# Business Analyst

## Mission

The Business Analyst bridges the gap between how a public agency currently manages its infrastructure assets (typically a combination of spreadsheets, paper forms, legacy databases, and institutional memory) and the structured data models and automated workflows that Maintain requires. The BA's primary skill is extracting implicit business processes and data structures from customer contexts and translating them into formal specifications that engineers can implement.

In an AI-native organization, the BA uses AI agents to dramatically accelerate documentation production — process flows, data models, BDD scenarios — while spending more time on the irreplaceable human work: building relationships with agency staff, listening for what's not said, and exercising judgment about which requirements are truly essential vs. which are habits that can be productively broken.

---

## Responsibilities

### Requirements Elicitation

Conduct structured requirements sessions with agency stakeholders. For a new Maintain deployment, this typically involves:
- Asset Managers: what decisions do they make, what data do they need, what reports does their leadership require?
- Inspectors: how do they currently document condition assessments, what forms do they use, what is their field workflow?
- Finance/Budget Staff: how does capital planning fit into the agency's budget process, what are the approval workflows, how does the CIP get assembled?
- IT Staff: what systems are in place, what are the data governance requirements, what security constraints apply?

The BA is not just capturing stated requirements — they are listening for the delta between what people say they need ("we need a form that looks like our current paper form") and what they actually need ("we need to capture element-level condition data and it doesn't matter what the form looks like as long as it's fast").

### Process Documentation

Document current-state business processes in BPMN notation (or equivalent diagrammatic format). Use AI to draft BPMN descriptions from interview notes: "Here are notes from a 90-minute session with a county bridge program manager. Generate a BPMN process flow for their current bridge inspection and defect tracking process." Review AI output against notes; correct where AI missed nuances.

Future-state process flows document how the process will work in Maintain. The delta between current-state and future-state defines the change management requirements and the training needs.

### Data Model Extraction

When a customer's data lives in spreadsheets (common), extract the implicit data model. This is one of the BA's most important skills: a well-designed spreadsheet contains a data model — it's just not labeled or normalized.

AI-native approach: photograph or export the spreadsheet structure (column names, sample data) and use Claude to propose a normalized data model. Review the proposed model with the Lifecycle Domain Expert to validate semantic correctness. Present the proposed model to the customer for validation.

Common findings from spreadsheet analysis:
- Multiple condition entries per asset in separate columns (date1, condition1, date2, condition2...) → inspection history table
- Free-text location descriptions → structured spatial data with PostGIS geometry
- Work order tracking in a separate tab with manual VLOOKUP linkage → proper relational FK
- Different people using different terminology for the same thing in free-text fields → controlled vocabulary (defect codes, asset types)

### Acceptance Criteria Development

Write acceptance criteria that are specific, testable, and domain-accurate. Acceptance criteria are the bridge between the PM's user stories and the QA Lead's test cases. Vague AC ("the system should work correctly") produces vague tests and disputes at sprint review.

AI-native AC development:
1. Start with the user story
2. Use Claude to generate 15 draft BDD scenarios (Given/When/Then) covering: happy path, validation errors, boundary conditions, permission scenarios, integration scenarios
3. Review with the Lifecycle Domain Expert for domain accuracy
4. Review with the PM for feature completeness
5. Review with the QA Lead for testability
6. Finalize the AC that becomes the sprint story's definition of done

The BA owns AC quality. If an engineer builds something that passes all the AC but doesn't actually solve the customer's problem, the AC was wrong. The BA learns from these events and improves the AC template.

### Change Management Support

A BA in a SaaS company that serves public agencies must understand that software deployment is change management. Agencies have deeply ingrained workflows. A new inspection form that is technically superior to the paper form will fail adoption if it requires inspectors to change 20-year-old habits simultaneously.

The BA produces:
- Training guides (AI-drafted, BA-reviewed): step-by-step instructions for each user role
- Transition plans: how does the agency migrate from their current process to Maintain, step by step, with a period of parallel operation
- Change impact assessments: for each significant change to agency workflow, who is affected and how significantly?

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| AC Testability Rate | > 95% of AC items are unambiguously testable | Per sprint |
| Dispute Rate at Sprint Review | < 2 "this isn't what I expected" per sprint | Per sprint |
| Requirements Completeness | < 3 undiscovered requirements per feature post-implementation | Per feature |
| Customer Onboarding Data Migration Accuracy | > 99% of migrated records match source | Per onboarding |
| BDD Scenario Coverage | > 10 scenarios per major user story (including 3+ negative scenarios) | Per story |
| Process Documentation Lag | < 1 sprint behind feature development | Ongoing |
| Training Guide Quality | < 5 customer support questions per guide (indicating confusion) | Per guide |

---

## Authority

The BA has authority to:
- Define the acceptance criteria for user stories
- Require domain expert review of AC before sprint commitment
- Request clarification from the customer before a story enters the sprint
- Document requirements in the format established by the PM/BA working agreement

The BA does not have authority to:
- Make product scope decisions (PM authority)
- Override engineering implementation choices
- Commit to customer feature delivery dates

---

## Deliverables

**Per story**: BDD acceptance criteria (Given/When/Then format), wireframe input notes (UX-ready), data model implications

**Per feature**: Current-state and future-state process flows, data model extraction report

**Per customer onboarding**: Requirements summary, data migration specification, training guides, change impact assessment

**Monthly**: Requirements backlog health (any outstanding clarifications?), process documentation currency check

---

## Decision Making

When evaluating a customer requirement:

1. **Essential vs. habitual**: Is this requirement essential to the customer's business outcome, or is it a habit from their current tool? Example: "We need the inspection form to have a signature line at the bottom" — essential (legal/compliance) or habitual (paper form convention)? Ask why; the answer changes the solution.

2. **Scope boundary check**: Does this requirement fall within Maintain's defined scope? The BA is the first filter for scope creep.

3. **Data model compatibility**: Does this requirement require changes to the canonical data model, or can it be satisfied with the existing model? Data model changes require Architect review.

4. **Testability**: Can this requirement be expressed as a testable AC? If not, it's not ready for a story.

5. **Regulatory compliance**: Does this requirement intersect with FHWA, AASHTO, or state regulatory requirements? If so, the Lifecycle Domain Expert must validate.

---

## Daily Workflow

**08:00–08:30** — Review open requirements questions and outstanding AC disputes. Prioritize resolution.

**08:30–10:00** — Customer calls and requirements sessions (typically 2–4 per week).

**10:00–11:30** — AC development: translating customer needs into testable BDD scenarios using AI-accelerated drafting.

**11:30–12:00** — Process documentation: updating BPMN flows, data model documentation.

**14:00–15:30** — Collaboration with PM: aligning on story prioritization, reviewing upcoming sprint stories for AC completeness.

**15:30–17:00** — Deep work: data migration specification, training guide drafting, change impact analysis.

---

## Collaboration

**With PM**: The BA is the PM's execution partner for requirements definition. The PM makes prioritization decisions; the BA produces the detailed specifications that make those priorities buildable.

**With Lifecycle Domain Expert**: Every domain-sensitive AC needs domain expert validation. The BA writes the AC; the domain expert checks that it reflects real-world infrastructure operations correctly.

**With QA Lead**: AC is the QA Lead's primary input for test design. The BA and QA Lead review AC together before sprint commitment; the QA Lead flags any AC items that aren't testable or that conflict.

**With Integration Strategist**: When a customer requirement involves EAM data, the BA and Integration Strategist jointly define: what data comes from the EAM, what data is entered in Maintain, and what data is reconciled between them.

**With Customers**: The BA maintains ongoing relationships with agency staff contacts for requirements clarification. These relationships are distinct from the PM's executive-level customer relationships — the BA works with the operational users who will actually use the software day-to-day.

---

## Escalation

The BA escalates to the PM when:
- A customer requirement is out of scope and the customer is pushing for it
- A requirement conflict exists between two customer stakeholders (common: the IT director wants one thing, the asset manager wants another)
- A requirement cannot be satisfied with the current product architecture

---

## Continuous Improvement

Monthly: review sprint review disputes ("this isn't what I asked for"). Each dispute is a failed AC item. Analyze what made the AC ambiguous and improve the AC template.

Quarterly: review training guide effectiveness (support ticket volume per guide). High-volume guides indicate that the onboarding documentation didn't address the actual user questions.

---

## Example Scenarios

### Scenario 1: Extracting a Data Model from a County Spreadsheet

A rural county has been tracking their 127 bridges in a master Excel workbook for 15 years. Each bridge has a row. Columns include: Bridge ID, County Route, Federal Route Number, Year Built, Material (handwritten codes: C = concrete, S = steel, T = timber), NBI Rating (9-point scale), Last Inspection Date, Inspector Name, and 12 columns labeled Condition 2010, Condition 2012, Condition 2014... through Condition 2022.

The BA photographs the spreadsheet and uses Claude to generate a proposed relational schema. Claude correctly identifies: the condition columns should become an InspectionRecord table (one row per inspection, not per bridge), the material codes need a lookup table, and Federal Route Number needs to be nullable (not all bridges are on federal routes).

The BA validates with the domain expert: the NBI Rating maps to Maintain's condition score (needs 9→100 conversion), and there are bridges with no Federal Route Number (farm-to-market roads) which is valid. The BA presents the proposed schema to the county IT director, who adds one requirement: they need to preserve the original Excel row numbers as an import reference ID for auditing.

The result is a complete data migration specification in 3 hours. Without AI, this would have taken 2 days.

### Scenario 2: Decomposing a Vague Requirement into Testable AC

The PM writes a user story: "As an asset manager, I want to see a capital needs summary so that I can report to my director." This is underspecified — what's on the summary? What format? What date range?

The BA schedules a 30-minute call with the asset manager at a reference customer. Key findings: the director wants to see the 10-year capital needs by asset class, the current year's committed budget vs. identified needs, and the top 5 unfunded critical projects. The director reviews this monthly.

The BA drafts 12 BDD scenarios using Claude as a starting point:
- Given a portfolio with 47 bridges and 12 road segments, when I view the capital needs summary for 10 years, then I see a table with rows for each asset class and columns for each fiscal year
- Given a capital plan with $3M committed in Year 1 against $4.5M in identified needs, when I view the summary, then the Year 1 commitment shows as $3M and the gap is displayed as ($1.5M)
- Given a plan with no projects in Year 6, when I view the summary, then Year 6 shows $0 for both committed and needs

Three of Claude's generated scenarios were wrong: they described behavior for a feature (export to Excel) that wasn't in scope for this story. The BA removes them and adds 3 scenarios the PM flagged: what happens when the date range spans a new fiscal year boundary, what happens when there are zero unfunded projects (the top 5 list should show a "no unfunded projects" state), and what permissions are required (read-only users should see this; editors should see it too).

### Scenario 3: Managing Scope Creep During Onboarding

During implementation for a state DOT, the agency's IT director requests that Maintain integrate with their custom Fleet Management system (a 20-year-old Oracle database) to pull equipment costs from bridge construction projects. This is not in scope.

The BA documents the request precisely, routes it to the PM, and prepares a clear explanation for the agency: this integration would require 4–6 weeks of custom development outside the current contract, it is not in the current product roadmap, and it would be scoped separately as a Statement of Work.

The BA also investigates whether there is a workaround: could the Fleet Management cost data be exported to CSV and imported into Maintain via the bulk import feature? Yes — this satisfies 80% of the need (historical cost data is importable) without custom integration work. The BA documents this as a recommended interim approach and presents it to the agency. They accept it. The scope is preserved.

---

## AI Agent Pairing

The Business Analyst pairs with a **Requirements Elicitation Agent** — a Claude Code session used for user story generation, acceptance criteria drafting, and onboarding data mapping.

**What the agent handles autonomously:**
- Converting raw interview notes and workshop outputs into structured user stories with INVEST criteria
- Drafting acceptance criteria for a given user story from a feature brief
- Mapping customer spreadsheet/database schemas to Maintain's canonical asset data model
- Generating data migration scripts (CSV → API bulk import format) from agency data exports
- Researching regulatory requirements (TAMP, GASB 34, FHWA guidance) to validate AC correctness
- Identifying missing acceptance criteria by cross-referencing the feature brief against the `vol-2-product-knowledge/domains/` specs

**What requires the human's judgment:**
- Deciding whether a customer process gap is a product feature request, a configuration need, or a training/change-management issue
- Scope boundary calls: what is in vs. out of contract for an onboarding engagement
- Resolving ambiguity in acceptance criteria where the customer has contradictory requirements
- Final approval of the user story set before sprint commitment

**Prompt guidance:** Brief the agent with the agency name, their current toolset (CMMS brand, spreadsheet formats), the business problem they are trying to solve, and a transcript or summary of the requirements interview. See `engineering-playbook/vol-9-templates/user-story-template.md` and `vol-10-claude-prompts/07-story-generation.md`.
