# Runbook: Deploy to dev / staging / prod

> Version: `v0.1 — 2026-07-23` • Owner: Platform / Release Engineering • Reviewed: `2026-07-23`

Standard deploy procedure. Merges to `main` auto-deploy to `dev`. Tagged releases deploy to
`staging`. Prod is approval-gated. This runbook covers all three plus common failure modes.

---

## Symptom

Not a fire-fighting runbook. Use when:

- You have merged a PR and want to promote the change through the pipeline.
- CI shows a red job in the deploy pipeline (e.g. `deploy-staging` failed).
- Something looks wrong immediately after a deploy (the deploy is the prime suspect).

Post-deploy fires with clear runbook coverage (5xx spike, DB failure, integration outage)
should route through `incident-response.md` first.

---

## Severity + expected TTR

- **Green-path deploy:** not an incident. Target: dev < 15 min, staging < 30 min, prod
  gate + 30 min swap.
- **Failed deploy needing rollback:** Severity `High`, TTR 30 min. Protects the "Write
  APIs" SLO (99.5%). If the failure produces user-visible 5xx or blocks logins, escalate
  to `Critical` (protects Login SLO 99.9%).

---

## Preconditions

- You are on the release engineer rota or on-call primary.
- You have GitHub `write` on the repo (approval-gate deploys require `deploy: prod`
  reviewer role in GitHub Environments — see repo settings).
- The change has passed all three CI jobs on `main`: `backend-build-test`,
  `backend-integration-tests`, `frontend-lint-test` (see `.github/workflows/ci.yml`).
- For prod: an on-call primary + secondary have both acknowledged they are at a keyboard
  for the next hour.
- For prod: no other prod deploy has been kicked off in the last 30 min (check GitHub
  Actions `Environments → prod`).

---

## Diagnosis steps (pre-deploy sanity)

1. **Confirm CI is fully green on the target commit.**
   ```
   gh run list --branch main --limit 5
   ```
   - Expected: latest run status `completed / success`, all 3 jobs green.
   - Failure: red job → do NOT deploy. Investigate the failing job. Coverage-gate failures
     on `Application/Calculations/**` mean a calc got new code without a test — fix the
     test first (see `CLAUDE.md § Conventions` — Calculations are 90% gated).

2. **Confirm no pending migration surprises.**
   ```
   git log --oneline -20 -- 'backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/Migrations/'
   ```
   - Expected: any new migration since the last prod deploy is listed. Note its filename.
   - If a new migration exists → read `db-migration.md` before proceeding. Every prod deploy
     that introduces a migration follows the additive-first two-phase pattern.

3. **Confirm the error budget is not exhausted.**
   - Open the Grafana `SLO burn — 30d` dashboard.
   - Expected: burn < 100% of monthly budget.
   - Failure: burn >= 100% → deploy freeze is in effect (per `README.md § Expected SLOs`).
     Only fixes for open incidents may deploy. Escalate to the Engineering Manager for
     override.

---

## Recovery steps (the deploy itself)

Recovery here means "how you actually run each promotion." Each step lists the trigger,
what to watch, and the rollback if it fails.

### Step 1 — Deploy to `dev` (auto on merge to `main`)

1. Merge the PR to `main` via GitHub. The `deploy-dev` job in `.github/workflows/ci.yml`
   (Phase 1 extension — currently spec'd, see `execution-plan.md § Phase 1`) runs
   automatically.
2. Watch: GitHub Actions `Environments → dev` page. Migration one-shot Fargate task runs
   first (see `db-migration.md`). ECS service update follows.
3. Verify:
   ```
   curl -sf https://dev.maintain.aurigo.net/health/ready
   ```
   - Expected: `200 OK`, body `{"status":"Healthy"}` with `db`, `migrations`, and
     `integrations` all `Healthy`.
   - Failure: 5xx or a component `Unhealthy` → jump to `rollback.md` (choose tier by
     whether a migration ran; see `rollback.md § Decision flow`).

### Step 2 — Cut a release tag for `staging`

1. Tag the commit on `main` and push:
   ```
   git tag -a v$(date +%Y.%m.%d)-rc1 -m "Staging candidate $(date +%Y-%m-%d)"
   git push origin v$(date +%Y.%m.%d)-rc1
   ```
2. The `deploy-staging` workflow triggers on the tag push.
3. Watch: same as dev, but on `staging.maintain.aurigo.net`.
4. Verify: run the Playwright smoke suite against staging.
   ```
   cd frontend/asset-maintenance-web && npm run e2e -- --config=playwright.staging.config.ts
   ```
   - Expected: 10/10 smoke tests pass (login, asset detail, new inspection, new capital
     need, push to plan, TAMP view, publish TAMP, plus 3 additional smoke journeys).
   - Failure: any test red → do NOT promote to prod. Jump to `rollback.md`.

### Step 3 — Promote to `prod` (approval-gated)

1. In GitHub → Actions → `deploy-prod` workflow → `Run workflow`, select the release tag
   from Step 2.
2. Approver clicks "Approve deployment" in the `prod` environment page. Two approvers
   required (per environment protection rule).
3. Blue-green swap semantics (via CodeDeploy):
   - Blue = current prod tasks, still receiving 100% traffic.
   - Green = new tasks with the release image. Start behind the ALB with 0% weight.
   - CodeDeploy shifts traffic 10% → 50% → 100% at 5-min intervals with automatic rollback
     if 5xx rate exceeds 1% during any window.
4. Watch during the swap:
   - Grafana panel `HTTP 5xx by service` (must stay < 1%).
   - Grafana panel `ALB target-group healthy hosts` (green must reach desired count within
     5 min or CodeDeploy aborts).
   - CloudWatch alarm `WAFBlockedRequestsSpike` (see § "WAF false positives" below).
5. Verify at 100% traffic:
   ```
   curl -sf https://maintain.aurigo.net/health/ready
   curl -sf https://maintain.aurigo.net/api/v1/version
   ```
   - Expected: `version` matches the release tag; `ready` all-green.
6. Watch the SLO burn dashboard for the next 30 min. Any spike above the pre-deploy
   baseline → `rollback.md § Decision flow`.

---

## Common failures

### Image pull failure

Symptom: ECS task events show `CannotPullContainerError: image ... not found`.

Cause: the `Dockerfile` multi-stage build succeeded in CI but the push to ECR failed
silently (usually IAM permission drift on the CI role), OR the ECR lifecycle policy purged
an image the deploy was trying to reuse.

Fix:

1. Re-run the `build-and-push` job.
2. If still failing, run locally:
   ```
   docker build -t maintain:localtest -f Dockerfile .
   ```
   - The `Dockerfile` at repo root is a 3-stage build (frontend → backend → runtime,
     final image on port 8080). If local build fails, the CI failure was real, not a
     transient — investigate the actual build error.
3. If local build succeeds, the issue is IAM. Verify the CI role can `ecr:PutImage` on
   `arn:aws:ecr:*:*:repository/aurigo/maintain`.

### Migration hang

Symptom: the migration one-shot Fargate task is running for > 10 min, ECS service update
is blocked waiting on it.

See `db-migration.md § "How to handle a hung migration"`. Do NOT kill the task blindly —
it may be holding a lock that leaves the DB in a partially-migrated state.

### Health check timeout

Symptom: ECS tasks come up but the ALB target group marks them unhealthy after the
grace period, CodeDeploy aborts.

Diagnosis:

1. Get the failing task's logs:
   ```
   aws logs tail /ecs/maintain-api --follow --since 10m
   ```
2. Look for startup errors — most common are:
   - `Npgsql.NpgsqlException: no pg_hba.conf entry for host …` → RDS security group /
     VPC misconfig. Verify the ECS security group is allowed on 5432.
   - `Migrations pending: ...` → migration one-shot didn't run or failed silently.
     See `db-migration.md`.
   - `The type initializer for 'Aurigo.AssetMaintenance...' threw an exception` →
     missing env var (Secrets Manager binding). Check ECS task-def env references.

Recovery: If root cause is missing config, redeploy after fixing task def. If root cause
is the code itself (regression), jump to `rollback.md § Decision flow`.

### WAF false-positive block on synthetic traffic

Symptom: post-deploy CloudWatch alarm `WAFBlockedRequestsSpike` fires. Grafana `HTTP 5xx`
looks normal because these never hit the app. Customers may see 403 from WAF page.

Diagnosis:

1. Check the WAF logs:
   ```
   aws wafv2 get-sampled-requests --web-acl-arn <arn> --rule-metric-name <suspect-rule> \
     --scope REGIONAL --time-window <last-10m> --max-items 20
   ```
2. Common triggers:
   - Playwright smoke suite hitting the same endpoint fast → looks like a bot. Solution:
     add the smoke-runner egress IP to the WAF allowlist (Terraform variable
     `waf_allowed_ips` — apply via `infra/` PR).
   - A new API endpoint accepting a payload the AWS managed ruleset flags as SQLi
     (common with search strings containing `--`). Solution: scope-down the rule for that
     path via a WAF exception rule; do NOT disable the whole managed group.

Recovery: If the block is spurious, add the WAF exception. If the block looks like a real
attack, keep it, page the security lead (L4), and treat as security incident per
`incident-response.md § Security-flavored incidents`.

---

## Post-incident actions

Deploys that need this section usually turned into an incident — follow
`incident-response.md § Post-mortem`.

Even for green deploys, ONCE per week during the on-call handoff (see `oncall-handoff.md`),
review the week's deploys for:

- Deploy frequency + median time-to-prod.
- Any near-miss (5xx spike that recovered without rollback).
- Any WAF false-positive that was allowlisted (revisit whether the allowlist is still
  needed).

---

## Related runbooks

- [`rollback.md`](./rollback.md) — every deploy that turns yellow ends here.
- [`db-migration.md`](./db-migration.md) — always read when a migration is in the change set.
- [`incident-response.md`](./incident-response.md) — if the deploy causes a user-visible
  incident.

## Related dashboards

- Grafana `Deploys — last 24h` (timeline of image tags applied per env).
- Grafana `HTTP 5xx by service` (primary post-deploy watch).
- Grafana `SLO burn — 30d` (pre-deploy gate, post-deploy watch).
- CloudWatch dashboard `WAF — blocked-vs-allowed`.

## Related alerts

- `DeployHealthCheckFailed` (ECS task health-check failure during deploy).
- `WAFBlockedRequestsSpike` (WAF blocking > 5x baseline).
- `SLOBurnFastWindow` (post-deploy latency or 5xx spike within 1 hr).

---

## Runbook feedback

Did this runbook help? Was a step wrong? Post in Slack `#runbook-feedback` with:

```
Runbook: deploy.md
Version: v0.1 — 2026-07-23
Date used: YYYY-MM-DD
What worked:
What was wrong or missing:
Severity of the incident:
Suggested edit (optional):
```
