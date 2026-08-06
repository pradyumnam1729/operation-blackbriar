# Threat Catalog — Seed

> Companion to `data-flow-diagrams.md`. Pre-populated so the Week 3 workshop starts hot.
> STRIDE = **S**poofing / **T**ampering / **R**epudiation / **I**nformation disclosure / **D**oS / **E**levation of privilege.
> Severity uses CVSS-style: **Critical / High / Medium / Low**.
> Every "Existing mitigation" cell either cites a doc in `vol-3-architecture/` or `vol-6-integration-strategy/`, or is marked **OPEN — no standard exists yet** for the workshop to convert to an ADR follow-up.

---

## Section A — Already-Found Bugs (from `17-tenant-isolation-audit.md`)

These are not seeded threats — they are **confirmed exploits** that pre-date the workshop. They are listed first so the workshop cannot skip past them. Fix ownership is already assigned in the audit; the workshop only re-confirms severity and blast radius.

| ID | DFD | STRIDE | Threat | Existing mitigation | Residual risk | Owner |
|---|---|---|---|---|---|---|
| BUG-01 | DFD-1 | Elevation of privilege | `SsoConfigController` trusts `{tenantId}` path parameter, applies `IgnoreQueryFilters()` — Tenant A Admin can read/write/delete Tenant B's SSO OIDC config. Write path enables auth-takeover via authority URL replacement. | **OPEN — fix pending.** Recommended: inject `ICurrentTenant`, reject if `tenantId != _currentTenant.Value`. See `17-tenant-isolation-audit.md` § BUG-01. Regression test exists (unskipped) in `TenantIsolationTests.cs`. | **Critical** — full cross-tenant auth takeover | `backend-lead` |
| BUG-02 | DFD-2 | Information disclosure | `GetAssetAuditHistoryHandler` queries `AuditLog` by `EntityId` only, no `TenantId` filter. Tenant A user with a Tenant B asset UUID can retrieve Tenant B's full audit trail (cost, ARV, risk, condition deltas). | **OPEN — fix pending.** Recommended: `.Where(x => x.TenantId == _currentTenant.Value)` OR load Asset via filtered DbSet first. See `17-tenant-isolation-audit.md` § BUG-02. | **High** — full business data exposure | `backend-lead` |
| BUG-03 | DFD-1 | Elevation of privilege | `SsoConfigController` write actions (PUT/DELETE) — extension of BUG-01. Higher severity than the read path (BUG-01) because PUT can silently redirect users to attacker-controlled IdP. | **OPEN — same fix as BUG-01.** | **Medium** (already subsumed by BUG-01 Critical) | `backend-lead` |
| BUG-04 | DFD-1 | Spoofing | Non-SSO login uses `FindByEmailAsync` (cross-tenant by design) with no tenant-mismatch check post-lookup. Relies on `TenantProvisioner`'s app-level email uniqueness with no DB-level constraint. | **OPEN — needs migration** for `UNIQUE(lower(email))` on `app_users`, OR add explicit `tenantId` to login request + validate. See `17-tenant-isolation-audit.md` § BUG-04. | **Medium** — defense-in-depth gap, not currently exploitable | `backend-lead` |

**Workshop directive:** Do NOT re-debate severity of BUG-01–BUG-04. Confirm the owner and due date, then move on.

---

## Section B — Seeded STRIDE Threats

### DFD-1 — Login / JWT / Tenant Scoping

| ID | DFD | STRIDE | Threat | Existing mitigation | Residual risk | Owner |
|---|---|---|---|---|---|---|
| T-01 | DFD-1 | Spoofing | Stolen JWT replayed from attacker host. 8-hour access token = 8-hour attack window. | Short-lived access token (8h) + refresh token in httpOnly cookie prevents XSS theft. TLS 1.2+ prevents interception. `07-security.md` § Token Lifetime. | Low | `backend-lead` |
| T-02 | DFD-1 | Spoofing | Forged JWT with hand-crafted claims (bypass `lambda-authorizer`). | JWT signature validated against `lambda-authorizer` JWKS public key on every request. `07-security.md` § JWT Validation. | Low | `backend-lead` |
| T-03 | DFD-1 | Elevation of privilege | Refresh-token replay after logout — attacker keeps a captured refresh cookie and mints new access tokens indefinitely. | **OPEN — no standard exists yet.** Refresh-token rotation on use (invalidate old on issuance of new) is `security-review-template.md` A-05 but not documented as implemented. Workshop must confirm implementation OR file follow-up ADR. | Medium (pending confirmation) | `backend-lead` |
| T-04 | DFD-1 | Elevation of privilege | SuperAdmin impersonation abuse — an internal Aurigo employee impersonates a tenant without cause. | Impersonation token expires in 1h, every mutation logged with `impersonatorId`, real-time alert to security team. `08-authorization.md` § SuperAdmin Impersonation. | Low | `backend-lead` + `devops` (alert wiring) |
| T-05 | DFD-1 | Information disclosure | JWT logged in application logs during debug — token leaks to Splunk/CloudWatch. | `HttpBodyScrubber` (`Application/Integrations/Diagnostics/HttpBodyScrubber.cs`) strips `Authorization` header from outbound HTTP logs. **Gap:** verify same scrubbing on inbound request logs and MediatR pipeline logs. Flag as workshop item. | Medium | `backend-lead` |

### DFD-2 — Asset Create / Audit / PostGIS

| ID | DFD | STRIDE | Threat | Existing mitigation | Residual risk | Owner |
|---|---|---|---|---|---|---|
| T-06 | DFD-2 | Tampering | SQL injection via crafted asset name / notes / metadata. | EF Core parameterized queries exclusively; zero `FromSqlRaw` in production code (confirmed `17-tenant-isolation-audit.md` § 4.1). `07-security.md` § SQL Injection. | Low | `backend-lead` |
| T-07 | DFD-2 | Tampering | PostGIS injection via crafted GeoJSON that bypasses NetTopologySuite parsing. | NetTopologySuite parses input; SRID fixed at `4326`; no user-supplied string interpolated into `ST_*` functions. `security-review-template.md` D-02/D-03. | Low | `backend-lead` |
| T-08 | DFD-2 | Repudiation | `AuditInterceptor` bypass — a developer adds `.SaveChangesAsync(cancellationToken, acceptAllChangesOnSuccess: false)` or opens a raw connection to write without going through EF. | `AuditInterceptor` cannot be bypassed via EF (registered globally). Raw-SQL writes are absent from production code. **Gap:** no `NetArchTest` assertion prevents future bypass. Flag as ADR follow-up. | Medium | `tech-architect` (arch-test) + `backend-lead` |
| T-09 | DFD-2 | Information disclosure | Cross-tenant asset UUID enumeration returns 403 (confirming existence) instead of 404. | `security-review-template.md` B-09 requires 404. All `AssetsController` paths confirmed to return 404 via EF global query filter (`17-tenant-isolation-audit.md` § 4.2). | Low | `backend-lead` |
| T-10 | DFD-2 | DoS | Unbounded `notes` / `description` field on asset — 10 MB payload persisted per record. | FluentValidation `MaximumLength(200)` on all string inputs (`07-security.md` § Input Validation). **Gap:** verify `notes` and `metadata` fields have explicit limits. | Low | `backend-lead` |

### DFD-3 — Inspection Submit / Cascade

| ID | DFD | STRIDE | Threat | Existing mitigation | Residual risk | Owner |
|---|---|---|---|---|---|---|
| T-11 | DFD-3 | Tampering | Malicious Inspector downgrades bridge condition score to force spurious capital need. | RBAC gates the endpoint (`Inspector` role). Audit log captures old/new values (`07-security.md` § Audit Log). **OPEN — no anomaly-detection standard** exists for outlier condition ratings; workshop should flag as future ML/audit-review task. | Medium — human threat, non-cryptographic | `backend-lead` + `qa-lead` |
| T-12 | DFD-3 | Tampering | Boundary math error in `RulCalculator` / `ArvCalculator` — negative or non-finite input silently produces garbage. | Pure C# calculators with ≥90% coverage per `CLAUDE.md`. **Gap:** verify property-based / fuzz coverage exists for boundary inputs (NaN, Infinity, extreme dates). | Low | `qa-lead` |
| T-13 | DFD-3 | Repudiation | Partial cascade failure — asset.condition updated but capital_need INSERT failed; audit log records both states without indicating the discrepancy. | Handler wraps writes in single transaction; `SaveChangesInterceptor` records all-or-nothing. Integration test coverage is a QA regression item. | Low | `backend-lead` |
| T-14 | DFD-3 | Elevation of privilege | Inspector edits *another* Inspector's inspection (violates B-08 row-level authz). | `08-authorization.md` permission matrix: Inspector can edit own only; AssetManager+ can edit any. Enforced in handler by checking `inspection.CreatedBy == currentUser.Id`. **Gap:** confirm handler check exists (not just controller RBAC). | Medium | `backend-lead` |

### DFD-4 — Capital Need Push / Aurigo Plan / Reverse Flow

| ID | DFD | STRIDE | Threat | Existing mitigation | Residual risk | Owner |
|---|---|---|---|---|---|---|
| T-15 | DFD-4 | Spoofing | Rogue EAM/Plan credential — attacker steals a tenant's Plan OAuth client_secret and impersonates the sync worker. | Per-tenant credentials in Secrets Manager (`vol-6-integration-strategy/00-integration-overview.md` § Credential Storage). 180-day rotation for OAuth secrets. **Gap:** verify credential rotation is scheduled, not just documented. | Medium | `devops` + `integration-strategist` |
| T-16 | DFD-4 | Tampering | OAuth access-token replay (1-hour token captured in log/breakpoint) → attacker submits capital needs impersonating tenant. | `HttpBodyScrubber` scrubs `Authorization` header from outbound logs. Access-token TTL is 1h. **Gap:** no allowlist verification that log sinks (Datadog, CloudWatch) don't index scrubbed patterns. | Medium | `backend-lead` + `devops` |
| T-17 | DFD-4 | Information disclosure | Cross-tenant PII in sync logs — a background worker logs `TenantA` and `TenantB` context in the same log line during batching. | Workers scope `db.CurrentTenantId` per iteration (`17-tenant-isolation-audit.md` § 1.4). Log context includes `tenantId`. **OPEN — no standard** for structured-log tenant-tag enforcement. Workshop to file ADR: log context propagation. | Medium | `backend-lead` + `devops` |
| T-18 | DFD-4 | DoS | Retry storm — Plan API returns 500, worker retries immediately across all tenants, DoSes Plan (and Maintain worker pool). | **OPEN — no standard exists yet.** No exponential-backoff / dead-letter documented for `AurigoPlanStatusPollingWorker`. Cityworks/Maximo workers may or may not have this; workshop confirms and ADRs the pattern. | High | `integration-strategist` + `devops` |
| T-19 | DFD-4 | Tampering | Webhook replay — Plan (or Cityworks/Maximo webhooks) reposts the same status change; handler treats as new event, double-writes history. | **OPEN — no standard exists yet.** Echo detection exists in Cityworks adapter but no cross-cutting webhook idempotency-key standard. Workshop ADR follow-up. | Medium | `integration-strategist` |
| T-20 | DFD-4 | Spoofing | SSRF on integration URL configuration — Admin enters `http://169.254.169.254/latest/meta-data/` as Plan base URL, adapter fetches AWS instance metadata. | Outbound URL allowlist (`07-security.md` § SSRF). `security-review-template.md` C-07. **Gap:** verify allowlist covers `169.254.169.254`, `localhost`, `10.0.0.0/8`, `.internal`. | Medium | `integration-strategist` + `devops` |

### DFD-5 — TAMP Generate / Lock / Public Publish

| ID | DFD | STRIDE | Threat | Existing mitigation | Residual risk | Owner |
|---|---|---|---|---|---|---|
| T-21 | DFD-5 | Information disclosure | Draft TAMP version leaked via public URL. | `PublicTampController` filters `status IN ('Locked','Submitted')` (`17-tenant-isolation-audit.md` § 1.2). Regression test would enforce. | Low | `backend-lead` |
| T-22 | DFD-5 | Tampering | Watermark strip / raw-PDF path — a hidden query param or direct S3 URL bypasses the Aurigo attribution + version tag. | **OPEN — no standard exists yet.** No documented mechanism for enforcing watermark on all TAMP output paths. Workshop ADR follow-up. | Medium | `frontend-lead` + `tech-architect` |
| T-23 | DFD-5 | Elevation of privilege | XSS via TAMP narrative markdown — Admin injects `<script>` or `<iframe>` in narrative, executes in every citizen's browser on public page and in printable PDF. | **OPEN — sanitization gap confirmed.** `TampNarrativeTab.tsx` and `ConsistencyLetterModal.tsx` render markdown without sanitization. `07-security.md` § XSS requires `HtmlSanitizer` for rich text. Workshop must assign fix + regression test. | **High** — full XSS on public page | `frontend-lead` + `backend-lead` |
| T-24 | DFD-5 | DoS | Public URL rate-limit gap — a scraper hammers `/public/tamp/{slug}/{version}` and DoSes Maintain, blocking legit consistency-determination readers on July 31. | **OPEN — no rate-limit standard** documented for `[AllowAnonymous]` endpoints beyond WAF defaults. `security-review-template.md` H-02 requires stricter anonymous-endpoint limits. Workshop ADR follow-up. | Medium | `devops` |
| T-25 | DFD-5 | Repudiation | TAMP submission attestation — after Locked, an internal actor claims "I never approved that version." | Audit log captures the `mark-submitted` transition with `user_id` (`07-security.md` § Audit Log). Version is immutable after Lock (schema-enforced). | Low | `backend-lead` |

### Cross-Cutting (all DFDs)

| ID | DFD | STRIDE | Threat | Existing mitigation | Residual risk | Owner |
|---|---|---|---|---|---|---|
| T-26 | all | Information disclosure | Secret leakage in logs (JWT, OAuth, DB password interpolated into error message). | `HttpBodyScrubber` for outbound. **Gap:** inbound + internal-log scrubbing not formalized. `07-security.md` § Secrets Management. | Medium | `backend-lead` + `devops` |
| T-27 | all | Elevation of privilege | Supply-chain compromise — a transitive NuGet or npm dep ships malicious code. | Dependabot enabled per repo; GitHub secret scanning on. **Gap:** Snyk not integrated; `dotnet list package --vulnerable` not gated in CI (`vol-8-roadmaps/11-mvp1-execution-plan.md` § Phase 2). OTel CVE (`project_otel_cve_1_10` memory) was a recent example. | High | `devops` + `tech-architect` |
| T-28 | all | Tampering | CSRF on state-changing endpoints (attacker page POSTs on user's behalf using cookie). | Pure Bearer auth on API (no auth cookie sent with cross-site requests). Refresh cookie is `SameSite=Strict` / `Lax` per `security-review-template.md` E-03. Confirm setting. | Low | `backend-lead` |
| T-29 | all | Elevation of privilege | IDOR beyond BUG-01 — a controller trusts a `{id}` path param that maps to another aggregate root without going through the tenant-filtered DbSet. | Confirmed clean for `assets`, `capital-needs`, `job-orders`, `inspections`, `reports/tamp/versions` (`17-tenant-isolation-audit.md` § 4.2). **Gap:** any new controller. Workshop → require new-controller checklist item. | Low (with checklist) | `tech-architect` |
| T-30 | all | Information disclosure | Verbose error responses leak internal path names, stack traces, DB IDs. | Production error responses use RFC 7807 problem-details with no stack (`security-review-template.md` G-02/G-03). Confirm middleware. | Low | `backend-lead` |

---

## Section C — Summary

**Total seeded (excluding BUG-01…BUG-04):** 30 threats.

**STRIDE distribution:**

| Category | Count | IDs |
|---|---|---|
| Spoofing | 4 | T-01, T-02, T-15, T-20 |
| Tampering | 8 | T-06, T-07, T-11, T-12, T-16, T-19, T-22, T-28 |
| Repudiation | 3 | T-08, T-13, T-25 |
| Information disclosure | 8 | T-05, T-09, T-17, T-21, T-23 (bleeds to E), T-26, T-30, +BUG-02 |
| Denial of service | 3 | T-10, T-18, T-24 |
| Elevation of privilege | 7 | T-03, T-04, T-14, T-23, T-27, T-29, +BUG-01, BUG-03 |

*(T-23 is dual-classified as I/E; counted once each above and in the summary reporting.)*

**Threats flagged `OPEN — no standard exists yet`** (require follow-up ADR post-workshop):

1. **T-03** — Refresh-token rotation-on-use: is it implemented? If not, ADR + fix.
2. **T-08** — `NetArchTest` assertion to prevent bypass of `AuditInterceptor`.
3. **T-11** — Anomaly detection for outlier inspection ratings (future ML / audit-review process).
4. **T-17** — Structured-log tenant-tag enforcement standard.
5. **T-18** — Exponential-backoff + dead-letter standard for integration polling workers.
6. **T-19** — Webhook idempotency-key standard (cross-cutting, replaces per-adapter ad-hoc echo detection).
7. **T-22** — Watermark enforcement standard on all TAMP output paths (HTML, PDF, direct-download).
8. **T-23** — Markdown sanitization for TAMP narrative — code fix (not ADR alone), regression test required.
9. **T-24** — Rate-limit standard for `[AllowAnonymous]` endpoints.
10. **T-27** — Snyk integration + `dotnet list package --vulnerable` CI gate.
11. **T-29** — New-controller checklist enforcement (playbook item — Definition of Done addition).

---

## Section D — Threats Explicitly Out of Scope

Documented so the workshop doesn't re-litigate:

- **Physical / social-engineering attacks** against Aurigo staff or customer agencies (owned by Corporate Security, not this workshop).
- **AWS IaaS-level compromises** (compromise of AWS control plane) — inherited risk, not modelable at this layer.
- **Attacks on `lambda-authorizer` itself** — that's a sibling service with its own threat model; we trust its output post-JWT-signature-validation.
- **Denial-of-wallet on external APIs** (e.g., someone runs up Aurigo Plan API bill via loop) — cost-monitoring is a DevOps concern in `vol-8-roadmaps/11-mvp1-execution-plan.md` § Phase 3, not a security threat here.
