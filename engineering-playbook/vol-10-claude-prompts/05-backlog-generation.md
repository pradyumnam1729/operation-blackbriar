# 05 — Backlog Generation Prompt

Use this prompt to turn a feature brief, PRD section, or stakeholder description into an executable set of user stories ready for sprint planning. The output follows Aurigo's standard story format and includes Gherkin acceptance criteria, technical breakdown, estimates, and risk flags.

---

## When to Use

- When you have a feature brief or PRD section and need to break it into sprint-ready stories.
- When a stakeholder has described a feature in a meeting and you need to formalize it.
- When you are preparing for a sprint planning session and need stories estimated and sequenced.

## Prerequisites

Before running this prompt, you should have:
- A clear feature description (2-5 sentences minimum)
- The target persona (from `vol-2-product-knowledge/`)
- The phase this feature belongs to (from `vault/phases/`)

---

## Backlog Generation Prompt

Replace `[FEATURE_DESCRIPTION]`, `[PERSONA]`, `[PHASE]`, and `[MODULE]`. Paste the full prompt:

---

You are a senior product owner at Aurigo generating a sprint-ready backlog for the Aurigo Maintain product. Your output will be used directly in sprint planning.

**Context:**
- Product: Aurigo Masterworks Maintain (public-sector capital planning)
- Module: `[MODULE]` (e.g., Asset Inventory, Condition Recording, RUL, ARV, Risk Scoring, Capital Needs, Dashboard, Configuration)
- Primary Persona: `[PERSONA]` (e.g., Asset Manager, Capital Planner, GIS Analyst, Agency Director)
- Build Phase: `[PHASE]`

**Feature Description:**
```
[FEATURE_DESCRIPTION]
```

**Before generating stories, read these files to understand context:**
1. Read `vault/phases/[PHASE].md` for what is already complete in this phase
2. Read the relevant domain entities in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/` for the module
3. Read `vol-2-product-knowledge/` for persona vocabulary and goals
4. Read existing stories in this module if any exist in `vault/stories/` or the backlog file

**Rules for generating stories:**
- Use the persona vocabulary from vol-2-product-knowledge — not generic "user" language
- Each story must be independently testable — no story can only be verified by running another story first
- Each acceptance criterion must be verifiable by a QA engineer without access to source code
- If a story depends on a calculation formula, do NOT write the implementation story — write a spike story for the formula first, and make the implementation story depend on the spike
- Stories larger than 8 story points must be split — a story that cannot be completed in 2 days needs splitting
- Story points use Fibonacci: 1, 2, 3, 5, 8 (if you reach for 13, split the story)
- Label stories that require architecture review before starting with [ARCH-REVIEW]
- Label stories with ambiguous requirements with [CLARIFY: question] in the risk flags

**Generate 5-10 user stories for this feature. For each story, provide:**

---

### Story [N]: [Story Title]

**User Story:**
As a [specific persona], I want to [specific action/goal] so that [specific benefit/outcome].

**Story Points:** [1 / 2 / 3 / 5 / 8]

**Acceptance Criteria (Gherkin):**

```gherkin
Scenario: [Happy path scenario name]
  Given [initial context]
  When [user action]
  Then [expected outcome]
  And [additional assertions if needed]

Scenario: [Edge case 1]
  Given [edge condition setup]
  When [user action]
  Then [expected edge case behavior]

Scenario: [Error state]
  Given [error-inducing condition]
  When [user action]
  Then [expected error behavior]
  And [user is informed how]

Scenario: [Authorization]
  Given [user with insufficient role]
  When [they attempt the action]
  Then [access is denied with appropriate message]
```

**Technical Tasks:**
- [ ] Backend: [specific task]
- [ ] Backend: [specific task]
- [ ] Database: [specific task if applicable]
- [ ] Frontend: [specific task]
- [ ] Frontend: [specific task]
- [ ] Tests: [specific task]

**Dependencies:**
- Depends on: [Story N] (if applicable)
- Blocks: [Story N] (if applicable)
- Requires ADR/Architecture Review before starting: [Yes/No]

**Risk Flags:**
- [CLARIFY: question for product owner or domain expert if requirements are ambiguous]
- [FORMULA: if this story involves a calculation, the formula must be confirmed before implementation starts]
- [ARCH-REVIEW: if this story introduces a new pattern that should be reviewed before building]
- [SPIKE: if this story requires research before estimation is reliable]

---

**After all stories, provide:**

### Dependency Map
Draw a dependency graph (text format) showing which stories must be completed before others can start:
```
Story 1 --> Story 3 --> Story 5
Story 2 --> Story 4 --> Story 5
```

### Risk Summary
List the top 3 risks for this backlog:
1. [Risk]: [Mitigation]
2. [Risk]: [Mitigation]
3. [Risk]: [Mitigation]

### Total Estimate
Sum of all story points: [N points]
At a 2-engineer team with 8-point velocity per sprint, estimated [N] sprints.

### Clarifications Needed
List every [CLARIFY] flag from the stories above. These must be resolved before sprint planning.

---

## Worked Example

The following is a worked example. Run this prompt as-is to see an example, then modify `[FEATURE_DESCRIPTION]` for your actual feature.

---

You are a senior product owner at Aurigo generating a sprint-ready backlog for the Aurigo Maintain product.

**Context:**
- Product: Aurigo Masterworks Maintain
- Module: Risk Scoring
- Primary Persona: Asset Manager
- Build Phase: Phase 4 (ARV + Risk Scoring)

**Feature Description:**
Add a risk scoring dashboard to Masterworks Maintain that shows each asset's risk score as a heat map, allows the Asset Manager to filter by risk category (High/Medium/Low), and provides a drill-down view showing the likelihood of failure score, consequence of failure score, and composite risk score for a selected asset.

**Before generating stories:**
Read `vault/calculations/RiskScorer.md` for the risk scoring formula.
Read `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/Asset.cs`.
Read `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Calculations/RiskScorer.cs` if it exists.

**Generate 5-10 user stories following the rules and format above.**

---
