# 18 — Integration Monitoring Runbook

Integration monitoring is the on-call engineer's operational surface for the entire EAM integration layer. This runbook covers: what dashboards exist, what metrics indicate health, what alarms are configured, what to do when each alarm fires, how to manually trigger operations, and how to isolate a bad tenant without affecting others.

The integration layer's failure modes are different from the application's failure modes. An EAM system going down for a customer is not a Maintain outage — but if we do not respond correctly, it becomes one. This runbook exists so that on-call engineers can respond to integration issues with confidence and consistency.

---

## Dashboards

### Dashboard 1: Integration Overview

**URL**: `https://cloudwatch.aws.amazon.com/dashboard/integration-overview`

**Purpose**: 30,000-foot view of all integrations. Answers "is anything on fire?"

**Panels**:
- Total tenants with active integrations (count)
- Sync operations in the last hour (count, by adapter)
- Sync success rate in the last hour (percentage, by adapter)
- Total records synced in the last hour (count)
- Currently failing tenants (list, with tenant name + adapter + last successful sync)
- Circuit breakers open (count and list)
- Average sync latency in the last hour (P50, P95, P99)

**Refresh**: 1 minute

**On-call reads this dashboard**: first thing after receiving any integration-related page

### Dashboard 2: Per-Adapter Health

**URL**: `https://cloudwatch.aws.amazon.com/dashboard/adapter-{adapterName}`

Available for each adapter: `adapter-ibm-maximo`, `adapter-sap-eam`, `adapter-cityworks`, `adapter-oracle-eam`, `adapter-infor-eam`, `adapter-maintainx`, `adapter-upkeep`.

**Panels**:
- Sync operations for this adapter (time series, last 24 hours)
- Error rate for this adapter (percentage, last 24 hours)
- Records fetched, mapped, upserted, failed (stacked area)
- HTTP status code distribution (200s, 400s, 500s)
- Retry counts (indicates transient issue trending)
- Circuit breaker state (open/closed/half-open)
- Rate limit consumption (tokens used / tokens available)
- Top 5 tenants by error count

**Use**: after identifying a problem adapter from Dashboard 1, drill down here to see the pattern

### Dashboard 3: Per-Tenant Integration Health

**URL**: `https://cloudwatch.aws.amazon.com/dashboard/tenant-integration?tenantId={tenantId}`

**Panels**:
- Sync operations for this tenant (all adapters)
- Last successful sync time (per adapter, per record type)
- Sync lag (delta between now and last sync)
- Records fetched today (per adapter, per record type)
- Records failed today (with categorization: identity, data, schema)
- Conflict resolution queue depth
- Human review queue depth

**Use**: when a specific tenant is reported as having integration issues

### Dashboard 4: Sync Job Execution

**URL**: `https://cloudwatch.aws.amazon.com/dashboard/sync-jobs`

**Panels**:
- Lambda invocation count (per adapter, per record type)
- Lambda duration (P50, P95, P99)
- Lambda error count
- Lambda concurrent executions
- SQS queue depth for retry queue
- SQS queue depth for dead letter queue (DLQ)
- EventBridge Scheduler execution success rate

**Use**: when investigating whether the sync execution infrastructure itself is healthy vs the adapters

### Dashboard 5: Data Quality

**URL**: `https://cloudwatch.aws.amazon.com/dashboard/data-quality`

**Panels**:
- Records synced with missing required fields (by adapter, by tenant)
- Records with unmapped enum values (by field, by adapter)
- Records with default values applied (e.g., "UNKNOWN" for unmapped class codes)
- Conflict rate (identity conflicts, data conflicts, delete conflicts)
- Records quarantined for human review (count, by tenant, by reason)
- Data quality score (composite metric, per tenant per adapter)

**Use**: for monthly integration health reviews; not typically for real-time incident response

---

## Metrics That Indicate Health

### Sync Success Rate

**Definition**: `records_upserted / records_fetched` per sync operation

**Healthy**: > 99.5%

**Warning**: 95% – 99.5% — investigate but not urgent

**Critical**: < 95% — page and investigate immediately

**Why it matters**: A drop indicates that something in the mapping or upsert path is failing. Could be schema drift, data corruption, or an infrastructure issue.

### Sync Lag

**Definition**: `(now) - (last_successful_sync_at)` per adapter per tenant

**Healthy**:
- Delta sync: < 20 minutes (15-min scheduled + up to 5 min tolerance)
- Event-driven sync: < 5 minutes
- Batch/nightly sync: < 26 hours

**Warning**:
- Delta sync: 20 – 60 minutes
- Event-driven sync: 5 – 15 minutes
- Batch/nightly sync: 26 – 48 hours

**Critical**:
- Delta sync: > 60 minutes
- Event-driven sync: > 15 minutes
- Batch/nightly sync: > 48 hours

**Why it matters**: Sync lag directly affects data currency in Maintain. High lag means Maintain is making decisions based on stale EAM data.

### Record Count Trends

**Definition**: Number of records fetched per sync, compared to the same window in the previous week

**Healthy**: within 50% of the previous week's count

**Warning**: 50% – 200% deviation

**Critical**: > 200% deviation (either 2x more or 2x less than expected)

**Why it matters**:
- Sudden drop to zero: EAM query filter is misconfigured, or the EAM is empty (unlikely) or the delta filter is misconfigured
- Sudden 10x spike: often indicates the delta filter reset and full re-sync is happening
- Steady drop over time: could indicate tenant is decommissioning assets

### HTTP Error Rate (per adapter)

**Definition**: HTTP responses with 4xx or 5xx status codes / total HTTP responses

**Healthy**: < 1%

**Warning**: 1% – 5%

**Critical**: > 5% sustained for 10 minutes

**Why it matters**: The adapter cannot fetch data if the EAM is returning errors. Different codes have different meanings:
- 4xx (authentication, rate limit): adapter or configuration issue
- 5xx (server error): EAM system issue
- Timeouts: network or EAM performance issue

### Circuit Breaker Trips

**Definition**: Count of circuit breaker transitions from closed to open per hour

**Healthy**: 0

**Warning**: 1 – 2 per day (indicates transient EAM instability)

**Critical**: > 3 per day, or open for > 15 minutes at a time

**Why it matters**: Circuit breaker opens when 50% of requests fail in a 60-second window. Frequent trips indicate systemic EAM issues that need customer communication.

### Rate Limit Consumption

**Definition**: `tokens_consumed / tokens_available` per minute

**Healthy**: < 80%

**Warning**: 80% – 100%

**Critical**: > 100% (throttled — requests being queued)

**Why it matters**: If we consistently hit our own configured rate limit, we may be under-provisioned for the customer's data volume. If we hit the EAM's rate limit (visible via 429 responses), we need to slow down.

### Conflict Rate

**Definition**: `conflicts_detected / records_upserted` per adapter per tenant

**Healthy**: < 0.5%

**Warning**: 0.5% – 2%

**Critical**: > 2%

**Why it matters**: A rise in conflict rate can indicate: data drift between Maintain and EAM (users editing in both), an adapter mapping bug producing false conflicts, or a systemic identity issue.

---

## CloudWatch Alarms

The following alarms are configured. Each has a specific response.

### Alarm: `IntegrationSyncFailureRate`

**Trigger**: Sync success rate < 95% for 5 consecutive minutes for any adapter

**Severity**: P1

**Runbook** (see below):
1. Identify which adapter is failing (dashboard)
2. Identify which tenant(s) are failing
3. Check for recent adapter deployment or configuration change
4. Check EAM system status (external status page if available)
5. If new pattern, escalate to Integration Strategist

### Alarm: `IntegrationSyncLag`

**Trigger**: Any tenant's sync lag exceeds 60 minutes for delta sync

**Severity**: P2 (P1 if > 3 tenants affected simultaneously)

**Runbook**:
1. Check the tenant's dashboard — is the adapter alive at all?
2. Check the sync job Lambda logs for the tenant
3. Is the tenant's EAM reachable? (health check endpoint)
4. Check if the tenant is in a rate-limit-throttled state
5. Manual trigger a sync (see below) and observe

### Alarm: `CircuitBreakerOpen`

**Trigger**: Any adapter's circuit breaker is open for > 5 minutes

**Severity**: P2

**Runbook**:
1. Identify the tenant + adapter
2. Look at the pre-trip error pattern in the adapter dashboard
3. Was it timeouts? 5xx errors? 429 rate limits?
4. Wait for the circuit to attempt half-open (5-minute break duration by default)
5. If it re-opens immediately, the EAM is still failing — customer notification recommended
6. If it stays closed, monitor for 30 minutes to confirm resolution

### Alarm: `DlqDepth`

**Trigger**: Dead-letter queue depth > 100 messages

**Severity**: P2 (P1 if > 1000)

**Runbook**:
1. Investigate the DLQ messages — what type of failure?
2. Common causes: schema changes not yet mapped, expired credentials, unrecoverable data validation errors
3. For expired credentials: coordinate with customer IT to renew
4. For unmapped fields: add to canonical model or field mapping overrides
5. For unrecoverable errors: log in the integration issue log, notify the customer via CSM
6. After fix, replay DLQ messages using the DLQ Redrive tool (see below)

### Alarm: `AuthenticationFailure`

**Trigger**: > 5 authentication failures in 5 minutes for any tenant's adapter

**Severity**: P1

**Runbook**:
1. Confirm the tenant + adapter
2. Do not retry — the credential is either expired, rotated, or revoked
3. Halt the sync for this tenant (see below)
4. Immediate notification to the customer IT contact via CSM
5. Investigate and coordinate credential renewal
6. Once renewed, restart the sync

### Alarm: `HighConflictRate`

**Trigger**: Conflict rate > 5% for any tenant for 1 hour

**Severity**: P2

**Runbook**:
1. Review the conflicts in the human review queue for this tenant
2. Are they identity conflicts (records that should merge)? Data conflicts (real user edits)?
3. If identity conflicts: investigate the canonical ID generation — did the EAM key change?
4. If data conflicts: this may be legitimate (both systems editing) — coordinate with the customer
5. If system-generated (bug in mapping producing false conflicts): file a bug and roll back the adapter version

### Alarm: `DataQualityRegression`

**Trigger**: Data quality score drops > 20% from previous week for any tenant

**Severity**: P3

**Runbook**:
1. Identify the specific fields with regressed quality
2. Is the EAM sending fewer values (customer changed process)?
3. Is our mapping producing more defaults?
4. Not urgent — investigate and file follow-up bugs or configuration updates as needed

### Alarm: `WriteBackFailure` (Hybrid/Native Mode only)

**Trigger**: > 5% failure rate on `CreateWorkOrderAsync` or `UpdateWorkOrderStatusAsync` for any adapter

**Severity**: P1

**Runbook**:
1. Which specific write is failing?
2. Are we sending invalid data (validation error in EAM)? Check the response body
3. Is the EAM in a state that rejects writes (e.g., closed period)?
4. Retry with backoff; if still failing after 3 retries, quarantine the request and notify

---

## Common Runbook Actions

### Manually Trigger a Sync

Used when: a scheduled sync was missed, a tenant needs an ad-hoc refresh, or after resolving an EAM issue.

```bash
# Trigger delta sync for a specific tenant + adapter
aws lambda invoke \
  --function-name eam-sync-worker \
  --payload '{"tenantId":"city-of-boston","adapterName":"ibm-maximo","syncMode":"delta"}' \
  /dev/null

# Trigger initial (full) load — use with caution, high volume
aws lambda invoke \
  --function-name eam-sync-worker \
  --payload '{"tenantId":"city-of-boston","adapterName":"ibm-maximo","syncMode":"initial"}' \
  /dev/null
```

**Rules**:
- Never trigger a manual initial load without customer notification during business hours (it can strain their EAM)
- Manual triggers are logged; the Integration Strategist reviews weekly

### Halt Sync for a Tenant

Used when: authentication is broken, data is being corrupted, or the customer requests a pause.

```bash
# Set the adapter config for the tenant to enabled=false
aws dynamodb update-item \
  --table-name IntegrationAdapterConfig \
  --key '{"TenantId":{"S":"city-of-boston"},"AdapterName":{"S":"ibm-maximo"}}' \
  --update-expression "SET Enabled = :false" \
  --expression-attribute-values '{":false":{"BOOL":false}}'
```

The next scheduled sync will skip this tenant. Existing data in Maintain is preserved.

To resume: set `Enabled = true`.

### Quarantine Bad Data for a Tenant

Used when: an incoming batch has data quality issues, or a specific record is triggering repeated failures.

**Option A: Filter out specific records at the adapter layer**

Add a filter to the adapter configuration:

```json
{
  "fieldFilters": {
    "asset": {
      "excludeIfAny": [
        {"field": "AssetTypeCode", "equals": "SCRAP"},
        {"field": "EamNativeId", "startsWith": "TEST-"}
      ]
    }
  }
}
```

**Option B: Mark specific records as quarantined**

```sql
UPDATE canonical_assets
SET quarantined = true, quarantine_reason = 'Duplicate identity — pending merge'
WHERE tenant_id = 'city-of-boston' AND eam_native_id IN ('BRIDGE-001-DUPE', 'BRIDGE-002-DUPE');
```

Quarantined records do not participate in Maintain queries but are preserved for review.

### Isolate a Tenant Without Affecting Others

The critical operational property: one tenant's bad data must not affect other tenants' operations.

**Isolation is automatic at the following layers**:
- Sync jobs run per tenant (not shared)
- Circuit breakers are per adapter per tenant, not global
- Rate limits are enforced per tenant
- Retry queues use tenant-scoped visibility timeouts
- Human review queues are per-tenant

**If you need to force isolation** (e.g., a specific tenant is causing systemic issues):

1. Halt sync for the tenant (above)
2. Verify other tenants continue to sync normally (dashboard 1)
3. Investigate the offending tenant separately
4. Do not resume sync until the root cause is understood and fixed

**What NOT to do**: never bulk-halt all tenants for one adapter because of one bad tenant. This is over-response and affects healthy customers.

### Replay Failed Sync Records (DLQ Redrive)

Used after fixing the cause of a DLQ backup.

```bash
# List messages in the DLQ (safe, read-only)
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/{account}/eam-sync-dlq \
  --max-number-of-messages 10 \
  --visibility-timeout 0

# Redrive messages from DLQ back to the main queue
aws sqs start-message-move-task \
  --source-arn arn:aws:sqs:us-east-1:{account}:eam-sync-dlq \
  --destination-arn arn:aws:sqs:us-east-1:{account}:eam-sync-main
```

**Before redriving**:
- Confirm the root cause of the DLQ backup is fixed
- Confirm the failed messages will not fail again (or you will just move them back to DLQ)
- Redrive in small batches (100 at a time) to observe behavior

### Force a Full Re-Sync for a Tenant

Used when: initial load was incomplete, data drift is suspected, or after a major schema change.

**Warning**: this reloads all records from the EAM. Can take hours. Coordinate with customer.

```bash
# Reset the sync state
aws dynamodb update-item \
  --table-name IntegrationSyncState \
  --key '{"TenantId":{"S":"city-of-boston"},"AdapterName":{"S":"ibm-maximo"}}' \
  --update-expression "REMOVE LastSyncAt, LastContinuationToken"

# Trigger the initial load
aws lambda invoke \
  --function-name eam-sync-worker \
  --payload '{"tenantId":"city-of-boston","adapterName":"ibm-maximo","syncMode":"initial"}' \
  /dev/null
```

**When to use**: only in coordination with the Integration Strategist. This is a heavy-touch operation.

### Rotate Credentials for an Adapter

Used when: customer rotates their EAM service account password, OAuth secret expires, or credential compromise is suspected.

1. Customer IT generates new credentials in the EAM
2. Store new credentials in AWS Secrets Manager:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id maximo-boston-creds \
     --secret-string '{"username":"aurigo-sa","password":"NewPassword123"}'
   ```
3. The adapter reads the secret on next sync; no code deploy required
4. Verify the next sync succeeds
5. If it fails, roll back credentials to previous version (secrets are versioned)

### Diagnose a Specific Record Failure

Used when: a specific asset or work order is not appearing in Maintain despite being present in the EAM.

1. Get the EAM native ID for the record from the customer
2. Query the sync operation log:
   ```sql
   SELECT * FROM sync_operation_log
   WHERE tenant_id = 'city-of-boston'
     AND started_at > NOW() - INTERVAL '24 hours'
   ORDER BY started_at DESC;
   ```
3. Find the sync that should have included the record
4. Check the record error log:
   ```sql
   SELECT * FROM sync_record_errors
   WHERE tenant_id = 'city-of-boston'
     AND eam_native_id LIKE '%BRIDGE-001%'
   ORDER BY occurred_at DESC LIMIT 10;
   ```
5. Common causes:
   - Record failed validation (log will show why)
   - Record was outside the site filter or asset class filter
   - Record's CHANGEDATE is before the last sync (delta filter missed it — reset sync state and re-sync)
   - Record has a custom field that failed mapping (log the field and add to mapping config)

---

## Multi-Tenant Considerations

Aurigo Maintain supports the case where a single EAM installation has multiple SITEID (Maximo), plant codes (SAP), or business units (Oracle) mapping to different Aurigo tenants.

### Scenario: One Maximo Installation, Multiple Maintain Tenants

Common when a state DOT has one Maximo but each district manages its assets as a separate Aurigo tenant.

**Configuration**:
```json
[
  {
    "tenantId": "state-dot-district-1",
    "adapterName": "ibm-maximo",
    "baseUrl": "https://maximo.state.gov/maximo",
    "siteFilter": ["DIST1-BRIDGES", "DIST1-ROADS"]
  },
  {
    "tenantId": "state-dot-district-2",
    "adapterName": "ibm-maximo",
    "baseUrl": "https://maximo.state.gov/maximo",
    "siteFilter": ["DIST2-BRIDGES", "DIST2-ROADS"]
  }
]
```

**Considerations**:
- Each tenant has its own credentials (do not share service accounts across tenants — audit trail)
- Rate limits should be coordinated: if the EAM allows 300 req/min total and we have 3 tenants, each gets 100 req/min
- Each tenant syncs independently; a failure in one tenant does not affect another
- If a record could belong to two tenants (rare), the site filter must be exclusive; document this in the adapter configuration comment

### Scenario: Multiple EAMs for One Tenant

Rarer, but happens when a customer is mid-migration or has separate EAMs for different asset classes.

**Configuration**:
```json
[
  {
    "tenantId": "city-of-boston",
    "adapterName": "ibm-maximo",
    "assetClassFilter": ["BRIDGE", "CULVERT"]
  },
  {
    "tenantId": "city-of-boston",
    "adapterName": "cityworks",
    "assetClassFilter": ["ROAD", "SIGN"]
  }
]
```

**Considerations**:
- Canonical IDs must be adapter-scoped (`SHA-256(tenantId|adapterName|eamNativeId)`) so records from two adapters do not collide
- Reporting in Maintain shows the source adapter for each record
- Conflict resolution across adapters (same asset in both EAMs) requires special handling — the Integration Strategist configures the primary adapter per record type

---

## EAM Upgrade Migration Path

Customers upgrade their EAMs on their own schedule. When they do, our adapter may need to change.

### Detection

Signals that a customer's EAM has been upgraded:
- Sudden change in HTTP response schema (new fields, renamed fields)
- Authentication mechanism change (e.g., moving from Basic to OAuth)
- Error rate spike after the customer notifies of maintenance window
- Customer IT notification (ideally before the upgrade)

### Response

**Preferred path**: proactive coordination

1. Customer IT notifies us of a planned EAM upgrade at least 4 weeks in advance
2. Integration Strategist reviews the target EAM version release notes for breaking changes
3. If the current adapter supports the new version: no action needed except a post-upgrade smoke test
4. If the adapter needs updates: schedule adapter changes to complete before the customer's upgrade window
5. Test the new adapter version against a customer sandbox (if available)
6. Deploy the new adapter version; keep the old version available for rollback
7. Coordinate with customer to run smoke tests during their upgrade window
8. Monitor for 48 hours post-upgrade

**Reactive path**: customer upgraded without notice

1. Detect the change (increased error rate, sync failures)
2. Halt sync for the affected tenant to prevent data corruption
3. Investigate: what changed in the EAM API?
4. Update the adapter or configuration
5. Test against staging or a customer sandbox
6. Resume sync
7. Follow up with customer to add EAM upgrade notification to their change management process

### Maximo 7.6 → MAS Migration Example

The most complex EAM upgrade path. Steps:

1. **Before customer's upgrade**:
   - Confirm the target MAS version and features enabled (are they moving to IBM Managed or self-managed?)
   - Confirm OAuth 2.0 configuration will be available
   - Verify GraphQL endpoint availability (some MAS features expose GraphQL)

2. **Adapter changes**:
   - The `IbmMaximoAdapter` remains the same at the interface level
   - The underlying HTTP client switches: `MaximoRestClient` → `MaximoMasClient` (uses OAuth 2.0 flow instead of Basic Auth)
   - The OSLC endpoint URL may change from `/maximo/oslc/os/mxasset` to `/maximo/api/os/mxasset` (7.6 uses `/oslc/`, MAS uses `/api/`)
   - Some fields (auto-generated GUIDs) become available in MAS but not 7.6

3. **Deployment**:
   - Adapter version supports both 7.6 and MAS via a config flag `useMasClient: true`
   - Customer's tenant configuration is updated with the new base URL and OAuth credentials
   - Test with a small sync (single record) before enabling full sync

4. **Cutover**:
   - Customer performs their upgrade
   - We update the adapter configuration
   - Monitor closely for 48 hours
   - Retain the ability to roll back the configuration if the upgrade has issues on their side

5. **Cleanup**:
   - After 30 days of stable operation, mark the tenant as "MAS-native"
   - The 7.6-specific configuration options are archived

---

## Integration SLAs by Mode

Different deployment modes have different sync latency SLAs.

| Mode | Read Sync SLA (P95) | Write-back SLA (P95) | Reconciliation SLA |
|---|---|---|---|
| Integrated (read-only) | 20 minutes | N/A | Weekly |
| Hybrid (write-back specific records) | 20 minutes | 5 minutes for work orders | Weekly |
| Native (Maintain is primary) | N/A (no EAM read) | N/A | N/A |

SLA breach triggers customer notification:
- SLA breach for < 4 hours: internal alert only
- SLA breach for 4–12 hours: customer notification via email
- SLA breach for > 12 hours: incident declared, follows Vol 5 doc 16 protocol

---

## Weekly Health Review

The Integration Strategist runs a 30-minute weekly review:

1. **Sync success rates per adapter** (target > 99.5%)
2. **Sync lag per tenant** (target within SLA)
3. **Conflict queue depth** (target < 20 per tenant)
4. **DLQ depth** (target < 10)
5. **Data quality scores** (trend, per tenant)
6. **Customer-reported integration issues** (count, resolution time)
7. **Preventive actions from postmortems** (open, overdue)

Findings feed the monthly integration reliability report to the ED and PM.

---

## AI-Assisted Integration Response

Claude Code assists integration on-call in three ways:

**Error log analysis during on-call**:
```
Analyze these {ADAPTER} error logs from the last 24 hours for tenant {TENANT}.
Categorize errors by root cause. Identify the top 3 fixable issues.
Suggest a specific action for each.
```

**Field mapping debugging**:
```
Given this raw EAM response JSON and our current CanonicalAsset mapping,
identify: fields present in the response but not mapped, fields mapped but
producing default values, and enum values not in our mapping table.
```

**Runbook generation from a novel incident**:
```
Given this incident postmortem, generate a runbook entry for the integration
runbook (following the template in vol-6-integration-strategy/18-integration-monitoring.md).
Include: detection signals, common causes, resolution steps, escalation path.
```

The human on-call reviews AI output and takes action. AI does not directly execute infrastructure changes or manipulate customer data.
