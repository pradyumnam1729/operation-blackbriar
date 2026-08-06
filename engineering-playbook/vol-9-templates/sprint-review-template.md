# Sprint Review

---

## Meeting Header

| Field | Value |
|-------|-------|
| **Sprint** | Sprint [N] |
| **Sprint Goal** | [One sentence: what this sprint was supposed to accomplish] |
| **Sprint Dates** | YYYY-MM-DD to YYYY-MM-DD |
| **Meeting Date** | YYYY-MM-DD |
| **Facilitator** | [Scrum Master / EM name] |
| **Product Owner** | [PM name] |
| **Team Members Present** | [Names] |
| **Stakeholders Present** | [Names and roles] |
| **Meeting Duration** | [N] minutes |

---

## Sprint Goal Assessment

**Goal:** [Restate the sprint goal]

**Goal Met?** Yes / Partially / No

**Explanation:** [One to three sentences on whether the goal was met and why. If not met, what was the blocker or root cause?]

---

## Story-by-Story Demo Agenda

*For each committed story, demonstrate the feature in the staging environment. The Product Owner verifies acceptance criteria live during the demo.*

---

### Story 1: [Story ID] — [Story Title]

**Demo Presenter:** [Name]
**Estimated Demo Time:** [N] minutes

**Demo Steps:**
1. [Navigate to / open / click...]
2. [Enter / select / trigger...]
3. [Show the result]

**Acceptance Criteria Verification:**

| AC# | Scenario | Status | Notes |
|----|---------|--------|-------|
| AC-1 | [Scenario name] | Accepted / Rejected / Deferred | |
| AC-2 | [Scenario name] | Accepted / Rejected / Deferred | |
| AC-3 | [Scenario name] | Accepted / Rejected / Deferred | |
| AC-4 | [Scenario name — authorization] | Accepted / Rejected / Deferred | |

**Overall Story Status:** Accepted / Rejected / Partially Accepted (carry-over AC noted)

---

### Story 2: [Story ID] — [Story Title]

**Demo Presenter:** [Name]
**Estimated Demo Time:** [N] minutes

**Demo Steps:**
1. [Step 1]
2. [Step 2]

**Acceptance Criteria Verification:**

| AC# | Scenario | Status | Notes |
|----|---------|--------|-------|
| AC-1 | [Scenario name] | Accepted / Rejected / Deferred | |
| AC-2 | [Scenario name] | Accepted / Rejected / Deferred | |

**Overall Story Status:** Accepted / Rejected / Partially Accepted

---

*(Add as many story blocks as needed.)*

---

## Sprint Metrics

### Velocity

| Metric | Value |
|--------|-------|
| Committed points this sprint | [N] |
| Completed points this sprint | [N] |
| Carry-over points | [N] |
| Completion rate this sprint | [N]% |
| Sprint N velocity | [N] points |
| Sprint N-1 velocity | [N] points |
| Sprint N-2 velocity | [N] points |
| **3-sprint rolling average** | **[N] points** |

### Stories Summary

| Category | Count | Points |
|----------|-------|--------|
| Stories committed | [N] | [N] |
| Stories accepted | [N] | [N] |
| Stories partially accepted | [N] | [N] |
| Stories not started | [N] | [N] |
| Stories carry-over to Sprint N+1 | [N] | [N] |

### Quality Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Bugs opened this sprint | [N] | — | — |
| Bugs closed this sprint | [N] | — | — |
| Open bug backlog (end of sprint) | [N] | <= [N] | On Track / At Risk |
| Test pass rate (CI, main branch) | [N]% | >= 98% | On Track / At Risk |
| Code coverage (Calculations + Domain) | [N]% | >= 90% | On Track / At Risk |

---

## What Didn't Get Done and Why

*For each story or task that was committed but not completed, explain the root cause. This is not a blame exercise — it's data for planning.*

| Story ID | Title | Root Cause | Action for Next Sprint |
|----------|-------|-----------|----------------------|
| [ID] | [Title] | [Scope expanded / dependency blocked / tech complexity underestimated / unplanned work] | [Carry over / re-estimate / split / descope] |

---

## Technical Debt Items Closed

*Technical debt tasks completed this sprint (from the tech debt backlog, not story work).*

| Debt Item | Description | Effort (hours) |
|-----------|-------------|----------------|
| [ID] | [What was cleaned up or improved] | [N] |

---

## Customer Feedback Collected This Sprint

*External feedback received from customers, customer success, or user research during this sprint.*

| Source | Feedback | Action |
|--------|----------|--------|
| [Customer name / channel] | [Summary of feedback] | [Log as story / No action / Forward to PM] |

*(Write "None received this sprint" if applicable.)*

---

## Preview of Next Sprint

**Proposed Sprint N+1 Goal:** [One sentence]

**Stories likely to be committed:**
- [Story ID]: [Title] — [N] points
- [Story ID]: [Title] — [N] points
- [Story ID]: [Title] — [N] points

**Capacity notes:** [Any known leaves, holidays, or reduced capacity in the next sprint]

---

## Stakeholder Feedback

*Capture feedback from stakeholders present at the review meeting.*

| Stakeholder | Feedback / Question | Owner | Action |
|-------------|---------------------|-------|--------|
| [Name / Role] | [Feedback or question raised] | [PM / EM / Engineer] | [Log story / Answer async / No action] |

---

## Releasability Decision

**Is the sprint output releasable to staging / production?**

- [ ] Yes — all accepted stories are in staging and ready for release
- [ ] Yes with conditions — [Specify conditions that must be met before release]
- [ ] No — [Specify what must be resolved before release is possible]

**Release Decision Owner:** [PM or EM name]

**Target Release Date:** YYYY-MM-DD

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| Product Owner | [Name] | YYYY-MM-DD |
| Engineering Manager | [Name] | YYYY-MM-DD |
| Scrum Master | [Name] | YYYY-MM-DD |

---
---

## Example: Sprint 18 Review (Partial)

### Meeting Header

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 18 |
| **Sprint Goal** | Deliver TAMP compliance reporting (bridge PDF export and pavement XML export) so that MnDOT can validate the feature before their August submission deadline |
| **Sprint Dates** | 2026-06-30 to 2026-07-11 |
| **Meeting Date** | 2026-07-11 |
| **Facilitator** | Priya Nambiar |
| **Product Owner** | Meera Pillai |
| **Team Members Present** | Ravi Krishnaswamy, Ananya Krishnan, Sanjay Venkataraman |
| **Stakeholders Present** | Kiran Menon (ED), Dev Kumar (Customer Success — MnDOT account) |

### Sprint Goal Assessment

**Goal Met?** Partially

**Explanation:** The bridge PDF export (MW-442) was accepted in full. The pavement XML export (MW-438) was partially accepted — the XML generation and schema validation are complete, but the scheduled export feature (FR-006 in the PRD) was not delivered due to scope underestimation in the scheduling UI. FR-006 is carry-over to Sprint 19.

### Sprint Metrics

| Metric | Value |
|--------|-------|
| Committed points | 34 |
| Completed points | 26 |
| Carry-over points | 8 |
| Completion rate | 76% |
| 3-sprint rolling average | 30 points |

### Releasability Decision

- [x] Yes with conditions — MW-442 (bridge export) can be released to staging immediately. MW-438 requires the carry-over story MW-438b (scheduled export UI) before the full feature is released to MnDOT beta.

**Release Decision Owner:** Meera Pillai
**Target Release Date for MW-442:** 2026-07-14
