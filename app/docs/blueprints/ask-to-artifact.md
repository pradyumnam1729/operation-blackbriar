# Blueprint — Ask-to-artifact routing (the ask router)

- **Status:** ready for build (hackathon MVP slice)
- **Date:** 2026-08-07
- **Author:** app-architect
- **Builds on:** `app/docs/blueprints/agents-tab.md` (shipped — AGENT_REGISTRY, composeAgentPrompt, locked-suffix pattern, test-run machinery), `app/docs/blueprints/template-library.md` (shipped — `generateFromTemplate`, the 409 no-final-doc gate), Aurigo `engineering-playbook/vol-3-architecture/` 03-api / 07-security / 08-authorization / 13-testing
- **Constitution rules encoded:** §8.4 (routing never fires generation — the system proposes a prefilled card, the human clicks Generate; the artifact is born `draft` in the existing approval machine), §3.1 (the routed path lands on `generateFromTemplate`, which already refuses without a final messaging doc — 409), §3.2 (the router can only route to slot-driven templates, so every routed asset still flows positioning → messaging → copy), §9.2 (the question path is unchanged role-aware answering), §6 (the confirmation card *is* the brief: Context + End State + Constraints, editable before execution)
- **Demo value props served:** 90% faster asset creation (the demo moment: type "I need a leave-behind for a DOT prospect about risk prediction" into Ask, get a prefilled one-click Generate), faster response to new opportunities (asset demand is captured at the ask surface, not lost in chat answers)
- **Requirement provenance:** approved requirement — classify every ask as QUESTION vs ARTIFACT REQUEST; router is a configurable/disableable task agent (`ask-router`); classification degrades safely (low confidence / parse failure / disabled = question, never a blocked ask); template choice validated server-side (model proposes, code verifies). Encoded here, not re-litigated.

---

## 0. What this ships

A **thin routing layer** in front of the existing ask-war-room flow. `POST /api/query` classifies every request first with a new `ask-router` task agent (cheap, fast model). Questions proceed through the **unchanged** answer flow. Artifact requests short-circuit: no answer model call — the response is a **routing proposal** (asset type, validated generation-ready template, product, drafted brief, suggested title) that the Ask page renders as a prefilled confirmation card whose Generate button calls the **existing** `POST /api/templates/:id/generate`, including its 409 no-final-doc UX.

Nothing downstream changes: no new generation path, no new artifact machinery, no new approval semantics. The router is registry row #7 among the task agents — configurable, test-runnable, and disableable from the Agents tab like the other six.

### Survey findings the design leans on (verified in code)

| Existing piece | File | Bearing on this design |
|---|---|---|
| Ask flow: config load → role framing → corpus → `composeAgentPrompt` (locked suffix = question block) → `ask()` → `logQuery` → `{answerHtml, role}` | `app/backend/src/routes/query.ts` (whole file, 77 lines) | Classification inserts at the top of this handler, after the 400 question check. The answer path below it is byte-identical |
| `AGENT_REGISTRY` + `getAgentConfig` (synthetic row when table/row missing) + `composeAgentPrompt` + `resolveModel` + `checkContract` + boot `syncAgentBaselines()` (inserts missing registry rows) | `app/backend/src/services/agents.ts` | The router is one more `AgentRegistryEntry` + one more contract type. Boot sync auto-inserts the row even if the migration lags — the migration's only unique value is seeding the haiku model default (§2) |
| Leaf module for canonical base prompts | `app/backend/src/services/agentPrompts.ts` | `ASK_ROUTER_BASE_PROMPT` lives here (one string, one module — Agents blueprint §0.1-3) |
| `parseModelJson<T>` (fence-strip + brace-slice) | `app/backend/src/services/questionnaire.ts:160` | Router JSON parse — reused, not duplicated. Parse failure = question (§4) |
| `generateFromTemplate(templateId, productId, title, extraBrief, userId)`; gates: 404 template/product, 422 unapproved/no-body, **409 no final messaging doc**, draft artifact + guard + warnings out | `app/backend/src/services/templateGenerate.ts:202–262` | The routed Generate button reuses this end-to-end via the existing route — zero changes |
| `POST /api/templates/:id/generate` is `requireAuth` (any role drafts; approval stays admin — §8.4 comment in code); template list for non-admins = `approved` only; `generation_ready = body !== null` | `app/backend/src/routes/templates.ts:86–100, 302–333` | Candidate set = `approved AND body is not null`. Any authenticated role may confirm-generate — this is the **existing** API authorization boundary (vol-3 08), see §9 risk row |
| `canRead`: admin ∥ final ∥ `created_by === userId` | `app/backend/src/routes/artifacts.ts:64` | A non-admin who confirm-generates can open their own draft at `/library/:id` — post-generate navigation works for every role |
| Ask surface = Home "Ask Hive" chat: `Bubble[] {role, text?, html?}` thread, `askWarRoom(q, PERSONA_TO_ROLE[persona])`, suggestion chips | `app/frontend/src/pages/Home.tsx:103–107, 226–247, 303–380` | The confirmation card is a new bubble variant in this thread |
| Studio 409 UX: `ApiError.status === 409` → red banner + `Link to="/questionnaire"`; clean result → `navigate('/library/'+id)`; warnings/guard → summary panel + "Open in editor" | `app/frontend/src/pages/Studio.tsx:163–204, 485–578` | The card copies these states verbatim (one delta: non-admins get guidance text instead of the questionnaire link — the questionnaire is admin surface) |
| `ApiError {status, body}`, `generateFromTemplate` helper, `getProducts`, `TemplateSummary` | `app/frontend/src/lib/api.ts:17–38, 87–99, 275–352, 371–374` | Frontend helpers to extend |
| Test-run switch with per-agent static samples; `contractSuffixPreview`; sabotage-override demo | `app/backend/src/routes/agents.ts:62–91, 319–489` | Router gets a `case "ask-router"` in both (§5) |
| Products seed: Masterworks, Essentials, Primus, **Masterworks AI** (`0009` re-seeds `…1107`) | `supabase/migrations/0001_init.sql:12`, `0009:5–7` | "Masterworks AI" is a real `products.name` — the ambiguity default resolves to a real row |
| Migration numbering | `supabase/migrations/` | **0001–0015 exist (0011 twice). This migration is `0016_ask_router.sql` — ui-engineer: re-check the next free number at build time; parallel sessions keep taking them** |

### 0.1 Decisions recorded

1. **One endpoint, discriminated response — `POST /api/query` gains a `kind` field; no separate `/api/query/route`.** A separate routing endpoint forces the client to orchestrate two round trips on every ask (route, then query), doubles router latency exposure, and creates a bypassable seam (a client that "forgets" to call `/route` silently loses the feature). Putting classification inside the query handler means the gate lives where the ask lives, the disabled-router path is literally the pre-existing code path, and the client stays one `apiPost`. The response is additive: the answer variant keeps `answerHtml`/`role` exactly as today plus `kind:"answer"`, so the only consumer (`Home.tsx` via `askWarRoom`) updates one type. Documented per 03-api-standards in §3.
2. **Classify-then-answer: two sequential model calls on the question path; the router call is small and on a cheap model.** Per the approved requirement, classification happens **first on every ask** (mode `auto`). Question path = 1 router call (haiku-class, ~1k-token prompt, `maxTokens: 500`, no war-room corpus) + 1 unchanged answer call. Artifact path = 1 router call only — the expensive answer call is skipped. *Alternative rejected — single combined call (answer model classifies and answers in one JSON envelope):* it would wrap the ask-war-room markdown answer in a JSON contract (breaking the existing locked suffix, the HTML rendering path, and the §9.2 framing semantics), waste a full opus-class generation whenever intent is artifact, and make the router non-independently configurable/disableable. *Alternative rejected — parallel fire-both-discard-one:* doubles cost on every ask for ~1 s saved; not a hackathon trade.
3. **Router default model is `claude-haiku-4-5`, seeded on the row (`agents.model`), not a new registry capability.** The allowlist already contains it (Agents blueprint §0.1-6). Known wrinkle, accepted and documented: **Revert** on the Agents tab resets `model` to `null` = platform default (opus) — the registry's revert semantics can't express a per-agent model default. The admin re-picks haiku after a revert; a `defaultModel` field on `AgentRegistryEntry` is V2 (see §10-2). The migration seeds haiku with a conflict clause that never clobbers an admin's later choice (§2).
4. **Disabled router = bypass, not block — the one deliberate exception to Agents blueprint §0.1-5.** For the six pipeline agents, `enabled=false` fails the operation fast (409) because a silently half-disabled pipeline is a debugging trap. The router is the opposite shape: it is an **optional pre-gate on someone else's flow**, and its non-negotiable contract is "the answer flow is never blocked by the router." So `classifyAsk` checks `cfg.enabled` itself and returns `{intent:"question"}` — `assertAgentEnabled` is **not** called, no 409, no user-visible difference. Same treatment for every router failure mode: model error, parse failure, low confidence, unknown template, empty candidate list. Misrouting degrades to the previous behavior, never to an error.
5. **Model proposes, code verifies — the validation ladder (§4.2) is deterministic and server-side.** `template_id` is only ever accepted if it exists in the freshly-loaded candidate set (`approved AND body is not null`). Invalid/missing id → fall back to the proposed `asset_type`'s first candidate (ordered by `name` — deterministic). No candidate for the type → question. `product_name` resolves case-insensitively against the `products` table; unresolved or absent → **Masterworks AI** (approved requirement). The model's strings never reach `generateFromTemplate` — only validated ids do, and only after the human clicks Generate.
6. **The routed path never writes anything.** The proposal is computed and returned; nothing persists until the user confirms through the existing template-generate route. The only side effect on the routing path is `logQuery(role, question, "[routed → <asset_type>: <template name>]")` — so C11/C13 metrics capture asset demand arriving through Ask.
7. **`mode: "question"` escape hatch.** The request body accepts `mode?: "auto" | "question"` (default `auto`). `"question"` skips classification entirely — it powers the card's "Just answer this instead" action (misclassification recovery in one click) and gives qa-reviewer a deterministic control path. No `mode:"artifact"` exists: forcing artifact intent without classification would ship an unvalidated proposal.

---

## 1. The `ask-router` agent

### 1.1 Base prompt (exact text — `ASK_ROUTER_BASE_PROMPT` in `services/agentPrompts.ts`)

This is the overridable body. Note the product default lives here deliberately: the admin can change the ambiguity default from the Agents tab without a deploy.

```
You are the request router for the PMM Agent's Ask surface. GTM teammates type
plain-language requests. Most are QUESTIONS to be answered from the war room. Some are
ARTIFACT REQUESTS - the asker wants a customer-ready asset produced (a one-pager,
datasheet, battlecard, deck, FAQ, brochure, banner, or similar deliverable).

Classify the request:
- "question": the asker wants information, guidance, talk tracks, proof points, or an
  answer they will read. DEFAULT HERE WHENEVER UNSURE - a misrouted question frustrates;
  a misrouted artifact request still gets a useful answer plus a manual path to Studio.
- "artifact": the asker explicitly asks for a deliverable to be produced - "create",
  "build", "generate", "draft", "make me", "put together", "I need a <asset> for..." -
  aimed at a document or graphic they will hand to a customer, prospect, or exec.

For artifact requests, also propose:
- asset_type: one of the asset types that appears in the template catalog below.
- template_id: the id of the best-matching template from the catalog. Match asset type
  first, then product line, then audience / persona / funnel stage. Use ONLY ids from
  the catalog - never invent one. Omit if nothing fits.
- product_name: the Aurigo product the request names or implies (Masterworks,
  Masterworks AI, Essentials, Primus). If ambiguous or unstated, use "Masterworks AI".
- brief: one or two sentences a generator can act on - audience, situation, and
  emphasis, extracted from the request in the requester's own terms. Never add facts
  the request does not contain.
- reason: one short line explaining the routing, shown to the requester.

confidence: 0.0-1.0 that your intent classification is correct. The system treats
anything below its threshold as a question.
```

### 1.2 Locked contract suffix (exact text — `buildRouterSuffix` in `services/askRouter.ts`)

Code-owned, appended unconditionally by `composeAgentPrompt` — an override can never remove it. The **template candidate list is runtime data and rides here**, never in config (same rule as slot lines and question blocks — Agents blueprint §0.1-2). `{catalogJson}` is `JSON.stringify` of the candidate array `[{id, name, asset_type, product_line, audience, persona, funnel_stage}]`; `{role}`/`{question}` are the request's values.

```
Template catalog - generation-ready, approved templates. These are the ONLY valid
template_id values:
{catalogJson}

Request from the {role} team:
{question}

Return ONLY valid JSON - no markdown fences, no commentary - matching exactly:
{"intent": "question" | "artifact", "confidence": 0.0-1.0, "asset_type": "...", "template_id": "...", "product_name": "...", "brief": "...", "reason": "..."}
When intent is "question", include only intent, confidence, and reason.
```

### 1.3 Registry entry (`services/agents.ts` — appended after `competitive-compare`, before the PMM groups; insertion order = display order)

```ts
"ask-router": {
  key: "ask-router",
  kind: "task",
  name: "Ask router",
  description:
    "Classifies Ask-the-War-Room requests as questions or artifact requests; for artifact requests it proposes the template, product, and brief for a one-click-confirm generation. Disabled = classification skipped, every request is answered as a question.",
  basePrompt: ASK_ROUTER_BASE_PROMPT,
  placeholders: [],                       // question, role, catalog all ride in the locked suffix
  contract: "route-json",                 // NEW contract type (§5.1)
  defaultsSchema:
    '{"min_confidence": 0.6} — artifact classifications below this confidence are treated as questions. 0 routes every artifact guess; 1 routes none.',
  registryDefaults: { min_confidence: 0.6 },
},
```

`AgentContract` union gains `"route-json"`. Everything else (drawer, PUT, revert, kill-switch toggle, activity log) works with zero Agents-tab changes — that is the point of the registry.

---

## 2. Migration — `supabase/migrations/0016_ask_router.sql`

No DDL — the `agents` table (0013) already fits. Seed only. **Numbering: re-verify 0016 is still free at build time.**

```sql
-- 0016: seed the ask-router task agent (ask-to-artifact routing blueprint §2).
-- The agents table ships in 0013; syncAgentBaselines() would insert this row at
-- boot anyway, but without the cheap-model default — this seed's one job is
-- model = 'claude-haiku-4-5' (blueprint decision §0.1-3). The conflict clause
-- fills the model only when it is currently null, so it never clobbers an
-- admin's explicit choice OR a boot-sync-inserted row's later admin edit,
-- and re-running is idempotent.

insert into agents (key, kind, name, description, model, defaults) values (
  'ask-router', 'task',
  'Ask router',
  'Classifies Ask-the-War-Room requests as questions or artifact requests; for artifact requests it proposes the template, product, and brief for a one-click-confirm generation. Disabled = classification skipped, every request is answered as a question.',
  'claude-haiku-4-5',
  '{"min_confidence": 0.6}'::jsonb
)
on conflict (key) do update
  set model = coalesce(agents.model, excluded.model);
```

(`base_prompt` is not seeded — boot sync owns it from `agentPrompts.ts`, same as the other six task agents per 0013's pattern.)

---

## 3. API contract (per 03-api-standards)

### 3.1 `POST /api/query` — extended, backward-additive

Auth: `requireAuth` (unchanged — all roles ask).

**Request** `{ question: string, role?: string, mode?: "auto" | "question" }` — `mode` defaults to `"auto"`; `"question"` skips classification (decision §0.1-7). Unknown `mode` values are treated as `"auto"`.

**Responses**

| Case | Status + body |
|---|---|
| Missing question | `400 {error: "question is required"}` (unchanged) |
| Question (classified, forced, router disabled, router failed, no candidates, low confidence, invalid proposal) | `200 {kind: "answer", answerHtml, role}` — existing fields kept verbatim; `kind` is the only addition |
| Artifact request | `200 {kind: "routing", role, proposal}` — **no answer model call was made** |
| `ask-war-room` agent disabled / answer model failure | `409` / `502 {error}` (unchanged — these belong to the answer path; the *router* never produces an error response) |

**`proposal` shape** (all fields code-validated, never raw model output — §4.2):

```ts
{
  confidence: number,                    // router's stated confidence (post-threshold)
  asset_type: string,                    // from the chosen template row
  template: { id, name, asset_type, product_line, audience, persona, funnel_stage },
  template_fallback_used: boolean,       // true when the model's template_id was invalid/absent
  product: { id: string, name: string }, // resolved products row (default: Masterworks AI)
  suggested_title: string,               // code-built: `${product.name} — ${template.name}`
  brief: string,                         // model-drafted, user-editable; becomes extra_brief
  reason: string                         // one line, shown on the card
}
```

Empty states: zero generation-ready approved templates → classification is skipped entirely (there is nothing to route to) and every ask is a question — indistinguishable from the disabled router, by design.

### 3.2 Generation — no new endpoint

The card's Generate button calls the existing `POST /api/templates/:id/generate` with `{product_id, title, extra_brief}` and inherits its whole contract: `409` no-final-doc (§3.1 gate), `422` unapproved/bodyless template (possible if the template was unapproved between proposal and click — the card surfaces the message), `404`, guard + warnings in the `201` body.

---

## 4. Service design — `app/backend/src/services/askRouter.ts` (new)

### 4.1 Shape

```ts
export interface RouterCandidate { id: string; name: string; asset_type: string;
  product_line: string | null; audience: string | null; persona: string | null;
  funnel_stage: string | null; }

export interface RoutingProposal { /* §3.1 shape */ }

export type ClassifyResult =
  | { intent: "question" }               // includes every degraded/skipped case
  | { intent: "artifact"; proposal: RoutingProposal };

/** Locked suffix builder — catalog + request + JSON contract (§1.2). Exported
 *  for routes/agents.ts (suffix preview + test run), same pattern as
 *  buildSlotFillSuffix. */
export function buildRouterSuffix(candidates: RouterCandidate[], question: string, role: string): string;

/** Load candidates: templates where approved = true AND body is not null,
 *  select the RouterCandidate columns, order by asset_type, name (deterministic
 *  fallback order), cap 60 rows (token bound). */
export async function loadRouterCandidates(): Promise<RouterCandidate[]>;

/** THE entry point. NEVER throws; every failure returns {intent:"question"}
 *  (decision §0.1-4) with a console.warn naming the cause. */
export async function classifyAsk(question: string, role: string): Promise<ClassifyResult>;
```

### 4.2 `classifyAsk` control flow (each step's failure → `{intent:"question"}`)

1. `cfg = await getAgentConfig("ask-router")` — `AgentError`/DB-unconfigured → question. **`cfg.enabled === false` → question (bypass, not `assertAgentEnabled` — decision §0.1-4).**
2. `candidates = await loadRouterCandidates()` — empty or query error → question.
3. `prompt = composeAgentPrompt(cfg, {}, buildRouterSuffix(candidates, question, role))`; `raw = await ask(prompt, { maxTokens: 500, model: resolveModel(cfg) })` — model error → question. (Reuses `ask()` so the cached brand-DNA system prefix rides along — it materially helps product inference, e.g. "DOT prospect" → Masterworks-line; a bare no-system call would need new `claude.ts` machinery for a worse router.)
4. `parsed = parseModelJson(raw)` — parse failure → question. `parsed.intent !== "artifact"` → question.
5. Threshold: `min = clamp(Number(cfg.defaults.min_confidence ?? 0.6), 0, 1)`; non-numeric/missing `parsed.confidence` or `< min` → question.
6. **Template validation ladder (decision §0.1-5):**
   a. `parsed.template_id` matches a candidate → use it (and **its** `asset_type`, ignoring the model's `asset_type` if they disagree). `template_fallback_used = false`.
   b. Else `parsed.asset_type` matches ≥1 candidate's `asset_type` → first candidate of that type in the deterministic order. `template_fallback_used = true`.
   c. Else → question.
7. Product: case-insensitive exact match of `parsed.product_name` against `products.name`; no match / absent → the `Masterworks AI` row (looked up by name; if even that row is missing, → question — never a proposal with a dangling product).
8. Assemble: `brief` = `String(parsed.brief ?? "").trim()` capped at 500 chars (empty allowed — `extra_brief` is optional downstream); `reason` likewise capped at 200; `suggested_title = \`${product.name} — ${template.name}\``.

### 4.3 `routes/query.ts` wiring (only edit in the handler)

After the 400 check, before the `ask-war-room` config load:

```ts
if (mode !== "question") {
  const routed = await classifyAsk(question, (role ?? "general").toLowerCase());
  if (routed.intent === "artifact") {
    void logQuery(role ?? "general", question,
      `[routed → ${routed.proposal.asset_type}: ${routed.proposal.template.name}]`);
    return res.json({ kind: "routing", role: role ?? "general", proposal: routed.proposal });
  }
}
// ...existing answer flow, unchanged, with `kind: "answer"` added to the response json
```

---

## 5. Agents-tab integration (`services/agents.ts` + `routes/agents.ts` edits)

### 5.1 Contract checker — `case "route-json"` in `checkContract`

`ContractCheckOptions` gains `validTemplateIds?: string[]`. Checks, in order, all deterministic:

1. `parseModelJson` parses → else `ok:false` ("Not parseable as JSON: …").
2. `intent` is `"question"` or `"artifact"` → else fail.
3. `confidence` is a finite number in [0,1] → else fail.
4. If `intent === "artifact"`: `asset_type` and `brief` are non-empty strings → else fail; if `template_id` is present it must be a string, and when `opts.validTemplateIds` is provided and does not contain it → `ok:false` with error `'template_id "<id>" is not in the catalog — at run time the router falls back to the asset type's first approved template.'` (fails the badge deliberately: the demo point is "the model invented an id and code caught it"; the error text tells the admin the runtime consequence is a fallback, not a crash).

### 5.2 Static test-run sample (constants in `services/agents.ts`)

```ts
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
```

### 5.3 `routes/agents.ts` — two additive edits

- `contractSuffixPreview`: `case "ask-router": return buildRouterSuffix(SAMPLE_ROUTER_CANDIDATES, "<the request>", "sales");`
- Test-run switch, `case "ask-router"`: `question` from `input.question` **or default `SAMPLE_ROUTER_QUESTION`** (static sample — no 400; the admin can still type their own), `role` as parsed; `prompt = composeAgentPrompt(candidate, {}, buildRouterSuffix(SAMPLE_ROUTER_CANDIDATES, question, role))`; **no `extraContext`** (the router never sees the corpus); `contractOpts = { validTemplateIds: SAMPLE_ROUTER_CANDIDATES.map(c => c.id) }`. Expected sample result: `intent:"artifact"`, `template_id:"sample-tpl-onepager"` — the canonical demo line round-trips on the Agents tab. Note: test runs go through the stored `assertAgentEnabled` like every agent (a disabled router 409s on *test-run* — that path is admin tooling, not the ask flow; the bypass semantics of §0.1-4 apply only inside `classifyAsk`).

---

## 6. Frontend

### 6.1 `lib/api.ts`

```ts
export interface RoutingProposal { /* §3.1 shape, typed */ }
export type AskResponse =
  | { kind: "answer"; answerHtml: string; role: string }
  | { kind: "routing"; role: string; proposal: RoutingProposal };
export const askWarRoom = (question: string, role: string, mode?: "auto" | "question") =>
  apiPost<AskResponse>("/api/query", { question, role, mode });
```

(Existing `generateFromTemplate`, `getProducts`, `ApiError` reused as-is.)

### 6.2 `pages/Home.tsx` — thread integration

`Bubble` gains a variant: `{ role: "bot"; proposal: RoutingProposal; question: string }`. In `send()`: `r.kind === "routing"` → push that bubble instead of an html bubble. Render it as `<RoutingCard proposal={b.proposal} question={b.question} onAnswerInstead={() => void send(b.question, "question")} />` — `send` gains an optional `mode` pass-through to `askWarRoom`.

### 6.3 `components/RoutingCard.tsx` (new — the confirmation card, §8.4 human-in-the-loop)

Rendered inside the bot bubble (`.msg`), styled with existing `.card` / `.pill` / `.btn` classes. Owns its own state; never blocks the chat.

```
RoutingCard
├── Header: pill "Asset request" (.pill-draft) + reason line
│   ("Routed: <reason>" — small, muted; when template_fallback_used:
│    appended note "closest available template for this type")
├── Template row: template.name (+ asset_type · product_line · funnel stage as
│   muted meta) + "Preview" link → /templates?preview=<template.id>
│   (§6.4 deep link; approved templates are visible to every role)
├── Product <select>: options from getProducts(), preselected proposal.product.id
├── Title <input>: prefilled suggested_title (required — disable Generate when blank)
├── Brief <textarea>: prefilled proposal.brief (optional; sent as extra_brief)
├── Actions: [Generate draft] .btn-primary → generateFromTemplate(template.id,
│   {product_id, title, extra_brief}) · [Just answer this instead] .btn → onAnswerInstead()
└── States
    ├── proposal (idle, fields editable — the "prefilled confirmation" state)
    ├── edited-brief: no special state — fields are live until Generate is clicked
    ├── generating: buttons disabled, spinner label "Generating draft…"
    ├── success-clean (guard.ok && warnings 0): card collapses to a success row
    │   "Draft created" + [Open in editor] → navigate(`/library/${artifactId}`)
    │   (navigate-away like Studio is wrong inside a chat thread — the user may
    │   want the thread; success shows the link instead of auto-navigating)
    ├── success-with-flags: Studio's check-row summary verbatim (slot warnings
    │   list, forbidden-words violations, brand-rules line) + [Open in editor]
    ├── 409 (ApiError.status === 409): red banner with the server message;
    │   admins also get Link to="/questionnaire" ("Open the Foundation
    │   Questionnaire"); non-admins instead get the line "Ask your PMM admin to
    │   approve a messaging document for <product> first." (the questionnaire
    │   is an admin surface — vol-3 08). Product select stays live: picking a
    │   product that HAS a final doc and re-clicking Generate recovers in-card
    ├── other errors (404/422/502): red banner with server message; fields stay
    │   editable; [Just answer this instead] always available
    └── disabled-router: NO state — a disabled router never produces a card;
        the thread shows a normal answer (invisible by design, §0.1-4)
```

### 6.4 `pages/Templates.tsx` — optional small edit (the preview link target)

On mount, read `useSearchParams().get("preview")`; when present and the id exists in the loaded list, call the existing `open(summary)` drawer. ~6 lines; makes the card's Preview link land on the real sandboxed-iframe preview. If cut for time, the card link falls back to `/templates` (browse) — the card must not grow its own preview renderer (thin-layer rule).

---

## 7. File-by-file change list

**New files**

| Path | Contents |
|---|---|
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\supabase\migrations\0016_ask_router.sql` | Seed row (§2) — **re-check next free number first** |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\askRouter.ts` | `buildRouterSuffix`, `loadRouterCandidates`, `classifyAsk`, types (§4) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\RoutingCard.tsx` | §6.3 card |

**Edits**

| Path | Change |
|---|---|
| `…\app\backend\src\services\agentPrompts.ts` | `ASK_ROUTER_BASE_PROMPT` (§1.1, verbatim) |
| `…\app\backend\src\services\agents.ts` | `AgentContract` + `"route-json"`; registry entry (§1.3); `checkContract` case + `validTemplateIds` opt (§5.1); `SAMPLE_ROUTER_QUESTION` / `SAMPLE_ROUTER_CANDIDATES` (§5.2). Import `RouterCandidate` type only — `agents.ts` must not import `askRouter.ts` functions (askRouter imports agents; keep the dependency one-way: define `RouterCandidate` in `agents.ts` or a shared type position and have `askRouter.ts` import it) |
| `…\app\backend\src\routes\query.ts` | `mode` param; classify-first block (§4.3); `kind:"answer"` on the existing response |
| `…\app\backend\src\routes\agents.ts` | `contractSuffixPreview` case; test-run case (§5.3) |
| `…\app\frontend\src\lib\api.ts` | `RoutingProposal`, `AskResponse` union, `askWarRoom` mode param (§6.1) |
| `…\app\frontend\src\pages\Home.tsx` | routing bubble variant + `RoutingCard` render + `send(text?, mode?)` (§6.2) |
| `…\app\frontend\src\pages\Templates.tsx` | optional `?preview=` deep link (§6.4) |

No changes to: `templateGenerate.ts`, `templates.ts`, `artifacts.ts`, `claude.ts`, `guardrails.ts`, `auth.ts`, the Agents drawer UI, or any migration ≤0015.

---

## 8. Build sequence (each stage ends with a qa-reviewer verification; vol-3 13 posture)

1. **Prompt + registry + contract checker + samples (`agentPrompts.ts`, `agents.ts`).** Verify (unit-testable, pure): `checkContract("route-json", …)` against canned outputs — valid question, valid artifact, invented `template_id` (fails with the fallback-explaining error), confidence `"high"` (fails), fenced JSON (passes via `parseModelJson`); registry lists 7 task agents; `GET /api/agents` shows `ask-router` after `competitive-compare`.
2. **`askRouter.ts` + migration 0016.** Run migrate + boot. Verify: row exists with `model='claude-haiku-4-5'`; re-run idempotent; deleting the row and rebooting re-inserts it via sync (model null — documented); `loadRouterCandidates` returns only `approved AND body not null` rows, deterministic order; `classifyAsk` with the router disabled returns question **without** a model call (log/latency check); with zero candidates likewise.
3. **`routes/query.ts` wiring.** Verify: `mode:"question"` skips classification (response has `kind:"answer"`, latency ≈ pre-feature); "What are our win themes against Kahua?" → answer, thread unchanged; "I need a leave-behind for a DOT prospect about risk prediction" → `kind:"routing"` with a real template id from the DB, product Masterworks AI, non-empty brief, `suggested_title` = `<product> — <template>`; disable `ask-router` on the Agents tab → same request now answers as a question (no error, no card); sabotage the router via prompt override ("reply in prose") → every ask still answers (parse-fail degradation); `query_log` rows show the `[routed → …]` marker on routed asks. Confirm `ask-war-room` disabled still 409s (answer-path semantics untouched).
4. **Agents-tab surfaces.** Verify: test-run with no input uses the static sample and returns `contract.checked:true, ok:true` with `template_id:"sample-tpl-onepager"`; sabotage override → contract badge broken while the composed prompt still ends with the §1.2 suffix; suffix preview renders catalog + contract block; revert restores the base prompt and `min_confidence: 0.6` (and — documented wrinkle — resets model to default, not haiku).
5. **Frontend.** Verify: the demo line in Ask Hive renders the card prefilled (template, product Masterworks AI, editable title + brief); editing the brief and clicking Generate creates a draft carrying that brief (check the artifact version note/slot fills); clean generate shows "Draft created" + working editor link **without** leaving the thread; a product with no final doc → 409 banner, admin sees the questionnaire link, a `sales`-role user sees the guidance line instead (log in as both); "Just answer this instead" re-asks with `mode:"question"` and appends a normal answer bubble; disabled router → typing the demo line yields a plain answer, zero UI residue; non-admin confirm-generate succeeds and the draft opens at `/library/:id` (creator read path); Preview link opens the template preview drawer (or `/templates` if §6.4 was cut).

---

## 9. Risks and edge cases

| Risk | Handling |
|---|---|
| **Misclassification UX — question routed as artifact** | Bias-to-question is designed in three places: the base prompt's explicit default rule, the `min_confidence` threshold (0.6, admin-tunable in `defaults`), and the card's one-click "Just answer this instead" (`mode:"question"`). Cost of the miss: one click, no model call wasted (the answer call was skipped, not spent) |
| **Misclassification — artifact answered as question** | Degrades to today's exact behavior; Studio remains the manual path. Acceptable: the value prop is additive, the failure mode is the status quo |
| **Router latency added to every question** | Bounded by design: haiku-class default model (seeded), no war-room corpus in the router prompt, candidate catalog capped at 60 rows, `maxTokens: 500`, cached brand-DNA system prefix. Expected ≈0.5–1.5 s added. Escape hatches: `mode:"question"` per request; disable the agent to remove the cost globally. If demo latency disappoints, disabling is one toggle — the feature fails closed to the old behavior |
| **Role-based access — non-admins can confirm-generate (confirmed)** | This is the **existing** authorization boundary, not a new one: `POST /api/templates/:id/generate` is `requireAuth` by design ("any role drafts; approval stays admin — §8.4", `routes/templates.ts:302`), non-admins see only approved templates, drafts are readable only by creator + admin (`artifacts.ts:64`), and finalization stays admin-only. The Ask card is a second door to a door that was already open. Note the surface-level asymmetry: Studio's *Create tab* is admin-only UI while the API is not — flagged as open decision §10-1 for the human to confirm the card ships to all roles |
| **Model invents a `template_id` / `asset_type` / `product_name`** | Never trusted: validation ladder §4.2 (candidate-set membership → type-fallback → question; product resolves against the `products` table or defaults to Masterworks AI). Only validated ids reach the generate call, and only after human confirmation |
| **Template unapproved/deleted between proposal and Generate click** | The generate route re-checks everything (404/422); the card surfaces the server message and keeps "Just answer this instead" available. No staleness window matters more than one chat turn |
| **Catalog token growth as templates multiply** | 60-row cap, compact JSON, list columns only. If the library outgrows the cap, pre-filtering by asset-type keywords is V2 — not needed at seed scale (~10 rows) |
| **Boot-sync vs migration race** | Sync inserts the row without a model (null → opus default); the migration's `coalesce` conflict clause upgrades null → haiku whichever order they run in, and never overwrites an admin's explicit model choice |
| **Revert resets router model to opus, not haiku** | Documented wrinkle of decision §0.1-3; correctness unaffected (opus routes fine, just slower/dearer). Registry `defaultModel` is the V2 fix (§10-2) |
| **Two calls on the question path (cost)** | Router call is ~1k input tokens on haiku — negligible next to the answer call's full-corpus opus context. Measured, not guessed: stage-3 QA includes a latency check |
| **`kind` field breaks an unknown API consumer** | Grep-verified: `askWarRoom` (Home.tsx) is the only `/api/query` consumer; answer-variant fields are unchanged so even an un-updated client keeps working |

---

## 10. Open decisions for the human

1. **Card audience.** The confirmation card renders for every role (matches the generate API's `requireAuth` boundary and demos "Sales asks → Sales gets a draft in minutes"). Studio's Create *tab* is currently admin-only UI. Confirm all-roles, or restrict the card to admins (one `me.role` check in `Home.tsx` — but it weakens the 90%-faster demo for the Sales persona).
2. **Router model default = `claude-haiku-4-5`** (seeded on the row), with the documented revert wrinkle. Confirm, or ask for the V2 `AgentRegistryEntry.defaultModel` field now (small, but touches revert semantics for all 21 agents — I recommend deferring).
3. **`min_confidence` default 0.6.** Tunable live in the agent's `defaults` — confirm the starting value after a few demo runs.
4. **§6.4 Templates `?preview=` deep link** — in scope (recommended, ~6 lines) or cut (card links to `/templates`)?
5. **Success behavior stays in-thread** (link, no auto-navigate) vs Studio-parity auto-navigate on clean generates. Blueprint says in-thread (a chat surface should not teleport the user); confirm.

**Proposed (not applied) CLAUDE.md repository-map update:** none — no new directories, no stack change. If the app-stack paragraph is ever revised, it could note "Ask the War Room classifies asset requests and routes them to template generation (ask-router agent, disableable from the Agents tab)."
