# TAMP Data-Purity Audit — PM Review (W3.4 Pre-Work)

**Date:** 2026-07-23
**Reviewer:** Product Manager (Aurigo Maintain)
**Branch:** primusmaintain-v2
**Scope:** PM disposition of the four TAMP data-purity findings raised in [`18-tamp-data-purity-audit.md`](18-tamp-data-purity-audit.md) § 6 (Blockers) before backend-lead touches code.
**Companion docs:** [`vol-2-product-knowledge/domains/tamp.md`](../vol-2-product-knowledge/domains/tamp.md), [`vol-8-roadmaps/03-ga.md`](../vol-8-roadmaps/03-ga.md), [`17-tenant-isolation-audit.md`](17-tenant-isolation-audit.md) (format precedent).

---

## Summary

| Bug | Severity | Customer-Visible Today? | Compliance Risk | Owning Role | Sprint |
|---|---|---|---|---|---|
| BUG-05 `FundingSource` never seeded | **P0** | Yes — $0 across every federal column | 23 CFR § 515.9(f) fail | backend-lead + frontend-lead (Config UI) | This sprint (partial) + next (UI) |
| BUG-06 `BuildFinancial(lcpSummaryForGap: null)` | **P0** | Yes — every `totalNeedM` = $0 | 23 CFR § 515.9(c) — capital-need chapter wrong | backend-lead | This sprint |
| BUG-07 Fabricated `"Baseline from 2023 HPMS submittal"` note | **P0** | Yes — literal text in seeded target | 23 CFR § 515.9(g) + FHWA reviewer trust | backend-lead (this sprint) + ux-strategist (labelling) | This sprint |
| BUG-08 Unit-cost `EffectiveDate = DateTime.UtcNow` | **P2** | Yes — false green "current" vintage badge | Defensibility / methodology audit trail | backend-lead | This sprint |

Three P0s + one P2. All four are demo-facing today and all four block the first state-DOT pilot. None require a new ADR; none introduce out-of-scope surface. The only bug that spawns a downstream PRD is BUG-05 (the Config UI for tenant-entered funding sources) — flagged to `frontend-lead` for W4.

---

## BUG-05 — `FundingSource` rows are never seeded

### Finding
Per [`18-tamp-data-purity-audit.md` § 6.1](18-tamp-data-purity-audit.md), the Financial Plan reads from `FundingSource` rows that no seeder populates. Every fresh tenant renders `$0` across NHPP, STBG, HSIP, NHFP, and state-match columns. `SeedRunner.cs` writes `FundingSource` **string labels** on capital needs (lines 1981–4078) but no `FundingSource` **entities** for the federal-apportionment table that `BuildFinancial` joins against.

### Severity: **P0**
This is the biggest of the four. The Financial Plan chapter is a hard FHWA requirement (§ 515.9(f)) and a "$0 everywhere" render will be caught by any reviewer in the first 30 seconds of a demo. It also blocks the "structural funding deficit" narrative that `tamp.md` § 1 identifies as the primary TAMP forcing function — without funding numbers there is no gap to close.

### Customer-visibility
A state-DOT reviewer opens Financial Plan → sees a fully formatted table with $0 in every federal column. Worse than a placeholder, because the columns imply the system knows the data and is reporting it. Confidence hit is immediate.

### Compliance risk
- **23 CFR § 515.9(f):** "financial plan… includes estimated revenues from all funding sources reasonably expected to be available" — $0 fails this on its face.
- **SOC 2 CC7.2 (data integrity):** shipping a report where a documented data element is silently absent is an integrity finding at audit time.
- **StateRAMP:** no direct hit, but this is exactly the class of finding that causes ATO delays.

### Recommendation — Option (a) with a caveat: **auto-seed a template, force the tenant to acknowledge it**
The three options in the task brief map to:
- (a) Auto-seed sensible defaults (10-yr straight-line apportionment)
- (b) Require Config UI entry before Financial Plan renders
- (c) Hide the funding-source split until data exists

Pick **hybrid (a) + (b)**:
1. **backend-lead this sprint:** seed `FundingSource` rows using the FHWA FMIS national-average NHPP/STBG/HSIP/NHFP formula for the tenant's state, marked with `IsTemplate = true` and `SourceNote = "Template — Aurigo FMIS national-average allocation. Replace with your state's actual apportionment before FHWA submission."`
2. **frontend-lead next sprint (PRD required):** Configuration → Funding Sources page. Renders template rows with an amber "unverified" chip. Blocks TAMP `SubmitForReview` state transition until every source row has `AcknowledgedByUserId` + `AcknowledgedAtUtc` set (even if the tenant kept the seeded number).

Rationale for rejecting pure (a): federal apportionment varies 2–5x across states — a national-average number is directionally right for demos but wrong enough to embarrass the customer in front of their FHWA division office. Rationale for rejecting pure (b) or (c): both leave the Financial Plan literally blank on day one, which kills the demo flow that Sales relies on. Hybrid preserves demoability + forces the correction before submission.

### Timeline
- **W3.4 (this sprint):** backend-lead adds seeder + `IsTemplate` flag. Ship the amber note.
- **W4 (next sprint):** frontend-lead ships Config UI. PRD to follow this doc: `docs/product/PRD-funding-source-config.md`.
- **Not before W5:** hard block on `SubmitForReview` transition (requires the Config UI to exist first, otherwise we brick every tenant).

### Success metric
- **Baseline:** 100% of tenants render `$0` in Financial Plan today.
- **Target:** 0% of tenants render `$0` after W3.4 seed ships; 100% of tenants that hit `SubmitForReview` have acknowledged funding source rows after W5.
- **Measurement source:** `SELECT COUNT(*) FROM funding_sources WHERE tenant_id = $1` in CI seed test; audit-log query on `AcknowledgedByUserId` for the second metric.

---

## BUG-06 — `BuildFinancial(lcpSummaryForGap: null)` is a straight bug

### Finding
Per [`18-tamp-data-purity-audit.md` § 6.2](18-tamp-data-purity-audit.md) and confirmed at `TampReportHandlers.cs:629`:

```csharp
var financial = BuildFinancial(budgets, lcpSummaryForGap: null, req.ScenarioId, horizonYears, currentYear, programmedByYear);
```

`null` is passed unconditionally even when the request carries a valid `ScenarioId` and the handler has already resolved `lcpSummary` on line 605 for the LifeCycle section. Every FY's `totalNeedM` renders as `$0`, so the gap analysis (needs − available) collapses to a negative number that equals the budget.

### Severity: **P0**
Not a product decision — a straight bug — but the customer-facing severity is high. This is the number the entire TAMP investment strategy narrative depends on (`tamp.md` § 1, § 6). Anyone who ran a report between Sprint T-5 and today got wrong numbers.

### Customer-visibility
Silent wrong numbers. Nobody sees an error; they see plausible-looking figures where every year shows zero need against real budget. If a customer already generated a TAMP PDF from this build, they got numbers that would fail FHWA cross-check against the LCP scenario report — which is generated correctly.

### Compliance risk
- **23 CFR § 515.9(c):** the 10-year capital need is a required data element. Reporting `$0` when the LCP engine computed a real number is a materially false submission.
- **SOC 2 CC7.1 (system operations — completeness & accuracy):** silent wrong-number bugs are the exact class of finding that leads to a "qualified" opinion rather than "unqualified."
- **Aurigo customer trust:** any tenant who already downloaded a report with these numbers may have shared it internally. We need a recall notice.

### Recommendation
Pass `lcpSummary` (already resolved on line 605) instead of `null`. One-line fix. Backend-lead confirms via existing `FinancialApiTests.cs` — add a regression test that asserts `totalNeedM > 0` when a scenario is bound.

Additionally: query the audit log for `TampVersion` rows generated in the last 30 days with `ScenarioId IS NOT NULL` — any customer on that list needs a "please regenerate" email. Assign to ux-strategist for the customer comms + release-notes framing.

### Timeline
Ship in W3.4. Customer comms out same week.

### Success metric
- **Baseline:** 100% of scenario-bound TAMP reports show `totalNeedM = $0`.
- **Target:** 100% show `totalNeedM = lcpSummary.CapitalNeedByFy[year]` post-fix.
- **Measurement source:** `FinancialApiTests.BuildFinancial_WithScenario_PopulatesTotalNeed`.

---

## BUG-07 — Fabricated `"Baseline from 2023 HPMS submittal"` note

### Finding
Per [`18-tamp-data-purity-audit.md` § 6.3](18-tamp-data-purity-audit.md) and confirmed at `SeedRunner.cs:2478`:

```csharp
Notes = "Baseline from 2023 HPMS submittal. Aligns with state TAMP aspirational goal.",
```

Literal string. Every tenant, every PM2 target row, ships with this note whether or not the tenant ever submitted an HPMS dataset in 2023 (most Aurigo tenants haven't — Aurigo isn't the HPMS system of record for any customer today).

### Severity: **P0**
Compliance-adjacent. FHWA reviewers cross-check TAMP data elements against HPMS submissions. A note that claims HPMS provenance when the number is a stock default will trigger a data-integrity flag on the review, and — worse — creates the impression that the tenant misrepresented their baseline. That's a customer-trust catastrophe, not just a technical bug.

### Customer-visibility
The note appears verbatim in the Performance Management chapter of the TAMP export. It's not buried metadata — it's reviewer-facing text.

### Compliance risk
- **23 CFR § 515.9(g):** performance measures must reference the underlying condition data source. Claiming HPMS provenance falsely is a material misrepresentation.
- **FHWA consistency determination:** listed in `tamp.md` § 10 as narrative-defensibility criterion — a false provenance note gives the reviewer a concrete reason to return the TAMP for revision.
- **SOC 2 CC1.4 (integrity of communications):** shipping fabricated source citations in customer-branded output is a code-of-conduct finding.

### Recommendation — Option (c) with copy edit: **replace the note, keep the row, flag it as a template**
Options (a) remove entirely, (b) require tenant to enter HPMS reference, (c) mark as template.

Pick **(c)** with concrete copy:
```
Notes = "[TEMPLATE VALUE — Replace with your agency's baseline reference (HPMS submission year, PMS extract date, or equivalent source) before FHWA submission.]"
```

Rationale for rejecting (a): a target row with no provenance note fails FHWA § 515.9(g). Rationale for rejecting pure (b): a hard gate at seed time breaks demo flow. (c) preserves the row, kills the false provenance claim, and the `[TEMPLATE VALUE — …]` bracket format visually screams "replace me" in any rendered chapter.

Frontend-side ask (ux-strategist, W4): the target-detail modal renders `[TEMPLATE VALUE — …]` strings with a red banner + "Edit provenance" CTA. Same treatment for the `Baseline`, `TwoYearTarget`, and `FourYearTarget` numeric fields — they also need "is this yours?" confirmation before `SubmitForReview`.

### Timeline
- **W3.4 (this sprint):** backend-lead changes the seed string. Trivial.
- **W4:** ux-strategist ships the `[TEMPLATE VALUE — …]` red-banner treatment in the target-detail modal.
- **W5:** same acknowledgement gate as BUG-05 — no `SubmitForReview` until template rows are edited or explicitly acknowledged.

### Success metric
- **Baseline:** 100% of seeded PM2 targets carry the false HPMS note.
- **Target:** 100% of seeded PM2 targets carry the `[TEMPLATE VALUE — …]` marker; 0% of `Locked` or `Submitted` TAMP versions contain any `[TEMPLATE VALUE — …]` string.
- **Measurement source:** grep test in CI + a `TampVersionValidator` rule at `Lock` transition.

---

## BUG-08 — Unit-cost `EffectiveDate = DateTime.UtcNow` at seed

### Finding
Per [`18-tamp-data-purity-audit.md` § 6.4](18-tamp-data-purity-audit.md) and confirmed at `SeedRunner.cs:742, 762, 774, 933, 939` + `InternalDataConnector.cs:155, 164`: every seeded `UnitCostRate` and `InflationConfig` row stamps `EffectiveDate = DateTime.UtcNow`. The Methodology chapter's "vintage" badge computes staleness from that date, so it always renders green "current" even when the rate is a stock national-average default.

### Severity: **P2**
Trivial to fix. Customer-visible but not chapter-breaking. The badge is an affordance, not a submission-blocking field.

### Customer-visibility
Methodology chapter shows "Unit costs: current" green pill next to numbers that are stock defaults. Sophisticated tenants (any state DOT with a real PMS team) will spot the mismatch immediately and lose confidence in the system's provenance tracking.

### Compliance risk
- **23 CFR § 515.9(j):** methodology documentation requires source dates for input data. A false "current" flag is a soft § 515.9(j) miss, not a hard one — the underlying numbers are still documented, just with wrong provenance.
- **Defensibility:** `tamp.md` § 10 makes clear FHWA reviews the narrative. A wrong provenance stamp weakens defensibility but isn't itself disqualifying.

### Recommendation — backdate + confirm the amber affordance
The task brief proposes backdating to `2024-01-01` at seed so the badge flags amber "stale (>3yr)". **Concur.** This is the right call:
- Amber is the right affordance — it says "we don't know these are yours; calibrate before you rely on them" without blocking the workflow.
- `2024-01-01` is defensible: pre-dates most Aurigo tenant onboarding, aligns with the vintage of the AASHTOWare/FHWA cost benchmarks we pulled the seed values from.

Same fix at both seed sites and at `InternalDataConnector.cs:155`. `InternalDataConnector.cs:164` (create branch for legit new-rate imports) keeps `DateTime.UtcNow` — that IS legitimately current for a real import event.

`ArvAndRiskHandlers.cs:226` (`SetInflationConfig`) keeps `DateTime.UtcNow` — user-entered rates are legitimately current at set-time.

### Timeline
Ship in W3.4 alongside the other backend fixes.

### Success metric
- **Baseline:** 100% of tenants show green "current" vintage badge on Methodology chapter for stock rates.
- **Target:** 100% show amber "stale (>3yr)" for un-modified stock rates; badge flips to green only after tenant `PUT`s a new `UnitCostRate` (which correctly stamps `DateTime.UtcNow`).
- **Measurement source:** unit test on `MethodologyBuilder.ComputeVintageBadge`.

---

## Combined W3.4 Dispatch Brief — for backend-lead

**Priority order (top → bottom = ship first → ship last within the sprint):**

1. **BUG-06 fix** — one-line change at `TampReportHandlers.cs:629`. Add regression test to `FinancialApiTests.cs`. **~1 hour.** Ship first because it's the smallest fix with the biggest correctness win.
2. **BUG-08 fix** — backdate `EffectiveDate` at `SeedRunner.cs:742, 762, 774, 933, 939` and `InternalDataConnector.cs:155` to `new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)`. Leave `InternalDataConnector.cs:164` and `ArvAndRiskHandlers.cs:226` alone. **~1 hour.**
3. **BUG-07 fix** — replace the note string at `SeedRunner.cs:2478` with the `[TEMPLATE VALUE — …]` copy specified in § BUG-07 above. Grep for any other hard-coded provenance strings in the seeder and give them the same treatment (verify no other rows claim HPMS/NBI/AASHTOWare provenance). **~2 hours.**
4. **BUG-05 partial fix (seeder half only)** — add `FundingSourceSeeder` that inserts the standard federal apportionment programs (NHPP, STBG, HSIP, NHFP, CMAQ, state-match) with `IsTemplate = true` and a template note per § BUG-05 above. Use FHWA FMIS national averages. **~1 day.** Add DB migration if `FundingSource` doesn't already have `IsTemplate` + `AcknowledgedByUserId` + `AcknowledgedAtUtc` columns (backend-lead call — check the entity, add if missing).

**Do NOT touch in W3.4:**
- Config UI for funding sources (BUG-05 second half) — waits for frontend-lead PRD in W4.
- `SubmitForReview` acknowledgement gate — waits for W5, needs the UI first or every tenant is bricked.
- `[TEMPLATE VALUE — …]` red-banner treatment in the target modal — ux-strategist owns, W4.
- Customer comms for wrong-number recall (BUG-06 downstream) — ux-strategist owns, this week but out of engineering scope.

**Reference every fix to:** [`18-tamp-data-purity-audit.md`](18-tamp-data-purity-audit.md) §§ 6.1–6.4 and this doc's §§ BUG-05 through BUG-08.

**Test bar for the dispatch:** CI must have one regression test per bug, all in `FinancialApiTests.cs` or a new `TampSeedDataPurityTests.cs`. All four tests must be un-skipped from the moment they're written (same standard as [`17-tenant-isolation-audit.md`](17-tenant-isolation-audit.md) § Summary — "CI fails on every build until the bugs are fixed").

---

## Downstream Handoffs

| Recipient | Deliverable | Deadline |
|---|---|---|
| `backend-lead` | This § "Combined W3.4 Dispatch Brief" | W3.4 |
| `frontend-lead` | PRD for Funding Source Config UI (I will produce `docs/product/PRD-funding-source-config.md` before W4 planning) | Before W4 sprint planning |
| `ux-strategist` | (a) `[TEMPLATE VALUE — …]` red-banner spec for target-detail modal, (b) customer comms copy for BUG-06 wrong-number recall | W4 |
| `engineering-director` | See below | Same day |

---

## Escalations to `engineering-director`

1. **Scope tension:** BUG-05 forces a Config-UI PRD into W4 that was not previously on the frontend-lead's plate. This is not scope creep in the "new capability" sense — it's making an already-half-shipped capability actually work (per `.ai/product-review.md#priority-6--scope-discipline-ongoing`). Requesting ED confirmation that frontend-lead's W4 capacity can absorb it, or that we jointly defer another W4 item.
2. **Customer-comms question (BUG-06):** any tenant who downloaded a TAMP PDF with wrong `totalNeedM` numbers in the last 30 days should get a "please regenerate" notice. This is a support/CSM call, not just a PM call. Escalating for CSM loop-in.
3. **No P0 security implications** — none of the four bugs are on the `.ai/architecture-review.md#🚨-critical` list; the existing P0s from [`17-tenant-isolation-audit.md`](17-tenant-isolation-audit.md) remain the higher priority for the security-focused half of the sprint.

---

## Cross-References

- Audit source: [`18-tamp-data-purity-audit.md`](18-tamp-data-purity-audit.md)
- Domain context: [`vol-2-product-knowledge/domains/tamp.md`](../vol-2-product-knowledge/domains/tamp.md)
- Format precedent: [`17-tenant-isolation-audit.md`](17-tenant-isolation-audit.md)
- GA bar: [`vol-8-roadmaps/03-ga.md`](../vol-8-roadmaps/03-ga.md) — SOC 2 CC7.1/CC7.2 implications called out in BUG-05 and BUG-06.
- Roadmap slot: this work lands under `vol-8-roadmaps/02-beta.md` "TAMP compliance completeness" bucket. No new roadmap file required — see `CLAUDE.md` "in scope" clause covering TAMP + Financial Plan.
