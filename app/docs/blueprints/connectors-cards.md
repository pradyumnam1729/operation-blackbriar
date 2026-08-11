# Blueprint: Connectors screen — card grid + config drawers

- Date: 2026-08-11
- Status: approved requirement; LIGHT blueprint (UI reorganization, no new subsystem)
- Route: `/integrations` (nav "Connectors") — route and nav label unchanged
- Owner file today: `app/frontend/src/pages/IntegrationsPage.tsx` (~872 lines, vertically stacked sections)
- Visual reference: the Agents tab card grid (`app/frontend/src/pages/Agents.tsx`, commit bd86cd3) and its config drawer (`app/frontend/src/components/AgentDrawer.tsx`)

## 1. Frame

The Connectors screen currently stacks three sections: a toggle-row summary
(`ConnectorSummary`), the Local folders console (`LocalFoldersSection`), and the
SharePoint (Graph) console (inline in `IntegrationsPage`). It becomes a
multi-column card grid — one card per connector — with per-connector config in a
right-side drawer, matching the interaction pattern the Agents tab adopted.

This is a refactor, not a rewrite: **every handler, form, and piece of state
moves as-is** into extracted components. **Zero backend changes** — the three
existing GET endpoints already carry everything the cards need:

| Endpoint | Auth | Feeds |
|---|---|---|
| `GET /api/integrations` | any user | flags: `canva_live`, `salesforce_live`, `sharepoint_graph` |
| `GET /api/sharepoint/status` | any user | configured, credentials source, flagEnabled, connections[] (enabled, lastSync, lastResult, docType, productLine) |
| `GET /api/local-folders` | any user | configured, enabled, paths, docType, productLine, lastScan/Ingest/Export + results |

All mutating endpoints stay exactly as used today (`PUT/DELETE
/api/sharepoint/credentials`, `POST /api/sharepoint/test`, `POST/DELETE
/api/sharepoint/connections`, `POST /api/sharepoint/connections/:id/sync`,
`POST /api/integrations/flags/:key/toggle`, `POST /api/integrations/:id/toggle`,
`PUT /api/local-folders`, `POST /api/local-folders/{toggle,scan,export}`). All
mutations are `requireAdmin` on the backend, so the authorization boundary is
unchanged (vol-3 08: server-enforced, UI only reflects it).

## 2. Card inventory (4 cards — no SMTP flag exists in the codebase; do not invent one)

Grid: `repeat(auto-fill, minmax(310px, 1fr))`, gap 14 — identical to Agents.tsx
line 561. Card anatomy copies Agents `renderCard`: 40px icon tile, name +
mono subline, status pill(s), 2–3-line description clamp, footer stat line
separated by `border-top: 1px solid var(--border)`, hover lift
(`shadow-2` + `translateY(-2px)`).

| Card | Icon | One-liner | Pills | Stat line (footer) | Click |
|---|---|---|---|---|---|
| **SharePoint (Microsoft Graph)** | `fa-brands fa-microsoft` | Live sync of release notes and context docs via Microsoft Graph. | `Credentials configured` (pill-live) / `Credentials missing` (pill-lock); toggle pill `Live sync on` / `Live sync off` | `{n} connection(s) · last sync {max(lastSync) or "never"}` | Opens SharePoint drawer |
| **Local folders (Input / Output)** | `fa-solid fa-hard-drive` | Watched Input folder + Output export — the SharePoint stand-in. | `Configured` / `Not configured` (pill-pending); toggle pill `Watching Input` / `Paused` | `last scan {lastScan or "never"} · last export {lastExport or "never"}` | Opens Local folders drawer |
| **Salesforce** | `fa-solid fa-cloud` | Nightly sync of win / loss opportunity data. | toggle pill `Live (mock)` / `Off`; footer pill `Mock data` (pill-review) | Honest note: "Mock opportunities until the read-only Connected App is provisioned." | Not clickable (nothing to configure) — cursor default, like custom-agent cards in Agents.tsx |
| **Canva** | `fa-solid fa-palette` | Populate approved brand templates directly in Asset Studio. | toggle pill `Live (mock)` / `Off`; footer pill `Mock data` | Honest note: "Mock template gallery until the Canva Connect OAuth app exists." | Not clickable |

Notes:
- The toggle pill is a `<button className="pill pill-live|pill-lost">` with
  `e.stopPropagation()`, exactly the Agents enabled/disabled pill (Agents.tsx
  284–299) — replacing the current `toggle-switch` rows. Admin-only; hidden
  (static pill) for non-admins.
- Salesforce/Canva flags are live-toggleable mocks today — **keep them
  toggleable** (parity), rendered as normal-opacity cards with the mock note.
  They are not "disabled cards"; they are "no-config cards".
- Local folders toggle stays disabled until `configured` (title hint:
  "Configure the folder pair first" → clicking the card opens the drawer with
  the form auto-open, which replaces today's `editing=true` auto-open).
- Card order: SharePoint, Local folders, Salesforce, Canva. One grid, no
  section groups (only 4 cards — grouping is gold-plating).

## 3. Config drawers (not modals)

**Choice: right-side drawer** using the existing `.overlay` + `.drawer`
primitives (brand.css 1155–1180) — the same primitive AgentDrawer uses. No
centered-modal primitive exists in the codebase; introducing one for this
refactor would violate consistency for no gain. The SharePoint drawer is
content-heavy (connections table), so widen it: `style={{ width: 640 }}`
override on `.drawer` (max-width 92% already caps small screens).

Shared drawer behavior (copy AgentDrawer's pattern, lines 150–154, 333–345):
- Overlay click, close button, and Escape all route through a dirty guard:
  `window.confirm("Discard unsaved changes?")` when dirty.
- Dirty definition per drawer:
  - SharePoint: `clientSecret !== ""` OR the add-connection form has any
    non-default field OR `testUrl !== ""` with `showAdd` open.
  - Local folders: `editing === true` AND form differs from loaded status.
- On any successful mutation the drawer calls `onChanged()` so the page
  refreshes card pills/stats (same contract as AgentDrawer's `onChanged`).

### 3.1 SharePointDrawer

Everything from today's SharePoint card body moves in, structure intact:

1. Header: name + `Credentials configured/missing` pill + live-sync toggle pill.
2. Credentials block (admin): the current `showCreds` collapsible → always-open
   form section inside the drawer (drawer *is* the disclosure now; drop the
   chevron button). Keep: setup instructions when `!configured`
   (`requiredPermission` text), env-source note, tenant/client/secret fields,
   `canSaveCreds` gate + titles, save (secret cleared after), `credsNote`,
   clear-credentials with `window.confirm` (only when source === "database").
3. Test + add connection (admin, `configured` only): test URL input, Test
   button (pre-fills add form with `suggestedFolderPath` and auto-opens it —
   preserve this), Add connection form with docType/productLine conditional.
4. Connections table: unchanged columns; Sync now / Pause–Resume / Remove
   (confirm) per row. `POST /api/integrations/:id/toggle` for pause/resume.
5. Sync log block at the bottom (unchanged).
6. The `run()` wrapper moves in verbatim, including the admin-error mapping
   ("Only PMMs (admins) can change integration settings…").

Non-admin: drawer opens read-only — the existing `isAdmin` conditionals in the
moved JSX already hide every control and show "A PMM admin must configure the
SharePoint credentials…" when unconfigured. This preserves today's non-admin
visibility of the connections table.

### 3.2 LocalFoldersDrawer

`LocalFoldersSection` moves in wholesale: intro paragraph, edit form
(inputPath/outputPath/docType/productLine, `canSave` gate, "Save & start
watching"), Pause/Resume + Edit buttons, the Input/Output two-row table with
Scan now / Export finals, activity log block. Behavior preserved: when
`!configured`, the form is open on drawer mount (today's `setEditing(true)`
on load). Non-admin: read-only table + pills, no form/buttons (existing
`isAdmin` conditionals).

## 4. Component tree and data flow

```
IntegrationsPage (page shell — rewritten, ~200 lines)
├─ loads: GET /api/integrations, /api/local-folders, /api/sharepoint/status  (Promise.all, one load())
├─ renders: title + pagesub, error banner, card grid (renderCard per connector)
├─ owns: flag/localfolders toggle handlers (flip pill), busy lock, open: "sharepoint" | "localfolders" | null
├─ SharePointDrawer  ({ isAdmin, onClose, onChanged })   — owns its own status load + all SP state/handlers
└─ LocalFoldersDrawer({ isAdmin, onClose, onChanged })   — owns its own status load + all LF state/handlers
```

Drawers self-load on mount (like AgentDrawer) rather than taking status as a
prop — avoids stale-prop bugs and keeps the page shell dumb. The page's `load()`
re-runs on `onChanged` and after every card-pill toggle.

## 5. States

- **Loading:** `<div className="empty-note">Loading connectors…</div>` until the
  initial `Promise.all` resolves (Agents.tsx pattern). Cards never render from
  partial data.
- **Error (page):** red banner (`#FCE8E8` box) above the grid — reuse the exact
  block from Agents.tsx 426–438. Cards still render from whatever loaded.
- **Error (drawer):** each drawer keeps its own error line (today's `error` /
  `lfError`), rendered inside the drawer.
- **Non-admin:** grid renders identically; toggle pills are static (no button),
  SharePoint/Local-folders cards remain clickable and open read-only drawers;
  Salesforce/Canva cards show static pills. Page keeps the `Admin only`
  lock pill in the title? **No** — remove it: the page is no longer admin-only
  in effect (viewers see state); replace pagesub with "Turn on the systems Hive
  pulls from and pushes to. Only PMM admins can change settings."
- **Empty:** not applicable — the four cards are static inventory. Inside the
  SharePoint drawer, keep "No SharePoint connections yet — add one above."

## 6. File-by-file change list

| File | Change |
|---|---|
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\pages\IntegrationsPage.tsx` | Rewrite as page shell + card grid. Delete `ConnectorSummary`, `LocalFoldersSection`, and the inline SharePoint JSX. Keep `StatePill` only if still used; export name `IntegrationsPage` and route untouched. |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\SharePointDrawer.tsx` | New. Extracted SharePoint section: `SpStatus` interface, all creds/test/add/sync/connection state and handlers moved verbatim; wrapped in `.overlay`/`.drawer` (width 640) with dirty guard + Escape. |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\LocalFoldersDrawer.tsx` | New. Extracted `LocalFoldersSection` + `LocalFoldersStatus` interface, wrapped in `.overlay`/`.drawer` (default 440 width) with dirty guard + Escape. |
| `app/frontend/src/styles/brand.css` | No change expected. Grid and card styles are inline (Agents precedent). Only touch if the 640px drawer override warrants a `.drawer-wide` class — optional. |
| Backend | **No changes.** |

## 7. Build sequence (with qa-reviewer verification per stage)

1. **Extract `LocalFoldersDrawer`** (smaller, self-contained). Page temporarily
   renders old SharePoint section + new LF card/drawer.
   *Verify:* full Local-folders checklist below passes.
2. **Extract `SharePointDrawer`.**
   *Verify:* full SharePoint checklist below passes.
3. **Rewrite page shell** — card grid, flag pills, remove `ConnectorSummary`.
   *Verify:* card pills mirror server state after every toggle; busy lock
   prevents double-toggles; non-admin render.
4. **Polish pass** — hover lift, keyboard (Enter/Space opens card, Agents.tsx
   214–219), Escape + dirty guards.
   *Verify:* `npm run build` in `app/frontend` passes typecheck; no unused
   exports left in IntegrationsPage.

## 8. Risks and parity checklist

**Primary risk:** regressing working SharePoint / Local-folders flows during an
~870-line refactor. Mitigation: move handlers verbatim (rename-only edits), and
qa-reviewer walks this exact action list against a running backend before and
after (record the "before" behavior first):

SharePoint (as admin):
1. Fresh state (no creds): drawer opens with setup instructions + permission name; creds form visible.
2. Save credentials with all three fields → note "Credentials saved…"; secret field clears; pill flips to `Credentials configured`.
3. Env-source case: note "Credentials currently come from app/backend/.env…" shows; saving overrides to database source and Clear button appears.
4. Clear credentials → confirm dialog → pill reverts.
5. Test connection with a site URL → success line with webUrl; add-connection form auto-opens pre-filled with siteUrl + suggested folderPath.
6. Add connection (name + siteUrl gates enforced via disabled+title) → row appears; form resets.
7. Sync now → sync log renders; lastSync/lastResult update in table and on the card stat line.
8. Pause/Resume a connection; Remove with confirm.
9. Live-sync pill toggle flips `sharepoint_graph` flag; card pill updates.
10. Forced 403 (non-admin session hitting a mutation) → mapped message "Only PMMs (admins) can change integration settings…".

Local folders (as admin):
11. Unconfigured: card shows `Not configured`, toggle pill disabled with hint; opening drawer shows the form already open.
12. Save & start watching (both paths required; folders auto-created) → success log line; table renders both rows.
13. docType `release_note` shows the Product line select; other types hide it.
14. Scan now → log + lastScan/lastScanResult update; Export finals → log + lastExport update.
15. Pause/Resume from drawer AND from the card pill both work and stay in sync.
16. Edit re-opens the form pre-filled.

Flags + non-admin:
17. Canva and Salesforce pills toggle their flags; mock notes visible; busy lock holds during a toggle.
18. As a non-admin: no toggle buttons anywhere; SharePoint/Local-folders drawers open read-only (tables visible, no forms/buttons); no console errors.

Secondary risks:
- **Dirty-guard false positives** (e.g. testUrl typed then abandoned) — keep the
  guard narrow per §3 definitions; verify closing an untouched drawer never prompts.
- **Drawer width on small screens** — `.drawer` max-width 92% already handles it; verify the connections table scrolls horizontally inside the drawer (`overflowX: auto` retained).
- **Losing the auto-expand behaviors** (`credsInitialised`, LF `setEditing(true)`) — both are explicitly called out above; qa-reviewer checks items 1 and 11.

## 9. Out of scope (V2, not in this slice)

- Per-connector status summary endpoint (not needed — existing GETs suffice).
- SMTP or any connector not present in the code today.
- Real Salesforce/Canva config drawers (blocked on credentials; cards stay honest mocks).
- Centered-modal primitive; drawer is the house pattern.
