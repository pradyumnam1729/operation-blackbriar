# 16 — Migration from Integrated to Native Mode

## Key Principle: Migration is Never Forced

Customers move from Integrated Mode toward Native Mode at their own pace. Maintain does not deprecate Integrated Mode, does not charge a premium for staying in Integrated Mode, and does not nag customers to migrate. The incremental path exists for customers who want it — it is not a treadmill.

Many customers will stay in Integrated Mode indefinitely. Their EAM contract runs for 10 more years. Their maintenance department loves Maximo. They want the capital planning intelligence that Maintain provides and nothing more. That is a valid, sustainable deployment model.

Customers move toward Native Mode when: their EAM contract expires and the renewal cost is high, their EAM vendor increases prices or discontinues the on-premise version, they want a single unified mobile experience for inspections and work orders, or they are opening new facilities without legacy EAM investment.

## The Five-Phase Migration Map

### Phase 1: Integrated Mode — Weeks 1–4

**What Maintain owns:** Nothing. Read-only integration.
**What stays in EAM:** Everything.
**What syncs:** Assets, work orders, PM schedules → Maintain (one direction).

Deliverables at end of Phase 1:
- All assets visible in Maintain with condition scores and RUL projections
- First capital plan generated (5-year capital investment requirements)
- Integration running stably (sync success rate > 99%)
- Users trained on Maintain dashboards and capital planning

### Phase 2: Inspection Migration — Months 2–3

**What Maintain owns:** Inspection workflows, defect records.
**What stays in EAM:** All work orders, PM schedules, asset registry.
**What syncs:** Assets from EAM → Maintain. Inspection completions may flow back to EAM as work order triggers (Hybrid Mode light).

At this phase, field inspectors conduct inspections using the Maintain mobile app instead of paper forms or EAM inspection modules. Inspection data populates condition scores with real assessment data rather than model-estimated scores.

Data migration needed: Import historical inspection records from EAM or Excel into Maintain. The migration tool is: `dotnet run -- migrate-inspections --tenant {tenantId} --source {csv-file}`.

### Phase 3: Capital Planning Native — Months 3–6

**What Maintain owns:** Inspection workflows, capital planning, capital improvement program.
**What stays in EAM:** Work orders, PM schedules, asset registry.
**What syncs:** Assets and work orders from EAM → Maintain. Approved capital needs may flow to EAM as planned work orders (Hybrid Mode full).

At this phase, the capital improvement program (CIP) is built and maintained in Maintain. The financial department works with Maintain for capital budgeting, not with spreadsheets. Maintain feeds CIP data to the agency's budget system via export or API.

### Phase 4: Work Order Hybrid — Months 6–12

**What Maintain owns:** Inspections, capital planning, work order recommendations, work order approval workflow.
**What stays in EAM:** Work order execution, parts management, technician timesheets, vendor management.
**What syncs:** Bidirectional — assets from EAM; approved work orders from Maintain to EAM; WO completions from EAM to Maintain.

At this phase, maintenance supervisors review and approve Maintain-generated work order recommendations in the Maintain workflow before they are dispatched to the EAM for execution. The EAM remains the execution platform; Maintain drives prioritization.

### Phase 5: Native Mode — 12+ Months

**What Maintain owns:** Asset registry, inspections, capital planning, work order lifecycle (create, approve, dispatch, complete).
**What stays in EAM:** Archive only (read-only access to historical data if EAM is kept running; otherwise EAM is decommissioned).
**What syncs:** Nothing (or one-way read from legacy EAM archive for historical WOs only).

Native Mode requires the most careful cutover planning. The EAM must be formally decommissioned or transitioned to read-only. Historical data from the EAM must be migrated into Maintain.

## Data Migration Approach

When moving data from an EAM to Maintain (for Phases 2 and beyond), use the canonical extract-map-load pipeline:

### Step 1: Extract from EAM

Use the existing IEamAdapter to extract all records. For Native Mode migration, this is a one-time full extract. The extract tool is:

```bash
dotnet run --project MigrateFromEam -- \
  --tenant city-of-boston \
  --adapter ibm-maximo \
  --record-types asset,workorder,pm,defect \
  --output ./migration-extract/
```

Output is NDJSON files (one record per line) in the canonical format.

### Step 2: Validate and Review

Run the data quality report against the extract:

```bash
dotnet run --project MigrateFromEam -- validate \
  --input ./migration-extract/ \
  --report ./migration-report.html
```

The report flags: missing required fields, unknown asset class codes, date inconsistencies, duplicate asset IDs, and assets with no work order history.

Fix data quality issues in the EAM before migrating. Do not migrate known-bad data.

### Step 3: Load into Maintain

The load uses the same upsert mechanism as the sync engine — fully idempotent.

```bash
dotnet run --project MigrateFromEam -- load \
  --tenant city-of-boston \
  --input ./migration-extract/ \
  --batch-size 500 \
  --dry-run  # remove for actual load
```

`--dry-run` prints what would be loaded without writing to the database. Always run dry-run first.

### Historical Data Volume Recommendations

| Record Type | Recommended History | Rationale |
|---|---|---|
| Work orders | 3 years | RUL calculator uses maintenance frequency from WO history |
| Condition inspections | 10 years | Deterioration rate modeling needs long-term trend |
| PM schedules | All active | All active PMs must migrate |
| Asset registry | All active | Plus decommissioned assets from the last 3 years |
| Cost records | 5 years | Capital planning accuracy benefits from 5-year cost basis |

Do not migrate closed work orders older than 3 years unless the customer specifically requests it. Older data adds migration time and storage without improving capital planning accuracy.

## Cutover Risk Mitigation

### Parallel Operation Period

During Phase 4 (Work Order Hybrid) and the transition to Phase 5 (Native), run EAM and Maintain in parallel. Both systems show the same assets and work orders. The maintenance team continues working in the EAM. Capital planners use Maintain. The parallel period runs for 60 to 90 days.

This allows the maintenance team to validate that Maintain data is accurate before they commit to using it as their primary system.

### Rollback Plan

If a customer decides to pause or reverse the migration at any point:
1. Disable write-back (Hybrid → Integrated Mode)
2. Continue sync from EAM as before
3. Maintain retains all inspection and capital planning data — nothing is lost
4. The customer can restart the migration at any time

Rollback is safe because Maintain never deletes EAM data and never modifies EAM records beyond the Hybrid Mode work order write-back.

## Cutover Checklist (Phase 5)

- [ ] Parallel operation complete (60+ days with no critical data discrepancies)
- [ ] All historical data migrated and validated in Maintain
- [ ] All maintenance team users trained on Maintain work order workflows
- [ ] EAM administrator confirmed: EAM contract expiry or decision to decommission
- [ ] EAM data archived (read-only backup or export to cold storage)
- [ ] Maintain go-live date communicated to all stakeholders
- [ ] EAM access disabled or set to read-only
- [ ] Integration adapter set to `status: decommissioned` in Maintain admin
- [ ] Post-cutover support plan in place (30-day hypercare period)
