import crypto from "crypto";
import { supabase } from "./db";
import { ask } from "./claude";
import { markdownToHtml } from "./html";
import { chunksToContext, retrieveChunks } from "./ingestion";
import { readUrl, searchWeb } from "./jina";
import {
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";
import { COMPETITIVE_EVIDENCE_RULES, COMPETITIVE_PRODUCT_MAP } from "./agentPrompts";

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
function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
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
  status: string;
  scraped_at: string | null;
}

/** Make sure the competitor has scraped, fresh sources. Returns usable sources. */
export async function ensureSources(competitor: CompetitorRow): Promise<SourceRow[]> {
  const sb = supabase()!;
  let { data: sources } = await sb
    .from("competitor_sources")
    .select("id, url, label, content_md, status, scraped_at")
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
      .select("id, url, label, content_md, status, scraped_at")
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
    } catch (err) {
      const msg = (err as Error).message;
      await sb.from("competitor_sources").update({ status: "failed", error: msg }).eq("id", s.id);
      s.status = "failed";
      console.error(`scrape failed for ${s.url}: ${msg}`);
    }
  }
  return (sources ?? []).filter((s) => s.status === "ok" && s.content_md);
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
  note: string | null;
}

export interface PositioningMap {
  id: string;
  xAxis: PositioningAxis;
  yAxis: PositioningAxis;
  points: PositioningPoint[];
  skipped: { name: string; reason: string }[];
  summaryHtml: string | null;
  evidence: { title: string; docType: string }[];
  createdAt: string;
}

interface MapRow {
  id: string;
  x_axis: PositioningAxis;
  y_axis: PositioningAxis;
  points: PositioningPoint[];
  skipped: { name: string; reason: string }[];
  summary_html: string | null;
  evidence: { title: string; docType: string }[];
  created_at: string;
}

function rowToMap(row: MapRow): PositioningMap {
  return {
    id: row.id,
    xAxis: row.x_axis,
    yAxis: row.y_axis,
    points: row.points,
    skipped: row.skipped ?? [],
    summaryHtml: row.summary_html,
    evidence: row.evidence ?? [],
    createdAt: row.created_at,
  };
}

export async function getLatestPositioningMap(): Promise<PositioningMap | null> {
  const sb = supabase()!;
  const { data } = await sb
    .from("positioning_maps")
    .select("id, x_axis, y_axis, points, skipped, summary_html, evidence, created_at")
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
    points.push({
      name,
      type: p.type === "aurigo" ? "aurigo" : "competitor",
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      note: typeof p.note === "string" ? p.note : null,
    });
  }
  if (points.length < 2) return null;

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
    points,
    skipped,
    summary: typeof o.summary === "string" ? o.summary : null,
  };
}

export async function buildPositioningMap(userId: string): Promise<PositioningMap> {
  const sb = supabase()!;

  const { data: comps } = await sb
    .from("competitors")
    .select("id, name, category, aurigo_product");
  const { data: srcs } = await sb
    .from("competitor_sources")
    .select("competitor_id, url, label, content_md, scraped_at")
    .eq("status", "ok");

  const withEvidence: { name: string; category: string | null; context: string }[] = [];
  const preSkipped: { name: string; reason: string }[] = [];
  for (const c of comps ?? []) {
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
      "No competitor has scraped sources yet. Refresh a competitor in the registry, then build the map."
    );
  }

  const chunks = await retrieveChunks(
    "positioning value propositions differentiators customers capital program asset management public sector",
    12
  );

  const competitorBlock = withEvidence
    .map((c) => `=== COMPETITOR: ${c.name}${c.category ? ` (${c.category})` : ""} ===\n${c.context}`)
    .join("\n\n");

  const prompt = [
    "Build a market positioning map for Aurigo against the competitors below.",
    "Respond with ONLY a JSON object — no prose before or after — shaped exactly like:",
    '{"x_axis": {"label": string, "low": string, "high": string}, "y_axis": {"label": string, "low": string, "high": string}, "points": [{"name": string, "type": "aurigo" | "competitor", "x": number 0-100, "y": number 0-100, "note": string}], "skipped": [{"name": string, "reason": string}], "summary": string}',
    "Rules:",
    "- Choose the two axes that best separate this market based on the evidence (for example public-sector capital program focus vs. general construction, or full life cycle suite vs. point solution). low/high name the two ends of each axis.",
    '- Place the Aurigo products Masterworks, Primus, and Essentials as separate points with type "aurigo", grounded in the Aurigo knowledge base below (which includes customer conversations).',
    "- Place each competitor ONLY from facts present in its scraped sources. If the sources are too thin to place one honestly, leave it out of points and add it to skipped with a short reason. Never invent a placement.",
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
      x_axis: parsed.xAxis,
      y_axis: parsed.yAxis,
      points: parsed.points,
      skipped,
      summary_html: parsed.summary ? markdownToHtml(parsed.summary) : null,
      evidence,
      created_by: userId,
    })
    .select("id, x_axis, y_axis, points, skipped, summary_html, evidence, created_at")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Could not store the positioning map");
  return rowToMap(row as MapRow);
}
