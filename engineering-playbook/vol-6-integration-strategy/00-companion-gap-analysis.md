# Maintain as a Companion Product — Gap Analysis

> Volume 6 · Integration Strategy · Document 00  
> Status: **COMMITTEE REVIEW — July 2026**  
> Trigger: ELT question — can Maintain be the intelligence layer that sits above and works WITH existing market products?  
> Research basis: Full audit of Infrastructure/ExternalClients/, vol-6 adapter docs, vol-2 domain specs

---

## The Core Idea

Maintain's value proposition to any customer who already has software is:

> *"Keep every system you already paid for. We sit above them and tell you what they cannot: what will break, when, what it will cost, and which ones to fund first."*

This means Maintain must be a **reliable data consumer and intelligence publisher** for every major system a target customer already runs. For each companion product, there is an inbound data contract (what we consume) and an outbound data contract (what we publish back). A gap in either direction breaks the companion story.

What follows is an honest assessment of every major product in the market — what the companion relationship should look like, what exists today, and what is missing.

---

## 1. Atom AI

**What they do:** City/county CMMS — asset tracking, work orders, PM scheduling, mobile inspections, permitting, right-of-way (Coordinate module). Customers: Chicago, Austin, Seattle, SF, Indianapolis, Hawaii DOT, Alaska Railroad.

**What the companion relationship should look like:**

| Direction | Data | Why It Matters |
|---|---|---|
| Atom AI → Maintain | Work order completion records, actual costs, defect logs, asset inventory | Work order cost history is the best proxy for deterioration rate and treatment cost when formal inspections are sparse |
| Atom AI → Maintain | Inspection results from field crews (photo + defect + asset ID) | Feeds condition recording without requiring duplicate data entry |
| Maintain → Atom AI | Capital need recommendations as work order requests | Closes the loop: Maintain identifies the capital need; Atom AI schedules the work |
| Maintain → Atom AI | RUL flags for assets approaching end of useful life | Atom AI PM scheduler can plan preventive campaigns against Maintain's predictions |

**Current state:** Nothing. No Atom AI connector exists. No stub, no interface, no documentation.

**What is missing:**
- Atom AI REST API connector (asset sync + work order sync inbound; capital need push outbound)
- Atom AI does not publish an open API in the same way Maximo does — integration requires OAuth 2.0 client credentials and their GraphQL or REST endpoints
- Field mapping between Atom AI asset types and Maintain asset classification hierarchy
- Echo detection (prevent Maintain-created work orders from re-importing as condition signals)

**Severity:** High. Atom AI has 500+ city customers. Without this connector, Maintain cannot position itself as the intelligence layer above Atom AI. Every sales conversation where a prospect says "we already have Atom AI" ends with "then we can't help you yet."

**Effort to build:** Medium. Atom AI has a documented REST API. 4–6 weeks for a production-grade connector using the same pattern as Cityworks.

---

## 2. AgileAssets / Trimble Unity Maintain

**What they do:** Pavement management, bridge management, lifecycle cost analysis, TAMP-adjacent output for state DOTs. Now being replatformed into Trimble Unity Maintain on Esri ArcGIS. Significant state DOT installed base (TX, NC, several others).

**What the companion relationship should look like:**

| Direction | Data | Why It Matters |
|---|---|---|
| AgileAssets → Maintain | Pavement condition survey data (IRI, distress, rutting) | AgileAssets often holds the pavement PMS data for a state DOT; Maintain needs it for TAMP lifecycle modeling |
| AgileAssets → Maintain | Treatment history (what was applied when, at what cost) | Calibrates Maintain's unit cost library and Weibull model with actual state-specific data |
| Maintain → AgileAssets | Capital need output | Less likely — AgileAssets has its own capital programming module |

**Honest assessment:** AgileAssets is a partial competitor, not a clean companion. They do lifecycle planning and TAMP-adjacent work. The companion story only works during the Trimble migration window — when a state DOT is being forced from AgileAssets to Trimble Unity Maintain and is considering alternatives. In that window, Maintain can position as "continue your AgileAssets data in a modern platform."

**Current state:** Nothing. No AgileAssets connector, no data import from their export formats.

**What is missing:**
- AgileAssets data export format ingestion (they export to CSV and proprietary formats; no public API)
- Historical pavement condition data import (to pre-populate Maintain's condition history for new state DOT customers coming from AgileAssets)
- Treatment history import from AgileAssets format

**Severity:** Medium. Priority during Trimble migration window (2026–2028). Not a runtime integration — primarily a one-time data migration tool for new customers.

**Effort to build:** Medium-High. No public API. Requires reverse-engineering or negotiating a data export format with Trimble/AgileAssets.

---

## 3. IBM Maximo

**What they do:** Enterprise EAM — work orders, asset master, PM schedules, inventory, labor tracking. Deployed at large state DOTs, transit agencies, utilities, manufacturing. IBM Maximo AIP (Asset Investment Planning) added June 2026 for basic capital planning.

**What the companion relationship should look like:**

| Direction | Data | Why It Matters |
|---|---|---|
| Maximo → Maintain | Asset master (ASSETNUM, SITEID, install date, location, classification, replacement cost) | Asset inventory foundation |
| Maximo → Maintain | Work order history (type, cost, completion date) | Condition signal: work order cost escalation is a leading indicator of deterioration |
| Maximo → Maintain | PM completion records | Validates that preventive maintenance was actually performed (affects deterioration model) |
| Maintain → Maximo | Capital need recommendations as planned work orders | Closes the loop: approved capital needs become Maximo WOs for scheduling |
| Maintain → Maximo | RUL alerts for assets approaching replacement threshold | Feeds Maximo's PM planning with lifecycle predictions |

**Current state:** ✅ Real production integration exists (Sprint 15). OSLC REST API, delta sync via CHANGEDATE, echo detection, composite key ASSETNUM:SITEID, supports Maximo 7.6.0 through MAS 8.11.

**What is missing despite the integration existing:**

- **IBM Maximo AIP data exchange** — AIP v9.2 (June 2026) generates health scores, criticality scores, and investment scenarios inside Maximo. Maintain does not consume or compare against AIP scores. A DOT running both Maximo AIP and Maintain would see conflicting capital need numbers with no reconciliation. This is a sales blocker that does not exist yet in our awareness.
- **PM schedule sync inbound** — The current integration syncs assets and work orders but does not pull Maximo PM schedules. Maintain cannot tell if an asset's condition is affected by completed vs. missed PM campaigns.
- **Failure mode classification** — Work orders come in with FAILDATE and FAILCODE but Maintain does not use these to distinguish between incidental repairs and structural failures. This distinction matters for Weibull calibration (only structural failures should reset the deterioration clock).
- **Multi-site disambiguation** — The ASSETNUM:SITEID composite key is implemented but site-to-district mapping (Maintain's geographic hierarchy) is not automatic. Manual configuration required per tenant.

**Severity of gaps:** Medium. The integration works. The gaps reduce analytical quality and create a potential conflict narrative with AIP.

---

## 4. Cityworks (now part of Trimble)

**What they do:** GIS-native work order management for public works. Strong in cities and counties. Now part of Trimble; will be absorbed into Trimble Unity Maintain.

**What the companion relationship should look like:** Same as Maximo — asset master, work order history in; capital need recommendations out.

**Current state:** ✅ Real production integration exists (Sprint 14). OAuth 2.0, Esri Feature Service geometry, delta sync via LastModifiedDate, echo detection via AdditionalData.SourceSystem.

**What is missing:**

- **Cityworks AMS (Asset Management System) vs. Cityworks PLL (Permits/Licenses/Licenses)** — Current integration targets Cityworks AMS for assets and work orders. Cityworks PLL holds permit and right-of-way data that is relevant for some asset condition signals (pavement cuts from utility permits accelerate deterioration). Not integrated.
- **Trimble migration path** — Cityworks is being replatformed into Trimble Unity Maintain. Customers currently on Cityworks will migrate. The integration will need to be pointed at Trimble Unity Maintain's API once migration completes. No plan for this transition exists in the codebase.
- **GIS geometry updates** — The current integration pulls geometry from Esri Feature Services at sync time. If a city updates its GIS layer (road segment reclassification, new road construction), Maintain does not detect and update geometry automatically. Delta sync only covers asset/WO records, not geometry changes.

**Severity of gaps:** Medium. The core integration works. The Trimble migration path is a time-sensitive gap — Cityworks customers will move to Unity Maintain and the integration will break without a plan.

---

## 5. AASHTOWare Bridge Management (BrM)

**What they do:** The national standard for bridge inspection data management. Every state DOT in the US uses BrM or its predecessor Pontis to store NBI bridge inspection records. AASHTOWare is AASHTO-governed software used by all 52 DOTs.

**What the companion relationship should look like:**

| Direction | Data | Why It Matters |
|---|---|---|
| BrM → Maintain | Bridge inventory (Structure ID, location, deck area, ADT, material, year built) | Bridge asset registry |
| BrM → Maintain | Inspection history (NBI items 58–113, element-level inspection, fracture-critical flags) | Core TAMP input — you cannot produce an FHWA-compliant bridge TAMP chapter without NBI data |
| BrM → Maintain | Condition ratings (Good/Fair/Poor determination per FHWA criteria) | Direct TAMP performance measure |
| BrM → Maintain | Sufficiency rating and structural appraisal items | Capital need prioritization |
| Maintain → BrM | None required | BrM is the record of truth for bridge inspection; Maintain reads, does not write |

**Current state:** ❌ Nothing. Zero integration. No connector, no stub, no interface, no documentation in vol-6. No BrM import capability of any kind.

**Why this is the most critical missing integration:**

A state DOT's TAMP bridge chapter must use NBI data. NBI data lives in BrM. Without a BrM connector, a state DOT using Maintain must manually export from BrM and manually import into Maintain for every inspection cycle (bridges are inspected at minimum every 2 years; fracture-critical bridges annually). That is more work than what they do today. No state DOT will sign an enterprise contract with this gap.

This single missing integration is the primary reason Maintain cannot be sold to state DOTs at enterprise pricing today.

**What is missing:**
- AASHTOWare BrM export format ingestion (BrM exports XML and CSV in standard NBI format)
- NBI element rating → Maintain condition score mapping
- Bridge inspection history import (20+ years of historical NBI data from existing BrM deployments)
- Ongoing sync: when a new bridge inspection is entered in BrM, it should flow to Maintain automatically (or on a scheduled basis)
- FHWA sufficiency rating calculation from raw NBI elements (Maintain must reproduce this to match BrM's TAMP numbers)

**Effort to build:** Medium. BrM has a documented export format. A batch import + delta sync connector using BrM's XML export or REST API (newer AASHTOWare versions) is a 6–8 week effort.

**Severity:** Critical. This is the #1 gap blocking state DOT enterprise sales.

---

## 6. HPMS (Highway Performance Monitoring System)

**What they do:** FHWA's national pavement condition database. Every state DOT submits an HPMS data file annually with pavement inventory and condition data (IRI, rutting, cracking, roughness). This is the official source of truth for pavement condition in TAMP performance measures.

**What the companion relationship should look like:**

| Direction | Data | Why It Matters |
|---|---|---|
| HPMS → Maintain | Historical HPMS submissions (up to 15 years of annual pavement condition data) | Immediately gives Maintain a calibrated dataset for deterioration modeling without waiting for Aurigo-recorded inspections |
| Maintain → HPMS | Annual HPMS export file | States must submit HPMS annually; if Maintain holds the pavement data, it must be able to generate the submission file |

**Current state:** ❌ Nothing. No HPMS import. No HPMS export. Not documented anywhere in vol-6.

**Why this matters:** Same reason as BrM. If Maintain holds pavement data but cannot produce the HPMS annual submission, the state DOT must maintain a parallel pavement system just for HPMS compliance. That parallel system is their existing PMS. They will not switch to Maintain.

**Effort to build:** Medium. HPMS format is a FHWA-published flat file spec. Import (historical years) is straightforward. Export (annual submission) requires mapping Maintain's pavement condition data to the 100+ HPMS data elements. 4–6 weeks.

**Severity:** Critical for state DOT market. Not needed for Primus.

---

## 7. Esri ArcGIS (Full GIS Companion — Beyond Geometry)

**What they do:** The dominant GIS platform in government. Most state DOTs and local agencies have an Esri enterprise license. ArcGIS holds the authoritative spatial inventory: road centerlines, bridge locations, parcel data, utility networks.

**Current state:** ✅ Partial. Esri Feature Service geometry pull exists (Sprint 11) — used by the Cityworks connector to get geometry for assets. This is not a full ArcGIS companion.

**What is missing for a true companion:**

- **Feature Service as primary asset import** — Many agencies maintain their asset inventory in ArcGIS as the system of record. Maintain should be able to import directly from an Esri Feature Service layer (not just as a geometry source for Cityworks). Currently no standalone ArcGIS asset import.
- **Bidirectional sync** — If an asset record is updated in ArcGIS (new road segment added, bridge rebuilt), Maintain should detect and update. Currently no change detection on ArcGIS layers.
- **ArcGIS Online / Portal authentication** — Current implementation handles portal tokens only if required (optional). Many agencies use ArcGIS Online with OAuth 2.0. This is not implemented.
- **Symbology export** — Maintain has its own Mapbox-based map. Agencies used to ArcGIS symbology conventions (color by condition, classification by asset type) cannot easily reconcile the two map views.

**Severity:** Medium. Most critical for the local agency tier where ArcGIS is the only system they have.

---

## 8. Aurigo Plan (Bidirectional Gap)

**Current state:** One-way push exists (Maintain → Plan via PushCapitalNeedToPlanHandler). Capital needs can be pushed from Maintain to Plan as project pipeline items.

**What is missing for a true companion:**

- **Plan → Maintain feedback loop** — When a capital need is funded in Plan (project approved, budget allocated), Maintain does not know. It continues showing the asset as an unfunded capital need. This creates a contradiction: the asset manager in Maintain sees an asset as critical-unfunded; the capital program manager in Plan has already programmed it. No reconciliation.
- **Project delivery status from Build → Maintain** — When a funded project completes in Build (road resurfaced, bridge deck replaced), the asset's condition clock should reset in Maintain. Currently this is documented as a Build → Maintain handoff but the actual data flow is one-way and thin (asset record created; condition not reset).
- **STIP/TIP import** — Plan manages the STIP/TIP program list. Maintain needs to know which of its capital-need assets are already in the STIP so it does not flag them as unfunded. This link does not exist.

**Severity:** High. This gap creates a credibility problem in every demo where a customer asks "what happens when a project gets funded?" The honest answer today is "Maintain doesn't know."

---

## 9. MaintainX / UpKeep (Primus CMMS Companions)

**What they do:** Modern CMMS tools popular in manufacturing and facilities. MaintainX and UpKeep are the Atom AI equivalents for the private sector — modern UX, mobile-first, work order management.

**Current state:** Documented in vol-6 (06-maintainx.md, 07-upkeep.md) but no code exists.

**What the companion relationship should look like:** Identical pattern to Maximo/Cityworks — consume work order history and asset master from their API; publish capital need recommendations back.

**What is missing:** The entire integration. Both are documented only.

**Severity:** High for Primus. Without these connectors, Maintain cannot serve the Primus manufacturing and facilities customers who almost all have one of these two tools already deployed.

---

## 10. SAP EAM / Oracle EAM / Infor EAM

**Current state:** Documented (vol-6 docs 02, 03, 05) but no code exists for any of them.

**Severity for Primus:** High. Large manufacturing plants and utilities predominantly run SAP PM or Oracle EAM. Without SAP integration, Maintain cannot enter the manufacturing segment seriously. UpKeep and MaintainX serve mid-market; SAP serves enterprise manufacturing.

**Severity for government:** Low. Government agencies primarily use Maximo, Cityworks, or Hansen (Hansen is not even documented). SAP in government is rare outside of large state governments using SAP for financials — and their EAM is usually still Maximo.

---

## The Honest Gap Summary

| Companion | Inbound exists | Outbound exists | Critical gap |
|---|---|---|---|
| **Atom AI** | ❌ None | ❌ None | No connector at all |
| **AgileAssets / Trimble** | ❌ None | ❌ None | Data migration path only; not runtime |
| **IBM Maximo** | ✅ Works | ✅ Works | AIP conflict, PM schedule, failure classification |
| **Cityworks** | ✅ Works | ✅ Works | Trimble migration path, geometry delta |
| **AASHTOWare BrM** | ❌ None | N/A | **Most critical gap — blocks all state DOT sales** |
| **HPMS** | ❌ None | ❌ None | **Blocks state DOT market — import + export both missing** |
| **Esri ArcGIS** | ⚠️ Geometry only | ❌ None | No standalone asset import, no change detection |
| **Aurigo Plan** | ❌ No feedback | ✅ Push only | Funded project status never returns to Maintain |
| **Aurigo Build** | ⚠️ Asset record only | ✅ Push | Condition reset on project completion not happening |
| **MaintainX** | ❌ None | ❌ None | Blocks Primus mid-market |
| **UpKeep** | ❌ None | ❌ None | Blocks Primus mid-market |
| **SAP EAM** | ❌ None | ❌ None | Blocks Primus enterprise |
| **Oracle EAM** | ❌ None | ❌ None | Blocks Primus enterprise |
| **Primavera P6** | ❌ Stub only | ❌ Stub only | Code exists; not validated against live instance |

---

## What This Means for the Committee

### The companion story has two working legs and eight broken ones

Maximo and Cityworks work. Those two integrations cover a meaningful portion of the government operations market. But the integrations that would make Maintain credible as a **state DOT capital planning companion** — BrM and HPMS — do not exist. And the integrations that would make Maintain credible as a **Primus private sector companion** — MaintainX, UpKeep, SAP — also do not exist.

The product is not yet a universal companion. It is a companion to Maximo/Cityworks customers and nothing else.

### Priority build order

Given what blocks revenue:

| Priority | Integration | Blocks | Sprint | Effort |
|---|---|---|---|---|
| 1 | **BrM / AASHTOWare** | All state DOT enterprise sales | Beta Sprint 1 | 6–8 weeks |
| 2 | **HPMS export + import** | State DOT TAMP compliance | Beta Sprint 1 | 4–6 weeks |
| 3 | **Aurigo Plan bidirectional** | Every cross-suite demo | Beta Sprint 1 | 3–4 weeks |
| 4 | **Atom AI connector** | City market (500+ prospects) | Beta Sprint 2 | 4–6 weeks |
| 5 | **MaintainX connector** | Primus mid-market | Beta Sprint 2 | 4–6 weeks |
| 6 | **Cityworks → Trimble migration** | Existing customer retention | Beta Sprint 2 | 2–3 weeks |
| 7 | **Maximo AIP conflict resolution** | Maximo customer credibility | Beta Sprint 3 | 2–3 weeks |
| 8 | **SAP EAM** | Enterprise manufacturing | GA | 8–12 weeks |
| 9 | **UpKeep connector** | Primus SMB | GA | 4–6 weeks |
| 10 | **Oracle / Infor EAM** | Large enterprise | Post-GA | 8–12 weeks each |

Full acceptance criteria and data contracts for each integration are in `02-beta.md`.

### What to say to the ELT

Maintain can be positioned as a companion product. The positioning is real — there is a genuine intelligence layer that sits above any EAM or operations tool. But the positioning is only credible today for Maximo and Cityworks customers. For every other product in the market — Atom AI, AgileAssets, BrM, HPMS, MaintainX, SAP — the connector does not exist and the companion story breaks down in the first technical conversation.

Building BrM + HPMS + Atom AI closes the three most important gaps. Those three integrations cover the majority of the addressable government market. With those three, the companion story becomes defensible. Without them, it remains a pitch.

---

*See also: [`vol-6-integration-strategy/`](.) for full adapter specifications · [`historical-data-continuity.md`](../vol-2-product-knowledge/domains/historical-data-continuity.md) for BrM historical import requirements · [`tamp.md`](../vol-2-product-knowledge/domains/tamp.md) for HPMS and BrM context in TAMP production*
