import crypto from "crypto";
import { supabase } from "./db";
import { ask } from "./claude";
import { cleanHtml, markdownToHtml, htmlToText } from "./html";
import { chunksToContext, retrieveChunks } from "./ingestion";
import { readUrl, searchWeb } from "./jina";
import { checkForbiddenWords } from "./guardrails";
import { logActivity } from "./activity";
import { TemplateSlot, renderTemplate, validateFills } from "./templateRender";
import { askFills, buildTrimPrompt } from "./templateGenerate";
import {
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";
import { COMPETITIVE_EVIDENCE_RULES, COMPETITIVE_PRODUCT_MAP } from "./agentPrompts";

export class CompetitiveIntelError extends Error {
  constructor(message: string, readonly status: number, readonly violations: string[] = []) {
    super(message);
  }
}

// Competitive Intelligence engine. Competitor facts come ONLY from scraped
// sources (Jina Reader); Aurigo facts come ONLY from the knowledge base
// (local folders + uploads) and the war room. The model is instructed to say
// "not confirmed in available sources" rather than invent.
//
// PRODUCT_MAP + EVIDENCE_RULES are the `competitive-compare` agent's
// overridable body (canonical text in agentPrompts.ts, re-exported here); the
// scraped-sources / knowledge-base / question blocks are locked runtime
// structure appended by composeAgentPrompt (Agents blueprint §2.2-3).

const STALE_DAYS = 30;

// Aurigo product mapping — the routing brief given to the model verbatim.
export const PRODUCT_MAP = COMPETITIVE_PRODUCT_MAP;

export const EVIDENCE_RULES = COMPETITIVE_EVIDENCE_RULES;

export interface CompetitorRow {
  id: string;
  name: string;
  aliases: string[];
  website: string | null;
  category: string | null;
  aurigo_product: string | null;
}

export async function findCompetitorInText(text: string): Promise<CompetitorRow | null> {
  const sb = supabase()!;
  const { data } = await sb
    .from("competitors")
    .select("id, name, aliases, website, category, aurigo_product");
  const lower = text.toLowerCase();
  let best: CompetitorRow | null = null;
  for (const c of (data ?? []) as CompetitorRow[]) {
    const names = [c.name, ...(c.aliases ?? [])];
    if (names.some((n) => n && lower.includes(n.toLowerCase()))) {
      // Prefer the longest matching name (\"Oracle Primavera Unifier\" over \"Oracle\").
      if (!best || c.name.length > best.name.length) best = c;
    }
  }
  return best;
}

/** Normalize so https://x.com and https://x.com/ don't become two sources. */
export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Priority URLs not already covered by the competitor's saved sources, deduped. */
export function excludeKnownUrls(priorityUrls: string[], existingUrls: string[]): string[] {
  const known = new Set(existingUrls.map(normalizeUrl));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of priorityUrls) {
    const url = normalizeUrl(raw);
    if (url === "" || known.has(url) || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

/** True only when a source that was already scraped successfully once now hashes differently. */
export function shouldFlagSiteChange(wasOk: boolean, previousHash: string | null, newHash: string): boolean {
  return wasOk && previousHash !== null && previousHash !== newHash;
}

/** Discover 2-3 source URLs for a competitor: official site/product page + a review page. */
export async function discoverSources(competitor: CompetitorRow): Promise<string[]> {
  const urls: string[] = [];
  if (competitor.website) urls.push(normalizeUrl(competitor.website));

  try {
    if (!competitor.website) {
      const hits = await searchWeb(`${competitor.name} construction capital program software official site`);
      const official = hits.find((h) => !/g2\.com|capterra|reddit|wikipedia|linkedin/i.test(h.url));
      if (official) urls.push(official.url);
    }
    const reviewHits = await searchWeb(`${competitor.name} G2 reviews`);
    const review = reviewHits.find((h) => /g2\.com|capterra\.com|trustradius\.com/i.test(h.url));
    if (review) urls.push(review.url);

    const productHits = await searchWeb(`${competitor.name} product features platform`);
    const domain = competitor.website ? new URL(competitor.website).hostname.replace(/^www\./, "") : null;
    const productPage = productHits.find(
      (h) => domain && h.url.includes(domain) && !urls.includes(h.url)
    );
    if (productPage) urls.push(productPage.url);
  } catch (err) {
    console.error(`source discovery failed for ${competitor.name}:`, (err as Error).message);
  }
  return [...new Set(urls.map(normalizeUrl))].slice(0, 3);
}

interface SourceRow {
  id: string;
  url: string;
  label: string | null;
  content_md: string | null;
  content_hash?: string | null;
  status: string;
  scraped_at: string | null;
}

/** Make sure the competitor has scraped, fresh sources. Returns usable sources. */
export async function ensureSources(competitor: CompetitorRow): Promise<SourceRow[]> {
  const sb = supabase()!;
  let { data: sources } = await sb
    .from("competitor_sources")
    .select("id, url, label, content_md, content_hash, status, scraped_at")
    .eq("competitor_id", competitor.id);

  if (!sources || sources.length === 0) {
    const urls = await discoverSources(competitor);
    for (const url of urls) {
      await sb
        .from("competitor_sources")
        .upsert(
          { competitor_id: competitor.id, url, status: "pending" },
          { onConflict: "competitor_id,url" }
        );
    }
    const re = await sb
      .from("competitor_sources")
      .select("id, url, label, content_md, content_hash, status, scraped_at")
      .eq("competitor_id", competitor.id);
    sources = re.data;
  }

  const staleCutoff = Date.now() - STALE_DAYS * 24 * 3600 * 1000;
  for (const s of sources ?? []) {
    const needsScrape =
      s.status !== "ok" ||
      !s.content_md ||
      !s.scraped_at ||
      new Date(s.scraped_at).getTime() < staleCutoff;
    if (!needsScrape) continue;
    const wasOk = s.status === "ok";
    const previousHash = (s as { content_hash?: string | null }).content_hash ?? null;
    try {
      const page = await readUrl(s.url);
      const hash = crypto.createHash("sha256").update(page.content).digest("hex");
      await sb
        .from("competitor_sources")
        .update({
          content_md: page.content,
          content_hash: hash,
          label: page.title.slice(0, 200),
          status: "ok",
          error: null,
          scraped_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      s.content_md = page.content;
      s.status = "ok";
      s.label = page.title;
      s.scraped_at = new Date().toISOString();
      // Site Change news items descoped for now (user decision, 2026-08-12) — feature
      // stays intact below (shouldFlagSiteChange/flagSiteChange), just not invoked.
      void wasOk;
      void previousHash;
      void hash;
    } catch (err) {
      const msg = (err as Error).message;
      await sb.from("competitor_sources").update({ status: "failed", error: msg }).eq("id", s.id);
      s.status = "failed";
      console.error(`scrape failed for ${s.url}: ${msg}`);
    }
  }
  return (sources ?? []).filter((s) => s.status === "ok" && s.content_md);
}

/** A source's content changed since the last scrape — log it as a Site Change news item. */
async function flagSiteChange(competitor: CompetitorRow, url: string, label: string): Promise<void> {
  const sb = supabase()!;
  const summary = await ask(
    `The page "${label}" (${url}) for competitor "${competitor.name}" changed since it was last scraped. In one sentence, note that a change was detected and that a PMM should review the page directly (you don't have the old vs new diff, just note the change was detected).`,
    { maxTokens: 200 }
  );
  await sb.from("news_items").insert({
    competitor_id: competitor.id,
    headline: `${competitor.name}: site change detected on ${label}`,
    summary_html: markdownToHtml(summary),
    source_url: url,
    category: "Site Change",
    priority: "normal",
    status: "approved",
  });
}

export interface CompareResult {
  comparisonId: string;
  answerHtml: string;
  competitor: string;
  aurigoProduct: string | null;
  sources: { url: string; label: string | null; scrapedAt: string | null }[];
  aurigoEvidence: { title: string; docType: string }[];
}

export async function compare(
  question: string,
  competitorId: string | null,
  productOverride: string | null,
  userId: string
): Promise<CompareResult> {
  const sb = supabase()!;

  let competitor: CompetitorRow | null = null;
  if (competitorId) {
    const { data } = await sb
      .from("competitors")
      .select("id, name, aliases, website, category, aurigo_product")
      .eq("id", competitorId)
      .single();
    competitor = data as CompetitorRow | null;
  } else {
    competitor = await findCompetitorInText(question);
  }
  if (!competitor) {
    throw new Error(
      "Could not tell which competitor this is about. Pick one from the registry (or add it) and ask again."
    );
  }

  const sources = await ensureSources(competitor);
  if (sources.length === 0) {
    throw new Error(
      `No scrapeable sources for ${competitor.name} yet. Add a source URL on the Competitive Intel page and retry.`
    );
  }

  // Agent config (Agents tab): body = prompt_override ?? PRODUCT_MAP+EVIDENCE_RULES.
  // Disabled agent -> AgentError(409), mapped by the route (kill switch, §0.1-5).
  const cfg = await getAgentConfig("competitive-compare");
  assertAgentEnabled(cfg);

  const chunks = await retrieveChunks(`${question} ${competitor.name}`, 10);
  const productHint = productOverride ?? competitor.aurigo_product;

  const competitorContext = sources
    .map(
      (s) =>
        `<competitor_source url="${s.url}" title="${s.label ?? ""}" scraped="${s.scraped_at ?? ""}">\n${(s.content_md ?? "").slice(0, 40_000)}\n</competitor_source>`
    )
    .join("\n\n");

  // Locked runtime structure. Documented ordering delta (§2.2-3): the registry
  // hint line now follows the whole body instead of sitting between PRODUCT_MAP
  // and EVIDENCE_RULES — advisory, not structural.
  const lockedSuffix = [
    productHint ? `Registry hint: this competitor is usually compared against Aurigo ${productHint}. Override only if the question clearly targets a different market.` : "",
    "=== SCRAPED COMPETITOR SOURCES ===",
    competitorContext,
    chunks.length > 0 ? `=== AURIGO KNOWLEDGE BASE (ground truth) ===\n${chunksToContext(chunks)}` : "",
    `=== QUESTION (from a GTM teammate) ===\nCompetitor: ${competitor.name}\n${question}`,
  ]
    .filter((s) => s !== "")
    .join("\n\n");

  const prompt = composeAgentPrompt(cfg, {}, lockedSuffix);

  const sourceMeta = sources.map((s) => ({
    url: s.url,
    label: s.label,
    scrapedAt: s.scraped_at,
  }));
  const evidenceMeta = chunks.map((c) => ({ title: c.title, docType: c.doc_type }));

  try {
    const md = await ask(prompt, { maxTokens: 8000, model: resolveModel(cfg) });
    const answerHtml = markdownToHtml(md);
    const { data: row } = await sb
      .from("comparisons")
      .insert({
        competitor_id: competitor.id,
        question,
        aurigo_product: productHint,
        answer_html: answerHtml,
        sources: sourceMeta,
        aurigo_evidence: evidenceMeta,
        status: "ok",
        created_by: userId,
      })
      .select("id")
      .single();
    return {
      comparisonId: row?.id ?? "",
      answerHtml,
      competitor: competitor.name,
      aurigoProduct: productHint,
      sources: sourceMeta,
      aurigoEvidence: evidenceMeta,
    };
  } catch (err) {
    await sb.from("comparisons").insert({
      competitor_id: competitor.id,
      question,
      aurigo_product: productHint,
      status: "failed",
      error: (err as Error).message,
      sources: sourceMeta,
      created_by: userId,
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Live positioning map. Same evidence discipline as compare(): Aurigo points
// are grounded in the knowledge base (which includes customer conversations);
// competitor points come only from their scraped sources — competitors with
// no usable evidence are skipped, never guessed.

export interface PositioningAxis {
  label: string;
  low: string;
  high: string;
}

export interface PositioningPoint {
  name: string;
  type: "aurigo" | "competitor";
  x: number;
  y: number;
  size: number;
  note: string | null;
}

export interface QuadrantLabels {
  top_left: string;
  top_right: string;
  bottom_left: string;
  bottom_right: string;
}

export interface PositioningMapParams {
  xAxis?: PositioningAxis;
  yAxis?: PositioningAxis;
  products?: string[];
  competitorIds?: string[];
}

export interface PositioningMap {
  id: string;
  xAxis: PositioningAxis;
  yAxis: PositioningAxis;
  quadrants: QuadrantLabels | null;
  points: PositioningPoint[];
  skipped: { name: string; reason: string }[];
  summaryHtml: string | null;
  evidence: { title: string; docType: string }[];
  params: PositioningMapParams;
  createdAt: string;
}

interface MapRow {
  id: string;
  x_axis: PositioningAxis;
  y_axis: PositioningAxis;
  quadrants: QuadrantLabels | null;
  points: PositioningPoint[];
  skipped: { name: string; reason: string }[];
  summary_html: string | null;
  evidence: { title: string; docType: string }[];
  params: PositioningMapParams | null;
  created_at: string;
}

const MAP_COLS =
  "id, x_axis, y_axis, quadrants, points, skipped, summary_html, evidence, params, created_at";

function rowToMap(row: MapRow): PositioningMap {
  return {
    id: row.id,
    xAxis: row.x_axis,
    yAxis: row.y_axis,
    quadrants: row.quadrants ?? null,
    points: (row.points ?? []).map((p) => ({
      ...p,
      size: Number.isFinite(Number(p.size)) ? Number(p.size) : 60,
    })),
    skipped: row.skipped ?? [],
    summaryHtml: row.summary_html,
    evidence: row.evidence ?? [],
    params: row.params ?? {},
    createdAt: row.created_at,
  };
}

export async function getLatestPositioningMap(): Promise<PositioningMap | null> {
  const sb = supabase()!;
  const { data } = await sb
    .from("positioning_maps")
    .select(MAP_COLS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToMap(data as MapRow) : null;
}

function isAxis(v: unknown): v is PositioningAxis {
  const o = v as Record<string, unknown> | null;
  return (
    !!o &&
    typeof o.label === "string" &&
    typeof o.low === "string" &&
    typeof o.high === "string"
  );
}

/** Defensively parse the model's answer: first {...} JSON block, validated. */
function parseMapAnswer(raw: string): {
  xAxis: PositioningAxis;
  yAxis: PositioningAxis;
  quadrants: QuadrantLabels | null;
  points: PositioningPoint[];
  skipped: { name: string; reason: string }[];
  summary: string | null;
} | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  if (!isAxis(o.x_axis) || !isAxis(o.y_axis) || !Array.isArray(o.points)) return null;

  const points: PositioningPoint[] = [];
  for (const entry of o.points) {
    const p = entry as Record<string, unknown>;
    const name = typeof p.name === "string" ? p.name.trim() : "";
    const x = Number(p.x);
    const y = Number(p.y);
    if (!name || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const size = Number(p.size);
    points.push({
      name,
      type: p.type === "aurigo" ? "aurigo" : "competitor",
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      size: Number.isFinite(size) ? Math.max(20, Math.min(100, size)) : 60,
      note: typeof p.note === "string" ? p.note : null,
    });
  }
  if (points.length < 2) return null;

  const q = o.quadrants as Record<string, unknown> | undefined;
  const quadrants: QuadrantLabels | null =
    q &&
    typeof q.top_left === "string" &&
    typeof q.top_right === "string" &&
    typeof q.bottom_left === "string" &&
    typeof q.bottom_right === "string"
      ? {
          top_left: q.top_left,
          top_right: q.top_right,
          bottom_left: q.bottom_left,
          bottom_right: q.bottom_right,
        }
      : null;

  const skipped = Array.isArray(o.skipped)
    ? (o.skipped as Record<string, unknown>[])
        .filter((s) => typeof s?.name === "string")
        .map((s) => ({
          name: s.name as string,
          reason: typeof s.reason === "string" ? s.reason : "insufficient evidence",
        }))
    : [];

  return {
    xAxis: o.x_axis,
    yAxis: o.y_axis,
    quadrants,
    points,
    skipped,
    summary: typeof o.summary === "string" ? o.summary : null,
  };
}

const MAP_AURIGO_PRODUCTS = ["Masterworks", "Masterworks AI", "Primus"];

export async function buildPositioningMap(
  userId: string,
  params: PositioningMapParams = {}
): Promise<PositioningMap> {
  const sb = supabase()!;

  const aurigoProducts =
    params.products && params.products.length > 0
      ? params.products.filter((p) => MAP_AURIGO_PRODUCTS.includes(p))
      : ["Masterworks", "Primus"];
  if (aurigoProducts.length === 0) {
    throw new Error("Pick at least one Aurigo product to place on the map.");
  }

  const { data: comps } = await sb
    .from("competitors")
    .select("id, name, category, aurigo_product");
  const scoped =
    params.competitorIds && params.competitorIds.length > 0
      ? (comps ?? []).filter((c) => params.competitorIds!.includes(c.id))
      : (comps ?? []);
  const { data: srcs } = await sb
    .from("competitor_sources")
    .select("competitor_id, url, label, content_md, scraped_at")
    .eq("status", "ok");

  const withEvidence: { name: string; category: string | null; context: string }[] = [];
  const preSkipped: { name: string; reason: string }[] = [];
  for (const c of scoped) {
    const own = (srcs ?? []).filter((s) => s.competitor_id === c.id && s.content_md);
    if (own.length === 0) {
      preSkipped.push({ name: c.name, reason: "no scraped sources yet — refresh it in the registry" });
      continue;
    }
    const context = own
      .map(
        (s) =>
          `<source url="${s.url}" title="${s.label ?? ""}">\n${(s.content_md ?? "").slice(0, 12_000)}\n</source>`
      )
      .join("\n");
    withEvidence.push({ name: c.name, category: c.category, context });
  }
  if (withEvidence.length === 0) {
    throw new Error(
      "None of the selected competitors have scraped sources. Refresh them in the registry, then build the map."
    );
  }

  const chunks = await retrieveChunks(
    `positioning value propositions differentiators customers ${aurigoProducts.join(" ")} ${params.xAxis?.label ?? ""} ${params.yAxis?.label ?? ""}`,
    12
  );

  const competitorBlock = withEvidence
    .map((c) => `=== COMPETITOR: ${c.name}${c.category ? ` (${c.category})` : ""} ===\n${c.context}`)
    .join("\n\n");

  const axisInstruction =
    params.xAxis && params.yAxis
      ? [
          `- Use EXACTLY these axes. X axis: "${params.xAxis.label}" (0 = ${params.xAxis.low}, 100 = ${params.xAxis.high}). Y axis: "${params.yAxis.label}" (0 = ${params.yAxis.low}, 100 = ${params.yAxis.high}). Echo them back verbatim in x_axis / y_axis.`,
        ]
      : [
          "- Choose the two axes that best separate this market based on the evidence (for example public-sector capital program focus vs. general construction, or full life cycle suite vs. point solution). low/high name the two ends of each axis.",
        ];

  const prompt = [
    "Build a market positioning map for Aurigo against the competitors below.",
    "Respond with ONLY a JSON object — no prose before or after — shaped exactly like:",
    '{"x_axis": {"label": string, "low": string, "high": string}, "y_axis": {"label": string, "low": string, "high": string}, "quadrants": {"top_left": string, "top_right": string, "bottom_left": string, "bottom_right": string}, "points": [{"name": string, "type": "aurigo" | "competitor", "x": number 0-100, "y": number 0-100, "size": number 20-100, "note": string}], "skipped": [{"name": string, "reason": string}], "summary": string}',
    "Rules:",
    ...axisInstruction,
    `- Place these Aurigo products as separate points with type "aurigo": ${aurigoProducts.join(", ")}. Ground them in the Aurigo knowledge base below (which includes customer conversations). Do not place any other Aurigo product.`,
    "- Place each competitor ONLY from facts present in its scraped sources. If the sources are too thin to place one honestly, leave it out of points and add it to skipped with a short reason. Never invent a placement.",
    "- size: evidence-weighted market presence on these axes, 20-100 — how strongly the available evidence supports this player's position (NOT company revenue).",
    "- quadrants: a 2-4 word label characterizing each quadrant of this map (top_left = low X / high Y, top_right = high X / high Y, bottom_left = low X / low Y, bottom_right = high X / low Y).",
    "- note: one sentence explaining the placement, citing what the evidence actually says.",
    '- summary: 3-5 sentences (markdown) on what the map reveals for Aurigo\'s position and open whitespace. Use "AI-native" as the only AI modifier and write "life cycle" as two words.',
    "",
    competitorBlock,
    chunks.length > 0
      ? `=== AURIGO KNOWLEDGE BASE (ground truth, incl. customer conversations) ===\n${chunksToContext(chunks)}`
      : "",
  ]
    .filter((s) => s !== "")
    .join("\n\n");

  const raw = await ask(prompt, { maxTokens: 4000 });
  const parsed = parseMapAnswer(raw);
  if (!parsed) {
    throw new Error("The model did not return a usable positioning map. Try again.");
  }

  const evidence = chunks.map((c) => ({ title: c.title, docType: c.doc_type }));
  const skipped = [...parsed.skipped, ...preSkipped];

  const { data: row, error } = await sb
    .from("positioning_maps")
    .insert({
      x_axis: params.xAxis ?? parsed.xAxis,
      y_axis: params.yAxis ?? parsed.yAxis,
      quadrants: parsed.quadrants,
      points: parsed.points,
      skipped,
      summary_html: parsed.summary ? markdownToHtml(parsed.summary) : null,
      evidence,
      params,
      created_by: userId,
    })
    .select(MAP_COLS)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Could not store the positioning map");
  return rowToMap(row as MapRow);
}

// ---------------------------------------------------------------------------
// CI Reports: admin-curated packaging of competitive research. Battlecards
// generate FROM an approved (final) report, not raw ad-hoc comparisons — the
// intelligence -> activation gate (Master Instructions routing rule).

export interface CiReportRow {
  id: string;
  competitor_id: string | null;
  aurigo_product: string | null;
  title: string;
  content_html: string;
  source_comparison_ids: string[];
  status: "draft" | "final" | "archived";
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

/** Same evidence pipeline as compare(), report-shaped prompt instead of Q&A. */
export async function generateCiReport(
  competitorId: string,
  productOverride: string | null,
  extraBrief: string | null,
  priorityUrls: string[],
  userId: string
): Promise<CiReportRow> {
  const sb = supabase()!;
  const { data: competitor } = await sb
    .from("competitors")
    .select("id, name, aliases, website, category, aurigo_product")
    .eq("id", competitorId)
    .single();
  if (!competitor) throw new CompetitiveIntelError("Competitor not found", 404);

  const sources = await ensureSources(competitor as CompetitorRow);
  if (sources.length === 0 && priorityUrls.length === 0) {
    throw new CompetitiveIntelError(
      `No scrapeable sources for ${competitor.name} yet. Add a source URL and retry.`,
      422
    );
  }
  const extraUrls = excludeKnownUrls(priorityUrls, sources.map((s) => s.url));
  const priorityBlocks: string[] = [];
  for (const url of extraUrls) {
    try {
      const page = await readUrl(url);
      priorityBlocks.push(`<priority_source url="${url}" title="${page.title}">\n${page.content.slice(0, 40_000)}\n</priority_source>`);
    } catch (err) {
      console.error(`priority URL scrape failed for ${url}:`, (err as Error).message);
    }
  }

  const productHint = productOverride ?? (competitor as CompetitorRow).aurigo_product;
  const chunks = await retrieveChunks(`${competitor.name} ${productHint ?? ""} competitive positioning`, 10);

  const competitorContext = sources
    .map(
      (s) =>
        `<competitor_source url="${s.url}" title="${s.label ?? ""}">\n${(s.content_md ?? "").slice(0, 40_000)}\n</competitor_source>`
    )
    .join("\n\n");

  const prompt = [
    PRODUCT_MAP,
    EVIDENCE_RULES,
    `Write a CI (competitive intelligence) report on ${competitor.name}${productHint ? ` for Aurigo ${productHint}` : ""}.`,
    "Structure it with these markdown headings: ## Executive summary, ## Recent moves, ## Pricing & packaging signals, ## Aurigo counter-positioning.",
    extraBrief ? `Additional brief: ${extraBrief}` : "",
    priorityBlocks.length > 0
      ? `The sources below marked <priority_source> were specifically flagged by the PMM as must-consider for this report — give them real weight in your analysis, don't just mention they exist.`
      : "",
    "=== SCRAPED COMPETITOR SOURCES ===",
    competitorContext,
    priorityBlocks.length > 0 ? `=== PMM-FLAGGED PRIORITY SOURCES ===\n${priorityBlocks.join("\n\n")}` : "",
    chunks.length > 0 ? `=== AURIGO KNOWLEDGE BASE (ground truth) ===\n${chunksToContext(chunks)}` : "",
  ]
    .filter((s) => s !== "")
    .join("\n\n");

  const md = await ask(prompt, { maxTokens: 6000 });
  // Transparency into what was actually scraped to build this report —
  // appended structurally, not left to the model to mention or omit.
  const allSourceUrls = [...sources.map((s) => ({ url: s.url, label: s.label })), ...extraUrls.map((url) => ({ url, label: url }))];
  const sourcesHtml = `<h2>Sources scraped</h2><ul>${allSourceUrls
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label ?? s.url}</a></li>`)
    .join("")}</ul>`;
  const contentHtml = markdownToHtml(md) + sourcesHtml;
  const title = `${competitor.name}${productHint ? ` vs Aurigo ${productHint}` : ""} — CI report`;

  const { data: row, error } = await sb
    .from("ci_reports")
    .insert({
      competitor_id: competitor.id,
      aurigo_product: productHint,
      title,
      content_html: contentHtml,
      status: "draft",
      created_by: userId,
    })
    .select("*")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Could not store the CI report");
  void logActivity("ci_report", row.id, userId, "generated", { competitor: competitor.name, priorityUrlCount: extraUrls.length });
  return row as CiReportRow;
}

export async function approveCiReport(id: string, userId: string): Promise<CiReportRow> {
  const sb = supabase()!;
  const { data } = await sb.from("ci_reports").select("*").eq("id", id).maybeSingle();
  if (!data) throw new CompetitiveIntelError("CI report not found", 404);
  const report = data as CiReportRow;
  if (report.status !== "draft") {
    throw new CompetitiveIntelError(`Only draft reports can be approved (current: '${report.status}').`, 409);
  }
  const guard = checkForbiddenWords(htmlToText(report.content_html));
  if (!guard.ok) {
    throw new CompetitiveIntelError(`Cannot approve — banned words found: ${guard.violations.join(", ")}`, 422, guard.violations);
  }
  const { data: row, error } = await sb
    .from("ci_reports")
    .update({ status: "final", approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Approval failed");
  void logActivity("ci_report", id, userId, "approved", {});
  return row as CiReportRow;
}

export interface BattlecardGenResult {
  artifactId: string;
  status: "final" | "draft";
  violations?: string[];
}

/** One approved CI report + one PMM-picked vertical + one battlecard template ->
 * one draft artifact in the PMM workspace. Deliberately does NOT touch
 * battlecard_links (the canonical-card table another workstream added) — the
 * two pre-existing battlecard routes in this file don't populate it either, so
 * this stays consistent with current behavior rather than introducing a second,
 * half-applied invariant. Always lands as "draft" — even when it passes the
 * banned-words guard — so a PMM admin explicitly promotes it to in_review/final
 * (CLAUDE.md non-negotiable #3: nothing ships without PMM approval). The guard
 * result is still surfaced via `violations` so reviewers see it up front. */
export async function generateCompetitiveBattlecard(
  reportId: string,
  templateId: string,
  vertical: string,
  userId: string
): Promise<BattlecardGenResult> {
  const sb = supabase()!;
  const { data: reportData } = await sb
    .from("ci_reports")
    .select("id, title, status, content_html, aurigo_product, competitor_id, competitors(name)")
    .eq("id", reportId)
    .maybeSingle();
  if (!reportData) throw new CompetitiveIntelError("CI report not found", 404);
  const report = reportData as unknown as CiReportRow & { competitors: { name: string } | null };
  // A separate report-approval step is no longer required before building a
  // battlecard from it — the battlecard itself always lands as "draft" and
  // goes through PMM review, so that's the one review gate now. Archived
  // reports are the only ones off-limits (superseded/stale evidence).
  if (report.status === "archived") {
    throw new CompetitiveIntelError(
      "This CI report is archived and can no longer be used to generate a battlecard.",
      409
    );
  }
  const competitorName = report.competitors?.name ?? "Competitor";
  const ourProduct = report.aurigo_product ?? "Aurigo";

  const { data: templateData } = await sb
    .from("templates")
    .select("id, name, format, body, slots, approved, asset_type")
    .eq("id", templateId)
    .maybeSingle();
  if (!templateData || templateData.asset_type !== "battlecard" || !templateData.approved) {
    throw new CompetitiveIntelError("Battlecard template not found or not approved", 404);
  }
  const slots = (templateData.slots ?? []) as TemplateSlot[];

  const { data: product } = report.aurigo_product
    ? await sb.from("products").select("id").ilike("name", `${report.aurigo_product}%`).limit(1).maybeSingle()
    : { data: null };

  const slotLines = slots
    .map((s) => {
      const shape =
        s.render === "lines"
          ? `One item per line, at most ${s.max_lines ?? 1} lines.`
          : "Single line of plain text.";
      return `- ${s.id}: ${s.purpose}. HARD LIMIT ${s.max_chars} characters — count them; shorter is fine, longer is rejected. ${shape}`;
    })
    .join("\n");
  const firstSlotId = slots[0]?.id ?? "slot_id";
  const prompt = [
    PRODUCT_MAP,
    EVIDENCE_RULES,
    `Fill a sales battlecard comparing Aurigo ${ourProduct} against ${competitorName}, targeted at the "${vertical}" vertical.`,
    "Base every claim about the competitor ONLY on the CI report below. Base every claim about Aurigo on the CI report's counter-positioning plus the product map above. Never invent facts, numbers, or quotes not present in the report.",
    "Slots to fill:",
    slotLines,
    "",
    'Return ONLY valid JSON — no fences, no commentary: {"fills": {"' + firstSlotId + '": "...", ... one key per slot id listed above}}',
    "",
    "=== CI REPORT ===",
    htmlToText(report.content_html),
  ].join("\n\n");

  let fills: Record<string, string>;
  try {
    fills = await askFills(prompt, "", undefined);
  } catch (err) {
    throw new CompetitiveIntelError(`Slot filling failed: ${(err as Error).message}. Nothing was created.`, 502);
  }

  const { ok, over } = validateFills(slots, fills);
  if (over.length > 0) {
    let retried: Record<string, string> = {};
    try {
      retried = await askFills(buildTrimPrompt(over, fills), "", undefined);
    } catch {
      retried = {};
    }
    const overSlots = slots.filter((s) => over.some((o) => o.slot_id === s.id));
    const second = validateFills(overSlots, retried);
    for (const o of over) {
      ok[o.slot_id] = (second.ok[o.slot_id] ?? "").trim();
    }
  }

  const { payload } = renderTemplate(templateData.format as "html", templateData.body as string, slots, ok);

  const digestParts = [`<h1>${report.title} — ${vertical}</h1>`];
  for (const slot of slots) {
    digestParts.push(`<h3>${slot.label}</h3><p>${(ok[slot.id] ?? "").replace(/\r?\n/g, "<br>") || "<em>(empty)</em>"}</p>`);
  }
  const digestHtml = cleanHtml(digestParts.join("\n"));

  const guard = checkForbiddenWords(htmlToText(digestHtml));
  const status: "final" | "draft" = "draft";

  const { data: artifact, error } = await sb
    .from("artifacts")
    .insert({
      title: `${templateData.name}: ${ourProduct} vs ${competitorName} (${vertical})`,
      asset_type: "battlecard",
      product_id: product?.id ?? null,
      competitor_id: report.competitor_id,
      vertical,
      persona: "Sales",
      status,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !artifact) throw new Error(error?.message ?? "Could not save the battlecard");

  await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: 1,
    content_html: digestHtml,
    note: `Generated from CI report "${report.title}" for the ${vertical} vertical`,
    created_by: userId,
  });
  await sb.from("artifact_renders").insert({
    artifact_id: artifact.id,
    version: 1,
    format: templateData.format,
    payload,
    slot_fills: ok,
    warnings: [],
    template_id: templateData.id,
    template_version: 1,
    ci_report_id: report.id,
    created_by: userId,
  });
  void logActivity("artifact", artifact.id, userId, "battlecard_from_ci_report_template", {
    ci_report_id: report.id,
    template_id: templateData.id,
    vertical,
  });

  return { artifactId: artifact.id, status, violations: guard.ok ? undefined : guard.violations };
}

// ---------------------------------------------------------------------------
// Market threats / new entrants: AI-drafted with a confidence score and a
// rationale, admin-approved before regular users see them.

export interface MarketThreatRow {
  id: string;
  name: string;
  aurigo_product: string | null;
  category: string | null;
  summary_html: string;
  rationale: string;
  confidence: number;
  source_url: string | null;
  status: "draft" | "final" | "archived";
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

interface ThreatDraft {
  summary: string;
  rationale: string;
  confidence: number;
}

/** Defensively parse the model's {summary, rationale, confidence} JSON. */
function parseThreatDraft(raw: string): ThreatDraft | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.summary !== "string" || typeof o.rationale !== "string") return null;
  const confidence = Number(o.confidence);
  if (!Number.isFinite(confidence)) return null;
  return { summary: o.summary, rationale: o.rationale, confidence: Math.max(0, Math.min(100, confidence)) };
}

export async function draftMarketThreat(
  name: string,
  product: string | null,
  url: string | null,
  userId: string
): Promise<MarketThreatRow> {
  const sb = supabase()!;
  let context = "";
  let sourceUrl: string | null = null;
  try {
    if (url && url.trim() !== "") {
      const page = await readUrl(url.trim());
      context = page.content.slice(0, 40_000);
      sourceUrl = url.trim();
    } else {
      const hits = await searchWeb(`${name} construction capital program software`);
      context = hits.map((h) => `${h.title} — ${h.url}\n${h.description}`).join("\n\n");
      sourceUrl = hits[0]?.url ?? null;
    }
  } catch (err) {
    console.error(`market threat research failed for ${name}:`, (err as Error).message);
  }

  const chunks = await retrieveChunks(`${name} ${product ?? ""} competitive threat market position`, 8);
  const prompt = [
    PRODUCT_MAP,
    `Assess whether "${name}" is a genuine competitive threat or new entrant${product ? ` against Aurigo ${product}` : ""}.`,
    "Respond with ONLY a JSON object, no prose before or after:",
    '{"summary": string (markdown, what this is and why it matters), "rationale": string (specifically why this was flagged as a threat, citing evidence), "confidence": number 0-100 (how confident you are this is a real, current threat)}',
    "If the evidence is thin, say so plainly in rationale and give a low confidence score rather than guessing.",
    context ? `=== RESEARCH ===\n${context}` : "=== RESEARCH ===\n(no web evidence found)",
    chunks.length > 0 ? `=== AURIGO KNOWLEDGE BASE ===\n${chunksToContext(chunks)}` : "",
  ]
    .filter((s) => s !== "")
    .join("\n\n");

  const raw = await ask(prompt, { maxTokens: 2000 });
  const parsed = parseThreatDraft(raw);
  if (!parsed) throw new Error("The model did not return a usable threat assessment. Try again.");

  const { data: row, error } = await sb
    .from("market_threats")
    .insert({
      name,
      aurigo_product: product,
      summary_html: markdownToHtml(parsed.summary),
      rationale: parsed.rationale,
      confidence: parsed.confidence,
      source_url: sourceUrl,
      status: "draft",
      created_by: userId,
    })
    .select("*")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Could not store the market threat");
  void logActivity("market_threat", row.id, userId, "drafted", { name, confidence: parsed.confidence });
  return row as MarketThreatRow;
}

export async function approveMarketThreat(id: string, userId: string): Promise<MarketThreatRow> {
  const sb = supabase()!;
  const { data } = await sb.from("market_threats").select("*").eq("id", id).maybeSingle();
  if (!data) throw new CompetitiveIntelError("Market threat not found", 404);
  const threat = data as MarketThreatRow;
  if (threat.status !== "draft") {
    throw new CompetitiveIntelError(`Only draft entries can be approved (current: '${threat.status}').`, 409);
  }
  const { data: row, error } = await sb
    .from("market_threats")
    .update({ status: "final", approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Approval failed");
  void logActivity("market_threat", id, userId, "approved", {});
  return row as MarketThreatRow;
}
