# 06 — Sprint Planning Prompt

Use this prompt to generate a structured sprint plan from a prioritized backlog, team capacity, and velocity history.

---

## When to Use

- At the start of every sprint, after backlog grooming is complete.
- When re-planning mid-sprint due to scope change or team capacity change.
- When estimating how many sprints a feature set will take.

## How to Prepare

Before running this prompt, have the following ready:
- The prioritized backlog (a list of stories with estimates and dependencies)
- Team roster with each engineer's focus factor for the sprint (1.0 = full sprint, 0.5 = half capacity)
- Sprint length in days
- Velocity history (last 3 sprints' completed story points)
- Any known constraints (holidays, code freeze dates, demo deadlines)

---

## Sprint Planning Prompt

Replace all `[PLACEHOLDER]` values. Paste the full prompt:

---

You are acting as an engineering lead at Aurigo facilitating sprint planning for the Maintain product team. Generate a complete sprint plan based on the inputs below.

**Sprint Details:**
- Sprint number: `[SPRINT_NUMBER]`
- Sprint dates: `[START_DATE]` to `[END_DATE]`
- Sprint length: `[N]` working days

**Team Capacity:**
```
[ENGINEER_1_NAME]: [ROLE] — [FOCUS_FACTOR] (e.g., 0.8 = 80% focused, 20% on other duties)
[ENGINEER_2_NAME]: [ROLE] — [FOCUS_FACTOR]
[ENGINEER_3_NAME]: [ROLE] — [FOCUS_FACTOR]
```

**Velocity History:**
```
Sprint [N-3]: [X] points completed
Sprint [N-2]: [X] points completed
Sprint [N-1]: [X] points completed
Average velocity: [X] points
```

**Known Constraints:**
```
[e.g., "Sprint demo on Day 8 — all demo features must be merged by Day 7"]
[e.g., "Engineer 2 out Day 3 for personal leave"]
```

**Prioritized Backlog (highest priority first):**
```
[STORY_ID] | [STORY_TITLE] | [POINTS] | [DEPENDENCIES] | [TAGS]
[STORY_ID] | [STORY_TITLE] | [POINTS] | [DEPENDENCIES] | [TAGS]
[continue for all backlog stories]
```

Tags reference: [ARCH-REVIEW] = requires architecture review before coding, [CLARIFY] = requirements not finalized, [SPIKE] = research story, [FE] = frontend only, [BE] = backend only, [FULLSTACK] = both layers.

**Instructions:**

**Step 1 — Calculate capacity:**
For each engineer: working days x focus factor x 2 points per day (Aurigo's baseline productivity assumption for Maintain, based on Clean Architecture overhead).
Sum to get total sprint capacity in story points.

**Step 2 — Apply the 20% tech debt rule:**
Reserve 20% of total capacity for tech debt, bug fixes, and unplanned work. This is non-negotiable per the Aurigo engineering operating model.
Available story point budget = total capacity x 0.8.

**Step 3 — Check each story against readiness criteria:**
A story is ready to pull into sprint if ALL of the following are true:
- [ ] Acceptance criteria are complete and unambiguous (no [CLARIFY] tags)
- [ ] No [ARCH-REVIEW] tag, OR the architecture review has already been completed
- [ ] All dependencies are either completed or also in this sprint and sequenced correctly
- [ ] If the story involves a calculation, the formula is confirmed and documented
- [ ] If the story is a spike, it has a clear timebox and deliverable

If a story fails any readiness check, it CANNOT be pulled into the sprint. Flag it and move to the next priority story.

**Step 4 — Select stories:**
Pull stories from the top of the backlog until you reach the available story point budget. Do not exceed budget. Apply these tiebreakers in order:
1. Stories that unblock other stories go first
2. Risk-reduction stories (spikes, architecture) go before feature stories they enable
3. Demo stories go before non-demo stories

**Step 5 — Assign stories to engineers:**
Expertise hints for this team:
```
[ENGINEER_1_NAME]: [EXPERTISE, e.g., "Strong .NET, EF Core, calculation engines"]
[ENGINEER_2_NAME]: [EXPERTISE, e.g., "Strong React/TypeScript, TanStack, Mapbox"]
[ENGINEER_3_NAME]: [EXPERTISE, e.g., "Full stack generalist, strong on testing"]
```

**Step 6 — Sequence the sprint:**
For each story assigned, estimate which days of the sprint it will occupy based on its size and dependencies.

**Produce the sprint plan:**

```
## Sprint [SPRINT_NUMBER] Plan
[START_DATE] to [END_DATE]

### Sprint Goal
[One or two sentences describing what will be demonstrably complete at the end of this sprint, written in business terms.]

### Capacity Summary
| Engineer | Working Days | Focus Factor | Raw Points | Available Points (x0.8) |
|----------|-------------|--------------|------------|--------------------------|
| [Name]   | [N]         | [X]          | [N]        | [N]                      |
| Total    | —           | —            | [N]        | [N]                      |

Tech debt / buffer reserved: [N] points (20% of total)
Story point budget: [N] points

### Stories In Sprint
| Story ID | Title | Points | Engineer | Days | Depends On |
|----------|-------|--------|----------|------|-----------|
| [ID]     | [title] | [pts] | [name] | Days 1-2 | — |
| [ID]     | [title] | [pts] | [name] | Days 2-4 | [ID] |

Total committed: [N] points

### Stories NOT Pulled (and why)
| Story ID | Title | Points | Reason Not Pulled |
|----------|-------|--------|-------------------|
| [ID]     | [title] | [pts] | [CLARIFY: question not resolved] |
| [ID]     | [title] | [pts] | Budget exceeded |

### Tech Debt / Buffer Allocation
[N] points reserved. If no tech debt items are identified at sprint start, this time will be used for:
1. Test coverage improvement in [MODULE]
2. Dependency updates (check for outdated NuGet/npm packages)
3. Performance profiling of [ENDPOINT]

### Sprint Sequence (Day-by-Day)
Day 1: [What each engineer starts]
Day 2: [What should be in review, what starts next]
Day [N]: [Demo-ready state]

### Risk Flags
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| [risk description] | High/Med/Low | High/Med/Low | [mitigation] |

### Definition of Done (Sprint Level)
- [ ] All stories merged to main
- [ ] All tests passing (unit + integration)
- [ ] Frontend changes tested at 375px mobile viewport
- [ ] No new architecture violations
- [ ] Sprint demo recorded or live demo delivered to stakeholder
- [ ] `vault/phases/` updated with what was completed this sprint
```

---
