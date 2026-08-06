# 06 — Competitive Landscape

---

## Overview

Understanding the competitive landscape is essential for building the right features, making the right architecture decisions, and telling the right story in a sales context. Aurigo competes in multiple overlapping market segments. The most important insight in this document is this: most of Aurigo's apparent "competitors" in the maintenance space are not competitors at all — they are integration partners. Aurigo's competitive strategy is integration-first, not replacement-first. The systems below are described accurately: where they are strong, where they are weak, and where Aurigo's position is most defensible.

---

## Six Strategic Lenses (Read This Before the Feature Matrix)

Feature-parity thinking is the wrong lens for this market. Every EAM ticks boxes; nobody wins on box count. Aurigo's competitive strategy is built on six lenses that describe **where the market is broken**, not what each vendor ships. Full analysis lives at `.ai/competitive-intelligence.md`; the summary is:

| Lens | Question | Aurigo's play |
|---|---|---|
| **Lifecycle Gaps** | Where does the competitor's model discontinue the asset lifecycle? | Own the future horizon (RUL / ARV / LCP) that EAMs cannot reach. |
| **Project Handoff** | How does information move Plan → Build → Maintain (and back)? | The unified data model is Aurigo's only unique architectural moat. Ship it real, not stubbed. |
| **AI** | Native to the data model, retrofit, or absent? | Own "explainable capital-planning AI" — deterministic + SHAP-style explanations. |
| **Capital Planning Feedback** | Does execution reality feed back to the planning model? | The `SubmitInspectionCommand` cascade *is* this loop. Instrument, test, publish as competitive proof. |
| **Executive Visibility** | What does the DOT Director / CIO / COO actually see? | Persona-specific dashboards (DOT Director, CFO packet, board export). Currently absent. |
| **Integration Opportunities** | Where should Aurigo integrate rather than compete? | Rank targets P0…P3 (see `vol-6-integration-strategy/00-integration-overview.md`). |

**Rule of thumb for sales enablement:** every talk track should name the lens, then the gap, then the Aurigo answer. Never name the feature first.

- Wrong: "Aurigo has 15 features Maximo doesn't have."
- Right: "**Maximo cannot answer 'what will your pavement network look like in 2036'** because the model that would answer it doesn't exist inside Maximo. Aurigo Maintain is that model. Deploy it above Maximo in 60 days."

Same shape for every competitor. See `.ai/competitive-intelligence.md` for the per-vendor application of the six lenses.

---

## EAM Platforms (We Integrate With, Not Compete With)

These are the established systems of record for maintenance execution. They manage work orders, preventive maintenance schedules, inventory, labor, and asset records. Aurigo does not compete with these systems for the execution layer. Aurigo's position is the intelligence layer above them.

### IBM Maximo

**Market position:** IBM Maximo is the dominant EAM platform in heavy industry, utilities, oil and gas, transportation, and government. It has been deployed at thousands of organizations worldwide and has been in the market for over 30 years in various forms.

**Strengths:**
- Extremely deep work order management functionality built over decades of customer customization
- Strong in heavy industrial environments: refineries, power plants, manufacturing
- IBM's enterprise sales relationships and integration with IBM infrastructure products
- Maximo Application Platform allows deep customization
- Large ecosystem of implementation partners and add-on applications

**Weaknesses:**
- Complex to implement and maintain; typical Maximo deployment costs $2-10M
- User interface is dated; mobile experience requires significant additional configuration
- No capital planning capability beyond basic budgeting
- No connection to project delivery (Build phase)
- Analytics are basic without IBM Cognos or other BI layer
- Cloud migration (Maximo Application Suite) has been slow and complex for existing customers
- AI capabilities are being added (IBM Watson integration) but are not native to the product

**Aurigo's position relative to Maximo:** Maximo customers are among Aurigo's best target customers because they already understand the value of asset management but have a clear gap in capital planning intelligence. Aurigo Maintain (Integrated mode) reads from Maximo via the Maximo API and adds the capital planning, TAMP, and AI intelligence layer without requiring any change to the existing Maximo workflows.

### SAP EAM (Plant Maintenance Module)

**Market position:** SAP PM (Plant Maintenance) is embedded in large enterprises that have already committed to the SAP ERP ecosystem. It is primarily used in manufacturing, utilities, and chemical/process industries.

**Strengths:**
- Deep integration with SAP financials, procurement, and HR — no integration cost for companies already on SAP
- Mature functionality for maintenance planning, execution, and costing
- SAP's global enterprise sales force
- SAP S/4HANA migration path provides a cloud future

**Weaknesses:**
- SAP PM requires SAP expertise to configure and maintain; expensive consulting cost
- Capital planning in SAP is financial planning (investment programs), not condition-based asset planning
- No spatial/GIS capability; infrastructure assets that have geometry are poorly supported
- No TAMP or public sector compliance framework
- Implementation complexity: SAP PM implementations at large utilities routinely run $10-50M

**Aurigo's position relative to SAP:** Aurigo rarely encounters SAP PM in public sector accounts. In private sector (manufacturing, utilities), SAP PM customers who need capital planning intelligence are a target segment. The integration approach: read asset and maintenance history from SAP PM, run the Maintain intelligence layer, feed capital needs back into SAP Investment Programs.

### Oracle EAM

**Market position:** Oracle EAM (within Oracle Fusion Cloud or the legacy Oracle E-Business Suite) is used primarily by mid-to-large government entities and utilities. Oracle's strong position in government ERP (Oracle Financials) creates pull for Oracle EAM.

**Strengths:**
- Integration with Oracle Financials eliminates the fund accounting integration challenge for government customers
- Oracle's enterprise sales relationships in government
- Oracle Primavera integration (same vendor) provides project scheduling capability

**Weaknesses:**
- Limited capital planning capability beyond budget tracking
- No condition-based deterioration modeling
- Geographic data support is limited
- Analytics require Oracle Analytics Cloud (additional cost and complexity)
- Oracle's cloud migration path has been rocky for EAM customers

**Aurigo's position relative to Oracle EAM:** Similar to SAP — Aurigo reads from Oracle EAM and adds the intelligence layer. The Aurigo + Oracle Financials integration (via Oracle EAM) gives public sector customers the fund accounting integration they need.

### Cityworks (Trimble)

**Market position:** Cityworks is the dominant EAM platform for local government utilities and public works departments. It is Esri-native, running on ArcGIS as its spatial platform. Most cities and counties that have GIS from Esri and a need for work order management use Cityworks.

**Strengths:**
- Deep Esri integration: Cityworks uses Esri geodatabase as its asset registry; all assets are spatial objects
- Strong in water/wastewater utilities and local government public works
- Good mobile experience (leverages Esri's mobile GIS tools)
- Understanding of local government workflows and terminology

**Weaknesses:**
- Capital planning capability is minimal; Cityworks manages work orders, not capital programs
- No deterioration modeling or RUL calculation
- No TAMP module for state-level compliance
- Weak in manufacturing or private sector contexts
- Analytics require separate Esri tools or BI platforms
- Trimble acquisition has created some product roadmap uncertainty

**Aurigo's position relative to Cityworks:** Cityworks customers are excellent Masterworks Maintain targets. They have the work order and GIS foundation; they lack the capital intelligence layer. Maintain reads from Cityworks via API and adds condition scoring, deterioration modeling, and capital needs analysis. The fact that Cityworks runs on Esri's geodatabase means Aurigo's PostGIS/GeoJSON data model can import Cityworks asset data with moderate integration work.

### Infor EAM

**Market position:** Infor EAM is a mid-market EAM platform with strength in manufacturing, healthcare facilities, and government. Infor's CloudSuite Industrial (formerly SyteLine) combined with EAM serves manufacturing customers who want ERP + EAM on one platform.

**Strengths:**
- Reasonable mobile experience
- Good fit for mid-market manufacturing
- Industry-specific configurations for discrete and process manufacturing

**Weaknesses:**
- Limited public sector penetration
- No capital planning beyond basic budgeting
- Analytics require Infor Birst (additional license)
- Smaller ecosystem than Maximo or SAP

---

## Public-Works AMS (GIS-Native, Municipal-Focused)

These vendors overlap the Cityworks segment but position as broader "gov-tech" suites. They are direct competitors in municipal deals — not integration partners.

### Cartegraph (OpenGov)

**Market position:** Cartegraph is OpenGov's asset management + operations management arm since the 2022 acquisition. Department-specific offerings (Transportation, Parks, Water, Facilities) sit alongside OpenGov's budgeting, permitting, and public-transparency products. Sweet spot: mid-sized US cities and counties (50k–500k population).

**Strengths:**
- Department-specific UX that maps to municipal org charts (Parks staff see a Parks UI, not a generic EAM)
- OpenGov's genuinely category-defining public-transparency portal — no competitor comes close on citizen-facing dashboards
- Elected-official reporting is polished; the audience is city council, and it shows
- Growing SaaS suite (Cartegraph + OpenGov Budgeting + OpenGov Permitting + OpenGov Reporting) with real cross-product data flow

**Weaknesses:**
- Capital planning depth is thin — Scenario Builder is a manual, separate step; not an inherent data flow
- No AI-native deterioration or RUL model
- No TAMP / federal-aid highway compliance module
- Transportation domain depth is limited compared to AgileAssets or Aurigo
- Cross-EAM integration is weak — Cartegraph wants to *be* the EAM, not sit above one

**Aurigo's position vs. Cartegraph:**
- Compete on: Plan → Build → Maintain continuity; transportation + civil-infrastructure depth; TAMP; ability to sit above an existing Cityworks / Maximo (Cartegraph asks the customer to replace those).
- Do not compete on: elected-official transparency UX (they win here — study their patterns instead).
- Do not integrate: direct head-to-head vendor.

---

## Transportation Asset Management (TAM Specialists — Direct Competitors)

These are the vendors Aurigo actually competes head-to-head with in state DOT and large-agency deals. Not "integration-first."

### AgileAssets (Trimble)

**Market position:** AgileAssets is the incumbent transportation asset management platform at many state DOTs. Trimble acquired them in 2021. Deep modules for pavement, bridge, signs, signals, roadside, safety, and maintenance management. This is the only vendor on this list that can honestly claim "we already do most of what Aurigo Maintain does for a state DOT."

**Strengths:**
- Mature per-asset-class deterioration models calibrated against decades of state-DOT time-series data
- Pavement management depth is genuinely category-leading — decades of AASHTO / FHWA research embedded in the models
- Explicit TAMP support with reference deployments at multiple state DOTs
- Trimble ecosystem — potential coupling with Cityworks (public-works), Trimble Construction Cloud, Bentley MicroStation for CAD/GIS
- Strong long-term customer relationships in state DOT M&O offices

**Weaknesses:**
- No Build / construction management layer — programmed projects hand off to Primavera, Bentley, or in-house tools via CSV / Excel / bespoke integration
- User experience is dated; modern-web expectations (mobile-first, real-time collaboration, dashboards for non-specialists) are unmet
- AI is model-based ML (deterioration curves), not GenAI or explainable-AI at the UX layer
- Transportation-only — a state DOT that also owns buildings, IT assets, or fleet needs a separate tool
- Deployment is heavy; typical AgileAssets rollout is 12–18 months with significant configuration effort

**Aurigo's position vs. AgileAssets:**
- **Do not pitch on feature parity** — this is the one vendor where feature-for-feature we will lose on transportation-specific depth.
- Compete on: **Plan → Build → Maintain continuity** (they have no Build); **modern UX + mobile field UX** (they are dated); **cross-asset-class breadth** (they are transportation-only); **AI-native TAMP narrative** (they are model-based, not GenAI).
- Reference-check every state DOT deal against them explicitly.
- If Trimble ever bundles AgileAssets + Cityworks + Trimble Construction as a "public-works lifecycle suite," threat level moves to Existential — see `vol-8-roadmaps/10-competitive-response-roadmap.md#scenario-6` (added).

### Brightly (Siemens — formerly Dude Solutions)

**Market position:** Brightly is the merger of Dude Solutions (K-12 / higher-ed / public-sector facilities), Confirm (transportation asset management, historically UK / Commonwealth), and related brands. Acquired by Siemens in 2022. Sweet spot: K-12 districts, higher education, healthcare facilities, and municipal facilities management. Predictor product does long-horizon capital forecasting with ML.

**Strengths:**
- Predictor is a genuine ML-driven asset-health + capital-forecasting engine — long-standing, not a marketing bolt-on
- Sustainability / ESG scoring is a real differentiator for K-12 boards and higher-ed sustainability committees
- Board-of-education-friendly dashboards and capital-plan visualisations — Aurigo should study their reporting templates
- Origin + Predictor closed-loop (work-order history feeds the forecasting model) is architecturally similar to what Aurigo needs to prove for its own cascade
- Siemens acquisition provides enterprise credibility with corporate customers

**Weaknesses:**
- Transportation asset depth is limited outside legacy Confirm markets
- No TAMP or federal-aid highway compliance module for US DOTs
- Linear infrastructure (roads, bridges, pipes) is not the category strength — buildings and building systems are
- Suite integration story (Origin + Predictor + SchoolDude + Confirm) is still stitching after the mergers

**Aurigo's position vs. Brightly:**
- Compete on: transportation + civil-infrastructure depth; TAMP; federal-aid compliance; Plan → Build → Maintain continuity.
- Do not compete on: K-12 facilities; sustainability / ESG scoring for buildings; board-of-education dashboards.
- Partner opportunity: mixed-asset municipal deals where Aurigo owns civil / transportation and Brightly owns interior building systems.

---

## AI-Native Field Capture (Signal Producers, Not Competitors)

### Atom AI

**Market position:** Atom is one of a small cohort of AI-native inspection tools (alongside RoadBotics, RoadWay AI, and camera-mounted mobile CV startups) that convert imagery into condition ratings, defect codes, and geolocated data at scale. Field-inspection-first.

**Strengths:**
- Native computer vision — photo-to-defect classification and condition scoring from imagery, not a bolt-on
- Genuinely mobile-first workflow (they were designed for iPhone, not adapted to it)
- Open positioning as a signal producer — happy to integrate with whatever consumes the ratings
- Fast time-to-value for inspection backlog reduction

**Weaknesses:**
- No multi-year capital-planning layer — that is deliberately not their category
- No TAMP or programme-level reporting
- Executive-visibility layer is thin; the audience is the field-manager, not the DOT Director

**Aurigo's position vs. Atom AI:**
- **Integrate, do not compete.** Publish an Atom → Aurigo Maintain ingest adapter and reference architecture. Ratings + defect codes + photos flow into Aurigo's Condition + Documents domain.
- Same category as RoadBotics / RoadWay AI — treat as a signal-producer partnership.
- Watch for encroachment: if Atom raises a Series B and adds a planning module, threat level moves to Moderate. Playbook `vol-8-roadmaps/10-competitive-response-roadmap.md#scenario-4` (new-entrant) covers this abstractly; consider naming Atom specifically in the next quarterly review.

---

## CMMS / Lightweight EAM (Work Order Management Focus)

These tools are primarily used by smaller organizations or organizations that do not need the full complexity of enterprise EAM. They are not capital planning tools. They are not Aurigo competitors in the intelligence layer.

### MaintainX

**Strengths:** Modern mobile-first interface, easy to deploy, strong SMB adoption, good user experience  
**Weaknesses:** No capital planning, no deterioration modeling, no GIS, no compliance reporting  
**Aurigo position:** Not a direct competitor; would be an integration source in Integrated mode for small customers

### UpKeep

**Strengths:** Strong UX, good mobile inspection tools, growing analytics capability  
**Weaknesses:** No capital planning, no lifecycle modeling, no public sector compliance  
**Aurigo position:** Same as MaintainX

### Limble CMMS

**Strengths:** SMB-focused, easy setup, affordable  
**Weaknesses:** Minimal analytics, no capital planning  
**Aurigo position:** Not a direct competitor

---

## Capital Program Management (Our Core Competitors in Plan/Build)

These vendors compete directly with Masterworks Plan and Build in the capital program management space.

### Oracle Primavera / Unifier

**Market position:** Oracle Primavera is the gold standard for project scheduling (P6) and capital program management (Unifier) in large infrastructure programs. It is widely used at state DOTs, utilities, and major construction programs.

**Strengths:**
- Oracle Unifier is deeply functional for large, complex capital programs
- Primavera P6 integration (scheduling is native)
- Oracle's enterprise relationships in government and utilities
- Long history in the market; many agencies have years of data in Unifier

**Weaknesses:**
- Extremely complex to implement and maintain; typical Unifier deployment is $5-15M
- User interface is dated and difficult for field users
- No asset management or Maintain capability
- No TAMP module
- Cloud migration has been slow

**Aurigo's position:** This is the most direct competitor in large state DOT Plan/Build. Aurigo wins on total cost of implementation, modern user experience, and the ability to connect Plan/Build to Maintain in a single platform. Oracle cannot provide the Maintain layer without a completely separate product.

### Kahua

**Market position:** Kahua is an emerging cloud-native capital program management platform with a modern architecture and good user experience. It is growing in public sector and commercial real estate.

**Strengths:**
- Cloud-native architecture; good mobile experience
- Modern, configurable data model
- Growing market presence and VC-backed growth

**Weaknesses:**
- No asset management or Maintain capability
- Smaller customer base than Oracle or Aurigo
- Limited public sector compliance depth (TAMP, federal aid rules)

**Aurigo's position:** Kahua is the closest technology-comparable competitor. Aurigo's advantage is the Maintain layer and 20 years of public sector domain depth. Kahua would need to build or acquire an asset management platform to compete at the full lifecycle level.

### e-Builder (Trimble)

**Market position:** e-Builder is a construction program management platform owned by Trimble. It is strong in public buildings, higher education, and some transportation. The Trimble acquisition gave it additional reach.

**Strengths:**
- Good document management and RFI/submittal workflows
- Strong in public buildings and facilities
- Trimble ecosystem integration (Trimble Connect, Cityworks)

**Weaknesses:**
- Limited in transportation asset management
- No TAMP module
- No asset lifecycle management capability

**Aurigo's position:** e-Builder competes primarily in the facilities and public buildings market. Aurigo's transportation and infrastructure focus means limited direct competition.

### Procore

**Market position:** Procore is the dominant construction management platform with the largest user base and most recognized brand in the AEC industry.

**Strengths:**
- Largest user base in construction management; strong brand recognition
- Excellent mobile experience for field construction crews
- Large partner ecosystem and marketplace
- Strong document management and photo documentation

**Weaknesses:**
- Construction execution focus; limited capital program management capability
- No asset lifecycle management or maintenance integration
- No TAMP or public sector compliance capability
- No deterioration modeling or RUL calculation
- Designed for construction teams, not asset managers or capital planners

**Aurigo's position:** Procore is a construction execution tool, not a capital program management tool. Some agencies use both Procore (for construction) and Aurigo (for capital program management and asset management). These often coexist rather than compete directly.

---

## Competitive Positioning Matrix

| Capability | Aurigo | IBM Maximo | Oracle Unifier | Procore | Cityworks | Kahua |
|------------|--------|------------|----------------|---------|-----------|-------|
| Capital Program Management | ✅ Strong | ❌ None | ✅ Strong | ⚠️ Limited | ❌ None | ✅ Good |
| Construction Project Delivery | ✅ Strong | ❌ None | ✅ Strong | ✅ Strong | ❌ None | ✅ Good |
| Asset Registry | ✅ Strong | ✅ Strong | ❌ None | ❌ None | ✅ Strong | ❌ None |
| Condition Recording | ✅ Strong | ⚠️ Limited | ❌ None | ❌ None | ⚠️ Limited | ❌ None |
| Deterioration Modeling | ✅ Strong | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| Capital Needs Analysis | ✅ Strong | ❌ None | ⚠️ Limited | ❌ None | ❌ None | ❌ None |
| TAMP Compliance | ✅ Strong | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| Work Order Management | ⚠️ Limited (Native) | ✅ Strong | ❌ None | ❌ None | ✅ Strong | ❌ None |
| GIS / Spatial Data | ✅ Strong | ⚠️ Limited | ❌ None | ❌ None | ✅ Strong | ❌ None |
| AI / ML Capital Optimization | ✅ Strong | ⚠️ Emerging | ❌ None | ❌ None | ❌ None | ❌ None |
| Plan → Build → Maintain Continuity | ✅ Unique | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |

---

## Why Aurigo Wins

**Reason 1: The only vendor with Plan → Build → Maintain in a single data model.** Every competitor solves one phase. Aurigo connects all three. The data continuity that results cannot be replicated by combining three point solutions, because the integration cost is high, the data loss at handoff points is significant, and the combined user experience is fragmented.

**Reason 2: Deepest public sector domain knowledge.** Twenty years of federal-aid highway compliance, TAMP methodology, NBIS inspection standards, FTA asset management requirements, NERC CIP, and state-level budget processes is embedded in Aurigo's product and in its people. Competitors from the ERP world or the construction tech world cannot acquire this knowledge quickly.

**Reason 3: AI-native architecture.** Aurigo's AI capabilities — deterioration modeling, capital optimization, TAMP narrative generation — are not features added to a legacy product. They are designed into the data model from the start. Every inspection recorded, every maintenance event captured, every capital plan validated contributes to the AI training data. Legacy competitors (Maximo, Oracle) are retrofitting AI onto architectures that were not designed for it.

**Reason 4: Integration philosophy lowers adoption barrier.** Aurigo does not ask customers to replace their existing EAM. The integration-first approach means the decision to adopt Maintain does not require a rip-and-replace migration. This dramatically reduces the perceived risk of adoption and shortens the sales cycle.

**Reason 5: Modern technology stack.** React frontend, cloud-native backend, PostGIS spatial data, REST APIs — Aurigo's technology stack enables the user experiences and integration patterns that modern infrastructure organizations expect. Legacy competitors cannot deliver comparable UX without rebuilding their front-end architectures, which they are doing slowly and expensively.

---

## Why Aurigo Loses — Honest Weakness Analysis

Documenting where Aurigo actually loses is more important than documenting where it wins. This section is updated quarterly from CRM-tracked win/loss data (n=41 lost deals, trailing 12 months).

### Reason 1 — Insufficient brand recognition against IBM/Oracle in top-10 state DOTs (33% of losses)

State DOT executives are risk-averse. A procurement officer choosing between "IBM" and "Aurigo" faces personal risk if the smaller vendor stumbles publicly. Aurigo loses ~33% of top-10 state DOT competitive deals to Oracle Unifier or IBM Maximo primarily on perceived vendor risk, not on functional evaluation.

**What we are doing about it:**
- Publishing lighthouse customer case studies with named reference sponsors
- CEO speaking slots at AASHTO annual meetings
- Federal government contracting vehicles (GSA, NASPO ValuePoint) to reduce procurement friction
- Public financial disclosures (private but audited) available under NDA to major procurement officers

### Reason 2 — Cityworks incumbency in Esri-tight local government (24% of losses)

When a city runs Esri ArcGIS Enterprise + Cityworks and has been running it for 8+ years, replacing Cityworks is a political-technical fight Aurigo does not always win. Cityworks + Esri is a coupled stack.

**What we are doing about it:**
- Explicit ArcGIS Enterprise integration mode — read/write directly to Esri feature services
- "Cityworks-adjacent" positioning: we do not compete with Cityworks for work orders; we sit above it for capital planning
- Trimble monitoring: any Cityworks roadmap announcement about capital planning gets a same-week competitive response

### Reason 3 — Feature parity gaps in specific verticals (19% of losses)

Where Aurigo has not yet deployed a lighthouse customer in a vertical, the "reference risk" is fatal. Examples: freight rail, marine ports, wastewater treatment plant process equipment.

**What we are doing about it:**
- Deliberate lighthouse recruitment: identify 1 anchor customer per new vertical before broad sales investment
- Product/roadmap gating: no vertical is added to marketing collateral until the lighthouse is live in production

### Reason 4 — "Wait for AI" objection (12% of losses)

Some sophisticated customers explicitly decline to buy any asset intelligence software right now, betting that OpenAI or Anthropic will offer a general-purpose "ask my assets anything" product within 2 years.

**What we are doing about it:**
- Publishing evidence that domain-specific AI + integrated data outperforms general models
- Emphasizing the data continuity moat (an LLM cannot invent your bridge inspection history)
- Offering short-term (12-month) contracts to reduce commitment risk

### Reason 5 — Implementation complexity concerns (8% of losses)

Even integration-first, some customers perceive Aurigo as "another IT project I can't afford."

**What we are doing about it:**
- Fixed-fee 90-day time-to-value implementations
- Chief Customer Officer commitment: if we cannot show ROI in 90 days, the customer keeps the software free until we do

### Reason 6 — Price (4% of losses)

Losses on price alone are rare — customers who choose based on price alone are usually not a good long-term fit anyway. When it happens, the winner is almost always a lightweight CMMS priced below $30K/year.

---

## Win/Loss Analysis Framework

Every competitive deal ≥ $100K ACV, won or lost, triggers a formal Win/Loss debrief within 21 days of decision. The framework:

### Data captured (mandatory in CRM)

| Field | Populated by | When |
|-------|--------------|------|
| Primary competitor | Sales | RFP submission |
| Secondary competitors | Sales | RFP submission |
| Evaluation criteria weights (customer's own scoring) | Sales | Discovery |
| Customer's stated Top 3 reasons for decision | Sales + CS | Post-decision, from customer directly |
| Customer's stated Top 3 concerns about winner | Sales | Post-decision |
| Aurigo's honest self-assessment | RVP + PM | Post-decision, blameless |
| Product gap identified (if any) | PM | Post-decision |
| Would customer accept an interview? | Sales | Post-decision |
| Interview transcript | Product Marketing | Within 30 days if consent |

### Cadence

- **Monthly:** Regional VP + Product Marketing review all deals closed in the month.
- **Quarterly:** CEO + CTO review the aggregate. Any product gap identified in 2+ losses in a quarter becomes a formal roadmap discussion item.
- **Annually:** Full win/loss narrative published to the company as part of the annual strategy review.

### Red-line rule

If Aurigo loses 3 consecutive deals in the same vertical to the same competitor, sales enablement freezes new outreach in that vertical for 60 days while product + engineering root-cause the loss. This prevents burning goodwill in a segment where we are not currently competitive.

---

## Extended Feature Comparison Matrix — 15 Capabilities × 8 Competitors

Legend: 5 = Category leader; 4 = Strong; 3 = Adequate; 2 = Limited; 1 = None; N/A = Not applicable

| Capability | Aurigo | IBM Maximo | Oracle Unifier | Oracle EAM | Cityworks | Infor EAM | SAP PM | Kahua | Procore |
|-----------|--------|------------|----------------|------------|-----------|-----------|--------|-------|---------|
| Capital program mgmt (CIP, STIP) | 5 | 1 | 4 | 2 | 1 | 1 | 2 | 4 | 2 |
| Federal-aid highway compliance | 5 | 1 | 2 | 2 | 2 | 1 | 1 | 2 | 1 |
| Construction project delivery | 4 | 1 | 4 | 2 | 1 | 1 | 2 | 4 | 5 |
| Asset registry (with GIS) | 5 | 4 | 1 | 3 | 5 | 3 | 3 | 1 | 1 |
| Condition recording (per-class scales) | 5 | 3 | 1 | 2 | 3 | 3 | 2 | 1 | 1 |
| Mobile inspections (offline) | 4 | 3 | 1 | 2 | 4 | 4 | 3 | 3 | 5 |
| Deterioration modeling (RUL) | 5 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 |
| Capital needs analysis | 5 | 1 | 2 | 2 | 1 | 1 | 2 | 3 | 1 |
| Budget optimization (constrained) | 5 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 1 |
| TAMP report generation | 5 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| NBI / NBIS bridge module | 5 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 1 |
| Work order execution | 3 | 5 | 1 | 4 | 5 | 4 | 5 | 1 | 2 |
| Preventive maintenance scheduling | 3 | 5 | 1 | 4 | 4 | 4 | 5 | 1 | 1 |
| AI / ML native to product | 4 | 2 | 1 | 1 | 1 | 2 | 2 | 1 | 2 |
| Plan → Build → Maintain continuity | 5 | 1 | 2 | 2 | 1 | 1 | 2 | 2 | 1 |

Aurigo's clear white space (score 5, competitors ≤ 2): TAMP, deterioration modeling, capital needs analysis, Plan → Build → Maintain continuity, federal-aid highway compliance. These are the pitch topics that Aurigo can defend head-to-head. Everything else is either parity or below.

---

## How to Win Against — Competitor Playbooks

### Playbook: IBM Maximo (Integrated)

**Position:** "Do not replace Maximo. Layer intelligence above it."
**Talk track:** "Your Maximo investment protects your work order continuity. Maintain protects your capital planning credibility. We integrate in 60 days and never touch your work orders."
**Proof required:** 90-day Maximo integration reference (available with 3 customers).
**Trap:** If IBM shifts the conversation to "Maximo Application Suite adds analytics," respond with the specific gap — Maximo has no deterioration engine, no TAMP module, no capital optimization. Show the report Maintain produces that Maximo cannot.
**Do not compete on:** Work order execution UX. That is Maximo's home ground.
**Close:** Fixed-fee 90-day PoC that outputs a signed TAMP-format report. If the customer likes it, expansion is automatic.

### Playbook: Oracle Unifier

**Position:** "Modern UX, integrated Maintain, half the implementation cost."
**Talk track:** "You are considering an Unifier upgrade — that is a $5–15M project with 18-month timeline. Aurigo delivers Plan + Build + Maintain for less and includes the asset intelligence you'll need for TAMP."
**Proof required:** Cost-of-ownership calculator with real Unifier customer testimony.
**Trap:** Oracle will pull Primavera P6 into the conversation. Response: Aurigo integrates with P6 natively — no data loss, no replacement required.
**Do not compete on:** Enterprise procurement relationships. Instead lead with a state DOT reference.
**Close:** Multi-year commitment with locked pricing; capitalize on customer's Unifier upgrade fatigue.

### Playbook: SAP PM

**Position:** "Keep SAP as system of record. Add capital intelligence with GIS."
**Talk track:** "SAP PM manages plant maintenance. It does not do condition-based capital planning with geographic context. Aurigo reads from SAP, produces the capital plan, feeds back to SAP Investment Programs."
**Proof required:** Live SAP PM integration reference in manufacturing.
**Trap:** SAP will offer S/4HANA Asset Intelligence Network add-on. Response: show the depth of Aurigo's deterioration modeling vs. AIN's high-level dashboards.
**Do not compete on:** SAP-native procurement or financials.
**Close:** Value-based ROI tied to downtime reduction, priced against the plant's OEE gap.

### Playbook: Cityworks

**Position:** "Cityworks is your work order system. Aurigo is your capital planning system."
**Talk track:** "You have great mobile and work order management. What is your TAMP? What is your 10-year capital forecast? Show me your deterioration model."
**Proof required:** Esri feature service integration reference; ArcGIS + Aurigo joint demo.
**Trap:** If Trimble announces Cityworks "capital planning module," accelerate — Aurigo has 3 years of head start on the intelligence layer.
**Do not compete on:** Esri geodatabase depth or work order execution.
**Close:** Position Aurigo Maintain as an ArcGIS-adjacent, not ArcGIS-replacement, choice. Reference Esri partner status.

### Playbook: Kahua

**Position:** "Kahua is a good capital program tool. Aurigo is a capital program + asset lifecycle platform."
**Talk track:** "For Plan and Build only, Kahua is a viable choice. But when you get to TAMP and 10-year asset planning, Kahua stops. Aurigo continues."
**Proof required:** Head-to-head Maintain demo against Kahua's roadmap. Show the depth of TAMP, RUL, and AI capital optimization.
**Trap:** Kahua's UX is genuinely modern. Do not compete on shiny UI alone — go to the intelligence layer immediately.
**Do not compete on:** Time-to-first-value on Plan-only deals. Kahua can install fast if the customer only wants program management.
**Close:** Lifecycle case study — a customer that went from Kahua to Aurigo because Maintain was needed.

### Playbook: Procore

**Position:** "Procore is a construction tool. Aurigo is a lifecycle platform."
**Talk track:** "Your construction teams love Procore. Keep it. Aurigo runs above Procore — capital program management for the CIP office and asset lifecycle for the maintenance organization."
**Proof required:** Procore integration reference where Procore continues to run construction and Aurigo runs the program.
**Trap:** Do not fight Procore on construction execution UX. Procore has invested more here than anyone.
**Close:** Coexistence, not replacement. Sell to the CIP office; ignore the construction team's Procore commitment.

### Playbook: In-house build ("we'll build it ourselves")

**Position:** "You are not a software company. Every year in-house is a year not compliant."
**Talk track:** "Show me your 20-year backlog of federal-aid workflows. Show me your TAMP template library. Show me your AI training data."
**Proof required:** ROI calculator showing 3-year total cost of in-house vs. Aurigo including opportunity cost.
**Trap:** Some large agencies genuinely have the IT capacity. Do not dismiss — offer a "co-build" alternative where Aurigo provides the platform and the customer's team owns customization.
**Close:** Ask for the CIO to review the total cost. In-house builds almost always fail at the "sustain" phase.

---

## Threat Radar — Emerging Competitors to Watch

Updated quarterly by the competitive intelligence function.

| Competitor | Stage | Threat vector | Time horizon | Aurigo action |
|-----------|-------|---------------|--------------|---------------|
| Palantir Foundry (Ontology for infrastructure) | Deployed at 3 state DOTs | Data platform positioning at exec level | 12–18 months | Differentiate on domain workflows, not just data |
| RoadBotics / RoadWay AI | Series B | Automated pavement rating from vehicle-mounted cameras | 6–12 months | Integrate as an inspection source, not compete |
| CivicPlus + AI add-ons | Public sector native | Bundles with municipal ERP | 18–24 months | Federal compliance depth as differentiator |
| Autodesk Construction Cloud + Tandem | Deployed | Digital twin positioning | 24–36 months | Emphasize operational asset intelligence, not just visualization |
| Startup XYZ (Y Combinator W25) | Seed | LLM-first CMMS with cheap onboarding | 18–24 months | Monitor; likely irrelevant in enterprise but watch mid-market |

---

*Next: [07 — Success Metrics](07-success-metrics.md)*
