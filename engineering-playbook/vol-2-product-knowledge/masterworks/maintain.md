# Masterworks Maintain — Asset Intelligence for Public Agencies

## Purpose

Masterworks Maintain is the asset intelligence platform for public infrastructure agencies. It gives agencies what their existing maintenance management systems cannot: a complete, current, condition-based picture of their asset network, a defensible 10-year capital needs forecast, and the compliance documentation that federal agencies require for Transportation Asset Management Plans.

Masterworks Maintain is explicitly not a CMMS. It does not manage work orders. It does not schedule preventive maintenance. It does not track spare parts inventory. Those functions remain in the agency's existing systems — IBM Maximo, Cityworks, Infor EAM, or whatever work order system the maintenance team relies on. Maintain reads from those systems (via integration) and provides the intelligence layer above them.

The distinction is critical: **EAMs tell you what happened. Maintain tells you what will happen and what it will cost.**

A state DOT with IBM Maximo knows exactly how many maintenance work orders were completed on its bridge inventory last year and what they cost. Maximo is excellent at this. What Maximo cannot tell the agency is: of the 2,400 bridges in the state network, which 50 have the highest probability of dropping below the structural sufficiency threshold in the next three years, what will it cost to rehabilitate or replace them, and which of those projects should be funded first given a constrained budget? That is the question Maintain answers.

## What Masterworks Maintain Is For

Maintain serves a specific set of decisions that every public infrastructure agency must make:

1. **Which assets are most at risk?** (Condition scoring, risk scoring, deterioration modeling)
2. **How long will they last without intervention?** (Remaining Useful Life)
3. **What will it cost to fix them?** (Asset Replacement Value, unit cost models)
4. **When should we fund the intervention?** (Capital needs analysis, year-of-need forecast)
5. **How do we justify the investment?** (TAMP compliance, capital needs reports, executive dashboards)
6. **What happens if we don't fund it?** (Risk-based scenario analysis, deferred maintenance backlog quantification)

## Asset Classes Tracked

Masterworks Maintain supports the full range of public sector infrastructure asset classes:

| Asset Class | Key Attributes | Condition Rating Scale |
|-------------|---------------|----------------------|
| NHS Pavement | Route, surface type, IRI, rut depth, cracking | International Roughness Index (IRI), PASER (1-10) |
| Bridges | Structure ID, NBI items, deck area, ADT | NBI sufficiency rating (0-100), structural condition (Good/Fair/Poor) |
| Culverts | Material, diameter, length, headwall | Visual condition (0-5 scale) |
| Signs | Type, retroreflectivity, installation year | Retroreflectivity score (cd/lux/m²) |
| Signals | Age, controller type, detection type | Asset age index, component condition |
| Sidewalks | Width, surface, barrier compliance | Visual condition (0-5 scale), ADA compliance |
| Drainage | Type, capacity, sediment level | Hydraulic capacity index |
| Transit Vehicles | Fleet type, age, mileage | Fleet condition index, major component condition |
| Transit Facilities | Station, maintenance facility, parking | Facility condition index |
| Track | Rail type, tie type, ballast condition | Track Condition Index, FRA track class |
| Water Main | Material, diameter, installation year, pressure zone | Pressure rating, leak history index |
| Wastewater Main | Material, diameter, installation year, infiltration zone | PACP condition rating |

## Condition Recording

The condition recording workflow is the foundation of every other capability in Maintain. Without current, accurate condition data, deterioration models are wrong, capital needs are wrong, and TAMP reports are non-compliant.

**Inspection types supported:**
- **Routine / Drive-by:** Periodic visual inspection of pavement, signs, drainage, culverts. Typically conducted by maintenance staff on a defined cycle.
- **Detailed / Level 2:** Formal condition assessment using standardized rating scales. Conducted by trained inspectors. Required for TAMP compliance.
- **NBIS Bridge Inspection:** National Bridge Inspection Standards compliance inspection. Must be conducted by a certified bridge inspection team on a two-year maximum cycle (or annual for fracture-critical bridges).
- **Emergency / Special:** Triggered by events (flooding, traffic incident, reported defect). Documenting the condition finding and the resulting maintenance or capital action.

**Condition rating scales:**
Maintain supports the full set of condition rating standards used in public sector infrastructure:
- International Roughness Index (IRI) for pavement
- PASER (1-10) for local agency pavement
- NBI sufficiency rating and structural condition for bridges
- PACP (Pipeline Assessment and Certification Program) for wastewater mains
- Custom 0-5 scale (Aurigo default) for general civil assets

**The mobile inspection workflow:**
1. Inspector downloads their assigned inspection queue to the mobile device (works offline)
2. Arrives at asset location; GPS confirms asset identity or allows manual lookup
3. Records condition ratings per the applicable standard
4. Photographs defects with auto-tagging (asset ID, inspector ID, timestamp, GPS)
5. Records repair recommendations and urgency flags
6. Submits inspection when connectivity is available
7. Supervisor review and approval (optional step; required for NBIS bridge inspections)

## TAMP Module

The Transportation Asset Management Plan (TAMP) module is a first-class feature of Masterworks Maintain, not an afterthought. It is the primary compliance deliverable for state DOTs on the National Highway System and the feature that makes Maintain uniquely valuable for that buyer.

**What the TAMP module does:**
1. **Asset inventory export:** Produces a complete NHS asset inventory in the format required for TAMP submission, including all required NBI fields for bridges and pavement condition data for pavement segments
2. **Condition analysis:** Aggregates condition data to produce the TAMP-required metrics: percent of NHS pavement in Good/Fair/Poor condition, percent of NHS bridges in Good condition, percent structurally deficient
3. **Performance gap analysis:** Compares current condition to TAMP performance targets and shows the gap by asset class and year
4. **10-year financial plan:** Produces the multi-year capital investment requirement needed to close the performance gap, structured in the TAMP financial plan format
5. **Risk analysis:** Documents the assets most at risk under the proposed financial plan (assets not funded within their projected replacement window)
6. **TAMP narrative generation (AI):** Produces a draft TAMP narrative that the asset manager can review and edit, substantially reducing the report-writing burden

**TAMP data quality requirements:**
FHWA's TAMP review criteria include assessment of data quality. Maintain provides a data quality dashboard showing: percentage of NHS assets with current condition ratings (within inspection cycle), percentage with complete attribute data, percentage with geometry, and recommendations for improving data completeness before TAMP submission.

## Capital Needs Analysis

The capital needs analysis is the primary output of Maintain's condition and deterioration data. It answers: which assets need capital investment, in what year, at what cost?

**The calculation:**
1. For each asset, apply the deterioration model (linear or Weibull) to project the condition trajectory
2. Identify the year in which the projected condition crosses the replacement threshold
3. Apply the asset replacement value (unit cost × quantity) to calculate the capital cost in that year
4. Aggregate by asset class and year to produce the 10-year capital needs schedule

**Budget-constrained optimization:**
When the capital needs exceed the available budget (which they almost always do), Maintain's AI produces a budget-constrained capital plan that prioritizes investments to maximize condition improvement per dollar spent. The optimization accounts for:
- Asset risk score (high-risk assets are prioritized)
- Federal funding eligibility (assets eligible for federal funding are prioritized when federal programs are available)
- Condition urgency (assets below the safety threshold take absolute priority)
- Geographic equity (configurable constraint: no county can be below a minimum condition threshold)

## Integration Modes

**Integrated Mode (most common):**
Maintain reads asset condition data from the existing EAM via REST API integration. Supported EAM integrations:
- IBM Maximo (via Maximo Application Framework REST APIs)
- Cityworks (via Cityworks REST APIs)
- Infor EAM (via Infor API)
- Generic REST/CSV import for systems without native connectors

In Integrated mode, Maintain does not attempt to replicate all EAM data. It reads: asset master records (ID, type, location), condition inspection records, and maintenance event records. It derives the rest from its own calculations.

**Native Mode:**
For agencies without an existing EAM, or for agencies migrating to a new system, Maintain can function as the complete asset management platform — including work order management, PM scheduling, and inventory — without EAM integration.

## AI Capabilities

**Condition prediction:** Given an asset's inspection history, predict the condition score at future points in time. Supports linear and Weibull models with automatic model selection based on the shape of the observed condition curve.

**Capital optimization:** Produce a budget-constrained capital investment plan that maximizes condition improvement per dollar, respecting user-defined risk tolerance and geographic equity constraints.

**TAMP narrative generation:** Generate a draft TAMP section from structured condition and capital plan data. The generated narrative follows FHWA TAMP structure and includes all required quantitative elements.

**Anomaly detection:** Flag assets where the observed condition change between inspections is significantly greater than the expected change based on the deterioration model. These anomalies may indicate accelerated deterioration, data entry errors, or events (flooding, traffic incidents) that require field verification.

**Natural language query:** Users can ask questions about the asset network in plain English and receive structured results: "Show me all bridges on the NHS with a sufficiency rating below 50 that have not been inspected in the past 18 months."

## Dashboards

**Executive Dashboard:**
- Network health score (aggregate condition index across all asset classes, weighted by replacement value)
- Top 10 highest-risk assets (by risk score = probability of failure × consequence of failure)
- Capital needs summary: total needs by year for the next 10 years, vs. projected funding
- Investment efficiency: current condition per dollar invested vs. prior year
- TAMP compliance status: percentage of NHS assets with current condition ratings

**Asset Manager Dashboard:**
- Condition distribution by asset class (pie chart: Good / Fair / Poor)
- Deterioration trend by asset class (condition score over time, 5-year history)
- Inspection compliance: percentage of assets inspected on schedule
- Capital needs by asset class and year (bar chart, 10-year horizon)
- AI alerts: assets flagged for condition anomaly, approaching threshold, or exceeding replacement cycle

**Field Inspector Dashboard:**
- Today's inspection queue (assigned assets with location map)
- Recently completed inspections (last 30 days)
- Outstanding non-conformances
- Sync status (records pending upload)

## Personas

Refer to [Document 05 — Customers](../../vol-1-company/05-customers.md) for full persona descriptions. Primary Maintain users:
- State DOT Asset Manager (primary user: TAMP, capital needs, executive dashboards)
- County Engineer (primary user: capital budget justification, inspection tracking)
- City Public Works Director (primary user: executive dashboard, condition status)
- Field Inspector (primary user: mobile inspection workflow)

## User Stories

1. **As a State DOT Asset Manager**, I want to generate the TAMP financial plan chapter from Maintain's 10-year capital needs forecast so that I reduce the TAMP preparation time from 6 months to 2 weeks.

   *Acceptance criteria:* TAMP financial plan chapter generates from capital needs data, formatted to FHWA requirements. Includes total investment needs by asset class by year, comparison to projected funding, and gap analysis. AI draft narrative is editable before export.

2. **As a State DOT Asset Manager**, I want to see which NHS bridges are projected to become structurally deficient in the next 5 years so that I can ensure they are in the funded capital program before they reach that threshold.

   *Acceptance criteria:* Report shows all NHS bridges with current NBI condition rating, projected NBI rating in years 1-5 based on deterioration model, and bridge sufficiency rating. Filter by district, county, structure type. Highlight bridges projected to become structurally deficient within the planning horizon.

3. **As a County Engineer**, I want to produce a capital needs report that I can present to the county board to justify my budget request so that the board understands which bridges and roads need investment and what the cost will be over the next 5 years.

   *Acceptance criteria:* Capital needs report shows all county assets with condition rating, projected replacement year, and estimated replacement cost. Report is formatted for board presentation (summary table + map). Total capital needs by year, by asset class. Available in PDF format.

4. **As a Field Inspector**, I want to record a bridge inspection from my phone without internet connection so that I can conduct inspections in remote areas and sync the data when I return to coverage.

   *Acceptance criteria:* Inspection form works in offline mode. Photos are stored locally. GPS coordinates are captured offline. Sync completes within 60 seconds when connectivity is restored. Synced inspection is visible to supervisor for review.

5. **As an Asset Manager**, I want the system to alert me when an asset's condition drops below the threshold that requires emergency action so that I can dispatch a crew before the asset becomes a safety risk.

   *Acceptance criteria:* Alert is generated within 24 hours of the condition threshold being crossed (by new inspection data or AI prediction). Alert is sent to the asset manager by email and in-app notification. Alert includes asset ID, location, condition score, threshold, recommended action, and link to asset detail.

6. **As a City Public Works Director**, I want to see the deferred maintenance backlog — the total capital cost of all assets past their replacement date that have not been funded — so that I can present a quantified case for increased capital investment to the Mayor.

   *Acceptance criteria:* Deferred maintenance backlog report shows all assets past their projected replacement date, ranked by risk score. Total deferred cost by asset class and total for the entire network. Year-by-year chart showing how the backlog grows if funding is not increased.

7. **As a Capital Program Manager**, I want Maintain's capital needs forecast to automatically flow into Masterworks Plan as unfunded project needs so that I have a complete picture of funded vs. unfunded infrastructure investment requirements.

   *Acceptance criteria:* Capital needs items from Maintain are visible in Masterworks Plan's unfunded needs list. Each need shows: asset class, location, projected replacement year, estimated cost, current condition, and risk score. Funded projects in Plan are linked to the Maintain asset records they address.

8. **As a State DOT Asset Manager**, I want to run a budget scenario analysis that shows the network condition trajectory under three funding scenarios (current funding, 20% reduction, 20% increase) so that I can quantify the impact of budget decisions on network condition.

   *Acceptance criteria:* Scenario tool takes the capital needs forecast and three budget inputs. For each scenario, it shows the year-by-year network condition score projection, the percent of assets in Good/Fair/Poor condition by year, and the cumulative deferred maintenance backlog. All three scenarios displayed side by side.

9. **As a Field Inspector**, I want to scan an asset's QR code to bring up its inspection history and the current inspection form so that I can quickly identify the asset and see its prior condition before recording a new inspection.

   *Acceptance criteria:* QR code scan opens the asset detail page within 3 seconds. Asset detail shows last three inspection dates, condition scores, and defect photos. Current inspection form is pre-populated with the asset ID, type, and standard rating fields.

10. **As an Asset Manager**, I want to configure the deterioration model for each asset class (linear vs. Weibull, and the model parameters) so that the capital needs forecast reflects the actual deterioration behavior of our specific asset network.

    *Acceptance criteria:* Deterioration model configuration page shows each asset class with the current model type and parameters. User can select linear or Weibull, and either enter parameters manually or ask the system to fit parameters to the historical inspection data. The effect of parameter changes on the RUL calculation is shown in a preview chart.

11. **As a Capital Program Manager**, I want to see the list of assets that were commissioned in Masterworks Build in the last 12 months and verify that their Maintain records are complete so that I know the asset handoff process is working correctly.

    *Acceptance criteria:* Asset handoff report shows all assets created in Maintain from Build closeout in the selected date range. For each asset: asset ID, project ID, closeout date, data completeness score (percentage of required fields populated). Flag assets with completeness below 80%.

12. **As a State DOT Asset Manager**, I want to import pavement condition data from the pavement management system (LCMS or similar) via bulk import so that I don't have to re-enter condition data that already exists in another system.

    *Acceptance criteria:* Bulk import accepts CSV format with field mapping UI. Import validates data (condition values within valid range, asset IDs match existing registry, inspection dates are valid). Import report shows records created, records updated, validation errors. Imported records are flagged with the source system.

13. **As a Field Inspector Supervisor**, I want to review and approve bridge inspection records before they are counted toward NBIS compliance so that I can ensure inspection quality meets FHWA requirements.

    *Acceptance criteria:* Inspection record status includes: Draft (not yet submitted), Submitted (awaiting supervisor review), Approved, Returned for revision. Supervisor review screen shows submitted inspection with all field data, photos, and condition ratings. Supervisor can approve or return with comments. Approved inspections are locked from editing.

14. **As a City Public Works Director**, I want to see the infrastructure health score for my city on a single-number dashboard that I can share with the Mayor and Council so that they understand the state of our assets without needing to understand condition indices.

    *Acceptance criteria:* Single infrastructure health score (0-100) displayed on the executive dashboard. Score is the replacement-value-weighted average condition index across all asset classes. Color coding: 80-100 (green/Good), 60-79 (yellow/Fair), below 60 (red/Poor). Score trend over 5 years.

15. **As an Asset Manager**, I want to see the AI-generated capital prioritization recommendation and compare it to my own judgment so that I can validate the AI recommendations before presenting them to leadership.

    *Acceptance criteria:* AI prioritization shows the recommended investment schedule ranked by risk-adjusted priority score. For each recommendation, the "why" is shown: condition urgency score, safety risk score, federal eligibility, cost-benefit calculation. User can adjust the weightings and see the recommendation change in real time. User can accept or override individual recommendations; overrides are logged with a reason.

## Business Rules

1. **NBIS inspection cycle:** NHS bridges must have an approved inspection on record within the past 24 months (12 months for fracture-critical bridges). Maintain flags bridges approaching or exceeding the inspection cycle deadline.

2. **Condition rating scale validation:** Condition values must be within the valid range for the applicable rating scale. IRI values must be positive. NBI item ratings must be integers from 0 to 9. PASER ratings must be integers from 1 to 10.

3. **Multi-tenant data isolation:** All asset records, inspection data, and capital plans are scoped to the tenant. No user in Tenant A can view or modify data belonging to Tenant B.

4. **Replacement threshold configurable:** The condition score that triggers a capital replacement recommendation is configurable by asset class and by tenant. The system default is a condition score of 2.5 (on the 0-5 scale), but different agencies use different thresholds.

5. **TAMP data freeze:** When a TAMP report is generated, the underlying data is version-frozen (snapshot is captured). TAMP reports reference the snapshot, not the live data. This ensures that TAMP reports remain reproducible after subsequent data updates.

6. **Inspection date cannot be future:** Inspection records cannot be dated in the future. Backdating more than 90 days requires supervisor approval and documented justification.

7. **Asset geometry required:** Assets cannot be published (made visible to all users) without geometry. The geometry of an asset is required for the map view, spatial queries, and GIS export.

8. **ARV calculation audit trail:** Asset Replacement Value (ARV) calculations are stored with the source unit cost, quantity, and calculation date. When unit costs are updated, the system recalculates ARV and shows the change from the prior value.

## Future Evolution

- **IoT sensor integration:** Real-time structural health monitoring (SHM) data from sensors on bridges and critical structures feeds directly into condition time series, reducing inspection frequency for monitored assets
- **Drone inspection integration:** Drone imagery processed by AI defect detection model auto-populates inspection records with detected defects, reducing field inspection time
- **Predictive failure before inspection:** Asset failure prediction model trained on historical failure events, maintenance history, and environmental exposure data; alerts flagged without requiring a recent inspection
- **Cross-agency benchmarking:** Anonymized condition and investment data shared across Maintain customers enables peer agency benchmarking (per AASHTO and FHWA guidance on TAMP benchmarking)
- **Automated TAMP amendment:** When the capital program changes significantly (major STIP amendment), the TAMP is automatically flagged for update with a pre-populated amendment report

---

## TAMP Calculation — Full FHWA-Compliant Specification

The TAMP module is not marketing collateral — it is a regulatory report generator. Its outputs must exactly match FHWA requirements. Engineers implementing or modifying TAMP-related code must adhere to the specifications below.

### Governing regulations (authoritative)

- **23 CFR Part 515** — Asset Management Plans (governs TAMP contents, process, and certification)
- **23 CFR Part 490** — Performance Management Rule (governs the metrics reported to TAMP)
- **23 CFR § 650 Subpart C** — National Bridge Inspection Standards (NBIS) — governs bridge data source
- **23 CFR § 490.313** — pavement condition measures for NHS
- **23 CFR § 490.409** — bridge condition measures for NHS
- **FHWA Order 5520.1** — Transportation Asset Management Plan Development
- **FHWA TAMP Consistency Determination Guidance (2019)**

### The 10 required TAMP contents (per 23 CFR § 515.7)

Maintain's TAMP module produces each section with a deterministic mapping from the asset data model:

| CFR § 515.7 element | Maintain module output |
|---------------------|-------------------------|
| (a) Summary listing of NHS pavement and bridge assets | `TampAssetInventoryExport` — includes asset count, deck area, lane-miles |
| (b) Asset management objectives and measures | Configurable by tenant — matches state DOT's approved TAMP |
| (c) Performance gap identification | `TampPerformanceGap` — actual vs. target from 23 CFR § 490 |
| (d) Lifecycle planning analysis | `RulEngineReport` — per-class deterioration and treatment table |
| (e) Risk management analysis | `TampRiskRegister` — probability × consequence for each risk item |
| (f) Financial plan (10-yr) | `CapitalPlan10Year` — investment schedule with sources |
| (g) Investment strategies | `InvestmentStrategyDoc` — narrative + quantitative link |
| (h) Consistency with LRTP and STIP | Cross-references Masterworks Plan |
| (i) Performance target development process | Text template (agency-editable) |
| (j) Bridge and pavement condition targets | `PerformanceTargetTable` — 2-year and 4-year targets per 23 CFR § 490 |

### Required NBI fields captured (23 CFR § 650, Recording and Coding Guide)

Full 116-field NBI record supported. Critical items for TAMP:

| Item # | Description | Maintain field |
|--------|-------------|-----------------|
| 8 | Structure Number | `Asset.ExternalId` |
| 27 | Year Built | `Asset.YearBuilt` |
| 43 | Structure Type | `Asset.StructureType` |
| 49 | Structure Length (ft) | `Asset.Length` |
| 51 | Bridge Roadway Width | `Asset.Width` |
| 52 | Deck Width | `Asset.DeckWidth` |
| 58 | Deck Condition | `Inspection.DeckCondition` (0–9) |
| 59 | Superstructure Condition | `Inspection.SuperstructureCondition` (0–9) |
| 60 | Substructure Condition | `Inspection.SubstructureCondition` (0–9) |
| 61 | Channel and Channel Protection | `Inspection.ChannelCondition` (0–9) |
| 62 | Culvert Condition | `Inspection.CulvertCondition` (0–9) |
| 67 | Structural Evaluation | `Inspection.StructuralEvaluation` |
| 68 | Deck Geometry | `Inspection.DeckGeometry` |
| 71 | Waterway Adequacy | `Inspection.WaterwayAdequacy` |
| 91 | Designated Inspection Frequency (months) | `Asset.InspectionFrequencyMonths` |
| 92 | Critical Feature Inspection | `Asset.FractureCritical` (boolean) |
| 95 | Sufficiency Rating (computed) | `Asset.SufficiencyRating` (0–100) |

### Bridge Condition Categorization (23 CFR § 490.411)

Deterministic rules:
- **Good:** min(Item 58, 59, 60) ≥ 7
- **Fair:** 5 ≤ min(Item 58, 59, 60) < 7
- **Poor / Structurally Deficient:** min(Item 58, 59, 60) ≤ 4

For culverts (Item 62 only): same threshold applied to Item 62.

Reporting to FHWA: percent of deck area (Item 49 × Item 52) in each category on the NHS.

### Pavement Condition Categorization (23 CFR § 490.313)

For NHS Interstate:

- **Good:** IRI < 95, Cracking < 5%, Rutting < 0.20 in, Faulting < 0.10 in (all four)
- **Poor:** Any two of: IRI ≥ 170, Cracking ≥ 10% (asphalt) / ≥ 15% (JPCP) / ≥ 5% (CRCP), Rutting ≥ 0.40 in, Faulting ≥ 0.15 in
- **Fair:** Everything else

For NHS non-Interstate: same rules, with weighted PSR permitted for lower-volume routes (< 500,000 AADT).

### Performance Targets (23 CFR § 490.105)

State DOTs set 2-year and 4-year targets for:
- % NHS Interstate pavement in Good condition (minimum)
- % NHS Interstate pavement in Poor condition (maximum)
- % NHS non-Interstate pavement in Good condition (minimum, if applicable)
- % NHS non-Interstate pavement in Poor condition (maximum, if applicable)
- % NHS bridges by deck area in Good condition (minimum)
- % NHS bridges by deck area in Poor condition (maximum)

Federal minimum: no more than 5% of NHS Interstate pavement lane-miles in Poor condition (23 CFR § 490.315). Maintain's TAMP module enforces this as a hard warning on the report if the customer's forecast crosses this threshold.

### Data Certification Requirements (23 CFR § 515.9)

Every 4 years, the state DOT certifies:
- The TAMP is being implemented
- Investment strategies are being followed
- Progress is being tracked

Maintain's TAMP module maintains a certification packet:
- Signed evidence log (electronic signature per E-Sign Act)
- Comparison of planned vs. actual investment
- Explanation of variances
- Corrective action plan if targets not being met

### The TAMP Generation Pipeline (Maintain implementation)

1. **Data freeze** — snapshot all NHS asset condition, inspection, and capital plan data at report date (audit trail requirement)
2. **Compute condition metrics** — apply 23 CFR § 490.313 and § 490.411 categorizations to snapshot
3. **Aggregate performance metrics** — deck-area-weighted for bridges, lane-mile-weighted for pavement
4. **Compare to targets** — compute performance gap by asset class and year
5. **Run lifecycle plan** — RUL model produces year-by-year treatment schedule
6. **Compute investment need** — apply unit cost model to lifecycle plan
7. **Balance financial plan** — reconcile investment need against projected revenue (10 years)
8. **Compute residual risk** — assets not funded within their treatment window
9. **Generate narrative** — Opus-class LLM produces draft; asset manager edits
10. **Export** — PDF (FHWA layout), XLSX (data appendix), machine-readable JSON

Every generation is stored with the input snapshot hash so a Year 3 audit can reproduce a Year 0 report exactly.

### Failure modes explicitly handled

| Failure | Detection | Handling |
|---------|-----------|----------|
| Missing NBI data on ≥ 1% of NHS bridges | Data quality gate | Report blocked with named list of missing structures |
| Pavement IRI values > 500 or < 0 | Range validation | Excluded from aggregate, flagged as data issue |
| No condition data within past inspection cycle | Freshness check | Report flags "stale data" — inclusion at discretion of asset manager |
| 10-yr financial plan revenue exceeds LRTP forecast | Cross-reference to Plan | Warning, requires override justification |
| Target that violates federal minimum (23 CFR § 490.315) | Rule check | Hard error, must be corrected before export |
| STIP amendment issued after last freeze | Change detection | TAMP amendment workflow triggered |

### Edge cases every developer must handle

- **Asset with no inspection data:** Do not include in condition metrics. Include in inventory count. Data quality dashboard names the asset.
- **Asset with inspection outside NBIS cycle:** Include in metrics with "past due" flag. Do not include for federal reporting.
- **Bridge with no deck area (culvert, other):** Use Item 62 (culvert condition) for categorization; do not sum deck area in aggregation.
- **Pavement segment with mixed surface types along its length:** Segment-level attribute in registry; treat each type as separate segment for reporting.
- **Zero budget scenario:** Reports still generate; "do nothing" scenario shows network trajectory. Explicitly required by 23 CFR § 515.7(f).
- **New asset commissioned mid-year:** Initial condition = "Good"; deterioration begins from commissioning date, not inspection date.
- **Asset in "under construction" state:** Exclude from condition metrics; include in inventory as "not yet operational."
- **Multi-tenant boundary:** No cross-tenant aggregation ever, even for peer benchmarking (which uses anonymized snapshots via a separate pipeline with tenant consent).

---

*See also: [Masterworks Plan](plan.md) | [Masterworks Build](build.md) | [Inspections Domain](../domains/inspections.md) | [Capital Planning Domain](../domains/capital-planning.md) | [AI Domain](../domains/ai.md)*
