# 04 — Cityworks Integration

## Overview

Cityworks is the dominant work management system in US local government — cities, counties, water utilities, and stormwater agencies. Unlike Maximo or SAP, Cityworks is purpose-built for public works and utilities, which means its data model closely matches how public agencies actually think about their infrastructure. It was acquired by Trimble and has deep Esri integration: assets in Cityworks are often managed as features in ArcGIS, with geometry stored in Esri Feature Services rather than (or in addition to) the Cityworks database.

Cityworks has two major product lines: **AMS** (Asset Management System) for asset maintenance and **PLL** (Permits, Licenses, and Land) for permitting and land management. For Maintain, the integration target is Cityworks AMS.

Cityworks is particularly important for the Masterworks product line (public agencies). Many cities running Cityworks lack capital planning capability — they manage work orders efficiently but have no structured process for assessing asset condition, projecting remaining useful life, or building a capital improvement program. This is exactly the intelligence gap Maintain fills.

## Cityworks AMS Overview

| Object | Description |
|---|---|
| ServiceRequest | Citizen or staff-initiated request for service |
| WorkOrder (WO) | Work to be performed, can include labor, materials, equipment |
| Project | Collection of related work orders |
| Asset (AMS Entity) | Infrastructure asset, often linked to a GIS feature |
| Inspection | Formal condition assessment (IMS module) |
| Employee | Technician or staff member |
| Contract | Service contract with a vendor |

Cityworks REST API is available in version 23 and later. Older installations (22.x and earlier) use SOAP-based APIs. The adapter supports REST v23+ by default; SOAP fallback is available for legacy deployments.

## API and Authentication

### REST v23+ (OAuth 2.0)

Cityworks REST API uses OAuth 2.0 with client credentials or authorization code flow. For service-to-service integration, use client credentials.

```
POST https://{cityworks-host}/CityworksOnline/Services/authentication/token
Content-Type: application/json

{
  "LoginName": "maintain_svc",
  "Password": "secret",
  "CWUser": "false"
}
```

Note: Cityworks uses a custom token endpoint format, not standard OAuth. The response includes an `Value` field containing the token. Include the token in all API calls:
```
Authorization: Bearer {token}
```

Token lifetime is configurable by the Cityworks administrator. The adapter refreshes the token 5 minutes before expiry.

### Esri Feature Service for Geometry

Cityworks assets are often ArcGIS features. The geometry (coordinates) for roads, bridges, pipes, and signs is stored in the ArcGIS feature service, not in the Cityworks database. The Cityworks record contains a `GISID` or `OBJECTID` that corresponds to the ArcGIS feature.

For accurate geometry, the Maintain adapter should pull geometry from the Esri Feature Service directly, not from the Cityworks API. Esri Feature Services return GeoJSON with `Point`, `Polyline`, or `Polygon` geometries.

```
GET https://{arcgis-server}/server/rest/services/Infrastructure/RoadCenterlines/FeatureServer/0/query
    ?where=1=1
    &outFields=OBJECTID,ROADNAME,FROMSTREET,TOSTREET,LENGTH,INSTALLDATE
    &returnGeometry=true
    &outSR=4326
    &f=geojson
```

The GIS department maintains these feature services. Coordinate with the agency's GIS team to get feature service URLs and confirm the `OBJECTID` or `GlobalID` linkage to Cityworks asset IDs.

## Data Mapping Table

| Cityworks Field | Canonical Field | Type | Notes |
|---|---|---|---|
| Entity.EntityId | CanonicalAsset.EamNativeId | string | |
| Entity.EntityType | CanonicalAsset.AssetTypeCode | string | Requires customer-specific type mapping |
| Entity.EntityUID | CanonicalAsset.ExternalGisId | string | ArcGIS OBJECTID or GlobalID |
| Entity.EntityDescription | CanonicalAsset.Name | string | |
| Entity.InstallDate | CanonicalAsset.InstallDate | DateOnly | |
| Entity.RetireDate | CanonicalAsset.DecommissionDate | DateOnly? | Nullable |
| Entity.Location | CanonicalAsset.LocationCode | string | Text description |
| Entity.Geometry (from GIS) | CanonicalAsset.Geometry | Geometry | Pull from Esri Feature Service |
| Entity.Status | CanonicalAsset.Status | enum | ACTIVE/INACTIVE/RETIRED |
| Entity.SearchAttributes["MATERIAL"] | CanonicalAsset.CustomFields["Material"] | string | Custom attribute |
| Entity.SearchAttributes["LENGTH"] | CanonicalAsset.CustomFields["LengthFt"] | string | Custom attribute |
| WorkOrder.WorkOrderId | CanonicalWorkOrder.EamNativeId | string | |
| WorkOrder.Description | CanonicalWorkOrder.Description | string | |
| WorkOrder.InitiateDate | CanonicalWorkOrder.ReportedAt | datetime | |
| WorkOrder.ScheduledStartDate | CanonicalWorkOrder.ScheduledStartDate | datetime | |
| WorkOrder.ActualFinishDate | CanonicalWorkOrder.CompletedAt | datetime | |
| WorkOrder.Status | CanonicalWorkOrder.Status | enum | Open/Closed/Cancelled |
| WorkOrder.ActualCost | CanonicalWorkOrder.ActualCost | decimal | Sum of labor + material |
| WorkOrder.EntityId | CanonicalWorkOrder.AssetEamId | string | FK to asset |
| WorkOrder.Geometry (centroid) | CanonicalWorkOrder.Location | Point | From work order location |

## GIS-First Integration

The most important design principle for Cityworks integration is: **get the geometry from Esri, not from Cityworks.** Cityworks stores a reference to the GIS feature (via `EntityUID` or `GISID`), but the authoritative geometry lives in ArcGIS.

Why this matters:
- Agencies update road centerlines and facility footprints in ArcGIS, not in Cityworks
- ArcGIS geometry is often more precise (GPS survey quality) than addresses typed into Cityworks
- Cityworks point locations for linear assets (roads, pipes) are typically just midpoints

Implementation:
1. Extract `EntityUID` from Cityworks asset records
2. Batch-query the ArcGIS Feature Service using those UIDs: `where=GlobalID IN ('uid1','uid2',...)`
3. Store the GeoJSON geometry in `CanonicalAsset.Geometry` (convert to WKT for PostGIS)

For agencies that do not have an ArcGIS instance or whose Cityworks is not GIS-linked, fall back to geocoding the `Entity.Location` text field using the Aurigo geocoding service.

## Asset Type Mapping

Cityworks EntityType codes are agency-specific. Every agency configures its own asset types in Cityworks. There is no standard taxonomy. The adapter configuration includes an `assetTypeMapping` section that the implementation team fills in with the customer during onboarding.

```json
{
  "assetTypeMapping": {
    "RD": "ROAD_SEGMENT",
    "RDPVMT": "ROAD_PAVEMENT",
    "BRDG": "BRIDGE",
    "CULV": "CULVERT",
    "SGN": "SIGN",
    "SWLK": "SIDEWALK",
    "DRPIPE": "DRAINAGE_PIPE",
    "STRMLT": "STREETLIGHT"
  }
}
```

The right column values are Aurigo canonical AssetClassCodes that must exist in the `AssetClass` reference table. The onboarding team must add any missing asset classes before the initial sync.

## Work Order Sync

Cityworks work orders are linked to assets via `EntityId`. The sync includes the asset reference so that Maintain can build the maintenance history per asset — a critical input to the RUL calculation.

Work order status mapping:

| Cityworks Status | Canonical Status |
|---|---|
| Open | Open |
| InProgress | InProgress |
| Submitted | Open |
| Closed | Closed |
| Cancelled | Cancelled |
| Pending | Open |

## Setup Checklist

- [ ] Confirm Cityworks version (23+ for REST API support)
- [ ] Create Cityworks service account `maintain_svc` with read-only domain access
- [ ] Grant domain permissions: Read on Work Management, Asset Management, Inspection Management
- [ ] Confirm REST API is licensed and enabled on the Cityworks server
- [ ] Obtain API base URL: `https://{cityworks-host}/CityworksOnline/Services/`
- [ ] Map Cityworks EntityType codes to Aurigo AssetClassCodes (fill in assetTypeMapping)
- [ ] Coordinate with GIS team: obtain ArcGIS feature service URLs for each asset class
- [ ] Confirm ArcGIS Global ID or Object ID matches Cityworks EntityUID
- [ ] Configure ArcGIS REST service credentials (or public access if available)
- [ ] Store all credentials in AWS Secrets Manager
- [ ] Create IntegrationAdapterConfig for the tenant
- [ ] Run connectivity test
- [ ] Validate geometry pull from ArcGIS Feature Service
- [ ] Schedule initial load

## Cityworks Admin Configuration Steps

The Cityworks administrator must complete these steps before the integration can go live:

1. In Cityworks Admin, create a new Domain Account for `maintain_svc`
2. Assign the account to the `Maintain Integration` domain group (create this group)
3. In Domain Group Permissions, set: Work Management → Read, Asset Management → Read, Inspection Management → Read
4. Generate an API key for the account in Cityworks Settings → API Keys
5. Confirm the Cityworks REST API service is running: `GET https://{host}/CityworksOnline/Services/general/version` should return 200
6. If Cityworks is behind a firewall, open port 443 to the Maintain integration service's outbound IP range

## Common Issues

**Empty geometry on assets:** EntityUID is not linked to GIS features. Either the agency has not linked Cityworks to ArcGIS, or the feature service URL is incorrect. Fall back to geocoding.

**Asset type mapping incomplete:** New asset types added to Cityworks after onboarding are not in the mapping table. These assets will sync with `AssetClassCode = UNKNOWN`. The onboarding team should monitor the UNKNOWN asset class count in the sync dashboard and update the mapping when new types appear.

**Work orders not syncing for certain asset types:** Domain group permissions are scoped by asset type in some Cityworks configurations. Verify the service account has permissions for all required asset types.

**Cityworks 22.x SOAP fallback:** Set `"apiVersion": "22-soap"` in the adapter config to activate SOAP mode. SOAP mode does not support delta sync via last-modified timestamp — full sync must be run nightly. The customer should be encouraged to upgrade to Cityworks 23+.
