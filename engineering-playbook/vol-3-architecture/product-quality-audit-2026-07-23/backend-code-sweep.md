# Backend code sweep — 2026-07-23

**Auditor role:** backend-lead
**Scope:** every MediatR handler under `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/**/*Handlers.cs` (35 files), every controller (34 files), every `BackgroundService` (7 files) in `Infrastructure/BackgroundServices/`.
**Focus classes:** null-arguments passed unconditionally, orphan enum values, half-shipped DTO fields, background services without health checks, cross-controller route inconsistencies.
**Exclusions:** TAMP data purity (§18), tenant isolation (§17), Capital Needs feature scope in flight (W4.1–W4.3).

Findings numbered `BE-##`.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 4 |
| Medium | 6 |
| Low | 3 |

---

## Null-arguments passed unconditionally

### BE-01 · Critical · backend-lead
**`lcpSummaryForGap: null` passed unconditionally.**
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Reports/TampReportHandlers.cs:629`

```csharp
var financial = BuildFinancial(budgets, lcpSummaryForGap: null, req.ScenarioId, horizonYears, currentYear, programmedByYear);
```

`BuildFinancial` (declared at line 1332) branches on `if (lcpSummaryForGap is not null && !string.IsNullOrWhiteSpace(lcpSummaryForGap.CostByYearJson))` at line 1371. With hard-null input this branch NEVER fires. Downstream `needEntries` stays empty, `_gapCalc.Calculate(needEntries, ...)` runs with zero-need input, and every `GapByYear` row in the TAMP Financial section shows `TotalNeed = $0M`. Every fiscal year is reported as fully funded regardless of reality. This is the exact silent-failure bug the product owner flagged. Cross-referenced in `domain-data-purity.md#DP-10`.

**Fix:** load the current scenario's `LcpScenarioSummary` (matching `req.ScenarioId`, or the newest Approved one when scenarioId is null) and pass it in. Add an integration test that asserts non-zero `TotalNeed` when a scenario exists.

---

## Orphan enum values

### BE-02 · High · backend-lead
**5 of 7 `TampNarrativeSection` enum values have no reader that USES them beyond the generic narrative endpoints.**
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Enums/TampNarrativeSection.cs:9-71`

Enum values: `InvestmentStrategy=1`, `RiskManagement=2`, `AssetValuation=3`, `ProgressToTargets=4`, `StrategyProcess=5`, `Resilience=6`, `MethodologyNotes=7`, `Other=99`.

The generic controller endpoints at `ReportsController.cs:159-174` accept any value. But only `InvestmentStrategy` (used at `TampReportHandlers.cs:638`) and `MethodologyNotes` (used at line 655) are actually READ by the aggregator handler that ships the TAMP report payload. `RiskManagement`, `AssetValuation`, `ProgressToTargets`, `StrategyProcess`, `Resilience` have narrative rows seeded (`SeedRunner.cs:172-178`) and can be edited via `TampNarrativeTab.tsx:26-34`, but their content never appears in the TAMP report payload.

**Result:** users can author narratives for these 5 chapters, save them (backend writes succeed), and they will NEVER surface in the report or the public TAMP view. The Save button reports success; the data lands in the DB; but the report never reads it back. This is a classic "tabs that save to nowhere" bug — 5 of them.

**Fix:** in `TampReportHandlers.Handle`, load and populate all 7 narrative slots on the returned `TampReportData`. Frontend already expects the section keys (see `TampNarrativeTab.tsx`).

### BE-03 · Medium · backend-lead
**`FundingSourceType.Federal_HSIP` is enumerated in the funding-source breakdown but there is no seeder or migration that produces `Federal_HSIP` rows in test tenants.**
`TampReportHandlers.cs:1358-1365` sums `Federal_HSIP` alongside `Federal_NHPP`, `Federal_STBG`, `State`, `Local`. The demo seed (per glob check on `SeedRunner.cs`) does not create Federal_HSIP funding sources. Demo TAMP will always show `$0M HSIP`. Orphan-enum symptom.

---

## Half-shipped DTO fields

### BE-04 · High · backend-lead
**`TampNarrative.VersionTag` field is set on lock (`LockTampVersionCommand` handler in `TampVersionHandlers.cs`) but no read path filters narratives by `VersionTag` when rendering a locked snapshot.**
The frontend banner at `TampNarrativeTab.tsx:106-110` warns "Locked to version X. Edits will create an unlinked draft" — the copy is correct, but the backend does not enforce it. A user editing a locked-version narrative currently overwrites the row in place; the "unlinked draft" behavior isn't implemented.

### BE-05 · Medium · backend-lead
**`CapitalNeedPlanStatus.Delivered` is grouped with `Approved` for programmed-spend rollup but no code path transitions a need to `Delivered`.**
`TampReportHandlers.cs:619-620` — filters `PlanStatus == Approved || PlanStatus == Delivered`. Grep for `PlanStatus = CapitalNeedPlanStatus.Delivered` in Application handlers: zero writers. Enum member exists (`CapitalNeed.cs` in Domain) but no state transition sets it. Result: `Delivered` count is always 0.

### BE-06 · Medium · backend-lead
**`ConflictingNeedId`, `ConflictingStatus`, `ConflictingCost` on the dedup-conflict DTO are declared but the client doesn't display 2/3 of them.**
`backend/.../Application/CapitalNeeds/CapitalNeedHandlers.cs:117-119` — DTO fields defaulting to `null`. Frontend `CreateNeedDialog.tsx` (per glob) reads only `ConflictingNeedId` to render the dedup toast. `ConflictingStatus` and `ConflictingCost` are DTO ballast.

---

## Background services without health checks

### BE-07 · High · devops
**7 hosted `BackgroundService` classes, ZERO expose a health-check hook.**
`backend/.../Infrastructure/BackgroundServices/` — `LcpScenarioWorker`, `IntegrationSyncWorker`, `BuildStatusPollingWorker`, `AurigoPlanStatusPollingWorker`, `PrimaveraStatusPollingWorker`, `CapitalNeedAutoSurfacerService`. `AddHealthChecks()` at `Program.cs:210-211` only wires `DbHealthCheck`.

Result: if any worker dies (unhandled exception outside its try/catch), the container health probe stays green and Kubernetes never restarts it. `LcpScenarioWorker.cs:38-41` catches exceptions inside the loop — good — but if the `ChannelReader` completes (bug + hosted service tear-down race), the worker exits silently. Same pattern in the polling workers.

**Fix:** each worker should implement `IHealthCheck` OR register a heartbeat marker (`SetHeartbeat(DateTime.UtcNow)`) and expose it as a health-check that fails if the heartbeat is > 2× the poll interval old. `IntegrationSyncWorker.cs:30` etc. should register a lightness check via `services.AddHealthChecks().AddCheck<WorkerHeartbeatCheck>(...)`.

### BE-08 · Medium · devops
**`AurigoPlanStatusPollingWorker` is registered TWICE: once as singleton, once as hosted service via `sp.GetRequiredService<...>`.**
`Infrastructure/DependencyInjection.cs:194-195`

```csharp
services.AddSingleton<AurigoPlanStatusPollingWorker>();
services.AddHostedService(sp => sp.GetRequiredService<AurigoPlanStatusPollingWorker>());
```

Intent is presumably to expose the same instance to other callers (a controller injecting the worker to inspect run state). Grep confirms no such caller exists. The dual registration adds a startup allocation and a subtle lifetime hazard (if a scoped service tries to inject the singleton). Recommend either drop the singleton or add a comment explaining the pattern.

---

## Cross-controller route inconsistencies

### BE-09 · High · backend-lead
**`ReportsController` mixes prefixed AND absolute routes in the same class.**
`backend/.../Api/Controllers/ReportsController.cs:14` — class has `[Route("api/v1/reports")]`, so `[HttpGet("tamp")]` at line 65 → `/api/v1/reports/tamp`. But `[HttpPost("~/api/v1/tamp/versions")]` at line 204 → `/api/v1/tamp/versions` (leading `~` breaks the class-level prefix). Also the endpoint at line 249 is named `mark-submitted`, NOT `submit`. This class specifically is called out in the memory file `project_reports_controller_mixed_routes.md`. Anyone extending it will assume uniform prefixing and silently 404.

**Fix:** split into two controllers — `ReportsController` for `/api/v1/reports/*` and `TampVersionsController` for `/api/v1/tamp/versions/*`. Adjust the frontend hook file `useTampVersions.ts` if needed (paths already correct).

### BE-10 · Medium · backend-lead
**`AuthController` uses `[Route("auth")]` (no `api/v1/` prefix) while every other controller uses `api/v1/*`.**
`frontend/asset-maintenance-web/src/lib/api.ts:20-23` already documents this in a comment. Fine as-is but should be an ADR — currently discoverable only by reading two files.

### BE-11 · Medium · backend-lead
**`PublicTampController` uses `[Route("public/tamp")]` — no `api/v1/*` prefix.**
`backend/.../Api/Controllers/PublicTampController.cs:29`. Third route-prefix convention in the same solution. Justifiable (public URLs shouldn't leak an internal `api/v1` cadence) but should be documented alongside BE-10 in an ADR.

---

## Other patterns

### BE-12 · Low · backend-lead
**Handler `CancellationToken` propagation is inconsistent — some pass `ct` into downstream `_db` calls, some pass `default`.**
Spot-checked `Handlers.cs` files: `AssetHandlers.cs`, `CapitalNeedHandlers.cs`, `LcpHandlers.cs` — all correct. `RulHandlers.cs`, `ArvAndRiskHandlers.cs` — not verified in this sweep. Follow-up ticket.

### BE-13 · Low · backend-lead
**`SeedRunner.RunStep` catches all exceptions and logs — good for demo, but a failed seed silently degrades every subsequent step.**
`Infrastructure/Persistence/SeedRunner.cs` — recommend surface a boot-time warning banner on `/health` when any step failed.

### BE-14 · Low · backend-lead
**`ExceptionHandlingMiddleware` (referenced at `Program.cs:270`) but not opened in this sweep — verify it doesn't leak stack traces in Prod.**

---

## Recommended top-5 backend fixes (in dispatch order)

1. **BE-01 (Critical, backend-lead):** wire `lcpSummaryForGap` — TAMP Financial is currently useless.
2. **BE-02 (High, backend-lead):** wire the 5 orphan narrative sections into the TAMP payload.
3. **BE-07 (High, devops):** add heartbeat health checks to all 7 BackgroundServices.
4. **BE-09 (High, backend-lead):** split `ReportsController` into two clean controllers.
5. **BE-04 (High, backend-lead):** enforce narrative-per-version isolation (or update the frontend banner to reflect the real behavior).
