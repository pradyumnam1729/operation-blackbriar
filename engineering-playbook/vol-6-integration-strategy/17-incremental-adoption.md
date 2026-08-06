# 17 — Incremental Adoption Playbook

## Why Incremental Matters

The highest-risk path to adopting any enterprise software is the big bang: go live with all features on a single date, train all users at once, and hope nothing goes wrong. It almost always goes wrong. The safer path is incremental adoption — deliver value in small slices, prove each slice works before adding the next, and let success build confidence.

For Maintain, the incremental adoption philosophy is baked into the deployment model. Integrated Mode delivers value in week 2 (the capital plan exists as soon as assets sync). Inspection workflows add value in month 2. Native Mode, if the customer gets there, is month 12+. Each step is independently valuable and each step makes the next step easier.

## Five Success Factors

### 1. Executive Sponsorship

Every successful Maintain deployment has a named executive sponsor — a director of public works, a chief infrastructure officer, or a deputy commissioner — who has publicly committed to using Maintain for the capital improvement program. Without executive sponsorship, the maintenance department has no reason to change their behavior. The data stays in the EAM and Maintain becomes shelfware.

What executive sponsorship looks like in practice:
- The executive reviews the Maintain capital plan in every CIP planning meeting
- The executive directs the maintenance manager to complete inspections in Maintain
- The executive communicates to the team that Maintain is the system of record for capital planning

What the Aurigo team can do to support it:
- Provide the executive with a one-page summary of the capital plan findings every month
- Send a weekly email with the three highest-risk assets in the portfolio
- Alert the executive when a critical defect is logged in an inspection

### 2. Clear Per-Phase Scope

Before each phase begins, write down exactly what is in scope and what is out of scope. Distribute it to all stakeholders. This prevents scope creep during implementation and manages expectations for what users will see at go-live.

The scope document for Phase 1 should be one page. If it takes more than one page to describe Phase 1 scope, the scope is too large.

### 3. Data Quality First

The single most common reason a Maintain deployment underperforms is data quality in the EAM. If the EAM has wrong install dates, missing asset types, incomplete work order history, or duplicate assets, the capital plan produced by Maintain will be inaccurate. Customers will see the inaccurate numbers and lose confidence in the system.

Before the initial sync, run the data quality report (see `16-migration-strategy.md`) and fix critical issues in the EAM. Focus on:
- Install dates: missing install dates prevent RUL calculation. At minimum, fill in installation decade (year 2000–2009 → use 2005 as estimated install date).
- Asset classification: every asset must have an asset type that maps to an Aurigo asset class. Unclassified assets do not get RUL or ARV calculations.
- Work order completions: work orders that are open indefinitely (opened 5 years ago, never closed) skew maintenance history. Close or cancel stale work orders before sync.

### 4. Training Investment

Maintain is only as good as the quality of inspections entered into it. If field inspectors do not understand the condition scoring methodology, the condition scores will be inconsistent and the capital plan will be unreliable.

Training investment means:
- At least one 4-hour in-person training session for inspection supervisors
- Written field guides for inspectors (one page per asset class with photo examples)
- A brief monthly calibration meeting where inspectors review borderline condition ratings together
- Access to the Maintain help center and video tutorials

Skimping on training is the second most common reason deployments underperform.

### 5. Integration Reliability Monitoring

The integration sync must be monitored continuously. A silent sync failure means Maintain's data goes stale without anyone noticing. The capital plan becomes outdated. Users check asset data in Maintain and find it does not match the EAM. They stop trusting Maintain.

Every tenant's integration dashboard must show sync health prominently. The implementation team must configure CloudWatch alarms that fire to the customer's designated integration owner when:
- Sync lag exceeds 30 minutes
- Sync success rate drops below 95%
- More than 100 parse errors in a single sync run
- EAM health check fails (credentials expired, server unreachable)

## Five Common Failure Modes

### Failure Mode 1: Integration Installed But Forgotten

**Symptom:** Maintain is deployed, sync runs, but no one logs into Maintain after week 2. The implementation team leaves. The system drifts.

**Root cause:** No executive sponsorship. No one is accountable for using the capital plan.

**Fix:** Before contract signature, identify the executive sponsor by name. Include a 90-day adoption KPI in the contract (see KPIs section below). Schedule a 30-day and 60-day review call with the executive sponsor.

### Failure Mode 2: Bad Data, Bad Plan

**Symptom:** The capital plan is generated but the numbers look wrong. The CFO rejects it. The project loses credibility.

**Root cause:** Data quality issues in the EAM (wrong install dates, missing asset types) produced inaccurate RUL and ARV calculations.

**Fix:** Run the data quality report before go-live. Do not publish the capital plan until at least 80% of assets have valid install dates and asset classifications. Include a data confidence score on the capital plan cover page.

### Failure Mode 3: Integration Breaks Silently

**Symptom:** Users notice that assets added to the EAM three weeks ago do not appear in Maintain.

**Root cause:** Sync was failing silently. No monitoring alarms were configured. No one noticed for three weeks.

**Fix:** Configure CloudWatch alarms during onboarding. Require the customer to confirm alarm routing before the implementation is marked complete.

### Failure Mode 4: Inspection Quality Collapse

**Symptom:** Condition scores are suspiciously high across the board. The capital plan shows no capital needs. The maintenance manager knows the infrastructure is aging but the system disagrees.

**Root cause:** Inspectors are marking everything as good condition to avoid follow-up work. Calibration was not enforced.

**Fix:** Implement the inspector calibration process. Review condition score distributions by inspector each month. Any inspector with a distribution that is > 20 points above the team average should be flagged for calibration review.

### Failure Mode 5: Hybrid Mode Write-Back Causes EAM Conflicts

**Symptom:** Work orders appear in the EAM that the maintenance team did not create. The EAM administrator is confused. Trust in the integration breaks.

**Root cause:** Hybrid Mode write-back was enabled without adequate explanation to the EAM team.

**Fix:** Do not enable Hybrid Mode write-back without explicit written approval from the EAM system owner. Include a prefix in the EAM work order description (`[Aurigo Maintain]`) so Maintain-generated WOs are visually distinguishable.

## The 90-Day Fast Track Plan

This week-by-week plan assumes Integrated Mode deployment with the goal of delivering the first capital plan by day 60 and the first approved inspection by day 90.

| Week | Activities | Milestone |
|---|---|---|
| 1 | EAM credentials configured, adapter deployed, connectivity test passed | Sync green |
| 2 | Initial load complete, asset sync running, first assets visible in Maintain | Assets in system |
| 3 | Data quality report reviewed, critical issues fixed in EAM | Data quality baseline |
| 4 | Asset classes configured, condition model reviewed with asset manager | Model calibrated |
| 5 | First capital plan generated (draft), executive sponsor briefed | Draft capital plan |
| 6 | Capital plan reviewed with finance team, RUL assumptions validated | Plan validated |
| 7 | Capital plan revisions based on review, inspection checklist templates built | Templates ready |
| 8 | Inspector training session 1 (supervisors), mobile app tested in field | Inspectors trained |
| 9 | Inspector training session 2 (field crew), calibration exercise | Field crew ready |
| 10 | First inspections completed in Maintain (pilot: 20 assets) | First inspections |
| 11 | Inspection results reviewed with asset manager, scoring calibration | Calibration done |
| 12 | Full inspection program started, capital plan updated with real condition data | Adopted |

## KPIs for Adoption Success

Track these metrics in the Maintain admin dashboard and review them with the customer monthly:

| KPI | Description | Green | Yellow | Red |
|---|---|---|---|---|
| Asset coverage | % of EAM assets synced to Maintain | > 95% | 80–95% | < 80% |
| Condition data coverage | % of assets with a condition score | > 75% | 50–75% | < 50% |
| Inspection completion rate | % of scheduled inspections completed on time | > 90% | 70–90% | < 70% |
| Capital plan accuracy | Variance of actual bids vs. Maintain ARV estimates | < 15% | 15–30% | > 30% |
| User login rate | % of licensed users who logged in this month | > 80% | 50–80% | < 50% |
| Sync health | Sync success rate over the last 7 days | > 99% | 95–99% | < 95% |
| Capital plan adoption | % of CIP projects initiated from a Maintain capital need | > 70% | 40–70% | < 40% |

Review the KPI dashboard with the executive sponsor at month 1, month 3, and month 6. Any KPI in red triggers a recovery plan.

## Onboarding Checklist for Implementation Teams

### Pre-Deployment
- [ ] EAM credentials created and stored in AWS Secrets Manager
- [ ] Asset class mapping table built and loaded into Maintain
- [ ] Field mapping overrides configured for customer's EAM customizations
- [ ] Connectivity test passed and documented
- [ ] CloudWatch alarms configured (sync lag, error rate, health check)
- [ ] Alarm routing confirmed with customer IT team
- [ ] Executive sponsor identified and briefed on adoption KPIs

### Week 1–2
- [ ] Initial load complete (all assets in Maintain)
- [ ] Data quality report reviewed with customer
- [ ] Asset type mapping verified (no significant UNKNOWN asset class usage)
- [ ] Delta sync running and confirmed with a test change in EAM

### Month 1
- [ ] First capital plan reviewed with customer
- [ ] Inspection templates built for the top 3 asset classes by count
- [ ] Inspector training scheduled

### Month 2–3
- [ ] First 50 inspections completed
- [ ] Scoring calibration session held
- [ ] Capital plan updated with inspection data

## Change Management for Maintenance Teams

The hardest part of Maintain adoption is not the technology — it is getting maintenance technicians and supervisors to conduct inspections in a new system when they have been doing it on paper or in a different app for years.

Tips that work:
- **Show them the output, not the input.** Show the maintenance supervisor a risk map of their district. Point out that Bridge X is in the top 5% of risk. Ask: "Would you want to know which bridges to prioritize before the next storm?" The output motivates the input.
- **Make mobile first.** Ensure the Maintain mobile app is installed on the inspection tablets before training. Field crews will not adopt a system they have not touched.
- **Small wins first.** Pick one asset class with a champion inspector and do the first 20 inspections together. That inspector becomes the internal advocate.
- **Avoid big bang training.** Do not train 40 inspectors in one day. Train 5, let them do real inspections, then train the next 5 with the first 5 as coaches.
- **Acknowledge the disruption.** Admit that it is extra work in the short term. Explain that the capital plan means their work orders will be funded faster because the CIP is now tied to real asset condition data — not a manager's guess.

## The Anti-Pattern: Native in 30 Days

The most destructive pattern in Maintain deployments is a customer (or an Aurigo salesperson) who insists on going to Native Mode in 30 days. This means: turn off the EAM, migrate all data, train all users, go live with full work order management in Maintain — in one month.

It always fails. The data migration is incomplete. Users are not trained. The integration breaks and there is no EAM fallback. The maintenance department panics. The CIO gets calls.

When a customer requests Native in 30 days, the Aurigo implementation lead must escalate to the account executive and insist on a phased approach. The minimum credible timeline for Native Mode is 12 months from contract signature. A customer who will not accept this timeline is not a candidate for Native Mode — they should stay on Integrated Mode indefinitely.
