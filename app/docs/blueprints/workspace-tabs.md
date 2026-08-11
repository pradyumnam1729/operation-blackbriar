# Blueprint: PMM Workspace tab restructure (workspace-tabs)

Date: 2026-08-12 · Author: app-architect · Builder: ui-engineer · Verifier: qa-reviewer
Scope: frontend information-architecture restructure. No backend changes required; two optional
backend enhancements are flagged as non-blocking (§9).

## 1. Why (feedback + constitution)

User feedback, verbatim: *"Finalized Assets UI is extremely bad, you cannot have sections like
that. It is confusing, there has to be a proper tabular structure and sub-tab structure. For
example: Reference documents can be a sub-tab where you can show all the list of documents."*

The complaint targets the two surfaces that stack heterogeneous content vertically:

- **Studio → "Finalized assets" view** (`app/frontend/src/pages/Studio.tsx`, `view === "finalized"`):
  three unlabeled-by-hierarchy sections stacked — "Approved messaging documents" table,
  "System finals" table, then `<ReferenceLibrary />` (a fourth table under a `section-label`).
  This is the only surface non-admins get on `/studio`.
- **PMM Workspace** (`app/frontend/src/pages/ArtifactLibrary.tsx`, route `/library`, admin-only):
  a card grid of artifacts (all statuses) plus an embedded `FoundationQuestionnaire` behind a
  two-button `.tab-row`.

Constitution alignment: §8.4 (draft → final lifecycle is the primary axis of the IA — finals and
work-in-progress are separated at the top level, not mixed in one grid); CLAUDE.md non-negotiable
rule 3. Serves the demo value props: finding the finalized asset in seconds is part of the
"90% faster" story.

## 2. Current-state inventory (survey results)

| Content group | Lives today | Endpoint | Notes |
|---|---|---|---|
| Artifacts, all statuses (card grid) | `/library` assets view | `GET /api/artifacts?product_id&asset_type&persona&status&q&mine` | Non-admin list is server-forced to `status=final` unless `mine=1` (own drafts, any status) — `canRead` in `app/backend/src/routes/artifacts.ts` |
| New-artifact create form | `/library` | `POST /api/artifacts` | Admin-facing today (page is admin-only) |
| Positioning & messaging questionnaire | `/library?tab=questionnaire` | questionnaire routes | Deep-linked from `/pmm` and `/questionnaire` redirects in `main.tsx` |
| System finals table | Studio finalized view | `GET /api/artifacts?status=final` | `viewFinal()` opens the artifact render (html/svg/deck) or digest fallback in a new tab; Edit → `/library/:id` (admin) |
| Approved messaging documents table | Studio finalized view | `GET /api/messaging-docs` (finals only, all roles) | `viewDoc()` opens brand-styled HTML in a new tab |
| Reference output library table | Studio finalized view via `components/ReferenceLibrary.tsx` | `GET /api/reference-assets` (+ `/file`, `/preview`) | Curated exemplars under `reference output/Output`; View + Export-to-PDF actions |
| Ingested knowledge-base documents | `/uploads` (UploadsConsole, admin) | `GET /api/documents?source&doc_type&ai` | `doc_type ∈ prd, jtbd, transcript, release_note, battlecard, other`; non-admins see only their own uploads (backend-enforced) |

Routes into these surfaces: `/library` (nav "PMM workspace", `adminOnly` in `Layout.tsx` and
`main.tsx`), `/library/:id` editor (open to all roles), `/pmm` and `/questionnaire` →
`/library?tab=questionnaire`, topbar search → `/library?q=…`, Notifications →
`/library/:id`. Studio, CompetitiveIntel, Home, RoutingCard all navigate to `/library/:id` —
none of those change.

Existing tab primitives in `brand.css`: `.tab-row` (pill segmented control, used on this page and
Studio) and `.step-pills` (used as type filters in Studio/Templates and questionnaire steps).
Neither reads as a first-class page-tab bar; §7 adds a minimal underline `.tabs` style.

## 3. Target information architecture

`/library` becomes the single tabbed **PMM Workspace**. Studio's finalized view is removed and
redirects here (kills the duplication; one canonical finalized surface). Tabs and sub-tabs are
URL state: `?tab=<tab>&sub=<sub>` — linkable, refresh-safe, back/forward-safe.

### Top-level tabs (in order)

| Label | `?tab=` | Visible to | Content |
|---|---|---|---|
| Finalized assets | `finalized` (default) | all roles | Final artifacts + approved messaging docs, sub-tabbed |
| In progress / My drafts | `in-progress` | all roles (non-admin label: "My drafts") | Non-final artifacts, sub-tabbed by status |
| Reference documents | `reference` | all roles | Ingested KB documents by doc type + exemplar library, sub-tabbed |
| Positioning & messaging | `questionnaire` | admin only | Embedded `FoundationQuestionnaire` — unchanged, token preserved for `/pmm` + `/questionnaire` redirects |

### Sub-tabs

**Finalized assets** (`?sub=`): `all` (default) · `datasheet` "Datasheets" · `deck` "Decks" ·
`one-pager` "One-pagers" · `faq` "FAQs" · `brochure` "Brochures" · `battlecard` "Battlecards" ·
`banner` "Banners" · `email` "Emails" · `other` "Other" · `messaging` "Messaging documents".
Type sub-tabs filter one artifacts dataset client-side; `messaging` swaps in the messaging-docs
table (different entity, own columns). Sub-tabs with zero rows still render (with empty state) —
predictable navigation beats hiding.

**In progress** (`?sub=`): `all` (default) · `draft` "Drafts" · `review` "In review" ·
`archived` "Archived".

**Reference documents** (`?sub=`): `all` (default, ingested docs only) · `transcript`
"Transcripts" · `prd` "PRDs" · `release_note` "Release notes" · `jtbd` "JTBDs" ·
`battlecard` "Battlecards" · `other` "Other" · `exemplars` "Exemplar library".
`exemplars` is the current ReferenceLibrary content (curated reference outputs) — distinct
source, so it is its own sub-tab and is **excluded from `all`**, which covers ingested docs only.

URL rules: unknown/illegal `tab` or `sub` falls back to defaults (no crash, no redirect loop);
changing tab resets `sub` to `all`; `setSearchParams` with `replace: true` for sub-tab changes so
back button steps through tabs, not every sub-tab click. Legacy `?tab=questionnaire` continues to
work verbatim.

## 4. Table specs

All tables: existing `<table>` styling from `brand.css`, wrapped in `<div style={{overflowX:"auto"}}>`
(wide tables scroll in their container). Client-side sort via clickable column headers
(asc/desc toggle, `fa-sort`/`fa-sort-up`/`fa-sort-down` indicator). One text filter box per tab
(pill input, same style as today's title search), filtering the loaded rows client-side. Sorting
and filtering are **client-side by design** — row counts at hackathon scale are tens to low
hundreds; no server capability needed (§9).

### 4.1 Finalized assets — artifact sub-tabs

Data: `GET /api/artifacts?status=final` (admin adds the explicit param; non-admin gets finals by
default — same call Studio makes today). Plus the existing product `<select>` retained above the
table (server param `product_id`).

| Column | Field | Sort | Notes |
|---|---|---|---|
| Name | `title` + type icon (`TYPE_ICON` map) | yes | Row is not click-navigable; actions are explicit |
| Type | `asset_type` | yes | Shown on `all` sub-tab only; hidden on type sub-tabs |
| Product | `product_name` | yes | `—` when null |
| Persona | `persona` | yes | `—` when null |
| Version | `current_version` | yes (numeric) | render `v3` |
| Updated | `updated_at` | yes (date, **default sort desc**) | `toLocaleDateString()` |
| Actions | — | no | **View** (opens render/digest in new tab — move Studio `viewFinal()` logic into shared helper, §5); **Edit** (→ `/library/:id`, admin only, matching Studio today) |

Text filter matches `title`, `persona`, `product_name`, `asset_type` (case-insensitive substring)
— this preserves today's persona filter capability without a dedicated input.
Empty states: `all` → "Nothing finalized yet. Assets appear here once a PMM admin approves them.";
type sub-tab → "No finalized <label> yet."

### 4.2 Finalized assets — Messaging documents sub-tab

Data: `GET /api/messaging-docs` (finals only, all roles).

| Column | Field | Sort |
|---|---|---|
| Document | `title` + `fa-file-signature` icon | yes |
| Product | `products.name` | yes |
| Version | `version` | yes (numeric) |
| Approved | `approved_at` | yes (date, **default sort desc**) |
| War room path | `war_room_path` (muted, `overflowWrap: anywhere`) | no |
| Actions | **View** (brand-styled HTML in new tab — Studio `viewDoc()` logic, moved to shared helper) | no |

Empty state: "No approved messaging documents yet. Approve one from the Positioning & messaging tab."

### 4.3 In progress

Data: `GET /api/artifacts` — admin: no status param, filter client-side per sub-tab (one fetch
serves all four sub-tabs); non-admin: `mine=1` (backend returns own artifacts, any status).
Admin keeps the "My artifacts" checkbox (`mine=1`). Product `<select>` retained.

| Column | Field | Sort |
|---|---|---|
| Name | `title` + type icon | yes |
| Type | `asset_type` | yes |
| Product | `product_name` | yes |
| Persona | `persona` | yes |
| Status | pill (`STATUS_PILL` map) | yes |
| Version | `current_version` | yes (numeric) |
| Updated | `updated_at` | yes (date, **default sort desc**) |
| Actions | **Open** → `/library/:id`; row click also navigates (this tab is a worklist, unlike finals) | no |

Admin `all` sub-tab excludes `final` (finals live in the first tab; no double-listing).
Empty states: admin `all` → "Nothing in progress. Create a new artifact or generate one in the
Asset studio."; non-admin → "You have no drafts yet. Generated assets you save land here."
The **New artifact** button + create form (unchanged fields) live on this tab, admin-only in the
UI (matches today's admin-only page; backend permits more but we do not widen the UI surface).

### 4.4 Reference documents — ingested sub-tabs

Data: `GET /api/documents` (one fetch; `doc_type` filtering client-side per sub-tab). Non-admins
see only their own uploads — backend-enforced, we do not change it.

| Column | Field | Sort |
|---|---|---|
| Title | `title` + `fa-file-lines` icon | yes (**default sort: createdAt desc**) |
| Doc type | `docType` | yes | (hidden on type sub-tabs, mirroring §4.1's Type column — post-QA amendment) |
| Source | `source` | yes |
| Product | `product` | yes |
| Chunks | `chunkCount` | yes (numeric) |
| AI | `aiEnabled` → "Enabled"/"Disabled" pill | yes |
| Ingested | `createdAt` | yes (date) |
| Actions | **Manage** → `/uploads` (admin only; chunk preview endpoint is canManage-gated, so no generic View action for MVP — §9) | no |

Empty states: admin → "No ingested documents of this type. Ingest files from the Uploads console
or a connector."; non-admin → "Documents you upload appear here once ingested."

### 4.5 Reference documents — Exemplar library sub-tab

Data + actions exactly as `ReferenceLibrary.tsx` today: `GET /api/reference-assets`; columns
Asset (icon + name, `title` = path) · Folder (`group · subgroup`) · Type (`ext`) · Size ·
Modified · Actions [**View**, **Export to PDF** (documents only)] with the existing
`authedBlob` open/print flows. Add: sortable headers (default Folder asc, then name — today's
server order), text filter over name + folder. Keep the explanatory line ("the quality bar
generated assets are measured against"). Empty state unchanged.

## 5. Component tree and file-by-file changes

```
ArtifactLibrary.tsx  (rewritten: tabbed shell — owns tab/sub ↔ URL state, role gating,
│                     shared product filter + per-tab text filter state, create form)
├── WorkspaceTabs (inline in shell: .tabs top bar + .step-pills sub bar)
├── FinalAssetsTab      → SortableTable (artifacts)  |  MessagingDocsTable → SortableTable
├── InProgressTab       → SortableTable
├── ReferenceDocsTab    → SortableTable (documents)  |  ExemplarLibraryTable → SortableTable
└── FoundationQuestionnaire (embedded, unchanged)
```

| File (absolute, under `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\`) | Change |
|---|---|
| `app\frontend\src\pages\ArtifactLibrary.tsx` | **Rewrite** as the tabbed shell. Keep exported component name and page title "PMM Workspace". Keep `?q=` seeding (lands on `tab=finalized`, seeds the text filter; filter state is shared across artifact tabs so switching to In progress keeps it). Keep `?tab=questionnaire` handling. Card grid is removed. |
| `app\frontend\src\components\workspace\FinalAssetsTab.tsx` | **New.** Artifact finals table + type sub-tab filtering + messaging sub-tab swap. |
| `app\frontend\src\components\workspace\MessagingDocsTable.tsx` | **New.** §4.2. |
| `app\frontend\src\components\workspace\InProgressTab.tsx` | **New.** §4.3. |
| `app\frontend\src\components\workspace\ReferenceDocsTab.tsx` | **New.** §4.4 + hosts ExemplarLibraryTable on `sub=exemplars`. |
| `app\frontend\src\components\workspace\ExemplarLibraryTable.tsx` | **New** — refactor of `ReferenceLibrary.tsx` (§4.5). |
| `app\frontend\src\components\ReferenceLibrary.tsx` | **Delete** (only importer is Studio; Studio import is removed below). |
| `app\frontend\src\components\SortableTable.tsx` | **New, generic.** Pays for itself across 5 table variants. Props: `columns: { key; label; sortable?; numeric?; render?(row); nowrap?; hidden? }[]`, `rows: T[]`, `defaultSort: { key; dir }`, `rowKey(row)`, `onRowClick?(row)`, `emptyNode`. Renders header sort indicators, `overflowX` wrapper, `empty-note` when zero rows. No pagination (client-side scale, §8). |
| `app\frontend\src\lib\assetViewers.ts` | **New.** `openArtifactRender(a)` (from Studio `viewFinal`) and `openMessagingDoc(d)` (from Studio `viewDoc`), including the shared brand-styled HTML shell string — single source for both former Studio and new Workspace usage. |
| `app\frontend\src\pages\Studio.tsx` | **Modify.** Remove the `finalized` view, `ReferenceLibrary` import, `viewFinal`/`viewDoc`/finals/approvedDocs state and the `tab-row`. Non-admin: `<Navigate to="/library?tab=finalized" replace />`. Admin: create wizard only, plus a link "Finalized assets → PMM workspace" (`/library?tab=finalized`) near the page title. |
| `app\frontend\src\main.tsx` | **Modify.** `/library` route: remove `adminOnly(…)` wrapper (backend already scopes non-admin reads to finals + own; see role model §6). `/pmm`, `/questionnaire`, `/library/:id` untouched. |
| `app\frontend\src\components\Layout.tsx` | **Modify.** `MAIN_NAV`: `/library` entry drops `adminOnly: true`. Optionally relabel non-admin nav to "Asset library" — keep "PMM workspace" for MVP (one label, less churn). |
| `app\frontend\src\styles\brand.css` | **Add ~20 lines**: `.tabs` / `.tabs button` / `.tabs button.active` — flex row, `border-bottom: 1px solid var(--border)` on the bar; buttons transparent, `padding: 10px 14px`, secondary text; active = `font-weight: 500`, primary text, `2px` solid `var(--teal-dark)` bottom border. Sub-tabs reuse existing `.step-pills`/`.step-pill` (precedented as type filters in Templates/Studio). No other CSS. |

Build sequence (each stage independently verifiable):
1. `SortableTable.tsx` + `.tabs` CSS + `assetViewers.ts` (pure additions, nothing wired). Verify: typecheck/build passes.
2. Rewrite `ArtifactLibrary.tsx` shell + `InProgressTab` + `FinalAssetsTab`/`MessagingDocsTable`. Verify: admin walks all sub-tabs, deep links, create form, `?q=` and `?tab=questionnaire` intact.
3. `ReferenceDocsTab` + `ExemplarLibraryTable`; delete `ReferenceLibrary.tsx`. Verify: exemplar View/Export parity.
4. Studio cleanup + route/nav opening. Verify: non-admin `/studio` redirect, non-admin `/library` scoping, no dead imports.

## 6. Role behavior (existing semantics, no new access)

- **Admin:** all four tabs; all statuses on In progress; status/type/product filtering; New artifact;
  Edit actions; Manage → /uploads.
- **Non-admin (sales / marketing / elt):** tabs Finalized assets · My drafts · Reference documents.
  Finals list is server-scoped (`canRead`: finals for everyone). "My drafts" uses `mine=1` —
  own artifacts, any status, exactly today's backend rule. Reference documents: exemplar library
  for everyone (endpoint is `requireAuth`); ingested sub-tabs show only their own uploads
  (backend-enforced). No questionnaire tab, no New artifact button, no Edit action on finals.
- Route opening `/library` to all roles is a **frontend** change only; every backend read this page
  performs is already role-scoped server-side (`artifacts.ts` `canRead`, `documents.ts` owner
  filter, `messaging-docs` finals-only). Authorization boundary stays in the API per
  engineering-playbook vol-3 08 — the UI never becomes the gate.

## 7. Parity + acceptance checklist (qa-reviewer)

Parity — every current capability must survive:
- [ ] Artifact browse with product filtering; type/status/persona/title narrowing achievable via sub-tabs + text filter; "My artifacts" (admin checkbox; non-admin default).
- [ ] Create artifact (title/product/type/persona) → navigates to `/library/:id`.
- [ ] Open any artifact row into the editor from In progress; Edit from Finalized (admin).
- [ ] View finalized artifact render in a new tab (html/svg/deck render paths + digest fallback) — identical output to Studio's old `viewFinal`.
- [ ] View approved messaging doc (brand-styled HTML tab); war-room path shown.
- [ ] Exemplar library: View for pdf/video/other; Export to PDF for documents (pdf downloads; office formats open print-ready view). Busy-state disables buttons per row.
- [ ] `/pmm` and `/questionnaire` still land on the questionnaire tab; questionnaire behaves unchanged.
- [ ] Topbar search still lands on `/library?q=…` with the filter applied.
- [ ] Notifications / CompetitiveIntel / Home / RoutingCard links to `/library/:id` unaffected.
- [ ] Non-admin `/studio` shows finalized content (via redirect) — nothing they could see before is now unreachable.

New acceptance criteria:
- [ ] `?tab=` and `?sub=` deep-link and survive refresh; invalid values fall back to defaults; switching top tab resets sub to `all`; browser Back steps through top tabs.
- [ ] Every column marked sortable in §4 toggles asc/desc with a visible indicator; numeric and date columns sort numerically/chronologically, not lexically.
- [ ] Text filter is per-tab, case-insensitive, matches the fields listed in §4, and clears on tab switch (except the shared artifact-tab filter noted in §5).
- [ ] Each sub-tab shows its specified empty state; API errors render the existing red error banner, not a blank page.
- [ ] Tables scroll horizontally inside their container at narrow widths; tab bars wrap without overflow.
- [ ] Non-admin sees exactly the tabs/actions in §6 — verify by role switch, and verify the API (not the UI) is what withholds drafts (`/api/artifacts` returns finals-only for a non-admin token).
- [ ] `rg ReferenceLibrary` returns no live imports; build has no unused-export warnings for removed Studio code.

## 8. Risks

- **Regressed links:** `?tab=questionnaire` is load-bearing (`/pmm`, `/questionnaire` redirects); the new tab token set deliberately keeps it. Topbar search and `/library/:id` paths unchanged. Covered in checklist.
- **Studio redirect loop:** non-admin `/studio` → `/library` is safe only after `/library` is opened to all roles — build-sequence stage 4 does both together.
- **Table performance:** client-side sort/filter over full fetched lists. Explicitly acceptable at hackathon scale (tens to low hundreds of rows); no pagination or server-side sort in MVP. Revisit only if a list exceeds ~1,000 rows (then add server `sort`/`limit` params — V2).
- **Loss of card visuals:** finals move from cards to rows; thumbnails/icons are retained inline. This is the requested direction ("proper tabular structure").
- **Narrow screens:** app is desktop-first; tables scroll in-container, tab rows wrap. No dedicated mobile layout in MVP.
- **Double-listing:** finals excluded from admin In progress `all` so no artifact appears on two tabs.

## 9. Flagged backend gaps (non-blocking, V2 candidates)

1. `GET /api/artifacts` list returns no approver name/date and no creator display name (only
   `created_by` uuid) — so the finals table shows Updated, not "Approved by / on". V2: join
   approval metadata from the activity log into the list payload.
2. `GET /api/documents/:id/chunks` is canManage-gated, so a generic per-row "View" for reference
   documents is not possible for non-owners; MVP ships admin "Manage → /uploads" instead. V2: a
   read-only document preview endpoint if the demo needs it.
3. No server-side sort/pagination on any list endpoint — intentionally not needed (§8).
