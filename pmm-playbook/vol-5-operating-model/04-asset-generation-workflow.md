# 04 — Asset Generation Workflow

---

## The Value Prop 1 Pipeline

This is the workflow behind "90% faster sales asset creation" — and the chapter where that promise meets its dependency: **the speed is real only while the foundation is current.** A generator over a stale foundation is fast at producing liabilities.

```
1. Request → 2. Freshness check → 3. Generate draft → 4. asset-qa gate
     → 5. PMM approval → 6. Final (delivered, traced, logged)
```

Supported asset types at MVP: battlecards, one-pagers, RFP response sections, exec briefs — plus talk tracks and channel copy as templates land (Vol 9).

---

## Step by Step

**1. Request.** Structured intake per [chapter 01](01-intake-protocol.md): asset type, product, audience/persona, and context (deal, launch, channel). Requests come from consumers or the PMM; either way they are logged, traced to the requester, and triaged (a live-deal battlecard is legitimate ad hoc; the third one this month is a promotion signal).

**2. Freshness check — before any generation.** Deterministic ([Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)):

- Are the required foundation sections `approved` and within freshness windows?
- Are the required intelligence inputs current? (Battlecards: competitive dossier ≤ 30 days — the `/battlecard` skill dispatches A3 first if not.)
- Outcomes: **pass** → generate; **warn** (marginal staleness) → generate with the staleness surfaced to the PMM at approval; **block** (missing/expired essentials) → the refresh task is dispatched first and the requester told the honest sequence. Blocked-with-a-plan beats fast-and-wrong.

**3. Generate draft.** The owning activation agent ([Vol 4, ch. 02](../vol-4-agent-organization/02-activation-group.md)) composes from **template (Vol 9) + war-room truth** — approved sections, schema value props, evidence-register proof, verbatim customer language. The draft records its `source_sections` with versions (the trace) and lands as `stage: draft`. No model-general-knowledge facts; the same grounding rule as [chapter 03](03-query-answer-workflow.md).

**4. The asset-qa gate.** The `/asset-qa` skill runs before any human sees the draft — machine review in two layers:

| Layer | Checks |
|-------|--------|
| Deterministic (code) | Forbidden words; terminology rules (program/portfolio, life cycle, AI-native-only); em-dash and binary-contrast limits; trace completeness; frontmatter present |
| Model judgment (reviewer pass) | Swap test (§8.1); narrative-arc integrity for narrative assets; raw customer language present; claim-evidence proximity; role/channel fit |

Output is pass/fail per check with offending lines and proposed rewrites. Failures loop back to step 3 with the findings as context; a draft that cannot pass after two loops escalates to the PMM as a foundation problem, not a generation problem — persistent QA failure usually means the foundation lacks what the asset needs.

**5. PMM approval.** The queue shows the draft, its trace, QA results, and any freshness warnings. Approve → final; reject → notes → regeneration. Full rules in [chapter 05](05-approval-gates.md). The clock in the turnaround metric includes this step — approval latency is a PMM SLA, not dead time.

**6. Final.** The asset is delivered to the requester, visible to its audience role, written to its war-room destination with frontmatter, and live in the trace graph — meaning future foundation changes will flag it stale automatically ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)).

---

## The Speed Math, Honestly

Minutes-not-days holds because steps 2–4 are seconds-to-minutes of machine time and step 5 is minutes of human attention **when the foundation is ready**. Every case where the old way was genuinely days — gathering scattered inputs, chasing the current positioning, rewriting off-brand drafts — was foundation debt being paid at request time, under deal pressure, by the least appropriate person. This workflow moves that cost to where it belongs: paid once, upstream, at the foundation ([chapter 02](02-foundation-doc-workflow.md)), amortized over every asset.

Corollary: when freshness checks block generation, the system is not being slow — it is refusing to hide foundation debt inside a confident-looking asset. The dashboard's freshness panel exists so this moment is rare.

---

## Regeneration

Stale-flagged assets (foundation moved beneath them) queue as regeneration proposals: same request parameters, new foundation versions, diff shown against the old final. The PMM approves the replacement; the old version is retired, not deleted — the audit trail keeps history ([Vol 3, ch. 05](../vol-3-architecture/05-security-and-governance.md)). Dead cards out is part of the loop, not an afterthought.

---

*Next: [05 — Approval Gates](05-approval-gates.md)*

Last updated: 2026-08-06
