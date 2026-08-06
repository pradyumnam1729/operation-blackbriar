# Scalability Architecture

> Volume 3 · Architecture · Document 10  
> Horizontal scaling, multi-tenant isolation at scale, database scaling, and event processing scale

---

## Stateless Service Design

The foundation of horizontal scalability is statelessness. A service is stateless when any instance can serve any request without needing to know about previous requests or shared in-process state.

Aurigo Maintain is stateless by design:

- **No in-process session state.** Authentication state is in the JWT (self-contained). No server-side session store.
- **No in-process application state.** No static variables holding domain state, no request-scoped state shared across requests.
- **Distributed cache for shared computed state.** RUL scores, risk scores, and dashboard metrics that are expensive to recompute are stored in Redis (ElastiCache). Any instance can read from or write to the shared cache.
- **All uploaded files in S3.** No local disk usage for user data.
- **Background job state in the database.** Long-running jobs (report generation, bulk import) persist their state in Postgres, not in memory. If the instance dies, another instance can pick up the job.

The test: kill any ECS task at any point during normal operation. Traffic should continue to be served without errors, and any request in flight at the time of the kill should fail with a retryable error (not a silent data corruption).

---

## Horizontal Scaling on AWS ECS

### Auto-Scaling Configuration

Aurigo Maintain runs on AWS ECS Fargate. Auto-scaling is configured with two metrics:

**CPU-based scaling:**
- Scale out when average CPU > 70% over 5 minutes
- Scale in when average CPU < 30% over 15 minutes (longer cool-down prevents oscillation)
- Minimum instances: 2 (for availability during scale-in)
- Maximum instances: 20

**Request-count-based scaling:**
- Scale out when requests per target > 500/minute
- This catches I/O-bound workloads that don't spike CPU (e.g., large report generation with network I/O waiting)

**Scale-in protection:** ECS tasks with active long-running background jobs (report generation, bulk import) are protected from scale-in until the job completes. The job completion handler removes the scale-in protection.

### Instance Sizing

Current configuration (MVP):
- vCPU: 1 (1024 CPU units)
- Memory: 2 GB

Review and potentially right-size at GA based on production profiling. Asset maintenance workloads are not uniformly CPU or memory bound — profile under realistic load.

---

## Database Scaling

### Read Replicas

AWS RDS Aurora PostgreSQL automatically provisions a read replica in the same region. Read replicas are used for:

- Report generation queries (can tolerate slight read-behind)
- Dashboard aggregations run on a schedule
- Analytics queries from the Reporting Service
- TAMP report data export

The application uses two connection strings: one for the primary writer (all writes and latency-sensitive reads), one for the read replica (analytics and reporting). EF Core supports this via a read-only DbContext or by switching the connection string per use case.

```csharp
// Infrastructure/DependencyInjection.cs
services.AddDbContext<AssetMaintenanceDbContext>(options =>
    options.UseNpgsql(config.GetConnectionString("Default")));

// Separate context for read replica
services.AddDbContext<AssetMaintenanceReadContext>(options =>
    options.UseNpgsql(config.GetConnectionString("ReadReplica"))
           .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));
```

### Aurora Serverless v2

For staging and development environments, Aurora Serverless v2 reduces cost by scaling compute to near-zero when idle. Production uses provisioned Aurora with predictable performance.

### PgBouncer for Connection Pooling

Each ECS task instance opens its own connection pool to RDS. With 20 ECS instances each holding 100 connections, that's 2,000 connections to RDS. Aurora PostgreSQL supports up to 5,000 connections on larger instance sizes, but each connection consumes memory (roughly 10 MB per connection). At 2,000 connections, the database server is holding 20 GB of connection memory.

When ECS scales beyond 10 instances, introduce PgBouncer as a connection pooler in transaction-mode:
- PgBouncer runs as an ECS sidecar or as a separate ECS service.
- Each application instance connects to PgBouncer.
- PgBouncer maintains a small pool of actual database connections (e.g., 100 total), multiplexing many application connections through them.
- Reduces database connection count from O(instances × pool_size) to O(pool_size).

---

## Multi-Tenant Isolation at Scale

### Pool Model (Standard Tenants)

In the pool model, all tenants share the same database and the same ECS tasks. Tenant isolation is enforced by:
- EF Core global query filter (`WHERE tenant_id = @currentTenantId`) on every query
- Row-level security (PostgreSQL RLS) as a defense-in-depth backup
- Audit logging that captures tenant_id on every record

The pool model is appropriate for:
- Small tenants (< 10,000 assets)
- Medium tenants (< 100,000 assets)
- Customers who have not requested dedicated infrastructure

**Advantages:** Efficient resource utilization, simpler operations (one deployment, one database), cost-effective.

**Limitations:** A noisy neighbor (a tenant running a large report or bulk import) can affect other tenants' performance. Mitigated by query timeouts and background job queuing.

### Silo Model (Enterprise Tenants)

In the silo model, an enterprise tenant gets dedicated ECS tasks (or an ECS cluster) and a dedicated RDS instance. This is provisioned via Terraform from a module:

```
terraform/
  modules/
    tenant-silo/
      main.tf        — ECS service, RDS, ElastiCache, S3 bucket
      variables.tf
      outputs.tf
```

The silo model is appropriate for:
- Tenants with data residency requirements (must stay in a specific AWS region or account)
- Tenants with very large asset registries (> 500,000 assets) where performance isolation is critical
- Enterprise customers with contractual SLA requirements for dedicated infrastructure

**Tenant size tiers and resource allocation:**

| Tier | Asset Count | Model | ECS (vCPU/Memory) | RDS Instance | ElastiCache |
|---|---|---|---|---|---|
| Small | < 10,000 | Pool | Shared | Shared | Shared |
| Medium | < 100,000 | Pool | Shared | Shared | Shared |
| Large | > 100,000 | Pool or Silo | Dedicated (2/4 GB) | db.r6g.large | cache.r6g.large |
| Enterprise | > 500,000 | Silo | Dedicated cluster | db.r6g.xlarge | cache.r6g.xlarge |

---

## Event Processing Scale

### SQS Queue Throughput

Standard SQS queues support nearly unlimited throughput. The bottleneck is the consumer (the ECS service reading from the queue). The consumer processes messages in batches:

```csharp
// Background service reading from SQS
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        var response = await _sqsClient.ReceiveMessageAsync(new ReceiveMessageRequest
        {
            QueueUrl = _queueUrl,
            MaxNumberOfMessages = 10,  // batch of 10
            WaitTimeSeconds = 20,      // long polling — reduces empty receives
        }, stoppingToken);

        await Task.WhenAll(response.Messages.Select(m => ProcessMessageAsync(m, stoppingToken)));

        // Delete successfully processed messages
        // ... batch delete
    }
}
```

For burst scenarios (all field inspectors submitting at end of workday, large bulk import), the SQS queue absorbs the spike. Messages are processed at the consumer's rate — the producer (the inspection API) is not blocked by the consumer (the RUL recalculation service).

### Bulk Operation Processing

Bulk operations (importing 10,000 assets from a CSV, running TAMP calculations for 50,000 assets) use batch processing:

1. User uploads CSV via `/api/v1/assets/import`.
2. File is stored in S3. A job record is created in the database with status `Queued`.
3. A message is published to the `bulk-import` SQS queue with the job ID and S3 key.
4. A Lambda function (or ECS background service) processes the file in chunks of 500 rows.
5. Progress is updated on the job record: `{ processed: 3500, total: 10000, status: 'Processing' }`.
6. The frontend polls `GET /api/v1/jobs/{jobId}` every 5 seconds to show progress.

This pattern decouples the user-facing API from the heavy processing, keeps the API response fast, and allows the heavy processing to retry independently on failure.

---

## Cache Invalidation Strategy

The distributed cache (Redis) stores computed values that are expensive to recompute. The challenge is knowing when to invalidate.

**Time-based invalidation (for slowly-changing data):**
- Tenant configuration: TTL 5 minutes
- Asset classes and reference data: TTL 1 hour
- Dashboard summary metrics: TTL 1 minute

**Event-based invalidation (for computed values tied to data changes):**
When `inspection.completed` is processed by the Capital Planning consumer, it invalidates the RUL score cache for the affected asset:
```csharp
await _cache.RemoveAsync($"rul:{tenantId}:{assetId}", ct);
```

The next request for that asset's RUL score will miss the cache, recompute, and repopulate it. This ensures the displayed RUL score is always based on the latest inspection data, with at most the cache TTL delay.

**Cache stampede prevention:** When a heavily-used cache entry expires, multiple concurrent requests may try to recompute simultaneously (the "thundering herd"). Use a distributed lock (Redis SETNX) to allow only one request to recompute:

```csharp
await using var _ = await _distributedLock.AcquireAsync($"rul-compute:{assetId}", TimeSpan.FromSeconds(10), ct);
// Double-check the cache after acquiring the lock (another instance may have populated it while we waited)
var cached = await _cache.GetAsync(cacheKey, ct);
if (cached is not null) return cached;
// Now compute and store
```

---

## Load Testing and Capacity Planning

Run load tests quarterly and before major releases:

- **Baseline load test:** 50 concurrent virtual users, realistic usage mix (60% GET asset list, 20% GET asset detail, 10% POST inspection, 5% GET dashboard, 5% complex report). Target: p95 < 200ms, error rate < 0.1%.
- **Spike test:** Ramp from 0 to 500 VU in 30 seconds, hold for 1 minute. Target: no 500 errors, auto-scaling reacts within 3 minutes.
- **Soak test:** 50 VU for 4 hours. Target: no memory leaks (memory usage stable after 30-minute warm-up), no degradation in response time over the soak period.

Tools: k6 for synthetic load, AWS CloudWatch Contributor Insights for real production traffic patterns.

---

_See also: [09 — Performance](./09-performance.md) for query optimization, [14 — CI/CD](./14-cicd.md) for k6 load tests in the pipeline._
