# 07 — Success Metrics

---

## Overview

Metrics are only useful when they are connected to decisions. Each metric in this document exists because someone will use it to decide something: whether to continue investing in a product area, whether to prioritize a feature, whether to assign more engineers to an area, whether to escalate a customer issue. Every engineer should understand the business metrics that their work influences, not just the technical metrics that measure code quality.

This document is organized into four tiers: Business Metrics (company health), Product Metrics (product value delivery), Engineering Metrics (delivery capability), and Customer Success Metrics (customer outcomes). These tiers are interdependent: engineering metrics predict product metrics, product metrics predict customer success metrics, and customer success metrics predict business metrics.

---

## Business Metrics

### Annual Recurring Revenue (ARR)

ARR is the primary measure of Aurigo's commercial health. It represents the annualized value of all subscription contracts. ARR is tracked at the company level and broken down by product line (Masterworks vs. Primus), module (Plan, Build, Maintain), and segment (public sector vs. private sector).

The target ARR growth rate for a scale-up phase SaaS company in this market is 40 to 60 percent year-over-year. Below 30 percent indicates that market penetration is insufficient or that competitive dynamics are adverse. Above 70 percent requires examining whether growth is sustainable (is churn low? are new customers healthy?).

**Engineering relevance:** ARR is a lagging indicator of product quality. A product that has high defect rates, poor performance, or a confusing user experience will lose customers over time. The connection between engineering quality and ARR is real; it is just measured in months to years, not days.

### Net Revenue Retention (NRR)

NRR measures the revenue retained from existing customers, including expansion revenue from upsells and cross-sells, minus revenue lost from downgrades and churn. NRR above 120 percent means the existing customer base is growing without acquiring new customers. NRR above 130 percent is exceptional.

**Target NRR:** 120 to 135 percent  
**Why this matters:** An NRR above 120 percent means that even if Aurigo stopped acquiring new customers tomorrow, revenue would still grow. This is the compounding effect of the land-and-expand motion. Every Masterworks Plan customer who adds Maintain contributes to NRR.

**Engineering relevance:** NRR is highly sensitive to the quality of the expansion product. If Maintain is not compelling or has a poor implementation experience, Plan customers do not expand. Every feature in Maintain that creates clear value for an existing Plan or Build customer is a direct contribution to NRR.

### Customer Churn Rate

Annual logo churn (the percentage of customers who cancel completely) and revenue churn (the percentage of ARR that cancels). In public sector infrastructure software, logo churn should be below 5 percent per year. Revenue churn should be below 3 percent.

**Why churn is so low in public sector:** Switching cost is high (data migration, re-procurement, staff retraining), contract terms are multi-year, and the procurement process is painful enough that customers tolerate imperfect software rather than going through another procurement cycle. This means Aurigo can invest in retention through product improvement rather than aggressive competitive pricing.

### Customer Acquisition Cost (CAC) and CAC Payback Period

CAC is the total sales and marketing cost divided by the number of new customers acquired. CAC payback period is the number of months required to recover the CAC through gross profit.

**Target CAC payback:** 18 to 24 months for new logos, 6 to 9 months for expansion within existing accounts.

**Engineering relevance:** A strong product reduces CAC because customers refer peers, industry conferences generate inbound interest, and competitive evaluations are easier to win. Every improvement to Maintain that makes it demonstrably better in a 30-day proof of concept reduces the cost of acquiring the next customer.

### LTV / CAC Ratio

The ratio of customer lifetime value to customer acquisition cost. A ratio of 3:1 is the minimum threshold for a healthy SaaS business. 5:1 or above indicates strong unit economics. Given Aurigo's high switching cost and long contract terms, a target of 6:1 to 8:1 is achievable as the product matures.

### Expansion Revenue from Maintain Add-ons

The quarterly new ARR generated from Maintain licenses sold to existing Masterworks Plan and Build customers. This is tracked separately from new logo revenue because it requires no new sales cycle and represents the pure financial return on the platform strategy investment.

**Target:** Expansion Maintain ARR should represent at least 40 percent of total new ARR by year three of the Maintain launch. If it is below 30 percent, it means the land-and-expand motion is not working — either because Maintain's value proposition is not compelling to Plan/Build customers or because the sales team is not positioning the expansion effectively.

---

## Product Metrics

### Daily Active Users / Monthly Active Users (DAU/MAU) by Module

The DAU/MAU ratio measures user engagement. A high DAU/MAU (above 0.4) means users are visiting the product almost every working day. A low ratio (below 0.15) means the product is used occasionally but is not embedded in daily workflows.

**Targets by module:**
- Field Inspector (inspection recording): DAU/MAU > 0.5 (inspectors use the tool on every inspection day)
- Asset Manager (condition review, capital planning): DAU/MAU > 0.3 (weekly use of core dashboards)
- Executive Dashboard: DAU/MAU > 0.15 (monthly board preparation, weekly check-ins)
- TAMP Module: Seasonal (spikes around TAMP submission cycles); track annual completion events

### Feature Adoption Rate

The percentage of active customers using each major feature. A feature that is shipped but unused is waste. Feature adoption is tracked at 30/60/90 days post-launch.

Key features to track:
- Condition inspection recording (mobile)
- Deterioration model configuration
- Capital needs report generation
- TAMP report module
- AI prioritization recommendation (view + accept/reject)
- Integration health dashboard (for Integrated mode customers)

**Target:** A newly launched feature should reach 60 percent adoption among active users within 90 days. Features below 30 percent at 90 days should be reviewed for UX issues or positioning problems.

### Data Quality Score

The average completeness of asset records across all customers: the percentage of required fields populated, the percentage of assets with current (within-cycle) condition ratings, and the percentage of assets with geometry (location recorded).

**Why this matters:** Every AI capability in Maintain depends on data quality. A deterioration model built on incomplete inspection history is unreliable. A capital needs analysis that covers only 60 percent of the asset inventory is misleading. Data quality is a prerequisite for AI value.

**Target:** 85 percent average data completeness score across active customers after 12 months of deployment. Below 70 percent indicates that the data import and maintenance workflow needs improvement.

### Integration Health (for Integrated Mode Customers)

- EAM data sync success rate (percentage of scheduled sync events that complete without error)
- Sync latency (time from EAM record update to Maintain record update)
- Data conflict rate (percentage of EAM records that conflict with Maintain records at sync)

**Target:** 99.5 percent sync success rate. Latency under 15 minutes for near-real-time integrations.

### AI Utilization Rate

The percentage of AI-generated recommendations (capital prioritization, condition alerts, deterioration model outputs) that users view and act on, vs. recommendations that are generated but ignored.

This metric has two components:
1. **View rate:** What percentage of AI recommendations are opened and read?
2. **Acceptance rate:** Of viewed recommendations, what percentage does the user act on (accept the prioritization, acknowledge the alert, adopt the suggested capital plan)?

**Target:** View rate above 70 percent. Acceptance rate above 50 percent. If acceptance rate is below 30 percent, the AI recommendations are not matching user expectations — either the model is wrong, the explanation is insufficient, or the recommendations are not actionable given the user's constraints.

---

## Engineering Metrics (DORA)

Aurigo measures engineering delivery using the DORA (DevOps Research and Assessment) framework. These four metrics have been validated as the best leading indicators of software delivery performance and organizational reliability.

### Deployment Frequency

How often does Aurigo deploy to production? The goal is multiple deployments per day per service in a mature CI/CD pipeline, or weekly for major feature releases.

**Current target:** Weekly deployments for the Maintain application. Daily or on-demand for hotfixes.

**Why this matters:** Higher deployment frequency means smaller batch sizes, faster feedback, and lower risk per deployment. An organization that deploys weekly learns from production 52 times per year. An organization that deploys monthly learns only 12 times.

### Lead Time for Changes

The time from a code commit to that commit running in production. This includes code review, automated testing, build, and deployment pipeline execution.

**Target:** Under 2 hours for a code change committed to the main branch (assuming tests pass). Under 30 minutes for a hotfix.

### Mean Time to Recovery (MTTR)

When a production incident occurs, how quickly is the system restored to normal operation? MTTR measures the operational resilience of both the system and the engineering team.

**Target:** Under 1 hour for P1 incidents (full service outage). Under 4 hours for P2 incidents (major feature unavailable). Under 24 hours for P3 incidents (degraded performance, workaround available).

### Change Failure Rate

The percentage of deployments that cause a production incident requiring a hotfix, rollback, or patch.

**Target:** Below 5 percent. An elite organization achieves below 2 percent. Above 15 percent indicates that the testing and review process is insufficient.

### Test Coverage by Module

- **Domain layer:** ≥ 90 percent line coverage
- **Application/Calculations:** ≥ 90 percent line coverage (calculation engines are business-critical; errors cost millions in capital planning errors)
- **Infrastructure layer:** ≥ 70 percent line coverage
- **Integration tests:** All API endpoints covered by at least one integration test
- **End-to-end tests:** Critical user journeys covered (inspection recording, capital report generation, TAMP export)

### Technical Debt Ratio

Measured via static analysis (SonarQube or equivalent): the ratio of technical debt remediation time to the total development time invested in the codebase. A ratio below 5 percent is acceptable; below 3 percent is excellent.

This is tracked per module and reviewed quarterly. Modules with rising technical debt ratios are candidates for refactoring investment before the debt becomes a development velocity tax.

### AI Agent Productivity Multiplier

This metric is specific to Aurigo's AI-native engineering model. It measures the story points delivered per engineer per sprint, normalized by pre-AI baseline (established before Claude Code adoption).

The multiplier is not about replacing engineers — it is about understanding where AI assistance is delivering the highest productivity benefit and where it is not being used effectively. Engineers who learn to work with AI pair programming effectively consistently deliver 1.5x to 3x the output of engineers who do not.

**Target:** 2x average multiplier across the engineering team by the end of the first year of AI-native development. Tracking by individual (anonymized), by module, and by task type (feature development, test writing, refactoring, documentation).

---

## Customer Success Metrics

### Time to First Value

The number of days from contract execution to the first measurable outcome delivered to the customer. For Maintain customers, "first value" is defined as: the first completed capital needs report, the first TAMP module output, or the first AI condition alert that the customer acknowledges.

**Target:** Under 30 days for Integrated mode customers (data integration is the long pole). Under 60 days for Native mode customers (data migration adds complexity).

### TAMP Completion Rate

For public agency customers, the percentage who have completed at least one full TAMP cycle using Masterworks Maintain data and reporting. This is the ultimate product-market-fit metric for the public sector — if customers are using Maintain to produce their TAMP, they are deeply embedded.

**Target:** 80 percent of public agency Maintain customers complete a TAMP cycle within 18 months of deployment.

### Capital Plan Accuracy

The difference between the capital needs projected by Maintain's deterioration models (at the time of plan development) and the actual capital spend in subsequent years. This metric improves as the models are calibrated with customer-specific deterioration data.

**Target:** Within 15 percent of actual spend for year 1 of the plan, within 25 percent for years 3-5. The model improves with each inspection cycle.

### Asset Condition Improvement

The average condition score change (across all customers, per asset class) after 24 months of Maintain deployment. If Maintain is working — that is, if customers are using it to make better capital investment decisions — then condition scores should improve over time as the worst-condition assets are addressed.

This is the ultimate outcome metric. Not "did the software work" but "did the assets get better."

**Target:** 5 to 10 percent improvement in average network condition score across public agency customers over 24 months. (Context: a 5 percent improvement in pavement condition represents hundreds of millions of dollars in avoided deterioration and failure cost for a large state DOT.)

---

## Leading vs. Lagging Indicators

Metrics without a leading/lagging classification are decoration. Classification determines when a metric can influence a decision.

| Metric | Type | Predicts | Time-to-signal |
|--------|------|----------|----------------|
| AUCLM (North Star) | **Lagging** (composite) | Revenue, retention | 3–6 months |
| ARR | Lagging | Company health | 12 months |
| NRR | Lagging | Platform-strategy validity | 12–18 months |
| Data Quality Score | **Leading** for NRR + retention | Whether AI outputs will be trusted | 2–4 months |
| Time to First Value | Leading for churn | 90-day trigger for CS intervention | 30 days |
| Feature adoption at 30/60/90 | Leading for renewal | Feature ROI | 30–90 days |
| AI recommendation acceptance rate | Leading for expansion | Whether customers trust our intelligence | 4–8 weeks |
| Integration sync success rate | Leading for CS escalations | Support ticket volume, churn | 2 weeks |
| DORA metrics | Leading for defect rate | Customer-perceived quality | 30–60 days |
| Change failure rate | Leading for MTTR | Incident volume | 30 days |
| Test coverage (Calculations) | Leading for capital plan accuracy | Trust in models | 90 days |
| Deployment frequency | Leading for velocity | Roadmap delivery | 30 days |
| Customer churn rate | Lagging | Compounding revenue effect | 12 months |
| TAMP completion rate | Lagging | Public-sector product-market fit | 12–18 months |
| Asset Condition Improvement | Lagging | Ultimate customer outcome | 24 months |

**Operating rule:** Any decision to change a lagging metric must reference the specific leading metric expected to move first. Otherwise the decision is a guess.

---

## Metrics Dashboard Cadence

Metrics that are not viewed on a schedule by an accountable person do not exist.

### Daily (viewed by named role, 5-min stand-up review)

| Metric | Owner | Threshold triggering escalation |
|--------|-------|----------------------------------|
| Prod uptime, error rate | On-call SRE | > 0.1% error rate for 15+ min |
| P1 incident count | Head of Engineering | Any P1 |
| AI cost run rate (last 24h) | Head of AI Eng | > 20% above 7-day trailing avg |
| Integration sync failures | Integration Eng Lead | > 5 sync failures across any single tenant |
| Deployment frequency | Head of Engineering | Zero deployments in 24h during work hours |

### Weekly (30-min business review, Monday 09:00)

| Metric | Owner |
|--------|-------|
| Pipeline coverage (Sales) | CRO |
| Win/loss deals this week | CRO + VP Marketing |
| New logo ARR + expansion ARR | CFO |
| Change failure rate (trailing 7-day) | Head of Engineering |
| Time to First Value cohort progress | Chief Customer Officer |
| Support ticket P1 + P2 counts | Head of Support |
| Feature adoption for last shipped feature | Head of Product |

### Monthly (60-min executive review, first Tuesday)

| Metric | Owner |
|--------|-------|
| ARR (new, expansion, churn) | CFO |
| CAC, LTV, payback | CFO + CRO |
| NRR by segment | CRO |
| AUCLM growth by tenant | Head of Product + CCO |
| Test coverage by module | CTO |
| DORA metrics summary | CTO |
| AI recommendation acceptance rate | Head of AI Eng |
| Data Quality Score trend | Head of Product |
| Roadmap status vs. commit | CTO + Head of Product |

### Quarterly (Half-day strategy review, first month of quarter)

| Metric | Owner |
|--------|-------|
| AUCLM North Star | CEO |
| Full DORA metrics | CTO |
| Win/loss narrative from prior quarter | CRO |
| Customer churn root-cause analysis | CCO |
| Technical debt ratio trend | CTO |
| Competitive positioning shift | VP Marketing |
| Financial model reforecast | CFO |
| ADR review — any strategy pivot needed | CEO + CTO |

### Annually

| Metric | Owner |
|--------|-------|
| Full business plan reforecast | CFO + CEO |
| Product roadmap for next 12 months | CTO + Head of Product |
| Compensation & equity refresh | CFO + CHRO |
| Long-range 3-year plan | CEO |

---

## Concrete Year-by-Year Targets

Metrics without numbers are aspirations. Aspirations without deadlines are decorations.

| Metric | End 2026 | End 2027 | End 2028 |
|--------|----------|----------|----------|
| AUCLM | 250K assets | 1.5M | 5M |
| ARR (total) | $95M | $155M | $240M |
| ARR — Maintain module share | 22% | 35% | 45% |
| NRR | 118% | 125% | 130% |
| Gross logo churn | ≤ 5% | ≤ 4% | ≤ 3% |
| CAC payback (new logos) | 22 mo | 20 mo | 18 mo |
| CAC payback (expansion) | 8 mo | 7 mo | 6 mo |
| Rule of 40 (growth% + FCF%) | 42 | 47 | 52 |
| NPS (average) | 42 | 50 | 55 |
| Data quality score (customer avg) | 75% | 82% | 88% |
| TAMP completion rate (public customers) | 60% | 75% | 85% |
| AI recommendation acceptance rate | 40% | 50% | 60% |
| Deployment frequency (Maintain) | 3× weekly | daily | multiple × daily |
| Change failure rate | 8% | 5% | 3% |
| MTTR P1 | 90 min | 45 min | 30 min |
| Test coverage — Calculations layer | 90% | 92% | 95% |
| Ratio of expansion ARR to new logo ARR | 0.7× | 1.0× | 1.3× |

Any target missed by more than 20% in two consecutive quarters triggers a CEO-level "unblock or re-plan" meeting with the accountable exec.

---

## Financial Model — Path to Cash-Flow Positive

The full financial model lives in Finance's data room; the summary that engineering needs to understand:

| Line ($M) | 2026 | 2027 | 2028 | 2029 | 2030 |
|-----------|------|------|------|------|------|
| ARR | 95 | 155 | 240 | 355 | 500 |
| Revenue (GAAP) | 82 | 132 | 205 | 305 | 435 |
| Gross margin % | 73% | 76% | 79% | 81% | 82% |
| S&M % of revenue | 45% | 40% | 35% | 32% | 30% |
| R&D % of revenue | 32% | 28% | 26% | 25% | 24% |
| G&A % of revenue | 12% | 10% | 9% | 8% | 8% |
| Operating margin % | -16% | -2% | 9% | 16% | 20% |
| Cash on hand (year-end) | $85M | $70M | $85M | $130M | $210M |
| Cash-flow positive quarter | — | Q3 | Q1 | achieved | achieved |
| Headcount (year-end) | 380 | 480 | 570 | 640 | 720 |
| ARR per employee | $250K | $323K | $421K | $555K | $694K |

Assumptions: no additional funding after 2026 A-round; ARR mix shifts to 45% Maintain by 2028; expansion revenue grows to 55% of new ARR by 2029.

**What breaks the model:**
- CAC payback > 30 months for new logos would delay cash-flow positive by 2 quarters
- NRR drop below 115% would require a $40M bridge round
- Gross margin below 70% (implying AI compute overage or heavy PS) would trigger a pricing model review

---

## Engineering-to-Metric Attribution

Every engineering effort should trace to at least one metric it moves. Examples:

| Engineering effort | Metric moved | Expected magnitude | Time-to-impact |
|--------------------|--------------|---------------------|----------------|
| Ship offline mobile inspection sync v2 | Data Quality Score, Field-inspector DAU/MAU | +5–8 pp DQS, +0.1 DAU/MAU | 60–90 days |
| RUL engine calibration with 5 more asset classes | Capital Plan Accuracy, AI Acceptance Rate | -3 pp variance, +8 pp acceptance | 120 days |
| TAMP narrative generation | TAMP Completion Rate | +10 pp | 6 months |
| Integration performance improvements (Cityworks) | Integration sync success rate, Time-to-First-Value | +0.3 pp, -5 days | 30 days |
| PostgreSQL partition strategy (Vol-3 §10) | MTTR P1, p99 latency | -20 min MTTR, -30% p99 | 90 days |
| Claude Code prompt evals (Vol-7) | AI cost, model quality | -10% cost/request | 30 days |

If a roadmap item cannot be attributed to a metric it moves, it is a candidate for prune.

---

*Next: [08 — Core Values](08-core-values.md)*
