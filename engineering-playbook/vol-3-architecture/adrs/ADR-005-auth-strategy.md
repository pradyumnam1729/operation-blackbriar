# ADR-005 — Reuse Aurigo Lambda-Authorizer JWT Claim Shape

**Status:** Accepted  
**Date:** 2024-Q4  
**Deciders:** CTO, Principal Architect, Engineering Director  

---

## Context

Aurigo Maintain is a new service in the Aurigo Platform family, alongside DocMgmt, Workflow, Notifications, Essentials, and the core Masterworks/Primus modules. All of these services are deployed behind an AWS API Gateway and share a common authentication infrastructure: an AWS Lambda authorizer that validates JWT tokens and enriches the API Gateway request context.

The Lambda authorizer:
- Validates the JWT signature using the Aurigo identity provider's public key (JWKS endpoint)
- Extracts claims from the token and injects them into the API Gateway request context
- Returns an IAM policy allowing or denying the request
- Has a defined, stable claim shape used by all existing Aurigo services

The JWT claim shape is:
```json
{
  "sub": "user-uuid",
  "tenantId": "tenant-uuid",
  "role": "Administrator",
  "email": "user@agency.gov",
  "exp": 1753056000,
  "iat": 1753027200
}
```

The question is: should Aurigo Maintain (a) reuse this exact claim shape and integrate with the existing Lambda authorizer, or (b) introduce its own authentication mechanism (separate identity provider, different claim shape, separate auth service)?

---

## Decision

**We reuse the Aurigo lambda-authorizer JWT claim shape exactly.** Aurigo Maintain does not introduce its own authentication mechanism, identity provider, or JWT claim shape. The service validates JWTs issued by the existing Aurigo identity provider. The `tenantId` claim is used for multi-tenant isolation via EF Core global query filters. The `role` claim is used for authorization.

The Maintain service's role set (`SuperAdmin`, `Administrator`, `AssetManager`, `Inspector`, `ReadOnly`) is documented in [08 — Authorization](../08-authorization.md) and is issued in the `role` claim by the Aurigo identity provider.

---

## Consequences

### Positive
- **No new authentication infrastructure.** The team does not need to build, operate, or secure an identity provider. Authentication is a solved problem on the Aurigo platform.
- **Single sign-on.** Users who are already authenticated to Masterworks Plan or Build do not need to re-authenticate for Maintain. The same token works across all Aurigo services behind the same API Gateway.
- **Consistent security posture.** All Aurigo services have the same token validation logic. Security improvements to the Lambda authorizer benefit all services simultaneously.
- **Tenant isolation is standardized.** The `tenantId` claim is used the same way across all Aurigo services. The EF Core global query filter pattern used in Maintain is the same pattern used elsewhere.
- **Faster time to market.** Authentication is typically a 2–4 week implementation effort. Reusing the existing infrastructure compresses this to a 1-day integration.
- **Reduced attack surface.** Fewer identity systems means fewer places for authentication vulnerabilities to exist.

### Negative / Trade-offs
- **Dependency on the lambda-authorizer.** If the lambda-authorizer changes its claim shape or signing key rotation procedure, Maintain is affected. We must be notified of any breaking changes in the lambda-authorizer.
- **Role granularity.** The Maintain-specific roles (`AssetManager`, `Inspector`) must be provisioned in the Aurigo identity provider. If a customer needs a custom role not in the standard set, this requires a change to the identity provider, not just to Maintain.
- **Local development requires JWT generation.** Developers cannot call the real lambda-authorizer from their local machine. A local JWT generation utility (`JwtTestHelper`) is provided in the test project for integration tests. For local API development, `appsettings.Development.json` configures the JWT validation to accept tokens signed with a local development key.

---

## Multi-Tenant Isolation Design

The `tenantId` claim is the foundation of the multi-tenant isolation model:

1. **JWT claim:** The lambda-authorizer includes the user's `tenantId` in the JWT when the token is issued.
2. **Middleware:** `MultiTenantResolverMiddleware` reads the `tenantId` claim and sets it on the `ICurrentUserService` ambient context.
3. **EF Core global query filter:** Every aggregate root has `HasQueryFilter(e => e.TenantId == _currentUser.TenantId)`. This filter is applied automatically to every query.
4. **Defense in depth:** The API controller checks the JWT is present (`[Authorize]`); the EF Core filter enforces tenant scope regardless of controller-level checks.

This means that even if a developer writes a query that does not explicitly filter by `tenantId`, the global query filter applies it automatically. An asset from Tenant A is physically unreachable by a query executing in the context of Tenant B.

---

## SuperAdmin Impersonation Design

Aurigo support engineers are SuperAdmins — they can impersonate any tenant to provide support. The impersonation mechanism:

1. SuperAdmin logs in normally → receives a JWT with `role: "SuperAdmin"` and `tenantId: "aurigo-internal"`.
2. SuperAdmin calls `POST /api/v1/admin/impersonate/{targetTenantId}` (SuperAdmin only endpoint).
3. The Maintain service issues a short-lived (1-hour) impersonation JWT: `role: "Administrator"`, `tenantId: {targetTenantId}`, `impersonation: true`, `impersonatorId: {superAdminUserId}`.
4. The frontend stores the original SuperAdmin JWT in `localStorage['aurigo.jwt.super']` and uses the impersonation JWT as the active token.
5. The impersonation banner is shown on every page.
6. All actions taken during impersonation are logged with `is_impersonation: true` and the `impersonator_id` in the audit log.

The impersonation token is issued by the Maintain service (not the lambda-authorizer) because it is a Maintain-internal concept. The lambda-authorizer issues the initial SuperAdmin token; Maintain issues the impersonation token scoped to a target tenant.

---

## Local Development Authentication

For local development and integration tests, a development-only JWT is used:

```json
{
  "Auth": {
    "Authority": "local-dev",
    "Audience": "asset-maintenance-local",
    "DevelopmentMode": true,
    "DevelopmentSecretKey": "local-dev-secret-key-not-for-production"
  }
}
```

When `DevelopmentMode: true`, the JWT validation middleware accepts tokens signed with the `DevelopmentSecretKey`. This key is in `appsettings.Development.json` (not production secrets). The integration test `JwtTestHelper.CreateToken(userId, tenantId, role)` uses this key to generate test tokens.

This mechanism does not appear in `appsettings.json` (production configuration). Production always uses the real JWKS endpoint. The `DevelopmentMode` flag is never set to true in any non-development environment.

---

## Alternatives Considered

### Option A: Build a Dedicated Maintain Identity Service

Build a standalone identity service that manages Maintain users independently of the broader Aurigo platform.

**Rejected because:**
1. **Redundant work.** Aurigo already has a working, production-hardened identity provider. Building another one is reinventing the wheel at significant cost and risk.
2. **SSO fragmentation.** Users would need separate credentials for Maintain vs. other Aurigo services.
3. **Security risk.** Building an identity provider correctly requires deep security expertise. Every new identity system is a new attack surface.
4. **Integration with the Aurigo platform.** The lambda-authorizer is how all Aurigo services integrate with AWS API Gateway. A separate auth mechanism would require either bypassing the lambda-authorizer (breaking the common auth model) or running the two systems in parallel.

### Option B: Extend the Lambda-Authorizer Claim Shape

Add Maintain-specific claims (custom permissions, asset class access, geographic restriction) to the lambda-authorizer.

**Deferred, not rejected.** Fine-grained permission claims (e.g., "this user can only access assets in county X") are not needed for MVP. The five-role model (`SuperAdmin`, `Administrator`, `AssetManager`, `Inspector`, `ReadOnly`) is sufficient. If future requirements demand field-level or geographic access restrictions, extending the claim shape will be revisited. At that point, the lambda-authorizer (owned by the Platform team) would need to be updated to issue the additional claims.

---

## References

- [07 — Security](../07-security.md) — JWT validation configuration and security standards
- [08 — Authorization](../08-authorization.md) — role hierarchy, permission matrix, and frontend authorization
- AWS Lambda authorizer documentation: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html
