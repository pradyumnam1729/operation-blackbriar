---
stage: draft
date: 2026-08-06
sources:
  - "engineering-playbook/vol-2-product-knowledge/README.md"
  - "reference output/Masterworks AI Messaging and Positioning.pdf (Parts B5, B6)"
---

# Product Wiki — where feature truth lives

Agents do not invent product facts. Feature truth lives in `engineering-playbook/vol-2-product-knowledge/`. This file maps each product to its knowledge sources.

## Product → source map

| Product | Audience | Feature truth |
|---------|----------|---------------|
| **Masterworks** (Plan, Build, Maintain) | Public owners | `vol-2-product-knowledge/masterworks/README.md`, `plan.md`, `build.md`, `maintain.md` |
| **Essentials** | Local and regional agencies | No dedicated volume yet — inherit from `masterworks/` and flag gaps |
| **Primus** (Plan, Build, Maintain) | Facility owners | `vol-2-product-knowledge/primus/README.md`, `plan.md`, `build.md`, `maintain.md` |
| **Lumina** (AI engine) | Foundational layer, not standalone | `vol-2-product-knowledge/domains/ai.md`; platform architecture in the Masterworks AI messaging doc (B6): Foundation Data Model, AI Orchestration & Agent Framework, Responsible AI |
| **Masterworks AI** (Copilot + agents) | Masterworks customers | Agent catalog in the messaging doc (B5); AI capabilities in `domains/ai.md` |

## Cross-cutting domain documents (`vol-2-product-knowledge/domains/`)

14 domain docs underpin both product families: asset-management, capital-planning, project-delivery, maintenance, inspections, preventive-maintenance, inventory, gis, work-orders, mobile, **ai**, dashboards, reporting, future-vision. Read the relevant domain doc before writing any feature-level claim.

## Masterworks AI agent catalog (approved names — use these exactly)

- **Copilot:** Document Search Agent, Data Search Agent, Help Agent.
- **Planning:** Scenario Planning Agent, Funding Agent, Project Scoring Agent.
- **Delivery:** Project Administration (PMO) Agent, RFI Agent, Risk Prediction (Early-Warning) Agent, Field Inspection Agent, Documentation Control Agent.
- **Extend:** Agent Builder.

7 agents ship out of the box plus Agent Builder. Never say generic "Agent" — name the agent type.

## Scope guardrail (prevents false claims)

Maintain is a **System of Intelligence**, not a CMMS/EAM. It is not a work order execution engine, inventory system, PM scheduler, document management system, GIS, or financial system. Test before any capability claim: "Would this feature ship in Maximo, Cityworks, or SAP PM?" If yes, it is an integration story, not an Aurigo feature. Full IS/IS-NOT list: `vol-2-product-knowledge/README.md`.

## Roadmap and recent releases

Long-horizon vision (digital twins, IoT, drones): `domains/future-vision.md`. 10-year platform capabilities: `vol-1-company/01-vision-mission.md`.

## Validation status

- Sourced: all pointers verified against the repo tree; agent catalog from the July 2026 messaging doc.
- Placeholder: no Essentials product volume exists (flagged); "recent releases" feed is not wired — connect release notes as a data source before the Product-to-Market Translator agent runs.
