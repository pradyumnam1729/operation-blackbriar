# Database Standards

> Volume 3 · Architecture · Document 04
> PostgreSQL schema design, EF Core patterns, migration workflow, query performance, and data retention

The database is the system of record. Errors at this layer corrupt data and are the hardest to recover from. Aurigo Maintain sits above customer EAM systems as the System of Intelligence for infrastructure lifecycle planning — inspection records, capital plans, and TAMP snapshots become the audit-critical source of truth that public infrastructure agencies rely on for legal, regulatory, and budgetary defensibility. These standards exist to prevent mistakes that are trivially avoidable: missing soft delete on audit-critical records, unbounded queries that crash under load, migrations that drop columns without a deprecation window, N+1 queries hidden in lazy-loaded navigation properties. Read this document before writing your first migration or your first LINQ query.

---

## PostgreSQL Schema Design

### Standard Columns on Every Table

Every table in the Aurigo Maintain schema has these columns without exception:

```sql
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id   UUID        NOT NULL
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL
deleted_at  TIMESTAMPTZ NULL        -- soft delete; NULL = not deleted
```

**Rationale for each column:**

`id UUID DEFAULT gen_random_uuid()` — UUIDs prevent ID enumeration attacks. `gen_random_uuid()` generates RFC 4122 version 4 UUIDs natively in PostgreSQL. Using `DEFAULT` in the database (not the application) ensures that bulk inserts via tools outside the ORM also produce valid IDs.

`tenant_id UUID NOT NULL` — Every row is owned by exactly one tenant. EF Core global query filters enforce this at the application level; the NOT NULL constraint enforces it at the database level. Both checks must exist — defense in depth.

`created_at TIMESTAMPTZ` and `updated_at TIMESTAMPTZ` — Audit trail. Timezone-aware (`TIMESTAMPTZ`) because the Maintain platform serves customers across all US time zones. `updated_at` is managed by the EF Core `AuditInterceptor` — it is set on every `SaveChanges` call automatically.

`deleted_at TIMESTAMPTZ NULL` — **Soft delete**. Never physically delete asset records, inspection records, or capital plan records at the point of user action. Public infrastructure agencies must maintain audit trails for legal compliance. A NULL value means the record is active. A non-null value means it was soft-deleted at that timestamp by the user whose `userId` is stored in the separate `audit_log` table. The EF Core global query filter includes `WHERE deleted_at IS NULL` on all queries.

---

### Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Table | `snake_case`, plural | `assets`, `inspection_records`, `capital_needs` |
| Column | `snake_case` | `asset_class_id`, `condition_index`, `install_date` |
| Primary key | `id` | `id` |
| Foreign key column | `[referenced_table_singular]_id` | `asset_id`, `tenant_id` |
| Foreign key constraint | `fk_[table]_[referenced_table]` | `fk_inspections_assets` |
| Index | `ix_[table]_[columns]` | `ix_assets_tenant_id_status` |
| Unique constraint | `uq_[table]_[columns]` | `uq_asset_classes_code` |
| Check constraint | `ck_[table]_[column]_[rule]` | `ck_assets_condition_index_range` |

EF Core's `UseSnakeCaseNamingConvention()` (from the `EFCore.NamingConventions` package) is applied in `OnModelCreating`. This converts C# PascalCase property names to `snake_case` column names automatically.

---

### Enums Stored as Strings

All enumerations are stored as their string representation, not as integers.

```sql
condition_rating VARCHAR(20) NOT NULL  -- 'VeryGood', 'Good', 'Fair', 'Poor', 'VeryPoor', 'Failed'
asset_status     VARCHAR(20) NOT NULL  -- 'Active', 'Inactive', 'Decommissioned'
```

**Rationale:** Integer enums are opaque in SQL queries, data exports, and audit logs. When a DBA or regulator queries the database directly, `condition_rating = 'Poor'` is self-documenting. `condition_rating = 2` requires a lookup table or code knowledge.

In EF Core:
```csharp
builder.Property(a => a.ConditionRating).HasConversion<string>().HasMaxLength(50);
```

---

### Indexes

Required on every table:
- The primary key `id` (automatic).
- `tenant_id` alone (for admin queries across the tenant).
- Every foreign key column (prevents sequential scan on join).
- `(tenant_id, status)` composite where status filtering is common.
- `deleted_at` for partial index: `CREATE INDEX ix_assets_active ON assets (tenant_id) WHERE deleted_at IS NULL;`

Required for spatial data:
```sql
CREATE INDEX ix_assets_location USING GIST ON assets (location);
```

**GiST** (Generalized Search Tree) is the correct index type for PostGIS geometry columns.

---

### Geometry Storage

All spatial data uses PostGIS geometry types with SRID 4326 (WGS84):

```sql
location   GEOMETRY(Point, 4326)       -- point assets (signs, valves, poles)
alignment  GEOMETRY(LineString, 4326)  -- linear assets (roads, pipelines)
footprint  GEOMETRY(Polygon, 4326)     -- area assets (buildings, lots)
```

In C# / EF Core, use NetTopologySuite types. Coordinate order in WGS84 is **longitude first, latitude second** (X=longitude, Y=latitude) — this is the geospatial industry standard and what Mapbox GL JS expects.

```csharp
var point = new Point(-122.4194, 37.7749) { SRID = 4326 };  // Correct: longitude first
```

---

## EF Core Patterns

### DbContext Structure

One DbContext per service. The DbContext constructor accepts `ICurrentUserService` to support global query filters:

```csharp
public class AssetMaintenanceDbContext : DbContext
{
    private readonly ICurrentUserService _currentUser;

    public AssetMaintenanceDbContext(
        DbContextOptions<AssetMaintenanceDbContext> options,
        ICurrentUserService currentUser) : base(options)
    {
        _currentUser = currentUser;
    }

    public DbSet<Asset> Assets { get; set; } = null!;
    public DbSet<AssetClass> AssetClasses { get; set; } = null!;
    public DbSet<Inspection> Inspections { get; set; } = null!;
    public DbSet<CapitalNeed> CapitalNeeds { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AssetMaintenanceDbContext).Assembly);
        modelBuilder.UseSnakeCaseNamingConvention();
        base.OnModelCreating(modelBuilder);
    }
}
```

### Global Query Filters

Applied in the entity configuration. Each aggregate root has two filters: soft delete and multi-tenancy.

```csharp
public void Configure(EntityTypeBuilder<Asset> builder)
{
    builder.HasKey(a => a.Id);
    builder.Property(a => a.Id)
        .HasConversion(id => id.Value, value => new AssetId(value));

    // Multi-tenancy + soft delete global query filter
    builder.HasQueryFilter(a =>
        a.TenantId == _currentUser.TenantId &&
        a.DeletedAt == null);

    builder.Property(a => a.Name).HasMaxLength(200).IsRequired();
    builder.Property(a => a.ConditionRating).HasConversion<string>().HasMaxLength(50);
    builder.Property(a => a.Location).HasColumnType("geometry(Point, 4326)");

    builder.HasIndex(a => new { a.TenantId, a.Status }).HasDatabaseName("ix_assets_tenant_id_status");
    builder.HasIndex(a => a.AssetClassId).HasDatabaseName("ix_assets_asset_class_id");
}
```

**Never bypass `IgnoreQueryFilters()`** unless you are SuperAdmin reading across tenants, or in a migration/seed context. Every call to `IgnoreQueryFilters()` requires a code comment explaining why.

### Strongly-Typed IDs

Use strongly-typed IDs to prevent mixing IDs across entities:

```csharp
public record AssetId(Guid Value);
public record InspectionId(Guid Value);

public async Task<Asset?> GetByIdAsync(AssetId id, CancellationToken ct);

// EF Core value conversion:
builder.Property(a => a.Id)
    .HasConversion(id => id.Value, value => new AssetId(value));
```

### Read Queries: AsNoTracking and Projection

```csharp
var assets = await _context.Assets
    .AsNoTracking()
    .Where(a => a.Status == AssetStatus.Active)
    .OrderBy(a => a.Name)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .Select(a => new AssetListItemDto(
        a.Id.Value, a.Name, a.AssetClass.Name, a.ConditionRating, a.InstallDate))
    .ToListAsync(ct);
```

### Write Operations: Load, Mutate, Save

```csharp
public async Task Handle(UpdateAssetCommand request, CancellationToken ct)
{
    var asset = await _context.Assets
        .FirstOrDefaultAsync(a => a.Id == new AssetId(request.AssetId), ct);

    if (asset is null)
        throw new AssetNotFoundException(request.AssetId);

    asset.UpdateDetails(request.Name, request.Description, request.InstallDate);
    await _context.SaveChangesAsync(ct);
}
```

### N+1 Queries

**Never use lazy loading.** All navigation properties are explicit `Include()`:

```csharp
var assets = await _context.Assets
    .AsNoTracking()
    .Include(a => a.AssetClass)
    .Where(a => a.TenantId == tenantId)
    .ToListAsync(ct);

var inspection = await _context.Inspections
    .AsNoTracking()
    .Include(i => i.Defects)
        .ThenInclude(d => d.Photos)
    .FirstOrDefaultAsync(i => i.Id == inspectionId, ct);
```

### Owned Entities (Value Objects)

```csharp
builder.OwnsOne(a => a.Address, address =>
{
    address.Property(a => a.Street).HasMaxLength(200).HasColumnName("address_street");
    address.Property(a => a.City).HasMaxLength(100).HasColumnName("address_city");
    address.Property(a => a.StateCode).HasMaxLength(2).HasColumnName("address_state_code");
    address.Property(a => a.PostalCode).HasMaxLength(10).HasColumnName("address_postal_code");
});
```

---

## Migration Workflow

### Creating a Migration

```bash
dotnet ef migrations add Add_AssetClass_WeibullParameters \
  --project src/Aurigo.AssetMaintenance.Infrastructure \
  --startup-project src/Aurigo.AssetMaintenance.Api
```

### Applying a Migration

```bash
dotnet ef database update \
  --project src/Aurigo.AssetMaintenance.Infrastructure \
  --startup-project src/Aurigo.AssetMaintenance.Api
```

### Migration Naming Rules

Descriptive names: `Add_Inspections_Table`, `Add_GeoIndex_To_Assets`, `Rename_ConditionScore_To_ConditionIndex`, `Add_SoftDelete_To_CapitalNeeds`.

Bad names: `Update1`, `Migration20`, `Fix`, `Temp`.

### Migration Safety Rules

- **Never** edit a migration that has been applied to any shared environment.
- **Never** write `DropTable` or `DropColumn` without a two-step approach: (1) make nullable and stop writing, (2) after all deployed code no longer references the column, drop.
- **Always** review the generated migration SQL: `dotnet ef migrations script --idempotent`.
- **Always** test migrations on a clean database. CI integration tests apply migrations from scratch via Testcontainers on every run.
- **Forward-only.** We do not roll back migrations in production; fix-forward instead. See [14 — CI/CD](./14-cicd.md).

---

## Data Retention Policy

Aurigo Maintain stores three broadly different classes of data. Each class has its own retention rules driven by legal obligation, business need, and cost. This policy is enforced by scheduled background jobs; nothing is deleted ad hoc.

### Data Classes

| Class | Examples | Retention driver |
|---|---|---|
| **Operational domain data** | Assets, inspections, capital needs, job orders, TAMP snapshots | Business need + agency records-retention law |
| **Audit data** | `audit.audit_log`, security event log | SOC 2, state records law, contractual obligations |
| **Ephemeral operational data** | Session data, cache, temporary jobs, rate-limit counters | Cost + relevance |
| **PII linked to natural persons** | User records (name, email), inspector attribution on inspections | GDPR / CCPA / CPRA + agency HR policies |

### Retention Table

| Data | Active retention | Archive retention | Deletion after archive | Legal basis |
|---|---|---|---|---|
| Asset master records (soft-deleted) | 7 years online | 3 years cold storage (S3 Glacier) | Anonymize, then hard-delete | 44 U.S.C. § 3301 (federal records), state DOT records schedules commonly cite 10 years |
| Inspection records | 10 years online | 5 years cold storage | Anonymize, then hard-delete | FHWA NBIS 23 CFR 650 requires bridge inspection records for the life of the bridge + 3 years; we standardize on 10y online for all inspections |
| Capital plans / TAMP snapshots | 10 years online | Indefinite in Glacier Deep Archive | Never hard-deleted; anonymized at request | TAMP is a federally required plan; snapshots are legal evidence of prioritization decisions |
| Job orders (work orders) | 5 years online | 2 years cold storage | Hard-delete | Insurance and defect-liability windows |
| `audit.audit_log` | 7 years online | Indefinite in Glacier | Never hard-deleted | SOC 2 Type II, most state records laws, contractual obligations to public agencies |
| Security events (login, impersonation, permission changes) | 2 years online | 5 years cold storage | Hard-delete | Standard security event retention |
| Application logs (CloudWatch) | 90 days (production) | none | Auto-expire | Operational only; not the audit log |
| Session tokens, rate-limit counters | Token lifetime | none | Auto-expire | Ephemeral |
| Uploaded photos and documents (S3) | Same as owning record | Glacier | Same as owning record | Photos are part of inspection records |
| Report renderings (PDF) | 90 days | 1 year in S3 | Hard-delete | Reports can be regenerated from source data; the renderings are convenience artifacts |

### Soft Delete vs Hard Delete

**Soft delete** (the default for all aggregate roots) sets `deleted_at`. The record is invisible to normal queries but preserved for audit and for potential undelete. The record continues to occupy database rows and indexes.

**Hard delete** removes the row entirely. Hard delete is only performed by the scheduled retention job after the record has exceeded its active retention period and been archived. Hard delete is never performed by a user action.

**Archive** copies the row into cold storage (typically S3 Glacier via a nightly ETL) with a manifest that records tenant, class, and archival timestamp. Only after archive succeeds is hard delete permitted.

### Retention Job Architecture

A single background job — `RetentionSweepJob` — runs nightly at 02:00 UTC and processes retention in three phases:

```csharp
// Application/Retention/RetentionSweepJob.cs
public class RetentionSweepJob : IHostedService
{
    // Phase 1: Detect records that have crossed the active-retention boundary
    // Phase 2: Archive to S3 (only proceed to phase 3 if archive succeeds)
    // Phase 3: Hard delete from the primary database, log the action to audit.audit_log
}
```

Every retention action is itself audited: which records were archived, which were hard-deleted, when, and by which job invocation. This is the audit-of-the-audit that regulators expect.

### GDPR / CCPA / CPRA Right to Erasure

Aurigo Maintain is not directly consumer-facing, but municipal customers occasionally serve constituents whose personal data appears in the system (e.g., an inspector who left the agency, a citizen whose complaint led to a work order). The Right to Erasure endpoint handles this:

```
POST /api/v1/admin/gdpr/erasure
Authorization: Bearer <Administrator JWT>
Content-Type: application/json

{
  "subjectType": "User" | "ExternalContact",
  "subjectId": "user-uuid",
  "reason": "GDPR Article 17 request received 2027-03-15, ticket AUR-4821"
}
```

The handler performs:

1. **Verify legal basis to erase.** If the subject is referenced from a record still within its legal retention window (e.g., an inspector whose inspection is 3 years old and needs to remain evidence-grade for 10 years), we cannot fully erase. In that case, the response is a **restriction** rather than an erasure: PII fields are replaced with a tombstone, and API responses no longer surface the person's identifiable data, but the record continues to exist. This is compliant with GDPR Article 17(3)(b) and CCPA §1798.105(d) which both explicitly permit retention for legal compliance.
2. **Redact PII fields in place.** `first_name`, `last_name`, `email`, `phone`, `title` are replaced with `[erased]`. The `user_id` FK is preserved (records remain queryable by ID) but the person is no longer identifiable.
3. **Suppress in future audit log reads.** The audit log rows themselves are preserved (required for compliance) but the PII fields within them are redacted at read time via a view.
4. **Record the erasure event** in `audit.audit_log` with `operation = 'GDPR_ERASURE'`.
5. **Return a receipt** to the caller with a unique erasure ID for the customer's compliance records.

### Tenant Offboarding

When a tenant contract ends:

| Day 0 | Contract termination notice received. Tenant enters `PendingOffboarding` status. |
| Day 0–30 | Read-only access, no new writes. Export tools remain available. |
| Day 30 | Full data export delivered to the tenant (CSV + GeoJSON per module). |
| Day 60 | Tenant status transitions to `Offboarded`. Access disabled. Data remains in the primary database. |
| Day 90 | Data moved to per-tenant Glacier archive. Primary database rows are hard-deleted. |
| Day 90 + 7 years | Archive expires and is hard-deleted. |

This 7-year post-offboarding window matches the SOC 2 audit horizon and covers most state records-retention laws for public agencies.

### Backups vs Retention

Retention rules apply to the primary database. Automated RDS backups (35-day PITR window) are separate — they are for disaster recovery, not compliance retention. Backups do not extend the effective retention of erased or deleted data (restoring from backup after an erasure would be a compliance violation and requires immediate re-erasure).

---

## Query Performance Rules

| Rule | Rationale |
|---|---|
| `AsNoTracking()` on all reads | Change tracking overhead is pure waste for reads |
| Project to DTO in the IQueryable chain | Avoids `SELECT *` and in-memory mapping |
| Filter before paginate | `WHERE` clause runs before `SKIP/TAKE` |
| `AnyAsync()` for existence checks | Generates `SELECT 1 WHERE EXISTS (...)` — stops after first match |
| No unbounded queries | All list queries have `Skip/Take` pagination |
| Index all foreign keys | Without index, FK joins cause sequential scans |
| `EXPLAIN ANALYZE` for queries > 50ms | Understand the query plan before accepting the code |
| Avoid multiple `SaveChanges` in one handler | Each call is a database round trip; batch changes |

---

## Audit Log Schema

The `audit.audit_log` table captures every mutation automatically via the `AuditInterceptor`. It is stored in a separate `audit` schema and is **never written to by application code directly**.

```sql
CREATE TABLE audit.audit_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID        NOT NULL,
    user_id      UUID        NOT NULL,
    entity_type  VARCHAR(100) NOT NULL,
    entity_id    UUID        NOT NULL,
    operation    VARCHAR(20) NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE',
                                        -- 'GDPR_ERASURE', 'RETENTION_ARCHIVE', 'RETENTION_HARD_DELETE'
    old_values   JSONB,
    new_values   JSONB,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id   VARCHAR(100),
    impersonator_id UUID
);

CREATE INDEX ix_audit_log_tenant_entity ON audit.audit_log (tenant_id, entity_type, entity_id);
CREATE INDEX ix_audit_log_changed_at ON audit.audit_log (changed_at);
CREATE INDEX ix_audit_log_user_id ON audit.audit_log (user_id);
```

Audit records are **never updated by application code**. The application role has INSERT + SELECT grants only. UPDATE and DELETE are reserved for the retention job's dedicated PostgreSQL role and are gated by the retention policy above.

---

_See also: [ADR-002 — Database Strategy](./adrs/ADR-002-database-strategy.md) for the PostgreSQL/PostGIS decision, [13 — Testing](./13-testing.md) for how to test database code with Testcontainers, [07 — Security](./07-security.md) for the encryption and audit posture that complements this retention policy._
