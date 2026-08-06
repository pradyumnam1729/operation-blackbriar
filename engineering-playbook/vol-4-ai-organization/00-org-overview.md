# AI Organization Overview

> Volume 4 · AI Organization · Document 00

---

## The AI-Native Engineering Org

An AI-native engineering organization is not a company that uses AI tools — it is a company where the fundamental unit of production is a **human + AI agent pair**. The pair operates as a unit: the human provides judgment, domain authority, accountability, and stakeholder relationships; the AI agent provides speed, breadth, consistency, and tireless capacity for mechanical work.

Aurigo has committed to this model not as an experiment but as its operating standard. Every role in the engineering organization has an AI counterpart. Every workflow in this playbook describes how the human and the AI agent collaborate to complete that workflow.

The implications are significant:
- A team of 6 humans, each paired with an AI agent, can produce the output of a team of 20–30 in a traditional model.
- The bottleneck is no longer "how many engineers can we hire" — it is "how well can we define goals, review outputs, and make good decisions?"
- The quality of the human's judgment becomes even more important, not less. AI agents amplify both good and bad judgment.
- Knowledge capture becomes a competitive advantage. Engineers who document their context and decisions in machine-readable form (CLAUDE.md, MEMORY.md, ADRs) enable future agents to operate more effectively.

---

## How AI Agents Work at Aurigo

Aurigo's AI-native development is built on **Claude Code** — Anthropic's official CLI for Claude. Claude Code is not a chat interface bolted onto a code editor; it is a full-featured AI agent that can:

- **Explore large codebases:** Read, navigate, and understand thousands of files to answer architectural questions or find the right place to make a change.
- **Plan and execute multi-step tasks:** Given a user story, Claude Code can explore the existing code, identify what needs to change, write the implementation, write the tests, and update the documentation.
- **Maintain persistent context:** Through MEMORY.md files and the CLAUDE.md project file, agents retain context across sessions. A new agent session on the same project doesn't start from zero — it reads the memory files and understands the project state.
- **Collaborate with humans via code:** The primary output of an AI agent session is code, tests, documentation, and ADRs committed to the repository. The human reviews and approves via pull request.
- **Operate autonomously on defined tasks:** With a well-specified user story and access to the codebase, an AI agent can complete a full implementation task (controller → handler → repository → tests → Swagger documentation) without step-by-step human direction.

---

## Memory Architecture

Context is the foundation of effective AI agent operation. Without context, every agent session starts from scratch. Aurigo maintains a multi-level memory architecture:

### Project-Level Memory (Persistent)

**`CLAUDE.md` at the project root** — This is the first file every AI agent reads. It contains:
- What this project is and who it serves
- The tech stack (locked choices)
- Directory layout
- Common commands (build, test, run)
- Coding conventions
- Explicit DO NOT rules

When conventions change, when a new dependency is added, when a new DO NOT rule is established, `CLAUDE.md` is updated. An AI agent operating with a stale `CLAUDE.md` will make incorrect decisions.

**`SKILLS.md`** — How-to recipes for common tasks (add a new module, add a new migration, add a new feature). More specific than `CLAUDE.md`; actionable step-by-step.

**`~/.claude/projects/[project-id]/memory/`** — Typed memory files that persist facts across sessions:
- `user_role.md` — Who the user is and their role
- `project_prototype_scope.md` — Locked tech and scope decisions
- `project_platform_foundation.md` — Platform context
- Additional files added as new facts emerge

### Session-Level Memory (Transient)

The conversation history within a Claude Code session. Context accumulates during the session but does not automatically persist to the memory files. Engineers should proactively update memory files when the session establishes new important facts.

### Artifact Memory (Permanent)

Code, ADRs, tests, and documentation committed to the repository. This is the most reliable form of memory — it survives agent and human turnover, and it is searchable, diffable, and reviewable. The goal is to capture important context as repository artifacts wherever possible.

---

## How Agents Collaborate

Multiple AI agents can work on the same codebase simultaneously (in separate Claude Code sessions), but they must do so carefully to avoid conflicting changes. The protocol:

1. **Agents work on separate branches.** Like human engineers, AI agents work on feature branches, not directly on main.
2. **Agents communicate through artifacts.** One agent cannot directly message another. Instead, Agent A commits a feature branch, opens a PR, and the human (or Agent B operating in a review capacity) reviews it.
3. **Shared memory files are authoritative.** If two agents need to agree on a convention, the convention is written in `CLAUDE.md` or the memory files — not assumed from conversation.
4. **Human approval gates prevent conflicting merges.** The human (or the human-managed PR process) controls what merges to main.

For complex features that require multiple agents in parallel, the recommended approach is to define the interfaces (API contracts, event schemas, database schemas) first, commit those to main, and then have separate agents implement the consumers and producers independently.

---

## Human Approval Gates

AI agents are powerful but not infallible. Certain decisions require explicit human review before the AI-generated output is committed or deployed:

| Gate | What triggers it | Who approves |
|---|---|---|
| **Pull request approval** | Every AI-generated code PR | Engineer (Backend Lead or Frontend Lead for domain-specific changes) |
| **Architecture decision** | New ADR proposed | Technical Architect |
| **Database migration** | New migration created | Backend Lead (reviews SQL); Database backup confirmed before production apply |
| **Security change** | Any change to auth, authz, or query filters | Engineering Director or Technical Architect |
| **Production deployment** | Every release to production | Engineering Director triggers; PM confirms feature readiness |
| **EAM integration credential** | New real API key configured | Engineering Director approves; DevOps configures in Secrets Manager |

These gates exist because the cost of a mistake at each of these points is high. A flawed PR can be reverted easily. A flawed migration applied to production is much harder to recover from. A security hole in the authorization model could expose customer data. The gates are not bureaucracy — they are defense in depth.

---

## Capabilities of AI Agents in This Org

### Codebase Exploration

An AI agent can read the entire codebase in minutes. Given a question like "Where does the RUL calculation happen and what inputs does it use?", the agent can locate the relevant files, read them, trace the call chain from the API to the calculation engine, and provide a complete answer. For human engineers navigating a large codebase, this alone saves hours per week.

### Product Discovery

An AI agent can read and synthesize the feature specs (`Asset Maintenance Features.csv`), the vault documentation (`vault/calculations/`, `vault/decisions/`), and the user personas (`vault/personas/`) to provide domain context for an implementation question. Before implementing a new feature, the agent reads the relevant vault notes to understand what has already been decided.

### Implementation

Given a well-specified user story with clear acceptance criteria, an AI agent can:
1. Explore the existing code to understand the current structure
2. Identify what files need to change (new controller action, new command/handler, new entity configuration, new migration, new frontend route, new feature component, new tests)
3. Implement each change following the standards in this playbook
4. Write unit and integration tests
5. Update Swagger documentation
6. Update CLAUDE.md if new conventions were established

The human reviews the PR and either approves, requests changes, or asks clarifying questions.

### Review

An AI agent operating in review mode can check:
- Does the code follow the naming conventions in [01 — Coding Standards](../vol-3-architecture/01-coding-standards.md)?
- Are there N+1 queries?
- Is `AsNoTracking()` used on read queries?
- Is the multi-tenancy global query filter being bypassed without explanation?
- Are there hardcoded strings where constants should be used?
- Are the new endpoints covered by integration tests?

This is not a replacement for human code review — the human reviewer catches domain-level errors that require product knowledge. But the AI agent handles the mechanical quality checks, freeing the human reviewer to focus on correctness and architecture.

---

## Example: Full Feature Development Workflow

**User story:** "As an asset manager, I want to see the last 5 inspections for an asset on the asset detail page, so I can quickly understand the condition history without navigating to the inspections module."

**How this is executed in the AI-native org:**

1. **BA** uses an AI agent to write the detailed acceptance criteria from the PM's description.
2. **Technical Architect** reviews the story and confirms the API pattern (use the existing `GET /api/v1/assets/{id}/inspections` endpoint with `pageSize=5`).
3. **Backend Lead** confirms no new endpoint is needed — the existing endpoint supports the use case.
4. **Frontend Lead** assigns the story to the AI agent in a Claude Code session.
5. AI agent:
   - Reads CLAUDE.md and the relevant feature spec
   - Explores `src/features/assets/` and `src/routes/assets/$assetId.tsx`
   - Implements: `useInspectionHistory` hook (TanStack Query), `RecentInspectionsPanel` component, wires into the asset detail page
   - Writes component tests
   - Verifies no new route or API is needed
6. Human (Frontend Lead) reviews the PR:
   - Checks component accessibility
   - Confirms TanStack Query is used correctly (not raw fetch)
   - Confirms loading and empty states are handled
   - Approves or requests changes
7. PR merged → CI passes → deployed to dev

Total elapsed time: 2–4 hours for the AI agent session + 30 minutes for human review. In a traditional model, this might be 2–3 days of development + 1 hour of review.

---

_See also: [01 — Engineering Director](./01-engineering-director.md) for leadership model, [README](./README.md) for organization chart._
