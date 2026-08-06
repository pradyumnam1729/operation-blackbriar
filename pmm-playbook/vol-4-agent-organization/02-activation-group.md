# 02 — Group B: GTM Strategy & Activation

Five agents that turn foundation plus validated intelligence into buyer-facing output. Every B agent is behind the hard gate ([ch. 00](00-org-overview.md)): required intelligence inputs are named in each contract, and the orchestrator verifies them before dispatch. All buyer-facing drafts obey the chain ([Vol 2, ch. 02](../vol-2-domain-knowledge/02-positioning-messaging-copy-chain.md)), the narrative arc where narrative applies, and land as `stage: draft` for the approval queue — no B agent ships anything.

---

## B6 · Product-to-Market Translator (contract — file to be authored as `product-to-market.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Convert product updates into buyer problem, business value, differentiation, and messaging |
| **Required intelligence (gate)** | A1 (buyer language for the affected area), A2 (which personas care), A3 (competitive context of the change) — validated and current |
| **Other inputs** | `product-wiki.md`, release notes, approved positioning section |
| **Outputs** | Value propositions in the six-field schema ([Vol 2, ch. 04](../vol-2-domain-knowledge/04-value-prop-schema.md)); launch story on the 7-step arc; positioning implications if the update shifts category or differentiation claims |
| **Destinations** | Messaging library (`PLAYBOOKS-AND-ASSETS/messaging-library/`), launch brief inputs for B7 |
| **Cadence** | On-demand, triggered by product updates |
| **Consumers** | B7, B8, Marketing; the foundation's value-props section (as proposals) |

B6 owns the positioning → messaging transition. Its definition of done is schema entries, not prose: a product update that ends as a paragraph instead of tagged value props is unfinished.

## B7 · Launch Orchestration (contract — file to be authored as `launch-orchestration.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Recommend launch tier; develop audience, deliverables, owners, dependencies, and readiness plan |
| **Required intelligence (gate)** | B6's validated messaging for the launch subject; A2 personas for audience; A5 proof for claims |
| **Other inputs** | `about-me.md` (company stage — tier and channel mix are stage-aware per §10), `strategy.md` (OKR trace) |
| **Outputs** | The launch tree: `BRIEF.md`, `assets/messaging.md`, `assets/objections.md`, `enablement/battlecards/`, `enablement/one-pager.md`, `channels/email.md`, `channels/social.md`; channel mix and ABM plan for Tier-1; analyst-relations deliverables for Tier-1 (§14); AEO optimization plan alongside SEO (§8.3) |
| **Destinations** | `GTM-War-Room/ACTIVE-LAUNCHES/<launch-name>/` (the §4 tree); the `/launch-brief` skill scaffolds this |
| **Cadence** | On-demand per launch |
| **Consumers** | All other B agents (the launch tree is their workspace), Marketing, Sales |

## B8 · Sales & Deal Enablement (contract — file to be authored as `sales-enablement.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Opportunity-specific messaging, discovery questions, objection handling, proof points; battlecards; deal narratives; champion leave-behinds |
| **Required intelligence (gate)** | A3 dossier current within 30 days for any battlecard (the `/battlecard` skill enforces this by dispatching A3 first); A4 for objection reality; A5 for proof |
| **Other inputs** | Approved foundation sections; deal context from the requesting rep |
| **Outputs** | Two-page battlecards (strengths, weaknesses, talk track, landmines); deal narratives on the 7-step arc with champion leave-behind ([Vol 2, ch. 03](../vol-2-domain-knowledge/03-narrative-arc.md)); objection one-liners; interactive business-case calculator as artifact when warranted; SDR certification and training materials (§14) |
| **Destinations** | `PLAYBOOKS-AND-ASSETS/battlecards/`, `sales-playbooks/`; deal-specific outputs to the requesting context |
| **Cadence** | On-demand (deal-triggered) + always-on battlecard refresh: win/loss in → competitive shifts in → dead cards out → repeat |
| **Consumers** | Sales, SDR/BDR, Proposals |

B8 is the highest-volume agent and the face of Value Prop 1; it is also where a stale foundation does the most damage, which is why its freshness checks are the strictest.

## B9 · Adoption & Expansion (contract — file to be authored as `adoption-expansion.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Identify adoption barriers, expansion opportunities, and required customer-journey messaging; surface churn-risk signals and upsell triggers |
| **Required intelligence (gate)** | A1 (customer voice on adoption friction), A5 (expansion evidence), usage signals (Vol 6) |
| **Outputs** | Adoption messaging, expansion talk tracks, churn-risk signal summaries framed as actions (business-translated for CS) |
| **Destinations** | `PLAYBOOKS-AND-ASSETS/` (playbooks for CS); findings routed to Product via roadmap-implication sections |
| **Cadence** | On-demand + quarterly journey review |
| **Consumers** | Customer Success, Product, C13 |

## B10 · Pricing & Packaging Intelligence (contract — file to be authored as `pricing-packaging.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Identify packaging gaps, pricing friction, and monetization opportunities |
| **Required intelligence (gate)** | A3 (competitive pricing signals), A4 (price-related win/loss reasons), willingness-to-pay evidence |
| **Outputs** | Pricing/packaging analyses and recommendations — strictly internal, business-translated, with an influence-squad stakeholder map (§7.5) since pricing changes require cross-functional adoption |
| **Destinations** | Internal strategy docs; inputs to Leadership decisions — never buyer-facing pricing copy without explicit PMM direction |
| **Cadence** | On-demand, tied to strategy/roadmap cycles |
| **Consumers** | Leadership, Product, C14 |

---

## Group-Wide Notes

- **Content production is not a separate agent** (§14): B6/B7/B8 produce content as part of activation. A dedicated content-production agent is a V2 expansion, as is a dedicated campaign agent (currently scoped into B7).
- Every B output ends with proposed context-doc updates (§8.5) — activation work constantly discovers foundation gaps, and the proposal mechanism is how those flow back without corrupting canon.

---

*Next: [03 — Governance Group](03-governance-group.md)*

Last updated: 2026-08-06
