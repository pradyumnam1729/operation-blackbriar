# Runbook: Rollback a bad deploy

> Version: `v0.1 — 2026-07-23` • Owner: Platform / Release Engineering • Reviewed: `2026-07-23`

Three tiers of rollback. Choose the tier from the decision flow, then follow only that
tier's steps. Do not mix.

---

## Symptom

The deploy you just shipped (or one shipped in the last 24 hr) is causing customer-visible
problems. Common triggers:

- 5xx spike, latency spike, or SLO burn alert firing within 1 hr of the deploy.
- Playwright smoke suite red on staging or prod.
- Customer report + Grafana confirms regression (e.g. TAMP publish now returns 500 for
  every tenant).
- Data corruption suspected (rare — jump straight to `incident-response.md § Security-
  flavored incidents` because "corruption suspected" is a data-loss-risk incident).

---

## Severity + expected TTR

- `High` by default. TTR target: 30 min for Tier 1 (frontend/image-only), 60 min for
  Tier 2 (with additive migration kept), up to 4 hr for Tier 3 (with reverse migration).
- `Critical` if the deploy is causing login failures or > 25% tenant impact — reduce TTR
  targets accordingly and pull L3 (Incident Commander) in immediately.
- Protects the "Write APIs" SLO (99.5%) and, if applicable, "Login + JWT refresh" SLO
  (99.9%).

---

## Preconditions

- The incident channel is open (`incident-response.md § Open the channel`).
- Incident Commander is assigned.
- You have the previous known-good release tag written down. Get it via:
  ```
  gh release list --limit 5
  ```
  or from the GitHub Environments `prod` deployment history.
- You have identified whether the bad deploy included an EF migration:
  ```
  git log --oneline PREV_TAG..CURRENT_TAG -- \
    'backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/Migrations/'
  ```
  - No output → no migration → Tier 1.
  - Migration files listed → open each one and check whether it is additive-only. See
    § "Decision flow" below.

---

## Decision flow

```
    Did the bad deploy include an EF migration?
    │
    ├── No  ────────────────────────────────►  Tier 1: Frontend / image-only rollback
    │
    └── Yes
        │
        ├── Additive-only  ─────────────────►  Tier 2: Image rollback, keep migration
        │   (new tables, new nullable columns,
        │    new indexes, new enum values —
        │    old code tolerates them)
        │
        └── Destructive / breaking  ────────►  Tier 3: Image rollback + reverse migration
            (dropped tables/columns,               (ONLY if a tested down-migration exists;
             renamed columns, tightened NOT NULL,   otherwise roll FORWARD with a hotfix)
             changed data types, backfills)
```

**Rule of thumb for "additive-only":** if the previous code version can hit the migrated
schema and return 200 for every path the smoke suite covers, it's additive. If you're not
sure, treat as destructive.

---

## Tier 1 — Frontend / image-only rollback (no DB change)

Fastest tier. Use when the change was purely code — no migration, or the migration is
unrelated to the regression.

1. **Find the previous release tag.**
   ```
   gh release list --limit 5
   ```
   Note the tag one version before current. Example: current `v2026.07.23-rc2`, previous
   `v2026.07.22-rc1`.

2. **Trigger the `deploy-prod` workflow with the previous tag.**
   - GitHub → Actions → `deploy-prod` → `Run workflow` → select previous tag.
   - Approver approves in the `prod` environment page.
   - CodeDeploy blue-greens the old image back in.

3. **Watch:**
   - Grafana `HTTP 5xx by service` — 5xx rate should drop to baseline within 5 min of
     traffic shift starting.
   - Grafana `ALB target-group healthy hosts` — old-image tasks reach desired count.

4. **Verify:**
   ```
   curl -sf https://maintain.aurigo.net/health/ready
   curl -sf https://maintain.aurigo.net/api/v1/version
   ```
   - Expected: `version` == previous tag, `ready` all-green.

5. **Rollback if step fails:** if the old image also fails its health check, the DB is
   the suspect. Move to Tier 3, and page L4 (Engineering Manager) — you have a corrupt DB
   or a mis-diagnosed decision-flow branch.

**Verification:** run the Playwright smoke suite against prod.
```
cd frontend/asset-maintenance-web && npm run e2e -- --config=playwright.prod-smoke.config.ts
```
Expected: 10/10 green.

---

## Tier 2 — Backend rollback with data-compatible migration

Use when the deploy included an additive-only migration and the regression is in the
application code, not the schema change.

The migration STAYS applied. The old image is rolled back on top of the migrated schema.

1. Do steps 1–4 of Tier 1 (revert the image).

2. **Verify the old image tolerates the new schema.**
   - Run the Playwright smoke suite against prod (see Tier 1 step 5).
   - Spot-check a query on each newly-added column via the backend read path — the old
     code should ignore the new column entirely.

3. **Do NOT run any `dotnet ef migrations remove` or `database update <previous>`.** The
   migration is applied and safe. Reversing it while the old code doesn't reference the
   new columns creates zero user value and risks data loss if the migration back-filled
   anything.

4. **File a follow-up ticket** to re-attempt the intended change with a fixed application
   version. The migration is already in place; the follow-up deploy is image-only.

**Rollback if this tier goes wrong:** if the old image fails against the migrated schema,
the migration was not actually additive. Reclassify as Tier 3 and continue there.

---

## Tier 3 — Backend rollback with data-incompatible migration

Use when the deploy included a destructive migration (dropped a column the old code reads,
renamed a table, tightened a constraint the old code violates, etc.).

**Prerequisite:** a tested down-migration exists AND was run in dev/staging BEFORE the
forward deploy went to prod. If neither is true, DO NOT reverse — roll forward instead
(see § "Roll-forward fallback" at the bottom of this tier).

1. **Take the service to maintenance mode.**
   - Put the ALB `maintenance` target group in front of a static "temporarily unavailable"
     page (this target group is provisioned by the Terraform module `alb-maintenance` in
     `infra/`; toggle via `aws elbv2 modify-listener --default-actions ...` or by running
     the `enable-maintenance-mode` Actions workflow).
   - Announce in the incident channel: "Prod in maintenance mode, ETA <X> min while we
     reverse migration `<name>`."

2. **Take a fresh RDS snapshot before touching anything.**
   ```
   aws rds create-db-snapshot --db-instance-identifier maintain-prod \
     --db-snapshot-identifier maintain-prod-pre-rollback-$(date -u +%Y%m%dT%H%M%S)
   ```
   Wait for `available`. This is your last-resort restore point.

3. **Reverse the migration via a one-shot Fargate task.**
   - The migration Fargate task-def (see `db-migration.md § "How migrations run in prod"`)
     accepts an override `--target-migration <previous-migration-name>`. Trigger via the
     `run-ef-migration` GitHub Actions workflow with input `direction=down` and
     `target=<previous_migration_name>`.
   - The task runs `dotnet ef database update <target> --project ... --startup-project
     ...` inside the same runtime environment the app uses.
   - Expected exit code 0. Task logs show `Reverting migration '<name>'`.

4. **Verify the schema is at the target migration.**
   ```
   psql "$RDS_URL" -c "SELECT migration_id FROM __EFMigrationsHistory ORDER BY migration_id DESC LIMIT 3;"
   ```
   - Expected: the top row is the previous migration; the bad migration is gone.

5. **Deploy the previous image (Tier 1 steps 1–4).**

6. **Leave maintenance mode.**
   - Restore the ALB listener to the normal target group.
   - Announce: "Prod restored. Running smoke."
   - Run the Playwright smoke suite against prod.

### Roll-forward fallback

If no down-migration exists, or you have no confidence the reverse will complete cleanly,
DO NOT attempt Tier 3. Instead:

1. Keep the migration in place.
2. Write a hotfix commit that makes the new code work correctly against the new schema.
3. Deploy the hotfix as a normal (fast-tracked) deploy: merge → dev → tag → staging smoke
   → approval → prod. Skip the deploy freeze if in effect (Engineering Manager approval).
4. If the hotfix is not writeable in < 2 hr, use maintenance mode to buy time. If > 4 hr,
   escalate to L4 and consider RDS point-in-time-restore to just before the migration
   (this is destructive of any writes since the migration — L5 approval required).

---

## Post-incident actions

- [ ] Update the incident channel with the resolution note, tier used, and reasoning.
- [ ] Post-mortem within 5 business days (see `incident-response.md § Post-mortem`). If
      this was Tier 3, the post-mortem MUST cover why a destructive migration reached
      prod without a rehearsed down-migration, and add a policy or automation to prevent
      recurrence.
- [ ] If Tier 2 was used, file the follow-up ticket for the re-attempt.
- [ ] Bump this runbook's version + reviewed date if any step was wrong.

---

## Related runbooks

- [`deploy.md`](./deploy.md) — the deploy procedure this rollback undoes.
- [`db-migration.md`](./db-migration.md) — read before writing any migration; explains the
  additive-first two-phase pattern that keeps most rollbacks in Tier 1 or 2.
- [`incident-response.md`](./incident-response.md) — always run in parallel with any Tier
  2/3 rollback.

## Related dashboards

- Grafana `HTTP 5xx by service`.
- Grafana `SLO burn — fast window`.
- CloudWatch `RDS Performance Insights` — watch during any migration operation.
- CloudWatch `ALB target-group state` — watch during blue-green swap.

## Related alerts

- `SLOBurnFastWindow`.
- `MigrationOneShotTaskFailed`.
- `DeployHealthCheckFailed`.

---

## Runbook feedback

Did this runbook help? Was a step wrong? Post in Slack `#runbook-feedback` with:

```
Runbook: rollback.md
Version: v0.1 — 2026-07-23
Date used: YYYY-MM-DD
Tier used: 1 / 2 / 3 / roll-forward
What worked:
What was wrong or missing:
Severity of the incident:
Suggested edit (optional):
```
