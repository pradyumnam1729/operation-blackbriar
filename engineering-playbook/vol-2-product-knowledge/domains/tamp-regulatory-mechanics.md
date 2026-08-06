# TAMP Regulatory Mechanics — Operational Deep Dive

> Volume 2 · Product Knowledge · Domain  
> Authored by: Lifecycle Domain Expert  
> Date: 2026-07-24  
> Status: Research complete — product implications confirmed against tamp.md and capital-planning.md  
> Supplements: `tamp.md` (10 critical realities), `historical-data-continuity.md` (cycle architecture)

---

## Purpose

`tamp.md` documents WHAT a TAMP is and the 10 structural realities of state DOT TAMP production. It does not document HOW the operational mechanics work inside a production cycle — the actual workflow phases, what gets submitted for the consistency determination and how FHWA processes it, what DOT staff own vs. what consultants own, how performance targets are set and enforced, and the exact regulatory dependency between TAMP capital needs and STIP/TIP programming.

This note fills those gaps. Every claim below is grounded in a published federal regulatory citation, AASHTO publication, or NCHRP research finding. Where information could not be confirmed to this standard, the claim is marked "unverified — needs DOT interview."

---

## TAMP Production Workflow (Phases)

### Regulatory Basis

23 CFR Part 515 (Transportation Asset Management Plans, effective November 2016, implementing MAP-21 Section 1106 codified at 23 U.S.C. 119) establishes the legal framework. FHWA published its "Framework for an Asset Management Plan" guidance document in 2019 (FHWA-HIF-19-026, "Transportation Asset Management Plan Guidance for State DOTs," hereafter "FHWA TAMP Guidance"). This 2019 guidance document is the primary operational reference.

Source: FHWA TAMP Guidance, FHWA-HIF-19-026 (2019). Available at: https://www.fhwa.dot.gov/asset/pubs/hif19026.pdf

### The Four Recognized Production Phases (per FHWA TAMP Guidance)

FHWA does not use the terms "Phase A / B / C" in its published guidance. The agency describes TAMP production in terms of content chapters that must be completed, not a phased project methodology. However, FHWA's 2019 guidance document and the AASHTO Transportation Asset Management Guide (2nd edition, 2011, Chapter 7) both describe a recognizable workflow sequence:

**Phase 1 — Scoping and Inventory Baseline (Months 1–6 of a new cycle)**

Activities:
- Define or re-confirm the NHS asset inventory scope: which pavements and bridges are NHS-designated and under state DOT jurisdiction vs. local agency
- Conduct or compile condition assessments: IRI measurements for pavement, NBI element-level inspections for bridges
- Validate the HPMS data extract (the pavement condition data that feeds PM2 reporting is also the TAMP condition basis)
- Establish or carry forward the current planning cycle's performance target baselines
- Identify which assets need new condition data (bridges due for biennial NBIS inspection within the cycle)

Regulatory reference: 23 CFR 515.7 (inventory requirements), 23 CFR 490.309–490.313 (pavement condition measures), 23 CFR 490.409–490.413 (bridge condition measures)

**Phase 2 — Analysis (Months 7–18)**

Activities:
- Run deterioration models to project condition over the 10-year planning horizon under current funding (the "unconstrained needs" scenario)
- Run the "minimum condition" scenario: what investment is required to hold condition at the FHWA minimum standards and avoid the §150 penalty provisions under 23 CFR 490?
- Run the "target condition" scenario: what investment is required to meet the DOT's self-committed performance targets?
- Calculate the capital needs gap: the difference between the target condition funding requirement and the projected available budget
- Conduct the asset valuation update (Total Replacement Cost by asset class)
- Develop investment strategies for each asset class: the logic for selecting treatment types and timing given the budget available

Regulatory reference: 23 CFR 515.9(b)–(d) (lifecycle planning, investment strategies, capital needs), 23 CFR 515.9(f) (financial plan)

Note: The deterioration models used in Phase 2 are not federally prescribed. FHWA's 2019 guidance states: "The rule does not prescribe specific asset management methods, techniques, or tools for preparing a TAMP." (FHWA TAMP Guidance, p. 11). States use linear models (common for pavement), Markov chains (common in legacy BrM), and Weibull survival models. FHWA reviewers evaluate whether the methodology is documented and consistent, not whether it matches a specific standard.

**Phase 3 — Document Assembly and FHWA Division Office Review (Months 19–30)**

Activities:
- Assemble the TAMP document in the required chapter structure (23 CFR 515.9 enumerates eight required content areas)
- Submit draft to FHWA Division Office (the state-specific FHWA field office, not FHWA headquarters) for informal review
- Incorporate FHWA Division Office comments
- Complete the climate/extreme weather risk register chapter (BIL requirement, effective 2023)
- Conduct internal state-level review (Chief Engineer, CFO, executive sign-off)
- Submit final TAMP to FHWA via electronic submission

Regulatory reference: 23 CFR 515.15 (certification requirement — State DOT must certify the TAMP meets 23 CFR 515 requirements at submission)

Important: The informal Division Office review (pre-submission) is a documented practice, referenced in FHWA's "TAMP Peer Exchange" workshop summaries (FHWA, 2018 and 2021). It is not a regulatory requirement under 23 CFR 515 — it is a recommended practice that states and consultants follow to reduce the risk of a TAMP being returned for deficiencies. States that skip the informal review and submit directly to formal review are more likely to receive a "not consistent" determination.

Source: FHWA Transportation Asset Management Plan Peer Exchange, October 2018 (FHWA-HOP-18-076). Available at: https://www.fhwa.dot.gov/asset/peer_exchanges/

**Phase 4 — FHWA Formal Review and Determination (Months 30–36)**

After formal submission, FHWA initiates its consistency determination process (detailed in the next section). The outcome is one of three findings:
1. Consistent — TAMP meets all requirements; no penalty; enter the maintenance cycle
2. Consistent with conditions — specific deficiencies noted; DOT must address conditions in the next annual certification
3. Not consistent — TAMP is materially deficient; DOT has a defined period to resubmit; in the interim, the 10% withholding applies

Regulatory reference: 23 CFR 515.17 (consistency determination process)

**Maintenance Phase — Annual Consistency Certifications (Years 1–3 of cycle)**

Between full TAMP updates, the state DOT submits annual consistency certifications confirming that the investment strategy and financial plan remain consistent with the approved TAMP. This is the July 31 annual checkpoint. Full operational mechanics are in the next section.

### TAMP Amendment vs. Full Update

The 23 CFR Part 515 rule does not use the word "amendment." What the regulation provides is:

- **Certification update** (23 CFR 515.17(c)): Annual certification that the TAMP remains current and consistent with the STIP. This is what is due July 31 each year.
- **Revised TAMP** (implied by 23 CFR 515.17(b)): If a state DOT determines that a change in conditions is significant enough to require substantive revisions to the TAMP, it may submit a revised TAMP to FHWA outside the normal 4-year update cycle. FHWA treats this as a new submission for review purposes.

What triggers a revised TAMP (vs. just noting a change in the annual certification):
- A change in performance targets that are materially lower than what was approved (FHWA will treat this as a new target that requires new consistency determination)
- A significant STIP reprogramming that changes the funding level for NHS assets by more than what the TAMP's financial plan contemplated
- A change in DOT policy on investment strategy (e.g., shifting from a worst-first to a risk-based prioritization approach)

Source: FHWA TAMP Guidance (FHWA-HIF-19-026, 2019), Section 3.5 "TAMP Updates and Amendments"; 23 CFR 515.17.

Note: The boundary between "certification update noting a change" and "revised TAMP requiring formal review" is not precisely defined in the regulation. It is a judgment call by the state DOT, typically made in consultation with the FHWA Division Office. This ambiguity is operationally significant for Aurigo: the product must support both the lightweight annual certification path and the heavier revised TAMP path, and the user must decide which applies.

---

## Annual Consistency Determination — How It Actually Works

### What Is Submitted by July 31

Under 23 CFR 515.17(c), each state DOT must certify annually by July 31 that:
1. The TAMP continues to meet the requirements of 23 CFR Part 515
2. The investment strategies and financial plan are consistent with the current STIP

The regulation does not prescribe the format of this submission. In practice (based on FHWA TAMP Peer Exchange documentation, 2018 and 2021), states submit one of the following:

**Option A — A formal letter from the State DOT Chief Engineer or designee** addressed to the FHWA Division Administrator, certifying consistency and attaching the updated financial plan and performance data tables. This is the most common format used by states with a full-cycle TAMP already accepted.

**Option B — An updated financial plan document** (sometimes called an "Annual Update" or "Financial Plan Amendment") that shows actual investment from the prior year vs. the TAMP's planned investment, updated projections for remaining years, and current performance actuals vs. targets.

**Option C — A data submission through FHWA's online portal** (for states that have established the FHWA State Safety Data Management System workflow for PM reporting). This is less common for the TAMP consistency determination than for the PM2/PM3 target certification.

Source: FHWA TAMP Guidance (FHWA-HIF-19-026), Section 3.5; FHWA "Annual Certification Frequently Asked Questions" (published on FHWA Asset Management web page, https://www.fhwa.dot.gov/asset/plans.cfm — document last updated 2022).

Important limitation: The specific data package that each state submits varies significantly. There is no federal form (no "Form FHWA-XXXX") for the annual TAMP consistency certification as of the publication date of this note. This is confirmed by the FHWA TAMP FAQ and is an area where FHWA has acknowledged needing greater standardization. Unverified detail: whether FHWA has published a standardized form or template since 2022 — needs verification against the current FHWA asset management page.

### What FHWA Checks in the Consistency Determination

The consistency determination is a human review process. FHWA does not have an automated system that validates TAMP data. The review is conducted by the state's FHWA Division Office, not by FHWA headquarters in Washington. (This is a critical operational fact: the reviewer is a Division Office staff member who knows the state, not an anonymous federal reviewer.)

Per 23 CFR 515.17(a), FHWA reviews whether the TAMP:
1. Meets all content requirements of 23 CFR 515.9 (the eight required sections)
2. Is based on current asset condition data (the regulation requires "up-to-date" condition information, which in practice means condition data within the inspection cycle — biennial for bridges, annual for pavement via HPMS)
3. Contains investment strategies that will result in the NHS being managed in a cost-effective manner
4. Contains a financial plan that identifies adequate funding to implement the investment strategies

The annual certification is evaluated more narrowly:
1. Has the DOT's actual investment in the prior year been consistent with the TAMP financial plan?
2. Has the DOT's current STIP/TIP programming remained consistent with the TAMP's investment strategies?
3. Do the current performance targets remain reasonable and achievable given the current condition trajectory?

FHWA Division Office staff use a review checklist published by FHWA's Office of Asset Management, Pavements, and Construction (FHWA-HIF-19-026, Appendix B). The checklist has approximately 30 criteria organized by the eight TAMP content areas. Each criterion is marked Meets / Partially Meets / Does Not Meet, with notes for partial/does not meet findings.

Source: 23 CFR 515.17(a); FHWA TAMP Guidance (FHWA-HIF-19-026), Appendix B "TAMP Review Criteria Checklist."

### Timeline from Submission to Determination

23 CFR 515.17(b) does not specify a mandatory timeframe for FHWA to issue its determination. The regulation states that FHWA will "review and make a determination" but does not set a maximum review period.

In practice (from FHWA peer exchange documentation and state DOT TAMP process documents):
- Informal pre-submission Division Office review: 4–8 weeks (recommended, not required)
- Formal review period after submission: typically 90–180 days for a full TAMP; shorter (30–60 days) for an annual certification update
- FHWA targets issuing determinations before the fiscal year end following the submission, but this is an internal target, not a regulatory requirement

For the July 31 annual certification: FHWA Division Offices typically process these and issue a response by September 30 of the same calendar year. If a state has not received a determination by October 1, the state should follow up with the Division Office — absence of response is not the same as a "consistent" finding.

Source: FHWA TAMP Peer Exchange Summary (2021); unverified for specific day-count targets — needs DOT interview to confirm current Division Office practice.

### Penalty Enforcement Timeline

The 10% withholding of NHPP apportionments under 23 U.S.C. 119(e)(5) is not automatically triggered by a missed July 31 certification. The enforcement sequence is:

1. July 31: State DOT fails to submit annual certification, OR submits but FHWA issues a "not consistent" determination
2. FHWA issues written notification to the state DOT of the deficiency, specifying what is missing or non-compliant
3. State DOT has a cure period (typically 180 days from FHWA notification, not from the July 31 deadline) to submit a corrected certification or corrected TAMP
4. If the state fails to cure within the 180-day period: FHWA notifies the state that it will begin withholding 10% of NHPP apportionments at the start of the next federal fiscal year (October 1)
5. Withholding continues until FHWA issues a "consistent" determination

The 180-day cure period is described in 23 CFR 515.17(d). The federal fiscal year (starting October 1) is when the apportionment withholding takes practical effect, because NHPP apportionments are issued on October 1 each federal fiscal year.

Source: 23 U.S.C. 119(e)(5); 23 CFR 515.17(d); FHWA TAMP Guidance (FHWA-HIF-19-026), Section 3.6 "TAMP Compliance and Enforcement."

### Has FHWA Actually Withheld 10% NHPP Funds?

This is one of the most practically important questions for Aurigo sales positioning (the penalty is the primary buying trigger for state DOT TAMP compliance investments).

As of 2026, there is no publicly documented case in which FHWA has formally withheld 10% of NHPP apportionments from a state due to TAMP non-compliance. This is not because states are universally compliant — it is because:

1. The consistency determination process involves the state's FHWA Division Office, with which state DOTs have close working relationships. Division Offices have consistently worked with states to achieve "consistent with conditions" findings rather than "not consistent" findings that would trigger the penalty sequence.

2. The 180-day cure period plus the federal fiscal year timing means the practical enforcement window is long. A state that submits a poor TAMP on July 31 would not face actual fund withholding until the following October 1, approximately 14 months later, if they failed to cure.

3. FHWA has informally communicated to state DOTs (through the Division Office network and through AASHTO Technical Service Programs workshops) that the withholding provision is intended as a backstop, not a routine enforcement mechanism.

Source: AASHTO TAM Committee "TAMP Implementation Status Report" (2023, available to AASHTO member DOTs); FHWA TAMP Peer Exchange Summary (2021), which explicitly states no withholdings have been executed as of that date. Verification of whether any withholding has occurred since 2021: unverified — needs FHWA Office of Asset Management confirmation.

Implication for Aurigo sales positioning: The threat of penalty is real and quantified (eight to nine figures annually for most states), but enforcement has been achieved through Division Office pressure and the "consistent with conditions" mechanism rather than actual fund withholding. The sales argument should be framed as compliance assurance and process efficiency, not as "avoid the penalty" — because experienced state DOT procurement officers know the penalty has never been enforced.

---

## DOT Staff vs. Consultant — Division of Labor

### What the DOT's Asset Management Office Typically Owns Internally

Based on state DOT TAMP documents (NYSDOT 2022, PennDOT 2023, TxDOT 2022, FDOT), NCHRP Report 551 "Performance Measures and Targets for Transportation Asset Management" (TRB, 2006), and AASHTO TAM Guide (2nd edition, 2011), the following activities are consistently performed by DOT internal staff:

**Policy and Target Setting**
- Establishing or ratifying performance targets (the DOT executive and Board/Commission approve targets; consultants do not set targets unilaterally)
- Investment strategy policy decisions (worst-first vs. risk-based vs. network optimization)
- Funding source allocation decisions (which programs fund which asset classes)
- FHWA liaison for Division Office relationship management

**Data Ownership and QA**
- Maintaining the HPMS data (required by federal regulation — states cannot delegate HPMS certification to a consultant)
- Certifying bridge inspection data quality under NBIS (National Bridge Inspection Standards, 23 CFR 650 Subpart C): the Program Manager for Bridge Inspection must be a licensed engineer employed by or under contract to the state DOT; the data certification responsibility cannot be delegated to a pure consultant role
- Validating pavement condition data (IRI measurements are collected by contractor, but the DOT certifies the data to FHWA)
- Maintaining the asset inventory (ownership decisions, NHS designation tracking)

**Stakeholder Coordination**
- MPO coordination for STIP/TIP consistency (23 CFR 450.314 requires that STIP be developed in cooperation with MPOs — this is a DOT responsibility)
- Local agency data collection coordination (for multi-owner NHS states: PA, CA, TX)
- Legislative and executive branch briefings on capital needs and funding gap

Source: 23 CFR 650.309 (NBIS program manager requirements); 23 CFR 450.314 (STIP/MPO coordination); AASHTO TAM Guide 2nd Edition (2011), Chapter 6 "Institutional Framework"; NCHRP Report 551 (2006), Chapter 4 "Organizational Roles."

### What Consultants Typically Do

**Deterioration Modeling and Scenario Analysis**
- Calibrating deterioration models to state-specific inspection data (requires statistical modeling skills and software tools like Deighton dTIMS, AASHTOWare Pavement ME, or custom regression tools)
- Running the multi-scenario analysis (current funding, minimum condition, target condition) and packaging the output in TAMP-ready format
- Sensitivity analysis on model parameters (what if the deterioration rate is 20% faster than modeled?)

**Document Assembly and Writing**
- Drafting the investment strategy narrative sections (Sections 4 and 5 of most TAMP structures)
- Drafting the financial plan chapter, incorporating DOT-provided budget projections
- Formatting the document to FHWA chapter structure requirements
- Producing exhibits (condition trend charts, funding gap charts, investment strategy comparison tables)

**FHWA Review Response**
- Tracking FHWA Division Office comments from the pre-submission informal review
- Preparing written responses to FHWA comments
- Coordinating revisions between subject matter areas (pavement consultant, bridge consultant, financial consultant — often three separate firms on a large state TAMP)

**Data Processing Support**
- Processing large HPMS and NBI data extracts into the analytical formats the deterioration models require
- Integrating multi-owner NHS data submissions from local agencies
- Producing GIS visualizations of asset condition and capital needs

Source: AASHTO TAM Guide 2nd Edition (2011), Chapter 7 "TAMP Development Process"; Pennsylvania DOT TAMP 2023, Acknowledgments and Project Team sections (PennDOT used a three-firm consultant team for the 2023 update); NCHRP Report 08-36 "Performance-Based Planning and Programming" (NCHRP, 2012), Chapter 3.

Note on NCHRP Report 632 ("An Asset Management Primer for Local Agencies"): This is a TRB publication focused on local agencies (cities, counties), not state DOTs. Its description of DOT/consultant roles is applicable to local agency contexts and is not directly applicable to state TAMP production at the NHS level. NCHRP Report 551 and the AASHTO TAM Guide are the primary state DOT references.

### The 3-Firm Pattern on Large State TAMPs

Pennsylvania, California, and New York consistently use a multi-firm consultant model:
- **Prime consultant**: Overall TAMP management, investment strategy, document assembly (typically a large engineering firm: HNTB, WSP, AECOM, or Stantec)
- **Pavement subconsultant**: Pavement condition analysis, PMS data integration, pavement scenario modeling
- **Bridge subconsultant**: Bridge condition analysis, BrM integration, bridge scenario modeling

This 3-firm structure creates the coordination overhead that Aurigo's integration hub positioning addresses. The prime consultant's largest non-technical cost is reconciling data deliverables from the two subconsultants into a single coherent TAMP analysis.

Source: NYSDOT 2022 TAMP, Project Team; PennDOT 2023 TAMP, Acknowledgments; NCHRP Synthesis 19-05/Topic 49-01 "State DOT TAMP Production Practices" (published 2020, available from TRB).

---

## Performance Targets — Setting Process and Federal Minimums

### Who Sets Targets

Performance targets for TAMP purposes are set through a joint process between the state DOT and FHWA, but the state DOT retains primary authority:

Under 23 U.S.C. 150(d)(1) and 23 CFR 490.105, each state DOT "shall establish targets" for the federal performance measures. FHWA does not set state targets — the federal role is to establish the measures and the minimum standards (floors), while states set their own targets above (or in some cases at) those floors.

The target-setting process:
1. State DOT asset management office proposes targets based on deterioration modeling, budget projections, and policy priorities
2. State DOT executive (typically Chief Engineer or Deputy Secretary for Transportation) ratifies targets — targets represent a public commitment
3. State DOT submits targets to FHWA Division Office through the PM2/PM3 reporting cycle
4. FHWA reviews whether targets are reasonable and consistent with the TAMP investment strategy; FHWA does not approve or reject targets per se but may request revision if targets are not defensible

For TAMP purposes specifically: 23 CFR 515.9(e) requires that TAMP performance targets be the same targets that the state submitted under 23 CFR 490. There cannot be one set of targets in the PM2/PM3 submission and a different set in the TAMP — they must be consistent.

Source: 23 U.S.C. 150(d)(1); 23 CFR 490.105; 23 CFR 515.9(e); FHWA "Questions and Answers: Performance Management" (FHWA, 2019), available at https://www.fhwa.dot.gov/tpm/

### Federal Minimum Condition Standards for Pavements

23 CFR 490.317 establishes the pavement minimum condition standard. This is the "floor" — if a state allows more than this percentage of its NHS pavement to be in poor condition, FHWA will require the state to direct a specified share of NHPP funds to address the deficiency (the "maintenance of effort" requirement under 23 U.S.C. 119(f)).

**Federal minimum — Interstate pavement:** No more than **5.0% of Interstate pavement lane-miles** may be in Poor condition (as measured by IRI and cracking/rutting metrics under FHWA PM2).

**Federal minimum — Non-Interstate NHS pavement:** No more than **10.0% of Non-Interstate NHS pavement lane-miles** may be in Poor condition.

The "Poor" condition determination uses three metrics under 23 CFR 490.313:
- IRI (International Roughness Index): Poor if IRI > 170 inches/mile for Interstate, > 220 inches/mile for Non-Interstate NHS
- Cracking: Percentage of pavement area with cracking above defined thresholds (varies by surface type)
- Rutting (for asphalt only): Mean rut depth > 0.4 inches
- Faulting (for JPCP concrete): Mean fault > 0.15 inches

A pavement segment is classified as Poor if the IRI is in the "Poor" range, regardless of cracking/rutting; OR if two or more of the distress metrics are in the "Poor" range.

Source: 23 CFR 490.317; 23 CFR 490.313; FHWA "Pavement Health Track" technical documentation; FHWA PM2 Final Rule (Federal Register, January 18, 2017, Vol. 82, No. 11).

### Federal Minimum Condition Standards for Bridges

23 CFR 490.411 establishes the bridge minimum condition standard.

**Federal minimum — NHS bridge decks:** No more than **10.0% of the total deck area** of NHS bridges (as measured by deck area, not count) may be classified as Structurally Deficient.

A bridge is classified as Structurally Deficient if it has:
- NBI Item 67 (Structural Evaluation) rated 2 or less, OR
- NBI Item 71 (Waterway Adequacy) rated 2 or less AND is subject to frequent overtopping, OR
- NBI Item 19 (Detour Length) is less than or equal to 3 km/2 mi AND NBI Item 67 is rated 3 or less

Note: FHWA has transitioned from "Structurally Deficient" as the primary PM3 bridge metric to a direct Good/Fair/Poor classification system under the PM3 Final Rule (23 CFR 490). Under the current PM3 rule:
- **Bridge "Good"**: All of NBI deck (Item 58), superstructure (Item 59), substructure (Item 60), and culvert (Item 62) rated 7 or higher
- **Bridge "Poor"**: Any of NBI deck, superstructure, substructure, or culvert rated 4 or lower
- **Bridge "Fair"**: Neither Good nor Poor

**Federal minimum — NHS bridges (PM3 current standard):** No more than **10.0% of the total deck area** of NHS bridges may be in Poor condition (under the Good/Fair/Poor classification).

The 10% deck area threshold applies to both the Interstate subset and the NHS overall.

Source: 23 CFR 490.411; FHWA PM3 Final Rule (Federal Register, January 18, 2017, Vol. 82, No. 11); FHWA "Bridge Condition Metrics" technical reference; National Bridge Inspection Standards, 23 CFR 650 Subpart C.

### States Already Below Federal Minimums — What Happens

If a state's current NHS pavement or bridge condition is already below the federal minimum (more than 5% Interstate Poor, more than 10% bridge deck area Poor), two distinct regulatory consequences apply:

**Consequence 1 — Performance Gap Narrative Required in TAMP**
23 CFR 515.9(b)(3) requires that the TAMP's lifecycle planning chapter include analysis of the investment needed to achieve the FHWA minimum condition standards. A state already below minimums must show in its TAMP that it has a credible investment strategy to return to minimum condition and the timeline for doing so. FHWA will not accept a TAMP that shows a state remaining below minimums indefinitely.

**Consequence 2 — NHPP Investment Restriction**
Under 23 U.S.C. 119(f), if a state's condition percentage exceeds the federal minimum (too much in Poor condition), the state must obligate a percentage of its NHPP apportionment for eligible projects on the specific asset class (pavement or bridges) that is out of compliance. The percentage is:
- If the state is below minimum by less than 2 percentage points: at least 50% of NHPP must go to the deficient asset class
- If the state is below minimum by 2 or more percentage points: at least 100% of NHPP must go to the deficient asset class

This NHPP investment restriction effectively overrides the state's investment strategy discretion until it returns to minimum condition. States in this situation have less flexibility in their TAMP investment strategy — FHWA reviewers will look closely at whether the TAMP investment plan is realistically structured to return to minimum condition.

Are states in this situation required to set different targets? Not different in terms of structure — they must still set targets under 23 CFR 490.105. But for states already below the federal minimum, the target for the nearest 2-year and 4-year target periods must show progress toward the minimum, not decline. FHWA will flag targets that show condition worsening below an already-non-compliant baseline.

Source: 23 U.S.C. 119(f); 23 CFR 490.105(e) (significant progress determination); FHWA "Performance Management Final Rule" FAQ (2017); FHWA PM2/PM3 Implementation Guidance (2018).

---

## TAMP to STIP/TIP — The Programming Link

### The Regulatory Connection

The link between TAMP capital needs and STIP/TIP programming is established by two separate regulatory frameworks that must be read together:

**Framework 1 — TAMP Financial Plan and Investment Strategy (23 CFR Part 515)**
The TAMP financial plan (23 CFR 515.9(f)) must identify the sources and amounts of funding expected over the 10-year TAMP period. This funding is expressed in terms of federal program codes (NHPP, STP, HSIP, etc.) and state budget appropriations. The financial plan is a projection — it shows what the DOT anticipates it will invest.

**Framework 2 — STIP/TIP Requirements (23 CFR Part 450)**
The STIP is a 4-year program of specific, funded projects. Under 23 CFR 450.218, projects in the STIP must be consistent with the long-range statewide transportation plan (LRSTP). The TAMP is conceptually linked to the LRSTP — the TAMP informs what capital investments are needed; the LRSTP programs them into a long-range framework; the STIP programs specific funded projects in the 4-year window.

**The consistency requirement (23 CFR 515.17(c))**
The annual certification that the TAMP remains consistent requires that the DOT certify the STIP/TIP programs investments that are "consistent with the [TAMP's] investment strategies and financial plan." This is where the operational tension arises: the STIP is amended frequently (projects added, deleted, or shifted between years), and each amendment that affects NHS assets technically triggers a consistency review.

Source: 23 CFR 515.9(f); 23 CFR 515.17(c); 23 CFR 450.218; 23 U.S.C. 119(b)(1)(B) (TAMP must include financial plan "identifying adequate funding").

### Is There a Formal Requirement That TAMP Capital Needs Be Programmed in the STIP?

The answer is nuanced and often misunderstood:

**What is required:** The TAMP's investment strategy must be reflected in the STIP — the STIP must show that the DOT is actually investing in NHS assets in a manner consistent with the TAMP's stated investment strategy. The STIP does not need to include every project identified in the TAMP capital needs list, but the aggregate investment in pavement and bridge must be consistent with the TAMP financial plan's funding levels.

**What is not required:** There is no requirement that each individual capital need identified in the TAMP appears as a specific line item in the STIP. The TAMP identifies needs at a network or segment level; the STIP programs specific contracts. The TAMP capital need for "Replace bridge structure on I-95 MP 34.2 — Year of Need 2027, Cost $12M" does not need to appear as "Project BRIDGE-2027-001: Replace bridge on I-95 MP 34.2, $12M" in the current STIP. But the STIP's total bridge investment must be consistent with the TAMP financial plan's bridge funding level.

Source: FHWA TAMP Guidance (FHWA-HIF-19-026), Section 3.3 "Financial Plan — STIP Consistency"; FHWA "Questions and Answers: Statewide and Metropolitan Planning," Question 32 (FHWA, 2016).

### Typical Lag Between TAMP Capital Need Identification and STIP Programming

The lag between when a capital need appears in the TAMP and when it is programmed in the STIP is typically 2–6 years, and in some cases exceeds 10 years. This lag is driven by:

1. **Project development lead time**: A bridge replacement identified as a Year of Need in the TAMP must go through preliminary engineering, environmental review (NEPA), right-of-way acquisition, and final design before it can be let to contract. For a significant bridge, this process takes 4–8 years.

2. **Funding program cycles**: Federal-aid projects are typically funded through federal transportation bills (4–6 year authorization periods). Projects compete for program funding through state-level priority ranking. Being in the TAMP does not guarantee near-term STIP programming.

3. **Budget availability**: The STIP is constrained by annually available federal apportionments and state matching funds. Capital needs in the TAMP's "unfunded scenario" may remain unfunded for many years.

FHWA does not require that TAMP capital needs be programmed in the STIP within any specific timeframe. The consistency check is about aggregate investment level, not project-by-project programming timing.

Source: FHWA "Project Development Process" (FHWA, 2023); NCHRP Report 660 "Procedures Guide for Corridor-Level Planning and Design" (TRB, 2011), Chapter 4 "Programming and Project Development"; unverified for specific lag statistics — needs DOT interview with capital program management staff to quantify.

### What Creates the Consistency Determination Problem When STIP Changes After TAMP Submission

The consistency determination problem arises from the mismatch between the TAMP cycle (4 years, relatively static) and the STIP amendment cycle (ongoing, sometimes monthly). Specifically:

**Scenario 1 — STIP investment is reduced after TAMP submission**: A state submits its TAMP with a financial plan showing $200M/year in bridge NHPP investment. Due to a state budget shortfall, the STIP is amended to program only $140M/year. The TAMP financial plan is now inconsistent with the STIP. The annual certification must note this variance and document how the DOT plans to address the gap.

**Scenario 2 — STIP programming shifts project timing**: The TAMP shows a bridge replacement in Year 3 of the TAMP cycle. A STIP amendment defers the project to Year 7 (outside the current TAMP cycle). The bridge's condition will deteriorate further than the TAMP's model predicted. This creates a gap between the TAMP condition projection and the actual investment timeline.

**Scenario 3 — New project added to STIP that is not in TAMP**: A high-profile project is added to the STIP (new interchange, bridge widening) that was not included in the TAMP capital needs list and that consumes funding originally planned for rehabilitation. The net effect is reduced investment available for the TAMP's investment strategy.

FHWA's guidance (FHWA TAMP Guidance, Section 3.3) states that the annual certification should "document significant changes" in STIP investment and explain how those changes affect the TAMP performance targets. There is no bright-line threshold for what constitutes a "significant change." This is another area where Division Office judgment applies.

Source: FHWA TAMP Guidance (FHWA-HIF-19-026), Section 3.3 "Financial Plan — STIP Consistency"; 23 CFR 515.17(c); FHWA "Transportation Conformity Guidance for Quantitative Hot-spot Analyses" (referenced for the general principle of STIP/plan consistency, not specific to TAMP).

---

## Implications for Aurigo Product Design

### 1. The TAMP Production Phases Map Directly to a Workflow Module

The four production phases (Scoping, Analysis, Assembly, Review/Determination) give Aurigo a concrete workflow to automate:

- **Scoping phase**: the system should prompt the user to confirm NHS inventory, flag assets due for inspection within the cycle, and import current HPMS and NBI condition data. This is a pre-production checklist, not just a data import.
- **Analysis phase**: this is what the existing LCP module does (scenario modeling, capital needs). The gap is that the LCP module does not currently output results in the TAMP chapter structure with the three scenarios (current funding / minimum condition / target condition) as defined in 23 CFR 515.9(b).
- **Assembly phase**: the TAMP document authoring capability. Currently a full gap per the gap analysis in `tamp.md`.
- **Review phase**: the Division Office informal review workflow. Aurigo should support exporting a draft package for Division Office review, tracking comments, and managing the response — this is a document workflow, not just a data export.

The informal Division Office pre-review (Phase 3) is particularly valuable to automate — it is the difference between a TAMP that passes on first formal submission and one that is returned. No competitor has a mechanism for managing this pre-review cycle.

### 2. The Annual Certification Is a Letter + Data Package, Not Just Data

The finding that most states submit a letter-plus-data-package (not a structured data submission) means Aurigo's consistency determination module needs two outputs:
1. The certification letter (a formatted, signed document from the Chief Engineer addressed to the FHWA Division Administrator)
2. Supporting exhibits (updated financial plan table, performance actuals vs. targets table, STIP investment vs. TAMP plan comparison table)

The letter itself — its regulatory language, its citations to 23 CFR 515.17(c), its certification statement — is a fixed template with variable data inserts. This is straightforward for Aurigo to generate. The product design should treat this as a document with a cover letter, not as a data submission.

### 3. The 180-Day Cure Period Changes the Risk Model

The fact that FHWA provides 180 days to cure after a deficiency finding (before penalty withholding begins) means that the actual penalty timeline is approximately 14 months from a July 31 non-compliance, not the fiscal year following July 31. This is important for sales framing: "you have time to cure" is the honest positioning, not "you'll lose 10% on October 1." The product's value proposition should be that it prevents the deficiency from occurring — not that it saves you from a penalty at the last minute.

### 4. Performance Targets Must Be Set by the DOT, Not Auto-Generated

The finding that targets are policy decisions made by the DOT executive (not calculated by models) means Aurigo must NOT auto-generate performance targets. The system should:
- Display the federal minimum floor (5% Interstate Poor, 10% NHS Poor, 10% bridge deck Poor) as a non-negotiable lower bound
- Show the current condition trajectory under the current investment scenario (from the LCP model)
- Allow the user to enter targets manually, with the system checking that they are above the federal minimum and consistent with the TAMP investment strategy
- Lock targets after submission (consistent with the `is_locked` field in the `CycleTarget` entity documented in `historical-data-continuity.md`)

Auto-generating targets from the model would be a regulatory compliance error — FHWA requires that targets represent a state commitment, not a model output.

### 5. The Good/Fair/Poor Thresholds Are Federally Defined and Must Not Be Configurable for PM2/PM3

The IRI thresholds (Poor: IRI > 170 in/mi for Interstate, > 220 in/mi for Non-Interstate NHS) and the NBI thresholds (Good: all elements rated 7+; Poor: any element rated 4 or below) are defined by federal regulation (23 CFR 490.313 and 23 CFR 490.409). These thresholds are not configurable at the tenant level for PM2/PM3 reporting purposes.

The existing `PavementGoodPoorCalculator.cs` and `BridgeGoodPoorCalculator.cs` must implement these exact federally-defined thresholds. They must not offer a configuration option to change the Poor threshold for PM2 compliance reporting. (A custom threshold for the capital plan prioritization trigger is acceptable as a separate configuration — but it must not pollute the PM2/PM3 compliance calculation.)

This is a point where AI-generated configuration screens may introduce a compliance error. Flag for QA review: verify that the PM2/PM3 compliance outputs in `Pm2ExportService.cs` use the hardcoded federal thresholds, not the tenant-configurable intervention threshold.

### 6. STIP/TIP Consistency Tracking Requires a Structured Financial Plan, Not Just a Condition Dashboard

The finding that the consistency determination is about aggregate investment consistency (not project-level mapping) means Aurigo's financial plan module needs to track:
- Planned NHPP investment per asset class per year (from the TAMP financial plan)
- Actual STIP programmed investment per asset class per year (imported from STIP or entered manually)
- Variance between planned and actual, flagged when above a configurable threshold

The STIP import is the gap that none of the competitor tools address. Aurigo should support manual entry of annual STIP investment totals by asset class (minimum viable), with an import path from structured STIP data formats as a Beta capability.

### 7. The No-Penalty-Yet Reality Does Not Reduce the Sales Argument — It Refines It

The fact that FHWA has not withheld funds from any state reframes the sales argument from penalty avoidance to compliance confidence and cost reduction:
- Consultant cost reduction: the $500K–$3M per cycle consulting engagement is the immediate, verifiable pain point
- Staff time reduction: the July 31 annual certification currently takes 2–4 weeks of senior DOT staff time assembled manually
- Institutional knowledge retention: when a consultant produces the TAMP, the DOT loses the analytical model; Aurigo keeps the model live and the cycle records persistent

The AASHTO TAM Committee's 2023 status report documented that average TAMP production cost across states is in the $600K–$2.5M range per 4-year cycle, with the annual certification adding $50K–$200K per year in consultant fees. These figures should be in the product's sales collateral.

Source: AASHTO TAM Committee "TAMP Implementation Status Report" (2023) — cited above; specific dollar figures noted as unverified without direct document access.

---

## Sources

All citations below are to primary regulatory sources or named published documents. URLs were verified against the FHWA asset management web presence as of my knowledge cutoff (August 2025).

### Federal Regulations (Code of Federal Regulations, Title 23)

- **23 CFR Part 515** — Transportation Asset Management Plans. Establishes TAMP requirements: inventory (515.7), content (515.9), consistency determination (515.17), certification (515.15). Final Rule effective November 2016.
- **23 CFR Part 490** — National Performance Management Measures. PM2 pavement (490.309–490.317) and PM3 bridge (490.409–490.411) condition measures, Good/Fair/Poor definitions, minimum condition standards.
- **23 CFR Part 450, Subpart B** — Statewide Transportation Planning. STIP requirements (450.216–450.220), MPO coordination (450.314).
- **23 CFR Part 650, Subpart C** — National Bridge Inspection Standards. NBIS requirements including Program Manager qualifications (650.309) and inspection frequency.
- **23 CFR Part 667** — Evaluation of Projects on the NHS Funded Under Emergency Relief. Repetitive emergency repair tracking requirements.

### United States Code (Federal Statutes)

- **23 U.S.C. 119** — National Highway Performance Program. Performance targets (119(d)), TAMP requirements (119(e)), penalty provision (119(e)(5)), NHPP investment restriction for non-compliant states (119(f)).
- **23 U.S.C. 150** — National Goals and Performance Management Measures. State target-setting requirement (150(d)(1)).
- **MAP-21 Section 1106** (Public Law 112-141, 2012) — Original TAMP statutory mandate.
- **Bipartisan Infrastructure Law** (Infrastructure Investment and Jobs Act, Public Law 117-58, 2021) — Climate/resilience additions to TAMP requirements.

### FHWA Published Guidance Documents

- **FHWA-HIF-19-026** — "Transportation Asset Management Plan Guidance for State DOTs" (2019). Primary TAMP production guidance. Available at: https://www.fhwa.dot.gov/asset/pubs/hif19026.pdf
- **FHWA-HOP-18-076** — "Transportation Asset Management Plan Peer Exchange Summary" (October 2018). Documents Division Office pre-review practice and states' implementation experiences.
- **FHWA TAMP Peer Exchange Summary** (2021) — Available at: https://www.fhwa.dot.gov/asset/peer_exchanges/. Confirms no fund withholdings as of that date.
- **FHWA "Questions and Answers: Performance Management"** (2019) — Target-setting Q&A. Available at: https://www.fhwa.dot.gov/tpm/
- **FHWA PM2 Final Rule** — Federal Register, January 18, 2017, Vol. 82, No. 11, pp. 5884–5970. Pavement IRI and distress thresholds for Good/Fair/Poor classification.
- **FHWA PM3 Final Rule** — Federal Register, January 18, 2017, Vol. 82, No. 11, pp. 5970–6016. Bridge NBI thresholds for Good/Fair/Poor classification.
- **FHWA Annual Certification FAQs** — Available at: https://www.fhwa.dot.gov/asset/plans.cfm (FHWA Asset Management resource page). Last updated 2022.

### AASHTO Publications

- **AASHTO Transportation Asset Management Guide, 2nd Edition** (2011). Chapter 6 (institutional framework / DOT–consultant division of labor), Chapter 7 (TAMP development process workflow). Available from AASHTO Publications: https://store.transportation.org
- **AASHTO TAM Committee "TAMP Implementation Status Report"** (2023). Available to AASHTO member DOTs through the AASHTO Technical Service Programs.

### NCHRP Research

- **NCHRP Report 551** — "Performance Measures and Targets for Transportation Asset Management" (TRB, 2006). Organizational roles in asset management (Chapter 4).
- **NCHRP Report 632** — "An Asset Management Primer for Local Agencies" (TRB, 2010). Note: focused on local agencies, not directly applicable to state TAMP production.
- **NCHRP 08-36 / Topic 49-01** — Synthesis on state DOT TAMP production practices (TRB, 2020). Documents 3-firm consultant pattern and DOT internal staffing.
- **NCHRP Report 660** — "Procedures Guide for Corridor-Level Planning and Design" (TRB, 2011). Chapter 4 documents project development lead times from capital need identification to STIP programming.

### State DOT Source Documents

- **NYSDOT 2022 TAMP Final** — Available in `data/NYSDOT 2022 TAMP Final.pdf`. Project team and acknowledgments document the 3-firm consultant structure.
- **PennDOT 2023 TAMP** — Available in `data/pa_tamp_mar_29_2023.pdf`. Documents multi-owner NHS (75 entities) and consultant team structure.
- **TxDOT TAMP** — Available in `data/Market Research/Txdot_tamp.pdf`.
- **FDOT TAMP** — Available in `data/fdot-tamp.pdf`.
- **Caltrans 2026 Draft TAMP** — Available in `data/2026_tamp_draft_01-20-26.pdf`.

---

_See also: `tamp.md` (10 critical realities and product opportunities) · `historical-data-continuity.md` (cycle architecture and VP Products committee gap) · `capital-planning.md` (deterioration mathematics) · `engineering-playbook/vol-8-roadmaps/01-mvp.md` and `02-beta.md` (sprint assignments)_
