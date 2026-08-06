# Autonomous Documentation

Documentation debt is a persistent engineering problem. In a sprint with 20 stories, engineers write code for all 20 stories but update documentation for perhaps 8. Over six months, the documentation diverges from the implementation to the point where it cannot be trusted. Engineers stop reading it. New engineers get confused. Support tickets increase. The documentation — which was meant to reduce friction — instead adds it.

AI agents fundamentally change this dynamic. An agent that can read the current implementation can also write accurate, current documentation for that implementation. The engineering effort required to keep documentation current drops from "significant manual work" to "review the AI draft."

This document covers the documentation types Aurigo maintains, the AI workflow for each type, the triggers that initiate automated documentation generation, and the review checklist that ensures AI-generated documentation is accurate and appropriate.

---

## The Documentation Debt Problem

The core issue is that documentation is always secondary to implementation in a sprint. When time pressure mounts, documentation is what gets cut. Over time:

1. API documentation describes endpoints that were added, modified, or removed months ago
2. User guides describe flows that no longer exist in the UI
3. Architecture documentation refers to patterns that were refactored away
4. Release notes are missing entire sprints of changes

Customers and engineers make decisions based on this stale documentation. They build integrations against documented APIs that behave differently. They follow user guides that lead to dead ends. They design new features that conflict with architecture patterns that were superseded.

AI-driven documentation workflows break this cycle by making the cost of keeping documentation current negligibly small. The documentation is regenerated from the current implementation, reviewed for accuracy, and published.

---

## Documentation Type 1 — API Documentation from Code

**What it produces:** Swagger XML comments on controller actions, plus API reference markdown for the `docs/api/` directory.

**Trigger:** Any PR that adds or modifies a controller action, a request DTO, or a response DTO.

**Workflow:**
1. AI agent reads the controller action, the MediatR handler, the request DTO, and the response DTO
2. AI agent writes XML summary comments on the controller action
3. AI agent writes the API reference markdown entry

**Prompt:**
```
You are the Documentation Agent for Aurigo Software Technologies.

## Endpoint to Document
Read: Api/Controllers/InspectionsController.cs — focus on the CreateInspection action
Read: Application/Inspections/Commands/CreateInspectionRecordCommand.cs
Read: Application/Inspections/DTOs/InspectionRecordDto.cs

## Reference Pattern
Read: docs/api/assets.md — follow this format for the markdown documentation
Read: Api/Controllers/AssetsController.cs — follow the existing XML comment style

## Your Task
1. Write XML summary comments for the CreateInspection action in InspectionsController.cs:
   - <summary>: one sentence describing the operation
   - <param>: each parameter
   - <returns>: what is returned and when
   - <response code="201">: description
   - <response code="400">: description
   - <response code="404">: description
   - <response code="403">: description

2. Write the API reference entry in docs/api/inspections.md:
   Use the format from docs/api/assets.md.
   Include: endpoint path, HTTP method, auth requirement, request body schema 
   (with field descriptions), response schema, error codes, example request, 
   example response.

## Deliverable
1. Updated Api/Controllers/InspectionsController.cs (XML comments only)
2. Updated or created docs/api/inspections.md
```

**Review checklist:**
- [ ] All fields in the request DTO are documented with descriptions
- [ ] All response fields are documented
- [ ] Error codes match what the handler actually returns (404, 400, 403, 422)
- [ ] Example values in the documentation are realistic infrastructure domain values (not "string", not 0)
- [ ] Authentication requirement is correctly stated

---

## Documentation Type 2 — ADR Draft from PR

Architecture Decision Records capture important technical decisions. Engineers frequently make architectural decisions during implementation without writing ADRs, because ADR writing takes time and feels secondary to shipping the feature.

**What it produces:** A draft ADR following the `vol-9-templates/adr-template.md` format.

**Trigger:** A PR that introduces a new pattern, a significant library, or a structural decision not captured in an existing ADR. Identified by the code reviewer or the Architecture Review Agent.

**Workflow:**
1. Architecture Review Agent (or engineer) flags that the PR contains an architectural decision
2. Documentation Agent reads the PR diff, the relevant existing ADRs, and the playbook
3. Documentation Agent produces a draft ADR
4. Engineering Director and Technical Architect review and finalize the ADR

**Prompt:**
```
You are the Documentation Agent for Aurigo Software Technologies, writing an 
Architecture Decision Record.

## Context
A PR was merged that introduces [brief description of the architectural decision].

Read: engineering-playbook/vol-3-architecture/adrs/ — all existing ADRs, so you 
understand what has already been decided and what ADR number is next.
Read: engineering-playbook/vol-9-templates/adr-template.md — the ADR format.

## The Decision to Document
[Description of the decision: what pattern was introduced, what alternatives were 
considered, what the rationale was]

Key files that implement this decision:
- [file 1]
- [file 2]

## Your Task
Write a complete ADR following the template in vol-9-templates/adr-template.md.

The ADR should:
- Be assigned the next sequential number
- Have status: Proposed (it becomes Accepted after Engineering Director review)
- Include 2-3 alternatives that were considered (even if briefly)
- Include a compliance section describing how to verify the decision is being followed
- Be accurate to the current implementation

## Deliverable
File: engineering-playbook/vol-3-architecture/adrs/ADR-[NNN]-[slug].md
```

---

## Documentation Type 3 — User Guide from Story

**What it produces:** A user guide entry for a new feature, formatted for the audience defined in the story persona.

**Trigger:** A story is moved to Done status. If the story has a user-facing UI change, a user guide entry is required.

**Workflow:**
1. Documentation Agent reads the user story and acceptance criteria
2. Documentation Agent reads the implemented frontend component/page
3. Documentation Agent writes the user guide entry: step-by-step instructions, common questions, and edge case guidance

**Review checklist:**
- [ ] Instructions match the actual UI (screenshots or UI description accurate)
- [ ] Written for the right audience (field inspector, asset manager, admin)
- [ ] Edge cases and error states documented ("if you receive this error, it means...")
- [ ] Correct domain terminology (not generic software terms)

---

## Documentation Type 4 — Release Notes from Git

**What it produces:** Categorized release notes covering all changes since the last release.

**Trigger:** A release is being prepared. Engineering runs the release notes generation as part of release preparation.

**Workflow:**
1. Documentation Agent reads: `git log [previous-release-tag]..HEAD --oneline`
2. Documentation Agent reads the stories associated with each commit
3. Documentation Agent categorizes changes: new features, improvements, bug fixes, breaking changes
4. Documentation Agent drafts the release notes following `vol-9-templates/release-notes-template.md`
5. PM reviews for accuracy and customer-appropriateness

**Prompt:**
```
You are the Documentation Agent for Aurigo Software Technologies, writing release notes.

Read: vol-9-templates/release-notes-template.md — the release notes format.

## Changes to Document
The following is the git log since the last release:
[paste git log output]

## Context
Product: Aurigo Maintain
Version: [version number]
Release date: [date]
Target audience for release notes: Aurigo customer administrators and integration engineers

## Your Task
Write release notes following the template in vol-9-templates/release-notes-template.md.

For each change:
- Identify the category (new feature, improvement, bug fix, breaking change)
- Write a customer-facing description (not "implemented CreateInspectionRecord handler" 
  — write "Inspectors can now record inspection results from the mobile app")
- Note any user action required (migration steps, configuration changes)
- Note any breaking changes with upgrade instructions

## Deliverable
Draft release notes in the vol-9-templates/release-notes-template.md format.
```

---

## Documentation Type 5 — Playbook Update from ADR

When an ADR is accepted, it may affect sections of the playbook. The Documentation Agent can identify affected sections and draft the updates.

**Trigger:** An ADR status changes from Proposed to Accepted.

**Workflow:**
1. Documentation Agent reads the new ADR
2. Documentation Agent reads the table of contents for each affected playbook volume
3. Documentation Agent identifies specific sections that need updating
4. Documentation Agent drafts the updates
5. Engineering Director reviews and approves playbook updates

---

## Documentation Review Checklist

All AI-generated documentation must pass this checklist before publication:

**Technical accuracy:**
- [ ] Describes the current implementation, not a past or planned state
- [ ] Code examples run without modification
- [ ] Field names and types match the actual DTOs
- [ ] Error codes match what the API actually returns

**Domain accuracy:**
- [ ] Uses correct infrastructure asset management terminology
- [ ] Asset classes are named correctly (pavement, bridge, sign, drain — not road, overpass)
- [ ] Regulatory references (TAMP, FHWA) are correctly described
- [ ] Business rules (condition score 0-5, not 1-10 or 0-100) are correctly stated

**Audience appropriateness:**
- [ ] Technical documentation (API docs) written for developers, not end users
- [ ] User guides written for the specific persona from the story (inspector, asset manager)
- [ ] ADRs written for future engineers who will need to understand the context

**Completeness:**
- [ ] All required template sections are present
- [ ] Error states and edge cases are documented
- [ ] Prerequisites and dependencies are noted
- [ ] Links to related documentation are included

---

## Making Documentation Generation Habitual

The goal is for documentation generation to become as habitual as running tests before merging a PR. The triggers above define when documentation should be generated. The review checklists define what must be verified. The remaining ingredient is engineering culture.

Documentation generation should be part of the Definition of Done for every story. A story is not "Done" if its documentation is not updated. The AI agents make this standard achievable — the effort is reviewing a draft, not writing from scratch. A documentation review takes 10 minutes. This is not a significant burden in the context of a two-week sprint.

The playbook itself is maintained using these same workflows: ADRs are drafted by the Documentation Agent when significant decisions are made, and playbook sections are updated when ADRs are accepted. Volume 7 is updated when agent patterns are established or changed. Volume 9 is updated when new template sections are added. Volume 10 is updated when new prompts are validated. The playbook is a living document, and AI makes keeping it alive practical.
