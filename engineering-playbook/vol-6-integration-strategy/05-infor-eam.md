# 05 — Infor EAM Integration

## Overview

Infor EAM (Enterprise Asset Management) is a cloud-based EAM platform with strong penetration in manufacturing, utilities, and healthcare. In the public sector, it appears in transit agencies, airports, and water utilities that have chosen Infor CloudSuite Public Sector or Infor CloudSuite Industrial. Its cloud-native architecture and multi-site/multi-organization support make it well-suited for agencies with complex organizational structures.

Infor EAM uses a standardized integration architecture built on **Infor ION** (Infor Operating Network) — a lightweight integration platform that connects Infor applications using XML-based messages called **BODs** (Business Object Documents). BODs are the lingua franca of the Infor ecosystem. Every Infor application publishes and consumes BODs.

For Maintain, the primary integration path is via Infor ION: subscribe to the ION message queue for BODs published by Infor EAM, process them, and map to canonical Maintain types. A secondary path is the Infor EAM REST API for initial load and on-demand queries.

## Infor ION Architecture

Infor ION is a publish-subscribe messaging backbone. When an asset or work order is created or updated in Infor EAM, ION publishes a BOD to all subscribers. The Maintain integration service subscribes to the relevant BOD types.

```
Infor EAM → Infor ION (publish) → ION Message Queue → Maintain Integration Service → EAM Sync Engine
```

ION uses AMQP-compatible messaging under the covers. The Maintain adapter connects to ION via the Infor ION API (REST-based), which provides a message queue interface without requiring direct AMQP access.

## BOD Types Used

BODs follow the Infor Open Architecture (IOA) standard. The naming convention is `{Verb}{Noun}` — for example, `SyncAsset` is the "Sync" verb applied to the "Asset" noun, meaning a full state synchronization message.

| BOD Type | Trigger | Description |
|---|---|---|
| `SyncAsset` | Asset create/update | Full asset record including attributes and hierarchy |
| `SyncWorkOrder` | Work order create/update | Maintenance order with operations and costs |
| `SyncMaintenancePlan` | PM schedule create/update | Preventive maintenance plan with frequency |
| `SyncEquipmentPart` | Part consumption on WO | Materials used on a work order |
| `AcknowledgeAsset` | Asset status change | Lightweight status update (active/inactive/retired) |
| `ConfirmMaintenanceOrder` | Work order completion | Confirmation of completed work with actual values |

For initial load, use the `SyncAsset` and `SyncWorkOrder` BOD types via the ION `/request` endpoint to trigger bulk export of all records.

## Data Mapping Table

| Infor EAM / BOD Field | Canonical Field | Notes |
|---|---|---|
| `Asset/AssetId/Id` | CanonicalAsset.EamNativeId | |
| `Asset/Description/Description` | CanonicalAsset.Name | |
| `Asset/SerialId` | CanonicalAsset.SerialNumber | |
| `Asset/AssetClassification/Code` | CanonicalAsset.AssetClassCode | |
| `Asset/Status/Code` | CanonicalAsset.Status | Active/Inactive/Scrapped |
| `Asset/Manufacturer/Name` | CanonicalAsset.Manufacturer | |
| `Asset/Model/Code` | CanonicalAsset.Model | |
| `Asset/DateCreated` | CanonicalAsset.InstallDate | |
| `Asset/Owner/OrganizationID` | CanonicalAsset.SiteCode | Multi-site organization |
| `Asset/Department/Code` | CanonicalAsset.DepartmentCode | |
| `Asset/Party[PartyType=Responsible]/ID` | CanonicalAsset.AssignedTo | Responsible party |
| `Asset/UserArea/Property[Name=REPLACEMENTCOST]` | CanonicalAsset.ReplacementCostEam | Custom property in UserArea |
| `WorkOrder/WorkOrderId/Id` | CanonicalWorkOrder.EamNativeId | |
| `WorkOrder/Description` | CanonicalWorkOrder.Description | |
| `WorkOrder/CreationDateTime` | CanonicalWorkOrder.ReportedAt | |
| `WorkOrder/PlannedStartDateTime` | CanonicalWorkOrder.ScheduledStartDate | |
| `WorkOrder/ActualEndDateTime` | CanonicalWorkOrder.CompletedAt | |
| `WorkOrder/Status/Code` | CanonicalWorkOrder.Status | R=Released, C=Completed |
| `WorkOrder/ActualCost/Amount` | CanonicalWorkOrder.ActualCost | |
| `WorkOrder/AssetReference/Id` | CanonicalWorkOrder.AssetEamId | |

## Authentication

### Infor ION API Credentials

Infor ION uses OAuth 2.0 with a service account created in the Infor OS (Operating Service). The credentials are an ION API file downloaded from Infor OS Console.

The ION API file contains:
```json
{
  "ti": "{tenant_id}",
  "ci": "{client_id}",
  "cs": "{client_secret}",
  "pu": "https://{tenant}.mingle.infor.com",
  "oa": "https://{tenant}.mingle.infor.com/as/authorization.oauth2",
  "ot": "https://{tenant}.mingle.infor.com/as/token.oauth2",
  "or": "https://{tenant}.mingle.infor.com/as/revoke_token.oauth2"
}
```

Store the entire ION API file content in AWS Secrets Manager. Parse it at runtime to extract the token URL and credentials.

```csharp
var ionCredentials = JsonSerializer.Deserialize<InforIonCredentials>(secretValue);
var tokenResponse = await httpClient.PostAsync(
    ionCredentials.TokenUrl,
    new FormUrlEncodedContent(new[] {
        ("grant_type", "client_credentials"),
        ("client_id", ionCredentials.ClientId),
        ("client_secret", ionCredentials.ClientSecret)
    }));
```

### Infor EAM REST API (Direct)

For direct REST API access (bypassing ION), Infor EAM Cloud uses the same OAuth 2.0 token obtained from ION credentials. The API base URL is `https://{tenant}.cloudsuite.infor.com/INEAM/rest/`.

## BOD Processing

### Subscribing to BOD Types

In Infor ION, create a Data Flow that routes the target BOD types to the Maintain integration endpoint.

1. In Infor ION Console, go to Connect → Data Flow
2. Create a new outbound connection point for "Aurigo Maintain" with type "API (REST)"
3. Set the endpoint URL to the Maintain integration receiver: `https://integration.maintain.aurigo.net/infor/bod/receive`
4. Select BOD types: `SyncAsset`, `SyncWorkOrder`, `SyncMaintenancePlan`, `ConfirmMaintenanceOrder`
5. Configure authentication: ION will call the Maintain endpoint with an HMAC signature header

### Processing Incoming BODs

The Maintain BOD receiver endpoint:
1. Validates the ION HMAC signature
2. Parses the BOD XML into a typed C# object using the generated BOD schema (XSD → C# via `xsd.exe`)
3. Maps the BOD to the canonical type using the BOD-specific mapper
4. Publishes the canonical event to the internal sync queue for upsert processing

```csharp
public class InforBodReceiver
{
    public async Task<IResult> ReceiveBod(
        HttpRequest request,
        [FromBody] string bodXml,
        IHmacValidator hmacValidator,
        IBodMapper mapper,
        IAssetSyncQueue queue)
    {
        if (!hmacValidator.Validate(request)) return Results.Unauthorized();
        
        var bod = BodParser.Parse(bodXml);
        switch (bod.Noun)
        {
            case "Asset":
                var asset = mapper.MapSyncAsset(bod);
                await queue.EnqueueAsync(asset);
                break;
            case "WorkOrder":
                var wo = mapper.MapSyncWorkOrder(bod);
                await queue.EnqueueAsync(wo);
                break;
        }
        return Results.Accepted();
    }
}
```

### Initial Load via ION Request

To trigger a full export of all assets at onboarding, send a `RequestAsset` BOD to ION:

```xml
<RequestAsset xmlns="http://schema.infor.com/InforOAGIS/2">
  <ApplicationArea>
    <Sender><LogicalID>lid://aurigo.maintain</LogicalID></Sender>
    <CreationDateTime>2026-07-18T00:00:00</CreationDateTime>
    <BODID>urn:uuid:{guid}</BODID>
  </ApplicationArea>
  <DataArea>
    <Request><ActionCriteria><ActionExpression actionCode="Get">GetAll</ActionExpression></ActionCriteria></Request>
    <Asset><AssetHeader><Status><Code>Active</Code></Status></AssetHeader></Asset>
  </DataArea>
</RequestAsset>
```

ION responds by publishing a stream of `SyncAsset` BODs back to the Maintain Data Flow endpoint.

## Organization Unit Mapping

Infor EAM's multi-site architecture uses `OrganizationID` to partition data. For an agency with multiple facilities or departments, each `OrganizationID` corresponds to a Maintain `SiteCode`.

```json
{
  "organizationMapping": {
    "DIST1": "DISTRICT_1",
    "DIST2": "DISTRICT_2",
    "HQ": "HEADQUARTERS",
    "MAINT": "MAINTENANCE_YARD"
  }
}
```

## Common Issues

**BOD schema differences between versions:** Infor EAM 11.x and 12.x have slightly different BOD schemas. The `UserArea` extension fields in particular vary. The adapter uses a loose-parsing strategy for `UserArea` — enumerate all `Property` elements and populate `CustomFields` — to be robust across versions.

**ION Data Flow not triggering:** After configuring the Data Flow in ION Console, a test BOD must be sent to confirm the endpoint is reachable. Use the ION Console test tool to send a sample `SyncAsset` BOD and verify the Maintain receiver returns HTTP 202.

**Infor EAM multi-tenant vs. single-tenant:** Cloud deployments are multi-tenant at the Infor infrastructure level but single-tenant from the customer perspective (each customer has their own Infor tenant ID). Do not confuse the Infor tenant ID with the Maintain tenant ID — they are different identifiers.
