# Product-quality audit bundle — 2026-07-23

**Convener:** engineering-director
**Sub-agent auditors (6 in parallel):** product-manager, ux-strategist, lifecycle-domain-expert, backend-lead, frontend-lead, qa-lead
**Repo state:** `primusmaintain-v2` branch. Source-code walk only; no processes killed, no code modified.
**Explicit exclusions:** TAMP data purity (`../18-tamp-data-purity-audit.md`), tenant isolation (`../17-tenant-isolation-audit.md`), Capital Needs deep-dive (W4.1–W4.3 in flight).

---

## Executive summary

- **86 findings** across 6 audits (Critical 12, High 26, Medium 34, Low 14).
- **Ten blockers** are the single-most-important fix list — see next section.
- The dominant failure mode is **"succeeds silently"**: mutations that persist to DB but never render back (FE-01/BE-02), UI form fields dropped from payloads (FE-07, UJ-10), background workers dying without heartbeat (BE-07), and orphan routes/nav entries (FE-10, FE-11).
- **The single most surprising finding:** the entire TAMP report page is unreachable from any in-app navigation (`FE-10 / UJ-23`). It's a deep-link only.

---

## Top-10 blockers (single-line, owner-tagged)

| # | ID | Severity | Owner | One-line |
|---|---|---|---|---|
| 1 | BE-01 / DP-10 | Critical | backend-lead | `lcpSummaryForGap: null` passed unconditionally at `TampReportHandlers.cs:629` → TAMP Financial section reports $0 need every year. |
| 2 | FE-01 / BE-02 | Critical | frontend-lead + backend-lead | 5 TAMP narrative tabs (Strategy-Process, Resilience, Progress-to-Targets, Risk-Management, Asset-Valuation) save successfully but their content NEVER renders in the report. |
| 3 | FE-10 / UJ-23 | Critical | frontend-lead | `/reports/tamp` has no sidebar entry — TAMP page is undiscoverable via navigation. |
| 4 | UX-14 / UJ-24 | Critical | product-manager | "Library" nav item permanently disabled with "Soon" pill — demo blocker. |
| 5 | UJ-10 | Critical | frontend-lead | LCP scenario "Do Nothing" type still shows an editable `annualBudgetCap` field that is silently dropped from the payload. |
| 6 | UX-05 | Critical | frontend-lead | Dashboard KPIs show `0` for empty tenants — indistinguishable from real zero portfolio outcome. |
| 7 | DP-15 | Critical | backend-lead | Seeded "Investment Strategy" narrative renders on the public TAMP as if tenant-authored. |
| 8 | TC-01 | Critical | qa-lead | No test asserts saved narrative content appears in the final report — the exact failure that let FE-01 ship. |
| 9 | TC-02 | Critical | qa-lead | No end-to-end LCP scenario test (create → run → assert non-empty output). |
| 10 | TC-03 | Critical | qa-lead | No smoke covers Financial Plan dashboard tab — would have caught BE-01 on merge. |

---

## Categorized punchlist

### Bugs (17)

Silent failures, wrong data, crashes, unhandled null paths.

| ID | Sev | Owner | Effort | Src audit | One-line |
|---|---|---|---|---|---|
| BE-01 | Critical | backend-lead | M (1d) | backend-code-sweep | Wire `lcpSummaryForGap` from the current LCP scenario. |
| FE-01 / BE-02 | Critical | frontend-lead+backend-lead | M (1d) | frontend/backend | Populate 5 orphan narrative sections in TAMP payload. |
| UJ-10 | Critical | frontend-lead | S (2h) | user-journeys | Hide `annualBudgetCap` for non-Constrained scenarios. |
| BE-04 | High | backend-lead | M (1d) | backend-code-sweep | Enforce narrative-per-version isolation on lock. |
| BE-05 | Medium | backend-lead | S (4h) | backend-code-sweep | Wire `CapitalNeedPlanStatus.Delivered` transition or drop the enum member. |
| BE-06 | Medium | backend-lead | S (2h) | backend-code-sweep | Drop unused `ConflictingStatus` / `ConflictingCost` from DTO. |
| BE-08 | Medium | devops | S (30m) | backend-code-sweep | Rationalise dual registration of `AurigoPlanStatusPollingWorker`. |
| FE-07 | High | frontend-lead | S (2h) | frontend-code-sweep | Disable region-filter input when preset assets pre-selected. |
| FE-08 | Medium | frontend-lead | S (30m) | frontend-code-sweep | Add `min` / `max` / `step` to discount-rate `<input>`. |
| UJ-04 | Medium | ux-strategist | S (2h) | user-journeys | Add breadcrumb / back-link between Asset → Inspect. |
| UJ-17 / UX-02 | Medium | frontend-lead | S (2h) | user-journeys/ux | Replace `window.confirm` in users.tsx with Overlay-based confirm. |
| UX-04 | Low | ux-strategist | S (1h) | ux-audit | Migrate ConsistencyLetterModal inline banners to `useRCToast`. |
| UX-15 | Medium | frontend-lead | S (30m) | ux-audit | Remove or wire the dead "Cloud sync" top-bar icon. |
| UJ-16 | Medium | frontend-lead | S (2h) | user-journeys | Add short-circuit Restricted panel on `/integrations` for non-admins. |
| DP-01 | Medium | frontend-lead | S (2h) | domain-data-purity | Add "missing grades = 0 inspections, not 0 assets" footnote on grade donut. |
| DP-07 | Medium | lifecycle-domain-expert | M (1d) | domain-data-purity | Per-year inflation lookup (or explain single-row behavior in UX). |
| DP-11 | Low | lifecycle-domain-expert | S (2h) | domain-data-purity | Add deterioration-model attribution footer to Do-Nothing output. |

### Data Purity (16)

Fabricated / placeholder data rendered as real.

| ID | Sev | Owner | Effort | One-line |
|---|---|---|---|---|
| DP-15 | Critical | backend-lead | M (1d) | Label or gate the seeded Investment Strategy narrative pre-lock. |
| DP-10 (=BE-01) | High | backend-lead | see BE-01 | see BE-01 |
| DP-06 | High | lifecycle-domain-expert | M (1d) | Add unit-cost source citation + as-of-date trailer to ARV output. |
| DP-08 | High | product-manager | L (3d) | Ship a user-editable Risk Register CRUD screen. |
| DP-13 | High | lifecycle-domain-expert | M (1d) | Add "reset to default" affordance on Domain Profile. |
| DP-03 | Medium | backend-lead | S (4h) | Move hard-coded 5×5 risk-band cutoffs into `RiskConfig`. |
| DP-04 | Medium | lifecycle-domain-expert | M (1d) | Class-specific deterioration curves (no more shared Pontis curves). |
| DP-09 | Medium | lifecycle-domain-expert | S (2h) | Prefix Risk Register categories with taxonomy source. |
| DP-12 | Medium | backend-lead | S (4h) | Compute + render % of budget spent on JobOrderCostsTab. |
| DP-16 | Medium | backend-lead | S (2h) | Migrate `Demo:Domain` off appsettings.json into `Tenant.DemoDomain`. |
| DP-02 | Low | lifecycle-domain-expert | S (2h) | Normalise `Region` free-text on inventory import. |
| DP-05 | Low | frontend-lead | S (2h) | Make "Approaching EoL" threshold tenant-configurable. |
| DP-14 | Low | frontend-lead | S (2h) | Render `lastEditedAt` / `lastEditedBy` on Domain Profile. |
| BE-03 | Medium | backend-lead | S (2h) | Seed at least one Federal_HSIP funding source for demo tenants. |

### UX (24)

Design-system violations, missing states, dead affordances, a11y.

| ID | Sev | Owner | Effort | One-line |
|---|---|---|---|---|
| UX-14 (=UJ-24) | Critical | product-manager | S (30m) | Kill or ship "Library" nav. |
| UX-05 | Critical | frontend-lead | S (4h) | Empty-state the dashboard KPIs for new tenants. |
| UX-10 (=FE-10) | Critical | frontend-lead | S (2h) | Add TAMP into sidebar nav. |
| UX-01 | High | frontend-lead | M (1d) | Unify all pickers on `RCDropDownList`. |
| UX-11 (=FE-11) | High | ux-strategist+frontend-lead | S (4h) | Surface public TAMP URL after lock. |
| UX-06 | High | frontend-lead | S (2h) | Financial-Plan KPI cards need "no data" state matching charts. |
| UX-07 | High | frontend-lead | S (2h) | Replace em-dash KPI loader with a real skeleton. |
| UX-18 | High | ux-strategist | S (1h) | Add option-level tooltips on Prioritization Method dropdown. |
| UX-21 | High | qa-lead | S (2h) | Add visible focus rings on sidebar links (WCAG 2.4.7). |
| UJ-01 | High | ux-strategist | S (2h) | Replace `/reports` redirect with a landing page. |
| UJ-08 | High | frontend-lead | S (4h) | Improve Push-to-Build error drawer (server reason + retry). |
| UJ-21 | High | product-manager | S (2h) | Add "View public URL" chip on locked TAMP versions. |
| UJ-11 | High | lifecycle-domain-expert | S (2h) | Load `modelSettings.discountRate` as scenario default. |
| UX-03 | Medium | ux-strategist | M (1d) | Consolidate 3 markdown renderers into one. |
| UX-08 | Medium | frontend-lead | S (2h) | Add CTA to empty-notifications state. |
| UX-09 | Medium | frontend-lead | S (2h) | TAMP report error banner should surface actual server message. |
| UX-12 | High | frontend-lead | S (4h) | Add dashboard shortcut to Consistency Letter for public-agency tenants. |
| UX-13 | Medium | ux-strategist | S (4h) | Segmented control for Push-to-Plan state. |
| UX-16 | Medium | frontend-lead | S (2h) | Bell popover needs bulk-dismiss without opening popover. |
| UX-19 | Medium | ux-strategist | S (1h) | Discount-rate tooltip citing OMB A-94 / FHWA convention. |
| UX-22 | Medium | qa-lead | S (2h) | DOMPurify pass or documented escape guarantee on markdown sinks. |
| UX-23 | Medium | qa-lead | S (4h) | Add focus trap to `Overlay` modal (use radix `Dialog`). |
| UX-24 | Medium | ux-strategist | M (1d) | Add hamburger drawer for <768px viewports. |
| UX-25 | Medium | ux-strategist | S (2h) | Make heatmap responsive on mobile. |

### Missing Features (14)

Half-shipped surfaces, unwired configs, absent UX affordances.

| ID | Sev | Owner | Effort | One-line |
|---|---|---|---|---|
| BE-07 | High | devops | L (3d) | Add heartbeat health check to all 7 BackgroundServices. |
| BE-09 | High | backend-lead | M (1d) | Split `ReportsController` into `Reports` + `TampVersions`. |
| BE-10 | Medium | backend-lead | S (2h) | Document AuthController route deviation in an ADR. |
| BE-11 | Medium | backend-lead | S (2h) | Document PublicTampController route deviation in an ADR. |
| FE-11 | High | frontend-lead | S (4h) | Surface public TAMP URL chip after lock. |
| FE-14 | High | frontend-lead | M (1d) | Gitignore per-worktree `vite.config.ts` OR move ports to env vars. |
| FE-15 | Medium | frontend-lead | S (2h) | Auto-retry 5xx once with backoff. |
| FE-17 | Low | frontend-lead | S (2h) | Add `beforeLoad` route guards on `/users` and `/integrations`. |
| FE-18 | Medium | frontend-lead | S (30m) | Move notification poll interval to env / settings. |
| UJ-14 | Low | ux-strategist | S (30m) | Default GIS hazard overlay on for PublicAgency. |
| UJ-22 | Medium | ux-strategist | S (1h) | Slug-review guard rail before locking a public TAMP version. |
| UJ-25 | Medium | qa-lead | see TC-01 | Cross-refs TC-01 |
| UJ-15 | High | ux-strategist | S (4h) | Add "switching domain profile re-runs seed. Confirm?" banner. |
| FE-13 | Medium | frontend-lead | S (30m) | Remove dead `/setup` route or add nav entry. |

### Test Gaps (15)

Regression risk per finding: no test would catch a re-break.

| ID | Sev | Owner | Effort | One-line |
|---|---|---|---|---|
| TC-01 | Critical | qa-lead | M (1d) | Assert saved narratives appear in the final TAMP payload. |
| TC-02 | Critical | qa-lead | M (1d) | End-to-end LCP scenario run test. |
| TC-03 | Critical | qa-lead | S (4h) | Financial Plan tab non-zero-gap assertion after scenario run. |
| TC-04 | High | qa-lead | M (1d) | Users & Roles invite-role-deactivate journey test. |
| TC-05 | High | frontend-lead+qa-lead | M (1d) | Capital-needs dialog form logic (via data-testids). |
| TC-06 | High | qa-lead | S (4h) | Push-to-Build sad-path test. |
| TC-07 | High | qa-lead | S (4h) | Public TAMP viewer negative-path tests (Draft 404, rate limit). |
| TC-08 | High | frontend-lead | S (4h) | XSS-injection tests for 3 markdown renderers. |
| TC-09 | Medium | qa-lead | S (2h) | Dashboard empty-state coverage. |
| TC-10 | Medium | qa-lead | S (2h) | GIS Explorer domain-center fallback assertion. |
| TC-11 | Medium | backend-lead | S (2h) | `BuildFinancialTests.cs` non-null lcpSummary test. |
| TC-12 | Medium | qa-lead | M (1d) | Background service liveness integration test. |
| TC-13 | Medium | qa-lead | S (2h) | Public-URL slug parameter injection tests. |
| TC-14 | Medium | devops | S (4h) | CI guard: primus vs masterworks vite.config diff. |
| TC-15 | Low | qa-lead | S (1h) | Unit test for `relativeTime()` in `__root.tsx`. |

---

## Recommended dispatch order for follow-on work

**Wave A (this week — the "silent-failure" hotfix bundle):**

1. `backend-lead`: BE-01 (lcpSummaryForGap) + BE-02 (5 orphan narratives) — combined PR.
2. `frontend-lead`: FE-10 (TAMP in sidebar) + FE-11 (public TAMP URL) + UJ-10 (hide budget cap on Do-Nothing) — combined PR.
3. `qa-lead`: TC-01 + TC-02 + TC-03 + TC-11 — the four tests that would have caught this week's regressions.
4. `product-manager`: UX-14 (Library nav decision) — one-line.

**Wave B (next sprint):**

5. `frontend-lead`: FE-01 render side of the narrative fix (validate against BE-02).
6. `backend-lead`: BE-09 controller split, BE-04 narrative-version isolation, DP-15 seeded narrative labelling.
7. `devops`: BE-07 heartbeat health checks (all 7 workers) + TC-14 vite drift guard.
8. `ux-strategist`: UX-05 dashboard empty-states, UX-01 dropdown unification, UX-24 mobile drawer.

**Wave C (next quarter):**

9. `product-manager` + `lifecycle-domain-expert`: DP-08 (editable risk register), DP-06 (ARV source attribution), DP-13 (domain profile reset).
10. `frontend-lead`: FE-14 vite config gitignore/env-var refactor.

**Standing:** stand up the review-gate pattern per `review-gate-pattern.md` so the next audit is a diff, not a re-scan.

---

## Cross-references

| Detail file | Auditor | Findings |
|---|---|---|
| [`user-journeys.md`](user-journeys.md) | product-manager | UJ-01..UJ-26 |
| [`ux-audit.md`](ux-audit.md) | ux-strategist | UX-01..UX-26 |
| [`domain-data-purity.md`](domain-data-purity.md) | lifecycle-domain-expert | DP-01..DP-16 |
| [`backend-code-sweep.md`](backend-code-sweep.md) | backend-lead | BE-01..BE-14 |
| [`frontend-code-sweep.md`](frontend-code-sweep.md) | frontend-lead | FE-01..FE-18 |
| [`test-coverage-gaps.md`](test-coverage-gaps.md) | qa-lead | TC-01..TC-17 |
| [`review-gate-pattern.md`](review-gate-pattern.md) | engineering-director | standing-review proposal |

**Related in-scope audits (not re-covered here):**
- [`../17-tenant-isolation-audit.md`](../17-tenant-isolation-audit.md) — 4 known tenant-isolation bugs already tracked.
- [`../18-tamp-data-purity-audit.md`](../18-tamp-data-purity-audit.md) — TAMP-report data purity findings.
- [`../19-tamp-audit-bugs-pm-review.md`](../19-tamp-audit-bugs-pm-review.md) — PM disposition of TAMP data-purity bugs.
