# Blueprint — Open API layer (finalized assets, intel, and Ask for other teams' tools)

- **Status:** ready for build (hackathon MVP slice)
- **Date:** 2026-08-13
- **Author:** app-architect
- **Builds on:** `app/docs/blueprints/agents-tab.md` (agent config + ask pipeline), `app/docs/blueprints/connectors-cards.md` (shipped — card grid + drawer pattern on `/integrations`), `app/docs/blueprints/workspace-tabs.md`, Aurigo `engineering-playbook/vol-3-architecture/` 03-api / 07-security / 08-authorization / 13-testing
- **Constitution rules encoded:** §8.4 (draft → approval → final: **only `status='final'` content ever crosses the public boundary** — the approval gate IS the publication gate), §8.1 (the guard already ran before anything went final, so the public surface inherits the QA gate for free — no re-checking, no bypass), §9 (personas who live in other tools get role-ready output where they already work — the API is the §9 delivery channel for teams that won't open this app), §3.3 (competitive claims are internal-unless-cleared: only human-approved intel surfaces ship; raw AI comparisons stay internal — see §4.3)
- **Demo value props served:** faster response to new market opportunities (other teams' agents call our brain the moment messaging is approved), 3–5× PMM leverage (Sales/Proposals tooling self-serves finalized assets and intel with zero PMM touch), 100% messaging consistency (every external consumer reads the same finals — never a stale copy pasted into another tool)
- **Requirement provenance (PMM admin, verbatim intent):** "This platform is created for the PMM team and the other teams have their own tools and agents — not everyone will be comfortable coming to another application. I need a feature to expose the finalized assets, competitive intel information and other things available to other personas using Open APIs; then we will share an API documentation." Design constraints (API keys not JWTs, versioned read-only surface, hand-maintained OpenAPI + offline docs page, Connectors-card admin UI, hashed keys shown once) were agreed with the admin — encoded here, not re-litigated.

---

## 0. What this ships

A second, **separate auth domain** beside the Supabase-JWT app: admin-issued API keys
(`pmm_live_…`, hashed at rest, shown once) unlocking a **versioned, read-only-biased
surface** at `/api/public/v1/`:

```
                         ┌── /api/*            Supabase JWT (requireAuth)   — the app, unchanged
Express (index.ts) ──────┤
                         └── /api/public/…     API key (requireApiKey)      — this blueprint
                              ├── v1/assets, v1/messaging-docs, v1/intel/*   read-only, FINALS ONLY
                              ├── v1/ask                                     POST, answers only (router off)
                              ├── v1/openapi.json                            no auth (spec, no data)
                              └── docs                                       no auth (self-contained HTML)
```

Key management is a fifth card on the Connectors screen (`/integrations`), matching the
shipped card + drawer pattern (connectors-cards.md §2–3, `SharePointDrawer` /
`LocalFoldersDrawer` precedents).

### Survey findings the design leans on (verified in code, with line references)

| Existing piece | File : lines | Bearing on this design |
|---|---|---|
| Migration numbering — `supabase/migrations/` runs 0001–0022; 0011/0015/0019/0020 each taken twice by parallel sessions | `supabase/migrations/` listing | **This migration is `0023_api_keys.sql`.** ui-engineer must re-check the next free number at build time and renumber if a parallel session claimed 0023 (this exact collision happened to the Agents migration — agents-tab §6.1) |
| `requireAuth` verifies Supabase JWT + profile role; `requireAdmin` gates on `role === "admin"` | `middleware/auth.ts:23–60` | The **admin key-management routes** use this stack. The **public routes never touch it** — `requireApiKey` is a sibling middleware, not a wrapper. Two auth domains, zero mixing |
| Artifacts: `status in ('draft','in_review','final','archived')`; consumers already filtered to `.eq("status","final")`; finalize is admin-only and guard-gated (422 on banned words) | `routes/artifacts.ts:25, 111–114, 850–895` | The public assets surface reuses the exact same predicate — `status='final'` in **every** query, plus 404 (not 403) for anything else so the API never confirms a draft exists |
| `artifacts` columns incl. `vertical` (0022), `current_version`, `products(name)` join + `flatten()` | `routes/artifacts.ts:36–61`; `supabase/migrations/0022_battlecard_templates.sql:14` | Field allowlist for the public payload (see §3.2). Internal ids (`request_id`, `prompt_id`, `created_by`) are excluded |
| `artifact_renders`: `format in ('html','svg','deck','email','markdown')`, `payload text`, `template_id`, `messaging_doc_id`, one row per (artifact, version) | `supabase/migrations/0011_template_library.sql:23–37`; `routes/artifacts.ts:216–242` | The `/download` endpoint serves `payload` with a per-format content type; provenance (template name, messaging-doc title+version) comes from this row |
| `wrapExportHtml(title, html, brand)` produces a complete branded HTML document from a content fragment | `routes/export.ts:38–43`; `services/localFolders.ts` | Download fallback when a final artifact has no render row: wrap `content_html` — every final asset is downloadable |
| `messaging_docs`: `status in ('draft','final','archived')`, `sections jsonb [{id,title,markdown}]`, `content_html`, `approved_at`; internal-only columns `gaps`, `guard_violations`, `war_room_path`, `exported_path`, `created_by`, `content_md` (carries war-room frontmatter) | `supabase/migrations/0009_foundation_questionnaire.sql:62–80`; `routes/messagingDocs.ts:13–64` | Public detail = `sections + content_html` + identity/approval metadata, nothing else. The existing internal route already models finals-only reads for consumers |
| Competitive module inventory: `competitors` registry (incl. internal `notes`, `aliases`), `comparisons` (raw AI answers, **no approval gate**), `ci_reports` (draft→final, admin `approveCiReport` guard-gated), `market_threats` (draft→final, admin-approved, carries AI `rationale`/`confidence`), news items (auto-scanned, no gate), `competitor_events` (raw scrape deltas), frameworks/digests (leadership analysis, no approval state), positioning maps | `routes/competitive.ts` (whole file); `0010/0019/0020` migrations | Drives the §4.3 in/out-of-scope split: only human-approved surfaces ship |
| Ask pipeline: classify (router) → `getAgentConfig("ask-war-room")` → per-role framing → `composeAgentPrompt` → `answerWithTools(prompt, {model})` → fallback single-shot over corpus; `logQuery(role, question, answer)` fire-and-forget | `routes/query.ts:34–120`; `services/askAgent.ts:275–278`; `services/db.ts:22–27` | §5: extract the post-classification portion into a shared `answerQuestion()`; the public `/ask` calls it with role `general` and **never calls `classifyAsk`** (router disabled by construction, not by flag) |
| `logActivity(entityType, entityId, actorId, action, detail)` — `activity_log.entity_id` is `uuid not null`; the activity feed is user-visible | `services/activity.ts:4–21`; `0002_platform.sql` | Key **lifecycle** events (create/toggle/delete) go to `activity_log` (key id is a uuid). Per-request logging does NOT — it would flood the feed; a dedicated `api_request_log` table is the cheap dedicated log (decision §0.1-4) |
| `supabase()` returns null when unconfigured — helpers no-op | `services/db.ts:8–20` | `requireApiKey` returns 503 `{error:"Service unavailable"}` when the DB is down — public callers get a clean contract, not a crash |
| Global `app.use(cors())` already wide open | `index.ts:40` | No CORS change needed for server-to-server use; §8 documents why browser use of keys is discouraged anyway |
| Connectors screen: card grid on `IntegrationsPage.tsx`, drawers self-load on mount, dirty guard + Escape, `onChanged()` refresh contract | connectors-cards.md §2–4; `components/SharePointDrawer.tsx`, `LocalFoldersDrawer.tsx` (shipped) | The API-access card + `ApiAccessDrawer` copy this pattern exactly |
| Frontend helpers: `apiGet/apiPost/apiDelete` + `ApiError{status, body}` | `frontend/src/lib/api.ts:17–68` | New typed helpers ride these; the drawer's non-admin state keys off `ApiError.status === 403` |

### 0.1 Decisions recorded

1. **API keys are a separate auth domain, sha-256 at rest, shown once.** Keys are
   `pmm_live_` + 40 hex chars from `crypto.randomBytes(20)` — 160 bits of entropy.
   sha-256 (Node `crypto`, no new deps) is sound here **because these are high-entropy
   random tokens, not passwords**: brute force against 2^160 is not a realistic threat,
   so bcrypt/argon2 buys nothing (vol-3 07-security: hashing strength matched to the
   threat, not cargo-culted). Plaintext exists only in the 201 response of the create
   call; the DB stores `key_hash` (unique) + `key_prefix` (first 15 chars, for UI
   identification). Lookup is by exact hash — no timing-sensitive comparison exists.
2. **Only human-approved content crosses the boundary — enforced per-query, not
   per-router.** Every public data query carries its own `status='final'` (or
   equivalent approval) predicate AND an explicit column allowlist. `select("*")` is
   banned in `routes/publicApi.ts` (qa-reviewer greps for it, §7 stage 2). Non-final
   ids return **404**, indistinguishable from nonexistent — the API never confirms a
   draft exists (§8.4 as an information boundary, vol-3 08).
3. **The public Ask has no artifact routing and no trace.** `classifyAsk` is never
   invoked on the public path (routing proposals name internal templates and drive an
   in-app confirmation flow that has no meaning for an external agent). The
   `answerWithTools` trace (which names war-room files and internal tools) is
   **omitted** from the public response — answers only, per the requirement. Trace
   exposure is V2 if a team asks for citations.
4. **Request logging: dedicated `api_request_log` table; lifecycle events in
   `activity_log`.** Per-request rows in `activity_log` would flood the user-visible
   feed. The dedicated table is one insert per request, fire-and-forget via
   `res.on("finish")`, stores `key_id` (never the key), method, path, status,
   duration. `last_used_at` updates fire-and-forget on every authenticated call —
   at MVP traffic volumes a per-call update is cheaper than staleness bookkeeping.
5. **429 rate limiting is V2.** No limiter dependency exists and the MVP audience is
   a handful of internal teams. Mitigations that DO ship: per-key request log (usage
   is visible in the drawer), the kill switch (`enabled=false` takes effect on the
   next request), and scope-of-least-privilege (`ask` granted sparingly — it costs
   model tokens). The docs page states the fair-use expectation.
6. **`openapi.json` and the docs page are unauthenticated.** They expose endpoint
   *shapes*, never data, and the whole point is "share an API documentation" with
   teams that don't have keys yet. Both live under `/api/public/…` so the Vite dev
   proxy serves them too.
7. **Envelope:** success = `{data, meta?}`; every error = `{error: string}` with the
   correct status (401 bad/missing key, 403 missing scope, 404 not-found-or-not-final,
   400 bad params, 503 DB/agent unavailable, 502 upstream model failure). List `meta`
   = `{page, per_page, total, total_pages}`. The `/download` endpoint is the one
   non-envelope response (raw file + content type). This is the whole contract —
   consistent with 03-api-standards' `{error}` convention already used app-wide.
8. **Both `Authorization: Bearer <key>` and `X-API-Key: <key>` are accepted.**
   Bearer is what generic HTTP clients and agent frameworks emit by default;
   `X-API-Key` avoids collision confusion for anyone proxying both auth domains.
   There is no conflict server-side: the public router only ever consults
   `requireApiKey`, never `requireAuth`.

---

## 1. Migration `supabase/migrations/0023_api_keys.sql`

> Check the next free number before committing (§0 survey note). No seeds — keys are
> only ever created by an admin through the API (the plaintext must be shown once,
> which a migration cannot do).

```sql
-- Open API keys: a separate auth domain for exposing FINALIZED content to other
-- teams' tools (blueprint: app/docs/blueprints/open-api.md). Constitution: §8.4
-- (only finals cross this boundary), §9 (personas served in their own tools).
-- Keys are stored hashed (sha-256 of the full 'pmm_live_…' string); plaintext is
-- returned exactly once at creation and never persisted or logged.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),   -- activity_log.entity_id is uuid (0002)
  name text not null,                              -- label, e.g. "Proposals RFP bot"
  team text not null default '',                   -- owner team label, e.g. "Proposals"
  key_prefix text not null,                        -- first 15 chars ("pmm_live_" + 6) for UI display
  key_hash text not null unique,                   -- sha-256 hex of the FULL key string
  scopes text[] not null default '{}',             -- subset of: assets:read, messaging:read, intel:read, ask
  enabled boolean not null default true,           -- false = revoked (kill switch; delete = hard revoke)
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Per-request usage log (decision §0.1-4). Append-only, fire-and-forget writes,
-- never user-visible in the activity feed. Stores the key id — NEVER key material.
create table if not exists api_request_log (
  id bigint generated always as identity primary key,
  key_id uuid not null references api_keys(id) on delete cascade,
  method text not null,
  path text not null,                              -- req.originalUrl WITHOUT query string
  status int,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists api_request_log_key_idx
  on api_request_log (key_id, created_at desc);

alter table api_keys enable row level security;
alter table api_request_log enable row level security;
-- (Backend service-role is the only client — same posture as 0002/0009/0011.)
```

---

## 2. Backend — auth domain

### 2.1 `app/backend/src/services/apiKeys.ts` (new)

```ts
import crypto from "crypto";

export const API_SCOPES = ["assets:read", "messaging:read", "intel:read", "ask"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "assets:read":    "List and download finalized assets (battlecards, datasheets, decks…)",
  "messaging:read": "Read approved Positioning & Messaging documents",
  "intel:read":     "Read approved competitive intelligence (registry, CI reports, market threats)",
  "ask":            "Ask the PMM knowledge engine plain-language questions (uses AI tokens)",
};

/** Generate a key. Called exactly once per key; plaintext never persisted. */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `pmm_live_${crypto.randomBytes(20).toString("hex")}`; // 9 + 40 chars
  return { plaintext, hash: hashApiKey(plaintext), prefix: plaintext.slice(0, 15) };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export interface ResolvedApiKey { id: string; name: string; team: string; scopes: string[] }

/** Hash the presented key, look it up, require enabled. null on any miss.
 *  Side effect on hit: fire-and-forget last_used_at update. */
export async function resolveApiKey(presented: string): Promise<ResolvedApiKey | null>;

/** Fire-and-forget insert into api_request_log. Never throws; console.error on failure. */
export function logApiRequest(keyId: string, method: string, path: string, status: number, durationMs: number): void;
```

### 2.2 `app/backend/src/middleware/apiKey.ts` (new)

```ts
declare global { namespace Express { interface Request { apiKey?: ResolvedApiKey } } }

/** Factory: authenticates the key AND checks one scope. The ONLY auth used by
 *  public data routes — requireAuth/requireAdmin never appear in publicApi.ts. */
export function requireApiKey(scope: ApiScope) {
  return async (req, res, next) => {
    if (!supabase()) return res.status(503).json({ error: "Service unavailable" });

    // Bearer or X-API-Key (decision §0.1-8)
    const header = req.headers.authorization ?? "";
    const presented =
      (header.startsWith("Bearer ") ? header.slice(7) : null) ??
      (typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : null);
    if (!presented) {
      return res.status(401).json({ error: "Missing API key. Send it as 'Authorization: Bearer <key>' or 'X-API-Key: <key>'." });
    }

    const key = await resolveApiKey(presented);            // hash lookup + enabled check + last_used_at
    if (!key) return res.status(401).json({ error: "Invalid or revoked API key" }); // never distinguish which

    if (!key.scopes.includes(scope)) {
      return res.status(403).json({ error: `This key does not have the '${scope}' scope` });
    }

    req.apiKey = key;
    const started = Date.now();
    res.on("finish", () =>                                  // decision §0.1-4
      logApiRequest(key.id, req.method, req.originalUrl.split("?")[0], res.statusCode, Date.now() - started)
    );
    next();
  };
}
```

Hard rules (qa-reviewer verifies in stage 1): the presented key string is **never**
logged, never echoed in any error body, never stored anywhere but the transient
`presented` local; `resolveApiKey` queries by `key_hash` equality only.

### 2.3 `app/backend/src/routes/apiKeys.ts` (new) — admin key management

Mount: `app.use("/api/api-keys", apiKeysRouter)`. Every endpoint
`requireAuth + requireAdmin` (Supabase-JWT domain — vol-3 08: issuing credentials
that bypass user auth is the tightest boundary in the app). `{error}` bodies.

| # | Method + path | Request | Response |
|---|---|---|---|
| 1 | `GET /api/api-keys` | — | `200 {keys:[{id, name, team, key_prefix, scopes, enabled, created_at, last_used_at, created_by_name}]}` — `created_by_name` via `profiles(full_name)` join; newest first |
| 2 | `POST /api/api-keys` | `{name, team?, scopes: string[]}` | `201 {key:{…row fields as #1}, plaintext_key}` — **the only response ever carrying plaintext.** 400 if `name` empty; 400 if `scopes` empty or not a subset of `API_SCOPES` (`{error:"scopes must be a non-empty subset of: assets:read, …"}`). `logActivity("api_key", id, user, "api_key_created", {name, team, scopes, key_prefix})` — detail carries the prefix, NEVER the key or hash |
| 3 | `POST /api/api-keys/:id/toggle` | — | `200 {key}` — flips `enabled` (revoke/re-enable; takes effect on the key's next request — no cache exists). 404 unknown id. `logActivity(…, enabled ? "api_key_enabled" : "api_key_revoked", {name, key_prefix})` |
| 4 | `DELETE /api/api-keys/:id` | — | `200 {ok:true}` — hard delete; `api_request_log` rows cascade. 404 unknown id. `logActivity(…, "api_key_deleted", {name, key_prefix})` |
| 5 | `GET /api/api-keys/:id/usage` | `?limit=` (default 50, max 200) | `200 {requests:[{method, path, status, duration_ms, created_at}]}` — newest first; feeds the drawer's usage panel. 404 unknown id |

No PUT/edit endpoint: name/team/scopes are immutable for MVP — changing scopes on a
live key silently changes what a foreign system can reach; the honest flow is
"create a new key, revoke the old one" (documented in the drawer helper text). V2
may add scope editing with re-consent.

---

## 3. Backend — public surface `app/backend/src/routes/publicApi.ts` (new)

Mount: `app.use("/api/public", publicApiRouter)` in `index.ts` (after the existing
mounts; no path conflicts — nothing else claims `/api/public`). The router contains
`GET /docs`, `GET /v1/openapi.json` (both unauthenticated, §6) and the v1 data
routes below (each with its own `requireApiKey(scope)`).

Conventions for every data endpoint (decision §0.1-7):
- Success: `{data, meta?}`. Errors: `{error}`. Empty result: `200 {data: [], meta:{page:1, per_page:N, total:0, total_pages:0}}` — never 404 for an empty list.
- Pagination: `?page=` (default 1, min 1) `&per_page=` (default 25, max 100); non-integer → `400 {error:"page and per_page must be positive integers (per_page ≤ 100)"}`. Implemented with supabase `.range((page-1)*per_page, page*per_page - 1)` + `{count:"exact"}`.
- `updated_since` filters: ISO 8601; invalid → `400 {error:"updated_since must be an ISO 8601 timestamp"}`.
- `product` filters accept a **product name** (external teams don't know UUIDs): resolve via `products.name ilike %param%` → `.in("product_id", ids)`; no match → empty list, not an error.
- Explicit column allowlists everywhere; `select("*")` banned in this file (decision §0.1-2). Never exposed anywhere in this file: user ids/emails (`created_by`, `approved_by`), internal FKs (`request_id`, `prompt_id`, `template_id` raw, `messaging_doc_id` raw), guard/gap fields, war-room paths, agent config, prompts.

### 3.1 Assets — scope `assets:read`

**`GET /api/public/v1/assets`** — query: `asset_type?`, `product?`, `updated_since?`, `page?`, `per_page?`.
Base query: `artifacts` where `status = 'final'` (always, unconditionally), order `updated_at desc`, join `products(name)`.

```json
{
  "data": [
    {
      "id": "5e2c…",
      "title": "Aurigo Masterworks vs Kahua — battlecard",
      "asset_type": "battlecard",
      "product": "Masterworks",
      "persona": "Sales",
      "vertical": "Transportation",
      "version": 3,
      "created_at": "2026-08-10T09:12:00Z",
      "updated_at": "2026-08-12T14:03:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 12, "total_pages": 1 }
}
```
(`product`, `persona`, `vertical` are nullable. `version` = `current_version`.)

**`GET /api/public/v1/assets/:id`** — fetch by id **with `status='final'` in the
predicate**; miss (nonexistent OR non-final) → `404 {error:"Asset not found"}` —
one message, both cases (decision §0.1-2). Then load the current version's
`content_html` from `artifact_versions` and the current version's `artifact_renders`
row (if any) with `templates(name)` and `messaging_docs(title, version)` joins.

```json
{
  "data": {
    "id": "5e2c…", "title": "…", "asset_type": "battlecard",
    "product": "Masterworks", "persona": "Sales", "vertical": "Transportation",
    "version": 3, "created_at": "…", "updated_at": "…",
    "content_html": "<h1>…</h1>…",
    "download": { "available": true, "format": "html" },
    "provenance": {
      "template": "Insights battlecard",
      "messaging_doc": { "title": "Masterworks — Positioning & Messaging", "version": 2 }
    }
  }
}
```
- `content_html` is the sanitized digest HTML every internal consumer sees (it was
  guard-checked at finalization — §8.1 inherited).
- `download.available` = render row exists for the current version, else `false` with
  `format: null` — **but** the download endpoint still works via the wrap fallback
  (below), so `available` is always `true` in practice; keep the field as
  `{available: true, format: "html" | "svg" | "deck" | "email" | "markdown" | "digest"}`
  where `"digest"` signals the wrapped-HTML fallback.
- `provenance.template` / `.messaging_doc` are `null` when absent (freeform or
  studio-created finals).

**`GET /api/public/v1/assets/:id/download`** — same finals-only fetch → 404 rules.
Serves the **current version's** render payload; no `version` query param (external
consumers get the approved current state, never history — history is an internal
concern).

| Render `format` | Content-Type | Filename |
|---|---|---|
| `html`, `deck`, `email` | `text/html; charset=utf-8` | `<slug>.html` |
| `markdown` | `text/markdown; charset=utf-8` | `<slug>.md` |
| `svg` | `image/svg+xml` | `<slug>.svg` |
| *(no render row)* | `text/html; charset=utf-8` — `wrapExportHtml(title, content_html, "Hive by Aurigo")` | `<slug>.html` |

`Content-Disposition: attachment; filename="…"`, slug via the kebab pattern already
in `artifacts.ts:526`. (.pptx for decks is V2 — the HTML deck payload is complete
and self-contained; `buildDeckPptx` reuse is a five-line follow-up if a team asks.)

### 3.2 Messaging docs — scope `messaging:read`

**`GET /api/public/v1/messaging-docs`** — query: `product?`, `page?`, `per_page?`.
`messaging_docs` where `status = 'final'`, order `approved_at desc`, join `products(name)`.

```json
{
  "data": [
    { "id": "9a1f…", "product": "Masterworks", "version": 2,
      "title": "Masterworks — Positioning & Messaging",
      "approved_at": "2026-08-11T10:00:00Z", "created_at": "2026-08-09T16:40:00Z" }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 3, "total_pages": 1 }
}
```
Note: finals only — `archived` (superseded) versions are **excluded**: external
consumers must only ever see the currently approved messaging (100%-consistency
value prop). The internal app keeps its final+archived history view.

**`GET /api/public/v1/messaging-docs/:id`** — `status='final'` in the predicate; 404 otherwise.

```json
{
  "data": {
    "id": "9a1f…", "product": "Masterworks", "version": 2, "title": "…",
    "approved_at": "…", "created_at": "…",
    "sections": [ { "id": "A1", "title": "The Why (Golden Circle)", "markdown": "…" }, … ],
    "content_html": "<h1>…</h1>…"
  }
}
```
Explicitly excluded: `content_md` (carries war-room frontmatter incl. internal file
paths), `gaps`, `guard_violations`, `war_room_path`, `exported_path`, `created_by`,
`approved_by`.

### 3.3 Competitive intel — scope `intel:read`

The share rule (constitution: competitive claims are internal-unless-cleared): **a
surface ships only if a PMM admin approved that specific content** (§8.4 gate), or
it is pure registry fact. Three endpoints ship; the rest of the module is out of
scope with reasoning (§4.3).

**`GET /api/public/v1/intel/competitors`** — the registry (pure facts the company
tracks; no claims). No pagination (registry is small): `{data:[…], meta:{total}}`.

```json
{ "data": [ { "id": "c7d3…", "name": "Kahua", "category": "Capital program management",
              "website": "https://kahua.com", "aurigo_product": "Masterworks" } ],
  "meta": { "total": 8 } }
```
Excluded: `notes` (internal commentary), `aliases` (internal search shorthand),
sources/scrape state (reveals collection methods).

**`GET /api/public/v1/intel/reports`** — `ci_reports` where `status='final'`
(admin-approved via `approveCiReport`, guard-gated). Query: `competitor?` (name,
ilike-resolved like `product`), `page?`, `per_page?`. Order `approved_at desc`
(fallback `created_at`).

```json
{ "data": [ { "id": "…", "title": "Kahua — competitive intelligence report",
              "competitor": "Kahua", "aurigo_product": "Masterworks",
              "approved_at": "…", "created_at": "…" } ],
  "meta": { "page": 1, "per_page": 25, "total": 4, "total_pages": 1 } }
```

**`GET /api/public/v1/intel/reports/:id`** — final-only predicate, 404 otherwise.
Adds `content_html`. Excluded: `created_by`, `approved_by`, generation inputs
(`extraBrief`, priority URLs, source scrape metadata).

**`GET /api/public/v1/intel/threats`** — `market_threats` where `status='final'`
(admin-approved). No pagination (small): `{data:[…], meta:{total}}`.

```json
{ "data": [ { "id": "…", "name": "BuilderCo AI", "category": "New entrant",
              "aurigo_product": "Masterworks", "summary_html": "<p>…</p>",
              "source_url": "https://…", "approved_at": "…" } ],
  "meta": { "total": 2 } }
```
Excluded: `rationale` and `confidence` — AI drafting aids the admin reviewed, not
approved claims themselves.

### 3.4 Ask — scope `ask`

**`POST /api/public/v1/ask`** — body `{question: string}`. This is the "other teams'
agents call our brain" endpoint. Router **disabled by construction** (decision
§0.1-3): the handler never imports `classifyAsk`; it calls the shared pipeline (§5)
with role `general` (§9.2's general framing).

Validation: `question` required, non-empty, string, ≤ 2000 chars →
`400 {error:"question is required (string, ≤ 2000 characters)"}`.

```json
{
  "data": {
    "question": "What proof points do we have for Masterworks in transportation?",
    "answer_markdown": "…raw model markdown…",
    "answer_html": "<p>…rendered…</p>"
  }
}
```
- Both forms ship: agents consume markdown; simple integrations embed the HTML.
- On success: `logQuery("api", question, answer)` — API demand shows up in the same
  C11/C13 metrics stream as in-app asks; the request itself is also in
  `api_request_log` with the key id.
- Error mapping: `AgentError` (ask-war-room disabled via Agents tab) →
  `503 {error:"Ask is temporarily unavailable"}` — external callers never see
  internal Agents-tab phrasing; model/pipeline failure → `502 {error:"The answer could not be generated — try again"}`.
  (Internal detail stays in the server console, per 07-security: errors never leak internals.)

---

## 4. Scope table, error contract, and exclusions (normative summary)

### 4.1 Scopes

| Scope | Grants |
|---|---|
| `assets:read` | §3.1 — list/get/download finalized artifacts |
| `messaging:read` | §3.2 — list/get final messaging docs |
| `intel:read` | §3.3 — registry, final CI reports, final threats |
| `ask` | §3.4 — POST /ask |

### 4.2 Error contract (every endpoint)

| Status | When | Body |
|---|---|---|
| 400 | bad params / body | `{error: "<specific message>"}` |
| 401 | missing key / unknown key / revoked key | `{error:"Missing API key. …"}` or `{error:"Invalid or revoked API key"}` |
| 403 | valid key, missing scope | `{error:"This key does not have the '<scope>' scope"}` |
| 404 | nonexistent **or non-final** resource | `{error:"<Resource> not found"}` — one message, both cases |
| 429 | — | **V2** (decision §0.1-5); documented as reserved in the spec |
| 502 | upstream model failure (ask) | `{error:"The answer could not be generated — try again"}` |
| 503 | DB unconfigured / ask agent disabled | `{error:"Service unavailable"}` / `{error:"Ask is temporarily unavailable"}` |

### 4.3 Competitive surfaces deliberately OUT of scope (with reasoning — do not add)

| Surface | Why it stays internal |
|---|---|
| `comparisons` (compare Q&A history) | Raw AI output with **no human approval gate** — publishing it over an API violates the internal-unless-cleared rule and §8.4. The cleared channel for comparison content is: comparison → battlecard draft → PMM finalize → appears in `/v1/assets` |
| News items | Auto-scanned, no approval; also redistributes third-party content verbatim |
| `competitor_events` / diffs | Raw scrape deltas — collection-method exposure, zero editorial review |
| Frameworks, digests, ELT overview | Leadership-internal analysis with no approval state; contains candid strategic assessments |
| Positioning maps | Internal strategy artifacts; publishing coordinates of competitors externally is a claims-clearance problem |
| Competitor `notes` / `aliases` / sources | Internal working data on the registry |

---

## 5. Shared ask pipeline extraction — `app/backend/src/services/askPipeline.ts` (new)

The public `/ask` must reuse the real pipeline, not fork it. Extract the
post-classification portion of `routes/query.ts:60–119` verbatim:

```ts
/** The ask pipeline AFTER routing/classification: agent config → role framing →
 *  compose → agentic answerWithTools → degraded single-shot fallback.
 *  Throws AgentError when the ask-war-room agent is disabled/unavailable. */
export async function answerQuestion(question: string, role: string): Promise<string>;
```

- Internals move as-is: `getAgentConfig("ask-war-room")` + `assertAgentEnabled`,
  `ROLE_FRAMING` + `defaults.role_framing` merge, `composeAgentPrompt` with the
  locked question suffix, `answerWithTools(prompt, {model: resolveModel(cfg)})`,
  and the existing catch → `loadCorpus()`/`retrieveChunks` single-shot fallback.
- Return the raw markdown answer (plus trace internally if trivial — but the public
  caller ignores it; keep the signature `Promise<{answer: string; trace: TraceStep[]}>`
  if that is the smaller diff, and let callers pick).
- `routes/query.ts` becomes: classification block (unchanged, lines 44–58) →
  `answerQuestion(question, role)` → `logQuery` + `markdownToHtml` + response
  shaping (unchanged shapes: `{kind:"answer"|"routing", …}`). **Under default
  config the internal path must be behaviorally identical** — qa-reviewer stage 4
  regression-checks the in-app Ask before and after.
- `routes/publicApi.ts` calls `answerQuestion(question, "general")` only.

---

## 6. Documentation deliverables

### 6.1 `app/backend/src/services/openapiSpec.ts` (new) — hand-maintained spec object

One exported constant `OPENAPI_SPEC` (typed `Record<string, unknown>` — no OpenAPI
tooling dependency), served verbatim by `GET /api/public/v1/openapi.json` with
`Content-Type: application/json`. Skeleton (ui-engineer fills every path from §3's
tables — the spec and this blueprint must agree exactly; qa-reviewer diffs them):

```jsonc
{
  "openapi": "3.0.3",
  "info": {
    "title": "Hive by Aurigo — PMM Open API",
    "version": "1.0.0",
    "description": "Read access to FINALIZED, PMM-approved marketing content (assets, messaging, competitive intel) and a plain-language Ask endpoint. Draft content is never exposed. Server-to-server use only — never embed keys in a browser or mobile app."
  },
  "servers": [{ "url": "/api/public/v1" }],
  "security": [{ "bearerKey": [] }, { "headerKey": [] }],
  "components": {
    "securitySchemes": {
      "bearerKey": { "type": "http", "scheme": "bearer", "description": "Authorization: Bearer pmm_live_…" },
      "headerKey": { "type": "apiKey", "in": "header", "name": "X-API-Key" }
    },
    "schemas": {
      "Error":        { "type": "object", "properties": { "error": { "type": "string" } }, "required": ["error"] },
      "Meta":         { "type": "object", "properties": { "page": {"type":"integer"}, "per_page": {"type":"integer"}, "total": {"type":"integer"}, "total_pages": {"type":"integer"} } },
      "Asset":        { /* §3.1 list item, field-for-field */ },
      "AssetDetail":  { /* §3.1 detail incl. content_html, download, provenance */ },
      "MessagingDoc": { /* §3.2 list item */ },
      "MessagingDocDetail": { /* §3.2 detail incl. sections[], content_html */ },
      "Competitor":   { /* §3.3 */ },
      "IntelReport":  { /* §3.3 */ },
      "Threat":       { /* §3.3 */ },
      "AskRequest":   { "type": "object", "properties": { "question": { "type": "string", "maxLength": 2000 } }, "required": ["question"] },
      "AskAnswer":    { /* §3.4 data object */ }
    }
  },
  "paths": {
    "/assets":                  { "get": { /* params: asset_type, product, updated_since, page, per_page; 200/400/401/403 */ } },
    "/assets/{id}":             { "get": { /* 200/401/403/404 */ } },
    "/assets/{id}/download":    { "get": { /* 200 (binary/text per format, Content-Disposition), 401/403/404 */ } },
    "/messaging-docs":          { "get": { } },
    "/messaging-docs/{id}":     { "get": { } },
    "/intel/competitors":       { "get": { } },
    "/intel/reports":           { "get": { } },
    "/intel/reports/{id}":      { "get": { } },
    "/intel/threats":           { "get": { } },
    "/ask":                     { "post": { /* requestBody AskRequest; 200/400/401/403/502/503 */ } }
  }
}
```

Every operation carries `x-scope` (`"assets:read"` etc.) — the docs renderer (§6.2)
reads it for the scope badge.

### 6.2 `app/backend/src/services/openapiDocs.ts` (new) — self-contained docs page

`renderDocsHtml(spec): string`, served by `GET /api/public/docs` as
`text/html; charset=utf-8`. Built once at module load (the spec is a constant).
**Zero external requests**: no CDN scripts, no CDN fonts, no Swagger UI — a
hand-rolled single-file reference with one inline `<style>` block and no `<script>`.
Offline-check: the rendered HTML contains no `http`/`https` URL in any `src`/`href`
except the literal example curls in `<code>` blocks (qa-reviewer greps, stage 5).

Brand styling (Aurigo Brand Standards, matching `wrapExportHtml`'s posture):
`font-family: Roboto, "Helvetica Neue", Arial, sans-serif` (system Roboto with
graceful fallback — no webfont download), Dark Teal `#015F74` header band and
section headings, **sharp corners everywhere** (`border-radius: 0`), method badges
(GET teal / POST dark), scope pills, `<code>`/`<pre>` blocks on `#F5F7F8`.

Page structure (in order):
1. **Header band** — "Hive by Aurigo · PMM Open API", version, one-line purpose.
2. **Overview** — what's exposed (finalized-only guarantee, stated plainly: "If it
   isn't PMM-approved, it isn't in this API"), base URL `/api/public/v1`.
3. **Authentication** — how to get a key (ask the PMM admin), both header forms with
   examples, key-handling rules (server-side only, never in a browser, never in
   logs/repos; revocation is immediate).
4. **Scopes** — table from `SCOPE_DESCRIPTIONS`.
5. **Conventions** — envelope `{data, meta}`, pagination params, error table (§4.2),
   fair-use note (rate limits reserved; `429` documented as reserved).
6. **Endpoint reference** — grouped `Assets` / `Messaging documents` /
   `Competitive intelligence` / `Ask`, rendered by walking `spec.paths`: method
   badge + path, scope pill (`x-scope`), description, parameters table, one
   **curl example** and one **sample response** per endpoint (hand-maintained in
   the spec under `x-example-curl` / `x-example-response` extensions so the docs
   renderer stays generic).

   Curl example shape (uses an obviously fake key):
   ```
   curl -H "X-API-Key: pmm_live_EXAMPLE000000" \
     "https://<host>/api/public/v1/assets?asset_type=battlecard&product=Masterworks"
   ```
7. **Footer** — "Maintained by the PMM team · Hive by Aurigo", spec link
   (`/api/public/v1/openapi.json`), absolute date.

This page **is** the artifact the PMM admin shares: a single URL (or a saved single
HTML file — it must survive "Save page as" intact, which the no-external-deps rule
guarantees).

---

## 7. Frontend — API access card + drawer on Connectors

### 7.1 Card (edit `app/frontend/src/pages/IntegrationsPage.tsx`)

Fifth card in the existing grid (after Canva), same `renderCard` anatomy
(connectors-cards.md §2):

| Field | Value |
|---|---|
| Icon | `fa-solid fa-key` |
| Name | **API access** (mono subline `/api/public/v1`) |
| One-liner | "Expose finalized assets, messaging, and competitive intel to other teams' tools." |
| Pills | admin: `{n} active key{s}` (pill-live when n>0, pill-pending "No keys yet" when 0); non-admin: static `PMM managed` pill |
| Stat line | `docs: /api/public/docs · last call {max(last_used_at) or "never"}` |
| Click | Opens `ApiAccessDrawer` (all roles — non-admin gets the read-only docs view) |

Card stats need a count: the page's existing `load()` `Promise.all` adds
`apiGet("/api/api-keys")` **for admins only** (non-admin skips it — the endpoint
403s); non-admin card renders the static pill without the call.

### 7.2 `app/frontend/src/components/ApiAccessDrawer.tsx` (new)

`.overlay` + `.drawer` (width 640, SharePointDrawer precedent), self-loads on mount,
Escape + dirty guard (dirty = create form has any input OR an unshown key is on
screen), `onChanged()` after every mutation (page refreshes the card).

```
ApiAccessDrawer ({ isAdmin, onClose, onChanged })
├── Header: "API access" + docs link button → window.open("/api/public/docs", "_blank")
│   and a copyable spec URL line (/api/public/v1/openapi.json)
├── Non-admin body: explainer ("Other teams integrate through PMM-issued API keys.
│   Browse the documentation; ask a PMM admin for a key.") + docs link. Nothing else.
├── [admin] Key list table: Name · Team · Key (key_prefix + "…") · Scopes (pills)
│   · Last used (relative) · Enabled pill-toggle (POST /toggle, stopPropagation)
│   · Delete (window.confirm naming the key: "Revoke and delete '<name>'? Systems
│     using it lose access immediately.")
│   · Row click → expands inline usage panel (GET /:id/usage, last 50: method,
│     path, status, when) — no sub-drawer
├── [admin] Create form: Name (required) · Team · Scope checkboxes, each labeled
│   with SCOPE_DESCRIPTIONS text (mirrored as a frontend const) · [Create key]
│   .btn-primary (disabled until name + ≥1 scope; title hint)
├── [admin] One-time reveal panel (after 201): dark .card, the full plaintext key
│   in a mono block, [Copy] button (navigator.clipboard), unmissable warning:
│   "Copy it now — this key is shown ONCE and cannot be recovered. Store it in the
│   consuming system's secret manager." Panel persists until dismissed
│   ([I've stored it] button); dismissing clears the plaintext from state.
│   Closing the drawer with an undismissed key → dirty guard confirm.
└── States: loading (empty-note) · error line (drawer-local) · empty ("No keys yet —
    create the first one for a team that wants API access.") · 403 on load →
    non-admin body (keys off ApiError.status)
```

### 7.3 `app/frontend/src/lib/api.ts` (edit) — typed helpers

```ts
export interface ApiKeySummary { id: string; name: string; team: string; key_prefix: string;
  scopes: string[]; enabled: boolean; created_at: string; last_used_at: string | null;
  created_by_name: string | null }
export interface ApiKeyUsageRow { method: string; path: string; status: number | null;
  duration_ms: number | null; created_at: string }

export const listApiKeys   = () => apiGet<{ keys: ApiKeySummary[] }>("/api/api-keys");
export const createApiKey  = (b: { name: string; team?: string; scopes: string[] }) =>
  apiPost<{ key: ApiKeySummary; plaintext_key: string }>("/api/api-keys", b);
export const toggleApiKey  = (id: string) => apiPost<{ key: ApiKeySummary }>(`/api/api-keys/${id}/toggle`);
export const deleteApiKey  = (id: string) => apiDelete<{ ok: true }>(`/api/api-keys/${id}`);
export const getApiKeyUsage = (id: string) =>
  apiGet<{ requests: ApiKeyUsageRow[] }>(`/api/api-keys/${id}/usage`);
```

---

## 8. File-by-file change list

**New files**

| Path | Contents |
|---|---|
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\supabase\migrations\0023_api_keys.sql` | §1 DDL (renumber if 0023 is taken at build time) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\apiKeys.ts` | §2.1 — scopes, generate/hash/resolve, request logging |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\middleware\apiKey.ts` | §2.2 — `requireApiKey(scope)` |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\routes\apiKeys.ts` | §2.3 — admin key CRUD (JWT domain) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\routes\publicApi.ts` | §3 — all `/api/public` routes (key domain + the two unauthenticated doc routes) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\askPipeline.ts` | §5 — `answerQuestion()` extracted from query.ts |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\openapiSpec.ts` | §6.1 — `OPENAPI_SPEC` constant |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\openapiDocs.ts` | §6.2 — `renderDocsHtml()` |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\ApiAccessDrawer.tsx` | §7.2 |

**Edits**

| Path | Change |
|---|---|
| `…\app\backend\src\index.ts` | Mount `apiKeysRouter` at `/api/api-keys` and `publicApiRouter` at `/api/public` (order-independent — no path overlap with existing mounts) |
| `…\app\backend\src\routes\query.ts` | §5 — replace lines 60–119 with the `answerQuestion()` call; classification + response shapes untouched |
| `…\app\frontend\src\pages\IntegrationsPage.tsx` | §7.1 — fifth card + admin-only key count in `load()` |
| `…\app\frontend\src\lib\api.ts` | §7.3 helpers + interfaces |

No changes to: `middleware/auth.ts` (the JWT domain is untouched), `artifacts.ts`,
`messagingDocs.ts`, `competitive.ts` (the public router runs its own thin
allowlisted queries — reusing those routes' handlers would drag in `req.user`
semantics and `isAdmin` branches that must not exist in the key domain; the only
**service** reuse is `wrapExportHtml`, `answerQuestion`, `logQuery`, `supabase`,
`logActivity`). No new npm dependencies, backend or frontend.

---

## 9. Build sequence (each stage ends with a qa-reviewer verification)

1. **Migration 0023 + `services/apiKeys.ts` + `middleware/apiKey.ts` + `routes/apiKeys.ts`.**
   Verify: create → 201 carries `plaintext_key` starting `pmm_live_` (49 chars);
   DB row has `key_hash` (64 hex) + `key_prefix` (15 chars) and **no plaintext
   anywhere** (inspect row + server stdout); listing never returns hash or plaintext;
   400 on empty name / empty scopes / unknown scope; toggle + delete round-trip;
   `activity_log` rows for created/revoked/deleted carry prefix only; non-admin JWT
   → 403 on all five endpoints; no JWT → 401.
2. **`publicApi.ts` — assets + messaging (§3.1–3.2).**
   Verify with curl: valid key + scope → 200 envelope with correct meta math
   (`total_pages = ceil(total/per_page)`); both auth header forms work; missing key
   → 401, wrong-scope key → 403 with the exact §4.2 messages; a **draft** artifact id
   → 404 with the same body as a random UUID; `updated_since` filters and rejects
   garbage with 400; `product=masterworks` (case-insensitive) filters; download
   content types per the §3.1 table incl. the wrap fallback for a render-less final;
   messaging list excludes archived; messaging detail excludes `content_md`/
   `war_room_path`/guard fields (assert on the raw JSON). **Grep `publicApi.ts` for
   `select("*")` — must be zero.** Revoke the key mid-session → next call 401.
   `api_request_log` rows appear with correct status codes; `last_used_at` advances.
3. **Intel endpoints (§3.3).**
   Verify: draft CI report → 404; only `final` threats appear; competitor payload
   has no `notes`/`aliases`; confirm **no** route exists for comparisons, news,
   events, frameworks, digests, or positioning maps (curl each → 404).
4. **`askPipeline.ts` extraction + `POST /v1/ask` (§3.4, §5).**
   Verify first the **internal regression**: in-app Ask (all roles, plus a routing-
   classified request and `mode:"question"`) behaves identically pre/post refactor.
   Then public: valid ask → `{data:{question, answer_markdown, answer_html}}`, no
   `trace`, no `kind`, no routing ever (ask "make me a battlecard" — must get an
   answer, not a proposal); missing/long question → 400; disable ask-war-room in the
   Agents tab → 503 with the external-safe message; `query_log` gains a `role='api'`
   row.
5. **`openapi.json` + docs page (§6).**
   Verify: `GET /api/public/v1/openapi.json` parses as JSON, `openapi: "3.0.3"`,
   every §3 endpoint present with `x-scope`; docs page renders with zero network
   requests beyond the page itself (DevTools network tab — one request), no
   `<script>`, no external `src`/`href` (grep), Dark Teal + sharp corners, every
   endpoint has a curl + sample response; page survives "Save page as HTML" and
   opens offline; both doc routes work **without any auth header**.
6. **Frontend card + drawer (§7).**
   Verify: admin sees key count pill; create flow shows the key once, copy works,
   dismiss clears it from React state (inspect devtools), reopening the drawer never
   shows it again; toggle/delete update the row and the card; usage panel lists the
   curl calls made in stages 2–4; non-admin: static pill, drawer shows docs-only
   view, zero 403 console noise beyond the handled load; docs link opens through the
   Vite proxy in dev; `npm run build` passes in `app/frontend`.

Testing posture (vol-3 13, hackathon-scaled): unit-test the pure pieces —
`generateApiKey`/`hashApiKey` (format, determinism, uniqueness), scope-subset
validation, pagination-param parsing, the per-format content-type map, and
`renderDocsHtml` (contains no external URL outside `<code>`, contains every
`spec.paths` key). Auth-domain and finals-only behavior are covered by the staged
curl verifications above, which double as the demo script ("here is Proposals'
agent pulling our approved battlecard with one curl").

---

## 10. Risks and edge cases

| Risk | Handling |
|---|---|
| **Key leakage via logs** | Plaintext exists only in the create-201 response and the caller's clipboard. `resolveApiKey`/`requireApiKey` never log the presented key; `api_request_log` stores `key_id`; `activity_log` detail stores `key_prefix` only; no `console.log` of headers anywhere in the new files (qa-reviewer greps stage 1). Frontend clears plaintext from state on dismiss |
| **Hashed-only storage adequacy** | sha-256 over 160-bit random tokens (decision §0.1-1) — offline cracking is infeasible by entropy, unlike passwords. Revisit only if keys ever become user-chosen |
| **Public surface leaking drafts / internals** | Three walls: (1) `status='final'` predicate inside every query — never post-filtering; (2) explicit column allowlists + the `select("*")` ban; (3) 404-for-non-final so existence itself doesn't leak. Prompts, agent configs, war-room paths, guard results, user ids, and the §4.3 intel surfaces have no route at all — nothing to misconfigure |
| **Ask endpoint exposing internal tooling** | No trace, no routing proposals, external-safe error strings (§3.4). The answer itself is model output over approved context — same trust level as the in-app general-role answer |
| **CORS / browser misuse of keys** | Global `cors()` already permits any origin, and that stays (server-to-server callers ignore CORS entirely). The real control is documentation + culture: docs page and reveal panel both say server-side-only. Tightening CORS would not stop a leaked key and would break nothing else — not a real defense, so not pretended to be one (07-security: no security theater) |
| **Cost/abuse on `ask` (no 429 in MVP)** | Scope granted sparingly; per-key usage visible in the drawer; kill switch is immediate (no key cache — every request hits the DB). 429 + budgets = V2 (§0.1-5) |
| **`answerQuestion` extraction regressing in-app Ask** | Verbatim move, stage-4 pre/post regression on all roles + routing + `mode:"question"` before the public route is even wired |
| **Spec drift from implementation** | Both are hand-maintained in one PR-reviewable place each (`openapiSpec.ts`, `publicApi.ts`); stage-5 QA diffs spec paths/params against this blueprint's §3 tables. Automated contract testing = V2 |
| **Migration number collision (parallel sessions)** | Explicit build-time re-check instruction (§1 note); the agents-tab precedent (0012→0013) proves this happens |
| **`api_request_log` growth** | Append-only, indexed, tiny rows; MVP volume is trivial. Retention/pruning = V2 note in the table comment |
| **DB unavailable** | `requireApiKey` → 503 before any handler runs; admin routes already inherit the app's existing posture |

---

## 11. Open decisions for the human (PMM admin / build lead)

1. **`intel:read` scope granularity** — one scope covers registry + reports +
   threats. If some teams should see the registry but not reports, split into
   `intel:read` / `intel:reports:read` (additive change: new scope constant + per-
   route middleware arg — no schema change). Proposed: keep one scope for MVP.
2. **Threats: include `confidence`?** Excluded here as an AI drafting aid (§3.3).
   If Leadership's external dashboards want it, it is a one-line allowlist addition.
3. **Docs page host URL** — the curl examples need a real host. For the demo,
   `http://localhost:3001` (or the demo tunnel URL) goes in `servers[].url` /
   examples; confirm what the shared docs should print.
4. **Key expiry** — keys currently never expire (revoke-only). Optional
   `expires_at` column + middleware check is a small additive follow-up; proposed V2.
5. **`.pptx` download for finalized decks** over the public API — V2 (§3.1 note);
   confirm the HTML deck payload is acceptable for the first consumer.

**Proposed (not applied) CLAUDE.md repository-map update:** in the app-stack
paragraph, after the backend description, add: "Finalized content is also exposed to
other teams' tools via an API-key-secured Open API (`/api/public/v1`, docs at
`/api/public/docs`); keys are PMM-admin-issued from the Connectors screen." No new
top-level directories.
