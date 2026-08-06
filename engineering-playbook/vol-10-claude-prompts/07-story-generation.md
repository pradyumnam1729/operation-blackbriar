# 07 — Story Generation Prompt

Use this prompt to generate a single, well-formed user story from a feature description. The output follows `vol-9-templates/user-story-template.md` exactly and includes the most specific persona, complete acceptance criteria (happy path + edge cases + error state + authorization), business rule flags, and a size warning if the story is likely too large.

---

## When to Use

- When you have a feature idea or stakeholder request and need to formalize it as a story.
- When a story in the backlog is poorly written and needs to be rewritten before sprint planning.
- When splitting a large story into smaller ones.
- Before assigning a story to an engineer, to ensure it is complete and unambiguous.

## Key Rule

**If the feature requires a calculation, do not write the implementation story without the formula.** Write a spike story for the formula first, and make the implementation story depend on the spike. A story that says "calculate RUL" without specifying the RUL formula is not implementable.

---

## Masterworks Variant (Public Sector)

Replace `[FEATURE_DESCRIPTION]` with your feature description. Paste the full prompt:

---

You are a product owner at Aurigo writing a user story for the Masterworks Maintain product (public-sector infrastructure owners: US DOTs, cities, counties, transportation agencies).

**Feature Description:**
```
[FEATURE_DESCRIPTION]
```

**Before writing the story, read these files:**
1. `vol-2-product-knowledge/` — identify the most specific appropriate persona from the Masterworks persona set
2. `vault/phases/` — identify which phase this story belongs to and what is already complete
3. The relevant domain entity file in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/` if applicable

**Persona selection rule:** Do not use generic "user" or "administrator." Select the most specific persona whose Job to Be Done matches this feature.

Public-sector personas available:
- **Asset Manager** — owns the asset lifecycle, tracks condition, manages inspections
- **Capital Planner** — builds the capital budget, prioritizes replacements, produces the TAMP
- **GIS Analyst** — manages spatial data, produces maps, validates asset locations
- **Inspector / Field Technician** — performs field inspections, records condition scores
- **Agency Director / Executive** — reviews dashboards, approves capital plans
- **Finance Officer** — reviews capital budgets, validates ARV figures

**Write the story following this exact template:**

---

### Story: [Concise title in the form "Verb + noun phrase"]

**User Story:**
As a [specific persona from the list above],
I want to [specific action or capability — be precise],
So that [specific benefit — connect to the persona's Job to Be Done].

**Story Points:** [Fibonacci: 1, 2, 3, 5, 8 — if you would estimate 13, flag for splitting]

**Module:** [Asset Inventory | Condition Recording | RUL | ARV | Risk Scoring | Capital Needs | Dashboard | Configuration]

**Phase:** [0 | 1 | 2 | 3 | 4 | 5]

**Priority:** [Must-Have | Should-Have | Could-Have] (MoSCoW)

**Acceptance Criteria:**

```gherkin
Scenario: Happy path — [name the primary scenario]
  Given [the user is authenticated with the correct role]
  And [relevant system state]
  When [the user performs the primary action]
  Then [the primary expected outcome]
  And [any secondary assertions]

Scenario: Edge case — [name the edge case]
  Given [the edge condition]
  When [the user performs the action]
  Then [the expected edge case handling]

Scenario: Edge case — [name a second edge case]
  Given [second edge condition]
  When [the user performs the action]
  Then [expected behavior]

Scenario: Error state — [name the error condition]
  Given [the error-inducing condition]
  When [the user performs the action]
  Then [the user sees a specific, helpful error message]
  And [the system state is not corrupted]

Scenario: Authorization — insufficient permissions
  Given [a user authenticated with an insufficient role]
  When [they attempt this action]
  Then [they receive an HTTP 403 Forbidden response]
  And [the UI shows a clear "you do not have permission" message]
```

**Business Rules:**
List any business rule that governs this story. For each rule, note: (a) where the rule is documented, (b) whether the rule needs confirmation before implementation, (c) if it involves a formula, state the formula explicitly.

**Technical Notes (for the implementing engineer):**
- Relevant entity: `[EntityName]` in `Domain/Entities/[EntityName].cs`
- Relevant handler pattern: `[path to a similar existing handler]`
- Migration required: [Yes — add column [name] to table [name] | No]
- New calculation engine required: [Yes — spike first | No]
- Frontend route: `[/expected/route/path]`
- New API endpoint: `[HTTP METHOD /api/v1/resource]`

**Size Assessment:**
[If <= 8 points:] "This story is sized appropriately. It can be completed by one engineer in 2 days or less."
[If you estimated 13+ points:] "**FLAG: This story is too large.** Split it as follows: [list 2-3 smaller stories this breaks into]."

**Calculation Formula Flag:**
[If the story requires a calculation:] "**FORMULA REQUIRED before implementation.** This story requires the [CALCULATION NAME] formula. Read `vault/calculations/[FileName].md` to confirm the formula is specified. If not, write a spike story first."
[If no calculation required:] "No calculation formula dependency."

---

## Primus Variant (Private Sector)

Use for features targeting Primus (manufacturing, data centers, utilities, airports, life sciences). Replace `[FEATURE_DESCRIPTION]`. Paste this prompt:

---

You are a product owner at Aurigo writing a user story for the Primus Maintain product (private-sector infrastructure owners: manufacturing plants, data centers, utilities, airports, life sciences facilities).

**Feature Description:**
```
[FEATURE_DESCRIPTION]
```

**Before writing the story, read the same files as the Masterworks variant,** then select the persona from the Primus persona set:

Private-sector personas:
- **Facilities Manager** — owns the building/facility asset lifecycle, manages inspections
- **Reliability Engineer** — analyzes equipment failure modes, sets maintenance intervals, owns RUL modeling
- **CapEx Planner** — builds the annual capital expenditure budget, prioritizes asset replacements
- **Operations Director** — owns uptime and production targets, approves maintenance windows
- **Plant Manager** — accountable for facility operations, reviews risk and compliance dashboards
- **EHS Manager** — reviews risk scores for safety-critical assets, ensures regulatory compliance

**Write the story following the same exact template** as the Masterworks variant, with these differences:
- Replace TAMP references with CapEx plan references
- Replace public-sector terminology (DOT, highway, bridge rating) with private-sector equivalents
- In the Authorization scenario, use Primus roles: FacilitiesManager, ReliabilityEngineer, CapExPlanner, OperationsDirector, ReadOnly

**Additional check for Primus stories:**
After writing the story, verify: does this story assume integration with an EAM system? If so, note which integration tier is required (Integrated / Hybrid / Native per `vol-6-integration-strategy/`) and whether the EAM stub in `Infrastructure/ExternalClients/` already covers this.

---
