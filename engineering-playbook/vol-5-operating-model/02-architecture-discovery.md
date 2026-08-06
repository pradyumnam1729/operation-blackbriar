# 02 — Architecture Discovery Protocol

Repository discovery (document 01) gives you the surface. Architecture discovery gives you the depth. This protocol is for engineers and AI agents who need to understand *why* the system is structured the way it is, what the key patterns are, and what cannot change without a formal review.

Execute architecture discovery before making any structural change: new entity, new service, change to the DI graph, new external dependency, change to multi-tenancy handling, schema change that affects more than one module.

---

## Step 1 — Read All Architecture Decision Records

**Location**: `engineering-playbook/vol-3-architecture/adrs/`

ADRs are locked-in decisions. Reading them first prevents you from proposing a change that was already considered and rejected, or re-introducing a pattern that was deliberately replaced.

For each ADR, record:
- The decision number and title
- The chosen option
- The key rejected alternatives and why they were rejected
- Any constraints the decision imposes on future work

Pay special attention to ADRs that touch:
- Data access pattern (EF Core vs. raw SQL vs. Dapper)
- Multi-tenancy strategy
- Authentication and JWT claim shape
- External service integration pattern
- CQRS and MediatR usage
- Test strategy (Testcontainers, no mocks for DB)

If you are proposing something that contradicts an ADR, stop. You need to either (a) follow the existing decision, or (b) open a new ADR that supersedes the old one. Do not silently deviate.

**Automated Claude Code prompt:**
```
Read all ADR files in engineering-playbook/vol-3-architecture/adrs/. For each ADR, summarize: decision made, alternatives rejected, constraints imposed. Identify any ADRs relevant to [PROPOSED_CHANGE].
```

---

## Step 2 — Read All IEntityTypeConfiguration Files

**Location**: `src/[ProjectName].Infrastructure/Persistence/Configurations/`

EF Core fluent configuration files are the authoritative source for the database schema. They tell you:
- The actual table name (may differ from entity name)
- Column types, nullability, and max lengths
- Indexes (composite, unique, partial)
- Foreign key constraints and cascade behavior
- How value objects are mapped (owned entities vs. JSON columns vs. separate tables)
- How geometry is configured (NetTopologySuite, SRID 4326)
- Multi-tenancy index conventions (most tables have a composite index on `tenant_id`)

Reading these is not optional before writing a migration. A migration written without understanding the existing configuration will either duplicate constraints, miss indexes, or create schema drift.

For each configuration file, note:
- Table name
- Primary key structure
- Any `HasIndex` with `IsUnique()` — these impose uniqueness constraints
- Any `HasQueryFilter` at the entity level (in addition to the global one in DbContext)
- Any `OwnsOne` or `OwnsMany` relationships

**Automated Claude Code prompt:**
```
Read all files in Infrastructure/Persistence/Configurations/. For each entity configuration, summarize: table name, primary key, unique indexes, foreign keys, and any query filters. Identify any PostGIS geometry columns.
```

---

## Step 3 — Read the DbContext

**Location**: `src/[ProjectName].Infrastructure/Persistence/[ProjectName]DbContext.cs`

The DbContext is the second source of truth for the data model (after the configurations). Read it to understand:

**DbSets**: Every `DbSet<T>` property is an entity tracked by EF. Note any that exist in the DbContext but are not mentioned in domain discovery — these may be read-model projections or legacy tables.

**Global Query Filters**: Look for `modelBuilder.Entity<T>().HasQueryFilter(...)`. These are invisible WHERE clauses applied to every query for that entity. In Aurigo projects, the most common global filter is:
```csharp
e => e.TenantId == _currentUserService.TenantId
```
This means every query automatically scopes to the current tenant. If you see a query returning cross-tenant data unexpectedly, the first thing to check is whether the entity has this filter and whether it was accidentally disabled with `.IgnoreQueryFilters()`.

**SaveChangesInterceptor**: Look for interceptors registered in `OnConfiguring` or DI. The audit interceptor automatically sets `CreatedAt`, `UpdatedAt`, `CreatedBy`, and `UpdatedBy` on entities implementing `IAuditableEntity`. Never set these fields manually.

**ApplyConfigurationsFromAssembly**: Confirms that all `IEntityTypeConfiguration<T>` files in the Infrastructure assembly are loaded automatically. This means adding a new configuration file is sufficient — no DbContext registration needed.

---

## Step 4 — Trace a Complete Request End-to-End

Pick an existing, working endpoint and trace it from HTTP request to database response. Do not guess — actually read each file in the chain.

The standard Aurigo request path:

```
HTTP Request
    → ASP.NET Core Middleware (JWT validation, tenant extraction)
    → Controller action method
        → validates with [FromBody] binding + FluentValidation pipeline
        → creates Command or Query record
        → calls _mediator.Send(command)
    → MediatR pipeline behaviors
        → ValidationBehavior (runs all validators, throws if invalid)
        → LoggingBehavior (if present)
    → IRequestHandler<TCommand, TResult>.Handle()
        → calls domain services or repositories
        → calls DbContext directly (preferred over repository pattern in Aurigo)
        → calls IMapper to build response DTO
        → returns Result<TDto>
    → Controller maps Result to IActionResult
        → 200 OK with DTO on success
        → 400 Bad Request with validation errors
        → 404 Not Found with problem details
        → 500 Internal Server Error (caught by global exception middleware)
HTTP Response
```

Trace questions to answer:
1. Where is the JWT bearer token validated? (Program.cs middleware setup)
2. Where are tenant claims extracted? (ICurrentUserService implementation)
3. Where is the MediatR pipeline registered? (Application/DependencyInjection.cs)
4. How does FluentValidation wire into MediatR? (ValidationBehavior pipeline behavior)
5. How is the DbContext scoped? (Scoped lifetime, one per HTTP request)
6. Where are EF migrations applied? (Program.cs or a dedicated migration runner)

**Automated Claude Code prompt:**
```
Trace the complete request lifecycle for [ENDPOINT_NAME]. Start at the controller action, follow to the MediatR handler, follow to the DbContext query, follow back to the HTTP response. Identify: JWT validation location, tenant extraction, validation pipeline, DbContext usage, response mapping.
```

---

## Step 5 — Understand the Multi-Tenancy Pattern

Multi-tenancy is the most critical architectural constraint in any Aurigo codebase. Getting it wrong creates data leakage between tenants — a severe security and compliance failure.

**How tenancy flows:**

1. JWT token contains a `tenant_id` claim (Aurigo's lambda-authorizer shape)
2. `ICurrentUserService` is a scoped service that extracts `TenantId`, `UserId`, and `Roles` from `IHttpContextAccessor`
3. `DbContext` receives `ICurrentUserService` via constructor injection
4. DbContext `OnModelCreating` applies `HasQueryFilter(e => e.TenantId == _currentUserService.TenantId)` to every entity that implements `IMultiTenantEntity`
5. DbContext `SaveChanges` override (or interceptor) sets `TenantId = _currentUserService.TenantId` on new entities before insert

**What this means for implementation:**
- Never set `TenantId` manually in a handler — the DbContext does it
- Never call `.IgnoreQueryFilters()` in production code — every use requires architecture review
- Never cross-join entities without verifying both have the tenant filter
- Always test with at least two different tenant IDs in integration tests to verify isolation

**The impersonation model (SUPER_JWT_STORAGE_KEY):**

Aurigo has an internal super-user pattern for support and debugging. When a JWT contains the superuser claim, `ICurrentUserService` can be configured to return a specified tenant ID rather than the one from the JWT. This allows Aurigo support engineers to impersonate a tenant without the tenant's credentials.

Key rule: the impersonation logic lives entirely in `ICurrentUserService`. No handler, no controller, no repository should contain any impersonation logic. If you see impersonation checks scattered through business logic, that is architectural debt.

Read the `ICurrentUserService` interface and its implementation. Understand exactly what properties it exposes and where they come from.

---

## Step 6 — Identify Hard Constraints

These are architectural properties that cannot change without a formal ADR and architecture review:

**Constraint 1: EF Core is the only data access mechanism.**
No raw SQL in application code (migrations excepted). No Dapper. No ADO.NET. If a query requires raw SQL for performance, it uses `DbContext.Database.SqlQuery<T>()` with a tracked or untracked projection, and the decision is documented.

**Constraint 2: All geometry is SRID 4326.**
WGS84. Never insert geometry with a different SRID. Always ensure NetTopologySuite geometry is constructed with SRID 4326. Coordinate order is longitude, latitude (GeoJSON convention).

**Constraint 3: Multi-tenancy via global query filter.**
Not row-level security at the DB level, not application-layer WHERE injection per query. The EF global filter approach was chosen deliberately. Do not bypass it.

**Constraint 4: External services are always behind interfaces.**
DocMgmt, Notification, Workflow, Essentials integrations are behind `I[Service]Client` interfaces. The Infrastructure project has stub implementations. Never call external service HTTP endpoints directly from Application or Domain layers.

**Constraint 5: No domain logic in controllers or infrastructure.**
Controllers translate HTTP to commands. Infrastructure translates commands to data. Business rules live in Application handlers or Domain entities/services.

**Constraint 6: Calculations are pure, stateless, and unit-tested.**
Any calculation engine (RUL, ARV, Risk, deterioration) lives in `Application/Calculations/`. No DbContext, no HttpClient, no static state. Must have ≥90% line coverage.

---

## Output: Architecture Discovery Summary

After completing all six steps, produce a written summary covering:

**Top 5 Patterns in This Codebase:**
1. [Pattern name]: [How it works, where to find it, how to follow it]
2. (repeat for 5 patterns)

Example patterns: MediatR CQRS, EF Core with global query filters, FluentValidation in pipeline behavior, AutoMapper for DTO projection, Result<T> return type.

**Top 3 Constraints (Cannot Change Without ADR):**
1. [Constraint]: [Why it exists, what breaks if violated]
2. (repeat for 3)

**Known Technical Debt:**
List any debt you observed during discovery:
- [Debt item]: [Location, nature of debt, risk if left unaddressed]

Examples: a controller with direct EF access bypassing MediatR, a handler that calls an external service directly, a missing index on a high-traffic query column, missing validation on an existing endpoint.

---

## When to Repeat Architecture Discovery

- When a new module is added to the solution (new Clean Architecture project)
- When a new external integration is introduced
- When the DbContext is significantly refactored
- When you are onboarding to a different Aurigo product (e.g., moving from Maintain to Plan)
- Quarterly, as part of the architecture summit (see document 14)

Architecture discovery is not a gatekeeping exercise — it is calibration. An engineer who understands the architecture writes better code, asks better questions, and catches more problems in code review.
