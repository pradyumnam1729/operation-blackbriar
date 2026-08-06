# Test-coverage gap analysis — 2026-07-23

**Auditor role:** qa-lead
**Scope:** cross-check `product-manager`'s 10 critical journeys against the Playwright `@smoke` suite (`frontend/asset-maintenance-web/e2e/smoke/*.spec.ts`) + `backend-lead`'s handler sweep against the xUnit integration test suite.
**Exclusions:** TAMP data purity (§18), tenant isolation (§17).

Findings numbered `TC-##`.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 5 |
| Medium | 6 |
| Low | 3 |

---

## Journey-vs-smoke-test matrix

Legend:  **✅** = smoke exists and would catch a regression · **⚠️** = smoke exists but too shallow · **❌** = no smoke.

| # | Journey | Smoke file | Coverage |
|---|---|---|---|
| 1 | Login → dashboard | `01-login.spec.ts` | ✅ |
| 2 | Assets list → detail | `02-assets-list.spec.ts`, `03-asset-detail.spec.ts` | ⚠️ (no assertion on empty-state) |
| 3 | New inspection → submit | `04-new-inspection.spec.ts` | ⚠️ (Syncfusion controls bypassed — form validation not tested) |
| 4 | Capital Needs list → new → confirm | `05-new-capital-need.spec.ts` | ⚠️ (creates via API, not UI — dialog form logic uncovered) |
| 5 | Job Orders list → new → assign → handoff | `06-push-to-plan.spec.ts` (adjacent) | ⚠️ (push flow only; assign/handoff untested) |
| 6 | LCP scenarios → new → run → view → adopt | none | ❌ **Critical** |
| 7 | GIS Explorer → toggles → asset click | none | ❌ |
| 8 | Configuration → domain profile | `09-configuration.spec.ts` | ✅ (partial — tab strip + one tab) |
| 9 | Users & roles → invite → assign → deactivate | none | ❌ |
| 10 | Notifications | none | ❌ |
| — | Public TAMP viewer | `07-tamp-view.spec.ts`, `08-publish-tamp.spec.ts` | ✅ but see TC-01 |

---

## Critical gaps

### TC-01 · Critical · qa-lead
**The 4 orphan TAMP narrative tabs (Progress-to-Targets, Strategy-Process, Resilience, RiskManagement) have NO test asserting that saved content appears in the final report.**
Cross-referenced in `backend-code-sweep.md#BE-02` and `frontend-code-sweep.md#FE-01`. A test that (a) authors a narrative for each section, (b) locks a TAMP version, (c) fetches the public TAMP JSON, and (d) asserts the narrative text is present would have caught this bug the day it shipped. Write it.

### TC-02 · Critical · qa-lead
**No smoke covers the LCP scenario end-to-end (create → wait for `Complete` status → adopt).**
`LcpScenarioWorker` (background) runs async; the smoke suite has zero coverage. Regressions in the worker (channel completion, MediatR handler wiring, condition trajectory calculator) all ship silently to Prod-like environments. Write a test: POST scenario → poll `/api/v1/lcp/scenarios/{id}` until Status=Complete or 30s timeout → GET `/api/v1/lcp/scenarios/{id}/summary` → assert `costByYear.length > 0`.

### TC-03 · Critical · qa-lead
**No smoke covers the "Financial Plan" dashboard tab.**
`routes/index.tsx:518-605` — the very tab where the null-`lcpSummaryForGap` bug (BE-01) surfaces if the user navigated there. A single assertion `expect(page.getByText(/\$0\.0M/i).count()).toBeLessThanOrEqual(1)` (after seeding a scenario) would have flagged BE-01 immediately.

---

## High gaps

### TC-04 · High · qa-lead
**Users & Roles has no test coverage.**
Invite → assign role → deactivate is the single most sensitive tenant-onboarding flow. Backend handlers in `UserManagementHandlers.cs` have integration tests (per repo convention) but the UI journey — including the `users.tsx:177` `window.confirm` for delete — is untested.

### TC-05 · High · qa-lead
**"Capital Needs create dialog" test bypasses the dialog entirely.**
`e2e/smoke/05-new-capital-need.spec.ts:36-40` — the test explicitly documents that it closes the modal and posts via API instead. **The dialog's form logic (RCDropDownList driving, validation errors, dedup 409 handling) has zero coverage.** The Syncfusion driver-brittleness comment is fair, but a scoped test using `data-testid` selectors would be feasible.

### TC-06 · High · qa-lead
**Push-to-Build handoff (`HandoffErrorDrawer`) has no error-path smoke.**
The happy path (`06-push-to-plan.spec.ts`) is presumably covered. But the sad path — 5xx from the stubbed Build endpoint — has no test. Given the drawer will surface frequently in dev (stub returns 501 by default in most configurations), a test would be useful.

### TC-07 · High · qa-lead
**Public TAMP viewer authorization boundary has no test.**
`08-publish-tamp.spec.ts` and `07-tamp-view.spec.ts` presumably test the happy path. Missing: **negative** tests that (a) a Draft version returns 404, (b) an inactive tenant returns 404, (c) rate limiting kicks in after N requests. Given `PublicTampController.cs` deliberately bypasses tenant filter, these are the tests that guard against the leaked-draft nightmare scenario.

### TC-08 · High · qa-lead
**No unit tests cover `renderMarkdown.ts` — the three markdown renderers each need XSS-injection tests.**
`features/reports/renderMarkdown.ts`, `features/reports/ConsistencyLetterModal.tsx` (inlined renderer), `features/ai/MarkdownMessage.tsx`. Given `dangerouslySetInnerHTML` is the sink, one test per renderer with input `<script>alert('xss')</script>` + `[click me](javascript:alert(1))` asserts the escape guarantee.

---

## Medium gaps

### TC-09 · Medium · qa-lead
**Dashboard "byGrade" / "byRulBand" empty-state paths have no test.**
`routes/index.tsx:484-513` — the `EmptyState` branch fires when `series.length === 0`. No test forces this state.

### TC-10 · Medium · qa-lead
**GIS Explorer domain-center fallback (`GisExplorer.tsx:82-83`) has no test.**
Adding a new domain that isn't in `DOMAIN_CENTERS` silently falls back to Texas. A test asserting the fallback firing (via a `console.warn` spy after DP-13 fix) would surface future config drift.

### TC-11 · Medium · qa-lead
**No integration test verifies `BuildFinancial` produces non-zero `TotalNeed` when a real `LcpScenarioSummary` is passed in.**
Fixing BE-01 without a test lets it regress next sprint. Test path: `Aurigo.AssetMaintenance.UnitTests/Reports/BuildFinancialTests.cs` — pass a hand-crafted `LcpScenarioSummary` with a 5-year CostByYearJson → assert `GapByYear.TotalNeed > 0` for those years.

### TC-12 · Medium · qa-lead
**Background service liveness has no test.**
`LcpScenarioWorker` etc. — no integration test asserts the worker consumes a queued scenario within N seconds and marks it Complete. Pair with the BE-07 heartbeat health-check work.

### TC-13 · Medium · qa-lead
**Tenant slug in public URLs isn't tested for URL-injection.**
`PublicTampController.cs:44` — `{tenantSlug}` and `{versionTag}` go directly into an EF filter. EF parameterises, so it's safe from SQL injection, but a test with `slug="../../etc/passwd"` (route not matched → 404) plus `slug=" "` (empty match) validates the parameter handling.

### TC-14 · Medium · qa-lead
**Vite worktree drift (FE-14) has no CI guard.**
CI could `diff frontend/asset-maintenance-web/vite.config.ts` against a canonical `vite.config.masterworks.ts` and fail if a port/proxy line diverges without a corresponding ADR update.

---

## Low gaps

### TC-15 · Low · qa-lead
**Notification bell polling interval (15 s) has no e2e assertion.**
Low value; a Vitest for `relativeTime()` at `__root.tsx:249-263` is more useful.

### TC-16 · Low · qa-lead
**Domain profile "reset to default" (DP-13 fix) needs a test when it lands.**

### TC-17 · Low · qa-lead
**`WorkflowCanvasTab` + `TriggerRulesTab` in AI Intelligence use `apiFetch` and have unit tests only via `useIntegrations.test.tsx`. E2E coverage is thin but the surface is Wave-2.**

---

## Top-10 tests worth writing next (priority order)

| # | Test | Owner | File | Rationale |
|---|---|---|---|---|
| 1 | Author + lock + public-view assertion for all 5 § 515.9 narrative sections | qa-lead + backend-lead | new `e2e/smoke/11-tamp-narratives.spec.ts` | Catches FE-01 / BE-02 |
| 2 | End-to-end LCP scenario run (create → poll → assert costByYear non-empty) | qa-lead + backend-lead | new `e2e/smoke/12-lcp-scenario-run.spec.ts` | Catches BE-01 / TC-02 |
| 3 | Financial Plan dashboard tab renders non-zero gap when a scenario exists | qa-lead | new `e2e/smoke/13-financial-plan.spec.ts` | Regression guard for BE-01 |
| 4 | `BuildFinancialTests.cs` — non-null `lcpSummaryForGap` → non-zero `TotalNeed` | backend-lead | new xUnit test | Unit-level guard for BE-01 |
| 5 | XSS-injection tests for all 3 markdown renderers | frontend-lead | `features/reports/__tests__/renderMarkdown.test.ts` (+ 2 sibling tests) | Escape-guarantee proof |
| 6 | Public TAMP viewer negative-path tests (Draft 404, inactive-tenant 404, rate-limit) | qa-lead | augment `e2e/smoke/07-tamp-view.spec.ts` | Guards TC-07 |
| 7 | Users tab: invite + assign role + deactivate journey | qa-lead | new `e2e/smoke/14-user-mgmt.spec.ts` | Covers TC-04 |
| 8 | Capital-needs dialog form logic (Syncfusion `data-testid` selectors) | frontend-lead + qa-lead | rewrite `05-new-capital-need.spec.ts` | Covers TC-05 |
| 9 | Background-worker heartbeat health check | devops + qa-lead | `Api/HealthChecks/WorkerHeartbeatCheckTests.cs` | Pairs with BE-07 fix |
| 10 | CI diff between primus + masterworks `vite.config.ts` | devops | `.github/workflows/vite-drift-guard.yml` | Prevents the wrong-worktree config-copy bug class |

---

## Meta observation

The 10 existing smoke tests are all shallow happy-path renders. Zero of them cover a mutation → invalidate → visible-effect cycle end-to-end. This is why "tabs that save to nowhere" (FE-01) was invisible to CI. **Pattern-level recommendation:** every mutation-touching test must have (a) pre-mutation query, (b) mutation, (c) post-mutation query that MUST return a value derived from the mutation. Only then is the round-trip guaranteed.
