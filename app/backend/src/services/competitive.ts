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
