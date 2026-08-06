# Domain: Inventory

## Purpose

The inventory domain manages spare parts, materials, and tools that are consumed in maintenance and capital work. In the context of Aurigo Maintain, inventory management has a specific and limited scope: it is relevant primarily in Native mode (for customers without a separate EAM or ERP managing inventory) and as an integration source for customers whose parts and materials data resides in an existing system.

The inventory domain's connection to capital planning is its most distinctive contribution: when assets are approaching end of life and their capital replacement is in the capital plan, the inventory domain should inform stocking decisions for critical spare parts. Running out of a critical spare part at the moment of an asset failure — when the asset is past its replacement year and parts availability is uncertain — is an avoidable crisis if the capital plan and inventory system are connected.

Inventory is explicitly out of scope for the initial implementation phases. It is documented here for completeness and to inform future development.

## Business Value

**Critical spare parts availability:** For assets approaching end of life, the risk of unexpected failure increases. Maintaining adequate stock of critical spare parts reduces the MTTR when a failure does occur. Maintain can identify assets approaching the end of their modeled life and recommend stocking levels for their critical parts.

**Maintenance cost capture:** In Native mode, recording material consumption against work orders provides the complete maintenance cost per asset — labor plus parts. This cost data is essential for the maintenance cost trend analysis that feeds into capital planning.

**ERP integration:** For customers using SAP or Oracle for procurement and inventory, the integration with Maintain's work order system enables seamless recording of material consumption without duplicate data entry.

## Personas

**Storeroom Manager / Parts Supervisor:** Manages spare parts inventory, handles procurement of consumables, and ensures critical parts availability for planned and emergency maintenance.

**Maintenance Planner:** Plans maintenance work including material requirements. Checks inventory availability before scheduling work orders.

**Procurement Analyst:** Manages vendor relationships and purchasing for maintenance materials. Uses Maintain (or the ERP integration) to track consumption and set reorder points.

## User Stories

1. **As a Storeroom Manager**, I want to see which spare parts are associated with assets approaching end of life in the capital plan so that I can adjust stocking levels to ensure parts availability during the period between now and capital replacement.

2. **As a Maintenance Planner**, I want to add a bill of materials to a work order template so that planned work orders automatically include the required parts and materials, allowing availability checking before scheduling.

3. **As a Maintenance Manager**, I want to see the total material cost by asset class over the past 12 months so that I can identify asset classes with high parts consumption that may indicate deterioration.

4. **As an Integration Administrator**, I want to configure the integration with our SAP Material Management module so that parts consumption recorded against work orders in Maintain is reflected in SAP inventory without manual re-entry.

5. **As a Storeroom Manager**, I want to be alerted when a critical spare part's stock level falls below the reorder point so that I can initiate procurement before the part becomes unavailable.

## Business Rules

1. **Stock level floor for critical parts:** Critical parts (those associated with assets classified as criticality 4 or 5) have a configurable minimum stock level. Stock below this level triggers a reorder alert.

2. **Material consumption links to work order:** Parts consumed in maintenance work must be linked to a work order. "General" parts consumption without a work order reference is not allowed.

3. **Inventory valuation method:** Parts are valued at average cost (weighted average). The inventory valuation method is not configurable (fixed at average cost for simplicity).

4. **Integration with ERP:** When ERP integration is active, inventory quantities are mastered in the ERP. Maintain reads inventory levels from the ERP and does not maintain its own quantity records for parts that are ERP-managed.

## Integration Points

- **ERP Systems (SAP, Oracle):** Material master records, stock levels, and consumption transactions are integrated with the ERP when active.
- **Work Orders Domain:** Material consumption is recorded against work orders. Work order completion triggers the consumption transaction.
- **Capital Planning Domain:** Assets approaching end of life in the capital plan are cross-referenced with their associated spare parts to inform stocking recommendations.

## Future Evolution

- **AI-driven stocking recommendations:** ML model that recommends reorder quantities based on historical consumption patterns and the capital replacement schedule
- **Vendor portal integration:** Direct purchase order creation and vendor acknowledgment through the Maintain interface, without requiring a separate procurement system
- **Condition-based spare parts forecasting:** When the AI flags an asset as high failure risk, automatically increase the recommended stocking level for its critical parts

---

*See also: [Work Orders Domain](work-orders.md) | [Preventive Maintenance Domain](preventive-maintenance.md) | [Capital Planning Domain](capital-planning.md)*
