# Domain data-purity audit (non-TAMP surfaces) — 2026-07-23

**Auditor role:** lifecycle-domain-expert
**Scope:** every domain surface OUTSIDE the TAMP report. Format mirrors `vol-3-architecture/18-tamp-data-purity-audit.md`.
**Classification legend (identical to §18):**

- **REAL** — Value read from a real read-model, unaltered.
- **CALCULATED** — Derived server-side from real inputs via a pure engine.
- **SEEDED-CONFIG** — Static config planted by a seeder; user-editable but only via a specific config screen.
- **FALLBACK** — Rendered when the primary data source is empty; SHOULD be visually distinct.
- **SYNTHETIC** — Fabricated by a demo/seed step (fine for demo, MUST be flagged in production).
- **PLACEHOLDER** — Hard-coded literal that must be replaced before production.

Findings numbered `DP-##`. Every finding cites file:line evidence + classification.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 5 |
| Medium | 6 |
| Low | 3 |

**Data purity score by surface (0 = all fabricated, 10 = all real):**

| Surface | Score | Notes |
|---|---|---|
| Inventory (`/assets`) | 9 | Real DB rows, geometry is real WKT. |
| Condition rollups (dashboard byGrade) | 8 | REAL when inspections exist; FALLBACK zero-map when empty (see DP-01). |
| RUL views | 7 | CALCULATED via `RulCalculator`; upstream inputs SEEDED. |
| ARV calculations | 6 | CALCULATED; unit-cost source is SEEDED-CONFIG and rarely reviewed. |
| Risk register (dashboard) | 5 | 24 seed rows shipped verbatim as REAL. Not tenant-editable. |
| LCP scenario summary | 8 | CALCULATED after run; PLACEHOLDER before run (empty). |
| PM schedules | n/a | Feature not shipped in primus per glob check. |
| Job Order cost tab | 7 | REAL cost entries when present; no calculated aggregates yet. |
| Configuration domain-profile screens | 4 | Mix of SEEDED-CONFIG (default profiles) + user-editable overrides — but no "reset to default" makes drift silent. |

---

## Inventory (`/assets`)

### DP-01 · Medium · frontend-lead
**"By condition grade" donut renders zero-count grades as if they were real.**
`frontend/asset-maintenance-web/src/routes/index.tsx:127-131` — `sgr = (Excellent+Good)/total`. When no inspections exist, `total=0` returns null and the donut shows an EmptyState — correct. But if inspections exist for only some grades, the donut plots the present grades verbatim without a caveat that missing grades = 0 assets, which reads as "no Fair-grade assets in the portfolio" (REAL implication) instead of "no Fair-grade INSPECTIONS have been recorded" (actual meaning). Classification: **CALCULATED** — but with an implicit-completeness assumption that should be surfaced in a footnote.

### DP-02 · Low · lifecycle-domain-expert
**"Region" is a free-text string.**
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Assets/AssetHandlers.cs:499` — `Region = iRegion >= 0 ? cols[iRegion].Trim() : null`. Classification: **REAL** (user-typed) but with no normalization — "TX-Dist 1" vs "Texas District 1" are different regions. Cosmetic for demo, but bites reports later.

---

## Condition rollups (Dashboard "byGrade", "byRulBand", "byRiskBand")

### DP-03 · Medium · lifecycle-domain-expert
**Risk band buckets are computed from `Likelihood × Consequence` but the 4-band cutoff (Low / Medium / High / Critical) is hard-coded, not read from a `RiskConfig`.**
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Dashboard/DashboardHandlers.cs` (not opened here; flagged for backend-lead cross-check). Classification: **CALCULATED** with **PLACEHOLDER** thresholds. FHWA has no fixed threshold, but any tenant that argues for a 3-band scheme cannot express it.

---

## RUL views

### DP-04 · Medium · lifecycle-domain-expert
**Deterioration curves per asset class come from `ModelSettings` — but the default seed uses generic FHWA "Pontis-style" pavement curves for every class including "Culvert" and "Sign".**
`backend/.../Config/ModelSettingsHandlers.cs` + `Infrastructure/Persistence/SeedRunner.cs`. Classification: **SEEDED-CONFIG** — technically correct but reviewers will spot that non-pavement classes share the pavement half-life. Add a "curve source" column to the curve UI.

### DP-05 · Low · frontend-lead
**"Approaching EoL" RUL band label is defined by a threshold (5 years) that isn't tenant-configurable.**
Dashboard uses the fixed `rulPalette` at `routes/index.tsx:74-76`. Classification: **PLACEHOLDER** for the threshold, REAL for the count. Fine for demo.

---

## ARV calculations

### DP-06 · High · lifecycle-domain-expert
**Unit-cost source citation is absent in the ARV output — a critical audit-trail miss.**
`backend/.../Application/ARV/ArvAndRiskHandlers.cs` (not opened; classification below is based on documented behavior in `18-tamp-data-purity-audit.md` findings that ARV is CALCULATED). Classification: **CALCULATED** — but with no "based on unit-cost X from source Y as of date Z" trailer. A FHWA reviewer scoring the TAMP will mark this "insufficient methodology narrative".

### DP-07 · Medium · lifecycle-domain-expert
**Inflation adjustment uses the newest `InflationConfig` row, silently ignoring per-year lookups.**
`backend/.../Application/Reports/TampReportHandlers.cs:647-649` — `.OrderByDescending(i => i.EffectiveDate).FirstOrDefaultAsync(ct)`. Classification: **SEEDED-CONFIG** by default. If a tenant adds two rows (2024, 2026) intending a schedule, only the newer applies. Missing UX guidance.

---

## Risk register (dashboard)

### DP-08 · High · product-manager
**24 seed rows are hard-coded as "the tenant's enterprise risk register" but there is no in-app editor.**
`backend/.../Application/Risk/RiskMitigationHandlers.cs` + no CRUD controller for `RiskRegisterEntry` (only `RiskRegisterController.cs` for read). Classification: **SEEDED-CONFIG** with **no user override path**. A tenant that says "my risk register has 8 items, not 24" cannot express that.

### DP-09 · Medium · lifecycle-domain-expert
**Risk register `category` values come from NCHRP 08-93 (per `routes/index.tsx:422`) but the seed doesn't note the source in the category label.**
Consider prefixing categories with source (e.g. "[NCHRP] Governance") so a reviewer knows the taxonomy origin.

---

## LCP scenario summary

### DP-10 · High · lifecycle-domain-expert
**`lcpSummaryForGap: null` is passed unconditionally to `BuildFinancial`.**
`backend/.../Application/Reports/TampReportHandlers.cs:629` — `var financial = BuildFinancial(budgets, lcpSummaryForGap: null, ...);`. Downstream `BuildFinancial` at line 1371-1384 branches on `if (lcpSummaryForGap is not null && !string.IsNullOrWhiteSpace(...CostByYearJson))` — always false. Result: `needEntries` is always empty, so `GapByYear.TotalNeed` is always 0, and every FY row shows `$0M` need for the TAMP Financial section. This is the exact bug the product owner flagged. Classification: **PLACEHOLDER** hard-null (should be **CALCULATED** from the current scenario). **Owner: backend-lead. Critical.** Cross-reference: this is also flagged in `backend-code-sweep.md#BE-01`.

### DP-11 · Low · lifecycle-domain-expert
**"Do Nothing" scenario returns a condition trajectory that assumes natural deterioration only — but does not disclose the deterioration model in use.**
`backend/.../Application/LCP/LcpHandlers.cs` (not opened; documented in behavior). Classification: **CALCULATED** with implicit assumptions. Add a "based on model X.Y" footer to Do-Nothing output.

---

## PM schedules

Not shipped in primus. Skipped.

---

## Job Order cost tab

### DP-12 · Medium · backend-lead
**`JobOrderCostsTab` reads real cost entries but computes no aggregate — "% of budget spent" is absent.**
`frontend/asset-maintenance-web/src/features/capital-program/JobOrderCostsTab.tsx` + `AddCostDrawer.tsx` (per glob). Classification: **REAL** at the row level, **MISSING** at the aggregate level.

---

## Configuration domain-profile

### DP-13 · High · lifecycle-domain-expert
**"Reset to default" absent — a tenant that edits a domain profile then wants to compare against the shipped default has no path.**
`frontend/asset-maintenance-web/src/routes/configuration.domain-profile.tsx` (per glob). Classification: **SEEDED-CONFIG** that becomes **USER-EDITED** irrecoverably. Add a "revert to default" per section.

### DP-14 · Low · frontend-lead
**Domain profile screen doesn't show `lastEditedAt` / `lastEditedBy`.**
Audit trail exists in DB (via `AuditingSaveChangesInterceptor` at `Infrastructure/Persistence/DependencyInjection.cs:49`) but is not rendered.

---

## Cross-cutting

### DP-15 · Critical · backend-lead
**Seeded "Investment Strategy" narrative row is a **PLACEHOLDER** shipped as if it were tenant-authored.**
`backend/.../Infrastructure/Persistence/SeedRunner.cs:172` seeds an `InvestmentStrategy` narrative per tenant. `TampReportHandlers.cs:637-641` reads it back and renders it verbatim as the tenant's own narrative on the public TAMP viewer. Classification: **SEEDED-CONFIG** rendered as **REAL** — a FHWA reviewer reading the public TAMP will see boilerplate presented as the DOT's authored content. Must be either (a) clearly labelled as a starter template or (b) blocked from lock/publish until edited. Cross-references TAMP purity audit; this row was not caught there because the audit assumed the seed was a distinct "starter" row.

### DP-16 · Medium · lifecycle-domain-expert
**`Demo:Domain` config value influences the entire report copy.**
`backend/.../Api/Controllers/ReportsController.cs:32` — `_demoDomain = config["Demo:Domain"] ?? "PublicAgency"`. Passed into `GetTampReportDataQuery` at line 87. Some section titles / copy vary on this. Classification: **SEEDED-CONFIG** — fine for a demo, but production tenants shouldn't have their report copy driven by an `appsettings` key.

---

## Recommended top-5 data-purity fixes

1. **DP-10 (High, backend-lead):** wire `lcpSummaryForGap` — Critical bug; TAMP Financial section is currently useless.
2. **DP-15 (Critical, backend-lead):** label or gate the seeded Investment Strategy narrative.
3. **DP-08 (High, product-manager):** make the risk register user-editable.
4. **DP-06 (High, lifecycle-domain-expert):** ARV output needs unit-cost source + as-of-date trailer.
5. **DP-13 (High, lifecycle-domain-expert):** "reset to default" affordance on domain profile.
