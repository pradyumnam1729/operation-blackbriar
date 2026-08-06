# 05 — Customers

---

## Overview

Understanding customers at the persona level — not just the organization type — is fundamental to building software that solves real problems. The personas in this document are composites built from customer discovery research, implementation experience, and ongoing customer engagement. They are not hypothetical archetypes. They represent the actual people who evaluate, buy, implement, and use Aurigo products every day.

Each persona is described with a job title and role, the organizational context they operate in, their primary pains and frustrations, the jobs they are hired to do (in the Clayton Christensen sense — the outcomes they are accountable for), how Aurigo helps them, and how they measure success. Engineers who understand these personas build features that matter. Engineers who do not build features that are technically correct but commercially irrelevant.

---

## Public Sector Personas

### Persona 1 — State DOT Asset Manager

**Title:** Asset Management Engineer, Senior Transportation Engineer, or Director of Asset Management  
**Organization:** State Department of Transportation, typically managing NHS assets in a state with $500M to $5B in annual capital investment

**Role:** This person is responsible for the Transportation Asset Management Plan — the federal requirement that dictates how the state tracks, conditions-assesses, and plans improvements for all NHS pavements and bridges. They own the relationship with FHWA's state-level division office. They are the internal champion for data standards, condition rating methodologies, and performance-based planning.

**Organizational context:** The Asset Management Engineer sits within the planning division of the DOT, distinct from the construction division and the maintenance division. They coordinate across all three divisions to aggregate condition data, but they own none of the field operations that generate that data. This means their biggest challenge is data quality and completeness — they are entirely dependent on other people's data collection, often delivered in inconsistent formats.

**Primary pains:**
- TAMP preparation takes 6 to 12 months of manual data aggregation from multiple systems (bridge inspection database, pavement management system, GIS, finance system). The output is a 200-page report that is outdated by the time it is published.
- Condition data from field inspections arrives in CSV files, spreadsheets, and paper forms. Standardizing this data is a recurring manual effort.
- The connection between the TAMP's capital needs analysis and the Statewide Transportation Improvement Program (STIP) is manual and error-prone. Assets that appear in the TAMP's 10-year needs forecast are not automatically linked to funded projects in the STIP.
- Federal performance measure reporting (NHPP pavement condition, bridge condition) requires aggregating data from multiple sources into specific FHWA report formats.
- When asked by the Secretary of Transportation "which bridges in our state are most at risk," the answer requires pulling data from three systems and building an ad-hoc spreadsheet.

**Jobs to be done:**
1. Produce a FHWA-compliant TAMP that passes the regulatory review and enables federal funding eligibility
2. Maintain a current, accurate inventory of all NHS assets with standardized condition ratings
3. Provide the data that justifies capital investment requests to the legislature and the Secretary
4. Satisfy NHPP performance measure reporting requirements on the federal schedule
5. Identify the highest-risk assets in the state network before they become failures

**How Aurigo helps:**
Masterworks Maintain consolidates condition data from all sources into a single asset registry. The TAMP module produces a compliant report from structured data — reducing 12 months of manual work to a continuous report that is always current. The capital needs analysis automatically generates the 10-year investment requirement from deterioration models. The integration with the capital program management system (Plan) means that funded projects are automatically connected to the assets they address.

**Success metrics:**
- Time to produce TAMP report: from 12 months to continuous (annual update in days)
- FHWA TAMP approval without conditions
- Percentage of NHS assets with current condition ratings
- Capital plan accuracy: projected need vs. actual program in subsequent years

---

### Persona 2 — County Engineer

**Title:** County Engineer, Director of Public Works, Road Commissioner  
**Organization:** County road department, typically managing 500 to 5,000 lane miles of local roads, bridges, drainage, and signs

**Role:** The County Engineer is often both the technical lead and the political interface for all county infrastructure. In a small county, this person might have a staff of five. In a large county, a staff of 50. In either case, they are responsible for everything: emergency road repairs, bridge inspections, culvert replacements, drainage maintenance, sign inventory, and the annual capital budget request to the county board of supervisors.

**Organizational context:** County engineers are time-constrained. They are managing daily operational decisions (which pothole crew goes where today) while simultaneously trying to build the long-term capital plan that justifies the county's budget request. They are often one person deep on technical expertise. When the senior bridge inspector retires, institutional knowledge walks out the door.

**Primary pains:**
- The 5-year capital plan is a spreadsheet that gets rebuilt every year from scratch. There is no institutional memory in the tool — just in the engineer's head.
- Bridge inspection reports are PDFs that sit in a file server. No system connects the inspection findings to the capital plan automatically.
- Federal bridge funding (Bridge Formula Program) requires data in specific FHWA formats. The county has to manually extract data from their inspection system and reformat it for federal reporting.
- Staff turnover is a constant threat to institutional knowledge. If the engineer who has managed the county's culvert database for 15 years leaves, no one knows the condition of the county's 800 culverts.
- Local elected officials demand politically viable answers to technically complex questions: "why do we need to replace the Route 7 bridge when the one on County Road 12 looks worse to me?"

**Jobs to be done:**
1. Produce an annual capital budget request that is defensible to the county board
2. Maintain federal eligibility by meeting NBIS inspection requirements on schedule
3. Ensure that the worst-condition assets are addressed before they fail catastrophically
4. Build institutional knowledge that survives staff turnover

**How Aurigo helps:**
Masterworks Maintain provides a simple, role-appropriate interface for condition recording, asset inventory, and capital needs analysis. The mobile inspection tool allows field staff to record inspection findings with photos, eliminating paper forms. The capital needs report automatically produces a ranked list of projects with cost estimates that the engineer can take directly to the board. The system stores condition history so that new staff inherits the institutional knowledge built by predecessors.

**Success metrics:**
- Percentage of bridges inspected on NBIS schedule
- Capital plan defensibility: ability to answer board questions with data
- Staff onboarding time for new hires
- Federal funding accessed through Bridge Formula Program

---

### Persona 3 — Transit Capital Program Director

**Title:** Director of Capital Programs, VP of Capital Delivery, Assistant GM for Capital  
**Organization:** Large urban transit agency, typically managing $500M to $5B in annual capital program

**Role:** The Capital Program Director is responsible for delivering capital projects on time and on budget — rail station renovations, fleet procurement, system-wide infrastructure upgrades. They manage a portfolio of hundreds of active projects, a program team of 20-100 people, and relationships with dozens of contractors and consultants.

**Primary pains:**
- The capital program is tracked in spreadsheets and PowerPoint presentations that are manually updated every month. Program-level visibility requires aggregating data from 50 separate project managers.
- When the FTA asks for program status, someone spends three days pulling data from project files. The response is always delayed and never quite complete.
- Change orders are managed via email. Commitments made verbally are not always captured in the system. Budget overruns are discovered late.
- When a project closes out, the asset data (equipment installed, configuration, commissioning test results) is filed in a project closeout folder that no one in the maintenance organization can find.
- Fleet and facility assets at end of life compete for the same capital budget as major rehabilitation projects. The director does not have a unified view of asset replacement needs vs. new project requests.

**How Aurigo helps:**
Masterworks Build provides the project delivery platform. Masterworks Maintain provides the asset lifecycle view that competes with new project requests for the same capital budget. The Build → Maintain handoff captures fleet and facility asset records at project closeout automatically.

---

### Persona 4 — City Public Works Director

**Title:** Director of Public Works, Commissioner of Public Works  
**Organization:** City government, typically managing roads, water/sewer, parks, facilities, and fleet

**Role:** The Public Works Director is a political appointee or senior career civil servant who reports to the Mayor or City Manager. They manage a department of hundreds to thousands of employees, a capital budget of $50M to $500M, and political accountability for the condition of all city infrastructure. Potholes are the most politically visible failure mode. Bridge closures are the most expensive.

**Primary pains:**
- Infrastructure condition data is fragmented across GIS, inspection databases, maintenance work order systems, and spreadsheets. No single view of the city's infrastructure health exists.
- The annual capital budget request is built by multiple division heads (roads, water, parks, facilities) who compete for funding. There is no objective scoring methodology that the director can point to as the basis for allocation decisions.
- When council members ask "what is the condition of our city's infrastructure," the honest answer is "we're not sure." The political consequence of that honest answer is severe.
- Deferred maintenance creates a backlog that grows faster than capital budgets. The director needs to quantify the deferred maintenance backlog to make the case for increased funding.

**How Aurigo helps:**
Masterworks Maintain provides the unified infrastructure health dashboard that the Director can show council and the Mayor. The deferred maintenance backlog report quantifies the cost of underfunding. The risk-based prioritization framework provides an objective basis for capital allocation decisions.

---

## Private Sector Personas

### Persona 5 — VP of Operations / Manufacturing

**Title:** VP of Operations, VP of Manufacturing, Plant Manager  
**Organization:** Mid-to-large manufacturing company, single plant ($50M to $500M revenue) or multi-plant ($500M to $5B)

**Role:** The VP of Operations owns production output, production cost, and production quality. They are P&L accountable. Every hour of unplanned downtime appears directly in their financial results. They are measured on OEE (Overall Equipment Effectiveness), on cost per unit, and on delivery performance.

**Primary pains:**
- Asset failures are unpredictable. The maintenance team operates reactively — fixing things when they break, not preventing breaks. The root cause is that no one knows the actual condition of critical production equipment with confidence.
- Capital planning for equipment replacement is based on informal judgment by the maintenance supervisor and gut feel for which machines are "getting old." There is no model.
- When the annual capital budget process begins, the maintenance team submits a list of "equipment that needs replacement" based on memory and intuition. Finance cuts the list by 30% because it is not defensible. Sometimes the wrong items are cut.
- Major overhaul projects are difficult to schedule because the impact on production is not clearly modeled. The result is deferred overhauls that increase the probability of in-production failures.

**Jobs to be done:**
1. Maximize OEE by minimizing unplanned downtime
2. Produce a defensible multi-year capital plan for equipment replacement
3. Optimize maintenance spend: neither over-maintaining nor under-maintaining
4. Ensure that capital investments are made at the right time (not too early, not too late)

**How Aurigo helps:**
Primus Maintain tracks equipment condition, maintenance history, and deterioration trends. The capital needs analysis produces a year-by-year equipment replacement schedule with cost estimates that the VP can take to the board. The AI deterioration model flags equipment approaching end of reliable life, enabling planned replacements before failures occur.

**Success metrics:**
- OEE improvement year-over-year
- Reduction in unplanned downtime events
- Capital plan accuracy: actual replacement spend vs. projected
- Maintenance cost per unit of output

---

### Persona 6 — Director of Critical Infrastructure / Data Center

**Title:** Director of Data Center Operations, VP of Critical Infrastructure, Chief Infrastructure Officer  
**Organization:** Enterprise data center operator, colocation provider, or hyperscale cloud provider

**Role:** This person owns the physical infrastructure that keeps the data center running: power, cooling, fire suppression, physical security. They are measured on uptime SLA compliance, PUE (Power Usage Effectiveness), and cost per kW of IT load. A single SLA breach is a contractual, financial, and reputational event.

**Primary pains:**
- The data center contains hundreds of capital assets — generators, UPS systems, CRAC units, PDUs, chillers, cooling towers, switchgear, ATS units, fire suppression systems, fuel tanks — each with different useful life, different maintenance schedules, and different criticality.
- No system provides a unified view of all assets, their condition, their age relative to design life, and their projected replacement timeline.
- Capital budget requests for equipment replacement are difficult to justify because the condition data does not exist in a form that finance can evaluate.
- Regulatory compliance — NFPA 110 for emergency power, ASHRAE for cooling, local fire marshal requirements — requires documented inspection and maintenance records for all critical systems.
- When a generator fails during a utility outage and the UPS cannot bridge the gap, the root cause is almost always: a known issue that was not prioritized for capital replacement because the decision was made informally.

**Jobs to be done:**
1. Maintain uptime SLA compliance (99.982% or better)
2. Produce a multi-year capital plan for all critical infrastructure assets
3. Manage regulatory compliance documentation for all critical systems
4. Optimize PUE through proactive cooling system management

**How Aurigo helps:**
Primus Maintain provides an asset registry for all data center critical infrastructure assets, with Weibull-based lifecycle models for mechanical systems and defined replacement cycles for electrical systems. The capital planning module produces a year-by-year replacement schedule. The compliance module tracks required inspection and maintenance documentation.

---

### Persona 7 — Chief Compliance Officer / Life Sciences

**Title:** VP of Quality Systems, Head of Compliance, Director of GMP Manufacturing  
**Organization:** Pharmaceutical manufacturer, biotech, medical device company

**Role:** This person is responsible for ensuring that all manufacturing equipment and systems are maintained in a qualified, validated state as required by FDA 21 CFR Part 11 and Good Manufacturing Practices (GMP). They own the Validation Master Plan, the Equipment Qualification program, and the periodic review process.

**Primary pains:**
- Equipment requalification after maintenance is poorly tracked. When a maintenance technician replaces a component on a qualified piece of equipment, the requalification requirement is triggered. This is often missed, creating FDA compliance risk.
- Capital planning does not account for qualification costs. A piece of equipment budgeted at $2M for replacement actually costs $3.5M when qualification is included. Capital plans that omit qualification costs lead to underfunded projects.
- The audit trail for qualified equipment is distributed across QMS (Quality Management System), CMMS (work order history), and calibration management systems. No single system provides a complete compliance picture for any given asset.

**Jobs to be done:**
1. Maintain a complete audit trail of all equipment qualification status and maintenance history
2. Ensure that capital plans include all costs (equipment + installation + validation)
3. Satisfy FDA audit requirements for equipment qualification and maintenance records

**How Aurigo helps:**
Primus Maintain integrates with existing QMS and CMMS systems to provide the complete audit trail. The capital planning module includes qualification cost templates for pharmaceutical equipment classes. The compliance dashboard shows qualification status by equipment, flagging assets with outstanding requalification requirements.

---

### Persona 8 — Asset Integrity Manager / Energy

**Title:** Asset Integrity Manager, Director of Operational Integrity, VP of Engineering  
**Organization:** Oil and gas operator, pipeline company, energy utility

**Role:** This person is responsible for the structural and mechanical integrity of the assets that, if they fail, cause safety incidents, environmental events, or regulatory violations. Pipeline inspection, pressure vessel assessment, rotating equipment condition monitoring, and facility integrity are all in scope.

**Primary pains:**
- Regulatory compliance (PHMSA for pipelines, OSHA PSM for pressure systems) requires documented inspection programs with specific intervals and methods. Managing compliance across hundreds of assets is complex.
- Fitness-for-service (FFS) assessments for pressure vessels and piping require engineering judgment that is not always consistently documented.
- Capital planning for major integrity repairs and replacements must account for regulatory timelines, not just financial timelines.
- ESG reporting increasingly requires quantified asset integrity data (e.g., pipeline leak rates, emission intensity of aging equipment).

**How Aurigo helps:**
Primus Maintain provides the asset registry and compliance documentation platform for regulated assets. Inspection records are structured to support regulatory documentation requirements. Capital needs analysis accounts for regulatory replacement timelines.

---

## Quantified Pain and Current Workarounds

Every persona has to be pitched against the specific status quo they will defend. If the sales conversation cannot enumerate what the customer does today, in hours and dollars, the pitch is generic.

| Persona | Pain (quantified) | Current workaround | Cost of the workaround |
|---------|------------------|--------------------|------------------------|
| State DOT Asset Manager | Spends 1,200–1,800 person-hours per TAMP cycle | 3 analysts + 1 senior engineer working in Excel, Access, and ArcGIS | $180K–$260K per TAMP cycle, plus 4-month delay to publication |
| County Engineer | 4–8 hours per week manually updating capital plan spreadsheet | Multi-tab XLSX shared drive, no version control | 200–400 hours/year; institutional knowledge dies with the engineer |
| Transit Capital Program Director | 3 days per FTA data request, monthly | 2 project controls analysts pulling data from Primavera + Sharepoint | 720 hours/year across program controls, delayed decisions |
| City Public Works Director | Cannot answer "what's the condition of our infrastructure" in council chambers | Ad-hoc requests to 6 divisions, 2-week turnaround | Reputational + $1.5–3M/year over-spend on politically visible items |
| VP of Operations (Manufacturing) | Loses 47 hours/year to a single asset class of avoidable downtime | Maintenance supervisor's spreadsheet of "at-risk equipment" | $2.3M avg per plant per year for a $200M facility |
| Director of Critical Infrastructure (Data Center) | 1 near-miss SLA event per Tier III site per 18 months | Excel-based lifecycle plan + reactive vendor recommendations | $9K/min per SLA breach; potential 7-figure penalty |
| Chief Compliance Officer (Life Sciences) | 60–120 days pre-audit scramble to reconstruct equipment qualification history | Consultants + paper records reconciliation | $300K–$800K per audit cycle; risk of FDA 483 observation |
| Asset Integrity Manager (Energy) | 30% of inspection reports arrive past due to PHMSA windows | Manual reminder tracking; consultants for backlog | Fines + reputational; direct incident-preventable-costs unknown |

These numbers come from Aurigo customer interviews (n=94, 2024–2026) and industry benchmarks (McKinsey Global Institute — Infrastructure Productivity; Uptime Institute Data Center Outage Report; FDA warning letter analysis). They are the numbers that convert a persona from a slide deck into an ROI conversation.

---

## Customer Discovery Questions

The five questions to ask in a discovery call for each persona to qualify pain-fit within the first 45 minutes.

### State DOT Asset Manager
1. "Walk me through your last TAMP cycle. How many people, how many months, what tools?"
2. "When FHWA issued its most recent NHPP performance measure feedback, what changed in your workflow?"
3. "What percentage of your NHS bridges have current condition data in a machine-readable form today?"
4. "If your Secretary asked in the next hour for a list of the 10 highest-risk NHS bridges, could you answer with data or from memory?"
5. "Which of your peer state DOTs would you pattern-match on for reference?"

### County Engineer
1. "How many bridges does the county own, and how many are on a current NBIS inspection cycle?"
2. "When you build the annual capital budget request, is it a fresh spreadsheet or does it evolve year-over-year?"
3. "If your senior bridge inspector retired next month, what would break?"
4. "Which board member has questioned a capital request in the last 12 months? What did they ask?"
5. "Have you accessed Bridge Formula Program funding? What made it hard?"

### Transit Capital Program Director
1. "How many active capital projects are you tracking, and what tool is the source of truth?"
2. "How long does a monthly FTA status report take to produce?"
3. "When was the last time a project closeout produced clean data for maintenance?"
4. "What percentage of your capital budget is being consumed by asset renewal vs. expansion?"
5. "Where is the friction in your current Primavera / P6 workflow?"

### City Public Works Director
1. "If the council asked next Tuesday for a condition report on the city's infrastructure, what would you show them?"
2. "How do the 6 divisions of Public Works currently coordinate on the capital budget request?"
3. "What is your deferred maintenance backlog estimate? How was it calculated?"
4. "Which failure has your name attached to it politically? What preceded it?"
5. "What does your finance director want to see in a capital request that they aren't getting today?"

### VP of Operations (Manufacturing)
1. "What is your current OEE, and what is the biggest single contributor to unplanned downtime?"
2. "When your maintenance supervisor lists 'equipment that needs replacement,' how confident are you in that list?"
3. "What percentage of last year's capital budget went to reactive replacements vs. planned replacements?"
4. "Where do you have sensor data today, and is it being used for anything beyond alarms?"
5. "If you could see a five-year replacement schedule with confidence intervals, what would you do differently?"

### Director of Critical Infrastructure (Data Center)
1. "What tier are you certified to, and how many near-miss SLA events did you have in the last 24 months?"
2. "How is your generator overhaul schedule maintained today?"
3. "When was your last UPS battery capacity test, and how is that data trended?"
4. "What percentage of your operating hours are within design envelope for your cooling?"
5. "If your CFO asked why capital replacement of a specific chiller is required, how would you defend it?"

### Chief Compliance Officer (Life Sciences)
1. "What was the finding of your most recent FDA inspection, and what did it teach you about your equipment records?"
2. "When a technician replaces a component, how is the requalification decision made and tracked?"
3. "How much of your capital plan for the next 3 years includes qualification cost lines?"
4. "Where do your equipment qualification records live today — QMS, CMMS, LIMS, paper?"
5. "How many hours per audit cycle are spent reconstructing rather than reporting?"

### Asset Integrity Manager (Energy)
1. "What percent of your PHMSA-mandated inspections were completed on-time last year?"
2. "How is fitness-for-service documented and versioned?"
3. "What is your inspection backlog by asset class?"
4. "How does asset integrity feed into ESG reporting today?"
5. "What is the single asset class where a failure has the highest safety consequence?"

Sales teams are expected to memorize the relevant five before every discovery call and to record the answers in the CRM in the customer's own words. Discovery questions are the raw material of product feedback loops.

---

## Persona-to-Product-Module Map

| Persona | Primary module | Secondary modules | Success metric moved |
|---------|----------------|-------------------|----------------------|
| State DOT Asset Manager | Maintain (TAMP) | Plan, Reporting | Time-to-TAMP, TAMP approval |
| County Engineer | Maintain (Native mode) | Mobile, Plan | Federal funding accessed |
| Transit Capital Program Director | Build | Plan, Maintain (Transit TAM) | On-time project delivery |
| City Public Works Director | Maintain + Plan | Dashboards | Deferred maintenance backlog quantified |
| VP of Operations | Maintain (Integrated) | AI Risk | OEE improvement, downtime reduction |
| Director of Critical Infrastructure | Maintain (Native) | AI Predictive | SLA compliance |
| Chief Compliance Officer | Maintain (Integrated with QMS) | Compliance module | Audit prep time |
| Asset Integrity Manager | Maintain + Reporting | Compliance module | Inspection on-time % |

---

*Next: [06 — Competitive Landscape](06-competitive-landscape.md)*
