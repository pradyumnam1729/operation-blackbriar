# 11 — Outbound Webhooks

## Overview

Aurigo Maintain publishes webhooks so that external systems can react to events in Maintain without polling the API. This is the inverse of the EAM event subscription described in `10-events.md`. Where that document covers events flowing into Maintain from EAM systems, this document covers events flowing out of Maintain to external systems.

External systems that benefit from Maintain webhooks:
- **EAM systems (Hybrid Mode):** receive work order recommendations as soon as they are approved in Maintain
- **Financial systems:** receive capital need approvals so budget reservations can be made immediately
- **Cityworks:** receive inspection completion events to update asset condition records
- **Customer dashboards and BI tools:** receive condition change events to refresh reports
- **Notification services:** receive high-risk alerts to send SMS or email to asset managers

## Events Published

Maintain publishes the following domain events as webhooks. Events follow the pattern `resource.action`:

| Event | Trigger | Payload Key Fields |
|---|---|---|
| `asset.condition.changed` | Condition score changes by > 5 points | assetId, previousScore, newScore, inspectionId |
| `asset.decommissioned` | Asset status set to Decommissioned | assetId, assetName, decommissionedAt, replacementCapitalNeedId |
| `asset.created` | New asset added to Maintain registry | assetId, assetName, assetClass, siteCode |
| `inspection.completed` | Inspection workflow marked complete | inspectionId, assetId, conditionScore, defectCount, completedBy |
| `inspection.defect.critical` | Inspection records a critical defect | defectId, assetId, defectDescription, severity |
| `capital-need.created` | Capital need identified for an asset | capitalNeedId, assetId, estimatedCost, suggestedYear, priority |
| `capital-need.approved` | Capital need approved for CIP funding | capitalNeedId, assetId, approvedAmount, approvedYear |
| `work-order.requested` | Maintain requests work order creation in EAM | workOrderId, assetId, description, priority, requestedBy |
| `work-order.completed` | EAM confirms work order completion | workOrderId, assetId, actualCost, completedAt |
| `risk.score.changed` | Risk score changes category (e.g., Medium → High) | assetId, previousCategory, newCategory, riskScore |

## Webhook Payload Schema

All webhook payloads follow a standard envelope schema. The `data` field contains the event-specific payload.

```json
{
  "id": "evt_01J5K8ZWX4YABCDEF12345",
  "type": "inspection.completed",
  "version": "1",
  "tenantId": "city-of-boston",
  "occurredAt": "2026-07-18T14:32:11.442Z",
  "signature": "sha256=3c4e7a9b1d0f5e8c2a6b4d8e0f3a7c9b1e5d8a2f4c6e0b3d7a9f1c5e8b2d4f",
  "data": {
    "inspectionId": "insp_ABC123",
    "assetId": "ast_XYZ456",
    "assetName": "Main St Bridge Deck",
    "conditionScore": 62,
    "previousConditionScore": 74,
    "defectCount": 3,
    "criticalDefectCount": 1,
    "completedBy": "john.doe@boston.gov",
    "completedAt": "2026-07-18T14:32:11.442Z"
  }
}
```

The `id` field is a globally unique event ID using ULID format (sortable, URL-safe). The `signature` is used to verify the payload integrity (see Security section below).

## HMAC-SHA256 Signature

Every webhook payload is signed using HMAC-SHA256. The signature is computed over the raw request body using the webhook endpoint's secret key. Recipients must verify the signature before processing the payload.

### Computing the Signature (Maintain side)

```csharp
public string ComputeSignature(string payload, string secret)
{
    var keyBytes = Encoding.UTF8.GetBytes(secret);
    var payloadBytes = Encoding.UTF8.GetBytes(payload);
    
    using var hmac = new HMACSHA256(keyBytes);
    var hash = hmac.ComputeHash(payloadBytes);
    return "sha256=" + Convert.ToHexString(hash).ToLowerInvariant();
}
```

### Verifying the Signature (Consumer side — C# example)

```csharp
public bool VerifySignature(HttpRequest request, string webhookSecret)
{
    if (!request.Headers.TryGetValue("X-Maintain-Signature", out var signature))
        return false;
    
    // Read raw body — must be done before model binding
    request.Body.Seek(0, SeekOrigin.Begin);
    using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
    var payload = reader.ReadToEnd();
    
    var expected = ComputeSignature(payload, webhookSecret);
    
    // Constant-time comparison to prevent timing attacks
    return CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(expected),
        Encoding.UTF8.GetBytes(signature.ToString()));
}
```

**Important:** Never use string equality (`==`) for signature comparison. Use `CryptographicOperations.FixedTimeEquals` to prevent timing-based attacks.

## Retry Policy

Maintain uses an at-least-once delivery guarantee. If the recipient endpoint returns a non-2xx response (or times out), Maintain retries with exponential backoff.

| Attempt | Delay | Total elapsed |
|---|---|---|
| 1 (initial) | Immediate | 0s |
| 2 | 30 seconds | 30s |
| 3 | 5 minutes | 5m 30s |
| 4 (final) | 30 minutes | 35m 30s |

After 4 attempts, the event is moved to the dead letter queue and a `webhook.delivery.failed` notification is sent to the endpoint owner (if a notification email is configured for the webhook registration).

The retry state is stored in the `WebhookDeliveryAttempt` table:
```
WebhookDeliveryAttempt(webhookId, eventId, attemptNumber, attemptedAt, statusCode, responseBody, nextAttemptAt)
```

## Dead Letter Endpoint

Failed deliveries after all retries are stored in the `WebhookDeadLetterQueue` table and visible in the Maintain admin panel under Settings → Integrations → Webhook Delivery Failures. Admins can:
- Review the failed payload and error
- Re-queue for redelivery (after the recipient system is back online)
- Permanently discard the event

## Webhook Registration via API

External systems register their webhook endpoints using the Maintain REST API.

```
POST /api/v1/webhooks
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "url": "https://cityworks.boston.gov/maintain/webhook",
  "events": ["inspection.completed", "asset.condition.changed"],
  "secret": "my-secret-key-32-chars-minimum",
  "description": "Cityworks condition update receiver"
}
```

Response:
```json
{
  "id": "wh_01J5K8ZWX4Y",
  "url": "https://cityworks.boston.gov/maintain/webhook",
  "events": ["inspection.completed", "asset.condition.changed"],
  "status": "active",
  "createdAt": "2026-07-18T10:00:00Z"
}
```

**Security requirements for webhook URLs:**
- HTTPS only — HTTP webhook URLs are rejected
- Must respond to a `POST` request within 10 seconds
- Must return 2xx for successful receipt

A test delivery can be triggered via `POST /api/v1/webhooks/{id}/test` which sends a `webhook.test` event to the endpoint.

## Delivery Guarantee: At-Least-Once

Maintain guarantees at-least-once delivery. This means a webhook may be delivered more than once if:
- The recipient endpoint returned 2xx but Maintain did not receive the response (network timeout)
- A retry was triggered before the previous attempt's response arrived

**Consumers must be idempotent.** Use the `id` field (ULID) in the webhook payload as the idempotency key. If you receive the same event ID twice, process only the first occurrence.

```csharp
// Consumer example: idempotent webhook receiver
[HttpPost("/maintain/webhook")]
public async Task<IResult> ReceiveMaintainWebhook(
    HttpRequest request,
    [FromBody] MaintainWebhookPayload payload)
{
    if (!VerifySignature(request, _config.MaintainWebhookSecret))
        return Results.Unauthorized();
    
    // Idempotency: skip if already processed
    if (await _idempotencyStore.HasProcessedAsync(payload.Id))
        return Results.Ok(); // Return 200 to prevent retry
    
    await ProcessAsync(payload);
    await _idempotencyStore.MarkProcessedAsync(payload.Id, TimeSpan.FromDays(7));
    return Results.Ok();
}
```

## Security: HTTPS and Signature Verification

Two security controls are mandatory for webhook consumers:

1. **HTTPS only:** All webhook endpoints must be HTTPS. Maintain will not deliver to HTTP endpoints. This ensures the payload is encrypted in transit and the endpoint owner controls the certificate.

2. **Signature verification:** Consumers must verify the `X-Maintain-Signature` header before processing. This ensures the payload was sent by Maintain (not a third party spoofing the endpoint) and was not tampered with in transit.

Optionally, consumers can whitelist the Maintain webhook delivery IP range. The outbound IP ranges for the Maintain webhook delivery service are published at `/api/v1/webhooks/ip-ranges`.

## Example: Cityworks Receiving inspection.completed

When an inspection is completed in Maintain, Cityworks receives the event and updates the asset condition record.

**Cityworks webhook receiver (pseudocode):**
1. Receive POST from Maintain with `type: "inspection.completed"`
2. Verify HMAC signature
3. Look up Cityworks entity by the `assetId` from Maintain (using the stored EamNativeId mapping)
4. In Cityworks AMS, update the entity's condition rating field to match `data.conditionScore`
5. Create a Cityworks inspection record (if Cityworks tracks inspection history) with the completion timestamp
6. Return HTTP 200

This integration keeps Cityworks condition records synchronized with Maintain's condition assessment results, without requiring double data entry by field inspectors.
