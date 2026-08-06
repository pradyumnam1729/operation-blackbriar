# Primus Build — Private Project Delivery

## Purpose

Primus Build manages the delivery of capital projects for private infrastructure owners — from design authorization through construction, commissioning, qualification (where applicable), and structured asset handoff to Primus Maintain. It provides the project execution platform that private organizations need to deliver capital projects on time and on budget, with the complete documentation that regulatory compliance, warranty management, and maintenance operations require.

The fundamental asset handoff problem (described in Masterworks Build) exists in private sector capital projects just as acutely as in public sector. When a manufacturing plant installs a new production line, the as-built documentation, equipment specifications, warranty certificates, and commissioning test results are the foundation of the maintenance program for that line. When those documents are filed in a SharePoint folder that maintenance never opens, the value of the project data is lost. Primus Build ensures this information flows directly into Primus Maintain at project closeout — structured, complete, and immediately usable.

## Key Differences from Masterworks Build

Private sector project delivery differs from public sector in several important ways that shape the product configuration:

### Procurement Speed and Flexibility

Private organizations can procure construction and equipment services faster than public agencies. No public bid requirement, no formal selection process mandated by law, no protest period, no DBE goals, no Buy America restrictions (unless federally co-funded). Primus Build supports the range of private procurement models:

- **Competitive bid (public-style)** — used when the customer wants to demonstrate best-value procurement to their own board or auditors; supported but not required
- **Negotiated procurement** — direct engagement with 2-3 preferred vendors, price and terms negotiated
- **Sole source / direct award** — for specialized equipment (OEM-specific), long-term partnership contractors, or urgency
- **Master service agreement (MSA)** — pre-qualified contractor pool with pre-negotiated rates; work packages issued as task orders
- **EPC (engineering-procurement-construction)** — turnkey delivery, single contract, common in energy and process industries
- **EPCM (EPC with owner as construction manager)** — hybrid model, common in mining and heavy industry

The procurement module tracks the model used, captures the required documentation for each, and enforces the customer's internal procurement policy (approval thresholds, sole-source justification requirements).

### Production Downtime as First-Class Schedule Risk

For manufacturing and data center projects, construction downtime is not just a schedule issue — it is a revenue issue. A production line that is offline for maintenance or capital improvement is not producing revenue.

Primus Build includes a **production impact calendar**: the project schedule is overlaid on the production/operations calendar. The system flags:

- Construction phases scheduled during high-production periods (e.g., "line rebuild scheduled during Q4 automotive model-year buildup — recommend deferring to Q1 shutdown window")
- Cumulative downtime hours across all active projects on a given production line
- Utility conflicts (e.g., "chiller replacement requires shutting down chilled water loop — process line 4 uses that loop, coordinate with production planning")

The production impact is monetized. A 14-day shutdown at $8,500/hr of throughput value = $2.86M of production impact. This number appears alongside the direct project cost so the total cost decision is transparent.

### Commissioning Workflows Are First-Class

Private sector capital projects — especially in data centers, process industries, life sciences, and mission-critical facilities — require formal commissioning. Commissioning is the structured, documented process of testing all systems to verify they meet design specifications before the asset is declared operational.

Primus Build supports the standard commissioning frameworks:

- **ASHRAE Guideline 0 / Guideline 1.1** — HVAC commissioning
- **Uptime Institute Tier Certification** — data center commissioning at Tier I through Tier IV levels
- **NETA Acceptance Testing Specifications (ATS)** — electrical system commissioning
- **NFPA 110** — emergency and standby power system commissioning (generators, ATS, distribution)
- **ISPE Baseline Guides** — commissioning and qualification for life sciences (harmonized with FDA GMP)

The commissioning module captures:

1. **Commissioning plan** — list of all systems, acceptance criteria per system, test protocols, required sign-off authorities, scheduled test dates
2. **Test execution records** — measured values against acceptance criteria, pass/fail with electronic signature, photos, deviations
3. **Deviations and dispositions** — when a test fails or measured value is out of range: root cause, corrective action, retest, disposition (accepted with justification, rejected, requires rework)
4. **Commissioning certificate** — final signed document declaring the system commissioned; released asset to operations

For data centers, five levels of commissioning are supported:
- **Level 1: Factory Witness Testing** — verified at factory before shipment
- **Level 2: Site Acceptance Testing** — vendor start-up and initial verification
- **Level 3: Functional Performance Testing** — individual system testing under simulated load
- **Level 4: Integrated Systems Testing** — multi-system testing under simulated operational scenarios (e.g., loss of utility power → generator start → transfer → building loads restored)
- **Level 5: Sustained Load Testing** — 24-hour or 72-hour continuous load runs at rated capacity

Level 4 and 5 test records are the primary source of the **baseline performance data** that flows into Primus Maintain. When the generator is tested at Level 5 with 100% rated load for 24 hours and starts within 10 seconds every time, those numbers are captured as the "as-commissioned" baseline. Six months later, if the generator is showing signs of slower start times, Maintain can compare against the commissioned baseline — not just a manufacturer specification.

### Qualification Workflows (Life Sciences)

For pharmaceutical, biologics, and medical device facilities, equipment must be **qualified** under FDA GMP requirements before it can be used in production. Primus Build implements the standard qualification framework:

- **DQ (Design Qualification)** — verified that the equipment design meets the URS (User Requirements Specification). Executed during design phase, before purchase order.
- **IQ (Installation Qualification)** — verified that the equipment is installed according to specifications. Confirms: correct model/serial, utilities connected correctly, calibration documentation present, materials of construction match specification, environmental conditions meet requirements.
- **OQ (Operational Qualification)** — verified that the equipment operates within specified parameters across its intended operating range. Executes test protocols across the range (e.g., autoclave: verified operation at 121°C and 134°C, 15 min and 30 min cycles).
- **PQ (Performance Qualification)** — verified that the equipment consistently produces the intended output under actual production conditions. Typically 3 consecutive successful runs of the intended product/process.

Primus Build enforces the sequence: DQ before IQ, IQ before OQ, OQ before PQ. Out-of-sequence execution is blocked. Each qualification includes:

- **Protocol document** (test procedure), approved before execution
- **Execution records** — measured data, deviation log, electronic signatures per 21 CFR Part 11 (unique user, timestamp, meaning of signature)
- **Deviation dispositions** — every out-of-tolerance observation resolved before final approval
- **Final report** — summary, deviation summary, conclusion (qualified / conditionally qualified / not qualified)

The qualification records are the **evidence package** for FDA inspection. If the FDA arrives and asks "show me the qualification record for the tablet compression machine on line 3," Primus Build produces the complete package — protocol, executed data, deviations, dispositions, signatures — in a compliant electronic form.

### Contractor Relationships

Many private sector capital projects use **long-term contractor relationships** rather than one-off competitive bids. Primus Build is designed for this model:

- **Contractor master file** — pre-qualified contractors with expiration-tracked qualifications (insurance certificates, safety records, licenses, tax documents)
- **MSA management** — master service agreements with pre-negotiated rate schedules, terms, and conditions
- **Contractor portal** — frequent collaborators access project documents, submit progress reports, upload deliverables, receive approvals without the formal contractor setup process required in public procurement

The contractor portal is more permissive than in Masterworks (where contractors are formally onboarded per project) because private customers manage contractor risk through their MSA and pre-qualification process rather than per-project onboarding.

## Personas

**Capital Projects Manager (Owner)** — Manages a portfolio of capital projects. Primary user for budget and schedule tracking, change order management, closeout documentation, contractor coordination.

**Commissioning Manager** — Responsible for testing and accepting installed systems. Primary user for commissioning workflow. May be an owner employee, a third-party commissioning firm (CxA — Commissioning Authority), or the design engineer of record.

**Qualification Manager (Life Sciences)** — Quality function role. Owns the DQ/IQ/OQ/PQ protocol library, executes qualifications, manages deviations, signs off on final qualification reports.

**Resident Engineer / Owner's Representative** — Day-to-day site presence. Records daily work reports, inspects construction quality, manages RFIs and submittals, tracks contractor performance.

**Contractor / Equipment Vendor** — Secondary user through the contractor portal. Submits O&M manuals, as-built drawings, warranty certificates, factory acceptance test records, and equipment data sheets. Responds to RFIs.

**Reliability Engineer (Manufacturing)** — Reviews commissioning results and equipment performance data to validate that new assets meet the reliability requirements the capital plan was based on. Feeds baseline observations into Primus Maintain.

**Production Planning Coordinator** — Manages the production impact calendar. Coordinates project shutdown windows with production schedule.

## User Stories

1. **As a Capital Projects Manager**, I want to track all capital projects in my portfolio with current budget-at-completion and schedule status so that I can report program health to the VP of Operations monthly without manual data collection.

   *Acceptance criteria:* Portfolio dashboard shows all active projects with EAC (Estimate at Completion), original budget, current variance, and schedule variance from baseline. Filter by business unit, plant, project type, project manager.

2. **As a Commissioning Manager**, I want to create a Level 3-5 commissioning plan for a new data center hall that lists all systems to be tested, the acceptance criteria for each test, and the required sign-off authority so that commissioning is executed in a controlled, documented manner meeting Uptime Institute Tier III certification requirements.

   *Acceptance criteria:* Commissioning plan template pre-populated per Tier level. Each test lists: system, subsystem, acceptance criteria, test protocol reference, required witness (owner rep, CxA, vendor). Plan requires approval before test execution begins.

3. **As a Commissioning Manager at a data center**, I want to record generator load bank test results — start time, frequency stability, voltage regulation, load acceptance at 25/50/75/100% steps, and sustained 4-hour load run — and link them to the asset record in Primus Maintain so that the commissioning baseline is captured for future comparison.

   *Acceptance criteria:* Load bank test form captures all standard measurements per NETA ATS. On pass, values are written to the generator asset record in Maintain as the commissioning baseline. Future condition trending compares against this baseline.

4. **As a Life Sciences Qualification Manager**, I want to execute the IQ protocol for a new manufacturing line and document all deviations with their disposition (accepted with justification, rejected requiring rework, further investigation required) so that the IQ record is complete for FDA audit purposes.

   *Acceptance criteria:* IQ execution captures every test item with measured value, expected value, pass/fail, electronic signature (21 CFR Part 11 compliant). Deviations logged with type, root cause, corrective action, disposition, and reviewer signature. IQ cannot be closed with open deviations.

5. **As a Resident Engineer**, I want to receive equipment vendor O&M manuals and warranty certificates through the contractor portal so that all closeout documentation is in one place and automatically linked to the Primus Maintain asset record.

   *Acceptance criteria:* Contractor portal upload form maps each document to the specific asset it covers. On upload, document is filed and linked to the pending Maintain asset record. Closeout checklist shows document completeness per asset.

6. **As a Capital Projects Manager in manufacturing**, I want to see the schedule overlap between my project's construction phases and the production calendar so that I can schedule construction outages for minimum production impact.

   *Acceptance criteria:* Production impact calendar overlays project Gantt chart on production schedule. Overlaps highlighted with monetized impact (hours × $/hr throughput value). Alternative scheduling suggestions offered based on planned production shutdowns.

7. **As a Capital Projects Manager**, I want the system to generate the Primus Maintain asset record at project closeout, pre-populated with all data captured during the project — geometry, manufacturer/model/serial, installation date, commissioning baseline, warranty terms, O&M manual references — so that the maintenance team inherits a complete asset record without manual re-entry.

   *Acceptance criteria:* At substantial completion, closeout wizard walks user through Maintain handoff. For each asset created, all captured fields are pre-populated; user reviews and completes any missing fields; validation prevents handoff completion until required Maintain fields are populated.

8. **As a Data Center Owner's Representative**, I want to record Level 5 integrated system test results — including the full utility-failure-to-generator-and-back sequence — with all measured recovery times, voltage transients, and load stability data so that the Uptime Institute Tier III certification package is complete.

   *Acceptance criteria:* Integrated system test form captures the full test sequence with timestamps for each event (utility loss detected, generator start command, generator online, ATS transfer, building loads restored, utility returned, ATS retransfer, generator shutdown). All measurements compared against Uptime Institute Tier III criteria; deviation flagged.

9. **As a Contractor**, I want to submit factory acceptance test (FAT) records for equipment before it ships to the site so that the owner accepts the equipment against specification prior to site delivery.

   *Acceptance criteria:* Contractor portal FAT submission includes: FAT protocol reference, test date, witness name/company, measured values against acceptance criteria, pass/fail, photos. Owner reviews and accepts or requests corrections. Only accepted FAT records permit shipping authorization.

10. **As a Qualification Manager**, I want to see all assets in the current project that are in each qualification stage (DQ / IQ / OQ / PQ / Complete) so that I can manage the qualification schedule and identify blockers.

    *Acceptance criteria:* Qualification dashboard shows all in-flight assets with current status, next milestone, and days-since-status-change. Overdue items highlighted. Drill-down to individual asset shows full qualification history.

## Business Rules

1. **Commissioning must precede asset handoff.** An asset cannot be transferred to Primus Maintain as "in-service" unless the commissioning plan has been completed with all acceptance criteria met (or all deviations formally accepted and closed).

2. **Qualification required for life sciences (tenant-configurable).** For tenants with life sciences qualification workflows enabled, IQ must be completed before OQ can begin; OQ must be completed before PQ can begin. Out-of-sequence qualification execution is blocked. Assets without complete IQ/OQ/PQ cannot be released for GMP production.

3. **O&M documentation required at closeout.** Closeout checklist requires at least one O&M manual document is attached for each major equipment item. Projects with missing O&M documentation cannot be financially closed.

4. **Warranty period tracking.** Warranty certificates must specify warranty type, start date, end date, warranty holder (vendor name and contact), and covered defects. Primus Maintain is automatically notified of warranty expiration at 90, 30, and 7 days before expiry.

5. **Change order budget control.** Change orders that would cause the project cost-at-completion to exceed the approved capital budget by more than 10% require additional capital approval (matching the original approval level for the project).

6. **Retainage rules.** For projects with retainage terms (typical: 5-10% withheld from progress payments), retainage is released at substantial completion less an amount held for punch list items (typically 200% of estimated punch list value). Full retainage release requires punch list completion and final acceptance.

7. **21 CFR Part 11 compliance for qualification signatures.** Electronic signatures on qualification records require: unique user credential (not shared), date/time stamp, meaning of signature (author, reviewer, approver), and cannot be repudiated. Signature history is preserved for the retention period (life of asset + regulatory retention).

8. **Production impact approval.** Construction activities exceeding a configurable production impact threshold (default: $250K of monetized impact) require approval from Production Planning before schedule finalization.

9. **Contractor qualification currency.** Contractors cannot be assigned to a project if their pre-qualification documents (insurance, safety, licenses) are expired. System blocks assignment and notifies the contractor.

## Future Evolution

- **BIM integration** — Structural and MEP BIM models linked to project record; as-built model exported to Maintain as asset geometry (IFC 4 format standard)
- **Digital commissioning** — IoT sensor data during commissioning automatically captured as commissioning test results, reducing manual data entry (e.g., generator start test measured by BMS, not stopwatch)
- **AI punch list management** — Computer vision analysis of project photos to identify punch list items that may have been overlooked in manual inspections
- **Vendor performance tracking** — Aggregate contractor performance metrics (commissioning defect rate, O&M manual completeness, response time, on-time delivery) across all Primus Build projects to inform pre-qualification decisions
- **Automated FDA submission generation** — For life sciences change controls, auto-generate the regulatory submission package from qualification records
- **Automated Tier certification packet** — Generate the Uptime Institute Tier Certification submission from Level 3-5 commissioning records

---

*See also: [Primus Plan](plan.md) | [Primus Maintain](maintain.md) | [Project Delivery Domain](../domains/project-delivery.md)*
