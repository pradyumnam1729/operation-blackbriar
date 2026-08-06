# 01 — Repository Discovery Protocol

This document defines the **complete, ordered process** for any engineer or AI agent who is new to an Aurigo codebase. Execute every step before writing any implementation code. Skipping steps leads to duplicate patterns, wrong abstractions, and architecture violations that are expensive to unwind.

The protocol takes approximately 45–60 minutes for a human engineer. For a Claude Code agent with parallel tool calls, the same discovery can complete in under 5 minutes.

---

## Why This Protocol Exists

Aurigo codebases follow Clean Architecture with conventions layered on top: specific folder names, specific DI registration patterns, specific naming for handlers and DTOs. An engineer who assumes the project works like their last project will introduce inconsistencies. An AI agent that skips discovery and writes code from pattern-matching will create technically correct but architecturally inconsistent output.

This protocol ensures that before any code is written, the implementer understands:
- The domain model (what entities exist and how they relate)
- The API surface (what endpoints exist and what they accept/return)
- The data model (how the domain maps to tables and relationships)
- The conventions in use (naming, error handling, DI, query patterns)
- The recent history (what has just changed, what is in progress)

---

## Step 1 — Read CLAUDE.md

**Location**: always at the repo root.

CLAUDE.md is the AI orientation document for the project. It contains:
- What the system does and who uses it
- The locked tech stack
- Directory layout with explanations
- Build and run commands
- Conventions to follow
- Explicit DO NOT list

Read every word. The DO NOT list is especially important — it contains rules that exist because someone already made the mistake.

If there is no CLAUDE.md in the root, check for one in the `src/` subdirectory. If neither exists, the project predates this standard; flag the gap and create one after completing discovery.

**Automated Claude Code prompt:**
```
Read the CLAUDE.md at the repository root and summarize: (1) what this system does, (2) the tech stack, (3) the directory layout, (4) any explicit DO NOT rules.
```

---

## Step 2 — Read Playbook Volume 1 (Company Context)

**Location**: `engineering-playbook/vol-1-company-context/`

If you are starting work on a feature, understanding the business domain is not optional. Engineering decisions — naming, entity structure, workflow design — should reflect the domain. The playbook Volume 1 covers:
- Aurigo's products and how they relate
- The infrastructure owner persona and their jobs-to-be-done
- Module definitions (Plan, Build, Maintain)
- The difference between Masterworks and Primus target markets

For AI agents: read at minimum the module overview and the personas document. Without this context, generated code will have generic names and miss domain semantics.

---

## Step 3 — Explore Directory Structure

List the top-level directories, then read any subdirectory README files. The expected Clean Architecture layer structure for Aurigo backend projects is:

```
src/
├── [ProjectName].Api/               # ASP.NET Core host: controllers, middleware, DI wiring, Program.cs
├── [ProjectName].Application/       # Use cases: MediatR handlers, DTOs, validators, mappers, calculations
├── [ProjectName].Domain/            # Pure domain: entities, value objects, enums, domain events
└── [ProjectName].Infrastructure/    # External concerns: EF Core DbContext, PostGIS, external client stubs
tests/
├── [ProjectName].UnitTests/         # Pure logic: Calculations/, Domain/, Application handlers (mocked)
└── [ProjectName].IntegrationTests/  # Full stack: Testcontainers Postgres, HTTP client, real EF
```

For each layer, answer:
- What is in here that is not obvious from the layer name?
- Are there subdirectories that group related functionality?
- Are there any files that do not belong in this layer (e.g., business logic in Infrastructure)?

For frontend projects:
```
src/
├── api/           # Generated API client from OpenAPI spec — never hand-edit
├── routes/        # TanStack Router file-based pages — one file per route
├── features/      # Domain feature modules — each contains components, hooks, types
├── components/ui/ # shadcn/ui primitives — Radix-based, Tailwind-styled
└── lib/           # Shared utilities: mapbox helpers, formatters, calc helpers
```

**Automated Claude Code prompt:**
```
List all top-level directories and their immediate subdirectories. For each src/ layer, describe what it contains. Identify any files that appear to be in the wrong layer.
```

---

## Step 4 — Read All Domain Entities

**Location**: `src/[ProjectName].Domain/Entities/`

The Domain entities are the source of truth for the business model. Read every entity file. For each entity, capture:
- Name and purpose
- Properties and their types
- Navigation properties (relationships)
- Whether it implements `IAuditableEntity`, `ISoftDeletable`, or similar base interfaces
- Any value objects it uses

Also read:
- `src/[ProjectName].Domain/Enums/` — all enum types
- `src/[ProjectName].Domain/ValueObjects/` — value objects
- `src/[ProjectName].Domain/Events/` — domain events if present

Build a mental (or written) entity relationship map. For example, in Asset Maintenance: Asset has many Inspections; Inspection has many InspectionItems; Asset has one AssetValuation; etc.

**Automated Claude Code prompt:**
```
Read all files in Domain/Entities/ and Domain/Enums/. Produce an entity relationship summary: for each entity, list its properties, relationships to other entities, and any interfaces it implements.
```

---

## Step 5 — Read Recent Git Log

Run:
```sh
git log --oneline -20
```

This gives you:
- What work has recently completed
- What the current branch's purpose is (branch name)
- Whether there are ongoing migrations (look for "migration" in commit messages)
- Whether there are known breaking changes in progress

Also run:
```sh
git branch -a | head -20
```

This shows active branches and gives context on parallel work streams. If you see a branch named `feature/capital-needs` and you are implementing a capital needs feature, check whether work is already in progress before starting.

---

## Step 6 — Read All Controllers

**Location**: `src/[ProjectName].Api/Controllers/`

Controllers define the API surface. For each controller, capture:
- The route prefix (`[Route("api/v1/...")]`)
- Every action method: HTTP verb, path, parameters, return type
- Whether `[Authorize]` is present and what policy or role is required
- Whether the controller uses `IMediator` (CQRS pattern) or direct service injection

Look for patterns: Does every controller inherit from a common base? Is there a consistent way errors are returned? Is `[ProducesResponseType]` used?

**Automated Claude Code prompt:**
```
Read all controller files in Api/Controllers/. For each controller, list every endpoint: HTTP method, route, parameters accepted, return type, and authorization requirement.
```

---

## Step 7 — Read Frontend Routes

**Location**: `frontend/[app]/src/routes/`

TanStack Router uses file-based routing. The file path determines the URL path. For each route file:
- What URL does it correspond to?
- What page-level component does it render?
- What data does it load (TanStack Query hooks)?
- What features does it compose?

Also read `routeTree.gen.ts` (auto-generated) for the complete route tree structure.

**Automated Claude Code prompt:**
```
List all files in src/routes/. For each route file, identify the URL it maps to and the primary data it loads. Describe the overall navigation structure.
```

---

## Output of Discovery: Six Questions to Answer

Before writing any code, you must be able to answer these six questions in writing:

**Q1. What is the primary domain model?**
List all entities, their key properties, and their relationships. Example: "Asset is the aggregate root. It has many Inspections. Each Inspection has many InspectionItems. An Asset has one AssetValuation."

**Q2. What is the complete API surface?**
List all existing endpoints by controller. Identify which endpoints you will need to create or modify for the current story.

**Q3. Where do the conventions live in this codebase?**
Name the handler pattern used (MediatR? direct injection?), how errors are returned, how DTOs are named, how validators are registered. If you cannot name them, re-read the controllers and existing handlers.

**Q4. What database migrations exist?**
List the existing migrations from `Infrastructure/Migrations/`. Understand the current schema. Identify whether your feature requires a new migration.

**Q5. What has changed recently that is relevant?**
From the git log: are there in-progress migrations, schema changes, or feature branches that overlap with your work? Who should you coordinate with?

**Q6. What do the tests tell you about intended behavior?**
Read the existing test files for the area you are working in. What scenarios are already tested? What is the test data setup? What assertions are made?

---

## Automated Discovery Prompt for Claude Code Agents

Use this prompt to run the full discovery in one pass:

```
You are starting work on [FEATURE_NAME]. Before writing any code, execute the full repository discovery protocol:

1. Read CLAUDE.md at the repository root. Summarize what the system does, the tech stack, DO NOT rules.
2. List all src/ directories and subdirectories. Identify the Clean Architecture layers.
3. Read all files in Domain/Entities/ and Domain/Enums/. Produce an entity relationship map.
4. Run: git log --oneline -20. Note recent changes relevant to [FEATURE_NAME].
5. Read all controller files. List every endpoint with its route and return type.
6. Read the frontend routes/ directory. List routes and their data dependencies.
7. Read the existing tests for [FEATURE_AREA]. Note what is already tested.

Output: Answer the six discovery questions (domain model, API surface, conventions, migrations, recent changes, test coverage) before proceeding to implementation planning.
```

---

## When to Re-Run Discovery

Discovery is not a one-time step. Re-run it (or the relevant steps) when:
- You have been away from the project for more than 2 weeks
- You are starting a feature in an area you have not touched before
- A large merge has landed on main that you have not reviewed
- You are asked to debug an issue in an unfamiliar module

For AI agents: run discovery at the start of every new session, even if you have context from a previous session. The codebase may have changed.
