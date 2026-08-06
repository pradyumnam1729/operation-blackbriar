# EAM Integration Deployment Checklist

**Engineering Playbook · Aurigo Software Technologies**
Version 1.0 · July 2026

This is the sequential go-live checklist for onboarding a customer's Enterprise Asset Management (EAM) system into Aurigo Maintain. It must be completed in order. Each phase gate must be explicitly signed off before proceeding to the next phase.

**Customer:** _______________________________________________
**EAM System:** _______________________________________________
**EAM Version:** _______________________________________________
**Integration Mode:** Integrated / Hybrid / Native (circle one)
**Aurigo Implementation Engineer:** _______________________________________________
**Customer Technical Contact:** _______________________________________________
**Target Go-Live Date:** _______________________________________________
**Checklist Started:** _______________________________________________

---

## Phase 1 — Pre-Integration Preparation

*Complete before any data is moved or any connection is established.*

### Customer EAM System Verification

- [ ] **EAM system version confirmed and listed on the Maintain supported integrations matrix.** If the version is not on the matrix, raise a support ticket before proceeding. Confirmed version: _______________
- [ ] **Customer has confirmed that their EAM system is on a supported version and that upgrades during the integration window are frozen.** Change freeze confirmed until: _______________
- [ ] **API access method confirmed:** REST API / SOAP API / Database direct read / File export (CSV/XML) — circle one. If database direct read, proceed only after security review approval.
- [ ] **EAM API documentation version obtained and stored** in the customer's project folder. Doc version: _______________

### Service Account and Credentials

- [ ] **Service account created in the EAM system** with the minimum required permissions (read-only access to asset, work order, and condition tables/APIs). Account name: _______________
- [ ] **Permissions verified** — list of required API endpoints or DB tables accessible by the service account, confirmed by the customer's EAM administrator.
- [ ] **Credentials stored in Aurigo's secrets manager** (AWS Secrets Manager, not in code or config files). Secret ARN: _______________
- [ ] **Credential rotation schedule agreed with customer:** _______________
- [ ] **API key or OAuth client credentials obtained** (if REST API). Token expiry and refresh mechanism documented: _______________

### Network Connectivity

- [ ] **Network connectivity verified:** Aurigo's integration runner can reach the customer's EAM endpoint on the required port. Test command output attached.
- [ ] **TLS version confirmed:** EAM endpoint supports TLS 1.2 or higher. TLS version: _______________
- [ ] **Certificate validity confirmed:** EAM server certificate is valid (not self-signed unless an approved exception is on file). Certificate expiry: _______________
- [ ] **VPN or private link required?** Yes / No. If Yes, VPN configuration completed and tested: _______________
- [ ] **Firewall rules documented:** ports opened, direction (inbound/outbound), source/destination IP ranges.
- [ ] **Connectivity test from integration staging environment passes:** `curl -I https://[eam-endpoint]` returns 200 (or expected auth challenge).

### Field Mapping Configuration

- [ ] **Field mapping document completed** and stored in the customer project folder. The document maps every EAM field to the corresponding Aurigo canonical field for: Asset, Asset Class, Location, Condition Record, Work Order.
- [ ] **Mandatory Aurigo fields with no EAM equivalent identified** and a default value or derivation rule agreed for each. List: _______________
- [ ] **Custom fields identified:** any customer-specific EAM fields that need to be preserved in Aurigo's `ExtensionData` JSON column. Count: _______________
- [ ] **Asset class mapping table completed:** each EAM asset category mapped to an Aurigo `AssetClass` enum value. Unmapped categories: _______________
- [ ] **Coordinate system confirmed:** EAM geometry is in WGS84 (SRID 4326). If not, coordinate transformation is configured. EAM SRID: _______________
- [ ] **Date format and timezone confirmed.** EAM date format: _______________ EAM timezone: _______________

### Integration Mode Documentation

- [ ] **Integration mode selected** (Integrated / Hybrid / Native) and rationale documented in the customer project folder.
  - **Integrated:** Aurigo reads from and writes back to EAM. EAM is the system of record.
  - **Hybrid:** EAM assets are read into Aurigo; condition and capital needs data live in Aurigo only.
  - **Native:** Aurigo is the sole data store; no ongoing EAM sync after initial migration.
- [ ] **Conflict resolution policy selected and documented** (Last Write Wins / Aurigo Wins / EAM Wins / Human Review Queue). Policy: _______________
- [ ] **Sync direction confirmed** for each data entity:

| Entity | Direction | Notes |
|--------|-----------|-------|
| Assets (master data) | EAM to Aurigo / Bidirectional / Aurigo only | |
| Condition records | EAM to Aurigo / Bidirectional / Aurigo only | |
| Work orders | EAM to Aurigo / Bidirectional / Aurigo only | |
| Geometry / location | EAM to Aurigo / Bidirectional / Aurigo only | |

**Phase 1 Gate Sign-Off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Aurigo Implementation Engineer | | | |
| Customer Technical Contact | | | |

---

## Phase 2 — Test Environment Initial Load

*Complete before touching the production EAM system.*

### Initial Load — Test Environment

- [ ] **Integration adapter configured in Aurigo test environment** with test credentials.
- [ ] **Initial load run against the test environment** (never run the first initial load against production EAM without a test run).
- [ ] **Load completed without fatal errors.** Any non-fatal errors logged and reviewed.
- [ ] **Record count reconciliation:**
  - EAM asset count (from EAM report): _______________
  - Aurigo loaded count: _______________
  - Variance: _______________% (must be within 2% tolerance)
  - If variance > 2%: variance investigated and documented before proceeding. Root cause: _______________
- [ ] **Asset geometry spot-check:** verify that 10 randomly sampled assets have geometries that appear in the correct geographic region on the Maintain map (not in the ocean, not at 0,0 coordinates).
- [ ] **Asset class mapping verified:** at least 80% of assets have been classified to a known Aurigo `AssetClass`. Classification rate: _______________%. If < 80%: unmapped categories reviewed and mapping table updated.
- [ ] **Work order history loaded:** target is 3 years of work order history. Actual years loaded: _______________. If less than 3 years available in EAM, document the available range.
- [ ] **Condition records loaded:** most recent condition record for each asset is present in Aurigo (spot-check 20 assets).

### Customer Data Quality Review

*Document data quality findings to set customer expectations before go-live.*

| Metric | Value | Quality Rating |
|--------|-------|---------------|
| % assets with install date populated | ___% | Good (>80%) / Fair (50-80%) / Poor (<50%) |
| % assets with at least one condition record | ___% | Good (>70%) / Fair (40-70%) / Poor (<40%) |
| % assets with geometry (non-null coordinates) | ___% | Good (>90%) / Fair (70-90%) / Poor (<70%) |
| % assets with valid asset class mapping | ___% | Good (>80%) / Fair (60-80%) / Poor (<60%) |
| % work orders with a valid asset reference | ___% | Good (>95%) / Fair (80-95%) / Poor (<80%) |

- [ ] **Data quality summary shared with customer** and customer has acknowledged the quality ratings above.
- [ ] **Critical data quality issues identified and assigned** to the customer for remediation before go-live (if any). Open issues count: _______________

**Phase 2 Gate Sign-Off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Aurigo Implementation Engineer | | | |
| Customer Technical Contact | | | |

---

## Phase 3 — Delta Sync Verification

*Verify that ongoing synchronization works correctly before enabling in production.*

### Delta Sync — Test Environment

- [ ] **Delta sync interval configured** and documented. Target: <= 15 minutes. Configured interval: _______________
- [ ] **Create test:** a new asset record created in the EAM test system appears in Aurigo within the configured sync interval. Test performed at: _______________. Record appeared at: _______________.
- [ ] **Update test:** an existing asset record updated in the EAM test system (change asset name and a numeric attribute) is updated correctly in Aurigo within the configured sync interval. No old field values retained.
- [ ] **Delete test:** a record deleted in EAM test system is soft-deleted in Aurigo (`IsDeleted = true`) — not hard-deleted. Verify the record is invisible to users but still exists in the database for audit purposes.
- [ ] **Delta sync timestamp mechanism verified:** the adapter correctly tracks the last-sync watermark timestamp and only processes records modified after that timestamp. No records are missed, and no records are processed twice.
- [ ] **Large delta test:** simulate 500 records changed simultaneously in EAM; verify all 500 appear in Aurigo within 3x the configured sync interval.

### Conflict Resolution

- [ ] **Conflict resolution policy tested:** create a record in EAM, let it sync to Aurigo, modify it in both EAM and Aurigo simultaneously, confirm the conflict resolution policy is applied correctly.
- [ ] **Human review queue working** (if Human Review conflict policy is selected): conflicting records appear in the Maintain conflict queue and can be manually resolved.
- [ ] **Pre-go-live conflict queue empty:** all conflicts identified during test load have been reviewed and resolved.

**Phase 3 Gate Sign-Off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Aurigo Implementation Engineer | | | |
| Customer Technical Contact | | | |

---

## Phase 4 — Production Go-Live Preparation

### Pre-Production Checklist

- [ ] **Production EAM credentials stored in production AWS Secrets Manager.** Secret ARN: _______________
- [ ] **Production network connectivity verified** (separate from test environment — verify production firewall rules are in place).
- [ ] **Integration adapter deployed to production Aurigo environment** and configured with production credentials.
- [ ] **Maintenance window agreed with customer** for initial production load. Window: _______________
- [ ] **Customer users notified** that Maintain will be in read-only or unavailable mode during the initial load window.
- [ ] **Rollback procedure tested** in staging: disabling the integration adapter leaves Maintain fully functional with the data loaded to date. Rollback test completed by: _______________

---

## Phase 5 — Production Initial Load

### Initial Production Load

- [ ] **Initial load started** at the beginning of the maintenance window. Start time: _______________
- [ ] **Load monitoring active** during the run. No fatal errors observed.
- [ ] **Load completed.** End time: _______________. Duration: _______________.
- [ ] **Record count reconciliation (production):**
  - EAM asset count: _______________
  - Aurigo loaded count: _______________
  - Variance: _______________% (must be <= 2%)
- [ ] **Geometry spot-check (production):** 10 assets verified in correct geographic location on Maintain map.
- [ ] **Work order history verified:** sample of 5 assets checked for correct work order history.

---

## Phase 6 — Monitoring Configuration

- [ ] **Sync health dashboard configured** in the team's monitoring platform. Dashboard URL: _______________
- [ ] **Sync lag alert configured:** alert fires if sync lag exceeds 30 minutes. Alert target: _______________
- [ ] **Sync error rate alert configured:** alert fires if error rate during a sync run exceeds 5%. Alert target: _______________
- [ ] **Failed records queue alert configured:** alert fires if the failed-records queue depth exceeds 100. Alert target: _______________
- [ ] **On-call contact designated for integration failures** (customer-side and Aurigo-side). Customer contact: _______________. Aurigo contact: _______________
- [ ] **Initial sync runs monitored for the first 48 hours post-go-live.** Monitoring log attached.

---

## Phase 7 — Customer Sign-Off and Rollback Readiness

### Customer Validation

- [ ] **Customer validates asset records** by spot-checking 20 assets of their choosing. Validation completed by: _______________. Date: _______________
- [ ] **Customer validates work order history** for at least 5 assets with known work order history. Validation completed by: _______________. Date: _______________
- [ ] **Customer validates condition data** — most recent condition rating matches EAM for 10 spot-checked assets.
- [ ] **Customer has acknowledged data quality findings** from Phase 2 and accepts the data quality as sufficient for go-live.
- [ ] **Customer signs off on data quality** (formal acceptance). Signed by: _______________. Date: _______________

### Rollback Readiness

- [ ] **Rollback procedure documented** in the customer run book and confirmed with the customer.
  - Rollback trigger: [define the condition that would initiate rollback]
  - Rollback action: disable integration adapter; customer continues to use EAM directly
  - Data in Maintain after rollback: retained (read-only view of loaded data) / reset to empty (circle one)
- [ ] **Rollback tested in staging** (already completed in Phase 4; confirm staging test result is acceptable for production).
- [ ] **Customer informed of rollback procedure** and agrees that rollback within 48 hours of go-live is an acceptable contingency.

### Final Go-Live Confirmation

- [ ] **Go-live date confirmed** by both Aurigo and customer. Date: _______________
- [ ] **All items in this checklist are checked or have a documented N/A reason.**
- [ ] **No outstanding unresolved blockers.**

**Final Go-Live Sign-Off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Aurigo Implementation Engineer | | | |
| Aurigo Engineering Manager | | | |
| Customer Technical Contact | | | |
| Customer Project Manager | | | |

---

## Post-Go-Live Review (48 Hours)

*Complete 48 hours after the production initial load.*

- [ ] Sync has run at least twice since go-live without fatal errors
- [ ] No unresolved alerts fired on the sync health dashboard
- [ ] Customer has reported no missing or incorrectly mapped assets
- [ ] Failed records queue is empty or all failures are documented and have a known remediation
- [ ] Post-go-live review meeting held with customer. Date: _______________. Notes: _______________

**Post-Go-Live Sign-Off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Aurigo Implementation Engineer | | | |
| Customer Technical Contact | | | |

---

## Appendix — Supported EAM Systems and Versions

| EAM System | Supported Versions | Integration Method | Notes |
|------------|-------------------|-------------------|-------|
| IBM Maximo | 7.6.1+, 8.x | REST API (Maximo Application Framework) | OAuth 2.0 supported from 8.1 |
| SAP PM | ECC 6.0+, S/4HANA 1809+ | RFC / SOAP | Requires SAP BASIS team involvement for RFC setup |
| Infor EAM | 11.4+ | REST API | Asset class codes may need manual mapping |
| Cityworks | 15.3+ | REST API | Primarily work orders; asset master requires separate export |
| AssetWorks | Fleet Focus 2020+ | Database direct read (read-only SQL Server replica) | Requires security review approval |
| Custom EAM | Any | CSV file export (scheduled SFTP drop) | Fallback for unsupported systems; manual mapping required |

*If the customer's EAM system is not in this table, contact the Engineering Manager before starting this checklist. A new integration connector may need to be developed.*
