# Security Review — Aurigo Maintain Threat Model (Workshop Output)

**Derived from:** `engineering-playbook/vol-9-templates/security-review-template.md`
**Instructions:** at the workshop, copy this file to `vault/security/SEC-YYYY-NNNN-maintain-threat-model.md` and fill in the empty cells. The Aurigo-Maintain-specific sections below are **pre-filled**. Do not re-derive them — challenge them if wrong, otherwise proceed.

---

## How to Use

1. The Tech Architect (scribe) drives edits during the workshop.
2. Mark items `Pass`, `Fail`, `N/A — [reason]`, or `Waived — [approver + ticket]`. Never leave blank.
3. Attach the completed template to the workshop read-out.
4. At least one reviewer from the Platform Security list must sign off before the review is closed.
5. Any **Fail** blocks acceptance into `vault/security/`. Any **Waived** must reference an approved risk-acceptance ticket signed by an EM or higher.

---

## Review Header

| Field | Value |
|-------|-------|
| **Review ID** | SEC-YYYY-NNNN _(assigned at workshop)_ |
| **PR / RFC** | Threat-model workshop (Week 3) — no PR |
| **Author** | Tech Architect (scribe) |
| **Reviewer (Security)** | _[assign at workshop]_ |
| **Product** | **Aurigo Maintain** (both Primus + Masterworks brands) |
| **Change Type** | **Architecture-wide threat model** — recurring, not a per-PR review |
| **Data Classification Touched** | **Confidential** (asset condition, capital financials) + **Restricted-PII** (inspector PII, agency user PII) |
| **Review Date** | _[workshop date]_ |
| **Threat Model Updated?** | Yes — this document IS the threat model |

**One-paragraph summary of the change:**

Whole-platform baseline threat model for Aurigo Maintain. Covers five primary data flows (login → JWT → tenant scoping; asset create → audit → PostGIS; inspection submit → RUL/ARV/risk cascade; capital-need push → Aurigo Plan reverse-flow; TAMP generate → lock → public publish). Bidirectional integrations to Aurigo Plan, Cityworks, Maximo, Primavera P6, and ArcGIS are in scope. The four known tenant-isolation bugs (BUG-01…BUG-04 per `17-tenant-isolation-audit.md`) are treated as confirmed exploits pending fix, not as new threats.

---

## Pre-Filled System Context

### System Under Review

**Aurigo Maintain** — .NET 8 Web API + React 18 SPA. Sibling microservice to the existing MW Platform 2.0 stack (NextGen Essentials, DocMgmt, Workflow, Notifications, Aurigo Engage AI). Deployed to AWS ECS Fargate behind ALB behind CloudFront + WAF. Data plane is RDS PostgreSQL 16 with PostGIS 3.4 extension.

### Multi-Tenant Model

- **Row-level isolation** on shared RDS via `TenantId (uuid)` on every aggregate root.
- Every `ITenantOwned` entity is registered with an EF Core global query filter that appends `WHERE tenant_id = <ICurrentTenant.Value> AND deleted_at IS NULL` to every query. See `08-authorization.md` § Row-Level Security.
- `ICurrentTenant.Value` is derived from the JWT `tenantId` claim only — never from request body/path/query/header. Violation of this rule is `security-review-template.md` B-03 and was the root cause of BUG-01.
- `.IgnoreQueryFilters()` requires a documented reason. All 50 current call sites are catalogued in `17-tenant-isolation-audit.md` (43 safe, 3 suspicious, 4 bugs).
- SuperAdmin cross-tenant operations use a separate `SuperAdminDbContext` with no query filters, gated by the `aurigo.superadmin` claim.

### Auth Model

- **JWT bearer** issued by the shared Aurigo `lambda-authorizer` service. Maintain validates only — does not issue.
- **JWT claims:** `sub` (userId UUID), `tenantId` (UUID), `role` (string), `email`, `exp`, `iat`. See `07-security.md` § JWT Claims Shape.
- **Access token lifetime:** 8h (in-memory in SPA). **Refresh token:** 30d (httpOnly cookie).
- **RBAC roles** (hierarchy — higher inherits lower): `ReadOnly < Inspector < AssetManager < Administrator < SuperAdmin`. Permission matrix in `08-authorization.md` § Permission Matrix.
- **[AllowAnonymous] endpoints:** `/health`, `/health/ready`, `/auth/login`, `POST /auth/sso/callback`, and the entire `PublicTampController` (`/public/tamp/{tenantSlug}/{versionTag}`). No others without security review.
- **SSO:** OIDC + SAML 2.0 planned for GA (`vol-8-roadmaps/03-ga.md` § Enterprise SSO). SsoConfigController exists today per-tenant — see BUG-01.

### External Systems (Trust Boundaries)

| System | Direction | Auth | Purpose | Adapter file |
|---|---|---|---|---|
| **Aurigo Plan** | Bidirectional | OAuth2 client-credentials per tenant | Capital-need push + status reverse-flow polling (15-min cadence) | `Infrastructure/ExternalClients/Aurigo/AurigoPlanIntegrationAdapter.cs` |
| **Aurigo Build** | Outbound | OAuth2 per tenant | Build status polling for job orders | `Infrastructure/BackgroundServices/BuildStatusPollingWorker.cs` |
| **Cityworks** | Bidirectional | Basic auth per tenant | Asset + work-order sync; hybrid write-back | `Infrastructure/ExternalClients/Cityworks/CityworksAdapter.cs` |
| **IBM Maximo** | Bidirectional | Basic auth or OAuth per tenant | Asset + work-order sync; hybrid write-back | `Infrastructure/ExternalClients/Maximo/MaximoAdapter.cs` |
| **Primavera P6** | Outbound | Basic auth per tenant | Project schedule sync | `Infrastructure/BackgroundServices/PrimaveraStatusPollingWorker.cs` |
| **ArcGIS Enterprise / Online** | Outbound | API key or SAML | Read-only asset geometry + jurisdiction boundaries | `Infrastructure/ExternalClients/ArcGis/ArcGisIntegrationAdapter.cs` |
| **SendGrid** | Outbound (stub today) | API key | Templated email notifications | `Infrastructure/ExternalClients/` (stub) |
| **DocMgmt** (MW Platform 2.0 sibling) | Bidirectional (stub today) | Service JWT | Inspection photo + attachment storage | `Application/ExternalServices/` (stub) |

Per `CLAUDE.md`: external integrations are **stubbed** behind interfaces. Real HTTP wiring is a 1-day swap; do not couple business logic to real APIs.

### Compliance Surface

- **FHWA 23 CFR § 515.9** — TAMP mandatory content sections (a)–(l). Every state DOT tenant produces a TAMP annually. Non-compliance = 10% NHPP withholding. See `vol-2-product-knowledge/domains/tamp.md`.
- **FHWA 23 CFR § 490** — PM2 performance metrics (pavement condition thresholds). Required in TAMP reporting.
- **SOC 2 Type II** — in prep for GA per `vol-8-roadmaps/03-ga.md` § SOC 2 Type II. Trust services criteria in scope: Security (CC), Availability (A), Confidentiality (C).
- **FISMA / FedRAMP Moderate** — aspirational for federal DOT customers; not in scope for MVP.
- **GDPR / CCPA** — right-to-erasure implemented via `TenantAdminController` PII-redaction endpoint (`07-security.md` § GDPR).
- **State-level open-records laws** — the `PublicTampController` publishes to satisfy public-record obligations. Draft-vs-published distinction is legally significant (see T-21).

### Data Classification

| Class | Examples | Storage | Encryption at rest | Retention |
|---|---|---|---|---|
| **Public** | Locked/Submitted TAMP versions, generated PDFs after publish | RDS + optional S3 for PDFs | KMS (default RDS/S3 encryption) | Indefinite (compliance archive) |
| **Confidential** | Asset condition scores, capital planning financials, cost estimates, ARV, risk scores, EAM integration credentials (indirect) | RDS + Secrets Manager (for creds) | KMS | Per tenant contract; default 7 years |
| **Restricted-PII** | Inspector name/email/role, TAMP submission attestations (signer name + timestamp), Aurigo Administrator PII | RDS | KMS | Redactable on GDPR/CCPA request; audit log tombstoned |
| **Draft / Internal** | Draft TAMP versions, in-progress inspections, unpushed capital needs | RDS | KMS | Purged 90 days after supersession |

---

## Section 1 — Authentication

| # | Check | Result | Notes |
|-------|--------|--------|-------|
| A-01 | Every new API endpoint has `[Authorize]` or explicit `[AllowAnonymous]` with a comment justifying the exception | | Confirmed clean today per audit; workshop to add DoD checklist item |
| A-02 | JWT is validated against Aurigo Identity issuer (no bypass, no dev-mode auth in code paths reachable in prod) | | |
| A-03 | JWT signing key comes from AWS Secrets Manager or Parameter Store — never hard-coded | | |
| A-04 | Token expiry is enforced (`ValidateLifetime = true`) and clock skew is bounded (`ClockSkew <= TimeSpan.FromMinutes(2)`) | | `07-security.md` uses 5 min — flag for tightening |
| A-05 | Refresh token rotation is enforced — old refresh tokens are invalidated on use | | **T-03 open** — verify at workshop |
| A-06 | No custom "sudo" or "impersonation" mode without a security review and audit log entry | | SuperAdmin impersonation exists — confirm audit + alert wiring (T-04) |
| A-07 | Password reset / MFA change flows require step-up auth | | N/A — password reset flows through `lambda-authorizer` |

## Section 2 — Authorization (RBAC + Tenancy)

| # | Check | Result | Notes |
|-------|--------|--------|-------|
| B-01 | Every new endpoint enforces role via `[Authorize(Roles="...")]` or policy | | |
| B-02 | The role list matches the RBAC matrix in `08-authorization.md` | | |
| B-03 | **TenantId comes from the JWT claim only** — never from body/path/query/header | | **BUG-01 violates this today.** |
| B-04 | Every new aggregate root has a `TenantId` property set from current-user tenant on insert | | |
| B-05 | Every new DbSet is covered by the `ITenantScoped` global query filter | | |
| B-06 | No raw SQL bypassing the global query filter without explicit tenant check | | Confirmed 0 in prod (`17-tenant-isolation-audit.md` § 4.1) |
| B-07 | Cross-tenant references explicitly flagged in DTO name + dedicated authz check | | N/A — no cross-tenant DTOs exist |
| B-08 | Row-level authz: user cannot fetch/mutate rows they should not see within their tenant | | **T-14 open** — verify Inspector-own-inspection guard |
| B-09 | 404 vs 403 leak avoided (404 when row exists but belongs to different tenant) | | Confirmed (T-09) |
| B-10 | Integration tests cover tenant isolation for every new endpoint | | `TenantIsolationTests.cs` exists; new endpoints need per-endpoint coverage |
| B-11 | No new cache keyed on entity ID without also keying on TenantId | | N/A — no distributed cache today |
| B-12 | No background job iterating all rows without tenant partition | | Workers partition by tenant (`17-tenant-isolation-audit.md` § 1.4) |
| B-13 | No new EventBridge event without `tenantId` in payload | | N/A — EventBridge not adopted yet |
| B-14 | No new SQS message consumed without validating `tenantId` matches intended action | | N/A |

## Section 3 — Input Validation

_See seed catalog T-06, T-07, T-10._

| # | Check | Result | Notes |
|-------|--------|--------|-------|
| C-01 | Every request DTO with user input has a FluentValidation validator | | |
| C-02 | String lengths bounded | | T-10 open — verify `notes`/`metadata` |
| C-03 | Enums validated to allowed values | | Backend enum serialization uses ints — see `project_backend_enum_serialization` |
| C-04 | Numeric ranges bounded where valid | | |
| C-05 | File uploads validate MIME by magic-byte | | Applies to inspection photos + TAMP PDFs |
| C-06 | File upload size capped at API gateway AND app layer | | |
| C-07 | Any user-supplied URL SSRF-protected (allowlist) | | **T-20 open** — verify allowlist covers metadata IPs |
| C-08 | GUIDs typed `Guid`, not `string` | | |
| C-09 | Deserialization bounded depth, no polymorphic binders | | |

## Section 4 — Injection Attacks

| # | Check | Result | Notes |
|-------|--------|--------|-------|
| D-01 | SQL injection: no string concat into raw SQL | | T-06 mitigated |
| D-02 | PostGIS injection: no user string in `ST_*` functions | | T-07 mitigated |
| D-03 | PostGIS SRID fixed | | Fixed at 4326 |
| D-04 | XSS: no unescaped user input in server-rendered HTML | | **T-23 open — CRITICAL** — TAMP markdown unsanitized |
| D-05 | CSV injection: escape leading `=`, `+`, `-`, `@` | | Verify capital-needs CSV export |
| D-06 | JSON injection: no `TypeNameHandling.All` | | System.Text.Json — not affected |
| D-07 | Command injection: no `Process.Start` with user input | | |
| D-08 | LDAP injection | | N/A |
| D-09 | XML/XXE: `DtdProcessing.Prohibit` on any XML parse | | Relevant for HPMS export (`vol-6-integration-strategy/20-hpms.md`) |
| D-10 | Log injection: escape newlines in user-derived log strings | | |

## Section 5 — CSRF and Cross-Origin

_See seed T-28._

## Section 6 — Secrets Management

_See seed T-05, T-26._

## Section 7 — Data Exposure

_See seed T-09, T-17, T-30, and BUG-02._

## Section 8 — API Security

_See seed T-24 for public-endpoint rate limits._

## Section 9 — Dependency Vulnerabilities

_See seed T-27._

## Section 10 — Infrastructure Security

_(Workshop assigns owners; DevOps drives.)_

## Section 11 — Threat Model

### Assets

| Asset | Sensitivity | Owner |
|-------|-------------|-------|
| Tenant asset inventory + condition scores | Confidential | Backend Lead |
| Capital planning financials (needs, ARV, prioritization) | Confidential | Backend Lead |
| Inspector PII (name, email) | Restricted-PII | Backend Lead |
| TAMP submission attestations (signer + timestamp) | Restricted-PII + regulatory | Tech Architect |
| Locked/Submitted TAMP versions (publicly consumable) | Public (post-lock) | Tech Architect |
| EAM/Plan integration credentials (per-tenant) | Confidential (Secrets Manager) | DevOps |
| Audit log (full mutation history) | Confidential | Backend Lead |

### Trust Boundaries

_See `data-flow-diagrams.md` Trust Boundary Legend (TB-1 through TB-9)._

### STRIDE

_Filled in `threat-catalog-seed.md` Sections A + B. Workshop reviews, adds, adjusts severity, assigns owners._

### Risk Register

_(Workshop populates from `threat-catalog-seed.md` — copy each threat marked Medium/High/Critical here with likelihood + impact.)_

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|------------|-------|
| _(from workshop)_ | | | | |

---

## Section 12 — Sign-Off

| Signer | Role | Verdict | Date | Notes |
|--------|------|---------|------|-------|
| Tech Architect | Author + Scribe | | _[workshop date]_ | |
| Engineering Director | Facilitator | | | |
| Backend Lead | Peer Reviewer | | | |
| Frontend Lead | Peer Reviewer | | | |
| DevOps Engineer | Peer Reviewer | | | |
| Integration Strategist | Peer Reviewer | | | |
| _[Platform Security representative]_ | Platform Security | | | Required |
| _[CISO or delegate]_ | Executive | | | Required for architecture-wide review |

---

_Copy this file to `vault/security/SEC-YYYY-NNNN-maintain-threat-model.md` at workshop start. Do not edit this template in-place — this is the reusable version for the next quarterly refresh._
