# AI Agent Design Principles

An AI agent is a Claude model instance given a specific role, a specific context, and a specific task, instructed to complete that task with tool access to the codebase. Agents are the building blocks of Aurigo's AI-assisted engineering workflows. The quality of an agent — how reliably it produces the right output — depends almost entirely on how it was designed: what context it was given, how its role was defined, and what its boundaries are.

This document covers the principles for designing agents that work reliably: single responsibility, the prompt template structure, memory design, isolation patterns, and how to identify and correct poor agent designs.

---

## The Single Responsibility Principle for Agents

An agent that has one clear job performs that job well. An agent that is asked to do everything performs everything poorly.

This is not unique to AI agents — it is a generalization of the software engineering principle of single responsibility. But it applies with particular force to AI agents because agents do not have the domain knowledge to make good trade-offs across multiple responsibilities. An agent asked to simultaneously write backend code and frontend code and tests and documentation will produce work that is technically acceptable in each area but does not reflect the expertise that a specialist agent would bring.

**Good agent designs:**

*Repository Discovery Agent:* Reads the codebase. Builds a structured understanding of what exists: entities, controllers, existing patterns, recent changes. Produces a written summary. Does not make code changes.

*Backend Implementation Agent:* Writes .NET 8 handler code, validators, domain events, entity configurations. Knows the Clean Architecture layer rules and EF Core patterns cold. Does not write frontend code.

*Frontend Implementation Agent:* Writes React 18 + TypeScript components, TanStack Router routes, TanStack Query hooks. Knows shadcn/ui component library, Tailwind CSS conventions, and the Aurigo design system. Does not write backend code.

*Test Generation Agent:* Given an existing implementation, writes comprehensive tests. Knows xUnit + FluentAssertions for backend, Vitest + React Testing Library for frontend, Playwright for E2E. Does not write production code.

*Architecture Review Agent:* Reviews code against ADRs and playbook standards. Produces a review report. Does not make code changes — it recommends changes for a human to approve and then implement (or delegate to another agent).

*Documentation Agent:* Writes or updates documentation: API docs, ADR drafts, user guides, release notes. Reads code; does not modify code.

**Bad agent designs:**

*"Do everything" agent:* Asked to implement a feature end-to-end — backend, frontend, tests, documentation, migration, review. No specialization. Produces mediocre outputs in every area. The backend code lacks depth because the agent is also thinking about the frontend. The tests are shallow because the agent is also thinking about the documentation.

*Agent without context:* No CLAUDE.md loaded, no memory of previous sessions, no project-specific context. Produces syntactically correct code that is architecturally wrong — wrong patterns, wrong file locations, missing constraints.

*Agent with conflicting instructions:* Asked to "follow the existing pattern" and also "implement it more efficiently" — these two instructions conflict when the existing pattern is not the most efficient. The agent will guess which instruction takes priority, and guess wrong approximately half the time.

---

## Agent Prompt Template

Every agent used in Aurigo's workflows should be structured using this template. The template ensures all necessary context dimensions are present.

```
## Role
You are the [role name] for Aurigo Software Technologies.
[2-3 sentences describing the role: what this agent is an expert in, what its 
responsibilities are, and what it should decline to do.]

## Company Context
Aurigo Software Technologies builds enterprise SaaS for infrastructure owners — 
public agencies (DOTs, cities, counties) and private owners (manufacturers, utilities, 
data centers). The platform covers the full infrastructure lifecycle: Plan (capital 
program management) → Build (project delivery) → Maintain (asset lifecycle intelligence).

The Maintain product positions itself as the System of Intelligence above existing EAM 
systems (IBM Maximo, SAP EAM, Oracle EAM, Cityworks, Infor EAM) — it does not replace 
them; it provides analytics, condition intelligence, and capital planning on top of them.

## Product Context
[Which product: Masterworks (public sector) or Primus (private sector)?]
[Which module: Asset Registry, Inspections, Capital Needs, Risk Scoring, EAM Integration?]
[Which deployment mode: Integrated (with existing EAM), Hybrid, Native (Maintain as sole EAM)?]

## Tech Stack
[List only the stack relevant to this agent's domain. Backend agents get the .NET stack. 
Frontend agents get the React stack. Both get auth and multi-tenancy.]

Backend (if relevant):
- .NET 8 Web API, Clean Architecture (Api / Application / Domain / Infrastructure)
- MediatR for CQRS
- EF Core 8 + Npgsql + PostGIS 3.4
- PostgreSQL 16 with global tenant_id query filter
- FluentValidation for all input validation
- JWT authentication (claims: tenantId, userId, role)

Frontend (if relevant):
- React 18 + Vite 5 + TypeScript 5
- TanStack Router (file-based routing)
- TanStack Query for server state
- shadcn/ui (Radix primitives) + Tailwind CSS
- react-hook-form + zod for forms
- Mapbox GL JS for maps
- Recharts for charts

## Your Task
[Specific, unambiguous task description. Include:
- What to produce
- What input data or files you are working with
- Any relevant constraints for this specific task]

## Files to Read
[List the files the agent should read before starting work. Include:
- CLAUDE.md
- Reference implementations to follow
- Domain entities relevant to the task
- Any existing tests to understand the testing pattern]

## Files to Create or Modify
[List the files to create or modify. Use full relative paths from the project root.
For modifications, note what changes are needed in each file.]

## Constraints
[Everything the agent must not do:
- Multi-tenancy: do not bypass EF global query filter
- Security: all new endpoints need [Authorize]
- Architecture: do not put business logic in controllers
- Any task-specific constraints]

## Output Format
[What the deliverable looks like:
- For code: file paths and expected content structure
- For documentation: sections to include
- For reviews: report format]

## Quality Checklist
Before completing, verify:
[Task-specific quality checks the agent should self-verify]
```

---

## Agent Memory Design

Agents retain context across sessions via memory files. Good memory design gives agents enough context to perform their role without requiring re-explanation each session.

**What each agent role should save to memory:**

*Backend Implementation Agent:*
- Patterns that were corrected in a session (e.g., "AutoMapper profiles go in `Application/[Domain]/Mappers/` not in the controller")
- Domain knowledge accumulated (e.g., "The InspectionRecord entity requires both AssetId and InspectorId — neither can be null")
- Performance patterns identified (e.g., "The GetAssetsByFilter query uses compiled queries — follow this pattern for similar list queries")

*Repository Discovery Agent:*
- A summary of the current state of each module (complete, in-progress, not started)
- Known areas of technical debt
- File paths for key patterns that should be referenced as examples

*Architecture Review Agent:*
- ADR decisions and their compliance implications
- Common violations found in past reviews (so the agent knows what to look for)
- New patterns added since the last architecture review

**Memory file naming convention:**
- `feedback_[agent-role]_[topic].md` for corrections and confirmations
- `project_[module]_state.md` for module completion state
- `reference_[topic].md` for external references

**Memory freshness:**
Memory files should include a `Last Updated:` date at the top. When a memory file has not been updated in more than one sprint cycle, it should be reviewed for staleness. Stale memories are worse than no memories — an agent acting on incorrect memory produces confidently wrong outputs.

---

## Agent Isolation Patterns

Agent isolation determines whether an agent's changes immediately affect the working tree or are sandboxed until approved.

**No isolation (default):** Agent writes to the active working directory. Changes are visible immediately in `git status`. Suitable for: small, well-defined tasks with low risk of producing unwanted changes. Not suitable for: large refactoring, uncertain implementations, or cases where partial work would break the build.

**Worktree isolation (`isolation: "worktree"`):** Agent works in a separate git worktree. The main working tree is unaffected until the worktree is merged. Suitable for: large features, parallel agent work, risky refactoring. The engineer reviews the changes before merging.

**Branch isolation:** Agent works on a new git branch. Less isolation than worktree (still in the same directory) but provides a clean review and merge path. Use when worktree isolation is not available or the tooling does not support it.

**When to require isolation:**
- The agent is making changes to more than 5 files
- The agent is working on a migration file
- The agent is touching security-critical code (auth, authorization)
- Two agents are running in parallel on the same feature

---

## Evaluating Agent Quality

After an agent completes its task, evaluate the quality of the output before accepting it. The key questions:

**Did the agent follow the constraints?** Check every constraint in the prompt. If any constraint was violated, that is a critical failure — add reinforcement to the constraint in the prompt and re-run.

**Did the agent follow the reference patterns?** Compare the generated code to the reference implementation. If significant structural differences exist, identify why. Sometimes the difference is an improvement. Often it is a mistake.

**Did the agent produce all deliverables?** If the prompt specified code + tests + documentation and the agent produced only code, the deliverable is incomplete. Do not accept partial deliverables; send the agent back to complete what was missing.

**Did the agent explain its choices?** For complex decisions (choosing a caching strategy, selecting an index, designing an API shape), the agent should explain why it made the choice. If no explanation was provided, ask for one. This both improves the output and builds the engineer's understanding.

**Did the tests pass?** AI-generated tests that do not run are worse than no tests — they create false confidence. Run all generated tests before accepting the PR.

---

## Specialized Agent Configurations for Aurigo

The following agent configurations are pre-defined for common Aurigo workflows. Each has a corresponding full prompt in Volume 10.

**Backend Handler Agent:** Implements a single MediatR command or query, its validator, its unit tests, and the controller endpoint. Reference: `vol-10-claude-prompts/08-implementation.md`.

**Frontend Feature Agent:** Implements a single route/page with its components, TanStack Query hooks, and form handling. Reference: `vol-10-claude-prompts/08-implementation.md`.

**Calculation Test Agent:** Generates comprehensive xUnit tests for a calculation engine. Reference: `vol-10-claude-prompts/09-testing.md`.

**Repository Discovery Agent:** Performs a full codebase survey and produces a structured summary for memory. Reference: `vol-10-claude-prompts/01-repository-discovery.md`.

**Architecture Review Agent:** Reviews a PR against Aurigo's ADRs and architecture standards. Reference: `vol-10-claude-prompts/02-architecture-review.md`.

**Release Notes Agent:** Generates categorized release notes from a git log range. Reference: `vol-10-claude-prompts/12-release.md`.

---

## Testing Agent Prompts

Agent prompts are code. Code needs tests. Aurigo treats prompt testing as a first-class engineering activity for any prompt that lives in `vol-10-claude-prompts/` and is used repeatedly.

### Prompt regression tests

For each library prompt, maintain a small suite of test inputs and expected output characteristics. Not the exact output text — that will vary — but structural expectations:

- Given a well-specified story with clear acceptance criteria, the implementation prompt should produce: (1) a handler file, (2) a validator file, (3) a unit test file, (4) an integration test file, (5) no changes to files outside the listed scope.
- Given a story missing acceptance criteria, the prompt should surface the gap as a question, not fabricate criteria.
- Given a story that requires a new calculation formula, the prompt should refuse to proceed and instead recommend a spike story.

These expectations become the pass/fail criteria for a prompt regression test. Run monthly or on any prompt change.

### A/B testing prompts

When improving a prompt, compare the improved version against the current version on 5-10 real test cases. Metrics:

- **Deliverable completeness.** Did both prompts produce all deliverables?
- **Constraint compliance.** Did either violate a stated constraint?
- **Cost.** Which used fewer tokens?
- **Iteration count.** How many prompt iterations did each need before an acceptable result?

Only ship the improved version if it wins on at least two of these dimensions and does not regress on the others.

### Prompt versioning

Every prompt in `vol-10-claude-prompts/` has a version marker at the bottom (`_Version: 1.3 · Updated 2026-07-10_`). Version bumps require:

- A brief note in the file's changelog about what changed and why.
- A regression test run showing the new version does not regress on the standard test cases.
- Reviewer sign-off (any senior engineer for minor changes; EM for major structural changes).

Ad hoc changes to prompts without version bump and changelog are not permitted — the prompts are shared infrastructure and drift accumulates quickly without discipline.

---

## Agent Error Handling

When an agent produces wrong output, the response depends on the failure mode. Diagnose before re-running.

### Wrong output that violates a constraint

**Root cause is almost always prompt.** The constraint was buried, understated, or not stated at all. Add it explicitly, re-run. If the same constraint gets violated twice with the same prompt, promote it to `CLAUDE.md` as a project-level rule.

### Wrong output that produces plausible but incorrect code

**Root cause could be prompt (missing context) or task (genuinely hard).** For calculation code and domain-specific code, ask the agent to explain its choice — often the explanation reveals the mistaken assumption. Correct the assumption in the prompt or reject the output.

### Wrong output that references nonexistent code or APIs

**Root cause is hallucination.** See the hallucination detection section in `13-ai-safety.md`. Verify APIs against the actual installed version. Consider switching to Opus if Sonnet is consistently hallucinating on this domain area — the more expensive model may pay for itself in correctness.

### Wrong output that ignored parts of a long prompt

**Root cause is context window pressure or attention scatter.** Shorten the prompt. Front-load critical instructions. Split into smaller agents with focused prompts.

### Agent stops mid-task or produces incomplete output

**Root cause is often model output-length limits or resource issues.** Ask the agent to continue from where it stopped. If this recurs, the task is too large for one agent — decompose into a supervisor and sub-agents (see `04-agent-collaboration.md`).

### Agent produces output but claims the task is impossible

**Sometimes the agent is right.** Especially for tasks that violate a stated constraint (e.g., "implement this feature without adding a new dependency" when the feature genuinely requires one). Read the agent's reasoning. If the impossibility is real, escalate to a human decision (accept the trade-off, redesign the task, or expand the constraint). If the impossibility is imagined, correct the misunderstanding and re-run.

### Repeated failure across attempts

If two carefully-corrected attempts do not produce acceptable output, do not attempt a third with more corrections. Instead: (a) do the task manually, (b) split the task, or (c) elevate to a more capable model. Iterating a broken prompt more than twice is the AI equivalent of debugging by adding more print statements — sometimes right, often wasteful.
