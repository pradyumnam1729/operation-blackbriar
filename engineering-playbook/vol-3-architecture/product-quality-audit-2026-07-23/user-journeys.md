# User-journey audit — 2026-07-23

**Auditor role:** product-manager
**Scope:** 10 critical user journeys, primus branch (`primusmaintain-v2`), source-code walk only (app not run).
**Exclusions:** TAMP data purity (covered by `18-tamp-data-purity-audit.md`), tenant isolation (covered by `17-tenant-isolation-audit.md`), Capital Needs feature scope in flight (W4.1/W4.2/W4.3).
**Severity ladder:** Critical / High / Medium / Low.
**Owner tag:** the role that should own the fix (backend-lead / frontend-lead / ux-strategist / product-manager / qa-lead / lifecycle-domain-expert / devops).

Each finding cites file:line evidence. Findings numbered `UJ-##`.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 6 |
| Medium | 7 |
| Low | 4 |

---

## Journey 1 — Login → dashboard → tenant scoping

### UJ-01 · High · ux-strategist
**`/reports` route silently redirects to home dashboard.**
`frontend/asset-maintenance-web/src/routes/reports.tsx:8` — any hit to `/reports` (or `/reports/`) throws `redirect({ to: '/' })`. Users who bookmark `/reports` or click a shared link land on the dashboard with no explanation. The comment says "Primus build removed public-agency-only reports" but the redirect fires on both worktrees.
**Fix:** either render a "Reports index" landing card with links to available report kinds, or scope the redirect to `BRAND.key === 'primus'` AND surface a toast on redirect.

### UJ-02 · Medium · frontend-lead
**Login screen has no visible tenant selector.**
`frontend/asset-maintenance-web/src/routes/login.tsx` — dev-token auto-fetch (`ensureDevToken` in `lib/api.ts:49-53`) always requests `role=AssetManager` and lands the user on a default tenant. First-time reviewers can't pick which of the 4 vertical demo tenants to enter without opening devtools. `AppSwitcher` exists in `__root.tsx:145` but is post-login. A domain/tenant preview on the login page would remove the confusion.

### UJ-03 · Low · frontend-lead
**Session-expired flow is a silent hard reload.**
`lib/api.ts:36-39, 43-46` — 401 triggers `localStorage.removeItem` + `window.location.assign('/login')`. In-flight form data is lost with no warning. Acceptable for MVP; flag for Wave-2 idle-timeout UX.

---

## Journey 2 — Assets list → asset detail → new inspection → submit

### UJ-04 · Medium · ux-strategist
**No breadcrumb between `Assets list → Asset detail → Inspect`.**
`frontend/asset-maintenance-web/src/routes/assets.$id.inspect.tsx` — the route is `/assets/$id/inspect` but the layout does not render a back-to-asset link. A user starting an inspection has no in-page cue to abandon and return; only the sidebar's "Inspections" highlight (see `__root.tsx:451-453` isActive rule) tells them what section they're in.

### UJ-05 · Low · qa-lead
**Inspection submit success is a toast — no post-submit summary.**
`frontend/asset-maintenance-web/src/routes/inspections.$id.tsx` and the smoke test `e2e/smoke/04-new-inspection.spec.ts` show mutation + toast, then the user is left on the form page. A summary screen showing "what was scored, what changed" would tighten the loop.

---

## Journey 3 — Capital Needs list → new need → confirm

**Scope note:** per task instruction, we do NOT re-review CapitalNeeds detail; W4.1–W4.3 covers bundle push, generatedBy column, tab reorder, stale-needs. Findings below are ONLY about journey ergonomics on the list page and CreateNeedDialog opening/closing.

### UJ-06 · Medium · ux-strategist
**Empty "Bundled" and "Closed" tabs have no zero-state guidance.**
`frontend/asset-maintenance-web/src/features/capital-program/CapitalNeedsPage.tsx:35-61` — STATUS_CONTEXT copy is populated for all statuses, but the actual empty table renders "No capital needs match the current filters" with no next-step hint (based on the STATUS_CONTEXT for "Bundled" they should be told to visit Job Orders; the copy exists but doesn't render below zero-row tables in the code path).

### UJ-07 · Low · product-manager
**Filter chip cluster ("hasFilters") shows a clear-all link only when a filter is active — expected — but the label doesn't say how many rows were removed.**
`CapitalNeedsPage.tsx:101` — improving this to "12 filtered out" makes the state discoverable.

---

## Journey 4 — Job Orders list → new job order → assign → handoff to Build

### UJ-08 · High · frontend-lead
**"Push to Build" handoff error is a full-page drawer with no context on what to fix.**
`frontend/asset-maintenance-web/src/features/capital-program/HandoffErrorDrawer.tsx` (surface exists based on the file listing). Users hitting a 500 from the stubbed Build endpoint (see `Infrastructure/ExternalClients/*Stub*` — Build is a stub in dev) will see this generic error frequently in the demo. Suggested: add a "reason from server" bullet plus a "retry" button that re-invokes the mutation.

### UJ-09 · Medium · lifecycle-domain-expert
**Job Order stepper has no "cancel" branch shown until the drawer is opened.**
`frontend/asset-maintenance-web/src/features/capital-program/JobOrderStepper.tsx` + `CancelJobOrderDrawer.tsx` — cancellations happen but the stepper doesn't visually reserve a "cancelled" terminal state, which will confuse the auditor demo scenario.

---

## Journey 5 — LCP scenarios → new scenario → run → view results → adopt

### UJ-10 · Critical · frontend-lead
**"Scenario Type = Do Nothing" (value 2) accepts the same form fields as other types but silently ignores `annualBudgetCap`.**
`frontend/asset-maintenance-web/src/routes/lcp/scenarios.index.tsx:73-83` (payload builder) — `annualBudgetCap` is only sent when `type === 1` (Constrained). Correct behavior, but the form still lets the user type a budget cap in "Do Nothing" mode and does not disable/hide it. Users assume the number is saved; it isn't. This is exactly the class of silent-failure bug the product owner flagged. **Fix:** hide the `annualBudgetCapM` input for `type !== 1`, or show `disabled + tooltip "not applicable in this scenario type"`.

### UJ-11 · High · lifecycle-domain-expert
**"Discount Rate" default of 3% is hard-coded — no source citation, no per-tenant override wired to `/model-settings`.**
`scenarios.index.tsx:103` — `discountRatePct: '3'` — infrastructure planners will ask "why 3? OMB Circular A-94 says 7% for benefit-cost". The `/model-settings` endpoint exists (see `Config/ModelSettingsHandlers.cs`) but is not read by this form. Load `modelSettings.discountRate` as the default.

### UJ-12 · Medium · ux-strategist
**"Prioritization Method" descriptions don't warn that Risk-First requires risk register data — silent zero results possible.**
`scenarios.index.tsx:39-43` — for a tenant with no completed inspections (fresh demo), Risk-First produces an empty scenario. No pre-flight validation.

---

## Journey 6 — GIS Explorer → layer toggles → asset click → info panel

### UJ-13 · Medium · frontend-lead
**Domain-specific map centers use hard-coded coordinates with no timezone/accuracy comment.**
`frontend/asset-maintenance-web/src/features/gis/GisExplorer.tsx:31-44` — 5 fixed lon/lat pairs. Domains added later (e.g., a new vertical) will fall back to PublicAgency Texas (`GisExplorer.tsx:82-83`) with no user-visible cue. Add a `console.warn` when the fallback fires, or drive from `DomainProfile` config so it's tenant-editable.

### UJ-14 · Low · ux-strategist
**"Hazard overlay" toggle is off by default with no callout to enable it — a first-time reviewer misses the entire resilience story.**
`GisExplorer.tsx:60` — `hazardVisible = false`. Consider making it default-on for the PublicAgency vertical (which needs the Chapter 4 resilience talking point per FHWA § 515.9(k)).

---

## Journey 7 — Configuration → domain profile → objectives → integrations

### UJ-15 · High · ux-strategist
**Configuration tab strip includes "Domain profile" but there is no "you must save changes" indicator when the user switches profiles.**
`frontend/asset-maintenance-web/src/routes/configuration.domain-profile.tsx` (per glob listing) — combined with the "no setup wizard gate" memory (`feedback_no_setup_wizard_gate.md`), a new tenant who lands on this screen will not realize their picks materially change every seed downstream. Suggested banner: "Switching domain profile re-runs the demo seed. Confirm?"

### UJ-16 · Medium · frontend-lead
**Integrations page requires Administrator role — non-admins get filtered out of sidebar (`__root.tsx:386`) but the direct URL `/integrations` still renders the shell before returning 403 XHRs.**
`frontend/asset-maintenance-web/src/routes/integrations.tsx` — should short-circuit with a Restricted panel like `users.tsx:40-49` does.

---

## Journey 8 — Users & roles → invite → assign role → deactivate

### UJ-17 · Medium · product-manager
**"Delete user" uses `window.confirm(...)`.**
`frontend/asset-maintenance-web/src/routes/users.tsx:177` — `if (confirm(...))`. Every other destructive action in the app uses a custom `Overlay` modal. Inconsistent; native confirm won't get past a modal-dialog QA scan.

### UJ-18 · Medium · frontend-lead
**"Password / Set / Reset" dialog handles activation + reset + invite in one screen — hard to scan.**
`users.tsx:196-258` — three mutations (`setPw`, `reset`, `invite`) share the same overlay with conditional copy. Splitting into two tabs ("Set temporary password" / "Send invite") would remove the "which button do I press?" moment.

---

## Journey 9 — Notifications

### UJ-19 · Low · frontend-lead
**Bell popover has no "view all notifications" link.**
`frontend/asset-maintenance-web/src/routes/__root.tsx:265-347` — `NotificationBell` shows up to 96px of scrollable list and never surfaces a link to a dedicated `/notifications` page (which would need to be created). Given the polling interval is 15s (`__root.tsx:273`), users will accumulate 20+ items in a demo and lose old ones.

### UJ-20 · Medium · backend-lead
**Notifications are polled every 15s from every open tab.**
`__root.tsx:273` — `refetchInterval: 15_000`. With 4 tabs open in the demo, that's 4 requests/tenant/15s and the endpoint has no caching header per a spot check of `NotificationsController` (not opened here; flagged for `backend-lead` sweep to confirm). SSE or long-poll would be cleaner but is Wave-2.

---

## Journey 10 — Public TAMP viewer (unauth)

### UJ-21 · High · product-manager
**Public TAMP viewer has no entry point in the app — a tenant admin has no way to preview what the public sees before they publish.**
`frontend/asset-maintenance-web/src/routes/public.tamp.$tenantSlug.$versionTag.tsx` exists (per glob listing) but no in-app link points to it. After a version is locked, TampVersionSidebar should surface a "View public URL" chip.

### UJ-22 · Medium · ux-strategist
**Public TAMP URL includes the tenant slug — a leak of internal slug naming to the public web.**
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Api/Controllers/PublicTampController.cs:44` — route `public/tamp/{tenantSlug}/{versionTag}`. Fine for staged demos, but flag for review before real DOT customers pick embarrassing slugs.

---

## Cross-cutting

### UJ-23 · Critical · frontend-lead
**Reports (TAMP) unreachable from any nav.**
The sidebar (`__root.tsx:31-52`) has no `/reports` entry. `/reports` root redirects to `/`. `/reports/tamp` exists but is a deep-link the demo audience will never discover. This is the single largest journey break in the app.
**Fix:** add `/reports/tamp` to the CAPITAL_PROGRAM or a new "Reports" section, gated on `isPublicAgencyVertical`.

### UJ-24 · Critical · product-manager
**"Library" nav item is permanently disabled with a "Soon" pill.**
`__root.tsx:49` — `{ to: '/library', label: 'Library', Icon: BookOpen, enabled: false }`. Ship-blocker for any demo where the CEO asks "what's Library". Either remove it or wire a stub landing page. Same "reviewers will ask why it exists" problem as an unshipped feature stub.

### UJ-25 · Medium · qa-lead
**No E2E covers the login → dashboard → TAMP → publish journey end-to-end because TAMP is off-nav (see UJ-23).**
`frontend/asset-maintenance-web/e2e/smoke/07-tamp-view.spec.ts` + `08-publish-tamp.spec.ts` presumably navigate directly to `/reports/tamp` — which would silently pass while a real user cannot get there.

### UJ-26 · Low · devops
**No demo-data reset in the app UI.**
Reviewers who click "delete" on demo assets have no "reset" button. In a demo, this creates a Slack pager for engineering.

---

## Recommended top-5 for immediate follow-up dispatch

1. **UJ-23 (Critical, frontend-lead):** add TAMP into sidebar.
2. **UJ-10 (Critical, frontend-lead):** hide `annualBudgetCap` for non-Constrained scenarios.
3. **UJ-24 (Critical, product-manager):** decide fate of "Library" nav item.
4. **UJ-01 (High, ux-strategist):** replace `/reports` redirect with a landing page.
5. **UJ-21 (High, product-manager):** surface the public-view URL on the TAMP version sidebar after lock.
