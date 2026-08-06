# 03 — Value Propositions

---

## Dogfooding the Framework

Master Instructions §7.4 defines the schema every value proposition in the messaging library must follow: use case + context, the problem to overcome, the feature/product that solves it, how it delivers value (capability), the benefit derived, and the cost of not solving it. If the schema is good enough for our customers' products, it is good enough for ours. The four value props of the PMM Agent, in the schema they will one day be generated from:

---

## Value Prop 1 — 90% Faster Sales Asset Creation

| Schema field | Content |
|--------------|---------|
| **Use case + context** | A sales rep has a competitive deal call tomorrow morning and needs a current battlecard and a one-pager tailored to the buyer's industry. It is 4 p.m. |
| **The problem** | Today this is a ticket to the PMM with a multi-day queue, or a DIY deck assembled from stale fragments found in shared folders. |
| **What solves it** | The PMM Agent asset generator: request an asset type, audience, and product; a draft is generated from the approved foundational doc through the asset templates, then passes the asset-qa gate. |
| **How it delivers value (capability)** | Generation draws only from foundation sections and validated intelligence, so a first draft that used to take days of gathering and writing is assembled in minutes and arrives pre-aligned to approved messaging. |
| **The benefit** | Customer-ready collateral in minutes instead of days — the rep walks into tomorrow's call armed, and the PMM never touched the request. |
| **Cost of not solving it** | Reps sell unarmed or improvise. Deals slow down waiting on collateral; PMM capacity drains into the ~10% ad hoc bucket until it becomes the whole jar (§3.5). |

---

## Value Prop 2 — 100% Messaging Consistency

| Schema field | Content |
|--------------|---------|
| **Use case + context** | A buyer meets two reps, reads the website, and receives an RFP response from the same vendor within one month of evaluating. |
| **The problem** | In a fragmented state, those four touchpoints carry four variants of the story. Inconsistency reads as incoherence, and buying committees price incoherence as risk. |
| **What solves it** | The consistency rule in the PMM Agent data model: every generated asset and answer traces to the foundational-doc sections it came from, and the deterministic guardrails (forbidden-words check, swap test prompts) run on every output. |
| **How it delivers value (capability)** | There is exactly one approved source per product. Assets cannot be generated from anything else; when a foundation section changes, dependent assets are flagged stale automatically. |
| **The benefit** | Every customer-facing touchpoint tells the same approved story, in the buyer's language, regardless of who generated it or when. |
| **Cost of not solving it** | Message drift compounds: every off-foundation asset trains the field further from the approved story, and the brand blurs one deck at a time. |

---

## Value Prop 3 — 3–5× More Products, Industries, and Personas per PMM

| Schema field | Content |
|--------------|---------|
| **Use case + context** | A PMM team of one or two supports a growing portfolio — at Aurigo: Masterworks, Essentials, Primus, and Lumina, across government agencies and facility owners, each with multiple buyer personas. |
| **The problem** | A human PMM saturates at one or two products. Every added product, industry, or persona multiplies the asset matrix; coverage thins and the weakest-covered product loses deals. |
| **What solves it** | The standardized foundational-doc framework plus the 14-agent organization ([Volume 4](../vol-4-agent-organization/README.md)): the PMM authors and approves; agents draft, refresh, and generate per segment. |
| **How it delivers value (capability)** | The marginal cost of a new segment drops from "a research and writing project" to "extend the foundation, approve, and the whole asset catalog lights up for that segment." |
| **The benefit** | One PMM credibly covers 3–5× the products, industries, and personas — with per-segment depth, not thinner butter over more bread. |
| **Cost of not solving it** | Portfolio growth outruns messaging coverage. Products launch without positioning; new verticals get hand-me-down messaging from the flagship; PMM hiring becomes the bottleneck on company strategy. |

---

## Value Prop 4 — Faster Response to New Market Opportunities

| Schema field | Content |
|--------------|---------|
| **Use case + context** | A competitor stumbles, a regulation creates a new buyer urgency, or leadership green-lights entry into a new vertical. The window is measured in weeks. |
| **The problem** | Responding needs positioning, messaging, and assets for the new context. Starting from fragments, that is a multi-week sprint — and the window narrows while it runs. |
| **What solves it** | A current foundation plus the always-on intelligence programs ([Vol 5, ch. 06](../vol-5-operating-model/06-always-on-programs.md)): weekly competitive and voice-of-market runs mean the raw intelligence is already in the war room when the opportunity opens. |
| **How it delivers value (capability)** | The distance from "opportunity spotted" to "field is armed" collapses to: extend foundation → approve → generate assets. Days, not quarters. |
| **The benefit** | The company moves at the speed of its judgment, not the speed of its document production. First credible responder wins the narrative. |
| **Cost of not solving it** | Opportunities are ceded to whoever tells a coherent story first. The strategic opportunity funnel (§3.4) stalls at "spot patterns" because framing and shaping have no fuel. |

---

## Using These Value Props

- These four are the demo bar. Every hackathon demo scene must land at least one of them concretely (see `../vol-8-roadmap/` when written).
- Each maps to measurable targets in [06 — Success Metrics](06-success-metrics.md): turnaround time (VP1), consistency score and trace coverage (VP2), segments per PMM (VP3), time-to-armed (VP4).
- Each is a claim to hold against the anti-generic mandate (§8.1). "90% faster" is only ours while it is measured and demonstrable; the schema's cost-of-inaction rows are what make these props specific rather than brochureware.

---

*Next: [04 — Users & Personas](04-users-personas.md)*

Last updated: 2026-08-06
