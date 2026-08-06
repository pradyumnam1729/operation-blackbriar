# Aurigo Engineering Playbook

This playbook is the operating system of Aurigo's engineering organization. It documents how we work: our company context, product knowledge, architecture standards, operating model, integration strategy, templates, and AI tooling. If a decision was made but not documented here, it does not exist for the next engineer or AI agent.

---

## Why This Exists

Software teams accumulate three kinds of knowledge: the kind in code, the kind in people's heads, and the kind that is documented. The first kind is queryable but not always legible. The second kind walks out the door. The third kind scales.

This playbook is the third kind. It is written for permanence, not for a specific sprint. It answers the questions that slow engineers down: What does Aurigo actually build? Who are our users? What architectural decisions have we locked in and why? How do we review code? What does a good user story look like? How do I use AI effectively on this codebase?

The intended readers are:
1. Engineers joining the team
2. AI agents (Claude Code, subagents) starting a new session
3. Product managers and engineering leaders needing a shared reference
4. Anyone who has been away and needs to re-orient quickly

---

## How to Use This Playbook

### If you are a new engineer

Read in this order:

1. **Vol 1 — Company Context** — understand what Aurigo builds, who we serve, and how Maintain fits the portfolio
2. **Vol 2 — Product Knowledge** — understand the domain, personas, and what problems we are solving
3. **Vol 6 — Integration Strategy** — understand how Maintain integrates with EAM systems (this shapes architecture decisions)
4. **Vol 5 — Operating Model** — understand how the team works: ceremonies, code review standards, definition of done
5. **Vol 9 — Templates** — bookmark this; you will use it every sprint
6. **Vol 10 — Claude Prompts** — set up your AI tooling before writing your first line of code

Plan for 3-4 hours to read the playbook in full. It will save you many more hours of confusion later.

### If you are an AI agent

Start with this file to understand the structure, then read:

1. The project-level `CLAUDE.md` (at `asset_maintenance/CLAUDE.md`) for codebase conventions and build commands
2. `vol-2-product-knowledge/` for domain vocabulary and personas
3. `vol-9-templates/` for the templates you will use when generating stories, ADRs, or guides
4. `vol-10-claude-prompts/` for task-specific prompts that encode Aurigo's standards into your instructions

When starting a new session, run the Repository Discovery prompt from `vol-10-claude-prompts/01-repository-discovery.md` before any other work.

### If you are a product manager

You need:
- **Vol 1 — Company Context** — the market, the buyers, the product portfolio
- **Vol 2 — Product Knowledge** — the personas, jobs to be done, domain vocabulary
- **Vol 9 — Templates** — the user story template and acceptance criteria format
- **Vol 10 — Claude Prompts** — the backlog generation, sprint planning, and product review prompts

You do not need to read the architecture volumes unless you are involved in technical scope discussions.

### If you are an engineering leader

You need the full playbook, with emphasis on:
- **Vol 5 — Operating Model** — ceremonies, team agreements, code review standards, definition of done
- **Vol 6 — Integration Strategy** — the EAM integration model that shapes product positioning
- **Vol 9 — Templates** — ADR format and when to add new decisions
- **Vol 10 — Claude Prompts** — how AI tooling is embedded in the engineering workflow

---

## Volume Index

| # | Folder | Title | Description |
|---|--------|-------|-------------|
| 1 | `vol-1-company/` | Company Context | Who Aurigo is, what we build, the Plan-Build-Maintain lifecycle, and how Maintain fits the Masterworks and Primus product lines |
| 2 | `vol-2-product-knowledge/` | Product Knowledge | Domain entities, user personas and jobs to be done, feature modules, and acceptance vocabulary for Masterworks and Primus Maintain |
| 3 | *(not yet written)* | Architecture Standards | Clean Architecture conventions, EF Core patterns, API design standards, multi-tenancy model, and the full architecture review checklist |
| 4 | *(not yet written)* | Security and Compliance | JWT auth model, tenant isolation requirements, data classification, and security review checklist |
| 5 | `vol-5-operating-model/` | Operating Model | How the team works: sprint cadence, ceremonies, code review standards, definition of ready/done, incident response |
| 6 | `vol-6-integration-strategy/` | Integration Strategy | The Integrated/Hybrid/Native EAM integration model, supported EAM systems, stub architecture, and integration decision criteria |
| 7 | *(not yet written)* | Data Model and Migrations | Entity relationship overview, migration conventions, PostGIS spatial data patterns, and seed data strategy |
| 8 | *(not yet written)* | Testing Strategy | Test pyramid, coverage targets, Testcontainers setup, test builder patterns, and E2E Playwright conventions |
| 9 | `vol-9-templates/` | Templates | Ready-to-use templates for user stories, ADRs, runbooks, incident reports, and API reference documents |
| 10 | `vol-10-claude-prompts/` | Claude Prompt Library | 13 ready-to-use Claude Code prompts covering discovery, architecture review, product review, implementation, testing, code review, refactoring, release preparation, and documentation generation |

---

## Contributing to the Playbook

The playbook is part of the codebase and is reviewed like code. It lives at `asset_maintenance/engineering-playbook/`.

**Which volume to modify:**

| Type of change | Volume |
|----------------|--------|
| New architectural decision locked in | Vol 3 (Architecture Standards) + `vault/decisions/` |
| New persona or domain concept identified | Vol 2 (Product Knowledge) |
| Team process change (ceremonies, definition of done) | Vol 5 (Operating Model) |
| New EAM integration supported or integration model updated | Vol 6 (Integration Strategy) |
| New template needed | Vol 9 (Templates) |
| Prompt improved or new prompt added | Vol 10 (Claude Prompts) |

**Commit message format for playbook changes:**

```
docs(playbook): [vol-N] [short description of what changed]

Examples:
docs(playbook): [vol-10] add E2E Playwright test variant for inspector journey
docs(playbook): [vol-2] add Reliability Engineer persona for Primus
docs(playbook): [vol-5] update code review checklist with nullable reference type check
```

**How to propose a change:**

1. Make the change in a branch.
2. In your PR description, include a `## Playbook Change` section explaining why the change is needed and what triggered it.
3. At least one other engineer should review playbook changes, not just code changes.

---

## A Note on Completeness

Not every volume exists yet. Volumes 3, 4, 7, and 8 are marked as "not yet written." Their absence does not mean those topics are unimportant — it means the team has not yet formalized those standards into the playbook. Until they exist:

- For architecture standards, refer to `CLAUDE.md` and `vault/decisions/`.
- For security, refer to the JWT conventions in `CLAUDE.md`.
- For data model, refer to the EF Core entities and migrations directly.
- For testing, refer to the existing test files as the de facto standard.

When you encounter a standard that is not documented, document it. The cost of writing it down once is far less than the cost of every future engineer (or AI agent) rediscovering it from scratch.

---

This playbook is the operating system of Aurigo's engineering organization. If a decision was made but not documented here, it does not exist for the next engineer or AI agent.

---

## Last Updated

2026-07-18 — Vol 10 (Claude Prompt Library) added with 13 ready-to-use prompts covering the full SDLC.
