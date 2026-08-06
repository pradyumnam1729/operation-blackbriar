# Masterworks Build — Project Delivery Management

## Purpose

Masterworks Build manages the delivery of capital projects from design authorization through construction completion to project closeout. It covers the full project execution lifecycle: design management, bid and contract administration, construction management, change order processing, RFI and submittal management, field inspection and testing, document management, and — most critically — the structured handoff of completed assets to Masterworks Maintain.

Masterworks Build is the operational system for capital project delivery. It gives project managers real-time visibility into budget, schedule, and quality. It gives program managers the project-level data they need to manage the portfolio. It gives auditors the complete documentation trail that federal and state oversight requires. And it gives Masterworks Maintain the complete record of every asset that comes out of construction.

The asset handoff capability is what distinguishes Masterworks Build from every other project delivery system in the market. When a construction project closes in Masterworks Build, a structured asset record is automatically created in Masterworks Maintain. The asset record includes the geometry (precise location from as-built GPS), the classification (asset type, subtype, component), the material specifications, the warranty information, the commissioning inspection results, and the baseline condition score. No manual re-entry. No data loss. No more asset records that were created "from what we could find in the closeout package."

## The Asset Handoff Problem in Detail

The infrastructure industry has a specific, well-documented problem that Masterworks Build is designed to solve: project data does not survive project closeout.

When a construction project completes, a closeout package is assembled: as-built drawings, material certifications, equipment warranties, testing and inspection reports, commissioning documentation, maintenance manuals. In most agencies, this package is filed in a document management system (or a SharePoint folder, or a file cabinet) and never referenced again. The maintenance organization that inherits the asset:

- Does not know exactly what materials were used in construction (and therefore cannot specify the right repair materials)
- Does not have the initial condition baseline (and therefore cannot measure deterioration from commissioning)
- Does not have the warranty information (and therefore does not know what defects are still under warranty)
- Does not have the maintenance schedule specified by the equipment manufacturer (and therefore maintenance intervals are estimated, not specified)
- Does not know the precise geometry of the asset as built (and therefore must conduct a new survey)

The cost of this information loss is substantial: redundant surveys, incorrect repair specifications, missed warranty claims, and premature deterioration because maintenance intervals are wrong. The aggregate value of these losses across a state DOT's annual project closeout volume is in the millions of dollars annually.

Masterworks Build → Maintain solves this problem structurally. The closeout data that must flow to the asset record is defined in the data model. Project managers are required to capture it during the project — it is not a "closeout checklist" added at the end, it is data that is collected during the project and structured for handoff. When the project closes, the handoff is automatic.

## Personas

**Project Manager (Agency)**
The agency project manager is responsible for the delivery of one to twenty capital projects. They use Masterworks Build to track project budget and schedule, process change orders and RFIs, review submittals, track testing results, and manage project documentation. The project manager is the primary daily user of Masterworks Build.

**Construction Inspector**
The field inspector uses Masterworks Build's mobile interface to record daily inspection observations, document test results, photograph construction activities, and log non-conformances. They may not be office-based; offline capability is essential.

**Project Manager (Contractor / Consultant)**
The contractor's project manager uses Masterworks Build to submit RFIs, respond to submittals, upload as-built documentation, and review contract documents. The contractor PM is a secondary user type who accesses Masterworks Build through a restricted portal.

**Capital Program Manager**
The capital program manager uses Build for portfolio-level visibility: which projects are on schedule, which are at risk, what is the aggregate budget variance across the program, and what projects are approaching closeout (and therefore will feed new assets into Maintain).

**Resident Engineer**
The resident engineer manages day-to-day construction activity at the project site. They use Build to document daily work reports, track pay item quantities, approve contractor pay applications, and manage the punch list through to substantial completion.

## User Stories

1. **As a Project Manager**, I want to create a change order that captures the reason for the change, the cost impact, the schedule impact, and the required approval chain so that I have a complete audit trail for every budget change.

   *Acceptance criteria:* Change order form captures change category (scope change, differing site condition, design error, owner-directed change), cost estimate by labor/material/equipment, schedule impact in days, justification narrative, and supporting documents. Approval workflow is configurable by change order dollar amount. Status is tracked through the full approval chain. Approved change orders update the project budget automatically.

2. **As a Construction Inspector**, I want to record daily inspection observations from my mobile device, including photos and GPS location, and have them automatically synced when I return to connectivity so that my inspection records are always in the system without manual re-entry.

   *Acceptance criteria:* Mobile inspection form works offline (inspections recorded without connectivity are queued for sync). Each inspection record has GPS coordinates, timestamp, weather conditions, crew on site, observations, and up to 10 photos. Sync occurs automatically when connectivity is restored. Synced records are immediately visible in the project file.

3. **As a Resident Engineer**, I want to track pay item quantities against the contract bid schedule and generate a pay estimate for contractor payment processing so that contractor payments are accurate and timely.

   *Acceptance criteria:* Pay estimate form shows each bid item with contract quantity, unit price, prior period quantities, and current period quantities entered by the resident engineer. System calculates earned amount, retainage, and net payment due. Pay estimate generates as a PDF in the state's required format. Approved pay estimates create cost transactions in the project budget.

4. **As a Project Manager**, I want to log a non-conformance when a contractor's work does not meet specification so that the issue is documented, tracked to resolution, and included in the project record.

   *Acceptance criteria:* Non-conformance form captures location (GPS), specification reference, description, photos, corrective action required, and corrective action deadline. Non-conformances are tracked from open to resolved. Unresolved non-conformances prevent issuance of substantial completion.

5. **As a Capital Program Manager**, I want to see the current budget-at-completion and schedule completion date for all active projects so that I can identify projects that are at risk of overrunning the STIP-programmed amount.

   *Acceptance criteria:* Portfolio dashboard shows all active projects with current budget-at-completion (original budget + approved change orders), current schedule completion date, and variance from the STIP-programmed amount and date. Color coding highlights projects with cost variance >5% or schedule variance >30 days.

6. **As a Project Manager**, I want to generate the as-built asset record that will be transferred to Masterworks Maintain so that the maintenance organization has the complete project data at handoff.

   *Acceptance criteria:* At project closeout, the system presents a structured form that captures all required Maintain fields: asset classification, precise geometry (imported from GPS survey or entered manually), material specifications, installation date, warranty information, initial condition inspection results, and maintenance manual references. Validation prevents closeout unless all required Maintain fields are populated.

7. **As a Resident Engineer**, I want to receive and respond to RFIs from the contractor through the system so that all project communications are documented and responses have a time-stamped record.

   *Acceptance criteria:* Contractor submits RFI through contractor portal with question, reference drawings, and urgency flag. RFI is routed to the designer of record for response. Response time is tracked against the contract requirement. All responses are logged in the project file. Overdue RFIs appear on the project manager dashboard.

8. **As a Project Manager**, I want to produce a substantial completion certificate that documents the date of substantial completion, the list of outstanding punch list items, and the retainage release conditions so that the contractor can begin the warranty period and the project can be financially closed.

   *Acceptance criteria:* Substantial completion form captures date, punch list items with required completion dates and responsible party, retainage release amount and conditions. Certificate generates as a signed PDF. Punch list items are tracked to completion. Retainage release is initiated when all punch list items are resolved.

## Business Rules

1. **Budget control:** Change orders cannot be approved if they would cause the total project cost-at-completion to exceed the STIP-programmed amount without a corresponding STIP amendment. The system warns at 90% and blocks at 110% of the programmed amount.

2. **Federal billing eligibility:** Only cost transactions coded to eligible cost categories and phases can be included in federal reimbursement claims. The system validates eligibility at transaction entry.

3. **Inspection frequency:** Federal and state requirements specify minimum inspection frequencies for certain project types (bridge construction inspections, pavement quality inspections). The system tracks inspection dates and alerts when the required frequency is not being met.

4. **Closeout completeness:** A project cannot be marked as financially closed unless all pay items are reconciled, all non-conformances are resolved, all punch list items are signed off, and the Masterworks Maintain asset record is completed.

5. **Warrant periods:** Warranty information (warranty type, start date, end date, warranty holder) must be entered for all equipment and specialty items at closeout. The system tracks warranty periods and notifies the project manager of expiring warranties.

6. **As-built documentation:** Federal-aid projects require as-built drawings to be submitted within 90 days of project closeout. The system tracks as-built document submission and sends reminders to the project manager as the deadline approaches.

7. **Contractor access scope:** Contractor portal users can submit RFIs and submittals, upload documents, and view items addressed to them. They cannot view other contractors' documents or access the project financial data.

8. **Environmental commitment tracking:** Projects with NEPA commitments (mitigation measures, environmental conditions) must track compliance with each commitment. Outstanding commitments prevent project closeout.

## Future Evolution

- **AI document review:** Automated review of submitted specifications and submittals against design requirements, flagging discrepancies for engineer review
- **Schedule risk prediction:** ML model that predicts probability of schedule delay based on current progress indicators and historical patterns for similar project types
- **Automated as-built generation:** Integration with GPS survey and BIM tools to auto-populate as-built geometry in the Maintain handoff
- **Carbon footprint tracking:** Material quantity tracking combined with material carbon intensity factors to calculate project embodied carbon
- **Contractor performance scoring:** Aggregate contractor performance metrics (schedule adherence, change order frequency, RFI response time) across all Masterworks Build projects to support contractor prequalification decisions

---

*See also: [Masterworks Plan](plan.md) | [Masterworks Maintain](maintain.md) | [Project Delivery Domain](../domains/project-delivery.md)*
