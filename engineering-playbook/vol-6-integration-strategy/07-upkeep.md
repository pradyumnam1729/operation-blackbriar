# 07 — UpKeep Integration

## Overview

UpKeep is a mobile-first CMMS founded in 2014, positioned as the most user-friendly maintenance management platform for small to mid-size operations. Its customer base is concentrated in manufacturing, facilities management, property management, and light industrial. UpKeep's key differentiators are its modern mobile application, ease of setup (minutes to onboard a technician), and competitive pricing.

UpKeep is relevant to the Aurigo Primus product line. Primus customers in commercial real estate, logistics, and private utilities often use UpKeep because it is simple and affordable. What UpKeep lacks — and what Primus Maintain provides — is capital planning intelligence: multi-year capital needs projection, asset replacement scheduling, and portfolio-level risk scoring.

UpKeep has invested in a REST API and developer ecosystem since 2021. The API is well-documented, supports OAuth 2.0, and includes webhook support for real-time event delivery.

## UpKeep Object Model

| Object | Description |
|---|---|
| Asset | Equipment, infrastructure, or any tracked item |
| Work Order | Maintenance task (corrective, preventive, inspection) |
| Request | Employee or guest work request |
| Part | Spare part in inventory |
| Location | Physical location (hierarchical: building → floor → room) |
| Team | Group of technicians |
| Category | Asset classification (customer-defined) |
| Procedure | Checklist template attached to work orders |

## Authentication

UpKeep uses OAuth 2.0 with client credentials for server-to-server integration.

```
POST https://api.upkeep.com/api/v2/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
```

Response:
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

UpKeep tokens have a 24-hour lifetime (86400 seconds), which is longer than most EAM APIs. Cache the token; refresh proactively 10 minutes before expiry and on any 401 response.

All API requests must include:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

## Data Mapping Table

### Asset Mapping

| UpKeep Field | Canonical Field | Type | Notes |
|---|---|---|---|
| `id` | CanonicalAsset.EamNativeId | string | UUID format |
| `name` | CanonicalAsset.Name | string | |
| `description` | CanonicalAsset.Description | string | |
| `serialNumber` | CanonicalAsset.SerialNumber | string | Nullable |
| `barCode` | CanonicalAsset.Barcode | string | Nullable; stored in CustomFields |
| `manufacturer` | CanonicalAsset.Manufacturer | string | Nullable |
| `model` | CanonicalAsset.Model | string | Nullable |
| `category` | CanonicalAsset.AssetTypeCode | string | Top-level category |
| `subCategory` | CanonicalAsset.AssetClassCode | string | Sub-category within category |
| `locationId` | CanonicalAsset.LocationCode | string | |
| `purchasedDate` | CanonicalAsset.InstallDate | DateOnly | |
| `purchasedCost` | CanonicalAsset.OriginalCost | decimal | |
| `residualValue` | CanonicalAsset.ResidualValue | decimal | |
| `status` | CanonicalAsset.Status | enum | operational/non-operational/being-repaired/out-of-service |
| `customFields[*]` | CanonicalAsset.CustomFields | dict | All custom fields preserved |
| `additionalInfos[*]` | CanonicalAsset.CustomFields | dict | Additional info fields |

### Work Order Mapping

| UpKeep Field | Canonical Field | Type | Notes |
|---|---|---|---|
| `id` | CanonicalWorkOrder.EamNativeId | string | UUID |
| `title` | CanonicalWorkOrder.Description | string | |
| `description` | CanonicalWorkOrder.Notes | string | |
| `status` | CanonicalWorkOrder.Status | enum | open/in_progress/on_hold/complete/cancelled |
| `priority` | CanonicalWorkOrder.Priority | enum | none/low/medium/high |
| `category` | CanonicalWorkOrder.Category | string | Maintenance type |
| `dueDate` | CanonicalWorkOrder.ScheduledEndDate | datetime | |
| `completedDate` | CanonicalWorkOrder.CompletedAt | datetime | |
| `assetId` | CanonicalWorkOrder.AssetEamId | string | |
| `totalCost` | CanonicalWorkOrder.ActualCost | decimal | |
| `createdAt` | CanonicalWorkOrder.ReportedAt | datetime | |
| `updatedAt` | (sync filter field) | datetime | Used for delta sync |

## Asset Hierarchy: Categories and Sub-Categories

UpKeep uses a two-level taxonomy: Category (top level) and Sub-Category. This maps to Aurigo's `AssetTypeCode` (category) and `AssetClassCode` (sub-category). Both are customer-defined in UpKeep.

Example category tree for a commercial real estate portfolio:
```
Building Systems
  ├── HVAC → HVAC_UNIT
  ├── Electrical → ELECTRICAL_PANEL
  └── Plumbing → PLUMBING_FIXTURE
Exterior
  ├── Roofing → ROOF_MEMBRANE
  ├── Facade → FACADE_SYSTEM
  └── Parking → PARKING_STRUCTURE
```

The adapter configuration includes mappings for both levels:

```json
{
  "assetCategoryMapping": {
    "Building Systems/HVAC": "HVAC_UNIT",
    "Building Systems/Electrical": "ELECTRICAL_PANEL",
    "Building Systems/Plumbing": "PLUMBING_FIXTURE",
    "Exterior/Roofing": "ROOF_MEMBRANE",
    "Exterior/Facade": "FACADE_SYSTEM",
    "Exterior/Parking": "PARKING_STRUCTURE"
  }
}
```

If a category/sub-category combination is not in the mapping, the adapter concatenates them as `{category}/{subCategory}` and stores it as the AssetTypeCode with a warning. This ensures no assets are dropped, and the onboarding team can add the mapping later.

## Custom Fields for Asset Attributes

UpKeep allows customers to add custom fields to assets. These store physical characteristics like dimensions, material type, and condition. The adapter preserves all custom fields in `CanonicalAsset.CustomFields`.

For well-known custom field names, the adapter applies semantic mapping:

```json
{
  "customFieldSemanticMapping": {
    "Length (ft)": "asset.lengthFt",
    "Area (sq ft)": "asset.areaSqFt",
    "Material": "asset.material",
    "Year Built": "asset.yearBuilt",
    "Condition Rating": "asset.conditionRating"
  }
}
```

If a customer has stored a condition rating in a custom field, Maintain imports it as the initial condition score rather than defaulting to the model-predicted score. This gives the capital planning engine a better starting point.

## Integration Modes

### Integrated Mode (Read-Only)

The adapter polls UpKeep every 15 minutes for changed assets and work orders. Delta sync uses the `updatedAt` field.

```
GET https://api.upkeep.com/api/v2/assets?updatedSince=2026-07-18T14:00:00Z&limit=100&page=1
Authorization: Bearer {token}
```

Maintain builds condition scores and RUL projections from the maintenance history (work orders per asset). These are displayed in the Maintain UI alongside the asset data from UpKeep.

### Hybrid Mode (Write-Back)

When a Maintain inspection workflow generates a work order recommendation, it can be pushed to UpKeep as a new work order:

```
POST https://api.upkeep.com/api/v2/work-orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Roof membrane replacement - building A",
  "description": "[Aurigo Maintain] Capital need CN-2026-0042. Remaining useful life: 2 years. Risk: High.",
  "priority": "high",
  "assetId": "asset-uuid-from-upkeep",
  "dueDate": "2027-01-15T00:00:00Z",
  "category": "Corrective"
}
```

The work order description includes the Maintain capital need ID for traceability.

## Webhook Setup

UpKeep supports webhooks via their integrations platform. Configure webhooks through the UpKeep web app or via API.

### Webhook API Registration

```
POST https://api.upkeep.com/api/v2/webhooks
Authorization: Bearer {token}
Content-Type: application/json

{
  "url": "https://integration.maintain.aurigo.net/upkeep/webhook",
  "events": ["work_order.completed", "work_order.updated", "asset.updated"],
  "secret": "{WEBHOOK_SECRET}"
}
```

Store the webhook secret in AWS Secrets Manager. The Maintain receiver validates the `X-UpKeep-Signature` header (HMAC-SHA256).

### Events to Subscribe

| Event | Trigger | Action in Maintain |
|---|---|---|
| `work_order.completed` | WO marked complete in UpKeep | Update asset maintenance history, recalculate condition |
| `work_order.updated` | WO status change | Keep sync state current without waiting for polling |
| `asset.updated` | Asset record modified | Trigger immediate re-sync of the modified asset |
| `asset.created` | New asset added | Trigger sync and capital planning flag for new asset setup |

## Setup and Configuration Steps

1. Log into UpKeep as organization admin
2. Go to Settings → Developer → API Keys
3. Create a new API key with permissions: `Assets Read`, `Work Orders Read/Write`, `Locations Read`
4. Navigate to Settings → Developer → OAuth Applications
5. Create a new OAuth app for "Aurigo Maintain Integration"
6. Copy Client ID and Client Secret to AWS Secrets Manager as `upkeep-{tenantId}-credentials`
7. In IntegrationAdapterConfig, create a record for the tenant with `adapterName: "upkeep"`
8. Fill in `assetCategoryMapping` with the customer's UpKeep category structure
9. Configure `customFieldSemanticMapping` if the customer has condition-related custom fields
10. Run the connectivity test: `GET /api/v2/assets?limit=1`
11. Review the sync dashboard after the first successful sync

## Rate Limits

UpKeep imposes:
- 500 requests per minute per API key (standard plans)
- 2,000 requests per minute (enterprise plans)

Configure the adapter with the appropriate limit:
```json
{ "rateLimitRequestsPerMinute": 500 }
```

For organizations with more than 5,000 assets, the initial load may require 10–15 minutes. Schedule initial loads during off-hours. Contact UpKeep support to request a temporary rate limit increase for the initial sync if needed.

## Common Issues

**Sub-categories not populating:** UpKeep returns sub-categories only when querying the asset detail endpoint, not the list endpoint. The adapter must fetch asset detail for each asset during initial load or use the bulk export endpoint (enterprise plans only).

**`purchasedDate` is null:** Many UpKeep users do not enter purchase dates. When `purchasedDate` is null, Maintain falls back to estimating install date from the work order creation date of the earliest work order for that asset.

**Custom fields have inconsistent naming:** Different UpKeep users at the same organization may have named the same field differently (e.g., "Length" vs "Length (ft)" vs "LENGTH"). The `customFieldSemanticMapping` must be built carefully during onboarding. Run a data quality report on UpKeep custom field names before going live.
