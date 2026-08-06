# 06 — Success Metrics

---

## Principles

Three rules govern this chapter, inherited from the constitution:

1. **Every metric has an owner and a direction.** A number nobody owns is a dashboard decoration (§3.3).
2. **Leading and lagging are tagged, never mixed.** Leading metrics tell us the system is being used correctly this week; lagging metrics tell us the value props came true this quarter (§7.3, C13's taxonomy).
3. **Each value prop from [chapter 03](03-value-props.md) gets at least one measurable target.** A value prop without a number is a slogan.

Baselines below reflect the pre-system state described in [chapter 02](02-problem-statement.md); where no measured baseline exists at Aurigo yet, the stated baseline is the industry-typical figure we will validate in the first month of operation.

---

## The Core Five

### 1. Asset turnaround time (Value Prop 1) — lagging

Time from asset request to approved final, measured per asset type.

| Asset type | Baseline (pre-system) | Target (MVP demo) | Target (steady state) |
|------------|----------------------|-------------------|----------------------|
| Battlecard refresh | 2–5 days | < 30 minutes | < 15 minutes |
| One-pager | 2–4 days | < 30 minutes | < 15 minutes |
| RFP response section | 1–3 days | < 20 minutes | < 10 minutes |
| Exec brief | 1–2 days | < 30 minutes | < 20 minutes |

The 90% claim is honest when the median across types drops from days to minutes. Measured automatically from the Query/Answer and Asset logs ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)). Note the clock includes the PMM approval step — a fast draft stuck in an approval queue for three days is a failed turnaround, which is why the approval queue is a first-class app surface.

### 2. Asset usage rate in deals (Value Props 1, 2) — lagging

Percentage of active deals in which system-generated collateral is used, tracked by C11 (messaging-effectiveness agent). Baseline: unknown but low — the field uses whatever is on its laptops. Target: 60% of competitive deals within one quarter of GA, 80% at steady state. This is the metric that distinguishes "we generate assets" from "the field trusts the assets." If turnaround hits target and usage does not, the problem is trust or fit, not speed — investigate before generating more.

### 3. Messaging consistency score (Value Prop 2) — leading

Percentage of in-circulation final assets that (a) trace to current foundation sections and (b) pass the deterministic guardrail checks. Computed by the governance dashboard from asset trace records; audited monthly by C12 (content-governance agent).

- Target: 100% for system-generated assets, by construction — an asset that fails cannot reach final.
- The honest number to watch: percentage of *all* customer-facing assets in circulation that are system-generated or system-verified. Baseline 0%; target 90% by GA. The gap is the shadow inventory of legacy decks, and closing it is a C12 program, not a feature.

### 4. Products, industries, and personas supported per PMM (Value Prop 3) — lagging

Count of segments with a current (not stale) foundational doc and a full asset catalog available, divided by PMM headcount. Aurigo baseline: one PMM effectively covering 1–2 products. Target: 4 products (Masterworks, Essentials, Primus, Lumina) × primary verticals and personas by GA — landing in the claimed 3–5× range. "Current" is doing the work in this metric: a stale foundation does not count, which keeps the metric honest against coverage theater.

### 5. Time-to-first-answer (Value Prop 4, and daily utility) — leading

Median time from a consumer submitting a plain-language question to receiving a cited, role-framed answer. Target: < 60 seconds when the war room can answer; < 5 minutes including honest escalation ("the war room cannot answer this; an intelligence task has been routed") when it cannot. The companion rate — **answer coverage**, percentage of queries answerable from the war room without escalation — is the truest measure of foundation completeness. Target: 70% at MVP seed, 90% at steady state.

---

## Supporting Metrics

| Metric | Type | Owner | What it protects |
|--------|------|-------|------------------|
| Foundation freshness (days since each section's last validation) | Leading | PMM admin | Everything — stale foundation poisons all four value props |
| Approval queue latency (draft submitted → PMM decision) | Leading | PMM admin | Turnaround honesty; the human gate must not become the new queue |
| Guardrail rejection rate (drafts failing voice/anti-generic checks) | Leading | C12 | Quality bar; a falling rate means agents are learning the standard |
| Escalation resolution time (unanswerable query → intelligence delivered) | Leading | Group A agents | The "never guess" promise (§2.1) |
| Time-to-armed for a new segment (decision → assets available) | Lagging | PMM admin | Value Prop 4, measured end to end |
| Query volume by persona | Leading | PMM admin | Adoption; a persona that never asks is a persona still living in failure modes 1–3 |

---

## Anti-Metrics

Numbers we deliberately do not optimize:

- **Total assets generated.** Volume is the failure mode of §8.2, not a success measure. Ten used assets beat a hundred generated ones.
- **Words produced per session.** Same reason.
- **Approval pass rate at 100%.** If the PMM never rejects a draft, the gate is rubber-stamping. A healthy rejection rate (5–15%) is evidence the gate is real.

---

## Review Cadence

- **Weekly (PMM):** freshness, approval latency, escalations outstanding — the operational three.
- **Monthly (C13 GTM-performance run):** full core-five review, tagged leading/lagging, translated per §7.3 into stakeholder language and routed to Leadership.
- **Quarterly:** targets themselves re-examined against stage (Master Instructions §10) — MVP targets are not GA targets, and pretending otherwise corrupts the numbers.

---

*Back to [Volume 1 index](README.md). Next volume: [Volume 2 — Domain Knowledge](../vol-2-domain-knowledge/README.md)*

Last updated: 2026-08-06
