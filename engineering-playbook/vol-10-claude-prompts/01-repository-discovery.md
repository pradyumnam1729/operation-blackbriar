# 01 — Repository Discovery Prompt

Use this prompt at the start of a new session, before beginning work in an unfamiliar module, or after returning from a long gap. The goal is to give you (and the AI agent) a shared, accurate picture of what the codebase currently contains before any work begins.

---

## When to Use

- First thing in any new Claude Code session where you plan to write or modify code.
- Before starting a major feature, to verify the foundation is in the state you expect.
- After merging from `main` into your branch, to understand what changed.
- When onboarding a new engineer — run the deep variant and save the output to `vault/sessions/YYYY-MM-DD-discovery.md`.

## How to Save Output

At the end of the discovery session, ask Claude to save the summary:

> "Save this discovery summary to vault/sessions/YYYY-MM-DD-discovery.md"

Then reference it in the next session to avoid repeating the discovery.

## What to Do If Discovery Reveals Unexpected State

- **Migrations not applied:** Run `dotnet ef database update` before proceeding.
- **Failing tests:** Do not add new code on top of failing tests. Fix the tests first or explicitly scope your work to unrelated modules.
- **Broken build:** Stop. Fix the build. Commit the fix before any feature work.
- **Schema drift (DB does not match migrations):** Check `__EFMigrationsHistory` table. Identify the gap and apply or roll back migrations to restore sync.

---

## Quick Discovery Prompt

Use this when you need orientation in under 5 minutes. Paste this prompt verbatim:

---

You are helping me work on the Aurigo Maintain codebase (Asset-Based Capital Planning, .NET 8 / React 18). Before we start, orient me quickly.

Read these files in order and build situational awareness:

1. `CLAUDE.md` (project root — read the full file)
2. `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/` — list all entity files (do not read them yet, just list names)
3. Run `git log --oneline -15` to see recent activity
4. Run `git status` to see the current working tree state

Then give me a brief summary (5-8 bullet points) covering:
- What the system is and what it does
- Which domain entities exist
- What the last 5 commits were working on
- Whether the working tree is clean or has in-progress changes
- Any obvious issues I should know about before starting

Keep it under 300 words. I will ask follow-up questions if I need more.

---

## Standard Discovery Prompt

Use this at the start of a normal working session. Paste this prompt verbatim:

---

You are helping me work on the Aurigo Maintain codebase (Asset-Based Capital Planning prototype). Before we start any work, perform a structured discovery of the current state of the codebase.

**Step 1 — Read foundation files (do this first, in order):**

1. `CLAUDE.md` — project conventions, stack, directory layout, build commands
2. `SKILLS.md` — how-to recipes for common tasks
3. `vault/phases/` — list all phase files and read the most recent one
4. `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/` — read all entity files

**Step 2 — Survey the API surface:**

5. Read `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Api/Controllers/` — list all controllers and their action methods (names only, not the full method bodies)
6. Read `infra/swagger/asset-maintenance-v1.json` — note the top-level resource paths

**Step 3 — Survey the frontend:**

7. Read `frontend/asset-maintenance-web/src/routes/` — list all route files
8. Read `frontend/asset-maintenance-web/src/features/` — list all feature directories

**Step 4 — Check current state:**

9. Run `git log --oneline -20`
10. Run `git status`
11. Run `git diff --stat HEAD~1` to see what the most recent commit touched

**Now produce a structured discovery report with these sections:**

### Domain Model
List each entity with: entity name, key fields (3-5 most important), relationships to other entities.

### API Resources
List each controller with its route prefix and the HTTP methods it exposes.

### Frontend Features
List each feature module and the pages it contains.

### Recent Activity (last 10 commits)
Summarize what areas of the codebase have been active, grouped by concern (e.g., "3 commits on migrations", "2 commits on frontend dashboard").

### Current In-Progress Work
Based on `git status` and uncommitted changes, describe what work is currently in flight. If the working tree is clean, state that.

### Architectural Patterns Observed
List 3-5 patterns you observed that are consistent with the documented conventions in CLAUDE.md. Confirm that Clean Architecture layers are respected.

### Potential Concerns
List any issues observed during discovery: failing tests, missing migrations, schema drift, TODOs in critical paths, anti-patterns in recently-modified files. If none, state "None observed."

### Ready to Work
State which areas of the codebase are clean and ready to receive new work, and which areas have outstanding issues.

---

## Deep Discovery Prompt

Use this before starting a major feature, after a long gap, or when onboarding. This is thorough and may take 10-15 minutes. Paste this prompt verbatim:

---

You are helping me work on the Aurigo Maintain codebase (Asset-Based Capital Planning, .NET 8 / React 18 / PostgreSQL + PostGIS). Perform a deep discovery of the current codebase state. This will be saved and used as a reference for the next several sessions.

**Phase 1 — Architecture and Domain**

1. Read `CLAUDE.md` completely.
2. Read all files in `vault/decisions/` — list each ADR with its title and status (Accepted/Superseded/Proposed).
3. Read all files in `vault/phases/` — identify which phases are complete and which are in progress.
4. Read all files in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/`.
5. Read all files in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Enums/` if the directory exists.
6. Read `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/AssetMaintenanceDbContext.cs`.

**Phase 2 — Application Layer**

7. List all directories under `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/`.
8. For each Commands/ and Queries/ subdirectory, list the handler files (names only).
9. Read all files in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Calculations/`.

**Phase 3 — API Layer**

10. Read all controller files in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Api/Controllers/`.
11. Read `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Api/Program.cs`.

**Phase 4 — Infrastructure**

12. List all migration files in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Migrations/` (names only, newest first).
13. Read `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/DependencyInjection.cs`.

**Phase 5 — Frontend**

14. Read `frontend/asset-maintenance-web/src/routeTree.gen.ts` to see the complete route tree.
15. List all files under `frontend/asset-maintenance-web/src/features/` recursively.
16. Read `frontend/asset-maintenance-web/src/api/` — list all generated API hook files.

**Phase 6 — Tests**

17. List all test files in `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.UnitTests/`.
18. List all test files in `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.IntegrationTests/`.

**Phase 7 — Current State**

19. Run `git log --oneline -30`.
20. Run `git status`.
21. Run `dotnet build backend/Aurigo.AssetMaintenance/Aurigo.AssetMaintenance.sln` and report the result.

**Produce a deep discovery report with these sections:**

### Complete Domain Model
For each entity: name, table name (if known), key fields with types, relationships, business rules you can infer from the code.

### Calculation Engines
For each class in Application/Calculations/: what it calculates, its inputs and outputs, whether it has corresponding tests.

### API Completeness
For each domain entity: does it have a controller? What CRUD operations are exposed? What is missing?

### Frontend Completeness
For each backend API resource: does it have a corresponding frontend route and feature? What gaps exist?

### Architecture Compliance
Check each of the following and report Compliant / Partially Compliant / Non-Compliant with evidence:
- Clean Architecture: no Infrastructure references in Application or Domain
- Multi-tenancy: tenant_id present on all aggregate roots, global query filter applied
- EF Core: AsNoTracking used on read-only queries, no lazy loading
- Validation: FluentValidation at API boundary, not duplicated in handlers
- Mapping: AutoMapper or explicit mappers used, entities not returned from controllers
- Security: JWT auth applied to all controllers, no unauthenticated endpoints

### Test Coverage Assessment
For each calculation engine: tested / not tested. For each controller action: integration test exists / does not exist. Overall assessment of test coverage gaps.

### Migration Health
List all migrations in order. Identify any gaps or naming inconsistencies. State whether the migration history looks clean.

### Outstanding Work
Based on phase files, ADRs, and code state: what work is documented as in-progress or TODO? What phases are incomplete?

### Recommended Next Steps
Given the current state, what are the 3 most important things to address before adding new features?

---
