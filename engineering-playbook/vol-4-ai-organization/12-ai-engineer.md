# AI Engineer

## Mission

The AI Engineer builds, calibrates, and maintains the machine learning and AI capabilities that make Aurigo Maintain a System of Intelligence rather than a System of Record. The AI Engineer works at the intersection of domain mathematics (infrastructure asset deterioration modeling, optimization theory), software engineering (Clean Architecture, .NET, Python ML tooling), and LLM prompt engineering (Claude for TAMP narrative generation and NLP query).

This role requires breadth: a narrow ML specialist who doesn't understand the domain will produce models that are technically elegant but domain-wrong; a domain expert who doesn't understand ML will produce mathematically incorrect models; a software engineer who doesn't understand either will produce models that are correct but unmaintainable. The AI Engineer must be competent in all three dimensions.

---

## Responsibilities

### Deterioration Model Development and Calibration

Own the deterioration modeling layer in `Application/Calculations/`. This includes both the linear model (default, used when insufficient data exists for calibration) and the Weibull survival model (calibrated when sufficient inspection history exists).

**Model calibration process**:
1. Extract historical inspection records from the PostgreSQL database (per tenant, per asset class, per climate zone)
2. Apply data quality filters (remove single-inspection assets, remove assets with known data entry errors)
3. Fit Weibull parameters (shape β, scale η) using maximum likelihood estimation
4. Validate calibration: held-out test set, check that survival function matches observed inspection data distribution
5. Document calibration results: parameter values, confidence intervals, goodness-of-fit statistics, asset class and climate zone scope
6. Publish to the ModelSettings table in the database (one row per asset class per climate zone per calibration run)
7. Run the anomaly detection job against the new model parameters to surface any assets whose current condition significantly deviates from the updated model

Calibration runs quarterly for asset classes with > 50 inspection records. For asset classes with fewer records, the linear model is used with AASHTO-specified default deterioration rates.

### Capital Plan Optimization Algorithm

Own the ILP-based capital plan optimizer. The optimizer takes a set of candidate projects (one per asset needing work), a multi-year budget envelope, and a set of optimization weights (risk vs. condition vs. age) and returns a feasible, optimized project schedule.

**Algorithm maintenance responsibilities**:
- Monitor solution quality: for every optimization run, log the objective function value (total risk reduction) and compare to a lower-bound estimate. Solution quality below 80% of the lower bound triggers investigation.
- Tune solver parameters: the ILP solver (Google OR-Tools) has parameters that affect the speed/quality tradeoff. Maintain configuration for typical Maintain portfolio sizes (50–2000 candidate projects).
- Handle infeasibility: when no feasible solution exists (budget too low to meet minimum condition requirements), the optimizer must detect infeasibility and return a clear explanation, not an exception.
- Add constraint types: as new business rules emerge (dependency constraints, phasing requirements, funding source restrictions), add them to the optimization formulation.

### TAMP Narrative Generation Pipeline

Own the TAMP narrative generation pipeline that uses Claude to produce draft TAMP sections from structured data. Responsibilities:

**Prompt engineering**: Write and maintain the system prompts for each TAMP section. Prompts must:
- Produce FHWA-compliant language (specific terminology required by 23 CFR Part 515)
- Cite specific data from the structured context without hallucinating additional claims
- Flag when input data is insufficient to support a required TAMP statement
- Match the formal, professional tone of a federal compliance document

**Pipeline architecture**: The pipeline is a C# service that: (1) assembles the structured context from the database, (2) calls the Claude API, (3) handles rate limits and retries, (4) stores the generated draft with version metadata, (5) presents the draft for human review.

**Quality monitoring**: Track which AI-generated sections require the most human editing (high edit rate → prompt needs improvement). Track which sections produce FHWA reviewer comments in final submitted TAMPs (rare but high-signal: the AI made an error that an expert reviewer missed).

### Anomaly Detection Engine

Own the nightly anomaly detection job. The job runs after midnight for all active tenants:
1. Pull current condition scores and condition history for all assets
2. Apply the current deterioration model to compute predicted condition scores
3. Compute the normalized deviation (actual - predicted) / model standard deviation
4. Classify anomalies by severity (Moderate, High, Critical)
5. Write new anomaly records to the database for any assets exceeding the threshold
6. Trigger notification pipeline for Critical anomalies

Monitor false positive rate: if the anomaly detection is generating too many alerts that turn out to be data entry errors (condition score accidentally recorded as 4 instead of 40), the threshold or the data quality filter needs adjustment.

### NLP Query Interface

Own the natural language query interface. Responsibilities:
- Maintain the Claude system prompt for SQL generation (includes the database schema, tenant isolation constraints, read-only enforcement rules, and output format instructions)
- Monitor query accuracy: log generated SQL queries and their results; sample 5% of queries per week for accuracy review
- Handle schema changes: when the database schema changes, update the NLP query system prompt
- Implement safety controls: read-only enforcement (SELECT-only user for NLP queries), rate limiting, query complexity limits

### Model Monitoring and Governance

Own the model monitoring infrastructure:
- Version every model parameter set (Weibull parameters, optimization weights, anomaly detection thresholds)
- Track model drift: for Weibull models, compare prediction accuracy on new inspection data arriving after calibration. If accuracy drops below threshold, trigger recalibration.
- Maintain the model explainability layer: every AI output must carry a plain-language explanation that references the specific inputs and model parameters used
- Run bias audits quarterly: do the models perform differently for different asset classes, age ranges, or geographic regions in ways that could disadvantage certain agency types?

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| Weibull Model Prediction Accuracy (MAPE) | < 15% on held-out test set | Per calibration |
| Optimizer Solution Quality | > 80% of lower bound on objective function | Per optimization run |
| Anomaly Detection False Positive Rate | < 10% of flagged anomalies are data entry errors | Monthly |
| TAMP Narrative Human Edit Rate | < 25% of generated paragraphs require substantive edits | Monthly |
| NLP Query Accuracy | > 90% of queries return correct results | Weekly |
| Model Calibration Frequency | All eligible asset classes recalibrated quarterly | Quarterly |
| Explainability Coverage | 100% of AI outputs carry a plain-language explanation | Per release |

---

## Authority

The AI Engineer has authority to:
- Update model parameters and recalibrate models (requires documentation, not approval)
- Update prompts for the TAMP narrative generator (requires QA Lead review for significant changes)
- Tune optimization solver configuration
- Set anomaly detection thresholds

The AI Engineer does not have authority to:
- Change the product feature scope for AI capabilities
- Deploy to production without going through the standard CI/CD pipeline
- Access customer data outside of the anonymized analytics and aggregated model training datasets

---

## Deliverables

**Per calibration run**: Model calibration report (parameters, accuracy metrics, comparison to prior version)

**Monthly**: AI capability performance report (model accuracy trends, anomaly detection false positive rate, NLP query accuracy, TAMP edit rate)

**Quarterly**: Model governance audit (drift analysis, bias audit, explainability quality review)

**Per new AI feature**: Technical design document (algorithm description, data requirements, output format, explainability approach, test vectors)

---

## Decision Making

When selecting or updating a model approach:

1. **Accuracy first**: Does the model produce correct predictions? Use held-out test sets, known-good reference values, and domain expert validation.
2. **Explainability second**: Can the model's output be explained to a non-technical agency employee in 2 sentences? If not, it may be too complex for the context.
3. **Simplest model that works**: Prefer linear models over Weibull when linear is accurate enough (saves calibration data requirements). Prefer Weibull over neural network approaches (more explainable, less data-hungry).
4. **Failure mode graceful**: What does the model do when input data is missing or out of range? It must degrade gracefully, not throw exceptions or produce nonsense.

---

## Daily Workflow

**08:00–08:30** — Review overnight model jobs (anomaly detection, scheduled optimizations). Any failures? Any unusual anomaly rate spikes (may indicate data quality issue from an EAM sync problem)?

**08:30–10:00** — Active model development or calibration work.

**10:00–11:00** — Collaboration with Backend Lead on Calculations/ code quality and integration test coverage.

**11:00–12:00** — Prompt engineering and TAMP narrative quality review.

**14:00–16:00** — Research: reading deterioration modeling literature, AASHTO publications, optimization algorithm updates, new Claude model capabilities.

**16:00–17:00** — Documentation: calibration reports, model governance records, technical design updates.

---

## Collaboration

**With Lifecycle Domain Expert**: Most important collaboration relationship. The domain expert validates that model outputs make sense; the AI Engineer validates that the math is correct. When they disagree, they jointly investigate with real data. The domain expert's sanity check is required before any model update ships.

**With Backend Lead**: Calculations/ code must meet the same quality standards as all other backend code. The AI Engineer writes the algorithm; the Backend Lead reviews implementation quality, performance, and test coverage.

**With QA Lead**: Test vector development for calculation tests. The AI Engineer and QA Lead jointly define known-good input/output pairs anchored to domain literature. These become the mutation-testing-resistant test cases.

**With DevOps Engineer**: AI job infrastructure (nightly batch jobs, optimizer queue, Claude API call management, CloudWatch metrics for model job latency).

---

## Escalation

The AI Engineer escalates to the ED when:
- A model calibration produces parameters that the domain expert considers domain-implausible, and the discrepancy cannot be resolved by data investigation
- The Claude API introduces a breaking change to model behavior (prompt caching invalidation, output format change)
- Model performance is degrading and requires emergency recalibration outside the quarterly schedule

---

## Continuous Improvement

Monthly: review the TAMP narrative edit log. Which paragraphs get edited most heavily? The prompt for those sections needs improvement.

Quarterly: run the full model governance audit — drift analysis, bias audit, explainability quality check. Document findings and improvement actions.

Annually: evaluate whether new model approaches (newer Weibull variants, Markov chain models, survival analysis extensions) would improve accuracy significantly enough to justify the implementation and calibration cost. The AI Engineer must balance improvement pursuit against stability for customer-facing models.

---

## Example Scenarios

### Scenario 1: Diagnosing Model Calibration Failure for Timber Bridges

The quarterly calibration run completes for all asset classes. Review reveals that the Weibull model for Timber Bridges produces unexpected parameters: shape β = 0.4, which represents an "infant mortality" failure pattern (most failures early, then decreasing failure rate). For timber bridges, this is domain-wrong — timber bridges fail due to decay which accumulates over time (an increasing failure rate pattern, β > 1).

The AI Engineer investigates the calibration dataset: 34 timber bridge inspection records across 8 bridges. Six of the 8 bridges have only one inspection record each. The optimizer is fitting to a dataset that is too small and too sparse for the Weibull model.

Decision: fall back to the linear model with AASHTO-specified timber bridge deterioration rate (1.8 points/year) for this asset class until more inspection records accumulate. The AI Engineer documents the decision, updates the ModelSettings record with model_type = "Linear", calibration_note = "Insufficient data for Weibull calibration", and notifies the Lifecycle Domain Expert who validates the linear rate is appropriate.

### Scenario 2: Improving the Optimizer for Large Portfolios

A state DOT with 2,400 bridge projects in their capital needs register runs the capital plan optimizer. The optimizer times out after 30 seconds without producing a feasible solution, returning an error to the user.

The AI Engineer investigates: the ILP problem has 2,400 binary decision variables and 1,200 constraints. The exact solver is spending all 30 seconds branching without finding a feasible solution because the initial LP relaxation is too loose.

Fix: implement a two-phase approach: (1) heuristic pre-selection — reduce the candidate set to the top 800 projects by risk score × urgency (eliminating 1,600 projects that the optimizer would very likely not select anyway), (2) run the exact ILP on the reduced set. The heuristic pre-selection runs in < 1 second; the ILP on 800 variables completes in 8 seconds with a solution quality > 92% of optimal.

The AI Engineer documents the algorithm change in an ADR, adds a unit test that verifies solution quality against a known-optimal small test case, and validates with the Lifecycle Domain Expert that the pre-selection heuristic doesn't systematically exclude any asset class.

### Scenario 3: Resolving a TAMP Narrative Accuracy Issue

A customer submits their TAMP to FHWA. The FHWA reviewer returns a comment on the Life Cycle Planning section: "The plan states that concrete bridge elements have an average design life of 100 years. FHWA guidance and AASHTO literature cite 75 years for concrete bridge decks and 100 years for concrete superstructures. Please clarify."

The customer escalates to the AI Engineer (via the Lifecycle Domain Expert). Investigation: the TAMP generation prompt included a generic "concrete elements have design life 100 years" instruction that the domain expert had not reviewed.

Fix: (1) update the prompt to specify design life by element (not just material), using AASHTO-specified values per element type; (2) require Lifecycle Domain Expert review of all TAMP prompt changes going forward; (3) add a unit test that verifies the model settings used for TAMP generation match the domain-reviewed reference values.

The customer resubmits with the corrected narrative. FHWA accepts it. The AI Engineer documents the incident in the model governance log and adds element-specific design life to the validation checklist for future calibration reviews.

---

## AI Agent Pairing

The AI Engineer pairs with a **Model Development Agent** — a Claude Code session used for ML model calibration, prompt engineering, and AI safety review.

**What the agent handles autonomously:**
- Implementing and tuning deterioration model parameter fitting against historical inspection datasets
- Drafting and iterating on Claude prompt templates for TAMP narrative generation
- Generating worked examples and edge-case tests for new calculation engines
- Reviewing prompt outputs against the FHWA TAMP guidance checklist and flagging regulatory accuracy issues
- Profiling agent response latency and identifying prompt optimisations (context reduction, caching)
- Maintaining the model governance log (prompt versions, calibration datasets, validation results)

**What requires the human's judgment:**
- Accepting a calibrated model for production — the agent produces the validation report, the AI Engineer decides if the results are trustworthy
- Choosing between model approaches (e.g., Weibull vs. Markov chain deterioration) based on data availability and domain fit
- Deciding when a prompt change is significant enough to trigger Gate 5b (calculation accuracy) review
- Resolving conflicts between the model's statistical output and the domain expert's sanity check

**Prompt guidance:** When briefing this agent for model calibration work, include: the asset class, the historical inspection dataset (or a sample), the target output metric, and the validation criteria (acceptable error margin). For prompt engineering work, include the target audience, the regulatory section being addressed, and three examples of acceptable vs. unacceptable outputs. See `engineering-playbook/vol-7-ai-engineering/` for AI engineering standards.
