# UX + design-system audit — 2026-07-23

**Auditor role:** ux-strategist
**Scope:** design-system fidelity, empty/loading/error states, invisible-until-data affordances, dead controls, tooltip absences on non-obvious actions, mobile responsiveness at 375px breakpoint (source read only), accessibility misses.
**Exclusions:** TAMP data purity, tenant isolation, CapitalNeeds detail (W4.1–W4.3 in flight).
**Severity ladder:** Critical / High / Medium / Low.

Findings numbered `UX-##`.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 5 |
| Medium | 8 |
| Low | 5 |

---

## Design-system violations

### UX-01 · High · frontend-lead
**Native `<select>` used where the app otherwise standardises on `RCDropDownList` (Syncfusion).**
`frontend/asset-maintenance-web/src/routes/reports.tamp.tsx:663-682` — plain `<select>` for horizon + scenario picker. `frontend/asset-maintenance-web/src/routes/users.tsx:294-296` uses a native multi-select for role assignment. Result: two visual dialects on the same screen (native OS dropdown vs Aurigo-branded Syncfusion). Standardise via `RCDropDownList` from `@/components/aurigo`.

### UX-02 · Medium · frontend-lead
**`window.confirm()` used for a destructive action.**
`frontend/asset-maintenance-web/src/routes/users.tsx:177` — native browser confirm for "Delete user". Everywhere else the app uses the `Overlay` primitive. Inconsistent + not brand-styled.

### UX-03 · Medium · ux-strategist
**Two independent markdown renderers with divergent output styling.**
`frontend/asset-maintenance-web/src/features/reports/renderMarkdown.ts:21-89` (block-based, Tailwind classes on emitted HTML) vs `frontend/asset-maintenance-web/src/features/reports/ConsistencyLetterModal.tsx:17-43` (line-based, different `class=` attributes, different heading margins) vs `frontend/asset-maintenance-web/src/features/ai/MarkdownMessage.tsx` (React-node based, CSS-file-driven). Three code paths, three visual results for the same input. Consolidate into one renderer.

### UX-04 · Low · ux-strategist
**Toast styling inconsistent — the app uses `useRCToast` from `RCToastMessage` but some flows use inline banners.**
`ConsistencyLetterModal.tsx:106` uses an inline red banner instead of a toast.

---

## Empty / loading / error states

### UX-05 · Critical · frontend-lead
**Dashboard "Assets under management" KPI shows `0` instead of an empty state when the tenant is truly empty.**
`frontend/asset-maintenance-web/src/routes/index.tsx:174` — `KpiCard label="Assets under management" value={data?.assetCount ?? 0}` — a fresh tenant reads "0 assets under management" as if it's a portfolio outcome, not an unseeded state. This is a first-impression bug for a demo tenant that just got provisioned.

### UX-06 · High · frontend-lead
**Financial Plan "cumulative gap" shows `$0.0M` for a tenant with no scenario runs — indistinguishable from "budget covers all needs".**
`frontend/asset-maintenance-web/src/routes/index.tsx:519-522, 531-535` — `gapData = []` collapses to totals of 0. The card copy `Cumulative Gap: $0.0M` reads as a positive outcome; it's actually "nothing to compute". Empty-state banner exists at 566, 587 but only inside the charts, not on the KPI cards. Add a "no data — run an LCP scenario" tone to the KPI row when `gapData.length === 0`.

### UX-07 · High · frontend-lead
**Loader for the dashboard is `"—"` in the KPI value slot — no indication anything is happening.**
`frontend/asset-maintenance-web/src/routes/index.tsx:476` — `{loading ? <span className="text-muted-foreground/60">—</span> : value}`. Users watching a slow first-load see 4 em-dashes and assume the endpoint is broken.

### UX-08 · Medium · frontend-lead
**Notifications empty state is generic — no CTA.**
`frontend/asset-maintenance-web/src/routes/__root.tsx:322-324` — `"You're all caught up."` No link to `/inspections` or `/capital-needs` for expected followups. Fine for the bell, but the app has no dedicated `/notifications` page (see UJ-19).

### UX-09 · Medium · frontend-lead
**TAMP report "Failed to load report" error text does not mention which section failed.**
`frontend/asset-maintenance-web/src/routes/reports.tamp.tsx:697` — `"Failed to load report. Check API connection and try again."` swallows the actual error. `mutation.error?.message` or `error?.response?.data?.detail` should be shown so the user can screenshot it for support.

---

## Invisible-until-data affordances

### UX-10 · Critical · frontend-lead
**Reports nav item does not exist.** See `user-journeys.md#UJ-23` — critical for full-app visibility. Owned by ux-strategist for the placement decision + frontend-lead for the code change.

### UX-11 · High · ux-strategist
**Public TAMP URL is not surfaced after a version is locked.**
`frontend/asset-maintenance-web/src/features/reports/TampVersionSidebar.tsx` — no "copy public URL" chip. The user has to construct the URL manually from `public/tamp/{tenantSlug}/{versionTag}`. Every locked version should render a copy-to-clipboard chip.

### UX-12 · High · frontend-lead
**Consistency-letter button only renders on the TAMP report page — but the report page itself is un-navigable.**
Chained failure: even after fixing UX-10, `ConsistencyLetterModal` is triggered by a single button on `reports.tamp.tsx` that hides behind conditional data. Add a shortcut on the dashboard for public-agency tenants.

### UX-13 · Medium · ux-strategist
**"Push to Plan" button changes label without changing shape.**
`frontend/asset-maintenance-web/src/features/capital-program/PushToPlanButton.tsx` (per file listing) — combined with `PushStatusChip.tsx`, the pushed-state is expressed only via a small chip alongside the same button. Consider a segmented control ("Push / Pushed / Failed") for the demo audience.

---

## Dead affordances

### UX-14 · Critical · product-manager
**"Library" sidebar item is permanently disabled and permanent visible.**
`frontend/asset-maintenance-web/src/routes/__root.tsx:49` — `{ to: '/library', label: 'Library', enabled: false }`. Renders with a "Soon" pill on every page load. Ship-blocker for demos. Either remove or wire a Wave-2 stub landing page.

### UX-15 · Medium · frontend-lead
**"Cloud sync" top-bar icon does nothing.**
`frontend/asset-maintenance-web/src/routes/__root.tsx:151` — `<IconButton label="Cloud sync"><Cloud size={18} /></IconButton>`. No `onClick`. Aria-labelled "Cloud sync" — screen readers will read it as an actionable button. Either remove or add an actual sync/status popover.

### UX-16 · Medium · frontend-lead
**`unread > 9 ? '9+' : unread` badge is fine for the notification bell but exposes no way to "clear all" without opening the popover.**
`__root.tsx:302-306`. Users who see a 9+ count and want to bulk-dismiss must open the popover first. Add a right-click / long-press option.

### UX-17 · Low · frontend-lead
**GIS Explorer "hazard overlay" toggle uses a checkbox not styled like the Aurigo `RCSwitch`.**
Confirmed via `LayerPanel.tsx` (per file listing) — worth a quick unify pass.

---

## Tooltip absences on non-obvious actions

### UX-18 · High · ux-strategist
**Scenario `Prioritization Method` dropdown has no tooltip explaining what each method does.**
`frontend/asset-maintenance-web/src/routes/lcp/scenarios.index.tsx:39-43` — the `desc` field exists in the source array but is not rendered as a tooltip on the dropdown option; it may show only after selection in `selectedPriority.desc`. Suggested: `title={o.desc}` per `<option>` OR a permanent helper-text line under the field.

### UX-19 · Medium · ux-strategist
**"Discount rate" text input has no tooltip citing OMB Circular A-94 vs FHWA convention.**
`scenarios.index.tsx:100+` (input field) — this is the single most-audited number in a TAMP. See also UJ-11 for the missing model-settings integration.

### UX-20 · Low · ux-strategist
**Sidebar collapse button has no tooltip.**
`__root.tsx:405-412` — button has `aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}` but no `title=`. Non-screen-reader users may not discover it.

---

## Accessibility

### UX-21 · High · qa-lead
**No visible focus ring on `Sidebar` links.**
`__root.tsx:469-495` — `SidebarItem` uses `text-white/75 hover:...` but no `focus-visible:` classes. Keyboard users cannot tell which nav item is focused. Fails WCAG 2.4.7.

### UX-22 · Medium · qa-lead
**`dangerouslySetInnerHTML` used for narrative previews without a runtime sanitiser.**
`frontend/asset-maintenance-web/src/features/reports/TampNarrativeTab.tsx:185`, `reports.tamp.tsx:1367`, `ConsistencyLetterModal.tsx:123`. The renderers escape input at write time (see `renderMarkdown.ts:25`), so it's currently safe — but a future contributor swapping in a heavier markdown library will assume the sink is safe. Add a `DOMPurify` pass OR document the escape guarantee inline.

### UX-23 · Medium · qa-lead
**Modal focus trap is DIY.**
`users.tsx:731-759` — `Overlay` uses `role="dialog"` and `aria-modal="true"` but does not trap tab focus. Users tabbing past the last field will jump to the underlying page. Compare against `@radix-ui/react-dialog` which the codebase pulls in transitively via shadcn.

---

## Mobile responsiveness (source-read only, breakpoint 375px)

### UX-24 · Medium · ux-strategist
**Sidebar has no drawer / hamburger for <768px viewports.**
`__root.tsx:389-395` — `aside` renders `w-14` collapsed or `w-56` expanded; both take horizontal viewport space at 375px. On a phone the app becomes unusable — main content shrinks to ~200px wide. Ship a hamburger overlay for `md:` and below.

### UX-25 · Medium · ux-strategist
**Dashboard KPI grid `md:grid-cols-2 lg:grid-cols-4` collapses to 1 column below md, which is fine — but the heatmap is fixed `height: '360px'`.**
`routes/index.tsx:249` — on a 375px phone the heatmap will still be 360px tall, occupying most of the fold with no interaction affordance (Syncfusion heatmap not touch-optimised).

### UX-26 · Low · ux-strategist
**Table components (`Users`, `Capital Needs`) have no horizontal scroll cue.**
`users.tsx:137` etc. — `<table className="w-full">` in a narrow container becomes a horizontal-scroll trap with no scrollbar hint.

---

## Recommended top-5 UX fixes

1. **UX-14 (Critical, product-manager):** kill or ship the "Library" nav.
2. **UX-05 (Critical, frontend-lead):** empty-state the dashboard KPIs.
3. **UX-10 (Critical, frontend-lead):** add TAMP into the sidebar.
4. **UX-01 (High, frontend-lead):** unify all pickers on `RCDropDownList`.
5. **UX-11 (High, ux-strategist):** surface the public TAMP URL after a lock.
