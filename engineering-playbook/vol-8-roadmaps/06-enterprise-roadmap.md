# Enterprise Readiness Roadmap — Aurigo Maintain

## What Enterprise Means

Enterprise readiness is distinct from feature richness. A product with 200 features that cannot answer "where does our data live?" or "who had access to our records on March 15?" will not pass enterprise procurement. Enterprise means: contractual certainty, technical controls that satisfy InfoSec requirements, operational predictability, and a commercial relationship structure that matches how large organizations procure and operate software.

For Maintain, the enterprise buyer is the CIO or IT Director of a State DOT, a large county government, or a large private facility operator. They sign contracts after procurement processes that include security questionnaires, legal review, pilot programs, and executive approval. They need:

1. **Security controls** that satisfy their own InfoSec and legal teams
2. **Identity integration** that works with their existing directory
3. **Infrastructure isolation** or proof that isolation is contractually guaranteed
4. **Data residency** documentation they can show their legal counsel
5. **SLA guarantees** backed by penalties, not just best-effort commitments
6. **Support structures** — not just documentation, but named people
7. **Organizational fit** — the product must map to how their agency is structured

This roadmap addresses each requirement systematically.

---

## Identity and Access Management

### SSO Federation

Enterprise customers do not want to manage a second identity store. Their staff is provisioned in Microsoft Entra ID (formerly Azure AD), Okta, Ping Identity, or a state-level Shibboleth IdP. SSO integration means: the user logs into Maintain with their existing agency credentials, no separate Maintain password is created, and when the user is offboarded from the agency's IdP their Maintain access terminates automatically.

**Entra ID (Azure AD):** The most common IdP in US state and local government. Supported via SAML 2.0 or OIDC (Entra supports both). Integration tested against Entra ID P1 and P2 tenants. Conditional Access Policies (MFA requirements) are honored because the IdP enforces them before issuing the assertion.

**Okta:** Widely used in larger municipal governments and universities. Supported via SAML 2.0 and OIDC. Okta Workflows integration for automated role assignment based on Okta group membership.

**Ping Identity:** Common in larger state agencies and federal-adjacent organizations. PingFederate SAML 2.0 integration. PingOne OIDC integration. Both tested.

**Shibboleth:** Used by some state DOTs that federate with InCommon. Supported via SAML 2.0 with InCommon entity categories.

**Active Directory Federation Services (ADFS):** On-premise Microsoft IdP still common in agencies that haven't migrated to Entra ID. SAML 2.0 support with ADFS 3.0+.

Each SSO integration is configured in the Agency Admin UI: the admin enters the IdP metadata URL (or uploads the metadata XML), configures attribute mappings (which claim maps to user email, display name, and Aurigo role), and activates SSO. A test assertion flow is available before activation.

### SCIM 2.0 Automated Provisioning

SCIM (System for Cross-domain Identity Management) is the protocol that allows the customer's IdP to push user lifecycle events (create, update, deactivate) to Maintain automatically. Without SCIM, offboarding a departed employee from Maintain requires an Agency Admin to manually deactivate the account — a compliance risk.

Maintain's SCIM 2.0 server endpoint implements:
- `GET /Users` — list all provisioned users (for IdP reconciliation)
- `POST /Users` — provision a new user (creates Maintain user account with role assigned from SCIM Group membership)
- `GET /Users/{id}` — retrieve user
- `PUT /Users/{id}` — full update
- `PATCH /Users/{id}` — partial update (the standard for attribute changes and deactivation)
- `DELETE /Users/{id}` — deprovision (deactivates account, retains data with audit log)
- `GET /Groups` — list groups (mapped to Aurigo roles)
- `POST /Groups` — create group → role mapping
- `PATCH /Groups/{id}` — update group membership → triggers user role update in Maintain
- `GET /ServiceProviderConfig` — SCIM capabilities discovery
- `GET /Schemas` — schema discovery for IdP configuration

SCIM authentication uses a long-lived API token issued by the Agency Admin during SCIM setup. The token is scoped to SCIM operations only.

### Multi-Factor Authentication Enforcement

For enterprise customers without SSO (or as a supplementary control), Maintain supports TOTP-based MFA (RFC 6238, compatible with Google Authenticator, Authy, Microsoft Authenticator). MFA can be required for all users, required for admin roles only, or optional. Agency Admins can generate MFA recovery codes for users who lose their authenticator device.

---

## Dedicated Infrastructure

### Silo Model

Tier 1 enterprise customers receive dedicated infrastructure: their own RDS instance (no sharing with other tenants at the database level), their own ECS task group, and their own S3 bucket. The silo model eliminates the theoretical possibility of data leakage through application bugs that affect multi-tenant isolation (though such bugs are also prevented by the pool model's EF query filters). More practically, it enables:

- Per-customer backup and restore (restore this customer's database from last night's backup without affecting other tenants)
- Per-customer maintenance windows (maintenance on Tenant A's infrastructure does not affect Tenant B)
- Per-customer performance SLAs (a spike in one tenant's workload does not degrade another tenant's performance)

The silo model is provisioned via Terraform. Each silo deployment takes approximately 20 minutes via the provisioning pipeline. Agency Admin receives a notification when their silo is ready.

### Dedicated Compute

Tier 1 enterprise customers also receive dedicated ECS compute: a dedicated Fargate cluster with reserved capacity (not spot or shared capacity). This prevents compute contention. The dedicated cluster is sized to the tenant's workload with a minimum of 2 tasks and auto-scaling headroom of 4× the current load.

---

## Data Residency and Compliance

### US Data Residency

All Maintain services are deployed in AWS US regions: us-east-1 (primary) and us-west-2 (secondary for DR). No customer data transits AWS regions outside the continental US. The Customer Data Processing Addendum (DPA) specifies:
- All data stored in AWS us-east-1 or us-west-2
- No sub-processors that operate outside the US without explicit written consent
- AWS certifications applicable to the deployment (SOC 1/2/3, FedRAMP Authorized services used throughout)

State-specific requirements: California (CCPA compliance for any California agency customer), Texas (Texas Privacy Protection Act), Virginia (CDPA). Each state DPA addendum is available pre-drafted.

### FedRAMP Pathway

State DOTs that receive federal highway funding operate under federal data security requirements. FedRAMP Authorization (Moderate impact level, for systems processing CUI) is a long-term goal not on the current roadmap but factored into architecture decisions. Key FedRAMP controls implemented now (as they align with SOC 2):
- FIPS 140-2 validated cryptographic modules (AWS services in GovCloud use FIPS endpoints)
- Continuous monitoring
- Incident response
- Configuration management (Infrastructure as Code + change management gates)

The architecture avoids patterns that would make FedRAMP authorization prohibitively expensive (e.g., using non-FedRAMP-authorized third-party services as data processors).

### Audit Log

Every data mutation in Maintain is captured in an immutable audit log (via the EF `SaveChangesInterceptor`). The audit log records: entity type, entity ID, field changed, old value, new value, user ID, user email, timestamp, request IP address, and request ID (for correlation with access logs).

The audit log UI (available in GA, Tier 1 only during Beta) allows Agency Admins to:
- Search by user, entity type, date range, IP address
- Export audit log entries to CSV
- View the complete change history of any asset or inspection record

Audit logs are retained for 7 years (configurable to longer for customers with specific regulatory retention requirements). Logs older than the online retention window are archived to S3 Glacier.

---

## Custom SLAs

### Tier Definitions

| Tier | Target SLA | Support Response | Infrastructure |
|---|---|---|---|
| Standard | 99.5% monthly | Next business day | Pool model |
| Professional | 99.9% monthly | 4-hour business hours | Pool model |
| Enterprise | 99.9% monthly | 1-hour 24x7 | Pool or Silo |
| Tier 1 Enterprise | 99.99% annual | 15-minute 24x7 | Silo only |

99.99% annual SLA means less than 52 minutes of downtime per year. Achieving this requires: multi-AZ active-active deployment (no single point of failure), zero-downtime deployments (blue-green or rolling with traffic shifting), pre-tested failover (monthly DR test), and dedicated on-call engineering support for the Tier 1 tenant.

### SLA Credits

SLA credits are applied automatically when Maintain falls below the contracted SLA in any calendar month:
- 99.5% tier: 10% monthly credit for each 0.5% below SLA (max 30%)
- 99.9% tier: 25% monthly credit for any month below 99.9% (max 50%)
- 99.99% tier: 50% monthly credit, 100% for two consecutive months below SLA

Credit calculation is based on external synthetic monitoring (Datadog or Pingdom), not internal metrics, to avoid disputes about measurement methodology.

---

## Professional Services and Customer Success

### Dedicated Customer Success Manager

Enterprise tier customers (annual contract above $50K) receive a named Customer Success Manager (CSM). The CSM's responsibilities:
- Quarterly Executive Business Reviews (EBR) — value delivered, roadmap preview, renewal planning
- 30/60/90 day onboarding plan execution
- Feature adoption tracking and intervention when usage metrics indicate friction
- Escalation path for support issues that require engineering involvement
- Voice of the Customer input to the product roadmap

### Implementation Professional Services

Larger deployments require configuration work that exceeds what Agency Admins can self-serve: GIS data migration from legacy systems, custom field mapping, multi-jurisdiction hierarchy setup, EAM integration configuration, custom deterioration model calibration, and training delivery. Aurigo Professional Services delivers these engagements at a day-rate.

The Professional Services catalog includes standard SOW templates for: Basic Onboarding (5 days: GIS import, user setup, initial configuration), Standard Deployment (15 days: all of Basic plus EAM integration and custom model calibration), and Enterprise Deployment (30 days: multi-jurisdiction, custom reporting, training for multiple departments).

### Sandbox Environment

Enterprise tier customers receive a dedicated sandbox environment: a separate Maintain tenant pre-populated with synthetic data (not their production data) where they can: test integrations before deploying to production, train new users without risk to production data, validate new feature configurations (e.g., new deterioration model parameters), and test TAMP generation with modified assumptions.

The sandbox environment is refreshed monthly with a clean synthetic dataset. Customers can also manually refresh the sandbox from a redacted, anonymized snapshot of their production data (personally identifiable information removed).

---

## Organizational Hierarchy

### State → District → County → Department

State agencies operate with complex organizational hierarchies. A State DOT has a headquarters plus 8–12 district offices, each managing separate geographic portfolios. Some districts sub-delegate to county transportation departments. The organizational hierarchy in Maintain maps to:

**State Level:** The root tenant. State-level admins see aggregated condition and capital needs data across all districts. State-level TAMP pulls from all district data. State-level users cannot see asset-level detail in districts unless granted cross-jurisdiction access.

**District Level:** Each district is a sub-tenant under the state. District admins manage users and assets within their district. District capital plans roll up to the state-level view. Districts are isolated from each other at the user level — a District 4 inspector cannot view or edit District 7 inspections.

**County Level:** Some states delegate asset ownership to county governments. County sub-tenants sit below their parent district in the hierarchy. County data rolls up through district to state.

**Department Level:** Within a jurisdiction, departments (roads, bridges, drainage, signage) can be separate organizational units with separate user groups and, optionally, separate dashboards and reports.

Role inheritance flows downward: a state-level Read-Only Viewer can see all districts. A district-level Asset Manager can only edit within their district. A state-level Admin can create district-level Admins but cannot perform operations as that district admin.

---

## Custom Configuration

### Custom Condition Rating Scale Mapping

Different agencies use different condition rating scales. PASER uses 1–10. NBI uses 0–9. Some agencies use A–F letter grades. Some use custom scales adopted by local ordinance. Maintain's native scale is 0.0–5.0 (supports both whole numbers and decimals).

Enterprise customers can configure a custom condition rating scale with a mapping function to the 0–5 internal scale. The mapping is displayed in the UI: when an inspector enters "7 (PASER)" the system converts internally to 3.5 on the 0–5 scale for calculations while displaying "7 (PASER)" to the user throughout the interface.

### Custom Deterioration Model Calibration

Enterprise customers can calibrate their deterioration model parameters from their own historical inspection data rather than using literature defaults. The calibration workflow:
1. Agency exports historical inspection records (minimum: 500 inspections across 3+ inspection cycles per asset class)
2. Aurigo's calibration service fits Weibull parameters (shape k, scale λ) and linear deterioration rates to the observed data using maximum likelihood estimation
3. Calibration results are presented with confidence intervals and goodness-of-fit metrics (AIC/BIC comparison vs default parameters)
4. Agency Admin approves the calibrated parameters; they are stored per tenant and used for all future calculations

Calibrated parameters are versioned so that the parameters active at the time of any historical TAMP report can be retrieved for audit purposes.

### Custom Capital Planning Rules

Enterprise customers can configure business rules that constrain the capital plan:
- **Funding source constraints:** Federal funds restricted to NHS routes. State bridge funds restricted to bridges above threshold ADT. Local funds unrestricted.
- **Policy-based prioritization:** All assets on school bus routes prioritized above other assets of equivalent condition. All assets on emergency response routes treated as highest consequence in the risk matrix.
- **Minimum budget allocations:** At least 30% of annual capital budget allocated to bridges (agency policy). No more than 50% in any single district.
- **Intervention cost overrides:** Unit cost assumptions can be overridden per asset type to reflect local labor and material costs.

Rules are configured in a rule editor (structured form, not code) by Agency Admins with Capital Planning Manager role.

---

## Enterprise Sales Motion Considerations

### Procurement Cycles

State and county government procurement cycles are 6–18 months. The procurement motion for a new SaaS contract typically includes: needs assessment (RFI), competitive procurement (RFP), technical evaluation (demo, pilot), security review, legal review, budget approval, and contract execution.

Maintain must be prepared for the full procurement motion:
- **RFI response templates** maintained in the CS knowledge base
- **RFP response repository** with pre-approved language for standard questions (security, data handling, SLA, integration, support)
- **Security questionnaire** (SIG Lite, CAIQ, customer-specific) responses pre-drafted and reviewed quarterly
- **Pilot program structure** — a 90-day paid pilot at reduced cost, with success criteria jointly defined at the start

### Technical Pilot Program

The standard enterprise pilot is 90 days. Structure:
- Days 1–10: Environment provisioning, data import, user setup
- Days 11–30: Field inspector training, first inspection cycle
- Days 31–60: First capital needs schedule generation, comparison with agency's existing estimate
- Days 61–75: TAMP draft generation, review with agency's TAMP coordinator
- Days 76–90: EAM integration go-live (if applicable), pilot wrap-up meeting

Success criteria are defined in the pilot SOW. If success criteria are met, the pilot auto-converts to a production contract at the agreed terms. If not met, either party can terminate with 14 days notice.

### Legal Review

Enterprise contracts require legal review on both sides. Standard contract terms are pre-negotiated with Aurigo Legal for standard elements (liability caps, indemnification, data processing). Non-standard requests (custom data processing terms, insurance requirements, jurisdiction-specific legal requirements) require Legal involvement and add 30–60 days to the procurement cycle. Maintain's legal templates cover: Master SaaS Agreement (MSA), Order Form, DPA, Business Associate Agreement (BAA if customer data includes health-relevant infrastructure near medical facilities), and state-specific data privacy addenda.
