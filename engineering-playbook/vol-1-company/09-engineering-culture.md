# 09 — Engineering Culture

---

## Overview

Culture is not what a company says it values — it is what the company does when values are expensive. When there is pressure to ship fast and the tests are not written, does the team write the tests or skip them? When there is ambiguity about an architecture decision and an ADR would take an hour to write, does the team write it? When AI assistance is available but using it requires trust and practice, does the team invest in developing that skill?

This document describes engineering culture at Aurigo as it exists and as it should exist. It is both descriptive (how we work) and prescriptive (how we want to work). When there is a gap between the two, the document describes the goal, not just the current state.

---

## The AI-Native Collaboration Model

Aurigo operates as an AI-native engineering organization. This is not a statement about using AI tools. It is a statement about how work is organized.

In a traditional engineering organization, the unit of work is the human engineer: one engineer, one ticket, one pull request. In Aurigo's AI-native model, the unit of work is the engineer-agent pair: one engineer, one AI agent, one objective. The agent handles the mechanical aspects of the work — generating boilerplate, writing initial implementations, producing test cases, drafting documentation. The engineer handles the judgment aspects: does this implementation match the domain requirements? Are the tests testing the right things? Does this documentation accurately reflect the intent?

This is not a junior/senior dynamic. The AI agent is not "doing the easy stuff" while the engineer does "the real work." The AI agent is doing expensive mechanical work efficiently, freeing the engineer to spend more time on the judgment calls that only a human who understands the domain can make.

**The agent role structure at Aurigo is explicit:**
- Engineering Manager Agent: coordinates multi-agent work, makes tradeoff decisions, escalates to human
- PM/Quality Guardian Agent: reviews features against product requirements, catches scope drift
- Architect Agent: reviews architecture decisions, maintains consistency with ADRs
- Backend Lead Agent: owns .NET/EF Core/PostGIS implementation standards
- Frontend Lead Agent: owns React/TypeScript/Tailwind standards
- Domain Expert Agent: provides infrastructure domain knowledge to other agents

**Every engineer is expected to:**
- Pair with AI on all feature development, test writing, and documentation
- Review AI output with domain knowledge that the AI does not have
- Provide feedback to improve agent memory and context documents
- Never ship AI-generated code that the engineer cannot explain and defend

---

## Asynchronous-First Communication

Aurigo's engineering team is distributed. Asynchronous communication — written, deliberate, searchable — is the primary medium.

**What this means in practice:**

Design decisions are made in ADRs, not in real-time meetings. When a significant technical choice needs to be made, the engineer who is thinking about it writes a draft ADR: the problem, the options considered, the decision, and the consequences. That ADR is shared for async comment before a decision is made. The conversation happens in writing, in the repository, where it can be found three years later.

Feature requirements are documented before implementation starts. Not after, when documentation is an afterthought. The relevant product requirement or user story is linked from the pull request description. The implementation decision (how the requirement is met technically) is explained in the PR description. Reviewers should be able to understand both the what and the why from the PR alone.

Status updates are written, not spoken. Sprint progress is tracked in the task management system (not reconstructed from memory in a standup meeting). Blockers are documented when they arise, not when the scheduled standup occurs.

**What asynchronous-first does not mean:**
It does not mean no meetings. Pairing sessions, design reviews, incident response — these are cases where synchronous communication is more efficient. The principle is: don't hold a meeting when a document would serve the same purpose better.

---

## Code Review Culture

Code review at Aurigo is educational and collaborative, not gatekeeping. The purpose of a code review is:
1. To catch correctness errors (logic bugs, domain errors, security issues, performance problems)
2. To share knowledge (the reviewer learns something about the domain or technology; the author learns something from the reviewer's perspective)
3. To maintain code quality standards (consistency with the existing codebase, test coverage, documentation)

It is not the purpose of code review to demonstrate that the reviewer is smarter than the author, to introduce personal style preferences as requirements, or to block shipping because of minor issues that do not affect correctness or quality.

**Review standards:**

Every pull request requires at least one approving review from a team member who understands the domain being changed. A backend engineer approving a calculation engine change must have read the relevant calculation specification (in vault/calculations/). A frontend engineer approving a map interaction change must have tested the change with the Mapbox GL JS layer configuration.

**Review comments are categorized:**
- **Blocking:** Must be resolved before merge. Correctness errors, missing tests for critical paths, security issues, broken migrations.
- **Suggested:** Should be addressed if possible, but may be deferred. Code clarity improvements, minor performance issues.
- **Non-blocking:** Observations or questions. No action required.

Authors are expected to respond to all comments, even if the response is "I'll address this in a follow-up PR" with a ticket created. Ignoring review comments is not acceptable.

**The 24-hour rule:** Pull requests should receive at least one review within 24 business hours. Reviewers who cannot review within that window should communicate so the author can request another reviewer. Blocking PRs for more than 48 hours without communication degrades the team's delivery velocity.

---

## Blameless Post-Mortems

When something goes wrong in production — a data quality incident, a failed deployment, a calculation error discovered by a customer — Aurigo conducts a blameless post-mortem within 72 hours of resolution.

"Blameless" means exactly that. The post-mortem is not an opportunity to assign fault to an individual. It is an opportunity to understand the system failure: what conditions allowed this to happen, what signals were present that were missed, and what changes to the system (code, process, monitoring, documentation) would prevent it from happening again.

**Post-mortem structure:**
1. **Timeline:** A factual, minute-by-minute reconstruction of the incident from first detection to full resolution
2. **Root cause analysis:** The systemic cause (not "developer error" — that is never the root cause; the root cause is the condition that allowed developer error to have production impact)
3. **Contributing factors:** What made the root cause possible? Lack of test coverage? Insufficient monitoring? Unclear documentation? Insufficient review?
4. **Action items:** Concrete, assignable changes to code, tests, monitoring, or process that address the contributing factors. Every action item has an owner and a deadline.
5. **Metrics:** Time to detection, time to resolution, customer impact (how many customers, what severity, what data was affected)

Post-mortems are published internally on a shared knowledge base, not buried in a ticket comment. The pattern of post-mortems over time is the most valuable signal for where the engineering process has systemic weaknesses.

---

## Documentation as a First-Class Engineering Artifact

Documentation at Aurigo is not an afterthought. It is a deliverable, with the same status as working code and passing tests.

**The definition of done for any feature includes:**
- Technical documentation updated (or created) if the feature introduces new concepts, new API endpoints, or new configuration options
- ADR written if the feature required a significant architectural decision
- Vault/ notes updated if the feature touches calculation logic, domain rules, or product decisions that are documented there
- CLAUDE.md updated if the feature changes the developer setup or conventions
- API changelog entry if the API surface changes (new endpoints, changed request/response shapes, new error codes)

**The types of documentation Aurigo maintains:**

*Code-level:* XML documentation comments on all public methods in the API and Application layers. Not just "what this does" but "why it exists and what the caller is expected to know."

*Architecture-level:* ADRs in the `vault/decisions/` directory. These are permanent records of why the system is designed the way it is. They are not updated retroactively (a decision that was made cannot be un-made; a new decision gets a new ADR).

*Domain-level:* The `vault/calculations/` notes explain the calculation methodology behind every formula in the codebase. Before implementing or changing a calculation, read the relevant note. After changing a calculation, update the note.

*Product-level:* The Engineering Playbook (this document) provides the context that makes individual decisions coherent. It should be treated as living documentation: updated when the company strategy evolves, the market understanding changes, or a new competitive dynamic emerges.

---

## Onboarding: How New Engineers Join

Onboarding at Aurigo follows a deliberate three-level discovery process. New engineers are not handed a ticket and told to get started. They are given structured time to understand the system they are joining at three levels: repository, architecture, and product.

**Week 1 — Repository Discovery:**
- Set up the development environment using the CLAUDE.md instructions
- Read the full CLAUDE.md and the Engineering Playbook (this volume)
- Run the seed data loader and explore the application
- Identify five things that seem strange or unclear; document them as questions to discuss with a senior engineer

**Weeks 2-3 — Architecture Discovery:**
- Read the `vault/` notes for all existing modules
- Walk through the database schema with the Backend Lead
- Run the test suite; understand what is covered and what is not
- Map the dependency graph: which projects depend on which, which external services are called, where the integration boundaries are
- Pair with the Backend Lead on one small feature or bug fix

**Weeks 3-4 — Product Discovery:**
- Sit in on a customer demo (or watch a recording)
- Read the market analysis (this Playbook, Volume 1)
- Read the product specifications for the module they will be working on (Volume 2)
- Understand the customer persona they are building for (Document 05 — Customers)
- Pair with the Frontend Lead on one UI feature to understand the product end-to-end

**The test of successful onboarding:** A new engineer who can, after four weeks, answer the question "why does this feature exist and who uses it?" for the code they have worked on, and who can answer "where should this code go?" for a new feature they are asked to implement.

---

## The Domain Knowledge Expectation

Every engineer at Aurigo is expected to develop working knowledge of the infrastructure domain they are building for. "Working knowledge" means:

- Understanding the personas (who uses this? what problem are they solving?)
- Understanding the terminology (NBI, TAMP, NBIS, PCI, PASER, RUL, ARV, OEE — these are not jargon to be avoided; they are the language of the domain)
- Understanding the regulatory context (why does TAMP have the data requirements it has? what is the regulatory consequence of getting it wrong?)
- Understanding the business consequences of errors (a wrong deterioration model is not a bug; it is a capital planning error that affects multi-million dollar decisions)

This domain knowledge is not taught in a one-day training session. It is built over months of reading vault/ notes, attending customer conversations, reviewing customer data, and asking questions of colleagues who have been in the domain longer.

The expectation is not expertise. It is engagement. An engineer who has worked on the capital needs calculation for six months should be able to explain to a technical manager why Weibull deterioration differs from linear deterioration and why that difference matters for the 10-year capital plan output. An engineer who says "I just implement what the spec says" is not meeting the domain knowledge expectation.

---

## Anti-Patterns

These are the behaviors that most commonly undermine engineering culture at Aurigo. They are listed explicitly because they occur, not because they are hypothetical risks.

**Shipping without documentation.** A feature that works but is not documented creates two problems: the next engineer who touches it cannot understand it, and the customer cannot configure or use it effectively. Documentation is not a "nice to have" after the feature ships. It is part of the feature.

**Architecture decisions made informally.** "We decided in the meeting that we would use X" is not an architecture decision — it is a verbal commitment that half the team was not in the meeting for and that will not be findable in six months. Significant decisions get ADRs.

**Writing code that only an expert understands.** Code that requires knowing a specific implementation detail to understand is technical debt even if it works correctly. Every piece of code will eventually be read by someone who does not know the context. Write for that person.

**Treating failing tests as acceptable.** A test suite with known failing tests is a trust problem. If the team accepts failing tests, the signal-to-noise ratio of the test suite degrades and the suite stops being useful as a quality gate. Failing tests are fixed immediately or removed (with documentation of why the test case is no longer valid).

**Building for the demo, not for production.** Features that look great in a controlled demo but require specific data conditions to work correctly, or that degrade at scale, or that have no error handling — these are a form of technical debt that creates customer disappointment and requires rework.

**Ignoring the integration layer.** Aurigo's value depends heavily on integrations with EAM systems. Features built without testing against the integration stubs are built in isolation and may fail for the majority of customers (who are in Integrated or Hybrid mode). Every feature that touches shared data must be tested against integration scenarios.

---

## When Culture Meets Deadline Pressure

The moment values are tested is the moment a deadline is at risk. Aurigo's operating rule under pressure:

1. **Domain-critical code (Calculations, Domain layer, Security, Data model)** — **never** compromises on quality gates. If it will not ship correctly, we ship less scope. Cutting scope is normal; cutting quality is disqualifying.
2. **User-facing polish (UI, UX, marketing surfaces)** — ships with known limitations if the customer can work around them and the limitation is documented.
3. **Internal tooling** — ships with the minimum viable spec.
4. **When a deadline requires cutting a test to ship** — the deadline is renegotiated with the accountable executive before the code merges. This escalation is not optional.

Every engineer has the authority — and the obligation — to say "no" to a deadline that requires cutting corners on Category 1 work. The CTO backstops this authority in every case. An engineer who was overruled and then had to ship broken code has the CTO's private cell number and the standing invitation to escalate.

**The blame rule under pressure:** if a team ships broken code because "the deadline was firm," accountability rests with the executive who set the deadline, not the engineer who shipped. Post-mortems name the systemic pressure, not the individual.

---

## Maintaining Culture at Scale

At 380 engineers today, culture is transmitted by repetition and by example. As Aurigo grows past 500 engineers, culture drift is inevitable unless explicitly countered.

### Scale mechanics

- **Onboarding cohort model.** Every new engineer joins a cohort of 4–8 that goes through the 4-week discovery together. Cohorts have a dedicated senior engineer as culture guide.
- **Values re-anchoring quarterly.** Every quarter, every team spends one hour reviewing a values scenario together — a real anonymized incident from the last quarter — and discussing whether we lived the values.
- **Engineering brown-bags weekly.** Every Thursday at 12:00 PT, one engineer presents a domain deep-dive, a post-mortem, or an ADR walkthrough. Attendance is optional; recordings are mandatory. The library of brown-bag recordings is a first-class knowledge asset.
- **Manager promotions require a values reference.** Any promotion to Engineering Manager or above requires 3 written peer references specifically addressing values. HR maintains the template and reviews.
- **CTO reviews all ADRs authored above L4** for pattern-matching on values drift.

### Culture Failure Modes (5)

The specific ways engineering culture at Aurigo breaks down, and the early warning signs.

**Failure Mode 1 — "The Hero Culture."**
An informal norm develops that certain engineers (the "heroes") ship faster by skipping quality gates, and this is celebrated. The organization starts to believe that speed = skipping process.
- *Early signals:* Same 3–5 engineers on the top of the ship-metrics leaderboard for 3+ months; disproportionate share of hotfixes; peer complaints about "cleaning up after."
- *Correction:* CTO publishes a "how heroes actually work" post naming the values-aligned high performers and quantifying their test coverage, PR review quality, and post-mortem contributions. Compensation adjusts to weight against hero-style behavior.

**Failure Mode 2 — "The Silent PR."**
PRs get approved by managers who did not read them because the queue is too long. Reviews become rubber-stamps.
- *Early signals:* Time-to-first-review drops below 30 minutes; approval rate hits 98%+ on senior reviewers; incident count for "not-caught-in-review" bugs rises.
- *Correction:* Reintroduce mandatory peer-of-domain review; publish weekly a "reviewer of the week" recognizing depth of review. Break up unrealistically wide review responsibilities.

**Failure Mode 3 — "The Documentation Backlog."**
Documentation slips to "we'll write it after we ship." It never gets written. New engineers can't onboard.
- *Early signals:* Documentation debt ticket count grows month-over-month; onboarding time-to-first-PR climbs above 3 weeks; internal docs search returns "not found" more than 20% of the time.
- *Correction:* Institute the "no doc, no merge" rule for new features. Dedicate 10% of engineering capacity to documentation debt for the next quarter.

**Failure Mode 4 — "The AI Rubber-Stamp."**
Engineers start pasting AI output into PRs without meaningful review. Test coverage numbers rise but tests test the wrong things.
- *Early signals:* Test files where the tests are all trivial (`Assert.NotNull(x)`); PR descriptions that read like AI outputs; specific bug patterns that a human review would have caught but didn't.
- *Correction:* Add "AI review verification" checklist to PR template. Random-sample PRs for AI-review quality audit. Rescore engineers on values interview criterion "AI Amplification."

**Failure Mode 5 — "The Domain Vacuum."**
As engineers get more senior, they get pulled into architecture, and the day-to-day domain expertise dilutes. Junior engineers ship features without domain input.
- *Early signals:* Increase in customer bug reports categorized as "domain misunderstanding" not "code bug"; declining vault/ note activity; senior engineer calendar shows zero customer interaction for 30+ days.
- *Correction:* Every engineer above L4 is required to attend one customer call per month. Domain-expert agents (in the AI stack) are refreshed monthly with input from senior engineers.

---

## Cultural KPIs

Culture, like everything else, is measured. The monthly culture health scorecard tracks:

| KPI | Target | Owner |
|-----|--------|-------|
| PR review time-to-first-comment (median) | ≤ 8 business hours | CTO |
| ADRs authored per month | ≥ 1 per team | Engineering Managers |
| Documentation debt ticket age (P95) | < 60 days | Head of Engineering |
| Post-mortem action item completion rate | ≥ 90% within committed timeline | Head of SRE |
| eNPS (engineering) | ≥ 50 | CTO + CHRO |
| Onboarding time-to-first-merged-PR | ≤ 10 business days | Engineering Managers |
| Values reference score in perf reviews | Median ≥ 4/5 | CHRO |

Any KPI red for two consecutive months is on the CTO's monthly dashboard.

---

*Next: [10 — AI Strategy](10-ai-strategy.md)*
