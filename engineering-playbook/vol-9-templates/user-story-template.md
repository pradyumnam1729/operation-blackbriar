# User Story Template

---

## Story Header

| Field | Value |
|-------|-------|
| **Story ID** | [PROJ-NNN] |
| **Title** | [Short, action-oriented title: verb + object] |
| **Epic** | [Epic name] |
| **Sprint** | Sprint [N] |
| **Story Points** | [1 / 2 / 3 / 5 / 8 / 13] |
| **Priority** | Must-have / Should-have / Nice-to-have |
| **Author** | [PM Name] |
| **Assigned To** | [Engineer Name] |
| **Status** | Backlog / In Grooming / Ready / In Progress / In Review / Done |

---

## Story Statement

**As a** [specific persona from vault/personas/],
**I want to** [specific capability or action],
**so that** [specific outcome or value delivered].

---

## Background

[One to three paragraphs providing the context an engineer needs to implement this correctly. Cover: what the user is doing before they encounter this feature, what they do after, and any domain knowledge required to understand the acceptance criteria. Reference relevant PRD sections, ADRs, or vault notes.]

---

## Acceptance Criteria

Each scenario follows Gherkin format. Cover at minimum: happy path, one edge case, one error state, and the authorization boundary.

### Scenario 1: Happy Path — [Short label]

```gherkin
Given [the relevant starting state of the system and user]
  And [any additional preconditions]
When [the user performs the action]
Then [the expected observable outcome]
  And [any secondary observable outcome]
```

### Scenario 2: Edge Case — [Short label]

```gherkin
Given [edge-case starting state]
When [the user performs the action]
Then [the expected behavior at the boundary]
```

### Scenario 3: Error State — [Short label]

```gherkin
Given [conditions that make success impossible]
When [the user attempts the action]
Then [the system handles failure gracefully]
  And [the error message is specific and actionable]
  And [no partial state is committed to the database]
```

### Scenario 4: Authorization — [Short label]

```gherkin
Given [a user with insufficient role or wrong tenant]
When [the user attempts the action]
Then the system returns HTTP 403 Forbidden
  And no data is exposed or modified
```

---

## Technical Notes

[Notes from the engineer or architect that constrain implementation choices. May include: which layer to put the logic in, EF Core query hints, PostGIS function to use, specific calculation engine to call, performance target for this endpoint, caching considerations. This section is written collaboratively by PM and engineer during grooming.]

- [Technical note 1]
- [Technical note 2]
- [Technical note 3]

---

## Out of Scope

The following related capabilities are explicitly not part of this story. If they arise during implementation, log them as separate stories rather than expanding scope.

- [Capability 1]
- [Capability 2]

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| [Story / ADR / PRD / external system] | Blocker / Non-blocking | Done / In Progress / Not Started |

---

## Definition of Done

- [ ] All acceptance criteria pass in the staging environment
- [ ] Unit tests written and passing (coverage >= 90% for any new `Calculations/` or `Domain/` code)
- [ ] Integration test covers happy path and authorization boundary
- [ ] No new EF Core N+1 queries introduced (verified with EF Core logging in integration tests)
- [ ] All new API endpoints documented in Swagger and match the spec in `infra/swagger/`
- [ ] FluentValidation validator written and tested for all new request DTOs
- [ ] New UI components pass accessibility check (keyboard nav, color contrast >= 4.5:1)
- [ ] PR reviewed and approved by at least one engineer who did not write the code
- [ ] Architecture Review completed if this story touches layer boundaries or multi-tenancy patterns
- [ ] Design Review completed if this story introduces a new UI surface
- [ ] CLAUDE.md / vault notes updated if this story makes a new locked-in choice

---
---

## Example Story 1: Generate TAMP Bridge Condition Summary (Masterworks)

### Story Header

| Field | Value |
|-------|-------|
| **Story ID** | MW-442 |
| **Title** | Generate TAMP bridge condition summary PDF |
| **Epic** | TAMP Compliance Reporting |
| **Sprint** | Sprint 18 |
| **Story Points** | 5 |
| **Priority** | Must-have |
| **Author** | Meera Pillai |
| **Assigned To** | Ravi Krishnaswamy |
| **Status** | Done |

### Story Statement

**As a** DOT Asset Manager (Kenji Watanabe persona),
**I want to** generate a one-page PDF bridge condition summary that conforms to the FHWA TAMP bridge element reporting format,
**so that** I can attach it to my agency's annual TAMP submission without manually reformatting data from Masterworks.

### Background

FHWA requires state DOTs to report bridge element condition ratings annually as part of the National Bridge Inspection Standards (NBIS) compliance process. The reporting format is defined in FHWA's TAMP Bridge Condition Reporting Guidance (2023). The report must include: the NBI structure number, inspection date, overall condition rating (Good / Fair / Poor / Serious / Critical), element-level detail for up to 5 primary structural elements, and the inspector's name and certification number.

The DOT Asset Manager exports this report from the Condition module, selects a reporting year, and downloads a PDF. The PDF is then attached to a DocMgmt document package for submission. This story covers only the report generation; the DocMgmt attachment workflow is a separate story (MW-445).

The bridge condition data is already stored in the `InspectionRecords` table with `AssetClass = Bridge`. The TAMP-compliant format mapping has been agreed with the MnDOT domain expert and is documented in `vault/calculations/TampBridgeMapping.md`.

### Acceptance Criteria

#### Scenario 1: Happy Path — Standard bridge with complete inspection data

```gherkin
Given a DOT Asset Manager is logged in to Masterworks
  And the tenant has at least one bridge asset with an InspectionRecord for the selected reporting year
  And the inspection record has a condition rating and at least one element record
When the user navigates to Condition > Reporting > TAMP Bridge Summary
  And selects reporting year 2025
  And clicks "Generate PDF"
Then the system generates a PDF within 10 seconds
  And the PDF contains the NBI structure number, inspection date, overall condition rating, and element detail
  And the PDF includes the inspector's name and certification number from the InspectionRecord
  And the PDF is downloaded to the browser
```

#### Scenario 2: Edge Case — Bridge with no element-level inspection data

```gherkin
Given a bridge asset has an overall condition rating but no element records in the selected year
When the user generates the TAMP bridge summary PDF
Then the PDF is generated successfully
  And the element detail section displays "No element-level data recorded for this inspection period"
  And no error is shown
```

#### Scenario 3: Error State — No bridges with inspections in the selected year

```gherkin
Given the tenant has bridge assets but none have InspectionRecords for the selected reporting year
When the user selects that reporting year and clicks "Generate PDF"
Then the system displays the message: "No bridge inspections found for 2025. Select a different year or record inspection data first."
  And no PDF is generated
  And no network error is thrown
```

#### Scenario 4: Authorization — Non-authorized role attempts download

```gherkin
Given a user with the role FieldInspector (not AssetManager or higher)
When the user navigates to Condition > Reporting > TAMP Bridge Summary
Then the navigation item is not visible in the sidebar
  And a direct GET request to /api/v1/reports/tamp-bridge returns HTTP 403 Forbidden
  And no PDF data is returned
```

### Technical Notes

- PDF generation: use `QuestPDF` (already in the solution). Template lives in `Application/Reports/TampBridgePdfTemplate.cs`.
- The `InspectionRecord` to TAMP field mapping is in `vault/calculations/TampBridgeMapping.md`. Do not invent mappings; use this document.
- The endpoint is `GET /api/v1/reports/tamp-bridge?year={year}` and returns `Content-Type: application/pdf`.
- Performance target: PDF for up to 500 bridges must generate in < 10 seconds. Benchmark with QuestPDF before submitting PR.
- Authorization: require the `AssetManager` role claim. FieldInspector cannot access reporting endpoints.

### Out of Scope

- Pavement condition TAMP export (covered by MW-438).
- Automated upload to FHWA portal (requires separate FHWA API agreement; planned for Phase 6).
- Historical PDF storage (the PDF is generated on demand; not persisted to DocMgmt in this story).

### Definition of Done

- [x] All 4 acceptance criteria pass in staging
- [x] Unit tests for `TampBridgePdfTemplate` cover field mapping for all 11 TAMP-required fields
- [x] Integration test: `TampBridgeReportControllerTests` covers happy path, no-data state, and 403
- [x] PDF output manually validated against FHWA sample document by Meera Pillai
- [x] PR reviewed by Priya Nambiar
- [x] Swagger updated with new `/api/v1/reports/tamp-bridge` endpoint

---

## Example Story 2: Record Data Center Generator Inspection (Primus)

### Story Header

| Field | Value |
|-------|-------|
| **Story ID** | PR-117 |
| **Title** | Record diesel generator inspection with fuel sample result |
| **Assigned To** | Ananya Krishnan |
| **Epic** | Mechanical Asset Condition — Primus Data Center Vertical |
| **Sprint** | Sprint 21 |
| **Story Points** | 3 |
| **Priority** | Must-have |
| **Author** | Vikram Acharya (PM, Primus) |
| **Status** | In Review |

### Story Statement

**As a** Facilities Engineer at a data center operator (Primus — Marcus Chen persona),
**I want to** record a diesel generator inspection including a DEF/fuel sample result and load bank test outcome,
**so that** the inspection is stored in Maintain and automatically triggers a RUL recalculation for the generator asset.

### Background

Data center operators run backup generators on a monthly load bank test schedule and annually collect fuel samples to detect microbial contamination and water content. These results feed into the Weibull-based RUL model (see ADR-009) via the `InspectionRecord.ConditionScore` field. The condition score for generators is computed from the load bank test outcome and the fuel sample contamination index using the formula in `vault/calculations/GeneratorConditionFormula.md`.

This story delivers the inspection recording form for the Generator asset class in Primus. The form is accessed from the asset detail page, similar to the existing inspection form for HVAC units (PR-101, shipped in Sprint 19). Reuse the `InspectionRecordForm` component; add a Generator-specific field extension for the fuel sample fields.

### Acceptance Criteria

#### Scenario 1: Happy Path — Complete generator inspection with passing tests

```gherkin
Given a Facilities Engineer is viewing a Generator asset detail page in Primus
  And the generator has no pending inspection for the current month
When the user clicks "Record Inspection"
  And enters: inspection date, inspector name, load bank test result (Pass / Fail), fuel sample DEF % (0.0-100.0), fuel sample contamination index (0-10)
  And clicks "Save Inspection"
Then the InspectionRecord is persisted with all entered values
  And a ConditionScore is computed automatically from the GeneratorConditionFormula
  And the asset's RUL is recalculated asynchronously (within 30 seconds)
  And the asset detail page displays the new condition score and updated RUL
  And a success notification is displayed: "Inspection recorded successfully"
```

#### Scenario 2: Edge Case — Load bank test failure with borderline fuel sample

```gherkin
Given a generator with a fuel sample contamination index of exactly 5 (the alert threshold)
  And a load bank test result of Fail
When the user saves the inspection
Then the ConditionScore is computed as "Poor" per GeneratorConditionFormula section 3.2
  And a warning banner is displayed: "Condition score is Poor. This asset may require priority capital action."
  And the inspection is saved normally
```

#### Scenario 3: Error State — Invalid fuel sample DEF percentage

```gherkin
Given a Facilities Engineer is completing the inspection form
When the user enters a DEF percentage of 105.5 (outside 0-100 range)
  And clicks "Save Inspection"
Then the form displays a field-level validation error: "DEF % must be between 0 and 100"
  And the form does not submit
  And no InspectionRecord is created
```

#### Scenario 4: Authorization — Viewer role cannot record inspections

```gherkin
Given a user with the ReadOnly role is viewing the generator asset detail page
When the user accesses the page
Then the "Record Inspection" button is not rendered
  And a direct POST request to /api/v1/inspection-records returns HTTP 403 Forbidden
```

### Technical Notes

- Extend `InspectionRecordForm.tsx` with a `GeneratorFields` sub-component gated on `assetClass === 'Generator'`.
- Backend: add `FuelSampleDefPercent` (decimal, nullable) and `FuelSampleContaminationIndex` (int, nullable) to `CreateInspectionRecordRequest`. Add FluentValidation rules: DEF % must be 0-100 if provided, contamination index 0-10 if provided.
- ConditionScore computation: call `GeneratorConditionCalculator.Compute(loadTestResult, defPercent, contaminationIndex)` in the handler, store result in `InspectionRecord.ConditionScore`.
- RUL recalculation: publish `InspectionRecordCreatedEvent` after save; existing handler triggers recalc. Do not call RUL calculator synchronously in this handler.
- No new DB migration needed — the new fields use the existing `ExtensionData` JSON column on `InspectionRecord`.

### Out of Scope

- Automatic work order creation on "Poor" condition (logged as PR-128).
- Photo attachment to inspection record (PR-119, separate story).
