# HPMS Export + Import — Implementation Spec

**Last updated:** 2026-07-23
**Owner:** Aurigo Maintain, Masterworks (public-agency) worktree
**Status:** Draft for engineering hand-off — two-engineer, 5-sprint plan
**Reviewers:** BE lead, FE lead, QA lead, product (DOT lane)

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [HPMS format spec](#2-hpms-format-spec)
3. [What Maintain already has](#3-what-maintain-already-has)
4. [Maintain-side data model changes](#4-maintain-side-data-model-changes)
5. [Export pipeline](#5-export-pipeline)
6. [Import pipeline](#6-import-pipeline)
7. [Validation](#7-validation)
8. [API surface](#8-api-surface)
9. [Frontend](#9-frontend)
10. [TAMP linkage](#10-tamp-linkage)
11. [Testing](#11-testing)
12. [Effort estimate](#12-effort-estimate)
13. [Open questions](#13-open-questions)

---

## 1. Executive summary

Every US state DOT submits Highway Performance Monitoring System (HPMS) data to FHWA once a year. Interstate segments are due **April 15**; all other Federal-aid highways are due **June 15**. If Maintain cannot produce a valid HPMS submission, the state keeps its legacy pavement management system alive purely to hit compliance — which kills the switch. This spec adds two capabilities to the Masterworks (public-agency) worktree:

- **Export** — the state picks a Report Year and Maintain assembles a submission-ready package (Sections + Ramps + Sample Panel geodatabase-shaped payloads + LRS network) validated against the top ~30 FHWA rules, wrapped in a downloadable ZIP.
- **Import** — a new-adopter state uploads its prior year's HPMS submission; Maintain parses it, runs a dry-run diff, and (on commit) upserts pavement `Asset` rows + `PavementConditionRecord` rows so year 1 doesn't start empty.

Both live behind a new `HpmsController` at `/api/v1/hpms/*`. UI ships as a new `features/hpms/` folder plus a Reports → HPMS page. TAMP hooks into the same `HpmsGradeComputer` + `PavementGoodPoorCalculator` already used for 23 CFR § 490 % Good / % Poor lane-miles. Estimated effort: **~78 person-days** (BE 42, FE 24, QA 12) across ~5 two-week sprints.

## 2. HPMS format spec

**Governing document.** [HPMS Field Manual, December 2016 (published PDF)](https://www.fhwa.dot.gov/policyinformation/hpms/fieldmanual/hpms_field_manual_dec2016.pdf) plus the [HPMS Field Manual Errata Sheet, November 2020 (Version 1.3)](https://www.fhwa.dot.gov/Policyinformation/hpms/fieldmanual/hpms_field_manual_errata_sheet.pdf). FHWA published an [updated draft in Docket FHWA-2023-0014](https://downloads.regulations.gov/FHWA-2023-0014-0003/attachment_1.pdf) plus a [January 2024 NPRM](https://www.federalregister.gov/documents/2024/01/25/2024-00373/national-performance-management-measures-extenuating-circumstances-highway-performance-monitoring) renaming several HPMS data-item fields and clarifying PM2 pavement measure applicability. **Version alignment is Open Question O-1** — see § 13. Implementation targets Field Manual + Errata Sheet 1.3, structured to swap in the 2024 renames behind a single `HpmsFieldMap` table.

**Submission model.** A state submits a spatial dataset (Esri File Geodatabase historically; delimited/TSV for the LRS network) built from three overlapping logical extents:

| Logical extent | Applies to | What it carries |
| --- | --- | --- |
| **Full Extent** | All Federal-aid public roads (F-System 1–5 plus urban minor collectors) | Universe attributes — F-System, AADT, Ownership, Through Lanes, Route Number, etc. |
| **Sample Panel** | Stratified random sample stratified by state × urban/rural × F-System × traffic-volume group | Geometric + detailed pavement + intersection items ([FHWA sampling methodology](https://www.fhwa.dot.gov/policyinformation/hpms/hpmsmanage.cfm)) |
| **NHS-only "Full Extent"** | Every NHS mile (Item 64 = 1) | The 6 pavement condition items reported end-to-end for PM2 (Items 47–52) |

The state also submits the underlying **LRS (Route Network)** as a linear-referenced polyline layer; every Section row's Route_ID + Begin_Point + End_Point must resolve on that LRS.

**Datasets/record types** submitted (per Field Manual Chapter 4):

- `Sections` (fka Universe) — one row per homogeneous roadway segment on all Federal-aid public roads
- `Ramps` — attribute subset for on/off ramps
- `Toll_Section` — toll-facility attributes when Item 15 = 1
- `Sample_Panel` — sample-selected sections carrying the full detailed geometric + pavement attribute payload
- `LRS_Network` — the linear-reference polyline network the above tables project onto

**Field layouts.** Historically delimited (pipe/CSV). Since 2018 states have submitted spatial File Geodatabase (Esri `.gdb`). Non-Esri shops (few) submit shapefile + DBF + delimited attribute tables. Maintain will emit the delimited variant first (see § 5) with a plug-in point for FileGDB via [GDAL/OGR bindings](https://gdal.org/drivers/vector/openfilegdb.html) in Sprint H-5.

**Top ~30 items** (verbatim FHWA names, from [Field Manual Chapter 4](https://www.fhwa.dot.gov/policyinformation/hpms/fieldmanual/page04.cfm)):

| # | Item | Applicability |
| --- | --- | --- |
| 1 | Functional System (F_System) | Full Extent + Ramps |
| 2 | Urban Code | Full Extent + Ramps |
| 3 | Facility Type | Full Extent + Ramps |
| 5 | Access Control | Principals + Sample |
| 6 | Ownership | Full Extent |
| 7 | Through Lanes | Full Extent + Ramps |
| 9 | Managed Lanes (HOV_Lanes) | Full Extent where applicable |
| 14 | Speed Limit | Principals + Sample |
| 15 | Toll Charged | Full Extent where applicable |
| 17 | Route Number | Full Extent principals/NHS |
| 18 | Route Signing | Full Extent principals |
| 21 | AADT | Full Extent + Ramps |
| 22 | Single Unit Truck AADT | Principals + Sample |
| 24 | Combination Truck AADT | Principals + Sample |
| 26 | K-Factor | Sample Panel |
| 34 | Lane Width | Sample Panel |
| 35 | Median Type | Sample Panel |
| 37 | Shoulder Type | Sample Panel |
| 38 | Right Shoulder Width | Sample Panel |
| 47 | International Roughness Index (IRI) | Full Extent NHS + Sample |
| 48 | Present Serviceability Rating (PSR) | Full Extent NHS + Sample (used where IRI n/a) |
| 49 | Surface Type | Full Extent NHS + Sample |
| 50 | Rutting | Full Extent NHS + Sample (asphalt only) |
| 51 | Faulting | Full Extent NHS + Sample (jointed concrete only) |
| 52 | Cracking Percent | Full Extent NHS + Sample |
| 54 | Year of Last Improvement | Sample Panel |
| 55 | Year of Last Construction | Sample Panel |
| 63 | County Code | Full Extent |
| 64 | National Highway System | Full Extent |
| 65 | Strategic Highway Network | Full Extent |
| 66 | National Truck Network | Full Extent |
| 70 | Directional Through Lanes | Full Extent Interstates |

Conditional cells (e.g., Item 50 Rutting is required only on asphalt surfaces per Item 49, Item 51 Faulting only on jointed concrete) become row-level rules in the validator (§ 7).

## 3. What Maintain already has

Grep of `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/` (see actual files `Asset.cs`, `Performance/PavementConditionRecord.cs`, `Performance/NbiBridgeRatings.cs`, `Enums/HpmsGrade.cs`) shows the following already exists:

**Direct HPMS mappings (already present):**

| HPMS item | Maintain field | Location |
| --- | --- | --- |
| Item 21 AADT | `Asset.Adt` (currently NBI-sourced) | `Domain/Entities/Asset.cs:88` |
| Item 47 IRI | `PavementConditionRecord.Iri` (decimal, in/mi) | `Domain/Entities/Performance/PavementConditionRecord.cs:15` |
| Item 50 Rutting | `PavementConditionRecord.RuttingMm` | same file, line 17 |
| Item 51 Faulting | `PavementConditionRecord.FaultingMm` | same file, line 18 |
| Item 52 Cracking Percent | `PavementConditionRecord.CrackingPct` | same file, line 16 |
| Item 64 NHS | `Asset.IsNhs` + `PavementConditionRecord.IsNhs` | Asset.cs:101 |
| Item 1 F-System (partial) | `Asset.FunctionalClass` (string, NBI-derived) | Asset.cs:93 |
| Section geometry | `Asset.Geometry` (`geometry(Geometry, 4326)`, NetTopologySuite) | Asset.cs:23 |
| Segment length | `PavementConditionRecord.LaneMiles` (decimal) | line 20 |

**Derivations that already work:**

- **HPMS grade classification** — `Application/Calculations/PavementGoodPoorCalculator.cs` already thresholds IRI ≥ 170, Cracking > 20, Rutting > 14 mm, Faulting > 4.2 mm → Poor; and the mid-band values into Fair; else Good. That is the FHWA § 490.313 pavement measure thresholds. Reused directly by the exporter.
- **PSR from IRI** — Not yet implemented but the calculator has all inputs; add `PsrFromIriConverter` in `Application/Calculations/`. The FHWA-recommended formula is `PSR = 5·e^(-0.0038·IRI)` (Al-Omari-Darter, in HPMS Chapter 4 § 4.2, Item 48).

**Gaps (missing entirely):**

- No `RoadSegment` companion entity — pavement records currently hang off `Asset` directly. HPMS requires **one row per homogeneous-attribute Section**, and a single physical road asset may need to be split into 5–15 Sections to keep AADT / Surface Type / IRI homogeneous.
- No LRS location fields (Route ID, Begin_Point, End_Point, Direction). `Asset.Geometry` gives us the polyline but we have no linear-reference calibration.
- No F_System code table — `Asset.FunctionalClass` is a free-text string. HPMS Item 1 needs the integer code (1=Interstate, 2=Principal Arterial – Other Freeways, 3=Principal Arterial – Other, 4=Minor Arterial, 5=Major Collector, 6=Minor Collector, 7=Local).
- No **HPMS Sample Panel membership** flag — states manage a semi-fixed panel; Maintain needs a persistent tag per Section indicating "in-panel, stratum X, expansion factor Y".
- No Urban Code, County Code, Facility Type, Access Control, Ownership, Route Signing, Ownership, Toll_Charged (Items 2, 3, 5, 6, 15, 17, 18, 63).
- No detailed geometric items (Items 34–46) — lane width, shoulder, median, curves, grades.
- No `AadtHistory` — HPMS wants the current year's AADT but auditors ask for the source year. Currently we only store a scalar `Adt`.

## 4. Maintain-side data model changes

**New table — `road_segments`** (companion entity, one-to-many under `Asset`).

An `Asset` of class `ROAD` becomes a *managed corridor*; its child `RoadSegment` rows are the homogeneous slices that map 1:1 to HPMS Sections. Existing `PavementConditionRecord` rows repoint `AssetId → RoadSegmentId` in the same migration. NBI-imported `Asset` rows (bridges) are unaffected.

```csharp
// Domain/Entities/RoadSegment.cs
public class RoadSegment : EntityBase
{
    public Guid AssetId { get; set; }           // parent corridor
    public Asset? Asset { get; set; }

    // ── HPMS LRS location (Items — Route_ID/Begin_Point/End_Point) ──
    public string RouteId { get; set; } = default!;
    public decimal BeginMilepost { get; set; }
    public decimal EndMilepost   { get; set; }
    public HpmsDirection Direction { get; set; } // Both/Northbound/Southbound/Eastbound/Westbound

    // ── Inventory items (1–20) ──
    public int  FSystem      { get; set; }      // Item 1  (1–7)
    public int  UrbanCode    { get; set; }      // Item 2  (5-digit Census UACE)
    public int  FacilityType { get; set; }      // Item 3
    public int? AccessControl { get; set; }     // Item 5  (conditional)
    public int  Ownership    { get; set; }      // Item 6
    public int  ThroughLanes { get; set; }      // Item 7
    public int? HovLanes     { get; set; }      // Item 9
    public int? SpeedLimit   { get; set; }      // Item 14
    public bool TollCharged  { get; set; }      // Item 15
    public string? RouteNumber   { get; set; }  // Item 17
    public int? RouteSigning     { get; set; }  // Item 18

    // ── Traffic (21–33) ──
    public int? Aadt              { get; set; } // Item 21
    public int  AadtYear          { get; set; }
    public int? SingleUnitTruckAadt   { get; set; } // Item 22
    public int? CombinationTruckAadt  { get; set; } // Item 24
    public decimal? KFactor       { get; set; } // Item 26

    // ── Geometric (34–46) — sample-only ──
    public decimal? LaneWidth        { get; set; }
    public int?     MedianType       { get; set; }
    public decimal? MedianWidth      { get; set; }
    public int?     ShoulderType     { get; set; }
    public decimal? RightShoulderWidth { get; set; }
    public decimal? LeftShoulderWidth  { get; set; }

    // ── Pavement construction (54–62) — sample-only ──
    public int? YearOfLastImprovement { get; set; }
    public int? YearOfLastConstruction { get; set; }
    public decimal? LastOverlayThickness { get; set; }
    public int?     BaseType             { get; set; }
    public decimal? BaseThickness        { get; set; }
    public int?     ClimateZone          { get; set; }
    public int?     SoilType             { get; set; }

    // ── Designations (63–70) ──
    public int  CountyCode         { get; set; } // Item 63
    public bool IsNhs              { get; set; } // Item 64  (mirrors Asset.IsNhs)
    public bool IsStrahnet         { get; set; } // Item 65
    public bool IsNationalTruckNet { get; set; } // Item 66
    public int? DirectionalThroughLanes { get; set; } // Item 70 Interstates

    // ── Sample panel membership ──
    public HpmsSamplePanelStatus SamplePanelStatus { get; set; }  // NotInPanel / InPanel / Retired
    public string? StratumCode { get; set; }     // state.stratum key (F-System × UrbanRural × VolumeGroup)
    public decimal? ExpansionFactor { get; set; } // sample-weight for statistical roll-up

    public Geometry? Geometry { get; set; }      // polyline SRID 4326
    public decimal LengthMiles { get; set; }
    public decimal LaneMiles   { get; set; }
}
```

**Enums.** `HpmsDirection`, `HpmsSamplePanelStatus` in `Domain/Enums/`. Reuse the existing `HpmsGrade` unchanged.

**`Asset` changes.** No new columns — `Asset.IsNhs` already exists and stays as the "corridor rolls up to NHS" flag. `Asset.Adt` is retained for non-DOT tenants but the exporter reads `RoadSegment.Aadt` when a corridor has child segments.

**New table — `hpms_submissions`** — tracks each Export run so re-runs are idempotent and audits can find "what did we send FHWA on 2027-04-14?".

```csharp
public class HpmsSubmission : EntityBase
{
    public int ReportYear { get; set; }
    public HpmsSubmissionStatus Status { get; set; }  // Assembling/Validated/Failed/Downloaded
    public int SectionsCount { get; set; }
    public int SampleCount   { get; set; }
    public int ValidationErrors { get; set; }
    public int ValidationWarnings { get; set; }
    public string? PackageBlobKey { get; set; }   // S3 pointer for the ZIP
    public string? ValidationReportBlobKey { get; set; }
    public Guid CreatedByUserId { get; set; }
}
```

**New table — `hpms_import_runs`** — same shape but for uploads (with `DryRun bool` + a JSON `DiffSummary`).

**Migrations.** Following the repo convention (see `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/Migrations/20260722000070_AssetHazardScores.cs`) create four migrations under `Infrastructure/Persistence/Migrations/` at hand-off week:

- `20260803000010_AddRoadSegments.cs` — creates `road_segments`, backfills one segment per existing pavement asset (100% of `LaneMiles`, best-effort LRS from `Asset.LocationText`), repoints `pavement_condition_records.asset_id → road_segment_id`.
- `20260803000020_AddHpmsSubmission.cs`
- `20260803000030_AddHpmsImportRun.cs`
- `20260803000040_AddHpmsFieldMap.cs` — 3-column lookup (`ItemNumber`, `FieldName`, `IntroducedInVersion`) so the 2024 field-name rename doesn't require a code change.

Backfill script (`seeds/backfill_hpms_defaults.sql`) sets `FSystem` from a mapping of the existing `Asset.FunctionalClass` string (`Interstate → 1`, `Principal Arterial → 3`, etc.), sets `Ownership = 1` (State Highway Agency) for anything class `ROAD`, sets `CountyCode` from a tenant-config default when unknown. All backfilled columns are then written as *warnings* in the first validation run so planners know to correct them.

## 5. Export pipeline

**Location.** `Application/Integrations/Hpms/` — new folder. Not `Application/Reports/` (TAMP-only) because HPMS ships an external artefact rather than a rendered PDF/JSON report.

```
Application/Integrations/Hpms/
├── HpmsSubmissionAssembler.cs        // orchestrator
├── HpmsSectionRecordBuilder.cs       // builds Full Extent rows
├── HpmsSamplePanelBuilder.cs         // filters by SamplePanelStatus = InPanel
├── HpmsRampRecordBuilder.cs
├── HpmsLrsNetworkBuilder.cs
├── HpmsDelimitedWriter.cs            // pipe-delimited emitter, streaming
├── HpmsFileGdbWriter.cs              // Sprint H-5 (GDAL/OGR native bindings)
├── HpmsPackageZipper.cs              // ZIP with manifest.json + top-30 rules report
├── HpmsExportProgressReporter.cs     // pushes {done, total, stage} to SignalR channel
└── Validators/                       // see § 7
```

**Flow.** User picks Report Year → `POST /api/v1/hpms/submissions` returns `submissionId` synchronously, then a background `IHostedService` job picks it up and runs:

1. `Assembler.LoadTenantScopedSegmentsAsync(reportYear)` — streams `RoadSegment` rows via `IAsyncEnumerable<RoadSegment>` (`AsAsyncEnumerable()` on the EF query) so a Texas-sized tenant (300 k segments) never materialises the whole set at once. Order by `RouteId, BeginMilepost` so the writers can emit directly to disk without a second pass.
2. `SectionRecordBuilder` yields one `HpmsSectionRow` per segment. Ramps are filtered where `FacilityType = 4|5|6` and routed to `RampRecordBuilder`.
3. `SamplePanelBuilder` filters `SamplePanelStatus = InPanel` and enriches with the geometric + construction items from § 4.
4. Each builder yields into `HpmsDelimitedWriter` which writes to a `PipeWriter`-backed `FileStream` under `%TEMP%/hpms/{submissionId}/`.
5. `LrsNetworkBuilder` runs a `SELECT ST_Union(geom)` grouped by `RouteId` (PostGIS) so we emit the LRS polyline layer once, not per segment.
6. Every emitted row is fed through the validator chain (§ 7). Errors go to `validation_report.csv` (row-level, keyed by `submissionId + rowNumber`), not aborting the whole run.
7. `HpmsPackageZipper` assembles `Sections.psv | Ramps.psv | SamplePanel.psv | LRS.geojson | manifest.json | validation_report.csv` into `hpms_{state}_{year}.zip`, uploads to S3, stores the blob key on `HpmsSubmission`, and marks `Status = Validated` (or `Failed` if error count > threshold).
8. `HpmsExportProgressReporter` broadcasts a `{done, total, stage}` payload to the frontend via SignalR (`/hubs/hpms-progress`).

**Streaming discipline.** No `.ToListAsync()` in the pipeline path. All builders return `IAsyncEnumerable<T>`. The delimited writer flushes every 5 000 rows. Peak memory target: **< 200 MB for 300 k segments** — enforceable via a `MemoryUsageAssertion` unit test.

**Comparison to TAMP.** `Application/Reports/TampReportHandlers.cs:GetTampReportDataHandler` sequentially loads every entity into memory (line 465–487). That's fine for a 100-row TAMP but would blow up for HPMS. Do NOT copy that shape — the HPMS builders must stream.

**Progress reporting.** `IHostedService` uses a dedicated `Channel<HpmsProgressEvent>` per submission id, drained by a SignalR hub in `Api/Hubs/HpmsProgressHub.cs`. Frontend subscribes on submission-detail page. Backpressure via `BoundedChannelOptions { Capacity = 64, FullMode = DropOldest }` — dropping progress frames is fine, it's only a UX signal.

## 6. Import pipeline

**Location.** `Application/Integrations/Hpms/Import/` alongside the export folder.

```
Application/Integrations/Hpms/Import/
├── HpmsSubmissionParser.cs           // detects .zip/.gdb/.psv, delegates
├── HpmsDelimitedParser.cs            // pipe/csv reader (streaming)
├── HpmsSectionMapper.cs              // row → RoadSegment upsert candidate
├── HpmsImportDiffer.cs               // dry-run: emits Create/Update/NoChange counts
├── HpmsImportCommitter.cs            // writes upserts inside a single transaction
└── HpmsImportProgressReporter.cs
```

**Flow.**

1. `POST /api/v1/hpms/imports` (multipart upload). Server persists blob, creates `HpmsImportRun` row with `DryRun = true`.
2. Parser streams rows; each row → `HpmsSectionMapper.MapAsync` → `RoadSegmentCandidate { Route, Begin, End, all HPMS items }`.
3. `HpmsImportDiffer` looks up existing segments by natural key `(TenantId, RouteId, BeginMilepost, EndMilepost)`:
   - Not found → **Create**
   - Found + all mapped fields equal → **NoChange**
   - Found + any field differs → **Update** (with a per-field diff blob)
4. Diff summary returned as `HpmsImportDiffDto { toCreate, toUpdate, toLeaveAlone, conflicts, rowErrors }` for user review.
5. User clicks **Commit** → `POST /api/v1/hpms/imports/{id}/commit`. The committer runs one transaction, applies upserts, and records per-row provenance in a `road_segment_source_events` table (source = "HPMS", reportYear, rowNumber).

**Idempotency.** The natural key is `(TenantId, RouteId, BeginMilepost, EndMilepost)`. Re-running the same submission yields NoChange everywhere. This matches the pattern in `PublicDataImporter.cs:58` where `Assets.Where(a => a.Code.StartsWith(src + "-"))` is preloaded.

**Conflict resolution.** For **Update** rows, the user chooses at commit time one of three global strategies:

- **HPMS wins** — overwrite Maintain values (default for year 1 adoption)
- **Maintain wins** — only fill nulls (safe re-import after planners have edited data)
- **Manual per-field** — for the ≤ 50 conflicts case, ship a per-row grid in the frontend (§ 9) with a keep-mine / take-theirs radio

Conflict resolution choice is stored on `HpmsImportRun.ConflictStrategy` so re-commits are reproducible.

**Dry-run mode.** Enforced — a commit call on an `HpmsImportRun` whose `DryRun = true` triggers a "Preview → Commit" state machine transition. User has 24h to commit before the row is auto-purged (background sweep).

## 7. Validation

FHWA runs [~200 automated rules on submitted files](https://www.fhwa.dot.gov/policyinformation/hpms/softwareguide/hpms_software_guide.pdf) via the HPMS Software Guide's validation module. Full rule count is a moving target; this spec targets the **top 30 by historical failure frequency** based on the FHWA presentation ["HPMS Field Manual & Software Updates" (Vaughn & Clarke, 2019)](https://www.fhwa.dot.gov/policyinformation/hpms/hpms_public_release.cfm). Every rule lives in `Application/Integrations/Hpms/Validators/` as a `IHpmsValidationRule` implementation.

| # | Rule | Where in pipeline | Type |
| --- | --- | --- | --- |
| V-001 | Section geometry projects onto declared Route_ID LRS | LRS build | error |
| V-002 | Item 21 AADT > 0 for F-System 1–4 | SectionBuilder | error |
| V-003 | Item 7 Through_Lanes ≥ 1 | SectionBuilder | error |
| V-004 | Item 7 × Item 34 Lane Width ≤ Item 3 Facility Type max width | SamplePanelBuilder | warning |
| V-005 | Item 47 IRI ≥ 0 and ≤ 500 in/mi on NHS | SectionBuilder | error |
| V-006 | Item 48 PSR ∈ [0, 5] | SectionBuilder | error |
| V-007 | Item 50 Rutting present iff Item 49 Surface_Type ∈ (asphalt codes) | SectionBuilder | error |
| V-008 | Item 51 Faulting present iff Item 49 Surface_Type ∈ (jointed concrete codes) | SectionBuilder | error |
| V-009 | Item 52 Cracking Percent ∈ [0, 100] | SectionBuilder | error |
| V-010 | Item 1 F_System ∈ {1..7} | SectionBuilder | error |
| V-011 | Section length ≤ 10 miles | SectionBuilder | warning |
| V-012 | Adjacent sections on same Route_ID are contiguous (no gaps > 0.001 mi) | LRS build | error |
| V-013 | Adjacent sections do not overlap | LRS build | error |
| V-014 | Item 64 NHS = 1 requires Items 47–52 non-null | SectionBuilder | error |
| V-015 | Item 22 SUT AADT ≤ Item 21 AADT | SectionBuilder | error |
| V-016 | Item 24 Combo AADT ≤ Item 21 AADT | SectionBuilder | error |
| V-017 | Item 22 + Item 24 ≤ 0.5 × Item 21 (truck share sanity) | SectionBuilder | warning |
| V-018 | Item 15 Toll_Charged = 1 requires a Toll_Section row | RampBuilder | error |
| V-019 | Item 6 Ownership ∈ {1..27} | SectionBuilder | error |
| V-020 | Item 17 Route Number present iff Item 64 NHS = 1 or F-System = 1 | SectionBuilder | error |
| V-021 | Item 63 County Code is a valid 3-digit FIPS in submitting state | SectionBuilder | error |
| V-022 | Sample Panel expansion factor > 0 | SamplePanelBuilder | error |
| V-023 | Sample Panel row references an existing Sections row | SamplePanelBuilder | error |
| V-024 | Item 55 Year of Last Construction ≤ Report Year | SamplePanelBuilder | error |
| V-025 | Item 54 Year of Last Improvement ≥ Item 55 | SamplePanelBuilder | error |
| V-026 | Item 14 Speed Limit ∈ [10, 85] | SamplePanelBuilder | warning |
| V-027 | Item 34 Lane Width ∈ [8, 16] feet | SamplePanelBuilder | warning |
| V-028 | Item 38 Right Shoulder ≥ 0 and ≤ 30 | SamplePanelBuilder | warning |
| V-029 | Item 21 AADT change year-over-year ≤ 50% (else warn) | SectionBuilder | warning |
| V-030 | IRI change year-over-year ≤ 30 in/mi (else warn) | SectionBuilder | warning |

Rules emit `HpmsValidationResult { Severity, RuleId, RowNumber, ItemNumber, Message, ProposedFix }`. Errors block the ZIP from being marked Validated but do NOT abort the whole run — the operator sees the report and re-runs after fixing. Warnings ship through untouched.

## 8. API surface

**New controller.** `Api/Controllers/HpmsController.cs`. All routes `[Authorize(Roles = "Administrator")]` — HPMS submission is a state-level obligation, not a per-user action. Rate-limit `exports` at **1 in-flight per tenant** (via a `SemaphoreSlim` keyed by TenantId in a singleton service); `imports` at **3 in-flight per tenant**.

| Verb | Path | DTO in / out | Purpose |
| --- | --- | --- | --- |
| POST | `/api/v1/hpms/submissions` | `{ reportYear, includeDelimited?, includeFileGdb? }` → `{ submissionId }` | Kick off an export |
| GET | `/api/v1/hpms/submissions` | → `HpmsSubmissionListDto[]` | List past submissions |
| GET | `/api/v1/hpms/submissions/{id}` | → `HpmsSubmissionDto` (status, counts, errors summary) | Detail |
| GET | `/api/v1/hpms/submissions/{id}/package` | → `application/zip` stream | Download the ZIP |
| GET | `/api/v1/hpms/submissions/{id}/validation` | → `HpmsValidationRow[]` (paged) | Row-level errors |
| POST | `/api/v1/hpms/imports` | multipart `file` → `{ importRunId }` | Upload a submission for parse |
| GET | `/api/v1/hpms/imports/{id}` | → `HpmsImportRunDto` (status, diff counts) | Status |
| GET | `/api/v1/hpms/imports/{id}/diff` | → `HpmsImportDiffRow[]` (paged) | Per-row diff |
| POST | `/api/v1/hpms/imports/{id}/commit` | `{ conflictStrategy, perRowOverrides? }` | Commit the upsert |
| GET | `/api/v1/hpms/rules` | → `HpmsValidationRuleDto[]` | Static rule catalogue for the UI |

Add SignalR hub `Api/Hubs/HpmsProgressHub.cs` with `SubscribeToSubmission(submissionId)` / `SubscribeToImport(importRunId)` methods. Same JWT auth as REST.

## 9. Frontend

**Location.** `frontend/asset-maintenance-web/src/features/hpms/` mirrored on the routes tree as `routes/reports.hpms.tsx` (list) + `routes/reports.hpms.$id.tsx` (detail). Discoverability: add a **"HPMS Submission"** card to the Reports landing page (`routes/reports.tsx`) next to the TAMP card. Also surface **"Import HPMS"** as a card on `routes/configuration.integrations.tsx` since it's a one-off adoption task.

Match the shadcn/ui + TanStack Query patterns in `features/reports/CreateTampVersionModal.tsx` and `features/integrations/ConfigureIntegrationDrawer.tsx`. All state via `useQuery`/`useMutation`; forms via `react-hook-form` + `zod`. SignalR client via `@microsoft/signalr` — reuse the existing `useSignalRConnection` hook from `features/lcp/`.

**Wireframes.**

Export wizard (`features/hpms/ExportWizard.tsx`):

```
┌───────────────────────────────────────────────────────────┐
│  Generate HPMS Submission                                 │
├───────────────────────────────────────────────────────────┤
│  Report year:  [ 2026 ▼ ]                                 │
│  Formats:      [x] Pipe-delimited  [ ] File Geodatabase   │
│  Include:      [x] Sections   [x] Ramps                   │
│                [x] Sample Panel   [x] LRS network         │
│                                                           │
│  Segments in scope:  312 456                              │
│  Sample panel size:   14 812  (4.7% expansion)            │
│                                                           │
│  Estimated size:  ~ 180 MB                                │
│  Estimated time:  ~ 6 minutes                             │
│                                                           │
│                             [ Cancel ]  [ Start export ]  │
└───────────────────────────────────────────────────────────┘
```

Submission detail (`features/hpms/SubmissionDetail.tsx`):

```
┌───────────────────────────────────────────────────────────┐
│  HPMS Submission — 2026                        [Download] │
│  Status: Validated with 12 warnings, 0 errors             │
├───────────────────────────────────────────────────────────┤
│  Progress:  ████████████████████░░  87 %                  │
│  Stage:     Writing Sample Panel (14 812 / 14 812)        │
├───────────────────────────────────────────────────────────┤
│  Validation                              [ Filter: All ▼ ]│
│  ┌───┬──────┬─────────────────────────────────────────┐  │
│  │Row│ Rule │ Message                                 │  │
│  ├───┼──────┼─────────────────────────────────────────┤  │
│  │407│V-004 │ Lane Width 16.4 exceeds Facility Type 3 │  │
│  │892│V-029 │ AADT jumped +62% YoY on I-35 mile 412…  │  │
│  └───┴──────┴─────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

Import diff (`features/hpms/ImportDiff.tsx`):

```
┌───────────────────────────────────────────────────────────┐
│  Import HPMS 2025 — Dry run                               │
├───────────────────────────────────────────────────────────┤
│    Would create:   8 214 segments                         │
│    Would update:     346 segments (127 with conflicts)    │
│    Would leave:  293 019 segments                         │
│    Row errors:        12 rows (see below)                 │
├───────────────────────────────────────────────────────────┤
│  Conflicts (127)                                          │
│  ┌────────┬───────────┬──────────┬──────────┐             │
│  │Segment │ Field     │ Maintain │ HPMS     │  Keep       │
│  ├────────┼───────────┼──────────┼──────────┤             │
│  │US75-12 │ AADT      │ 45 200   │ 47 800   │  ○ M  ● H   │
│  │US75-12 │ IRI       │ 74.1     │ 82.3     │  ● M  ○ H   │
│  └────────┴───────────┴──────────┴──────────┘             │
│  Strategy:  ○ HPMS wins  ● Maintain wins  ○ Manual        │
│                                    [ Cancel ]  [ Commit ] │
└───────────────────────────────────────────────────────────┘
```

Validation error panel is a shadcn `<DataTable>` bound to `useQuery(['hpms', id, 'validation'], … )` with a status-badge column (`error` red / `warning` amber).

## 10. TAMP linkage

The FHWA TAMP pavement chapter (23 CFR § 490 metrics — % Good, % Fair, % Poor lane-miles on NHS) already reads from `PavementConditionRecord` via `PavementGoodPoorCalculator`. HPMS Item 47 IRI, Item 50 Rutting, Item 51 Faulting, Item 52 Cracking Percent are the source-of-truth fields for those metrics — same columns, same thresholds. Wiring the export doesn't require new math; it requires that the TAMP chapter cite the **HPMS submission id** it drew from.

**Concrete changes in `TampReportHandlers.cs`:**

1. Append a nullable `HpmsSubmissionRef` on `TampMeta`:
   ```csharp
   public record TampMeta(
       string PlanTitle, string PlanPeriod, int HorizonYears,
       Guid? ScenarioId, string ScenarioName,
       // ── HPMS lineage (Sprint H-4) ─────────────────────────
       HpmsSubmissionRef? SourcedFromHpms);
   public record HpmsSubmissionRef(Guid SubmissionId, int ReportYear, DateTime SubmittedAtUtc);
   ```
   Append at end of the positional record per the file-header rule at line 20.
2. In `BuildMeta` (line 821) load the latest `HpmsSubmission` for the tenant where `Status = Validated`, populate `SourcedFromHpms`.
3. In `BuildInventory` (line 838) — when `SourcedFromHpms` is non-null, sum `RoadSegment.LaneMiles` where `IsNhs` instead of the current `PavementConditionRecord.LaneMiles` sum. Segments are the canonical HPMS unit; pavement condition records lag the sample panel by up to a year.
4. Add a "PM2 lineage" narrative slot (new `TampNarrativeSection.HpmsLineage`) so planners can annotate deltas between HPMS-submitted numbers and TAMP numbers (e.g., re-collected mid-year IRI).

Frontend: on `routes/reports.tamp.tsx` a small "Sourced from HPMS 2026-05-14" pill next to the Meta section.

## 11. Testing

**Fixtures — real HPMS submission data.** FHWA publishes each state's submitted HPMS as a downloadable File Geodatabase under [FHWA HPMS Public Data Release](https://catalog.data.gov/dataset/highway-performance-monitoring-system-hpms). Use **Delaware** or **Rhode Island** — smallest states, both ~4-6 k segments, well under 20 MB compressed. Store the fixture under `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.IntegrationTests/Fixtures/Hpms/RI_2023.zip` (or the delimited equivalent — convert once via `ogr2ogr` and commit the CSV).

**Unit tests — parser + writer.**

- `HpmsDelimitedParserTests` — 20 cases: happy path, missing required item, wrong data type, item order mismatch, quoted delimiter, BOM, empty file, single row, 10 000 rows (perf), row 5 malformed → row-level error only, unknown item number → warning, negative AADT, IRI = null on NHS, IRI = null off-NHS, Route_ID with special chars, Begin > End milepost, overlapping sections, floating point precision (12.999999 vs 13.0), UTF-8 vs ASCII, Windows vs Unix line endings.
- `HpmsSectionRecordBuilderTests` — 15 cases: covers every conditional item (Rutting only on asphalt, Faulting only on concrete, PSR only where IRI missing, Route Number only on principal arterials, Directional Through Lanes only on Interstates), plus lane-miles calculation edge cases (curved geometry, missing width).
- `HpmsValidationRuleTests` — one test class per rule V-001..V-030, each with positive + negative case. Target 100% coverage on `Validators/`.
- `PsrFromIriConverterTests` — 5 cases covering the FHWA formula boundaries (IRI 0 → PSR 5, IRI 60 → PSR ≈ 3.98, IRI 170 → PSR ≈ 2.62, IRI 500 → PSR ≈ 0.75).

Coverage target ≥ 90% on `Application/Integrations/Hpms/` and `Application/Calculations/` (matches the repo rule in `CLAUDE.md` § Conventions).

**Integration tests — full pipeline with Testcontainers.**

- `HpmsExportPipelineTests` in `IntegrationTests/Hpms/` — spins up Postgres+PostGIS via Testcontainers (existing pattern, see `IntegrationTests/Fixtures/PostgresFixture.cs`), seeds RI_2023 fixture, runs full export, asserts:
  1. ZIP structure (5 files present)
  2. Sections row count matches segment count
  3. Sample panel row count matches `SamplePanelStatus = InPanel` count
  4. Validation report present and error count == 0 for the clean fixture
  5. Round-trip: exported ZIP → re-imported (dry-run) → 100% NoChange
- `HpmsImportPipelineTests` — upload RI_2023 to an empty tenant, assert dry-run creates == segment count in fixture, commit creates rows, second commit is idempotent.
- `HpmsExportPerformanceTest` — generate 300 000 synthetic segments, run export, assert peak working set < 200 MB (via `System.Diagnostics.Process.WorkingSet64` sampled every 500 ms).

**FHWA validator cross-check.** Manual QA gate before Sprint H-5 sign-off: run the emitted ZIP through the [FHWA-provided HPMS validation software](https://www.fhwa.dot.gov/policyinformation/hpms/) on a Windows workstation, confirm error count on the RI fixture matches (or beats) the FHWA's own reported error count for RI 2023.

## 12. Effort estimate

Two-engineer team (1 BE, 1 FE) + fractional QA. 10 working days per sprint. **Total: ~78 person-days over 5 sprints.**

| Sprint | Scope | BE (d) | FE (d) | QA (d) |
| --- | --- | --- | --- | --- |
| H-1 | Data model + migrations + backfill (§ 4) | 8 | 1 | 1 |
| H-2 | Export pipeline (§ 5) — delimited only, no FileGDB | 12 | 3 | 3 |
| H-3 | Validation rules V-001..V-030 (§ 7) | 8 | 2 | 3 |
| H-4 | Import pipeline (§ 6) + TAMP linkage (§ 10) | 8 | 6 | 3 |
| H-5 | UI polish, SignalR progress, FileGDB writer, RI fixture cross-check | 6 | 12 | 2 |
| **Total** | | **42** | **24** | **12** |

Buffer 20% for FHWA-doc-hunt overhead and Field Manual version reconciliation (see § 13 O-1) → **effective budget ≈ 94 person-days ≈ 10 calendar weeks**.

## 13. Open questions

**O-1. HPMS Field Manual version.** The published PDF is dated December 2016, the last errata is Version 1.3 November 2020, but Docket FHWA-2023-0014 shipped a full replacement draft and the January 2024 NPRM renamed several fields. Which version does FHWA currently accept? **Action:** engineering lead emails FHWA Office of Highway Policy Information (PolicyInfoFeedback@dot.gov) week of hand-off and blocks Sprint H-2 spec-freeze on their reply. Fallback: target Errata 1.3 for MVP, add the 2024 renames as a `HpmsFieldMap` migration when confirmed.

**O-2. Special Data Items (SPS) in scope?** The Field Manual Chapter 7 defines optional Special Purpose Study items (SPS-1 through SPS-9, Long Term Pavement Performance sites). Historically < 5% of states submit SPS. **Recommendation:** out of scope for MVP; call it out in release notes as "Phase 2".

**O-3. GPS-based section matching on import.** Some HPMS submissions carry no LRS (Route_ID + Begin_Point + End_Point) and rely purely on segment polylines. Should the import path support "snap this polyline to the nearest Maintain corridor" via PostGIS `ST_DWithin` + `ST_HausdorffDistance`, or require LRS everywhere? **Recommendation:** require LRS for MVP (matches how ≥ 48 of 50 states submit), gate the geometric-match code path behind a feature flag.

**O-4. Sample Panel refresh cadence.** FHWA allows states to migrate segments in/out of the panel to keep stratification valid. Does Maintain provide the panel-management UI, or do we trust the state to hand us an authoritative panel via annual re-import? **Recommendation:** MVP trusts the import. Add a "Sample Panel Manager" module in Phase 2 with stratified random sampling built in.

**O-5. Concurrent submissions.** What if a planner triggers Export while another Export from the same tenant is still running? Current spec: `SemaphoreSlim` blocks and returns 429. **Alternate:** queue and return 202 with a poll URL. **Recommendation:** ship with 429; revisit if support tickets appear.

**O-6. Ownership of "which columns are yours vs ours" on conflict.** In § 6, the default "HPMS wins" strategy could clobber a planner's manual AADT correction. Should Maintain track a per-field `IsUserEdited` flag so conflict resolution can preserve edits automatically? **Recommendation:** yes but Phase 2; MVP surfaces the diff clearly and forces an explicit choice.

---

## Source references

- [FHWA HPMS Field Manual (landing page)](https://www.fhwa.dot.gov/policyinformation/hpms/fieldmanual/)
- [HPMS Field Manual — December 2016 PDF (13 MB)](https://www.fhwa.dot.gov/policyinformation/hpms/fieldmanual/hpms_field_manual_dec2016.pdf)
- [HPMS Field Manual Chapter 4 — Data Items](https://www.fhwa.dot.gov/policyinformation/hpms/fieldmanual/page04.cfm)
- [HPMS Field Manual Chapter 6 — Sampling](https://www.fhwa.dot.gov/policyinformation/hpms/fieldmanual/page08.cfm)
- [HPMS Field Manual Errata Sheet — November 2020, Version 1.3](https://www.fhwa.dot.gov/Policyinformation/hpms/fieldmanual/hpms_field_manual_errata_sheet.pdf)
- [Docket FHWA-2023-0014 draft HPMS Field Manual](https://downloads.regulations.gov/FHWA-2023-0014-0003/attachment_1.pdf)
- [January 2024 NPRM — HPMS Data Field Names](https://www.federalregister.gov/documents/2024/01/25/2024-00373/national-performance-management-measures-extenuating-circumstances-highway-performance-monitoring)
- [HPMS Software Guide (Version 8.0)](https://www.fhwa.dot.gov/policyinformation/hpms/softwareguide/hpms_software_guide.pdf)
- [FHWA HPMS Sample Management](https://www.fhwa.dot.gov/policyinformation/hpms/hpmsmanage.cfm)
- [FHWA HPMS Public Data Release (fixture source)](https://catalog.data.gov/dataset/highway-performance-monitoring-system-hpms)
- [WV DOT HPMS training manual (EmikoTrainingManualHPMS.pdf)](https://gis.transportation.wv.gov/ftp/TMA/HPMSManualsAndReferences/EmikoTrainingManualHPMS.pdf)
