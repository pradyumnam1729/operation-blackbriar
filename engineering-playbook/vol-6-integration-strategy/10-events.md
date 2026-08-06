# 10 — Event-Based EAM Integration

## Near-Real-Time vs. Polling

Polling works. Every 15 minutes, the sync job asks the EAM for records changed since the last run. This is reliable, simple, and sufficient for capital planning use cases where data does not need to be real-time.

Event-based integration changes the latency model: instead of waiting up to 15 minutes to see a work order completion, the Maintain system receives notification within seconds. This matters for:
- Inspection completion triggering immediate risk score recalculation
- Work order completion updating asset condition for an upcoming board meeting
- Asset status changes (decommission, emergency replacement) propagating immediately

Event-based integration is recommended when it is available in the EAM system and the customer has real-time reporting requirements. It is optional, not required. Polling remains the fallback.

## EAM Systems That Publish Events

### IBM MAS — Kafka

IBM MAS 8.x (cloud deployment) publishes asset and work order changes to Kafka topics managed by IBM Event Streams (Kafka-as-a-service on IBM Cloud).

| Kafka Topic | Event | Payload |
|---|---|---|
| `maximo.asset.change` | Asset created or updated | Maximo ASSET record as JSON |
| `maximo.workorder.change` | Work order state change | WORKORDER record as JSON |
| `maximo.pm.change` | PM schedule modified | PM record as JSON |

To subscribe, configure the MAS Integration Framework to publish to the Kafka broker and configure the Maintain consumer with the broker connection details and consumer group ID.

```json
{
  "kafka": {
    "bootstrapServers": "es-prod.messaging.cloud.ibm.com:9093",
    "saslMechanism": "SCRAM-SHA-512",
    "credentialSecretArn": "arn:aws:secretsmanager:us-east-1:...",
    "groupId": "aurigo-maintain-maximo-consumer",
    "topics": ["maximo.asset.change", "maximo.workorder.change"]
  }
}
```

### SAP — IDoc/ALE

SAP ECC and S/4HANA publish change notifications via IDoc (Intermediate Documents) over ALE (Application Link Enabling). IDocs are XML documents transmitted over RFC. When configured, SAP sends `EQUI01` IDocs when equipment is created or changed and `PORDER02` IDocs when maintenance orders change.

The Maintain integration service exposes a POST endpoint `/internal/idoc/receive` that accepts incoming IDoc XML via the SAP RFC destination configured in transaction SM59. SAP pushes, Maintain receives.

Event delivery is synchronous from SAP's perspective — SAP waits for the Maintain endpoint to return HTTP 200 before confirming the IDoc was delivered. The endpoint must respond quickly (under 5 seconds) and queue the IDoc for asynchronous processing.

```csharp
[HttpPost("/internal/idoc/receive")]
[RequireInternalNetwork]  // VPC-only endpoint
public async Task<IResult> ReceiveIdoc([FromBody] string idocXml)
{
    var idocId = ExtractIdocNumber(idocXml);
    await _queue.EnqueueAsync(new InboundIdocMessage(idocId, idocXml));
    return Results.Ok(new { status = "queued", idocNumber = idocId });
}
```

### Oracle — Business Events and Advanced Queuing

Oracle EBS raises Business Events via the Business Events System (WF_EVENT). Events are published to Oracle Advanced Queuing (AQ) queues. External systems consume from AQ via JMS (Java Message Service) or via a polling REST API.

For Maintain, subscribe to:
- `oracle.apps.eam.workorder.create` — new work order
- `oracle.apps.eam.workorder.complete` — work order completed
- `oracle.apps.eam.asset.update` — asset record modified

Oracle Fusion Cloud uses a similar concept but via Oracle Integration Cloud (OIC) event subscriptions.

### Infor — ION Message Queue

Infor ION uses AMQP-compatible messaging. As described in `05-infor-eam.md`, Maintain subscribes to BOD types via an ION Data Flow. When a new BOD is published by Infor EAM (triggered by an asset or work order change), ION delivers it to the Maintain endpoint within seconds.

## Event Subscription Setup Per EAM

### Setting Up Kafka Subscription (IBM MAS)

1. In IBM Event Streams (Kafka), create a service credential with `Manager` role
2. Download the credentials file (contains bootstrap servers, API key, certificates)
3. Store credentials in AWS Secrets Manager
4. In the Maintain integration service, register the `KafkaMasConsumer` background service with the tenant configuration
5. Test: produce a test message to the topic manually and verify it appears in the Maintain sync log

### Setting Up SAP IDoc Delivery

1. In SAP SM59, create an RFC destination of type `HTTP connection to external server`
2. Target host: Maintain integration service hostname, path `/internal/idoc/receive`
3. Logon tab: Basic Auth with a Maintain-issued service token
4. In BD64, add the distribution model for `EQUMASTER` and `PORDER02` to the MAINTAIN partner
5. In WE20, create outbound partner profiles for the MAINTAIN partner
6. Activate the change pointers via BD61

### Setting Up Oracle Business Events Subscription

1. In Oracle EBS, navigate to Workflow → Business Events → Subscriptions
2. Create a subscription to `oracle.apps.eam.workorder.create` and `.complete`
3. Set subscription type to `External` with the Maintain HTTPS endpoint
4. Configure authentication (Basic Auth with Maintain integration service credentials)
5. Test using Oracle's Business Event test tool

## Event Payload Normalization

Every event, regardless of EAM source, is normalized to a canonical `EamChangeEvent` before being processed by the sync engine.

```csharp
public record EamChangeEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public string TenantId { get; init; } = default!;
    public string AdapterName { get; init; } = default!;
    public string RecordType { get; init; } = default!;   // "asset", "workorder"
    public EamChangeType ChangeType { get; init; }        // Created, Updated, Deleted
    public string EamNativeId { get; init; } = default!;
    public DateTimeOffset OccurredAt { get; init; }
    public string RawPayload { get; init; } = default!;   // Original JSON/XML for debugging
    public CanonicalBase? CanonicalRecord { get; set; }   // Populated after mapping
}
```

Each event consumer (Kafka consumer, IDoc receiver, Oracle subscription handler) produces an `EamChangeEvent` and enqueues it. The sync engine dequeues, maps the raw payload to the canonical type, and upserts to the database.

## Exactly-Once Processing

EAM events may be delivered more than once (network retry, at-least-once delivery guarantee). The Maintain sync engine must be idempotent.

**Idempotency key:** `tenantId:adapterName:eamNativeId:changeTimestamp`

```csharp
public async Task ProcessEventAsync(EamChangeEvent ev)
{
    var idempotencyKey = $"{ev.TenantId}:{ev.AdapterName}:{ev.EamNativeId}:{ev.OccurredAt:O}";
    
    // Check if already processed (Redis cache, TTL 24 hours)
    if (await _idempotencyCache.ExistsAsync(idempotencyKey))
    {
        _logger.LogDebug("Duplicate event skipped: {Key}", idempotencyKey);
        return;
    }
    
    await _idempotencyCache.SetAsync(idempotencyKey, "1", TimeSpan.FromHours(24));
    
    // Process event
    var canonical = _mapper.Map(ev);
    await _repository.UpsertAsync(canonical);
}
```

The idempotency check uses Redis with a 24-hour TTL. This covers retry storms and duplicate deliveries. After 24 hours, a duplicate event will be re-processed — but EAM systems rarely produce duplicate events more than 24 hours apart.

## Dead Letter Queue Handling

Failed events (mapping errors, database errors) are routed to a DLQ in AWS SQS.

```
Failed event → DLQ (SQS) → CloudWatch alarm → On-call alert → Admin review queue (Maintain UI)
```

The Admin review queue in the Maintain admin panel shows:
- Raw event payload
- Error message and stack trace
- Options: Retry, Discard, Flag for Engineering

DLQ messages are retained for 14 days. The on-call engineer has 14 days to review and resolve before the event is permanently lost.

## Event Ordering

For most Maintain use cases, event ordering is not critical. Condition scores and RUL projections are recalculated on every update — receiving events out of order produces the same final state.

One case where ordering matters: **work order lifecycle.** A work order completion event must not be processed before the work order creation event (otherwise the "completed" work order would be created with status Completed without a prior Active state, which triggers validation errors).

Handling: use the EAM native ID as a partition key in the Kafka consumer. Events for the same work order are always processed in order within a partition.

## Comparison: Polling vs. Event-Driven

| Dimension | Polling (15 min) | Event-Driven |
|---|---|---|
| Latency | Up to 15 minutes | Seconds to 1 minute |
| Implementation complexity | Low | Medium-High |
| Reliability | High (simple) | Requires DLQ, idempotency, ordering |
| EAM load | Regular queries | EAM push (lower query load) |
| Setup effort | 1 day | 1-3 days (EAM config, broker setup) |
| EAM support required | Minimal | Moderate (IDoc config, Kafka setup) |
| Recommended when | Default for all | Customer needs near-real-time; MAS or Infor ION available |
| Fallback if event system fails | Auto-fallback to polling | Auto-fallback to polling |

The integration engine runs polling as the baseline for all tenants. Event-driven sync is additive — when enabled, it reduces latency without removing the reliability of the polling baseline. If the event system goes down, polling ensures no data is missed.
