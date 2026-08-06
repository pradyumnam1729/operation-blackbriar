# Authorization

> Volume 3 · Architecture · Document 08  
> Role hierarchy, permission matrix, API authorization, row-level security, frontend authorization

---

## Role Hierarchy

Aurigo Maintain uses a five-level role hierarchy. Higher roles implicitly satisfy lower role checks — an Administrator can perform any action an AssetManager, Inspector, or ReadOnly user can perform.

```
SuperAdmin
    └── Administrator
            └── AssetManager
                    └── Inspector
                            └── ReadOnly
```

### Role Definitions

**SuperAdmin**  
Cross-tenant access for Aurigo internal operations (support, provisioning, diagnostics). SuperAdmins can impersonate any tenant using the impersonation token system. There are no customer SuperAdmins — this role is exclusively for Aurigo employees. Every SuperAdmin action is logged with `SUPERADMIN_IMPERSONATION` in the audit log.

**Administrator**  
Full access within a single tenant. Can manage users, configure the system (asset classes, condition rating scales, model parameters), approve capital plans, and access all data. This is the customer's system administrator role — typically one or two people per agency.

**AssetManager**  
Primary operational role. Can create and edit assets, record inspections, create and manage capital needs, and create work orders. Cannot manage users or change system configuration. This is the role for most engineers and planners at the customer agency.

**Inspector**  
Can create and edit their own inspections. Can view all data within the tenant (read-only on assets, capital needs, work orders). Cannot create or edit assets. This role is designed for field personnel who use the mobile app during site visits.

**ReadOnly**  
View all data within the tenant. No mutations. This role is appropriate for executives reviewing dashboards, stakeholders who need visibility but not editing rights, and external auditors.

---

## Permission Matrix

The following table defines which operations each role can perform. The hierarchy means that a higher role always satisfies a lower role's check — "Administrator" can do everything in the "AssetManager" row.

| Module | Operation | ReadOnly | Inspector | AssetManager | Administrator | SuperAdmin |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Assets** | List assets | ✓ | ✓ | ✓ | ✓ | ✓ |
| | View asset detail | ✓ | ✓ | ✓ | ✓ | ✓ |
| | Create asset | — | — | ✓ | ✓ | ✓ |
| | Edit asset | — | — | ✓ | ✓ | ✓ |
| | Decommission asset | — | — | — | ✓ | ✓ |
| | Delete asset (soft) | — | — | — | ✓ | ✓ |
| **Inspections** | List inspections | ✓ | ✓ | ✓ | ✓ | ✓ |
| | View inspection detail | ✓ | ✓ | ✓ | ✓ | ✓ |
| | Create inspection | — | ✓ | ✓ | ✓ | ✓ |
| | Edit own inspection | — | ✓ | ✓ | ✓ | ✓ |
| | Edit any inspection | — | — | ✓ | ✓ | ✓ |
| | Complete inspection | — | ✓ | ✓ | ✓ | ✓ |
| | Delete inspection | — | — | — | ✓ | ✓ |
| **Capital Needs** | List capital needs | ✓ | ✓ | ✓ | ✓ | ✓ |
| | View capital need detail | ✓ | ✓ | ✓ | ✓ | ✓ |
| | Create capital need | — | — | ✓ | ✓ | ✓ |
| | Edit capital need | — | — | ✓ | ✓ | ✓ |
| | Prioritize capital need | — | — | ✓ | ✓ | ✓ |
| | Approve capital plan | — | — | — | ✓ | ✓ |
| **Job Orders** | List job orders | ✓ | ✓ | ✓ | ✓ | ✓ |
| | View job order detail | ✓ | ✓ | ✓ | ✓ | ✓ |
| | Create job order | — | — | ✓ | ✓ | ✓ |
| | Complete job order | — | ✓ | ✓ | ✓ | ✓ |
| | Cancel job order | — | — | — | ✓ | ✓ |
| **Reports** | View reports | ✓ | ✓ | ✓ | ✓ | ✓ |
| | Generate report | — | — | ✓ | ✓ | ✓ |
| | Export data | — | — | ✓ | ✓ | ✓ |
| **Configuration** | View asset classes | ✓ | ✓ | ✓ | ✓ | ✓ |
| | Edit asset classes | — | — | — | ✓ | ✓ |
| | Manage model settings | — | — | — | ✓ | ✓ |
| | Manage users | — | — | — | ✓ | ✓ |
| | Manage roles | — | — | — | ✓ | ✓ |

---

## API Authorization

### Default: Require Authentication

All controllers have `[Authorize]` at the class level. There are no unauthenticated endpoints in Aurigo Maintain except the health check endpoints (`/health`, `/health/ready`).

```csharp
[ApiController]
[Route("api/v1/assets")]
[Authorize]  // ALL endpoints in this controller require authentication
public sealed class AssetsController : ControllerBase
{ ... }
```

`[AllowAnonymous]` is permitted only on:
- `/health` and `/health/ready` (load balancer health checks)
- `POST /auth/login` (the login endpoint itself)

Any PR adding `[AllowAnonymous]` to other endpoints requires an explicit security review.

### Role Requirements on Individual Actions

```csharp
// Anyone authenticated can list assets
[HttpGet]
public async Task<ActionResult<PagedList<AssetListItemDto>>> ListAssets(...) { }

// AssetManager or above can create assets
[HttpPost]
[Authorize(Roles = "AssetManager,Administrator")]
public async Task<ActionResult<AssetDto>> CreateAsset(...) { }

// Only Administrator can approve capital plans
[HttpPost("{needId:guid}/approve")]
[Authorize(Roles = "Administrator")]
public async Task<IActionResult> ApprovePlan(...) { }
```

**Note on Role Inheritance:** The `[Authorize(Roles = "AssetManager,Administrator")]` attribute checks if the user has EITHER the AssetManager OR Administrator role. It does not automatically handle role hierarchy. To enforce hierarchy at the API level, list all roles that satisfy the check explicitly: `"AssetManager,Administrator"` (not just `"AssetManager"`).

A custom attribute helper reduces this repetition:
```csharp
// Api/Authorization/RequireRoleAttribute.cs
public class RequireRoleAttribute : AuthorizeAttribute
{
    public RequireRoleAttribute(params string[] roles)
    {
        Roles = string.Join(",", roles);
    }
}

// Usage
[RequireRole("AssetManager", "Administrator")]
```

---

## Row-Level Security: EF Core Global Query Filters

The most critical security control in the system is the **EF Core global query filter** that enforces tenant isolation. Every entity that has a `tenant_id` column has this filter configured:

```csharp
builder.HasQueryFilter(a =>
    a.TenantId == _currentUser.TenantId &&
    a.DeletedAt == null);
```

This filter is applied to **every** LINQ query against that entity, regardless of where the query is written. Even if a developer writes a query that does not explicitly filter by `tenant_id`, the global filter is still applied automatically by EF Core.

This means:
- A user from Tenant A can never see data from Tenant B, even if they know the UUID of a Tenant B record.
- Soft-deleted records are automatically excluded from all queries.
- Defense in depth: the controller authorizes the user; the EF filter enforces isolation regardless.

### Bypassing Global Filters

The ONLY legitimate uses of `IgnoreQueryFilters()`:
1. SuperAdmin cross-tenant operations (using a special `SuperAdminDbContext` that has no query filters).
2. Seed runners and migrations (run outside of a tenant context).
3. Internal background jobs that explicitly handle multi-tenant data (must scope correctly after ignoring the filter).

Every usage of `IgnoreQueryFilters()` requires a comment explaining why.

---

## SuperAdmin Impersonation

SuperAdmin users can impersonate a specific tenant to provide support or investigate issues. The impersonation system works as follows:

**Frontend flow:**
1. SuperAdmin logs in normally — receives their SuperAdmin JWT.
2. SuperAdmin navigates to `Settings > Impersonation`.
3. They select a tenant to impersonate.
4. The system calls `POST /api/v1/admin/impersonate/{tenantId}` (SuperAdmin only endpoint).
5. The backend issues a short-lived impersonation JWT with the target tenant's `tenantId` in the claims, but with an `impersonation: true` claim and the original SuperAdmin's `sub` in `impersonatorId`.
6. The frontend stores the original SuperAdmin JWT in `aurigo.jwt.super` in localStorage and sets the impersonation JWT as the active token.
7. Every page renders an impersonation banner: "You are viewing as Tenant: [TenantName] | Click to exit impersonation."

**Backend behavior during impersonation:**
- The `ICurrentUserService` reads the impersonation JWT.
- The `TenantId` used for EF global query filters is the impersonated tenant's ID.
- Every database write is tagged with `impersonatorId` in the audit log (in addition to the `userId`).
- The SuperAdmin DbContext is NOT used — the impersonator sees exactly what the tenant user sees.

**Security controls:**
- Impersonation tokens expire in 1 hour (regardless of normal access token lifetime).
- All actions during impersonation are logged with `is_impersonation = true` in the audit log.
- Impersonation events are alerted to the security team in real time.

---

## Frontend Authorization

### `useCurrentUser` Hook

Returns the current user's role and profile. This hook reads from the JWT claims stored in-memory after login.

```typescript
interface CurrentUser {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  isImpersonation: boolean;
}

export function useCurrentUser(): CurrentUser { ... }
```

### `useHasRole` Hook

Returns true if the current user has the specified role or a higher role in the hierarchy.

```typescript
export function useHasRole(minimumRole: UserRole): boolean {
  const { role } = useCurrentUser();
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minimumRole);
}

// ROLE_HIERARCHY (ascending order)
const ROLE_HIERARCHY: UserRole[] = ['ReadOnly', 'Inspector', 'AssetManager', 'Administrator', 'SuperAdmin'];
```

### Conditional UI

Hide actions the current user cannot perform. Do not rely solely on API rejection — the experience of clicking a button and receiving a 403 error is poor.

```typescript
export function AssetDetailActions({ assetId }: { assetId: string }): JSX.Element {
  const canEdit = useHasRole('AssetManager');
  const canDecommission = useHasRole('Administrator');

  return (
    <div className="flex gap-2">
      {canEdit && <EditAssetButton assetId={assetId} />}
      {canDecommission && <DecommissionButton assetId={assetId} />}
    </div>
  );
}
```

### Route Guards

Routes that require a minimum role redirect unauthorized users to the appropriate page.

```typescript
// routes/settings/users.tsx
export const Route = createFileRoute('/settings/users')({
  beforeLoad: ({ context }) => {
    if (!context.auth.hasRole('Administrator')) {
      throw redirect({ to: '/unauthorized' });
    }
  },
  component: UserManagementPage,
});
```

---

_See also: [07 — Security](./07-security.md) for authentication and JWT details, [ADR-005 — Auth Strategy](./adrs/ADR-005-auth-strategy.md) for the lambda-authorizer decision._
