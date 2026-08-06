# Tenant Isolation Audit — Aurigo Maintain

**Date:** 2026-07-23
**Branch:** primusmaintain
**Scope:** All `IgnoreQueryFilters()` call sites in `backend/src/`, raw SQL usage, controller ID-route enumeration, background-worker tenant-scope ordering.

---

## Summary

| Verdict | Production source call sites |
|---|---|
| Safe | 43 |
| Suspicious — needs proof-of-safety test | 3 |
| BUG — fix required | 4 |

Raw SQL (`FromSqlRaw` / `ExecuteSqlRawAsync`): **0 in production source** (test cleanup only). No risk.

Regression test suite lives at `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.IntegrationTests/Security/TenantIsolationTests.cs`. The two bug-regression tests are intentionally left un-skipped so CI fails on every build until the bugs are fixed, ensuring they cannot be silently ignored.

---

## Section 1 — Safe (Legitimate Escape Hatches)

### 1.1 `AuthController.cs` — Anonymous auth endpoints
**File:** `src/Aurigo.AssetMaintenance.Api/Controllers/AuthController.cs:149,186,214,297,319,366,391,468,478,493`
**Verdict: Safe**

All uses are on `[AllowAnonymous]` endpoints where the JWT does not exist yet. After `IgnoreQueryFilters()`, lookups are scoped by primary-key (user id from a validated one-time token), by email (login), or by `TenantId` (role lookup during SSO user provisioning). The `SsoCallback` path explicitly checks `user.TenantId != tenantId` and returns 401 on mismatch. The `FindByEmailAsync` cross-tenant email lookup has no per-tenant mismatch check in the non-SSO `Login` path (see BUG-04 for the defense-in-depth gap).

### 1.2 `PublicTampController.cs` — Unauthenticated TAMP public endpoint
**File:** `src/Aurigo.AssetMaintenance.Api/Controllers/PublicTampController.cs:60,86`
**Verdict: Safe**

Correct pattern: tenant is resolved from the slug (the `Tenant` table has no tenant filter by design), then all subsequent queries use `.Where(v => v.TenantId == tenant.Id)` plus a mandatory status guard (`.Where(v => v.Status == "Locked" || v.Status == "Submitted")`). Draft versions cannot leak through this endpoint.

### 1.3 `AdminTenantsController.cs` — Platform super-admin back-office
**File:** `src/Aurigo.AssetMaintenance.Api/Controllers/AdminTenantsController.cs:49,51,53,92,100,101,164,241`
**Verdict: Safe**

Gated by `[Authorize(Policy = "PlatformAdmin")]` requiring the `aurigo.superadmin` claim. Cross-tenant enumeration is the explicit purpose. Specific-tenant reads (lines 92, 100, 101, 164, 241) are followed by `.Where(u => u.TenantId == id)` where `id` is the route parameter validated against `WellKnownIds.PlatformTenant` (rejected with 400).

### 1.4 Background workers — cross-tenant iteration
**Files:**
- `BackgroundServices/CapitalNeedAutoSurfacerService.cs:69,79,88,97,106,116`
- `BackgroundServices/AurigoPlanStatusPollingWorker.cs:102,153`
- `BackgroundServices/BuildStatusPollingWorker.cs:105,364`
- `BackgroundServices/PrimaveraStatusPollingWorker.cs:97`
- `BackgroundServices/IntegrationSyncWorker.cs:73,81`

**Verdict: Safe**

All workers enumerate cross-tenant data, group by `TenantId`, then set `db.CurrentTenantId = tenantId` **before** any per-tenant write queries. Tenant scope is established before the DbContext is used for mutations, not after.

### 1.5 Other legitimate escape hatches
- `JobOrderCostRecorder` / `JobOrderCostReconciler` / `JobOrderCostRecalculator` — all reads scope by PK; called from polling workers with known jobOrderId
- `LcpHandlers.cs:542, 754` — RunLcpScenarioHandler sets CurrentTenantId right after cross-tenant scenario lookup; summary duplicate-key guard is defensive
- `EamClosureNotifier`, `AurigoPlanClientFactory`, `PrimaveraP6ClientFactory`, `DbTenantIntegrationCredentialStore` — all explicitly scope by tenantId parameter
- `TenantProvisioner` — startup-only seed code; email uniqueness check is intentionally cross-tenant
- `SeedRunner`, `PrimusDemoSeeder`, `DemoClientSeeder` — startup only
- `TokenService`, `MaximoAdapter`, `CityworksAdapter` — token verification / explicit tenantId filters

---

## Section 2 — Suspicious (Needs Proof-of-Safety Test)

### 2.1 `SsoConfigController.cs` — IDOR on `{tenantId}` route parameter
Promoted to BUG-01.

### 2.2 `GetAssetAuditHistoryHandler.cs` — audit log TenantId gap
Promoted to BUG-02.

### 2.3 `LcpHandlers.cs:542` — TOCTOU window
Between lines 541–545 the context's `CurrentTenantId` has not yet been set to the scenario's tenant. In practice this handler runs single-threaded so the window is safe; test is desirable to guard against future refactors that introduce concurrency.

---

## Section 3 — Bugs (Must Be Fixed)

### BUG-01 (Critical) — `SsoConfigController`: IDOR exposes another tenant's SSO configuration
**File:** `src/Aurigo.AssetMaintenance.Api/Controllers/SsoConfigController.cs:45,56,71,108,142,161`
**Route:** `api/v1/tenants/{tenantId:guid}/sso-configs`

The controller uses `[Authorize(Roles = "Administrator")]` but never validates that the `{tenantId}` route parameter matches the caller's `aurigo.tenant_id` JWT claim. `IgnoreQueryFilters()` is then applied with the attacker-controlled `tenantId`.

**Attack vector:** Tenant A's Administrator calls `GET /api/v1/tenants/{tenantB_id}/sso-configs` → receives Tenant B's OIDC provider list (client IDs, authority URLs).

**Escalation via write path:**
- `PUT /api/v1/tenants/{tenantB_id}/sso-configs/{configId}` → can overwrite Tenant B's OIDC authority URL with an attacker-controlled IdP → full authentication takeover (any Tenant B user who next logs in via SSO will be redirected to the attacker's IdP).
- `DELETE /api/v1/tenants/{tenantB_id}/sso-configs/{configId}` → disables Tenant B's SSO (login denial).

**Fix:** Inject `ICurrentTenant` and add `if (tenantId != _currentTenant.Value) return Forbid();` at the top of each action. Alternatively, drop `IgnoreQueryFilters()` and let the EF global filter scope to the JWT's tenant, making the route `tenantId` a non-functional (cosmetic) parameter — remove it from the route if that's the chosen path.

---

### BUG-02 (High) — `GetAssetAuditHistoryHandler`: Audit log is not tenant-scoped
**File:** `src/Aurigo.AssetMaintenance.Infrastructure/Persistence/AssetAuditQueryHandler.cs:15-19`
**Route:** `GET /api/v1/assets/{id}/audit-history`

The `AuditLog` table has no EF global query filter (by intentional design — see comment in `AdminTenantsController`). The handler queries it by `EntityId` alone: `.Where(x => x.EntityType == "Asset" && x.EntityId == req.Id)`. There is no `.Where(x => x.TenantId == <currentTenant>)` guard.

The `AssetsController.Get` returns 404 for a cross-tenant asset UUID (correct). But `AssetsController.AuditHistory` calls this handler which bypasses the Assets table entirely and queries the AuditLog directly. A Tenant A user with a Tenant B asset UUID can retrieve Tenant B's audit trail even though the asset itself is invisible.

**Impact:** The audit log captures field-level old/new values for every mutation — EstimatedCost, ARV, risk scores, condition scores. This is full business data exposure.

**Fix:** Inject `ICurrentTenant` into `GetAssetAuditHistoryHandler` and add `.Where(x => x.TenantId == _currentTenant.Value)` to the query. Alternatively, first load the `Asset` (goes through the filtered DbSet → automatic 404 for cross-tenant), then query the audit log for that confirmed asset id.

---

### BUG-03 (Medium) — `SsoConfigController` write actions (extension of BUG-01)
Listed separately because the `PUT` write path (auth-takeover via OIDC authority replacement) has higher severity than the read path. Same root cause and same fix as BUG-01.

---

### BUG-04 (Medium) — Login path cross-tenant email: no tenant-mismatch check
**File:** `src/Aurigo.AssetMaintenance.Api/Controllers/AuthController.cs:186` (`FindByEmailAsync`)
**Affected endpoint:** `POST /auth/login` (non-SSO password login)

`FindByEmailAsync` is cross-tenant by design. The `SsoCallback` flow correctly checks `user.TenantId != tenantId` (line 406) and rejects with 401. The non-SSO login path does not: after `FindByEmailAsync` returns the first-matched user, the tenant gate (`TenantGateAsync`) only checks whether the user's own `TenantId` is active — it does not check that the user's tenant matches any expectation from the login request.

If a user email appears in two tenants (the seeding-time uniqueness guard in `TenantProvisioner` prevents this at provisioning time, but there is no database-level `UNIQUE` constraint on `app_users.email` enforcing this), the first-matched user is granted a JWT scoped to their tenant regardless of which tenant the client intended.

**Severity: Medium** because the primary guard (uniqueness constraint in `TenantProvisioner`) is strong. This is a defense-in-depth gap, not a currently exploitable bypass.

**Fix:** Add a database-level `UNIQUE` constraint on `(lower(email))` (migration needed) to make the defense structural, OR add a `tenantId` parameter to the login request and validate it against the found user's `TenantId`.

---

## Section 4 — Adjacent Risk Reviews

### 4.1 Raw SQL
All `ExecuteSqlRawAsync` / `FromSqlRaw` calls are in test cleanup code only (`TRUNCATE TABLE ...`). Zero occurrences in production code. **No risk.**

### 4.2 Controller ID-route enumeration
All reviewed `{id:guid}` routes route through MediatR handlers that load via the global-filtered DbSet. None apply `IgnoreQueryFilters()` on those specific paths. Cross-tenant ID attacks against `/api/v1/assets/{id}`, `/api/v1/capital-needs/{id}`, `/api/v1/job-orders/{id}`, `/api/v1/inspections/{id}`, `/api/v1/reports/tamp/versions/{id}` all correctly return 404. **Exception: `/api/v1/assets/{id}/audit-history` (see BUG-02).**

### 4.3 Background worker tenant-scope ordering
No ordering bugs found. All workers set `db.CurrentTenantId` before writes, not after.

---

## Cross-References

- Standard: [`vol-3-architecture/07-security.md`](07-security.md)
- Standard: [`vol-3-architecture/08-authorization.md`](08-authorization.md)
- Template: [`vol-9-templates/security-review-template.md`](../vol-9-templates/security-review-template.md)
- Regression suite: `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.IntegrationTests/Security/TenantIsolationTests.cs`
