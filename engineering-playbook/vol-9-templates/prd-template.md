# Product Requirements Document

---

## Header

| Field | Value |
|-------|-------|
| **Title** | [Feature Name] |
| **Status** | Draft / In Review / Approved / Shipped |
| **Author** | [PM Name] |
| **Engineering Lead** | [Engineer Name] |
| **Date Created** | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |
| **Version** | 0.1 |
| **Product** | Masterworks / Primus / Both |
| **Module** | Asset Inventory / Condition / RUL / ARV / Risk / Dashboard / Integration / Config |
| **Phase** | [Phase number from CLAUDE.md build phases] |

---

## Problem Statement

[Two to three paragraphs. First paragraph: what pain exists today, for whom, and how they cope. Second paragraph: why the current workaround is inadequate and what it costs them. Third paragraph (optional): strategic reason Aurigo is solving this now — market timing, customer contract commitment, platform capability unlock.]

Do not describe the solution here. This section exists purely to document the problem so that any engineer, PM, or stakeholder who reads it can independently propose solutions.

---

## Customer Evidence

| Source | Quote or Data Point | Date |
|--------|---------------------|------|
| [Customer name / persona] | "[Direct quote or paraphrase of feedback]" | YYYY-MM-DD |
| [Customer name / persona] | "[Direct quote or paraphrase of feedback]" | YYYY-MM-DD |
| Support ticket analysis | [X tickets in the last 90 days requesting this capability] | YYYY-MM-DD |
| NPS qualitative | [Theme from open-ended NPS responses] | YYYY-MM-DD |

---

## Goals

Goals must be measurable. Each goal maps to a Success Metric at the bottom of this document.

| # | Goal | Measurement |
|---|------|-------------|
| G-1 | [Specific outcome for the customer] | [How we measure it, and target value] |
| G-2 | [Specific outcome for the customer] | [How we measure it, and target value] |
| G-3 | [Business or platform outcome] | [How we measure it, and target value] |

---

## Non-Goals

The following are explicitly out of scope for this feature. If any of these are requested during implementation, escalate to PM before proceeding.

- [Non-goal 1] — [brief reason why it is excluded]
- [Non-goal 2] — [brief reason why it is excluded]
- [Non-goal 3] — [brief reason why it is excluded]

---

## Personas

| Persona | Role | Primary Need This Feature Addresses |
|---------|------|-------------------------------------|
| [Persona name] | [Job title at customer] | [One sentence] |
| [Persona name] | [Job title at customer] | [One sentence] |

See `vault/personas/` for full persona cards.

---

## User Stories

User stories are maintained in your project management tool. The following stories are planned for this feature. Each story follows the template in `user-story-template.md`.

| Story ID | Title | Points | Priority |
|----------|-------|--------|----------|
| [ID] | [Story title] | [SP] | Must-have / Should-have / Nice-to-have |
| [ID] | [Story title] | [SP] | Must-have / Should-have / Nice-to-have |
| [ID] | [Story title] | [SP] | Must-have / Should-have / Nice-to-have |

---

## Functional Requirements

Each requirement has a unique ID, a priority (Must/Should/Could), and a source (which user story or goal it serves).

| ID | Priority | Requirement | Source |
|----|----------|-------------|--------|
| FR-001 | Must | [The system shall...] | G-1 |
| FR-002 | Must | [The system shall...] | G-1 |
| FR-003 | Should | [The system shall...] | G-2 |
| FR-004 | Could | [The system shall...] | G-3 |

---

## Non-Functional Requirements

### Performance
- [Specific latency or throughput target, e.g., "Export of up to 50,000 asset records must complete within 30 seconds on the reference server configuration."]
- [API endpoint P95 latency target]

### Scale
- [Maximum data volumes expected, e.g., "Must support customers with up to 500,000 assets in a single tenant."]

### Accessibility
- All new UI surfaces must meet WCAG 2.1 Level AA.
- Keyboard navigable without mouse for all primary user journeys.
- Color is never the sole means of conveying information.

### Security
- [JWT claim requirements for this feature]
- [Any PII or sensitive data handling notes]
- [Row-level security / tenant isolation notes]

---

## UI/UX Notes

[Reference to Figma frame or wireframe URL if available. If no Figma, describe the interaction pattern briefly.]

Key interaction decisions:
- [Decision 1]
- [Decision 2]

Edge states that must be designed (do not leave these to engineer discretion):
- Empty state: [describe]
- Loading state: [describe]
- Error state: [describe]
- Partial data state (e.g., some assets lack condition data): [describe]

---

## Data Model Impact

[Describe any new tables, columns, or index changes. Reference the EF Core migration name if already created.]

| Change | Entity / Table | Description |
|--------|----------------|-------------|
| New column | [Table] | [Column name, type, nullable, default] |
| New table | [Table] | [Purpose, FK relationships] |
| New index | [Table] | [Columns indexed, reason] |

If no data model changes: write "None — this feature reads existing data only."

---

## API Impact

[List new or modified endpoints. Link to `api-design-template.md` documents for each.]

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| [GET/POST/PUT/DELETE] | `/api/v1/[path]` | New / Modified / Deprecated | [Brief note] |

If no API changes: write "None — this feature is frontend-only."

---

## Integration Impact

[Does this feature affect or depend on EAM connectors, DocMgmt, Notification, Workflow, or Aurigo Engage AI? List each integration and the nature of the impact.]

| Integration | Impact | Notes |
|-------------|--------|-------|
| [Integration name] | [None / Read / Write / New event] | [Brief description] |

---

## Dependencies

| Dependency | Type | Team / System | Risk |
|------------|------|--------------|------|
| [Dependency] | Technical / Business / Data | [Owner] | [Low/Med/High and brief rationale] |

---

## Open Questions

| # | Question | Owner | Due Date | Resolution |
|---|----------|-------|----------|------------|
| Q-1 | [Question text] | [Name] | YYYY-MM-DD | [Empty until resolved] |
| Q-2 | [Question text] | [Name] | YYYY-MM-DD | [Empty until resolved] |

---

## Success Metrics

[Map back to Goals section. Define how success is measured post-launch, by whom, and when the first measurement occurs.]

| Goal | Metric | Baseline | Target | Measurement Date |
|------|--------|----------|--------|-----------------|
| G-1 | [Metric name] | [Current value] | [Target value] | [Weeks post-launch] |
| G-2 | [Metric name] | [Current value] | [Target value] | [Weeks post-launch] |

---

## Launch Plan

| Phase | Description | Owner | Target Date |
|-------|-------------|-------|-------------|
| Internal alpha | Deploy to staging; Aurigo engineers validate | EM | YYYY-MM-DD |
| Customer beta | One design-partner customer enabled | PM | YYYY-MM-DD |
| General availability | All customers on eligible plan | PM | YYYY-MM-DD |

Rollback trigger: [Describe the condition under which this feature is rolled back — e.g., "error rate > 1% on export endpoint for 15 minutes."]

---
---

## Example: Automated TAMP Pavement Condition Export

### Header

| Field | Value |
|-------|-------|
| **Title** | Automated TAMP Pavement Condition Export |
| **Status** | Approved |
| **Author** | Meera Pillai (PM, Masterworks Maintain) |
| **Engineering Lead** | Ravi Krishnaswamy |
| **Date Created** | 2026-06-01 |
| **Last Updated** | 2026-06-18 |
| **Version** | 1.2 |
| **Product** | Masterworks |
| **Module** | Condition / Asset Inventory |
| **Phase** | Phase 2 — Condition Recording |

### Problem Statement

US state DOTs that receive federal highway funding are required by law (23 CFR Part 490) to report pavement condition data to FHWA annually using a specific XML format defined by the Transportation Asset Management Plan (TAMP) standard. Today, Masterworks customers must manually export pavement condition records to a CSV, paste them into a separate desktop tool maintained by their state DOT, and then upload the result to the FHWA portal. This process takes a senior pavement engineer 6–12 hours per reporting cycle and is error-prone because the manual transformation step introduces field-mapping mistakes.

The manual workaround fails when customers have more than 5,000 lane-miles to report. Several large DOT customers have reported that their engineers spend entire weeks on this export before every FHWA deadline, diverting staff from actual inspection work. One customer submitted an incorrect IRI value for 340 segments in their 2025 submission and had to file a formal correction, which triggered a compliance review.

Aurigo is solving this now because three new DOT contracts signed in Q1 2026 each included "automated TAMP reporting" as a contractual deliverable in Year 1. Delivering this feature also creates a strong platform differentiator against competing EAM vendors who do not offer integrated TAMP export.

### Customer Evidence

| Source | Quote or Data Point | Date |
|--------|---------------------|------|
| MnDOT pavement division | "Our team manually maps IRI and PSR values every single year. It is ridiculous that we have to do this." | 2026-03-15 |
| CDOT contract SOW | Clause 4.2 requires "native TAMP XML export available within Maintain by December 2026." | 2026-01-30 |
| Support ticket analysis | 14 tickets in the last 90 days requesting TAMP export or related pavement reporting functionality. | 2026-05-31 |
| NPS qualitative (Q1 2026) | Reporting and compliance export was the most common theme in open-ended "what is missing?" responses among DOT customers. | 2026-04-01 |

### Goals

| # | Goal | Measurement |
|---|------|-------------|
| G-1 | Reduce time to produce TAMP-compliant export from 6 hours to under 10 minutes | Engineer-observed time-on-task in beta customer test; target <= 10 min |
| G-2 | Eliminate field-mapping errors | Zero FHWA correction filings by beta customers in the first reporting cycle after launch |
| G-3 | Satisfy CDOT and MnDOT contract deliverable | Both customers confirm acceptance in writing by 2026-11-30 |
| G-4 | Support the feature for all Masterworks Maintain customers at no extra cost tier | Available on all paid tiers by GA date |

### Non-Goals

- Real-time push to FHWA portal — the feature produces the XML file; the engineer still uploads it. Automated portal submission is Phase 2 and requires FHWA API agreement.
- Bridge condition TAMP export — bridges are a separate regulatory framework (NBIS). This PRD covers pavement only.
- Historical backfill export (prior to Maintain go-live) — we export only data entered in Maintain.

### Functional Requirements

| ID | Priority | Requirement | Source |
|----|----------|-------------|--------|
| FR-001 | Must | The system shall generate a TAMP-compliant XML file conforming to the current FHWA HMS schema version 6.2 | G-1, G-3 |
| FR-002 | Must | The user shall be able to filter the export by reporting year, network (NHS / non-NHS), and state code | G-1 |
| FR-003 | Must | The system shall validate the generated XML against the HMS schema before allowing download, and surface any validation errors with field-level detail | G-2 |
| FR-004 | Must | The export shall be accessible from the Asset Inventory module > Pavement section > Export menu | G-1 |
| FR-005 | Should | The system shall store a log of every export (user, timestamp, filter parameters, record count, validation result) | Audit requirement |
| FR-006 | Could | Users with the State Admin role can schedule automatic export generation 30 days before the FHWA reporting deadline | G-1 |

### Success Metrics

| Goal | Metric | Baseline | Target | Measurement Date |
|------|--------|----------|--------|-----------------|
| G-1 | Median time to generate and download TAMP export | ~6 hours (manual) | <= 10 minutes | 4 weeks after beta launch |
| G-2 | FHWA correction filings by Maintain customers | 1 per year (observed) | 0 | After first annual reporting cycle |
| G-3 | Contract acceptance by CDOT and MnDOT | Pending | Written sign-off | 2026-11-30 |
