# 03 — Oracle EAM Integration

## Overview

Oracle Enterprise Asset Management (EAM) appears in two major forms: Oracle E-Business Suite (EBS) with the eAM module, and Oracle Fusion Cloud (Oracle Cloud ERP) with the Asset Lifecycle Management module. Both are used in public sector — EBS more commonly in state and county governments that deployed in the 2000s, Fusion Cloud in newer deployments and agencies that have migrated to Oracle Cloud.

Oracle EAM is tightly coupled to Oracle's financial modules (GL, AP, Procurement), which makes it sticky and gives it strong cost tracking capabilities. For Maintain, this means work order cost data is accurate and complete when sourced from Oracle EAM — an advantage over some other EAM systems.

**Key Oracle EAM tables and APIs:**

| Object | EBS Table / Fusion Resource | Description |
|---|---|---|
| Asset | EAM_ORG_MAINT_DEFAULTS / Asset | Equipment and infrastructure assets |
| Work Order | WIP_ENTITIES / MaintenanceWorkOrder | Maintenance work orders |
| Asset Activity | EAM_ASSET_ACTIVITIES | PM tasks and activity definitions |
| Meter | CSI_COUNTERS_VL | Asset meters and readings |
| Defect | EAM_WORK_REQUESTS | Work requests generated from defects |
| Asset Route | EAM_JOB_OPERATIONS | Work order operations and steps |
| Organization | MTL_PARAMETERS | Inventory organizations (multi-org) |

## Integration Options

### Oracle Integration Cloud (OIC)

For Oracle Cloud ERP customers, Oracle Integration Cloud is the standard middleware. OIC has pre-built adapters for Oracle Fusion and exposes a standardized REST interface to external systems. Maintain connects to OIC as an external REST consumer.

Advantages: Oracle-managed, pre-built asset and work order connectors, event subscription support via Oracle Business Events.
Disadvantages: Additional licensing cost, adds a middleware layer that requires Oracle admin involvement.

### REST APIs for Oracle Fusion Cloud

Oracle Fusion Cloud exposes REST APIs directly (REST API documentation at `https://docs.oracle.com/en/cloud/saas/maintenance/`). The Fusion REST API is the preferred direct-integration path for Oracle Cloud customers who do not have OIC or prefer direct API access.

Key Fusion REST endpoints:
- `GET /fscmRestApi/resources/latest/maintenanceWorkOrders` — work orders
- `GET /fscmRestApi/resources/latest/maintenanceAssets` — assets
- `GET /fscmRestApi/resources/latest/maintenanceActivities` — PM activities
- `GET /fscmRestApi/resources/latest/maintenanceWorkRequests` — defects/work requests

### Oracle Business Events for EBS

Oracle EBS raises Business Events when key records change. The Maintain integration service can subscribe to EBS Business Events via the Oracle Advanced Queuing (AQ) messaging framework. This enables near-real-time sync without polling.

Key business events:
- `oracle.apps.eam.workorder.create` — new work order created
- `oracle.apps.eam.workorder.complete` — work order completed
- `oracle.apps.eam.asset.update` — asset record updated

## Data Mapping Table

| Oracle Field / Resource | Type | Canonical Field | Notes |
|---|---|---|---|
| AssetNumber (Fusion) / ASSET_NUMBER (EBS) | string | CanonicalAsset.EamNativeId | |
| AssetDescription / DESCRIPTION | string | CanonicalAsset.Name | |
| AssetType / ASSET_TYPE_CODE | string | CanonicalAsset.AssetTypeCode | |
| SerialNumber / SERIAL_NUMBER | string | CanonicalAsset.SerialNumber | |
| ManufacturerName / MANUFACTURER_NAME | string | CanonicalAsset.Manufacturer | |
| DateInService / DATE_IN_SERVICE | date | CanonicalAsset.InstallDate | |
| CurrentCost / CURRENT_COST | decimal | CanonicalAsset.OriginalCost | |
| OwningDepartment / OWNING_DEPARTMENT | string | CanonicalAsset.DepartmentCode | |
| InventoryOrgCode / ORGANIZATION_CODE | string | CanonicalAsset.SiteCode | |
| ActiveStatus / ACTIVE | bool | CanonicalAsset.Status | true→Active, false→Inactive |
| WorkOrderNumber / WO_ID | string | CanonicalWorkOrder.EamNativeId | |
| WorkOrderDescription / DESCRIPTION | string | CanonicalWorkOrder.Description | |
| CreationDate / CREATION_DATE | datetime | CanonicalWorkOrder.ReportedAt | |
| ScheduledStartDate / SCHEDULED_START_DATE | datetime | CanonicalWorkOrder.ScheduledStartDate | |
| ActualEndDate / ACTUAL_COMPLETION_DATE | datetime | CanonicalWorkOrder.CompletedAt | |
| WorkOrderStatus / STATUS_TYPE | string | CanonicalWorkOrder.Status | RELEASED/COMPLETE/CLOSED |
| ActualCost / ACTUAL_COST | decimal | CanonicalWorkOrder.ActualCost | |
| AssetNumber (on WO) | string | CanonicalWorkOrder.AssetEamId | FK to asset |

## Authentication

### OAuth 2.0 (Oracle Fusion Cloud)

Oracle Fusion Cloud uses OAuth 2.0 with a 3-legged or 2-legged (client credentials) flow. For service-to-service integration use client credentials via Oracle Identity Domain.

```
POST https://{identity-domain}.identity.oraclecloud.com/oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&scope=https://{fusion-host}/fscmRestApi
```

Token lifetime is typically 3600 seconds. Cache and refresh with a 60-second safety margin.

### Basic Authentication (Oracle EBS)

Oracle EBS REST APIs (if REST is enabled via Oracle Web Services) use Basic Auth with a database application user. The user must have the `eAM User` responsibility.

```
Authorization: Basic base64(username:password)
```

For EBS, also set the `Responsibility-Key` header to scope the request to the correct EAM responsibility:
```
Responsibility-Key: EAM_RESPONSIBILITY
```

## Multi-Org Setup

Oracle's multi-org architecture (introduced in EBS 11i) means every record belongs to an operating unit and/or inventory organization. A single Oracle EBS instance may serve dozens of operating units — for a state, this might mean each county agency or department has its own operating unit.

**Critical configuration:** The Maintain adapter must be configured with the correct organization codes for the tenant. Every Oracle API call requires an `InventoryOrgId` parameter or the `ORG_ID` moac context set.

```json
{
  "oracleOrganizations": [
    { "orgCode": "CITY_STREETS", "orgId": 101, "siteCode": "STREETS" },
    { "orgCode": "CITY_PARKS", "orgId": 102, "siteCode": "PARKS" },
    { "orgCode": "CITY_WATER", "orgId": 103, "siteCode": "WATER" }
  ]
}
```

The sync job iterates over each configured organization and runs the asset/work order queries per org. Results are tagged with the `SiteCode` from the org mapping.

## Unit of Measure Conversions

Oracle uses UOM codes from `MTL_UNITS_OF_MEASURE`. Asset dimensions (length, area, volume) may be stored in different units depending on the agency's configuration. The adapter must normalize to Maintain's canonical units:

| Oracle UOM Code | Canonical Unit |
|---|---|
| FT | feet |
| MI | miles |
| SQ-FT | square_feet |
| SQ-YD | square_yards (convert to sq ft: × 9) |
| LF | linear_feet |
| EA | each |

Maintain stores all linear measurements in feet and all area measurements in square feet internally. Conversion factors are in the `UomConversionService`.

## Sync Strategy

### Initial Load

Oracle Fusion REST supports `limit` and `offset` parameters for pagination:
```
GET /fscmRestApi/resources/latest/maintenanceAssets
    ?limit=200
    &offset=0
    &fields=AssetNumber,AssetDescription,AssetType,...
    &finder=LastUpdatedSinceDate;LastUpdatedDate=2000-01-01T00:00:00Z
```

For EBS, use a database view or the custom EBS extractor report that exports to a flat file. Parse the flat file in the adapter. This is the recommended approach for large EBS installations (> 100K assets).

### Delta Sync

Oracle Fusion: use the `LastUpdatedSinceDate` finder parameter.
Oracle EBS: query `EAM_ORG_MAINT_DEFAULTS.LAST_UPDATE_DATE > :lastSyncAt`.

## Error Handling

| Error | Handling |
|---|---|
| 401 Unauthorized | Refresh OAuth token; retry once |
| 403 Forbidden | Check operating unit authorization; log and alert |
| Multi-org query returns empty | Org ID mismatch; verify org configuration |
| UOM code not recognized | Use raw value; log UOM code for manual mapping |
| Date format mismatch | Oracle returns ISO 8601 from Fusion REST; EBS may return `DD-MON-RRRR` — parse both |

## Common Issues

**Assets missing despite correct org:** Oracle Fusion REST requires the `EffectiveDate` query parameter to be set to today's date to return currently active assets. Without it, some APIs return empty results.

**Work order cost is $0:** Oracle posts actual costs asynchronously via cost processor. There is a 24-hour window after work order completion before costs are fully settled. Do not treat $0 cost on a recently completed work order as an error.

**Duplicate assets across org boundaries:** Oracle does not enforce uniqueness of asset numbers across organizations. Use `OrgCode:AssetNumber` as the composite EamNativeId to prevent collisions.
