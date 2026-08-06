# Capital-Needs Hygiene Audit — Aurigo Maintain

**Date:** 2026-07-23
**Branch:** primusmaintain-v2
**Auditor:** Business Analyst (W4.3 — "review the needs generated so far, is there anything sitting static from old scenarios?")
**Scope:** Every row of the `capital_needs` table across both local Postgres databases (Primus vertical demo + Masterworks vanilla). Read-only SELECTs; no writes, no schema changes, no code.

---

## 1. Executive Summary

**Audit execution status: BLOCKED — Postgres not reachable from this agent session.**

This agent runs with a read-only tool surface (Read / Grep / Glob / Write / Edit — no shell, no `psql`, no Docker CLI). The audit cannot execute the SELECTs against `localhost:5433` from within this session, and per the task ground rules ("If Postgres is not running... document the finding as 'audit blocked'... and produce the queries + schemas as static evidence anyway, with a note that the counts must be run manually"), this document ships the eight prepared queries + expected-result grids + recommended actions. A reviewer with `docker exec asset-maintenance-db psql ...` access can paste each `-- Query` block verbatim, capture the row counts, and back-fill Section 2's "Rows found" columns and the top-20 evidence tables.

**Databases to target (both on `localhost:5433`, user `aurigo` / password `aurigo`):**

| Branch | Database name (actual) | Task-brief name (aliased) | Notes |
|---|---|---|---|
| `primusmaintain-v2` (this branch) | `asset_maintenance_primus` | brief calls this "`_primus`" | 4 vertical demo tenants (DataCenter / LifeSciences / Manufacturing / Utilities) provisioned by `PrimusDemoSeeder` |
| `masterworksmaintain-v2` (peer worktree) | `asset_maintenance` | brief calls this "`asset_maintenance`" | Public-agency demo path (`DemoClientSeeder`) — 1 default tenant |

The task brief referred to the primus DB as "`_primus`" — the actual name is `asset_maintenance_primus` (see `seeds/init-extra-dbs.sh:8` and `appsettings.Development.json:18`). The masterworks name matches. Both DBs run inside the same `asset-maintenance-db` container; there is no separate container per branch.

**Anomaly-rule summary (counts to be filled by reviewer):**

| # | Rule | Primus rows | Masterworks rows | Verdict |
|---|---|---:|---:|---|
| 1 | Orphaned `PlannedActivityId` (dangling FK) | TBD | TBD | HIGH — no FK constraint exists, orphans are physically possible |
| 2 | Stale Draft > 30 days, never touched | TBD | TBD | MED — expected non-zero in demo (auto-surfacer runs nightly against never-triaged assets) |
| 3 | `Source = Manual` XOR `PlannedActivityId` mismatch | TBD | TBD | HIGH — definitionally impossible; any hit is a bug |
| 4 | Bundled with dangling `JobOrderId` | TBD | TBD | LOW-MED — FK is `SetNull` on delete, so 0 expected unless the delete predates the FK migration |
| 5 | Pushed but no `PushCharterUrl` | TBD | TBD | HIGH — indicates push handler wrote status without persisting URL (data-loss bug) |
| 6 | `PlanStatus != NotPushed` AND `PushStatus = NotPushed` | TBD | TBD | HIGH — impossible under the Sprint 18a authority model; poller wrote before the push landed |
| 7 | Distribution snapshot per tenant × Status × Source × PlanStatus | see § 2.7 | see § 2.7 | Snapshot; no verdict |
| 8 | Orphaned parent `Asset` (dangling AssetId) | TBD | TBD | LOW — FK constraint (`OnDelete(Restrict)`) should prevent; drift check only |

**Prior evidence this class of anomaly is real:** migration `20260703203925_RemoveOrphanCapitalNeeds` already had to delete pre-Sprint tenant-stamping duplicates (`TenantId = 00000000-…`). That migration is proof the anomaly class covered here has occurred at least once — this audit closes the loop by checking every remaining category.

---

## 2. Per-Anomaly Findings

Every SELECT below has been sanity-checked against the current entity + configuration in `Domain/Entities/CapitalNeed.cs` and `Persistence/Configurations/CapitalNeedConfiguration.cs`. All identifier casing matches the actual EF-generated schema (PascalCase columns, quoted; snake_case table names, unquoted — the CapitalNeeds config maps to `capital_needs` at line 11).

### 2.1 Orphaned scenario reference (PlannedActivityId points nowhere)

**Rule:** `capital_needs."PlannedActivityId" IS NOT NULL` AND (a) no `lcp_planned_activities` row with that Id OR (b) the parent `lcp_lifecycle_plans` row is gone OR (c) the grand-parent `lcp_scenarios` row is gone.

**Why this can happen:** `CapitalNeedConfiguration.cs:82` declares `PlannedActivityId` as a plain scalar property — there is **no `HasOne(...).HasForeignKey(x => x.PlannedActivityId)` and therefore no FK constraint at the database level**. The LCP cascade path is `LcpScenario → LifeCyclePlan (Cascade) → PlannedActivity (Cascade)`, so deleting a scenario cascades all the way down to `PlannedActivity` and orphans every CapitalNeed that referenced any activity in it. The LcpScenario also has a soft-delete flag (`IsDeleted`) but that only hides from list queries; hard-deleted scenarios (via `DELETE FROM lcp_scenarios ...`, migration cleanup, or admin action) cascade physically.

**Count query:**

```sql
-- Query 2.1a — count of orphaned PlannedActivityId references
SELECT COUNT(*) AS orphan_count
FROM capital_needs cn
WHERE cn."PlannedActivityId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lcp_planned_activities pa
    WHERE pa."Id" = cn."PlannedActivityId"
  );

-- Query 2.1b — count where the activity exists but its parent LCP is gone
SELECT COUNT(*) AS activity_orphan_of_plan
FROM capital_needs cn
JOIN lcp_planned_activities pa ON pa."Id" = cn."PlannedActivityId"
WHERE NOT EXISTS (
    SELECT 1 FROM lcp_lifecycle_plans p
    WHERE p."Id" = pa."LifeCyclePlanId"
  );

-- Query 2.1c — count where the LCP exists but its parent scenario is gone
SELECT COUNT(*) AS plan_orphan_of_scenario
FROM capital_needs cn
JOIN lcp_planned_activities pa ON pa."Id" = cn."PlannedActivityId"
JOIN lcp_lifecycle_plans p ON p."Id" = pa."LifeCyclePlanId"
WHERE p."ScenarioId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lcp_scenarios s
    WHERE s."Id" = p."ScenarioId"
  );

-- Query 2.1d — count where the LCP exists but its scenario is soft-deleted
SELECT COUNT(*) AS plan_from_soft_deleted_scenario
FROM capital_needs cn
JOIN lcp_planned_activities pa ON pa."Id" = cn."PlannedActivityId"
JOIN lcp_lifecycle_plans p ON p."Id" = pa."LifeCyclePlanId"
JOIN lcp_scenarios s ON s."Id" = p."ScenarioId"
WHERE s."IsDeleted" = TRUE;
```

**First-20 evidence query (union of a + b + c + d):**

```sql
-- Query 2.1e — first 20 offenders, unioned by anomaly sub-type
SELECT cn."TenantId", cn."Id" AS need_id, cn."AssetId",
       cn."PlannedActivityId", cn."Status", cn."CreatedAt", '2.1a_hard_orphan' AS reason
FROM capital_needs cn
WHERE cn."PlannedActivityId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM lcp_planned_activities pa WHERE pa."Id" = cn."PlannedActivityId")
UNION ALL
SELECT cn."TenantId", cn."Id", cn."AssetId", cn."PlannedActivityId",
       cn."Status", cn."CreatedAt", '2.1b_plan_gone'
FROM capital_needs cn
JOIN lcp_planned_activities pa ON pa."Id" = cn."PlannedActivityId"
WHERE NOT EXISTS (SELECT 1 FROM lcp_lifecycle_plans p WHERE p."Id" = pa."LifeCyclePlanId")
UNION ALL
SELECT cn."TenantId", cn."Id", cn."AssetId", cn."PlannedActivityId",
       cn."Status", cn."CreatedAt", '2.1c_scenario_gone'
FROM capital_needs cn
JOIN lcp_planned_activities pa ON pa."Id" = cn."PlannedActivityId"
JOIN lcp_lifecycle_plans p ON p."Id" = pa."LifeCyclePlanId"
WHERE p."ScenarioId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM lcp_scenarios s WHERE s."Id" = p."ScenarioId")
UNION ALL
SELECT cn."TenantId", cn."Id", cn."AssetId", cn."PlannedActivityId",
       cn."Status", cn."CreatedAt", '2.1d_scenario_soft_deleted'
FROM capital_needs cn
JOIN lcp_planned_activities pa ON pa."Id" = cn."PlannedActivityId"
JOIN lcp_lifecycle_plans p ON p."Id" = pa."LifeCyclePlanId"
JOIN lcp_scenarios s ON s."Id" = p."ScenarioId"
WHERE s."IsDeleted" = TRUE
LIMIT 20;
```

**Rows found (both DBs):** TBD — reviewer to run and populate.

**Recommended action:**
- Sub-rule (a) hard orphan: **clear the pointer** — `UPDATE capital_needs SET "PlannedActivityId" = NULL WHERE ...`. This is non-destructive (the need itself is preserved; only the dangling LCP link is severed). Also clear `TreatmentTypeId` for the same rows to keep the pair consistent.
- Sub-rule (b) plan-gone: same treatment — clear the pointer. Investigate: the activity should have cascaded when the plan was deleted, so if we find (b) hits it means an activity row is itself an orphan and needs a matching cleanup.
- Sub-rule (c) scenario-gone: same treatment — clear the pointer.
- Sub-rule (d) soft-deleted scenario: **do not clear** — the scenario data still exists, the tenant can un-archive. Instead surface a UI badge "LCP scenario archived" on the need and let the planner decide.
- **All destructive `UPDATE` statements require product-manager signoff** before execution.

---

### 2.2 Stale Draft from old auto-surfacer runs

**Rule:** `Status = Draft (0)` AND `CreatedAt < NOW() - INTERVAL '30 days'` AND `UpdatedAt = CreatedAt` (untouched since creation) AND `Source = Maintain (0)` (auto-surfaced, not manual). Excludes `Source = Manual` because a manual draft that sits for 30 days may still be legitimate WIP.

**Why this can happen:** `CapitalNeedAutoSurfacerService` runs every 24 h at 02:00 UTC and creates a `Draft` need for every asset with `RUL < 2 yr` OR `RiskBand = Critical` that does not already have an open need. If a planner never triages the asset (never confirms, bundles, or closes), that Draft persists indefinitely. Over a demo lifespan of weeks that is expected volume; after 30 days it is stale data that pollutes the "capital pipeline" dashboard.

**Count query:**

```sql
-- Query 2.2 — stale auto-surfaced Drafts (> 30d, never touched)
SELECT COUNT(*) AS stale_draft_count
FROM capital_needs
WHERE "Status" = 0                                -- Draft
  AND "Source" = 0                                -- Maintain (auto-surfaced)
  AND "CreatedAt" < (NOW() AT TIME ZONE 'utc') - INTERVAL '30 days'
  AND "UpdatedAt" = "CreatedAt";                  -- Untouched
```

**First-20 evidence query:**

```sql
-- Query 2.2b — first 20 stale drafts, oldest first
SELECT "TenantId", "Id", "AssetId", "TriggerType", "EstimatedCost",
       "CreatedAt", (NOW() AT TIME ZONE 'utc' - "CreatedAt") AS age
FROM capital_needs
WHERE "Status" = 0 AND "Source" = 0
  AND "CreatedAt" < (NOW() AT TIME ZONE 'utc') - INTERVAL '30 days'
  AND "UpdatedAt" = "CreatedAt"
ORDER BY "CreatedAt" ASC
LIMIT 20;
```

**Rows found (both DBs):** TBD.

**Recommended action:**
- **Product-decision required (do not act without PM signoff):** hard-delete vs. soft-close vs. leave. Recommended path: introduce a new `CapitalNeedStatus.AutoStale` value; a nightly sweep transitions any Draft matching the rule above to AutoStale. That keeps the row for audit + surfacer-decision history while removing it from the active pipeline. Trigger of new surfacer run then re-creates a fresh Draft if the asset still breaches.
- Alternate cheap path: filter the pipeline view to `CreatedAt > NOW() - 60 days` client-side. No data change; user gets an implicit sunset. This is the **recommended MVP path** — no PM approval needed, no data loss.

---

### 2.3 Inconsistent `Source` vs `PlannedActivityId`

**Rule:** `Source = Manual (2)` AND `PlannedActivityId IS NOT NULL` — OR — `Source = Maintain (0)` AND `PlannedActivityId IS NOT NULL` (the LCP engine sets this pair together; Maintain-source needs should not have a PlannedActivityId unless the LCP engine wrote them). The CapitalNeed.cs comment at line 18 pins the invariant: "Set by LCP engine; null for manually-created needs".

**Count query:**

```sql
-- Query 2.3a — Manual source with a scenario link (impossible)
SELECT COUNT(*) AS manual_with_planned_activity
FROM capital_needs
WHERE "Source" = 2                                -- Manual
  AND "PlannedActivityId" IS NOT NULL;

-- Query 2.3b — Manual source with a TreatmentTypeId (impossible — same invariant)
SELECT COUNT(*) AS manual_with_treatment
FROM capital_needs
WHERE "Source" = 2
  AND "TreatmentTypeId" IS NOT NULL;

-- Query 2.3c — Auto-surfaced (Maintain) with a PlannedActivityId (unexpected —
-- the surfacer at CapitalNeedAutoSurfacerService.cs:148-158 never sets this;
-- only the LCP engine (Source = EssentialsPlan? or an unlabelled internal
-- source) sets it. Flag any Maintain-source hit for review.)
SELECT COUNT(*) AS maintain_source_with_planned_activity
FROM capital_needs
WHERE "Source" = 0
  AND "PlannedActivityId" IS NOT NULL;
```

**First-20 evidence query:**

```sql
-- Query 2.3d — first 20 inconsistent rows, all 3 sub-rules
SELECT "TenantId", "Id", "AssetId", "Source", "PlannedActivityId",
       "TreatmentTypeId", "CreatedAt", "UpdatedBy",
       CASE
         WHEN "Source" = 2 AND "PlannedActivityId" IS NOT NULL THEN '2.3a_manual_has_activity'
         WHEN "Source" = 2 AND "TreatmentTypeId" IS NOT NULL THEN '2.3b_manual_has_treatment'
         WHEN "Source" = 0 AND "PlannedActivityId" IS NOT NULL THEN '2.3c_maintain_has_activity'
       END AS anomaly
FROM capital_needs
WHERE ("Source" = 2 AND ("PlannedActivityId" IS NOT NULL OR "TreatmentTypeId" IS NOT NULL))
   OR ("Source" = 0 AND "PlannedActivityId" IS NOT NULL)
ORDER BY "CreatedAt" DESC
LIMIT 20;
```

**Rows found (both DBs):** TBD.

**Recommended action:**
- 2.3a / 2.3b: **fix by hand-migration + write a CHECK constraint.** These are bugs; a Manual-source row cannot semantically own a PlannedActivity link. Two-step fix: (i) hand-clear the two fields for affected rows (`UPDATE capital_needs SET "PlannedActivityId" = NULL, "TreatmentTypeId" = NULL WHERE "Source" = 2`); (ii) add DB CHECK constraint (see § 4). Step (i) requires **product-manager signoff** since it edits user-created rows.
- 2.3c: **investigate before acting.** May indicate an old LCP-adoption path that stamped `Source = Maintain` instead of `EssentialsPlan` when copying an LCP activity into a new need. Read the audit-log rows for the `UpdatedBy` user to understand which handler wrote them.

---

### 2.4 Bundled but JobOrder deleted

**Rule:** `Status = Bundled (2)` AND `JobOrderId IS NOT NULL` AND the referenced `job_orders."Id"` no longer exists.

**Why this should be rare:** `CapitalNeedConfiguration.cs:87–88` declares `.HasOne(x => x.JobOrder).WithMany(j => j.Needs).HasForeignKey(x => x.JobOrderId).OnDelete(DeleteBehavior.SetNull)`. So on a normal EF-driven delete the FK is nulled. Physical orphans can still arise from (a) raw SQL deletes bypassing EF, (b) deletes before this cascade rule was in place, (c) cross-database restore mismatches. Also flag the paired inconsistency: `Status = Bundled` AND `JobOrderId IS NULL` (should be impossible by domain rule — a Bundled need was bundled *into* something).

**Count query:**

```sql
-- Query 2.4a — Bundled with dangling JobOrderId
SELECT COUNT(*) AS bundled_dangling_joborder
FROM capital_needs cn
WHERE cn."Status" = 2                             -- Bundled
  AND cn."JobOrderId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM job_orders j WHERE j."Id" = cn."JobOrderId"
  );

-- Query 2.4b — Bundled with NULL JobOrderId (SetNull ran but Status wasn't reverted)
SELECT COUNT(*) AS bundled_null_joborder
FROM capital_needs
WHERE "Status" = 2 AND "JobOrderId" IS NULL;
```

**First-20 evidence query:**

```sql
-- Query 2.4c — first 20 offenders
SELECT cn."TenantId", cn."Id", cn."AssetId", cn."Status", cn."JobOrderId",
       cn."CreatedAt", cn."UpdatedAt",
       CASE
         WHEN cn."JobOrderId" IS NULL THEN '2.4b_bundled_null_jo'
         ELSE '2.4a_bundled_dangling'
       END AS anomaly
FROM capital_needs cn
WHERE cn."Status" = 2
  AND (cn."JobOrderId" IS NULL
       OR NOT EXISTS (SELECT 1 FROM job_orders j WHERE j."Id" = cn."JobOrderId"))
LIMIT 20;
```

**Rows found (both DBs):** TBD.

**Recommended action:**
- 2.4a: transition back to `Confirmed` (Status = 1) and null the `JobOrderId`. Non-destructive. The planner then decides to re-bundle or close. Requires **PM signoff** because the status transition is user-visible.
- 2.4b: mirror action — flip Status to `Confirmed`. Add a DB-level CHECK constraint: `CHECK ("Status" != 2 OR "JobOrderId" IS NOT NULL)`. See § 4.

---

### 2.5 Pushed but no CharterUrl

**Rule:** `PushStatus = Pushed (1)` AND `PushCharterUrl IS NULL`.

**Why this matters:** the URL is the only thing the UI needs to render the "Open in Aurigo Plan" chip. A Pushed row with no URL means the handler updated the status but didn't persist the URL — the planner sees a green success badge with no link, or worse, believes the push completed while the charter is unreachable.

**Count query:**

```sql
-- Query 2.5a — Pushed but URL missing
SELECT COUNT(*) AS pushed_no_url
FROM capital_needs
WHERE "PushStatus" = 1
  AND "PushCharterUrl" IS NULL;

-- Query 2.5b — PartiallyPushed but URL missing (same class of bug — the POST
-- leg succeeded but URL wasn't persisted; PATCH-retry cannot proceed)
SELECT COUNT(*) AS partial_no_url
FROM capital_needs
WHERE "PushStatus" = 3
  AND "PushCharterUrl" IS NULL;

-- Query 2.5c — cross-check: PushedAtUtc set but URL null
SELECT COUNT(*) AS pushed_ts_no_url
FROM capital_needs
WHERE "PushedAtUtc" IS NOT NULL
  AND "PushCharterUrl" IS NULL;
```

**First-20 evidence query:**

```sql
-- Query 2.5d — first 20 offenders across all 3 sub-rules
SELECT "TenantId", "Id", "AssetId", "PushStatus", "PushedAtUtc",
       "PushedByUserId", "LastPushAttemptAtUtc", "LastPushError"
FROM capital_needs
WHERE ("PushStatus" IN (1, 3) AND "PushCharterUrl" IS NULL)
   OR ("PushedAtUtc" IS NOT NULL AND "PushCharterUrl" IS NULL)
ORDER BY "PushedAtUtc" DESC
LIMIT 20;
```

**Rows found (both DBs):** TBD.

**Recommended action:**
- If count > 0: **push-handler bug — do not attempt hand-fix**. Investigate `CapitalNeedHandlers.cs` PushToPlan path + the Aurigo Plan client response mapping. Likely root cause: response body parse failure that swallowed the URL while the `PushStatus` write already committed (transaction ordering). File under `sprint-planner` for a hotfix + regression test.
- Do NOT hand-populate the URL; if the record has no URL the charter may not actually exist in Plan (partial write on the Plan side too). Instead flip `PushStatus` back to `PushFailed (2)` for the affected rows so the retry path re-drives the POST leg cleanly. Requires **PM signoff** because it triggers user-visible retry attempts.

---

### 2.6 PlanStatus set but PushStatus not

**Rule:** `PlanStatus != NotPushed (0)` AND `PushStatus = NotPushed (0)`.

**Why this is impossible under the Sprint 18a authority model:** the `AurigoPlanStatusPollingWorker` only polls charters that have already been pushed. `PlanStatus` transitions from `NotPushed` require a Plan-side charter to exist, which requires a `PushCharterUrl`, which requires `PushStatus = Pushed`. Any row violating this ordering means the poller mutated a record it shouldn't have touched — either the poller iterates un-pushed records (bug in worker filter) or a manual DB edit skipped the push.

**Count query:**

```sql
-- Query 2.6a — PlanStatus advanced without a push
SELECT COUNT(*) AS planstatus_without_push
FROM capital_needs
WHERE "PlanStatus" != 0                           -- NotPushed
  AND "PushStatus" = 0;                           -- NotPushed

-- Query 2.6b — LastPlanStatusCheckUtc set but never pushed
SELECT COUNT(*) AS polled_without_push
FROM capital_needs
WHERE "LastPlanStatusCheckUtc" IS NOT NULL
  AND "PushStatus" = 0;

-- Query 2.6c — HasPlanConflict = true but never pushed (definitionally impossible)
SELECT COUNT(*) AS conflict_without_push
FROM capital_needs
WHERE "HasPlanConflict" = TRUE
  AND "PushStatus" = 0;
```

**First-20 evidence query:**

```sql
-- Query 2.6d — first 20 offenders
SELECT "TenantId", "Id", "AssetId", "PushStatus", "PlanStatus",
       "LastPlanStatusCheckUtc", "HasPlanConflict", "PlanConflictReason"
FROM capital_needs
WHERE ("PlanStatus" != 0 AND "PushStatus" = 0)
   OR ("LastPlanStatusCheckUtc" IS NOT NULL AND "PushStatus" = 0)
   OR ("HasPlanConflict" = TRUE AND "PushStatus" = 0)
LIMIT 20;
```

**Rows found (both DBs):** TBD.

**Note on migration-back-fill:** the `CapitalNeedPlanStatus` enum comment mentions "migration back-fills `Draft` for rows where `PushStatus` is already `Pushed`". If a demo tenant was seeded with `PushStatus = Pushed` for demo purposes, they will have `PlanStatus = Draft (1)` legitimately. Only hits where `PushStatus = NotPushed` are true anomalies — the query above filters correctly.

**Recommended action:**
- If count > 0: **poller-filter bug**. Read `AurigoPlanStatusPollingWorker.cs` and confirm the worker's WHERE clause includes `PushStatus = Pushed` (should — but the audit exists precisely to prove it). Hand-migrate anomalous rows: `UPDATE ... SET "PlanStatus" = 0, "LastPlanStatusCheckUtc" = NULL, "HasPlanConflict" = FALSE, "PlanConflictReason" = NULL`. Requires **PM signoff** for the UPDATE.

---

### 2.7 Distribution snapshot

**Rule:** none — this is a sanity check on total data volume. If total row counts differ wildly from what the product owner expects, the audit itself is malformed (e.g. wrong tenant scope in the JWT that generated the seed).

**Count queries:**

```sql
-- Query 2.7a — grand totals per DB
SELECT COUNT(*) AS total_needs,
       COUNT(DISTINCT "TenantId") AS distinct_tenants,
       COUNT(DISTINCT "AssetId") AS distinct_assets
FROM capital_needs;

-- Query 2.7b — per tenant
SELECT "TenantId", COUNT(*) AS need_count
FROM capital_needs
GROUP BY "TenantId"
ORDER BY need_count DESC;

-- Query 2.7c — per Status (Draft=0, Confirmed=1, Bundled=2, Closed=3)
SELECT "Status", COUNT(*) AS c
FROM capital_needs
GROUP BY "Status"
ORDER BY "Status";

-- Query 2.7d — per Source (Maintain=0, EssentialsPlan=1, Manual=2)
SELECT "Source", COUNT(*) AS c
FROM capital_needs
GROUP BY "Source"
ORDER BY "Source";

-- Query 2.7e — per PlanStatus (NotPushed=0, Draft=1, Approved=2, Rejected=3, OnHold=4, Cancelled=5, Delivered=6)
SELECT "PlanStatus", COUNT(*) AS c
FROM capital_needs
GROUP BY "PlanStatus"
ORDER BY "PlanStatus";

-- Query 2.7f — 3-way pivot: Tenant × Status × Source
SELECT "TenantId", "Status", "Source", COUNT(*) AS c
FROM capital_needs
GROUP BY "TenantId", "Status", "Source"
ORDER BY "TenantId", "Status", "Source";
```

**Results (both DBs):** TBD.

**Recommended action:** none — snapshot only. Any surprises (a tenant with 0 needs, a tenant with 10× more than any other, `Source = 1 EssentialsPlan` populated when the Plan integration is stubbed) is a discovery item to raise with the product-manager rather than a data-cleanup task.

---

### 2.8 Orphaned parent Asset

**Rule:** `capital_needs."AssetId"` does not resolve to any row in `assets."Id"`.

**Why this should be impossible:** `CapitalNeedConfiguration.cs:84–85` declares `.HasOne(x => x.Asset).WithMany().HasForeignKey(x => x.AssetId).OnDelete(DeleteBehavior.Restrict)` — deleting an asset with active needs is a database-level failure. This check is a drift audit against raw-SQL deletes or restore-mismatch scenarios.

**Count query:**

```sql
-- Query 2.8 — orphaned AssetId (should always be 0 given the FK)
SELECT COUNT(*) AS orphan_asset_count
FROM capital_needs cn
WHERE NOT EXISTS (
    SELECT 1 FROM assets a WHERE a."Id" = cn."AssetId"
  );
```

**First-20 evidence query:**

```sql
-- Query 2.8b — first 20 offenders
SELECT cn."TenantId", cn."Id", cn."AssetId", cn."Source", cn."Status",
       cn."CreatedAt"
FROM capital_needs cn
WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a."Id" = cn."AssetId")
LIMIT 20;
```

**Also verify the tenant-mismatch case** (asset exists but belongs to a different tenant — should also be impossible under the global query filter, but the audit ignores query filters via raw SQL):

```sql
-- Query 2.8c — need's TenantId does not match parent asset's TenantId
SELECT COUNT(*) AS cross_tenant_asset_ref
FROM capital_needs cn
JOIN assets a ON a."Id" = cn."AssetId"
WHERE cn."TenantId" != a."TenantId";
```

**Rows found (both DBs):** TBD (expected 0 for both queries).

**Recommended action:**
- 2.8: if non-zero, escalate as a **critical data-integrity incident**. Do not touch — capture the offending IDs, take a DB snapshot, and hand off to `platform-engineer` for restore-source investigation.
- 2.8c: if non-zero, this is a tenant-isolation breach — file under the same protocol as `17-tenant-isolation-audit.md`. **Do not proceed with cleanup without security-review signoff.**

---

## 3. Cleanup Plan

Sequence assumes counts have been captured; every step is gated on the count being > 0 for that rule. Total pessimistic effort is 3–5 days of engineering + 0.5 day of PM alignment + 0.5 day of soak-test observation.

| Step | Rule | Action | Effort | Approval gate |
|---|---|---|---:|---|
| 1 | Pre-flight | `pg_dump` both DBs to a timestamped backup before any DDL/DML | 0.5 h | Platform-engineer |
| 2 | 2.8 / 2.8c | Investigate orphaned-asset hits (should be 0; if not, halt everything) | 2 h | — |
| 3 | 2.5 | Investigate push-handler URL-loss root cause; fix the write path; add regression test | 1 d | — |
| 4 | 2.6 | Audit `AurigoPlanStatusPollingWorker` WHERE-clause + hand-migrate anomalous rows | 0.5 d | **PM (UPDATE user-visible rows)** |
| 5 | 2.3 | Hand-migrate manual-source rows with dangling LCP fields; add CHECK constraint | 0.5 d | **PM (edits user-created rows)** |
| 6 | 2.1 | Null the dangling PlannedActivityId/TreatmentTypeId pointers per sub-rule | 0.5 d | **PM (severs LCP links)** |
| 7 | 2.4 | Flip 2.4a/2.4b Bundled rows back to Confirmed; add CHECK constraint | 0.5 d | **PM (visible status change)** |
| 8 | 2.2 | Ship the "hide drafts older than 60 d" UI filter (**MVP path — no data change**) | 0.5 d | — |
| 8-alt | 2.2 | Add `CapitalNeedStatus.AutoStale` value + nightly sweep + entity migration | 2 d | **PM (new enum value; UX change)** |
| 9 | All | Re-run § 2 queries; confirm all anomaly counts are 0 (except 2.2 which is by-design non-zero) | 1 h | — |
| 10 | All | Update `capital-needs-hygiene-audit.md` with post-cleanup counts + close ticket | 0.5 h | — |

**Actions explicitly requiring product-manager signoff before execution:** steps 4, 5, 6, 7, 8-alt. Every UPDATE that changes a user-visible field (`Status`, `PlanStatus`, `PushStatus`, `PlannedActivityId`) mutates something the tenant may have deliberately created; the BA does not have authority to hand-migrate these rows unilaterally (see § "Authority" in `vol-4-ai-organization/11-business-analyst.md`).

---

## 4. Data-Integrity Recommendations (Preventive)

These are schema changes that would make the recurrence of each anomaly class either impossible or immediately visible via a constraint violation. Every recommendation is a proposed EF Core migration — actual authoring is out of BA scope but the shape is captured here so `platform-engineer` can pick it up directly.

| # | Rule addressed | Proposed constraint | Why it works |
|---|---|---|---|
| A | 2.1 | Add real `HasOne(x => x.PlannedActivity).WithMany().HasForeignKey(x => x.PlannedActivityId).OnDelete(SetNull)` in `CapitalNeedConfiguration.cs` | Turns hard orphans into automatic NULL — the LCP-scenario delete cascade already exists; wiring the CapitalNeed FK completes the chain. Complements the existing `JobOrderId` SetNull pattern. |
| B | 2.3 | DB CHECK: `CHECK ("Source" != 2 OR ("PlannedActivityId" IS NULL AND "TreatmentTypeId" IS NULL))` | Postgres refuses the INSERT/UPDATE at the DB layer. Belt-and-braces vs. the FluentValidation guard. |
| C | 2.4b | DB CHECK: `CHECK ("Status" != 2 OR "JobOrderId" IS NOT NULL)` | Enforces the "Bundled → must have JobOrder" domain invariant at the DB. |
| D | 2.5 | DB CHECK: `CHECK ("PushStatus" NOT IN (1, 3) OR "PushCharterUrl" IS NOT NULL)` | Blocks the "Pushed / PartiallyPushed with no URL" state at write time. Requires backfill of existing offenders (step 3 above) before the migration will apply. |
| E | 2.6 | DB CHECK: `CHECK ("PlanStatus" = 0 OR "PushStatus" != 0)` | Enforces the Sprint 18a ordering: PlanStatus can only advance beyond NotPushed if PushStatus has advanced beyond NotPushed. |
| F | 2.2 | New enum value `CapitalNeedStatus.AutoStale = 4` + `Application/BackgroundServices/StaleDraftSweeper` background job | Bounds the pipeline surface area; every stale row auto-transitions into a hidden bucket that still preserves history for audit. |
| G | 2.8c | Add tenant-mismatch trigger: `CREATE TRIGGER trg_capital_need_tenant_match BEFORE INSERT OR UPDATE ON capital_needs EXECUTE FUNCTION assert_asset_tenant_match()` | Belt-and-braces against a raw-SQL cross-tenant write. Complements the EF global query filter. |

Ordering note: constraints B / C / D / E must be added **after** the corresponding cleanup UPDATEs in § 3 — otherwise the migration will fail on existing offenders.

---

## 5. Cross-References

- Adjacent audit: [`vol-3-architecture/18-tamp-data-purity-audit.md`](18-tamp-data-purity-audit.md) — 65-field TAMP report purity assessment (same review cycle).
- Adjacent audit: [`vol-3-architecture/17-tenant-isolation-audit.md`](17-tenant-isolation-audit.md) — cross-tenant IDOR + tenant-scope review. Rule 2.8c above overlaps with the isolation audit's scope.
- Adjacent audit: [`vol-3-architecture/19-tamp-audit-bugs-pm-review.md`](19-tamp-audit-bugs-pm-review.md) — PM-decision framing template used as the model for § 3's approval-gate column.
- Domain doc: [`vol-2-product-knowledge/domains/capital-planning.md`](../vol-2-product-knowledge/domains/capital-planning.md) — the domain the audit protects.
- Entity: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/CapitalNeed.cs` — 119-line entity with the invariants this audit tests.
- Config: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/Configurations/CapitalNeedConfiguration.cs` — EF configuration with the FK definitions (or lack thereof — see rule 2.1).
- Prior cleanup: `backend/.../Migrations/20260703203925_RemoveOrphanCapitalNeeds.cs` — precedent for a one-shot data-fix migration (deleted pre-tenant-stamping duplicates).
- Auto-surfacer: `backend/.../Application/Calculations/CapitalNeedAutoSurfacer.cs` + `Infrastructure/BackgroundServices/CapitalNeedAutoSurfacerService.cs` — the source of the Draft-source rows targeted by rule 2.2.

---

## Actual Counts — 2026-07-23 (populated by foreground SQL pass)

**Both Postgres DBs reachable.** Docker container `asset-maintenance-db` up 22h healthy.

| Rule | Primus (`asset_maintenance_primus`) | Masterworks (`asset_maintenance`) |
|---|---|---|
| Total CapitalNeed rows | **75** | **52** |
| Status: Draft / Confirmed / Bundled / Closed | 62 / 6 / 7 / 0 | 45 / 2 / 4 / 1 |
| Rule 1: orphan `PlannedActivityId` | 0 | 0 |
| Rule 2: stale Draft (>30 days untouched) | 0 | 0 |
| **Rule 3: `Source=Manual` AND `PlannedActivityId IS NOT NULL`** | **2** | **0** |
| Rule 4: `Bundled` with orphan JobOrder | 0 | 0 |
| Rule 5: `Pushed` but no `PushCharterUrl` | 0 | 0 |
| Rule 6: `PlanStatus` > 0 while `PushStatus = 0` | 0 | 0 |

Actual data is **dramatically cleaner** than the BA's schema-analysis fear-case suggested. The 3-5-day cleanup estimate assumed the worst; the real cleanup is closer to **0.5 day**.

### The 2 Rule-3 offenders (primus, both from July 19 demo seed)

| Id | Asset | Notes |
|---|---|---|
| `02e07ed2-…` | `d938edbf-…` | "Pump station Unit 2 impeller wear confirmed. Impeller replacement plus VFD installation…" |
| `f39b1a09-…` | `8273056e-…` | "HPLC system approaching end of OEM support. Technology refresh to Waters Arc HPLC…" |

Both `Status=Draft`, both created 2026-07-19 03:12 UTC. Root cause: the primus demo seeder wrote `Source=Manual` while also linking to a `PlannedActivityId` — inconsistent per `CapitalNeed.cs:18` ("Set by LCP engine; null for manually-created needs"). Either the seeder should mark them `Source=Maintain` (auto-surfaced) OR clear `PlannedActivityId` on Manual writes.

### Fix recommendation (0.5 day)

1. **Data cleanup (5 min)** — one UPDATE flipping the 2 rows to `Source=Maintain` (safer than nulling `PlannedActivityId` which loses the link). No PM signoff needed — demo data, no customer.
2. **Seeder fix (30 min)** — grep `PrimusDemoSeeder.cs` for the offending code path and align it with the entity invariant.
3. **Defensive DB constraint (60 min)** — add a `CHECK` constraint `NOT (Source = 2 AND PlannedActivityId IS NOT NULL)` in a follow-up migration. Prevents recurrence structurally.
4. **Optional FK constraint on `PlannedActivityId`** (60 min) — the BA flagged this as a physical-possibility for orphans; no orphans exist today, but a `ON DELETE SET NULL` FK would prevent future drift.

Related BA findings (unchanged, from static review): Sprint 18a poller ordering + Manual-source invariant have no DB-level enforcement — both consistent-in-data-today but structurally weak.
