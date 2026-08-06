# Aurigo Plan Bidirectional Sync — Integration Spec

**Last updated:** 2026-07-23
**Author:** Architecture Review
**Status:** Ready for implementation — Sprint 19+

---

## Table of Contents

1. Executive Summary
2. Current State Analysis
3. Plan API Surface for Reverse Flow
4. Maintain-side Data Model Changes
5. Sync Architecture
6. UI Changes
7. TAMP Wiring
8. API Surface
9. Backward Compatibility
10. Testing
11. Effort Estimate
12. Rollout

---

## 1. Executive Summary

Today Maintain pushes a `CapitalNeed` to Aurigo Plan as a charter (one-way). When Plan subsequently changes that charter's status — approving it, placing it on hold, or cancelling it — Maintain never learns about it. Asset managers see the need as "Pushed" with no further signal; capital program managers in Plan see an approved or programmed charter. The contradiction is visible in every cross-product demo.

Sprint 18a delivered the complete backend of the reverse pipe: a `AurigoPlanStatusPollingWorker` that calls `GET /odata/v1/Charters({id})` every 15 minutes, maps Plan status strings to a `CapitalNeedPlanStatus` enum, persists transitions in `capital_need_plan_status_history`, and raises a `HasPlanConflict` flag when Plan cancels a charter that has a live downstream JobOrder. The backend DTOs already project this data. The gap is: (a) the frontend TypeScript types and components do not yet consume the new fields, (b) the TAMP financial chapter does not yet deduct programmed spend from the funding gap, and (c) Plan's charter status vocabulary (`Draft | Published | Converted | Declined`) does not include an explicit `Approved` or `Programmed` state — the mapping is imprecise and constitutes an open dependency on the Plan team.

This spec closes all three gaps.

---

## 2. Current State Analysis

### 2.1 What Is Already Shipped (Backend — Sprint 18a)

The one-way outbound push has been in production since Sprint 2/6. The reverse-flow backend was added in Sprint 18a.

**Domain entity** (`CapitalNeed.cs` lines 77–115):
- `PlanStatus` (`CapitalNeedPlanStatus` enum, 7 values: `NotPushed/Draft/Approved/Rejected/OnHold/Cancelled/Delivered`)
- `LastPlanStatusCheckUtc` (`DateTime?`)
- `HasPlanConflict` (`bool`, default `false`)
- `PlanConflictReason` (`string?`, max 500 chars)
- `XminConcurrency` (`uint`, Postgres `xmin` optimistic-concurrency token)

**Navigation entity** (`CapitalNeedPlanStatusHistory.cs`): append-only per-need status transition log.

**Migration** (`202607220010_CapitalNeedPlanStatusFlowback.cs`): adds columns, creates history table, backfills `PlanStatus = Draft` for rows with `PushStatus = Pushed && PushCharterUrl IS NOT NULL`.

**Background service** (`AurigoPlanStatusPollingWorker.cs`): 15-minute interval, multi-tenant, deduplicates by charter id, `xmin` optimistic-concurrency.

**Controller endpoints** already live:
- `POST /api/v1/capital-needs/{id}/sync-plan-now` — on-demand poll (rate-limited 1/min per user)
- `POST /api/v1/capital-needs/{id}/resolve-plan-conflict`
- `GET /api/v1/capital-needs/{id}/plan-status-history`

### 2.2 What Is NOT Yet Shipped (Frontend Gap)

- `CapitalNeedListItem` / `CapitalNeedDetail` TypeScript interfaces don't include `planStatus`, `hasPlanConflict`, `lastPlanStatusCheckUtc`.
- No `PlanStatusPill` component.
- `NeedDetailDrawer` shows only `pushStatus` (outbound leg), no `planStatus`.

### 2.3 One-Way Flow (Current)

Planner clicks "Push to Plan" → `POST /push-to-plan` → `AurigoPlanClient.CreateCharterAsync` writes to Plan → Maintain stores `PushStatus=Pushed`. **Silence** until poll cycle catches a status change.

---

## 3. Plan API Surface for Reverse Flow

Ground truth: `specs/swagger.json`.

### 3.1 What Plan Exposes

| Endpoint | Method | Purpose |
|---|---|---|
| `/odata/v1/Charters({key})` | GET | Get single charter |
| `/odata/v1/Charters({key})` | PATCH | Update charter |
| `/odata/v1/Projects({key})` | GET | Get single project |
| `/odata/v1/PlanningWindows` | GET/POST | Planning windows |

**Auth:** Bearer via `POST /identity/token` with `grant_type=organization_integration`. 60-second tokens. `AurigoPlanTokenCache` already handles this.

**Charter status vocabulary** (per swagger): `Draft | Published | Converted | Declined`.

**Programmed fiscal year:** Not surfaced as a scalar. Encoded in `proposedStart`/`proposedEnd` date range and `PlanningWindow.startYear`.

**Funded amount:** Not distinct from `capExEstimate + opExEstimate`.

**Webhook/push callback:** Does not exist. No SNS/SQS. No OData `$delta`.

### 3.2 Plan-Team Dependencies

**B-1 (Blocker):** Confirm that `GET /odata/v1/Charters({id})` returns the internal status vocabulary (`Approved`, `InProgress`, etc.) rather than only the swagger-documented `Draft | Published | Converted | Declined`. If swagger-only, update `MapPlanStatusToCapitalNeed`: `Published` → `Approved`, `Converted` → `Delivered`, `Declined` → `Rejected`.

**G-1:** Expose `programmedFiscalYear` on `PublicCharter` (or via `PlanningWindow.startYear` expand).

**G-2:** Expose `approvedBudget` or `fundedAmount` distinct from `capExEstimate`.

---

## 4. Maintain-side Data Model Changes

**No new columns required today.** Sprint 18a covers it.

When G-1/G-2 land, add:

| Column | Type | Migration |
|---|---|---|
| `PlanProgrammedFiscalYear` | `int?` | `20260804120000_AddCapitalNeedPlanFundingFields.cs` |
| `PlanFundedAmountM` | `decimal(18,2)?` | same |

Gated on Plan-team delivery. Write migration with `TODO(B-1/G-1/G-2)` comment; do not ship until unblocked.

---

## 5. Sync Architecture

### 5.1 Pattern: Polling (Not Webhook)

Rationale: Plan has zero webhook capability today. Building a webhook receiver that Plan cannot call is dead code. The 15-min polling worker already exists, handles multi-tenant, dedupes by charter id, uses `xmin` concurrency. Polling delivers the same user-visible outcome in 2 days of remaining work.

If Plan adds webhooks later, add `POST /api/v1/integrations/plan-webhook` with HMAC-SHA256 verification.

### 5.2 Failure Handling

The worker wraps per-tenant + per-charter in try/catch, logs Warning, continues. `AurigoPlanClient.SendWithBearerAsync` retries 502/503/504 with exponential backoff + one 401-driven token refresh. Already production-proven from outbound push.

### 5.3 Configuration

```json
"AurigoPlanPolling": { "IntervalMinutes": 15 }
```
`0` disables (use in Development + IntegrationTests).

---

## 6. UI Changes

### 6.1 TypeScript Type Extensions

Add to `CapitalNeedListItem`:
```typescript
planStatus: string
lastPlanStatusCheckUtc: string | null
hasPlanConflict: boolean
```

Add to `CapitalNeedDetail`:
```typescript
planConflictReason: string | null
```

Add:
```typescript
export interface CapitalNeedPlanStatusHistoryEntry {
  id: string
  fromStatus: string
  toStatus: string
  changedAtUtc: string
  source: string
  externalRef: string | null
  note: string | null
  statusChangeReason: string | null
}
```

### 6.2 New Component: PlanStatusPill

| planStatus | Color | Label |
|---|---|---|
| `NotPushed` | — | (render nothing) |
| `Draft` | slate | In Plan (Draft) |
| `Approved` | blue | Approved in Plan |
| `OnHold` | amber | On Hold in Plan |
| `Rejected` | red | Rejected in Plan |
| `Cancelled` | red | Cancelled in Plan |
| `Delivered` | green | Delivered in Plan |

Conflict banner + "Resolve" button when `hasPlanConflict`. Hide "Push to Plan" CTA when `planStatus >= Approved`. Show "View in Plan" deep link using `pushCharterUrl`.

### 6.3 Capital Needs List Page

`NeedRow` — add `PlanStatusPill` below `PushToPlanButton`. Rename column header to "Plan Status".

### 6.4 Need Detail Drawer

Extend existing "Plan" section with: `PlanStatusPill`, "View in Plan" link, "Sync now" button (wraps `useSyncPlanNow`), "Plan History" collapsible showing `CapitalNeedPlanStatusHistoryEntry[]`.

### 6.5 Asset Detail Page Badge

When any need has `planStatus === 'Approved'`, render `[ Programmed in Plan FY26 ]` chip.

---

## 7. TAMP Wiring

**File:** `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Reports/TampReportHandlers.cs`

Add to `GapByYear` (APPEND at end per positional-record rule):
```csharp
decimal ProgrammedSpendM   // sum EstimatedCost for needs with PlanStatus >= Approved
```

In `Handle`, add sequential load:
```csharp
var programmedNeeds = await _db.CapitalNeeds.AsNoTracking()
    .Where(n => n.PlanStatus == CapitalNeedPlanStatus.Approved
             || n.PlanStatus == CapitalNeedPlanStatus.Delivered)
    .Select(n => new { n.FiscalYear, n.EstimatedCost })
    .ToListAsync(ct);
var programmedByYear = programmedNeeds
    .Where(n => n.FiscalYear.HasValue)
    .GroupBy(n => n.FiscalYear!.Value)
    .ToDictionary(g => g.Key, g => g.Sum(n => n.EstimatedCost));
```

Pass to `BuildFinancial`. `GapByYear` gets a `ProgrammedSpendM` field. Report chapter shows plan-vs-budget discrepancy (differentiator vs standalone TAMP software).

---

## 8. API Surface

### 8.1 Existing (Sprint 18a)

| Method | Route | Auth | Rate Limit |
|---|---|---|---|
| `GET` | `/api/v1/capital-needs/{id}/plan-status-history` | JWT | standard |
| `POST` | `/api/v1/capital-needs/{id}/sync-plan-now` | JWT | 1/min per user + `integrations-posts` 10/min |
| `POST` | `/api/v1/capital-needs/{id}/resolve-plan-conflict` | JWT | standard |

### 8.2 New Endpoints Required

None. When Plan adds webhooks:

| Method | Route | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/v1/integrations/plan-webhook` | HMAC-SHA256 | `X-Aurigo-Signature: sha256=HMAC_HEX` |

---

## 9. Backward Compatibility

- Existing rows backfilled to `PlanStatus=Draft` for `Pushed` needs, else `NotPushed`.
- Frontend renders no pill for `NotPushed` (graceful degrade).
- Outbound push path untouched.
- `GapByYear.ProgrammedSpendM` appended at end (positional-record safety).

---

## 10. Testing

### 10.1 Unit Tests

New file: `AurigoPlanStatusPollingWorkerTests.cs`
- `MapPlanStatusToCapitalNeed` full vocabulary
- `IsPostHandoffLifecycle` for all `JobOrderStatus`
- `TryExtractCharterIdFromUrl` various URL shapes

### 10.2 Integration Tests

New file: `PlanStatusPollingIntegrationTests.cs` (WireMock + Testcontainers Postgres):
1. Seed pushed need, WireMock returns `Approved` → assert `PlanStatus=Approved` + history row
2. WireMock returns `Cancelled` with active JobOrder → assert `HasPlanConflict=true`
3. Resolve endpoint clears conflict, writes User-sourced history row
4. On-demand `sync-plan-now` returns refreshed DTO
5. Rate-limit: second call in same minute returns 429

Set `AurigoPlanPolling:IntervalMinutes=0` in test appsettings so background worker doesn't race explicit calls.

### 10.3 Frontend

Vitest: `PlanStatusPill.test.tsx` covering all 7 statuses + conflict banner + link href/target.

Playwright: create need → push → simulate approval → assert blue pill + "View in Plan" visible + "Push to Plan" hidden.

---

## 11. Effort Estimate

| Work Item | Layer | PD |
|---|---|---|
| FE: TS interface additions | FE | 0.25 |
| FE: `PlanStatusPill` component | FE | 1.5 |
| FE: `NeedRow` integration + column rename | FE | 0.5 |
| FE: `NeedDetailDrawer` extend + Sync Now + Resolve + history | FE | 1.5 |
| FE: `useSyncPlanNow` + `useResolvePlanConflict` hooks | FE | 0.5 |
| FE: Asset detail badge | FE | 0.5 |
| FE + QA: unit + Playwright tests | FE/QA | 1.0 |
| BE: TAMP `GapByYear.ProgrammedSpendM` + `BuildFinancial` | BE | 0.5 |
| BE + QA: `AurigoPlanStatusPollingWorkerTests` unit | BE/QA | 0.5 |
| BE + QA: `PlanStatusPollingIntegrationTests` WireMock | BE/QA | 1.0 |
| PM: Plan-team coordination (B-1, G-1, G-2) | PM | 0.5 |
| **Total** | | **8.25 PD** |

Plan-team dependencies:
- **B-1 (Blocker):** status vocab confirmation before Sprint 19 kickoff
- **G-1 (Non-blocking):** `programmedFiscalYear` field on `PublicCharter`
- **G-2 (Non-blocking):** `fundedAmount` distinct from `capExEstimate`

---

## 12. Rollout

**Feature flag:** Not needed. Polling controlled by `AurigoPlanPolling:IntervalMinutes=0` per environment.

**Per-tenant enable:** Already gated via `TenantIntegrationCredentials`. `IAurigoPlanClientFactory.ListTenantsWithActivePushesAsync` skips tenants without Plan credentials.

**Deploy sequence:**
1. Ship backend Sprint 18a migration (verify applied in staging)
2. Deploy polling worker with `IntervalMinutes=15` in staging
3. Verify against test CapitalNeed in staging Plan tenant
4. Ship FE additions
5. Enable in production via `appsettings.Production.json`

**Monitoring:** Alert on `Handoff.CapitalNeedToPlan.PlanConflictRaised` (Warning) so support can proactively notify asset managers.
