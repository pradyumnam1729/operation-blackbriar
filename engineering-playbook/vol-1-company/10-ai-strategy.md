# 10 — AI Strategy

---

## AI Vision

Aurigo will operate as a fully AI-native software company. This means something more specific than "we use AI tools." It means that AI is embedded in how we build software, how our product delivers value, and how the organization captures and applies knowledge. AI is the operating model of the engineering organization. It is not a product feature to be shipped to a roadmap item.

The three-layer AI strategy describes how this plays out: AI assists engineers in building software (Layer 1), AI capabilities are embedded in the product delivered to customers (Layer 2), and AI agents progressively take on more autonomous engineering work with human oversight (Layer 3). These layers are concurrent and reinforcing, not sequential phases.

---

## Layer 1 — AI-Assisted Development

**Status:** Active since 2024  
**Platform:** Claude Code (Anthropic)  
**Model:** All feature development, test writing, documentation, and code review involve AI assistance

### The Engineering Agent Architecture

Aurigo's AI-assisted development model is built on a structured agent hierarchy with defined roles, shared memory, and escalation paths. Each agent role has a specific mandate and a specific place in the engineering workflow.

**Engineering Manager Agent**
- Owns: sprint coordination, architectural tradeoff resolution, escalation to human engineers
- Memory: team context, current sprint objectives, outstanding blockers, architectural decisions in progress
- Escalation triggers: conflicting architectural decisions, requirements that exceed agent autonomy bounds, production incidents

**PM / Quality Guardian Agent**
- Owns: feature completeness review, scope drift detection, acceptance criteria verification
- Memory: product requirements, user stories, acceptance criteria, definition of done
- Trigger: reviews every feature PR against the relevant user stories before approval

**Architect Agent**
- Owns: architectural consistency, ADR alignment, cross-cutting concerns (security, multi-tenancy, performance)
- Memory: all ADRs, the Clean Architecture layer boundaries, the API versioning strategy, the EF Core conventions
- Trigger: any PR that changes the data model, adds a new service, or modifies a shared infrastructure component

**Backend Lead Agent**
- Owns: .NET 8 implementation standards, EF Core patterns, PostGIS usage, API design consistency
- Memory: coding standards document, all existing controllers and services, EF migration history
- Trigger: all backend PRs

**Frontend Lead Agent**
- Owns: React/TypeScript patterns, component library usage, TanStack Router/Query conventions, Tailwind/shadcn standards
- Memory: component library documentation, routing conventions, form validation patterns, API client usage
- Trigger: all frontend PRs

**Domain Expert Agent**
- Owns: infrastructure domain knowledge (RUL calculations, deterioration models, TAMP requirements, NBI rating standards, PCI methodology)
- Memory: vault/calculations/ notes, vault/decisions/, product requirement documents
- Trigger: any feature that implements or modifies a domain calculation or regulatory compliance feature

### Shared Memory and Context

The AI agent system maintains persistent context across sessions through a hierarchy of memory documents:

- `CLAUDE.md` — project conventions, setup, architectural decisions that affect all engineers
- `vault/` — domain knowledge, calculation specifications, ADRs, phase plans
- `memory/MEMORY.md` — user-specific context: role, preferences, key decisions
- `memory/*.md` — topic-specific persistent context files

Every session begins by loading relevant memory. Every significant session ends by updating memory with new decisions, patterns, or context that the next session will need.

**The institutional knowledge principle:** No knowledge that affects engineering decisions should exist only in a conversation. If an agent (or a human) makes a decision during a session that will matter to future work, that decision is captured in the appropriate memory document before the session ends.

### Practical Engineer Workflow

A typical day for an Aurigo engineer working with AI:

1. **Start of day:** Load the current sprint context, review yesterday's AI session notes, check the task queue
2. **Feature implementation:** Pair with Backend or Frontend Lead agent on the feature. The agent generates the initial implementation based on the requirements and the established patterns. The engineer reviews for domain correctness and edge cases the agent may not have considered.
3. **Test writing:** Ask the AI agent to generate test cases. The agent produces a comprehensive set of test cases based on the function signature, the domain knowledge in vault/, and the existing test patterns. The engineer reviews for domain completeness (does the agent know about the edge case where an asset has zero inspections?)
4. **Code review:** When reviewing a colleague's PR, use the AI agent to flag potential issues. The agent can identify deviation from patterns, potential performance issues, and missing test cases faster than a human reviewer scanning manually. The engineer's review focuses on domain correctness and design intent.
5. **Documentation:** Ask the agent to draft the API documentation or ADR. The engineer reviews for accuracy and completeness. The human writes the judgment content (the "why" of a decision); the AI writes the structural and boilerplate content.
6. **End of day:** Capture any new patterns, decisions, or domain knowledge learned during the day in the relevant memory documents.

---

## Layer 2 — AI-Powered Product

**Status:** Active and expanding  
**Core capabilities:** Condition prediction, deterioration modeling, capital optimization, TAMP narrative generation

### Condition Prediction

Given an asset's inspection history, Maintain's AI predicts the asset's condition score at future points in time. This powers the "Remaining Useful Life" (RUL) calculation — the estimate of how many years until the asset reaches the threshold condition score that triggers replacement or major rehabilitation.

**How it works:**
1. The AI retrieves the asset's inspection history (condition scores over time, indexed by inspection date)
2. It selects the appropriate deterioration model: linear (for assets with consistent degradation patterns) or Weibull (for assets with accelerating or decelerating degradation patterns)
3. It fits the model parameters to the observed condition data
4. It extrapolates the condition score to future years
5. It calculates the year in which the extrapolated condition crosses the threshold
6. It presents the prediction with a confidence interval based on the number of inspections and the goodness of fit

**Explainability requirement:** Every condition prediction shows the user which model was used, the model parameters, the inspection data used to fit the model, and the confidence interval. The user can change the model or the threshold and see the updated prediction in real time.

**When confidence is low:** If an asset has fewer than three inspection points, the model will fit but the confidence interval is wide. The UI prominently shows "Low Confidence — 1 inspection point" and recommends that the user add more inspection data before relying on the prediction.

### Capital Optimization

Given a set of assets with capital needs in specific years and a budget constraint over a multi-year horizon, Maintain's AI produces an optimized capital investment plan that minimizes total lifecycle cost subject to the budget constraint and risk tolerance settings.

**How it works:**
1. The AI receives the capital needs list (asset ID, projected replacement year, estimated cost, condition, risk score)
2. It applies the budget constraint for each year of the planning horizon
3. It uses a priority scoring function (configurable by the customer) that weights condition urgency, safety risk, federal funding eligibility, and cost
4. It produces a year-by-year investment schedule that maximizes the condition improvement per dollar spent
5. It shows what happens to the network condition score under the proposed plan vs. the "do nothing" scenario and vs. the "fully fund all needs" scenario

**Explainability requirement:** The optimization output includes a rationale for each deferral decision: "Asset 12345 (Route 7 Bridge) deferred from Year 2 to Year 4 because: 1) current condition score of 3.2 is above the immediate replacement threshold of 2.5, 2) the Year 2 budget is fully committed to higher-risk assets, 3) the deterioration model projects condition of 2.7 in Year 4, still above the emergency threshold of 2.0."

### TAMP Narrative Generation

Masterworks Maintain can generate a draft Transportation Asset Management Plan narrative from structured asset condition and capital plan data. The AI takes the quantitative outputs — condition percentages by asset class, 10-year capital needs by year, performance gap analysis — and produces a structured narrative in the format required by FHWA.

**How it works:**
1. The AI reads the TAMP data package: asset inventory counts, condition distributions, performance targets, capital plan, risk analysis
2. It generates a draft narrative following the FHWA TAMP structure (Executive Summary, Organization Description, Network Inventory, Condition Assessment, Performance Gaps, Financial Plan, Risk Analysis)
3. The engineer / asset manager reviews the draft, edits for accuracy, and adds agency-specific context that the AI does not know (local political context, specific legislative commitments, agency priorities)
4. The final TAMP is exported as a PDF formatted to FHWA submission requirements

**Explainability requirement:** Every numerical claim in the narrative is linked to the source data. "The state's NHS pavement is currently 68 percent in good or fair condition" links to the specific query that produced that percentage, the data sources used, and the date of the most recent condition data.

### Anomaly Detection

The AI monitors changes in asset condition and maintenance activity patterns, flagging anomalies that may indicate accelerating deterioration or a systemic problem.

**Example anomalies detected:**
- Asset condition score drop of more than 0.5 points in a single inspection cycle (normal degradation is 0.1-0.2 per year)
- Maintenance work order frequency for an asset class increasing by more than 50% quarter-over-quarter (may indicate systemic deterioration)
- An asset that was scheduled for routine inspection is overdue by more than 30 days
- An asset class where the average condition score has dropped below a threshold that historically precedes a wave of emergency failures

### Natural Language Query

Maintain's AI enables natural language queries against the asset database. Users can ask questions in plain English:

- "Show me all bridges with a sufficiency rating below 50 that are on the NHS"
- "Which pavement segments on Interstate 90 will need resurfacing in the next three years based on current deterioration rates?"
- "What is the total replacement cost of all water main assets installed before 1970?"
- "Which assets have the highest risk score and have not been inspected in the past two years?"

The AI translates these queries into structured database queries, executes them against the asset registry, and returns the results in a formatted table or map view. It shows the SQL query it generated (or a simplified equivalent) so users can verify the query logic.

---

## Layer 3 — Autonomous Engineering

**Status:** Emerging (2026+)  
**Goal:** AI agents that propose, review, and implement features with human approval gates

### The Autonomous Engineering Vision

The destination of Aurigo's AI strategy is an engineering organization where AI agents handle the full lifecycle of a well-specified feature: understanding the requirements, designing the implementation, writing the code, writing the tests, writing the documentation, creating the pull request, and responding to review comments. Humans approve at each significant gate — requirements, design, production deployment — but do not perform the implementation work.

This is not a vision for reducing headcount. It is a vision for changing the nature of engineering work. Engineers who spend their time on judgment, domain expertise, customer understanding, architecture, and quality review produce far more value than engineers who spend their time on mechanical implementation. The mechanical implementation is where AI has the highest impact. The judgment calls are where humans have the highest impact. The goal is to route every unit of human engineering effort to the judgment calls.

### Implementation Roadmap

**Phase 1 (2024-2025): Paired development**
Human engineers lead, AI agents assist. The engineer defines the approach; the agent implements it. This is the current state.

**Phase 2 (2025-2026): Spec-driven development**
Product specifications are well-structured and machine-readable. An AI agent can take a specification, propose an implementation design, and generate a PR with code, tests, and documentation. The human engineer reviews the design and the code but does not write either from scratch.

**Phase 3 (2026+): Human-gated autonomous implementation**
AI agents monitor the issue backlog, identify well-specified issues, propose implementations, and create PRs. Humans review and approve. For well-defined feature additions to existing modules, the end-to-end cycle from issue to merged PR runs without human implementation work.

### Autonomous Test Generation

A near-term autonomous capability that is already partially active: given any function signature and its associated domain documentation (in vault/), the AI agent generates a comprehensive test suite covering:
- Happy path cases
- Boundary conditions (edge values, empty collections, null inputs)
- Domain-specific edge cases (assets with no inspection history, assets with condition score exactly at threshold)
- Integration scenarios (does the calculation produce the correct result when called via the API?)

The generated tests are reviewed by the engineer who implemented the function, corrected if any test misunderstands the domain, and then committed as part of the feature PR.

### Autonomous Documentation Updates

When a PR is merged that changes the behavior of a feature, an AI agent can generate a diff of the documentation change required — identifying which vault/ notes, API documentation, and user-facing help text needs to be updated. The engineer reviews the proposed documentation changes and commits them.

This closes one of the most common gaps in software development: code that changes but documentation that doesn't.

---

## AI Safety Principles

These principles are non-negotiable. They apply to AI capabilities in the product (Layer 2) and to AI-assisted engineering (Layer 1).

**AI never deploys to production without human approval.** No matter how confident the AI is that a change is correct, a human engineer must review and approve before deployment. The CI/CD pipeline requires a human approval gate before production deployment. This is enforced at the infrastructure level, not just by policy.

**AI never makes financial recommendations without explainability.** Every capital plan recommendation, every cost estimate, every prioritization score is shown with the inputs, model, and assumptions that generated it. The capital planner can audit any recommendation. If the recommendation cannot be audited, it is not shown.

**AI never fabricates data.** If inspection data is missing, the AI says "insufficient data" — it does not estimate or impute values that will be treated as actual inspections. The distinction between a measured condition value and a predicted condition value is always visible to the user.

**All AI recommendations are auditable and traceable.** Every AI output is stored with its inputs and model version. If a capital plan is generated in Year 1 and a TAMP auditor asks in Year 3 to reproduce the analysis, the system can replay the Year 1 model with the Year 1 inputs and produce the same output.

**AI models are calibrated and monitored.** Deterioration models are validated against actual outcomes annually. When actual condition in Year N differs significantly from the model's Year N prediction (made in Year N-3), the model is recalibrated and the deviation is documented.

**AI never overrides human judgment on safety-critical decisions.** For assets with safety implications (bridges, pressure vessels, airport runways, generators in critical facilities), the AI provides decision support and risk flags — it does not make the replacement recommendation autonomously. A human with appropriate credentials must review and authorize the recommendation.

---

## AI Cost Management

AI is a cost of goods sold (COGS). It must be managed with the discipline of any other COGS. Aurigo's AI cost model is measured, capped, and continuously optimized.

### Cost model — key drivers

- **Layer 1 (engineering assist):** Claude Code subscriptions + API overage. Budgeted per engineer, capped monthly.
- **Layer 2 (product AI):** Per-tenant per-month AI compute consumption tied to condition prediction, capital optimization, TAMP narrative generation, and NLQ. This is 80–90% of Aurigo's AI COGS.

### Budgeted 2026 AI costs (illustrative)

| Cost driver | Volume | Unit cost (blended) | Annual |
|-------------|--------|----------------------|--------|
| Claude Code seats | 380 engineers | $200/mo | $912K |
| Claude API overage (Layer 1) | ~$400/eng/yr | — | $152K |
| Product AI — Sonnet-class (RAG, NLQ) | 4.5M requests | ~$0.015/req | $67K |
| Product AI — Opus-class (TAMP narrative) | 12K narratives | ~$1.20/narrative | $14K |
| Product AI — Haiku-class (classifications, condition tags) | 55M calls | ~$0.0006/call | $33K |
| Embedding generation | 8M items | ~$0.00013/item | $1K |
| Vector storage (pgvector-managed) | 200M vectors | Amortized | $95K |
| Fine-tuning experiments (quarterly) | — | — | $80K |
| **Total AI COGS 2026** | — | — | **~$1.35M** |

Expressed as a share of gross margin, this is ~1.7% of 2026 revenue — well within the 3% ceiling that the finance model tolerates. Above 3%, AI cost is escalated to the CTO as a margin risk.

### Per-tenant AI budget

Each tenant has:
- **Included allowance:** 10,000 asset-months of modeling per month.
- **Overage rate:** $0.40 per 1,000 asset-months.
- **Hard cap:** Configurable per contract; default 3× included allowance. When hit, degrades to rule-based fallbacks with a customer-facing banner.

The billing pipeline tracks tokens-consumed per tenant per feature per model. Alerts trigger at 80% of monthly budget.

### Cost controls (mandatory)

1. **Prompt caching** — every prompt >2K tokens must use Anthropic prompt caching. Non-cached prompts require a written exception approved by the AI Engineering Lead.
2. **Model routing** — a request must route to the cheapest model that meets the quality bar (see model selection guide below).
3. **Batch mode** — any non-realtime workflow (condition backfill, TAMP narrative generation) uses batch API (50% discount).
4. **Circuit breakers** — any tenant that spikes 5× above its 7-day rolling average is auto-throttled and paged to the AI on-call engineer.
5. **Quarterly cost audit** — the top 3 features by token spend are re-examined for prompt compression, caching, or model downgrade opportunities.

---

## AI Model Selection Guide

Model choice is not preference; it is engineering. The guide below is authoritative for all Aurigo AI code (both product and internal).

### Decision matrix

| Use case | Latency budget | Quality bar | Model tier | Fallback |
|----------|----------------|-------------|------------|----------|
| Classification (defect from photo, asset type from text) | < 500ms | High recall, moderate precision | **Haiku** | Rule-based classifier |
| Condition tag extraction from inspection notes | < 1s | Domain-accurate | **Haiku** | Structured form entry |
| Retrieval-augmented answer over asset registry | < 3s | Cite sources | **Sonnet** | Deterministic query |
| Capital plan explanation ("why did the AI defer this?") | < 5s | Explainable, precise | **Sonnet** | Templated explanation |
| TAMP narrative section drafting | < 60s (batch OK) | Publication quality, cite data | **Opus** | Templated boilerplate |
| Multi-step agentic workflows (capital optimization loop) | 30s–3min | Reasoning depth | **Opus** with Sonnet sub-steps | Downgrade to Sonnet |
| Coding tasks — refactoring, tests | Multi-second | High correctness | **Claude Code Opus-class** | Sonnet |
| Coding tasks — trivial changes, boilerplate | Multi-second | Correct enough | **Sonnet** | — |
| Embeddings | < 100ms | Consistent | **Voyage-3** (via Anthropic partner) or OpenAI text-embedding-3-small | — |

### Cost-per-quality curve

Aurigo's internal eval suite (see prompt versioning below) measures quality on a per-task basis. Model is chosen at the lowest tier that hits the **90th-percentile quality threshold** for that task. If a task's Haiku quality is <90th percentile, it escalates to Sonnet; only escalate to Opus if Sonnet fails.

### Multi-model fallback

Every production AI feature has a fallback path:
- Primary: Claude (chosen tier)
- Secondary: OpenAI equivalent tier (via LiteLLM proxy)
- Tertiary: Deterministic rule-based path with reduced feature capability

Model outages must not cause customer-facing feature outages. The rule-based path is exercised in monthly chaos tests.

---

## Prompt Versioning Strategy

Prompts are code. They ship with the same rigor.

### Prompt storage

All prompts live in `src/*/Prompts/` as `.md` files. Every prompt file has:
- Frontmatter: `id`, `owner`, `model_target`, `version`, `last_evaluated`, `cache_priority`.
- The prompt body itself, with named placeholders.
- A `# Change log` section listing every version's rationale.

### Prompt versioning rules

- Every prompt change is a **semver bump** (`major.minor.patch`).
  - Patch: wording tweaks, output-format changes with backward-compatible parsers.
  - Minor: new placeholders, new capabilities, no breaking output changes.
  - Major: breaking output format changes, model-tier changes, new persona.
- The version string is passed in the API request logging so every AI output in production is traceable to a specific prompt version.
- Major bumps require a green run of the eval suite AND a PR review from the AI Engineering Lead.
- Prompts have a mandatory `deprecated_after` field if being retired. Old versions run in shadow mode for 30 days after the switch.

### Prompt eval harness

- Every prompt has an eval file (`<prompt>.evals.jsonl`) with input/expected-output pairs and rubrics.
- The CI harness runs evals on any PR touching a prompt. Prompts that regress on eval quality fail CI.
- Golden-set expansion: any customer-reported AI bug adds a case to the golden set.

### Deployment

- Prompts deploy through the same CI/CD as code — no in-place edits in production.
- Rollback is `git revert` of the prompt file + redeploy. Prompts never live outside the repo.

---

## AI Failure Mode Analysis

Every deployed AI feature is analyzed against these failure modes. Any feature that cannot answer all of them does not ship.

| Failure mode | Description | Mitigation | Test |
|--------------|-------------|-----------|------|
| **Hallucination** | Model invents data not in the source | Structured RAG with citation, refuse-to-answer on missing data | Eval set with adversarial "unanswerable" cases |
| **Silent regression** | Model quality drops after provider change | Continuous eval scoring, alert on drift | Weekly eval run against golden set |
| **Prompt injection** | User input tricks the model into a different task | Structured input parsing, output validation, guardrails | Injection test set in eval harness |
| **Confidence miscalibration** | Model expresses false certainty | Enforce confidence-interval outputs; teach model to say "insufficient data" | Calibration eval — expected vs. reported confidence |
| **PII leak** | Model surfaces data across tenants | Tenant-scoped RAG only; output PII scan | Cross-tenant probe suite |
| **Cost blowup** | Model spirals in agentic loops | Max-step cap, budget cap per session | Load test with adversarial prompts |
| **Latency degradation** | Provider slow-down cascades to user | Timeouts + fallback tier | Chaos test with injected latency |
| **Model deprecation** | Anthropic/OpenAI EOLs a model version | Multi-tier ready alternatives; abstract via LiteLLM | Quarterly failover exercise |
| **Domain drift** | Model output diverges from evolving regulation (e.g., new FHWA rule) | Domain SME quarterly review of prompts | Regulation-change ticket triggers prompt review |
| **Explainability failure** | Model produces answer without traceable rationale | Enforce chain-of-thought with citations for regulated outputs | Explainability eval must pass 100% for TAMP outputs |

---

## AI Governance Framework — Explainability, Bias, Auditability

Product AI operates in regulated environments (public infrastructure, capital planning, life sciences). Governance is not optional.

### Explainability

Every AI output that affects a capital or compliance decision must include:
1. **Inputs** — which data records were used
2. **Model** — which prompt version, which model tier, which deterioration formula
3. **Confidence** — a quantified confidence interval or level
4. **Alternatives** — what would the answer be with different assumptions

The UI is required to show these on demand for any decision-support surface. This is a Vol-3 § 07 security requirement (auditability) enforced by the codebase.

### Bias monitoring

- **Geographic bias:** Aurigo monitors AI recommendation acceptance rate by customer region. A large delta in acceptance (say, urban vs. rural DOTs) triggers a bias audit.
- **Asset-class bias:** Deterioration models are trained per asset class. If the model's error distribution has a systemic skew (e.g., always over-predicts on prestressed concrete bridges), it is recalibrated.
- **Language/format bias:** Inspection notes in different formats (paper-transcribed vs. keyboard-entered) get separate quality tracking.

### Auditability

- Every production AI call is logged (tenant, user, prompt version, model, tokens, input hash, output hash, latency, cost).
- Logs retain for **7 years** (matches TAMP audit requirement).
- Log storage is append-only (S3 Object Lock, WORM).
- On any customer audit request, Aurigo can reconstruct the exact reasoning path from the timestamp — the model version, the prompt, the inputs. This is a contractual commitment for regulated customers.

### Governance forum

- **AI Governance Committee** meets monthly.
- Members: CTO (chair), Head of AI Engineering, Chief Compliance Officer, Head of Product, Chief Customer Officer, external legal counsel.
- Reviews: new AI features, eval regression trends, customer complaints, regulator inquiries.
- Approval required for: any new AI-generated content that becomes a regulatory submission (e.g., TAMP narrative), any model tier change on a regulated feature, any cross-tenant training data question.

---

## AI Investment ROI — Engineering Productivity Multiplier

### Baseline

Pre-Claude-Code (2023 baseline): Aurigo's engineering throughput per engineer, measured in story-points-delivered per sprint, normalized for engineer level and feature complexity, was set at **1.0×**.

### Measured multiplier (2026)

Aurigo tracks throughput via three converging signals:

1. **Story-point delivery (normalized).** Trailing 6-month average: **2.3×** baseline.
2. **Feature-cycle time (from spec to prod).** Trailing 6 months: **-42%** (a 12-day median cycle vs. 21-day baseline).
3. **Test coverage delta.** Coverage on Calculations layer rose from 78% to 92% in the same period at unchanged headcount — a productivity dividend, not test-writing labor.

Aurigo's target multiplier is **3.0× by end of 2028**, driven by Layer 3 (autonomous engineering) adoption.

### ROI calculation

| Line | Amount |
|------|--------|
| Fully loaded engineer cost (blended, 2026) | $220K/yr |
| Engineers | 380 |
| Baseline productive capacity | 380 × 1.0 = 380 EFE |
| Actual productive capacity (2.3× multiplier) | 874 EFE |
| Equivalent engineers Aurigo would need to hire to match | 494 |
| Avoided salary cost | 494 × $220K = **$108M/yr** |
| AI COGS (Layer 1 slice) | ~$1.1M/yr |
| **Net productivity ROI** | **~98×** |

*EFE = Effective Full-time Engineer, normalized story-point capacity.*

### Where the ROI is highest

- **Test generation:** ~5× improvement in test cases written per PR.
- **Documentation:** ~4× improvement in doc coverage per feature.
- **Boilerplate CRUD scaffolding:** ~6× improvement.
- **Regulatory reference lookups:** ~3× improvement (Domain Expert Agent).
- **Code review augmentation:** ~2× improvement in defects caught pre-merge.

### Where the ROI is lowest

- **Complex distributed systems debugging:** ~1.3× — humans still lead.
- **Architecture decisions:** ~1.1× — AI is a sparring partner, not a decision-maker.
- **Customer conversations:** N/A — no AI substitute.

Engineers who use AI ineffectively (< 1.5× multiplier for two consecutive quarters) receive a values-anchored coaching plan focused on AI Amplification (Value 4) with the AI Engineering team.

---

## AI Governance Runbook Excerpt

Real, actionable procedures the AI on-call engineer follows:

**When a customer reports a wrong AI recommendation:**
1. Retrieve the AI log entry by request ID.
2. Reproduce the recommendation in the eval harness with the same prompt version, model, and inputs.
3. If reproducible: file eval regression case; open prompt-fix or model-tier ticket; notify Customer Success within 4 business hours.
4. If not reproducible: check model provider status; escalate to AI Engineering Lead.
5. Post-mortem within 5 business days if the recommendation affected a customer capital decision.

**When AI cost spikes 5× over baseline for a tenant:**
1. Auto-throttle triggers at 5×. Page AI on-call.
2. Root-cause: usually agentic loop, prompt injection attempt, or feature bug.
3. Notify tenant CSM within 2 business hours if throttled.
4. If root cause is Aurigo code, ship fix and reverse throttle within 24h.

**When Anthropic (or OpenAI) posts a model deprecation notice:**
1. Head of AI Eng creates a migration ticket the same day.
2. Eval suite runs against the successor model tier within 48 hours.
3. If successor passes, ship migration through standard CI/CD.
4. If successor fails, escalate to CTO for provider-tier decision.

---

*This concludes Volume 1. See [Volume 2 — Product Knowledge](../vol-2-product-knowledge/README.md) for detailed product and domain documentation.*
