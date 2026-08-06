# Aurigo Maintain — Ops Runbooks

Runbooks for humans on call at 3 AM. Every entry is written so a tired, slightly-panicked
responder who has not touched the code in a month can follow numbered steps to green.

**Scope:** Ops procedures for the Aurigo Maintain service (both `primus` and `masterworks`
brand builds). These procedures apply globally — this folder lives once in the `primus`
worktree and is the source of truth for both brands.

**Audience:** On-call primary + secondary, incident commander, delivery engineers, platform
SREs, release managers.

---

## Index

| Runbook | When to use | Severity coverage |
|---|---|---|
| [`incident-response.md`](./incident-response.md) | You've been paged. Read this first — always. | All |
| [`deploy.md`](./deploy.md) | Rolling a change from `main` to dev / staging / prod. | Change management |
| [`rollback.md`](./rollback.md) | The deploy is bad and you need to back it out. | High / Critical |
| [`db-migration.md`](./db-migration.md) | Writing or applying an EF Core migration in prod. | Change management + High |
| [`oncall-handoff.md`](./oncall-handoff.md) | Weekly rotation handoff meeting or setup. | Process |
| [`tenant-onboarding.md`](./tenant-onboarding.md) | A new customer needs a tenant provisioned (pre-automation). | Delivery |
| [`_template.md`](./_template.md) | Authoring a new runbook. Copy this, don't write from scratch. | N/A |

---

## Template usage

To add a new runbook:

1. Copy `_template.md` to `<short-symptom-name>.md` (kebab-case, no leading verb — e.g.
   `tamp-report-timeout.md`, not `fix-tamp-timeout.md`).
2. Fill in every section. Do NOT leave placeholders. If a section does not apply, write
   `Not applicable — <one-sentence reason>` so the reader knows you thought about it.
3. Link the new runbook from this README's index.
4. Land the runbook in a PR titled `docs(runbook): add <symptom>`. Runbook PRs skip the
   integration test job by the CI path filter — expect only backend-build-test + frontend
   jobs to run.
5. Announce in `#eng-oncall` so the rotation knows the new runbook exists.

---

## Escalation ladder

Escalate only when the runbook explicitly says to, or when you're outside your severity
band's TTR and still don't have a diagnosis.

| Level | Role | Contact channel | Escalate when |
|---|---|---|---|
| L1 | On-call primary | PagerDuty `Aurigo-Maintain-Primary` | Page received |
| L2 | On-call secondary | PagerDuty `Aurigo-Maintain-Secondary` | Primary silent 15 min, or explicit handoff |
| L3 | Incident Commander (rotating weekly) | Slack `#eng-oncall`, PagerDuty `Aurigo-Maintain-IC` | Severity `Critical` declared, or L2 requests |
| L4 | Engineering Manager | Slack DM + phone | Multiple systems affected, or IC requests |
| L5 | VP Engineering + CTO | Phone tree in PagerDuty | Data loss suspected, security breach suspected, or > 4 hr customer-facing outage |

**Security incidents** (suspected credential leak, data exfiltration, WAF evasion) skip the
ladder and go straight to L4 + Security Lead in parallel. See `incident-response.md`
§ "Security-flavored incidents".

---

## Expected SLOs

Every runbook cites the SLO it protects. This is the master table.

| Path | Availability | Latency (p95) | Notes |
|---|---|---|---|
| Read APIs (`GET /api/v1/**`) | 99.9% | < 500 ms | Hard-page on burn > 2% / hr |
| Write APIs (`POST/PUT/PATCH/DELETE /api/v1/**`) | 99.5% | < 1 s | Soft-page on burn > 5% / hr |
| TAMP report generation (`POST /api/v1/tamp/generate`) | 99% success | < 30 s @ 10k assets | Async job; SLO is job completion, not HTTP response |
| Integration sync (Cityworks, Maximo, ArcGIS, Aurigo Plan) | 99% success / 24 hr window | < 15 min lag | See `AurigoPlanStatusPollingWorker` cadence (`Infrastructure/BackgroundServices/`) |
| Login + JWT refresh | 99.9% | < 400 ms | Blocks every other path when broken — treat as Critical |

Error budgets: monthly. When the 30-day burn exceeds the budget, the team stops feature work
and spends the next sprint on reliability. Enforced via the release-gate check documented in
`deploy.md § "Error-budget gate"`.

---

## Severity + TTR reference (mirrored from `oncall-handoff.md`)

| Severity | Definition | Ack | TTR (Time-to-Recovery) |
|---|---|---|---|
| Critical | Full outage, data loss risk, security breach, or > 25% of tenants affected. | 15 min | 1 hr |
| High | Major feature broken for one tenant, or degradation across many. TAMP publish blocked. | 30 min | 4 hr |
| Medium | Non-critical feature broken; workaround exists. Slow queries, minor UI regressions. | 4 hr | Next business day |
| Low | Cosmetic, documentation, single-user report. | 3 business days | 3 business days |

---

## Runbook feedback

Did a runbook help you? Did it lie to you? Was a step wrong?

Post in Slack `#runbook-feedback` with the template at the bottom of every runbook. Feedback
gets triaged weekly by the on-call handoff meeting (see `oncall-handoff.md`). Stale runbooks
are the fastest way to lose trust — call them out.

Runbook set version: `v0.1 — 2026-07-23` (initial set; iterated per incident).
