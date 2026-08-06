# Runbook: Database migration (EF Core in prod)

> Version: `v0.1 — 2026-07-23` • Owner: Backend / Platform • Reviewed: `2026-07-23`

How to write, ship, and (if needed) unstick EF Core migrations in production. This is the
single source of truth — reference it from `deploy.md` and `rollback.md`.

---

## Symptom

- You are writing a schema change and need to know the safe pattern.
- A production deploy is blocked on a migration one-shot Fargate task.
- A migration ran successfully but the app can't read the schema.
- The `__EFMigrationsHistory` table shows a migration in a half-applied state.

---

## Severity + expected TTR

- **Writing a migration:** not an incident. Process runbook.
- **Migration one-shot task hung / failed:** Severity `High`. TTR 30 min for hung task,
  60 min for failed task requiring rollback. Blocks all further deploys. Protects the
  "Write APIs" SLO (99.5%) and, if migrations are queued behind it, the deploy pipeline.
- **Migration lock held by dead session:** Severity `High`, TTR 15 min. Blocks the same
  paths.

---

## Preconditions

- You have `psql` and read access to the RDS instance (via bastion or IAM DB auth).
- You have `aws ecs` and `aws logs` access for the `maintain-migration` task family.
- For any destructive action (killing a Postgres session, forcing a lock release), the
  Incident Commander has approved.

---

## How migrations run in prod

**One-shot Fargate task before ECS service swap.** Every prod deploy that includes a new
migration triggers `run-ef-migration` as the first step in `deploy-prod`. The task:

1. Boots a runtime image identical to the app image, but with `ASPNETCORE_ENVIRONMENT`
   overridden to `Migration` (skips background services, HTTP endpoints).
2. Acquires the migration lock (see § "Migration lock table" below).
3. Runs `dotnet ef database update --project src/Aurigo.AssetMaintenance.Infrastructure
   --startup-project src/Aurigo.AssetMaintenance.Api`.
4. Releases the lock.
5. Exits 0 on success. ECS service update proceeds. Exits non-zero on failure. ECS
   service update is NOT triggered; the previous image keeps serving.

The task-def has a 15-minute stop-timeout. Migrations that legitimately need longer must
be broken into smaller migrations (see § "How to write a safe migration").

Existing migrations live in
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/Migrations/`.
As of this runbook's version there are 20+ migrations from Sprint 1 through Sprint 18a
including `20260526193335_InitialBaseline`, `20260602024816_AddAssetExtendedAttributes`,
and later.

---

## How to write a safe migration

**Never combine additive and destructive changes in the same migration.** Ship additive
first, deploy, then ship destructive as a second migration + second deploy.

### Additive-first, destructive-second pattern

Example: renaming `Asset.Name` to `Asset.DisplayName`.

**Migration 1 (additive):**
- Add new column `DisplayName` as nullable.
- Backfill `DisplayName = Name` in a data migration step (small tables — `< 10k rows`) or
  a separate job (large tables — see § "Backfilling large tables").
- Update application code to write to BOTH `Name` and `DisplayName` and read from
  `DisplayName ?? Name`.
- Deploy. Wait 24 hr. Verify no code path is writing only `Name`.

**Migration 2 (destructive):**
- Drop `Name`.
- Update application code to read/write only `DisplayName`.
- Deploy.

If Migration 2 fails, rollback is Tier 1 (image-only). If you had combined them into one
migration, rollback would be Tier 3 (with an unrehearsed reverse migration). This is
non-negotiable for any column the app actively reads or writes.

### Additive checklist (each item = safe)

- [ ] Add a new table.
- [ ] Add a new nullable column.
- [ ] Add a new column with a server-side default that all existing rows can adopt without
      re-write.
- [ ] Add a new index (with `CONCURRENTLY` for large tables — see below).
- [ ] Add a new enum value at the END of the enum (never in the middle — see
      `MEMORY.md → backend enum serialization`; enums serialize as ints unless the DTO
      explicitly types them as `string`).

### Destructive checklist (each item = requires additive-first predecessor)

- [ ] Drop a column.
- [ ] Drop a table.
- [ ] Rename a column or table.
- [ ] Tighten a nullable column to NOT NULL.
- [ ] Change a column's data type.
- [ ] Reorder enum values.
- [ ] Add a UNIQUE constraint to a column that may have duplicates.

### Backfilling large tables

For any table over ~100k rows, do NOT backfill in the EF migration. The one-shot task's
15-minute stop-timeout will kill it and leave the table half-migrated. Instead:

1. Ship the additive migration (new column, no backfill).
2. Ship a **background backfill job** that batches updates (e.g. 5k rows per transaction,
   with a delay between batches) and writes progress to a control table.
3. Once the backfill is 100% complete (verify via the control table), ship the
   application-code update that reads the new column.
4. Ship the destructive migration.

The `PublicDataImporter` in
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/PublicDataImporter.cs`
is the closest existing pattern for batched bulk work — model background backfills on it.

### `CREATE INDEX CONCURRENTLY`

EF's default `CreateIndex` uses a blocking `CREATE INDEX`. For a table over ~50k rows,
that will lock writes for the duration. Override in the migration:

```csharp
migrationBuilder.Sql(
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_assets_condition_rating ON assets (condition_rating);");
```

`CONCURRENTLY` cannot run inside a transaction. Set `SuppressTransaction = true` on the
migration's `Up` method, or split the index creation into its own migration.

---

## Migration lock table

Postgres `pg_advisory_lock` is used to prevent two migration one-shot tasks from running
simultaneously (e.g. if a redeploy is triggered before the first task finishes).

The lock:

- Is acquired with `SELECT pg_advisory_lock(hashtext('maintain-ef-migration'))` inside a
  session-level lock (auto-released on session end).
- Is held for the duration of the migration.
- Is checked via:
  ```
  SELECT pid, granted, mode, classid, objid FROM pg_locks
    WHERE locktype = 'advisory' AND objid = hashtext('maintain-ef-migration');
  ```

If a migration task's session dies mid-run (Fargate task killed, network partition), the
lock is released automatically by Postgres. If the session is still alive but stuck (see
§ "How to handle a hung migration"), the lock is still held and a new task will block.

---

## How to handle a hung migration

### Diagnosis

1. **Confirm the one-shot task is running (not exited).**
   ```
   aws ecs list-tasks --cluster maintain-prod --family maintain-migration \
     --desired-status RUNNING
   aws ecs describe-tasks --cluster maintain-prod --tasks <task-arn> \
     --query "tasks[0].{status:lastStatus,started:startedAt,stopped:stoppedAt}"
   ```
   - Expected: `status: RUNNING`, `started` recent, `stopped` null.
   - Failure: `status: STOPPED` → task exited; check exit code:
     `aws ecs describe-tasks ... --query "tasks[0].containers[0].{exit:exitCode,reason:reason}"`.
     If exit != 0, the migration failed — read the task logs and jump to
     `rollback.md § Decision flow`.

2. **Get the task's Postgres session PID.**
   ```
   psql "$RDS_URL" -c "SELECT pid, state, wait_event_type, wait_event, \
     substring(query, 1, 120) AS query, now() - query_start AS elapsed \
     FROM pg_stat_activity WHERE application_name LIKE '%efcore%' \
     ORDER BY query_start LIMIT 5;"
   ```
   - Expected: one row, `state: active`, `elapsed < 5 min` for typical DDL.
   - Failure: `wait_event: Lock`, `wait_event_type: Lock` → blocked by another session.
     Continue to step 3.
   - Failure: `elapsed > 15 min` and DDL still running → likely a table rewrite on a
     large table. See § "Backfilling large tables" — you shipped a migration that should
     have been split. Continue to step 4.

3. **If blocked by another session, find the blocker.**
   ```
   psql "$RDS_URL" -c "SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid, \
     substring(blocking.query, 1, 120) AS blocking_query, \
     now() - blocking.query_start AS blocker_elapsed \
     FROM pg_stat_activity blocked \
     JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid)) \
     WHERE blocked.wait_event_type = 'Lock';"
   ```
   - Common blockers: long-running report generation, an idle-in-transaction session
     (usually a debugging session someone forgot to close).
   - Fix: terminate the blocker if safe.
     ```
     psql "$RDS_URL" -c "SELECT pg_terminate_backend(<blocking_pid>);"
     ```
     Do NOT terminate a session that is actively running a customer transaction unless
     the Incident Commander explicitly approves.

4. **If the migration itself is doing a slow table rewrite, decide fast:**
   - If < 5 more minutes to task stop-timeout: let it finish, monitor.
   - If > 5 min remaining: cancel the deploy. Terminate the task cleanly:
     ```
     aws ecs stop-task --cluster maintain-prod --task <task-arn> \
       --reason "runbook: hung migration, splitting into smaller change"
     ```
     Then jump to `rollback.md § Tier 1` (the app-image never got promoted, so the current
     image is still serving — but ECS may retry the migration task per the deploy
     workflow; disable the deploy in GitHub Actions to stop the retry loop).

### Recovery — half-applied migration

If the task died mid-migration and `__EFMigrationsHistory` shows the migration as applied
but some of its statements didn't run:

1. Confirm state — compare `__EFMigrationsHistory` to the actual schema (`\d+ <table>` in
   psql) for the tables the migration touched.
2. If the migration is idempotent (uses `IF NOT EXISTS`, `IF EXISTS` clauses), delete the
   history row and re-run:
   ```
   psql "$RDS_URL" -c "DELETE FROM \"__EFMigrationsHistory\" \
     WHERE migration_id = '<migration_id>';"
   ```
   Then re-trigger the one-shot Fargate task.
3. If the migration is NOT idempotent, escalate to L4 (Engineering Manager). Manual
   forward-repair via psql, followed by inserting the history row, is a case-by-case
   judgement call.

---

## Post-incident actions

- [ ] If a migration hung, file a follow-up ticket to split the change per § "How to
      write a safe migration".
- [ ] If the lock table held after a dead session, verify Postgres auto-released. If not,
      file a Postgres tuning ticket — this indicates a networking / TCP-keepalive issue.
- [ ] Post-mortem if the migration caused a customer-visible outage (see
      `incident-response.md § Post-mortem`).
- [ ] Update this runbook if a diagnosis or recovery step was missing.

---

## Related runbooks

- [`deploy.md`](./deploy.md) — the deploy path that runs migrations.
- [`rollback.md`](./rollback.md) — decides which tier applies when a deploy with a
  migration goes bad.

## Related dashboards

- CloudWatch Log Group `/ecs/maintain-migration` (one-shot task output).
- CloudWatch `RDS Performance Insights` — active session load, wait events.
- Grafana `Deploys — last 24h` (deploy pipeline state).

## Related alerts

- `MigrationOneShotTaskFailed` (non-zero exit or timeout).
- `MigrationLockHeldOver10Min` (long-held advisory lock).
- `RDSLongRunningTransaction` (any session > 15 min in `active` state).

---

## Runbook feedback

Did this runbook help? Was a step wrong? Post in Slack `#runbook-feedback` with:

```
Runbook: db-migration.md
Version: v0.1 — 2026-07-23
Date used: YYYY-MM-DD
Migration involved: <migration_id>
What worked:
What was wrong or missing:
Severity of the incident:
Suggested edit (optional):
```
