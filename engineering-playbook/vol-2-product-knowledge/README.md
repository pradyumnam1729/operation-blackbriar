# Volume 2 — Product Knowledge

This volume documents every major product area in the Aurigo platform — what it does, who uses it, how it works, and why it was built the way it was. Engineers should read the sections relevant to the code they are building before writing a single line. Product managers should use these documents as the authoritative internal reference for every feature conversation. Support engineers should use them to understand the business context behind customer questions.

---

## Structure

Volume 2 is organized into three sections:

### Masterworks (Public Sector)

The Masterworks product family serves US public infrastructure agencies — state departments of transportation, county road departments, transit agencies, port authorities, and water utilities. The products are: Masterworks Plan (capital program management), Masterworks Build (project delivery), and Masterworks Maintain (asset intelligence).

| Document | Description |
|----------|-------------|
| [Masterworks Overview](masterworks/README.md) | Who Masterworks serves, how the three modules connect, naming rationale |
| [Masterworks Plan](masterworks/plan.md) | Capital program management: CIPs, funding sources, federal compliance |
| [Masterworks Build](masterworks/build.md) | Project delivery: design, construction, closeout, asset handoff |
| [Masterworks Maintain](masterworks/maintain.md) | Asset intelligence: condition, RUL, capital needs, TAMP, AI |

### Primus (Private Sector)

The Primus product family serves private infrastructure owners — manufacturing, utilities, airports, data centers, life sciences, ports, mining, and energy. The products mirror Masterworks but are configured for private sector regulatory frameworks, asset classes, and financial incentives.

| Document | Description |
|----------|-------------|
| [Primus Overview](primus/README.md) | Who Primus serves, how it differs from Masterworks, naming rationale |
| [Primus Plan](primus/plan.md) | Private capital planning: ROI-based, board-level justification, vertical-specific |
| [Primus Build](primus/build.md) | Private project delivery: commissioning, qualification, asset handoff |
| [Primus Maintain](primus/maintain.md) | Private asset intelligence: manufacturing, data centers, utilities, life sciences |

### Domains

The domains section documents the cross-cutting capabilities that underpin both Masterworks and Primus. These are the building blocks of the platform — each domain document describes a core capability that appears in multiple product contexts.

| Document | Description |
|----------|-------------|
| [Domains Overview](domains/README.md) | Table of contents for all 14 domain documents |
| [Asset Management](domains/asset-management.md) | The asset registry: classification, geometry, condition, ownership |
| [Capital Planning](domains/capital-planning.md) | Capital needs calculation, budget optimization, TAMP, multi-year CIPs |
| [Project Delivery](domains/project-delivery.md) | Project lifecycle, the Build → Maintain handoff, closeout data |
| [Maintenance](domains/maintenance.md) | Maintenance intelligence vs. execution, EAM integration, condition signals |
| [Inspections](domains/inspections.md) | Inspection types, methods, rating scales, mobile workflow, AI-assisted |
| [Preventive Maintenance](domains/preventive-maintenance.md) | PM programs, templates, work orders, deterioration model calibration |
| [Inventory](domains/inventory.md) | Spare parts, materials, tools, ERP integration |
| [GIS](domains/gis.md) | Spatial data, WGS84, PostGIS, Mapbox, ArcGIS integration |
| [Work Orders](domains/work-orders.md) | Work order lifecycle, creation triggers, integration with EAM |
| [Mobile](domains/mobile.md) | Field experience, offline capability, PWA, sync |
| [AI](domains/ai.md) | All AI capabilities: prediction, optimization, NLQ, anomaly detection |
| [Dashboards](domains/dashboards.md) | Executive, asset manager, field inspector dashboards |
| [Reporting](domains/reporting.md) | Standard reports, custom builder, regulatory compliance, exports |
| [Future Vision](domains/future-vision.md) | 5-10 year platform roadmap: digital twins, IoT, drones, SHM |

---

## How to Use This Volume

**Before implementing a feature:** Read the domain document for the module you are building. Understand the personas, the user stories, and the business rules. A feature built without understanding the domain is a feature built on assumption.

**Before designing an API:** Read the integration points section of the relevant domain. Many Aurigo APIs must support data from multiple sources (native entry, EAM integration, bulk import). Design accordingly.

**Before writing a calculation:** Read the relevant vault/calculations/ note AND the domain document for the module. The vault/ note has the mathematical specification. The domain document has the business context and the user expectations.

**When a customer asks a question you don't know the answer to:** Start here. The domain documents contain the business rules that govern every feature. If the answer is not here, it needs to be added.

---

## What Maintain Is — and What It Is NOT

Reading this once will save you weeks. Maintain is repeatedly misclassified by newcomers as a CMMS or an EAM. It is neither.

### Maintain IS

- A **System of Intelligence** — the analytics, prediction, and capital-planning layer that sits above execution systems.
- An **Asset Registry with lifecycle continuity** — the source of truth for asset identity, geometry, and condition history, sourced from Build closeout or integrated from EAM.
- A **Deterioration and RUL modeling engine** — Weibull, Markov, and mechanistic-empirical models per asset class.
- A **Capital planning platform** — budget-constrained, risk-informed, multi-year investment scheduling.
- A **Regulatory reporting engine** — TAMP, NHPP, NBI, FTA TAM, FAA PMS, PHMSA, NERC CIP outputs.
- A **Decision-support surface** — explainable AI recommendations with cited data.
- An **API-first integration hub** — every capability accessible programmatically.

### Maintain is NOT

- **Not a CMMS.** We do not schedule technicians or assign daily maintenance tasks. That is the EAM's job.
- **Not a Work Order execution engine.** We track work orders as *signals* for condition — we do not manage crews, parts, or dispatching.
- **Not a spare parts / inventory system.** No stock levels, no reorder points, no vendor catalogs.
- **Not a labor / timesheet tracker.** No hours, no billing rates, no timecards.
- **Not a Preventive Maintenance scheduler.** We consume PM data; we do not generate the schedules.
- **Not a Vendor / warranty tracker.** No contract renewal alerts, no warranty claims.
- **Not a document management system.** We reference documents; we do not manage them.
- **Not an emergency dispatch / SCADA system.** No real-time alarms, no operational control.
- **Not a GIS system.** We consume from and serve GIS; we do not compete with ArcGIS.
- **Not a financial system.** We produce capital plans; we do not book them to a general ledger.

**The one-liner test:** *"Would this feature ship in Maximo, Cityworks, SAP PM, or a CMMS?"* If yes, it is NOT a Maintain feature. Ship the integration, not the replacement.

Every engineer joining a Maintain team is expected to be able to recite this list from memory before their first PR.

### Boundary case cheat-sheet

| Capability the customer asks for | Where it lives |
|----------------------------------|----------------|
| "Assign this bridge inspection to Bob" | EAM (Maximo) — Maintain provides the trigger and consumes the completion |
| "Track my technician hours on this repair" | EAM — Maintain consumes cost roll-ups |
| "Notify me when a bolt needs re-ordering" | ERP / EAM — outside scope |
| "Score this bridge's condition from the inspection" | **Maintain** |
| "Predict when this pavement segment will fall below PCI 55" | **Maintain** |
| "Produce a FHWA-compliant TAMP report" | **Maintain** |
| "Optimize which of 850 assets get funded next year" | **Maintain** |
| "Show me the last 20 work orders on this asset" | Integrated view — data from EAM, rendered in Maintain |
| "Draw a new pipeline segment on the map" | **Maintain** (or ArcGIS Enterprise where customer has it) |
| "Print a barcode label for spare parts" | ERP / EAM |

---

*See also: [Volume 1 — Company](../vol-1-company/README.md)*
