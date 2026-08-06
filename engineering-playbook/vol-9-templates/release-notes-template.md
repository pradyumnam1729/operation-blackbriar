# Release Notes — [Product Name] v[X.Y.Z]

---

## Release Header

| Field | Value |
|-------|-------|
| **Version** | [X.Y.Z] |
| **Release Date** | YYYY-MM-DD |
| **Release Type** | Major / Minor / Patch |
| **Product** | Masterworks Maintain / Primus Maintain / Both |
| **Released By** | [EM or release engineer name] |
| **Deployment Window** | YYYY-MM-DD HH:MM - HH:MM UTC |
| **Rollback Version** | [Previous version number] |

---

## Executive Summary

[Two to three sentences. State the most significant capability added or problem fixed in this release, and who benefits from it. Write for a customer success manager explaining the release to a customer — not for an engineer.]

---

## New Features

*Each new feature entry describes what was added and the customer benefit. Link to full documentation where available.*

### [Feature Name]

**What it does:** [One to two sentences describing the feature from the user's perspective.]

**Who benefits:** [Persona or role — e.g., "DOT Asset Managers who are required to submit annual TAMP reports."]

**How to access:** [Where to find the feature in the UI — e.g., "Asset Inventory > Pavement > Export > TAMP XML."]

**Documentation:** [Link to help article or vault note if available]

---

### [Feature Name]

**What it does:** [Description]

**Who benefits:** [Persona]

**How to access:** [Navigation path]

---

## Improvements

*Enhancements to existing features: performance improvements, UX improvements, reliability improvements.*

- **[Component or feature name]:** [Description of improvement and observable benefit. E.g., "Dashboard load time reduced from 9.4s to 1.8s (P95) for tenants with more than 20,000 assets, due to RUL result caching."]
- **[Component or feature name]:** [Description]
- **[Component or feature name]:** [Description]

---

## Bug Fixes

*Describe the symptom that was fixed and the scenario in which users experienced it. Do not include internal ticket numbers.*

- **[Module] — [Short description of symptom]:** [One sentence describing when the bug occurred and what the user experienced. One sentence describing what was fixed.]
- **[Module] — [Short description]:** [Description]
- **[Module] — [Short description]:** [Description]

---

## Breaking Changes

*API changes, configuration changes, or behavioral changes that require customer or integration action.*

> **Action required before upgrading if you are using [X].**

### [Breaking Change Title]

**What changed:** [Describe what changed technically.]

**Who is affected:** [Which customers, integrations, or API consumers are affected.]

**Migration required:** Yes / No

**Migration Guide:**

[Step-by-step instructions for customers to migrate. Include before/after code or configuration examples if applicable.]

Before:
```json
{
  "exampleField": "old-value"
}
```

After:
```json
{
  "exampleField": "new-value",
  "newRequiredField": "value"
}
```

**Deadline for migration:** [Date after which the old behavior is no longer supported, if applicable.]

---

## Known Issues

*Acknowledged issues in this release. These are documented here so customers know they are seen, and are accompanied by workarounds where possible.*

| Issue | Affected Version | Workaround | Fix Target |
|-------|-----------------|------------|-----------|
| [Short description of the issue] | v[X.Y.Z] | [Workaround steps, or "None available"] | v[X.Y.Z+1] / Sprint [N] |

---

## Deprecation Notices

*Features or API fields that are deprecated in this release and will be removed in a future version.*

| Deprecated Item | Type | Replacement | Removal Date |
|----------------|------|-------------|-------------|
| [Field / endpoint / feature name] | API field / Endpoint / UI feature | [Replacement name or "No replacement — see migration guide"] | YYYY-MM-DD (v[X.Y+1.0]) |

---

## Upgrade Instructions

*Steps required to upgrade from the previous version. If no steps are required beyond the standard deployment, write "Standard deployment — no additional steps required."*

1. [Pre-deployment step — e.g., "Back up the database before applying migrations."]
2. [Deployment step — e.g., "Run `dotnet ef database update` — two new migrations are included in this release."]
3. [Post-deployment step — e.g., "Warm up the RUL cache by visiting the dashboard for each active tenant."]

---

## API Changes

*Summarizes all API changes in this release for API consumers and integration partners.*

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| [GET/POST] | `/api/v1/[path]` | [Brief description] |

### Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| [GET/POST] | `/api/v1/[path]` | [What changed — new optional field, new response property, etc.] |

### Deprecated Fields

| Endpoint | Deprecated Field | Replacement Field | Removed In |
|----------|-----------------|------------------|-----------|
| [Path] | `[fieldName]` | `[newFieldName]` | v[X.Y+1.0] |

The full OpenAPI specification for this release is available at `/swagger/v1/swagger.json` in your deployed environment.

---
---

## Example: Masterworks Maintain v1.3.0

### Release Header

| Field | Value |
|-------|-------|
| **Version** | 1.3.0 |
| **Release Date** | 2026-07-15 |
| **Release Type** | Minor |
| **Product** | Masterworks Maintain |
| **Released By** | Priya Nambiar |
| **Deployment Window** | 2026-07-15 02:00 - 03:30 UTC |
| **Rollback Version** | 1.2.4 |

### Executive Summary

Maintain v1.3.0 introduces the Risk Score Dashboard, giving DOT Asset Managers a real-time ranked view of their highest-risk infrastructure assets alongside capital need projections. This release also delivers a 79% improvement in dashboard load time for large tenants and fixes three field-reported issues with condition recording on mobile devices.

### New Features

#### Risk Score Dashboard

**What it does:** Displays a ranked table of all assets sorted by composite risk score (probability of failure times consequence of failure), with configurable thresholds for High / Medium / Low risk bands. Includes a choropleth map view overlaying risk scores on asset geometry.

**Who benefits:** DOT Asset Managers (Kenji Watanabe persona) who need to prioritize capital investments based on risk, not just age.

**How to access:** Dashboard > Risk tab. The Risk tab is visible to users with the AssetManager role or higher.

**Documentation:** `vault/calculations/RiskScorer.md`

---

#### 5-Year Capital Needs Export

**What it does:** Generates a CSV export of the 5-year capital needs projection, showing projected replacement year, estimated cost, and funding gap by asset class. Designed to support agency budget presentations.

**Who benefits:** Finance analysts and DOT Directors who prepare annual capital budget submissions.

**How to access:** Capital Needs > Export > 5-Year Projection (CSV).

---

### Improvements

- **Dashboard load time:** Reduced from 9.4s to 1.8s P95 for tenants with more than 20,000 assets, by introducing a 24-hour Redis cache for RUL computation results (RFC-004). Cache is automatically invalidated when a new inspection record is saved.
- **Condition recording form — mobile:** Date picker on the inspection form is replaced with a native `<input type="date">` on touch devices, fixing a long-standing usability issue on iPad and iPhone.
- **Asset map clustering:** Asset markers on the map view now cluster at zoom levels below 12, preventing rendering performance degradation on tenants with more than 50,000 assets.

### Bug Fixes

- **Condition > Inspection List — filter badge count off by one:** When a user filtered the inspection list by multiple inspectors simultaneously, the "N results" badge showed a count one lower than the actual result set. The aggregate query now correctly counts all matching records.
- **Asset detail page — geometry not rendering after save:** After editing an asset's geometry and saving, the map on the asset detail page continued to show the old geometry until a manual page refresh. The map now automatically re-fetches geometry after a successful save.
- **Risk scoring — assets with no inspection record causing null reference:** Assets that had never been inspected caused a null reference exception in the risk scorer, resulting in those assets being silently excluded from risk rankings. Assets with no inspection now receive a default condition score of 0 and are included in the risk table with a "No inspection data" indicator.

### Breaking Changes

None in this release.

### Known Issues

| Issue | Affected Version | Workaround | Fix Target |
|-------|-----------------|------------|-----------|
| Risk score map choropleth rendering is slow (> 5 seconds) for tenants with more than 100,000 assets | v1.3.0 | Switch to the Table view for large asset sets; the table renders in < 1 second | v1.3.1 (Sprint 20) |

### Deprecation Notices

| Deprecated Item | Type | Replacement | Removal Date |
|----------------|------|-------------|-------------|
| `GET /api/v1/assets/{id}/rul` — `legacyConditionScore` response field | API field | `conditionScore` (introduced in v1.1.0) | 2026-10-01 (v1.5.0) |

### Upgrade Instructions

1. Apply database migrations: `dotnet ef database update` — this release includes migration `20260714_AddRiskScoreColumns`.
2. Ensure the Redis ElastiCache endpoint is configured in `appsettings.Production.json` under `Redis:ConnectionString`. If not configured, RUL results fall back to live computation (no data loss, but performance degrades).
3. Standard deployment — no other steps required.
