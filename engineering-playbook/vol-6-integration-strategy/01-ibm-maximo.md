# 01 — IBM Maximo Integration

## Overview

IBM Maximo Asset Management is the most widely deployed EAM platform in public sector infrastructure management. Cities, counties, transit authorities, and state DOTs have run Maximo for 20 to 30 years. It is known for extreme configurability — virtually every table, field, application, and workflow can be customized — which is both its greatest strength and the primary integration challenge.

This guide covers Maximo 7.6.1, 7.6.1.x (the last on-premise release), and IBM Maximo Application Suite (MAS) — the SaaS successor. All three share the same core data model, but MAS adds OAuth 2.0, improved REST APIs, and in some configurations exposes GraphQL (covered in `09-graphql.md`).

**Key Maximo tables and objects:**

| Object | Description | Primary Key |
|---|---|---|
| ASSET | Equipment and infrastructure assets | ASSETNUM + SITEID |
| LOCATIONS | Functional locations (physical address in asset hierarchy) | LOCATION + SITEID |
| WORKORDER | Work orders for corrective and preventive maintenance | WONUM + SITEID |
| PM | Preventive maintenance schedules | PMNUM + SITEID |
| FAILURE | Failure codes and symptom records | FAILURECODE |
| ASSET_SPEC | Asset attribute values (specifications) | ASSETNUM + ASSETATTRID |
| CLASSSTRUCTURE | Asset classification hierarchy | CLASSSTRUCTURE |

## Data Mapping Table

The following table maps Maximo fields to Aurigo canonical fields. Field paths use the format `OBJECT.FIELD` as they appear in OSLC queries.

| Maximo Field | Canonical Field | Type | Notes |
|---|---|---|---|
| ASSET.ASSETNUM | CanonicalAsset.EamNativeId | string | Composite: ASSETNUM + ":" + SITEID |
| ASSET.DESCRIPTION | CanonicalAsset.Name | string | |
| ASSET.ASSETTYPE | CanonicalAsset.AssetTypeCode | string | Map via AssetClassConfig |
| ASSET.CLASSSTRUCTUREID | CanonicalAsset.AssetClassCode | string | Traverse CLASSSTRUCTURE hierarchy |
| ASSET.SERIALNUM | CanonicalAsset.SerialNumber | string | Nullable |
| ASSET.SITEID | CanonicalAsset.SiteCode | string | |
| ASSET.LOCATION | CanonicalAsset.LocationCode | string | FK to LOCATIONS |
| ASSET.INSTALLDATE | CanonicalAsset.InstallDate | DateOnly | |
| ASSET.VENDOR | CanonicalAsset.Manufacturer | string | Actually the vendor field |
| ASSET.MANUFACTURER | CanonicalAsset.Manufacturer | string | Prefer this over VENDOR |
| ASSET.STATUS | CanonicalAsset.Status | enum | OPERATING→Active, DECOMMISSIONED→Decommissioned |
| ASSET.REPLACECOST | CanonicalAsset.ReplacementCostEam | decimal | EAM-provided; Maintain calculates its own ARV |
| ASSET.PURCHPRICE | CanonicalAsset.OriginalCost | decimal | |
| ASSET.EXPECTEDLIFE | CanonicalAsset.DesignLifeYears | int | |
| ASSET.CHILDREN (count) | CanonicalAsset.HasChildren | bool | Derived |
| ASSET.PARENT | CanonicalAsset.ParentEamId | string | Nullable |
| ASSET.GLACCOUNT | CanonicalAsset.DepartmentCode | string | GL account as proxy for department |
| ASSET.CHANGEDATE | (sync filter field) | datetime | Used in delta sync WHERE clause |
| WORKORDER.WONUM | CanonicalWorkOrder.EamNativeId | string | Composite: WONUM + ":" + SITEID |
| WORKORDER.DESCRIPTION | CanonicalWorkOrder.Description | string | |
| WORKORDER.STATUS | CanonicalWorkOrder.Status | enum | WAPPR/APPR/INPRG/COMP/CLOSE |
| WORKORDER.REPORTEDBY | CanonicalWorkOrder.ReportedBy | string | |
| WORKORDER.REPORTDATE | CanonicalWorkOrder.ReportedAt | datetime | |
| WORKORDER.ACTFINISH | CanonicalWorkOrder.CompletedAt | datetime | Nullable |
| WORKORDER.ACTLABCOST + ACTMATCOST | CanonicalWorkOrder.ActualCost | decimal | Sum |
| WORKORDER.ASSETNUM | CanonicalWorkOrder.AssetEamId | string | |

## Authentication

### Maximo 7.6.1 (On-Premise)

Maximo 7.6.1 uses Basic Authentication with a service account. The service account must be created in Maximo's Security Groups with read access to the required objects.

```
Authorization: Basic base64(username:password)
maxauth: base64(username:password)   // Alternative header, required for some versions
```

The service account needs read access to: ASSET, LOCATIONS, WORKORDER, PM, FAILURE, ASSET_SPEC, CLASSSTRUCTURE. In Maximo Security Groups, grant the `MAXREAD` permission set for each application.

Store credentials in AWS Secrets Manager. Never hardcode credentials in adapter configuration JSON.

```json
{
  "authType": "basic",
  "credentials": {
    "secretArn": "arn:aws:secretsmanager:us-east-1:123456789:secret:maximo-boston-creds"
  }
}
```

### IBM MAS (SaaS)

MAS uses OAuth 2.0 with client credentials flow via IBM App Connect or IBM Identity and Access Management (IAM). Obtain the token URL, client ID, and client secret from the MAS administrator.

```
POST https://iam.cloud.ibm.com/identity/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={YOUR_API_KEY}
```

Token response includes an `expiration` field (epoch seconds). Cache the token and refresh proactively 60 seconds before expiry. On a 401 response, invalidate the cached token and re-authenticate immediately.

## Sync Strategy

### Initial Load

The initial load extracts all assets regardless of modification date. Use OSLC REST API with paging to avoid memory exhaustion.

```
GET /maximo/oslc/os/mxasset
    ?oslc.where=SITEID="BOSTON"
    &oslc.select=ASSETNUM,DESCRIPTION,ASSETTYPE,SERIALNUM,INSTALLDATE,CHANGEDATE,...
    &oslc.pageSize=200
    &pagingref=1
```

The response includes an `rdfs:member` array and an `oslc:nextPage` link. Follow `oslc:nextPage` until it is absent. Record progress after each page in the sync state table so that a restart after failure resumes from the last successful page rather than from the beginning.

Initial load is run once at onboarding during off-hours (2 AM to 5 AM tenant local time). For agencies with more than 500,000 assets, coordinate with the IT team to allow increased Maximo query load or use the bulk export via Maximo's Integration Framework (MIF) instead of OSLC.

### Delta Sync

Delta sync runs every 15 minutes. It filters by `CHANGEDATE` greater than the last successful sync timestamp.

```
GET /maximo/oslc/os/mxasset
    ?oslc.where=ASSET.CHANGEDATE>"2026-07-18T14:00:00+00:00"
    &oslc.select=ASSETNUM,DESCRIPTION,...
    &oslc.pageSize=200
```

Important: Maximo `CHANGEDATE` is in server local time, not UTC. The adapter must know the Maximo server's time zone (configured in `IntegrationAdapterConfig`) and convert accordingly. Most public-sector Maximo installations are on US Eastern, Central, Mountain, or Pacific time.

Also sync child records when parent changes: a `CHANGEDATE` on a `WORKORDER` does not update the parent `ASSET`. Query work orders separately with their own CHANGEDATE filter and link them to assets via `ASSETNUM`.

### Event-Driven Sync (MAS Only)

MAS exposes Kafka topics for change events. When available, subscribe to the asset change topic for sub-minute latency. Polling remains the fallback.

## Error Handling

| Error Condition | Handling Strategy |
|---|---|
| Connection timeout (> 30s) | Retry with exponential backoff: 5s, 30s, 2min, 10min. After 4 failures, mark sync as degraded, alert on-call. |
| HTTP 401 Unauthorized | Invalidate cached token (MAS) or credentials (7.6.1). Retry once. If still 401, halt sync and alert. |
| HTTP 429 Too Many Requests | Respect Retry-After header. Add 5-minute jitter to next sync start. |
| HTTP 503 Service Unavailable | Exponential backoff as timeout. Check Maximo server status. |
| Invalid record (parse failure) | Log the raw record, skip it, increment `parse_error_count` in sync state. Continue batch. |
| Custom field not found | Map to `CanonicalAsset.CustomFields["MaximoField"]`. Log a warning. Do not fail the record. |
| CLASSSTRUCTURE not found | Map `AssetClassCode` to "UNKNOWN". Log warning. Accept and flag for manual review. |
| Missing required field | If `ASSETNUM` is null, skip. If `DESCRIPTION` is null, use "Asset {ASSETNUM}" as default. |

## Customization Handling

Maximo's configurability means every agency has a different field layout. Field mapping overrides are stored in the adapter configuration JSON.

```json
{
  "fieldMappingOverrides": {
    "asset.installDate": "ASSET.CUSTINSTALLDATE",
    "asset.condition": "ASSET.CUST_CONDITION_RATING",
    "asset.department": "ASSET.CUST_DIVISION"
  },
  "assetSpecMappings": {
    "asset.material": "CUST_MATERIAL_TYPE",
    "asset.length": "CUST_LENGTH_FT"
  }
}
```

The `assetSpecMappings` section maps ASSET_SPEC attribute IDs to canonical fields. ASSET_SPEC stores key-value pairs of custom attributes — for a road, `CUST_LENGTH_FT` might store the road segment length.

## Setup Checklist

- [ ] Create Maximo service account with read-only security group
- [ ] Grant MAXREAD to ASSET, LOCATIONS, WORKORDER, PM, FAILURE, ASSET_SPEC, CLASSSTRUCTURE applications
- [ ] Confirm OSLC API is enabled on the Maximo server (check `mxe.oslc.enabled=1` in MAXIMO.PROPERTIES)
- [ ] Note the server time zone (check MAXVARS.VARNAME = 'SERVERTIMEZONE')
- [ ] Obtain base URL for OSLC: `https://{host}/maximo/oslc/`
- [ ] For MAS: obtain IAM API key from MAS admin
- [ ] For MAS: confirm IOT/REST API scope is granted to the API key
- [ ] Store credentials in AWS Secrets Manager
- [ ] Create IntegrationAdapterConfig record in Maintain for the tenant
- [ ] Run connectivity test (see below)
- [ ] Schedule initial load for off-hours
- [ ] Confirm delta sync running successfully in sync dashboard

## Connectivity Test Script

Run this from the integration service environment to validate credentials and OSLC connectivity before the initial load.

```bash
# Test OSLC connectivity and credentials
curl -u "serviceaccount:password" \
  -H "Accept: application/json" \
  "https://maximo.agency.gov/maximo/oslc/os/mxasset?oslc.where=SITEID=\"MAIN\"&oslc.pageSize=1" \
  | jq '.["rdfs:member"] | length'

# Expected output: 1 (or 0 if no assets at site MAIN)
# If 401: credentials wrong or account locked
# If 404: OSLC path incorrect
# If 500: Maximo server error — check Maximo SystemOut.log
```

## Common Errors and Resolutions

| Error | Root Cause | Resolution |
|---|---|---|
| `BMXAA4211E: Authentication failed` | Wrong credentials or account locked | Reset service account password in Maximo Security Groups |
| `BMXAA0023E: The OSLC API is not enabled` | OSLC disabled on server | Set `mxe.oslc.enabled=1` and restart Maximo app server |
| `oslc:Error: User not authorized` | Missing security group permissions | Add MAXREAD grant for the required object structures |
| Partial sync — missing assets | SITEID filter too narrow | Confirm all site IDs with the Maximo admin; update siteFilter config |
| Wrong install dates | Customer uses custom date field | Add `asset.installDate` override to fieldMappingOverrides config |
| CLASSSTRUCTURE returns null | Agency uses flat asset types, no hierarchy | Set `AssetClassCode` from `ASSETTYPE` directly; disable hierarchy traversal |
| Duplicate assets across sites | Same physical asset exists in multiple Maximo sites | Use composite EamNativeId (`ASSETNUM:SITEID`) to prevent false duplicates |
| Sync lag > 30 min | Large delta (many changes) exceeds 15-min window | Increase sync frequency to 5 min or enable event-driven sync (MAS) |

## Version Support Matrix

The Maximo adapter supports specific versions of Maximo and MAS. Each version has different capabilities and quirks.

| Maximo Version | Status | Auth | OSLC | GraphQL | Event Stream | Notes |
|---|---|---|---|---|---|---|
| 7.6.0.x (7.6.0.0 – 7.6.0.11) | Supported | Basic | Yes (older syntax) | No | No | Legacy; some `oslc:` prefix syntax differences. Use `oslc.select=` explicitly. |
| 7.6.1.0 – 7.6.1.2 | Supported | Basic + LDAP | Yes | No | No | Most common in US public agencies as of 2026. |
| 7.6.1.3 (latest 7.6.1) | Supported | Basic + LDAP + API Keys | Yes | No | No | Last on-premise Maximo release. End of support: TBD by IBM. |
| MAS 8.9.x | Supported | OAuth 2.0 (IAM API keys) | Yes (new endpoint pattern) | Partial | Kafka topics | Base SaaS. `/maximo/oslc/` becomes `/maximo/api/`. |
| MAS 8.10.x | Supported | OAuth 2.0 | Yes | Yes | Kafka topics | GraphQL becomes production-stable. Preferred for new deployments. |
| MAS 8.11.x | Supported | OAuth 2.0 | Yes | Yes | Kafka topics + Event Streams | Adds native change data capture. |
| Maximo < 7.6.0 | Not supported | — | — | — | — | Customer must upgrade or use manual data import. |
| MAS 9.x (when released) | Roadmap | TBD | TBD | TBD | TBD | Watch IBM release notes. |

**Adapter version compatibility**: The single `IbmMaximoAdapter` handles all supported versions. The version is detected at initialization via `/maximo/oslc/whoami` (7.6) or `/maximo/api/whoami` (MAS) and stored in the tenant's adapter configuration. Version-specific behavior is dispatched based on this detection.

## Upgrade Path: 7.6.x → MAS

A customer's upgrade from on-premise Maximo 7.6 to IBM Maximo Application Suite is a common scenario. The following is the migration path for the adapter.

### Pre-Upgrade Preparation (4 weeks before customer's upgrade)

**Step 1: Confirm target MAS configuration**
- Which MAS version (8.9, 8.10, 8.11)?
- Is IBM App Connect or IAM used for authentication?
- Are Kafka topics enabled?
- Is GraphQL enabled?
- Which MAS applications are installed (Manage is required for our integration)?

**Step 2: Review breaking changes**
- The OSLC endpoint pattern changes: `/maximo/oslc/os/mxasset` → `/maximo/api/os/mxasset`
- Authentication changes from Basic Auth to OAuth 2.0
- Some field default values may change (specifically around workflow states)
- Custom fields defined on the ASSET object need to be re-verified (customization migration is customer's responsibility)

**Step 3: Prepare the adapter configuration**
- Draft the new tenant configuration with MAS-specific fields
- Coordinate with customer IT to receive the OAuth 2.0 IAM API key
- Store the new credentials in AWS Secrets Manager as a new secret version (do not overwrite the 7.6 credentials — they may still be needed for rollback)

### Test Cutover (2 weeks before)

**Step 4: Test against customer's MAS sandbox (if available)**
- Deploy a temporary tenant configuration pointing to the customer's MAS sandbox
- Run a sample sync of 100 records
- Verify canonical mapping produces the same results as the 7.6 sync
- Report any field mapping differences to the customer

**Step 5: Adjust field mappings**
- If MAS exposes new fields we want to consume, add to the canonical mapping
- If MAS renames a field we rely on (rare), update the field mapping override
- Verify the AssetSpec ID mappings for custom fields still work

### Cutover (Customer's Upgrade Weekend)

**Step 6: The customer performs their upgrade**
- We are informed of the go/no-go decision
- Sync remains disabled during the upgrade window (typically 4–24 hours)

**Step 7: Cutover the adapter configuration**
- Update the tenant's `IntegrationAdapterConfig`:
  - `baseUrl` → new MAS URL
  - `authType` → `oauth2`
  - `credentials.secretArn` → new MAS credentials ARN
  - `apiVersion` → `mas-8.10` (or the appropriate version)
- Re-enable sync
- Manually trigger the first sync from the runbook (Vol 6, doc 18)

**Step 8: Verify**
- First sync completes successfully
- Record count matches expectations
- No unusual error patterns
- Spot-check specific records in Maintain vs MAS to confirm correct mapping

### Post-Cutover (2 weeks after)

**Step 9: Monitor closely for 2 weeks**
- Daily review of the Per-Tenant Integration Health dashboard
- Watch for any new error patterns
- Confirm delta sync continues to work as expected
- Verify event-driven sync (if enabled) is delivering events

**Step 10: Cleanup**
- After 30 days of stable operation, archive the 7.6 credentials
- Remove the 7.6 configuration options from the tenant record
- Update the customer's integration documentation to reflect MAS

### Rollback Path (If Upgrade Fails)

If the customer needs to roll back to 7.6 (rare but possible for compliance reasons):

1. Update the adapter configuration back to the 7.6 settings
2. Re-enable the 7.6 credentials in Secrets Manager
3. Manually trigger a sync to verify
4. Investigate what caused the MAS upgrade to fail, in coordination with customer IT
5. Re-plan the MAS upgrade for a later window with mitigations in place

## Adapter Test Connectivity Script (Standalone)

The following script can be run by a customer's IT team before Aurigo is granted any access. It validates the Maximo installation is compatible with Aurigo's requirements. No Aurigo credentials or code are required.

```bash
#!/usr/bin/env bash
# aurigo-maximo-connectivity-test.sh
# Run this before contacting Aurigo for integration setup.
# Requires: bash, curl, jq

set -euo pipefail

MAXIMO_URL="${1:-}"
USERNAME="${2:-}"
PASSWORD="${3:-}"

if [[ -z "$MAXIMO_URL" || -z "$USERNAME" || -z "$PASSWORD" ]]; then
    echo "Usage: $0 <maximo-base-url> <service-account-username> <password>"
    echo "Example: $0 https://maximo.agency.gov/maximo maintainsvc mypass"
    exit 1
fi

echo "=== Aurigo Maintain — Maximo Connectivity Test ==="
echo "Target: $MAXIMO_URL"
echo

# Test 1: Basic connectivity
echo "Test 1: Basic connectivity..."
if curl -k -s -o /dev/null -w "%{http_code}" "$MAXIMO_URL/oslc/whoami" -u "$USERNAME:$PASSWORD" | grep -q "200\|302"; then
    echo "  PASS: Maximo server is reachable"
else
    echo "  FAIL: Cannot reach Maximo server. Check network, firewall, and URL."
    exit 1
fi

# Test 2: OSLC enabled
echo "Test 2: OSLC API enabled..."
OSLC_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
    "$MAXIMO_URL/oslc/os/mxasset?oslc.pageSize=1" \
    -u "$USERNAME:$PASSWORD" \
    -H "Accept: application/json")
if [[ "$OSLC_STATUS" == "200" ]]; then
    echo "  PASS: OSLC API is enabled"
elif [[ "$OSLC_STATUS" == "401" ]]; then
    echo "  FAIL: Authentication failed. Check service account credentials."
    exit 1
elif [[ "$OSLC_STATUS" == "403" ]]; then
    echo "  FAIL: Authorization failed. Service account lacks OSLC read permission."
    echo "  ACTION: Grant MAXREAD security group permissions."
    exit 1
elif [[ "$OSLC_STATUS" == "404" ]]; then
    echo "  FAIL: OSLC endpoint not found. Enable OSLC in Maximo."
    echo "  ACTION: Set mxe.oslc.enabled=1 in maximo.properties and restart."
    exit 1
else
    echo "  FAIL: Unexpected status $OSLC_STATUS"
    exit 1
fi

# Test 3: Required object structures
echo "Test 3: Required object structures accessible..."
for OBJ in mxasset mxwo mxpm mxfailurelist mxassetspec mxclassstructure; do
    STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
        "$MAXIMO_URL/oslc/os/$OBJ?oslc.pageSize=1" \
        -u "$USERNAME:$PASSWORD" \
        -H "Accept: application/json")
    if [[ "$STATUS" == "200" ]]; then
        echo "  PASS: $OBJ accessible"
    else
        echo "  FAIL: $OBJ returned $STATUS"
        echo "  ACTION: Grant read access to $OBJ in Security Groups."
        exit 1
    fi
done

# Test 4: Sample data volume
echo "Test 4: Data volume check..."
ASSET_COUNT=$(curl -k -s "$MAXIMO_URL/oslc/os/mxasset?oslc.pageSize=1&oslc.select=ASSETNUM" \
    -u "$USERNAME:$PASSWORD" \
    -H "Accept: application/json" | jq -r '.["oslc:responseInfo"].totalCount // "unknown"')
echo "  INFO: Total ASSET records: $ASSET_COUNT"

# Test 5: Server time zone (for delta sync)
echo "Test 5: Server time zone check..."
echo "  ACTION REQUIRED: Confirm server time zone with your Maximo admin."
echo "  Check MAXVARS table: SELECT VARVALUE FROM MAXVARS WHERE VARNAME='SERVERTIMEZONE';"

echo
echo "=== All connectivity tests passed ==="
echo "You may now share the following with Aurigo:"
echo "  - Maximo base URL: $MAXIMO_URL"
echo "  - Service account username: $USERNAME"
echo "  - (share password via secure channel)"
echo "  - Server time zone: (fill in from Test 5)"
echo "  - Total asset count: $ASSET_COUNT"
```

The customer runs this script from a machine that has network access to Maximo. If any test fails, the failure message provides a specific action to take. This dramatically reduces the back-and-forth during integration onboarding.

## Common Maximo Customization Types

Public agency Maximo installations tend to have specific customization patterns. Knowing these accelerates integration onboarding.

### Custom Fields on ASSET

Most common: agencies add fields to track:
- State route or federal aid route number (bridges, roads)
- District or region code
- Funding source
- Federal ID (for NBI-reportable bridges)
- Load rating (for bridges)
- Pavement material specifics (PCC, AC, gravel)

Detection: query `ASSET_SPEC` for ASSETNUM to see all custom attributes. Map high-value custom fields to canonical extension fields via `assetSpecMappings`.

### Custom Workflows

Agencies often add approval workflows to work orders. This creates non-standard status values.

Detection: query `WORKORDER.STATUS` distinct values. Compare to the standard status set (WAPPR, APPR, INPRG, COMP, CLOSE, CAN). Map non-standard values to canonical status via configuration.

### Nested Location Hierarchies

Some agencies use LOCATIONS as a hierarchy (District → City → Route → Bridge). Others use LOCATIONS as a flat list.

Detection: query `LOCATIONS.PARENT` for null vs non-null distribution. If most locations have a parent, hierarchy traversal is needed. If most are null, treat as flat.

### Multi-Site Configurations

Large agencies (state DOTs) often use SITEID to segment their data by geographic district. Same asset may exist logically in multiple sites (rare but happens with jointly-managed assets).

Detection: query `SITEID` distinct values from ASSET. Coordinate with Integration Strategist for multi-site tenant configuration.

### Custom Failure Codes

Agencies build custom failure code libraries specific to their asset types.

Detection: query `FAILURELIST.FAILURECODE` distinct values. Sample the top 100 by frequency. Add to canonical failure code mapping.
