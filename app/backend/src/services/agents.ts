import fs from "fs";
import path from "path";
import { supabase } from "./db";
import { REPO_ROOT } from "./warRoom";
import { parseModelJson } from "./questionnaire";
import { TemplateSlot, validateFills } from "./templateRender";
import {
  ASK_ROUTER_BASE_PROMPT,
  COMPETITIVE_BASE_PROMPT,
  DIGEST_BASE_PROMPT,
  EVENT_SUMMARY_BASE_PROMPT,
  EXTRACTION_BASE_PROMPT,
  FEATURE_MATRIX_BASE_PROMPT,
  FIVE_FORCES_BASE_PROMPT,
  MERGE_BASE_PROMPT,
  MESSAGING_DOC_BASE_PROMPT,
  ROLE_FRAMING,
  SLOT_FILL_BASE_PROMPT,
  SWOT_BASE_PROMPT,
  THREAT_TIERS_BASE_PROMPT,
} from "./agentPrompts";

// Agents registry + runtime composition layer (Agents tab blueprint §2.1).
// One table (`agents`, migration 0013) holds six task agents and the fourteen
// §12 PMM sub-agents. Services read their prompt through composeAgentPrompt:
//
//   final prompt = interpolate(prompt_override ?? base_prompt, vars)
//                + custom-instructions block (if any)
//                + LOCKED CONTRACT SUFFIX (code-owned, ALWAYS appended)
//
// The locked suffix lives in code, never in the DB (§0.1-2): it must stay
// byte-compatible with its parser (parseModelJson consumers, splitSections'
// heading regex, validateFills), so a full prompt override can change tone and
// policy but can never remove the output contract.

export type AgentKind = "task" | "pmm";
export type AgentContract =
  | "fq-answers-json"
  | "fills-json"
  | "section-headings"
  | "markdown"
  | "route-json"
  | "event-json"
  | "framework-json";

/** One row of the ask-router's template catalog (ask-to-artifact blueprint §4.1).
 *  Defined HERE (not in askRouter.ts) so the dependency stays one-way:
 *  askRouter.ts imports agents.ts, never the reverse (blueprint §7). */
export interface RouterCandidate {
  id: string;
  name: string;
  asset_type: string;
  product_line: string | null;
  audience: string | null;
  persona: string | null;
  funnel_stage: string | null;
}

export interface AgentConfig {
  id: string;
  key: string;
  kind: AgentKind;
  grp: string | null;
  name: string;
  description: string;
  base_prompt: string;
  custom_instructions: string;
  prompt_override: string | null;
  model: string | null;
  enabled: boolean;
  defaults: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
}

export const AGENT_MODEL_ALLOWLIST = ["claude-opus-4-8", "claude-sonnet-4-5", "claude-haiku-4-5"];
export const DEFAULT_AGENT_MODEL = process.env.PMM_MODEL ?? "claude-opus-4-8"; // mirrors claude.ts

export class AgentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Code-level registry: canonical base prompts (task), contract type,
 *  placeholder vocabulary, defaults schema, and revert targets. */
export interface AgentRegistryEntry {
  key: string;
  kind: AgentKind;
  grp?: "A" | "B" | "C";
  /** Display identity — also what the boot sync reconciles for task agents. */
  name: string;
  description: string;
  /** Task agents only: the canonical overridable body (agentPrompts.ts).
   *  PMM agents' canonical body is `.claude/agents/<key>.md` (§0.1-3). */
  basePrompt?: string;
  placeholders: string[];
  contract: AgentContract;
  /** Human-readable description of the `defaults` shape, shown in the drawer. */
  defaultsSchema: string;
  /** What revert restores `defaults` to (§0.1-4). */
  registryDefaults: Record<string, unknown>;
}

const NO_DEFAULTS = "No task defaults for this agent.";

function pmmEntry(
  key: string,
  grp: "A" | "B" | "C",
  name: string,
  description: string
): AgentRegistryEntry {
  return {
    key,
    kind: "pmm",
    grp,
    name,
    description,
    placeholders: [],
    contract: "markdown",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  };
}

/** Insertion order = display order: 6 task agents, then groups A, B, C. */
export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {
  "fq-extraction": {
    key: "fq-extraction",
    kind: "task",
    name: "Questionnaire extraction",
    description:
      "Evidence-extraction passes (transcripts + documents) for the Foundation Questionnaire. Answers the question bank with cited candidates only from ingested sources.",
    basePrompt: EXTRACTION_BASE_PROMPT,
    placeholders: ["product_name", "product_line", "source_type"],
    contract: "fq-answers-json",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "fq-merge": {
    key: "fq-merge",
    kind: "task",
    name: "Candidate merge & reconciliation",
    description:
      "Reconciles transcript and document extraction candidates into one merged proposal per question for the PMM review queue.",
    basePrompt: MERGE_BASE_PROMPT,
    placeholders: [],
    contract: "fq-answers-json",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "messaging-doc-generation": {
    key: "messaging-doc-generation",
    kind: "task",
    name: "Messaging document generation",
    description:
      "Generates the Positioning & Messaging document Part by Part from PMM-approved questionnaire answers (§3.2 chain: A feeds B feeds C/D/E).",
    basePrompt: MESSAGING_DOC_BASE_PROMPT,
    placeholders: ["part", "product_name"],
    contract: "section-headings",
    defaultsSchema:
      '{"section_instructions": {"<section id>": "<instruction>"}} — each entry overrides the built-in per-section generation instruction (e.g. retune the B2 pillar count) at run time; the code map stays the base.',
    registryDefaults: { section_instructions: {} },
  },
  "template-slot-fill": {
    key: "template-slot-fill",
    kind: "task",
    name: "Template slot fill",
    description:
      "Fills locked layout templates with approved messaging from the latest final messaging doc. Controls slot text only — never layout.",
    basePrompt: SLOT_FILL_BASE_PROMPT,
    placeholders: [
      "product_name",
      "product_line",
      "asset_type",
      "template_name",
      "audience",
      "persona",
      "funnel_stage",
      "doc_title",
      "doc_version",
    ],
    contract: "fills-json",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "ask-war-room": {
    key: "ask-war-room",
    kind: "task",
    name: "Ask the War Room",
    description: "Role-aware Q&A over the GTM War Room and knowledge base (§9.2 persona framing).",
    basePrompt: "",
    placeholders: ["role"],
    contract: "markdown",
    defaultsSchema:
      '{"role_framing": {"sales" | "proposals" | "marketing" | "leadership" | "product" | "cs" | "sdr" | "general": "<framing preamble>"}} — each entry overrides the built-in framing for that role. A full prompt override collapses all roles into one preamble ({{role}} is available).',
    registryDefaults: { role_framing: { ...ROLE_FRAMING } },
  },
  "competitive-compare": {
    key: "competitive-compare",
    kind: "task",
    name: "Competitive comparison",
    description:
      "Answers competitor questions from scraped competitor sources + Aurigo knowledge base only. Picks the competing Aurigo product per the mapping brief.",
    basePrompt: COMPETITIVE_BASE_PROMPT,
    placeholders: [],
    contract: "markdown",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "competitive-event-summary": {
    key: "competitive-event-summary",
    kind: "task",
    name: "Competitive change summarizer",
    description:
      "Classifies scraped-source diffs from competitor watch runs into delta-feed events (type, severity, title, summary). Judges the diff only — it never sees the full page. Disabled = raw content-changed events with no model summary; the watch pipeline is never blocked.",
    basePrompt: EVENT_SUMMARY_BASE_PROMPT,
    placeholders: [], // competitor, source, and diff all ride in the locked suffix
    contract: "event-json",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "ask-router": {
    key: "ask-router",
    kind: "task",
    name: "Ask router",
    description:
      "Classifies Ask-the-War-Room requests as questions or artifact requests; for artifact requests it proposes the template, product, and brief for a one-click-confirm generation. Disabled = classification skipped, every request is answered as a question.",
    basePrompt: ASK_ROUTER_BASE_PROMPT,
    placeholders: [], // question, role, catalog all ride in the locked suffix
    contract: "route-json",
    defaultsSchema:
      '{"min_confidence": 0.6} — artifact classifications below this confidence are treated as questions. 0 routes every artifact guess; 1 routes none.',
    registryDefaults: { min_confidence: 0.6 },
  },
  "fw-threat-tiers": {
    key: "fw-threat-tiers",
    kind: "task",
    name: "Framework: threat tiers",
    description:
      "Assigns tier 1/2/3 threat levels with trajectory and watch items, grounded only in scraped sources + recent change events. The result schema is locked by the framework engine; the tiering rubric here is the overridable part.",
    basePrompt: THREAT_TIERS_BASE_PROMPT,
    placeholders: [],
    contract: "framework-json",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "fw-swot": {
    key: "fw-swot",
    kind: "task",
    name: "Framework: SWOT",
    description:
      "Evidence-split SWOT per competitor: S/W from scraped sources only (cited), O/T as labeled Aurigo-side inference. Result schema locked by the framework engine.",
    basePrompt: SWOT_BASE_PROMPT,
    placeholders: [],
    contract: "framework-json",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "fw-five-forces": {
    key: "fw-five-forces",
    kind: "task",
    name: "Framework: Five Forces",
    description:
      "Porter's Five Forces for Aurigo's market. Every factor carries an evidence basis (scraped/internal/inference); a 'scraped' claim without a real citation is demoted to inference by the engine, never trusted. Result schema locked.",
    basePrompt: FIVE_FORCES_BASE_PROMPT,
    placeholders: [],
    contract: "framework-json",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "fw-feature-matrix": {
    key: "fw-feature-matrix",
    kind: "task",
    name: "Framework: capability matrix",
    description:
      "Aurigo-vs-competitors capability matrix. Positive competitor cells require a real citation or are demoted to not_confirmed; 'absent_from_sources' is first-class and never rendered as 'they don't have it'. Result schema locked.",
    basePrompt: FEATURE_MATRIX_BASE_PROMPT,
    placeholders: [],
    contract: "framework-json",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "competitive-digest": {
    key: "competitive-digest",
    kind: "task",
    name: "Competitive digest",
    description:
      "Writes the ELT competitive digest from window events + threat board + battlecard staleness. Capped at 3-5 items; an explicit no-change statement is a valid digest. Leadership framing per §9.2.",
    basePrompt: DIGEST_BASE_PROMPT,
    placeholders: [],
    contract: "markdown",
    defaultsSchema: NO_DEFAULTS,
    registryDefaults: {},
  },
  "voice-of-market": pmmEntry(
    "voice-of-market",
    "A",
    "Voice of Market (A1)",
    "Identifies buyer needs, objections, trends, and messaging gaps from call transcripts, customer interviews, and support tickets, and translates them into GTM and roadmap implications."
  ),
  "icp-persona": pmmEntry(
    "icp-persona",
    "A",
    "ICP & Persona Intelligence (A2)",
    "Refines target segments and buyer personas using customer, usage, and opportunity data, applying the JTBD framework alongside traditional persona methods."
  ),
  "competitive-intel": pmmEntry(
    "competitive-intel",
    "A",
    "Competitive Intelligence (A3)",
    "Tracks competitor moves — pricing pages, release notes, G2 reviews, job postings, analyst reports — and translates them into positioning and sales implications."
  ),
  "win-loss": pmmEntry(
    "win-loss",
    "A",
    "Win/Loss Intelligence (A4)",
    "Identifies why deals are won, lost, or stalled using interview data and CRM analysis, surfacing buyer language, decision drivers, trust signals, and objections."
  ),
  "customer-evidence": pmmEntry(
    "customer-evidence",
    "A",
    "Customer Evidence (A5)",
    "Surfaces validated proof points, measurable outcomes, reference candidates, and case-study opportunities, tracked by persona, segment, and use case."
  ),
  "product-to-market": pmmEntry(
    "product-to-market",
    "B",
    "Product-to-Market Translator (B6)",
    "Converts product updates into buyer problem, business value, differentiation, and messaging — applying the positioning → messaging → copy chain, the value-proposition schema, and the 7-step narrative arc."
  ),
  "launch-orchestration": pmmEntry(
    "launch-orchestration",
    "B",
    "Launch Orchestration (B7)",
    "Recommends launch tier, then builds the full launch plan — audience, deliverables, owners, dependencies, readiness, channel mix, AEO — emitted into the GTM-War-Room/ACTIVE-LAUNCHES tree."
  ),
  "sales-enablement": pmmEntry(
    "sales-enablement",
    "B",
    "Sales & Deal Enablement (B8)",
    "Produces opportunity-specific messaging, discovery questions, objection handling, proof points, battlecards on a continuous update loop, deal narratives via the 7-step arc, champion leave-behinds, and business-case calculators."
  ),
  "adoption-expansion": pmmEntry(
    "adoption-expansion",
    "B",
    "Adoption & Expansion (B9)",
    "Identifies adoption barriers, expansion opportunities, and required life-cycle messaging; surfaces churn-risk signals and upsell triggers for existing customers."
  ),
  "pricing-packaging": pmmEntry(
    "pricing-packaging",
    "B",
    "Pricing & Packaging Intelligence (B10)",
    "Identifies packaging gaps, pricing friction, and monetization opportunities by synthesizing competitive pricing signals with willingness-to-pay evidence."
  ),
  "messaging-effectiveness": pmmEntry(
    "messaging-effectiveness",
    "C",
    "Messaging Effectiveness (C11)",
    "Measures whether approved messaging is actually used by sales and how buyers respond to it, tracking asset usage rate in deals (% of deals where PMM collateral is utilized)."
  ),
  "content-governance": pmmEntry(
    "content-governance",
    "C",
    "Content Governance (C12)",
    "Flags outdated, inconsistent, unsupported, or incomplete messaging across all assets, running the site-auditor pattern (check copy against positioning-and-icp.md) and backing the PostToolUse voice guard hook with full-inventory audits."
  ),
  "gtm-performance": pmmEntry(
    "gtm-performance",
    "C",
    "GTM Performance (C13)",
    "Measures the impact of launches, enablement, messaging, and other PMM initiatives using the cross-functional metric taxonomy (§3.3), tagged leading vs. lagging, and outputs the KPI map — a traceable Company Goal → Key Metrics → KPIs tree."
  ),
  "pmm-prioritization": pmmEntry(
    "pmm-prioritization",
    "C",
    "PMM Prioritization (C14)",
    "Ranks recommended PMM actions by revenue impact, strategic importance, urgency, and effort; applies the OKR cascade (§3.6) and rocks/pebbles/sand sizing (§3.5) against the ~50/25/15/10 allocation; flags un-traceable work as sand and recurring ad-hoc requests for promotion to Always-On."
  ),
};

// ---------- model resolution ----------

/** `null` means "PMM default"; anything else must be on the allowlist. */
export function isAllowedModel(model: string | null): boolean {
  return model === null || AGENT_MODEL_ALLOWLIST.includes(model);
}

/** null → default; unlisted → default + console.warn (§0.1-6 — write-time
 *  validation is never the only defense). */
export function resolveModel(cfg: Pick<AgentConfig, "key" | "model">): string {
  if (cfg.model === null) return DEFAULT_AGENT_MODEL;
  if (!AGENT_MODEL_ALLOWLIST.includes(cfg.model)) {
    console.warn(
      `agent '${cfg.key}' carries unlisted model '${cfg.model}' — falling back to ${DEFAULT_AGENT_MODEL}`
    );
    return DEFAULT_AGENT_MODEL;
  }
  return cfg.model;
}

// ---------- composition ----------

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Interpolate {{placeholders}}; unknown placeholders are left verbatim and
 *  returned as warnings (never thrown — a typo degrades visibly, not fatally). */
export function interpolate(
  templateText: string,
  vars: Record<string, string>
): { text: string; unknown: string[] } {
  const unknown = new Set<string>();
  const text = templateText.replace(PLACEHOLDER_RE, (match, name: string) => {
    if (name in vars) return vars[name];
    unknown.add(name);
    return match;
  });
  return { text, unknown: [...unknown] };
}

/** `{{tokens}}` in an override that are not in the agent's placeholder
 *  vocabulary — surfaced as PUT warnings. */
export function findUnknownPlaceholders(text: string, known: string[]): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    if (!known.includes(m[1])) out.add(m[1]);
  }
  return [...out];
}

/** THE composition rule (§0 diagram). Custom instructions are appended even
 *  when an override is active; the contract suffix is appended UNCONDITIONALLY
 *  — no config state can remove it. */
export function composeAgentPrompt(
  cfg: Pick<AgentConfig, "base_prompt" | "custom_instructions" | "prompt_override">,
  vars: Record<string, string>,
  contractSuffix: string
): string {
  const body = interpolate(cfg.prompt_override ?? cfg.base_prompt, vars).text;
  const instructions = cfg.custom_instructions.trim();
  return (
    body +
    (instructions !== "" ? `\n\nAdditional instructions from the PMM admin:\n${instructions}` : "") +
    `\n\n${contractSuffix}`
  );
}

// ---------- kill switch ----------

/** enabled check + typed error the routes map to 409 (§0.1-5). Never a silent
 *  fallback to the base prompt — a half-disabled pipeline is a debugging trap. */
export function assertAgentEnabled(cfg: Pick<AgentConfig, "name" | "enabled">): void {
  if (!cfg.enabled) {
    throw new AgentError(`The ${cfg.name} agent is disabled — enable it in the Agents tab.`, 409);
  }
}

// ---------- .claude/agents file parsing (PMM baselines) ----------

export interface ParsedAgentFile {
  name: string | null;
  description: string;
  body: string;
}

/** YAML-frontmatter-lite parser for `.claude/agents/<key>.md`: `name:` and
 *  `description:` single-line values + everything after the closing `---`. */
export function parseAgentFile(content: string): ParsedAgentFile | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!m) return null;
  const frontmatter = m[1];
  const name = /^name:\s*(.+)\s*$/m.exec(frontmatter)?.[1]?.trim() ?? null;
  const description = /^description:\s*(.+)\s*$/m.exec(frontmatter)?.[1]?.trim() ?? "";
  return { name, description, body: content.slice(m[0].length).trim() };
}

/** Seed-style description from a roster file's frontmatter (§1.2): drop the
 *  leading "<Name> Agent (XN)." identity sentence, keep the first sentence of
 *  what remains ("vs." and ".md" do not end sentences). */
export function agentFileDescription(frontmatterDescription: string): string {
  const rest = frontmatterDescription.replace(/^[^.]*\([A-C]\d{1,2}\)\.\s*/, "");
  const m = /^[\s\S]*?\.(?=\s+[A-Z"'(]|$)/.exec(rest);
  return (m ? m[0] : rest).trim();
}

function pmmAgentFilePath(key: string): string {
  return path.join(REPO_ROOT, ".claude", "agents", `${key}.md`);
}

function readPmmBaseline(key: string): { description: string; body: string } | null {
  try {
    const raw = fs.readFileSync(pmmAgentFilePath(key), "utf-8");
    const parsed = parseAgentFile(raw);
    if (!parsed) return null;
    return { description: agentFileDescription(parsed.description), body: parsed.body };
  } catch {
    return null;
  }
}

// ---------- config reads (cached) ----------

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { cfg: AgentConfig; at: number }>();

export function bustAgentCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

function syntheticConfig(entry: AgentRegistryEntry): AgentConfig {
  const base =
    entry.kind === "task" ? entry.basePrompt ?? "" : readPmmBaseline(entry.key)?.body ?? "";
  return {
    id: "",
    key: entry.key,
    kind: entry.kind,
    grp: entry.grp ?? null,
    name: entry.name,
    description: entry.description,
    base_prompt: base,
    custom_instructions: "",
    prompt_override: null,
    model: null,
    enabled: true,
    defaults: entry.registryDefaults,
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  };
}

function rowToConfig(row: Record<string, unknown>): AgentConfig {
  const defaults = row.defaults;
  return {
    id: String(row.id),
    key: String(row.key),
    kind: row.kind === "pmm" ? "pmm" : "task",
    grp: typeof row.grp === "string" ? row.grp : null,
    name: String(row.name ?? row.key),
    description: typeof row.description === "string" ? row.description : "",
    base_prompt: typeof row.base_prompt === "string" ? row.base_prompt : "",
    custom_instructions: typeof row.custom_instructions === "string" ? row.custom_instructions : "",
    prompt_override: typeof row.prompt_override === "string" ? row.prompt_override : null,
    model: typeof row.model === "string" ? row.model : null,
    enabled: row.enabled !== false,
    defaults:
      defaults && typeof defaults === "object" && !Array.isArray(defaults)
        ? (defaults as Record<string, unknown>)
        : {},
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString(),
  };
}

/** Cached read (15 s TTL, busted on write — §0.1-7). Throws AgentError(503)
 *  when the DB is unconfigured; returns a synthetic default row (base from the
 *  registry / roster file, enabled, no override) when the agents table has no
 *  row yet or does not exist, so pipelines never hard-depend on the migration
 *  having run — behavior with zero config rows is identical to pre-registry. */
export async function getAgentConfig(key: string): Promise<AgentConfig> {
  const entry = AGENT_REGISTRY[key];
  if (!entry) throw new AgentError(`Unknown agent '${key}'`, 404);

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.cfg;

  const sb = supabase();
  if (!sb) throw new AgentError("Database not configured", 503);

  const { data, error } = await sb.from("agents").select("*").eq("key", key).maybeSingle();
  const cfg = !error && data ? rowToConfig(data as Record<string, unknown>) : syntheticConfig(entry);
  cache.set(key, { cfg, at: Date.now() });
  return cfg;
}

// ---------- boot sync (§0.1-3) ----------

/** Reconciles `base_prompt` (and display identity) from the canonical sources:
 *  task agents from the exported code constants, PMM agents from
 *  `.claude/agents/<key>.md`. Inserts a baseline row when one is missing.
 *  NEVER writes custom_instructions, prompt_override, model, enabled, or
 *  defaults on existing rows — admin edits survive every deploy. */
export async function syncAgentBaselines(): Promise<void> {
  const sb = supabase();
  if (!sb) {
    console.warn("agents sync skipped — database not configured");
    return;
  }
  const { data, error } = await sb
    .from("agents")
    .select("id, key, name, description, base_prompt");
  if (error) {
    console.warn(`agents sync skipped (run migration 0013?): ${error.message}`);
    return;
  }
  const byKey = new Map(
    ((data ?? []) as { id: string; key: string; name: string; description: string; base_prompt: string }[]).map(
      (r) => [r.key, r]
    )
  );

  for (const entry of Object.values(AGENT_REGISTRY)) {
    let base: string;
    let name = entry.name;
    let description = entry.description;
    if (entry.kind === "task") {
      base = entry.basePrompt ?? "";
    } else {
      const parsed = readPmmBaseline(entry.key);
      if (!parsed) {
        console.warn(
          `agents sync: .claude/agents/${entry.key}.md missing or unreadable — row left untouched`
        );
        continue;
      }
      base = parsed.body;
      if (parsed.description !== "") description = parsed.description;
    }

    const row = byKey.get(entry.key);
    if (!row) {
      const { error: insErr } = await sb.from("agents").insert({
        key: entry.key,
        kind: entry.kind,
        grp: entry.grp ?? null,
        name,
        description,
        base_prompt: base,
        defaults: entry.registryDefaults,
      });
      if (insErr) console.warn(`agents sync insert failed for ${entry.key}: ${insErr.message}`);
    } else if (row.base_prompt !== base || row.name !== name || row.description !== description) {
      const { error: updErr } = await sb
        .from("agents")
        .update({ base_prompt: base, name, description })
        .eq("id", row.id);
      if (updErr) console.warn(`agents sync update failed for ${entry.key}: ${updErr.message}`);
    }
  }
  bustAgentCache();
}

// ---------- event envelope (competitive-event-summary contract) ----------

export const EVENT_TYPES = [
  "content_changed",
  "pricing_changed",
  "release",
  "news",
  "job_signal",
  "procurement_award",
] as const;
export const EVENT_SEVERITIES = ["info", "notable", "high"] as const;

export interface EventEnvelope {
  changed: boolean;
  event_type?: string;
  severity?: string;
  title?: string;
  summary?: string;
}

/** Defensive parse of the event-summary JSON envelope. Returns null on any
 *  shape violation — callers degrade to a raw content_changed event, never
 *  block the watch pipeline. */
export function parseEventEnvelope(raw: string): EventEnvelope | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = parseModelJson<Record<string, unknown>>(raw);
  } catch {
    return null;
  }
  if (typeof parsed.changed !== "boolean") return null;
  if (!parsed.changed) return { changed: false };
  if (!EVENT_TYPES.includes(parsed.event_type as (typeof EVENT_TYPES)[number])) return null;
  if (!EVENT_SEVERITIES.includes(parsed.severity as (typeof EVENT_SEVERITIES)[number])) return null;
  if (typeof parsed.title !== "string" || parsed.title.trim() === "") return null;
  return {
    changed: true,
    event_type: parsed.event_type as string,
    severity: parsed.severity as string,
    title: parsed.title.trim(),
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
  };
}

// ---------- test-run contract checks (§2.3) ----------

export interface ContractCheckResult {
  checked: boolean;
  ok: boolean;
  error?: string;
}

export interface ContractCheckOptions {
  /** section-headings: the section ids the output must contain. */
  sectionIds?: string[];
  /** fills-json: slots whose hard character limits the fills must respect. */
  slots?: TemplateSlot[];
  /** route-json: catalog ids a proposed template_id must belong to. */
  validTemplateIds?: string[];
}

/** Deterministic contract check on a test-run output — the same walls the real
 *  pipeline enforces (parseModelJson shape, splitSections headings,
 *  validateFills limits), never model judgment. */
export function checkContract(
  contract: AgentContract,
  output: string,
  opts: ContractCheckOptions = {}
): ContractCheckResult {
  switch (contract) {
    case "fq-answers-json": {
      let parsed: { answers?: unknown };
      try {
        parsed = parseModelJson<{ answers?: unknown }>(output);
      } catch (err) {
        return { checked: true, ok: false, error: `Not parseable as JSON: ${(err as Error).message}` };
      }
      if (!Array.isArray(parsed.answers)) {
        return { checked: true, ok: false, error: 'Output JSON has no "answers" array.' };
      }
      for (const entry of parsed.answers) {
        if (!entry || typeof entry !== "object") {
          return { checked: true, ok: false, error: "An answers entry is not an object." };
        }
        const o = entry as Record<string, unknown>;
        if (typeof o.question_id !== "string") {
          return { checked: true, ok: false, error: "An answers entry is missing a string question_id." };
        }
        if (typeof o.content !== "string") {
          return {
            checked: true,
            ok: false,
            error: `Answer ${o.question_id} is missing a string content field.`,
          };
        }
        if (typeof o.confidence !== "number" || !Number.isFinite(o.confidence)) {
          return {
            checked: true,
            ok: false,
            error: `Answer ${o.question_id} is missing a numeric confidence.`,
          };
        }
      }
      return { checked: true, ok: true };
    }
    case "fills-json": {
      let parsed: { fills?: unknown };
      try {
        parsed = parseModelJson<{ fills?: unknown }>(output);
      } catch (err) {
        return { checked: true, ok: false, error: `Not parseable as JSON: ${(err as Error).message}` };
      }
      if (!parsed.fills || typeof parsed.fills !== "object" || Array.isArray(parsed.fills)) {
        return { checked: true, ok: false, error: 'Output JSON has no "fills" object.' };
      }
      for (const [slotId, value] of Object.entries(parsed.fills as Record<string, unknown>)) {
        if (typeof value !== "string") {
          return { checked: true, ok: false, error: `fills.${slotId} is not a string.` };
        }
      }
      if (opts.slots) {
        const { over } = validateFills(opts.slots, parsed.fills as Record<string, string>);
        if (over.length > 0) {
          return {
            checked: true,
            ok: false,
            error: `Over hard character limits: ${over
              .map((o) => `${o.slot_id} (${o.chars}/${o.max})`)
              .join(", ")}.`,
          };
        }
      }
      return { checked: true, ok: true };
    }
    case "section-headings": {
      // Same pattern splitSections uses (messagingDoc.ts).
      const missing = (opts.sectionIds ?? []).filter(
        (id) => !new RegExp(`^##\\s*${id}\\b`, "m").test(output)
      );
      if (missing.length > 0) {
        return { checked: true, ok: false, error: `Missing section heading(s): ${missing.join(", ")}.` };
      }
      return { checked: true, ok: true };
    }
    case "route-json": {
      // Ask-to-artifact blueprint §5.1 — deterministic, in order.
      let parsed: Record<string, unknown>;
      try {
        parsed = parseModelJson<Record<string, unknown>>(output);
      } catch (err) {
        return { checked: true, ok: false, error: `Not parseable as JSON: ${(err as Error).message}` };
      }
      if (parsed.intent !== "question" && parsed.intent !== "artifact") {
        return { checked: true, ok: false, error: 'intent must be "question" or "artifact".' };
      }
      if (
        typeof parsed.confidence !== "number" ||
        !Number.isFinite(parsed.confidence) ||
        parsed.confidence < 0 ||
        parsed.confidence > 1
      ) {
        return { checked: true, ok: false, error: "confidence must be a number between 0 and 1." };
      }
      if (parsed.intent === "artifact") {
        if (typeof parsed.asset_type !== "string" || parsed.asset_type.trim() === "") {
          return { checked: true, ok: false, error: "asset_type must be a non-empty string for artifact intent." };
        }
        if (typeof parsed.brief !== "string" || parsed.brief.trim() === "") {
          return { checked: true, ok: false, error: "brief must be a non-empty string for artifact intent." };
        }
        if (parsed.template_id !== undefined && parsed.template_id !== null) {
          if (typeof parsed.template_id !== "string") {
            return { checked: true, ok: false, error: "template_id must be a string when present." };
          }
          if (opts.validTemplateIds && !opts.validTemplateIds.includes(parsed.template_id)) {
            return {
              checked: true,
              ok: false,
              error: `template_id "${parsed.template_id}" is not in the catalog — at run time the router falls back to the asset type's first approved template.`,
            };
          }
        }
      }
      return { checked: true, ok: true };
    }
    case "event-json": {
      const parsed = parseEventEnvelope(output);
      if (!parsed) {
        return {
          checked: true,
          ok: false,
          error:
            'Not a valid event envelope: needs {"changed": boolean} plus event_type/severity/title when changed is true.',
        };
      }
      return { checked: true, ok: true };
    }
    case "framework-json": {
      // Deterministic minimum: a JSON object. Per-framework schema validation
      // runs in frameworks.ts, where the framework key is known.
      try {
        const parsed = parseModelJson<unknown>(output);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return { checked: true, ok: false, error: "Output is not a JSON object." };
        }
      } catch (err) {
        return { checked: true, ok: false, error: `Not parseable as JSON: ${(err as Error).message}` };
      }
      return { checked: true, ok: true };
    }
    case "markdown":
      return { checked: false, ok: true };
  }
}

// ---------- static test-run samples (§2.3 — no DB or scraping dependencies) ----------

export const SAMPLE_EXTRACTION_VARS: Record<string, string> = {
  product_name: "Masterworks",
  product_line: "Masterworks",
  source_type: "call transcripts",
};

/** Hard-coded copies of A1-Q1 / A3-Q1 / C1-Q2 from migration 0009. */
export const SAMPLE_QUESTIONS = [
  {
    id: "A1-Q1",
    prompt: "Why does this product exist — what change in the world does it drive for its customers?",
    guidance: 'The "Why" of the Golden Circle. A belief about the customer\'s world, not a feature.',
  },
  {
    id: "A3-Q1",
    prompt:
      "Who is the best-fit customer — organization type, situation, and constraint that makes them ideal?",
    guidance: "One tight sentence: who, running what, under what pressure.",
  },
  {
    id: "C1-Q2",
    prompt: "Economic buyer: what are their top pains, in their own words where possible?",
    guidance: "Raw quotes preferred; note which call/doc each came from.",
  },
];

export const SAMPLE_TRANSCRIPT_XML = `<doc id="sample-transcript-1" title="Discovery call — Central State DOT (sample)">
Program director: "We manage about $800 million a year across four districts, and every district tracks its projects in its own spreadsheets. When the legislature asks where the program stands, it takes my team three weeks to pull an answer together, and by the time we hand it over the numbers are stale."
Deputy director: "Federal reimbursement is the part that keeps me up at night. If Davis-Bacon documentation is incomplete on even one contract, FHWA can hold the whole submission. We found that out the hard way last year."
Program director: "What we want is one place where planning, construction, and right-of-way live together, so a status question is an hour, not a month."
</doc>`;

export const SAMPLE_MERGE_ITEMS = [
  {
    question_id: "A3-Q1",
    prompt:
      "Who is the best-fit customer — organization type, situation, and constraint that makes them ideal?",
    transcript_candidate: {
      content:
        "State DOTs managing about $800 million a year in capital spend across multiple districts, under legislative reporting pressure and federal reimbursement risk.",
      confidence: 0.7,
      sources: [
        {
          doc_id: "sample-transcript-1",
          title: "Discovery call — Central State DOT (sample)",
          evidence: "We manage about $800 million a year across four districts",
        },
      ],
    },
    document_candidate: {
      content:
        "Public-sector agencies — state DOTs, transit authorities, and large local governments — managing $1B+ in annual capital spend with built-in federal compliance requirements.",
      confidence: 0.8,
      sources: [
        {
          doc_id: "sample-prd-1",
          title: "Masterworks product overview (sample)",
          evidence: "agencies managing $1B+ annual capital programs",
        },
      ],
    },
  },
];

export const SAMPLE_MESSAGING_VARS: Record<string, string> = {
  part: "A",
  product_name: "Masterworks",
};

export const SAMPLE_MESSAGING_SECTIONS = [
  { id: "A1", title: "The Why (Golden Circle)" },
  { id: "A5", title: "Positioning Statements" },
];

export const SAMPLE_ACCEPTED_ANSWERS_CONTEXT = `PMM-approved questionnaire answers (JSON):
${JSON.stringify(
  [
    {
      question_id: "A1-Q1",
      section: "A1",
      prompt: "Why does this product exist — what change in the world does it drive for its customers?",
      final_answer:
        "Public-sector agencies steward taxpayer-funded capital programs, but their delivery data lives in disconnected spreadsheets. Masterworks exists so an agency can answer for every dollar and every project from one system, in hours instead of weeks.",
      sources: [
        {
          doc_id: "sample-transcript-1",
          title: "Discovery call — Central State DOT (sample)",
          evidence: "it takes my team three weeks to pull an answer together",
        },
      ],
    },
    {
      question_id: "A3-Q1",
      section: "A3",
      prompt:
        "Who is the best-fit customer — organization type, situation, and constraint that makes them ideal?",
      final_answer:
        "State DOTs, transit authorities, and large local governments managing $100M+ in annual capital spend, under legislative reporting pressure and federal reimbursement requirements. [Conflict: transcript cites ~$800M spend; product doc positions $1B+.]",
      sources: [
        {
          doc_id: "sample-prd-1",
          title: "Masterworks product overview (sample)",
          evidence: "agencies managing $1B+ annual capital programs",
        },
      ],
    },
    {
      question_id: "C1-Q2",
      section: "C1",
      prompt: "Economic buyer: what are their top pains, in their own words where possible?",
      final_answer:
        'Program directors: "When the legislature asks where the program stands, it takes my team three weeks to pull an answer together." Deputy directors fear federal reimbursement holds: "If Davis-Bacon documentation is incomplete on even one contract, FHWA can hold the whole submission."',
      sources: [
        {
          doc_id: "sample-transcript-1",
          title: "Discovery call — Central State DOT (sample)",
          evidence: "FHWA can hold the whole submission",
        },
      ],
    },
  ],
  null,
  2
)}`;

export const SAMPLE_SLOT_FILL_VARS: Record<string, string> = {
  product_name: "Masterworks",
  product_line: "Masterworks",
  asset_type: "one-pager",
  template_name: "Sample one-pager",
  audience: "public-sector agencies",
  persona: "Capital program director",
  funnel_stage: "consideration",
  doc_title: "Masterworks — Positioning & Messaging",
  doc_version: "1",
};

export const SAMPLE_SLOTS: TemplateSlot[] = [
  {
    id: "headline",
    label: "Headline",
    purpose: "One-line hook that opens from the reader's world",
    max_chars: 60,
    required: true,
    render: "text",
    source_sections: ["B1"],
  },
  {
    id: "proof",
    label: "Proof paragraph",
    purpose: "Supporting proof grounded in the approved messaging",
    max_chars: 260,
    required: true,
    render: "multiline",
    source_sections: ["B1"],
  },
];

export const SAMPLE_SECTION_XML = `<section id="B1" title="Messaging Hierarchy">
Your capital program answers to the public — every project, every dollar. Masterworks is the AI-native capital program management platform public-sector agencies use to plan, build, and account for infrastructure from one unified system. Twelve state DOTs run their programs on it, with federal compliance (Davis-Bacon, Buy America, FHWA reimbursement tracking) built in, so a legislature-ready program answer takes hours, not weeks.
</section>`;

/** Canonical ask-router demo line (ask-to-artifact blueprint §5.2) — the
 *  test-run default when the admin supplies no question. */
export const SAMPLE_ROUTER_QUESTION =
  "I need a leave-behind for a DOT prospect about risk prediction";

export const SAMPLE_ROUTER_CANDIDATES: RouterCandidate[] = [
  { id: "sample-tpl-onepager", name: "Masterworks AI One-Pager", asset_type: "one-pager",
    product_line: "Masterworks", audience: "public-sector agencies",
    persona: "Capital program director", funnel_stage: "decision" },
  { id: "sample-tpl-battlecard", name: "Masterworks AI Battlecard — Objection Handling",
    asset_type: "battlecard", product_line: "Masterworks", audience: null,
    persona: null, funnel_stage: null },
  { id: "sample-tpl-faq", name: "Masterworks AI — Sales FAQ", asset_type: "faq",
    product_line: "Masterworks", audience: null, persona: null, funnel_stage: null },
];

/** Static sample diff for competitive-event-summary test runs — no scraping,
 *  no DB. Expected result: changed true, event_type "release" or
 *  "pricing_changed", severity "notable"+. */
export const SAMPLE_SOURCE_DIFF = `- Kahua helps owners manage cost, documents, and processes on one platform.
+ Kahua helps owners manage cost, documents, and processes on one platform, now with Noa, Kahua's AI assistant for program insights.
+ Noa is included in the Enterprise plan and available as an add-on for Standard plans.`;

export const SAMPLE_COMPETITOR_XML = `<competitor_source url="https://example.com/kahua-sample" title="Kahua — Program Management (static sample)" scraped="2026-08-06">
Kahua describes itself as a construction program management platform for owners and program managers. The sample page lists capabilities for cost management, document management, and process automation, a partner ecosystem, and configurable apps built on its platform. It cites deployments with public and private owners and highlights integrations with common ERP and design tools. Pricing is not published on the page. This block is a built-in static sample used only for Agents-tab test runs — no scraping happens here, and claims should be treated as illustrative, not current competitor fact.
</competitor_source>`;
