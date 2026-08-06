# Blueprint — Agents tab (unified agent registry & configuration)

- **Status:** ready for build (hackathon MVP slice)
- **Date:** 2026-08-06
- **Author:** app-architect
- **Builds on:** `app/docs/blueprints/foundation-questionnaire.md`, `app/docs/blueprints/template-library.md` (both shipped), Aurigo `engineering-playbook/vol-3-architecture/` 03-api / 07-security / 08-authorization / 13-testing
- **Constitution rules encoded:** §12 (the 14 sub-agents become first-class registry entries, not hidden files), §8.4 (config changes are PMM-admin-only, audited), §8.1 (test-run surfaces the forbidden-words guard before an admin ships a prompt change), §3.1 (the locked contract suffix keeps every pipeline agent's validated-output contract intact — an override can change tone and policy, never the evidence/JSON discipline)
- **Demo value props served:** 3–5× PMM leverage (one admin tunes every AI step and every sub-agent from one screen), 100% messaging consistency (the locked base + contract suffix means tuning never breaks the guardrail chain)
- **Requirement provenance:** unified admin-only Agents tab covering BOTH task agents and the 14 PMM sub-agents, with (a) custom instructions, (b) model choice, (c) enabled + defaults jsonb, (d) full prompt override — approved by the PMM admin via explicit Q&A. Encoded here, not re-litigated.

---

## 0. What this ships

One **`agents` registry** (migration 0012) holding twenty rows — six **task agents** (the AI steps the app already runs) and fourteen **PMM sub-agents** (§12 roster) — plus an admin-only **Agents tab** to configure them, and a **runtime composition layer** every existing service reads its prompt through:

```
final prompt = interpolate(prompt_override ?? base_prompt, runtime vars)
             + custom-instructions block (if any)
             + runtime data blocks (docs / answers / slots / sources — never configurable)
             + LOCKED CONTRACT SUFFIX (code-owned, always appended)
```

Task agents and their config are read at **run time** by the services that already exist; nothing about consumer-facing surfaces changes — Sales asking the war room simply runs whatever config is active.

### Survey findings the design leans on (verified in code, with line references)

| Existing piece | File : lines | Bearing on this design |
|---|---|---|
| `ask(userPrompt, {extraContext, maxTokens})`, `const MODEL = process.env.PMM_MODEL ?? "claude-opus-4-8"` pinned at module scope; model used at the `client.messages.create` call | `app/backend/src/services/claude.ts:6, 39–58` | Minimal change (§3.1 below): add `model?: string` to `AskOptions`, use `opts.model ?? MODEL`. Nothing else in `claude.ts` changes; the cached brand-DNA system prefix is untouched |
| Extraction prompt (verbatim base) | `services/questionnaire.ts:246–276` (`extractionPrompt`) | Decomposed §2.2-1: body L256–269 overridable; L271–275 (Questions JSON + "Return ONLY valid JSON… matching exactly {…}") is the locked suffix — `parseModelJson`/`sanitizeCandidate` (L160–166, 194–227) consume it |
| Merge prompt | `services/questionnaire.ts:285–305` (`mergePrompt`) | §2.2-2: policy bullets L289–299 overridable; L301–304 locked (JSON contract). Read at three call sites: `runExtractionPass` L350, `runMergePass` L489, `regenerateMerge` L572 |
| `askJson` repair-retry wrapper | `services/questionnaire.ts:236–244` | Gains a `model` pass-through; the repair retry is an existing contract defense the override rides on |
| Doc-generation prompt + `SECTION_INSTRUCTIONS` | `services/messagingDoc.ts:110–135` (instructions), `137–157` (`generationPrompt`), model call at `317` | §2.2-3: rules body overridable; the `Produce ONLY these sections… "## {id} · {title}"` block is the locked suffix because `splitSections` (L160–174) parses those headings. `SECTION_INSTRUCTIONS` becomes overridable via `defaults.section_instructions` |
| Slot-fill prompt + trim retry | `services/templateGenerate.ts:98–149` (`buildSlotFillPrompt`), `152–167` (`buildTrimPrompt`), `askFills` 174–188, gate + call in `generateFromTemplate` 229–262 | §2.2-4: framing + Rules overridable; `Slots to fill` + `{"fills": …}` JSON tail locked (`validateFills`/renderer consume it). `buildTrimPrompt` stays 100% locked — it is a repair mechanism, not a persona |
| Role framing map + query handler | `routes/query.ts:11–24` (`ROLE_FRAMING`), ask at 51–54 | §2.2-5: per-role framing moves to `defaults.role_framing` (editable per role); question block is the locked suffix. §9.2 persona table stays the seeded default |
| Competitive compare prompt | `services/competitive.ts:16–48` (`PRODUCT_MAP`), `50–62` (`EVIDENCE_RULES`), prompt assembly 243–253, ask at 263 | §2.2-6: PRODUCT_MAP + EVIDENCE_RULES are the overridable body (the highest-value override target — product mapping changes as products launch); scraped-sources/KB/question sections are locked structure |
| `requireAuth` / `requireAdmin` / `isAdmin` | `middleware/auth.ts:23–60` | Every Agents endpoint is `requireAuth + requireAdmin` (vol-3 08-authorization: the tab is a boundary, not a nav convention) |
| `logActivity(entityType, entityId, actorId, action, detail)`; **`activity_log.entity_id` is `uuid not null`** | `services/activity.ts:4–21`, `supabase/migrations/0002_platform.sql:228–236` | Agents table therefore needs a **uuid PK plus a unique text `key`** — activity logs use the uuid; the human-readable key rides in `detail` |
| `WAR_ROOM_DIR` + exported `REPO_ROOT` | `services/warRoom.ts:6–11` | `.claude/agents/` resolves as `path.join(REPO_ROOT, ".claude", "agents")` for the PMM-agent baseline sync |
| PMM sub-agent file shape: YAML frontmatter (`name`, `description`, `tools`) + markdown body of base instructions | `.claude/agents/voice-of-market.md` (representative; 14 files, build agents excluded) | Seed `name`/`description` from frontmatter; body = `base_prompt`, synced at boot (§2.4) |
| Admin module pattern: `requireAdmin` routes, `logActivity` on transitions, `{error}` bodies, 409 on bad state | `routes/pmm.ts` (whole file) | Route style mirrored exactly |
| `ADMIN_NAV` array, `.pill`, `.card`, `.btn`, drawer-less page conventions | `frontend/src/components/Layout.tsx:24–30`, `styles/brand.css` | Nav entry + UI classes |
| `ApiError` with `status` + `body` | `frontend/src/lib/api.ts:17–38` | Frontend surfaces 400 model-allowlist and 409 disabled errors |
| QA deltas from shipped blueprints | `supabase/migrations/0009_foundation_questionnaire.sql:3` (renumbered), `routes/templates.ts:160–162` (templates default `approved:false` on create) | **Numbering: 0001–0011 exist, and 0011 is taken twice (`0011_pmm_workspace.sql`, `0011_template_library.sql`). This migration is `0012_agents.sql`.** The templates delta sets the precedent this design follows: safe-by-default (task agents seed `enabled=true` because they are live pipeline steps; but overrides start null and revert is one click) |

### 0.1 Decisions recorded (candidate ADRs when `pmm-playbook/vol-3-architecture/adrs/` is created)

1. **PMM sub-agents are config + test-run only in MVP — no persisted "run agent" outputs.** The registry seeds all 14 with their real instructions; the admin can edit config and *test-run* any of them (live model call against war-room context, output shown in-app, nothing saved). A generic "run agent → draft war-room doc" endpoint is **V2**: each agent has distinct data sources, output destinations, and §8.5 proposal semantics — a generic writer would either dump undifferentiated markdown into the war room (violating §4's tree discipline) or need 14 bespoke adapters (not a hackathon slice). Test-run already demos the value ("watch voice-of-market work, tuned by you") with zero persistence machinery. *Alternative rejected:* runnable-with-draft-artifact — the artifact table is product/asset-typed and a war-room file write without a review queue skirts §8.4.
2. **Locked contract suffixes live in code, never in the DB.** The suffix must stay byte-compatible with its parser (`parseModelJson` consumers, `splitSections` heading regex, `validateFills`). Storing it in the DB creates a second source of truth that can drift from the parser. The DB stores only the overridable body; each service exports its suffix builder and the composition layer appends it unconditionally — **a full prompt override can therefore never remove the output contract.** This is the guardrail pattern the requirement asked to evaluate, adopted.
3. **Code and `.claude/agents/` files are canonical for base prompts; the DB holds a synced snapshot.** Migration 0012 seeds task-agent base prompts verbatim (bootstrap), and `syncAgentBaselines()` at server boot refreshes `base_prompt` from the canonical source whenever it drifts: task agents from exported code constants, PMM agents from `.claude/agents/<key>.md` bodies. Sync touches **only** `base_prompt`/`name`/`description` — never `custom_instructions`, `prompt_override`, `model`, `enabled`, `defaults` — so admin edits survive every deploy. This resolves the seed-duplication risk: the migration copy can go stale harmlessly; boot always reconciles.
4. **Revert = clear the delta, keep the identity.** `POST /:key/revert` nulls `prompt_override`, empties `custom_instructions`, resets `model` to null (PMM_MODEL default) and `defaults` to the registry's code defaults. `enabled` is untouched (revert is "back to stock prompt", not "turn it on"). Base is always stored alongside the override (schema requirement), so revert needs no history table. Full config version history is **V2**; the activity log (who/what/when per save) is the MVP audit trail.
5. **`enabled=false` is an admin kill switch, honored at the service boundary.** A disabled task agent makes its endpoint/run fail fast with a 409 (`"The <name> agent is disabled — enable it in the Agents tab."`); background passes record the same message via `finishRun('failed', …)`. It does not silently fall back to the base prompt — a half-disabled pipeline is a debugging trap.
6. **Model allowlist is one server-side constant.** `AGENT_MODEL_ALLOWLIST = ["claude-opus-4-8", "claude-sonnet-4-5", "claude-haiku-4-5"]`; `null` means "PMM default" (`PMM_MODEL ?? "claude-opus-4-8"`). Validated on write (400) *and* on read (`resolveModel()` falls back to default with a console warning if a DB row somehow carries an unlisted model — model judgment is never the only defense, and neither is write-time validation).
7. **Config reads are cached in-process, 15 s TTL, busted on write.** One `agents` SELECT per key per 15 s; PUT/revert bust the cache immediately in the same process. Single-instance MVP; multi-instance cache invalidation is V2 (the TTL bounds staleness at 15 s regardless). Background runs load config **once at run start** — a mid-run config change applies to the next run, which is the only sane semantics for a multi-batch pass.

---

## 1. Migration `supabase/migrations/0012_agents.sql`

```sql
-- Agents registry: one table for the app's task agents (runtime prompt config)
-- and the 14 PMM sub-agents (§12). Constitution: §8.4 (admin-only, audited
-- config), §3.1/§8.1 (locked contract suffix lives in code — see services/agents.ts).
-- Boot-time syncAgentBaselines() refreshes base_prompt from canonical sources;
-- this seed is bootstrap only (decision §0.1-3).

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),   -- activity_log.entity_id is uuid (0002)
  key text not null unique,                        -- 'fq-extraction', 'voice-of-market', …
  kind text not null check (kind in ('task', 'pmm')),
  grp text check (grp in ('A', 'B', 'C') or grp is null),  -- pmm grouping; null for task
  name text not null,
  description text not null default '',
  base_prompt text not null default '',            -- overridable body ONLY (locked suffix is code-owned)
  custom_instructions text not null default '',    -- appended after the body, before runtime data
  prompt_override text,                            -- null = use base_prompt; never replaces the contract suffix
  model text,                                      -- null = PMM_MODEL default; allowlist-validated
  enabled boolean not null default true,
  defaults jsonb not null default '{}',            -- per-agent task defaults (documented per key in §2.2)
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table agents enable row level security;
-- (Backend service-role is the only client — same posture as 0002/0009/0011.)
```

### 1.1 Seed — task agents (6 rows, base prompts verbatim from the services)

`insert into agents (key, kind, name, description, base_prompt, defaults) values … on conflict (key) do update set name = excluded.name, description = excluded.description, base_prompt = excluded.base_prompt, defaults = agents.defaults;`
(`defaults` keeps the live value on re-run; base_prompt refresh is safe because admin state lives only in `custom_instructions` / `prompt_override` / `model` / `enabled` / `defaults`.)

`{{placeholders}}` are interpolated by the composition layer at run time (§2.1). Each body below is extracted verbatim from the cited lines, with only the runtime interpolations converted to placeholders.

**Row 1 — `fq-extraction`** (name "Questionnaire extraction", description "Evidence-extraction passes (transcripts + documents) for the Foundation Questionnaire. Answers the question bank with cited candidates only from ingested sources."). Body ← `questionnaire.ts:256–269`:

```
You are running an evidence-extraction pass for the Foundation Questionnaire.

Product: {{product_name}} ({{product_line}} line).
Source type for this pass: {{source_type}}.
The source documents are in the ADDITIONAL WAR ROOM CONTEXT above, each wrapped in <doc id="..." title="...">.

Answer ONLY the questions listed below, using ONLY what the source documents state.
Rules:
- Never infer, never fill gaps with prior knowledge, never invent numbers, names, or quotes.
- If the sources do not support a question, OMIT that question from the output entirely.
- content: a concise factual answer (max 120 words) preserving concrete numbers and raw customer phrasing.
- sources: every doc you drew from, each with a verbatim evidence quote of at most 25 words.
- confidence: 0.0-1.0. 0.9+ = stated explicitly and completely; 0.5 = partial or indirect; below 0.3 = omit the question instead.
- This is internal fact capture, not customer-facing copy: record facts and quotes exactly as stated, even if the wording violates brand voice.
```

**Row 2 — `fq-merge`** (name "Candidate merge & reconciliation", description "Reconciles transcript and document extraction candidates into one merged proposal per question for the PMM review queue."). Body ← `questionnaire.ts:289–299`:

```
You are reconciling two evidence-extraction passes for the Foundation Questionnaire.
For each question below you are given a transcript candidate and a document candidate,
each with source citations.

Propose ONE merged answer per question:
- Prefer facts the two candidates agree on.
- Where they conflict: keep the DOCUMENT version for product facts and the TRANSCRIPT
  version for customer language, and append one bracketed note: [Conflict: <one sentence>].
- Preserve vivid raw customer phrasing from transcripts.
- sources: the union of both candidates' citations. Never invent or drop a citation.
- confidence: the maximum of the two when they agree, the minimum when they conflict.
```

**Row 3 — `messaging-doc-generation`** (name "Messaging document generation", description "Generates the Positioning & Messaging document Part by Part from PMM-approved questionnaire answers (§3.2 chain: A feeds B feeds C/D/E)."). Body ← `messagingDoc.ts:138–156` minus the Produce-ONLY block (which becomes the locked suffix, §2.2-3):

```
Generate Part {{part}} of "{{product_name}} — Positioning & Messaging", the unified system
for how Marketing, Sales, and Proposals talk about {{product_name}}.

The ADDITIONAL WAR ROOM CONTEXT above contains the PMM-approved questionnaire answers
(JSON: question id, section, prompt, final answer, sources). These answers are validated
facts — the ONLY facts you may use beyond the Brand DNA. If a needed fact is missing or
an answer carries a [Conflict: ...] note, write a one-line "⚠ To confirm: ..." callout
at that spot instead of guessing.

Rules:
- Markdown only. Tables where the instructions say table. No preamble, no meta-commentary.
- The customer is the hero; open from the reader's world (cardinal rule).
- Swap test: if a sentence would still work with a competitor's name in place of Aurigo,
  rewrite it around the approved unique attributes.
- Raw quotes from the answers may be paraphrased into brand voice, but numbers, names,
  and certification wording must be carried over exactly.
```

`defaults` seed: `{"section_instructions": {}}` — admin-supplied entries here override `SECTION_INSTRUCTIONS` (`messagingDoc.ts:110–135`) per section id at run time; the code map stays the base.

**Row 4 — `template-slot-fill`** (name "Template slot fill", description "Fills locked layout templates with approved messaging from the latest final messaging doc. Controls slot text only — never layout."). Body ← `templateGenerate.ts:122–145` minus slot lines and JSON tail:

```
You are filling a locked layout template with approved messaging. You control ONLY the
text inside the named slots below — never layout, structure, colors, or anything else.

Product: {{product_name}} ({{product_line}} line).
Artifact: {{asset_type}} — "{{template_name}}".
Audience: {{audience}}. Persona: {{persona}}. Funnel stage: {{funnel_stage}}.

The ADDITIONAL WAR ROOM CONTEXT above contains sections of "{{doc_title}}" (version
{{doc_version}}, PMM-approved — the validated messaging for this product), each wrapped
in <section id="..." title="...">. These sections are the ONLY source of facts, claims,
numbers, and customer language for this task. If a slot's wired sections do not support
a strong fill, return "" for that slot — never pad, never invent, never fall back to
general knowledge.

Rules:
- Plain text only in every slot: no markdown syntax, no asterisks, no HTML tags.
- Character limits are hard limits. Compress by cutting words and clauses, never facts.
- Open from the reader's world, not from Aurigo or the product (cardinal rule).
- Swap test every sentence: if it would still work with a competitor's name, rewrite it
  around this product's approved unique attributes.
- Numbers, customer names, and certification wording exactly as they appear in the doc.
```

**Row 5 — `ask-war-room`** (name "Ask the War Room", description "Role-aware Q&A over the GTM War Room and knowledge base (§9.2 persona framing)."). `base_prompt` = `''` (the overridable unit is the per-role framing in `defaults`; see §2.2-5). `defaults` seed = the `ROLE_FRAMING` map verbatim from `routes/query.ts:11–24`:

```json
{"role_framing": {
  "sales": "The asker is in Sales, supporting an active deal. Frame the answer as talk tracks, objection handling, competitive proof points. Their metrics: SQLs, win rates, deal velocity, pipeline value, average deal size.",
  "proposals": "The asker writes RFP and proposal responses. Frame the answer as compliant, differentiated response language with proof assets and use-case evidence.",
  "marketing": "The asker runs campaigns and content. Frame the answer as messaging hierarchy, channel copy guidance, and campaign framing. Their metrics: MQLs, CPL, conversion rate.",
  "leadership": "The asker is an executive. Lead with metric impact (MRR, NRR, win rate, pipeline) and strategic implications. Keep it brief and decision-oriented.",
  "product": "The asker is in Product. Frame the answer as market signals, adoption barriers, feature positioning, and buyer feedback. Their metrics: activation rate, feature adoption, time-to-value.",
  "cs": "The asker is in Customer Success. Frame the answer as adoption messaging, expansion talk tracks, and churn-risk signals.",
  "sdr": "The asker is an SDR/BDR doing outbound. Frame the answer as persona-specific openers, pain-first copy, and objection one-liners.",
  "general": "Frame the answer for a general internal audience."
}}
```

**Row 6 — `competitive-compare`** (name "Competitive comparison", description "Answers competitor questions from scraped competitor sources + Aurigo knowledge base only. Picks the competing Aurigo product per the mapping brief."). Body = `PRODUCT_MAP` + `EVIDENCE_RULES` **verbatim, concatenated** from `competitive.ts:16–48` and `:50–62` (dollar-quoted in the migration; too long to duplicate here a second time — ui-engineer copies the two constants exactly, in that order, separated by one blank line). This is the highest-value override target: when a product launches or repositions, the admin edits the mapping without a deploy.

### 1.2 Seed — the 14 PMM sub-agents

`insert into agents (key, kind, grp, name, description) values … on conflict (key) do update set grp = excluded.grp;` — **name/description/base_prompt are NOT in the update clause** for these rows: `syncAgentBaselines()` owns them from the `.claude/agents/` files (decision §0.1-3), and a migration re-run must not regress a fresher sync.

| key | grp | name (seed) | description (seed: first sentence of the file's frontmatter `description`) |
|---|---|---|---|
| voice-of-market | A | Voice of Market (A1) | Identifies buyer needs, objections, trends, and messaging gaps from call transcripts, customer interviews, and support tickets. |
| icp-persona | A | ICP & Persona Intelligence (A2) | Refines target segments and buyer personas using customer and market signals. |
| competitive-intel | A | Competitive Intelligence (A3) | Tracks competitor moves — pricing pages, release notes, positioning shifts. |
| win-loss | A | Win/Loss Intelligence (A4) | Identifies why deals are won, lost, or stalled. |
| customer-evidence | A | Customer Evidence (A5) | Surfaces validated proof points, measurable outcomes, and reference candidates. |
| product-to-market | B | Product-to-Market Translator (B6) | Converts product updates into buyer problem, business value, and GTM framing. |
| launch-orchestration | B | Launch Orchestration (B7) | Recommends launch tier, then builds the full launch plan. |
| sales-enablement | B | Sales & Deal Enablement (B8) | Produces opportunity-specific messaging, discovery questions, and deal support. |
| adoption-expansion | B | Adoption & Expansion (B9) | Identifies adoption barriers and expansion opportunities. |
| pricing-packaging | B | Pricing & Packaging Intelligence (B10) | Identifies packaging gaps, pricing friction, and monetization signals. |
| messaging-effectiveness | C | Messaging Effectiveness (C11) | Measures whether approved messaging is actually used and working. |
| content-governance | C | Content Governance (C12) | Flags outdated, inconsistent, unsupported, or incomplete messaging and assets. |
| gtm-performance | C | GTM Performance (C13) | Measures the impact of launches, enablement, messaging, and campaigns. |
| pmm-prioritization | C | PMM Prioritization (C14) | Ranks recommended PMM actions by revenue impact and strategic weight. |

(ui-engineer: take each description verbatim-in-full from the file's frontmatter `description:` line, trimmed to the first sentence — the table above abbreviates. Build agents `app-architect`/`ui-engineer`/`qa-reviewer` are **excluded**: they are engineering tooling, not §12 roster.)

---

## 2. Backend design

### 2.1 `app/backend/src/services/agents.ts` (new — the registry + composition layer)

```ts
export type AgentKey =
  | "fq-extraction" | "fq-merge" | "messaging-doc-generation"
  | "template-slot-fill" | "ask-war-room" | "competitive-compare"
  | /* the 14 pmm keys */ string;

export interface AgentConfig {
  id: string; key: string; kind: "task" | "pmm"; grp: string | null;
  name: string; description: string;
  base_prompt: string; custom_instructions: string; prompt_override: string | null;
  model: string | null; enabled: boolean; defaults: Record<string, unknown>;
  updated_by: string | null; updated_at: string;
}

export const AGENT_MODEL_ALLOWLIST = ["claude-opus-4-8", "claude-sonnet-4-5", "claude-haiku-4-5"];
export const DEFAULT_AGENT_MODEL = process.env.PMM_MODEL ?? "claude-opus-4-8"; // mirrors claude.ts:6

/** Code-level registry: canonical base prompts (task), contract-suffix presence,
 *  placeholder vocabulary, defaults schema, and test-run sample inputs. */
export interface AgentRegistryEntry {
  key: string; kind: "task" | "pmm"; grp?: "A" | "B" | "C";
  basePrompt?: string;                 // task: canonical body (the §1.1 text, exported constants)
  placeholders: string[];              // e.g. ["product_name","product_line","source_type"]
  contract: "fq-answers-json" | "fills-json" | "section-headings" | "markdown";
  defaultsSchema: string;              // human-readable, shown in the drawer
  registryDefaults: Record<string, unknown>; // what revert restores
}
export const AGENT_REGISTRY: Record<string, AgentRegistryEntry>;

/** Cached read (15s TTL, busted on write — decision §0.1-7). Throws AgentError(503)
 *  when the DB is unconfigured; returns a synthetic default row (base from
 *  AGENT_REGISTRY, enabled, no override) when the agents table has no row yet,
 *  so services never hard-depend on the migration having run. */
export async function getAgentConfig(key: string): Promise<AgentConfig>;
export function bustAgentCache(key?: string): void;

/** enabled check + typed error the routes map to 409 (decision §0.1-5). */
export function assertAgentEnabled(cfg: AgentConfig): void; // throws AgentError(409, "The <name> agent is disabled — enable it in the Agents tab.")

/** null → DEFAULT_AGENT_MODEL; unlisted → DEFAULT_AGENT_MODEL + console.warn (decision §0.1-6). */
export function resolveModel(cfg: AgentConfig): string;

/** interpolate {{placeholders}}; unknown placeholders are left verbatim and returned as warnings. */
export function interpolate(templateText: string, vars: Record<string, string>): { text: string; unknown: string[] };

/** THE composition rule (§0 diagram). customInstructions are appended even when an
 *  override is active (requirement (a): they always ride on whatever body is live). */
export function composeAgentPrompt(
  cfg: AgentConfig,
  vars: Record<string, string>,
  contractSuffix: string          // built by the consuming service, code-owned
): string;
// = interpolate(cfg.prompt_override ?? cfg.base_prompt, vars).text
//   + (cfg.custom_instructions.trim() ? `\n\nAdditional instructions from the PMM admin:\n${cfg.custom_instructions.trim()}` : "")
//   + `\n\n${contractSuffix}`

/** Boot sync (decision §0.1-3). Called once from index.ts after route mounts.
 *  Task agents: upsert base_prompt from AGENT_REGISTRY when drifted.
 *  PMM agents: read `${REPO_ROOT}/.claude/agents/${key}.md`; frontmatter description →
 *  description, body after frontmatter → base_prompt. Missing/unreadable file →
 *  console.warn, existing row untouched. Never writes custom_instructions,
 *  prompt_override, model, enabled, or defaults. */
export async function syncAgentBaselines(): Promise<void>;

export class AgentError extends Error { constructor(message: string, readonly status: number) { super(message); } }
```

The six task-agent base-prompt constants move to (or are re-exported from) their owning services and referenced by `AGENT_REGISTRY` — one string per agent, single source of truth for both the seed text (§1.1) and the boot sync.

### 2.2 Per-service refactor plan (smallest diff first; config read points with line refs)

Common pattern per service: load config **once** per operation with `getAgentConfig(key)` → `assertAgentEnabled` → build vars → `composeAgentPrompt(cfg, vars, suffix)` → pass `resolveModel(cfg)` down to `ask()`. Runtime data (docs, answers, slots, scraped sources) keeps riding exactly where it rides today (`extraContext` or the suffix block) — it is never part of config.

**1. `services/claude.ts` — the enabling change (2 lines).**
```ts
export interface AskOptions { extraContext?: string; maxTokens?: number; model?: string; }  // line 33–37
// line 53:  model: opts.model ?? MODEL,
```
No other change. The system prompt, caching, and adaptive thinking are untouched.

**2. `routes/query.ts` → `ask-war-room` (smallest consumer).**
- Top of the handler (currently L28): `const cfg = await getAgentConfig("ask-war-room"); assertAgentEnabled(cfg);` — `AgentError` → `res.status(err.status).json({error: err.message})`.
- Framing (replaces L34–36): `const framingMap = {...ROLE_FRAMING, ...(cfg.defaults.role_framing ?? {})}` — code map stays the fallback; `defaults` wins per role.
- Prompt: `composeAgentPrompt(cfg, {role: role ?? "general"}, suffix)` where the **locked suffix** is `Question from the ${role ?? "internal"} team:\n${question}` and the body is `cfg.prompt_override ?? framingMap[role] ?? framingMap.general` (special case, documented: for this agent the "base body" is the resolved per-role framing, since `base_prompt` is empty — an override collapses all roles to one preamble, with `{{role}}` available).
- `ask(prompt, {extraContext: corpus, model: resolveModel(cfg)})` at L51.

**3. `services/competitive.ts` → `competitive-compare`.**
- In `compare()` after competitor/source resolution, before prompt assembly (L243): load + assert config.
- L243–253 assembly becomes: `[interpolatedBody, registryHintLine, lockedSuffix]` where body = `cfg.prompt_override ?? cfg.base_prompt` (no placeholders), hint line stays code-built runtime (L245), and the locked suffix = the `=== SCRAPED COMPETITOR SOURCES === … === AURIGO KNOWLEDGE BASE … === QUESTION …` blocks (L247–251) verbatim. Note the one ordering change: today the hint sits between PRODUCT_MAP and EVIDENCE_RULES; after the refactor it follows the whole body. Accepted — the hint is advisory, not structural.
- `ask(prompt, {maxTokens: 8000, model: resolveModel(cfg)})` at L263. `PRODUCT_MAP`/`EVIDENCE_RULES` constants remain in the file as the canonical base (exported for `AGENT_REGISTRY`).

**4. `services/templateGenerate.ts` → `template-slot-fill`.**
- `generateFromTemplate` loads + asserts config right before the prompt build (L239).
- `buildSlotFillPrompt` (L98–149) splits into: `buildSlotFillVars(template, product, doc)` (the `{{…}}` map incl. nullable audience/persona/funnel_stage rendered as `"not specified"`, matching L127) and `buildSlotFillSuffix(template, extraBrief)` returning the **locked tail**: optional `Requester's brief: …` line (runtime, stays), then `Slots to fill:\n{slotLines}` (L136–137 logic, unchanged) + the `Return ONLY valid JSON … {"fills": …}` block (L147–148).
- `askFills` (L174) gains `model`; both the initial call and the trim retry (L261) use it. `buildTrimPrompt` (L152–167) is untouched and never composed with config — it is a locked repair mechanism.

**5. `services/questionnaire.ts` → `fq-extraction` and `fq-merge`.**
- `askJson` (L236–244) gains `model?: string` in its opts.
- `extractionPrompt` (L246–276) splits: body from config (vars `product_name`, `product_line`, `source_type`); **locked suffix** = `Questions (JSON):\n{questionsJson}\n\nReturn ONLY valid JSON — no markdown fences, no commentary — matching exactly:\n{"answers":[…]}` (L271–275 verbatim). `runExtractionPass` loads config once after the product fetch (~L342), before the batch loop; every batch reuses the composed prompt exactly as today (L350).
- `mergePrompt` (L285–305) splits the same way: policy body from config; the PMM-feedback line (L286–288) stays **code-appended runtime** (it carries reviewer text, not admin config); locked suffix = L301–304. Config read in `runMergePass` (top, ~L425) and `regenerateMerge` (~L545). All three sites assert enabled; background passes surface `AgentError.message` through the existing `finishRun('failed', …)` catch (L412–414, 534–536).

**6. `services/messagingDoc.ts` → `messaging-doc-generation`.**
- `runGeneration` loads + asserts config once before the Part loop (L301).
- `generationPrompt` (L137–157) recomposes as: config body (vars `part`, `product_name`) + **locked suffix** `Produce ONLY these sections, in order, each starting with a heading "## {id} · {title}":\n{sectionLines}` — locked because `splitSections` (L160–174) parses those headings. Note the structural change: the Produce block moves from mid-prompt to the tail. Verified acceptable: nothing in the prompt references section order after that block today except the Rules, which move into the body above it.
- `sectionLines` (L307–309) merges instructions: `{...SECTION_INSTRUCTIONS, ...(cfg.defaults.section_instructions ?? {})}` — admin can retune one section's instruction without touching code (e.g., pillar count in B2).
- `ask(...)` at L317 gets `model: resolveModel(cfg)`.

### 2.3 Test-run design (the pre-save safety net, requirement (d))

`POST /api/agents/:key/test-run` runs a **candidate** config (request-body fields, unsaved) through the real composition + a real model call against a small static sample, then checks the output contract. The admin sees exactly what a change does *before* saving — and the contract badge is the demo moment for "override can't break the pipeline."

Per-agent sample inputs (static constants in `agents.ts`, no DB/scraping dependencies):

| key | sample vars + runtime | contract check on output |
|---|---|---|
| fq-extraction | 1 built-in ~600-char fake transcript `<doc>` + 3 questions (hard-coded copies of A1-Q1/A3-Q1/C1-Q2) | `parseModelJson` → `{answers:[…]}` with string `question_id`/`content`, numeric `confidence` |
| fq-merge | 1 synthetic question with a transcript + document candidate (conflicting number, to exercise the [Conflict:] rule) | same envelope |
| messaging-doc-generation | Part A, 2 sections (A1, A5), 3 synthetic accepted answers as `extraContext` | output contains `## A1` and `## A5` headings (the `splitSections` regex) |
| template-slot-fill | 2 synthetic slots (headline 60ch / proof 260ch) + 1 synthetic `<section id="B1">` | `parseModelJson` → `{fills:{…}}`, all values strings, then `validateFills` limits |
| ask-war-room | admin-supplied `{question, role}` (400 if missing); context = `retrieveChunks(question, 4)` only (no full corpus — keep test-runs cheap) | none (markdown); guard check only |
| competitive-compare | admin-supplied `{question}` + a built-in static 500-char fake competitor-source block (no scraping in test runs) | none; guard check only |
| any pmm agent | admin-supplied `{brief}` (400 if missing); prompt = composed body + brief; context = `retrieveChunks(brief, 6)` | none; guard check only |

Every test-run response also carries `guard: checkForbiddenWords(output)` (informational — §8.1 surfaced early) and the fully composed prompt so the admin can inspect the body/suffix seam. `compose_only: true` skips the model call (instant preview of the seam).

### 2.4 `app/backend/src/routes/agents.ts` (new) — API contract

Mount: `app.use("/api/agents", agentsRouter)` in `index.ts` (after L59), plus `void syncAgentBaselines()` at boot. All endpoints `requireAuth + requireAdmin` (vol-3 08; §8.4 — configuration of the system's brain is the PMM admin's boundary). Error bodies `{error}` per 03-api-standards. Unknown `:key` → 404.

| # | Method + path | Request | Response |
|---|---|---|---|
| 1 | `GET /api/agents` | — | `200 {agents:[{key, kind, grp, name, description, model, enabled, overridden (prompt_override != null), has_custom_instructions, updated_at, updated_by_name}], default_model, model_allowlist}` — grouped client-side. Empty table (migration not run) → `{agents:[]}` and the UI renders "Run migration 0012" note |
| 2 | `GET /api/agents/:key` | — | `200 {agent:{…all columns}, meta:{contract, contract_suffix_preview (built with sample runtime, code-owned), placeholders, defaults_schema, registry_defaults, model_allowlist, default_model}}` |
| 3 | `PUT /api/agents/:key` | `{custom_instructions?, prompt_override?: string\|null, model?: string\|null, enabled?, defaults?}` (partial) | `200 {agent, warnings:[string]}` — warnings: unknown `{{placeholders}}` in the override, override present on a JSON-contract agent without a test-run this session (advisory only). `400 {error:"model must be one of: …"}` for unlisted model; `400` if `defaults` is not a JSON object. Busts cache; `logActivity("agent", id, user, "agent_updated", {key, fields: [changed names], model})` |
| 4 | `POST /api/agents/:key/revert` | — | `200 {agent}` — semantics per decision §0.1-4. `logActivity(… "agent_reverted", {key})` |
| 5 | `POST /api/agents/:key/test-run` | `{custom_instructions?, prompt_override?, model?, defaults?, input?: {question?, role?, brief?}, compose_only?}` | `200 {prompt, output_raw?, output_html? (markdown-rendered for pmm/markdown agents), contract:{checked:boolean, ok:boolean, error?}, guard:{ok, violations}, model_used, duration_ms}`. `400` missing required sample input; `502 {error:"Test run failed: …"}` on model failure. `logActivity(… "agent_test_run", {key, with_override, contract_ok})`. Candidate config is **never persisted** by this endpoint |

Note #3's advisory warning needs no server state: the frontend tracks "tested since last edit" locally; the server only returns the placeholder warning. (Keeps the API stateless; the hard guarantee is the code-owned suffix, not the advisory.)

---

## 3. Frontend

### 3.1 Route, nav, helpers (edits)

- `app/frontend/src/main.tsx`: `<Route path="/agents" element={<Agents />} />`.
- `app/frontend/src/components/Layout.tsx`: `ADMIN_NAV` (L24–30) gets `{ to: "/agents", label: "Agents", icon: "fa-robot", adminOnly: true }` after "Integrations". Backend 403s regardless of nav visibility (08-authorization).
- `app/frontend/src/lib/api.ts`: interfaces `AgentSummary`, `AgentDetail`, `AgentMeta`, `TestRunResult`; helpers `listAgents()`, `getAgent(key)`, `updateAgent(key, patch)`, `revertAgent(key)`, `testRunAgent(key, body)`.

### 3.2 Page — `app/frontend/src/pages/Agents.tsx` (+ one component)

```
Agents (page; owns list, selected key, drawer open state)
├── Header: title + intro line ("Configure the AI steps this app runs and the 14 PMM
│   sub-agents. Changes apply at run time; every save is logged.")
├── Group sections (in order):
│   "Pipeline task agents" · "Intelligence agents (Group A)" ·
│   "Activation agents (Group B)" · "Governance agents (Group C)"
│   └── AgentRow (.card, one per agent — list rows, not a grid; 20 rows must scan fast)
│         name + key (.pill), description (1 line, ellipsis)
│         model pill: "Default · claude-opus-4-8" (.pill-archived) or the custom model (.pill-live)
│         "Overridden" .pill-draft when prompt_override set; "+instructions" chip when custom_instructions
│         enabled toggle rendered as .pill-live "Enabled" / .pill-lost "Disabled" (click = PUT {enabled})
│         updated line: "Updated 2026-08-06 · P. M." · click row → drawer
└── AgentDrawer  — components/AgentDrawer.tsx (only new component file; right-side panel,
    same inline-styled overlay pattern as Layout's avatar menu — no new dependency)
    ├── Identity: name, key, kind/grp pills, description
    ├── Config form
    │     Model <select>: "Default (claude-opus-4-8)" + allowlist entries
    │     Custom instructions <textarea> (helper text: "Appended to the prompt body on every
    │       run — base or override. Use for tone, emphasis, extra constraints.")
    │     Task defaults <textarea> (JSON; client-side JSON.parse validation before save;
    │       defaults_schema from meta shown above it — e.g. role_framing keys, section_instructions)
    ├── Prompt panel
    │     Base prompt: read-only <pre> (.prose mono)
    │     "Use full override" toggle → editable <textarea> prefilled with base; "clear override" link
    │     Locked contract block: read-only, visually distinct (dark .card), label
    │       "Always appended — locked. Overrides cannot change the output contract." (contract_suffix_preview)
    │     Placeholder chips ({{product_name}} …) from meta.placeholders
    ├── Test run panel
    │     input fields per agent (question+role select / question / brief) when required
    │     [Preview prompt] (compose_only) · [Run test] .btn-primary
    │     Result: contract badge (.pill-final "Contract OK" / .pill-lost "Contract BROKEN — fix
    │       the override before saving"), guard badge (violations listed), output (.prose),
    │       <details> composed prompt, duration + model_used
    ├── Footer: [Save] .btn-primary · [Revert to base] .btn (confirm dialog: lists what revert
    │     clears per §0.1-4) · save warnings banner (unknown placeholders, untested override)
    └── States: loading · save 400 (inline error on the model/defaults field) · 409 on a
        disabled-agent test-run · dirty-state guard on close
```

Page-level states: loading · empty (`agents:[]` → migration note) · list · drawer. Non-admins never reach the page (nav hidden + every API call 403s → redirect-to-home pattern used by other admin pages).

---

## 4. File-by-file change list

**New files**

| Path | Contents |
|---|---|
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\supabase\migrations\0012_agents.sql` | DDL + 6 task seeds (verbatim base prompts, §1.1) + 14 pmm seeds (§1.2) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\agents.ts` | §2.1 registry, config cache, composition, boot sync, samples, contract checks |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\routes\agents.ts` | §2.4 endpoints 1–5 |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\pages\Agents.tsx` | §3.2 page |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\AgentDrawer.tsx` | §3.2 drawer |

**Edits**

| Path | Change |
|---|---|
| `…\app\backend\src\services\claude.ts` | `AskOptions.model?`; `model: opts.model ?? MODEL` (L33–37, L53). Nothing else |
| `…\app\backend\src\index.ts` | mount `agentsRouter`; `void syncAgentBaselines()` after mounts |
| `…\app\backend\src\routes\query.ts` | §2.2-2: config load, defaults-merged framing, composed prompt, model, 409-on-disabled |
| `…\app\backend\src\services\competitive.ts` | §2.2-3: config in `compare()`, body-from-config, export base constants |
| `…\app\backend\src\services\templateGenerate.ts` | §2.2-4: split `buildSlotFillPrompt` into vars + locked suffix; config in `generateFromTemplate`; model through `askFills` |
| `…\app\backend\src\services\questionnaire.ts` | §2.2-5: split extraction/merge prompts; config in `runExtractionPass` / `runMergePass` / `regenerateMerge`; model through `askJson` |
| `…\app\backend\src\services\messagingDoc.ts` | §2.2-6: config in `runGeneration`; suffix-tail Produce block; `defaults.section_instructions` merge; model |
| `…\app\frontend\src\main.tsx` | `/agents` route |
| `…\app\frontend\src\components\Layout.tsx` | ADMIN_NAV entry |
| `…\app\frontend\src\lib\api.ts` | typed helpers + interfaces (§3.1) |

No changes to `guardrails.ts`, `html.ts`, `auth.ts`, `activity.ts`, `artifacts.ts`, `templates.ts`, `templateRender.ts` — reused as-is. No changes to `.claude/agents/*.md` — they stay canonical and read-only to the app.

---

## 5. Build sequence (each stage ends with a qa-reviewer verification)

1. **`claude.ts` model param.** Verify: existing flows unchanged (no callers pass `model` yet); a manual call with `model` overrides; without it, `PMM_MODEL` default holds.
2. **Migration 0012 + `agents.ts` (registry, cache, compose, sync) + endpoints 1–4.** Run `npm run migrate`, boot the server. Verify: 20 rows; 14 pmm rows have non-empty `base_prompt` after boot (sync worked; check one against its `.claude/agents` body); task base prompts match the code constants byte-for-byte; PUT with `model:"gpt-5"` → 400; PUT valid change → row updated, `activity_log` row with `agent_updated` + changed fields; revert clears override/instructions/model/defaults but not `enabled`; second boot does not clobber a saved `custom_instructions`; non-admin token → 403 on every endpoint; re-running the migration is idempotent and does not regress the synced pmm prompts.
3. **Test-run endpoint (5).** Verify per contract row in §2.3: fq-extraction sample returns `contract.checked:true`; plant a sabotage override ("reply in plain prose, never JSON") → `contract.ok:false` with the parse error surfaced — **and confirm the composed prompt still ends with the locked JSON suffix**; ask-war-room without `question` → 400; `compose_only` makes no model call (duration ~0, no `output_raw`); guard flags a planted "seamless" in output-land (use a custom instruction demanding the word — informational, run still 200).
4. **Consumer rewires (query → competitive → templateGenerate → questionnaire → messagingDoc, in that order — smallest diff first).** After each: run the feature's happy path end-to-end and confirm byte-identical prompt semantics under default config (no override, no instructions ⇒ composed prompt ≡ old prompt modulo the two documented ordering notes in §2.2-3/-6). Then per service: set a visible `custom_instructions` ("End with the line TEST-MARKER") and confirm it appears in output; set `enabled=false` and confirm the 409/failed-run message names the Agents tab; set model to a cheaper allowlisted model and confirm `model_used` changes (log line). Questionnaire regression: full extract → merge → decide → generate on the seeded product still completes with all-default config.
5. **Frontend.** Verify: nav admin-only; all 4 groups render with 6+5+5+4 rows; enabled toggle round-trips from the row; drawer save/revert/test-run against a task agent and a pmm agent; contract-broken badge blocks nothing but is unmissable; dirty-close guard; 400 model error lands inline; the demo path (open voice-of-market → add a custom instruction → test-run with a brief → watch tuned output) completes in one sitting.

Testing posture (vol-3 13, hackathon-scaled): unit-test the pure functions — `interpolate` (unknown-placeholder behavior), `composeAgentPrompt` (override + instructions + suffix ordering; suffix always present), `resolveModel` (null/unlisted fallbacks), the frontmatter parser in `syncAgentBaselines`, and each contract checker against canned good/bad outputs. Model-touching paths are covered by the stage verifications, not mocked suites.

---

## 6. Risks and edge cases

| Risk | Handling |
|---|---|
| Override breaks a JSON contract despite the suffix (e.g. "explain your reasoning first") | Three deterministic walls, none of them model judgment: (1) code-appended suffix always closes the prompt with the format demand; (2) `parseModelJson`'s existing fence-strip + brace-slice + one repair retry (`questionnaire.ts:160–166, 236–244`) tolerates preamble noise; (3) `sanitizeCandidate` / `validateFills` reject malformed entries. Plus the pre-save net: test-run contract badge + one-click revert. Residual risk accepted and visible: a run that still fails lands in `fq_runs.detail` / a 502 naming the agent, and the Agents tab is one click from revert |
| Config drift vs. `.claude/agents/` source files | Files are canonical; boot sync reconciles `base_prompt` every deploy and never touches admin fields (decision §0.1-3). Editing PMM base prompts **in the app** is deliberately not offered — edit the file, restart. In-app base editing is V2 (would need write-back + git hygiene) |
| Seed prompt duplication between migration and code | Accepted as bootstrap-only: code constants are canonical, sync overwrites drifted seeds at first boot, and `AGENT_REGISTRY` references the same exported constants the services use — one string per agent in exactly one module |
| Model allowlist staleness / invalid model in DB | Single constant; write-time 400 + read-time `resolveModel` fallback with console warning. Changing the allowlist is a one-line code change, no migration |
| Config-read caching staleness | 15 s TTL + same-process bust on write; background runs snapshot config at run start (§0.1-7). Worst case: a consumer request within 15 s of a save on a second process uses the old config — bounded and demo-irrelevant (single instance) |
| `enabled=false` strands a pipeline mid-flow | Assert happens at operation start, never mid-batch; message always names the Agents tab; drawer shows Disabled state prominently. Governance kill switch, not a scheduling feature |
| Placeholder typos in an override (`{{product}}` instead of `{{product_name}}`) | `interpolate` leaves unknown placeholders verbatim and PUT returns them as warnings; test-run `compose_only` shows the raw seam instantly |
| `activity_log.entity_id` is uuid, agent identity is a text key | Agents table carries both (uuid PK for the log, unique `key` for code); `detail.key` makes log rows human-readable |
| Empty/missing agents table (migration not yet run) on a consumer path | `getAgentConfig` synthesizes the registry default row — pipelines keep working exactly as pre-0012; only the Agents tab shows the migration note |
| test-run cost/abuse | Admin-only, one model call, small samples, `compose_only` free path, activity-logged. No further throttling for MVP |

---

## 6.1 Post-QA addendum: four prompt-ordering deltas, not two (and migration is 0013)

The migration shipped as `supabase/migrations/0013_agents.sql` (0012 was taken by
0012_guardrails.sql from a parallel session). Stage-4 QA verified byte-identity
under default config for fq-extraction, fq-merge (no feedback), and ask-war-room.
Beyond the two ordering deltas documented in the refactor plan, two more exist —
both semantically benign, both keeping the locked JSON tail as the prompt's close:

3. **template-slot-fill:** Rules now precede the brief and slot list (which moved
   into the locked suffix). Old order: Audience → brief → context → Slots →
   Rules → JSON. New: Audience → context → Rules → brief → Slots → JSON.
4. **fq-merge with feedback:** the reviewer-feedback line moved from the final
   policy bullet into the top of the locked suffix (after body + custom
   instructions), gaining a blank line. Byte-identical when no feedback.

## 7. Open decisions for the human

1. **Model allowlist contents** — proposed `["claude-opus-4-8", "claude-sonnet-4-5", "claude-haiku-4-5"]` (§0.1-6). Confirm the two non-default entries, or trim to opus-only if API-key access is opus-scoped for the demo.
2. **PMM agents: config + test-run only** (§0.1-1) — confirm the V2 deferral of "run agent → draft war-room doc". If the demo script needs one runnable PMM agent, the cheapest honest extension is a "Save test-run output as draft artifact" button (reuses the artifacts draft machine), but it is *not* in this blueprint.
3. **`ask-war-room` override semantics** — an override collapses per-role framing into one preamble (§2.2-2). Alternative (per-role overrides) lives naturally in `defaults.role_framing`, which the drawer already edits — confirm this split is acceptable.
4. **Studio free-form generation (`routes/studio.ts:115`) and `routes/ai.ts` calls are NOT registered as agents** — the requirement's task-agent list named six; these two remain hard-coded. Confirm, or ask for a follow-up slice (`studio-generation` would be a natural seventh key, additive, no schema change).
5. **Prompt-ordering deltas** — two documented, deliberate reorderings under default config: competitive hint line now follows EVIDENCE_RULES (§2.2-3); messaging-doc Produce block moves to the prompt tail (§2.2-6). Confirm both (qa-reviewer stage 4 checks output quality did not regress).

**Proposed (not applied) CLAUDE.md repository-map update:** none needed beyond the already-proposed `app/docs/blueprints/` pointer line (foundation-questionnaire blueprint §8-6); this feature adds no new top-level directories. If accepted, the app-stack paragraph could note "agent prompts are runtime-configurable via the admin Agents tab; `.claude/agents/` files remain canonical for the 14 sub-agents."
