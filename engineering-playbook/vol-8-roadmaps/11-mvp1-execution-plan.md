# Production-Grade Execution Plan

**Last updated:** 2026-07-23
**Author:** Architecture Review
**Status:** Draft v1 — requires exec + product review before commit
**Companion docs:** `vol-4-integration-specs/{brm-connector,hpms-export-import,atom-ai-connector,plan-bidirectional-sync}.md`

---

## Table of Contents

1. [Where we stand today](#1-where-we-stand-today)
2. [What "production-grade" means for this product](#2-what-production-grade-means-for-this-product)
3. [Phased execution plan](#3-phased-execution-plan)
   - Phase 0 — Foundation hardening (2-3 weeks)
   - Phase 1 — Deploy infrastructure (3-4 weeks)
   - Phase 2 — Security & compliance baseline (4-6 weeks, parallel)
   - Phase 3 — Observability & ops (3-4 weeks, parallel)
   - Phase 4 — Integration builds (~14-18 weeks)
   - Phase 5 — TAMP depth (~4-6 weeks, follows Phase 4)
   - Phase 6 — Data migration tooling (~4-6 weeks)
   - Phase 7 — Performance & scale (~2-4 weeks)
   - Phase 8 — Product hardening (ongoing, all phases)
   - Phase 9 — Documentation & enablement (~4 weeks, parallel)
4. [Team & timeline scenarios](#4-team--timeline-scenarios)
5. [Risks & mitigations](#5-risks--mitigations)
6. [First 30 days — concrete action list](#6-first-30-days--concrete-action-list)
7. [Decision points requiring executive input](#7-decision-points-requiring-executive-input)

---

## 1. Where we stand today

### 1.1 What works

- **Two-brand codebase (masterworks + primus)** ships end-to-end demo-quality flows across 5 domain modules (inventory, condition, RUL, ARV/risk, LCP scenarios, capital needs, job orders, PM schedules, TAMP reporting).
- **~74 backend unit tests + 8 frontend tests + WireMock-backed integration tests + Playwright E2E scaffolding.**
- **CI pipeline** at `.github/workflows/ci.yml` — 3 jobs, coverage gate (≥90%) on `Application/Calculations/**`, path-filter probe to skip integration tests on FE-only PRs.
- **Cityworks + Maximo integrations are real** — delta sync, echo detection, bidirectional flow, credential encryption, sync-run history.
- **Aurigo Plan outbound push** is production-proven (Sprint 2/6). Reverse-flow backend landed in Sprint 18a (frontend + TAMP wiring outstanding — see `plan-bidirectional-sync.md`).
- **§ 515.9 (a)–(l) TAMP coverage** — every FHWA-mandated section has *something*.
- **Multi-tenant with global EF query filter** on every aggregate root.
- **Audit log via EF `SaveChangesInterceptor`** — automatic.
- **Dockerfile targets Railway/PaaS** (multi-stage FE+BE build, port 8080).

### 1.2 What doesn't (yet)

**Infrastructure & deploy**
- No AWS Terraform / IaC. The `pe-apigateway-mw-platform2.0/` module is reference-only.
- No environment separation beyond local (no staging, no production).
- No CDN, no WAF, no ALB, no RDS, no Secrets Manager wiring.
- The `infra/` directory referenced in `CLAUDE.md` doesn't actually exist yet.
- CI has no deployment stage.

**Security**
- Pre-existing warnings in the codebase; `-warnaserror` deliberately OFF.
- No formal threat model.
- No penetration test.
- No SOC 2 attestation, no FedRAMP / StateRAMP path.
- OAuth secrets currently sit in local `*.credentials.json` files (gitignored, but not in a secrets manager).
- Tenant isolation rests on the EF global query filter — no independent audit that every `IgnoreQueryFilters()` call is safe.
- Rate limiting exists for the integrations POSTs and a few report endpoints, but is not comprehensive.

**Observability**
- OpenTelemetry NuGet packages are wired (`OpenTelemetry.Exporter.OpenTelemetryProtocol` 1.9.0 — but has a known moderate CVE per NU1902 warning; needs upgrade).
- No sink configured (Datadog / Grafana Cloud / X-Ray).
- No dashboards.
- No alerts.
- No SLO definitions.
- No on-call rotation, no runbooks.
- No incident-response process.

**Integrations (from July 2026 audit)**
- BrM (AASHTOWare Bridge Management) — missing entirely. Blocks state DOT sales.
- HPMS export/import — missing entirely. Blocks state DOT sales.
- Atom AI — no connector. Blocks 500+ city expansion.
- Plan bidirectional — backend done, frontend + TAMP wiring pending.
- Primavera P6, MaintainX, UpKeep, SAP EAM, AgileAssets — documented stubs only.

**TAMP depth**
- Product output is a "compliance schema" of a real TAMP: covers all § 515.9 items but at 10% of the depth a state DOT actually submits. See "TAMP gap assessment" thread in session notes.
- Hazard scores are synthetic (Sprint T-6.b — real FEMA/NOAA/USDA ingestion — hasn't shipped).
- No agency-wide risk register (only per-asset failure risk).
- No revenue-side financial modeling.
- No NHPP-programmed project list (§ 515.9(i)).
- No public consultation log.

**Data + operations**
- No production data model — dev seeds only. Real customer onboarding is manual today.
- No backup/restore / DR strategy.
- No PITR configuration.
- No load-tested scaling profile.
- Report generation is synchronous (would timeout on a 300k-segment Texas-scale tenant).

### 1.3 Honest verdict

**The product is a strong prototype** — better than most in Aurigo's category — but calling it "production" today would embarrass the team. Two axes need investment before a paid enterprise customer goes live:

1. **Infrastructure, security, observability, compliance** — the "boring" boxes that block enterprise procurement.
2. **Integrations + TAMP depth** — the boxes that convert prospects into paying customers.

Neither can be skipped. The plan below sequences them so shippable slices go out every 2-3 weeks.

---

## 2. What "production-grade" means for this product

Three tiers of "production-grade" to sequence:

### 2.1 MVP1 — "First paid customer" (target: month 4-5)

- Runs on managed AWS in a real customer account (or Aurigo-hosted multi-tenant).
- Real staging environment; blue-green deploy from CI.
- SOC 2 Type I attestation *in progress* (Type II is a 12-month look-back — not a launch gate).
- Basic observability: OTel → sink, uptime + p95 alerts, one on-call primary + secondary.
- Real integrations for the customer's actual stack (typically 1-2 of BrM/HPMS/AtomAI/Plan-bi).
- 99.5% availability SLA in the contract (not 99.9% yet — need 3 months of measured uptime before that commitment).
- Customer-specific data migration completed via file-drop or one-off script.
- Bug budget: no P0/P1 defects at go-live, ≤ 3 known P2s with workarounds documented.

### 2.2 MVP2 — "Second and third customers, no per-customer heroics" (target: month 8-10)

- Multi-tenant hardening: cross-tenant isolation tests, tenant provisioning automation, per-tenant resource quotas.
- Real ingestion of FEMA/NOAA/USDA hazard data (Sprint T-6.b) so the resilience chapter isn't demo-shaped.
- Full connector suite for the top 3 in the audit (BrM, HPMS, Plan bidirectional).
- Data migration tooling — self-service dry-run + commit for new customers.
- SOC 2 Type II window opened.
- 99.9% availability SLA.
- Runbooks + on-call rotation covering every automated + manual workflow.
- Documented, versioned API (public Swagger + integration guides).

### 2.3 MVP3 — "State DOT enterprise sale, defensible against RFP" (target: month 15-18)

- StateRAMP or FedRAMP Moderate authorization in progress.
- FedRAMP-eligible hosting posture (AWS GovCloud or equivalent, depending on customer).
- Full BrM + HPMS + Plan bidirectional in production.
- TAMP depth closed to submission-quality (deck-area weighting, § 490 metric derivation, agency-wide risk register, NHPP-programmed list, IT systems inventory, public consultation log).
- Performance-tested to Texas scale (300k segments, 20k bridges, sub-second p95 on read paths).
- WCAG 2.1 AA accessibility (mandatory for many state DOT contracts).
- Comprehensive change-management process, DR-tested with quarterly failover drills.

---

## 3. Phased execution plan

Phases 0-3 are prerequisites — sequence in parallel where staffing allows. Phases 4-9 are the value-delivery track. Every phase ends with a shippable, demonstrable slice.

### Phase 0 — Foundation hardening (2-3 weeks)

**Goal:** Get the codebase to a state where the next 12 months of work can be built on it without stopping every sprint to fix compile-time warnings, stale snapshots, or missing tests.

**Scope**

| Item | Effort | Notes |
|---|---|---|
| Fix the 7 pre-existing compile warnings | 0.5 PD | `ArvAndRisk.UpdatedAt` shadow, tuple-name mismatches in `InternalDataConnector.cs`, XML cref in `PublicDataConnectorsController.cs`, obsolete `WKTReader.DefaultSRID` in `CityworksAssetMapper.cs`, missing XML tag in `PublicTampController.cs` |
| Re-enable `-warnaserror` in `Aurigo.AssetMaintenance.sln` build config | 0.25 PD | Currently OFF per CI comment |
| Upgrade OpenTelemetry packages past the moderate CVE (NU1902) | 0.5 PD | Blocks any external attestation |
| EF snapshot regeneration (QG.2 — captures the two July 22 handwritten migrations properly) | 0.5 PD | Cosmetic today, blocks future `migrations add` |
| Test coverage ratchet: enable coverage gate on `Domain/**` at initial 60%, ratchet to 90% over 4 sprints | 3 PD (initial write-up) | Currently 0% enforced on Domain |
| Frontend Vitest coverage floor at 40% initial, ratchet | 2 PD | Currently `--passWithNoTests` |
| Playwright smoke suite: 10 critical user journeys (login → asset detail → new inspection → new capital need → push to plan → TAMP view → publish TAMP) | 4 PD | Currently scaffolded only |
| Cross-tenant leak test suite (`IgnoreQueryFilters()` audit + tests for every call) | 2 PD | Manual grep + 15-20 test cases |
| Rate-limit completeness audit + fill gaps | 1 PD | Extend `integrations-posts` policy pattern to all mutation endpoints |
| Empty-state coverage audit (every list page has a NoDataView) | 2 PD | Bug-bash style |
| Type-safe API client generation (currently manually curated `api.ts`; move to `openapi-typescript` codegen per `CLAUDE.md`) | 3 PD | Reduces drift, catches BE/FE shape mismatches at compile-time |

**Exit criteria**
- All warnings resolved; `-warnaserror` on in Release builds.
- Coverage gates enforced: `Application/Calculations/**` ≥ 90%, `Domain/**` ≥ 60% (ratchet plan documented).
- Playwright smoke suite green in CI on every PR.
- Zero `IgnoreQueryFilters()` calls without a passing tenant-leak test.

**Effort:** ~19 PD ≈ 4 dev-weeks for one engineer, or 2 weeks with two engineers.

---

### Phase 1 — Deploy infrastructure (3-4 weeks)

**Goal:** Real environments in AWS, wired to CI, capable of hosting real customer workloads. Everything modelled as code.

**Scope**

| Item | Effort | Notes |
|---|---|---|
| Terraform modules for: VPC (public+private+data subnets, NAT, Route 53), ALB + ACM + WAF, ECS Fargate service (Blue/Green via CodeDeploy), RDS Postgres 16 w/ PostGIS 3.4 (Multi-AZ, PITR, encryption at rest), S3 buckets (asset uploads + report exports + backups, versioned + encrypted), Secrets Manager, CloudWatch Logs + Metrics, IAM roles + policies (least-privilege) | 10 PD | Reuse patterns from `pe-apigateway-mw-platform2.0/` where they exist |
| Three environments: `dev`, `staging`, `prod` — separate accounts or at minimum separate VPCs + RDS instances | 3 PD | Aurigo standard: separate AWS accounts per env, cross-account IAM |
| GitHub Actions extension: on merge to `main` → deploy to `dev`; tagged release → deploy to `staging`; approval gate → deploy to `prod` | 4 PD | Blue-green swap, health-check gated, automatic rollback on 5xx spike |
| Migration pipeline: run `dotnet ef database update` inside a one-shot Fargate task before ECS service swap | 2 PD | Locks migrations against long-running txns; migration lock table in the DB |
| Secrets rotation: 90-day rotation for OAuth client secrets, DB passwords, JWT signing keys; store in AWS Secrets Manager; app reads via env var indirection | 3 PD | Automate with Lambda for RDS; document manual rotation for external OAuth |
| Aurigo API Gateway registration for the new environment (reuse `pe-apigateway-mw-platform2.0/` module — do NOT edit it, register a new stage) | 2 PD | Coordinate with platform team |
| CloudFront CDN for static assets + response caching | 1 PD | Cache TAMP JSON with short TTL, static bundles with year-long TTL |
| Runbook: how to deploy, how to rollback, how to run a migration, how to promote from staging to prod | 1 PD | Lives in `engineering-playbook/vol-5-production-readiness/runbooks/` |

**Exit criteria**
- One-click deploy from `main` to dev, tagged release to staging, approval-gated to prod.
- All three environments healthy under a smoke test.
- Migrations run automatically as part of deploy with lock protection.
- Secrets in Secrets Manager, not in `appsettings.*.json`.

**Effort:** ~26 PD ≈ 5 dev-weeks for a dedicated DevOps engineer.

---

### Phase 2 — Security & compliance baseline (4-6 weeks, parallel to Phase 3)

**Goal:** Meet the "boring boxes" enterprise procurement always asks about, and start the multi-quarter attestation clock.

**Scope**

| Item | Effort | Notes |
|---|---|---|
| Threat model workshop (STRIDE per data flow) | 3 PD | Output: threat register + 10-20 mitigation tickets |
| OWASP Top 10 pass: SQLi (parameterized only — EF gives this for free), XSS (sanitize markdown narratives — currently unrestricted), CSRF (sameSite cookies + tokens), IDOR (verify tenant scoping on every ID lookup), SSRF (webhook receivers, integration URL fields), auth (JWT expiry, refresh, rotation) | 8 PD | Manual code review + Snyk/CodeQL wired to CI |
| Dependency scanning: Dependabot already on; enable auto-PR for security patches; add container scanning (Trivy in CI) | 2 PD | |
| Data encryption: verify TLS 1.3 everywhere; RDS at-rest via KMS; S3 SSE-KMS with per-tenant keys for uploads | 2 PD | |
| Row-level tenant isolation formal audit: fuzz-test every controller with cross-tenant IDs | 4 PD | Extends Phase 0's leak tests to attack scenarios |
| RBAC completeness: verify every controller has `[Authorize(Roles=…)]` per intent; document the role/permission matrix | 3 PD | Some routes fell through the gap (e.g. this session found `IntegrationsController` gated Administrator but nav link showed to everyone) |
| PII discovery + redaction: audit all `*Dto` returns for user-identifying data; add automatic scrubbing in logs (`HttpBodyScrubber` already exists, extend) | 3 PD | Especially inspector names, uploader emails, address fields |
| Penetration test (external vendor — Bishop Fox, Trail of Bits, Cobalt) | 15 PD calendar (~5 PD our effort responding to findings) | ~$40-60k typical, 3-4 week engagement |
| SOC 2 readiness assessment (vendor: Vanta, Drata, or Aurigo internal if they have a program) | 10 PD | Sets up the control library, evidence collection automation; ~$25-50k first year |
| StateRAMP evaluation for state DOT track (decision: pursue StateRAMP Moderate now, or defer to Phase 6 / MVP3?) | 3 PD analysis | StateRAMP is 6-12 months and $200k-$500k; call out as a Phase-3 decision |
| Legal + compliance addenda: DPA template, Security Addendum, DR/BCP statement, subprocessor list, SIG questionnaire pre-answers | 4 PD (legal + eng) | Blocks first paid customer contract |

**Exit criteria**
- Threat model + mitigation plan reviewed by security lead + engineering.
- Pen test complete; all Critical/High findings fixed; Medium findings scheduled.
- SOC 2 control library populated; evidence collection running.
- RBAC + tenant-isolation matrix documented and tested.

**Effort:** ~45 PD in-house + $70-110k external vendor spend (pen test + SOC 2 tooling).

---

### Phase 3 — Observability & ops (3-4 weeks, parallel to Phase 2)

**Goal:** Know what the system is doing at all times; page the right person when it breaks; have a runbook for the top 20 failures.

**Scope**

| Item | Effort | Notes |
|---|---|---|
| OpenTelemetry sink choice (Datadog / Grafana Cloud / AWS X-Ray + Managed Grafana) + configuration | 3 PD | Ties to Aurigo's existing observability stack — align with platform team |
| Structured logging with correlation IDs (already partial via `TraceId`; verify every entry has `TenantId`, `UserId`, `RequestId`, `SpanId`) | 3 PD | Serilog + OTel exporter |
| Health checks: `/health/live` (process up) + `/health/ready` (DB reachable, migrations applied, integrations responsive) | 1 PD | ASP.NET Core `AddHealthChecks()` |
| Metrics dashboards: request rate + latency (p50/p95/p99) per endpoint, DB pool utilization, integration sync success rate, TAMP report generation time, queue depths | 4 PD | |
| SLO definitions per critical path: read APIs (99.9% avail, p95 < 500ms), write APIs (99.5%, p95 < 1s), TAMP generate (99% success, p95 < 30s for 10k assets), integration sync (99% success rate over 24h) | 2 PD | Feeds error budget policy |
| Alerts: SLO burn (fast + slow), integration sync failure > 30 min, DB connection saturation > 80%, RDS CPU sustained > 70%, 5xx spike, XSS/SQLi WAF triggers | 3 PD | Route to PagerDuty or Aurigo internal |
| On-call rotation setup: primary + secondary, weekly handoff, incident commander training | 2 PD | Team + tooling |
| Runbooks (initial set of 10): TAMP generate fails, integration sync stuck, DB migration rollback, tenant onboarding, tenant offboarding, secret rotation, credential compromise, DoS mitigation, RDS failover, deploy rollback | 5 PD | Lives in `engineering-playbook/vol-5-production-readiness/runbooks/` |
| Log retention + cost management: 30 days hot, 1 year cold (S3 Glacier), PII redaction on ingestion | 2 PD | GDPR/CCPA-adjacent even for US-only workloads |
| Error tracking: Sentry or equivalent for FE + BE unhandled exceptions | 2 PD | Fast triage vs digging through logs |

**Exit criteria**
- Every deployed service reports metrics + traces + logs to the sink.
- SLO dashboard visible to product + engineering leadership.
- Every alert has a corresponding runbook.
- On-call rotation live with pager coverage 24/7.

**Effort:** ~27 PD ≈ 5 dev-weeks for one SRE (or shared with backend eng).

---

### Phase 4 — Integration builds (~14-18 weeks)

**Goal:** Close the 4 gaps that convert prospects into customers. Specs are already written; this is execution.

**Sequence** (per July 2026 audit — highest revenue unlock first):

| Order | Integration | Spec | BE PD | FE PD | QA PD | Total PD | Notes |
|---|---|---|---|---|---|---|---|
| 1 | **Plan bidirectional** | `plan-bidirectional-sync.md` | 2 | 6 | 0.5 | **8.25** | Backend already shipped Sprint 18a; only FE + TAMP wiring left. Fastest win — do first. |
| 2 | **BrM** | `brm-connector.md` | 16.5 | 6 | 6.5 | **29** | REST (7.x) + DB-Direct (6.x) + FileDrop (SFTP NBI) dispatcher. 2 new tables. TAMP wiring lights up bridge chapter. |
| 3 | **HPMS export/import** | `hpms-export-import.md` | 42 | 24 | 12 | **78** | 4 new tables. Streaming pipeline for Texas scale. FHWA-validated output. Unlocks state DOT compliance story. |
| 4 | **Atom AI (v1 file-drop)** | `atom-ai-connector.md` | 6.5 | 1.5 | 1 | **9** | No public API today. CSV/GeoJSON file-drop under `IIntegrationAdapter`. v1.5 REST swap when partnership lands (~5 more PD). |
| 5 | Primavera P6 verification | (spec pending) | 4 | 2 | 3 | **9** | Code exists, never tested against live P6. Setup a test P6 instance, run existing paths against it, fix breakages. |
| 6 | MaintainX + UpKeep (v1 stubs → real) | (spec pending) | 8 | 3 | 2 | **13** | Both have public REST APIs. Follow the Cityworks/Maximo pattern. |
| 7 | SAP EAM | (spec pending) | 15 | 3 | 3 | **21** | SAP RFC / OData. Enterprise sales only. Deprioritize unless a specific prospect asks. |
| 8 | AgileAssets / Trimble | (spec pending) | 6 | 2 | 2 | **10** | One-shot migration importer, not continuous sync. |

**Total for top 4 (audit-priority):** ~124 PD ≈ 25 dev-weeks for 1 engineer, or **6-8 calendar weeks with a 4-eng pod** if the specs are executed in parallel (they're independent).

**Exit criteria per integration**
- Adapter class + DI + `VendorCatalog` row + drawer variant + tests all green.
- Integration test suite hits WireMock + Testcontainers.
- Runbook for onboarding a customer to this integration (credential setup, initial sync, verification checklist).
- Documented in the integrations guide (Phase 9).

---

### Phase 5 — TAMP depth (~4-6 weeks, follows Phase 4)

**Goal:** Close the ~40% gap that remains after integrations light up the data supply. Numbers here are the "TAMP gap assessment" session output.

**Scope** (in reviewer-attention order):

| Item | Effort | Depends on |
|---|---|---|
| Deck-area weighting + per-structure NBI table (per FHWA bridge measure) | 3 PD | BrM connector (data supply) |
| Full § 490 metric derivation from HPMS fields (%good/fair/poor lane-miles by F-System) | 5 PD | HPMS import (data supply) |
| Agency-wide risk register CRUD + report chapter (§ 515.7) | 3 PD | none — pure product work |
| Part 667 mitigation field + editor per repetitive-damage asset | 1 PD | none |
| § 515.9(i) NHPP-programmed project list | 3 PD | Plan bidirectional (programmed status) |
| IT systems inventory + data-governance chapter (§ 515.13) | 2 PD | Integrations phase — data pulls from `TenantIntegrationCredentials.LastSyncedAt` |
| Public consultation log (§ 515.9(l) documentation side) | 2 PD | none |
| Revenue-side financial planning module (10-yr revenue projection + escalation) | 12 PD | none — genuine new domain, `FundingRevenueProjection` entity |
| YOE inflation stack for financial plan | 3 PD | Revenue module |
| Cash-flow S-curve chart | 2 PD | Revenue module |
| Historical revenue actuals import | 4 PD | HPMS-adjacent (some data comes from FHWA fiscal management reports) |

**Total:** ~40 PD ≈ 8 dev-weeks single engineer. Slots naturally after Phase 4 integrations light up the data.

---

### Phase 6 — Data migration tooling (~4-6 weeks)

**Goal:** Make new-customer onboarding self-service (or repeatable by a delivery engineer), not a code-writing exercise per customer.

**Scope**

| Item | Effort |
|---|---|
| Import wizard framework — supports asset inventory, condition history, capital needs, budget periods; per-entity dry-run + diff + commit | 8 PD |
| BrM history bulk-import (initial customer seed, distinct from ongoing sync) | 3 PD |
| HPMS prior-year submission import (already in the HPMS spec — count it once) | — |
| AtomAI export bridge (already in the Atom spec — count it once) | — |
| Cityworks/Maximo initial bulk-load (extensions of existing sync path) | 3 PD |
| Data-quality dashboard per tenant: coverage %, freshness, orphaned rows, geometry sanity checks | 5 PD |
| Data-migration rollback: point-in-time restore for a tenant without affecting others | 4 PD |
| Customer-facing "data readiness" scorecard | 3 PD |

**Total:** ~26 PD ≈ 5 dev-weeks.

---

### Phase 7 — Performance & scale (~2-4 weeks)

**Goal:** Handle Texas at 300k segments + 20k bridges without breaking.

**Scope**

| Item | Effort |
|---|---|
| Load test harness (k6 or Artillery) with representative-scale seed data | 3 PD |
| DB indexing audit — trace slowest queries via `pg_stat_statements`, add covering indexes | 3 PD |
| N+1 query audit — the TAMP handler loads everything into memory; move to streaming/paged where possible | 5 PD |
| Async report generation: TAMP + HPMS export via background job (`Hangfire` or similar), progress via SignalR | 6 PD |
| Report result caching per-tenant per-version, invalidated on data change | 3 PD |
| CDN response caching for static reference data | 1 PD |
| Connection pool tuning + PgBouncer if needed | 2 PD |

**Total:** ~23 PD ≈ 5 dev-weeks.

---

### Phase 8 — Product hardening (ongoing, all phases)

**Goal:** Move from prototype UX to enterprise-grade UX.

| Item | Effort |
|---|---|
| Bug bash across all workflows (multi-day exercise per module) | 15 PD ongoing |
| Error message quality audit (every 4xx/5xx surfaces user-actionable text) | 3 PD |
| Accessibility audit + fixes (WCAG 2.1 AA — mandatory for state DOT contracts) | 10 PD |
| PDF export server-side for reports (currently browser print only) | 5 PD |
| Session timeout + refresh UX | 2 PD |
| Password reset + MFA setup UX | 3 PD |
| SSO wiring (existing partial per `admin.sso.tsx`) — SAML 2.0 + OIDC | 8 PD |
| Empty-state coverage extension | 3 PD |
| Print stylesheets for reports (partially exists — extend) | 3 PD |

**Total:** ~52 PD, spread across all other phases as capacity permits.

---

### Phase 9 — Documentation & enablement (~4 weeks, parallel)

**Goal:** No question requires the tech-lead's DM.

| Item | Effort |
|---|---|
| Admin docs per persona (planner, asset manager, capital program manager, DBE, admin) | 8 PD |
| Integration guides — one per vendor with wire-up walkthroughs, credential setup, troubleshooting | 6 PD |
| Public API reference (Swagger polish + hand-written narrative examples) | 4 PD |
| Data model reference (`vault/` already has some — publish cleanly) | 3 PD |
| Deployment runbook (Phase 1 output, formalized) | 2 PD |
| Video walkthroughs for demos (customer-facing) | 5 PD |
| Customer success playbook: onboarding, kickoff, first 90 days | 3 PD |

**Total:** ~31 PD ≈ 6 dev-weeks for one tech writer (or 8-10 weeks part-time for a PM/eng combo).

---

## 4. Team & timeline scenarios

**Scenario A — Full-court press (9 people, ~9-12 months to MVP2)**

Roles:
- 1 Tech Lead / Architect
- 2 Backend Engineers (integrations + platform)
- 2 Frontend Engineers (product surface + admin)
- 1 DevOps / SRE (Phase 1 + 3 lead, ongoing support)
- 1 QA Engineer (test infra automation + regression)
- 1 Security Engineer (Phase 2 lead, then part-time)
- 1 Product Manager (roadmap, customer discovery, TAMP prioritization)
- 1 Tech Writer (Phase 9, ongoing)

Cadence:
- Month 1-2: Phase 0 (all hands lean in), start Phase 1 (SRE lead), start Phase 2 (security lead)
- Month 3-4: Phase 3 (SRE + backend), start Phase 4 (Plan bidirectional first, then split BE across BrM + HPMS in parallel)
- Month 5-6: MVP1 launch (first paid customer); continue Phase 4 (Atom + Primavera); start Phase 5
- Month 7-9: MVP2 launch; complete Phase 4 remainder, Phase 5, Phase 6
- Month 10-12: Phase 7 (performance), Phase 8 (product hardening), Phase 9 (docs); SOC 2 Type II window opens

**Scenario B — Lean team (4 people, ~18-24 months to MVP2)**

Roles:
- 1 Tech Lead (BE-heavy)
- 1 Backend Engineer
- 1 Frontend Engineer
- 1 DevOps/SRE (part-time, shared with other Aurigo products)

Sequence phases mostly serially. Integrations spec-execution takes 4-6 months instead of 6-8 weeks. Security work stays baseline (no pen test until MVP1 is imminent).

**Scenario C — Current team baseline (1-2 people, per-sprint prioritization)**

Not recommended for a production push, but if the current session cadence continues (one engineer, focused sprints), realistic timeline is 3+ years to MVP2 quality. Recommend scoping to MVP1 subset:
1. Phase 0 (hardening)
2. Phase 1 minimal (single-environment production on ECS)
3. Phase 3 minimal (Datadog agent + PagerDuty + 5 alerts)
4. Phase 4 items 1-2 (Plan bidirectional + BrM)
5. Skip Phase 2 formal (rely on internal review); Skip Phase 6 (manual onboarding per customer)

MVP1 in 12-15 months at this scope.

---

## 5. Risks & mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| BrM 6.x customers have no API; DB-direct requires customer to open a firewall from Aurigo's cloud to their SQL Server | High (blocks state DOT deals) | High | Design DB-Direct via customer-hosted lightweight proxy (existing pattern in Aurigo product). File-drop as fallback for locked-down customers. |
| Atom AI never grants partner API access | Medium (blocks v1.5 upgrade, but v1 file-drop still works) | Medium | Ship v1 file-drop first; partnership becomes a nice-to-have not a blocker. |
| Plan team doesn't confirm status vocabulary (B-1) | Low (30-min fix once confirmed) | Medium | Ship with current fallback mapping. Add feature flag to swap mapping when Plan confirms. |
| SOC 2 Type II timeline slips past first customer's contract requirement | High (deal risk) | Medium | Offer SOC 2 Type I + attestation letter from Aurigo parent SOC 2. Contract in escrow if needed. |
| StateRAMP is required by a state DOT prospect and takes 12+ months | High (deal risk) | Medium | Qualify prospects early; deprioritize state DOTs that require FedRAMP/StateRAMP at contract signing. Chase cities + counties + private-sector first. |
| Integrations pod finishes BrM + HPMS on schedule but customer's data quality is too poor to onboard | Medium (delayed launch) | High | Phase 6 (data-quality dashboard + dry-run) IS the mitigation. Start it in parallel with integrations, not after. |
| A cross-tenant data leak found in pen test triggers a rebuild | Critical (public relations) | Low | Phase 0's leak-test suite catches this pre-pen-test. |
| Performance testing reveals fundamental architectural issue (e.g. TAMP handler can't stream) | High (rework) | Medium | Phase 7 starts with a spike, not a full build-out. If a rewrite is needed, catch early. |
| Aurigo Plan team's schedule diverges from ours (Plan features Maintain depends on are delayed) | Medium | Medium | Every Plan dependency has a fallback design that ships without waiting. Documented per spec. |
| Docker + PostGIS combination has an incompatibility on AWS Fargate (unusual PostGIS ext version, or Aurora Postgres missing extension) | Medium (deploy blocker) | Low | Verify PostGIS 3.4 on RDS Postgres 16 in Phase 1 kickoff. If Aurora is mandated, verify Aurora PostgreSQL 15/16 supports PostGIS. |

---

## 6. First 30 days — concrete action list

**Week 1 (foundation triage)**
- [ ] Executive review this document; align on Scenario A / B / C staffing.
- [ ] Save the 4 integration specs to the repo (done — `engineering-playbook/vol-4-integration-specs/`).
- [ ] Fix the 7 pre-existing compile warnings + upgrade OpenTelemetry past the CVE. Ship in one PR.
- [ ] EF snapshot regen (QG.2).
- [ ] Vitest coverage floor set to 40%, ratchet to 60% over next 4 sprints.
- [ ] Start the Plan bidirectional frontend work (8.25 PD — smallest, highest-visibility integration win).

**Week 2 (test infra + first infra shovel)**
- [ ] Domain-layer test coverage push to 60%.
- [ ] Playwright smoke suite: 10 critical journeys in CI on every PR.
- [ ] Cross-tenant leak test suite — audit every `IgnoreQueryFilters()` call, add tests.
- [ ] DevOps: Terraform skeleton (VPC + RDS + ECS module scaffolds).
- [ ] Threat modelling workshop scheduled (Week 3).

**Week 3 (parallel tracks light up)**
- [ ] Threat model workshop (half-day). Output: threat register + top-10 mitigation tickets.
- [ ] Plan bidirectional frontend + TAMP wiring lands. Shipped to dev environment.
- [ ] Terraform module PRs merge (VPC, RDS, ECS, ALB, WAF, Secrets Manager).
- [ ] Observability sink choice made (Datadog vs Grafana Cloud vs X-Ray) — decided with platform team.
- [ ] SOC 2 tooling vendor selected (Vanta / Drata) — trial started.
- [ ] Kick off BrM connector spec-to-code work (highest-priority integration).

**Week 4 (first observability slice + integration cadence)**
- [ ] Structured logging + OTel to selected sink; correlation IDs everywhere.
- [ ] Health checks (`/live` + `/ready`) live in dev environment.
- [ ] First 5 alerts configured (5xx spike, RDS CPU, integration sync failure, WAF trigger, health check fail).
- [ ] BrM adapter skeleton merged; connection test path working against a BrM 7.x test instance (need customer or AASHTOWare-provided test env — this is a Week-2 procurement dependency).
- [ ] HPMS pipeline design review (spec is written — this is the architecture kickoff for execution).
- [ ] Runbook template + first 3 runbooks written (deploy, rollback, on-call handoff).

**Exit of Day 30**
- Foundation phase complete (Phase 0 exit criteria met).
- Deploy infrastructure ~60% complete (dev environment healthy; staging + prod scaffolded).
- Observability MVP live in dev.
- Threat model complete; SOC 2 evidence collection started.
- Plan bidirectional shipped. BrM connector 25% done. HPMS in design.

---

## 7. Decision points requiring executive input

The following are decisions the plan can't make itself — each needs a call from product + engineering leadership before the phase kicks off. Recommend a 60-minute exec review after this doc is read.

1. **Staffing scenario (A/B/C in § 4)** — this cascades into every timeline. Recommend A if the product is on the enterprise roadmap; B if MVP1 is the goal and MVP2 is a "we'll see" bet.
2. **StateRAMP / FedRAMP path** — pursue in parallel with MVP2, or defer to MVP3, or skip entirely (only sell to cities + private sector)? Cost: $200-500k + 12-18 months.
3. **Hosting model** — Aurigo-hosted multi-tenant SaaS, or per-customer single-tenant in customer's AWS account, or offer both? Impacts Phase 1 infra design.
4. **Observability + APM vendor** — Datadog / New Relic / Grafana Cloud / AWS-native / align with existing Aurigo platform. Ties to Phase 3.
5. **Aurigo-parent SOC 2 leverage** — does Aurigo have a corporate SOC 2 that this product can inherit / extend, or do we start a Type I from scratch? Impacts Phase 2 timeline by 6+ months.
6. **First-customer profile** — city (fast, no compliance), county (moderate), state DOT (slow, high compliance, high ACV). The plan changes phase priorities significantly.
7. **Integration priority reorder** — if the first customer is Aurigo Plan-committed but doesn't use BrM, reorder Phase 4 to lead with Plan bidirectional + a customer-specific integration. (Plan bidirectional is item 1 already — this holds.)
8. **Primus vs Masterworks investment split** — the audit's revenue-unlock story is state DOT-focused (Masterworks). Should Primus (private sector) get equal Phase 4 investment, or accept that Masterworks is the lead brand and Primus follows 2 quarters behind?

---

## Appendix A — Effort roll-up

| Phase | Description | PD (single engineer) | Weeks (4-eng pod) |
|---|---|---|---|
| 0 | Foundation hardening | 19 | 1-2 |
| 1 | Deploy infrastructure | 26 | 2-3 (DevOps-led) |
| 2 | Security + compliance | 45 + external vendors | 3-4 (+ 12-mo SOC 2 clock) |
| 3 | Observability + ops | 27 | 2-3 |
| 4 | Integration builds (top 4) | 124 | 6-8 |
| 4b | Integration builds (5-8) | 53 | 3-4 |
| 5 | TAMP depth | 40 | 3-4 |
| 6 | Data migration tooling | 26 | 2-3 |
| 7 | Performance + scale | 23 | 2 |
| 8 | Product hardening | 52 | ongoing |
| 9 | Documentation | 31 | 3-4 (tech writer) |
| **Total** | | **466 PD** | **~9-12 months (Scenario A) / 18-24 months (Scenario B)** |

External vendor spend estimate:
- Pen test: $40-60k (Phase 2)
- SOC 2 tooling year 1: $25-50k (Phase 2, recurring)
- SOC 2 auditor year 1: $30-50k (year 2+, once Type II window opens)
- StateRAMP (if pursued): $200-500k + 12-18 months (Phase 2 decision)
- APM (Datadog Pro tier for ~10 hosts): ~$2k/month = $24k/year (Phase 3, recurring)

---

**End of plan.**
