# Observability

> Volume 3 · Architecture · Document 12  
> Metrics, traces, alerting, dashboards, and health checks

---

> **Implementation Status (as of 2026-07-19)**
>
> | Capability | Status |
> |---|---|
> | Serilog structured logging (console, JSON) | ✅ Shipped |
> | `/health` endpoint with `DbHealthCheck` | ✅ Shipped |
> | OTel tracing — AspNetCore + HttpClient instrumentation | ✅ Shipped |
> | OTel console exporter (dev only) | ✅ Shipped |
> | OTel OTLP exporter (configurable via `Otel:Endpoint`) | ✅ Shipped |
> | AWS X-Ray exporter | ⏳ Pending — not yet wired |
> | OTel metrics (custom business metrics, `AssetMetrics`) | ⏳ Pending |
> | OTel EF Core instrumentation | ⏳ Pending |
> | CloudWatch dashboards and alerting | ⏳ Pending — target: GA milestone |
> | OTel Collector sidecar in ECS | ⏳ Pending — target: GA milestone |
>
> The rest of this document describes the full target-state architecture. Items marked ⏳ are designed but not yet implemented.

---

## The Three Pillars

Observability is the property of a system that allows you to understand its internal state from its external outputs. The three pillars are complementary — each answers different questions:

| Pillar | Answers | Tool |
|---|---|---|
| **Logs** | What happened, and in what order? | AWS CloudWatch Logs + Serilog |
| **Metrics** | Is the system healthy right now? How does it compare to normal? | AWS CloudWatch Metrics + custom application metrics |
| **Traces** | Which services and operations contributed to this slow or failing request? | AWS X-Ray + OpenTelemetry |

A system with only logs is hard to monitor at scale (logs are high-volume and noisy). A system with only metrics can tell you something is wrong but not why. A system with all three allows you to move from "the p99 latency spiked" (metrics) → "these requests were slow" (traces) → "this specific database query was the bottleneck" (logs + trace details).

---

## Metrics

### Framework

OpenTelemetry SDK (.NET) exports metrics to AWS CloudWatch via the OTLP exporter. Custom application metrics use the `System.Diagnostics.Metrics` API (available in .NET 8) wrapped in service-specific metric classes.

```csharp
// Application/Metrics/AssetMetrics.cs
public class AssetMetrics
{
    private readonly Counter<long> _assetsCreated;
    private readonly Histogram<double> _inspectionDuration;
    private readonly ObservableGauge<int> _activeAssets;

    public AssetMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("Aurigo.AssetMaintenance");
        _assetsCreated = meter.CreateCounter<long>("assets.created", "count", "Number of assets created");
        _inspectionDuration = meter.CreateHistogram<double>("inspections.duration.ms", "ms", "Inspection recording duration");
        _activeAssets = meter.CreateObservableGauge("assets.active.count", () => GetActiveAssetCount());
    }

    public void RecordAssetCreated(string tenantId) =>
        _assetsCreated.Add(1, new TagList { { "tenant_id", tenantId } });

    public void RecordInspectionDuration(double durationMs) =>
        _inspectionDuration.Record(durationMs);
}
```

### Key Metrics to Monitor

**Request Metrics (from ASP.NET Core middleware):**
- `http.server.request.duration` (histogram) — latency distribution per endpoint
- `http.server.active_requests` (gauge) — currently in-flight requests
- `http.server.request.error.rate` — percentage of requests returning 5xx

**Database Metrics (from Npgsql):**
- `db.connection.pool.max` — max pool size configured
- `db.connection.pool.available` — idle connections in pool
- `db.connection.pool.pending` — requests waiting for a connection (leading indicator of pool exhaustion)
- `db.client.operation.duration` — query duration histogram

**Cache Metrics (custom):**
- `cache.hit.count` / `cache.miss.count` — hit rate per cache region
- `cache.eviction.count` — evictions due to TTL or memory pressure

**Business Metrics (custom, per tenant):**
- `inspections.completed.count` — daily inspection volume
- `capital_needs.identified.count` — new capital needs per day
- `rul.recalculations.count` — number of RUL recalculations triggered
- `report.generation.duration.ms` — report generation latency histogram

**Integration Metrics (custom):**
- `integration.sync.success.count` / `integration.sync.failure.count` — EAM sync reliability
- `integration.sync.duration.ms` — EAM sync duration

**Event Processing Metrics (SQS CloudWatch):**
- `ApproximateNumberOfMessagesVisible` — queue depth (consumer lag)
- `ApproximateAgeOfOldestMessage` — how long the oldest message has been waiting
- `NumberOfMessagesReceived` — throughput

---

## Traces

### OpenTelemetry Configuration

```csharp
// Program.cs
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddEntityFrameworkCoreInstrumentation(options =>
            {
                options.SetDbStatementForText = true;  // include SQL in traces (redact in prod)
            })
            .AddHttpClientInstrumentation()
            .AddSqsInstrumentation()
            .AddXRayTraceId()
            .AddAWSXRayExporter();
    });
```

### What Traces Show You

An X-Ray trace for a slow `GET /api/v1/assets/{id}/inspections` request might show:

```
Total: 847ms
  ├── ASP.NET Core request routing: 2ms
  ├── JWT validation middleware: 12ms
  ├── MediatR pipeline (validation behavior): 3ms
  ├── GetInspectionHistoryQueryHandler: 820ms
  │     ├── EF Core query #1 (GetAssetById): 4ms
  │     │     SQL: SELECT * FROM assets WHERE id = $1 AND tenant_id = $2
  │     ├── EF Core query #2 (GetInspections): 812ms  ← THIS IS THE PROBLEM
  │     │     SQL: SELECT * FROM inspections WHERE asset_id = $1
  │     │          ORDER BY inspected_at DESC
  │     └── AutoMapper: 4ms
  └── Response serialization: 10ms
```

The trace immediately points to query #2 as the bottleneck. The developer runs `EXPLAIN ANALYZE` on that query, discovers there's no index on `(asset_id, inspected_at)`, adds the index, and the query drops to 8ms.

### Trace Sampling

In production, trace every request would cost too much (storage and processing). Configure sampling:

- **1% of all requests** are traced by default.
- **100% of requests with errors** (4xx, 5xx) are traced.
- **100% of requests taking > 1 second** are traced.
- **100% of traces in development and staging.**

---

## Alerting

### Alert Tiers

**Critical (PagerDuty — wake someone up):**
- Error rate > 1% over 5 minutes
- p99 API latency > 5 seconds over 5 minutes
- Database connection pool exhausted (available connections = 0)
- Health check endpoint returning non-200 for > 2 minutes
- DLQ depth > 0 for the Capital Planning queue (capital needs may be lost)
- Failed payment or tenant provisioning event

**Warning (Slack #alerts-maintain channel — investigate during business hours):**
- p95 API latency > 500ms over 10 minutes
- Database connection pool utilization > 80%
- Cache hit rate dropping below 60% over 15 minutes
- EAM sync failure rate > 5% over 30 minutes
- DLQ depth > 0 for non-critical queues
- Report generation p95 > 60 seconds
- ECS task count below minimum for > 5 minutes

**Informational (CloudWatch dashboard — not alerted, reviewed in morning standup):**
- Daily active users per tenant
- New assets created per day
- Inspections completed per day
- Capital needs identified per day

### Alert Configuration (CloudWatch + SNS)

```json
{
  "MetricName": "5xxErrorRate",
  "Namespace": "Aurigo/AssetMaintenance",
  "Statistic": "Average",
  "Period": 300,
  "EvaluationPeriods": 1,
  "Threshold": 0.01,
  "ComparisonOperator": "GreaterThanOrEqualToThreshold",
  "AlarmActions": ["arn:aws:sns:us-east-1:...:PagerDuty-Critical"],
  "OKActions": ["arn:aws:sns:us-east-1:...:PagerDuty-Resolve"]
}
```

---

## CloudWatch Dashboards

### Service Health Dashboard

The primary dashboard. Opened first during any incident.

Widgets:
- Request rate (requests/minute) — line chart, 1-hour window
- Error rate (%) — line chart with 1% threshold line
- p50/p95/p99 latency — multi-line chart
- Database connection pool utilization — gauge
- ECS task count — current vs. desired
- Active SQS queue depths — gauge per queue
- Cache hit rate — line chart

### Database Performance Dashboard

- Top 10 slowest queries (from `pg_stat_statements`) — updated every 5 minutes
- Database CPU utilization
- Read IOPS / Write IOPS
- Free storage space
- Replication lag (primary → read replica)
- Connection count by state (idle, active, waiting)

### Business Metrics Dashboard

For product and customer success teams:
- Active tenants (tenants with at least one API call in the last 7 days)
- Assets registered per tenant (top 10 tenants by asset count)
- Inspections completed per day (trend, last 30 days)
- Capital needs identified per day
- Reports generated per week
- Average API response time (rolling 7-day)

---

## Health Checks

The `/health` endpoint returns a summary status for all dependencies. The load balancer polls this every 30 seconds. If the endpoint is unhealthy for > 2 minutes, the ECS task is replaced.

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddNpgsql(config.GetConnectionString("Default")!, name: "database")
    .AddRedis(config.GetConnectionString("Redis")!, name: "cache")
    .AddCheck<EamIntegrationHealthCheck>("eam-integration")
    .AddCheck<SqsHealthCheck>("sqs");

// Map health check endpoints
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
});
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,  // liveness check — just return 200 if the process is running
});
```

**Response (healthy):**
```json
{
  "status": "Healthy",
  "totalDuration": "00:00:00.0231456",
  "entries": {
    "database": { "status": "Healthy", "duration": "00:00:00.0198234" },
    "cache": { "status": "Healthy", "duration": "00:00:00.0012341" },
    "eam-integration": { "status": "Healthy", "description": "Maximo connector connected" },
    "sqs": { "status": "Healthy", "description": "Queue depth: 0" }
  }
}
```

**Response (degraded — EAM integration unavailable, but service can continue):**
```json
{
  "status": "Degraded",
  "entries": {
    "database": { "status": "Healthy" },
    "cache": { "status": "Healthy" },
    "eam-integration": {
      "status": "Degraded",
      "description": "Maximo connector unreachable. Last successful sync: 23 minutes ago."
    }
  }
}
```

Degraded vs. Unhealthy: The health check returns `Degraded` when a non-critical dependency is unavailable (EAM integration — the service continues to function without it). It returns `Unhealthy` when the database or cache is unavailable (the service cannot function).

The load balancer is configured to only take a task out of rotation on `Unhealthy`, not on `Degraded`.

---

## OpenTelemetry Collector

In production, a sidecar OpenTelemetry Collector runs in each ECS task. It receives telemetry from the application, batches it, and exports to:
- AWS X-Ray (traces)
- AWS CloudWatch Metrics (custom metrics)
- AWS CloudWatch Logs (via `awsemf` exporter for metrics embedded in logs)

The collector configuration is separate from the application — updating the export destination does not require an application deployment.

---

_See also: [11 — Logging](./11-logging.md) for log format and levels, [14 — CI/CD](./14-cicd.md) for performance test thresholds._
