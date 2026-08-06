# Autonomous Planning

Sprint planning and backlog management are traditionally high-overhead activities. A PM writes user stories based on a feature brief. Engineers estimate those stories. The team fills a sprint based on velocity and priority. This process can take two to four hours per sprint. When the stories are poorly written or the estimates are based on incomplete understanding, the planning session devolves into real-time requirements discovery — which is even more expensive.

AI agents substantially reduce this overhead. A well-prompted planning agent can take a feature brief and produce a complete set of user stories with acceptance criteria in minutes. Engineers and PMs review, refine, and approve — but the first draft comes from the agent. Over time, the quality of that first draft improves as the agent accumulates context about how Aurigo writes stories and what level of detail produces good engineering outcomes.

This document covers the AI-assisted planning workflow, from backlog generation through sprint planning, and the human gates that ensure AI planning output is accurate and appropriate before being committed to the sprint.

---

## AI-Assisted Backlog Generation

Given a feature brief or PRD, an AI agent can generate the complete backlog for that feature: user stories, acceptance criteria, technical task breakdown, story point estimates, and dependency mapping.

**Input to the planning agent:**
- The feature brief (1-3 paragraphs describing the feature and its business value)
- The personas that will use this feature (from Volume 2 or the current project's persona documentation)
- The current sprint backlog (so the agent can identify dependencies and avoid duplicating work that is already planned)
- The module state summary (so the agent understands what is already implemented)

**Output from the planning agent:**
- 3-8 user stories formatted using the `vol-9-templates/user-story-template.md` template
- Acceptance criteria in Gherkin format for each story
- Technical task notes (files to create, patterns to follow, dependencies)
- Story point estimates (Fibonacci: 1, 2, 3, 5, 8, 13) with brief rationale
- Dependency map (which stories must be completed before which)
- Risk flags (stories with ambiguous requirements, high complexity, or external dependencies)

**The planning agent prompt for Aurigo:**

```
You are the Planning Agent for Aurigo Software Technologies.

## Context
Aurigo Maintain is a .NET 8 / React 18 asset intelligence platform for infrastructure 
owners. The platform uses Clean Architecture, EF Core 8 + PostgreSQL, TanStack Router, 
and shadcn/ui.

## Current Module State
[Paste the relevant section from project_state.md memory]

## Current Sprint Backlog
[Paste any stories already in the sprint]

## Feature to Plan
[Paste the feature brief]

## Personas Affected
[Paste the relevant personas from vol-2-product-knowledge or project notes]

## Your Task
Generate a complete set of user stories for this feature. For each story:

1. Write the story in the format: "As a [persona], I want [action], so that [value]"
2. Write 3-5 acceptance criteria in Gherkin format (Given/When/Then)
3. Note the technical tasks (files to create, reference patterns, dependencies)
4. Estimate story points (Fibonacci: 1, 2, 3, 5, 8, 13) with one-sentence rationale
5. Flag any risks or ambiguities that need human clarification

## Constraints
- Stories must be independently deliverable (not "implement the backend and frontend 
  for the entire inspections module" — split by vertical slice)
- Acceptance criteria must be testable (avoid "should feel fast" — write "API response 
  < 200ms p95")
- Do not create stories for work already implemented (see module state above)
- Do not create stories for work explicitly out of scope (work orders, preventive 
  maintenance, parts/inventory)
- Point estimates are rough starting points — engineers will validate

## Output Format
Use the user story format from vol-9-templates/user-story-template.md.
Produce one story per markdown code block.
After all stories, produce a dependency map and a list of risks.
```

---

## The Planning Workflow

The full planning workflow runs in three phases. AI handles the first draft; humans review and approve.

**Phase 1 — AI Draft (1-2 hours)**

1. PM provides the feature brief to the Planning Agent
2. Planning Agent produces the draft backlog
3. PM reviews the draft for business accuracy: are the personas correct? Are the stated values accurate? Are there missing stories?
4. PM annotates the draft with comments (add story for X, remove story for Y, change the acceptance criteria for Z)

**Phase 2 — Technical Refinement (30-60 minutes)**

1. Backend Lead reviews the technical task notes for backend stories
2. Frontend Lead reviews the technical task notes for frontend stories
3. Engineers validate story point estimates (adding or reducing based on their understanding of the implementation complexity)
4. Dependencies are validated and adjusted
5. Risk flags are evaluated: which are real risks requiring action vs. false alarms?

**Phase 3 — Sprint Commitment (30 minutes)**

1. PM presents the refined backlog to the team
2. Sprint velocity from the previous sprint is compared against the total points of candidate stories
3. Stories are selected for the sprint based on priority and capacity
4. Sprint goal is drafted (the Planning Agent can draft this if given the selected stories)
5. Sprint is committed

**Total time with AI assistance:** 2-3 hours versus 4-6 hours without AI, with generally higher quality stories (more complete acceptance criteria, better dependency mapping).

---

## Autonomous Sprint Goal Setting

Given the following inputs, the Planning Agent can draft a sprint goal:

- The stories selected for the sprint (titles and brief descriptions)
- The current product phase and MVP milestone targets
- The team's velocity and capacity

Sprint goal format:
```
**Sprint [N] Goal:** [One sentence stating the outcome, not the activity]

**Key deliverables this sprint:**
1. [Deliverable 1] — enables [specific customer value]
2. [Deliverable 2] — enables [specific customer value]
3. [Deliverable 3] — enables [specific customer value]

**Success criteria:** [How we will know at the end of the sprint if the goal was achieved]
```

Example:
```
**Sprint 4 Goal:** A field inspector can record a complete structural inspection on a 
mobile device with photo evidence and condition scores.

**Key deliverables this sprint:**
1. Inspection form — mobile-first, offline-capable, all required fields — enables 
   inspectors to work in the field without connectivity
2. Photo capture and attachment — enables photo evidence to be associated with defect 
   records in inspections
3. Inspection submission workflow — enables field data to flow from mobile to office review

**Success criteria:** A tester can simulate a field inspection by completing the 
form on a 375px viewport, attaching photos, submitting, and verifying the record 
appears in the office dashboard.
```

---

## AI Story Estimation

Story point estimation is notoriously difficult to automate because it depends on team-specific factors: how familiar the team is with the code area, what technical debt exists, how clear the requirements are. AI estimations are directional starting points — they give engineers a number to react to, not a number to accept without thought.

**How the Planning Agent estimates:**

The agent estimates based on:
1. The number and complexity of files to create or modify
2. Whether the pattern exists (implementing an existing pattern is faster than establishing a new one)
3. The presence of external dependencies (EAM integration stories are inherently harder to estimate because behavior depends on the external system)
4. The test surface (a story that requires integration tests against a database container takes longer than one that requires only unit tests)
5. Historical comparison (if the agent has context about similar stories completed in previous sprints, it can compare)

**Calibration over time:**
After each sprint, compare estimated points to actual points (or effort). Save the delta to memory as calibration data. Over time, the agent's estimates become more accurate for the specific team.

---

## Limitations and Human Gates

AI planning is a powerful tool but has clear limitations that require human oversight.

**Business accuracy:** The Planning Agent does not know the customer. It can draft acceptance criteria based on the feature brief, but it cannot verify that those criteria match what the customer actually needs. PM must review every story for business accuracy.

**Technical feasibility:** The Planning Agent can identify patterns and reference implementations, but it may not know about recent architectural constraints or planned work in adjacent areas that would affect implementation. Engineering leads must validate technical task notes.

**Priority:** The agent does not make prioritization decisions. It can rank stories by dependency (which must come first) but cannot judge business value. PM owns priority.

**Estimations:** Story points are rough starting points. Engineers who will implement the stories must validate estimates. The agent's estimate of "3 points" for a story might be 1 point if an engineer has recently done very similar work, or 8 points if the area has significant technical debt.

**The "AI generated it" trap:** The biggest risk in AI-assisted planning is the team treating the AI draft as final because it looks complete. A convincing AI draft with subtly wrong acceptance criteria can send engineers in the wrong direction for an entire sprint. PM and engineering reviews are not optional steps — they are the quality gates that make AI-assisted planning safe.
