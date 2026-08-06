# W9-ED — 62-finding execution roadmap + W5.4 governance escalations

**Author:** engineering-director
**Date:** 2026-07-23
**Precedent audits:** [`README.md`](README.md) (86-finding roll-up) · [`user-journeys.md`](user-journeys.md) · [`ux-audit.md`](ux-audit.md) · [`domain-data-purity.md`](domain-data-purity.md) · [`backend-code-sweep.md`](backend-code-sweep.md) · [`frontend-code-sweep.md`](frontend-code-sweep.md) · [`test-coverage-gaps.md`](test-coverage-gaps.md) · [`review-gate-pattern.md`](review-gate-pattern.md)
**W5.4 source:** [`../../vol-5-operating-model/incident-comms/2026-07-23-bug06-tamp-financial-recall.md`](../../vol-5-operating-model/incident-comms/2026-07-23-bug06-tamp-financial-recall.md) § 7

## Status entering W9

- **86 total findings** across 6 audits.
- **24 closed by W4-W8** — 12 Criticals from the top-10 blockers table (BE-01, BE-02/FE-01, FE-10/UX-10/UJ-23, UJ-24/UX-14, UJ-10, UX-05, DP-15, TC-01, TC-02, TC-03) plus 12 mostly-High items burned down by the capital-needs Wave-2/3 remediation and the ancillary fixes (public TAMP viewer, hazard overlay, Integrations gate, ConsistencyCheck DTO, LCP mutation onErrors, ARV Band string).
- **62 remain** — the tables below tier all 62.

Tiers per instruction:
- **MERGE** — <1 day, no architectural decision, no cross-team dep.
- **SPRINT** — ~1 week, small design doc, PM+architect+lead sign-off.
- **ROADMAP** — multi-sprint or needs staffing / policy / schema call.

---

## 1. Tier assignment — all 62 remaining findings

### 1a. Backend sweep (BE-##) — 8 remaining

| ID | Sev | Tier | Owner | Effort | Blocking dep | Note |
|---|---|---|---|---|---|---|
| BE-03 | Medium | MERGE | backend-lead | 2h | none | Seed one Federal_HSIP funding source in demo tenants. |
| BE-04 | High | SPRINT | backend-lead | 1d | needs schema call on `VersionTag` filter semantics | Enforce narrative-per-version isolation on lock. |
| BE-05 | Medium | MERGE | backend-lead | 4h | none | Wire `CapitalNeedPlanStatus.Delivered` transition OR drop the enum. Decide + land. |
| BE-06 | Medium | MERGE | backend-lead | 2h | none | Drop unused `ConflictingStatus` / `ConflictingCost` from DTO. |
| BE-07 | High | SPRINT | devops | 3d | pairs with TC-12 | Heartbeat health checks on all 7 BackgroundServices. |
| BE-08 | Medium | MERGE | devops | 30m | none | Rationalise dual registration of `AurigoPlanStatusPollingWorker`. |
| BE-09 | High | SPRINT | backend-lead | 1d | frontend `useTampVersions.ts` verified in same PR | Split `ReportsController` → `Reports` + `TampVersions`. |
| BE-10 | Medium | MERGE | backend-lead | 2h | none | ADR for `AuthController` `/auth` route deviation. |
| BE-11 | Medium | MERGE | backend-lead | 2h | none | ADR for `PublicTampController` `/public/tamp` route deviation (co-land with BE-10). |
| BE-12 | Low | MERGE | backend-lead | 4h | none | `CancellationToken` audit in `RulHandlers.cs` + `ArvAndRiskHandlers.cs`. |
| BE-13 | Low | MERGE | backend-lead | 2h | none | `/health` warning banner when a `SeedRunner.RunStep` failed. |
| BE-14 | Low | MERGE | backend-lead | 2h | none | Verify `ExceptionHandlingMiddleware` doesn't leak stack traces in Prod. |

### 1b. Frontend sweep (FE-##) — 12 remaining

| ID | Sev | Tier | Owner | Effort | Blocking dep | Note |
|---|---|---|---|---|---|---|
| FE-02 | Medium | MERGE | frontend-lead | 4h | none | Colocate Resilience narrative visually next to `data.risk.resilienceMetrics`. |
| FE-03 | Medium | MERGE | frontend-lead | 2h | none | Storybook fixture for `ExternalPushChipList` + `SyncHealthChip`. |
| FE-04 | Low | MERGE | frontend-lead | 2h | none | Cosmetic — surface `BasemapPicker` layer panel. |
| FE-05 | Medium | MERGE | frontend-lead | 1h | none | Invalidate `['tamp-versions']` on `runConsistencyCheck` success. |
| FE-06 | Medium | MERGE | frontend-lead | 2h | none | Replace `window.location.assign('/admin')` in `ImpersonationBanner.onExit`. |
| FE-07 | High | MERGE | frontend-lead | 2h | none | Disable region-filter input when preset assets pre-selected. |
| FE-08 | Medium | MERGE | frontend-lead | 30m | none | Add `min` / `max` / `step` to discount-rate `<input>`. |
| FE-09 | Low | MERGE | frontend-lead | 30m | none | `UserDialog` mandatory-field indicators. |
| FE-11 | High | MERGE | frontend-lead | 4h | none | Public TAMP URL copy-chip after lock (pair with UX-11). |
| FE-12 | Medium | MERGE | frontend-lead | 30m | UX-14 already closed | Remove `/library` sidebar entry file/route. |
| FE-13 | Medium | MERGE | frontend-lead | 30m | none | Remove dead `/setup` route or add nav entry. |
| FE-14 | High | SPRINT | frontend-lead + devops | 1d + CI | pairs with TC-14 | Gitignore per-worktree `vite.config.ts` OR move ports to env vars. |
| FE-15 | Medium | MERGE | frontend-lead | 2h | none | Auto-retry 5xx once with backoff in `apiFetch`. |
| FE-16 | Low | — | — | — | none | No-action; confirmed safe. Close as verified. |
| FE-17 | Low | MERGE | frontend-lead | 2h | none | `beforeLoad` route guards on `/users`, `/integrations`. |
| FE-18 | Medium | MERGE | frontend-lead | 30m | none | Notification poll interval to env var. |

### 1c. User-journeys (UJ-##) — 11 remaining (UJ-10, UJ-23, UJ-24 closed)

| ID | Sev | Tier | Owner | Effort | Blocking dep | Note |
|---|---|---|---|---|---|---|
| UJ-01 | High | MERGE | ux-strategist | 2h | none | `/reports` redirect → landing page. |
| UJ-02 | Medium | SPRINT | frontend-lead | 3d | needs PM decision on tenant-picker UX | Tenant/domain preview on login screen. |
| UJ-03 | Low | ROADMAP | frontend-lead | — | Wave-2 idle-timeout | Idle-timeout UX. |
| UJ-04 | Medium | MERGE | ux-strategist | 2h | none | Breadcrumb Assets → Inspect. |
| UJ-05 | Low | MERGE | qa-lead | 2h | none | Inspection post-submit summary screen. |
| UJ-06 | Medium | MERGE | ux-strategist | 2h | none | Zero-state guidance on "Bundled" / "Closed" tabs. |
| UJ-07 | Low | MERGE | product-manager | 1h | none | "N filtered out" label copy. |
| UJ-08 | High | MERGE | frontend-lead | 4h | none | Push-to-Build error drawer with reason + retry. |
| UJ-09 | Medium | MERGE | lifecycle-domain-expert | 2h | none | JobOrderStepper visual for cancelled terminal state. |
| UJ-11 | High | MERGE | lifecycle-domain-expert | 2h | none | Load `modelSettings.discountRate` as scenario default. |
| UJ-12 | Medium | MERGE | ux-strategist | 2h | none | Risk-First preflight warning when no inspections. |
| UJ-13 | Medium | SPRINT | frontend-lead | 1d | tenant-editable via `DomainProfile` | Domain-map-center from `DomainProfile`. |
| UJ-14 | Low | MERGE | ux-strategist | 30m | none | Default GIS hazard overlay on for PublicAgency. |
| UJ-15 | High | MERGE | ux-strategist | 4h | none | "Switching domain profile re-runs seed. Confirm?" banner. |
| UJ-16 | Medium | MERGE | frontend-lead | 2h | none | Restricted panel on `/integrations` (already done for `/users`). |
| UJ-17 | Medium | MERGE | product-manager | 2h | pairs with UX-02 | Replace `window.confirm` in `users.tsx` with `Overlay`. |
| UJ-18 | Medium | SPRINT | product-manager | 3d | needs UX design pass | Split password/set/reset/invite dialog into tabs. |
| UJ-19 | Low | ROADMAP | frontend-lead | — | needs `/notifications` route | "View all notifications" link. |
| UJ-20 | Medium | SPRINT | backend-lead | 4d | polling → SSE/long-poll | Notification transport upgrade. |
| UJ-21 | High | MERGE | product-manager | 2h | pairs with FE-11 | "View public URL" chip on locked versions. |
| UJ-22 | Medium | MERGE | ux-strategist | 1h | none | Slug review guardrail before locking. |
| UJ-25 | Medium | — | qa-lead | — | tracked via TC-01 | Cross-ref; close with TC-01. |
| UJ-26 | Low | ROADMAP | devops | — | needs seeder API + auth | Demo-data reset in UI. |

### 1d. UX + a11y (UX-##) — 14 remaining (UX-05, UX-10, UX-14 closed)

| ID | Sev | Tier | Owner | Effort | Blocking dep | Note |
|---|---|---|---|---|---|---|
| UX-01 | High | SPRINT | frontend-lead | 1d | design pass on `RCDropDownList` conventions | Unify all pickers on `RCDropDownList`. |
| UX-02 | Medium | MERGE | frontend-lead | 2h | pairs with UJ-17 | `window.confirm` → `Overlay`. |
| UX-03 | Medium | SPRINT | ux-strategist | 1d | consolidation ADR | 3 markdown renderers → 1. |
| UX-04 | Low | MERGE | ux-strategist | 1h | none | `ConsistencyLetterModal` inline banner → `useRCToast`. |
| UX-06 | High | MERGE | frontend-lead | 2h | none | Financial-Plan KPI "no data" state. |
| UX-07 | High | MERGE | frontend-lead | 2h | none | Real skeleton for dashboard KPI loader (not `—`). |
| UX-08 | Medium | MERGE | frontend-lead | 2h | none | CTA on empty-notifications. |
| UX-09 | Medium | MERGE | frontend-lead | 2h | none | Surface actual server message on TAMP report error. |
| UX-11 | High | MERGE | ux-strategist + frontend-lead | 4h | pairs with FE-11 / UJ-21 | Public TAMP URL surface. |
| UX-12 | High | MERGE | frontend-lead | 4h | none | Dashboard shortcut to Consistency Letter. |
| UX-13 | Medium | MERGE | ux-strategist | 4h | none | Segmented control for Push-to-Plan state. |
| UX-15 | Medium | MERGE | frontend-lead | 30m | none | Remove or wire "Cloud sync" top-bar icon. |
| UX-16 | Medium | MERGE | frontend-lead | 2h | none | Bell popover bulk-dismiss without opening. |
| UX-17 | Low | MERGE | frontend-lead | 1h | none | `RCSwitch` unify on GIS hazard toggle. |
| UX-18 | High | MERGE | ux-strategist | 1h | none | Option-level tooltips on Prioritization Method. |
| UX-19 | Medium | MERGE | ux-strategist | 1h | none | Discount-rate tooltip citing OMB A-94. |
| UX-20 | Low | MERGE | ux-strategist | 30m | none | Tooltip on sidebar-collapse button. |
| UX-21 | High | MERGE | qa-lead | 2h | none | Visible focus rings on sidebar links (WCAG 2.4.7). |
| UX-22 | Medium | SPRINT | qa-lead | 1d | pairs with TC-08 | DOMPurify pass or documented escape guarantee. |
| UX-23 | Medium | SPRINT | qa-lead | 4h | Radix `Dialog` swap | Focus trap on `Overlay` modal. |
| UX-24 | Medium | SPRINT | ux-strategist | 1d | mobile design pass | Hamburger drawer for <768px. |
| UX-25 | Medium | MERGE | ux-strategist | 2h | none | Responsive heatmap on mobile. |
| UX-26 | Low | MERGE | ux-strategist | 1h | none | Horizontal-scroll cue on tables. |

### 1e. Domain data-purity (DP-##) — 12 remaining (DP-10 = BE-01 closed, DP-15 closed)

| ID | Sev | Tier | Owner | Effort | Blocking dep | Note |
|---|---|---|---|---|---|---|
| DP-01 | Medium | MERGE | frontend-lead | 2h | none | Footnote: missing grades = 0 inspections. |
| DP-02 | Low | MERGE | lifecycle-domain-expert | 2h | none | Normalise `Region` free-text. |
| DP-03 | Medium | MERGE | backend-lead | 4h | none | Hard-coded 5×5 risk-band cutoffs → `RiskConfig`. |
| DP-04 | Medium | SPRINT | lifecycle-domain-expert | 1d | domain SME sign-off on curves | Class-specific deterioration curves. |
| DP-05 | Low | MERGE | frontend-lead | 2h | none | "Approaching EoL" threshold tenant-configurable. |
| DP-06 | High | SPRINT | lifecycle-domain-expert | 1d | citation format decision | ARV unit-cost source + as-of-date trailer. |
| DP-07 | Medium | SPRINT | lifecycle-domain-expert | 1d | product decision on schedule vs latest-row | Per-year inflation lookup. |
| DP-08 | High | ROADMAP | product-manager | 3d + | new CRUD surface + PM/domain design | User-editable Risk Register. |
| DP-09 | Medium | MERGE | lifecycle-domain-expert | 2h | none | Prefix risk categories with taxonomy source. |
| DP-11 | Low | MERGE | lifecycle-domain-expert | 2h | none | Deterioration-model attribution footer. |
| DP-12 | Medium | MERGE | backend-lead | 4h | none | Compute + render % of budget spent on `JobOrderCostsTab`. |
| DP-13 | High | SPRINT | lifecycle-domain-expert | 1d | UX pattern for revert | "Reset to default" on Domain Profile. |
| DP-14 | Low | MERGE | frontend-lead | 2h | none | Render `lastEditedAt` / `lastEditedBy` on Domain Profile. |
| DP-16 | Medium | MERGE | backend-lead | 2h | none | Migrate `Demo:Domain` off appsettings.json into `Tenant.DemoDomain`. |

### 1f. Test-coverage gaps (TC-##) — 14 remaining (TC-01/02/03 closed)

| ID | Sev | Tier | Owner | Effort | Blocking dep | Note |
|---|---|---|---|---|---|---|
| TC-04 | High | SPRINT | qa-lead | 1d | none | Users invite/role/deactivate E2E. |
| TC-05 | High | SPRINT | frontend-lead + qa-lead | 1d | `data-testid` audit | Capital-needs dialog form-logic test. |
| TC-06 | High | MERGE | qa-lead | 4h | none | Push-to-Build sad-path smoke. |
| TC-07 | High | SPRINT | qa-lead | 4h | none | Public TAMP viewer negative-paths. |
| TC-08 | High | MERGE | frontend-lead | 4h | pairs with UX-22 | XSS-injection tests for 3 markdown renderers. |
| TC-09 | Medium | MERGE | qa-lead | 2h | none | Dashboard empty-state coverage. |
| TC-10 | Medium | MERGE | qa-lead | 2h | pairs with UJ-13 | GIS Explorer domain-center fallback assertion. |
| TC-11 | Medium | MERGE | backend-lead | 2h | none | `BuildFinancialTests.cs` non-null `lcpSummary` test (regression guard for BE-01). |
| TC-12 | Medium | SPRINT | qa-lead | 1d | pairs with BE-07 | Background service liveness integration test. |
| TC-13 | Medium | MERGE | qa-lead | 2h | none | Public-URL slug injection tests. |
| TC-14 | Medium | SPRINT | devops | 4h | pairs with FE-14 | CI diff-guard: primus vs masterworks `vite.config.ts`. |
| TC-15 | Low | MERGE | qa-lead | 1h | none | Unit test for `relativeTime()` in `__root.tsx`. |
| TC-16 | Low | — | qa-lead | — | tracked via DP-13 | Close with DP-13. |
| TC-17 | Low | ROADMAP | qa-lead | — | Wave-2 AI-panel scope | Workflow/Trigger tabs E2E. |

**Tier totals across 62 remaining:** MERGE ≈ 43 · SPRINT ≈ 15 · ROADMAP ≈ 4 (+ 4 W5.4 escalations).

---

## 2. Recommended MERGE batch #1 ("W10-MERGE-1")

Ten highest-leverage MERGE items, ordered by dependency and risk-reduction. Bundle into one housekeeping-sweep PR per lead.

| # | ID | Lead | Justification |
|---|---|---|---|
| 1 | UX-21 | qa-lead | WCAG 2.4.7 focus rings — accessibility blocker for federal-procurement demos. Cheapest a11y win in the audit. |
| 2 | UX-07 | frontend-lead | Dashboard KPI real skeleton — removes the "backend looks broken" first-impression that survived UX-05 close. |
| 3 | UX-06 | frontend-lead | Financial-Plan "no data" KPI — mirrors the BE-01 recall doctrine; without this, the exact class of silent-zero survives at the KPI card. |
| 4 | FE-11 + UX-11 + UJ-21 | frontend-lead + ux-strategist + PM | Bundle: public TAMP URL chip. Three IDs, one PR. Directly addresses the "post-lock, users can't find their published TAMP" pattern that lingered after FE-10 closed. |
| 5 | UJ-08 | frontend-lead | Push-to-Build error drawer with reason + retry — surfaces during every demo because Build stub returns 501. Highest-visibility MERGE. |
| 6 | UX-18 + UJ-11 + UX-19 | ux-strategist + lifecycle-domain-expert | Bundle: Prioritization tooltips + `modelSettings.discountRate` default + OMB A-94 tooltip. Three IDs, one PR. Closes the "why 3%?" question every FHWA reviewer asks. |
| 7 | UJ-15 | ux-strategist | Domain-profile switch banner — prevents accidental re-seed on demo tenants. High-consequence, low-effort. |
| 8 | FE-07 | frontend-lead | Region-filter disable on preset assets — same silent-drop class as UJ-10; not fixing it is a recognized recall pattern. |
| 9 | UJ-17 + UX-02 | frontend-lead + PM | Bundle: `window.confirm` → `Overlay`. Consistency across destructive actions; one PR. |
| 10 | BE-10 + BE-11 | backend-lead | Bundle: two route-deviation ADRs. Ends the "someone will assume uniform prefixing and silently 404" hazard called out in `project_reports_controller_mixed_routes.md`. |
| 11 | TC-11 | backend-lead | Regression guard for the BE-01 recall. Tiny, but if this slips we cannot claim the recall is prevention-hardened. |
| 12 | UX-15 + FE-13 + FE-12 | frontend-lead | Bundle: dead affordance sweep — remove "Cloud sync" icon, `/setup` route, `/library` sidebar remnants. Cleans three "why is this here?" demo questions. |

Total effort: ≈ 4-5 lead-days spread over the three roles. Executes as **one week**.

---

## 3. Recommended SPRINT sequencing

The 15 SPRINT items cluster into three themes. Suggested order (rationale below); dates are the ED user's call.

### Theme A — "Silent-failure guardrails" (first, most urgent)
Items: **BE-07** (worker heartbeats), **TC-12** (worker liveness test), **BE-04** (narrative version isolation on lock), **TC-11-batch** (already in MERGE-1), **UX-22 + TC-08** (markdown XSS + escape guarantee), **UX-23** (modal focus trap), **BE-09** (`ReportsController` split).

**Rationale:** every item here closes a class of defect the recall postmortem already surfaced. Workers dying silently and controllers 404-ing silently are the same failure mode as `lcpSummaryForGap: null` — and the review-gate pattern only catches these if the underlying hardening is done first.

### Theme B — "Contract + config discipline"
Items: **FE-14 + TC-14** (vite worktree drift), **UX-01** (dropdown unification), **UX-03** (markdown renderer consolidation), **UX-24** (mobile drawer), **DP-13** (Domain Profile reset-to-default), **DP-06** (ARV citation trailer), **DP-07** (per-year inflation lookup), **DP-04** (class-specific deterioration curves).

**Rationale:** each item forces a small design doc + ADR. Bundling into one sprint means the tech-architect + lifecycle-domain-expert reviews happen once, not eight times. Low-urgency items (mobile, curves) piggyback on the review meeting overhead.

### Theme C — "E2E depth coverage"
Items: **TC-04** (Users invite/role/deactivate), **TC-05** (capital-needs dialog form logic), **TC-06** (Push-to-Build sad path), **TC-07** (public TAMP negatives), **UJ-02** (tenant selector on login), **UJ-13** (domain-map-center via `DomainProfile`), **UJ-18** (password/set/reset/invite split), **UJ-20** (notification transport).

**Rationale:** these are all end-to-end journeys or transport upgrades that require the guardrails from Theme A to be in place (so a failing test is a real signal, not worker flakiness). Ship last of the three.

**Suggested order:** A → B → C. Doing B before A duplicates review overhead; doing C before A produces flaky results.

---

## 4. ROADMAP items surfaced for ED + PM

Ten items require multi-sprint work, staffing, or policy decisions. Not to be dispatched without user sign-off.

### From the audit backlog
1. **DP-08** — User-editable Risk Register CRUD screen. Needs PM design pass, domain SME sign-off on taxonomy (see also DP-09), backend CRUD controller, frontend surface. Estimate: 2 sprints. Owner: product-manager + lifecycle-domain-expert + backend-lead.
2. **UJ-03** — Idle-timeout UX. Needs a session-timeout policy (which the current auth flow doesn't have). Blocks on a security-review decision. Owner: tech-architect + frontend-lead.
3. **UJ-19** — Dedicated `/notifications` page. New route + backend paging + integration with the polling upgrade in UJ-20. Owner: frontend-lead + backend-lead.
4. **UJ-26** — In-app demo-data reset. Needs a seeder API + admin auth + a "reset" audit event. Owner: devops + backend-lead.
5. **TC-17** — Wave-2 AI-panel E2E. Blocked until AI panel is out of Wave-2 scope. Owner: qa-lead.

### From W5.4 governance escalations ([`incident-comms/2026-07-23-bug06-tamp-financial-recall.md`](../../vol-5-operating-model/incident-comms/2026-07-23-bug06-tamp-financial-recall.md) § 7)
6. **Disclosure grouping — bundling multi-tenant recalls.** ED + PM + Head of CSM joint call. The BUG-06 email enumerates one bug; the Companion audit mentions BUG-05/07/08 exist but doesn't list them to customers. The question is whether the next recall gets its own email or a rolled-up QBR-cycle package. This is a customer-trust policy, not a code decision. Owner: **VP-Product + ED**. Deliverable: a "recall-communication doctrine" section in `vol-5-operating-model/incident-comms/`.
7. **MSA scope — data-purity guarantees.** Legal (Melissa Chen) has to confirm whether current MSA templates carry an SLA on report accuracy that would trigger credit/refund obligations. Until this is answered, § 5 of the recall doc understates the escalation. Owner: **VP-Product + Legal**. Blocks on the general-counsel review calendar.
8. **Staffing — 62-finding backlog.** The MERGE-1 + Theme-A sprint alone consumes ~2 lead-weeks concentrated on frontend-lead and ux-strategist. If we ship this and continue W4-onwards feature work in parallel, we're implicitly asking the same two agents to be double-booked. ED call: either (a) freeze feature scope for a "quality sprint" (aligns with `.ai/product-review.md#priority-6--scope-discipline-ongoing`), (b) hire a second frontend-lead, or (c) accept a slower burn. Escalate to VP-Engineering with option costs.
9. **`report_generation_events` audit table.** New append-only log capturing `(tenant_id, user_id, report_type, params_hash, generated_at, delivery_channel)`. Needs (a) schema ADR — table shape, partitioning, retention window; (b) PII review — `user_id` is FK to users, `params_hash` may leak scenario identifiers; (c) integration into every report-emitting controller (TAMP, dashboard exports, Consistency Letter, Capital Needs bundle push). Owner: **tech-architect (schema) + backend-lead (impl) + security-reviewer (PII) + devops (retention/backup)**. Estimate: 1 sprint for design, 1 sprint for impl + backfill. Precedent: the BUG-06 blast-radius query in the recall doc's § 2 is best-effort precisely because this table doesn't exist.

### Roadmap-adjacent (surface, no blocker)
10. **Standing review gate rollout — Sprint W3.6/W3.7 from `review-gate-pattern.md`.** Not a finding; a doctrine. ED already owns the rollout; called out here so it isn't lost.

---

## 5. Recommended cadence

Per `review-gate-pattern.md`, the review gate operates per-PR. That leaves three additional cadences on the ED's calendar:

- **Wave-2 diff review — every 2 weeks.** Fires the three-parallel-reviewer dispatch (ux-strategist + qa-lead + role-specific) on the diff since the last Wave-2 run. Catches new instances of the "silent mutation" and "orphan enum" classes before they compound. This is what `review-gate-pattern.md` was designed to make cheap — 1 agent-turn wall-clock.
- **Full product-quality audit — every 6-8 weeks (roughly quarterly).** The 6-parallel-auditor pattern from this July-23 bundle. Only justified when the diff since the last full audit is materially larger than a Wave-2 review can absorb, or when a domain surface enters a new phase (e.g., Job Orders leaves scaffold). Anchor: § 09 code-review SLAs + the `review-gate-pattern.md` cost-benefit table.
- **ED refresh — monthly.** ED reads the last month's Wave-2 outputs, the `.ai/architecture-review.md` + `.ai/product-review.md` deltas, and the current MERGE/SPRINT/ROADMAP burn-down against this document. Produces a one-page update, saved under `docs/leadership/YYYY-MM-DD-ed-refresh.md`. Escalations flow to VP-Engineering out of this cycle.

Ship the first Wave-2 diff review two weeks after MERGE-1 lands. That checks whether MERGE-1 introduced regressions and whether the gate is actually catching the patterns it was designed to catch.

---

## Cross-references

- Audit source docs: this directory.
- W5.4 governance source: [`../../vol-5-operating-model/incident-comms/2026-07-23-bug06-tamp-financial-recall.md`](../../vol-5-operating-model/incident-comms/2026-07-23-bug06-tamp-financial-recall.md) § 7.
- Doctrine: [`review-gate-pattern.md`](review-gate-pattern.md), [`../../vol-5-operating-model/09-code-reviews.md`](../../vol-5-operating-model/09-code-reviews.md), [`../../vol-4-ai-organization/01-engineering-director.md`](../../vol-4-ai-organization/01-engineering-director.md).
- Scope-discipline anchor: `.ai/product-review.md#priority-6--scope-discipline-ongoing`.
