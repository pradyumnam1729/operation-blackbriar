# Blueprint — Foundation Questionnaire pipeline

- **Status:** ready for build (hackathon MVP slice)
- **Date:** 2026-08-06
- **Author:** app-architect
- **Builds on:** `pmm-playbook/vol-3-architecture/` (system overview, data model, AI architecture), Aurigo `engineering-playbook/vol-3-architecture/` 03-api / 07-security / 08-authorization / 13-testing
- **Constitution rules encoded:** §3.1 intelligence-before-activation (extraction + sign-off gate generation), §3.2 positioning → messaging → copy (Parts A → B → C/D/E chain), §4 foundational doc, §7.4 value-prop schema (Part C), §8.1 QA gates / anti-generic, §8.4 draft → PMM-admin approval, §8.5 proposed context updates (war-room write on approval)
- **Demo value props served:** one rigorous foundational doc per product built from real evidence in minutes (90% faster), single source of truth for downstream assets (100% consistency)

---

## 0. What this ships

A per-product pipeline that turns ingested evidence into the approved **Positioning & Messaging document** (the reference is `reference output/Output/Masterworks AI/Messaging/Masterworks AI Messaging and Positioning.pdf`, Parts A–F, 18 pp):

1. **Question bank** (~34 extract questions + a section registry marking synthesize-only sections) seeded in the migration.
2. **Two extraction passes** per product: Pass 1 over `context_docs` with `doc_type='transcript'`; Pass 2 over other `context_docs` (prd/jtbd/battlecard/other) + `release_notes`. Each produces per-question candidates `{content, sources[], confidence}`.
3. **Reconciliation queue**: per question — transcript candidate, document candidate, AI-proposed merge citing both. PMM CTAs: Accept / Edit / Pick one source / Regenerate (with feedback) / Reject. Single-candidate questions still require sign-off. Unanswered questions become gaps (the doc's "⚠ To confirm" items).
4. **Doc generation** after sign-off: Parts A–F, section by section, from final answers only. B7 renders the honest no-cleared-proof placeholder; F5 lists remaining gaps. Doc is born `draft`; only PMM admin promotes to `final` (forbidden-words gate first). On approval: versioned row in DB, markdown written to `GTM-War-Room/`, styled HTML exported to the configured local Output folder (reusing the `localFolders` export pattern).
5. **Integration point (out of scope to wire):** the approved `messaging_docs` row (latest `final` per product) is the primary generation source for Studio/artifact generation. Downstream rewiring is a follow-up blueprint.

### Survey findings the design leans on (verified in code)

| Existing piece | File | Reused for |
|---|---|---|
| `ask(userPrompt, {extraContext, maxTokens})` — claude-opus-4-8, adaptive thinking, brand DNA as cached system prefix | `app/backend/src/services/claude.ts` | all model calls; sources go in `extraContext` so the cached prefix stays byte-identical |
| `supabase()` service-role client, no-op when unconfigured | `app/backend/src/services/db.ts` | all persistence |
| `requireAuth` / `requireAdmin` / `isAdmin` | `app/backend/src/middleware/auth.ts` | authorization boundary (07/08): pipeline is admin-only; final docs readable by all roles |
| `logActivity(entityType, entityId, actorId, action, detail)` | `app/backend/src/services/activity.ts` | audit trail on every decision/transition |
| `checkForbiddenWords(text)` → `{ok, violations}` | `app/backend/src/services/guardrails.ts` | promotion gate (mirrors `artifacts.ts` status endpoint) |
| `markdownToHtml` / `htmlToText` | `app/backend/src/services/html.ts` | doc rendering; markdown never crosses to the frontend |
| `WAR_ROOM_DIR`, traversal-safe path resolution | `app/backend/src/services/warRoom.ts` | war-room writer |
| `getLocalFolders()` → `config.outputPath`; styled-HTML export wrapper in `exportFinals` | `app/backend/src/services/localFolders.ts` | Output-folder HTML export (same `<style>` block, same footer pattern) |
| Draft→final state machine + guard-gated `POST /:id/status`, `flatten()` join style, `{error}` JSON shape | `app/backend/src/routes/artifacts.ts` | approval workflow to mirror exactly |
| `apiGet/apiPost` with Supabase bearer token; `getProducts()` | `app/frontend/src/lib/api.ts` | new typed helpers |
| Admin nav group, `.step-pills`, `.card`, `.pill-*`, `.btn`, `.prose`, `.filechip`, `.empty-note` classes | `Layout.tsx`, `styles/brand.css` | new page UI |

**Numbering correction:** migrations 0001–**0007** exist (`0007_local_folders.sql`). This feature's migration is **`0008_foundation_questionnaire.sql`**, not 0007 as the task brief assumed.

**Product identity note:** `0002_platform.sql` deleted the `Masterworks AI` product row (portfolio is now line+module). The reference doc is for Masterworks AI, so 0008 seeds a `Masterworks AI` product row (`line='Masterworks', module='AI'`) with a fixed UUID for the demo. Flagged as an open decision below.

---

## 1. Migration `supabase/migrations/0008_foundation_questionnaire.sql`

Seed strategy: sections and questions are seeded **inside this migration** with stable text PKs (`'A1'`, `'A1-Q1'`) and `on conflict (id) do update` so re-running the migration refreshes wording without breaking `fq_answers` FKs. No separate seeding step.

```sql
-- Foundation Questionnaire: question bank, extraction candidates + PMM decisions,
-- versioned messaging docs. Constitution: §3.1 (intelligence gate), §8.4 (draft→final).

-- ---------- demo product row (Masterworks AI was removed in 0002) ----------
insert into products (id, name, line, module) values
  ('11111111-1111-1111-1111-111111111107', 'Masterworks AI', 'Masterworks', 'AI')
on conflict (name) do update set line = excluded.line, module = excluded.module;

-- ---------- section registry (Parts A–F of the reference doc) ----------
create table if not exists fq_sections (
  id text primary key,                      -- 'A1' … 'F5'
  part text not null,                       -- 'A' … 'F'
  title text not null,
  mode text not null check (mode in ('extract', 'synthesize', 'hybrid', 'auto', 'static')),
  ord int not null
);

-- ---------- question bank (extract questions only) ----------
create table if not exists fq_questions (
  id text primary key,                      -- 'A1-Q1'
  section_id text not null references fq_sections(id),
  ord int not null,
  kind text not null default 'extract' check (kind = 'extract'),
  prompt text not null,
  guidance text                             -- what a good answer contains; shown to model + reviewer
);

-- ---------- per-product answers: candidates + merge + PMM decision ----------
create table if not exists fq_answers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  question_id text not null references fq_questions(id),
  transcript_candidate jsonb,               -- {content, confidence, sources:[{doc_id,title,evidence}]}
  document_candidate jsonb,                 -- same shape
  merged_candidate jsonb,                   -- same shape; AI merge proposal citing both
  final_answer text,                        -- what the PMM accepted or edited
  final_sources jsonb not null default '[]',
  status text not null default 'unanswered'
    check (status in ('unanswered', 'pending_review', 'accepted', 'rejected', 'gap')),
  feedback text,                            -- free-text PMM feedback (persisted across regenerate)
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (product_id, question_id)
);

-- ---------- run tracking (background jobs, polled by the UI) ----------
create table if not exists fq_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  pass text not null check (pass in ('transcripts', 'documents', 'merge', 'generate')),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  detail text,                              -- human-readable result / error; generate stores doc id here
  docs_used int not null default 0,
  questions_answered int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ---------- versioned messaging & positioning documents ----------
create table if not exists messaging_docs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  version int not null,
  status text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  title text not null,
  sections jsonb not null,                  -- [{id:'A1', title, markdown}] in reference order
  content_md text not null,                 -- assembled markdown (war-room artifact incl. frontmatter)
  content_html text not null,               -- sanitized HTML for in-app viewing + export
  gaps jsonb not null default '[]',         -- F5 list: [{question_id, prompt, note}]
  guard_violations jsonb not null default '[]',
  war_room_path text,                       -- set on approval
  exported_path text,                       -- set on approval (null if local folders unconfigured)
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, version)
);

alter table fq_sections enable row level security;
alter table fq_questions enable row level security;
alter table fq_answers enable row level security;
alter table fq_runs enable row level security;
alter table messaging_docs enable row level security;
-- (Backend service-role is the only client — same posture as 0002.)

-- ---------- seed: sections ----------
insert into fq_sections (id, part, title, mode, ord) values
  ('A1','A','The Why (Golden Circle)','extract',1),
  ('A2','A','Market & Category','extract',2),
  ('A3','A','Best-Fit Customer & ICP','extract',3),
  ('A4','A','Competitive Alternatives & Right to Win','extract',4),
  ('A5','A','Positioning Statements','synthesize',5),
  ('B1','B','Umbrella Message & Taglines','synthesize',6),
  ('B2','B','Top Value Pillars','synthesize',7),
  ('B3','B','What It Does','extract',8),
  ('B4','B','Messaging Matrix','synthesize',9),
  ('B5','B','Key Capabilities & Agent Catalog','extract',10),
  ('B6','B','The AI Story & Platform','hybrid',11),
  ('B7','B','Proof Points & Testimonials','auto',12),
  ('C1','C','Economic Buyer (Capital Program / PMO Director)','hybrid',13),
  ('C2','C','Finance & Budget Officer','hybrid',14),
  ('C3','C','Primary User (Project / Portfolio Manager)','hybrid',15),
  ('C4','C','IT & Security','hybrid',16),
  ('D1','D','How We Stack Up Against the Alternatives','synthesize',17),
  ('D2','D','Where the Competition Is','extract',18),
  ('D3','D','Head-to-Head Battlecards','synthesize',19),
  ('D4','D','Objection Handling','hybrid',20),
  ('E1','E','Marketing Kit','synthesize',21),
  ('E2','E','Sales Kit','synthesize',22),
  ('E3','E','Proposals / RFP Kit','synthesize',23),
  ('F1','F','Voice & Tone','synthesize',24),
  ('F2','F','Preferred Word List','synthesize',25),
  ('F3','F','The Check-Yourself Checklist','static',26),
  ('F4','F','Ownership & Version Control','static',27),
  ('F5','F','Open Inputs to Confirm','auto',28)
on conflict (id) do update set title = excluded.title, mode = excluded.mode, ord = excluded.ord;
```

**Mode semantics** (enforced by services, documented here):
- `extract` — answered only by the extraction passes + PMM sign-off.
- `synthesize` — no questions; generated later from approved answers (never extracted).
- `hybrid` — factual sub-questions are extracted (persona pains, competitor facts, platform/trust facts); narrative (value props, pitches, counters) is synthesized from those approved facts. B6 carries extract questions deliberately: certifications and security claims must never be model-invented, so they enter only as extracted, PMM-approved facts.
- `auto` — deterministic: B7 placeholder, F5 gap list. `static` — fixed template text (F3, F4).

### 1.1 Seeded question bank (34 questions — the exact seed rows)

`insert into fq_questions (id, section_id, ord, prompt, guidance) values … on conflict (id) do update set prompt = excluded.prompt, guidance = excluded.guidance;`

| id | section | ord | prompt | guidance |
|---|---|---|---|---|
| A1-Q1 | A1 | 1 | Why does this product exist — what change in the world does it drive for its customers? | The "Why" of the Golden Circle. A belief about the customer's world, not a feature. |
| A1-Q2 | A1 | 2 | How does the product deliver that change — what approach, platform, or method makes it possible? | The "How": the mechanism (platform, data grounding, workflow placement). |
| A1-Q3 | A1 | 3 | What is the product, in one plain-language sentence? | The "What": named product + what it lets teams do. |
| A2-Q1 | A2 | 1 | What market category does the product claim, and what is it deliberately positioned against or distinct from? | Category name + the contrast frame (e.g. built-in vs bolt-on). |
| A2-Q2 | A2 | 2 | Why now — what shifts in the customer's environment make this urgent today? | 2–4 "why now" drivers (complexity, retirements, siloed data, funding pressure). |
| A2-Q3 | A2 | 3 | What market statistics or third-party figures support the opportunity, and what is the source and date of each? | Numbers only with source + date; unsourced figures become "⚠ To confirm". |
| A3-Q1 | A3 | 1 | Who is the best-fit customer — organization type, situation, and constraint that makes them ideal? | One tight sentence: who, running what, under what pressure. |
| A3-Q2 | A3 | 2 | Which segments are targeted first (verticals, agency types, sizes)? | Named segments in priority order. |
| A3-Q3 | A3 | 3 | Who is in the buying committee — which roles are in the room, and who signs? | Roles/titles; mark the economic buyer. |
| A3-Q4 | A3 | 4 | What events or pressures trigger a purchase (buying triggers)? | Concrete triggers: new funding, audit pressure, turnover, backlog. |
| A3-Q5 | A3 | 5 | What signals mark a prospect as NOT a fit (walk-away signals)? | Disqualifiers: no funded program, policy blockers, no budget cycle. |
| A4-Q1 | A4 | 1 | What do buyers do instead of buying this product — including status quo, DIY, and adjacent tools? | Alternatives as the buyer sees them, not just named vendors. |
| A4-Q2 | A4 | 2 | What can this product claim that competitors cannot copy (unique attributes / right to win)? | 2–4 durable attributes with the reason each is hard to copy. |
| A4-Q3 | A4 | 3 | What scale or adoption proof shows the right to win is real (customer counts, dollar volume, live capability)? | Quantified proof of scale, each with where it was stated. |
| B3-Q1 | B3 | 1 | In plain language, what does the product do for its users day to day? | 1–2 sentences a first-time reader understands; no jargon. |
| B3-Q2 | B3 | 2 | How does the product work end to end — the flow from user need to delivered outcome? | One paragraph: inputs, what runs where, who approves, what comes out. |
| B5-Q1 | B5 | 1 | List every named capability, module, or agent the product ships with, grouped as the sources group them. | Complete named list with groupings (e.g. Copilot / Planning / Delivery). |
| B5-Q2 | B5 | 2 | For each capability or agent: what does it do, and what outcome or metric does it deliver? | Per item: job + quantified outcome where stated. |
| B5-Q3 | B5 | 3 | How can customers extend or customize the product beyond what ships out of the box? | Builder/configuration options; what is configurable vs fixed. |
| B6-Q1 | B6 | 1 | What underlying platform or technology is the product built on, and what data or expertise grounds it? | Platform name + grounding claim (e.g. 20+ years of program data). |
| B6-Q2 | B6 | 2 | What are the platform's architectural building blocks or layers, as the sources describe them? | Layer names + one line each; only what sources state. |
| B6-Q3 | B6 | 3 | What security, governance, and compliance facts are explicitly stated (certifications, audit trails, data handling)? | Facts only — certification names verbatim; never inferred. |
| C1-Q1 | C1 | 1 | Economic buyer (e.g. capital program / PMO director): what are they measured on? | Their success metrics in business terms. |
| C1-Q2 | C1 | 2 | Economic buyer: what are their top pains, in their own words where possible? | Raw quotes preferred; note which call/doc each came from. |
| C2-Q1 | C2 | 1 | Finance & budget owner: what are they measured on? | Defensibility, cost control, audit readiness. |
| C2-Q2 | C2 | 2 | Finance & budget owner: top pains, in their own words where possible? | Raw language on defending decisions, scattered data. |
| C3-Q1 | C3 | 1 | Primary user (e.g. project / portfolio manager): what are they measured on? | Delivery metrics. |
| C3-Q2 | C3 | 2 | Primary user: top pains, in their own words where possible? | Admin burden, late risk discovery — raw quotes. |
| C4-Q1 | C4 | 1 | IT & security: what are they measured on and what must they protect? | Security, governance, controlled adoption. |
| C4-Q2 | C4 | 2 | IT & security: top concerns about adopting this product category, in their own words? | Data export, traceability, shadow AI. |
| D2-Q1 | D2 | 1 | Procore: what is their current product/AI capability and positioning, per the sources (with dates)? | Facts + as-of date; no editorializing. |
| D2-Q2 | D2 | 2 | Kahua: what is their current product/AI capability and positioning, per the sources (with dates)? | Same. |
| D2-Q3 | D2 | 3 | EcoInteractive: what is their current product/AI capability and positioning, per the sources (with dates)? | Same. |
| D4-Q1 | D4 | 1 | What objections, doubts, or pushbacks do prospects and customers actually raise? Quote raw language and note who raised each. | Verbatim objections from calls; the counters are synthesized later. |

Competitor names and persona archetypes are seeded from the current war room + reference doc; per-product configurability is V2 (see Open decisions).

---

## 2. API contract

Mount: `app.use("/api/questionnaire", questionnaireRouter)` and `app.use("/api/messaging-docs", messagingDocsRouter)` in `app/backend/src/index.ts`. All error bodies are `{ "error": string }` (existing convention, per 03-api-standards). All pipeline endpoints are `requireAuth + requireAdmin` — the questionnaire is PMM-admin work (§8.4, vol-3 08-authorization). Final messaging docs are readable by every authenticated role (they are the "single source of truth" consumers pull from).

| # | Method + path | Auth | Request | Response |
|---|---|---|---|---|
| 1 | `GET /api/questionnaire/:productId` | admin | — | `200 {sections:[{id,part,title,mode,ord,questions:[{id,ord,prompt,guidance,answer:{id,status,transcript_candidate,document_candidate,merged_candidate,final_answer,final_sources,feedback,decided_at}\|null}]}], progress:{total,unanswered,pending_review,accepted,rejected,gaps}, runs:[latest fq_runs row per pass]}` — sections with `mode<>'extract'` return `questions: []` |
| 2 | `POST /api/questionnaire/:productId/extract` | admin | `{pass:"transcripts"\|"documents"}` | `202 {run:{id,pass,status:"running",docs_used}}`. `409` if any run for this product is `running`. `422 {error:"No <transcripts\|documents> ingested for this product yet. Add sources via Requests & intake, the Uploads console, or the local Input folder."}` when the source set is empty (§3.1 fail-fast) |
| 3 | `POST /api/questionnaire/:productId/merge` | admin | — | `202 {run}`. `409` if a run is running or if neither pass has completed (`detail` explains). Marks questions with zero candidates as `gap` |
| 4 | `GET /api/questionnaire/:productId/runs` | admin | — | `200 {runs:[{id,pass,status,detail,docs_used,questions_answered,started_at,finished_at}]}` (poll target; newest first) |
| 5 | `POST /api/questionnaire/answers/:answerId/decision` | admin | `{action:"accept"\|"edit"\|"pick"\|"regenerate"\|"reject", content?, source?:"transcript"\|"document", feedback?}` | `200 {answer}` (updated row). Semantics: **accept** → `final_answer=merged.content`, `final_sources=merged.sources`, status `accepted`; **edit** → requires `content`, sources kept from merged, status `accepted`; **pick** → requires `source`, copies that candidate to final, status `accepted`; **regenerate** → requires `feedback`, synchronous single-question re-merge incorporating feedback, updates `merged_candidate`, status stays `pending_review`; **reject** → status `rejected`, `feedback` stored. `400` on missing required field; `409` if answer status is `unanswered` (nothing to decide). Every decision → `logActivity("fq_answer", id, user, action, {...})` |
| 6 | `POST /api/questionnaire/:productId/generate` | admin | — | `202 {run:{id,pass:"generate",...}}`. `409 {error:"Questionnaire is not signed off — N question(s) still unanswered or pending review.", pending:N}` unless every extract question is `accepted`, `rejected`, or `gap` (§3.1 gate). On completion the run's `detail` holds the new `messaging_docs.id` |
| 7 | `GET /api/messaging-docs/:productId` | any role | — | `200 {docs:[{id,version,status,title,created_at,approved_at,war_room_path,exported_path}]}` — non-admins see `final`/`archived` only |
| 8 | `GET /api/messaging-docs/doc/:id` | any role | — | `200 {doc:{…all columns, content_html, gaps, guard_violations}}`. `403` for non-admin when status is `draft` (mirrors `artifacts.ts` canRead) |
| 9 | `POST /api/messaging-docs/doc/:id/approve` | admin | — | `200 {doc, warRoomPath, exportedPath}` (`exportedPath:null` + `warning` string if local folders unconfigured). Re-runs `checkForbiddenWords` on `htmlToText(content_html)`; `422 {error, violations}` on failure — identical shape to `artifacts.ts` finalize gate. Archives any previous `final` version for the product. `409` if not `draft` |

Empty states: #1 with no answers yet returns every extract question with `answer:null`; the UI renders the "run extraction" empty state. #7 returns `{docs:[]}`.

---

## 3. Service design

### 3.1 `app/backend/src/services/questionnaire.ts` (new)

```ts
export interface CitedSource { doc_id: string; title: string; evidence: string }
export interface Candidate { content: string; confidence: number; sources: CitedSource[] }
export interface SourceDoc { id: string; title: string; content: string }
export type RunPass = "transcripts" | "documents" | "merge" | "generate";

/** Insert fq_runs row; 1 active run per product enforced by caller (409). */
export async function startRun(productId: string, pass: RunPass): Promise<string>;
export async function finishRun(runId: string, status: "done" | "failed", detail: string, counts?: {docsUsed?: number; questionsAnswered?: number}): Promise<void>;

/** Pass sources. transcripts: context_docs where doc_type='transcript' and (product_id = :p or product_id is null).
 *  documents: context_docs with doc_type in ('prd','jtbd','battlecard','other') same product filter,
 *  PLUS release_notes for the product (title = filename, content = raw_text).
 *  Reconciliation sign-off is the validation gate, so unapproved context_docs are included. */
export async function gatherSources(productId: string, pass: "transcripts" | "documents"): Promise<SourceDoc[]>;

/** Greedy batching: individual docs truncated to 30_000 chars; docs packed into
 *  batches of <= 80_000 chars total. One model call per batch, all 34 questions per call. */
export function batchDocs(docs: SourceDoc[], maxChars?: number): SourceDoc[][];

/** Strip ``` fences, slice first '{' .. last '}', JSON.parse. Throws on failure. */
export function parseModelJson<T>(raw: string): T;

/** Cross-batch reducer: keep the higher-confidence candidate per question. */
export function reduceCandidates(a: Candidate | null, b: Candidate | null): Candidate | null;

/** The pass. Sequential batches (no concurrency — protects the API budget and keeps
 *  the prompt cache warm). Upserts fq_answers.{transcript|document}_candidate per question.
 *  Wrapped in try/catch → finishRun('failed', message). Fired with `void` from the route. */
export async function runExtractionPass(productId: string, pass: "transcripts" | "documents", runId: string): Promise<void>;

/** Merge proposer. For each fq_answers row of this product:
 *  both candidates → include in one batched merge call (chunks of ~12 questions);
 *  one candidate  → merged_candidate = that candidate verbatim (no model call);
 *  none           → status 'gap'.
 *  Sets status 'pending_review' wherever a merged_candidate lands (single-candidate
 *  questions still require sign-off — requirement 3). */
export async function runMergePass(productId: string, runId: string): Promise<void>;

/** Synchronous single-question re-merge for the Regenerate CTA; returns the new proposal. */
export async function regenerateMerge(answerId: string, feedback: string): Promise<Candidate>;

/** True when no extract question for the product is 'unanswered' or 'pending_review'. */
export async function isSignedOff(productId: string): Promise<{ok: boolean; pending: number}>;
```

All model calls go through the existing `ask()` — source documents ride in `extraContext`, never in the system prompt, so the cached brand-DNA prefix stays byte-identical (vol-3 `03-ai-architecture`, pmm-playbook vol-7).

**Extraction prompt (exact draft).** `ask(userPrompt, { extraContext: docsXml, maxTokens: 16000 })` where `docsXml` is each source wrapped as `<doc id="<uuid>" title="<title>">…</doc>`, and `userPrompt` is:

```
You are running an evidence-extraction pass for the Foundation Questionnaire.

Product: {product.name} ({product.line} line).
Source type for this pass: {call transcripts | product documents (PRDs, specs, release notes)}.
The source documents are in the ADDITIONAL WAR ROOM CONTEXT above, each wrapped in <doc id="..." title="...">.

Answer ONLY the questions listed below, using ONLY what the source documents state.
Rules:
- Never infer, never fill gaps with prior knowledge, never invent numbers, names, or quotes.
- If the sources do not support a question, OMIT that question from the output entirely.
- content: a concise factual answer (max 120 words) preserving concrete numbers and raw customer phrasing.
- sources: every doc you drew from, each with a verbatim evidence quote of at most 25 words.
- confidence: 0.0-1.0. 0.9+ = stated explicitly and completely; 0.5 = partial or indirect; below 0.3 = omit the question instead.
- This is internal fact capture, not customer-facing copy: record facts and quotes exactly as stated, even if the wording violates brand voice.

Questions (JSON):
{[{ "id": "A1-Q1", "prompt": "...", "guidance": "..." }, …all 34]}

Return ONLY valid JSON — no markdown fences, no commentary — matching exactly:
{"answers":[{"question_id":"A1-Q1","content":"...","confidence":0.85,"sources":[{"doc_id":"<uuid from the doc tag>","title":"<doc title>","evidence":"<verbatim quote>"}]}]}
```

**Merge prompt (exact draft).** One batched call per ~12 questions; per question the payload carries both candidates:

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
{if regenerating: "- The PMM reviewer rejected the previous proposal with this feedback — address it directly: \"{feedback}\""}

Questions and candidates (JSON):
{[{ "question_id", "prompt", "transcript_candidate": {...}|null, "document_candidate": {...}|null }, …]}

Return ONLY valid JSON: {"answers":[{"question_id":"...","content":"...","confidence":0.8,"sources":[...]}]}
```

JSON-parse failure handling: on `parseModelJson` throw, retry the same call once with an appended line `Your previous reply was not valid JSON. Return only the JSON object.`; on second failure, `finishRun('failed', 'Model returned unparseable output for batch N — re-run the pass.')`.

### 3.2 `app/backend/src/services/messagingDoc.ts` (new)

```ts
/** Background generation run. Loads sections + accepted answers, generates Part by Part
 *  (6 model calls: A, B, C, D, E, F), assembles, guards, inserts messaging_docs draft
 *  (version = max(version)+1 for the product), finishRun('done', docId). */
export async function runGeneration(productId: string, userId: string, runId: string): Promise<void>;

/** Deterministic pieces — no model:
 *  B7: if no accepted answer contains cleared customer proof, render the reference
 *      placeholder verbatim: "No customer proof points are cleared for use yet. This
 *      section will be populated once named references and quantified outcomes are
 *      approved for external use."
 *  F3/F4: fixed template text mirroring the reference (ownership line reads
 *      "Owner: PMM admin — maintained in the PMM Agent app; regenerate from the
 *      Foundation Questionnaire, do not hand-edit exports.").
 *  F5: buildGapList() — every question with status 'gap' or 'rejected', plus every
 *      accepted answer whose content contains "[Conflict:". */
export function buildGapList(answers: AnswerRow[], questions: QuestionRow[]): {question_id: string; prompt: string; note: string}[];

/** Frontmatter (product, audience: internal-gtm, persona: all, stage, sources: distinct
 *  source-doc titles from final_sources + "GTM-War-Room/BRAND-DNA/*", date: YYYY-MM-DD)
 *  + '# {title}' + sections in fq_sections.ord order. Returns md + markdownToHtml(md). */
export function assembleDoc(meta: DocMeta, sections: {id: string; title: string; markdown: string}[]): {md: string; html: string};

/** Approval (admin route only): guard re-check → archive previous final → status 'final',
 *  approved_by/at → writeToWarRoom → exportDocHtml → logActivity. */
export async function approveMessagingDoc(docId: string, userId: string): Promise<{warRoomPath: string; exportedPath: string | null; warning?: string}>;

/** Writes content_md to GTM-War-Room/PLAYBOOKS-AND-ASSETS/messaging/<product-slug>-messaging-and-positioning.md
 *  (overwrite = latest final; history lives in messaging_docs). Resolves under WAR_ROOM_DIR
 *  with the same traversal guard as warRoom.ts. Returns the relative path. */
export function writeToWarRoom(doc: MessagingDocRow, productName: string): string;

/** Reuses the localFolders pattern: getLocalFolders() → config.outputPath; writes
 *  <product-slug>-messaging-and-positioning-v<N>.html using the exact HTML shell +
 *  <style> block from exportFinals (extract that wrapper into an exported helper
 *  `wrapExportHtml(title, bodyHtml, footer)` in localFolders.ts rather than duplicating it).
 *  Returns absolute path, or null (+warning) when local folders are not configured. */
export async function exportDocHtml(doc: MessagingDocRow, productName: string): Promise<string | null>;
```

**Generation prompt (exact draft, one call per Part).** `ask(userPrompt, { extraContext: answersJson, maxTokens: 16000 })`:

```
Generate Part {P} of "{Product} — Positioning & Messaging", the unified system
for how Marketing, Sales, and Proposals talk about {Product}.
(Wording note: never feed the model the banned phrase "single source of truth" —
the forbidden-words gate is a substring match over the generated doc.)

The ADDITIONAL WAR ROOM CONTEXT above contains the PMM-approved questionnaire answers
(JSON: question id, section, prompt, final answer, sources). These answers are validated
facts — the ONLY facts you may use beyond the Brand DNA. If a needed fact is missing or
an answer carries a [Conflict: ...] note, write a one-line "⚠ To confirm: ..." callout
at that spot instead of guessing.

Produce ONLY these sections, in order, each starting with a heading "## {id} · {title}":
{per-section instruction lines — see table}

Rules:
- Markdown only. Tables where the instructions say table. No preamble, no meta-commentary.
- The customer is the hero; open from the reader's world (cardinal rule).
- Swap test: if a sentence would still work with a competitor's name in place of Aurigo,
  rewrite it around the approved unique attributes.
- Raw quotes from the answers may be paraphrased into brand voice, but numbers, names,
  and certification wording must be carried over exactly.
```

Per-Part section instructions (embedded as the `{per-section instruction lines}`):

| Section | Instruction given to the model |
|---|---|
| A1–A4 | Render the approved answers nearly verbatim under the reference's sub-headings (Why/How/What; Category + Why now + Market context; Best fit/Segments/Who's in the room/Buying triggers/Not a fit; Alternatives/Can't copy/Proof it's real). Formatting only — do not add facts. |
| A5 | Two positioning statements from A1–A4 answers: classic Geoffrey Moore ("For … who …, X is … that … Unlike …, X …") and April Dunford components (category / best-fit customers / alternatives / unique attributes / value & proof). |
| B1 | Hero umbrella message, positioning opener, three tagline tiers: one-liner ≤10 words, short ≈25 words, long ≈50 words. |
| B2 | Exactly four value pillars as a table: pillar / what it means for the customer / proof — pillars derive from C-persona pains + B5 outcomes. |
| B3 | Plain-language description + one-paragraph product description from the B3 answers. |
| B4 | Messaging matrix table: customer pain / capability / why-us advantage / benefit — one row per approved C-pain, mapped to B5 capabilities and A4 attributes. |
| B5 | Capability/agent catalog table from the B5 answers: item / group / what it does / outcome. |
| B6 | Platform narrative from B6 answers: what the platform makes possible, architecture layers, enterprise-trust bullets, "why it's different" bullets. Certification wording verbatim from B6-Q3. |
| C1–C4 | Per persona (§7.4 value-prop schema): Measured on / Top pain (approved answers) / Value prop / 30-second elevator pitch / 3 discovery questions (synthesized). |
| D1 | Stack-up table: rows = domain data, where it runs, governance, time to value; columns = us / bolt-on tools / legacy-DIY — from A4 + D2 answers. |
| D2 | Per-competitor table from D2 answers: where they are today (with dates) / how we win. Close with "⚠ To confirm: competitor intelligence current as of source dates — verify before external use." |
| D3 | Head-to-head cards: they say / you counter / trap to set — one per alternative class. |
| D4 | Objection table from D4-Q1 raw objections: objection (raw language) / counter grounded in A4+B6 facts. |
| E1 | Marketing kit: campaign themes, funnel-stage messages, social/PR angles, website copy blocks, boilerplate — all pulled from B1/B2/A2. |
| E2 | Sales kit: opener, elevator pitch, 2 cold-email templates keyed to A3-Q4 triggers, discovery script from C discovery questions, MEDDIC-lite qualify, red flags from A3-Q5, advance-the-deal steps. |
| E3 | Proposals/RFP kit: requirement-theme table (theme/response/proof), technical differentiators, security boilerplate from B6-Q3 facts, 5-entry RFP FAQ. |
| F1–F2 | Voice & tone bullets and use/avoid word table derived from the Brand DNA + Voice of Aurigo rules already in the system prompt — not from extraction. |

Part order of generation respects §3.2: A (positioning) is generated first and included in the `extraContext` for B; A+B are included for C, D, E — messaging is always the bridge, copy (E kits) never generates straight from positioning.

### 3.3 Routes (new files)

- `app/backend/src/routes/questionnaire.ts` — endpoints 1–6. Route bodies stay thin: validate → 409/422 checks → `startRun` → `void runExtractionPass(...)` (fire-and-forget background, matching how `index.ts` fires watchers) → `202`. Stale-run recovery: any `fq_runs` row `running` for >15 minutes is flipped to `failed` by the `GET /runs` handler before responding (covers server restarts mid-run without a job queue).
- `app/backend/src/routes/messagingDocs.ts` — endpoints 7–9, mirroring `artifacts.ts` (canRead by status, guard-gated finalize, `logActivity` on every transition).

### 3.4 Concurrency & background-job decision (recorded)

**Decision: background fire-and-forget + DB-row polling; no queue.** Extraction is 1 model call per ~80k-char batch and generation is 6 calls — minutes, not seconds; a synchronous HTTP response would time out and freeze the UI. `fq_runs` + 2-second frontend polling reuses the pattern the app already lives with (Layout notification polling) and adds zero infrastructure. Consequences: a server restart orphans a run (mitigated by the 15-minute stale sweep); one run at a time per product (enforced with the 409). Alternatives rejected: SSE/streaming (more surface, no demo value), job queue (gold-plating for a hackathon).

---

## 4. Frontend

### 4.1 Route, nav, helpers (edits)

- `app/frontend/src/main.tsx`: add `<Route path="/questionnaire" element={<FoundationQuestionnaire />} />`.
- `app/frontend/src/components/Layout.tsx`: `ADMIN_NAV` gets `{ to: "/questionnaire", label: "Foundation questionnaire", icon: "fa-clipboard-question", adminOnly: true }` (place above "Foundation"). Non-admins never see the entry; the backend 403s regardless (authorization is the API boundary, not the nav — 08-authorization).
- `app/frontend/src/lib/api.ts`: typed helpers `getQuestionnaire(productId)`, `startExtraction(productId, pass)`, `startMerge(productId)`, `getRuns(productId)`, `decideAnswer(answerId, body)`, `startGeneration(productId)`, `listMessagingDocs(productId)`, `getMessagingDoc(id)`, `approveMessagingDoc(id)` + the interfaces from §2.

### 4.2 Component tree — `app/frontend/src/pages/FoundationQuestionnaire.tsx` (+ one component file)

```
FoundationQuestionnaire (page; owns productId, questionnaire payload, poll timer)
├── ProductPicker            — <select> from getProducts(); default "Masterworks AI"
├── StepPills                — existing .step-pills/.step-pill: 1 Extract · 2 Review · 3 Generate · 4 Approve
│                              (active step derived from progress + latest doc status)
├── ExtractPanel             — two .card blocks (Transcripts pass / Documents pass):
│                              source-doc count, last run status/pill, [Run pass] .btn-primary;
│                              "Build review queue" button → startMerge, enabled when ≥1 pass done;
│                              while any run is `running`: disable buttons, poll getRuns every 2s
├── ReviewQueue              — sections in ord order (.section-label headers), progress bar (.bar-*)
│   └── QuestionCard ×34     — components/QuestionCard.tsx (only new component file)
│         prompt + status .pill (pill-pending / pill-final / pill-lost for rejected / pill-draft for gap)
│         two source columns (.grid-2): transcript vs document candidate, each with
│           confidence badge and citation .filechips (title + evidence tooltip);
│           .empty-note when a candidate is absent ("No transcript evidence")
│         merged proposal block (highlighted, cites both)
│         CTA row (.btn .btn-sm): Accept · Edit (inline textarea + Save) · Use transcript ·
│           Use document · Regenerate · Reject — Regenerate/Reject open the feedback textarea
│           (required for regenerate); all call decideAnswer and update in place
├── GapsPanel                — .card listing status='gap' questions: "⚠ To confirm — will appear
│                              in F5"; suggests which doc types would fill each (§3.1 propose-how-to-populate)
├── GeneratePanel            — sign-off summary (accepted/rejected/gaps counts); [Generate document]
│                              disabled with reason while pending > 0 (mirrors the API 409);
│                              generation progress via run polling
└── DocViewer                — version list (v pill + status pill + dates); selected doc rendered
                               via dangerouslySetInnerHTML into .prose (sanitized server-side);
                               guard_violations banner when non-empty; gaps count chip;
                               [Approve & publish] .btn-primary (admin) → shows returned
                               warRoomPath + exportedPath (or the not-configured warning)
```

States the page must render: no product docs ingested (empty state with links to `/requests`, `/uploads`, `/integrations`) · extraction running (polling) · run failed (detail + retry) · review queue with mixed statuses · all-signed-off → generate enabled · generating · draft doc view → approve · approved (paths shown). Reuse `RichEditor` is **not** needed — Edit is a plain textarea on the answer text; the generated doc is view-only in the app (regeneration, not hand-editing, is the correction path for MVP).

---

## 5. File-by-file change list

**New files**

| Path | Contents |
|---|---|
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\supabase\migrations\0008_foundation_questionnaire.sql` | DDL + full seed (§1, all 34 question rows) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\questionnaire.ts` | §3.1 |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\messagingDoc.ts` | §3.2 |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\routes\questionnaire.ts` | endpoints 1–6 |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\routes\messagingDocs.ts` | endpoints 7–9 |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\pages\FoundationQuestionnaire.tsx` | §4.2 page |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\QuestionCard.tsx` | reconciliation card |

**Edits**

| Path | Change |
|---|---|
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\index.ts` | import + mount `questionnaireRouter` (`/api/questionnaire`) and `messagingDocsRouter` (`/api/messaging-docs`) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\localFolders.ts` | extract the HTML shell from `exportFinals` into exported `wrapExportHtml(title, bodyHtml, footer)`; `exportFinals` calls it (no behavior change) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\main.tsx` | `/questionnaire` route |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\Layout.tsx` | ADMIN_NAV entry |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\lib\api.ts` | typed helpers + interfaces (§4.1) |

No changes to `claude.ts`, `guardrails.ts`, `html.ts`, `warRoom.ts`, `auth.ts` — reuse as-is.

---

## 6. Build sequence (each stage ends with a qa-reviewer verification)

1. **Migration 0008.** Run `npm run migrate`. Verify: `fq_sections` = 28 rows, `fq_questions` = 34, `Masterworks AI` product exists; re-running the migration is idempotent; `fq_answers` unique constraint holds.
2. **Extraction service + endpoints 1, 2, 4.** Verify with curl (admin token): extract with zero transcripts → `422` with the guidance message; seed one transcript `context_doc` → run completes, `fq_answers` rows carry `transcript_candidate` with real `doc_id`s from the seeded doc, no invented citations (spot-check `evidence` quotes appear verbatim in the source); non-admin token → `403`; second extract while running → `409`.
3. **Merge + decision endpoints 3, 5.** Verify: question answered by both passes gets a merged proposal whose `sources` is the union; single-candidate question is `pending_review` (not auto-accepted); zero-candidate question is `gap`; each of the 5 CTA actions persists correctly (`final_answer`, `status`, `feedback`, `decided_by`, activity_log rows); `regenerate` without feedback → `400`.
4. **Generation + approval (endpoints 6–9) + war-room writer + exporter.** Verify: generate before sign-off → `409` with pending count; after sign-off → draft `messaging_docs` row with all 28 section headings in order, B7 placeholder when no proof, F5 listing exactly the gap/rejected/conflict items; plant a banned word ("seamless") in an accepted answer → approve returns `422` with violations; clean doc approves → war-room file exists at `GTM-War-Room/PLAYBOOKS-AND-ASSETS/messaging/masterworks-ai-messaging-and-positioning.md` with correct frontmatter, HTML lands in the local Output folder, previous final is archived; non-admin can `GET` the final doc but not the draft, and cannot approve.
5. **Frontend page.** Verify: nav entry admin-only; empty → review → generate → approve flow works end-to-end against a seeded product; run polling stops when runs finish; every CTA on the card round-trips; failed run shows detail with retry; the demo path (seed transcript + PRD → extract ×2 → merge → accept all → generate → approve → open exported HTML) completes in one sitting.

Testing posture (vol-3 13-testing, hackathon-scaled): unit-test the pure functions (`batchDocs`, `parseModelJson`, `reduceCandidates`, `buildGapList`, `assembleDoc` frontmatter) — they are deterministic and cheap; everything model-touching is covered by the stage verifications above, not mocked test suites.

---

## 7. Risks and edge cases

| Risk | Handling |
|---|---|
| No docs ingested for the product | `422` at extract start with concrete guidance (Requests, Uploads console, local Input folder). The UI empty state links to all three. §3.1: fail fast, propose how to populate — never generate from nothing. |
| Extraction JSON parse failure | Fence-strip + brace-slice, one repair retry, then run `failed` with a batch-specific message and a Retry button. Partial batches already upserted are kept (reducer is idempotent). |
| Long-running extraction / generation | Background + `fq_runs` polling (decision in §3.4). One active run per product (`409`). |
| Server restart mid-run | 15-minute stale sweep in `GET /runs` flips orphaned `running` rows to `failed`. |
| Concurrent PMM edits | Single-PMM-admin assumption for MVP. Decisions are last-write-wins on one row; the unique `(product_id, question_id)` constraint prevents duplicates; `updated_at` + activity_log preserve the audit trail. Optimistic locking is V2. |
| Raw quotes containing banned words | By design: extraction stores raw language (our-customer rule); the forbidden-words gate runs on the **generated doc**, and the generation prompt instructs paraphrase-into-voice. If a violation survives, approval is blocked with the exact violation list (same UX as artifacts). |
| Model invents citations | Extraction prompt restricts `doc_id` to ids present in the `<doc>` tags; the service drops any source whose `doc_id` is not in the batch before persisting (deterministic post-filter — model judgment is never the only defense, matching `guardrails.ts` philosophy). |
| Context overflow with many/large docs | 30k-char per-doc truncation + 80k-char batches + cross-batch reducer. Cited but truncated docs still carry titles for the PMM to inspect at the source. |
| Local folders not configured at approval | Approval still succeeds (DB + war room); `exportedPath: null` + warning string; UI shows it with a link to `/integrations`. |
| `context_docs.product_id` is null for folder-ingested docs (seen in `watcher.ts`/`localFolders.ts`) | `gatherSources` includes null-product docs; the reconciliation queue is the filter — the PMM rejects off-product evidence. Product tagging at ingest is a V2 fix noted below. |

---

## 8. Open decisions for the human

1. **`Masterworks AI` product row** — 0008 seeds it (`line='Masterworks', module='AI'`) so the demo matches the reference doc. Confirm, or name the demo product differently.
2. **Persona/competitor question wording** — C-sections use archetypes (economic buyer / finance / user / IT-security) and D-sections hardcode Procore, Kahua, EcoInteractive from the current war room. Per-product persona/competitor configuration is V2; confirm the fixed set is acceptable for the demo.
3. **B6 extract questions** — the brief listed extract sections as A1–A4, B3, B5, C-pains, D-facts. This blueprint adds three B6 fact questions because certifications/security claims must never be model-generated. Confirm the deviation.
4. **Unapproved `context_docs` as extraction sources** — this design treats answer sign-off (not the docs' `approved` flag) as the §3.1 validation gate. If you want double-gating, extraction filters to `approved=true` (one-line change; risks empty passes in the demo).
5. **War-room path** — `PLAYBOOKS-AND-ASSETS/messaging/<product-slug>-messaging-and-positioning.md`, latest-final-overwrite (history in DB). Confirm or redirect.
6. **Blueprint location** — written to `app/docs/blueprints/` per task direction; the app's other design docs live in `pmm-playbook/vol-3-architecture/`. Proposed: add a pointer line in `pmm-playbook/vol-3-architecture/README.md` and record the ADR-worthy choices here (§3.4 background-jobs decision, storage model) as ADRs in a future `pmm-playbook/vol-3-architecture/adrs/` when the tree is created.

**Proposed (not applied) CLAUDE.md repository-map update:** under `app/`, add `│   ├── docs/blueprints/ ← implementation blueprints (app-architect output)`.
