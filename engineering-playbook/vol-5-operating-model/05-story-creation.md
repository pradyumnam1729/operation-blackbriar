# 05 — Story Creation

A well-written user story is a gift to the engineer who implements it. It eliminates ambiguity, defines the scope boundary, and specifies exactly what "done" means. A poorly written story is a tax — it generates clarification conversations, rework, and scope disputes that consume far more time than the extra hour it takes to write the story well.

This document defines the complete anatomy of an Aurigo user story, provides a quality checklist, identifies anti-patterns, and includes two fully worked examples.

---

## Full Story Anatomy Template

Every story that enters a sprint must contain all sections below. Sections may not be left blank. If a section is not applicable, write "N/A — [reason]".

---

### Story Title
`[Module] [Verb] [Object] — [Persona] perspective`

Example: `Maintain — Record Pavement Condition — Field Inspector`

---

### Story Statement
```
As a [persona],
I want to [action],
So that [business value].
```

The "so that" clause is mandatory. It explains why this matters. If you cannot articulate why, the story should not exist.

---

### Background
2–4 sentences of context. Why does this story exist at this point in the product? What came before it? What does it enable downstream? Reference the Epic it belongs to.

Example: "Field inspectors currently record pavement condition observations on paper forms, which are then manually entered into the agency's GIS system. This story implements the digital condition recording workflow, replacing paper and enabling automated RUL calculations downstream."

---

### Acceptance Criteria

Written in Gherkin format. Each criterion is independently testable. Aim for 4–8 criteria per story — fewer means the story is underspecified, more means the story is too large.

Format:
```gherkin
Given [initial system state]
When [action taken by user or system]
Then [observable outcome]
And [additional observable outcome if needed]
```

Every criterion must name a specific, observable behavior. No vague language: "the system should handle errors" is not a criterion. "The system returns HTTP 422 with error message 'Condition rating must be between 1 and 10'" is a criterion.

**Multi-scenario criteria format:**
```gherkin
Scenario: [Name of scenario]
  Given ...
  When ...
  Then ...

Scenario: [Name of alternate scenario]
  Given ...
  When ...
  Then ...
```

---

### Out of Scope

Explicitly list what this story does NOT include. This prevents scope creep and clarifies the split between related stories.

Example:
- Creating or editing the asset record (covered by story AM-45)
- Triggering the RUL recalculation after submission (covered by story AM-52)
- Offline recording with sync-on-reconnect (deferred to Phase 3)

---

### Dependencies

List all other stories, tasks, or external items that must be completed before this story can be started or tested.

- **Blocking**: items that must be done before this story starts
- **Soft dependency**: items that should ideally be done first but can proceed in parallel with coordination

---

### Technical Notes

Engineering context that the PM would not know but the implementing engineer needs. Examples:
- Which entity/table this writes to
- Known edge cases in the data model
- Performance considerations
- Migration required: yes/no
- API change: breaking/non-breaking

---

### Definition of Done

Beyond the AC: what else must be true for this story to be closed? Standard Aurigo DoD is listed in the PR checklist (document 09), but story-specific additions go here.

Example: "In addition to standard DoD: a field tester from the QA team must verify the mobile rendering on an iOS device before closing."

---

## Story Quality Checklist

Before a story is approved for sprint entry, it must pass all 10 checks:

1. **Persona is defined**: the "As a" clause names a persona from the Aurigo persona catalog (document 03), not a generic "user."
2. **Value is stated**: the "So that" clause explains business value, not technical implementation.
3. **All AC are in Gherkin format**: Given/When/Then with no vague language.
4. **Each AC is independently testable**: a QA engineer can write an automated test for each one without additional specification.
5. **Out of Scope is written**: at least one item is explicitly excluded, or "N/A" with explanation.
6. **Blocking dependencies are resolved**: all blocking dependencies are done or have a confirmed completion date before the sprint starts.
7. **Story is ≤ 8 points**: larger stories must be split before sprint entry.
8. **No formula is referenced without a source**: if an AC mentions a calculation, the formula is cited (vault/calculations/ file, or formula inline).
9. **Edge cases are addressed in AC or Out of Scope**: empty state, no-data scenario, offline behavior, error states.
10. **Technical notes confirm migration/API change impact**: the implementing engineer knows before starting whether a migration is needed.

---

## Anti-Patterns

### Anti-Pattern 1: The Solution Story

**Bad**: "As a user, I want the system to use a Redis cache for inspection queries so that responses are fast."

**Good**: "As a Capital Planner, I want the inspection history for a large asset portfolio to load within 2 seconds, so that I can review condition trends without interruption."

The bad version tells the engineer what technology to use. The good version states the observable outcome and leaves the implementation decision to the engineer. Redis may or may not be the right solution — that is an engineering decision, not a product requirement.

---

### Anti-Pattern 2: The Compound Story

**Bad**: "As a Field Inspector, I want to record condition observations, attach photos, and sync to the server when connectivity is restored, so that the data is captured in the field."

This is three stories: (1) record condition, (2) attach photos, (3) offline sync. Bundled together they create a 13+ point story that spans multiple sprint cycles and creates unclear intermediate states.

**Good**: Split into three separate stories with clear dependency ordering.

---

### Anti-Pattern 3: Unmeasurable Acceptance Criteria

**Bad**: 
```
Given a user submits an inspection
When the data is saved
Then the user should see a success message
```

"A success message" is not specific. What does it say? Where does it appear? How long does it persist?

**Good**:
```
Given a user submits a valid inspection form
When the form submission succeeds
Then a toast notification appears with the text "Inspection saved successfully" and dismisses after 4 seconds
And the form is reset to its initial empty state
And the new inspection appears at the top of the inspection history list for that asset
```

---

### Anti-Pattern 4: The Missing Negative Case

Stories often specify only the happy path. Production failures almost always occur in the unhappy path.

**Bad**: Only specifying what happens when the form is valid.

**Good**: Include explicit AC for: form validation errors (which fields, what messages), server errors (500 — what does the user see?), and edge case inputs (empty form, maximum length exceeded, invalid date).

---

### Anti-Pattern 5: The Eternal Background Story

**Bad**: Background section is 3 paragraphs of product history, regulatory context, and technical background. The engineer spends 30 minutes reading background before getting to the AC.

**Good**: Background is 2–4 sentences. Deep context belongs in vault/ documentation or the PRD, which is linked. The story is the implementation contract, not the encyclopedia entry.

---

## Example Story 1: Masterworks Maintain — TAMP Pavement Condition Report

**Title**: Maintain — Export TAMP Pavement Condition Report — Capital Planner

**Story Statement**:
```
As a Capital Planner at a public agency,
I want to generate and export a TAMP-compliant pavement condition report for a specified fiscal year,
So that I can submit the required condition data to the federal reporting portal without manual compilation.
```

**Background**: The Federal Highway Administration requires state and local agencies receiving federal funding to submit annual TAMP condition reports. Currently, capital planners export raw inspection data from the system and manually format it in Excel. This story automates the TAMP report generation, reducing preparation time from approximately 4 hours to under 5 minutes.

**Acceptance Criteria**:
```gherkin
Scenario: Successful report generation
  Given I am logged in as a Capital Planner
  And there are at least 10 pavement assets with inspection records in the selected fiscal year
  When I navigate to Reports > TAMP Condition Report
  And I select fiscal year 2025 and click "Generate Report"
  Then the system generates a PDF report within 10 seconds
  And the report includes: agency name, fiscal year, total lane-miles assessed, percentage in Good/Fair/Poor condition, average PCI by network
  And the report header matches the FHWA TAMP template specification (vault/specs/tamp-report-template.md)

Scenario: Download report file
  Given a report has been generated for fiscal year 2025
  When I click "Download PDF"
  Then a file named "TAMP-Condition-Report-2025-[AgencyName].pdf" is downloaded to my browser
  And the file size is greater than 10KB (non-empty)

Scenario: No inspection data for selected year
  Given there are no inspection records for fiscal year 2024
  When I select fiscal year 2024 and click "Generate Report"
  Then the system displays: "No inspection data found for fiscal year 2024. At least one inspection must be recorded before a report can be generated."
  And no file is generated or downloaded

Scenario: Partial data warning
  Given 60% of pavement assets have inspection records in the selected fiscal year
  And 40% have no inspection records this year (using most recent available)
  When I generate the report
  Then the report is generated successfully
  And the report contains a warning section: "40% of assets (N assets) use prior-year inspection data. Condition assessment may be incomplete."
  And the warning lists the specific assets by name and last inspection date
```

**Out of Scope**:
- Submitting the report directly to the FHWA portal (requires external API integration, deferred)
- Reports for non-pavement asset types (bridges, signs — separate stories per asset class)
- Scheduling automatic report generation (deferred to notification module integration)

**Dependencies**:
- AM-44: Pavement inspection recording (blocking)
- AM-51: PCI calculation engine (blocking)
- AM-55: Report permissions for Capital Planner role (blocking)

**Technical Notes**:
- Report generation uses server-side PDF rendering (QuestPDF or equivalent)
- PCI calculation formula: see `vault/calculations/PavementConditionIndex.md`
- Multi-tenancy: report is scoped to current tenant's assets only
- Migration: no new migration required, reads from existing Inspections and Assets tables
- Performance: generating a report for 10,000+ assets must complete in under 10 seconds — requires an efficient aggregation query, not N+1

**Definition of Done**:
Standard DoD plus: verify with sample data matching FHWA specifications that the output report would pass manual format review.

---

## Example Story 2: Primus Maintain — Data Center Generator Condition Recording

**Title**: Maintain — Record Generator Condition Observation — Maintenance Technician

**Story Statement**:
```
As a Maintenance Technician at a data center,
I want to record a condition observation for a standby generator including runtime hours and last test date,
So that the Reliability Engineer can assess RUL and schedule the next maintenance interval.
```

**Background**: Data center operators run monthly load tests on standby generators and record observations. Currently these are logged in a spreadsheet shared via email. This story digitizes the observation recording into Aurigo Maintain, enabling automated RUL calculations and predictive maintenance scheduling.

**Acceptance Criteria**:
```gherkin
Scenario: Successful observation submission
  Given I am logged in as a Maintenance Technician
  And I have navigated to the asset detail page for Generator "GEN-UPS-01"
  When I click "Add Condition Observation"
  And I complete the form with: observation date (today), runtime hours (450), last load test date (today), condition rating (7 out of 10), notes (optional text)
  And I click "Submit"
  Then the observation is saved and appears in the Observation History panel with the date and rating I entered
  And a success toast notification appears: "Observation recorded successfully"
  And the asset's "Last Inspected" field on the asset card updates to today's date

Scenario: Condition rating boundary validation
  Given I am on the Add Condition Observation form
  When I enter a condition rating of 11 (above maximum)
  Then the field shows inline validation error: "Rating must be between 1 and 10"
  And the Submit button remains disabled

Scenario: Runtime hours validation
  Given I am on the Add Condition Observation form
  When I enter runtime hours of -5
  Then the field shows inline validation error: "Runtime hours must be 0 or greater"

Scenario: Future observation date rejected
  Given I am on the Add Condition Observation form
  When I enter an observation date 3 days in the future
  Then the field shows inline validation error: "Observation date cannot be in the future"

Scenario: Required fields enforcement
  Given I am on the Add Condition Observation form
  When I click Submit without entering a condition rating
  Then the form does not submit
  And the condition rating field shows: "Condition rating is required"

Scenario: API error handling
  Given I am on the Add Condition Observation form
  When I submit a valid form but the server returns a 500 error
  Then the form remains in its submitted state (data not lost)
  And an error message appears: "Failed to save observation. Please try again or contact support if the problem persists."
```

**Out of Scope**:
- Triggering an automated RUL recalculation (handled by AM-78, fires asynchronously after save)
- Photo attachments for the observation (Phase 2 — offline-capable photo upload)
- Bulk import of historical observations from spreadsheet (separate migration story)

**Dependencies**:
- AM-60: Generator asset type configuration with condition rating scale (blocking)
- AM-61: Asset detail page scaffold with observation history panel (blocking)

**Technical Notes**:
- Writes to `Inspections` table (reuses existing entity structure) with `AssetTypeCategory = Generator`
- New fields needed: `RuntimeHours` (decimal, nullable), `LastLoadTestDate` (date, nullable)
- Migration: yes — adds `runtime_hours` and `last_load_test_date` columns to the `inspections` table
- Validation: FluentValidation in `RecordObservationCommandValidator`
- API endpoint: POST /api/v1/inspections (existing endpoint, extends existing command)

**Definition of Done**:
Standard DoD plus: verify on a mobile viewport (375px width) that the form is usable on a tablet or phone.
