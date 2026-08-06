# Volume 5 — Engineering Operating Model

This volume defines **how Aurigo engineers work** — not what to build, not how to architect it, but the daily operating system that turns product requirements into shipped software. It covers every recurring process from backlog grooming through release, and the standards that make those processes consistent across teams, sprints, and years.

If Volume 1 is company context, Volume 2 is product intent, Volume 3 is architecture decisions, and Volume 4 is coding standards, then Volume 5 is the operating manual. It answers questions like: How do I ramp up on a codebase I have never seen? How do we write stories that engineers can implement without ambiguity? What does a sprint look like from Thursday planning prep to Friday retrospective? When does a code change require a formal architecture review? How do we get software out the door without breaking things?

This volume is equally useful for human engineers and AI agents. Every document is written so that a Claude Code agent reading it can execute the described process end-to-end without needing additional clarification. Where a human would ask a question, the document gives the decision rule.

---

## Documents

| # | File | What It Covers |
|---|------|----------------|
| 01 | [Repository Discovery](01-repository-discovery.md) | Step-by-step protocol for understanding any Aurigo repo from scratch — what to read, in what order, and what questions to answer before writing a line of code |
| 02 | [Architecture Discovery](02-architecture-discovery.md) | Deep protocol for understanding system architecture: ADRs, data model, request tracing, multi-tenancy pattern, constraints that cannot change without review |
| 03 | [Product Discovery](03-product-discovery.md) | How to understand product requirements before coding — priority order of truth, AC mapping, edge case identification, business rules |
| 04 | [Backlog Management](04-backlog-management.md) | Backlog structure, item types, story point scale, RICE prioritization, health rules, AI-assisted workflows |
| 05 | [Story Creation](05-story-creation.md) | Complete anatomy of an Aurigo user story, quality checklist, anti-patterns, and two fully worked example stories |
| 06 | [Sprint Planning](06-sprint-planning.md) | 2-week sprint cadence, pre-planning process, planning meeting agenda, capacity formula, carry-over policy, AI role |
| 07 | [Feature Development](07-feature-development.md) | End-to-end implementation guide from story assignment to PR merge — five phases, AI agent usage, common mistakes |
| 08 | [Architecture Reviews](08-architecture-reviews.md) | When to review, RFC process, required content, participants, what happens when review is skipped |
| 09 | [Code Reviews](09-code-reviews.md) | Review standards, complete checklist, turnaround SLA, feedback labeling, AI-assisted first pass |
| 10 | [Testing](10-testing.md) | Testing operating model, coverage requirements, test data strategy, flaky test policy, worked examples |
| 11 | [Documentation](11-documentation.md) | Documentation as shipped code — required docs by change type, AI-assisted authoring, anti-patterns |
| 12 | [Release Management](12-release-management.md) | Release cadence, deploy window rules, go/no-go criteria, hotfix process, version numbering |
| 13 | [Technical Debt](13-technical-debt.md) | Debt categories, tracking, monthly review, 20% capacity rule, prioritization formula |
| 14 | [Continuous Improvement](14-continuous-improvement.md) | Retrospective process, metrics reviewed, learning programs, the AI improvement loop |
| 15 | [Knowledge Management](15-knowledge-management.md) | Six-layer knowledge architecture, transfer protocol for new engineers, capture protocol, anti-patterns |
| 16 | [Incident Management](16-incident-management.md) | P0–P3 severity, triage, escalation matrix, communication templates, blameless postmortems, on-call rotation, security incident response |

---

## How to Use This Volume

**New engineer onboarding**: Start with document 01 (repository discovery) and 02 (architecture discovery). Then read 05 (story creation) and 07 (feature development) before picking up your first story.

**AI agent orientation**: Documents 01 and 02 contain explicit automated discovery prompts. Run those before any implementation work. Documents 07 and 09 define the implementation and review standards an agent must follow.

**Process questions**: Use the table above to find the relevant document. Each document is self-contained and cross-references others where needed.

**New team members or leads**: Read all 15 documents in order. This is the complete picture of how Aurigo engineering operates.

---

## Relationship to Other Volumes

This volume depends on and references:
- **Volume 1** (Company and Product Context): business domain, personas, modules
- **Volume 2** (Product Requirements): story format, acceptance criteria standards
- **Volume 3** (Architecture): ADR process, constraint catalog, architectural decisions
- **Volume 4** (Coding Standards): language conventions, patterns, review checklist inputs

Changes to any other volume may require updates to this one. The Operating Model is reviewed quarterly at the architecture summit (see document 14).
