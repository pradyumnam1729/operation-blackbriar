# 06 — MaintainX Integration

## Overview

MaintainX is a mobile-first CMMS (Computerized Maintenance Management System) that has grown rapidly in the manufacturing, facilities management, and light industrial markets. Founded in 2018, it competes with Hippo CMMS and UpKeep (see `07-upkeep.md`). Its primary differentiators are an exceptional mobile experience, fast onboarding (hours, not weeks), and a clean REST API.

MaintainX appears in the Aurigo Primus product line. Primus targets private-sector infrastructure operators: commercial real estate portfolios, logistics facilities, private utilities, and industrial plants. These customers often chose MaintainX because it was fast to deploy and easy for field technicians to use. They lack capital planning capability — they have no structured way to assess asset condition across a portfolio, project remaining useful life, or build a multi-year capital investment plan. Aurigo Primus Maintain provides exactly that.

**The core value proposition:** MaintainX tells you what maintenance happened. Aurigo Primus Maintain tells you what maintenance you should be planning to fund over the next 10 years.

## MaintainX Overview

| Object | Description |
|---|---|
| Asset | Equipment or infrastructure item |
| Work Order | Corrective or PM work task |
| Procedure | Reusable checklist/inspection template |
| Request | Work request submitted by any user |
| Part | Spare part or material |
| Location | Physical location hierarchy |
| User | Technician or manager |

MaintainX REST API is well-documented at `https://developer.maintainx.com/docs`. API version 1 is stable. Authentication is OAuth 2.0.

## Authentication

MaintainX uses OAuth 2.0 with client credentials flow for server-to-server integration.

```
POST https://api.maintainx.com/v1/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "{CLIENT_ID}",
  "client_secret": "{CLIENT_SECRET}"
}
```

Response:
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Tokens expire in 3600 seconds. Use the standard token refresh strategy: cache the token in memory, track `issuedAt + expiresIn - 60s`, refresh proactively.

## Data Mapping

### Asset Mapping

| MaintainX Field | Canonical Field | Notes |
|---|---|---|
| `id` | CanonicalAsset.EamNativeId | UUID |
| `name` | CanonicalAsset.Name | |
| `description` | CanonicalAsset.Description | |
| `serialNumber` | CanonicalAsset.SerialNumber | |
| `manufacturer` | CanonicalAsset.Manufacturer | |
| `model` | CanonicalAsset.Model | |
| `category` | CanonicalAsset.AssetTypeCode | Customer-configured |
| `location.id` | CanonicalAsset.LocationCode | |
| `location.name` | CanonicalAsset.LocationName | |
| `purchaseDate` | CanonicalAsset.InstallDate | |
| `purchaseCost` | CanonicalAsset.OriginalCost | |
| `status` (active/archived) | CanonicalAsset.Status | |
| `customFields[*]` | CanonicalAsset.CustomFields | All custom fields preserved |

### Work Order Mapping

| MaintainX Field | Canonical Field | Notes |
|---|---|---|
| `id` | CanonicalWorkOrder.EamNativeId | UUID |
| `title` | CanonicalWorkOrder.Description | |
| `description` | CanonicalWorkOrder.Notes | |
| `status` | CanonicalWorkOrder.Status | open/in_progress/on_hold/done/cancelled |
| `priority` | CanonicalWorkOrder.Priority | low/medium/high/critical |
| `dueDate` | CanonicalWorkOrder.ScheduledEndDate | |
| `completedAt` | CanonicalWorkOrder.CompletedAt | |
| `asset.id` | CanonicalWorkOrder.AssetEamId | |
| `totalCost` | CanonicalWorkOrder.ActualCost | |
| `createdAt` | CanonicalWorkOrder.ReportedAt | |

## Integrated Mode Configuration

In Integrated Mode, Maintain reads from MaintainX and enriches the data:

1. **Asset sync:** Pull all assets from MaintainX every 15 minutes. Map to canonical assets. Calculate condition scores using available maintenance history.
2. **Work order sync:** Pull completed work orders for maintenance history analysis. Work orders contribute to asset condition degradation modeling.
3. **Inspection gap analysis:** Identify assets with no recent work order history (likely under-maintained) and flag them in the Maintain condition dashboard.

The Maintain user sees assets and work orders from MaintainX in the Maintain UI, enriched with RUL, ARV, and risk scores. MaintainX users continue working in MaintainX with no change to their workflow.

## Hybrid Mode: Inspections to Work Orders

In Hybrid Mode, when a Maintain inspection identifies a defect requiring corrective maintenance, the capital planning workflow generates a work order recommendation. That recommendation can be pushed back to MaintainX as a new work order.

```csharp
// Hybrid Mode write-back
public class MaintainXWorkOrderWriter : IEamWorkOrderWriter
{
    public async Task<CreateResult> CreateWorkOrderAsync(CanonicalWorkOrder wo)
    {
        var mx = new MaintainXCreateWorkOrderRequest
        {
            Title = wo.Description,
            AssetId = wo.AssetEamId,
            Priority = MapPriority(wo.Priority),
            Description = $"[Aurigo Maintain] {wo.Notes}\nCapital Need: {wo.CapitalNeedId}",
            DueDate = wo.ScheduledEndDate
        };
        
        var response = await _client.PostAsync("/v1/work-orders", mx);
        return new CreateResult(response.Id, response.CreatedAt);
    }
}
```

The work order created in MaintainX includes a reference to the Maintain capital need ID in the description. This allows bidirectional traceability — the MaintainX technician can see where the work order came from, and Maintain can track the work order to completion.

## Webhook Support

MaintainX supports outbound webhooks. Subscribe to work order completion events so Maintain can update asset condition without waiting for the next polling cycle.

### Setting Up MaintainX Webhooks

In MaintainX Admin Settings → Integrations → Webhooks:
1. Add webhook URL: `https://integration.maintain.aurigo.net/maintainx/webhook`
2. Select events: `work_order.completed`, `work_order.updated`, `asset.updated`
3. Copy the generated webhook secret

Store the webhook secret in AWS Secrets Manager. The Maintain webhook receiver validates the `x-maintainx-signature` header (HMAC-SHA256 of the request body using the webhook secret).

### Processing Work Order Completion Webhooks

```csharp
[HttpPost("/maintainx/webhook")]
public async Task<IResult> ReceiveWebhook(
    HttpRequest request,
    [FromBody] MaintainXWebhookPayload payload,
    IWebhookSignatureValidator validator)
{
    var secret = await _secretsManager.GetSecretAsync("maintainx-webhook-secret");
    if (!validator.Validate(request, secret)) return Results.Unauthorized();
    
    if (payload.Event == "work_order.completed")
    {
        var wo = payload.Data as MaintainXWorkOrder;
        await _conditionEngine.RecordMaintenanceCompletionAsync(
            tenantId: payload.TenantId,
            assetEamId: wo.AssetId,
            completedAt: wo.CompletedAt,
            actualCost: wo.TotalCost);
    }
    
    return Results.Ok();
}
```

## Primus-Specific Configuration

For Primus customers, the MaintainX integration configuration includes asset category mapping for the customer's specific MaintainX category structure:

```json
{
  "adapterName": "maintainx",
  "assetCategoryMapping": {
    "HVAC": "HVAC_UNIT",
    "Electrical": "ELECTRICAL_PANEL",
    "Plumbing": "PLUMBING_FIXTURE",
    "Roofing": "ROOF_MEMBRANE",
    "Parking": "PARKING_STRUCTURE",
    "Elevator": "ELEVATOR_UNIT"
  },
  "webhookEnabled": true,
  "writeback": {
    "enabled": true,
    "workOrderCreation": true
  }
}
```

## Rate Limits

MaintainX API imposes rate limits:
- 1,000 requests per minute per API key
- 10 concurrent requests per API key

The adapter uses bulkhead isolation (10 concurrent) and backs off on HTTP 429. For initial load of large asset portfolios (> 10,000 assets), spread the load across multiple sync windows or contact MaintainX for rate limit increase.
