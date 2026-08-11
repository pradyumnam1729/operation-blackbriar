# Blueprint — Deck Studio + Document Editor v2

> **Status:** approved for build · **Date:** 2026-08-11 · **Author:** app-architect
> **Builds on:** `app/docs/blueprints/template-library.md` (render surface, slot decks), `ask-to-artifact.md` (ApiError contract)
> **Constitution rules encoded:** §3.2 (positioning → messaging → copy — decks generate from the 7-step arc, Vol 2 ch. 03), §8.1 (voice guard on every AI output), §8.4 (draft → approval → final; admin-only promotion), Voice of Aurigo (forbidden words), Aurigo Brand Standards (Dark Teal `#015F74`, Roboto on web, sharp corners).
> **Demo value props served:** 90% faster asset creation (prompt → branded deck → real `.pptx` in minutes), 100% messaging consistency (one theme, one guard, one narrative arc).

---

## 0. What this ships

1. **Structured slides for deck artifacts.** Deck artifacts get a first-class slide model (`slides_json` on `artifact_versions`), rendered slide-by-slide in the app and exported as a real `.pptx` styled from `AURIGO_PPT_TEMPLATE_2026.pptx`.
2. **Deck workspace** at `/library/:id` for deck artifacts: left thumbnail rail, center 16:9 editable canvas, right collapsible AI chat panel.
3. **Document editor v2** for all other artifacts: rendered document + TipTap manual editing + the same AI chat panel (replaces the current one-shot AI action chips card).
4. **Conversational AI editing** (`POST /api/artifacts/:id/chat-edit`): every accepted edit is a new version with a one-line summary as the version note; voice guard runs on every result.
5. **Studio deck generation upgrade**: the prompt path (`POST /api/studio/generate`) produces slides JSON on the 7-step narrative arc instead of a markdown wall; a deterministic scaffold deck keeps the path alive when AI is unavailable.
6. **Legacy migration path**: HTML-only decks get a one-click "Convert to slides" AI action.

Out of scope (V2, do not build): drag-to-reorder thumbnails (buttons suffice), image/chart slide layouts, persisted chat transcripts, per-slide comments, PDF export (browser print already covers it), theming beyond `aurigo-2026`, editing slot-fill template decks in the new canvas.

### Survey findings the design leans on (verified in code, 2026-08-11)

- `artifact_versions` is append-only; `content_html` is the only content column; every save bumps `artifacts.current_version` (`routes/artifacts.ts`). Rollback copies `content_html` (and `artifact_renders`) forward — it must learn to copy `slides_json` too (§4.7).
- `cleanHtml` allows only `h1–h4 p br hr strong em u s ul ol li blockquote a table thead tbody tr th td code pre span` (`services/html.ts`) — **no `div`/`section`**. The derived deck HTML (§3.1) must stay inside that whitelist.
- The finalize gate runs `checkForbiddenWords(htmlToText(content_html))` admin-only (`routes/artifacts.ts` status route). If `content_html` is always derived from slides, the existing gate covers decks with zero changes.
- Template slot-fill decks live in `artifact_renders` (`format='deck'`, assembled HTML payload) and are edited via `SlotFillPanel` + `reRenderWithFills`. That path stays byte-identical; see dispatch precedence §5.1.
- `pptxgenjs@^4.0.1` was added to `app/backend/package.json` for this feature (correction: the survey draft said it was pre-installed — it was installed during groundwork the same day). `adm-zip` was already present — the theme-extraction script needs no additional dependency.
- `AURIGO_PPT_TEMPLATE_2026.pptx` (repo root): 16:9 (12192000×6858000 EMU = 13.333"×7.5"), theme fonts Calibri/Calibri, full color scheme extracted in §6.1, ~40 named layouts ("Title slide_01", "Agenda slide", "Section separator", "Text Slide with Bullets", "3 pointer slide_1", "Customer case study_1", …).
- Frontend API helpers (`lib/api.ts`) throw `ApiError` with `.status` and `.body` — the chat panel uses this to distinguish guard warnings from hard failures. No blob helper exists yet (§5.4).
- Migrations `0016` and `0017` exist. **The next free migration number is `0018`** (the task brief said 0016 — that is stale).

### 0.1 Decisions recorded (candidate ADRs for `pmm-playbook/vol-3-architecture/adrs/` when that tree is created)

| # | Decision | Alternatives rejected |
|---|----------|----------------------|
| 1 | **Slides live in `artifact_versions.slides_json jsonb` (nullable); `content_html` is always derived server-side from slides** by a pure function. One migration, versioning/rollback/diff/guard/finalize all keep working on `content_html` untouched. | Embedding JSON in a `data-` attribute of `content_html` — the sanitizer strips unknown attributes, and round-tripping structured data through an HTML string is a corruption factory. A separate `deck_slides` table — over-normalized for an append-only version log. |
| 2 | **Slide fields are plain text** (no markup inside titles/bullets/notes). Guard scanning, pptx export, and inline editing all become trivial; the canvas styles come from layout, not from user markup. | Rich text per bullet — triples every surface (sanitize, render, export) for no demo value. |
| 3 | **PPTX export via `pptxgenjs` on the backend**, `GET /api/artifacts/:id/export.pptx`. Confirmed over template-XML cloning (adm-zip surgery on the .pptx is unmaintainable) and over client-side pptxgenjs (keeps the theme constants and auth in one trust boundary). **This supersedes template-library.md decision §0.1-4** ("no pptxgenjs for MVP") for *structured-slide* decks; slot-fill HTML decks keep their existing HTML download. |
| 4 | **Theme constants are code, extracted from the template file by a checked-in script** (`scripts/extract-deck-theme.ts`, run manually via `npm run extract:theme`), generating `services/deckTheme.ts` with a DO-NOT-EDIT header. No runtime pptx parsing; drift is caught by re-running the script. Extracted values are recorded in §6.1 so ui-engineer can write the file first and verify with the script after. |
| 5 | **Chat edits and manual saves are never blocked by guard violations; finalization still is.** Drafts may carry violations (that is what drafts are for — §8.4); the guard result rides every save/chat response so the UI warns immediately, and the existing admin-only 422 finalize gate remains the enforcement point. The authorization boundary (`requireAdmin` on `/status`, `canEdit` on all writes) is backend, not UI. |
| 6 | **Manual deck editing is click-to-edit on the canvas** (plain-text `contentEditable` regions bound to slide fields), not a structured side form. The side rail is navigation, the right panel is chat; a third form column would bury the slide. |
| 7 | **Chat history is client-session state only.** The durable trail is the version log — every accepted edit is a version whose note is the AI's one-line summary. Persisting transcripts is V2. |
| 8 | **Slot-fill template decks are untouched.** An artifact has either `slides_json` (new world) or an `artifact_renders` row (template world), never both; dispatch precedence in §5.1. Unifying them is V2. |

---

## 1. Slide data model

### 1.1 TypeScript contract (new file `app/backend/src/services/deck.ts`, mirrored in `app/frontend/src/lib/api.ts`)

```ts
export type SlideLayout =
  | "title"            // deck opener: kicker + title + subtitle, dark teal full bleed
  | "agenda"           // numbered items
  | "section"          // section separator, darkest teal full bleed
  | "content-bullets"  // headline + bullets (the workhorse)
  | "two-column"       // headline + two headed card columns
  | "quote"            // proof/quote slide, dark teal
  | "closing";         // CTA slide, darkest teal, wordmark

export interface SlideColumn { heading: string; items: string[]; }
export interface SlideQuote  { text: string; attribution: string; }

export interface DeckSlide {
  id: string;                       // stable within the deck ("s1", "s2", …); AI edits must preserve ids of untouched slides
  layout: SlideLayout;
  title: string;                    // plain text, ≤200 chars
  subtitle?: string;                // title | section | closing; ≤300
  body?: string[];                  // agenda | content-bullets; ≤20 items, each ≤500
  columns?: [SlideColumn, SlideColumn]; // two-column only
  quote?: SlideQuote;               // quote only
  notes?: string;                   // speaker notes, ≤2000; exported to pptx notes; guard-scanned
}

export interface DeckDoc {
  schema: 1;
  theme: "aurigo-2026";
  slides: DeckSlide[];              // 1–40
}
```

Validation (`validateDeckDoc(value: unknown): { deck: DeckDoc } | { issues: string[] }`, pure, no deps, style of `templateRender.ts`): checks `schema === 1`, known theme, slide count, unique non-empty ids, known layouts, field/length caps above, layout-field coherence (`columns` only on `two-column`, `quote` only on `quote`, etc.). Length caps are **hard server limits** (400 on save); the UI shows soft char counters well before them. Unknown extra keys are stripped, not rejected (forward compatibility).

### 1.2 The 7-step narrative arc mapping (Vol 2 ch. 03 — generation contract, not a hard schema rule)

Studio generation instructs the model to cover the seven steps across 7–10 slides:

| Arc step | Default layout |
|---|---|
| (opener) | `title` |
| 1 The old way | `content-bullets` |
| 2 What changed + 3 The tension | `content-bullets` (or `two-column`: "then / now") |
| 4 Cost of inaction | `content-bullets` |
| 5 Why alternatives aren't enough | `two-column` (maturity model — ceilings, never trash-talk) |
| 6 What success looks like | `content-bullets` |
| 7 Proof you can deliver | `quote` |
| (advance) | `closing` |

Optional `agenda` after title for decks ≥9 slides; `section` separators are the model's call.

---

## 2. Migration — `supabase/migrations/0018_deck_slides.sql` *(new)*

```sql
-- Deck Studio (blueprint app/docs/blueprints/deck-studio.md §2).
-- Structured slides for deck artifacts. content_html on the same row is ALWAYS
-- the server-derived HTML rendering of these slides — never edited directly.
alter table artifact_versions
  add column if not exists slides_json jsonb;

comment on column artifact_versions.slides_json is
  'DeckDoc (schema 1) for deck artifacts; null for documents and legacy versions. See app/backend/src/services/deck.ts.';
```

Idempotent, no backfill (legacy decks convert on demand, §4.6), no index (always fetched by `(artifact_id, version)` which is already keyed). Note: **0018**, not 0016 — 0016/0017 are taken.

---

## 3. Backend services

### 3.1 `app/backend/src/services/deck.ts` *(new — pure, deterministic, unit-testable per engineering-playbook vol-3 13)*

| Function | Contract |
|---|---|
| `validateDeckDoc(value: unknown)` | §1.1. |
| `slidesToHtml(deck: DeckDoc): string` | Deterministic derived rendering stored as `content_html`. **Emits only sanitizer-whitelisted tags** (`services/html.ts`): per slide → `<h2>{title}</h2>` (+ `<h3>` subtitle / column headings), `<ul><li>` bullets, `<blockquote>` for quotes, `<p><em>Speaker notes:</em> …</p>` when notes exist, `<hr>` between slides. Result passed through `cleanHtml` once, defensively. This string is what diff, search, the finalize guard, and read-only fallbacks see. |
| `deckToText(deck: DeckDoc): string` | Join of all titles/subtitles/bullets/columns/quotes/**notes** — the guard input (notes ship inside the .pptx, so they are customer-facing; §8.1 applies). Equivalent to `htmlToText(slidesToHtml(deck))` but explicit and cheap. |
| `scaffoldDeck(title: string, productName: string \| null): DeckDoc` | Deterministic 8-slide arc skeleton (title → old way → what changed → cost of inaction → alternatives' ceilings → success → proof → closing) with `"Draft this slide in the editor."` placeholders. Used when AI is unavailable (degraded Studio path). Contains no forbidden words by construction. |
| `extractDeckJson(modelText: string)` | Strips code fences / leading prose, `JSON.parse`, then `validateDeckDoc`. Returns `{ deck }` or `{ issues }`. Shared by generation, chat-edit, and convert. |

### 3.2 `app/backend/src/services/deckTheme.ts` *(new — generated, DO NOT EDIT header; values in §6.1)*

Exports `DECK_THEME`: colors, fonts, slide dimensions, and the per-layout style table used by both `deckPptx.ts` and (as documented reference for) `deck.css`. Single source of truth for brand fidelity.

### 3.3 `app/backend/src/services/deckPptx.ts` *(new)*

`buildDeckPptx(deck: DeckDoc, title: string): Promise<Buffer>` — pptxgenjs, `pptx.layout = "LAYOUT_WIDE"` (13.33×7.5 = the template's size), one `defineSlideMaster` per `SlideLayout` (7 masters, §6.2), `slide.addNotes(notes)` for speaker notes, returns `pptx.write({ outputType: "nodebuffer" })`. No model calls, no DB — unit-testable with a fixture deck (assert buffer unzips and contains `ppt/slides/slideN.xml` × slide count).

### 3.4 `app/backend/src/services/deckAi.ts` *(new — the model-touching half; uses `ask()` from `claude.ts`)*

All three functions share: strict-JSON instruction (`Return ONLY a JSON object matching this schema — no markdown, no commentary`), the §1.1 schema inlined, the 7-step arc summary, and **one repair round**: if `extractDeckJson` fails, re-ask once with the parse issues appended (`Your previous reply was invalid: <issues>. Return corrected JSON only.`); if it fails again, throw `DeckAiParseError` (→ 422, nothing saved).

| Function | Prompt core |
|---|---|
| `generateDeckSlides(opts: { title; assetPrompt; productContext; extraBrief? })` | Studio generation: produce 7–10 slides on the arc, grounded in war-room context (the `ask()` system core already carries brand DNA + voice rules). |
| `chatEditSlides(deck: DeckDoc, message: string, scope: string, history: ChatTurn[])` | Current `DeckDoc` + user instruction + optional scope (`"all"` or a slide id → "change ONLY that slide; return the FULL deck with all other slides byte-identical, ids preserved") + last ≤6 turns as conversational context. Returns `{ deck, summary }` — the model must include a `summary` string field (≤120 chars, imperative past tense: "Tightened the proof slide to two quantified points"). Response JSON shape: `{ "summary": string, "deck": DeckDoc }`. |
| `htmlToSlides(contentHtml: string, title: string)` | Legacy conversion: map an HTML document to a `DeckDoc` on the arc, preserving every load-bearing claim, inventing nothing (missing arc steps become a slide with a `"Needs PMM input: …"` bullet rather than fabricated content). |

Doc-mode chat (non-deck) does **not** live here — it is a thin branch in the route (§4.4) reusing `ask()` + `markdownToHtml`, same shape as the existing `/api/ai/edit` but full-document and version-saving.

---

## 4. API contract (per engineering-playbook vol-3 03: JSON, `{error}` on failure, meaningful statuses; all routes `requireAuth`)

### 4.1 `GET /api/artifacts/:id` *(modified)*

Response gains one field:

```jsonc
{
  "artifact": { /* unchanged */ },
  "versions": [ /* unchanged */ ],
  "contentHtml": "…",
  "hasRender": false,
  "slides": { "schema": 1, "theme": "aurigo-2026", "slides": [ … ] } | null   // NEW: current version's slides_json
}
```

Visibility unchanged (`canRead`): non-admins get `slides` for finalized decks — required for read-only viewing and export.

### 4.2 `POST /api/artifacts/:id/versions` *(modified)* — every save is a new version, unchanged

Request now accepts **exactly one** of `content_html` | `slides`:

```jsonc
{ "slides": DeckDoc, "note": "tightened proof slide" }        // deck manual save
{ "content_html": "<p>…</p>", "note": "…" }                   // document save (existing behavior)
```

- Both present or both absent → `400 {error}`.
- `slides` present → `validateDeckDoc`; invalid → `400 { "error": "Invalid slides", "issues": ["slide s3: columns only allowed on two-column", …] }`. Valid → server stores `slides_json` **and** `content_html = slidesToHtml(deck)` (client HTML is never trusted for decks).
- Response (both paths): `201 { "version": 4, "guard": { "ok": false, "violations": ["seamless"] } }` — guard is informational here (decision §0.1-5); it never blocks a draft save. (Existing callers ignore the new `guard` field — non-breaking.)

### 4.3 `GET /api/artifacts/:id/export.pptx?version=` *(new)*

- Auth: `canRead` (finalized decks exportable by every role — that is the demo).
- Loads `slides_json` for the requested (default current) version; **no slides → `409 { "error": "This deck has no structured slides yet — convert it to slides first." }`**.
- Success: `200`, `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`, `Content-Disposition: attachment; filename="<kebab-title>-v<N>.pptx"`, body = `buildDeckPptx` buffer. Logs activity `exported_pptx`.
- Frontend fetches with the bearer header and downloads via blob (the token cannot ride an `<a href>`), §5.4.

### 4.4 `POST /api/artifacts/:id/chat-edit` *(new)*

```jsonc
// request
{
  "message": "Make the proof slide about DOTs, not generic owners",
  "scope": "s7",                        // optional; "all" (default) or a slide id (deck only, ignored for documents)
  "history": [ { "role": "user", "text": "…" }, { "role": "assistant", "text": "…" } ]   // optional, last ≤6 turns, context only
}

// 201 — edit applied and saved as a new version
{
  "version": 5,
  "summary": "Rewrote the proof slide around two DOT outcomes",
  "guard": { "ok": true, "violations": [] },
  "slides": DeckDoc | null,             // null for document artifacts
  "contentHtml": "<h2>…</h2>…"          // the new current content (documents render this directly)
}
```

Behavior:
- Auth: `canEdit` (creator or admin) — read-only users never see the panel, but the boundary is here, not in the UI.
- **Deck branch** (current version has `slides_json`): `chatEditSlides` → validate → new version (`slides_json` + derived `content_html`), note = `AI: <summary>`.
- **Document branch**: model receives current `content_html` + instruction (+ history), returns full revised document in Markdown → `markdownToHtml` → new version, note = `AI: <summary>` (summary from a required first line `SUMMARY: …` the route strips; absent → note `AI edit`).
- Guard runs on the result (`deckToText` / `htmlToText`), rides the response, never blocks (§0.1-5).
- Errors: `400` missing/empty `message`; `403` not creator/admin; `404` artifact or scope slide id not found (`404 { "error": "Slide 's9' not found in the current version" }`); `422 { "error": "The AI reply could not be parsed into valid slides — no changes were saved.", "issues": […] }` after the repair round; `502 { "error": "<model error>" }` AI unavailable — **content untouched in all error cases** (a version is written only on success).

### 4.5 `POST /api/studio/generate` *(modified — deck branch only; request/response shapes unchanged)*

When `template.asset_type === "deck"` (prompt path):
1. Try `generateDeckSlides` → version 1 gets `slides_json` + derived `content_html`, note `Generated in Studio via "<prompt>"`; guard from `deckToText`.
2. `DeckAiParseError` after repair → fall back to the existing markdown path (deck without structure; convertible later) — never fail the whole generation over JSON shape.
3. AI unavailable → `scaffoldDeck()` (deterministic, no model): version 1 gets scaffold `slides_json` + derived HTML, note `Scaffold created (AI unavailable)`, `degraded: true`. **The degraded demo path still opens in the deck canvas.**

Non-deck asset types and the entire template slot-fill path (`routes/templates.ts`, `templateGenerate.ts`, `artifact_renders`) are untouched.

### 4.6 `POST /api/artifacts/:id/convert-to-slides` *(new — legacy HTML-only decks)*

- Auth `canEdit`. Preconditions: `asset_type === "deck"`, current version has **no** `slides_json` and **no** `artifact_renders` row (slot-fill decks are template-world, §0.1-8) — else `409 {error}`.
- `htmlToSlides(currentHtml, title)` → new version (`slides_json` + derived `content_html`), note `Converted to structured slides (AI)`.
- Response `201 { "version": 3, "slides": DeckDoc, "guard": {…}, "summary": "Converted 6 sections into 8 slides" }`. Errors: `422` parse failure (nothing saved), `502` AI unavailable — artifact stays HTML, banner stays.

### 4.7 Rollback fix *(modified — `POST /api/artifacts/:id/rollback`)*

The existing route copies only `content_html` forward. It must also select and copy `slides_json` from the target version — otherwise rolling back a deck silently strips its structure and kills export. One-line change to the select + insert. (Same class of bug the route already fixed for `artifact_renders`.)

---

## 5. Frontend

### 5.1 `app/frontend/src/pages/ArtifactEditor.tsx` *(rewritten as a thin shell + dispatcher)*

Keeps: header (title, status pill, meta), admin status-transition card (unchanged — transitions + 422 finalize violations), delete, Comments, version history (extracted to a component). Dispatch precedence on the loaded detail:

1. `slides !== null` → **DeckWorkspace** (editable iff `canEdit`, else read-only viewer — non-admins viewing finals get rail + canvas + Export, no chat, no editing).
2. `hasRender` → existing template render surface (`SlotFillPanel` + `TemplatePreview`), byte-identical behavior.
3. `asset_type === "deck"` (HTML-only legacy) → **DocEditor** plus a teal banner: *"This deck predates structured slides."* + **Convert to slides** button (`canEdit` only; busy state; on success reload into the canvas; on 422/502 show the error strip, content unchanged).
4. Otherwise → **DocEditor** (canEdit) or read-only `.prose` render.

### 5.2 Component tree

```
ArtifactEditor (shell: header, status card, dispatch, VersionHistoryPanel, Comments)
├── DeckWorkspace                        (grid: 168px rail | 1fr canvas | 340px chat, chat collapsible to 0)
│   ├── DeckToolbar                      (add slide→layout picker, duplicate, delete, move ↑/↓, layout switch,
│   │                                     notes toggle, Export .pptx, unsaved dot + note input + "Save version N+1")
│   ├── SlideThumbRail                   (scaled-down SlideCanvas per slide via transform: scale(); active ring;
│   │                                     click to select; slide numbers; amber dot on slides w/ guard hits)
│   ├── SlideCanvas                      (16:9, aspect-ratio CSS, max-width; renders active slide per layout;
│   │   └── SlideText                     click-to-edit primitive: contentEditable, plain-text paste only,
│   │                                     Enter=new bullet in lists, Esc=revert, blur=commit to local deck state;
│   │                                     soft char counter past 80% of the §1.1 cap)
│   ├── SpeakerNotes                     (collapsible strip under canvas, textarea, "internal — ships in the file" hint)
│   └── ChatEditPanel                    (shared, below)
├── DocEditor                            (RichEditor (TipTap) center + ChatEditPanel right; quick-action chips
│                                         [Rewrite/Shorten/Expand/Fix voice/Executive tone] move INTO the chat panel
│                                         as canned messages; keep selection-scoped /api/ai/edit behavior for
│                                         selections; full-document asks go through /chat-edit so they version)
├── ChatEditPanel                        (message list; user turn → POST chat-edit with scope from a
│                                         "Whole deck ▾ / This slide" selector (deck only); assistant turn shows
│                                         summary + "v5" chip linking the version; guard violations render as an
│                                         amber chip "3 banned words — will block finalization: seamless, …";
│                                         502 → red strip "AI unavailable — your content is unchanged" + retry;
│                                         busy: input disabled, typing indicator; unsaved manual edits → send is
│                                         disabled with hint "Save your manual edits first" (no silent merge))
└── VersionHistoryPanel                  (extracted verbatim from today's inline block: view/compare/rollback;
                                          viewing an old deck version renders a read-only DeckWorkspace canvas
                                          from that version's slides when present, else its content_html prose)
```

**Save model:** manual edits mutate local `DeckDoc` state (dirty flag, `beforeunload` warning). "Save version N+1" → `POST /versions { slides, note }`; response guard renders the amber chip. Chat edits save server-side and return the new deck — the workspace replaces local state and refreshes the version list (no full page reload). Conflict policy: last-write-wins on an append-only log — versions are never lost, only ordering (acceptable single-PMM hackathon posture; noted in §7).

### 5.3 Files

| File | Status |
|---|---|
| `app/frontend/src/pages/ArtifactEditor.tsx` | rewrite (shell + dispatch) |
| `app/frontend/src/components/VersionHistoryPanel.tsx` | new (extraction, logic unchanged) |
| `app/frontend/src/components/ChatEditPanel.tsx` | new |
| `app/frontend/src/components/DocEditor.tsx` | new (RichEditor + panel wiring) |
| `app/frontend/src/components/deck/DeckWorkspace.tsx` | new |
| `app/frontend/src/components/deck/DeckToolbar.tsx` | new |
| `app/frontend/src/components/deck/SlideThumbRail.tsx` | new |
| `app/frontend/src/components/deck/SlideCanvas.tsx` | new (all 7 layout renderers live here) |
| `app/frontend/src/components/deck/SlideText.tsx` | new |
| `app/frontend/src/components/deck/SpeakerNotes.tsx` | new |
| `app/frontend/src/styles/deck.css` | new (layout classes mirroring §6.1 tokens; Roboto; `border-radius: 0` everywhere on the canvas — sharp corners are brand law) |
| `app/frontend/src/lib/api.ts` | edit: `DeckDoc`/`DeckSlide`/`SlideLayout` types; `chatEditArtifact()`, `convertToSlides()`, `saveArtifactVersion()` (slides overload), `downloadArtifactPptx()` (§5.4); extend `DetailResponse` with `slides` |
| `app/frontend/src/pages/Studio.tsx` | edit: on deck generation success, toast copy "Deck generated — opening slide editor"; navigation already goes to `/library/:id` |

### 5.4 Authenticated binary download (`lib/api.ts`)

```ts
export async function apiGetBlob(path: string): Promise<Blob>  // fetch + authHeaders, !ok → ApiError from JSON body
export async function downloadArtifactPptx(id: string, title: string, version?: number): Promise<void>
// apiGetBlob → URL.createObjectURL → <a download="<kebab>-v<N>.pptx"> click → revoke (pattern from TemplatePreview.download)
```

`ApiError(409)` from export → toast with the convert-first message.

---

## 6. PPTX theme — extraction plan and recorded values

### 6.1 Extracted from `AURIGO_PPT_TEMPLATE_2026.pptx` → `ppt/theme/theme1.xml` + `ppt/presentation.xml` (verified 2026-08-11)

```ts
// app/backend/src/services/deckTheme.ts — GENERATED by scripts/extract-deck-theme.ts. DO NOT EDIT.
export const DECK_THEME = {
  source: "AURIGO_PPT_TEMPLATE_2026.pptx", extracted: "2026-08-11",
  colors: {
    ink:       "053445",  // dk1  — darkest teal (section/closing backgrounds)
    white:     "FFFFFF",  // lt1
    tealDark:  "015F74",  // dk2  — Aurigo Dark Teal (title bg, headings)
    mist:      "EAEDF0",  // lt2  — light panels / column cards
    tealLight: "46B2BE",  // accent1 — kickers, links, marks on dark
    red:       "EE3135",  // accent2 — accent bar ONLY (never body text)
    tealMid:   "38949F",  // accent3
    charcoal:  "383838",  // accent4 — body text on light
    green:     "6F9A35",  // accent5 (unused in MVP layouts)
    orange:    "E18527",  // accent6 (unused in MVP layouts)
    hyperlink: "46B2BE",
  },
  fonts: { pptx: "Calibri", pptxBold: "Calibri bold", web: "Roboto" },
  // Template theme font is Calibri — the .pptx uses it (safe on every Windows/Office install,
  // and matches the corporate template). The web canvas uses Roboto per Aurigo Brand Standards
  // + brand.css. This split is intentional and recorded here.
  slide: { widthIn: 13.333, heightIn: 7.5, pptxLayout: "LAYOUT_WIDE" },  // 12192000×6858000 EMU
  wordmark: { text: "AURIGO", charSpacingPt: 4, sizePt: 12 },            // bottom-right; replace with logo artwork V2
} as const;
```

### 6.2 Layout → pptxgenjs master mapping (one `defineSlideMaster` per layout; template layout names for visual reference)

| `SlideLayout` | Reference template layout | Master spec (colors from §6.1, font Calibri) |
|---|---|---|
| `title` | "Title slide_01" | bg `tealDark`; kicker = product/context line 13pt caps `tealLight` charSpacing 3 @ (0.9, 2.2); title bold 36pt `white` w 11.5 @ (0.9, 2.8); subtitle 16pt `mist` @ (0.9, 4.6); wordmark bottom-right `tealLight` |
| `agenda` | "Agenda slide" | white bg; accent bar `red` 0.9×0.07 @ (0.9, 1.1); title bold 28pt `tealDark` @ (0.9, 1.35); numbered body items 16pt `charcoal` lineSpacing 1.5, auto-numbered `1.` `tealDark` bold |
| `section` | "Section separator" | bg `ink`; title bold 32pt `white` vertically centered w 11; subtitle 15pt `tealLight`; wordmark `tealLight` |
| `content-bullets` | "Text Slide with Bullets" | white bg; accent bar `red`; title bold 26pt `tealDark`; bullets 15pt `charcoal`, bullet char `–`, lineSpacing 1.4, w 11.5; wordmark `tealDark` |
| `two-column` | "3 pointer slide_1" | white bg; accent bar + title as above; two rects fill `mist` (5.55×3.9 @ y 2.3, gap 0.4) each topped by a 0.06 line `tealDark`; column heading bold 16pt `tealDark`; items 13pt `charcoal` |
| `quote` | "Customer case study_1" | bg `tealDark`; kicker "PROOF" `tealLight`; quote italic 22pt `white` w 10 centered vertically; attribution 13pt `tealLight` prefixed `— ` |
| `closing` | "question slide" / "Custom Teal background Layout" | bg `ink`; kicker "NEXT STEP" `tealLight`; title bold 32pt `white`; subtitle 16pt `mist`; wordmark centered bottom, 16pt |

Every master: no rounded shapes (`rectRadius: 0`), speaker notes via `addNotes`. ui-engineer fine-tunes coordinates against the reference template side-by-side; qa-reviewer compares an exported deck to `reference output/Output/Masterworks Sales Enablement/Sales Deck/Aurigo Masterworks Sales Deck NEW April 2026.pptx` for brand fidelity (colors exact, fonts Calibri, no radius).

### 6.3 `app/backend/scripts/extract-deck-theme.ts` *(new; npm script `"extract:theme"`)*

adm-zip opens the repo-root pptx (path resolved from `REPO_ROOT` in `warRoom.ts`), regex-parses `theme1.xml` (`<a:dk1>…` scheme, `typeface=`) and `presentation.xml` (`sldSz`), regenerates `src/services/deckTheme.ts` verbatim (stable formatting → clean git diff). `--check` flag: exit 1 if the generated content differs from the file on disk (drift detection; qa-reviewer runs it). Rerun whenever the template file is replaced.

---

## 7. Edge cases and degradation (design them in, not on)

| Case | Behavior |
|---|---|
| Guard violations in AI/manual output | Version saves anyway; `guard` in response; amber chip in chat panel + thumb-rail dots; finalize stays blocked by the existing admin-only 422 gate (which scans the derived `content_html`, so slide text **and speaker notes** are covered). |
| AI unavailable (no credits / network) | `chat-edit`/`convert` → `502`, red strip, content untouched, retry affordance. Studio deck generation → deterministic `scaffoldDeck`, opens in the canvas, fully editable/exportable — the demo survives with zero API access. |
| Model returns unparseable slides | One automatic repair round; then `422` with `issues`, nothing saved. |
| Non-admin, non-creator on a final deck | Read-only DeckWorkspace: rail + canvas + Export .pptx; no chat, no editing, no save. Enforced by `canEdit` on every write route, not by hidden buttons (vol-3 08). |
| Non-admin, non-creator on a non-final artifact | Existing `403` on detail — unchanged. |
| Legacy HTML-only deck | Banner + Convert to slides (§4.6, §5.1-3); export returns `409` until converted; read-only users see the prose render as today. |
| Slot-fill template deck (`artifact_renders`) | Untouched surface (precedence §5.1-2); its HTML download remains; never offered the new canvas or `.pptx` export in MVP. |
| Rollback across the structure boundary | `slides_json` copied forward (§4.7); rolling back to a pre-conversion version legitimately restores an HTML-only deck and the banner returns. |
| Empty deck states | `validateDeckDoc` floor is 1 slide; deleting the last slide is blocked in the toolbar (tooltip). New-artifact deck with empty body: canvas shows the scaffold hint text via placeholders, not empty white. |
| Oversized model output | Hard caps in `validateDeckDoc` (40 slides / field lengths) → repair round → 422. |
| Concurrent editors | Last-write-wins on an append-only log; versions never destroyed; compare/rollback recovers. Accepted for MVP, recorded here. |
| `scope` slide id vanished (stale client) | `404` with the slide id in the message; panel tells the user to refresh. |
| pptxgenjs write failure | `500 {error}`; log; UI toast. No partial files (buffer built in memory before headers are sent). |

---

## 8. File-by-file change list

**Backend — new:** `app/backend/src/services/deck.ts` · `app/backend/src/services/deckTheme.ts` (generated) · `app/backend/src/services/deckPptx.ts` · `app/backend/src/services/deckAi.ts` · `app/backend/scripts/extract-deck-theme.ts` · `app/backend/tests/deck.test.ts` · `app/backend/tests/deckPptx.test.ts`

**Backend — modified:** `app/backend/src/routes/artifacts.ts` (detail `slides`; versions dual-mode; `chat-edit`; `convert-to-slides`; `export.pptx`; rollback `slides_json` fix) · `app/backend/src/routes/studio.ts` (deck branch + scaffold) · `app/backend/package.json` (`extract:theme` script only — **no new dependencies**)

**Frontend — new:** `app/frontend/src/components/deck/{DeckWorkspace,DeckToolbar,SlideThumbRail,SlideCanvas,SlideText,SpeakerNotes}.tsx` · `app/frontend/src/components/{ChatEditPanel,DocEditor,VersionHistoryPanel}.tsx` · `app/frontend/src/styles/deck.css`

**Frontend — modified:** `app/frontend/src/pages/ArtifactEditor.tsx` (rewrite as shell) · `app/frontend/src/lib/api.ts` · `app/frontend/src/pages/Studio.tsx` (toast copy only)

**Migration — new:** `supabase/migrations/0018_deck_slides.sql`

**Untouched by design:** `routes/templates.ts`, `services/templateGenerate.ts`, `services/templateRender.ts`, `components/{SlotFillPanel,TemplatePreview}.tsx`, `routes/ai.ts` (selection edits still use it), `services/html.ts`, `services/guardrails.ts`, all auth middleware.

---

## 9. Build sequence (each stage ends with a qa-reviewer verification)

| # | Stage | qa-reviewer verifies |
|---|---|---|
| 1 | Migration 0018 + `deck.ts` (+ tests) | `npm run migrate` idempotent twice; unit tests: `validateDeckDoc` accept/reject matrix, `slidesToHtml` determinism + output contains only sanitizer-whitelisted tags (`cleanHtml(x) === x`), `deckToText` includes notes, `scaffoldDeck` passes `checkForbiddenWords`. |
| 2 | `deckTheme.ts` + extraction script + `deckPptx.ts` (+ test) | `npm run extract:theme -- --check` exits 0; fixture deck → buffer unzips, slide count matches, no `<a:srgbClr>` outside the §6.1 palette in generated slide XML; open the file in PowerPoint: colors/fonts/sharp corners match the reference deck. |
| 3 | Routes: detail `slides`, dual-mode versions, export, rollback fix | curl matrix: save slides → new version + derived html; both/neither body → 400; invalid slides → 400 issues; export final deck as non-admin → 200 pptx; export legacy deck → 409; rollback deck version → `slides_json` present on the new head. |
| 4 | `deckAi.ts` + `chat-edit` + `convert-to-slides` + Studio deck branch | With API key: Studio deck generation lands slides on the arc; chat-edit with `scope` changes only that slide, note = `AI: <summary>`, guard in response. Without key (unset env): Studio → scaffold deck, degraded flag; chat-edit → 502, no version written. 403 for non-creator non-admin on all three. |
| 5 | Frontend deck workspace (read-only + editing + export) | Deck opens slide-by-slide; thumbnails navigate; click-to-edit commits; save creates vN+1; Export downloads a real .pptx; non-admin viewing a final deck: no chat/edit/save controls **and** write APIs still 403 if forced. Sharp corners + Roboto + `#015F74` audit on the canvas. |
| 6 | ChatEditPanel wired for deck + document; DocEditor; legacy banner | Conversational edit round-trips with version chip; guard chip shows on a deliberately banned word; 502 path shows the red strip with content intact; convert-to-slides turns a legacy deck into the canvas; finalize with violations still blocked at the status gate. |
| 7 | Polish: notes strip, dirty guard, collapsible panel, thumb-rail guard dots | Manual walkthrough of the demo script: prompt → deck → chat edit → approve → export. No markdown visible anywhere in the UI. |

---

## 10. Open decisions for the human

1. **Speaker notes in the guard** — this design scans them (they ship inside the .pptx). If PMM wants internal-only notes exempt from voice rules, say so and `deckToText` drops them (one line).
2. **pptx font: Calibri (template theme, chosen) vs. Roboto (web brand)** — Roboto is not installed on most recipients' machines and the corporate template itself is Calibri. Confirm Calibri.
3. **Export rights on non-final drafts** — currently creator/admin can export drafts (canRead). If .pptx should be a finals-only privilege, the export route gains a status check.
4. **Slot-fill template decks** — left on the old surface (decision §0.1-8). Confirm deferring unification, or a follow-up blueprint migrates the `templates` deck seed to the §1.1 schema.
5. **template-library.md §0.1-4 supersession** — this blueprint activates pptxgenjs for structured decks; the older doc should gain a pointer note when this ships (one-line edit, listed here rather than silently editing another blueprint).

### Proposed CLAUDE.md repository-map update (proposed, not applied)

In the `app/` bullet of the stack paragraph, after the frontend sentence, add: *"Deck artifacts carry structured slides (`artifact_versions.slides_json`) rendered in an in-app slide canvas and exported as branded `.pptx` from `AURIGO_PPT_TEMPLATE_2026.pptx` theme constants (`app/docs/blueprints/deck-studio.md`)."*
