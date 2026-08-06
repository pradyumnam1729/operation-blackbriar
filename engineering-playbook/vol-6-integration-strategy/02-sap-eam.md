# 02 — SAP EAM (Plant Maintenance) Integration

## Overview

SAP Plant Maintenance (PM), part of SAP ECC and SAP S/4HANA, is the EAM of choice for large state agencies, toll authorities, ports, and private-sector infrastructure operators. SAP PM is powerful, deeply integrated with SAP Finance and Materials Management, and notoriously complex to integrate with external systems.

SAP PM is not a standalone system — it is a module within the SAP ecosystem. Work order costs flow to SAP FICO. Material requisitions flow to SAP MM. This tight integration is its strength and the reason agencies do not replace it lightly. Aurigo Maintain reads from SAP PM to understand asset condition and maintenance history, and in Hybrid Mode writes back recommended maintenance orders.

**Core SAP PM objects and their technical equivalents:**

| SAP Object | SAP Table | Description |
|---|---|---|
| Equipment | EQUI / EQUZ | Individual assets (pumps, bridges, vehicles) |
| Functional Location | IFLOT | Hierarchical physical location structure |
| Maintenance Order | AUFK / AFKO | Corrective and planned maintenance work |
| Maintenance Plan | MHIS / MPLA | PM schedules and service plans |
| Notification | QMEL / QMIH | Defects, requests, activity reports |
| Measuring Point | IMPT / IMRG | Meter readings and counter documents |
| Maintenance Activity Type | T354 | Classification of work activities |

## Integration Options

### SAP OData (S/4HANA)

SAP S/4HANA exposes standard OData v2 and v4 services for PM objects. This is the preferred integration path for any SAP S/4HANA deployment (2020+). The OData services are pre-built, well-documented, and support $filter, $select, $top, $skip.

Key OData services:
- `API_EQUIPMENT_SRV` — equipment (assets)
- `API_MAINTNOTIFICATION_SRV` — maintenance notifications (defects)
- `API_MAINTENANCEORDER_SRV` — maintenance orders (work orders)
- `API_PM_MAINTENANCEPLAN_SRV` — maintenance plans (PM schedules)

### BAPI/RFC (SAP ECC)

SAP ECC (pre-S/4HANA) does not have OData APIs. Integration uses BAPIs (Business API Function Modules) called via SAP RFC (Remote Function Call). The .NET adapter uses the SAP NetWeaver RFC SDK via the `SAP.Middleware.Connector` NuGet package (SAP NCo).

Key BAPIs:
- `BAPI_EQUI_GETLIST` — list equipment with filters
- `BAPI_EQUI_GETDETAIL` — single equipment detail
- `BAPI_ALM_ORDER_GETLIST` — list maintenance orders
- `PM_ORDER_GET_DETAIL` — maintenance order detail (custom FM, varies by SAP version)

BAPI calls are synchronous and slow for bulk operations. Use IDoc/ALE for initial load and bulk sync. BAPIs for delta sync only.

### SAP Integration Suite (Cloud)

For agencies using SAP BTP (Business Technology Platform), the SAP Integration Suite (formerly SAP CPI) can be used as a middleware layer. The adapter communicates with Integration Suite, which handles the SAP backend communication. This isolates the Maintain adapter from SAP version differences.

## Data Mapping Table

| SAP Field | SAP Table/Object | Canonical Field | Notes |
|---|---|---|---|
| EQUNR | EQUI | CanonicalAsset.EamNativeId | Equipment number |
| EQKTX | EQKT (text) | CanonicalAsset.Name | Equipment short description |
| EQART | EQUI | CanonicalAsset.AssetTypeCode | Equipment type |
| ILART | IFLOT | CanonicalAsset.AssetClassCode | Functional location type |
| SERGE | EQUZ | CanonicalAsset.SerialNumber | Serial number from equipment linkage |
| INBDT | EQUI | CanonicalAsset.InstallDate | Start-up date |
| HERST | EQUI | CanonicalAsset.Manufacturer | Manufacturer name |
| TYPBZ | EQUI | CanonicalAsset.Model | Manufacturer model designation |
| ANSDT | ANLAV | CanonicalAsset.OriginalCost | Asset value (from FI Asset Accounting) |
| TPLNR | EQUI | CanonicalAsset.LocationCode | Functional location assigned |
| KOSTL | EQUI | CanonicalAsset.DepartmentCode | Cost center |
| IWERK | EQUI | CanonicalAsset.SiteCode | Maintenance plant |
| EQUST | EQUI | CanonicalAsset.Status | Equipment status (INST/ESTO/DACT) |
| AUFNR | AUFK | CanonicalWorkOrder.EamNativeId | Maintenance order number |
| KTEXT | AUFK | CanonicalWorkOrder.Description | Order short text |
| ERDAT | AUFK | CanonicalWorkOrder.ReportedAt | Order creation date |
| GSTRP | AFKO | CanonicalWorkOrder.ScheduledStartDate | Scheduled start date |
| GLTRP | AFKO | CanonicalWorkOrder.ScheduledEndDate | Scheduled finish date |
| ISTAT | JEST | CanonicalWorkOrder.Status | User status (CRTD/REL/PCNF/CNF/TECO/CLSD) |
| AUFNR (cost) | RPSCO | CanonicalWorkOrder.ActualCost | Actual costs from order settlement |

## Authentication

### OAuth 2.0 via SAP BTP IAS (S/4HANA)

SAP BTP Identity Authentication Service (IAS) issues OAuth 2.0 tokens for API access. Use client credentials flow for service-to-service integration.

```
POST https://{tenant}.accounts.ondemand.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&resource=https://{s4hana-host}:{port}
```

The resulting token is a JWT. Include it in API calls as `Authorization: Bearer {token}`. Tokens expire in 3600 seconds. Cache and refresh proactively.

### Basic Authentication with Service User (SAP ECC)

SAP ECC RFC connections require an SAP service user (type `Service` or `Communication Data`). The NCo connector authenticates with username and password.

```csharp
RfcConfigParameters config = new RfcConfigParameters();
config.Add(RfcConfigParameters.AppServerHost, "sap-ecc.agency.gov");
config.Add(RfcConfigParameters.SystemNumber, "00");
config.Add(RfcConfigParameters.SystemID, "PRD");
config.Add(RfcConfigParameters.User, "MAINTAIN_SVC");
config.Add(RfcConfigParameters.Password, password); // from Secrets Manager
config.Add(RfcConfigParameters.Client, "100");
config.Add(RfcConfigParameters.Language, "EN");
```

## SAP-Specific Challenges

### BAPI Synchronous Slowness

BAPIs are synchronous RFC calls. Calling `BAPI_EQUI_GETLIST` for 50,000 equipment records serially takes hours. Mitigations:
1. Use IDoc/ALE for initial load (bulk, asynchronous)
2. Limit BAPI calls to delta sync (small volumes)
3. Where available, use custom SAP reports (ABAP) that extract to file, and pull the file via SFTP

### Field-Level Authorization (SU24)

SAP's authorization concept (SU24) controls field-level read access. The service user must have `S_EQUI` (equipment) and `S_PM_ORDER` (maintenance order) authorization objects with appropriate values. If the service user lacks authorization for a specific field, that field returns blank rather than throwing an error. Always validate that the mapping returns expected values in the connectivity test.

Required authorization objects:
- `S_EQUI` with `ACTVT=03` (display) for all equipment
- `S_PM_ORDER` with `ACTVT=03` for all order types
- `S_IFLOT` with `ACTVT=03` for functional locations
- `S_QMEL` with `ACTVT=03` for notifications

### Time Zone Handling

SAP stores timestamps in the server time zone, not UTC. The SAP time zone is configured in transaction `STZAC`. Extract the time zone from the SAP system using function module `GET_SYSTEM_TIMEZONE` and convert all `ERDAT`/`AEDAT` fields to UTC before storing in Maintain.

```csharp
var sapTz = TimeZoneInfo.FindSystemTimeZoneById(sapTimeZoneId);
var utcDateTime = TimeZoneInfo.ConvertTimeToUtc(sapLocalDateTime, sapTz);
```

### Cost Center to Department Mapping

SAP cost centers (`KOSTL`) are SAP-specific and do not map directly to Aurigo department codes. The adapter configuration includes a `costCenterMapping` section that allows agencies to configure the translation.

```json
{
  "costCenterMapping": {
    "1000": "STREETS",
    "1100": "BRIDGES",
    "1200": "PARKS",
    "1300": "UTILITIES"
  }
}
```

If a cost center is not in the mapping, use the cost center code as the department code and log a warning for the onboarding team to resolve.

## SAP Basis Checklist for Service Account Setup

Work with the agency's SAP Basis team to complete the following:
- [ ] Create service user `MAINTAIN_SVC` (type: Service) in transaction SU01
- [ ] Assign role `Z_AURIGO_MAINTAIN_READ` (create this role with PM read authorizations)
- [ ] Role must include: S_EQUI, S_PM_ORDER, S_IFLOT, S_QMEL with ACTVT=03
- [ ] For OData (S/4HANA): register OAuth 2.0 client in SAP BTP IAS
- [ ] For RFC (ECC): create RFC destination in transaction SM59 pointing to target system
- [ ] Open firewall ports: 33{00-99} for RFC (based on system number), 443 for OData
- [ ] For IDoc setup: create RFC destination for inbound IDocs (Z_AURIGO_MAINTAIN_RFC)
- [ ] Confirm BASIS team schedules no system downtime during initial load window

## Connectivity Test Procedure

### S/4HANA OData Test

```bash
# Test OData connectivity
curl -u "MAINTAIN_SVC:password" \
  -H "Accept: application/json" \
  "https://s4h.agency.gov:443/sap/opu/odata/sap/API_EQUIPMENT_SRV/A_Equipment?\$top=1&\$select=Equipment,EquipmentName,InstallationDate" \
  | jq '.d.results[0]'

# Expected: first equipment record
# If 403: authorization issue — check SU24
# If 404: service not activated — run /n/IWFND/MAINT_SERVICE in SAP
```

### SAP ECC BAPI Test

```csharp
// Connectivity smoke test for ECC RFC
using (var destination = RfcDestinationManager.GetDestination("MAINTAIN_ECC"))
{
    var repo = destination.Repository;
    var func = repo.CreateFunction("BAPI_EQUI_GETLIST");
    func.SetValue("MAX_ROWS", 1);
    func.Invoke(destination);
    var result = func.GetTable("EQUIPLIST");
    Console.WriteLine($"Connectivity OK — first equipment: {result[0].GetString("EQUIPMENT")}");
}
```

## IDoc Configuration Guide

For ECC bulk sync, configure an outbound IDoc for equipment changes using `EQUI01` (equipment master) and `PORDER02` (maintenance order).

1. In transaction BD64, create a distribution model for the Maintain system
2. Add message type `EQUMASTER` → partner system `MAINTAIN`
3. In WE20, create a partner profile for `MAINTAIN` with outbound parameters for `EQUI01`
4. Configure the outbound IDoc port in WE21 (TCP/IP type, pointing to Maintain's IDoc receiver endpoint)
5. Test IDoc flow using WE19 (test tool) with a sample EQUI01 IDoc

The Maintain integration service exposes a POST endpoint `/internal/idoc/receive` that accepts raw IDoc XML and enqueues it for processing. This endpoint is internal-only and protected by VPC-level network controls, not public JWT.
