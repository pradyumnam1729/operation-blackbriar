# 03 — Group C: Governance & Optimization

Four agents that audit and steer the system itself. They consume everything, produce for the PMM and Leadership, and are the mechanism by which the system stays honest about its own performance. C-group outputs are internal by definition; their power is that A and B agents know the audit is coming.

---

## C11 · Messaging Effectiveness (contract — file to be authored as `messaging-effectiveness.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Measure whether approved messaging is actually used by sales and how buyers respond to it |
| **Inputs** | Asset usage signals (deal contexts, query/answer log, CRM signals per Vol 6), A1 call themes (is approved messaging appearing in calls?), A4 outcome correlations |
| **Outputs** | Monthly effectiveness report: **asset usage rate in deals** (% of deals where PMM collateral is utilized — the metric of [Vol 1, ch. 06](../vol-1-product/06-success-metrics.md) #2), messaging that lands vs. messaging that is ignored, field improvisation hotspots (reps saying things not in the library — either a gap to fill or drift to correct) |
| **Destinations** | `MARKET-INTELLIGENCE/` reporting; findings routed to B6/B8 as revision candidates and to C13 |
| **Cadence** | Monthly |
| **Consumers** | PMM, C13, B6, B8 |

C11 is the difference between "we shipped messaging" and "the messaging works." Low usage of an approved asset is treated as data about the asset, not as a field discipline problem, until proven otherwise.

## C12 · Content Governance (contract — file to be authored as `content-governance.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Flag outdated, inconsistent, unsupported, or incomplete messaging across all assets |
| **Inputs** | The full asset inventory with traces ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)), foundation section versions and freshness, `positioning-and-icp.md`, the guardrail config, key public pages (site-auditor pattern: scrape, check copy against positioning, flag discrepancies) |
| **Outputs** | Monthly audit: stale assets (tracing to superseded section versions), unsupported claims (no evidence-register entry), guardrail violations in circulating content, shadow inventory (circulating assets with no trace at all), consistency-score inputs |
| **Destinations** | Governance dashboard; regeneration/retirement proposals to the approval queue |
| **Cadence** | Monthly audit + **hook-triggered**: every messaging edit fires the consistency check (the PostToolUse hook `../../.claude/hooks/messaging-guard.ps1` is C12's always-on tripwire — §5.2) |
| **Consumers** | PMM (dashboard and queue), all A/B agents (findings against their outputs) |

C12 is deliberately part code: the deterministic checks ([Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)) are its hands; the monthly model-driven audit is its judgment. Dead cards out is as much its job as new cards in.

## C13 · GTM Performance (contract — file to be authored as `gtm-performance.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Measure the impact of launches, enablement, messaging, and other PMM initiatives |
| **Inputs** | C11 usage data, launch outcomes, A4 win/loss trends, the metric targets of [Vol 1, ch. 06](../vol-1-product/06-success-metrics.md), CRM/pipeline data (Vol 6) |
| **Outputs** | Monthly performance review using the full cross-functional metric taxonomy ([Vol 2, ch. 05](../vol-2-domain-knowledge/05-business-translation.md)), every metric tagged **leading or lagging**; the KPI map as a traceable tree: Company Goal → Key Metrics → KPIs |
| **Destinations** | Governance dashboard; Leadership brief (Executive dialect); inputs to C14 and quarterly strategy |
| **Cadence** | Monthly |
| **Consumers** | Leadership, PMM, C14 |

C13 is the agent that makes the four value props falsifiable: it owns the measurement of the 90%/100%/3–5× claims and reports them without garnish, including when they are not yet true.

## C14 · PMM Prioritization (contract — file to be authored as `pmm-prioritization.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Rank recommended PMM actions by revenue impact, strategic importance, urgency, and effort |
| **Inputs** | The recommendation backlog from all agents, `strategy.md` (company OKRs, quarterly rocks), C13 performance data, the orchestrator's triage log (bucket allocations, recurring ad hoc requests) |
| **Outputs** | A **traceable priority tree, not a flat ranked list** — every action links up through monthly priority and quarterly rock to a company OKR (§3.6); rock/pebble/sand sizing; the ~50/25/15/10 budget check with variance flagged; untraceable items flagged as sand; recurring ad hoc requests flagged for promotion to always-on |
| **Destinations** | PMM planning docs; `strategy.md` update proposals |
| **Cadence** | On-demand + quarterly planning cycle |
| **Consumers** | PMM, Leadership |

C14 is the defense of focus made explicit ([Vol 2, ch. 08](../vol-2-domain-knowledge/08-operating-cadence.md)). Its hardest and most valuable output is the flag column: what we are *not* doing, and why that is correct.

---

## How Group C Closes the Loop

The system's feedback cycle runs through C: B ships (gated by A) → C11 measures use → C13 measures impact → C12 audits integrity → C14 re-aims the effort → the PMM decides → A and B execute the new aim. Remove Group C and the system still produces — it just never learns whether production mattered. That distinction is most of the difference between this architecture and a content generator.

---

*Next: [04 — Build Agents](04-build-agents.md)*

Last updated: 2026-08-06
