---
product: Masterworks Maintain
audience: internal-gtm
persona: all
stage: final
sources:
  - Asset condition management_ product walkthrough and feedback.docx
  - aurigo-maintain-prd-v1.docx
  - GTM-War-Room/BRAND-DNA/*
date: 2026-08-07
---

# Masterworks Maintain — Positioning & Messaging

## A1 · The Why (Golden Circle)

**Why**

Masterworks Maintain exists to make infrastructure capital planning defensible, repeatable, and software-driven — replacing the four-year consulting binder-and-done deliverable with a live platform that improves with every inspection cycle, moving DOTs from "which of my assets fails next and what will it cost?" to a FHWA-ready capital plan the investment committee can stand behind. In the customer's own framing, this completes the project life cycle: "projects never really die," and the remedy for infrastructure is determined from asset condition, so digitizing and automating that missing part into Masterworks helps owners close the loop.

**How**

Maintain closes the Aurigo project life cycle: asset condition → risk-ranked capital needs → defensible capital plan → charter in Aurigo Plan → execution in Aurigo Build → updated asset condition. It works as a companion app that bridges into the EAM tools agencies already run (Maximo, Cityworks, DTIMS, Esri/ArcGIS) via adapters rather than replacing them, storing and pulling third-party data, and it drafts TAMP narrative sections with AI-native drafting. It is built on Aurigo's new foundation platform.

**What**

Aurigo Maintain is an asset-based capital planning SaaS product built as a companion to Aurigo Plan and Aurigo Build, shipping as Masterworks Maintain (public sector) and Primus Maintain (private sector). The current build is the Masterworks Maintain prototype — a lightweight asset condition management companion app with connectors, built on the new foundation platform.

---

## A2 · Market & Category

**Category**

Maintain claims the capital planning + TAMP generation category. It is positioned against the consulting-only TAMP market (APTech, GFT, WSP charging $500K–$3M per cycle with no software) and is distinct from EAM/condition-recording tools (Maximo, Cityworks, DTIMS), requiring no displacement of those systems — connecting via adapters. As the customer put it, "we will not ask them to switch; the companion will only be utilized alongside what they already have." Primary differentiator: only TAMP-generation software in market, closing the Aurigo project life cycle.

⚠ To confirm: category naming conflict — the transcript names the category simply as "asset management," while the PRD claims "capital planning + TAMP generation."

**Why now**

IIJA (2021) pushed $1.2T into US infrastructure, pressuring DOTs to prove capital plans are data-driven and auditable; AI tooling has matured enough to draft TAMP narrative sections reliably; Atom AI is moving toward capital planning, giving a 12–18 month window; and Caltrans has an active RFI (Aug 2026) for cross-asset capital planning software. On top of this, existing solutions for large agencies are "decades old" with old architecture and user experience, expensive licenses, and poor integration into capital programs, while TAMP publication is required once every four years, creating recurring urgency.

**Market context**

Third-party figure: IIJA (2021) pushed $1.2T into US infrastructure. Both source candidates agree DOTs pay approximately $500K–$3M every four years for a TAMP release, and the bottom end is a high-volume market of thousands of agencies — but no third-party source or date is cited for these consulting costs (internal research only). Additional internal PRD market figures (not third-party sourced): Combined TAM $430M, SAM $125M, SOM $15M ARR by FY2029; NHPP federal match drops 80%→65% for non-compliance under 23 U.S.C. 119(e)(5)(A).

⚠ To confirm: TAM/SAM/SOM figures are internal PRD estimates, not third-party sourced.

---

## A3 · Best-Fit Customer & ICP

**Best fit**

A mid-size state Department of Transportation (5,000–20,000 miles NHS, e.g. Nevada, Iowa, Hawaii, Wisconsin) that is already an Aurigo Plan customer, with a 4-year TAMP cycle approaching and a current consulting contract costing $500K–$900K. Entry is as an add-on SKU to that existing capital planning; smaller agencies (Excel replacement) are explicitly not the ideal customer profile.

⚠ To confirm: best-fit conflict — the transcript characterizes best-fit as "DOTs / large agencies," while the PRD specifies mid-size state DOTs and defers large state DOTs to Wave 2+.

**Segments**

Priority order: Wave 1 targets the 51 existing Aurigo Plan state DOT accounts (primary ICP). Public segments follow as state DOTs, then transit agencies (FTA TAM obligation), then local government (cities/counties, Excel-replacement, slow cycle). Wave 3 adds private-sector IOU utilities via Primus Maintain. This matches the transcript's two-ends framing: the top end (DOTs / large agencies) is the primary target entering via the capital-planning add-on, while the bottom end (cities, counties, small agencies) is high-volume Excel replacement but not the ICP — smaller governments own few transportation assets and care more about buildings and other assets.

**Who's in the room**

Public-sector roles: Capital Planning Director, Asset Management Engineer, and TAMP Program Manager (primary ICP titles). Secondary: Finance Director / CFO, who — as the customer put it — "when the budget hearings come, they need one live number for capital needs" and needs to satisfy audit obligations. The transcript also references a public works director (PWD) at smaller agencies. The economic buyer is not explicitly named; the sales motion is Customer Success expansion into existing Aurigo Plan accounts requiring no new RFP at the $70–100K entry level.

**Buying triggers**

A 4-year TAMP cycle approaching under 23 CFR Part 515 while a current consulting contract costs $500K–$900K; IIJA pressure to show data-driven, auditable plans. As the customer framed it, "when the TAMP season arrives, which is once every four years," agencies need funded, defensible condition data. Additional triggers: a smaller agency's asset list outgrowing Excel, and finance budget hearings requiring one live capital-needs number. Private-sector trigger: a PUC rate case filing in 12–18 months requiring a risk-justified, auditable capital plan.

**Not a fit**

Out-of-ICP for Wave 1: small cities/counties (low ACV $15–40K, long sales cycles, non-transportation assets dominate — Excel-replacement only, not a proactive target); and large state DOTs (TX, CA, FL, NY) with formal procurement thresholds, deferred to Wave 2+ until a mid-size DOT FHWA reference exists. The customer describes the bottom-end small-agency segment vividly as "cheap and slow and dispersed" — low appetite for cost (won't pay more for an EAM tool), a very slow sales process (as seen with Essentials), and a dispersed buyer base.

---

## A4 · Competitive Alternatives & Right to Win

**Alternatives**

Buyers today use consultant-driven TAMP production (APTech, GFT, WSP, Jacobs, Stantec — the transcript also names Gannett Fleming — charging $500K–$3M per cycle with no software), condition data siloed across Maximo, Cityworks, Esri/ArcGIS (Caltrans using only ArcGIS), DTIMS, PONTIS, and BRM systems that don't talk to each other, and manual Excel pivot tables / custom models to identify and prioritize capital needs. Deterioration and single-asset planning is done in tools such as AASHTOWare BRM (bridges) and DTIMS (pavements), with emerging condition-recording players like Atom AI. Cross-asset optimization is done manually by experienced engineers, and the capital plan goes stale when the consultant's contract ends.

**What they can't copy**

1. No software competitor generates TAMP narrative sections — TAMP generation is today a consulting-only space, and this is Maintain's most defensible v1 moat ("right now none of the players have something like this").
2. Capital program and delivery connected natively to the Maintain product, closing the Aurigo project life cycle with Plan + Build integration no competitor has.
3. Cross-asset-class capital planning optimization, a scaling gap not well served by existing players.
4. Regulatory stickiness — once a DOT runs its first TAMP cycle in Maintain, condition history and scenario library live inside the platform, creating high switching cost.

**Proof it's real**

Maintain is a v1 product with no production reference customers. Right-to-win proof is the installed base it attaches to: 51 existing Aurigo Plan DOT accounts (Wave 1 target), Nevada DOT ($3.7M ARR) as confirmed pilot anchor, and native Plan + Build integration listed as live capability in v1.

---

## A5 · Positioning Statements

**Geoffrey Moore (classic)**

For mid-size state DOTs already running Aurigo Plan who face a four-year TAMP cycle and a $500K–$900K consulting contract, Masterworks Maintain is asset-based capital planning software that turns asset condition into a risk-ranked, FHWA-ready capital plan and drafts the TAMP itself. Unlike consulting-only TAMP production (APTech, GFT, WSP) and condition-recording EAM tools (Maximo, Cityworks, DTIMS) that capture data but cannot plan, Masterworks Maintain closes the Aurigo project life cycle — connecting asset condition to Aurigo Plan and Aurigo Build via adapters, with no rip-and-replace — so the capital plan stays live between cycles instead of going stale when the consultant's contract ends.

**April Dunford (components)**

| Component | Statement |
|---|---|
| **Market category** | Capital planning + TAMP generation software. ⚠ To confirm: transcript names the category "asset management" while the PRD claims "capital planning + TAMP generation." |
| **Best-fit customers** | Mid-size state DOTs (5,000–20,000 miles NHS) that are existing Aurigo Plan customers, with a 4-year TAMP cycle approaching and a current consulting contract of $500K–$900K; entering as an add-on SKU. |
| **Competitive alternatives** | Consultant-driven TAMP production (APTech, GFT, WSP, Jacobs, Stantec, Gannett Fleming, $500K–$3M/cycle, no software); siloed EAM/condition tools (Maximo, Cityworks, DTIMS, PONTIS, Esri/ArcGIS, AASHTOWare BRM); manual Excel pivot tables and custom models. |
| **Unique attributes** | Only TAMP-generation software in market (AI-native narrative drafting); native Plan + Build integration closing the Aurigo project life cycle; cross-asset-class capital planning optimization; connects via adapters with no displacement of existing systems; regulatory stickiness once the first TAMP cycle runs in-platform. |
| **Value & proof** | A funded, defensible TAMP the investment committee can stand behind, kept live between cycles — success defined as FHWA approving the TAMP on first submission and consulting spend reduced ≥40%. Proof: 51 existing Aurigo Plan DOT accounts, Nevada DOT ($3.7M ARR) confirmed pilot anchor, native Plan + Build integration live in v1. (v1 product, no production reference customers yet.) |

Sources: GTM-War-Room/BRAND-DNA/positioning-and-icp.md; GTM-War-Room/BRAND-DNA/brand-voice.md; GTM-War-Room/BRAND-DNA/gtm-rules.md; GTM-War-Room/BRAND-DNA/our-customer.md; PMM-approved questionnaire answers (Asset condition management_ product walkthrough and feedback.docx, doc_id 9097d335-84cd-46cd-8f37-68012877f541; aurigo-maintain-prd-v1.docx, doc_id 4862c74b-5d06-4733-8cbe-2464746a026f).

## B1 · Umbrella Message & Taglines

**Hero umbrella message**

Every four years, TAMP season arrives and the capital plan you paid a consultant $500K–$900K to build is already out of date. Masterworks Maintain turns asset condition into a risk-ranked, FHWA-ready capital plan — and keeps it live between cycles instead of resetting when the consultant's contract ends.

**Positioning opener**

Capital planning teams at state DOTs are measured on one thing at TAMP season: producing a funded capital plan the investment committee can stand behind, approved by FHWA on first submission. Masterworks Maintain gives them a software-driven way to get there — closing the Aurigo project life cycle from asset condition through Aurigo Plan and Aurigo Build, without displacing the EAM systems already in place.

**Taglines**

- **One-liner (≤10 words):** Turn asset condition into an FHWA-ready capital plan.
- **Short (~25 words):** Masterworks Maintain turns asset condition into a risk-ranked, FHWA-ready capital plan — and keeps it live between cycles instead of going stale when the consultant leaves.
- **Long (~50 words):** For mid-size state DOTs facing a four-year TAMP cycle, Masterworks Maintain replaces the binder-and-done consulting deliverable with a live, software-driven capital plan. It turns asset condition into risk-ranked capital needs, drafts TAMP narrative sections with AI-native drafting, and pushes confirmed needs into Aurigo Plan — closing the Aurigo project life cycle.

---

## B2 · Top Value Pillars

| Pillar | What it means for the customer | Proof |
|---|---|---|
| **A capital plan the investment committee can stand behind** | Turn siloed condition data into a risk-ranked capital plan with an auditable trail from asset condition to funded need — the plan appropriators and FHWA can approve on first submission. | Success metric: FHWA approves TAMP on first submission. Capital Needs Pipeline auto-generates risk-ranked needs with recommended priority and source label; automatic audit log via EF SaveChangesInterceptor. |
| **A plan that stays live between cycles** | The capital pipeline no longer resets every four years. Each inspection recalculates condition, remaining useful life, and asset replacement value, so the plan improves continuously instead of going stale when the consultant's contract ends. | Condition Recording & Inspection recalculates condition grade, RUL, and ARV on each inspection and flags the capital pipeline. |
| **Lower TAMP cost, faster production** | Produce the TAMP with software instead of a $500K–$3M consulting-only engagement, cutting production time and spend while keeping the work in-house and auditable. | V1 drafts ~20–30% of a complete TAMP with AI-native narrative drafting; reduces consulting spend 40–60% in the production phase; economic-buyer success defined as consulting spend reduced ≥40%. |
| **One connected life cycle, no rip-and-replace** | Push confirmed capital needs straight into the capital program instead of email and manual re-entry — and keep Maximo, Cityworks, DTIMS, and Esri/ArcGIS in place, connected via adapters. | Native Plan + Build integration listed as live capability in v1; connects to existing EAM systems via adapters, eliminating the largest sales-cycle objection (displacement). |

---

## B3 · What It Does

**Plain language**

Day to day, Masterworks Maintain gives DOT teams a single view of their asset portfolio — work orders committed, inspection activity, urgent capital needs, condition status, remaining useful life, and performance against targets — alongside a financial planning and scenario view. Teams register and browse assets, record inspections and track condition over time, see which assets are approaching end of life, generate risk-ranked capital needs, run budget scenarios, draft a TAMP report, and push confirmed needs into Aurigo Plan as project charters that flow out to Aurigo Build as work and job orders.

**Product description**

Masterworks Maintain is an asset-based capital planning application that closes the Aurigo project life cycle: asset condition → risk-ranked capital needs → capital plan → charter in Aurigo Plan → execution in Aurigo Build → updated asset condition. Assets import via Excel, GIS sync, or API connector into the asset registry; each inspection recalculates condition grade, RUL, and ARV and pulls at-risk assets into the capital pipeline. A scenario and life cycle planning engine runs unconstrained, budget-cap, or do-nothing scenarios against a treatment library to auto-generate risk-ranked needs, and AI-native drafting produces TAMP narrative sections for review, lock, and PDF export. It works as a companion app alongside the EAM tools agencies already run, connecting via adapters rather than replacing them.

---

## B4 · Messaging Matrix

| Customer pain (persona) | Capability | Why-us advantage | Benefit |
|---|---|---|---|
| TAMP production is entirely consultant-driven at $500K–$3M per cycle, with no software (Economic buyer) | TAMP Report Generation with AI-native narrative drafting | No software competitor generates TAMP narrative sections — this is the only TAMP-generation software in market | Produce the TAMP in-house, cut consulting spend ≥40%, and keep the work auditable |
| The capital plan goes stale the moment the consultant's contract ends; there is no continuous model (Economic buyer) | Condition Recording & Inspection recalculating condition, RUL, and ARV | Closes the Aurigo project life cycle so the plan stays live between cycles inside the platform | A capital pipeline that improves with every inspection instead of resetting every four years |
| Capital needs are identified in one spreadsheet and prioritized in another, with no single auditable pipeline (Economic buyer) | Capital Needs Pipeline + Scenario / LCP Engine | Cross-asset-class capital planning optimization no siloed EAM tool provides, with automatic audit logging | One risk-ranked, auditable pipeline the investment committee can stand behind |
| Finance needs one live number for capital needs at budget hearings — not a consultant's PDF from 18 months ago (Finance owner) | Financial planning dashboard + scenario planner | Live condition-to-cost model rather than a point-in-time consulting deliverable | A current capital-needs figure ready for appropriations testimony and real-time follow-up |
| The total replacement value of transportation assets is a complex, periodically audited calculation with no automated recalculation (Finance owner) | RUL / ARV / Risk models | ARV recalculates automatically on condition change instead of a spreadsheet maintained by the asset team | Satisfies the ARV audit obligation with a repeatable, current figure |
| Condition data lives in multiple siloed systems with no cross-asset view (Primary user) | Asset Registry with import via Excel, GIS sync, and Maximo/Cityworks connectors | Connects via adapters with no displacement of existing systems — eliminating the largest sales-cycle objection | A single cross-asset view without ripping out Maximo, Cityworks, DTIMS, or Esri/ArcGIS |
| 'What-if' scenarios are custom Excel models — not reproducible, undocumented assumptions, no comparison (Primary user) | Scenario / LCP Engine (unconstrained / budget cap / do nothing, with NPV) | Reproducible, documented scenarios against a configurable treatment library | Compare funding scenarios under budget constraints and defend the chosen path |
| Needs are pushed to Aurigo Plan via email and manual re-entry, with status not tracked back (Primary user) | Capital Program Integration — one-click push to Aurigo Plan as draft charters, status synced back | Native Plan + Build integration no competitor has | Confirmed needs move to the capital program without re-keying, with charter status visible end to end |

---

## B5 · Key Capabilities & Agent Catalog

| Item | Group | What it does | Outcome |
|---|---|---|---|
| Asset Registry | Module 1 (core) | Multi-class asset import via Excel, GIS sync, or API connector; hierarchical view, map view, asset forms | A single cross-asset view of the portfolio |
| Condition Recording & Inspection | Module 2 (core) | In-platform inspection form or third-party pull; recalculates condition grade, RUL, and ARV per inspection | Condition data that stays current and flags the capital pipeline |
| RUL / ARV / Risk | Module 3 (core) | Foundation models calculate remaining useful life, asset replacement value, and replacement value, plus an audit report | Surfaces assets approaching end of life; satisfies the ARV audit obligation |
| Capital Needs Pipeline | Module 4 (core) | Auto-generates risk-ranked needs at condition thresholds with recommended priority and source label | One auditable, risk-ranked needs pipeline |
| Scenario Planning / LCP Engine | Module 5 (core) | Runs unconstrained / budget-cap / do-nothing scenarios against a treatment library, by horizon and prioritization method (risk, RUL, benefit-cost ratio), with NPV and auto-bundling | Reproducible funding scenarios teams can compare and defend |
| Job Orders / Work Bundles | Module 6 (strategic differentiator) | Turns work bundles into work orders and job orders pushed to Aurigo Build | Confirmed work flows to delivery without re-keying |
| TAMP Report Generation | Module 7 (strategic differentiator) | AI-native drafting of TAMP narrative sections (~20–30% of a complete TAMP); select scenarios, set horizon, review, lock, export PDF | Reduces consulting spend 40–60% in the production phase |
| Capital Program Integration | Module 8 (strategic differentiator) | One-click push of confirmed needs to Aurigo Plan as draft charters, with charter status synced back | Closes the Aurigo project life cycle with no manual re-entry |
| Configuration & Domain Profile | Module 9 | Tenant-level configuration of asset class definitions, condition grading thresholds, deterioration model selection, treatment libraries, and form fields; public vs. private domain profile; role-based access (Admin, Planner, Inspector, Viewer) | Adapts to each agency's standards and reporting obligations |
| Dashboard (financial planning dashboard + scenario planner) | User-facing surface | Overview of committed work orders, inspection activity, urgent capital needs, condition status, RUL, performance vs. targets, and a basic risk register | One place to see program status and plan funding |
| Connectors (ArcGIS/Esri, next-gen Masterworks Plan, build product) | Integration layer | Bridges into EAM tools agencies already run via adapters, storing and pulling third-party data | No displacement of Maximo, Cityworks, DTIMS, or Esri/ArcGIS |

⚠ To confirm: no named AI agents are described in the approved answers — TAMP narrative drafting is AI-native (Claude), but the questionnaire does not define discrete, named agents for Maintain.

---

## B6 · The AI Story & Platform

**What the platform makes possible**

Capital planners have never had software that moves from asset condition all the way to a funded capital plan and the TAMP narrative itself. Masterworks Maintain does — because it is built as a sibling microservice to MW Platform 2.0, Aurigo's new foundation platform, and grounded in a 10-DOT TAMP study used to configure section templates and data mappings. Asset forms were configured to HPMS and NBI standards. AI-native drafting (Claude) produces the TAMP narrative sections, while the dashboards, scenarios, treatment logic, and section templates run on that shared foundation.

**Architecture layers**

- **API / Application / Domain / Infrastructure** — .NET 8 Web API on Clean Architecture.
- **Calculation engines** — pure, stateless logic in Application/Calculations (no DB or IO), driving RUL, ARV, risk, and scenario math.
- **External integrations** — stubbed behind interfaces in Infrastructure/ExternalClients (Maximo, Cityworks, DTIMS, Esri/ArcGIS adapters).
- **Data layer** — EF Core 8 + Npgsql on PostgreSQL 16 with PostGIS 3.4 (SRID 4326).
- **Frontend** — React 18 SPA (Vite, TypeScript).
- **Platform registration** — Swagger registered into AWS API Gateway as a sibling microservice to MW Platform 2.0.

**Enterprise trust (certification wording verbatim from B6-Q3)**

- Multi-tenancy via tenant_id on every aggregate root with an EF Core global query filter applied automatically.
- JWT auth reusing Aurigo's lambda-authorizer claim shape.
- An automatic audit log via EF SaveChangesInterceptor (audit code not written in handlers).
- Asset forms configured to HPMS and NBI standards for government agencies.
- No formal certifications (e.g. FedRAMP) are stated for Maintain in this document.

⚠ To confirm: Maintain-specific certification status (FedRAMP / ISO 42001) — none stated in the approved answers.

**Why it's different**

- Only TAMP-generation software in market — no software competitor generates TAMP narrative sections.
- Native Plan + Build integration closes the Aurigo project life cycle; no competitor connects capital planning to delivery this way.
- Cross-asset-class capital planning optimization, a scaling gap existing players do not serve well.
- Connects via adapters with no displacement of existing EAM systems, removing the largest sales-cycle objection.
- Regulatory stickiness: once a DOT runs its first TAMP cycle in Maintain, condition history and the scenario library live inside the platform.

Sources: GTM-War-Room/BRAND-DNA/positioning-and-icp.md; GTM-War-Room/BRAND-DNA/brand-voice.md; GTM-War-Room/BRAND-DNA/gtm-rules.md; GTM-War-Room/BRAND-DNA/our-customer.md; PMM-approved questionnaire answers (Asset condition management_ product walkthrough and feedback.docx, doc_id 9097d335-84cd-46cd-8f37-68012877f541; aurigo-maintain-prd-v1.docx, doc_id 4862c74b-5d06-4733-8cbe-2464746a026f); Approved Part A (Positioning).

## B7 · Proof Points & Testimonials

No customer proof points are cleared for use yet. This section will be populated once named references and quantified outcomes are approved for external use.

## C1 · Economic Buyer (Capital Program / PMO Director)

**Measured on**

Producing a funded, defensible TAMP the investment committee can stand behind. Success is defined two ways: FHWA approves the TAMP on first submission, and consulting spend is reduced ≥40%. The secondary measure is keeping a live capital pipeline that does not reset every four years.

**Top pain (approved answers)**

At TAMP season, this buyer needs all condition data funded and a plan they can stand behind — while agencies never get enough money to do everything and must still show appropriators exactly what the money bought. Today the TAMP production process is entirely consultant-driven at $500K–$3M per cycle with no software; condition data is siloed across Maximo, Cityworks, Esri, DTIMS, and PONTIS; needs are identified in one spreadsheet and prioritized in another with no single auditable pipeline; and, in their own words, "the capital plan becomes stale the moment the consultant's contract ends. There is no continuous model."

**Value prop**

Masterworks Maintain turns siloed asset condition into a risk-ranked, FHWA-ready capital plan and drafts the TAMP narrative sections itself — the only TAMP-generation software in market. It closes the Aurigo project life cycle from asset condition through Aurigo Plan and Aurigo Build, so the plan stays live between cycles instead of going stale when the consultant leaves. Capital planners produce the TAMP in-house, cut consulting spend ≥40%, and keep every risk-ranked need on an auditable pipeline the investment committee can stand behind.

**30-second elevator pitch**

"Every four years, TAMP season arrives and the plan you paid a consultant $500K to $900K to build is already 18 months out of date. Masterworks Maintain changes that. It turns your asset condition into a risk-ranked, FHWA-ready capital plan and drafts the TAMP narrative sections — the only software that does this job. Because it closes the loop from condition into Aurigo Plan and Aurigo Build, the plan stays live between cycles instead of resetting. You produce the TAMP in-house, cut consulting spend by at least 40%, and walk into the investment committee with a plan you can stand behind."

**Discovery questions**

1. When is your next TAMP due, and what did the current cycle cost you in consulting fees?
2. Between cycles, how do you keep the capital plan current — or does it effectively freeze the day the consultant's contract ends?
3. When FHWA or your investment committee asks how a need was prioritized, how long does it take you to trace it back to the condition data behind it?

---

## C2 · Finance & Budget Officer

**Measured on**

Defensible capital justification and audit compliance: one live number for capital needs at budget hearings, satisfying periodic audits of the total replacement value of transportation assets, and responding to political pressure — including ASCE infrastructure grades used in appropriations testimony.

**Top pain (approved answers)**

This owner needs "one live number for capital needs during budget hearings — not a consultant's PDF from 18 months ago," and must handle the complex, occasionally audited calculation of the value of the state's transportation assets. Today ARV is a spreadsheet maintained by the asset team with no automated recalculation on condition change, and answering follow-up questions in real time during testimony is difficult.

**Value prop**

Masterworks Maintain gives finance a live condition-to-cost model instead of a point-in-time consulting deliverable. Asset replacement value recalculates automatically on every condition change, satisfying the ARV audit obligation with a repeatable, current figure, and the financial planning dashboard produces one live capital-needs number ready for appropriations testimony and real-time follow-up.

**30-second elevator pitch**

"When budget hearings come, you need one live capital-needs number — not a consultant's PDF from a year and a half ago. Masterworks Maintain gives you that. Asset replacement value recalculates automatically every time condition changes, so the total replacement value figure you're audited on is always current and repeatable. And when an appropriator asks a follow-up you didn't expect, you can answer from a live model instead of promising to get back to them. It's the difference between defending last year's snapshot and standing behind today's numbers."

**Discovery questions**

1. Where does your total-asset-replacement-value figure live today, and who has to rebuild it when the auditors ask?
2. During budget testimony, how often do you get a follow-up question you can't answer from the numbers in front of you?
3. When condition changes in the field, how long before that shows up in the capital-needs figure finance reports?

---

## C3 · Primary User (Project / Portfolio Manager)

**Measured on**

Identifying which assets are approaching end of life, building a defensible capital needs pipeline, running reproducible "what-if" scenarios under budget constraints, and pushing confirmed needs into the capital program — continuously, and on the annual budget cycle.

⚠ To confirm: [Conflict] the PRD names the primary user as the asset management engineer / capital planning director, while the transcript names a smaller-agency public works director whose asset list "might outgrow Excel" as a low-end, non-ICP user.

**Top pain (approved answers)**

Condition data lives in multiple siloed systems with no cross-asset view. The capital needs pipeline is built in Excel pivot tables that are manual, not auditable, and break on personnel change. "What-if" scenarios are custom Excel models — not reproducible, with undocumented assumptions and no scenario comparison. And needs are pushed to Aurigo Plan by email and manual re-entry, with status not tracked back.

**Value prop**

Masterworks Maintain replaces the Excel pivot tables and custom models with one connected workflow: every inspection recalculates condition, RUL, and ARV and pulls at-risk assets into a risk-ranked pipeline. The scenario and life cycle planning engine runs unconstrained, budget-cap, and do-nothing scenarios against a configurable treatment library — reproducible and documented, so you can compare funding paths and defend the one you chose. Confirmed needs push one-click into Aurigo Plan as draft charters with status synced back, closing the Aurigo project life cycle with no re-keying. It connects to Maximo, Cityworks, DTIMS, and Esri/ArcGIS via adapters, so nothing gets ripped out.

**30-second elevator pitch**

"Right now your capital pipeline lives in pivot tables that only you understand and that break the day someone leaves. Masterworks Maintain gives you one cross-asset view — every inspection recalculates condition, remaining useful life, and replacement value and surfaces what's approaching end of life. You run reproducible budget scenarios against a treatment library instead of one-off Excel models, then push the confirmed needs straight into Aurigo Plan as charters, with status coming back to you. And it connects to Maximo, Cityworks, and ArcGIS through adapters — you keep the systems you already run."

**Discovery questions**

1. If the person who owns your capital-needs spreadsheet left tomorrow, could anyone else reproduce how those needs were prioritized?
2. When you run a budget-cut scenario, can you show the trade-offs and defend which assets got deferred — and reproduce it next year?
3. Once a need is approved, how does it get into the capital program today, and can you see its charter status without chasing an email?

---

## C4 · IT & Security

**Measured on**

⚠ To confirm: no approved answer states what IT & Security is measured on for Masterworks Maintain. Recommended intelligence input: a security/IT persona definition in the questionnaire (C-series) or a security review brief.

**Top pain (approved answers)**

⚠ To confirm: no approved answer captures IT & Security pains for Masterworks Maintain in the buyer's own words. The closest grounded facts are the platform's stated data-handling and multi-tenancy design (B6-Q3), not a stated IT/Security pain. Recommended intelligence input: a security-review call transcript or IT stakeholder interview.

**Value prop**

Masterworks Maintain is built as a sibling microservice to MW Platform 2.0 on .NET 8 Clean Architecture, with tenant isolation enforced automatically: multi-tenancy via tenant_id on every aggregate root with an EF Core global query filter applied automatically, JWT auth reusing Aurigo's lambda-authorizer claim shape, and an automatic audit log via EF SaveChangesInterceptor (audit code not written in handlers). External systems — Maximo, Cityworks, DTIMS, Esri/ArcGIS — connect through adapters stubbed behind interfaces, so Maintain integrates alongside existing systems with no rip-and-replace. Asset forms are configured to HPMS and NBI standards for government agencies.

⚠ To confirm: no formal certifications (e.g. FedRAMP) are stated for Maintain in the approved answers; Maintain-specific FedRAMP / ISO 42001 status is unconfirmed.

**30-second elevator pitch**

"Maintain runs as a sibling microservice to your MW Platform 2.0 environment, so it fits the architecture you already govern. Tenant isolation is enforced automatically on every record, authentication reuses Aurigo's existing claim shape, and every change writes to an automatic audit log — the audit trail isn't something a developer can forget to add. Integrations to Maximo, Cityworks, and ArcGIS sit behind adapter interfaces, so Maintain connects to your systems without touching what's already in production."

⚠ To confirm: certification posture (FedRAMP / ISO 42001) for Maintain before using this pitch in a security review.

**Discovery questions**

1. What are your requirements for tenant isolation and audit logging in a system that touches capital-planning data?
2. Which certifications (FedRAMP, ISO 42001, others) must a new platform meet before it can enter your environment?
3. How do you prefer new tools to integrate with Maximo, Cityworks, and ArcGIS — direct connectors, adapters, or a controlled API gateway?

Sources: GTM-War-Room/BRAND-DNA/positioning-and-icp.md; GTM-War-Room/BRAND-DNA/brand-voice.md; GTM-War-Room/BRAND-DNA/gtm-rules.md; GTM-War-Room/BRAND-DNA/our-customer.md; PMM-approved questionnaire answers (Asset condition management_ product walkthrough and feedback.docx, doc_id 9097d335-84cd-46cd-8f37-68012877f541; aurigo-maintain-prd-v1.docx, doc_id 4862c74b-5d06-4733-8cbe-2464746a026f); Approved Part A (Positioning); Approved Part B (Messaging).

## D1 · How We Stack Up Against the Alternatives

Capital planning teams at TAMP season are choosing between three ways to turn asset condition into a funded plan. Here is how those approaches compare on the four things that decide whether the plan holds up.

| Dimension | Masterworks Maintain | Bolt-on EAM / condition-recording tools (Maximo, Cityworks, DTIMS, PONTIS, AASHTOWare BRM, Atom AI) | Legacy / DIY (consulting engagement + Excel) |
|---|---|---|---|
| **Domain data** | Grounded in a 10-DOT TAMP study used to configure section templates and data mappings; asset forms configured to HPMS and NBI standards | Record and store condition data, but capture only — no TAMP-generation or capital-planning logic on top | Domain knowledge lives with the consultant and the experienced engineer; it walks out when the contract ends |
| **Where it runs** | Companion app that closes the Aurigo project life cycle — asset condition → risk-ranked needs → Aurigo Plan → Aurigo Build — connecting to existing EAM systems via adapters, no rip-and-replace | Siloed systems that don't talk to each other; needs are identified in one and prioritized in another | Binder-and-done deliverable plus manual Excel pivot tables and custom models |
| **Governance** | Automatic audit log via EF SaveChangesInterceptor; multi-tenancy via tenant_id on every aggregate root with an EF Core global query filter. ⚠ To confirm: no formal certifications (e.g. FedRAMP) stated for Maintain in the approved answers | No single auditable pipeline from condition to funded need | Manual, not auditable, breaks on personnel change |
| **Time to value** | Add-on SKU to existing Aurigo Plan, no new RFP at the $70–100K entry level; drafts ~20–30% of a complete TAMP with AI-native drafting; reduces consulting spend 40–60% in the production phase (v1 product, no production reference customers yet) | Deliver condition data but leave the plan and the TAMP to be built elsewhere | 12–18 months of consultant-led production; plan goes stale the moment the contract ends |

---

## D2 · Where the Competition Is

| Alternative | Where they are today (with dates) | How we win |
|---|---|---|
| **Consulting-only TAMP firms** — APTech, GFT, WSP, Jacobs, Stantec, Gannett Fleming | Own the TAMP production process end to end at $500K–$3M per cycle, with no software platform doing the job (no third-party source/date cited — internal research only) | Only TAMP-generation software in market: AI-native narrative drafting produces ~20–30% of a complete TAMP in-house, cutting consulting spend 40–60% in the production phase and keeping the plan live between cycles instead of stale when the contract ends |
| **EAM / condition-recording tools** — Maximo, Cityworks, DTIMS, PONTIS, AASHTOWare BRM, Esri/ArcGIS (Caltrans using only ArcGIS) | Installed and recording condition today; systems don't talk to each other, so cross-asset planning is done manually | Connect via adapters with no displacement — a single cross-asset view and a risk-ranked capital pipeline on top of the systems already in place |
| **Atom AI (emerging condition-recording)** | Moving toward capital planning, giving a 12–18 month window to establish Aurigo as the capital planning layer; flagged UDOT watch-out to validate Atom AI is in ops, not capital planning | Native Plan + Build integration closes the Aurigo project life cycle — a connection no condition-recording entrant has; regulatory stickiness once the first TAMP cycle runs in-platform |
| **Caltrans RFI (market signal)** | Active RFI (Aug 2026) for cross-asset capital planning software | Cross-asset-class capital planning optimization is a scaling gap existing players don't serve well — and the category Maintain claims |

⚠ To confirm: competitor intelligence current as of source dates — verify before external use.

---

## D3 · Head-to-Head Battlecards

**Against consulting-only TAMP production (APTech, GFT, WSP, Jacobs, Stantec, Gannett Fleming)**
- **They say:** "We've delivered your TAMP for years — you get a finished, FHWA-ready deliverable without building anything."
- **You counter:** The deliverable is a binder that's out of date the day it's published, and the plan resets when the contract ends. Masterworks Maintain drafts the TAMP narrative sections with AI-native drafting and keeps the plan live between cycles — cutting consulting spend 40–60% in the production phase while the work stays in-house and auditable.
- **Trap to set:** Ask what happens to the capital pipeline the day after the engagement closes — and who recalculates condition, RUL, and ARV before the next cycle.

**Against siloed EAM / condition-recording tools (Maximo, Cityworks, DTIMS, PONTIS, AASHTOWare BRM, Esri/ArcGIS)**
- **They say:** "We already hold your condition data — you don't need another system."
- **You counter:** Those systems capture condition but can't turn it into a risk-ranked, auditable capital plan or the TAMP itself. Masterworks Maintain connects to them via adapters — no rip-and-replace — and adds cross-asset-class capital planning optimization on top.
- **Trap to set:** Ask how capital needs identified in one system get prioritized against needs in another today, and whether that pipeline is auditable.

**Against manual Excel / DIY models**
- **They say:** "Our engineers build the scenarios in Excel — it works and it's free."
- **You counter:** Custom Excel models aren't reproducible, carry undocumented assumptions, offer no scenario comparison, and break on personnel change. Masterworks Maintain runs unconstrained, budget-cap, and do-nothing scenarios against a configurable treatment library with NPV, so teams can compare funding paths and defend the chosen one.
- **Trap to set:** Ask who can rebuild the current model if the engineer who wrote it retires.

**Against emerging condition-recording AI (Atom AI)**
- **They say:** "We're adding AI and moving into capital planning."
- **You counter:** Recording condition is not planning capital. Masterworks Maintain closes the Aurigo project life cycle with native Plan + Build integration no condition-recording tool has, and once a DOT runs its first TAMP cycle in-platform, condition history and the scenario library live inside it.
- **Trap to set:** Validate whether the tool is in operations or in capital planning today. ⚠ To confirm: UDOT watch-out — validate Atom AI is in ops, not capital planning.

---

## D4 · Objection Handling

| Objection (raw language) | Counter (grounded in approved facts) |
|---|---|
| "We're not going to switch off Maximo / Cityworks / DTIMS." (Displacement — the largest objection in the sales cycle) | You don't have to. Masterworks Maintain works as a companion app that connects to the EAM tools you already run via adapters, storing and pulling third-party data rather than replacing it. As the customer framed it: "we will not ask them to switch; the companion will only be utilized alongside what they already have." This eliminates the largest objection in the sales cycle. |
| Buyer-readiness signal, VP Sales Michael Tooley (former DOT, Aug 3 2026 call): "If you showed this to Josh Moriarty … they would probably buy this right now … because they've got money and they've got needs." | Lean into it where the trigger is live: a 4-year TAMP cycle approaching under 23 CFR Part 515 against a $500K–$900K consulting contract, entering as an add-on SKU to existing Aurigo Plan with no new RFP at the $70–100K entry level. |
| "Isn't this just another AI tool making things up on a funding call?" | TAMP narrative drafting is AI-native (Claude) and grounded in a 10-DOT TAMP study, with every action recorded through an automatic audit log via EF SaveChangesInterceptor. The user reviews, locks, and exports each narrative section — AI drafts ~20–30% of a complete TAMP; the team stays in control of the plan. |

⚠ To confirm: the approved answers document only the displacement objection as raw buyer language (D4-Q1); other objections above are constructed from the readiness quote and the live AI objections in Brand DNA — verify against additional win/loss input before external use.

Sources: GTM-War-Room/BRAND-DNA/positioning-and-icp.md; GTM-War-Room/BRAND-DNA/brand-voice.md; GTM-War-Room/BRAND-DNA/gtm-rules.md; GTM-War-Room/BRAND-DNA/our-customer.md; PMM-approved questionnaire answers (Asset condition management_ product walkthrough and feedback.docx, doc_id 9097d335-84cd-46cd-8f37-68012877f541; aurigo-maintain-prd-v1.docx, doc_id 4862c74b-5d06-4733-8cbe-2464746a026f); Approved Part A (Positioning); Approved Part B (Messaging).

## E1 · Marketing Kit

**Campaign themes**

- **"The plan that doesn't go stale."** Every four years, TAMP season arrives and the capital plan a consultant built for $500K–$900K is already out of date. Masterworks Maintain keeps the plan live between cycles, so it improves with every inspection instead of resetting when the contract ends.
- **"From asset condition to FHWA-ready."** Capital planning teams are measured on one thing at TAMP season: a funded capital plan the investment committee can stand behind, approved by FHWA on first submission. Maintain turns asset condition into that plan.
- **"Close the loop, keep your systems."** Maintain closes the Aurigo project life cycle — asset condition → risk-ranked capital needs → capital plan → charter in Aurigo Plan → execution in Aurigo Build — connecting to Maximo, Cityworks, DTIMS, and Esri/ArcGIS via adapters, with no rip-and-replace.

**Funnel-stage messages**

| Stage | Message |
|---|---|
| Awareness (TOFU) | TAMP season comes once every four years — and the capital plan you paid a consultant to build is stale the moment the contract ends. There is now software-driven way to keep it live. |
| Consideration (MOFU) | Masterworks Maintain turns siloed condition data into a risk-ranked, FHWA-ready capital plan, drafts TAMP narrative sections with AI-native drafting, and pushes confirmed needs into Aurigo Plan — without displacing the EAM systems already in place. |
| Decision (BOFU) | Enter as an add-on to the Aurigo Plan capital program already in place. Success is defined the way agencies define it: FHWA approves the TAMP on first submission and consulting spend drops ≥40%. Native Plan + Build integration is live in v1. |

**Social / PR angles**

- IIJA (2021) pushed $1.2T into US infrastructure, and DOTs now have to prove their capital plans are data-driven and auditable — not a binder-and-done PDF from a consultant.
- The only TAMP-generation software in market: no software competitor drafts TAMP narrative sections today.
- ⚠ To confirm: no customer proof points are cleared for Masterworks Maintain specifically (v1 product, no production reference customers) — do not publish named outcomes until Customer Evidence clears them.

**Website copy blocks**

*Hero (above the fold):*
> Turn asset condition into an FHWA-ready capital plan.
> Masterworks Maintain replaces the four-year consulting deliverable with a live, software-driven capital plan that improves with every inspection cycle.

*Value block (from B2):*
> **A plan the investment committee can stand behind.** Turn siloed condition data into a risk-ranked capital plan with an auditable trail from asset condition to funded need.
> **A plan that stays live between cycles.** Each inspection recalculates condition, remaining useful life, and asset replacement value, so the plan improves continuously instead of going stale.
> **Lower TAMP cost, faster production.** Draft TAMP narrative sections with AI-native drafting and cut consulting spend 40–60% in the production phase.
> **One connected life cycle, no rip-and-replace.** Push confirmed needs straight into Aurigo Plan, and keep Maximo, Cityworks, DTIMS, and Esri/ArcGIS in place via adapters.

**Boilerplate**

> Masterworks Maintain is an asset-based capital planning application for government agencies, built as a companion to Aurigo Plan and Aurigo Build. It turns asset condition into a risk-ranked, FHWA-ready capital plan, drafts TAMP narrative sections with AI-native drafting, and closes the Aurigo project life cycle — connecting to the EAM systems agencies already run via adapters, with no displacement. Built on Aurigo's new foundation platform.
>
> ⚠ To confirm: official corporate boilerplate, trademark, and legal lines (per About Aurigo guardrail).

---

## E2 · Sales Kit

**Opener**

At TAMP season, your capital planning team is measured on one outcome: a funded plan the investment committee can stand behind, approved by FHWA on first submission. Today that means paying a consultant $500K–$900K for a plan that's stale the moment the contract ends. Masterworks Maintain gives your team a software-driven way to get there — and keeps the plan live between cycles.

**Elevator pitch**

Capital planning directors at state DOTs have to produce a defensible TAMP every four years — and right now the whole process is consultant-driven, with condition data siloed across Maximo, Cityworks, DTIMS, and Esri, and capital needs stitched together in spreadsheets that break when someone leaves. Masterworks Maintain turns asset condition into a risk-ranked capital plan, drafts the TAMP narrative sections with AI-native drafting, and pushes confirmed needs into Aurigo Plan as charters. Because it connects to the EAM systems you already run via adapters, there's no rip-and-replace. It's the only TAMP-generation software in market, and it closes the Aurigo project life cycle from condition through delivery — so the plan stays live between cycles instead of resetting every four years.

**Cold-email templates** (keyed to A3-Q4 triggers)

*Template 1 — trigger: 4-year TAMP cycle approaching + active consulting contract*

> Subject: Your next TAMP — before the consultant's contract resets it
>
> {First name}, with your next TAMP cycle approaching under 23 CFR Part 515, the plan your team produces has to be funded, defensible, and approvable by FHWA on first submission — and today that runs through a $500K–$900K consulting engagement that goes stale the moment the contract ends.
>
> Masterworks Maintain turns your asset condition data into a risk-ranked capital plan and drafts the TAMP narrative sections with AI-native drafting — keeping the plan live between cycles. It connects to Maximo, Cityworks, DTIMS, and Esri via adapters, so nothing gets ripped out.
>
> Worth 30 minutes to show you how it attaches to the Aurigo Plan program you already run?

*Template 2 — trigger: finance needs one live number at budget hearings*

> Subject: One live capital-needs number for budget hearings
>
> {First name}, when budget hearings come, your finance team needs one live number for capital needs — not a consultant's PDF from 18 months ago. And the total replacement value of your transportation assets is a complex, periodically audited calculation.
>
> Masterworks Maintain recalculates asset replacement value automatically on every condition change and gives finance a current capital-needs figure ready for appropriations testimony. It runs alongside the systems you already have, connecting via adapters.
>
> Open to a short walkthrough of the financial planning dashboard?

**Discovery script** (from the C discovery questions)

1. When is your next TAMP cycle, and what is your current consulting contract costing you per cycle?
2. Where does your condition data live today — Maximo, Cityworks, DTIMS, Esri/ArcGIS, or a mix? How do those systems talk to each other?
3. How do you build and prioritize your capital needs pipeline today — and is it auditable if FHWA asks?
4. When your consultant's contract ends, what happens to the plan? How current is it a year later?
5. At budget hearings, can finance produce one live capital-needs number and answer follow-ups in real time?
6. How do you handle the total-replacement-value audit on your transportation assets today?
7. When needs are confirmed, how do they get into your capital program — and can you track charter status back?

**MEDDIC-lite qualification**

| Element | What to confirm |
|---|---|
| **Metrics** | FHWA approves the TAMP on first submission; consulting spend reduced ≥40%. |
| **Economic buyer** | ⚠ To confirm: economic buyer not explicitly named in approved answers. Capital Planning Director / TAMP Program Manager is the measured owner; Finance Director / CFO is secondary. |
| **Decision criteria** | Defensible, FHWA-approvable plan; no displacement of existing EAM systems; live plan between cycles; lower consulting spend. |
| **Decision process** | Customer Success expansion into an existing Aurigo Plan account — no new RFP at the $70–100K entry level. |
| **Identify pain** | Consultant-driven TAMP at $500K–$3M/cycle with no software; siloed condition data; stale plan when the contract ends; no single auditable pipeline. |
| **Champion** | Capital Planning Director, Asset Management Engineer, or TAMP Program Manager carrying the TAMP deadline. |

**Red flags / walk-away signals** (from A3-Q5)

- Small cities or counties: low ACV ($15–40K), long sales cycles, non-transportation assets dominate — Excel-replacement only, not a proactive target ("cheap and slow and dispersed").
- Large state DOTs (TX, CA, FL, NY) with formal procurement thresholds — defer to Wave 2+ until a mid-size DOT FHWA reference exists.
- No existing Aurigo Plan relationship and no approaching TAMP cycle — outside the Wave 1 add-on motion.

**Advance-the-deal steps**

1. Confirm the account is an existing Aurigo Plan customer with a TAMP cycle approaching and an active consulting contract.
2. Run the discovery script; quantify current consulting spend and the cost of a stale plan.
3. Demo the condition → capital-needs → TAMP → Aurigo Plan flow against the customer's own asset classes.
4. Position as an add-on SKU — no new RFP at the $70–100K entry level.
5. Set success terms with the economic buyer: FHWA first-submission approval and ≥40% consulting-spend reduction.

---

## E3 · Proposals / RFP Kit

**Requirement-theme table**

| Requirement theme | Aurigo response | Proof |
|---|---|---|
| TAMP generation | Masterworks Maintain drafts TAMP narrative sections with AI-native drafting: select scenarios, set the planning horizon, review, lock, and export a PDF report. It is the only TAMP-generation software in market. | V1 drafts ~20–30% of a complete TAMP; reduces consulting spend 40–60% in the production phase; section templates grounded in a 10-DOT TAMP study. |
| Auditable capital needs pipeline | The Capital Needs Pipeline auto-generates risk-ranked needs at condition thresholds with recommended priority and a source label, backed by an automatic audit log. | Automatic audit log via EF SaveChangesInterceptor; success metric — FHWA approves TAMP on first submission. |
| Condition-driven, continuous planning | Each inspection recalculates condition grade, remaining useful life, and asset replacement value and flags the capital pipeline, so the plan stays live between cycles. | Condition Recording & Inspection module; RUL/ARV/Risk foundation models. |
| Scenario and life cycle planning | The Scenario / LCP Engine runs unconstrained, budget-cap, and do-nothing scenarios against a treatment library, by horizon and prioritization method (risk, RUL, benefit-cost ratio), with NPV and auto-bundling. | Module 5 (core), reproducible and documented scenarios. |
| Integration with existing systems | Maintain connects to Maximo, Cityworks, DTIMS, and Esri/ArcGIS via adapters — no displacement — and pushes confirmed needs to Aurigo Plan and work to Aurigo Build. | Native Plan + Build integration live in v1; external integrations stubbed behind interfaces in Infrastructure/ExternalClients. |
| Asset replacement value audit | Asset replacement value recalculates automatically on condition change, satisfying the periodic audit of total transportation-asset replacement value. | RUL / ARV / Risk models plus an audit report. |

**Technical differentiators**

- Only TAMP-generation software in market — no software competitor generates TAMP narrative sections.
- Native Plan + Build integration closes the Aurigo project life cycle from asset condition through delivery; no competitor connects capital planning to delivery this way.
- Cross-asset-class capital planning optimization, a scaling gap existing players do not serve well.
- Connects via adapters with no displacement of existing EAM systems, removing the largest sales-cycle objection.
- Regulatory stickiness: once an agency runs its first TAMP cycle in Maintain, condition history and the scenario library live inside the platform.
- Built as a sibling microservice to MW Platform 2.0 on .NET 8 (Clean Architecture), EF Core 8 + Npgsql, PostgreSQL 16 + PostGIS 3.4 (SRID 4326), React 18 frontend; registered into AWS API Gateway.

**Security boilerplate** (verbatim facts from B6-Q3)

- Multi-tenancy via tenant_id on every aggregate root, with an EF Core global query filter applied automatically.
- JWT auth reusing Aurigo's lambda-authorizer claim shape.
- An automatic audit log via EF SaveChangesInterceptor (audit code is not written in handlers).
- Asset forms configured to HPMS and NBI standards for government agencies.
- No formal certifications (e.g. FedRAMP) are stated for Maintain in this document.

⚠ To confirm: Maintain-specific certification status (FedRAMP / ISO 42001) — none stated in the approved answers.

**RFP FAQ**

1. **Do we have to replace Maximo, Cityworks, or DTIMS to use Maintain?**
No. Maintain connects to the EAM systems you already run via adapters, storing and pulling third-party data. There is no rip-and-replace — this eliminates the largest objection in the sales cycle.

2. **How much of the TAMP does the software produce?**
V1 drafts approximately 20–30% of a complete TAMP through AI-native narrative drafting, reducing consulting spend 40–60% in the production phase. Users select scenarios, set the horizon, review the drafted narratives, lock them, and export a PDF.

3. **How does the capital plan stay current between four-year cycles?**
Each inspection recalculates condition grade, remaining useful life, and asset replacement value and flags the capital pipeline, so the plan improves continuously instead of going stale when a consultant's contract ends.

4. **How do confirmed needs reach our capital program?**
Maintain pushes confirmed capital needs one-click into Aurigo Plan as draft charters, with charter status synced back, and work bundles flow to Aurigo Build as work and job orders — no email or manual re-entry.

5. **What are your certifications and data-handling practices?**
Maintain applies multi-tenancy with tenant_id on every aggregate root, JWT authentication, and an automatic audit log. Asset forms are configured to HPMS and NBI standards. No formal certifications (e.g. FedRAMP) are stated for Maintain in this document. ⚠ To confirm: Maintain-specific FedRAMP / ISO 42001 status.

Sources: GTM-War-Room/BRAND-DNA/positioning-and-icp.md; GTM-War-Room/BRAND-DNA/brand-voice.md; GTM-War-Room/BRAND-DNA/gtm-rules.md; GTM-War-Room/BRAND-DNA/our-customer.md; About Aurigo guardrail; PMM-approved questionnaire answers (Asset condition management_ product walkthrough and feedback.docx, doc_id 9097d335-84cd-46cd-8f37-68012877f541; aurigo-maintain-prd-v1.docx, doc_id 4862c74b-5d06-4733-8cbe-2464746a026f); Approved Part A (Positioning); Approved Part B (Messaging).

## F1 · Voice & Tone

- **Open from the reader's world.** Every Maintain asset starts with the capital planner's or finance director's situation — the TAMP cycle bearing down, the consultant's plan going stale, the auditor's question about replacement value — never from Aurigo or the product.
- **Customer is the hero; Maintain is the guide.** Write "DOT teams use Masterworks Maintain to build a defensible capital plan," never "Masterworks Maintain does X."
- **Confident and direct.** Short sentences, active voice, clear subject doing the action. No hedging words about what the product will do.
- **Precise outcomes over vague benefit words.** Name the outcome: FHWA approving the TAMP on first submission, one live capital-needs number at budget hearings, consulting spend reduced ≥40%. Avoid "better outcomes" or "greater efficiency."
- **Domain command, not jargon dropping.** Use the buyer's real vocabulary — TAMP, 23 CFR Part 515, NBI, HPMS, condition grade, remaining useful life, capital needs pipeline — because it signals fluency, not to sound expert.
- **Public-sector framing.** Government agencies run capital **programs**; use "program," never "portfolio," for Masterworks Maintain. Reserve "portfolio" for Primus Maintain / facility-owner content.
- **Never use ROI in public-sector copy.** Frame value as **program outcomes** or **capital program performance**. ROI framing is permitted only in Primus Maintain / commercial content.
- **AI-native is the only AI modifier.** Describe the TAMP-narrative drafting as AI-native and name the mechanism specifically (AI-drafted narrative sections). Do not use the retired hyphenated AI modifiers.
- **No "the" before an org abbreviation.** Write "FHWA requires," "NDOT runs its TAMP cycle," never "the FHWA."
- **"Do more with the same people."** Frame capacity gains as more program per person for lean teams — never as headcount reduction.
- **Binary contrast at most once per piece.** "This is not a consulting binder. It is a live capital plan." — use sparingly.
- **Em dashes: one to two per page.** American English throughout. No filler closers.
- **Every claim is traceable and swap-tested.** If a sentence would still read with a competitor's name in it, rewrite it around the unique attributes — TAMP-generation software, Plan + Build continuity, cross-asset-class optimization, regulatory switching cost.
- **No invented facts.** No unconfirmed numbers, no attributed customer quotes until cleared. Flag gaps with a "⚠ To confirm" callout rather than guessing.

## F2 · Preferred Word List

| Approved term | Rule it encodes |
|---|---|
| life cycle | Always two words — capital life cycle, project life cycle, asset life cycle. Never the single-word form. |
| infrastructure | Uncountable; never pluralized. Do not attach an "owners" suffix to it — say capital owners / public owners / facility owners instead. |
| capital owners / public owners / facility owners | Approved audience terms. "Capital owners" is umbrella only; public owners = government agencies (Masterworks/Essentials); facility owners = Primus. |
| government agencies | Approved term for public-sector buyers; replaces the retired two-word "public + agencies" phrasing. |
| capital program | Public-sector unit of work for Masterworks Maintain. Government agencies run programs. |
| capital portfolio | Commercial unit of work — Primus Maintain / facility owners only. Never swap program and portfolio. |
| program outcomes / capital program performance | The approved value framing for public sector. ROI is barred in public-sector copy; permitted only in commercial (Primus) content. |
| AI-native | The sole approved AI modifier. The retired hyphenated "powered / driven / enabled / based" AI modifiers are barred in body copy. |
| Masterworks Maintain, powered by Lumina | The only approved "powered by" construction if a platform modifier is used. Name AI mechanisms specifically (AI-drafted TAMP narrative sections). |
| unified system | Approved phrasing for connected data. Never the retired "source-of-truth" cliché — and only in build/delivery context, not planning. |
| FHWA requires / NDOT runs | No "the" before an org abbreviation. |
| do more with the same people | Approved capacity framing for public sector. Never phrase as headcount reduction. |
| in the cloud / in the field | Correct prepositions; replaces the retired "on the" forms. |
| transparent and accountable program delivery | Approved value phrasing. "Defensible" is barred in government-sector Aurigo copy even though buyers say it — record their word, translate to ours. |
| end users | Public-sector term for the served constituents; never "clients." |
| learn more | Approved CTA; replaces the retired "know more." |
| such as | Enterprise-voice connector; use instead of "like" in formal copy. |
| right of way (standalone) / right-of-way management (attributive) | Unhyphenated standalone; hyphenated only as a modifier. |
| audit trail (system-generated) | Describe the automatic audit log. Avoid the retired "paper trail" phrasing; if a manual process is meant, say paper-based audit trail. |

⚠ To confirm: no formal certification (e.g., FedRAMP) is stated for Masterworks Maintain in the source set — do not carry the platform-level certification wording into Maintain copy until PMM confirms scope.

Sources: GTM-War-Room/BRAND-DNA/brand-voice.md, GTM-War-Room/BRAND-DNA/gtm-rules.md, GTM-War-Room/BRAND-DNA/positioning-and-icp.md, GTM-War-Room/BRAND-DNA/our-customer.md, aurigo-maintain-prd-v1.docx, Asset condition management_ product walkthrough and feedback.docx

## F3 · The Check-Yourself Checklist

Before any copy built from this document ships, confirm every line:

- [ ] Opens from the reader's world, not from Aurigo or the product.
- [ ] Survives the swap test: put a competitor's name in place of "Aurigo" — if the sentence still works, rewrite it around the approved unique attributes.
- [ ] "AI-native" is the only AI modifier used; no other AI- compound appears.
- [ ] "life cycle" is two words; "infrastructure" is never pluralized.
- [ ] Program vs. portfolio is correct: government agencies run capital programs; facility owners run portfolios.
- [ ] No ROI framing in public-sector copy — use program outcomes or capital program performance.
- [ ] No terms from the avoid column of the Preferred Word List (F2).
- [ ] Every number, name, and certification traces to a PMM-approved questionnaire answer.

## F4 · Ownership & Version Control

Owner: PMM admin — maintained in the PMM Agent app; regenerate from the Foundation Questionnaire, do not hand-edit exports.

- Versions are tracked in the app; the war-room file always holds the latest final version.
- Propose changes through the Foundation Questionnaire review queue — approved answers regenerate this document.

## F5 · Open Inputs to Confirm

- ⚠ To confirm — **A2-Q1**: What market category does the product claim, and what is it deliberately positioned against or distinct from?
  Accepted answer carries an unresolved [Conflict:] note — verify before external use.
- ⚠ To confirm — **A3-Q1**: Who is the best-fit customer — organization type, situation, and constraint that makes them ideal?
  Accepted answer carries an unresolved [Conflict:] note — verify before external use.
- ⚠ To confirm — **B5-Q2**: For each capability or agent: what does it do, and what outcome or metric does it deliver?
  Accepted answer carries an unresolved [Conflict:] note — verify before external use.
- ⚠ To confirm — **C3-Q1**: Primary user (e.g. project / portfolio manager): what are they measured on?
  Accepted answer carries an unresolved [Conflict:] note — verify before external use.
- ⚠ To confirm — **C4-Q1**: IT & security: what are they measured on and what must they protect?
  No evidence found in the ingested sources — add a transcript or document that covers this.
- ⚠ To confirm — **C4-Q2**: IT & security: top concerns about adopting this product category, in their own words?
  No evidence found in the ingested sources — add a transcript or document that covers this.
- ⚠ To confirm — **D2-Q1**: Procore: what is their current product/AI capability and positioning, per the sources (with dates)?
  No evidence found in the ingested sources — add a transcript or document that covers this.
- ⚠ To confirm — **D2-Q2**: Kahua: what is their current product/AI capability and positioning, per the sources (with dates)?
  No evidence found in the ingested sources — add a transcript or document that covers this.
- ⚠ To confirm — **D2-Q3**: EcoInteractive: what is their current product/AI capability and positioning, per the sources (with dates)?
  No evidence found in the ingested sources — add a transcript or document that covers this.
