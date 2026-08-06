# Security Review

**Engineering Playbook · Aurigo Software Technologies**
Version 1.0 · July 2026

Use this template for the security review that gates any of the following: (a) a PR that touches auth, tenancy, data access, or file upload; (b) any architecture change that adds a new service, data store, or external integration; (c) any new feature that handles PII, financial data, or asset ownership records.

Aurigo customers are public agencies (DOTs, cities, counties) and private infrastructure owners. A security incident is not just a bug — it can breach FedRAMP-adjacent controls, trigger regulatory disclosure, and end procurement relationships. Do not skip this review.

---

## How to Use

1. The PR author or feature owner fills every section that applies.
2. Mark items `Pass`, `Fail`, `N/A — [reason]`, or `Waived — [approver + ticket]`. Never leave blank.
3. Attach the completed template to the PR description or RFC.
4. At least one reviewer from the Platform Security list must sign off before merge to `main` or acceptance of the RFC.
5. Any **Fail** blocks merge. Any **Waived** must reference an approved risk-acceptance ticket signed by an EM or higher.

---

## Review Header

| Field | Value |
|-------|-------|
| **Review ID** | SEC-YYYY-NNNN |
| **PR / RFC** | *[link]* |
| **Author** | *[Name]* |
| **Reviewer (Security)** | *[Name]* |
| **Product** | Masterworks / Primus / Platform |
| **Change Type** | PR / Architecture / New Feature / New Integration |
| **Data Classification Touched** | Public / Internal / Confidential / Restricted-PII |
| **Review Date** | YYYY-MM-DD |
| **Threat Model Updated?** | Yes / No / N/A |

**One-paragraph summary of the change:**
*[3-5 sentences: what changes, why, and what data/attack surface is affected.]*

---

## Section 1 — Authentication

*Applies whenever the change touches identity, sessions, or login flows.*

| # | Check | Result | Notes |
|---|-------|--------|-------|
| A-01 | Every new API endpoint has `[Authorize]` or explicit `[AllowAnonymous]` with a comment justifying the exception | Pass / Fail | *[file:line]* |
| A-02 | JWT is validated against Aurigo Identity issuer (no bypass, no dev-mode auth in code paths reachable in prod) | Pass / Fail | |
| A-03 | JWT signing key comes from AWS Secrets Manager or Parameter Store — never hard-coded | Pass / Fail | |
| A-04 | Token expiry is enforced (`ValidateLifetime = true`) and clock skew is bounded (`ClockSkew <= TimeSpan.FromMinutes(2)`) | Pass / Fail | |
| A-05 | Refresh token rotation is enforced — old refresh tokens are invalidated on use | Pass / Fail | N/A if not touching refresh flow |
| A-06 | No custom "sudo" or "impersonation" mode without a security review and audit log entry | Pass / Fail | |
| A-07 | Password reset / MFA change flows require step-up auth | Pass / Fail | N/A if not touching |

---

## Section 2 — Authorization (RBAC + Tenancy)

*This is where Aurigo has been burned the most historically. Read every check twice.*

| # | Check | Result | Notes |
|---|-------|--------|-------|
| B-01 | Every new endpoint enforces role via `[Authorize(Roles="...")]` or policy — no "anyone authenticated can hit this" endpoints on non-public data | Pass / Fail | |
| B-02 | The role list matches the RBAC matrix in `vol-3-architecture/08-authorization.md` | Pass / Fail | |
| B-03 | **TenantId comes from the JWT claim only** — never from a request body, query string, path parameter, or header | **Pass / Fail** | *[Verify with `git grep` for `tenantId` in DTOs]* |
| B-04 | Every new aggregate root entity has a `TenantId` property and it is set from the current-user tenant on insert | Pass / Fail | |
| B-05 | Every new DbSet is covered by the `ITenantScoped` global query filter in the DbContext | Pass / Fail | |
| B-06 | No raw SQL (`FromSqlRaw`, `ExecuteSqlRaw`) that bypasses the global query filter without an explicit tenant check | Pass / Fail | |
| B-07 | Cross-tenant references (e.g., "share this asset with another tenant") are explicitly flagged in the DTO name and require a dedicated authorization check | Pass / Fail | |
| B-08 | Object-level (row-level) authorization: a user cannot fetch or mutate rows they should not see even within their tenant | Pass / Fail | *[e.g., a field engineer cannot mutate work orders assigned to another district]* |
| B-09 | The 404 vs 403 leak is avoided — return 404 when a row exists but belongs to a different tenant (never 403, which confirms existence) | Pass / Fail | |
| B-10 | Integration tests cover tenant-isolation for every new endpoint (`TenantA` cannot see `TenantB` data) | Pass / Fail | |

**Aurigo-specific multi-tenant risks (mandatory verification):**

- [ ] **B-11** — No new caching layer that keys on entity ID without also keying on `TenantId`. *(A cache miss/hit crossover across tenants is a data leak.)*
- [ ] **B-12** — No new background job that iterates over all rows without a tenant partition. *(A job crashing mid-run must not skip tenants or corrupt data across tenants.)*
- [ ] **B-13** — No new event published on EventBridge without `tenantId` in the event payload. Consumers must filter by tenant.
- [ ] **B-14** — No new SQS message consumed without validating the `tenantId` in the message body matches the intended action.

---

## Section 3 — Input Validation

| # | Check | Result | Notes |
|---|-------|--------|-------|
| C-01 | Every request DTO with user input has a FluentValidation validator | Pass / Fail | |
| C-02 | String lengths are bounded (no unbounded `string` accepting arbitrary length) | Pass / Fail | |
| C-03 | Enums are validated to allowed values (no coercion from arbitrary integers) | Pass / Fail | |
| C-04 | Numeric ranges are bounded where semantically valid | Pass / Fail | |
| C-05 | File uploads validate MIME type by magic-byte inspection (not just filename extension) | Pass / Fail | N/A if no upload |
| C-06 | File upload size is capped at the API gateway AND at the app layer | Pass / Fail | N/A if no upload |
| C-07 | Any user-supplied URL is validated to prevent SSRF (allow-list of hosts, no `169.254.169.254`, no `localhost`) | Pass / Fail | N/A if no user URLs |
| C-08 | GUIDs and IDs are typed (`Guid`, `long`) not `string` — prevents crafted ID injection | Pass / Fail | |
| C-09 | Deserialization has bounded depth and disallows polymorphic type binders | Pass / Fail | |

---

## Section 4 — Injection Attacks

| # | Check | Result | Notes |
|---|-------|--------|-------|
| D-01 | **SQL injection** — no string concatenation into `FromSqlRaw`/`ExecuteSqlRaw`. All parameters are `FormattableString` or `SqlParameter` | Pass / Fail | |
| D-02 | **PostGIS injection** — no user-supplied string interpolated into `ST_GeomFromText`, `ST_Contains`, or any spatial function. Use NetTopologySuite `Geometry` types instead | **Pass / Fail** | *[Aurigo-specific — search for `ST_` in raw SQL]* |
| D-03 | **PostGIS injection** — no user-supplied SRID; always use `4326` or a fixed set | Pass / Fail | |
| D-04 | **XSS** — no server-rendered HTML that includes unescaped user input. React default escaping is preserved (no `dangerouslySetInnerHTML` on user content) | Pass / Fail | |
| D-05 | **CSV injection** — CSV export escapes leading `=`, `+`, `-`, `@` in cell values | Pass / Fail | N/A if no export |
| D-06 | **JSON injection** — no `Newtonsoft.Json` `TypeNameHandling.All` or equivalent | Pass / Fail | |
| D-07 | **Command injection** — no `Process.Start` with user-controlled arguments; no shell invocation | Pass / Fail | |
| D-08 | **LDAP injection** — N/A for Aurigo, but if any new AD integration is added, escape LDAP filters | Pass / Fail / N/A | |
| D-09 | **XML/XXE** — any XML parsing uses `DtdProcessing.Prohibit` and `XmlResolver = null` (relevant for TAMP export/import) | Pass / Fail | N/A if no XML |
| D-10 | **Log injection** — user input is not concatenated into log messages without escaping newlines | Pass / Fail | |

---

## Section 5 — CSRF and Cross-Origin

| # | Check | Result | Notes |
|---|-------|--------|-------|
| E-01 | All state-changing endpoints use `POST`/`PUT`/`PATCH`/`DELETE` — no state changes on `GET` | Pass / Fail | |
| E-02 | CORS is configured with an allow-list — never `*` in production | Pass / Fail | |
| E-03 | Cookies (if used) have `Secure`, `HttpOnly`, `SameSite=Strict` or `Lax` | Pass / Fail | N/A if pure Bearer auth |
| E-04 | No sensitive operation is protected only by referrer header | Pass / Fail | |

---

## Section 6 — Secrets Management

| # | Check | Result | Notes |
|---|-------|--------|-------|
| F-01 | No secrets in source code — verified via TruffleHog / GitLeaks CI check | Pass / Fail | |
| F-02 | Secrets are read from AWS Secrets Manager or SSM Parameter Store | Pass / Fail | |
| F-03 | No secrets in Docker image layers | Pass / Fail | |
| F-04 | No secrets in commit history (if introduced accidentally, secret must be rotated even if commit is reverted) | Pass / Fail | |
| F-05 | Secrets rotate on a defined schedule (documented in `vol-3-architecture/07-security.md`) | Pass / Fail | |
| F-06 | Development / staging secrets are distinct from production — no shared secrets across environments | Pass / Fail | |

---

## Section 7 — Data Exposure (PII and Sensitive Data)

| # | Check | Result | Notes |
|---|-------|--------|-------|
| G-01 | No PII (email, phone, SSN, address, name) logged at `Debug` or `Info` level. If needed, hashed or masked | Pass / Fail | |
| G-02 | Error responses do not include stack traces in production | Pass / Fail | |
| G-03 | Error responses do not include internal identifiers (DB IDs, internal path names) | Pass / Fail | |
| G-04 | Response DTOs are explicitly designed — no `[return: Entity]` patterns leaking internal fields | Pass / Fail | |
| G-05 | Bulk-export endpoints enforce rate limits and pagination — no "export 10M rows" endpoint | Pass / Fail | |
| G-06 | Data at rest is encrypted (RDS encryption, S3 SSE, EBS encryption) | Pass / Fail | |
| G-07 | Data in transit is encrypted (TLS 1.2+ on all connections, including internal service-to-service) | Pass / Fail | |
| G-08 | New PII fields are tagged in the data catalog and covered by the data retention policy | Pass / Fail | |
| G-09 | GDPR / CCPA delete-request flow can locate and remove the new PII field | Pass / Fail | |

---

## Section 8 — API Security

| # | Check | Result | Notes |
|---|-------|--------|-------|
| H-01 | Rate limits are applied to every public endpoint (default: 100 req/min per tenant unless justified) | Pass / Fail | |
| H-02 | Anonymous endpoints (login, health) have stricter rate limits per IP | Pass / Fail | |
| H-03 | Bulk endpoints (list, search) have pagination — no unbounded result sets | Pass / Fail | |
| H-04 | GraphQL endpoints (if applicable) have depth and complexity limits | Pass / Fail / N/A | |
| H-05 | New endpoints are registered in the API gateway config with the correct auth policy | Pass / Fail | |
| H-06 | Correlation ID (`X-Request-ID`) is propagated and logged for every request | Pass / Fail | |
| H-07 | No debug or admin endpoints exposed in production builds | Pass / Fail | |

---

## Section 9 — Dependency Vulnerabilities

| # | Check | Result | Notes |
|---|-------|--------|-------|
| I-01 | `dotnet list package --vulnerable --include-transitive` returns no High or Critical items | Pass / Fail | |
| I-02 | `npm audit --production` returns no High or Critical items | Pass / Fail | |
| I-03 | Snyk / GitHub Advanced Security scan is green | Pass / Fail | |
| I-04 | Any new dependency has been reviewed for license (MIT, Apache 2.0, BSD OK; GPL/AGPL blocked without legal review) | Pass / Fail | |
| I-05 | Any new dependency has active maintenance (last release within 12 months, no known abandoned status) | Pass / Fail | |
| I-06 | Docker base images are pinned to a digest, not just a tag | Pass / Fail | |
| I-07 | Docker base images run `trivy` scan with 0 High/Critical | Pass / Fail | |

---

## Section 10 — Infrastructure Security

| # | Check | Result | Notes |
|---|-------|--------|-------|
| J-01 | New AWS resources follow least-privilege IAM (no `*:*` policies) | Pass / Fail | |
| J-02 | Security groups do not open `0.0.0.0/0` except on ALB/API Gateway | Pass / Fail | |
| J-03 | New S3 buckets have `BlockPublicAccess` enabled | Pass / Fail | |
| J-04 | New RDS instances have `PubliclyAccessible = false` | Pass / Fail | |
| J-05 | KMS keys are used for encryption of any new sensitive data store | Pass / Fail | |
| J-06 | CloudTrail and GuardDuty coverage extend to any new AWS account or region | Pass / Fail | |
| J-07 | Terraform / IaC changes have been reviewed by Platform Eng | Pass / Fail | |

---

## Section 11 — Threat Model

*Required for architecture changes and new features. Optional for PRs unless the PR introduces a new trust boundary.*

### Assets

*What we are protecting.*

| Asset | Sensitivity | Owner |
|-------|-------------|-------|
| *[e.g., Work order data]* | Confidential | Product Maintain |
| *[e.g., Asset GIS coordinates]* | Confidential *(some agencies treat as critical infrastructure)* | Product Plan |

### Trust Boundaries

*Where trust changes.*

| Boundary | From | To | Auth mechanism |
|----------|------|-----|----------------|
| API Gateway → Fargate | Internet | Internal VPC | JWT |
| Fargate → RDS | Internal VPC | Data plane | IAM DB auth + password |
| Fargate → Maximo (integration) | Internal VPC | Customer VPN | OAuth 2.0 client credentials |

### STRIDE

| Threat | Applies? | Mitigation | Residual Risk |
|--------|----------|------------|---------------|
| **S**poofing (identity) | Yes / No | JWT + short expiry + refresh rotation | Low |
| **T**ampering (integrity) | Yes / No | Signed JWT, HTTPS everywhere, audit log | Low |
| **R**epudiation (denial of action) | Yes / No | Audit log with actor, action, tenant, timestamp | Low |
| **I**nformation disclosure | Yes / No | Encryption at rest and in transit, RBAC, tenant isolation | Low / Medium |
| **D**enial of service | Yes / No | Rate limits, WAF, autoscaling | Medium |
| **E**levation of privilege | Yes / No | RBAC enforced server-side, no client-side authz decisions | Low |

### Risk Register (this change)

*Only list risks introduced or increased by this change.*

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|------------|-------|
| *[e.g., New CSV export endpoint could be used to exfiltrate large datasets]* | Medium | Medium | Rate limit + audit log on export + row limit per request | Backend Lead |

---

## Section 12 — Sign-Off

| Signer | Role | Verdict | Date | Notes |
|--------|------|---------|------|-------|
| *[Name]* | Author | Self-review complete | YYYY-MM-DD | |
| *[Name]* | Peer Reviewer (Backend or Frontend) | Pass / Request Changes | YYYY-MM-DD | |
| *[Name]* | Platform Security Reviewer | Pass / Request Changes | YYYY-MM-DD | Required for merge |
| *[Name]* | EM (of affected product) | Waiver approved | YYYY-MM-DD | Required only if any `Waived` items present |
| *[Name]* | CISO / VP Security | Approved | YYYY-MM-DD | Required for architecture changes and any Restricted-PII touching change |

**Merge is blocked until:**

- No `Fail` items remain, OR each remaining `Fail` has been converted to `Waived` with an approved risk-acceptance ticket.
- Platform Security Reviewer has signed off.
- For architecture / Restricted-PII changes, CISO or delegate has signed off.

---

_Template maintained in vol-9-templates/security-review-template.md. Reviewed quarterly by Platform Security._
