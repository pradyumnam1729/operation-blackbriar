# 12 — Data Synchronization Strategy

## Overview

Data synchronization is the heartbeat of the Maintain integration layer. It is how the intelligence layer stays current with the EAM system. Sync failures mean stale condition scores, outdated capital plans, and loss of customer trust. This document defines the technical strategy for keeping Maintain data synchronized with EAM systems reliably.

## Sync Modes

### Initial Load

The initial load extracts all records from the EAM system for a tenant. It runs once at onboarding and is re-run whenever a full resync is needed (e.g., after a major EAM migration or data correction).

Characteristics:
- Runs in batches of 200 records per page
- Scheduled during off-hours (2 AM to 5 AM tenant local time) to minimize EAM load
- Resumable: if the load fails at page 47 of 230, the next run starts at page 47
- Idempotent: running the initial load twice produces the same result
- Progress is logged per page to `SyncOperationLog`

For a mid-size agency with 50,000 assets and 200,000 work orders, an initial load takes approximately 2 to 4 hours depending on EAM response time and record size.

### Delta Sync

Delta sync runs every 15 minutes and retrieves only records changed since the last successful sync. This is the primary sync mode during ongoing operations.

Characteristics:
- Filters by `ChangedSince` timestamp (EAM-specific field: CHANGEDATE, AEDAT, LastUpdateDate)
- Runs as an AWS EventBridge Scheduler trigger → Lambda → EAM adapter
- Processes assets, work orders, PM schedules, and defects in separate passes
- Typical volume: 10–500 records per 15-minute window for an active agency
- Sub-minute processing time for typical delta batches

Delta sync does not catch soft deletes (records deleted in the EAM without a status change). Run a weekly reconciliation job to find assets in Maintain that are no longer present in the EAM and mark them as `EamDeleted`.

### Event-Driven Sync

Event-driven sync provides near-real-time updates via EAM events (Kafka, IDoc, ION BODs). See `10-events.md` for full details. When enabled, events arrive within seconds of the EAM change. Polling delta sync still runs as a backup.

## Idempotency

Every sync operation must be idempotent. Running the same sync twice must produce the same result. This is achieved via upsert semantics and canonical IDs.

### Canonical ID Generation

Every asset, work order, and defect in Maintain has a canonical ID that is deterministically derived from the EAM source. This ensures the same EAM record always maps to the same Maintain record, regardless of how many times it is synced.

```csharp
public static class CanonicalIdGenerator
{
    /// <summary>
    /// Generate a stable canonical ID for an EAM record.
    /// Same inputs always produce the same output.
    /// </summary>
    public static string Generate(string tenantId, string adapterName, string eamNativeId)
    {
        var input = $"{tenantId}|{adapterName}|{eamNativeId}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        // Take first 16 bytes → 32-char hex string (collision probability negligible)
        return Convert.ToHexString(hash[..16]).ToLowerInvariant();
    }
}

// Usage
var canonicalId = CanonicalIdGenerator.Generate(
    tenantId: "city-of-boston",
    adapterName: "ibm-maximo",
    eamNativeId: "PIPE-12345:BOSTON");
// Always returns the same value: "3c4e7a9b1d0f5e8c"
```

### Upsert Semantics

All sync writes use PostgreSQL `INSERT ... ON CONFLICT DO UPDATE`:

```sql
INSERT INTO assets (
    id, tenant_id, eam_native_id, adapter_name, name, asset_type_code, ...
    eam_last_sync_at, eam_sync_version
)
VALUES (
    @canonicalId, @tenantId, @eamNativeId, @adapterName, @name, @assetTypeCode, ...
    NOW(), @syncVersion
)
ON CONFLICT (id)
DO UPDATE SET
    name = EXCLUDED.name,
    asset_type_code = EXCLUDED.asset_type_code,
    -- EAM-owned fields: always overwrite
    eam_last_sync_at = EXCLUDED.eam_last_sync_at,
    eam_sync_version = EXCLUDED.eam_sync_version
    -- Maintain-owned fields (condition, rul, arv, risk): NOT overwritten
    -- condition_score intentionally excluded from UPDATE
WHERE assets.eam_sync_version < EXCLUDED.eam_sync_version;
```

The `WHERE assets.eam_sync_version < EXCLUDED.eam_sync_version` clause prevents an older EAM snapshot from overwriting a newer one — important when events arrive out of order.

## Pagination

### Standard Page-Based Pagination

Used by: Cityworks, UpKeep, MaintainX, Oracle Fusion REST.

```csharp
public async Task<List<T>> FetchAllPagesAsync<T>(
    Func<int, int, Task<PageResponse<T>>> fetchPage,
    int pageSize = 200)
{
    var all = new List<T>();
    var page = 1;
    int fetched;

    do
    {
        var response = await fetchPage(page, pageSize);
        all.AddRange(response.Items);
        fetched = response.Items.Count;
        page++;
        
        await Task.Delay(50); // Polite delay between pages
    } while (fetched == pageSize);

    return all;
}
```

The loop continues as long as a full page is returned. An incomplete page signals the last page.

### Cursor-Based Pagination (Maximo OSLC)

Maximo OSLC uses server-side cursors. The response includes an `oslc:nextPage` URL. Follow it until it is absent.

```csharp
public async Task<List<OslcAsset>> FetchAllOslcAsync(string initialUrl, CancellationToken ct)
{
    var all = new List<OslcAsset>();
    string? nextUrl = initialUrl;

    while (nextUrl != null && !ct.IsCancellationRequested)
    {
        var response = await _httpClient.GetFromJsonAsync<OslcResponse>(nextUrl, ct);
        all.AddRange(response.Members);
        nextUrl = response.NextPage?.Href;
        
        // Persist cursor so we can resume after failure
        await _syncState.SetCursorAsync(_tenantId, "ibm-maximo", "asset", nextUrl ?? "DONE");
    }

    return all;
}
```

### SAP BAPI Pagination

SAP BAPIs return a fixed result table. Use `MAX_ROWS` and `PAGE_NUM` parameters:

```csharp
var equipList = sapFunction.GetTable("EQUIPLIST");
// If equipList.Count == MAX_ROWS, fetch the next page with PAGE_NUM++
```

## Sync State

Sync state is stored per tenant per adapter in the `SyncState` table.

```sql
CREATE TABLE sync_states (
    tenant_id       VARCHAR(64) NOT NULL,
    adapter_name    VARCHAR(64) NOT NULL,
    record_type     VARCHAR(32) NOT NULL,  -- 'asset', 'workorder', 'pm', 'defect'
    last_sync_at    TIMESTAMPTZ,
    last_successful_sync_at TIMESTAMPTZ,
    last_page       INT,
    continuation_token TEXT,
    error_count     INT NOT NULL DEFAULT 0,
    status          VARCHAR(32) NOT NULL DEFAULT 'idle',  -- idle/running/completed/failed/degraded
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, adapter_name, record_type)
);
```

At the start of each delta sync:
1. Read `last_successful_sync_at` → use as `ChangedSince` parameter
2. Set `status = 'running'`

At the end of each successful sync:
1. Set `last_sync_at = NOW()`
2. Set `last_successful_sync_at = NOW()`
3. Set `status = 'completed'`
4. Reset `error_count = 0`
5. Clear `continuation_token`

On failure:
1. Set `status = 'failed'`
2. Increment `error_count`
3. Preserve `continuation_token` for resumable recovery

If `error_count >= 3`, set `status = 'degraded'` and trigger a CloudWatch alarm.

## Monitoring

The sync health dashboard shows per-tenant, per-adapter metrics:

| Metric | Description | Alert threshold |
|---|---|---|
| Sync success rate (24h) | % of sync runs that completed successfully | < 95% → warning, < 85% → critical |
| Records processed (per run) | Count of records fetched and upserted | Drop > 50% from baseline → warning |
| Sync lag | Time since last successful sync | > 30 min → warning, > 2h → critical |
| Parse error rate | % of records that failed mapping | > 1% → warning |
| Adapter health check | EAM system reachable + credentials valid | Failure → critical |

CloudWatch dashboard: `maintain-integration-{environment}`. Alarms route to PagerDuty for critical, Slack for warning.

### Key CloudWatch Metrics Published by Sync Engine

```csharp
_metrics.PutMetricData(new PutMetricDataRequest
{
    Namespace = "AurigoMaintain/Integration",
    MetricData = new List<MetricDatum>
    {
        new() { MetricName = "RecordsProcessed", Value = result.RecordsUpserted,
                Dimensions = [new() { Name = "TenantId", Value = tenantId },
                              new() { Name = "AdapterName", Value = adapterName }] },
        new() { MetricName = "SyncLagMinutes", Value = syncLagMinutes,
                Dimensions = [new() { Name = "TenantId", Value = tenantId }] },
        new() { MetricName = "ParseErrors", Value = result.RecordsFailed }
    }
});
```

## Backfill: Forcing a Full Re-Sync

A full re-sync is needed when:
- Data quality issues are discovered (wrong field mappings, missing records)
- A major EAM upgrade changes field names or data formats
- The Maintain canonical model is updated with new fields

```
POST /api/v1/admin/sync/backfill
Authorization: Bearer {admin-jwt}
Content-Type: application/json

{
  "tenantId": "city-of-boston",
  "adapterName": "ibm-maximo",
  "recordTypes": ["asset", "workorder"],  // null = all
  "schedule": "off-hours"  // or "immediate"
}
```

Backfill resets `last_successful_sync_at` to `1900-01-01T00:00:00Z` for the specified record types, effectively triggering a full extract on the next sync run. The `schedule: "off-hours"` option queues the backfill to start at 2 AM tenant local time. `schedule: "immediate"` starts it within 60 seconds.

Backfill is idempotent — running it produces the same end state regardless of whether the data is already current. Field mappings are re-applied to all records, so backfill is the standard remediation for mapping-related data quality issues.
