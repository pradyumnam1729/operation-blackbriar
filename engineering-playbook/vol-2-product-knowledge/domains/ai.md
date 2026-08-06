# AI Capabilities

## Purpose

Aurigo Maintain is a System of Intelligence, not merely a System of Record. The core value proposition is that Maintain doesn't just store what you know about your infrastructure — it tells you what to do about it. Every AI capability in the platform serves this goal: transform raw condition data into actionable recommendations that help agencies allocate limited capital budgets more effectively.

This document catalogs every AI/ML capability in Maintain, describing how each works, what data it requires, how results are presented to users, and what explainability mechanisms ensure users can trust and audit the outputs.

---

## Design Principles for AI in Maintain

**Explainability is mandatory, not optional.** Public agency decisions backed by Maintain outputs may be challenged in public hearings, audits, or litigation. Every AI recommendation must carry a plain-language explanation of why the recommendation was made. "The model says so" is not acceptable.

**AI assists; humans decide.** AI outputs are presented as recommendations, not commands. The system proposes; the asset manager disposes. Overrides are allowed and logged, which also creates training data for model improvement.

**Graceful degradation.** When an AI feature lacks sufficient input data, it degrades to a simpler deterministic model (e.g., falls back to linear deterioration when insufficient inspection history exists for Weibull calibration). It never returns a null or an error to the user — it returns the best available estimate with a confidence indicator.

**Auditability.** Every AI-generated output is versioned. The inputs, model version, and output are stored together. If an agency's capital plan is challenged two years later, Maintain can reproduce exactly what the model recommended and why.

---

## Feature 1: Deterioration Prediction

### How It Works

Deterioration prediction models how an asset's condition score changes over time. Maintain supports two model types:

**Linear Model (default, low data)**
Condition score decreases linearly from 100 (new) to 0 (failed) over the asset's design life. The rate is parameterized per asset class (e.g., bridge decks deteriorate at 2.5 points/year in temperate climates).

`Predicted Condition = Current Condition − (Deterioration Rate × Years)`

**Weibull Survival Model (calibrated, sufficient data)**
When an asset class has at least 30 historical inspection records with multiple condition readings per asset, the system calibrates a Weibull distribution to model time-to-failure. The Weibull model captures the characteristic S-curve deterioration behavior — slow early decline, rapid mid-life deterioration, then flattening near failure.

Parameters: shape (β) controls curve steepness; scale (η) controls characteristic life. Calibrated per asset class, climate zone, and construction type combination.

### What Data It Needs

- Asset class and construction type
- Age or installation date
- Current condition score
- Condition history (for Weibull calibration)
- Climate zone (for adjustment factors)
- Prior rehabilitation history (resets the condition curve)

### How Results Are Presented

A condition curve chart shows the projected condition score over the next 1, 5, 10, and 20 years. Threshold lines at 60 (needs attention), 40 (rehabilitation), and 20 (replacement imminent) allow users to see visually when intervention will be required.

The chart shows a confidence band (80% prediction interval) that widens as the projection extends further into the future — honest about uncertainty at long horizons.

### Explainability

"This forecast uses a linear deterioration model calibrated for Concrete Bridge Decks in Climate Zone 5 (freeze-thaw). The model predicts 2.3 condition points per year of decline based on 847 bridge deck inspections in your dataset. The forecast does not account for rehabilitation events. Model last recalibrated: March 2026."

---

## Feature 2: Capital Plan Optimization

### How It Works

Given a set of candidate projects (assets needing rehabilitation or replacement), a multi-year budget envelope, and a set of optimization objectives, the Capital Plan Optimizer produces a ranked, feasible project schedule that maximizes value within budget constraints.

The optimizer uses **integer linear programming (ILP)** with the following formulation:

- Decision variables: binary (include project in year Y, or not)
- Objective: maximize total risk-reduction value (sum of risk score × improvement factor for selected projects)
- Constraints: annual budget, asset-level single-execution constraint, dependency constraints (rehab before replacement), minimum condition threshold (don't delay below Condition 20)

For large portfolios (>500 projects), the optimizer uses a heuristic-guided ILP with a time limit of 30 seconds, guaranteeing a feasible solution even if not globally optimal.

### What Data It Needs

- Candidate project list with estimated costs and work types
- Multi-year budget envelope (per fiscal year)
- Asset condition scores and risk scores
- Project dependencies and sequencing constraints
- Agency-defined optimization weights (risk vs. age vs. condition)

### How Results Are Presented

A tabular capital plan with one row per project per year. Filter controls allow the asset manager to see projects by year, by asset class, by priority tier. A budget vs. commitment chart shows annual spend against the approved budget. A portfolio condition forecast line shows the predicted condition distribution with vs. without the optimized plan.

### Explainability

Each project in the optimized plan carries a priority score breakdown: "This bridge was selected in Year 1 because: Risk Score 87/100 (×0.5 weight) + Condition Score 38/100, below rehabilitation threshold (×0.3 weight) + Age 34 years, exceeds design life (×0.2 weight). 12 lower-priority projects were deferred to Years 2–5."

---

## Feature 3: Remaining Useful Life (RUL) Calculation

### How It Works

RUL answers the question: "How many years until this asset must be rehabilitated or replaced?" It is derived directly from the deterioration model.

`RUL = (Current Condition − Threshold Condition) / Annual Deterioration Rate`

For the Weibull model:
`RUL = Weibull percentile estimate for condition reaching threshold − Current Age`

The threshold condition is configurable per asset class (e.g., 40 for rehabilitation, 20 for replacement) and defaults to regulatory minimums where mandated.

### What Data It Needs

Same as Deterioration Prediction. RUL is a derived scalar output from the condition curve projection.

### How Results Are Presented

Per-asset: a single number with a unit ("14 years to rehabilitation threshold") plus a short-form confidence range ("12–17 years at 80% confidence"). Displayed prominently on the asset detail page and in the capital needs register.

Portfolio-wide: a histogram showing the distribution of RUL values across the asset portfolio. This helps asset managers see at a glance that 40 bridges need attention in the next 5 years and 200 are not due until after 2040.

### Explainability

"RUL is calculated by dividing the condition gap (Current: 56 − Rehabilitation Threshold: 40 = 16 points) by the deterioration rate (2.3 points/year), yielding 7.0 years. Confidence range reflects uncertainty in the deterioration rate estimate."

---

## Feature 4: Asset Replacement Value (ARV) Calculation

### How It Works

ARV estimates the cost to replace an asset at today's prices. It is not the original construction cost — it is the current replacement cost. The formula is:

`ARV = Unit Cost × Quantity × Cost Index Adjustment`

- **Unit Cost**: cost per unit of measure (per square foot of bridge deck, per linear foot of pipe, per lane-mile of road), sourced from the agency's historical costs, regional RS Means data, or Maintain's built-in cost library
- **Quantity**: asset-class-specific measure (area, length, count)
- **Cost Index Adjustment**: Engineering News-Record Construction Cost Index ratio (current year / base year) to adjust for inflation

For composite assets (a bridge has deck + superstructure + substructure + culvert), ARV is calculated per component and summed with configurable weighting factors.

### What Data It Needs

- Asset class and construction type
- Geometric quantity (area, length, volume, count)
- Installation year (for age context)
- Regional cost adjustment factor
- Current cost index value

### How Results Are Presented

Per-asset: total ARV with a component breakdown table showing each sub-element's replacement cost. Portfolio-wide: total replacement value with asset-class pie chart. Used in capital needs register as the basis for replacement project cost estimates.

### Explainability

"ARV = 24,500 sq ft × $185/sq ft (Concrete Bridge Deck, Region 4) × 1.18 (ENR CCI 2026 adjustment) = $5,350,230. Unit cost sourced from agency's 2024 rehabilitation project actuals (3 comparable bridges). CCI adjusted from 2020 base year."

---

## Feature 5: Risk Score

### How It Works

Risk Score = Probability of Failure (PoF) × Consequence of Failure (CoF), normalized to a 0–100 scale.

**Probability of Failure (0–100)**
Derived from: condition score (40% weight), age relative to design life (30% weight), inspection frequency compliance (15% weight), structural redundancy (15% weight).

`PoF = (0.4 × ConditionFactor) + (0.3 × AgeFactor) + (0.15 × InspectionFactor) + (0.15 × RedundancyFactor)`

Each factor is normalized 0–1 and scaled.

**Consequence of Failure (0–100)**
Derived from: average daily traffic (30% weight), detour length in miles (20% weight), presence of utilities (15% weight), economic impact zone (15% weight), hazmat risk (10% weight), community connectivity (10% weight).

**Final Risk Score**
`Risk Score = (PoF × CoF) ^ 0.5 × 10`  — geometric mean scaled to 0–100

The geometric mean (rather than arithmetic mean) ensures that a very high consequence but very low probability asset doesn't score the same as an asset with moderate risk on both dimensions.

### What Data It Needs

- Current condition score
- Asset age and design life
- Inspection history (frequency compliance)
- Traffic data (AADT for bridges, throughput for utilities)
- Asset geometry (for detour calculation)
- Agency-defined consequence weights (configurable per tenant)

### How Results Are Presented

A 0–100 risk score with a color band: Low (0–30, green), Medium (31–55, yellow), High (56–75, orange), Critical (76–100, red). The score is prominently displayed on the asset detail page and drives sorting in capital needs registers and portfolio maps.

### Explainability

"Risk Score: 74/100 (High). PoF: 68/100 — driven primarily by Condition Score 38/100 (below rehabilitation threshold) and Age 31 years (at 103% of design life). CoF: 82/100 — driven primarily by high AADT (42,000 vehicles/day) and 18-mile detour if structure fails. No detour route exists with equivalent load capacity."

---

## Feature 6: TAMP Narrative Generation

### How It Works

The Transportation Asset Management Plan (TAMP) is a federally required document for state DOTs receiving NHPP funds (23 CFR Part 515). It must describe: asset inventory, condition assessment methodology, performance targets, life cycle cost analysis, and financial plan. Drafting a TAMP traditionally takes 6–18 months of consultant effort.

Maintain's TAMP Narrative Generation uses Claude to produce draft TAMP narrative sections from structured data. The pipeline:

1. The system extracts structured data: asset counts, condition distributions, deterioration rates, capital needs totals, budget projections, performance gap analysis
2. The data is formatted into a structured context document (JSON → markdown summary)
3. A carefully engineered prompt instructs Claude to write a specific TAMP section (e.g., "Life Cycle Planning") in the formal voice required by FHWA guidance, using only the provided data
4. The draft is presented to the asset manager in a rich text editor for review and editing
5. The asset manager (or a consultant) edits the draft, accepts it, and it becomes part of the TAMP document
6. Version history tracks every AI-generated draft and every human edit

The prompt is engineered to cite specific FHWA TAMP guidance sections (ISO reference codes) and to flag when the data is insufficient to support a required section (rather than hallucinating plausible-sounding content).

### What Data It Needs

- Asset inventory (counts, classes, values)
- Condition assessment results (distribution, trend)
- Performance targets (agency-defined or state-set)
- Capital needs register (10-year projection)
- Budget plan (approved budget by year)
- Prior TAMP (if available, for continuity)

### How Results Are Presented

A document editor showing the AI-drafted section with tracked changes highlighting. Each AI-generated paragraph carries a footnote showing the source data used. The editor supports accept/reject changes inline.

### Explainability

The AI-generated text is always clearly labeled "AI Draft — requires human review." The source data footnotes allow reviewers to verify every claim. Sections where data quality is low carry a "Data Confidence: Low" warning.

---

## Feature 7: Anomaly Detection

### How It Works

Anomaly detection identifies assets whose condition is deteriorating significantly faster than the model predicts. It runs nightly as a background job.

For each asset, the system computes:
`Anomaly Score = (Predicted Condition − Actual Condition) / Model Standard Deviation`

If the Anomaly Score exceeds 2.0 (two standard deviations below predicted), an anomaly is flagged. The severity is categorized:
- Moderate (2.0–3.0 σ): Informational alert
- High (3.0–4.0 σ): Review recommended within 30 days
- Critical (>4.0 σ): Urgent inspection recommended

### How Results Are Presented

Anomalies appear in the asset manager's dashboard notification feed and in a dedicated "Anomaly Alerts" page. Each alert shows: asset name, current condition, predicted condition, deviation, suggested action, and time since last inspection.

### Explainability

"This bridge's current condition score of 41 is 2.8 standard deviations below the predicted score of 52 for this age and class. The 11-point gap exceeds normal model uncertainty. Possible causes: undetected damage event, inspection methodology change, or accelerated environmental deterioration. Last inspection: 14 months ago. Recommended action: prioritize for early inspection."

---

## Feature 8: Natural Language Query

### How It Works

The Natural Language Query interface allows users to ask questions about their portfolio in plain English. The query is sent to a language model (Claude) with the database schema and tenant-scoped data context. Claude generates a SQL query, executes it (read-only), and returns results with a plain-language interpretation.

Examples:
- "Which bridges will fall below condition 40 in the next 3 years?"
- "What is my total capital need for culverts in District 7?"
- "Show me all assets where the last inspection was more than 2 years ago"

Safety mechanisms: all generated queries are read-only (SELECT only, executed via a restricted read replica user). Queries are logged. A query rate limit prevents abuse.

### How Results Are Presented

A chat-style interface with the question, the plain-language answer, and an expandable data table showing the underlying results. A "Show SQL" option lets technical users verify the generated query.

---

## Feature 9: Inspection Photo Analysis (Phase 2)

### How It Works

When an inspector captures a photo during an inspection, an on-server vision model analyzes the image and suggests defect codes from the agency's defect code library. The inspector sees the suggestion as a pre-filled recommendation they can accept, modify, or reject.

The model is fine-tuned on labeled infrastructure inspection photos (bridge deterioration, pavement distress, culvert damage categories). It outputs a defect code confidence score for each candidate code.

### Explainability

"Suggested defect: D-302 Spalling (Concrete). Confidence: 78%. The model detected exposed rebar and surface scaling in the upper-right quadrant of the image, consistent with freeze-thaw spalling patterns."

---

## Feature 10: Predictive Failure (Phase 3)

### How It Works

Integrating continuous sensor data (accelerometers, strain gauges, tilt sensors) with historical inspection and maintenance records, a multivariate survival model predicts the probability that a specific structural element will experience a failure event within a defined window (30, 60, 90 days).

This is a Phase 3 capability that requires the Structural Health Monitoring sensor infrastructure to be deployed.

The model uses a Cox Proportional Hazards model as the base, with sensor-derived features as time-varying covariates. The output is a failure probability with a confidence interval, updated daily as new sensor readings arrive.

### Explainability

"30-day failure probability for Bearing Pad B-4: 12% (elevated). Key drivers: vibration frequency shifted 3.2 Hz below baseline over the past 14 days (correlated with bearing deterioration in 85% of comparable historical failures), and temperature-induced expansion strain is 18% above design limit on cold mornings. Recommended action: physical inspection within 7 days."

---

## AI Model Governance

Every AI model in Maintain is subject to:

- **Version tracking**: model version stored with every output
- **Recalibration schedule**: deterioration models recalibrated quarterly as new inspection data accumulates
- **Performance monitoring**: for predictive models, a held-out validation set tracks accuracy over time; degradation triggers recalibration alerts
- **Human override logging**: every user override of an AI recommendation is logged and used as training signal
- **Explainability audit**: annually, the AI Engineer reviews explanation quality by sampling AI outputs and explanations across the customer base
