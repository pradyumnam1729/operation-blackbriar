# 08 — Core Values

---

## How to Read This Document

Core values are only useful if they are operational — that is, if they change what engineers do when they face a choice. Slogans on a wall do not change behavior. Concrete descriptions of what good looks like, what bad looks like, and why the distinction matters: those change behavior.

Each value below is written with three components: the statement (what we believe), the rationale (why we believe it), and behavioral examples (what this looks like in practice). The anti-patterns are as important as the positive examples — they describe the drift patterns that undermine culture over time.

---

## Value 1: Domain Depth Over Feature Breadth

**Statement:** We understand infrastructure better than anyone building software for it. One deeply correct feature beats five shallow ones.

**Rationale:** Infrastructure is a domain with enormous hidden complexity. Federal-aid highway funding rules have dozens of edge cases. Bridge inspection methodologies have regulatory requirements that differ by bridge type, ownership category, and state. Pharmaceutical equipment qualification has FDA-specific documentation formats. A developer who builds a feature without understanding the domain will build something that is technically correct but operationally wrong — and the customer will not adopt it, or worse, will adopt it and get wrong answers.

The alternative to domain depth is feature breadth: shipping many features quickly that each partially address a use case. This approach maximizes demo appeal but minimizes real-world value. A capital needs report that does not account for federal funding eligibility windows is worse than no capital needs report — it generates plans that cannot be executed.

**What good looks like:**
- Before implementing a new TAMP feature, reading the FHWA TAMP Policy (1901.D) and understanding the specific data elements required for regulatory compliance
- Before implementing a bridge condition scoring algorithm, understanding the NBI item ratings (Item 58, 59, 60, 61, 62) and how they aggregate to the sufficiency rating
- Before building a capital optimization algorithm, understanding that agencies have obligation deadlines and cannot simply defer all spending to the last year of the planning period
- Asking customers "what does this workflow look like in practice?" before designing the software that supports it

**What bad looks like:**
- Implementing a "condition score" field without understanding what rating scale the customer is using (PASER, NBI, PCI, IRI, custom) and whether the output is meaningful
- Building a "TAMP report" that exports data in a format that does not match the FHWA submission portal
- Designing a work order integration that does not account for the difference between a preventive maintenance work order and a corrective maintenance work order (they have different meaning for the deterioration model)
- Shipping features that look good in a demo but require significant customer customization to be useful in production

---

## Value 2: Lifecycle Thinking

**Statement:** Every decision considers where this data was born (Plan), where it lived (Build), and where it needs to go (Maintain).

**Rationale:** Aurigo's core competitive advantage is lifecycle continuity. Every engineering decision either strengthens or weakens that continuity. When a developer adds a new field to the Asset entity, they should consider: where was this data first known? (In the design drawings in Build? In the condition inspection in Maintain? In the project prioritization in Plan?) If this data was first known in Build, it should be populated from the Build closeout, not entered manually in Maintain. If it was first known in Plan, it should flow through to Build and Maintain automatically.

Lifecycle thinking is not just about data flow. It is about designing features so that the full lifecycle value is realized, not just the value in the current phase.

**What good looks like:**
- When designing the asset creation workflow, considering whether the asset record could be pre-populated from a project in Masterworks Build, even if the customer has not yet adopted Build
- When adding a new condition rating field, designing the API so that it can be populated from an EAM system (for Integrated mode customers), from a field inspection (for Native mode), or from a Build closeout (for Plan/Build/Maintain customers)
- When implementing a capital needs report, ensuring that the funded projects in Plan are automatically excluded from the unfunded needs list so the report does not double-count
- Considering the Maintain impact before removing or renaming a field in Build's project closeout data model

**What bad looks like:**
- Adding a field to the Asset entity without a migration path for customers who have data in other systems
- Building the TAMP module using hardcoded assumptions about data that should be configurable per customer (because different states use different condition rating scales)
- Designing the Build closeout workflow without involving the Maintain team in defining what data must be captured at closeout for Maintain to function correctly

---

## Value 3: Integration First

**Statement:** We make existing systems smarter before we replace them. Our customers' teams know their systems. We respect that.

**Rationale:** Every customer comes to Aurigo with existing tools, existing workflows, and existing data. The temptation in product development is to build everything natively and ask customers to migrate. This is the wrong instinct. A migration that takes 18 months destroys the goodwill that the integration-first approach builds in 90 days. Integration first is not a temporary compromise on the path to native. It is a permanent commitment to meeting customers where they are.

Practically, this means every feature in Maintain should have an answer to the question: how does this work for a customer whose source-of-truth is IBM Maximo? How does this work for a customer running Cityworks? The answer cannot be "they have to re-enter the data."

**What good looks like:**
- Designing the inspection domain so that inspection records can come from three sources: Maintain's own mobile app, an EAM work order (via integration), or a bulk import (for customers migrating historical data)
- Building the asset registry so that the tenant can configure which fields are mastered in the EAM and synchronized read-only, vs. which fields are mastered in Maintain
- When adding a new condition index type, checking whether it maps to a standard format used by Maximo or Cityworks and building the mapping automatically
- Testing every new API against the Maximo and Cityworks integration stubs before releasing to production

**What bad looks like:**
- Building a feature that only works for customers using Maintain's native work order module, without considering how it behaves for customers whose work orders live in Maximo
- Designing an import format that requires customers to manually reformat their data to match Aurigo's schema
- Breaking the EAM integration API in a feature release without notifying customers or providing a migration guide

---

## Value 4: AI Amplification

**Statement:** AI is not a feature. It is how we work. Every engineer pairs with AI. Every workflow is AI-assisted.

**Rationale:** The most efficient engineering organization is not the one with the most engineers. It is the one that best amplifies the capability of each engineer. AI pair programming, AI-assisted code review, AI-generated test cases, AI-accelerated documentation — these are not shortcuts. They are the new professional standard for software engineers in 2024 and beyond. Aurigo adopted this standard early. Engineers who develop effective AI collaboration skills now will be the most productive, most valuable engineers in the market over the next decade.

Within the product, AI amplifies every phase: deterioration prediction, capital optimization, TAMP narrative generation, natural language query. These capabilities are not marketing features — they are the reason the product exists. An infrastructure asset management platform without AI is a database. With AI, it is a decision-support system.

**What good looks like:**
- Using Claude Code to draft the initial implementation of a new feature, then reviewing, testing, and refining the output
- Asking AI to generate test cases for a calculation engine, then reviewing the test cases for domain correctness
- Using AI to generate the first draft of an ADR (Architectural Decision Record) when making a significant technical choice
- In the product: every AI recommendation includes the data and model assumptions behind it (explainability is non-negotiable)
- Building AI features that improve over time as more data accumulates (not one-time inference, but continuous learning)

**What bad looks like:**
- Treating AI-generated code as correct without review — AI generates plausible code, not necessarily correct code
- Building AI features that produce recommendations without explaining them (the capital planner who gets a ranked list of projects without understanding why project A beats project B will not trust the tool)
- Ignoring AI assistance on "important" work (the assumption that AI assistance is for simple tasks, not complex ones, is backwards — AI provides more value when the complexity is higher)

---

## Value 5: Trust Through Transparency

**Statement:** Infrastructure owners are stewards of public funds and private capital. We earn trust by being auditable, explainable, and honest about what our AI can and cannot do.

**Rationale:** A capital planner who uses Aurigo's AI recommendations to justify a $50 million bridge replacement program to a state legislature needs to be able to explain every number. The deterioration model needs to be explainable. The confidence interval needs to be shown. The assumptions need to be documented. If Aurigo cannot provide this transparency, the capital planner cannot use the tool for high-stakes decisions — and the high-stakes decisions are where Aurigo's value is highest.

This applies equally to engineering decisions. Every significant architectural choice should be documented in an ADR. Every data model change should have a migration that preserves existing data. Every breaking API change should be communicated with sufficient notice for customers to adapt.

**What good looks like:**
- Every AI recommendation in the product includes a "why" explanation: which deterioration model was used, what inspection data was input, what confidence level the model has
- Migration scripts that are fully reversible (or that explicitly document what is irreversible and why)
- API versioning that allows customers to stay on v1 while v2 is deployed
- When Aurigo's AI model has low confidence (sparse inspection history, unusual asset type), displaying the low confidence prominently rather than suppressing it
- Communicating honestly with customers about known data quality limitations in their own datasets

**What bad looks like:**
- A "condition score" that is computed from incomplete data without indicating that the score is an estimate
- An AI recommendation that references a deterioration model but does not tell the user which model, what parameters, or what input data
- Removing a feature or API endpoint without adequate customer notice
- Hiding error states in the UI rather than surfacing them clearly

---

## Value 6: Institutional Knowledge Over Chat History

**Statement:** Knowledge lives in documents, decisions, and code. Not in conversation logs that disappear.

**Rationale:** Software organizations routinely make the same mistakes twice — not because engineers are not smart, but because the decision-making context is stored in ephemeral places (email threads, Slack conversations, meeting notes on personal drives) rather than in the repository where code lives. When an engineer six months later asks "why did we design it this way," the answer should be in an ADR in the repository, not "I think someone made that decision in a Slack conversation last spring."

Aurigo's AI agents (Claude Code instances with defined roles) persist their context in memory documents that survive across sessions. This is the model for how human engineers should treat knowledge: captured, structured, searchable, and connected to the code that implements it.

**What good looks like:**
- Writing an ADR before making a significant architectural choice (not after, when the decision is already baked in)
- Updating the CLAUDE.md and vault/ documents when a domain decision is made that engineers will encounter later
- Writing code with comments that explain why the approach was chosen (not what the code does — that is obvious from the code — but why this approach was chosen over the alternatives)
- When a bug is found in a calculation engine, writing a test that captures the case before fixing it, so the fix is permanently documented in the test suite
- Post-mortems that result in documented process changes, not just verbal commitments

**What bad looks like:**
- Making a significant technology choice (switching ORMs, changing API design pattern) without writing an ADR
- Merging code that changes behavior without updating the relevant documentation
- Verbal architecture decisions in meetings that are never written down
- Relying on "the team knows" as a substitute for written documentation

---

## Value 7: Quality as a Competitive Advantage

**Statement:** A wrong capital recommendation costs millions. We ship carefully.

**Rationale:** Aurigo's products make recommendations that affect multi-million and multi-billion dollar capital investment decisions. A pavement deterioration model that is wrong by 10 percent means the state DOT funds the wrong projects at the wrong time — and the error does not surface for years, when actual pavement conditions diverge from the model's predictions. By then, the damage to both the infrastructure and to Aurigo's reputation is done.

Quality in this context is not just "no bugs in the UI." It is: the calculation engines produce correct results, the AI models have calibrated confidence, the integration layer does not corrupt or lose data, and the security model does not leak data across tenants. These are correctness requirements that require test coverage, domain review, and production monitoring to maintain.

**What good looks like:**
- Calculation engine code with 90+ percent test coverage, including edge cases documented from domain knowledge (zero inspections, missing fields, conditions at the rating scale boundary)
- Integration tests that verify data flows correctly through the full stack — from API input to database to API output
- Performance tests that verify query times at production-scale data volumes (100,000+ assets, 1,000,000+ inspection records)
- Load testing before shipping features that will be used by large state DOT customers
- A definition of done that includes documentation, test coverage, and peer review — not just "the feature works in dev"

**What bad looks like:**
- Shipping a calculation engine change without updating the tests
- Disabling a failing test to make the build pass
- "It works on my machine" as a reason to skip integration testing
- Accepting "good enough" when the domain requires "correct" — a condition score rounded to the nearest integer when the deterioration model requires two decimal places of precision changes the year-of-replacement calculation

---

## How Values Are Operationalized

Values that only appear in a slide deck are decoration. Aurigo values enter three specific workflows:

### 1. Hiring — Values-Based Interview

Every candidate above IC3 (senior engineer) goes through a dedicated values interview in addition to technical. Each value has a paired behavioral question:

| Value | Question |
|-------|----------|
| Domain Depth | "Tell me about a time you shipped a feature after discovering a domain rule you had missed. What did you learn?" |
| Lifecycle Thinking | "Describe the most complex data-flow decision you have made. Where did the data originate and where did it end up?" |
| Integration First | "Describe a time you chose to integrate rather than replace an existing customer system. Why?" |
| AI Amplification | "Walk me through your AI-assisted workflow on a recent non-trivial feature. What did AI accelerate? Where did you override it?" |
| Trust Through Transparency | "Tell me about a time you had to explain a wrong output your code produced to a stakeholder. How did you handle it?" |
| Institutional Knowledge | "Show me an ADR or written decision doc you have authored. Walk me through the alternatives you considered." |
| Quality as Competitive Advantage | "Describe a bug that shipped to production that could have been prevented. What changed in your process?" |

Scoring rubric per question: 1 (contradicts the value) → 5 (exemplifies the value). Candidate must score ≥ 3 on every value, ≥ 4 on at least four. A candidate with excellent technical skills but a values gap on more than one dimension is a **no-hire** at senior+ levels.

### 2. Performance Reviews — Values-Weighted

Every performance review has two scores:
- **Impact score** (0–5): What did the engineer ship? What did it move?
- **Values score** (0–5): How did they exhibit the values in doing so?

Total compensation adjustment is a function of both. An engineer who ships heroic amounts of code but violates values (e.g., writes zero tests, hides decisions, treats AI outputs as unreviewed truth) receives **zero** merit increase, even with a 5 on Impact. This rule is enforced by the CTO on all comp decisions above IC3.

Values scores are moderated by peer review — the engineer nominates 3 peers who worked with them in the review period; those peers rate them on the value dimensions.

### 3. Product & Roadmap Decisions — Values as Filters

At every major product review (RFC, spec, PR requesting significant scope), the reviewer explicitly checks the proposal against the values:

| Value | Question the reviewer asks |
|-------|----------------------------|
| Domain Depth | "Which regulation, standard, or customer workflow does this reflect?" |
| Lifecycle Thinking | "Where is this data born? Where does it flow?" |
| Integration First | "How does this behave for a Maximo customer? For a Cityworks customer?" |
| AI Amplification | "Is this AI-enhanced? If not, is there a reason?" |
| Trust Through Transparency | "Is the output explainable? Is confidence surfaced?" |
| Institutional Knowledge | "Is the decision documented in an ADR? Is CLAUDE.md updated?" |
| Quality as Competitive Advantage | "What is the test coverage plan? What are the domain edge cases?" |

An RFC that cannot answer these questions is sent back for revision. This has happened to the CTO's own proposals — the rule is not for junior engineers alone.

### 4. Firing — Values-Based Termination

Two documented values violations (with warnings) within a rolling 6-month window is grounds for termination regardless of technical output. Repeated failures include:

- Committing code with hidden decisions (no ADR, no comment on why)
- Shipping AI-generated code without review
- Ignoring domain feedback from customer success or subject-matter experts
- Suppressing error states in the UI to make demos look better
- Silently downgrading test coverage on Calculations code

The people team maintains the audit trail. This is not a threat; it is a bright-line commitment to the culture we are building.

---

## Values Conflict Resolution

Sometimes values pull in opposite directions. Explicit tie-breakers:

| Tension | Tiebreaker |
|---------|-----------|
| Domain depth vs. shipping velocity | Domain depth wins if the feature affects capital or compliance outputs; velocity wins for internal tooling and UI-only work. |
| Integration first vs. UX quality | Integration first wins for enterprise customers; UX wins where it does not create data loss. |
| AI amplification vs. Quality | Quality wins. AI proposes; humans verify. |
| Institutional knowledge vs. speed to first prototype | Speed wins for the throwaway spike; knowledge wins the moment a spike becomes durable. |
| Transparency vs. simplicity of UI | Transparency wins for any decision-support surface. Never hide a confidence interval to make a graph prettier. |

---

*Next: [09 — Engineering Culture](09-engineering-culture.md)*
