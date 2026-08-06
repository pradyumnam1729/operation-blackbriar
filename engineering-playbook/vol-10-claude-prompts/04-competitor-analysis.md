# 04 — Competitor Analysis Prompt

Use these prompts to produce a structured analysis of a competitor to Aurigo's Maintain product. Competitor analysis informs product roadmap, sales positioning, and feature prioritization.

---

## When to Use

- Before a sales engagement where a specific competitor is in the deal.
- During product roadmap review to identify capability gaps or differentiators.
- When a competitor announces a new feature or acquisition.
- Quarterly competitive intelligence refresh.

## How to Use the Output

Save the output to `vault/competitors/[COMPETITOR_NAME]-YYYY-MM.md`. Reference it in product roadmap discussions and sales enablement materials.

---

## Generic Competitor Analysis Prompt

Replace `[COMPETITOR_NAME]`, `[COMPETITOR_WEBSITE]`, and `[COMPETITOR_PRODUCT_NAME]`. Paste the full prompt:

---

You are performing a competitive analysis for Aurigo's product team. The competitor is `[COMPETITOR_NAME]` and their relevant product is `[COMPETITOR_PRODUCT_NAME]`. Their website is `[COMPETITOR_WEBSITE]`.

**Context on Aurigo Maintain:**
Aurigo Maintain is an Asset-Based Capital Planning platform — a System of Intelligence that sits above existing EAM systems (it reads asset data from EAM, adds condition tracking, deterioration modeling, RUL calculation, ARV tracking, risk scoring, and capital needs prioritization). It does NOT replace EAM systems; it integrates with them.

Aurigo serves two market segments:
- **Masterworks**: Public-sector agencies (US DOTs, cities, counties) that own civil infrastructure. Primary output: TAMP and capital budget justification.
- **Primus**: Private-sector owners (manufacturing, data centers, utilities, airports, life sciences). Primary output: CapEx planning and operational risk management.

Aurigo's integration model has three tiers:
- **Integrated**: Deep EAM integration — Aurigo reads and writes to the customer's existing EAM
- **Hybrid**: Aurigo manages some asset data directly, syncs key fields with EAM
- **Native**: Aurigo is the system of record — used when customer has no EAM or is replacing it

**Research the competitor and answer these questions:**

### 1. Product Capabilities
- What asset types does the product manage?
- Does it do condition assessment / inspection management?
- Does it calculate or estimate Remaining Useful Life?
- Does it calculate or estimate Asset Replacement Value?
- Does it do risk scoring?
- Does it do capital needs prioritization?
- Does it produce or support TAMP / CapEx planning documents?
- Does it have AI / ML features? What specifically?
- What is the UI like? Web-based? Mobile app?
- What reporting and analytics capabilities does it have?

### 2. Pricing and Business Model
- How is it priced? Per asset? Per user? Per module? Enterprise subscription?
- Is it cloud-only, on-premise, or hybrid?
- What is the typical implementation cost and timeline?
- Is it sold directly or through partners/resellers?

### 3. Target Customer
- What industries do they target?
- What size of organization do they target?
- Are they primarily public sector, private sector, or both?
- What are their named reference customers?

### 4. EAM Integration Strategy
- Do they integrate with existing EAM systems? Which ones?
- Is their integration deep (bidirectional sync) or shallow (import/export)?
- Do they compete with EAM systems or position alongside them?
- How do they handle the "we already have Maximo" objection?

### 5. AI and Intelligence Features
- What AI features do they offer?
- Are these AI features additive intelligence or workflow automation?
- Do they use ML for deterioration prediction, anomaly detection, or risk scoring?
- How do they describe these AI features to customers?

### 6. Differentiators vs. Aurigo
- What does this competitor do better than Aurigo today?
- What capabilities do they have that Aurigo does not?
- Where are they stronger in go-to-market (brand, partnerships, sales team)?

### 7. Weaknesses Aurigo Can Exploit
- Where is this competitor weak compared to Aurigo?
- What do their customers complain about? (Use G2, Capterra, Reddit, LinkedIn reviews if available)
- What is their Achilles heel in the capital planning domain specifically?
- Are there customer segments they serve poorly that Aurigo can capture?

### 8. Capital Planning Comparison
Create a side-by-side comparison table:

| Capability | Aurigo Maintain | [COMPETITOR_NAME] | Notes |
|------------|----------------|-------------------|-------|
| Condition scoring (0-5 or similar) | Yes | ? | |
| Deterioration curve modeling | Yes | ? | |
| RUL calculation | Yes | ? | |
| ARV tracking | Yes | ? | |
| Risk scoring (LxC matrix) | Yes | ? | |
| Capital needs prioritization | Yes | ? | |
| TAMP / CapEx planning output | Yes | ? | |
| EAM integration | Yes (Integrated/Hybrid/Native) | ? | |
| AI-driven recommendations | Roadmap | ? | |
| GIS / spatial analysis | Yes (PostGIS) | ? | |
| Multi-tenancy / SaaS | Yes | ? | |

### 9. Customer Segment Overlap
- Which customer segments does this competitor serve that Aurigo also targets? (High overlap)
- Which customer segments does this competitor serve that Aurigo does NOT yet target? (Gap opportunity)
- Which customer segments does Aurigo serve that this competitor ignores? (Aurigo advantage)

### 10. Recommendation
Given this analysis: in a competitive deal, what are Aurigo's top 3 talking points against this competitor? What are the 3 things we should NOT lead with (areas where we are weaker)?

---

## IBM Maximo Analysis Variant

Use when Maximo comes up in a deal or product discussion. Paste this prompt:

---

You are analyzing IBM Maximo (specifically IBM Maximo Application Suite, MAS) as a competitor to Aurigo Maintain.

**Important framing:** Maximo is primarily an EAM system. Aurigo Maintain is a System of Intelligence that sits ABOVE EAM systems. In many deals, the question is not "Maximo vs. Aurigo" but "customer already has Maximo — does Aurigo add value on top of it, or does Maximo already do capital planning?"

Focus the analysis specifically on Maximo's capital planning capabilities:
- IBM Maximo Manage (the core EAM)
- IBM Maximo Monitor (AI-powered anomaly detection)
- IBM Maximo Visual Inspection (AI image analysis for condition assessment)
- IBM Maximo Predict (predictive maintenance / RUL)
- IBM Maximo Health (asset health scoring and investment planning)

Answer all 10 questions from the generic prompt above, with particular emphasis on:

**Capital Planning Gap Analysis:** Does Maximo Health provide TAMP-quality capital planning for public agencies? What are the gaps? Does it handle multi-asset portfolio prioritization across asset types (roads, bridges, signs) in a single view?

**The Co-existence Play:** If a public DOT has Maximo as their EAM, what is the sales argument for also buying Aurigo Maintain? What value does Aurigo add that Maximo Health does not provide?

**The Replacement Risk:** In what scenarios might a customer choose to use Maximo Health instead of Aurigo? What is Aurigo's defense against this?

---

## Oracle Primavera Analysis Variant

Use when Oracle Primavera (P6, Unifier, or Capital Program Management) is mentioned. Paste this prompt:

---

You are analyzing Oracle's asset and capital management products as a competitor to Aurigo Maintain.

Oracle's relevant products in this space:
- **Oracle Primavera P6**: Project and portfolio scheduling
- **Oracle Primavera Unifier**: Capital program management, project controls
- **Oracle Primavera Capital Program Management (CPM)**: Asset lifecycle and capital planning
- **Oracle Utilities Asset Management (OUAM)**: Utility-specific EAM
- **Oracle Fusion Maintenance**: Asset maintenance in Oracle Cloud

Focus the analysis on Oracle Primavera CPM and its capital planning capabilities, since this is the most direct competitor to Aurigo Maintain in the public-sector capital planning space.

Answer all 10 questions from the generic prompt. Additionally address:

**Oracle's Ecosystem Lock-in:** How does Oracle position Primavera CPM as part of the broader Oracle ecosystem? How does this affect a deal where the customer already uses Oracle financials?

**The Platform Play:** Oracle positions its products as a unified platform. How does Aurigo counter the "we want one vendor" objection from a customer considering Oracle?

**Public Sector Penetration:** Oracle has strong penetration in large public agencies. What is Aurigo's strategy to win in accounts that have Oracle Primavera?

---

## e-Builder Analysis Variant

Use when Trimble / e-Builder is mentioned. Paste this prompt:

---

You are analyzing e-Builder (now Trimble ProjectSight / Trimble Construction Management) as a competitor to Aurigo Maintain.

e-Builder is primarily a construction project management and capital program management platform. It is NOT an EAM system. In public agency deals, e-Builder often manages the construction execution of capital projects — meaning Aurigo Maintain (which identifies which assets need capital investment) and e-Builder (which manages the resulting construction projects) could potentially be complementary rather than competing.

Answer all 10 questions from the generic prompt, with emphasis on:

**The Handoff Point:** Where does Aurigo's scope end and e-Builder's scope begin? Aurigo creates a Capital Need. Does e-Builder pick up from there? Is there a natural integration point?

**Deal Scenarios:** In which deals does e-Builder compete directly with Aurigo? In which deals are they complementary?

**Trimble's Broader Strategy:** Trimble has been acquiring construction tech aggressively. What is their asset management strategy? Do they have a deterioration/RUL product?

---

## Infor EAM Analysis Variant

Use when Infor (CloudSuite, EAM, or FSM) is mentioned in a private-sector deal. Paste this prompt:

---

You are analyzing Infor EAM (specifically Infor Enterprise Asset Management, part of Infor CloudSuite) as a competitor to Aurigo Maintain, specifically in the Primus (private-sector) context.

Infor EAM is an EAM system commonly used in manufacturing, utilities, and process industries. Like IBM Maximo, it is primarily an EAM system, not a capital planning system.

Answer all 10 questions from the generic prompt, with emphasis on:

**Private Sector Capital Planning:** Does Infor EAM have CapEx planning and capital prioritization features? How sophisticated are they compared to Aurigo Maintain's RUL, ARV, and risk scoring?

**Infor Industries:** Infor is known for deep industry-specific functionality. How does this compare to Aurigo Primus's industry support?

**The Integration Opportunity:** In a manufacturing plant that runs Infor EAM, what is the integration story for Aurigo Primus? Can Aurigo read asset and maintenance data from Infor EAM to power its capital planning calculations?

---
