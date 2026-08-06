# Integration Strategist

## Mission

The Integration Strategist owns the EAM connector strategy, the canonical data model that bridges Maintain and external systems, and the reliability of every integration in production. The EAM integration is the feature that makes Maintain viable for agencies already running CMMS or EAM systems — without it, Maintain is an island. With it, Maintain becomes the intelligence layer that adds capital planning and condition management capabilities to whatever EAM platform the agency already runs.

The most technically demanding aspect of this role: every Maximo installation is different. Every SAP PM configuration is different. The Integration Strategist must design connectors that handle the 80% standard case correctly and provide clear, documented extension points for the 20% agency-specific customization that every large agency deployment will require.

---

## Responsibilities

### EAM Connector Strategy

Define the integration architecture for each supported EAM platform. Current priority targets:

**IBM Maximo**
The most common EAM in US public agencies. Maximo uses a SOAP/REST hybrid: older installations use the SOAP Integration Framework (MIF); newer installations (7.6.1+) use the REST API. Key objects to integrate: Asset (MA), Work Order (WOTRACK), Inspection (SR - Service Request), Location (LOCATION). Custom fields are common — every agency adds BPAUSERID, ASSETNUM extensions for their internal tracking.

**SAP Plant Maintenance (PM)**
Common in larger agencies and private infrastructure operators. SAP PM uses: Functional Locations (IFLOT), Equipment (EQUI), Maintenance Orders (AUFK), Notifications (VIQMEL). Integration via BAPI (synchronous) or IDocs (asynchronous). SAP's API is deeply hierarchical — understanding the object model requires specific SAP PM training.

**Cityworks**
Strong in US municipalities and counties, especially for public works departments. REST API, relatively modern and consistent. Key objects: Activity (work orders), Inspection (condition assessments), Service Request, Asset. Better documented than Maximo or SAP.

**Infor EAM**
Strong in facility management and some DOTs. REST API, good documentation. Key objects: Equipment, Work Order, Purchase Order, Part.

For each connector, the Integration Strategist defines: authentication mechanism, field mapping (Maintain canonical fields to EAM fields), sync frequency, conflict resolution policy, error handling, and the customization extension points.

### Canonical Data Model

Own the canonical data model for integration: the intermediate representation that maps between Maintain's domain model and any EAM's object model. The canonical model is EAM-agnostic — it represents infrastructure concepts (Asset, Condition, WorkOrder, MaintenanceEvent) in a normalized format that any connector can map to/from.

The canonical model is not the same as Maintain's internal domain model — it is a deliberately simplified integration contract that avoids exposing internal complexity to external systems and allows EAM connectors to be developed and maintained independently.

### Integration Reliability

Own the reliability of all active integrations. Key metrics: sync success rate, sync latency, error categorization, alert thresholds.

Integration errors fall into categories with different handling:
- **Transient errors** (network timeout, rate limit exceeded): automatic retry with exponential backoff
- **Data validation errors** (required field missing in source, invalid format): logged, queued for human review, not retried until source data is corrected
- **Mapping errors** (unknown field value, unmapped status code): logged, flagged to the Integration Strategist, requires connector update
- **Authentication errors** (expired token, credential rotation): immediate alert to tenant admin, halt sync

The Integration Strategist monitors a daily integration health dashboard: for each active tenant integration, shows last successful sync time, error count by category, and any pending resolution items.

### Customer Integration Onboarding

When a new customer deploys Maintain with EAM integration, the Integration Strategist leads the technical integration onboarding:

1. Kick-off with customer IT: identify EAM version, API accessibility, field customizations, data quality state
2. Run the Maintain EAM Compatibility Assessment (a structured questionnaire that maps EAM configuration to the connector's requirements)
3. Configure the connector: field mappings, sync schedules, conflict resolution policies
4. Execute data reconciliation: compare counts and key field values between EAM and Maintain to verify sync accuracy
5. Sign off on integration health: all critical objects syncing, error rate below threshold, customer IT satisfied with behavior

This process typically takes 2–4 weeks for a standard configuration, 6–8 weeks for a heavily customized EAM.

### AI-Assisted Integration Work

Use Claude to accelerate specific integration tasks:

- **Field mapping generation**: "Given this Maximo REST API response JSON and this Maintain canonical model definition, generate the C# mapping code." Review and test; correct EAM-specific nuances.
- **Error log analysis**: "Analyze these 200 integration error log entries from the last 24 hours. Categorize by root cause and identify the most common fixable issues." Review and act on the top issues.
- **API documentation research**: "Given this SAP BAPI documentation page, explain what the BAPI_ALM_ORDER_CREATE function parameters mean in terms of a work order creation operation and map them to our canonical WorkOrder model."
- **Connector test generation**: Generate test fixtures using real API response samples from customer environments (with PII removed).

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| Integration Sync Success Rate | > 99.5% per tenant per day | Daily |
| Sync Latency (real-time triggers) | < 5 minutes from EAM change to Maintain update | Daily |
| Sync Latency (batch) | < 2 hours for nightly batch sync | Daily |
| Transient Error Recovery Rate | > 99% of transient errors resolved without human intervention | Weekly |
| Data Validation Error Resolution Time | < 24 hours for customer-blocking validation errors | Per error |
| Integration Onboarding Time | < 4 weeks for standard configuration | Per customer |
| Connector Test Coverage | > 90% of field mappings covered by integration tests | Monthly |
| Customization Debt | < 5 undocumented customer-specific configurations in production | Monthly |

---

## Authority

The Integration Strategist has authority to:
- Define the canonical data model and require all connectors to conform to it
- Block a connector release that fails integration reliability tests
- Require a customer to fix data quality issues in their EAM before the integration is activated
- Halt a sync operation that is producing incorrect data in Maintain (better to have no data than wrong data)

The Integration Strategist does not have authority to:
- Make software architecture decisions for the core Maintain application
- Access customer EAM systems without explicit written authorization
- Commit to integration capabilities during sales without ED and PM approval

---

## Deliverables

**Daily**: Integration health dashboard review, error log triage

**Per customer onboarding**: Compatibility assessment, field mapping specification, integration test results, sign-off report

**Monthly**: Integration reliability report (by tenant, by connector), error category trends, connector update log

**Quarterly**: EAM API changelog review (did Maximo/SAP/Cityworks release an update that affects the connector?)

---

## Decision Making

When evaluating a new integration requirement:

1. **Canonical model fit**: Does the new data element fit in the existing canonical model, or does it require a model extension?
2. **Idempotency**: Is the sync operation idempotent? Can it be safely retried without creating duplicate records?
3. **Conflict resolution**: What happens when the same record is modified in both Maintain and the EAM between sync cycles?
4. **Customization impact**: How does this change affect agencies with custom Maximo fields or SAP PM configurations?
5. **Versioning**: If the connector changes, how do we manage in-flight data without breaking existing tenant configurations?

---

## Daily Workflow

**08:00–08:30** — Integration health dashboard review. For each active tenant integration: last sync time, error count, any alerts. Triage errors into categories.

**08:30–09:30** — Error resolution: work through data validation and mapping errors from the previous day. For transient errors, verify they self-resolved; for persistent errors, investigate.

**09:30–11:30** — Connector development work: new connector features, field mapping updates, customization handling.

**11:30–12:00** — Customer integration support: answer questions from customer IT teams, assist with configuration issues.

**14:00–16:00** — Deep work: connector architecture, canonical model design, integration test development.

**16:00–17:00** — Research: EAM API documentation, competitor integration approaches, standards body publications (OGC, AASHTO, ISO 55000).

---

## Collaboration

**With Backend Lead**: The connectors are backend code — they follow the same Clean Architecture patterns as the rest of the application. The Integration Strategist designs the integration logic; the Backend Lead reviews implementation quality and EF Core patterns in the sync code.

**With Lifecycle Domain Expert**: Validation that the EAM field mappings correctly represent domain concepts. "In Maximo, what does ASSETNUM represent vs. SITEID? In Maintain's domain model, which entity should ASSETNUM map to?" The domain expert validates semantic correctness; the integration strategist validates technical correctness.

**With DevOps Engineer**: Integration infrastructure: connector scheduling (cron-based vs. event-driven), queue sizing for high-volume sync events, credential management for EAM service accounts.

**With QA Lead**: Integration test strategy. Integration tests for connectors use recorded API response fixtures (captured from real EAM systems with PII removed) rather than live EAM connections. The integration strategist provides the fixtures; the QA Lead designs the test coverage.

---

## Escalation

The Integration Strategist escalates to the ED when:
- A connector defect is causing incorrect data to appear in a customer's Maintain instance
- A customer EAM upgrade breaks an existing connector with no backward compatibility path
- A new customer's EAM configuration is so customized that the standard connector cannot support it without significant custom development

---

## Continuous Improvement

Monthly: review the customization log. How many customer-specific field mappings are in production? Each one is a maintenance burden. When 3+ customers have the same custom field, that field should become a standard connector feature.

Quarterly: review EAM API changelogs. Maximo, SAP, and Cityworks all release updates; connectors must keep pace. Plan connector updates proactively, not reactively after a customer upgrade breaks their sync.

---

## Example Scenarios

### Scenario 1: Handling a Heavily Customized Maximo Installation

A large county DOT has a Maximo installation with 12 custom fields on the WORKORDER object, a custom workflow that routes work orders through 4 approval levels before they become Open, and a non-standard asset hierarchy where their bridges are nested under LOCATION records three levels deep.

The standard Maximo connector handles none of this correctly. The Integration Strategist maps the customization:

1. The 12 custom fields: 7 can be ignored (internal tracking only), 3 map to existing Maintain fields (priority, district, funding source), 2 need new Maintain fields (state route number, federal aid route indicator)
2. The custom workflow: the connector needs to set the initial work order status as "Approved in Maintain" while the EAM status is "Approval Queue" — the status mapping table needs a new entry
3. The asset hierarchy: write a custom hierarchy traversal query that walks the 3-level LOCATION tree to find the Maintain asset ID

The Integration Strategist documents all three customizations in the customer integration record, creates the field mapping configuration (no code changes required — handled in the configuration layer), and adds a note to the connector test suite: "This customer configuration validates the 3-level hierarchy traversal."

### Scenario 2: AI-Assisted Error Log Analysis

Monday morning, the integration health dashboard shows 847 errors from a Cityworks customer over the weekend. The Integration Strategist exports the error log and uses Claude to analyze it.

Claude identifies: 843 of the 847 errors have the same root cause — the Cityworks API started returning a new field "ActivityCategory" in the Work Order response that the connector's deserializer doesn't recognize and is throwing an exception on. The other 4 errors are genuine authentication timeouts.

Total analysis time: 8 minutes. The fix: add the new field to the response DTO (or use a tolerant deserializer setting). The Integration Strategist implements the fix, tests it against a recorded response with the new field, and deploys. The 843 queued records are replayed successfully.

### Scenario 3: Designing the Conflict Resolution Policy

A customer has both Maintain and Maximo configured with bidirectional work order sync. An asset manager updates a work order status to "On Hold" in Maintain at 2:00 PM. A Maximo technician updates the same work order status to "In Progress" in Maximo at 2:03 PM. The sync runs at 2:15 PM.

What should happen? This is a genuine conflict — two users updated the same field with different values.

The Integration Strategist designs the conflict resolution policy for work order status:

1. Compare timestamps: Maximo update (2:03 PM) is more recent than Maintain update (2:00 PM)
2. Apply last-write-wins: Maximo wins, work order status in Maintain becomes "In Progress"
3. Log the conflict: both versions are recorded in WorkOrderStatusHistory with a "ConflictResolved" note
4. Notify: send an in-app notification to the Maintain asset manager: "Work order status was updated in Maximo. Your On Hold status was overwritten by an In Progress status from Maximo at 2:03 PM."

The policy is documented in the ADR for the Maximo connector conflict resolution and becomes the default policy for all EAM connectors.

---

## AI Agent Pairing

The Integration Strategist pairs with an **Integration Design Agent** — a Claude Code session focused on external system analysis, connector mapping, and conflict resolution design.

**What the agent handles autonomously:**
- Reading EAM vendor API documentation and extracting field-level data models
- Drafting canonical field mappings between source system fields and the Maintain asset schema
- Generating connector stub implementations in C# (`Infrastructure/ExternalClients/`)
- Producing integration architecture diagrams and data flow documentation
- Searching vol-6 for existing connector patterns and applying them to a new EAM target
- Drafting the Gate 1 RFC for a new integration pattern

**What requires the human's judgment:**
- Deciding which system is the authoritative source of record for a given field when both systems have the field
- Approving conflict resolution policies (field-wins vs. last-write-wins vs. human review)
- Determining whether a requested integration is additive (read-only enrichment) or bidirectional sync, and the governance implications of each
- Signing off on the canonical data model fields for a new asset class

**Prompt guidance:** When briefing this agent, include: the name and version of the target EAM system, the relevant Maintain entities being synced, the sync direction (inbound/outbound/bidirectional), and a sample of the EAM's actual field schema (from Swagger, Postman, or vendor docs). See `engineering-playbook/vol-6-integration-strategy/` for connector patterns and `vol-10-claude-prompts/` for prompt templates.
