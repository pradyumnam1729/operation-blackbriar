# Beta Roadmap — Aurigo Maintain

## Beta Goals

Beta begins after MVP is live with at least two paying public sector customers and the core platform has been validated in production. Beta has two goals: deepen the product for public sector customers who need more than MVP scope, and expand into the private sector with the first Primus module offering.

The working definition of Beta completion: five paying customers (at least three public sector, at least one private sector), NPS above 40 measured from users who have been active for more than 60 days, and 95% uptime over any rolling 30-day window. These are not arbitrary — five paying customers is the minimum validation that the product is repeatable, not a one-off fit for a single agency. NPS above 40 indicates users are actively recommending the product. 95% uptime is the minimum bar for a production enterprise SaaS that customers depend on for regulatory reporting.

Beta timeline is 18 months post-MVP launch.

---

## Public Sector Additions

### Advanced TAMP — All Asset Classes

The MVP TAMP covers pavements and bridges only, because those are federally mandated. Beta expands TAMP reporting to all Maintain asset classes: signs, culverts, sidewalks, retaining walls, drainage systems, streetlights, traffic signals, and tunnels. Each asset class requires:

- A defined condition rating scale (some use PASER-style 0–10, some use NBI-style 0–9, some use agency-specific scales)
- A condition rating converter so agencies on different scales can compare across asset classes
- Asset-class-specific defect catalogs
- Asset-class-specific deterioration model defaults
- Asset-class-specific TAMP section template

The TAMP narrative engine is enhanced to generate asset-class-specific language rather than generic filler text. Each section cites actual numbers from the tenant's data.

### Risk Scoring — Probability × Consequence Matrix

MVP capital planning prioritizes by condition: worst assets first. Beta adds a risk-based prioritization layer. Risk is defined as probability of failure × consequence of failure. 

Probability of failure is derived from the deterioration model and RUL: an asset at condition 1.5 on a linear model that started at 5.0 is further along its failure curve than an asset at 1.5 on a Weibull model with a slow tail. The probability function is configurable per asset class.

Consequence of failure is a weighted multi-factor score: traffic volume (for pavements and bridges), structural criticality (for load-bearing assets), community impact (school proximity, emergency access route), replacement cost (higher cost = higher consequence), and redundancy (is there an alternate route/path?). Factor weights are configurable per tenant.

Risk score = P(failure) × Consequence. Assets are ranked by risk score on the capital needs schedule as an alternative to condition-only ranking. Agencies can toggle between condition-priority and risk-priority views. The risk matrix is visualized as a 5×5 heatmap (probability bands × consequence bands) with assets plotted.

### Capital Plan Optimization — Budget Scenario Modeling

The MVP capital needs schedule answers: "what does it cost to maintain all assets above threshold?" Beta adds budget constraint optimization: "given $X annual budget, which assets should be treated to minimize total portfolio risk (or maximize condition improvement)?"

The optimizer is a linear program (or greedy priority-queue approximation for simplicity at Beta) that, given a budget constraint and a set of candidate interventions, selects the combination of interventions that maximizes a configurable objective function (minimize risk, maximize condition improvement, maximize lives extended, or a weighted combination).

Users can create and save multiple budget scenarios: "fully funded," "10% cut," "federal-only funding." For each scenario, the system shows which assets are treated, which are deferred, and what the projected portfolio condition looks like at years 5 and 10 under each scenario. Scenario comparison view shows the tradeoffs side by side.

### Maximo Integration

IBM Maximo is the most widely deployed EAM in State DOTs and large county governments. The Maximo integration mirrors the Cityworks integration pattern: nightly asset import (asset master records, locations, asset hierarchy), inspection result push (create service requests or work orders in Maximo based on defects flagged in Maintain), and capital plan write-back (approved capital plan interventions exported as planned work orders).

The Maximo integration requires the Maximo REST API (Maximo Application Framework 7.6.1+) or the older SOAP-based Integration Framework for legacy deployments. Both are implemented, selected by configuration. Field mapping is configurable per tenant. The integration supports Maximo on-premise and IBM Maximo Application Suite (cloud).

### SAP PM Integration

SAP Plant Maintenance (PM) and its successor SAP Asset Management in S/4HANA are common in municipal governments that run SAP for their financial and HR systems. The SAP integration uses the SAP Business Technology Platform (BTP) API Management layer or direct RFC calls depending on the customer's deployment. Asset import from SAP Functional Locations. Inspection notification creation. Capital plan sync to SAP PM Work Orders and SAP PS (Project System) for budget tracking.

### Work Order Recommendation to EAM Sync

Both the Maximo and SAP integrations include a work order recommendation engine. When an inspection identifies a defect above a configurable severity threshold, Maintain automatically creates a draft work order recommendation. The asset manager reviews recommended work orders in a queue (approve, reject, or edit), and approved work orders are synced to the connected EAM. The review queue prevents spamming the EAM with every minor defect. Configurable rules control which defect types auto-generate recommendations.

### Multi-Jurisdiction View

Large State DOTs operate across districts. Counties may manage assets that cross municipal boundaries. Beta adds a multi-jurisdiction hierarchy: a state-level admin can create sub-jurisdictions (districts, counties, municipalities) each with their own asset data and users, and roll up condition, capital needs, and risk data to the state level.

The state-level dashboard shows aggregate condition by jurisdiction (map choropleth and bar chart). The state-level TAMP pulls from all sub-jurisdictions. Each sub-jurisdiction retains its own data isolation — users in District 4 cannot see asset-level data from District 7 unless they have a cross-jurisdiction role.

---

## Private Sector Launch — Primus Modules

Beta launches Maintain for the private sector under the Primus brand. Private sector infrastructure owners (manufacturing plants, data centers, airports, utility companies, life sciences facilities) have fundamentally different asset profiles than public agencies but share the same core need: know the condition of critical assets, forecast when they will fail, and plan capital investment to prevent unplanned outages.

### Data Center Module

Data centers have 12 asset classes modeled in Beta:

1. Uninterruptible Power Supply (UPS) units
2. Computer Room Air Conditioning (CRAC/CRAH) units
3. Cooling towers
4. Generators
5. Power Distribution Units (PDUs)
6. Transfer switches (ATS/STS)
7. Raised floor systems
8. Cable trays and conduit runs
9. Fire suppression systems
10. Security/access control systems
11. Roof and building envelope
12. Fuel storage systems

Each asset class has Weibull model parameters derived from published MTBF data for commercial data center equipment (Uptime Institute and Lawrence Berkeley National Lab sources). The condition scale for mechanical/electrical equipment maps to: 5 (new/excellent), 4 (good, no issues), 3 (fair, minor degradation observed), 2 (poor, performance degradation), 1 (critical, immediate attention), 0 (failed). Defect catalogs include electrical fault codes, mechanical wear indicators, and environmental condition readings (thermal runaway precursors, vibration anomalies).

### Manufacturing Module

Manufacturing plants are defined by uptime and throughput. The manufacturing module adds two capabilities not present in the public sector modules:

**OEE Integration:** Overall Equipment Effectiveness data from the customer's SCADA or MES system can be imported as a signal that feeds into condition scoring. An asset with 85% OEE is in better condition than the same asset class running at 63% OEE. The OEE-to-condition mapping function is configurable per asset type.

**Production Uptime Risk Scoring:** The consequence dimension of the risk matrix for manufacturing assets is weighted by production impact: a conveyor on the critical path of a production line has higher consequence than a conveyor on a secondary line. Production dependency mapping (which asset failures would halt which production lines) is entered by the asset manager and used to calculate consequence weights automatically.

Asset classes for manufacturing Beta: conveyor systems, CNC machines, industrial robots, compressors, boilers and steam systems, HVAC, electrical switchgear, hydraulic systems, and dust collection systems.

---

## Beta Success Criteria

Beta is complete and ready for GA when all five criteria are met:

1. **Five paying customers** with signed contracts: at least three public sector agencies, at least one data center or manufacturing operator using the Primus module.

2. **NPS above 40** measured from users who have been active on the platform for more than 60 days. Measured via in-product survey triggered at 60-day mark.

3. **95% uptime** over any rolling 30-day period in the three months prior to GA declaration, measured from external synthetic monitoring.

4. **Maximo or SAP integration live** at at least one customer in production — not just configured, but actively syncing work orders bidirectionally for at least 30 days without manual intervention.

5. **Risk-based capital plan accepted** as the primary planning methodology by at least two customers — meaning they are using risk score, not condition only, as their prioritization basis for their official capital plan submission.

---

## Beta Timeline

**Months 1–3 Post-MVP:** Advanced TAMP for all asset classes. Asset class configuration framework (so adding new classes doesn't require code changes). Condition scale converter.

**Months 4–6:** Risk scoring engine. Risk matrix heatmap. Capital plan optimization (greedy algorithm first, linear program in iteration 2). Budget scenario comparison.

**Months 7–9:** Maximo integration. SAP PM integration. Work order recommendation queue. Multi-jurisdiction hierarchy and rollup views.

**Months 10–12:** Data center module for Primus. OEE integration API. Manufacturing module (initial 5 asset classes).

**Months 13–15:** Manufacturing module full (all 9 asset classes). Production uptime risk scoring. Primus-specific onboarding and help content.

**Months 16–18:** Beta customer success work: training, configuration support, feedback collection, NPS measurement. Performance tuning under real multi-tenant load. Bug fixes. Security improvements ahead of SOC 2 audit. GA preparation.

---

## Dependencies and Risks

**Maximo API Complexity:** IBM Maximo has a notoriously complex and inconsistently documented API surface. The integration will require dedicated engineering time with access to a real Maximo environment (not just docs). Allow 6 weeks, not 4.

**SAP RFC Complexity:** SAP RFC-based integrations are more complex than REST APIs. The SAP BTP path is cleaner but requires the customer to have BTP licensed. Plan for two integration paths from the start.

**Multi-Jurisdiction Data Model:** The multi-jurisdiction hierarchy affects the core data model (tenant_id becomes more complex). This must be planned as an architectural change (Gate 1) at the start of Beta, not retrofitted after other features are built.

**Primus Market Validation:** The private sector modules are built based on market research, not validated customer demand. The first Primus customer conversation should happen by month 3 of Beta. If no private sector customer is signed by month 9, reassess scope before investing in the manufacturing module.
