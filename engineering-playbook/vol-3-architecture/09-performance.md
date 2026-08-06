# Performance Standards

> Volume 3 · Architecture · Document 09  
> Performance targets, optimization techniques, and profiling guidance

---

## Performance Targets

Every target has a measurement method. If you cannot measure it, you cannot know whether you've met it.

| Metric | Target | Measurement |
|---|---|---|
| API read (GET) p95 latency | < 200ms | AWS X-Ray, CloudWatch p95 metric |
| API write (POST/PATCH) p95 latency | < 500ms | AWS X-Ray, CloudWatch p95 metric |
| Report generation (standard, < 500 assets) | < 30s | Custom CloudWatch metric `ReportGenerationDuration` |
| Report generation (large, > 500 assets) | Async + polling | N/A — response is async job reference |
| Page load Time to Interactive | < 2s (mid-range device, 4G) | Lighthouse CI on PR |
| Map first tile render | < 1s | Custom React performance mark |
| Database query | < 100ms under normal load | PostgreSQL `pg_stat_statements` |
| Cache hit rate (RUL/risk scores) | > 80% | CloudWatch custom metric `CacheHitRate` |
| Background job processing (RUL recalculation) | < 5s per asset | Custom CloudWatch metric |

---

## Backend Performance

### AsNoTracking on All Read Queries

EF Core change tracking has non-trivial memory and CPU cost. For every entity loaded with change tracking enabled, EF Core stores a full snapshot of the entity's property values so it can detect changes during `SaveChanges`. For read-only operations, this is wasted work.

Benchmark context: loading 100 assets with 20 properties each with tracking enabled can use 3–5x more memory than the same query with `AsNoTracking()`. At 20 concurrent users each loading an asset list, this adds up.

The rule is simple: if the code path does not call `SaveChanges()` after loading, use `AsNoTracking()`.

### Projection at the Database Layer

Don't load full entities and then map to DTOs in memory. Push the column selection into the SQL query:

```csharp
// This generates: SELECT id, name, condition_rating FROM assets WHERE ...
var items = await _context.Assets
    .AsNoTracking()
    .Where(a => a.Status == AssetStatus.Active)
    .Select(a => new AssetListItemDto(a.Id.Value, a.Name, a.ConditionRating))
    .ToListAsync(ct);

// This generates: SELECT * FROM assets WHERE ... then maps in C#
var entities = await _context.Assets.AsNoTracking().Where(...).ToListAsync(ct);
var items = entities.Select(a => new AssetListItemDto(a.Id.Value, a.Name, a.ConditionRating)).ToList();
```

The difference in data transferred over the database network connection is significant for wide tables (e.g., the `assets` table has 25+ columns; a list item DTO might use 6).

### Composite Indexes for Common Query Patterns

Every query that filters on `tenant_id + X` should have a composite index `(tenant_id, X)`. The most critical indexes:

```sql
-- All list queries scope by tenant first
CREATE INDEX ix_assets_tenant_id_status ON assets (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_assets_tenant_id_asset_class ON assets (tenant_id, asset_class_id);
CREATE INDEX ix_inspections_tenant_id_asset ON inspections (tenant_id, asset_id);
CREATE INDEX ix_capital_needs_tenant_id_priority ON capital_needs (tenant_id, priority);

-- Spatial queries
CREATE INDEX ix_assets_location USING GIST ON assets (location);
```

Use `EXPLAIN ANALYZE` on any query that runs slower than 50ms. The query plan will show whether the index is being used or whether a sequential scan is occurring.

### Connection Pooling

Npgsql (the .NET PostgreSQL driver) manages a connection pool per process. Default settings are suitable for single-instance deployments. For high-concurrency scenarios (ECS with multiple task instances), configure:

```json
{
  "ConnectionStrings": {
    "Default": "Host=...;Database=...;Username=...;Password=...;Maximum Pool Size=100;Minimum Pool Size=5;Connection Idle Lifetime=300"
  }
}
```

For very high connection counts (> 500 total across all ECS tasks), consider adding PgBouncer as a connection pooler between the application and RDS.

### Caching Strategy

**Two-level caching:** IMemoryCache for tenant configuration (TTL 5 minutes), IDistributedCache (Redis) for computed values with cross-instance sharing requirements.

```csharp
// IMemoryCache: tenant configuration — read-heavy, changes rarely
var config = await _cache.GetOrCreateAsync($"tenant-config:{tenantId}", async entry =>
{
    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
    return await _repository.GetTenantConfigAsync(tenantId, ct);
});

// IDistributedCache (Redis): RUL scores — computed values, invalidated on condition change
var rulKey = $"rul:{tenantId}:{assetId}";
var cached = await _distributedCache.GetStringAsync(rulKey, ct);
if (cached is not null)
    return JsonSerializer.Deserialize<RulScore>(cached)!;

var score = await CalculateRulAsync(assetId, ct);
await _distributedCache.SetStringAsync(rulKey,
    JsonSerializer.Serialize(score),
    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24) },
    ct);
return score;
```

Cache invalidation for RUL scores: when `inspection.completed` event is processed, invalidate the cache key for the affected asset.

### Async All the Way Down

A single synchronous blocking call on an async operation (`.Result`, `.Wait()`) blocks the entire thread. In ASP.NET Core's thread pool, blocking threads reduces concurrency capacity and can cause the server to become unresponsive under load.

Verify the entire call chain is async: controller action → handler → repository → EF Core. Any synchronous method in the chain that touches I/O is a performance hazard.

---

## Frontend Performance

### TanStack Query Staleness Configuration

Configure `staleTime` based on how frequently the data changes and how important freshness is:

```typescript
// Reference data (asset classes, config) — changes rarely, cache aggressively
const { data: assetClasses } = useQuery({
  queryKey: ['asset-classes'],
  queryFn: api.listAssetClasses,
  staleTime: 5 * 60 * 1000,  // 5 minutes
  gcTime: 60 * 60 * 1000,     // 1 hour
});

// Operational data — show latest, but don't hammer the API
const { data: inspections } = useQuery({
  queryKey: ['inspections', assetId],
  queryFn: () => api.getInspections(assetId),
  staleTime: 30_000,  // 30 seconds
});

// Dashboard metrics — balanced freshness
const { data: summary } = useQuery({
  queryKey: ['dashboard', 'summary'],
  queryFn: api.getDashboardSummary,
  staleTime: 60_000,  // 1 minute
  refetchInterval: 5 * 60 * 1000,  // background refresh every 5 min
});
```

### Virtual Scrolling for Large Lists

Asset registries for large agencies (county DOTs, state DOTs) may contain 10,000–100,000+ assets. Rendering 10,000 DOM nodes simultaneously locks the browser thread.

Use `@tanstack/react-virtual` for list virtualization:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export function AssetVirtualList({ assets }: { assets: AssetListItem[] }): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: assets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,  // estimated row height in pixels
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            <AssetListRow asset={assets[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Lazy Loading Route Components

Route components are code-split automatically by TanStack Router with Vite. Each route is a separate chunk. Heavy features (TAMP report viewer, full-screen map, bulk import) load only when navigated to:

```typescript
// routes/reports/tamp.tsx — this file's import creates a split point
export const Route = createFileRoute('/reports/tamp')({
  component: TampReportPage,
});
```

Verify bundle sizes with `npm run build -- --analyze` (Rollup visualizer). No single chunk should exceed 500 KB gzipped.

### Map Performance

Mapbox GL JS renders all asset markers as a WebGL layer, not DOM elements. Performance degrades when passing thousands of GeoJSON features to a single source without clustering.

**Cluster markers below zoom level 12:**
```typescript
map.addSource('assets', {
  type: 'geojson',
  data: assetsGeoJson,
  cluster: true,
  clusterMaxZoom: 12,
  clusterRadius: 50,
});

map.addLayer({
  id: 'asset-clusters',
  type: 'circle',
  source: 'assets',
  filter: ['has', 'point_count'],
  paint: { 'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40] },
});
```

At zoom level 12 and below (city/state view), show clusters. At zoom level 12+ (street level), show individual assets. This keeps the GPU workload manageable regardless of the total number of assets.

**Use vector tiles for large datasets (> 50,000 assets):** Generate Mapbox vector tiles from PostGIS using `pg_tileserv` and serve them from CloudFront. The browser only requests tiles for the visible viewport — it doesn't download all 50,000 assets on page load.

---

## Database Performance

### Query Analysis Workflow

When a query is taking > 50ms on a dataset of realistic size:

1. Enable `pg_stat_statements` extension (always enabled in production and staging):
   ```sql
   SELECT query, mean_exec_time, calls FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 20;
   ```

2. Run `EXPLAIN ANALYZE` on the slow query:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
   SELECT * FROM assets WHERE tenant_id = '...' AND status = 'Active'
   ORDER BY name LIMIT 20 OFFSET 0;
   ```

3. Look for: Seq Scan on large tables (missing index), Nested Loop on large result sets (N+1), Sort without index (missing sort index).

4. Add the appropriate index and verify the query plan changes.

### Partitioning Strategy for Large Tenants

For tenants with > 500,000 assets, consider range partitioning the `assets` table by `tenant_id` using PostgreSQL declarative partitioning:

```sql
CREATE TABLE assets (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    ...
) PARTITION BY HASH (tenant_id);

CREATE TABLE assets_0 PARTITION OF assets FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE assets_1 PARTITION OF assets FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE assets_2 PARTITION OF assets FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE assets_3 PARTITION OF assets FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

This keeps each partition smaller and focuses query I/O on the relevant partition for a given tenant.

### Autovacuum Tuning

Write-heavy tables (`inspections`, `audit_log`) accumulate dead tuples quickly. Autovacuum default settings may not be aggressive enough:

```sql
ALTER TABLE inspections SET (
    autovacuum_vacuum_scale_factor = 0.01,  -- vacuum when 1% of rows are dead
    autovacuum_analyze_scale_factor = 0.005
);
```

---

## Performance Testing

k6 load tests are in `tests/performance/`. They run against the staging environment in CI on every PR to main. Failure thresholds:

```javascript
// tests/performance/asset-list.js
export const options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% of requests < 200ms
    http_req_failed: ['rate<0.01'],    // < 1% error rate
  },
};
```

If a PR causes a threshold violation in the k6 load test, the CI pipeline fails and the PR cannot be merged until the regression is investigated and fixed.

---

_See also: [04 — Database Standards](./04-database-standards.md) for EF Core query patterns, [10 — Scalability](./10-scalability.md) for horizontal scaling._
