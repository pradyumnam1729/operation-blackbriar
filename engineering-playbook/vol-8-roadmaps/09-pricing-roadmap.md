# Pricing Roadmap — Aurigo Maintain

## Why Pricing Is a Roadmap

Pricing is a product decision, not a sales decision. It shapes the customer relationship, the product roadmap (what features are premium vs. standard), the competitive positioning, and the unit economics that determine whether the business is sustainable. As Maintain matures from MVP through GA to enterprise scale, pricing must evolve in step with the product and the market.

This roadmap describes how Maintain's pricing evolves from Beta pilot pricing through GA to Enterprise expansion. It is a directional document; specific price points are set with the CFO and Sales leadership and updated in `docs/pricing/pricing-current.md`.

---

## Pricing Principles

The following are Aurigo's durable pricing principles for Maintain, applied at every stage:

**1. Value-based, not cost-based.** Pricing reflects the customer's economic value from using Maintain — deferred capital costs, avoided emergency repairs, staff time saved on TAMP preparation — not Aurigo's cost of delivering the service.

**2. Aligned with customer scale, not customer size.** A large county with 50,000 assets pays more than a small county with 5,000 assets. But a large corporate parent using Maintain in one small facility does not pay based on their corporate revenue — they pay based on the assets under management.

**3. Predictable, not per-transaction.** Enterprise buyers reject pricing models that create unpredictable bills. Per-asset annual subscription is predictable. Per-inspection or per-report is not.

**4. Transparent tier boundaries.** A customer must be able to tell which tier they need without a sales conversation. Ambiguous tier boundaries create friction and delay procurement.

**5. Expansion revenue baked in.** As customers grow (more assets, more users, more modules), Aurigo grows with them. Pricing structure reflects this — it is a subscription, not a lump-sum sale.

---

## Pricing Dimensions

Maintain's price is a function of several dimensions. Each dimension is present in every tier, but the tier structure determines which dimensions matter most.

**Asset count.** The primary meter. Number of assets under management in the tenant.

**User count.** Total named users. Read-only users cost less than write users; agencies with many field inspectors get sublinear pricing.

**Modules enabled.** Some capabilities (advanced TAMP for all asset classes, risk scoring, capital optimization) are premium. Basic asset registry, condition recording, and simple capital needs are standard.

**Deployment mode.** Pool-model shared infrastructure is standard. Silo-model dedicated infrastructure is a premium up-charge that reflects the additional AWS cost plus operational overhead.

**Integration count.** The first EAM connector is included. Additional connectors are priced separately at moderate cost — this reflects both configuration effort and ongoing maintenance burden.

**AI features enabled.** Basic analytics are included. ML condition prediction, NLQ, drone inspection integration, and Phase 3+ AI capabilities are premium add-ons.

**Support tier.** Standard, Professional, Enterprise, and Tier 1 support tiers with corresponding SLA (see `06-enterprise-roadmap.md`).

---

## Beta Pilot Pricing (Current)

**Duration:** Through Beta phase, until GA.

**Structure:** Flat annual fee per pilot customer, discounted heavily from standard pricing. Typical range: $30K–$75K per customer per year, depending on scope.

**What's included:**
- All available modules and features
- All available EAM integrations (typically one, occasionally two)
- Onboarding and configuration support
- Direct engineering access for issues
- 5-year data retention

**What's NOT included:**
- Custom feature development on demand
- SLA commitments (Beta uses best-effort)
- Data residency guarantees beyond US
- Dedicated silo infrastructure

**Rationale for Beta pricing:**

Beta customers accept product immaturity in exchange for reduced price and product influence. Pricing must be low enough to be a rational choice for the customer — but not free, because free customers do not engage as seriously as paying customers.

Beta pricing is not intended to be sustainable. It is intended to seed the reference customer base that unlocks GA pricing conversations.

---

## GA Standard Pricing

**Launch:** Coincides with GA declaration.

**Structure:** Tiered subscription with a base fee plus per-asset pricing. Modules and add-ons priced separately.

### Tier structure

| Tier | Target Segment | Base Annual Fee | Per Asset | Included Modules | Included Users | SLA |
|------|---------------|-----------------|-----------|------------------|----------------|-----|
| **Essentials** | Small municipality (< 5,000 assets) | Low base | Highest per-asset | Asset Registry, Condition Recording, basic Capital Needs | 10 users | 99.5% |
| **Professional** | Mid-market county or city (5K–50K assets) | Moderate base | Mid per-asset | Essentials + Advanced TAMP + Risk Scoring | 50 users | 99.9% |
| **Enterprise** | State DOT or major private facility (50K+ assets) | Higher base | Lower per-asset | Professional + Capital Optimization + Multi-Jurisdiction + Custom Rules | 200 users | 99.9% |
| **Tier 1 Enterprise** | Fortune 500, largest state DOTs | Highest base | Lowest per-asset | Enterprise + Silo Infrastructure + Dedicated CSM + Custom SLA | Unlimited | 99.99% |

Specific dollar amounts are set with Sales leadership and updated in `docs/pricing/pricing-current.md`. Ballpark ranges at GA:
- Essentials: $40K–$80K per year
- Professional: $80K–$250K per year
- Enterprise: $250K–$750K per year
- Tier 1: $750K+ per year, custom

### Module add-ons (available at Professional and above)

Priced as annual add-on subscription:
- **Advanced EAM Connectors** (beyond the first): moderate per-connector fee
- **AI Condition Prediction (ML)**: premium add-on, priced per asset
- **Natural Language Query**: fixed annual add-on
- **AI Photo Analysis**: fixed annual add-on plus per-photo processing fee above a threshold
- **Digital Twin (bridges)**: premium add-on, priced per twin
- **Multi-Jurisdiction Rollup**: fixed annual add-on (Enterprise+ only)
- **Custom Model Calibration**: fixed one-time fee plus optional annual maintenance
- **Sandbox Environment**: included at Enterprise; add-on at Professional

### Professional services

Separately priced, not part of subscription:
- **Basic Onboarding**: fixed engagement fee (5 days, GIS import, user setup)
- **Standard Deployment**: fixed engagement fee (15 days, includes EAM integration)
- **Enterprise Deployment**: fixed engagement fee (30 days, multi-jurisdiction, training)
- **Custom Development**: day rate

### Discounts

- **Multi-year commitment:** 5% (2-year), 10% (3-year), 15% (5-year)
- **Multi-tenant enterprise** (state parent + district children): 10% off aggregate
- **Non-profit or public-agency starter**: 20% off Essentials for first year (grow into higher tier)
- **Reference customer discount**: negotiated case-by-case in exchange for public reference commitments

---

## Expansion Revenue Mechanics

Subscription growth over the customer lifetime is the core business model. Expansion happens along four dimensions:

**Asset growth.** As the customer adds asset classes or grows their portfolio (annexation, expansion), their per-asset fee scales. This is the most reliable expansion vector.

**Module upsell.** Customers who start at Essentials or Professional often upgrade to Enterprise as they adopt more advanced capabilities (risk scoring, optimization, custom rules).

**Add-on adoption.** AI features, additional EAM connectors, and premium services are separately priced. Historically, mature customers adopt an average of 1.5 add-ons per year of tenure.

**Support tier upgrade.** Customers who initially chose Professional often upgrade to Enterprise support after experiencing an incident where faster response would have helped.

Target net revenue retention (NRR) is 115% by Year 3 post-GA. This means customers, on aggregate, are paying 15% more each year than the prior year, driven by expansion.

---

## Competitive Pricing Benchmarks

The following are directional benchmarks against competing products. Precise numbers change; the ratios are stable.

- **IBM Maximo Application Suite**: Priced by "AppPoints" — complex, opaque. Total cost is typically 2-3x Aurigo Enterprise for equivalent asset coverage. Positioning: "you already have Maximo for maintenance; add Maintain for planning at a fraction of what Maximo Health would cost."
- **Oracle Primavera Unifier / CPM**: Priced per user, high per-seat cost. Total cost varies wildly by user count. For agencies with many field users, Aurigo is significantly cheaper.
- **Cityworks**: Primary EAM (Aurigo is complementary, not competing). Cityworks pricing is per module and typically lower than Aurigo — but Cityworks does not provide capital planning intelligence at Aurigo's depth.
- **Infor EAM**: Per named user, moderate to high cost. Similar structure to Oracle.
- **e-Builder / Trimble Construction Management**: Complementary product, not a direct competitor. Typically priced per project.
- **MaintainX / UpKeep**: Mid-market SMB CMMS, low cost. Not comparable to Aurigo enterprise offering.

Aurigo's competitive pricing goal: **be materially cheaper than IBM Maximo Health or Oracle Primavera CPM at equivalent asset coverage**, while being materially better on capital planning depth.

---

## Pricing Evolution Timeline

### Year 1 post-GA: Establish standard pricing

- Publish standard tier pricing (Essentials, Professional, Enterprise) on the website.
- Tier 1 remains custom, negotiated with sales.
- Establish reference customer program with formal discount policy.
- First round of pricing validation: are we winning at 50% of qualified deals? If below 40%, pricing is too high; if above 65%, likely too low.

### Year 2 post-GA: Introduce add-on tier

- Launch first AI add-ons (Condition Prediction ML, NLQ) as separately-priced modules.
- Introduce Sandbox environment as an add-on.
- First price increase for Essentials and Professional tiers (5-8% CPI-plus).
- Evaluate: is add-on adoption tracking to expectation? What is the actual NRR?

### Year 3 post-GA: Tier restructuring based on data

- Analyze which customers cluster in which tier and adjust boundaries based on real data.
- Introduce Tier 1 Enterprise as a formal tier with published (though negotiated) pricing.
- Consider consumption-based pricing for specific dimensions (e.g., ML inference count) as usage patterns become clearer.
- Larger price increases for legacy customers as multi-year contracts renew.

### Year 5 post-GA: Product-led pricing option

- Introduce self-service Essentials with credit card checkout for mid-market customers.
- Add usage-based components for API integrations (webhook delivery, external API calls) where high-volume integrations create cost.
- Consider federated pricing for consortiums (state DOT plus multiple sub-jurisdictions on a shared contract).

---

## Special Pricing Considerations

### Public sector procurement

Government procurement cycles constrain pricing tactics:
- Federal-aid customers may require GSA schedule pricing (published, not negotiable).
- State cooperative purchasing agreements (NASPO, Sourcewell) may set price ceilings.
- Sole-source justifications require differentiator language — pricing that seems too aggressive may compromise sole-source paths.

### FedRAMP-adjacent customers

State DOTs receiving federal highway funds have federal security requirements adjacent to FedRAMP. When FedRAMP Authorization is achieved (long-horizon, post-GA), premium pricing applies to the FedRAMP tier — typically 25-40% above equivalent commercial tier.

### Multi-tenant state / county hierarchies

For state parents with sub-jurisdictions, offer aggregate pricing that scales sub-linearly. This aligns Aurigo's revenue with the customer's total portfolio while providing an incentive to bring more sub-jurisdictions onto the platform.

### Loss leaders and strategic accounts

For a small number of highly-visible reference accounts (top-3 state DOTs, top-2 data center operators), Aurigo may offer material pricing discounts in exchange for public reference commitments, case studies, and speaking engagements. These are approved case-by-case by the VP of Sales and CFO.

---

## Anti-Patterns to Avoid

- **Discounting to close a deal that shouldn't close.** If the customer is not a good fit, discounting turns them into a churn risk. Better to walk away.
- **Publishing full price transparency for Enterprise tier.** Enterprise deals depend on negotiated terms; published pricing constrains flexibility.
- **Per-transaction pricing (per inspection, per report).** Creates unpredictable bills and CFO objections. Predictable subscription revenue is more valuable.
- **Free tier without adoption plan.** Free tier attracts users who never convert. Trial is different from free — trial has an end date.
- **Different pricing for the same features by industry.** Public vs. private pricing should reflect real cost differences (compliance, support model), not "what the market will bear."

---

## Related documents

- Enterprise readiness structure: `06-enterprise-roadmap.md`
- Competitive analysis prompt: `vol-10-claude-prompts/04-competitor-analysis.md`
- Current live pricing: `docs/pricing/pricing-current.md` (single source of truth for exact dollar amounts)
- Sales enablement pricing playbook: `docs/sales/pricing-playbook.md`
