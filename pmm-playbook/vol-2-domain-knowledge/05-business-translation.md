# 05 — Business Translation

*Source: Aatir Abdul Rauf. Encoded from Master Instructions §3.3 and §7.3.*

---

## The Principle

PMM is the cross-functional hub — a connector, not just a producer. Insights are the raw material, but an insight delivered in PMM language to a stakeholder who thinks in different units is an insight wasted. Every output must be framed in the metric language of the stakeholder it is intended for. This is what makes the PMM (and the PMM Agent) legible to the rest of the company: Sales hears win rates, Product hears activation, Leadership hears NRR.

The hard rule:

> **No finding ships as a raw observation.** Every insight must terminate in:
> **[customer insight] → [specific action] → [named metric it moves] → [stakeholder who owns it]**

An observation without an action is trivia. An action without a metric is a hunch. A metric without an owner is a dashboard decoration. Only the complete chain is a deliverable.

---

## The Cross-Functional Metrics Map

The stakeholder language table every agent applies at output time:

| Stakeholder | Their language |
|-------------|----------------|
| **Sales** | SQLs, win rates, deal velocity, pipeline value, average deal size |
| **Product** | Activation rate, MAU, feature adoption, time-to-value, trial-to-paid |
| **Marketing** | MQLs, CPL, CPA, website traffic, conversion rate, ROAS |
| **Executive** | MRR, LTV, CAC, NRR, net profit margin, ARPU |

Extensions for the full persona set ([Vol 1, ch. 04](../vol-1-product/04-users-personas.md)): Customer Success thinks in retention, expansion, and churn risk; SDR/BDR in reply and meeting rates; Proposals in submission win rate and turnaround.

Two Aurigo-specific overlays, because the metrics map must respect voice rules:

- Public-sector framing never uses ROI — translate to "program outcomes" or "capital program performance."
- Public-sector AI framing is "do more with the same people," never headcount reduction.

---

## The Pattern, Worked

Canonical example (from §7.3):

> "Our win/loss analysis shows customers leave due to integration gaps. Implementing Workday + Deel integrations this quarter could improve revenue retention (Exec/Finance metric)."

Broken into the four slots:

| Slot | Content |
|------|---------|
| Customer insight | Win/loss interviews attribute churn to integration gaps |
| Specific action | Ship Workday + Deel integrations this quarter |
| Named metric (tagged) | Revenue retention / NRR — **lagging** |
| Stakeholder owner | Executive / Finance |

A PMM Agent example:

| Slot | Content |
|------|---------|
| Customer insight | Voice-of-market run finds reps improvising competitive claims about Kahua in 4 of 10 analyzed calls |
| Specific action | Refresh the Kahua battlecard from current A3 intelligence and push to the field with a 15-minute enablement note |
| Named metric (tagged) | Competitive win rate vs. Kahua — **lagging**; battlecard usage rate in Kahua deals — **leading** |
| Stakeholder owner | Sales (RVP), with PMM accountable for the asset |

---

## Leading vs. Lagging — Always Tagged

C13 (gtm-performance) enforces the tag on every metric mention. Leading metrics (usage, freshness, coverage, engagement) move within weeks and tell you whether behavior changed. Lagging metrics (win rate, NRR, MRR) move within quarters and tell you whether the behavior mattered. A recommendation that promises only lagging movement with no leading indicator has no steering signal and gets sent back; a report that celebrates only leading movement has not yet earned a conclusion.

---

## Where the Pattern Is Enforced

1. **Intelligence agent outputs (A1–A5):** every finding section ends in the four-slot pattern before it is routed to an activation agent. A3's method step 3 ("Translate") is exactly this — a raw observation is an unfinished job (`../../.claude/agents/competitive-intel.md`).
2. **The knowledge engine's answer framing:** when Leadership asks a question, the answer renders in Executive metrics; when Sales asks the same question, it renders in Sales metrics. Same fact, different last mile ([Vol 3, ch. 01](../vol-3-architecture/01-system-overview.md)).
3. **C13's KPI map:** Company Goal → Key Metrics → KPIs, a traceable tree connecting every PMM initiative to a named company outcome.
4. **The strategic opportunity funnel (§3.4):** Spot Patterns → Frame the Problem → Shape Opportunity → Validate & Pitch. Business translation is the "frame" step — recurring translated insights, not raw signals, are what get elevated into initiatives. This is the mechanism that turns the system proactive.

---

## Failure Smells

| Smell | Fix |
|-------|-----|
| "Customers are frustrated with onboarding" (full stop) | Raw observation. Complete the chain: what action, what metric, whose metric? |
| "This will improve our GTM motion" | No named metric. Name it and tag it leading/lagging. |
| A Leadership brief full of MQLs | Wrong dialect. Re-render in Executive language. |
| The same insight reported three weeks running | Funnel stall. Escalate per §3.4 or drop it. |

---

*Next: [06 — JTBD & ICP](06-jtbd-and-icp.md)*

Last updated: 2026-08-06
