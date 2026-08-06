# Domain: Asset Warranty Attributes

> **Scope note:** This document covers **Version A — Warranty Attributes** only.  
> Version B (warranty claims workflow, contractor portal, parts replacement tracking) is explicitly out of scope per `CLAUDE.md` and `vault/decisions/ADR-011-warranty-attributes.md`.  
> Any feature that introduces claim status, contractor entities, or parts tracking requires a new ADR and PM scope approval before implementation.

---

## Purpose

When infrastructure is replaced or rehabilitated, contractors typically provide a warranty period. During this period the contractor is obligated to fix defects at no cost to the agency. Agencies currently track this in spreadsheets and frequently miss the warranty window — spending public funds on repairs that should have been covered by the contractor.

Warranty Attributes in Maintain give asset managers a single place to record warranty expiry dates, receive alerts before windows close, and filter asset lists to identify what is currently under warranty before authorising repair spend.

---

## Business Value

**Cost avoidance:** A missed warranty claim on a bridge bearing replacement can cost an agency $20,000–$200,000. Systematic tracking with 90-day alerts converts this from a process failure risk to a managed obligation.

**Audit defensibility:** Agencies that can demonstrate they tracked and acted on warranty periods have a stronger record for GASB 34 infrastructure reporting and TAMP documentation. "We replaced this bearing four years ago and the contractor's warranty covered the defect" is a defensible cost-avoidance record.

**Capital plan accuracy:** An asset under warranty with a known defect should not appear in the capital needs list as a replacement candidate — the warranty may cover the repair. Filtering assets by warranty status improves capital plan accuracy.

---

## Personas

**Asset Manager (Primary):** Records warranty information when logging a rehabilitation maintenance event. Needs to know at a glance which assets are under warranty when reviewing capital needs.

**Capital Program Manager:** Uses the "Under Warranty" filter when reviewing capital needs to avoid programming funded replacements for assets that should be covered by an active warranty.

**Inspector:** May note during inspection that a recently repaired element is showing distress. The warranty flag on the asset detail page tells the inspector whether to flag this as a warranty claim (contractor responsibility) vs. a capital need (agency cost).

---

## User Stories

1. **As an Asset Manager**, I want to record a warranty when logging a rehabilitation maintenance event so that I know which assets are under warranty and when the warranty expires.

   *Acceptance criteria:*
   - Warranty form accepts: vendor/contractor name (text), warranty period in months (integer), and optional notes
   - System computes `WarrantyExpiresOn` from the rehabilitation event date + warranty period months
   - Alternatively, the user can enter `WarrantyExpiresOn` directly if the warranty expiry is specified as a fixed date in the contract
   - Warranty is associated with the specific maintenance event, not with the asset class

2. **As an Asset Manager**, I want to see the current warranty status on the asset detail page so that I know whether an asset is under warranty before authorising repair work.

   *Acceptance criteria:*
   - Asset detail page shows a "Under Warranty" panel when a warranty record exists and `WarrantyExpiresOn` is in the future
   - Panel displays: vendor name, expiry date, days remaining, warranty notes
   - Panel shows "Warranty Expired" (greyed) when `WarrantyExpiresOn` is in the past, with the historical expiry date
   - Panel is absent when no warranty has been recorded

3. **As an Asset Manager**, I want to filter the asset list to show only assets currently under warranty so that I can quickly identify which assets I should not spend repair funds on.

   *Acceptance criteria:*
   - Asset list has a "Under Warranty" filter toggle
   - When active, shows only assets with `WarrantyExpiresOn > today`
   - Filter state is preserved in the URL (shareable link)

4. **As a Capital Program Manager**, I want the system to alert me 90 days before a warranty expires so that I have time to inspect the asset and file a claim if defects are present.

   *Acceptance criteria:*
   - Alert appears in the dashboard capital needs panel as "Warranty expiring: [Vendor] — [Date]"
   - Alert appears 90 calendar days before `WarrantyExpiresOn` (configurable per tenant via domain profile)
   - Alert is not duplicated if already open for that asset
   - Alert is dismissed automatically if the warranty is removed or the expiry date is extended

5. **As a Capital Program Manager**, I want warranty information to appear in the TAMP asset condition report so that our TAMP documentation reflects which rehabilitation events are still under contractor warranty.

   *Acceptance criteria:*
   - Asset condition report export includes a "Warranty Expiry" column (date or "N/A")
   - Warranty expiry date appears next to the rehabilitation event date in the asset maintenance history section

6. **As an Asset Manager**, I want a warning when I try to retire an asset that has an active warranty so that I don't lose the warranty claim opportunity before the asset record is archived.

   *Acceptance criteria:*
   - Attempting to retire an asset with `WarrantyExpiresOn > today` shows a warning dialog: "This asset has an active warranty until [date]. Retiring the asset will end warranty tracking. Continue?"
   - The user can override the warning and proceed with retirement
   - Warning is informational, not blocking

---

## Business Rules

1. **One active warranty per maintenance event.** A single rehabilitation event cannot have more than one active warranty record. If the contractor provides separate warranties for materials vs. labour, enter the shorter expiry date and note both in the warranty notes field.

2. **Warranty is event-scoped, not asset-scoped.** Warranty attaches to the specific rehabilitation maintenance event. If an asset is rehabilitated twice, each rehabilitation has its own warranty record. The "active warranty" shown on the asset detail page is the most recent one where `WarrantyExpiresOn > today`.

3. **Vendor is a free-text string.** There is no contractor/vendor entity. Vendor name inconsistencies (e.g., "Smith Bros Construction" vs. "Smith Brothers") are the agency's responsibility to manage. Version B (if ever implemented) would introduce a Contractor entity; Version A does not.

4. **Warranty period in months, not days.** Infrastructure contracts specify warranty in years or months (e.g., "24-month warranty"). The system stores `WarrantyPeriodMonths` and computes `WarrantyExpiresOn` by adding months to the rehabilitation event date. If the agency provides an exact expiry date instead, the system accepts it directly.

5. **Retired assets are excluded from warranty alerts.** When an asset is retired, its warranty records remain in the database for audit history but the 90-day expiry alert is not surfaced.

6. **Warranty notes are not a claim system.** The `WarrantyNotes` field is free-text for recording contract reference numbers, contact names, or notes for the agency's own records. It does not create a claim, notify the contractor, or track claim status.

---

## Data Model

```
WarrantyRecord
├── Id                   uuid PK
├── TenantId             uuid FK → Tenant (multi-tenancy, global query filter)
├── MaintenanceEventId   uuid FK → MaintenanceEvent.Id
├── AssetId              uuid FK → Asset.Id (denormalised — see ADR-011)
├── WarrantyExpiresOn    date NOT NULL
├── WarrantyVendor       varchar(200) NULL
├── WarrantyPeriodMonths int NOT NULL  CHECK (WarrantyPeriodMonths > 0)
├── WarrantyNotes        text NULL
├── CreatedAt            timestamptz NOT NULL
└── UpdatedAt            timestamptz NOT NULL
```

Indexes:
- `UNIQUE (MaintenanceEventId)` — one warranty per rehabilitation event
- `PARTIAL INDEX (TenantId, AssetId) WHERE WarrantyExpiresOn > now()` — powers the "under warranty" filter efficiently

---

## What This Domain Does NOT Include (Version B — Out of Scope)

| Feature | Status | See |
|---|---|---|
| Warranty claim submission | ❌ Out of scope | ADR-011 scope boundary |
| Claim status tracking (Open / Filed / Accepted / Closed) | ❌ Out of scope | ADR-011 scope boundary |
| Contractor entity / vendor management | ❌ Out of scope | ADR-011 scope boundary |
| Parts replaced under warranty | ❌ Out of scope | CLAUDE.md (parts/inventory) |
| External contractor access or portal | ❌ Out of scope | Separate auth scope |
| Subcontractor warranty distinction | ❌ Out of scope | ADR-011 scope boundary |
| Warranty transfer (asset sold to another agency) | ❌ Out of scope | Future consideration |

---

## Related

- `vault/decisions/ADR-011-warranty-attributes.md` — architecture decision and scope boundary
- `vault/calculations/WarrantyExpiryAlerter.md` — 90-day alert rule and thresholds
- `engineering-playbook/vol-2-product-knowledge/domains/asset-management.md` — parent domain
- `engineering-playbook/vol-2-product-knowledge/domains/maintenance.md` — `MaintenanceEvent` parent entity
- `CLAUDE.md` — In Scope / DO NOT sections
