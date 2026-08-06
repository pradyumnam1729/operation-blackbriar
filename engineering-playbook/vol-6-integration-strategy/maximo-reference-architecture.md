# Maximo Reference Architecture — "Primus above Maximo"

> Volume 6 · Integration Strategy · Reference Architecture
> Status: Current (2026-07-28)
> Scope: IBM Maximo 7.6.1.x (on-premise) and Maximo Application Suite (MAS 8.9–8.11)
> Owner: Integration Strategist
> Related: `01-ibm-maximo.md`, `vault/decisions/ADR-012-Maximo-7.6-vs-MAS.md`, `00-integration-overview.md`

---

## Overview

Primus sits above Maximo as an intelligence and capital planning layer. Maximo runs maintenance execution — it schedules PMs, dispatches technicians, tracks parts, and records work history. Primus reads that operational data, computes what Maximo cannot (RUL, ARV, risk, capital needs, LCP scenarios), and writes confirmed capital commitments back as planned work orders. The agency keeps its Maximo investment intact. Primus adds a planning intelligence that Maximo's data model was never designed to provide.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       IBM Maximo / MAS                          │
│                                                                  │
│  MXASSET (assets)          MXWO (work orders / history)         │
│  ┌──────────────────┐      ┌──────────────────────────────┐     │
│  │ ASSETNUM+SITEID  │      │ WONUM+SITEID, STATUS         │     │
│  │ DESCRIPTION      │      │ ACTLABCOST+ACTMATCOST        │     │
│  │ INSTALLDATE      │      │ ACTSTART, ACTFINISH          │     │
│  │ REPLACECOST      │      │ ASSETNUM (FK → MXASSET)      │     │
│  │ CHANGEDATE       │      │ CHANGEDATE                   │     │
│  └────────┬─────────┘      └──────────────┬───────────────┘     │
│           │  OSLC GET (delta, 15-min)     │  OSLC GET           │
└───────────┼───────────────────────────────┼─────────────────────┘
            │ inbound sync                  │ inbound sync
            ▼                               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      MaximoAdapter                                     │
│   Infrastructure/ExternalClients/Maximo/MaximoAdapter.cs              │
│                                                                         │
│   SyncAssetsAsync   ──→  UPSERT assets (SourceSystem="Maximo")         │
│   SyncWorkOrdersAsync──→ UPSERT job orders, link to asset by ExtId      │
│   Loop detection: skip WOs where reportedby="AurigoMaintain"           │
│   Auth: apikey header (7.6.1.3+ / MAS) OR maxauth header (7.6.0.x)    │
│   Credentials: TenantIntegrationCredential.EncryptedPayload (per-tenant)│
└───────────────────────────────────────────────────────────────────────┘
            │ Asset + WorkOrder records
            ▼
┌───────────────────────────────────────────────────────────────────────┐
│                  Primus Calculation Layer                              │
│                                                                         │
│  RulCalculator          — deterioration curve → years remaining         │
│  WeibullRulCalculator   — Weibull survival model (alt engine)           │
│  CalibrateDeterioration — observed rate from inspection history         │
│  ArvCalculator          — unit cost × quantity → replacement value      │
│  RiskScorer             — LoF × CoF → 5×5 matrix → Low/Med/High/Crit  │
│  CapitalNeedAutoSurfacer— creates capital needs when RUL/risk threshold │
│  LcpScenario engine     — multi-year NPV under funding constraints      │
│                                                                         │
│  All pure C#, stateless, in Application/Calculations/                  │
└───────────────────────────────────────────────────────────────────────┘
            │ Confirmed capital needs (Status=Confirmed, Asset.SourceSystem="Maximo")
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                RunOutboundSyncAsync                                      │
│   Infrastructure/ExternalClients/Maximo/MaximoAdapter.cs                │
│                                                                           │
│   POST /oslc/os/mxwo (7.6) or /api/os/mxwo (MAS)                        │
│   Payload: MaximoWorkOrderCreateMapper.Map(need, asset)                  │
│   Loop marker: reportedby="AurigoMaintain", description="[AurigoMaintain: NEED-{id}]…"│
│   Result: WONUM extracted from Location header or response body          │
│   Persisted: CapitalNeedExternalPush{TargetSystem="Maximo", Status=Pushed}│
└─────────────────────────────────────────────────────────────────────────┘
            │ OSLC POST (planned WO)
            ▼
┌────────────────────────────────────────────┐
│             IBM Maximo / MAS               │
│   Planned work order created in MXWO       │
│   Status: WAPPR (Waiting for approval)     │
└────────────────────────────────────────────┘
```

---

## What Primus reads from Maximo

### MXASSET → Asset master

The inbound asset sync pulls from the `mxasset` OSLC object structure using a `changedate > {cursor}` delta filter. Each record is mapped by `MaximoAssetMapper` to a `CanonicalAsset` shape and upserted into Primus's `assets` table with `SourceSystem="Maximo"` and `SourceExternalId="{ASSETNUM}:{SITEID}"`.

| Maximo field | Primus field | Notes |
|---|---|---|
| ASSETNUM + SITEID | SourceExternalId (composite) | Prevents false duplicates across multi-site configs |
| DESCRIPTION | Name | |
| INSTALLDATE | YearInstalled | |
| REPLACECOST | ReplacementCost | EAM-provided; Primus recalculates its own ARV on top |
| ASSETTYPE | AssetClassCode | Must match a pre-registered AssetClass for the tenant |
| LOCATION | LocationText | Free text; geometry resolved via ArcGIS connector (Sprint 15-tail) |
| CHANGEDATE | (delta filter field) | Stored in server local time; adapter converts using `ServerTimeZoneId` config |

Full field map: `engineering-playbook/vol-6-integration-strategy/01-ibm-maximo.md` § Data Mapping Table.

### MXWO → Work order history

Work order history feeds the `job_orders` table and drives two downstream calculations: actual cost informs capital need variance tracking, and completion records calibrate deterioration rates via the `CalibrateAssetDeteriorationRate` handler.

Inbound loop detection: any WO with `reportedby="AurigoMaintain"` or a description starting with `[AurigoMaintain: NEED-` is skipped by `MaximoAdapter.IsEchoedMaintainWorkOrder`. This prevents an infinite push-back echo loop.

When Maximo reports a WO terminal status (COMP, CLOSE, CAN), the corresponding Primus `JobOrder` is auto-advanced to `Completed` and a `JobOrderStatusHistory` row is written. When a Primus JobOrder completes on the Maintain side, `NotifyJobOrderClosedAsync` posts a `changeStatus=CLOSE` action back to Maximo (`POST /oslc/os/mxwo/{wonum}?action=changeStatus`).

---

## What Primus calculates on top of Maximo data

Once assets and work order history are in Primus, the calculation layer runs independently of Maximo:

**RUL (Remaining Useful Life)** — `Application/Calculations/RulCalculator.cs`: linear deterioration model from `YearInstalled`, design life, and current condition score. `WeibullRulCalculator` provides an alternative Weibull survival model. Both run on inspection save. `DeteriorationCalibrationHandlers.cs` refines the per-asset deterioration rate from observed inspection history via `POST /api/v1/assets/{id}/calibrate-deterioration`.

**ARV (Asset Replacement Value)** — `Application/Calculations/ArvCalculator.cs`: unit cost rate (from `UnitCostRate` lookup) × quantity × inflation adjustment. Maximo's `REPLACECOST` field is stored separately as `ReplacementCostEam` for comparison; Primus uses its own ARV for all risk and capital calculations.

**Risk scoring** — `Application/Calculations/RiskScorer.cs`: 5×5 matrix, LoF = max(condition-derived, RUL-band-derived), CoF from domain profile weights, Risk = LoF × CoF. Bands: Low (1–4), Medium (5–9), High (10–16), Critical (17–25).

**Capital needs** — `CapitalNeedAutoSurfacerService`: surfaces needs when RUL crosses into ApproachingEol or Critical bands, or when risk score exceeds the tenant-configured threshold.

**LCP scenarios** — multi-year capital spend optimisation under funding constraints; NPV stored on `LcpSummary`. Scenarios drive the TAMP capital investment program narrative.

**TAMP** — `TampVersion` entity aggregates performance targets, capital needs, LCP scenario, PM2/PM3 actuals, and narratives into a versioned, PDF-exportable plan document submitted to FHWA.

---

## What Primus writes back to Maximo

### Confirmed capital needs → planned work orders (MXWO OSLC POST)

When a capital need is confirmed (status `Confirmed`, asset `SourceSystem="Maximo"`), `RunOutboundSyncAsync` pushes it to Maximo as a planned WORKORDER. Eligibility criteria:

1. `CapitalNeed.Status == Confirmed`
2. `Asset.SourceSystem == "Maximo"` — round-trips only assets that originated in Maximo; Primus-native assets have no Maximo home
3. No `CapitalNeedExternalPush` row with `TargetSystem="Maximo"` and `Status=Pushed` yet

The payload is built by `MaximoWorkOrderCreateMapper.Map(need, asset, maintainBaseUrl, reportedBy)`. The loop marker `reportedby="AurigoMaintain"` and description prefix `[AurigoMaintain: NEED-{id}]` are written on every outbound WO so the inbound sync can skip them.

The created WONUM is extracted from:
1. `Location` response header (preferred — standard OSLC 201 behaviour)
2. `{"wonum": "..."}` response body (some MAS installs echo the row)
3. Recovery search: `GET /oslc/os/mxwo?oslc.where=reportedby="AurigoMaintain"&oslc.orderBy=-reportdate&oslc.pageSize=5` matching on description prefix

Push state is recorded in `CapitalNeedExternalPush{TargetSystem="Maximo"}`. Failed pushes stay `PushFailed` and are retried on the next outbound sync cycle.

Batch cap: 50 capital needs per outbound sync run (`MaximoAdapter.OutboundBatchSize`).

---

## Authentication

### Per-tenant credentials — not global appsettings

All Maximo credentials are stored per-tenant in `TenantIntegrationCredential.EncryptedPayload`, not in `appsettings.json` or environment variables. The payload is AES-encrypted at rest via `ISecretPayloadProtector` (ASP.NET Core Data Protection). The `MaximoServiceCredentialResolver` decrypts and returns a `MaximoCredentials` record at sync time.

Per-tenant endpoint configuration lives in `TenantIntegrationCredential.EndpointOverridesJson` (`MaximoEndpointOverrides`): `BaseUrl`, `SiteId`, `ServerTimeZoneId`, path overrides. This is the only place the Maximo base URL lives — there is no global Maximo URL in `appsettings.json`.

### Maximo 7.6.1.x — API key header

```
apikey: {api-key}
```

Maximo 7.6.1.3+ and all MAS installs accept an API key header. The `MaximoAdapter.BuildAuthenticatedRequest` method emits `apikey` when `MaximoCredentials.ApiKey` is set.

### Maximo 7.6.0.x through 7.6.1.2 — MAXAUTH header (Basic)

```
maxauth: base64("{loginname}:{password}")
```

Older on-premise installs that do not support API keys use the `maxauth` header (Maximo's proprietary Basic Auth variant). The adapter falls back to `maxauth` when `ApiKey` is absent and `LoginName` is set.

### MAS — OAuth2 ROPC (roadmap)

MAS uses IBM IAM OAuth2. The current adapter uses API keys for MAS (IBM IAM API keys are long-lived and do not require a token exchange). Full OAuth2 ROPC (Resource Owner Password Credentials) with token caching and refresh is a Sprint 15-tail item; see `ADR-012` for the detection and dispatch strategy.

---

## Maximo 7.6 vs. MAS differences

| Dimension | Maximo 7.6.1.x (on-prem) | MAS 8.9–8.11 (cloud) |
|---|---|---|
| Base OSLC path | `/maximo/oslc/os/mxasset` | `/maximo/api/os/mxasset` |
| Auth | `apikey` header or `maxauth` header | IBM IAM API key (same `apikey` header; OAuth2 ROPC is Sprint 15-tail) |
| Health check path | `/maximo/oslc/whoami` | `/maximo/api/whoami` (or `/maximo/oslc/os/mxperson?oslc.pageSize=1` fallback) |
| WO create path | `POST /maximo/oslc/os/mxwo` | `POST /maximo/api/os/mxwo` |
| WO status change | `POST /oslc/os/mxwo/{wonum}?action=changeStatus` | Same path pattern under `/api/` |
| WO deep-link URL | `{host}/webclient/login/main.jsp?event=loadapp&value=wotrack&wonum={wonum}` | `{host}/maximo/manage/workorders/{wonum}` |
| Response wrapper | `rdfs:member` array | `rdfs:member` or `member` array (some 8.10+ installs drop the `rdfs:` prefix) |
| CHANGEDATE time zone | Server local time (must configure `ServerTimeZoneId` per tenant) | Same — MAS does not change this behaviour |
| Event-driven sync | Not supported | Kafka topics available in MAS 8.9+; delta polling is the fallback |

Path selection is handled entirely via `MaximoEndpointOverrides` — there is no version-conditional branching in the adapter. When a tenant is on MAS, the onboarding operator sets the MAS paths in `EndpointOverridesJson`. The adapter code is identical; only the configured paths differ. See `ADR-012-Maximo-7.6-vs-MAS.md` for the rationale.

---

## Sync state management

The adapter cursor uses ISO 8601 UTC timestamps stored in `IntegrationSyncCursor` rows keyed on `(TenantId, Vendor="Maximo", Direction="Inbound", EntityType)`. Separate cursors exist for `Asset` and `WorkOrder` so a WO sync failure does not block the next asset cursor advance.

On the outbound side, the cursor is the `CapitalNeedExternalPush` table itself — the eligibility query acts as the cursor by excluding already-pushed records.

---

## References

- `Infrastructure/ExternalClients/Maximo/MaximoAdapter.cs` — full adapter implementation
- `Infrastructure/ExternalClients/Maximo/MaximoAssetMapper.cs` — OSLC → CanonicalAsset
- `Infrastructure/ExternalClients/Maximo/MaximoWorkOrderMapper.cs` — OSLC → CanonicalWorkOrder
- `Infrastructure/ExternalClients/Maximo/MaximoWorkOrderCreateMapper.cs` — CapitalNeed → OSLC WO payload
- `Infrastructure/ExternalClients/Maximo/MaximoServiceCredentialResolver.cs` — credential decryption
- `Infrastructure/ExternalClients/Maximo/MaximoClientOptions.cs` — static defaults + per-tenant overrides shape
- `engineering-playbook/vol-6-integration-strategy/01-ibm-maximo.md` — field mapping, error handling, setup checklist
- `vault/decisions/ADR-012-Maximo-7.6-vs-MAS.md` — version detection and auth dispatch strategy
- `vault/decisions/ADR-009-Source-EAM-BackLink-Encoding.md` — code prefix convention for Aurigo Plan push
