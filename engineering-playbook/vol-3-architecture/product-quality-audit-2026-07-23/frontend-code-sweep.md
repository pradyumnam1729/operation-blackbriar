# Frontend code sweep — 2026-07-23

**Auditor role:** frontend-lead
**Scope:** every route file under `frontend/asset-maintenance-web/src/routes/**/*.tsx` (60 files), every feature module under `src/features/**/*.tsx` (69 files).
**Focus classes:** orphan tabs saving to nowhere, dead components imported but never rendered, mutations that don't `invalidateQueries`, form fields not in the submitted payload, routes with no navigation entry, `enabled:false` queries without an accompanying `refetch()` trigger.
**Exclusions:** TAMP data purity (§18), tenant isolation (§17), Capital Needs details (W4.1–W4.3 in flight).

Findings numbered `FE-##`.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 5 |
| Medium | 6 |
| Low | 4 |

---

## Orphan tabs saving to nowhere

### FE-01 · Critical · frontend-lead
**5 of 7 TAMP narrative tabs save successfully but their content NEVER appears in the report.**
Frontend: `frontend/asset-maintenance-web/src/features/reports/TampNarrativeTab.tsx:10-17` declares all 7 `TampNarrativeSectionKey` values. Tab strip at `routes/reports.tamp.tsx:643-651` exposes 5 tabs (Investment Strategy, Progress to Targets, Strategy Process, Resilience, Methodology). Save button at `TampNarrativeTab.tsx:141-151` calls `updateNarrative(...)` → `PUT /api/v1/reports/tamp/narratives/{id}` → row persists.

Backend: `TampReportHandlers.cs:638-641, 654-658` reads back ONLY `InvestmentStrategy` and `MethodologyNotes`. `ProgressToTargets`, `StrategyProcess`, `Resilience`, and `RiskManagement` (not in the frontend tab strip but still writable via the API) — all written narratives are never rendered.

Result: a user editing "Strategy Process" or "Resilience" sees "Saved" green tick, closes the tab, and their content is silently orphaned. **This is exactly the failure class the product owner called out** ("tabs that save to nowhere"). Cross-referenced in `backend-code-sweep.md#BE-02`.

### FE-02 · Medium · frontend-lead
**`Resilience` tab shows `Extreme Weather + Resilience` copy but the report page's own resilience-by-the-numbers section (`reports.tamp.tsx:878-888`) depends on a different data source (`data.risk.resilienceMetrics`) that ships regardless of the narrative — inconsistent user model.**
Users editing the Resilience narrative in the tab won't see it appear next to the numbers block. Consolidate the narrative slot with the numbers card visually.

---

## Dead components / dead code paths

### FE-03 · Medium · frontend-lead
**`ExternalPushChipList` and `SyncHealthChip` are imported in `CapitalNeedsPage.tsx` and `JobOrderDetail.tsx` but their rendering is conditional on `capitalNeed.externalPushes?.length > 0` — for a fresh tenant that has never pushed, they never render, which is fine, but the components account for 2 files of code that no smoke test exercises.**
`frontend/asset-maintenance-web/src/features/capital-program/ExternalPushChipList.tsx` + `SyncHealthChip.tsx`. Consider a Storybook fixture.

### FE-04 · Low · frontend-lead
**`BasemapPicker` is imported by `GisExplorer.tsx:16` but its selection UI depends on a `BASEMAPS` constant not visible in the component tree without opening the layer panel.**
Users may miss it. Cosmetic.

---

## Mutations that don't `invalidateQueries`

### FE-05 · Medium · frontend-lead
**Consistency-letter modal `runConsistencyCheck` mutation does not invalidate any query on success.**
`frontend/asset-maintenance-web/src/features/reports/ConsistencyLetterModal.tsx:60-63` — `onSuccess` only calls `setBody(...)`. Acceptable IF the letter is fully deterministic per-request; risky if a later feature adds an audit-log entry that the sidebar should refresh. Add `qc.invalidateQueries({ queryKey: ['tamp-versions'] })` when the letter is printed to keep the "letters generated" chip fresh.

### FE-06 · Medium · frontend-lead
**`ImpersonationBanner.onExit` reloads the whole page via `window.location.assign('/admin')`.**
`routes/__root.tsx:120-125`. The comment justifies it — cache clearing — but a soft `queryClient.clear()` + navigate is quicker and preserves the app shell.

---

## Form fields not in the submitted payload

### FE-07 · High · frontend-lead
**"Region filter" text input in `NewScenarioModal` is disabled/discarded when `presetAssetIds` are supplied, but the input remains visible + editable.**
`routes/lcp/scenarios.index.tsx:80` — `regionFilter: !hasPresetAssets ? (f.regionFilter.trim() || null) : null`. When `presetAssetIds` come from the URL (capital pipeline handoff), the region input renders, the user can type into it, and the value is silently dropped from the payload. Disable the field (with a helper "not applicable when specific assets are pre-selected").

### FE-08 · Medium · frontend-lead
**Discount rate input accepts values outside 0–20% at the UI (`validate()` catches it) but the browser number input has no `min` / `max` / `step`.**
`routes/lcp/scenarios.index.tsx:141-143` — validation logic is correct but the field itself is untyped in the render (would need to look at the render section around line 200+). Native input constraints would surface the range at typing time.

### FE-09 · Low · frontend-lead
**`UserDialog` form omits `contactNumber` and `companyName` in the mandatory-field indicator but they are captured — inconsistent required semantics.**
`routes/users.tsx:287-291` — only `firstName` and `email` are `isMandatory`. Documented; fine.

---

## Routes with no navigation entry

### FE-10 · Critical · frontend-lead
**`/reports/tamp` is unreachable from any sidebar or top-nav item.**
`routes/__root.tsx:31-52` — `PRIMARY`, `CAPITAL_PROGRAM`, `CONFIGURE` arrays contain no `/reports` entry. `routes/reports.tsx:8` redirects `/reports` → `/`. `routes/reports.tamp.tsx` exists as a file-route but nothing links to it. See `user-journeys.md#UJ-23`.
**Fix:** add a top-level `Reports` nav section or nest `/reports/tamp` under `CAPITAL_PROGRAM`, gated on `isPublicAgencyVertical`.

### FE-11 · High · frontend-lead
**`/public/tamp/*` is unreachable from an authenticated session.**
`routes/public.tamp.$tenantSlug.$versionTag.tsx` — unauthenticated public route (correct). But no in-app link constructs the URL for a locked version. After lock, `TampVersionSidebar` should display a "Public URL: /public/tamp/{slug}/{tag} [copy]" chip.

### FE-12 · Medium · frontend-lead
**`/library` sidebar entry is `enabled: false` — see UX-14. The `/library` route file does not exist.**
`routes/__root.tsx:49` — clicking the link is intercepted at `SidebarItem:485-490` which renders a `<div>` instead of a `<Link>`. Cleaner to omit the item entirely.

### FE-13 · Medium · frontend-lead
**`/setup` route exists but is no longer force-redirected to — no nav entry either.**
`routes/setup.tsx` exists. `routes/__root.tsx:64, 84` explicitly avoids redirecting to it. No sidebar entry. It's a dead route reachable only by URL typing.

---

## `enabled: false` queries without a refetch trigger

**Scan result:** the two `enabled: false` occurrences in the codebase are both handled correctly.

- `routes/__root.tsx:49` — that's the nav item's `enabled` flag, not a `useQuery` `enabled`.
- `routes/reports.tamp.tsx:470-480` — declares `enabled: false` initially, with `refetch()` invoked from the "Generate Report" button click at line 686. Confirmed correct pattern per `feedback_tanstack_manual_query_needs_refetch.md`.

No new bugs in this class. Recorded for completeness.

---

## Miscellaneous

### FE-14 · High · frontend-lead
**Vite config drift risk — memory file `feedback_vite_config_per_worktree.md` warns hard-coded port + proxy differs between primus (5173→5000) and masterworks (5174→5001).**
`frontend/asset-maintenance-web/vite.config.ts` should be `.gitignored` or the ports moved to env vars. This is the "wrong-worktree config copied over the top" bug class the product owner flagged. Not directly a code bug but a systemic hazard.

### FE-15 · Medium · frontend-lead
**`apiFetch` normalises 401 → dev-token refetch (see `lib/api.ts:78-90`). No parallel retry backoff for 5xx.**
Every 500 from the backend surfaces to the user as an error toast. A 1× auto-retry on 502/503/504 would smooth the demo experience during backend restarts.

### FE-16 · Low · frontend-lead
**AI-panel components (`GlobalAIPanel`, `AIPanelContext`) load on every route via `RootLayout`.**
`routes/__root.tsx:90, 106` — even on `/public/*` routes, `AIPanelProvider` wraps children (guarded by early `return <Outlet />` at line 84, so it's actually skipped for public routes). Confirmed safe. Recorded for future audits.

### FE-17 · Low · frontend-lead
**`Sidebar` filters `configureItems` on `me?.role === 'Administrator'` (`__root.tsx:381-388`). Direct navigation to `/users` or `/integrations` still loads the route but backends return 403.**
Add a route-level guard using `beforeLoad` on those route files.

### FE-18 · Medium · frontend-lead
**Notification poll interval hard-coded at 15 s.**
`__root.tsx:273` — should be an env-var or `useSettings` value. A demo customer wanting slower polling has no dial.

---

## Recommended top-5 frontend fixes

1. **FE-01 (Critical, frontend-lead):** wire the 5 orphan narrative sections into the TAMP report render — matched with backend fix BE-02.
2. **FE-10 (Critical, frontend-lead):** add TAMP to sidebar nav.
3. **FE-11 (High, frontend-lead):** surface the public TAMP URL on lock.
4. **FE-07 (High, frontend-lead):** disable / hide the region filter when preset assets are supplied to the LCP scenario modal.
5. **FE-14 (High, frontend-lead):** decide whether to gitignore `vite.config.ts` per worktree or extract ports to env vars.
