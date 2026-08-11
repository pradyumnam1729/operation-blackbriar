import { supabase } from "./db";
import { ask } from "./claude";
import { markdownToHtml } from "./html";
import { chunksToContext, retrieveChunks } from "./ingestion";
import { parseSwot, parseThreatTiers } from "./competitiveParsing";
import {
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";

export type { SwotItem, ThreatTierEntry } from "./competitiveParsing";

// Framework engine (Phase 2 of the competitive ELT gap analysis). Every
// framework shares one evidence discipline: competitor facts only from
// enabled, scraped sources; Aurigo facts only from the knowledge base;
// competitors without evidence are skipped with a reason, never guessed.
// Each model-backed framework is an admin-tunable agents-registry row
// (fw-*): the analysis philosophy is overridable, the JSON result schema is
// locked here in code.

export type FrameworkKey = "threat-tiers" | "swot" | "delta-timeline";

export const FRAMEWORK_KEYS: FrameworkKey[] = ["threat-tiers", "swot", "delta-timeline"];

export interface FrameworkAnalysis {
  id: string;
  frameworkKey: FrameworkKey;
  params: Record<string, unknown>;
  result: unknown;
  summaryHtml: string | null;
  evidence: unknown[];
  skipped: { name: string; reason: string }[];
  createdAt: string;
}

interface AnalysisRow {
  id: string;
  framework_key: string;
  params: Record<string, unknown> | null;
  result: unknown;
  summary_html: string | null;
  evidence: unknown[] | null;
  skipped: { name: string; reason: string }[] | null;
  created_at: string;
}

const COLS = "id, framework_key, params, result, summary_html, evidence, skipped, created_at";

function rowToAnalysis(r: AnalysisRow): FrameworkAnalysis {
  return {
    id: r.id,
    frameworkKey: r.framework_key as FrameworkKey,
    params: r.params ?? {},
    result: r.result,
    summaryHtml: r.summary_html,
    evidence: r.evidence ?? [],
    skipped: r.skipped ?? [],
    createdAt: r.created_at,
  };
}

// ---------- shared evidence assembly ----------

interface CompetitorEvidence {
  id: string;
  name: string;
  category: string | null;
  context: string;
  urls: string[];
}

/** Max sources per competitor in a framework prompt (QA S6): a full-registry
 *  threat-tiers build over post-bootstrap source counts must not blow the
 *  model context. Newest sources win. */
const MAX_SOURCES_PER_COMPETITOR = 3;

/** Competitor blocks from enabled+ok scraped sources only; evidence-less
 *  competitors land in skipped. The one assembly every framework consumes —
 *  no framework may fetch its own web content. */
async function assembleCompetitorEvidence(
  competitorIds: string[] | null,
  perSourceCap: number
): Promise<{ withEvidence: CompetitorEvidence[]; skipped: { name: string; reason: string }[] }> {
  const sb = supabase()!;
  const { data: comps } = await sb.from("competitors").select("id, name, category");
  const scoped =
    competitorIds && competitorIds.length > 0
      ? (comps ?? []).filter((c) => competitorIds.includes(c.id))
      : (comps ?? []);
  const { data: srcs } = await sb
    .from("competitor_sources")
    .select("competitor_id, url, label, content_md, scraped_at, source_type, enabled")
    .eq("status", "ok");

  const withEvidence: CompetitorEvidence[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const c of scoped) {
    const own = (srcs ?? [])
      .filter((s) => s.competitor_id === c.id && s.content_md && s.enabled !== false)
      .sort((a, b) => String(b.scraped_at ?? "").localeCompare(String(a.scraped_at ?? "")))
      .slice(0, MAX_SOURCES_PER_COMPETITOR);
    if (own.length === 0) {
      skipped.push({ name: c.name, reason: "no scraped sources yet — track it in the registry" });
      continue;
    }
    const context = own
      .map(
        (s) =>
          `<source url="${s.url}" type="${s.source_type ?? "official"}" title="${s.label ?? ""}" scraped="${s.scraped_at ?? ""}">\n${(s.content_md ?? "").slice(0, perSourceCap)}\n</source>`
      )
      .join("\n");
    withEvidence.push({
      id: c.id,
      name: c.name,
      category: c.category,
      context,
      urls: own.map((s) => String(s.url).replace(/\/+$/, "")),
    });
  }
  return { withEvidence, skipped };
}

/** Dedupe skipped-lists merged from the assembler and the model (QA N6). */
function dedupeSkipped(
  lists: { name: string; reason: string }[][]
): { name: string; reason: string }[] {
  const seen = new Map<string, { name: string; reason: string }>();
  for (const list of lists) for (const s of list) if (!seen.has(s.name)) seen.set(s.name, s);
  return [...seen.values()];
}

async function recentEventsBlock(days: number): Promise<string> {
  const sb = supabase()!;
  const since = new Date(Date.now() - days * 24 * 3_600_000).toISOString();
  const { data } = await sb
    .from("competitor_events")
    .select("event_type, severity, title, summary_md, created_at, competitors(name)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);
  if (!data || data.length === 0) return "";
  const lines = data.map((e) => {
    const name = (e as unknown as { competitors: { name: string } | null }).competitors?.name ?? "?";
    return `- ${String(e.created_at).slice(0, 10)} [${e.severity}/${e.event_type}] ${name}: ${e.title}${e.summary_md ? ` — ${String(e.summary_md).slice(0, 200)}` : ""}`;
  });
  return `=== RECENT CHANGE EVENTS (last ${days} days, from tracked sources) ===\n${lines.join("\n")}`;
}

// ---------- threat tiers ----------

const THREAT_TIERS_SUFFIX = `Respond with ONLY a JSON object — no prose before or after — shaped exactly:
{"entries": [{"competitor": string, "tier": 1 | 2 | 3, "rationale": string, "trajectory": "rising" | "stable" | "fading", "watch_items": [string]}], "skipped": [{"name": string, "reason": string}], "summary": string}
- One entry per competitor that has usable evidence. Skipped: competitors whose evidence cannot support an honest tier, or EAM platforms Aurigo integrates with.
- summary: 2-4 sentences (markdown) on the board's headline for leadership. Use "AI-native" as the only AI modifier and write "life cycle" as two words.`;

// ---------- SWOT ----------

const SWOT_SUFFIX = `Respond with ONLY a JSON object — no prose before or after — shaped exactly:
{"strengths": [{"text": string, "evidence_url": string}], "weaknesses": [{"text": string, "evidence_url": string}], "opportunities": [{"text": string}], "threats": [{"text": string}], "summary": string}
- strengths/weaknesses: THEIR strengths and weaknesses, each citing the scraped source URL it came from. Omit items you cannot cite.
- opportunities/threats: Aurigo-side implications (the system labels these internal inference; no evidence_url needed).
- summary: 2-3 sentences (markdown). Use "AI-native" as the only AI modifier and write "life cycle" as two words.`;

// ---------- delta timeline (no model call) ----------

async function buildDeltaTimeline(): Promise<{
  weeks: { weekStart: string; events: { competitor: string; severity: string; event_type: string; title: string; created_at: string }[] }[];
}> {
  const sb = supabase()!;
  const since = new Date(Date.now() - 90 * 24 * 3_600_000).toISOString();
  const { data } = await sb
    .from("competitor_events")
    .select("event_type, severity, title, created_at, competitors(name)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  const byWeek = new Map<string, { competitor: string; severity: string; event_type: string; title: string; created_at: string }[]>();
  for (const e of data ?? []) {
    const d = new Date(e.created_at as string);
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const name = (e as unknown as { competitors: { name: string } | null }).competitors?.name ?? "?";
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push({
      competitor: name,
      severity: String(e.severity),
      event_type: String(e.event_type),
      title: String(e.title),
      created_at: String(e.created_at),
    });
  }
  return {
    weeks: [...byWeek.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([weekStart, events]) => ({ weekStart, events })),
  };
}

// ---------- build / read ----------

async function store(
  key: FrameworkKey,
  params: Record<string, unknown>,
  result: unknown,
  summary: string | null,
  evidence: unknown[],
  skipped: { name: string; reason: string }[],
  userId: string
): Promise<FrameworkAnalysis> {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("framework_analyses")
    .insert({
      framework_key: key,
      params,
      result,
      summary_html: summary ? markdownToHtml(summary) : null,
      evidence,
      skipped,
      created_by: userId,
    })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not store the analysis");
  return rowToAnalysis(data as AnalysisRow);
}

export async function buildFramework(
  key: FrameworkKey,
  params: { competitorId?: string; competitorIds?: string[] },
  userId: string
): Promise<FrameworkAnalysis> {
  if (key === "delta-timeline") {
    const result = await buildDeltaTimeline();
    return store(key, {}, result, null, [], [], userId);
  }

  if (key === "threat-tiers") {
    const cfg = await getAgentConfig("fw-threat-tiers");
    assertAgentEnabled(cfg);
    const { withEvidence, skipped } = await assembleCompetitorEvidence(
      params.competitorIds ?? null,
      8_000
    );
    if (withEvidence.length === 0) {
      throw new Error("No competitor has scraped sources yet — track competitors first.");
    }
    const events = await recentEventsBlock(30);
    const suffix = [
      THREAT_TIERS_SUFFIX,
      withEvidence
        .map((c) => `=== COMPETITOR: ${c.name}${c.category ? ` (${c.category})` : ""} ===\n${c.context}`)
        .join("\n\n"),
      events,
    ]
      .filter((s) => s !== "")
      .join("\n\n");
    const raw = await ask(composeAgentPrompt(cfg, {}, suffix), {
      maxTokens: 4000,
      model: resolveModel(cfg),
    });
    const parsed = parseThreatTiers(raw);
    if (!parsed) throw new Error("The model did not return a usable threat board. Try again.");
    return store(
      key,
      params.competitorIds ? { competitorIds: params.competitorIds } : {},
      { entries: parsed.entries },
      parsed.summary,
      withEvidence.map((c) => ({ competitor: c.name })),
      dedupeSkipped([skipped, parsed.skipped]),
      userId
    );
  }

  // SWOT — one competitor per analysis.
  if (!params.competitorId) throw new Error("Pick a competitor for the SWOT.");
  const cfg = await getAgentConfig("fw-swot");
  assertAgentEnabled(cfg);
  const { withEvidence, skipped } = await assembleCompetitorEvidence([params.competitorId], 15_000);
  if (withEvidence.length === 0) {
    throw new Error(
      `${skipped[0]?.name ?? "This competitor"} has no scraped sources yet — track it in the registry first.`
    );
  }
  const c = withEvidence[0];
  const chunks = await retrieveChunks(
    `positioning differentiators value propositions ${c.name}`,
    8
  );
  const suffix = [
    SWOT_SUFFIX,
    `=== COMPETITOR: ${c.name}${c.category ? ` (${c.category})` : ""} ===\n${c.context}`,
    chunks.length > 0
      ? `=== AURIGO KNOWLEDGE BASE (for opportunities/threats only) ===\n${chunksToContext(chunks)}`
      : "",
  ]
    .filter((s) => s !== "")
    .join("\n\n");
  const raw = await ask(composeAgentPrompt(cfg, {}, suffix), {
    maxTokens: 3000,
    model: resolveModel(cfg),
  });
  // Citations verified against the exact URLs that fed the prompt (QA S4):
  // a fabricated evidence_url is dropped before it can render as a source link.
  const parsed = parseSwot(raw, new Set(c.urls));
  if (!parsed) throw new Error("The model did not return a usable SWOT. Try again.");
  return store(
    "swot",
    { competitorId: params.competitorId, competitor: c.name },
    {
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      opportunities: parsed.opportunities,
      threats: parsed.threats,
    },
    parsed.summary,
    chunks.map((k) => ({ title: k.title, docType: k.doc_type })),
    skipped,
    userId
  );
}

export async function getLatestFramework(
  key: FrameworkKey,
  params?: { competitorId?: string }
): Promise<FrameworkAnalysis | null> {
  const sb = supabase()!;
  let q = sb
    .from("framework_analyses")
    .select(COLS)
    .eq("framework_key", key)
    .order("created_at", { ascending: false })
    .limit(1);
  if (key === "swot" && params?.competitorId) {
    q = q.eq("params->>competitorId", params.competitorId);
  }
  const { data } = await q.maybeSingle();
  return data ? rowToAnalysis(data as AnalysisRow) : null;
}

export async function getFrameworkHistory(key: FrameworkKey, limit = 10): Promise<FrameworkAnalysis[]> {
  const sb = supabase()!;
  const { data } = await sb
    .from("framework_analyses")
    .select(COLS)
    .eq("framework_key", key)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 24));
  return ((data ?? []) as AnalysisRow[]).map(rowToAnalysis);
}

export { THREAT_TIERS_SUFFIX, SWOT_SUFFIX };
