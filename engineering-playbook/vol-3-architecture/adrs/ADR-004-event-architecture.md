# ADR-004 — AWS EventBridge + SQS for Async Event Processing

**Status:** Accepted  
**Date:** 2024-Q4  
**Deciders:** Principal Architect, DevOps Engineer  

---

## Context

Aurigo Maintain has several cross-module and cross-service operations that are naturally asynchronous: when an inspection is completed, the capital planning module needs to recalculate the RUL for the affected asset. When a capital plan is approved, work orders need to be created. When an asset's condition changes, the reporting service needs to update its materialized views.

These operations have several characteristics that make synchronous REST calls a poor fit:
1. **The primary operation should not wait.** The inspector who completes an inspection is not waiting for RUL recalculation. The asset manager who approves a capital plan is not waiting for 500 work orders to be created.
2. **Multiple consumers.** When `inspection.completed` fires, both the Capital Planning module and the Reporting service need to react. A single synchronous call can only have one target.
3. **Resilience.** If RUL recalculation is temporarily unavailable, the inspection should still be recorded. The recalculation can happen when the service recovers.

We needed to choose a messaging/event infrastructure that supports: pub/sub fan-out, reliable delivery, retry with backoff, dead-letter queues, AWS-native operation, and .NET SDK support.

---

## Decision

**We use AWS EventBridge as the event routing layer and AWS SQS as the reliable delivery queue for each consumer.** EventBridge routes events to one or more SQS queues based on event type. Each consumer service reads from its own SQS queue. Lambda handles lightweight consumers; ECS background services handle complex consumers.

The event schema follows the standard defined in [06 — Events](../06-events.md).

Domain events within a single service (raised inside domain entities, dispatched after `SaveChanges`) use MediatR's in-process notification system. Events that cross service boundaries use EventBridge.

---

## Consequences

### Positive
- **AWS-native.** EventBridge and SQS are fully managed, have no servers to operate, and integrate natively with CloudWatch for monitoring, IAM for authorization, and Lambda for lightweight consumers.
- **Fan-out.** A single event published to EventBridge can be routed to multiple SQS queues — one per consumer. No producer needs to know about all its consumers. Adding a new consumer requires only a new EventBridge rule.
- **Reliable delivery.** SQS guarantees at-least-once delivery. Messages are retained for up to 14 days. Failed processing attempts go to the Dead Letter Queue (DLQ) for investigation rather than being silently lost.
- **Decoupling.** The producer (Inspection Service) does not need to know that Capital Planning and Reporting need to react to its events. It publishes to EventBridge; routing is configuration, not code.
- **Schema registry.** EventBridge Schema Registry captures event schemas and generates code bindings. As the event catalog grows, this becomes valuable for keeping consumers in sync.
- **Operational familiarity.** The Aurigo platform already uses SQS for notification delivery and job queuing. The team has existing operational knowledge.

### Negative / Trade-offs
- **Eventual consistency.** Between the time an inspection is completed and the time RUL is recalculated, the displayed RUL score may be stale. For the use case (capital planning calculations), this is acceptable — the inspector is not watching the RUL update in real time.
- **Message ordering.** Standard SQS does not guarantee ordering. FIFO queues guarantee ordering but at reduced throughput (3,000 messages/second for FIFO vs. unlimited for standard). For most events, ordering is not required. For events where ordering matters (asset condition updates from multiple inspections on the same day), the consumer handles idempotency and ordering by checking timestamps.
- **Observability.** Debugging a failed async event processing chain is harder than debugging a synchronous call. The `correlationId` and `causationId` fields on all events mitigate this — they enable tracing the chain in CloudWatch Logs Insights.
- **Infrastructure cost.** EventBridge and SQS have per-message pricing. At the volume we anticipate (thousands of events/day), this is negligible. At millions of events/day, it becomes significant and should be reviewed.

---

## Alternatives Considered

### Option A: Apache Kafka

Kafka is the industry-standard event streaming platform. It provides: ordered, replayed, persistent event streams; consumer group semantics; exactly-once processing semantics (with additional configuration); and very high throughput (millions of events/second).

**Rejected because:**
1. **Operational overhead.** Running Kafka on AWS requires MSK (Managed Streaming for Apache Kafka) or self-managed. MSK has significant minimum cost (2 broker nodes, regardless of usage) and requires understanding of topics, partitions, consumer groups, and broker configuration that is not required for EventBridge + SQS.
2. **Overkill for our scale.** At the event volumes we anticipate (thousands to tens of thousands of events per day), EventBridge + SQS is more than sufficient. Kafka becomes compelling at sustained > 10,000 events/second — a scale we do not anticipate in the next 24 months.
3. **Team expertise.** The team has existing AWS SQS operational knowledge. Kafka requires different operational expertise.
4. **Cost.** MSK minimum cost is approximately $300–500/month even with minimal load. EventBridge + SQS cost approximately $1–10/month at our anticipated event volumes.

We will revisit Kafka if: (a) we need event replay (replaying historical events to rebuild a state), (b) we need exactly-once processing semantics for financial transactions, or (c) sustained event volume exceeds 10,000 events/second.

### Option B: Direct Service-to-Service REST Calls

When an inspection is completed, the handler directly calls the Capital Planning service's REST API to trigger recalculation.

**Rejected because:**
1. **Tight coupling.** The Inspection handler must know the Capital Planning service's API contract. Any change to the Capital Planning API requires a coordinated change to the Inspection handler.
2. **Single consumer.** A REST call can only have one target. If Reporting also needs to know about inspection completion, the Inspection handler must make two calls — and know about both consumers.
3. **Cascade failures.** If Capital Planning is unavailable, the inspection recording fails. With events, the inspection records successfully even if the consumer is temporarily down.
4. **Latency.** The inspector waits for the synchronous RUL recalculation to complete before seeing a success response. RUL recalculation may take seconds for complex assets.

### Option C: AWS SNS (Simple Notification Service)

SNS provides pub/sub with fan-out, similar to EventBridge.

**Not chosen as primary because EventBridge offers:**
1. **Content-based routing.** EventBridge rules can filter events by any field in the event body. SNS routing is limited to message attributes and topic subscriptions.
2. **Schema registry.** EventBridge integrates with Schema Registry for event schema discovery and code generation.
3. **Archive and replay.** EventBridge can archive events and replay them — useful for recovering from a consumer bug that caused incorrect processing.
4. **Richer rule matching.** EventBridge's rule language supports prefix matching, suffix matching, numeric ranges, and `anything-but` patterns.

SNS remains useful for notification delivery (sending emails, SMS, push notifications) — that is the Aurigo Notifications service's domain, not Maintain's.

---

## References

- [06 — Events](../06-events.md) — event schema standard and domain event catalog
- AWS EventBridge documentation: https://docs.aws.amazon.com/eventbridge/
- AWS SQS documentation: https://docs.aws.amazon.com/sqs/
- Martin Fowler, "Event-Driven Architecture": https://martinfowler.com/articles/201701-event-driven.html
