# TAMP — Transportation Asset Management Plans

> Volume 2 · Product Knowledge · Domain  
> Research basis: 9 state DOT TAMPs analyzed July 2026 (NY, FL, PA, NC, MI, VA, OH, CA draft, TX)  
> States: NYSDOT 2022, FDOT (active), PennDOT 2023, Caltrans 2026 draft, TxDOT 2022, NCDOT, MDOT, VDOT, ODOT  
> Status: **Product gap and feature discovery — committee review**

---

## What Is a TAMP and Why It Matters for Aurigo

A **Transportation Asset Management Plan (TAMP)** is a federally mandated strategic document (23 CFR Part 515) that every state DOT receiving NHPP (National Highway Performance Program) funds must produce on a 4-year cycle. It is submitted to FHWA for review, and FHWA issues a consistency determination by **July 31 each year**. Non-compliant TAMPs result in a **10% withholding of NHPP apportionments** — this is an eight- to nine-figure annual penalty for most states.

The TAMP is the primary annual forcing function for capital planning at every US state DOT. It is the single document that links asset condition data → lifecycle analysis → capital needs → investment programs (STIP/TIP) → performance targets. It is not a "report" — it is the governing plan.

**Why this is Aurigo's market entry point:** State DOTs produce TAMPs using a fragmented set of tools (BrM, AASHTOWare, spreadsheets, custom SQL extracts) and no single system covers the full lifecycle. Any vendor that can reduce TAMP assembly time and improve defensibility of the capital need numbers wins multi-year contracts.

---

## 10 Critical Realities from State DOT TAMP Analysis

### 1. Every State Operates Under a Structural Funding Deficit

TAMP financial plans universally show a gap between "needs" and "available funding." This is not a political statement — it is the documented output of lifecycle analysis. The capital need is calculated from deterioration models + treatment costs; the available budget comes from legislative appropriations. The gap is the forcing function for investment strategy decisions.

- NY: $18.9B capital program 2020–2024; still prioritizing condition over capacity expansion
- FL: pavement NHS 79% Good, 17% Fair, 4% Poor; bridges 96%+ structurally sufficient — the floor is the FHWA national minimum
- PA: 75 separate entities own NHS pavement; complex multi-owner plan assembly
- TX: $85.1B 10-year Unified Transportation Program; pavement target ≥55% Good IRI
- CA 2026 draft: identifies local agency data gaps as the #1 assembly challenge

**Committee implication:** The TAMP does not exist to show a DOT is in good shape. It exists to document the gap and justify the investment ask. Aurigo's capital needs module must produce a documented, defensible gap — not a dashboard that reports current condition.

---

### 2. NHS Assets Are NOT All Owned by the State DOT

This is the largest unresolved data problem in TAMP production.

- Pennsylvania: 75 separate entities own NHS pavement (counties, cities, turnpike authority)
- California: 12,000+ lane-miles of Southern California NHS owned by individual cities and counties (not Caltrans)
- Texas: MPOs and local agencies own significant NHS lane-miles; data submission to TxDOT is manual
- North Carolina: statewide ownership (unusual — NC DOT maintains most local roads), simpler case

Every multi-owner NHS state must collect condition data from local agencies, validate it, and integrate it into the TAMP. This is done today via email, spreadsheet submissions, and manual QA — no automated pipeline exists in the market.

**Committee implication:** Multi-owner data collection is an unsolved problem worth $2–5M per state in consulting fees. A portal-based solution is a direct product opportunity.

---

### 3. Climate / Extreme Weather Resilience Is Now Federally Required

The Bipartisan Infrastructure Law (BIL) explicitly requires TAMP lifecycle plans and risk registers to address extreme weather and climate resilience. FHWA issued updated guidance making this a consistency determination criterion in 2024.

- VDOT 2022 TAMP was initially returned by FHWA — one cited reason was insufficient extreme weather integration in the risk section
- Every 2025+ TAMP draft now includes a dedicated resilience chapter
- 23 CFR Part 667 (new): assets repaired twice due to emergency events require root-cause analysis + alternatives assessment — this is a new compliance tracking requirement
- CA 2026 draft: climate vulnerability assessment integrated into pavement lifecycle scenarios

**Committee implication:** Climate/resilience is not a feature request from one state. It is a federal mandate driving every TAMP renewal in 2026 and beyond. Any TAMP module that does not include a weather/climate risk register chapter will fail FHWA review.

---

### 4. Every State Uses 3–5 Disconnected Tools to Produce One TAMP

The current state of TAMP production in every state reviewed:

| State | Bridge Management | Pavement Management | Other | Assembly |
|---|---|---|---|---|
| NY | BrM (AASHTOWare) | Custom PMS | Asset valuation system | Excel + Word |
| FL | BrM | FDOT PLAT (Excel-based) | GIS extract | Manual compilation |
| PA | BrM | AASHTOWare PM | 75 agency feeds | Consultant-driven |
| TX | BrM | Pavement Analyst (SaaS) | STIP/TIP system | Custom SQL extract |
| CA | BrM (in migration) | Various | Local agency portal (planned) | Consultant |
| NC | BrM | Deighton dTIMS | HPMS extract | Internal |
| MI | BrM | RQFS/PCFS/BCFS (custom) | Asset database | Annual update cycle |
| VA | BrM | Commercial PMS | Risk register (manual) | Consultant |
| OH | BrM | Commercial PMS | Lifecycle modeling | Internal staff |

No state uses a single system for TAMP. Every state spends significant staff time assembling, reconciling, and formatting data from multiple source systems. This is the addressable workflow pain.

**Committee implication:** Aurigo does not need to replace BrM or the pavement management systems. It needs to be the integration hub and capital planning engine that consumes data from those systems and produces TAMP outputs.

---

### 5. The 4-Year TAMP Cycle Has an Annual Compliance Checkpoint

The TAMP is not a one-time deliverable. The structure is:

- **Year 0:** Full TAMP produced and submitted
- **Year 1:** Annual consistency determination (July 31 deadline) — does current investment still align with TAMP goals?
- **Year 2:** Mid-cycle review — update financial plan if STIP revised
- **Year 3:** Annual consistency determination
- **Year 4:** Full TAMP update cycle begins

The July 31 annual consistency determination is a **recurring annual event** for every state DOT. Missing it triggers the 10% NHPP penalty. This creates a recurring annual revenue trigger — not a one-time implementation sale.

**Committee implication:** Aurigo's TAMP module should be priced as an annual subscription with a recurring "consistency determination package" that is triggered each spring/summer. The product should generate the consistency determination letter output automatically.

---

### 6. Performance Scenario Analysis Is the Core Deliverable

The TAMP does not simply report current condition. Its core requirement is **investment scenario analysis**: what happens to pavement and bridge condition under different funding levels over 10 years?

Required outputs per 23 CFR 515:
- Asset condition projections under "current funding" scenario
- Asset condition projections under "minimum condition" scenario (what does it cost to hold the FHWA minimums?)
- Asset condition projections under "target condition" scenario
- Capital need differential between scenarios
- Investment strategy narrative explaining the selected approach

FHWA reviewers read the narrative text and evaluate whether the investment strategy is defensible based on the scenario analysis. VDOT's TAMP was returned partly because the scenario narrative was not sufficiently tied to the quantitative analysis.

**Committee implication:** The LCP (Lifecycle Planning) module already exists in Aurigo. The TAMP module is not a separate product — it is a structured output layer on top of LCP scenarios. The LCP engine feeds the TAMP; the TAMP module formats and publishes the required chapters.

---

### 7. District / Regional Disaggregation Is Required for Implementation

Every state DOT is organized into districts or regions, and TAMP capital needs must be traceable to district-level programs. The state-level TAMP sets targets; districts implement via STIP/TIP project lists.

- TX: 25 TxDOT districts each manage their own STIP projects; unified TUP aggregates up
- NY: Regions; capital program is allocated by region
- FL: Districts; FDOT PLAT tool runs district-by-district
- CA: Caltrans districts 1–12; Southern California is the data gap problem

**Committee implication:** Multi-tenant architecture must support district/region as a sub-tenant tier below state DOT. A single Caltrans implementation needs to support 12 district views aggregating to a statewide TAMP.

---

### 8. 23 CFR Part 667 Creates a New Repetitive Damage Tracking Requirement

Effective 2024, FHWA requires states to track and report on assets that have been repaired twice or more due to emergency events (storm damage, flooding, landslides). For any such asset, states must conduct:
- Root-cause analysis
- Alternatives assessment (is repair still the right treatment?)
- Documentation of why treatment was selected

This is a new data element that no existing BMS/PMS tool tracks natively. It requires linking emergency repair records to the asset lifecycle, tagging repetitive emergency events, and generating the alternatives assessment documentation.

**Committee implication:** This is a differentiated capability — no competitor has it. A "repetitive emergency event" tracker tied to the asset record and lifecycle plan directly satisfies 23 CFR Part 667 with an audit trail FHWA can verify.

---

### 9. Asset Valuation Is a Required TAMP Chapter

Every TAMP must include an **asset inventory and valuation chapter** showing the current replacement value of the NHS asset portfolio. This is not financial accounting — it is an infrastructure economics calculation:

- Total Replacement Cost (TRC) = current inventory × unit replacement cost per asset class
- Backlog = the cost to bring all assets to a state of good repair

FHWA does not prescribe a single methodology, but requires it to be documented and consistent across TAMP cycles.

States currently compute this in Excel (FDOT), custom systems (NYSDOT), or consultant models. No commercially available tool produces this automatically from the asset database.

**Committee implication:** Aurigo's ARV (Asset Replacement Value) module directly satisfies the asset valuation chapter requirement. This is a differentiator that should be called out explicitly in sales collateral. No other vendor in the market has a purpose-built ARV module tied to an asset database.

---

### 10. FHWA Reviewers Read the Narrative — Tone and Defensibility Matter

FHWA's consistency determination process includes human review of the TAMP document text, not just data validation. The VDOT 2022 experience confirms: a technically correct TAMP with a poorly written investment strategy narrative was returned for revision.

Key defensibility requirements:
- Investment strategy must explicitly cite the scenario analysis results
- Methodology section must explain deterioration models used
- Financial plan must explain the funding gap and how it was addressed
- Limitations and assumptions must be documented

**Committee implication:** The TAMP module needs a structured document authoring capability — not just data export. Chapter templates, narrative prompts, and review checklists are part of the product.

---

## 10 Product Opportunities — Grounded in TAMP Evidence

### Opportunity 1: Multi-Owner NHS Data Portal
**Evidence:** PA (75 entities), CA (300+ local agencies), TX (MPO/local agencies)  
**Current state:** Email, spreadsheets, manual QA — no automated pipeline exists in the market  
**Product:** A lightweight portal for local agencies to submit pavement/bridge condition data; DOT validates, integrates into TAMP inventory  
**Differentiation:** No competitor has this. It directly solves the #1 data assembly problem in every multi-owner NHS state.  
**Revenue model:** Per-state implementation + per-agency seat license for the local portal tier  

---

### Opportunity 2: Climate / Extreme Weather Risk Integration
**Evidence:** BIL mandate; VDOT TAMP returned by FHWA; CA 2026 draft climate chapter  
**Current state:** Risk registers built in Excel or Word; no integration with asset condition data  
**Product:** Climate vulnerability layer integrated with asset inventory — flood zone overlay, extreme heat pavement impact, hurricane/wind zone bridge criticality; feeds into TAMP risk chapter with FHWA-required narrative  
**Differentiation:** Brightly has no TAMP. Cartegraph has no climate layer. Trimble Unity Maintain does not have TAMP-formatted risk output.  
**Revenue model:** Included in TAMP module; GIS data subscription for hazard layers  

---

### Opportunity 3: Annual Consistency Determination Automation
**Evidence:** Every state; July 31 FHWA deadline; 10% NHPP penalty  
**Current state:** Manual process; staffed by consultants (often 2–4 weeks of consultant time per state)  
**Product:** Automated consistency check — compares current STIP investment to TAMP performance targets; flags drift; generates consistency determination letter and supporting exhibits  
**Differentiation:** Pure recurring annual revenue trigger. No competitor in the market has automated this.  
**Revenue model:** Annual "TAMP Compliance Package" subscription; $50K–$150K per state per year  

---

### Opportunity 4: BrM / AASHTOWare Integration
**Evidence:** Every state uses BrM (AASHTOWare Bridge Management) as the bridge data system  
**Current state:** Manual bridge condition data export → import into capital planning tools  
**Product:** Direct BrM/AASHTOWare API integration — sync bridge inspection records, condition scores (NBI elements), and replacement cost data into Aurigo without manual export/import  
**Differentiation:** Eliminates the #1 manual step in TAMP bridge chapter assembly. No other commercial capital planning tool has a live BrM integration.  
**Revenue model:** Integration module; reduces consultant time by 2–3 weeks per TAMP cycle  

---

### Opportunity 5: Treatment Cost Library with Regional Calibration
**Evidence:** TX Pavement Analyst, FDOT PLAT, MDOT models — all use different unit cost assumptions  
**Current state:** Each state maintains a separate cost library in its PMS tool or Excel; not linked to capital plan  
**Product:** A treatment cost library with state/district/region calibration — mill-and-overlay, bridge deck rehabilitation, full replacement costs by asset class and region; feeds directly into lifecycle cost analysis and capital needs  
**Differentiation:** This is the primary input to TAMP capital needs scenarios. Getting costs right is what makes the scenario analysis defensible to FHWA.  
**Revenue model:** Bundled with TAMP module; annual update subscription for unit cost benchmarks  

---

### Opportunity 6: District / Region Sub-Tenant Views
**Evidence:** TX (25 districts), CA (12 districts), NY (regions), FL (districts)  
**Current state:** State-level systems; district reporting is manual extraction  
**Product:** Sub-tenant hierarchy: State DOT → Districts → (optionally) Local Agencies; each district sees its own assets, capital needs, and STIP projects; state aggregates across districts; TAMP is produced at the state level from district inputs  
**Differentiation:** Multi-tenancy already exists in Aurigo architecture (tenant_id on all aggregates). District-level is a configuration extension, not a rewrite.  
**Revenue model:** Per-district seat licensing above the state contract  

---

### Opportunity 7: HPMS Export Module
**Evidence:** Every state; HPMS (Highway Performance Monitoring System) is the federal highway inventory and condition database  
**Current state:** State PMS systems export HPMS-formatted flat files annually; this is done with custom SQL scripts or vendor tools  
**Product:** HPMS export generator — from Aurigo pavement asset database, generate the HPMS-formatted submission file directly, with field mapping, validation rules, and submission tracking  
**Differentiation:** Eliminates a time-consuming annual compliance step. Required by FHWA separately from the TAMP. States spend 2–4 weeks on HPMS submission each year.  
**Revenue model:** Included in base pavement module or as a compliance add-on  

---

### Opportunity 8: Supplementary Asset Classes
**Evidence:** CA 2026 draft includes drainage, Transportation Management Systems (TMS), bike/ped, and lighting asset classes in the lifecycle plan; this is an emerging pattern other states will follow  
**Current state:** Aurigo currently covers pavements, bridges, and generic infrastructure assets. Drainage, signals, lighting, and TMS require their own condition scales, lifecycle models, and treatment libraries.  
**Product:** Extend asset class library to include drainage structures, traffic signals, roadway lighting, TMS (variable message signs, cameras, sensors), and bike/ped infrastructure; each with condition rating scale, deterioration model, and treatment cost library  
**Differentiation:** CA leading the national trend; FHWA is signaling it will expand NHS TAMP scope to include TMS and active transportation. First to market on supplementary classes wins CA and future mandates.  
**Revenue model:** Per-asset-class module licensing  

---

### Opportunity 9: MPO / TIP Integration and Performance Agreement Tracking
**Evidence:** Every state; MPOs program STIP funds; performance agreements between FHWA, state DOTs, and MPOs (23 CFR 450.314)  
**Current state:** Performance agreement tracking done in separate spreadsheets; no link between TAMP targets and TIP project selection  
**Product:** MPO integration layer — import TIP project lists, track STIP/TIP programming against TAMP-identified capital needs, flag performance agreement targets vs. programmed investment; produces the STIP-TAMP consistency documentation  
**Differentiation:** Closes the gap between capital planning (TAMP) and project programming (STIP/TIP) — a gap every DOT consultant identifies as their biggest pain  
**Revenue model:** MPO portal tier; per-MPO licensing  

---

### Opportunity 10: TAMP Amendment Workflow
**Evidence:** All TAMPs; STIP amendments are common (projects added, deleted, delayed); each STIP amendment that affects NHS asset categories triggers a TAMP consistency review  
**Current state:** TAMP amendments are tracked in email threads and Word documents; no audit trail  
**Product:** Amendment workflow — when a STIP project affecting NHS assets is added/changed/removed, the system flags the TAMP impact, routes for review, and generates the amendment documentation and FHWA notification  
**Differentiation:** No one has automated this. It directly eliminates the July 31 consistency determination panic that consultants exploit for emergency billings.  
**Revenue model:** Part of annual TAMP compliance subscription  

---

## Gap Analysis: Current Aurigo Coverage vs. TAMP Requirements

| TAMP Requirement | Federal Basis | Aurigo Current | Gap | Priority |
|---|---|---|---|---|
| Asset Inventory (NHS pavements + bridges) | 23 CFR 515.7 | Exists (Asset module) | None for basic inventory | — |
| Asset Valuation / Total Replacement Cost | 23 CFR 515.9 | ARV module | Needs TAMP chapter output format | Medium |
| Condition Assessment (IRI, NBI) | 23 CFR 490 | Condition recording | Add NBI scale + IRI import | High |
| Lifecycle Planning with Scenarios | 23 CFR 515.9(b) | LCP module | Add TAMP scenario export format | High |
| Capital Needs (10-year, by asset class) | 23 CFR 515.9(c) | LCP capital needs | Add TAMP chapter format + narrative prompts | High |
| Investment Strategy + Narrative | 23 CFR 515.9(d) | None | Full gap — need document authoring | Critical |
| Risk Register with Extreme Weather | 23 CFR 515.9(e) + BIL | Risk module (basic) | Add climate layer + BIL-mandated elements | Critical |
| Financial Plan with Funding Sources | 23 CFR 515.9(f) | None | Full gap — need financial plan module | High |
| Annual Consistency Determination | 23 CFR 515.17 | None | Full gap — new product capability needed | Critical |
| STIP/TIP Integration | 23 CFR 450.314 | None | Integration gap | Medium |
| HPMS Export | 23 CFR 490 | None | Export module needed | Medium |
| 23 CFR Part 667 (repetitive damage) | 23 CFR 667 | None | New tracking requirement | Medium |
| Multi-Owner NHS Data Collection | 23 CFR 515.7 | None | Portal product gap | High |
| District / Region Disaggregation | State implementation | Single-tenant only | Sub-tenant tier needed | High |
| BrM / AASHTOWare Integration | AASHTO standard | None (stub) | Real integration needed | High |

---

## Priority Roadmap for TAMP Feature Development

### Sprint 1–2: Foundation (Ship to first state DOT pilot)

1. **NBI / IRI Condition Scale Import** — Extend condition recording to support NBI element ratings (AASHTOWare format) and IRI pavement roughness data. Required for FHWA performance measures.

2. **TAMP Scenario Output Format** — Add export layer to LCP module that generates TAMP-compliant performance scenario tables (Good/Fair/Poor percentages by year × scenario).

3. **ARV → Asset Valuation Chapter** — Add TAMP chapter output to ARV module: Total Replacement Cost by asset class + backlog calculation.

4. **Treatment Cost Library v1** — State-configurable treatment cost library with pavement and bridge treatments; feeds LCP capital needs calculation.

5. **Annual Consistency Determination Package v1** — Automated comparison of current STIP investment to TAMP performance targets; generates consistency summary letter and supporting exhibits.

### Sprint 3–4: Compliance Completeness

6. **Climate / Extreme Weather Risk Layer** — GIS-based climate vulnerability overlay (flood zones, extreme heat, hurricane zones) integrated with asset records; populates risk register with BIL-required elements.

7. **District / Region Sub-Tenant Tier** — Configuration extension to support district/region hierarchy below state DOT tenant.

8. **HPMS Export Module** — Generate HPMS-formatted flat file from Aurigo pavement inventory; validation rules per FHWA HPMS Field Manual.

9. **Financial Plan Module v1** — Structured financial plan input: funding sources (NHPP, STP, state match, local), multi-year allocation by asset class; produces financial plan chapter content.

10. **Investment Strategy Document Authoring** — TAMP chapter template with narrative prompts; links quantitative scenario output to human-authored strategy text; export to FHWA submission format.

### Medium-Term: Market Expansion

11. **Multi-Owner NHS Portal** — Lightweight portal for local agencies to submit condition data; DOT validates and integrates; addresses PA/CA/TX data assembly problem.

12. **BrM / AASHTOWare Real Integration** — Replace stub with live API integration to AASHTOWare Bridge Management (or BrM web service); pull inspection records and NBI scores directly.

13. **Supplementary Asset Classes** — Drainage, TMS, bike/ped, lighting condition scales and lifecycle models.

14. **MPO / TIP Integration** — Import TIP project lists; track STIP programming against TAMP capital needs; produce STIP-TAMP consistency documentation.

15. **23 CFR Part 667 Repetitive Damage Tracker** — Flag assets with 2+ emergency repair events; generate root-cause analysis and alternatives assessment workflow.

---

## Key Competitors and TAMP Capability

| Vendor | TAMP Output | Capital Scenario | Multi-Owner | Climate/BIL | Consistency Det. |
|---|---|---|---|---|---|
| **Aurigo Maintain** (current) | None | LCP scenarios exist | None | Basic risk | None |
| **AgileAssets / Trimble** | Partial | Yes | None | None | None |
| **HNTB / WSP / Stantec** | Full (consulting) | Yes (consulting) | Manual | Manual | Manual |
| **IBM Maximo AIP** | None | Basic budgeting | None | None | None |
| **Cartegraph** | None | None | None | None | None |
| **AtomAI** | None | None | None | None | None |
| **Brightly Predictor** | None | Yes | None | None | None |

The primary competition for TAMP production is **consulting firms (HNTB, WSP, Stantec, AECOM)** — not software vendors. Every state DOT pays $500K–$3M per TAMP cycle to consultants for assembly, lifecycle modeling, and document production. This is the market Aurigo displaces.

AgileAssets (now Trimble Unity Maintain) is the only software vendor with partial TAMP output capability, and it is in a platform migration that has disrupted their state DOT customer relationships — creating a 12–18 month competitive window.

---

## Win Conditions

**To win a TAMP contract against consulting firms:**
- Must produce the FHWA-required chapter structure (not just data)
- Must integrate with BrM (every state uses it for bridges)
- Must support the annual consistency determination without additional consulting engagement
- Must handle the investment strategy narrative authoring

**To win against Trimble Unity Maintain:**
- Highlight the platform migration disruption (AgileAssets customers being forced to Trimble Unity Maintain)
- Lead with annual compliance certainty: TAMP + consistency determination is automated, not a consulting engagement
- Target states where Trimble is displacing AgileAssets customers mid-TAMP-cycle (2026–2027 window)

**To win against "we'll just use consultants again":**
- Total cost of ownership comparison: one TAMP cycle consulting engagement ($500K–$3M) vs. 4-year Aurigo subscription
- Institutional knowledge retention: when the consultant delivers the TAMP, the state loses the model; Aurigo keeps it live
- Speed: annual consistency determination in days, not weeks

---

---

## Critical Architecture Gap: The Cyclic Problem

> **VP Products raised this in July 2026 committee review.** The TAMP opportunities above assume the product can handle data cyclically — ingesting prior TAMP reports, carrying performance targets across cycles, calibrating deterioration models from historical data. The current architecture cannot do any of this.

A TAMP customer renewing for their second cycle will find that:
- Prior cycle performance targets are not stored — FHWA cannot see progress against commitments
- Historical inspection data (10–20 years in BrM/HPMS) is not ingested — Weibull models use national defaults, making capital needs projections wrong
- The first cycle's capital plan is overwritten when the new cycle begins — no audit trail, no carryforward backlog

Without cycle architecture, every TAMP Aurigo produces is a first-and-only TAMP. The product cannot generate repeat business.

**See [`historical-data-continuity.md`](historical-data-continuity.md) for the full committee analysis**, including the `PlanningCycle` data model, the historical data ingestion pipeline (BrM, HPMS, prior TAMP AI extraction), calibrated Weibull models, the Cycle Performance Report for FHWA consistency determination, and the sprint plan for both MVP additions and Beta delivery.

---

_Sources: 9 state DOT TAMP documents analyzed July 2026. See `docs/TAMP/` for source files. Cross-reference: `06-competitive-landscape.md` for Trimble/AgileAssets threat analysis. See `engineering-playbook/vol-8-roadmaps/01-mvp.md` and `02-beta.md` for sprint assignments including cycle architecture work._
