# Domain: GIS

## Purpose

Geographic Information Systems (GIS) are foundational to infrastructure asset management. Every infrastructure asset has a physical location. Roads are lines. Bridges are points. Districts are polygons. Sign inventories are point clouds. Without spatial data, the asset registry is a database; with spatial data, it is a map of infrastructure that enables spatial queries, geographic analysis, and the visual communication that infrastructure owners need to explain their assets to decision-makers.

The GIS domain in Aurigo Maintain defines how spatial data is stored, queried, imported, exported, and visualized. It establishes WGS84 as the universal coordinate system, PostGIS as the spatial database engine, and Mapbox GL JS as the map client. It also defines how Maintain integrates with external GIS systems — primarily Esri ArcGIS, which is the GIS platform of record at most US government agencies.

## Business Value

**Spatial visualization:** The network map — every asset, color-coded by condition score — is often the most impactful output Aurigo can show a new customer. An executive who has never seen their entire road network on a single screen, colored from green (good) to red (poor), immediately understands the capital planning problem in a way that a spreadsheet cannot convey.

**Spatial analysis:** Infrastructure decisions have geographic dimensions. "Which bridges in District 3 will need replacement in the next 5 years?" is a spatial query. "Show me all pavement segments within 1 mile of a planned construction project" is a spatial query. PostGIS enables these queries natively; a relational database without spatial extensions cannot.

**GIS data import:** Most agencies already have GIS data for their assets. Importing from Esri ArcGIS feature services or Shapefile format is the fastest way to populate the asset registry. Without a robust GIS import capability, the asset registry must be populated manually — a multi-month data entry project that delays the entire implementation.

**GIS data export:** Agencies need to export asset condition data back to their GIS for use in other analyses, maps, and reports. GeoJSON export is the standard format. The ability to export updated condition data to GIS ensures that Maintain does not become a data silo disconnected from the agency's broader GIS ecosystem.

## Coordinate System: WGS84 (SRID 4326)

All geometry in Maintain is stored in the World Geodetic System 1984 (WGS84) coordinate reference system, identified by SRID 4326. WGS84 is the coordinate system used by GPS receivers and by most web mapping platforms (Google Maps, Mapbox, OpenStreetMap). It is the international standard for geographic coordinates.

**Why WGS84 and not state plane projections?**
Many US government agencies use state plane coordinate systems (EPSG codes vary by state, e.g., California State Plane Zone 3 is EPSG:2227) for their GIS data. State plane projections provide better local accuracy for distance and area measurements, but they are region-specific and cannot be mixed across state boundaries. WGS84 provides global coverage with consistent semantics.

Maintain imports geometry in any coordinate system and transforms to WGS84 at import time using the proj library (via NetTopologySuite). The transformation is logged so that the source coordinate system is preserved in the import record.

For area and distance calculations where precision matters (e.g., computing bridge deck area, pavement lane-miles), Maintain transforms WGS84 coordinates to an appropriate local projection for the calculation, then stores the result as a numeric value.

## PostGIS: The Spatial Database Engine

Maintain uses PostgreSQL 16 with the PostGIS 3.4 extension as its spatial database engine. PostGIS adds native support for geometry storage, spatial indexing, and spatial query operations to PostgreSQL.

**Key PostGIS capabilities used in Maintain:**

- **Geometry storage:** Assets are stored with a `geometry` column typed as `geometry(Geometry, 4326)`. The generic `Geometry` type allows the column to hold Point, LineString, or Polygon geometries — all using WGS84.

- **Spatial indexing:** PostGIS GiST (Generalized Search Tree) indexes on geometry columns enable fast spatial queries. Without a GiST index, a "find all assets within this polygon" query requires scanning every row. With a GiST index, it uses the spatial index for orders-of-magnitude faster execution.

- **Spatial query operators:**
  - `ST_Within(a.geometry, @polygon)` — find assets within a drawn polygon
  - `ST_DWithin(a.geometry, @point, @radius)` — find assets within a radius of a point
  - `ST_Intersects(a.geometry, @route)` — find assets that intersect a route
  - `ST_Distance(a.geometry, @point)` — calculate distance from an asset to a point

- **Geometry creation:**
  - `ST_GeomFromGeoJSON` — parse GeoJSON to PostGIS geometry
  - `ST_AsGeoJSON` — serialize PostGIS geometry to GeoJSON for API responses
  - `ST_Transform` — transform between coordinate systems

- **NetTopologySuite (C#):** In the .NET backend, geometry is represented using NetTopologySuite types: `Point`, `LineString`, `Polygon`, `MultiLineString`, etc. Npgsql maps these types to PostGIS geometry columns automatically.

## Mapbox GL JS: The Map Client

The frontend map experience is built with Mapbox GL JS. Mapbox provides:
- **Vector tile rendering:** Assets rendered as vector data on the client, enabling smooth zoom, pan, and filter without round-trips to the server
- **Layer management:** Separate Mapbox layers for each asset class, enabling independent styling and toggling
- **Data-driven styling:** Asset markers colored by condition score using a Mapbox expression: `["interpolate", ["linear"], ["get", "condition_score"], 0, "#ff0000", 2.5, "#ffff00", 5, "#00ff00"]`
- **Custom popup components:** React components rendered in Mapbox popups, providing rich asset detail on click
- **Drawing controls:** Polygon and circle drawing tools for spatial filter selection
- **Mapbox Studio:** Custom map styles that match Aurigo's design system

**Performance considerations:**
For large asset networks (100,000+ assets), rendering all assets as individual markers is not performant. Maintain uses two strategies:
1. **Clustering:** At low zoom levels, nearby assets are clustered into a single marker with a count badge. Zoom in to see individual assets.
2. **Tile layers:** For very large networks, assets are pre-generated into vector tiles by the backend and served as a Mapbox tile source, rather than loading all GeoJSON on the client.

## GIS Data Import/Export

### Import Formats

| Format | Description | Use Case |
|--------|-------------|---------|
| GeoJSON | JSON with geometry and properties | Most web GIS exports, scripted imports |
| Shapefile (.shp/.dbf/.prj) | Esri format, widely used in government GIS | Legacy agency GIS data |
| KMZ / KML | Google Earth format | Field data collected in Google Earth, aerial survey exports |
| CSV with coordinates | Latitude/longitude columns | Simple point asset lists |
| Esri Feature Service | REST API from ArcGIS Online or ArcGIS Server | Live integration with agency ArcGIS |

### Import Workflow
1. User selects import format and uploads file (or provides Feature Service URL)
2. Field mapping wizard: user maps source attributes to Maintain asset schema fields
3. Coordinate system specification: user identifies the source CRS (if not WGS84)
4. Preview: system shows first 20 records with geometry validation results
5. Validation: system checks required fields, geometry validity, duplicate asset IDs
6. Commit: approved records are written to the asset registry; validation errors are reported for correction

### Export Formats

| Format | Description | Use Case |
|--------|-------------|---------|
| GeoJSON | JSON with geometry and properties | Web GIS, scripting |
| Shapefile | Esri format | Agency GIS systems, consultant deliverables |
| CSV | Tabular data with lat/lon columns | Spreadsheet analysis, non-GIS systems |
| KMZ | Google Earth | Map visualizations, field reference |
| PDF Map | Print-quality map with legend | Board presentations, reports |

## Integration with Esri ArcGIS

Most US government agencies use Esri's ArcGIS platform for their enterprise GIS. The GIS domain provides two integration modes with ArcGIS:

**One-time import from ArcGIS Feature Service:**
The user provides the URL of an ArcGIS Feature Service layer. Maintain queries the layer via the Esri REST API, reads the features and attributes, and populates the import wizard. This is the fastest way to get existing agency GIS data into Maintain.

**Continuous sync from ArcGIS:**
For agencies where the ArcGIS geodatabase is the geometry-of-record (and will remain so), Maintain can sync geometry updates from ArcGIS on a scheduled basis. When an asset's location is updated in ArcGIS (e.g., after a resurvey), the updated geometry is pushed to Maintain.

**Maintain condition data export to ArcGIS:**
The reverse flow: Maintain exports current condition scores back to the ArcGIS layer as attribute updates. The agency's GIS staff can use the condition data in their own ArcGIS maps and analyses.

## User Stories

1. **As a GIS Analyst**, I want to import an ArcGIS feature service layer containing our bridge inventory into Maintain so that the asset registry is populated from our existing GIS data without manual re-entry.

2. **As an Asset Manager**, I want to draw a polygon on the map and see all assets within the polygon, filtered by condition score, so that I can build a targeted list for an inspection campaign.

3. **As a Capital Program Manager**, I want to see the network map with all assets colored by condition score and risk level so that I can understand the spatial distribution of capital needs at a glance.

4. **As a GIS Analyst**, I want to export the asset registry with current condition scores as a GeoJSON file so that I can display condition data in our agency's ArcGIS maps.

5. **As an Asset Manager**, I want to find all culverts within 500 meters of a planned road widening project so that I can include them in the project scope if they are in poor condition.

6. **As a Field Inspector**, I want to see my assigned assets on a map with turn-by-turn navigation to each one so that I can optimize my inspection route for the day.

7. **As an Asset Manager**, I want to update an asset's geometry by drawing a corrected line on the map so that the asset's location reflects the actual as-built location.

8. **As an Integration Administrator**, I want to configure the ArcGIS sync schedule and field mappings so that geometry updates in ArcGIS are reflected in Maintain within 24 hours.

## Business Rules

1. **WGS84 storage requirement:** All geometry is stored in WGS84 (SRID 4326). Import in other CRS is transformed; the source CRS is logged.

2. **GiST index required:** All geometry columns have a GiST spatial index. This is enforced in the migration framework.

3. **Geometry validation:** All imported geometry is validated using PostGIS `ST_IsValid`. Invalid geometries (self-intersecting polygons, zero-length lines) are rejected at import.

4. **Geometry type by asset class:** Roads are LineString/MultiLineString. Point assets (bridges, signs, culverts) are Point. Districts and service areas are Polygon. Geometry type is validated against the asset class at import.

5. **Geometry changes are versioned:** When an asset's geometry is updated, the previous geometry is preserved in the asset history. The current geometry is always the most recent version.

6. **Maximum geometry complexity:** Line strings may not exceed 10,000 vertices. Polygons may not exceed 50,000 vertices. This limit is enforced to prevent performance degradation in the map client.

7. **Bounding box validation:** Imported geometry that falls outside the expected geographic extent for the tenant (configured during onboarding) generates a warning. Geometry in the ocean or on another continent is likely a coordinate system error.

## Integration Points

- **Asset Management Domain:** The `geometry` column on the Asset entity. All spatial queries are executed in the asset management domain's query layer.
- **Mobile Domain:** GPS coordinates captured on the mobile device are POSTed to the asset API and stored as the asset's Point geometry.
- **Mapbox GL JS (Frontend):** The API exposes GeoJSON endpoints for each asset class, consumed by the Mapbox data sources in the frontend.
- **ArcGIS (External):** Esri Feature Service import/export, configured via the tenant integration settings.

## Future Evolution

- **3D geometry support:** Z-coordinate support for assets with elevation data (bridge deck elevation, tunnel profiles, underground pipes)
- **Raster layer support:** Display raster data (aerial imagery, LiDAR elevation models, pavement condition imagery) as base layers alongside vector assets
- **Digital elevation model integration:** Automatic routing of linear assets along road centerlines using DEM data, improving geometry accuracy for assets recorded as straight-line segments
- **Open geospatial standards:** Support for OGC WFS and WMS services as both import sources and export targets, expanding interoperability beyond the Esri ecosystem

---

## Supported CRS Conversions

All 50 US state plane systems + all common projections are supported for import via the proj library. Storage is always transformed to WGS84 (EPSG:4326).

### Common source CRS in customer data

| EPSG | Name | Common use |
|------|------|-----------|
| 4326 | WGS84 | GPS receivers, web mapping (native — no transform) |
| 3857 | Web Mercator | Google/Mapbox web tiles (transformed to 4326 for storage) |
| 4269 | NAD83 | US federal geographic (transformed) |
| 26910–26923 | UTM Zone 10N–23N | Federal projects, wilderness surveys |
| 2225–2274 | California State Plane (5 zones) | California DOT |
| 2277–2278 | Texas State Plane | Texas DOT |
| 2903–2905 | New York State Plane | NYSDOT |
| 3435 | Illinois State Plane East | IDOT |
| 26986 | Massachusetts State Plane Mainland | MassDOT |
| 6339–6350 | NAD83(2011) UTM zones | Modern federal surveys |
| Custom | State-specific vertical datums (NAVD88) | Bridge/tunnel elevation |

### Transformation rules

- Import: source CRS transformed to WGS84 using proj4 with datum-shift where required (NADCON5 for CONUS NAD27→NAD83 or NAD83→NAD83(2011)).
- Recorded fields on import: `source_srid`, `transform_pipeline`, `transform_error_horizontal_m`, `transform_error_vertical_m`.
- If accuracy loss > 2 m in any dimension after transform, import warns; customer must acknowledge.
- Vertical datum: elevation values imported in NAVD88 or NGVD29 are recorded but not transformed automatically (per-tenant policy).
- Bounding box: geometry must fall within tenant's operating region (defined as one or more polygons). Out-of-region geometry rejected as likely CRS error.

### Precision handling

- Coordinates stored at full 64-bit float precision (about 1 cm at CONUS scale).
- Length/area computations use appropriate local projection:
  - Bridge deck area → State Plane of tenant's home state
  - Lane-mile computation → Web Mercator length (with cos(latitude) correction for accuracy)
  - Watershed / district areas → USA Contiguous Albers Equal Area (EPSG:5070)
- Computed lengths/areas stored as separate numeric attributes; not recomputed on each query.

---

## Handling Assets Without Geometry

Not every asset comes with geometry — legacy data, incomplete surveys, indoor equipment, and data-quality gaps produce records without spatial data. The GIS domain must gracefully handle this without corrupting downstream capabilities.

### Rules for no-geometry assets

- **Point vs. Linear vs. Area type:** Enforced by asset class. Linear (roads, pipes) and Area (districts) assets **must** have geometry to be published. Point assets (bridges, signs, culverts) **may** be published without geometry, but with data-quality flag.
- **Publication rule:** An asset with `geometry IS NULL` is published only if:
  - The asset class is Point-type, AND
  - The customer's Data Quality Policy allows geometry-optional assets (default: allowed for signs/small culverts, disallowed for bridges), AND
  - A `pending_geometry_reason` is recorded (e.g., "field survey required", "legacy record", "confidential location").

### Consequences for downstream capabilities

| Capability | Behavior for no-geometry asset |
|-----------|------------------------------|
| Map view | Not shown on map; visible in "Missing Geometry" side panel |
| Spatial search | Excluded from radius/polygon queries |
| Route optimization (mobile) | Excluded; inspector shown alternate "known address" from asset name |
| GeoJSON export | Feature emitted with `geometry: null` and property `geometry_missing: true` |
| Shapefile export | Excluded; separate CSV export includes name-only records with reason |
| TAMP / federal export | Excluded from geometry-based aggregation; included in count only |
| Condition dashboard | Included; flagged with icon |
| Data Quality Score | Assets missing geometry receive 0 for Geometry Completeness component |

### Recovery workflow

For no-geometry assets, the system automatically:
1. Adds them to the "Geometry Survey Backlog" (per-tenant queue)
2. Assigns them to the tenant's default GIS analyst
3. Provides a "capture geometry" mobile workflow (inspector can tap map or use current GPS)
4. Removes them from backlog when geometry is added

Bulk-fix pathways: import a shapefile of updates, or link to Esri feature service for automated backfill.

---

## Map-Client Contract with Backend

The mobile and web maps consume a strict backend contract:

- **GeoJSON at low zoom (≤ 10):** Server serves clustered points (H3 hex bins) — one feature per hex containing count and average condition.
- **GeoJSON at mid zoom (11–14):** Server serves individual features with minimal properties (id, class, condition category).
- **Vector tiles at high zoom (≥ 15):** Server serves MVT (Mapbox Vector Tile) format, generated on demand or from cache.
- **Feature detail:** Full asset detail loaded on click via `/api/v1/assets/{id}` — not embedded in map response.

Response time SLA: 250 ms p95 for tile/GeoJSON requests at any zoom.

---

*See also: [Asset Management Domain](asset-management.md) | [Mobile Domain](mobile.md)*
