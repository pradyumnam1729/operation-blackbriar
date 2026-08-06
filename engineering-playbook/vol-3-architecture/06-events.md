# Event-Driven Architecture

> Volume 3 · Architecture · Document 06  
> Event schema, domain events, AWS EventBridge/SQS patterns, and key domain events

---

## When to Use Events vs. Direct Calls

The choice between synchronous REST calls and asynchronous events is not a matter of preference — it is determined by the requirements of the interaction.

**Use direct synchronous calls when:**
- The calling code needs the response to continue processing (e.g., the user is waiting for the result).
- The operation must be atomically visible to the caller (e.g., creating an asset and immediately showing it in a list).
- Consistency is required between the two operations (rolling back one means rolling back both).
- The latency of the callee is acceptable within the response SLA.

**Use asynchronous events when:**
- The sender does not need the result to continue its primary operation.
- Multiple, independent consumers may react to the same occurrence.
- Eventual consistency between domains is acceptable (the capital plan doesn't need to update within milliseconds of an inspection completing).
- The operation is a side effect rather than the primary outcome.
- Decoupling is more important than immediacy.

The most common error in distributed systems is using synchronous calls where events are appropriate, creating tight coupling between services and making cascade failures more likely.

---

## Event Schema Standard

All events published to EventBridge follow this schema. This is the canonical envelope — it applies whether the event originates from Maintain, from the Integration Gateway translating an EAM event, or from a future Aurigo service.

```json
{
  "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "inspection.completed",
  "version": "1.0",
  "tenantId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-07-15T14:35:22.347Z",
  "source": "inspection-service",
  "correlationId": "req-7a8b9c0d-e1f2-3456-789a-bcdef0123456",
  "causationId": "cmd-1234abcd-5678-efab-cdef-012345678901",
  "data": {
    "inspectionId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "assetId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "conditionIndex": 3.2,
    "inspectedAt": "2026-07-15T14:30:00Z",
    "inspector": "Jane Smith",
    "defectCount": 1
  }
}
```

### Envelope Fields

| Field | Type | Description |
|---|---|---|
| `eventId` | UUID | Unique identifier for this event instance. Used for idempotency by consumers. |
| `eventType` | string | The event name in `[domain].[entity].[action]` format (past tense). |
| `version` | string | Schema version of the `data` payload. Increment when the data shape changes in a breaking way. |
| `tenantId` | UUID | The tenant that owns this event. Consumers must enforce tenant isolation. |
| `timestamp` | ISO-8601 | UTC timestamp when the event occurred (not when it was published). |
| `source` | string | The service that published the event. |
| `correlationId` | UUID | Traces the original request across services. Propagated from the HTTP `X-Correlation-ID` header. |
| `causationId` | UUID | The ID of the command or event that caused this event to be raised. Enables event tracing. |
| `data` | object | Event-specific payload. Structure defined per event type and version. |

---

## Event Naming Convention

Events are named using the pattern: `[domain].[entity].[action]` in past tense (something that has already happened).

| Event | Meaning |
|---|---|
| `asset.registered` | A new asset has been added to the registry |
| `asset.condition.changed` | The asset's current condition index has changed |
| `asset.decommissioned` | An asset has been permanently removed from service |
| `asset.location.updated` | The GIS geometry of an asset has been updated |
| `inspection.created` | A new inspection record has been created (not yet complete) |
| `inspection.completed` | An inspection has been finalized and condition index assigned |
| `capital-need.identified` | The system has identified a capital replacement need for an asset |
| `capital-need.prioritized` | A capital need has been assigned a priority in the budget cycle |
| `capital-plan.approved` | A budget scenario has been approved |
| `work-order.created` | A work order has been created |
| `work-order.completed` | A work order has been completed in the field |
| `work-order.cancelled` | A work order has been cancelled |
| `asset.sync.received` | The Integration Gateway has received asset data from an EAM system |
| `inspection.sync.received` | The Integration Gateway has received inspection data from an EAM system |

---

## Key Domain Event Flows

### Flow 1: Inspection Completed → RUL Recalculation

```
Inspector submits inspection via mobile app
  → POST /api/v1/assets/{id}/inspections
  → RecordInspectionCommandHandler runs
  → Inspection record created in database
  → Asset.condition.index updated
  → SaveChanges() called
  → DomainEventDispatchInterceptor fires
    → Publishes InspectionCompletedEvent to EventBridge
  → Response returned to inspector (201 Created)

EventBridge routes inspection.completed to SQS queue
  → Capital Planning Service consumer processes queue message
  → RUL recalculated for the asset using updated condition index
  → Capital need identified or updated if replacement year changed
  → capital-need.identified event published if new capital need
```

The key insight: the inspector's POST completes before the RUL recalculation. The inspector is not waiting for capital planning math. If the RUL recalculation fails, the inspection record is still committed (it is the source of truth). The RUL can be recalculated again — the calculation is idempotent.

### Flow 2: Work Order Completed → Asset Condition Update

```
Field technician completes work order
  → PATCH /api/v1/work-orders/{id}/complete
  → CompleteWorkOrderCommandHandler runs
  → Work order status updated, completion data recorded
  → WorkOrderCompletedEvent published
  → Response returned to technician (204 No Content)

EventBridge routes work-order.completed to SQS queue
  → Asset Registry consumer receives the event
  → Asset condition updated based on work performed
  → asset.condition.changed event published
  
EventBridge routes asset.condition.changed
  → Capital Planning recalculates RUL with new condition
  → Reporting service updates materialized views
```

### Flow 3: Capital Plan Approved → Work Orders Created

```
Asset Manager approves capital plan budget scenario
  → POST /api/v1/capital-needs/{id}/approve
  → ApproveBudgetScenarioCommandHandler runs
  → Budget scenario status updated to Approved
  → CapitalPlanApprovedEvent published

EventBridge routes capital-plan.approved
  → Work Order Service creates work orders for each approved capital need
  → Project pipeline updated in the Aurigo Plan integration (if connected)
```

---

## Event Versioning

When the `data` payload of an event changes in a breaking way (removing a field, changing a field's type), increment the `version` field and publish the new schema. Keep the old version active for the deprecation window (minimum 6 months after notifying consuming services).

Consumers should be tolerant readers: ignore fields they don't recognize (forward compatibility) and handle missing optional fields gracefully (backward compatibility).

Non-breaking changes (adding new optional fields) do not require a version increment.

---

## AWS Implementation

### EventBridge

EventBridge is the routing layer. Events are published to an EventBridge custom event bus named `aurigo-maintain-{environment}` (e.g., `aurigo-maintain-production`).

Rules on EventBridge route events to SQS queues based on `eventType`:

```json
{
  "source": ["inspection-service"],
  "detail-type": ["inspection.completed"]
}
```

This rule routes to the Capital Planning SQS queue and the Reporting SQS queue, enabling fan-out to multiple consumers.

### SQS Queues

Each consumer service has its own SQS queue. Multiple queues can consume the same event from EventBridge (fan-out via EventBridge rule targeting multiple queues).

Queue naming: `aurigo-maintain-{consumer-service}-{environment}` (e.g., `aurigo-maintain-capital-planning-production`).

**Dead Letter Queues (DLQ):** Every queue has a DLQ. After 3 failed processing attempts (configurable), the message is moved to the DLQ. CloudWatch alarms fire on DLQ depth > 0. The SRE/DevOps team investigates DLQ messages.

**Visibility Timeout:** Set to 3x the maximum expected processing time for a single message. For RUL recalculation (< 2 seconds), set to 30 seconds.

**Message Retention:** 14 days. Messages in DLQ retained for 14 days for investigation.

### Lambda Consumers

For lightweight event consumers (updating a materialized reporting view), AWS Lambda is appropriate. For complex consumers (RUL recalculation that may involve multiple database queries), use ECS service-side consumers via the SQS long-polling pattern in a background service.

Idempotency is enforced in every consumer using the `eventId` field:

```csharp
// Before processing
if (await _processedEventStore.HasBeenProcessedAsync(eventId, ct))
    return; // Skip — already processed

// Process the event
await ProcessEventAsync(event, ct);

// Mark as processed
await _processedEventStore.MarkProcessedAsync(eventId, ct);
```

---

## Event Sourcing

Event sourcing (storing all state changes as a sequence of events rather than current state) is **not used** in the initial implementation. Standard CRUD with domain events published after commit is the pattern.

Rationale for deferring: Event sourcing adds significant complexity (event replay, projections, snapshot management). For the domains currently in scope, the audit log (captured by `AuditInterceptor`) provides the historical record that regulators require. If a future requirement emerges that genuinely requires event replay semantics (e.g., "show me exactly what the asset's condition was at any point in the past, with every change"), event sourcing can be introduced for that specific aggregate.

The most likely candidate for event sourcing in the future is the asset condition history, where customers may want to reconstruct the full condition timeline at any point in time.

---

## Monitoring

- CloudWatch Metrics on every SQS queue: `NumberOfMessagesSent`, `NumberOfMessagesReceived`, `ApproximateNumberOfMessagesNotVisible` (in-flight), `ApproximateNumberOfMessagesDelayed`.
- CloudWatch Alarm: DLQ depth > 0 triggers a warning alert.
- CloudWatch Alarm: Queue depth > 1000 (consumer lag) triggers a warning.
- Event processing latency (from event `timestamp` to processing completion) logged as a custom metric.

---

_See also: [ADR-004 — Event Architecture](./adrs/ADR-004-event-architecture.md) for the EventBridge vs. Kafka decision, [05 — Microservices](./05-microservices.md) for service topology._
