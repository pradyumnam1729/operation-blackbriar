# ADR-002 — PostgreSQL 16 + PostGIS 3.4 as the Primary Database

**Status:** Accepted  
**Date:** 2024-Q4  
**Deciders:** CTO, Principal Architect  

---

## Context

Aurigo Maintain manages infrastructure assets — roads, bridges, buildings, utility networks, signs, drains. Assets have a physical location in the real world. That location is not just an address; it is a geometry (point, line, polygon) that must be stored, indexed, queried spatially, and rendered on a map.

The database choice must satisfy several requirements simultaneously:

1. **Relational data model:** Assets have asset classes, inspections have defects, capital needs belong to budget scenarios. These are normalized relational relationships that benefit from a relational database's joins, foreign keys, and transactions.

2. **Spatial data:** Asset locations are GIS geometries (PostGIS geometry types). Queries like "find all assets within 500 meters of this point" or "find all assets along this road corridor" require spatial indexing and spatial functions. These queries are trivial in PostGIS and complex or impossible in databases without native spatial support.

3. **Multi-tenant isolation:** Tenant isolation via `tenant_id` column and EF Core global query filters. The database must support efficient filtering on `tenant_id` across all tables.

4. **JSON capabilities:** Audit log captures old/new values as JSON. Some integration adapters store flexible field mappings as JSONB. PostgreSQL's JSONB type is well-supported.

5. **Production-proven:** The database must have a track record in production at the scale we anticipate (millions of assets, thousands of concurrent users per tenant). It must have a strong ecosystem: .NET ORM support, managed hosting on AWS, observability tooling.

6. **Cost:** The database must be available as a managed service (AWS RDS / Aurora) without prohibitive licensing cost. Open-source preferred.

7. **EF Core support:** The primary ORM is EF Core 8. The database must have a first-class EF Core provider.

---

## Decision

**We use PostgreSQL 16 with PostGIS 3.4 as the primary and only relational database for Aurigo Maintain.** We use Npgsql as the .NET data provider and Npgsql.EntityFrameworkCore.PostgreSQL as the EF Core provider. We use NetTopologySuite for geometry types in C#.

On AWS, we deploy on Amazon RDS Aurora PostgreSQL (compatible with PostgreSQL 16). Aurora provides: automatic failover, read replicas, automated backups, point-in-time recovery, and CloudWatch integration — all without operational overhead.

---

## Consequences

### Positive
- **PostGIS is the gold standard for open-source spatial databases.** It has been in production use for 20+ years. Spatial queries that would require workarounds in other databases are single-function calls in PostGIS. ST_DWithin, ST_Intersects, ST_Length, ST_Area — all available natively.
- **Single database for both relational and spatial data.** Joins between asset metadata and asset geometry happen in a single query. No ETL between a relational database and a separate GIS database.
- **Excellent EF Core support.** Npgsql.EntityFrameworkCore.PostgreSQL + NetTopologySuite provides full spatial query support through LINQ. `ST_DWithin(a.Location, searchPoint, radiusMeters)` is written as a LINQ expression and translated to PostGIS SQL automatically.
- **Open-source, no per-seat licensing.** AWS Aurora PostgreSQL is priced on compute and storage, not on number of database users.
- **JSONB support.** The audit log's `old_values` and `new_values` columns store JSON efficiently with full indexing support.
- **pg_stat_statements, EXPLAIN ANALYZE, autovacuum.** The full PostgreSQL tooling ecosystem is available for performance analysis.
- **Proven at scale.** Instagram, GitHub, Shopify, and many other large-scale production systems run PostgreSQL. The scale we anticipate is well within PostgreSQL's documented capabilities.

### Negative / Trade-offs
- **Not SQL Server.** Aurigo's other products may use SQL Server in some installations. Engineers with strong SQL Server background need to learn PostgreSQL-specific syntax (RETURNING clause, UPSERT, JSONB operators, `TIMESTAMPTZ` vs `DATETIME2`). The learning curve is approximately 1 week for a competent SQL developer.
- **PostGIS is an extension.** AWS RDS and Aurora support PostGIS, but it must be enabled explicitly: `CREATE EXTENSION postgis;`. The migration that initializes the database must include this.
- **SRID handling.** All spatial data must use SRID 4326 (WGS84). Queries that mix SRIDs fail. Developers must be consistent about SRID when creating geometry objects.
- **EF Core migrations for PostGIS types.** Geometry columns require explicit `HasColumnType("geometry(Point, 4326)")` in EF Core entity configuration. This is not automatic.

### Neutral
- **Transaction semantics** are standard ACID — same as SQL Server or MySQL.
- **Npgsql connection pooling** works differently from SQL Server's built-in pooling. Configuration requires understanding Npgsql-specific parameters.

---

## Alternatives Considered

### Option A: SQL Server + Azure SQL

The Aurigo Maintain prototype was originally considered as an Azure deployment alongside an existing SQL Server footprint.

**Rejected because:**
1. **No native PostGIS equivalent.** SQL Server has a `geometry` type, but its spatial functions are not as comprehensive or performant as PostGIS. Complex spatial queries (line-of-sight analysis, network routing, topological analysis) would require workarounds.
2. **Per-core licensing cost.** SQL Server Enterprise licensing at scale is a significant cost center. Aurora PostgreSQL is priced on compute and storage alone.
3. **AWS deployment.** Aurigo's infrastructure is on AWS. Running SQL Server on RDS is more expensive and operationally complex than Aurora PostgreSQL.
4. **Ecosystem.** Aurigo's engineering team has stronger PostgreSQL skills. The open-source tooling ecosystem (pgAdmin, psql, pg_stat_statements, pgBadger) is more accessible.

### Option B: Separate Relational + Spatial Databases

Use PostgreSQL for relational data and a dedicated spatial database (Esri SDE, or a separate PostGIS-only instance) for geometry storage.

**Rejected because:**
1. **Join complexity.** Queries that need both asset attributes and asset geometry require joins across database instances, which are not supported by EF Core and require application-level merging of results.
2. **Operational overhead.** Two database instances to manage, back up, and monitor.
3. **Unnecessary.** PostGIS is specifically designed to co-locate spatial and relational data. Separating them provides no benefit and significant cost.

### Option C: NoSQL Document Database (MongoDB)

Some infrastructure management tools use document databases for flexible schema assets.

**Rejected because:**
1. **Multi-tenancy.** The `tenant_id` filter pattern is trivial in PostgreSQL but requires careful schema design in document databases to avoid cross-tenant data leakage.
2. **Complex queries.** Capital planning queries (find all assets in this asset class with condition below X, ordered by replacement year, grouped by budget cycle) are straightforward SQL but complex MongoDB aggregation pipelines.
3. **Relational integrity.** Foreign key constraints between assets, inspections, and capital needs are enforced at the database level in PostgreSQL. MongoDB does not have foreign keys — application-level integrity is more fragile.
4. **PostGIS.** MongoDB has spatial query support (2dsphere), but it is not as mature or comprehensive as PostGIS for infrastructure asset GIS use cases.

---

## Spatial Query Examples (PostGIS Advantages)

**Find all assets within 500m of a given point:**
```sql
SELECT id, name
FROM assets
WHERE ST_DWithin(
    location::geography,  -- cast to geography for meter-based radius
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
    500  -- meters
);
```

**Find all bridges along a road corridor:**
```sql
SELECT a.id, a.name
FROM assets a
JOIN asset_classes ac ON a.asset_class_id = ac.id
WHERE ac.code = 'BRDG'
AND ST_DWithin(
    a.location,
    (SELECT alignment FROM road_segments WHERE id = '...'),
    0.001  -- degrees (approximately 100m)
);
```

**Calculate total length of all roads in a county:**
```sql
SELECT SUM(ST_Length(alignment::geography)) / 1000 AS total_km
FROM assets
WHERE tenant_id = $1
AND asset_class_id IN (SELECT id FROM asset_classes WHERE code LIKE 'ROAD-%')
AND deleted_at IS NULL;
```

These queries are single expressions in PostgreSQL + PostGIS. In a system without native spatial support, they would require loading all geometries into the application layer and computing distances in C#, which is both slower and more complex.

---

## References

- PostGIS documentation: https://postgis.net/documentation/
- Npgsql EF Core provider with NetTopologySuite: https://www.npgsql.org/efcore/mapping/nts.html
- AWS Aurora PostgreSQL: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraPostgreSQL.html
- [04 — Database Standards](../04-database-standards.md) — EF Core patterns, schema design, and migration workflow
