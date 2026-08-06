# 13 — Conflict Resolution

## Overview

When Maintain reads from an EAM system and also generates its own data (condition scores, capital needs, work order recommendations), conflicts arise. The same asset record exists in two systems — the EAM and Maintain — and the two copies can diverge. This document defines how Maintain resolves those conflicts.

Conflicts are not errors. They are an expected consequence of running two systems that each have authoritative ownership over different subsets of the same data. The conflict resolution strategy makes that ownership explicit and handles edge cases consistently.

## Conflict Categories

### Identity Conflict

The same physical asset appears under different IDs or records in the EAM and Maintain.

**Example:** An EAM system is reconfigured and ASSETNUM changes from `BRIDGE-001` to `BR-001-MAIN`. Maintain has the asset stored under the old canonical ID derived from `BRIDGE-001`. When the new record arrives, Maintain treats it as a new asset rather than an update.

**Resolution:** Check for identity conflicts using fuzzy matching on (name, install date, location) when a canonical ID does not match. If the match confidence is > 85%, merge the records. If confidence is 70–85%, create a human review item. Below 70%, treat as a new asset.

Identity conflict detection runs as part of the initial load and when the sync error count exceeds 5% for a tenant.

### Data Conflict

The same field has different values in the EAM and Maintain.

**Example:** The EAM has `INSTALLDATE = 2005-03-15` but a Maintain inspector has manually corrected it to `2004-11-20` after discovering the EAM data was wrong. On the next sync, the EAM value would overwrite the corrected value.

**Resolution:** Apply per-field ownership policies (see Policy section below). EAM-owned fields are always overwritten. Maintain-owned fields are never overwritten. Shared fields use last-write-wins with a displacement threshold for location data.

### Delete Conflict

An asset is deleted (or status set to Inactive) in the EAM, but it has an active capital need or open inspection in Maintain.

**Example:** An agency retires a bridge in Maximo (sets status = DECOMMISSIONED), but Maintain has a $2M capital need for the bridge that was approved in the previous year's CIP.

**Resolution:** Never hard-delete an asset from Maintain when an active capital need exists. Instead:
1. Set `Asset.Status = EamDecommissioned`
2. Create a human review item: "Asset marked decommissioned in EAM while active capital need exists"
3. The reviewer can choose: close the capital need (bridge is truly being replaced), keep the capital need (the EAM status is wrong), or merge with a replacement asset.

### Schema Conflict

The EAM sends a field that has no canonical equivalent in Maintain.

**Example:** Maximo has a custom field `CUST_BRIDGE_LOAD_CLASS` (load classification for bridges) that does not map to any `CanonicalAsset` field.

**Resolution:** Store in `CanonicalAsset.CustomFields["CUST_BRIDGE_LOAD_CLASS"]`. Log a one-time informational message. Never discard unknown fields — they may be useful for future canonical model extensions.

## Per-Field Ownership Policies

These policies define which system wins for each field type. They are applied during upsert.

### EAM Wins (always overwrite from EAM)

EAM is the system of record for operational and physical facts about the asset:
- `Name` — asset name is managed by the maintenance team
- `Description` — same
- `InstallDate` — set at commissioning; EAM is authoritative
- `SerialNumber` — set at commissioning
- `Manufacturer`, `Model` — fixed physical attributes
- `OriginalCost` — financial record from procurement
- `SiteCode`, `LocationCode` — physical location assignment
- `DepartmentCode` — organizational assignment
- `Status` (when EAM sets it to Decommissioned) — EAM decommission is authoritative

### Maintain Wins (never overwrite from EAM)

Maintain is the system of record for intelligence and assessment:
- `ConditionScore` — calculated by Maintain from inspections; EAM cannot produce this
- `RemainingUsefulLifeYears` — calculated by Maintain RUL engine
- `AssetReplacementValue` — calculated by Maintain ARV engine
- `RiskScore`, `RiskCategory` — calculated by Maintain risk engine
- `CapitalNeedIds` — created by Maintain capital planning
- `LastInspectionDate` — set when Maintain inspection is completed
- `ConditionTrend` — derived by Maintain from history

### Last-Write-Wins (with human review threshold)

For fields that both systems legitimately update:
- `Location.Geometry` (spatial coordinates)
  - If displacement < 100 meters: EAM wins (minor correction)
  - If displacement 100m–1km: Last write wins, log the change
  - If displacement > 1km: Human review required (likely a data error)
- `AssetTypeCode` — if EAM changes asset type, accept it but flag for review if Maintain has inspection data for the old type
- `ExpectedLifeYears` — if EAM changes this, Maintain will recalculate RUL on next cycle; accept the change

## Conflict Resolution Implementation

```csharp
public class ConflictResolver
{
    public CanonicalAsset Resolve(CanonicalAsset existing, CanonicalAsset incoming)
    {
        // Start with existing (Maintain-owned fields preserved)
        var resolved = existing with {};
        
        // Apply EAM-wins fields unconditionally
        resolved = resolved with
        {
            Name = incoming.Name,
            Description = incoming.Description,
            InstallDate = incoming.InstallDate,
            SerialNumber = incoming.SerialNumber,
            Manufacturer = incoming.Manufacturer,
            Model = incoming.Model,
            OriginalCost = incoming.OriginalCost,
            SiteCode = incoming.SiteCode,
            DepartmentCode = incoming.DepartmentCode
        };
        
        // Handle status transitions
        if (incoming.Status == AssetStatus.Decommissioned && existing.HasActiveCapitalNeeds)
        {
            resolved = resolved with { Status = AssetStatus.EamDecommissioned };
            _reviewQueue.Enqueue(new ConflictReviewItem(
                AssetId: existing.Id,
                ConflictType: ConflictType.Delete,
                Description: "EAM decommission conflicts with active capital need",
                Options: ["close-capital-need", "ignore-eam-status", "flag-for-review"]));
        }
        else
        {
            resolved = resolved with { Status = incoming.Status };
        }
        
        // Location: check displacement
        if (existing.Geometry != null && incoming.Geometry != null)
        {
            var displacement = existing.Geometry.Distance(incoming.Geometry); // meters
            if (displacement > 1000)
            {
                _reviewQueue.Enqueue(new ConflictReviewItem(
                    AssetId: existing.Id,
                    ConflictType: ConflictType.LargeLocationDisplacement,
                    Description: $"Location changed by {displacement:F0}m",
                    Options: ["accept-eam", "keep-maintain", "manual-correct"]));
                // Keep existing geometry pending review
            }
            else
            {
                resolved = resolved with { Geometry = incoming.Geometry };
            }
        }
        
        // CustomFields: merge (EAM fields update; Maintain-only keys preserved)
        var mergedCustomFields = new Dictionary<string, string>(existing.CustomFields);
        foreach (var (k, v) in incoming.CustomFields)
            mergedCustomFields[k] = v;
        resolved = resolved with { CustomFields = mergedCustomFields };
        
        return resolved;
    }
}
```

## Human Review Queue

Items that cannot be auto-resolved appear in the human review queue. The queue is accessible via the Maintain admin panel under Settings → Integration → Conflict Review.

### Review Queue Schema

```sql
CREATE TABLE conflict_review_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    asset_id        UUID REFERENCES assets(id),
    conflict_type   VARCHAR(64) NOT NULL,
    description     TEXT NOT NULL,
    options         JSONB NOT NULL,  -- ["keep-maintain", "keep-eam", "merge"]
    resolution      VARCHAR(64),     -- NULL until resolved
    resolved_by     VARCHAR(256),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sla_deadline    TIMESTAMPTZ NOT NULL  -- 5 business days from created_at
);
```

### Resolution Options

For each review item, the reviewer selects one of:
- **Keep Maintain:** Maintain's value is authoritative. Create a field mapping override to prevent EAM from overwriting it in future syncs.
- **Keep EAM:** EAM's value is authoritative. Update Maintain to match and log the override.
- **Merge:** Opens a side-by-side view for the reviewer to manually construct the correct value.
- **Flag:** Escalate to the integration engineering team.

### SLA for Review

Review items must be resolved within 5 business days of creation. At 3 business days, an email reminder is sent to the tenant's designated integration owner. At 5 business days, the item is auto-escalated to Aurigo support.

Unresolved items do not block sync operations. Maintain continues syncing with the auto-resolved value (which may be incorrect) while the item is in the queue.

## Audit Trail

Every conflict resolution is logged, whether automatic (policy-based) or manual (human review).

```sql
CREATE TABLE conflict_resolution_audit (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           VARCHAR(64) NOT NULL,
    asset_id            UUID REFERENCES assets(id),
    conflict_type       VARCHAR(64) NOT NULL,
    field_name          VARCHAR(128),
    eam_value           TEXT,
    maintain_value      TEXT,
    resolved_value      TEXT,
    resolution_policy   VARCHAR(64),  -- 'eam-wins', 'maintain-wins', 'last-write-wins', 'human-review'
    resolved_by         VARCHAR(256), -- 'system:conflict-resolver' or user email
    resolved_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_operation_id   UUID REFERENCES sync_operation_logs(id)
);
```

This audit log is available via the admin API for compliance reporting and for debugging data quality issues. The integration team can query it to understand how specific fields are being resolved and whether the policies are producing correct results.
