# TAMP Data-Purity Audit — Aurigo Maintain

**Date:** 2026-07-23
**Branch:** primusmaintain-v2
**Auditor:** Lifecycle Domain Expert
**Scope:** Every field rendered by `/reports/tamp` (10 chapters, 12 grouped sections, 65+ discrete fields). Assessed against the product-owner bar: **"nothing should be synthetic placeholder data in the TAMP report. Everything must be generated using actual data in the product. Production grade."**

---

## 1. Executive Summary

**65 discrete rendered surfaces reviewed** across the 12 grouped sections of the TAMP report (Meta, Objectives, Inventory, Condition, Risk, Resilience, Repetitive Damage, Life Cycle, Investment, Financial, Performance, Performance Gap, Methodology, Report Metadata).

| Bucket | Count | Notes |
|---|---:|---|
| **REAL** — derived from tenant asset / inspection / claim / narrative rows | 22 | Inventory counts, condition counts, risk band counts, Top-10 critical, repetitive-damage list, per-year investment activities, generated timestamp. |
| **CALCULATED** — deterministic function of REAL data | 12 | %-Good/Poor, backlog $, NHS lane-miles rollups, gap $, cumulative backlog, treatment-mix totals, on-track classification. |
| **SEEDED — CONFIG** — planted by domain-profile seed with a plausible default the tenant rarely overrides | 15 | Unit costs, `ModelSettings` (Deterioration/RUL/Condition/Normalization method), inflation/discount rate, PM2 targets, budget-period totals, objectives, LCP scenario shapes. |
| **SEEDED — NARRATIVE** — literal FHWA-prompted markdown planted by `SeedTampNarrativesAsync` | 7 | InvestmentStrategy, RiskManagement, AssetValuation, ProgressToTargets, StrategyProcess, Resilience, MethodologyNotes narrative bodies. |
| **FALLBACK — HARD-CODED** — `??` default fires when a config row is missing | 5 | `0.05m` fallback deterioration rate, `"TwoPoint"`, `"WeightedAverage"`, `"Linear"`, `0.03m` discount rate, "Not specified" scenario name. |
| **SYNTHETIC — ALGORITHMIC** — fabricated by an in-app heuristic and tagged | 4 | Hazard scores (Flood 100/500, Wildfire, HeatDays, Coastal Surge — all `HazardSource="synthetic"`). |
| **PLACEHOLDER — WIRE STUB** — DTO exists but no impl path populates it in a real tenant | 0 | (Every DTO field has a code path that populates it — but many code paths depend on seeder-planted rows.) |

**Top-3 blockers to production-grade for a state DOT submission:**

1. **Hazard scores are 100% synthetic** (`SeedRunner.cs:339–388`). Row-level `HazardSource="synthetic"` badge is shown only when the report happens to render a source pill — the counts (`AssetsInFlood100yr` etc.) are surfaced with no visual honesty about their fabricated origin. Violates 23 CFR § 515.9(k) resilience "By the numbers" claim.
2. **Narrative sections ship pre-populated with FHWA-prompted templates** that read like tenant-authored prose (`TampNarrativeHandlers.cs:71–226`, planted by `SeedRunner.cs:162–206` for all 7 sections). A reviewer opening `# Investment Strategy → ## 1. Selected funding scenario → _State which of Current/Minimum/Target scenarios…_` sees a filled-in narrative that the tenant never wrote. Violates § 515.9(d), (e), (h), (i), (j), (k).
3. **`FundingSource` rows are NEVER seeded** anywhere (no `new FundingSource` in `SeedRunner.cs` or `PrimusDemoSeeder.cs`). The Financial chapter's federalNhpp/STBG/HSIP/state/local breakdown always sums to $0 on every fresh tenant, but the columns are exposed in the DTO — Sprint T-2 shipped the breakdown fields on `GapByYear` while the seeding side of the contract was never delivered. Violates § 515.9(f).

---

## 2. Classification Legend

- **REAL** — value derives from actual tenant data (asset rows, inspection rows, capital-need rows, LCP-scenario planned-activity rows, emergency-repair-claim rows, tenant-authored narrative rows).
- **CALCULATED** — value derives from REAL data via a documented calculation (e.g. %Good = good count / total).
- **SEEDED — CONFIG** — value comes from a domain-profile-seeded config table (`UnitCostRate`, `ModelSettings`, `InflationConfig`, `PerformanceTarget`, `BudgetPeriod`, `AssetManagementObjective`, `LcpScenario`) that a tenant *can* override in the UI but ships pre-populated. Rendering as "the tenant's data" is misleading if the tenant never touched Configuration.
- **SEEDED — NARRATIVE** — literal markdown placeholder text in `TampNarrativeHandlers.DefaultTemplateFor` planted per-tenant per-section by `SeedTampNarrativesAsync`. Currently renders in the report/tab exactly as if it were the tenant's written narrative.
- **FALLBACK — HARD-CODED** — a `??` default in the report handler (`0.05m`, `0.03m`, `"WeightedAverage"`, `"Linear"`, `"TwoPoint"`, `"Not specified"`). Renders with no indication the tenant never configured the real value.
- **SYNTHETIC — ALGORITHMIC** — value fabricated by an in-app heuristic (Sprint T-6 hazard-score seeder based on lat/lon + asset class + `Random(12345)`). Marked internally with `HazardSource="synthetic"`.
- **PLACEHOLDER — WIRE STUB** — DTO exists but no impl path populates it in a real tenant (no cases in this audit — every field has a populated path, though many paths run on seeded data).

---

## 3. Per-Section Tables

### 3.1 Meta (Chapter 8 rendered as "Report Metadata")

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `planTitle` | `reports.tamp.tsx:1112` | `TampReportHandlers.cs:851` `"Transportation Asset Management Plan"` (hard-coded literal) | **FALLBACK — HARD-CODED** | Always this exact string; no tenant override | Move to `Tenant.TampPlanTitle` field w/ Configuration UI. Trivial — 1 field + 1 Configuration screen row (~0.5 day). |
| `planPeriod` | `reports.tamp.tsx:1113` | `TampReportHandlers.cs:849` `$"{currentYear}–{currentYear+horizonYears}"` | **CALCULATED** | N/A (always computed) | No change needed. |
| `horizonYears` | `reports.tamp.tsx:1114` | `TampReportHandlers.cs:468` from request or 10 | **REAL** (user-selected) | Defaults to 10 if not passed | No change. |
| `scenarioId` | (used, not rendered directly) | `TampReportHandlers.cs:854` from request | **REAL** | Null if not selected | No change. |
| `scenarioName` | `reports.tamp.tsx:1115, 846` | `TampReportHandlers.cs:855` `scenario?.Name ?? "Not specified"` | **REAL** or **FALLBACK — HARD-CODED** when no scenario | "Not specified" | Suppress the whole Meta row when null (hide, don't apologize). ~15 min. |
| `generatedAt` | `reports.tamp.tsx:1116` | `TampReportHandlers.cs:705` `DateTime.UtcNow.ToString("O")` | **REAL** | N/A | No change. |

### 3.2 § 515.9(b) Asset Management Objectives (Chapter 1 sub-block)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `objectives[].name` / `.description` / `.ownerName` / `.targetDate` / `.status` / `.linkedMetrics` | `reports.tamp.tsx:614–644` | `TampReportHandlers.cs:665–670`, seeded at `SeedRunner.cs:217–252` | **SEEDED — CONFIG** — 3 canned objectives planted per tenant on first boot ("Achieve state of good repair on NHS Interstates by 2035", "Reduce statewide backlog by 30%", "Improve extreme-weather resilience") | 3 canned objectives with prescribed status/owner strings, e.g. `OwnerName = "Chief Engineer"`. FHWA reviewer sees fictitious ownership. | **Delete seed content, show empty-state.** Objectives already have a Configuration UI (`configuration.objectives.tsx`); starter rows should not ship in production. ~1 day (remove seeder + update tests). |

### 3.3 Inventory (Chapter 1)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `inventory.totalAssets` | `reports.tamp.tsx:590` | `TampReportHandlers.cs:923` `assets.Count` | **REAL** | 0 | No change. |
| `inventory.totalReplacementValueM` | `reports.tamp.tsx:591` | `TampReportHandlers.cs:867, 924` sum of `latestArv.FinalArv` | **CALCULATED** (over REAL) | $0 if no ARV calcs run | No change; UI already shows $0 cleanly. |
| `inventory.backlogToStateOfGoodRepairM` | (not currently rendered — DTO-only) | `TampReportHandlers.cs:873–879, 926` | **CALCULATED** | $0 | Frontend gap — surface as KPIBox. ~30 min. |
| `inventory.byClass[].className` | `reports.tamp.tsx:653` | `TampReportHandlers.cs:881` group-by AssetClass.Name | **REAL** | N/A | No change. |
| `inventory.byClass[].count` | `reports.tamp.tsx:654` | `TampReportHandlers.cs:914` | **REAL** | 0 | No change. |
| `inventory.byClass[].totalArvM` | `reports.tamp.tsx:655` | `TampReportHandlers.cs:915` | **CALCULATED** — depends on `UnitCostRate` (SEEDED — CONFIG) driving ARV | $0 if no ARV calc | Real if tenant has recorded/imported unit costs and run ARV; today rides on seed rates from `SeedRunner.cs:695–766`. |
| `inventory.byClass[].avgConditionGrade` | `reports.tamp.tsx:657` | `TampReportHandlers.cs:916` `ResolveEffectiveGrade` mode | **CALCULATED** (over REAL condition history) | "N/A" | No change. |
| `inventory.byClass[].nhsLaneMiles` | (not rendered — DTO-only) | `TampReportHandlers.cs:905–917` | **REAL** (from `PavementConditionRecord.LaneMiles`) or null | null | Frontend gap. |

### 3.4 Condition (Chapter 2)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `condition.excellentCount / goodCount / fairCount / poorCount / criticalCount / noDataCount` | `reports.tamp.tsx:678–691` | `TampReportHandlers.cs:939–951` grade-tally loop | **CALCULATED** over REAL condition + NBI history | Full counts of `noData` if no `ConditionHistory` rows | No change. |
| `condition.pctGoodOrBetter` / `pctPoorOrWorse` | `reports.tamp.tsx:672–673` | `TampReportHandlers.cs:954–959` | **CALCULATED** | 0% | No change. |
| `condition.byClass[].avgNormalized` | `reports.tamp.tsx:700` | `TampReportHandlers.cs:979–981` mean of `NormalizedScore` | **CALCULATED** | 0 | No change. |
| `condition.byClass[].dominantGrade` | `reports.tamp.tsx:702` | `TampReportHandlers.cs:983–988` | **CALCULATED** | "N/A" | No change. |
| `condition.byClass[].count` | `reports.tamp.tsx:699` | as above | **REAL** | 0 | No change. |
| `condition.byClass[].avgIri` | (not rendered — DTO-only) | `TampReportHandlers.cs:990–999` | **REAL** if PCR seeded; today ROAD/STREET PCRs are seeded from a fixed `pavProfiles[]` cycle at `SeedRunner.cs:2139–2151` (Good/Fair/Poor pattern) | Real IRI never entered — the profile array cycles Good→Good→Good→Fair→Fair→…→Poor→Good | UNCLEAR — needs verification with a fresh vanilla tenant (no `NhsConditions` seed). In demo mode, values LOOK REAL but are pattern-cycled from a fixed 10-entry array. **Delete seeder, require real IRI import.** Med — 2 days incl. import pipeline. |
| `condition.byClass[].nbiSourced` | (not rendered — DTO-only) | `TampReportHandlers.cs:1003–1005` | **REAL** — true only if `AssetNbiDetail.NbiGrade` populated | false | Surface as badge in UI. ~30 min. |

### 3.5 Risk (Chapter 3)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `risk.lowCount / mediumCount / highCount / criticalCount` | `reports.tamp.tsx:726–729` | `TampReportHandlers.cs:1023–1034` band-tally over `latestRisk` | **CALCULATED** over REAL `RiskScore` rows | 0 | No change. |
| `risk.top10Critical[]` (assetId, name, class, score, band, lof, cof) | `reports.tamp.tsx:737–744` | `TampReportHandlers.cs:1038–1054` | **REAL** | empty | No change. |

### 3.6 Resilience (§ 515.9(k) — Chapter 3 sub-block)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `resilienceMetrics.assetsWithScore` / `totalAssets` | `reports.tamp.tsx:763` | `TampReportHandlers.cs:1080–1082` | **CALCULATED** over SEEDED-SYNTHETIC data | shows "1200 of 1200 assets scored" — misleading since 100% of scores are synthetic | Show `assetsWithScore` as the **real-source** count only; badge synthetic rows separately. |
| `resilienceMetrics.assetsInFlood100yr` | `reports.tamp.tsx:767` | `TampReportHandlers.cs:1073` | **SYNTHETIC — ALGORITHMIC** — `SeedRunner.cs:357` bridges/culverts get `0.6 + rand*0.35`; pavement `0.2 + rand*0.30`; other `rand*0.20`. Counted as ≥0.5 | Non-zero count fabricated per demo | **Real ingestion pipeline** (FEMA MSC flood zones — see Blocker 1). Est 5–10 days. |
| `resilienceMetrics.assetsInFlood500yr` | `reports.tamp.tsx:768` | `TampReportHandlers.cs:1074`, seed `SeedRunner.cs:360` `flood100+0.10` | **SYNTHETIC — ALGORITHMIC** | Non-zero fabricated | As above (FEMA). |
| `resilienceMetrics.assetsInHighWildfireRisk` | `reports.tamp.tsx:769` | `TampReportHandlers.cs:1075`, seed `SeedRunner.cs:363–365` (higher inside 29.5–33.5°N band) | **SYNTHETIC — ALGORITHMIC** | Non-zero fabricated | **Real ingestion pipeline** (USDA Forest Service Wildfire Risk to Communities). |
| `resilienceMetrics.assetsHeatStressed` | `reports.tamp.tsx:770` | `TampReportHandlers.cs:1076`, seed `SeedRunner.cs:367–369` `90 - (lat-25)*5 + rand(-10,10)` | **SYNTHETIC — ALGORITHMIC** | Non-zero fabricated | **Real ingestion pipeline** (NOAA NCEI Local Climatological Data). |
| `resilienceMetrics.assetsInCoastalSurgeZone` | `reports.tamp.tsx:771` | `TampReportHandlers.cs:1077`, seed `SeedRunner.cs:371–375` (Gulf-only, lon -97.5 to -95.5) | **SYNTHETIC — ALGORITHMIC** | Non-zero for lat/lon-eligible; null otherwise | **Real ingestion pipeline** (USGS CoSMoS or NOAA SLOSH). |
| `resilienceMetrics.sources[]` | `reports.tamp.tsx:775–787` | `TampReportHandlers.cs:1078` `.Distinct()` on `HazardSource` | **CALCULATED** — always yields `["synthetic"]` today; UI does render an amber badge but the numbers upstream carry the same weight visually | `["synthetic"]` | UI has the honest badge (`s.toLowerCase().includes('synthetic')`); the fix is **making the fix visible sooner** — grey out the whole block or replace numbers with "—" when only synthetic sources present. ~1 hr. |

### 3.7 Repetitive Damage (23 CFR Part 667 — Chapter 3 sub-block)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `repetitiveDamageAssets[].assetId / assetCode / assetName / assetClass` | `reports.tamp.tsx:816–819` | `TampReportHandlers.cs:686–694` from `AssetEmergencyRepairClaim` group-by | **REAL** if claims real; today claims are **SEEDED — CONFIG** at `SeedRunner.cs:265–298` (2 assets seeded with 3 and 2 fake claims respectively) | Shows 2 fabricated repetitive-damage assets ("Flood ER-XX-2025-014", "Hurricane ER-XX-2024-002") | **Delete seeder, show empty-state.** ER claims must be tenant-imported or entered. ~0.5 day. |
| `repetitiveDamageAssets[].claimCount / totalDamage / mostRecentClaimDate / mostRecentEventType` | `reports.tamp.tsx:820–823` | `TampReportHandlers.cs:687–694` aggregations | **CALCULATED** over REAL/SEEDED claims | as above | As above. |

### 3.8 LifeCycle (Chapter 4)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `lifeCycle.scenarioType` | `reports.tamp.tsx:850` | `TampReportHandlers.cs:1114` `scenario.Type.ToString()` | **REAL** (from selected `LcpScenario`) or null | "No scenario selected" empty state | No change. Scenario itself is SEEDED CONFIG (`SeedRunner.cs:2751–2814`), but tenant picks. |
| `lifeCycle.totalNpvCostM` | `reports.tamp.tsx:855` | `TampReportHandlers.cs:1099` `summary.TotalNpvCost` | **CALCULATED** (from `LcpEngine`) | null | No change. Real once scenario runs. |
| `lifeCycle.treatmentMix[].tier / activityCount / totalCostM / affectedAssets` | `reports.tamp.tsx:865–868` | `TampReportHandlers.cs:1101–1109` group-by `PlannedActivity` | **REAL** (from `LcpEngine` output) | empty | No change. |
| `lifeCycle.scenarioComparison[]` (year, currentPctGood, minimumPctGood, targetPctGood, deltas) | (not rendered) | `TampReportHandlers.cs:1200–1237` | **CALCULATED** from three `LcpScenarioSummary.ConditionByYearJson` | empty when caller doesn't pass all 3 scenario ids | Frontend gap — this is the § 515.9(b) required 3-scenario compare. High priority. ~1 day FE. |
| `lifeCycle.targetProjections[]` | (not rendered — no dedicated table) | `TampReportHandlers.cs:1131–1170` | **CALCULATED** from scenario `PctGood` trajectory (proxy) | empty | Called out in tamp.md as Sprint T-6 refinement — per-asset-class trajectory rather than proxy. Medium. |
| `lifeCycle.progressToTargetsNarrative` | rendered in the Progress-to-Targets tab (not the main report grid) | `TampReportHandlers.cs:593–597` from `TampNarrative` row | **SEEDED — NARRATIVE** — planted verbatim from `TampNarrativeHandlers.cs:120–140` | Full FHWA-prompted markdown appears as if authored | See § 5 fix pattern. |

### 3.9 Investment (Chapter 5)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `investment.byYear[].fiscalYear / fundedCostM / deferredCostM / fundedActivities / deferredActivities` | `reports.tamp.tsx:911–915` | `TampReportHandlers.cs:1271–1280` from `PlannedActivity` rows | **REAL** — LCP engine output on real tenant data if scenario is selected | empty when no scenario | No change. |
| `investment.districtBreakdown[].district / totalCostM / pctOfTotal` | (not rendered) | `TampReportHandlers.cs:1292–1317` from `LcpScenarioSummary.CostByRegionJson` | **REAL** or empty | empty when no region rollup | Frontend gap — this is table-stakes for a multi-district DOT. Medium. |

### 3.10 Financial (Chapter 6)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `fundingGap[].fiscalYear` | `reports.tamp.tsx:984` | driven by `BudgetPeriod.FiscalYear` | **REAL** or **SEEDED — CONFIG** — BudgetPeriods are seeded FY2025–FY2035 with domain-shaped totals per `SeedRunner.cs:2563–2685` | FY2025–FY2035 rows visible even on fresh tenant | Med — allow tenant to delete seed budgets in Configuration; UI already has this. |
| `fundingGap[].totalNeedM` | `reports.tamp.tsx:985` | `TampReportHandlers.cs:1385` from `lcpSummaryForGap.CostByYearJson` (currently passed as `null` — see `TampReportHandlers.cs:629`!) | **CALCULATED** — but the `lcpSummaryForGap` arg is HARD-CODED NULL in the handler call. Every row shows `$0` even with a scenario selected. | $0 in every row | **BUG** — pass the scenario's summary through to `BuildFinancial`. ~1 hr. Frontend already surfaces the amber warning at `reports.tamp.tsx:937–942`. |
| `fundingGap[].availableBudgetM` | `reports.tamp.tsx:986` | `FundingGapCalculator` over `BudgetPeriod.TotalBudget` | **SEEDED — CONFIG** — from seed `BudgetPeriod` rows | Seed values ($5.5M–$8M etc.) | Tenant must edit. |
| `fundingGap[].gapM` / `cumulativeBacklogM` | `reports.tamp.tsx:995–1002` | calculator output | **CALCULATED** | 0 | No change (rolls up from above). |
| `fundingGap[].federalNhppM / federalStpM / federalHsipM / stateM / localM` | (not rendered — DTO-only) | `TampReportHandlers.cs:1341–1397` from joined `FundingSource` rows | **REAL** — but **NO SEED PLANTS `FundingSource` ROWS** in `SeedRunner.cs` or `PrimusDemoSeeder.cs` | Always $0 for every year | **BUG — half-shipped contract.** DTO exists (Sprint T-2), no seed data + no Configuration UI flow to enter. Blocker for § 515.9(f). ~2 days: minimal Configuration UI + optional seed. |
| `fundingGap[].programmedSpendM` | `reports.tamp.tsx:993` | `TampReportHandlers.cs:1394–1397` from `CapitalNeed.PlanStatus in (Approved, Delivered)` | **REAL** (from real capital-need rows and their Aurigo Plan status) | $0 | No change. |

### 3.11 Performance Targets (Chapter 7)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `performance.targets[].metricName` | `reports.tamp.tsx:1029` | `MetricLabels.For(t.MetricType)` — FHWA verbatim | **CALCULATED** (from enum → label) | N/A | No change. |
| `performance.targets[].twoYearTarget / fourYearTarget` | `reports.tamp.tsx:1030–1031` | from `PerformanceTarget` | **SEEDED — CONFIG** — seeded PavementGoodPct 45/48/52, PavementPoorPct 10/8/5, BridgeGoodPct 48/50/55, BridgePoorPct 12/10/7 with note `"Baseline from 2023 HPMS submittal"` (`SeedRunner.cs:2469–2508`) | Fabricated baselines and targets appear as tenant commitments | **Hide until tenant confirms in Configuration.** The note `"Baseline from 2023 HPMS submittal"` is fabricated and dangerous — FHWA reviewer will cross-check against HPMS and find a mismatch. ~1 day (remove seed, add empty-state, add "Import from HPMS" affordance). |
| `performance.targets[].currentActual` | `reports.tamp.tsx:1032` | latest `PerformanceActual.ActualValue` | **SEEDED — CONFIG** — `SeedRunner.cs:2224–2235` plants 12 `PerformanceActual` history snapshots (2022/2023/2024 for each of 4 metrics) with prescribed drift patterns (PavementGoodPct 49.2→46.8→44.1 etc.) | Fabricated 3-year trend | **Delete seeder, real ingestion (HPMS + NBI import).** Bigger — 5 days. |
| `performance.targets[].complianceStatus` | `reports.tamp.tsx:1039` | `TampReportHandlers.cs:1421–1441` OnTrack/AtRisk/Insufficient banding | **CALCULATED** — but 100% dependent on the fabricated `currentActual` and `fourYearTarget` above | fabricated | Real when the two inputs are real. |
| `performance.targets[].trajectory.years[] / .values[]` | rendered via `PerformanceTrajectorySparkline` | `TampReportHandlers.cs:518–529` from `PerformanceActualHistory` | **REAL** ONLY from the migration backfill (`20260722000040_TampVersionAndPerformanceTrajectory` copies one row per `PerformanceActual` into history) — no ongoing ingestion path | Single-point sparkline from backfill | UNCLEAR — needs verification. Trajectory is REAL relative to what the DB holds, but the DB is fed by `PerformanceActual` seed rows above; the sparkline inherits the fabrication chain. |

### 3.12 Performance Gap (Chapter 7 sub-block, § 515.9(c))

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `performanceGap.rows[].metricName / currentValue / fourYearTarget / gapAbs / gapDirection / projectedClosureYear / scenarioAdequacy` | `reports.tamp.tsx:1078–1097` | `TampReportHandlers.cs:715–766` | **CALCULATED** over the same PM2 target rows + latest actual + projected trajectory | Empty when no targets, else fabricated (same chain as Performance) | Fix inherits from Performance target fix above. |

### 3.13 Methodology (Chapter 9 — § 515.9(j))

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `methodology.deteriorationModel` | `reports.tamp.tsx:1145` | `TampReportHandlers.cs:784` `settings?.DeteriorationModel ?? "TwoPoint"` | **SEEDED — CONFIG** ("TwoPoint" seeded at `SeedRunner.cs:802`) or **FALLBACK — HARD-CODED** if ModelSettings deleted | "TwoPoint" always | Add `(default — not tenant-configured)` tag when value comes from `??`. ~30 min. |
| `methodology.fallbackDeteriorationRate` | `reports.tamp.tsx:1154` | `TampReportHandlers.cs:785` `settings?.DefaultDeteriorationRate ?? 0.05m` | **FALLBACK — HARD-CODED** (5%/yr — no source citation) | 0.05 | AASHTO gives per-material rates 2–7%/yr; 5% is a reasonable round-number placeholder but MUST be tenant-editable + cited. **Move to Configuration → Domain Profile UI.** ~1 day. |
| `methodology.deteriorationCurves[]` | `reports.tamp.tsx:1174–1189` | `TampReportHandlers.cs:793–806` — mean of `Asset.CalibratedDeteriorationRate` per class; else fallback | **CALCULATED** OR **FALLBACK** — `CalibratedDeteriorationRate` is NEVER seeded (grep confirms zero seeds). Every row shows `source="fallback"` at 5% for every class today. | Every class shows 5.00% "fallback" badge | **Delete seed content, show empty-state.** Requires running the `CalibrateAssetDeteriorationRate` handler on real inspection history. Med — 2 days incl. calibration cron. Frontend already renders the "fallback" badge in amber, which is honest. |
| `methodology.unitCosts[].assetClassName / subType / uom / currentRate / effectiveDate / vintage` | `reports.tamp.tsx:1214–1229` | `TampReportHandlers.cs:811–821` from `UnitCostRate` | **SEEDED — CONFIG** — rates loaded from `seeds/unit-cost-rates.json` (public-agency) or hard-coded per-domain arrays at `SeedRunner.cs:706–732` with `EffectiveDate = DateTime.UtcNow` | Seed rates + today's date | The "current" vintage badge is misleading — `EffectiveDate = UtcNow` means the seed always shows as fresh. **Move to Configuration → Domain Profile UI** + require real bid-tab CSV import for production use. Med-High — 3–5 days for a proper import module. |
| `methodology.discountRate` | `reports.tamp.tsx:1137` | `TampReportHandlers.cs:823` `inflation?.Rate ?? 0.03m` | **SEEDED — CONFIG** (`SeedRunner.cs:774` `Rate = 0.03m`) or **FALLBACK** | 0.03 (3%) | OMB Circular A-94 real discount rate for infrastructure is currently 2% (2026 update); 3% is a widely-used TAMP default but must be tenant-set with a citation. **Move to Configuration → Domain Profile UI.** ~0.5 day. |
| `methodology.discountRateEffectiveDate` | `reports.tamp.tsx:1153` | `TampReportHandlers.cs:824` `(inflation?.EffectiveDate ?? UtcNow)` | **FALLBACK** — always today's date on seed | today | Same fix as unit costs — real `EffectiveDate` on import. |
| `methodology.horizonYears` | `reports.tamp.tsx:1141` | `TampReportHandlers.cs:825` `scenario?.HorizonYears ?? horizonYears` | **REAL** (scenario) or **REAL** (user request) | 10 | No change. |
| `methodology.conditionScoringMethod` | `reports.tamp.tsx:1150` | `TampReportHandlers.cs:786` `settings?.ConditionScoringMethod ?? "WeightedAverage"` | **SEEDED — CONFIG** or **FALLBACK** | "WeightedAverage" | Add `(default — not tenant-configured)` tag. ~15 min. |
| `methodology.normalizationMethod` | `reports.tamp.tsx:1151` | `TampReportHandlers.cs:787` `settings?.NormalizationMethod ?? "Linear"` | **SEEDED — CONFIG** or **FALLBACK** | "Linear" | Same. |
| `methodology.rulModel` | `reports.tamp.tsx:1152` | `TampReportHandlers.cs:788` conditional expression | **SEEDED — CONFIG** or **FALLBACK** | "TwoPoint + Fallback" | Same. |
| `methodology.methodologyNotesNarrative` | `reports.tamp.tsx:1248–1252` (rendered via markdown) | `TampReportHandlers.cs:654–658` from `TampNarrative` row seeded at boot with `DefaultTemplateFor(MethodologyNotes)` at `TampNarrativeHandlers.cs:199–224` | **SEEDED — NARRATIVE** | Full FHWA-prompted markdown appears as authored | § 5 fix. |

### 3.14 Narrative tab bodies (Investment Strategy / Progress to Targets / Strategy Process / Resilience / Methodology Notes)

| Field | Frontend | Backend | Classification | If unset today | Fix |
|---|---|---|---|---|---|
| `TampNarrative.Markdown` for `InvestmentStrategy` | `TampNarrativeTab` in Investment Strategy tab | `TampNarrativeHandlers.cs:73–99` template planted by `SeedRunner.cs:190–199` | **SEEDED — NARRATIVE** | 4-heading FHWA-prompted markdown with italicized instruction text (looks tenant-authored) | § 5 fix. |
| `TampNarrative.Markdown` for `ProgressToTargets` | Progress-to-Targets tab | `TampNarrativeHandlers.cs:120–140`, same seed path | **SEEDED — NARRATIVE** | Same pattern | § 5 fix. |
| `TampNarrative.Markdown` for `StrategyProcess` | Strategy Process tab | `TampNarrativeHandlers.cs:142–165` | **SEEDED — NARRATIVE** | Same pattern | § 5 fix. |
| `TampNarrative.Markdown` for `Resilience` | Resilience tab | `TampNarrativeHandlers.cs:167–197` | **SEEDED — NARRATIVE** | Same pattern | § 5 fix. |
| `TampNarrative.Markdown` for `MethodologyNotes` | Methodology tab + rendered inside Chapter 9 | `TampNarrativeHandlers.cs:199–224` | **SEEDED — NARRATIVE** | Same pattern | § 5 fix. |
| `TampNarrative.Markdown` for `RiskManagement` | (no dedicated tab wired) | `TampNarrativeHandlers.cs:101–111` | **SEEDED — NARRATIVE** | Same pattern | § 5 fix. |
| `TampNarrative.Markdown` for `AssetValuation` | (no dedicated tab wired) | `TampNarrativeHandlers.cs:113–118` | **SEEDED — NARRATIVE** | Same pattern | § 5 fix. |

### 3.15 Report Metadata (Chapter 8)

Covered under 3.1 Meta.

---

## 4. The 4 Pre-Known Synthetic Sources

| Source | Status | Sprint / Ticket | Escalation |
|---|---|---|---|
| **Hazard scores** (5 metrics × N assets) | Ships as `HazardSource="synthetic"`; T-6.b was to ingest FEMA / NOAA / USDA. **Not started.** | Sprint T-6.b (planned) | Blocker 1 below. Requires 3 real-data adapters + `INSERT ON CONFLICT` overwrite logic (already scaffolded per the seeder comment at `SeedRunner.cs:325`). |
| **All 7 narrative section seed templates** | Ships as literal markdown planted per-tenant per-section. Currently indistinguishable from tenant-authored content when rendered. | Not scheduled | Blocker 2. Fix pattern: delete seeder + empty-state UI. |
| **4 methodology fallback defaults** (`0.05m`, `0.03m`, `"WeightedAverage"`, `"Linear"`, `"TwoPoint"`) | Fires when tenant deletes `ModelSettings` / `InflationConfig` singletons; otherwise SEEDED — CONFIG at plausible values. UI has no `(default — not configured)` tag. | Not scheduled | Blocker 4. Cheap fix (~1 day). |
| **Domain-profile seeded configs** (`UnitCostRate` rows, `PerformanceTarget` rows, `BudgetPeriod` rows, `AssetManagementObjective` rows, `LcpScenario` rows) | Planted on first tenant boot; tenant *can* override in the UI but the report renders them regardless. `EffectiveDate = UtcNow` makes the unit-cost "vintage" badge always green. | Not scheduled | Blocker 5. Requires either "empty-state until configured" for high-stakes fields (PM2 targets, ER claims) or "prominent seed provenance banner" for lower-stakes (unit costs, LCP scenario shapes). |

---

## 5. Fix Recommendation Summary

| Fix Pattern | Applies To | Count | Estimated Effort |
|---|---|---:|---|
| **Delete seed content, show empty-state** | 7 narrative bodies (§ 3.14), 3 objectives (§ 3.2), 2 ER claim sets (§ 3.7), 4 PM2 targets + 12 actuals (§ 3.11) | 4 seeders removed | ~3 days (remove seeders + add "not authored yet — click to write" empty states + update tests) |
| **Add explicit `(default — not configured)` tag** | 5 methodology fallbacks (§ 3.13), scenario name "Not specified" (§ 3.1), `planTitle` fallback | 7 fields | ~1 day (backend flag + frontend badge) |
| **Hide the row entirely until configured** | Every currently-hidden DTO field surfaced by removing the seed data (funding-source breakdown, calibrated deterioration curves, unit-cost vintage badge) | 5+ | Included in above |
| **Real ingestion pipeline** | Hazard scores (5 metrics), unit costs (real bid-tab CSV import), PM2 actuals (HPMS + NBI import), ER claims (FHWA ER database import), calibrated deterioration rates (calibration cron over inspection history) | 5 pipelines | ~25 days total (5 days each) |
| **Move to Configuration → Domain Profile UI** | Discount rate, fallback deterioration rate, condition-scoring / normalization / RUL model, unit-cost rate editor, PM2 target editor | 5 config surfaces | ~5 days (Configuration UI already exists — extend with these forms) |
| **Fix bug** | `TampReportHandlers.cs:629` passes `lcpSummaryForGap: null` unconditionally → Financial `TotalNeed` always $0 | 1 bug | ~1 hr |
| **Seed `FundingSource` rows OR require configuration** | § 515.9(f) breakdown fields | 1 gap | ~2 days |

**Total effort:** ~36 person-days across all patterns (excluding the FEMA / NOAA / USDA data-supplier procurement conversations, which are calendar-time, not person-day).

---

## 6. Blockers to Production-Grade (State DOT Submission-Ready)

Ordered by severity. Cross-referenced to the FHWA § 515.9 sub-item each blocker violates.

1. **[CRITICAL] Hazard scores are 100% synthetic and rendered as counts.**
   Violates § 515.9(k) resilience "by the numbers" claim + § 515.9(e)(2) BIL requirement.
   Fix: real FEMA/NOAA/USDA ingestion + strip synthetic rows from `AttachResilience` when `HazardSource="synthetic"`. Effort: ~10 days per hazard type, calendar-time gated on FEMA MSC API onboarding.

2. **[CRITICAL] 7 narrative sections ship pre-populated with FHWA-prompted templates that read as tenant-authored.**
   Violates § 515.9(d) Investment Strategy, § 515.9(e) Risk, § 515.9(f) Financial Plan, § 515.9(h) Progress-to-Targets, § 515.9(i) Strategy Process, § 515.9(j) Methodology, § 515.9(k) Resilience — every subsection where reviewers score the narrative.
   Fix: delete `SeedTampNarrativesAsync`, materialize on-open (already supported by `GetTampNarrativeHandler`), rewrite templates to be BLANK with the FHWA prompt in a floating drawer instead of the body. Effort: ~2 days.

3. **[CRITICAL] `FundingSource` rows never seeded → § 515.9(f) breakdown is $0.**
   Handler `BuildFinancial` calls `.Include(b => b.FundingSources)` but the DTO fields `federalNhppM/federalStpM/federalHsipM/stateM/localM` always sum to 0 because no seeder plants source rows. Wire contract half-shipped.
   Fix: Configuration UI to add funding sources to a `BudgetPeriod` (Financial module already has the API — `FinancialHandlers.cs:177`). Effort: ~2 days FE.

4. **[HIGH] PM2 targets, actuals, and 3-year drift are hard-coded fabrications with a `"Baseline from 2023 HPMS submittal"` note.**
   Violates § 515.9(g) performance-measure representations. FHWA cross-checks HPMS values.
   Fix: delete seed, add "Import from HPMS" affordance in Configuration → Performance. Effort: ~5 days (import + validation).

5. **[HIGH] `BuildFinancial` is called with `lcpSummaryForGap: null`** (`TampReportHandlers.cs:629`) so every FY row's `totalNeedM` renders `$0` even with a scenario selected. The frontend has the amber warning banner, but the honest fix is passing the summary through. Effort: ~1 hr.

6. **[HIGH] Repetitive-damage assets are seeded** — Reviewer opens Chapter 3 and sees 2 fabricated Part 667 assets with fake FHWA ER reference numbers (`"ER-XX-2025-014"`).
   Violates 23 CFR Part 667 tracking requirement (fabricated claims not backed by ER records).
   Fix: delete `SeedEmergencyRepairClaimsAsync`, require import from state's ER system. Effort: ~0.5 day (delete + empty-state).

7. **[MEDIUM] `BudgetPeriod` rows FY2025–FY2035 are pre-seeded with domain-shaped totals.**
   Violates § 515.9(f) financial plan authenticity.
   Fix: delete seed, add "Import prior-year adopted budget" affordance. Effort: ~1 day.

8. **[MEDIUM] `AssetManagementObjective` rows (3 canned objectives with fake owners like "Chief Engineer" / "Resilience Program Manager") ship pre-populated.**
   Violates § 515.9(b) — objectives must be agency-authored.
   Fix: delete `SeedObjectivesAsync`, empty-state UI already exists in `configuration.objectives.tsx`. Effort: ~0.5 day.

9. **[MEDIUM] Unit-cost rates always show `vintage="current"`** because `EffectiveDate = UtcNow` at seed time. Reviewer trusts the "current" badge; actual data is 2026-Q1 arbitrary numbers.
   Violates § 515.9(j) — methodology documentation of unit-cost source and vintage.
   Fix: seed with `EffectiveDate = new DateTime(2024, 1, 1)` so it lights up as `"stale (>3yr)"` OR delete seed. Effort: ~1 hr for the honest badge; ~5 days for bid-tab import.

10. **[MEDIUM] `LcpScenario` shapes (Unconstrained / Constrained / DoNothing) with domain-specific budget caps are pre-seeded.**
    Not itself a violation — LCP scenarios ARE tenant-configurable — but the "20-Year Baseline (Unconstrained)" name and $6M cap ships for every public-agency tenant.
    Fix: leave as example but rename to "Example — Unconstrained (edit before submitting TAMP)". Effort: ~15 min.

11. **[LOW — cosmetic]** `planTitle` is a hard-coded string `"Transportation Asset Management Plan"` (`TampReportHandlers.cs:851`). Real TAMPs are titled "[Agency] Transportation Asset Management Plan, [Cycle FY–FY]". Effort: ~30 min for a Tenant-level field.

---

## 7. Effort Estimate per Fix Pattern

| Pattern | Person-days | Feeds into MVP1 Execution Plan Phase |
|---|---:|---|
| Delete seed content, show empty-state | 3 | Phase 5 (TAMP depth) |
| Add explicit `(default — not configured)` tag | 1 | Phase 5 |
| Hide row until configured | (incl. above) | Phase 5 |
| Real ingestion pipeline (hazards, HPMS, NBI, bid tabs, ER, calibration) | 25 | Phase 4 (integration builds) + Phase 5 |
| Move to Configuration → Domain Profile UI | 5 | Phase 5 |
| Fix `lcpSummaryForGap: null` bug | 0.1 | Phase 5 (immediate) |
| Seed / configure `FundingSource` rows | 2 | Phase 5 |
| **Total (excluding calendar-time on 3rd-party data agreements)** | **~36 person-days** | **Phase 4 + Phase 5** |

Feed this into `vol-8-roadmaps/11-mvp1-execution-plan.md` Phase 5 (TAMP depth, currently 4–6 weeks scoped). **The 36-day estimate is consistent with Phase 5 if two engineers pair on it.** The FEMA / NOAA / USDA ingestion side is the calendar-time risk, not engineer-days.

---

## 8. Cross-References

- Sibling audit: [`vol-3-architecture/17-tenant-isolation-audit.md`](17-tenant-isolation-audit.md) — same format template.
- Domain spec: [`vol-2-product-knowledge/domains/tamp.md`](../vol-2-product-knowledge/domains/tamp.md) — 15 TAMP requirements, 10 product opportunities.
- Companion gaps: [`vol-6-integration-strategy/00-companion-gap-analysis.md`](../vol-6-integration-strategy/00-companion-gap-analysis.md) — Atom AI / AgileAssets / Maximo integration completeness.
- BrM / AASHTOWare adapter: [`vol-6-integration-strategy/19-brm-aashtoware.md`](../vol-6-integration-strategy/19-brm-aashtoware.md) — required to eliminate the NBI-condition seeder.
- HPMS export/import: [`vol-6-integration-strategy/20-hpms.md`](../vol-6-integration-strategy/20-hpms.md) — required to eliminate the pavement IRI + PM2 target/actual seeders.
- Aurigo Plan bidirectional: [`vol-6-integration-strategy/22-aurigo-plan-bidirectional.md`](../vol-6-integration-strategy/22-aurigo-plan-bidirectional.md) — feeds `programmedSpendM` (already REAL).
- Atom AI: [`vol-6-integration-strategy/21-atom-ai.md`](../vol-6-integration-strategy/21-atom-ai.md).
- Execution plan: [`vol-8-roadmaps/11-mvp1-execution-plan.md`](../vol-8-roadmaps/11-mvp1-execution-plan.md) — Phase 5 (TAMP depth) absorbs the fix effort.
- Out-of-scope: [`vault/Out-of-Scope.md`](../../vault/Out-of-Scope.md) — none of the fixes here breach the scope boundary.
- Seed code: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/SeedRunner.cs` (single source for all seed steps).
- Report handler: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Reports/TampReportHandlers.cs`.
- Narrative handler + templates: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Reports/TampNarrativeHandlers.cs`.
- Render tree: `frontend/asset-maintenance-web/src/routes/reports.tamp.tsx`.
