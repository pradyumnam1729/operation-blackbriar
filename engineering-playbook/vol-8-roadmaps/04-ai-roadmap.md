# AI Feature Roadmap — Aurigo Maintain

## Philosophy

Aurigo is building an AI-native product, not retrofitting AI onto a traditional SaaS. The distinction matters. AI-native means the AI capabilities are designed from the beginning to be core to the product's value proposition — not a chatbot bolted on, not a "smart insights" banner added in a PM sprint, but capabilities that fundamentally improve the quality of decisions asset managers make and reduce the time it takes to make them.

Infrastructure asset management is a domain where AI can create genuine economic value. Deterioration modeling is inherently probabilistic. Inspection data is sparse and noisy. Capital planning requires optimizing across thousands of assets with complex interdependencies. Human planners have intuitions that are difficult to scale. AI can extend those intuitions across an entire portfolio and make them explicit, consistent, and auditable.

But infrastructure management also has non-negotiable constraints that limit where AI should be trusted: safety-critical decisions (bridge load ratings, structural assessments) must remain with licensed engineers. Regulatory reporting (TAMP) must be auditable and reproducible. Capital allocations above threshold require human review. The AI roadmap is designed with these constraints as hard boundaries.

---

## Phase 1 — Current: AI-Assisted Analytics

**Status:** Live in MVP and iterating.

### Weibull and Linear Deterioration Models

The foundation of the AI/analytics capability is the deterministic deterioration engine. Weibull survival analysis and linear regression are not machine learning — they are parametric statistical models — but they represent the analytical backbone that all subsequent ML layers are built on. The models are:

- **Linear:** condition(t) = condition₀ - (rate × t), where rate is configured per asset subtype
- **Weibull:** survival function S(t) = exp(-(t/λ)^k), where λ is the scale parameter and k is the shape parameter, calibrated from literature values and adjusted with tenant inspection data as it accumulates

Both models are implemented as pure C# calculation engines in `Application/Calculations/`, unit-tested with ≥90% line coverage, and produce deterministic outputs that can be reproduced for audit purposes.

### Capital Plan Calculation

The capital plan engine is deterministic: given a set of assets with current conditions and deterioration trajectories, compute the year in which each asset crosses the intervention threshold, the intervention cost, and the aggregate annual spending requirement. This is foundational to the 10-year capital needs schedule and the TAMP investment strategy section.

### TAMP Narrative — Template-Based AI Assistance

The TAMP narrative generation uses structured templates with data interpolation. The template engine fills in asset counts, condition percentages, projected costs, and performance gap analysis from the tenant's data. An LLM (Claude via Anthropic API) post-processes the template output to improve prose quality — making the sentences flow naturally rather than reading like a fill-in-the-blank form — while being constrained to not alter any numerical values in the output.

The LLM is not trusted to generate numerical claims. It is trusted to improve readability of human-authored templates with data-interpolated values. Every numerical statement in the generated TAMP is independently verifiable against the underlying data.

### Anomaly Detection — Faster-Than-Model Deterioration

A simple anomaly detection rule runs on each new inspection: if the observed condition change since the last inspection implies a deterioration rate more than 2× the model's expected rate for that asset class, a flag is created. The asset is surfaced in a "Rapid Deterioration" panel on the condition dashboard.

This is not ML. It is a threshold rule. It catches assets that are failing faster than expected and surfaces them for prioritization before the capital plan cycle. The threshold multiplier (2×) is configurable per asset class.

---

## Phase 2 — Predictive (6–12 Months Post-GA)

### ML Condition Prediction

The first true ML model in Maintain. A supervised learning model trained on historical inspection data across all tenants (anonymized, aggregated). The model predicts asset condition at future time horizons (2, 5, 10 years) with uncertainty quantification.

**Model architecture:** Gradient Boosted Trees (XGBoost or LightGBM) in Phase 2, potentially a neural network in Phase 3 as data volume grows. Input features: current condition, age, asset class and subtype, number of prior inspections, condition velocity (rate of change from last two inspections), climate zone (derived from geolocation), traffic or load exposure, material/construction type.

**Training infrastructure:** AWS SageMaker. Training pipeline triggered quarterly (or when tenant data volume grows by 20%). Model registry with version tracking. A/B testing infrastructure to compare new model versions against the current production model before promotion.

**Output:** Predicted condition distribution (mean + 10th/90th percentile) at each time horizon. Displayed alongside the deterministic Weibull model output. Users see both — the ML model as a data-driven correction to the theoretical model, not a replacement for it.

**Governance:** Every prediction includes a SHAP-based explanation ("this asset's condition is projected lower than average for its age because its observed deterioration rate over the past 3 inspections is 40% higher than the class average"). Explanations are in plain language, not SHAP values. The model is not used for TAMP (which must be deterministic and auditable). It is used for planning horizon exploration and prioritization.

### Natural Language Query

The natural language query interface enables asset managers to ask questions in plain English instead of building filters. Example queries:

- "Which bridges are below condition 3 and need replacement in the next 5 years?"
- "Show me pavements in District 4 with condition below 2 on NHS routes"
- "What is the total capital need for culverts funded by federal sources through 2035?"
- "Which assets have deteriorated faster than expected since the last inspection cycle?"

The NLQ engine is implemented as a Claude tool-use agent. The agent receives the natural language question and has access to a schema description of the asset data model and a set of structured query tools (filter assets by condition, class, district, date, RUL, funding source; aggregate by group; compare to model prediction). The agent converts the NL question to a structured query using the tools, executes it, and returns results in a natural language answer with a data table.

The agent is constrained: it can only read data (no mutations), it cannot access other tenants' data, and every query it executes is logged for audit. The agent does not answer questions that require interpretation beyond the data (e.g., "should we replace Bridge 1234?" — it will surface the data but not make the recommendation).

### AI Inspection Photo Analysis — Defect Code Suggestion

When a field inspector uploads a photo during an inspection, a computer vision model analyzes the photo and suggests defect codes. For pavements: identifies cracking (alligator, longitudinal, transverse), potholing, rutting, raveling. For bridges: identifies spalling, exposed rebar, joint deterioration, staining patterns indicative of leakage.

The model suggests (does not require) defect codes with a confidence percentage. The inspector sees: "Suggested: Alligator Cracking (Medium Severity) — 84% confidence." They can accept, modify, or reject the suggestion. All final defect codes are chosen by the inspector. The AI suggestion speeds up the workflow and reduces variability in defect coding across inspectors.

**Model:** Fine-tuned vision transformer (ViT or Swin Transformer) on a labeled dataset of infrastructure defect photos. Training data sourced from: public FHWA roadway condition image datasets, bridge inspection photo corpora from state DOT open data portals, and (with consent) inspection photos from production customers. Model deployed via SageMaker endpoint.

**Privacy:** Photos are never used for model training without explicit tenant opt-in consent configured at the tenant level.

### Risk Prediction — Failure Probability Before Replacement

Phase 2 adds a failure probability model distinct from the RUL model. RUL answers "when will this asset need replacement given normal deterioration?" Failure probability answers "what is the probability this asset experiences an unplanned failure event (structural failure, complete pavement failure requiring emergency closure) before its planned replacement date?"

Failure probability is a survival analysis model (Cox Proportional Hazards) trained on historical data where unplanned failures were recorded. Features include: condition, age, condition velocity, maintenance history, climate exposure, load history. Output: probability of unplanned failure in the next 12 months.

Assets with high failure probability but relatively good modeled condition are the most dangerous — they are on an unexpected trajectory. These are surfaced separately in the risk dashboard.

---

## Phase 3 — Prescriptive (12–24 Months Post-GA)

### Optimal Maintenance Strategy Recommendation

Phase 2 predicts. Phase 3 prescribes. The maintenance strategy engine recommends not just "when" to intervene but "how": repair vs rehabilitate vs replace.

For each deteriorating asset, the engine evaluates three intervention strategies: do nothing (defer and monitor), maintain (minor repairs to slow deterioration), rehabilitate (major treatment to restore significant condition), or replace (full replacement at standard unit cost). For each strategy, it computes: estimated cost, projected condition trajectory over 10 years, life extension, and NPV of intervention vs no-action.

The engine recommends the strategy with the best risk-adjusted NPV, with the user able to override the optimization objective (e.g., "minimize risk" vs "maximize life extension per dollar"). The recommendation is explainable: "Rehabilitation is recommended over replacement because it costs $180K less, extends the asset life by 8 years, and keeps condition above threshold for the 10-year planning horizon. Replacement would be more cost-effective only if rehabilitation cost is above $245K."

### Budget Scenario Optimization — True Optimizer

The Beta budget scenario modeling uses a greedy priority queue (treat worst-risk assets first until budget is exhausted). Phase 3 replaces this with a true mixed-integer linear program (MILP) optimizer. The MILP correctly handles: treatment interdependencies (treating a bridge before the approach road costs less than treating them independently), funding source constraints (federal funds can only be used for NHS routes), multi-year budget profiles (spend this year vs next year is a decision variable), and minimum performance targets (portfolio average condition must remain above X even under constrained budgets).

The MILP solver is implemented using the OR-Tools library (Google) or HiGHS (open source). For portfolios above 100K assets, the MILP is decomposed by asset class or district and solved in parallel on SageMaker Processing Jobs.

### Fully Automated TAMP Narrative

Phase 3 moves from template-based AI assistance to fully automated TAMP narrative generation. The narrative engine is a Claude-powered agent that:

1. Reads all structured data for the TAMP sections from the database
2. Retrieves the applicable FHWA guidance language for each section
3. Generates each section in the required federal format with all required metrics
4. Applies quality checks: every numerical claim in the narrative matches the corresponding data query result
5. Flags any sections where the data implies a regulatory compliance gap that requires explicit acknowledgment

The output is ready for Agency Admin review and submission with zero template editing. The Agency Admin can annotate the generated narrative (political context, local priorities, planned legislative actions) in overlay fields that appear in the final document but are tracked separately from the AI-generated sections.

### Structural Health Monitoring Sensor Integration

Phase 3 adds the first real-time data input to Maintain. SHM sensors (strain gauges, accelerometers, tilt meters, displacement sensors) installed on bridges and critical infrastructure can stream readings into Maintain via a time-series ingest API. The AI layer processes sensor readings into condition signals: a bridge with increasing strain variance under standard load is exhibiting behavior consistent with structural degradation.

The sensor integration does not replace engineer inspections — it supplements them by providing near-continuous condition monitoring between inspection cycles. Anomalies detected from sensor data generate alerts and can trigger unscheduled inspection recommendations.

---

## Phase 4 — Autonomous (24–48 Months Post-GA)

### Autonomous Annual Capital Plan Draft

A capital planning agent runs annually (triggered by the fiscal year start date configured per tenant). It:

1. Processes all inspection data from the past year
2. Updates deterioration model parameters based on observed vs predicted condition changes
3. Runs the MILP optimizer for the 10-year horizon
4. Generates the capital needs schedule with recommended interventions
5. Generates the TAMP narrative
6. Presents the complete capital plan draft to the Agency Admin for review

The Agency Admin's role shifts from building the plan to reviewing and approving it. They interact with the plan via annotations, overrides, and approval. The total time for an Agency Admin to produce an annual capital plan submission falls from weeks to hours.

### Self-Calibrating Deterioration Models

Phase 4 closes the loop on deterioration modeling: the models are no longer configured with static parameters. A Bayesian update engine continuously adjusts Weibull shape and scale parameters (and linear deterioration rates) as new inspection data accumulates per tenant. Each tenant's model drifts toward its actual observed deterioration rates, diverging from the literature-default starting parameters.

The update is Bayesian (prior from literature, posterior updated with observations) so it is well-behaved with small data sets early in the tenant's lifecycle and increasingly data-driven as inspection history grows. Model updates are versioned and auditable: the capital plan generated in 2028 can be reproduced using the model parameters that were current in 2028.

### Drone Inspection with AI Defect Detection

Phase 4 integrates with drone inspection platforms (Skydio, DroneDeploy, or custom). A drone flies a pre-programmed inspection route for a bridge or road segment. The resulting photogrammetry and image data is uploaded to Maintain. A computer vision pipeline:

1. Orthorectifies imagery and builds a 3D point cloud
2. Runs defect detection models per structural element (deck, girder, abutment, pier)
3. Maps detected defects to asset record coordinates (GPS-referenced)
4. Pre-populates an inspection record with detected defect codes, severity estimates, and photo references

An engineer reviews the pre-populated inspection record, confirms, modifies, or rejects each AI-detected defect, and approves the inspection. Drone inspection with AI detection reduces the field time for a standard bridge inspection from 4 hours to 30 minutes. The engineer's review ensures accuracy and maintains professional liability requirements.

### Digital Twin

Phase 4 enables a full digital twin for assets with sufficient sensor and inspection data density. A digital twin is a continuously updated virtual representation of the physical asset that mirrors its current state and simulates its response to loads, weather, and time.

For infrastructure, the digital twin includes: geometric model (from design drawings or photogrammetry), material properties (from construction records), current condition state (from inspections and sensors), deterioration trajectory (from calibrated model), and load history (from traffic sensors or estimated from traffic count data). The twin is queryable: "what is the estimated remaining load-bearing capacity of this bridge given current condition?" "At what condition level does this pier require immediate intervention?"

Digital twins are initially available only for bridges (the most data-rich and safety-critical asset class) and require a minimum sensor installation for real-time data. They are the highest-cost, highest-value capability in the roadmap and are expected to be priced as a premium add-on.

---

## AI Model Governance

### Model Versioning

Every model deployed to production is versioned (semantic versioning: major.minor.patch). Model versions are stored in the SageMaker Model Registry with associated metadata: training dataset version, training date, validation metrics, and approval status (staging, production, deprecated). A production model is never overwritten — only replaced by a newer version after promotion.

### Model Monitoring

Each production model has an associated monitoring job (SageMaker Model Monitor) that tracks:

- **Data drift:** Input feature distributions are compared against the training distribution using Population Stability Index (PSI). Alert if PSI > 0.2 for any feature.
- **Prediction drift:** Output distribution is monitored for shifts. Alert if the mean predicted condition changes by more than 0.5 from the rolling 30-day baseline without a corresponding change in input data.
- **Performance drift:** For models with ground truth feedback (condition prediction models where subsequent inspections provide the actual condition), prediction error is tracked over time. Alert if RMSE exceeds 1.5× training RMSE.

Alerts are routed to the ML engineering on-call rotation via PagerDuty. Drifting models are retrained on the latest data and re-evaluated before replacement.

### Explainability Requirements

Every AI-generated output that is surfaced to a user must be accompanied by a plain-language explanation. SHAP values are computed at inference time for prediction models and converted to natural language by a template engine. The explanation format: "This prediction is [higher/lower] than average because [top 2-3 SHAP features in plain language]."

Explanations are stored alongside predictions in the database for audit. A customer can request a complete audit trail of any AI-generated output including the model version, input features, output values, and explanation.

### AI Decision Boundaries

These decisions are permanently outside AI autonomy regardless of Phase:

- Structural sufficiency ratings for load-bearing infrastructure (requires licensed engineer)
- Bridge load posting decisions
- Declaration of structural emergency
- Finalization of TAMP submission (must be approved by a human)
- Capital plan sign-off above a configurable dollar threshold (default $1M, configurable per tenant)
- Any output used in legal or regulatory proceedings without human review
