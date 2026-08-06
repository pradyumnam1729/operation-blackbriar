# Repository Indexing for AI Agents

An AI agent that does not know the current state of the codebase makes decisions based on outdated information. It creates files in locations that have been reorganized, uses patterns that have been superseded, implements features that already exist, and misses dependencies on recent additions. Repository indexing is the process of building a current, accurate mental model of the codebase at the start of an agent session or before significant work begins.

This document covers the indexing strategy (three levels of depth), the specific artifacts that indexing produces, when to trigger each level of index, and how to keep indexes current as the codebase changes.

---

## The Staleness Problem

Claude models are trained on data up to a cutoff date. But the repository changes daily. Even if a model was trained on a version of the Aurigo codebase, the current version may be substantially different. New modules have been added. Patterns have been refactored. Entity relationships have changed. File paths have moved.

There are two distinct staleness vectors:

**Training data staleness:** The model was trained before recent additions to the codebase. It does not know about the CapitalNeedsCalculator class because it was added last sprint.

**Session context staleness:** Even if the repository is provided to the agent, the agent may have incomplete or incorrect context from the previous session. Perhaps it indexed the codebase three weeks ago and saved a summary to memory, but the summary no longer reflects the current state.

The solution to both is the same: regular, structured repository indexing that produces current summaries saved to memory.

---

## Indexing Levels

Repository indexing is not one-size-fits-all. The depth of indexing required depends on the task.

### Level 1 — Session Bootstrap (Every Session)

Run at the beginning of every Claude Code session, before beginning any significant work. Takes 2-3 minutes.

**Steps:**
1. Read `CLAUDE.md` — confirm the tech stack, conventions, and DO-NOTs
2. Read `MEMORY.md` — load the current project context from memory
3. Run `git log --oneline -10` — see what changed in the last 10 commits
4. Run `git status` — see what is currently in progress (uncommitted changes)

**Output:** A session context that reflects the current state of active work. No file is written — this is an in-memory bootstrap for the current session only.

**When to do more:** If git log shows significant changes in the area you are working (migrations, new entities, handler restructuring), escalate to Level 2.

### Level 2 — Domain Discovery (When Starting Work in a New Domain)

Run when beginning work in a module or domain that was not the focus of recent sessions. Takes 10-20 minutes depending on the size of the domain.

**Steps:**

1. Level 1 steps first
2. List all files in the target domain:
   - `Domain/Entities/[Domain]/` — entity definitions
   - `Application/[Domain]/Commands/` — command handlers
   - `Application/[Domain]/Queries/` — query handlers
   - `Application/[Domain]/Validators/` — validators
   - `Application/Calculations/` — calculation engines (if domain has calculations)
   - `Api/Controllers/[Domain]Controller.cs` — controller
   - `Infrastructure/EntityConfigurations/[Domain]/` — EF configurations
   - `tests/UnitTests/[Domain]/` — unit tests
   - `tests/IntegrationTests/[Domain]/` — integration tests
   - `frontend/src/features/[domain]/` — frontend feature code
   - `frontend/src/routes/[domain]/` — frontend routes

3. Read the key entity file(s) for the domain — understand the aggregate root and its value objects
4. Read one reference command handler and one reference query handler — understand the current pattern
5. Read the controller — understand the current API surface
6. Check git log filtered to the domain directory: `git log --oneline -- src/[].Domain/Entities/[Domain]/`

**Output:** A domain summary saved to `project_state.md` memory:
```markdown
## [Domain] Module — Indexed YYYY-MM-DD

### Entities
- [EntityName]: [brief description, key fields]
- [EntityName]: [brief description, key fields]

### Command Handlers Implemented
- [CommandName]: [what it does]

### Query Handlers Implemented
- [QueryName]: [what it does]

### API Endpoints
- GET /api/v1/[domain] — [description]
- POST /api/v1/[domain] — [description]

### Reference Implementations
- Handler pattern: Application/[Domain]/Commands/[BestExample].cs
- Query pattern: Application/[Domain]/Queries/[BestExample].cs

### Not Yet Implemented
- [list of missing handlers, endpoints, or features]

### Known Issues
- [any known bugs or technical debt in this domain]
```

### Level 3 — Full Repository Index (Weekly or Before Major Feature Work)

Run weekly or before beginning a large feature (5+ stories, multiple domains). Takes 30-60 minutes. Produces artifacts that are saved to memory and used as the foundation for subsequent sessions.

**Steps:**

1. Level 1 and 2 steps for every active domain
2. Complete entity relationship map:
   - List all entities in `Domain/Entities/`
   - For each entity, identify its relationships (read the EF configuration files)
   - Document the relationship graph
3. Complete API surface map:
   - List all controllers and their actions
   - Note which are protected, which are open
4. Complete test coverage assessment:
   - Count test files per domain
   - Identify domains with no tests or sparse tests
5. Architecture compliance check:
   - Are there any obvious Clean Architecture violations?
   - Are there any direct dependencies between wrong layers?
6. Review all ADRs and note if any recent code changes may violate them

**Output:** A full index document saved to project memory:
- `project_state.md` — updated module status for all domains
- `project_entity_graph.md` — entity relationship map
- `project_api_surface.md` — complete API surface listing
- A brief architecture compliance note in `feedback_patterns.md` if violations were found

---

## Indexing Triggers

| Trigger | Recommended Level | Rationale |
|---------|-------------------|-----------|
| Start of any session | Level 1 | Low cost, ensures current context |
| Starting work in unfamiliar domain | Level 2 | Domain context needed for correct implementation |
| Starting a new sprint | Level 2 for sprint focus areas | Understand current state of each story's domain |
| New engineer joins team | Level 3 | Full codebase orientation |
| Major merge (5+ files in core area) | Level 2 for affected domain | Ensure agent sees post-merge state |
| Weekly maintenance | Level 3 | Catch drift between memory and reality |
| Before major feature work | Level 3 | Complex features benefit from full context |
| Before architecture review | Level 3 | Reviews require understanding the full picture |

---

## Indexing Artifacts

The following artifacts are produced by indexing and stored in project memory.

### Session Summary (Level 1)

Not written to disk. Exists only in the current session context. Contains:
- What has changed recently (git log summary)
- What is currently in progress (git status summary)
- Any context from memory files that is relevant to today's work

### Domain Summary (Level 2)

Written to `project_state.md`. Contains the domain-level snapshot as described in the Level 2 steps above. Updated in place when re-indexed.

### Full Index (Level 3)

Multiple memory files updated:
- `project_state.md` — complete module status
- `project_entity_graph.md` — entity relationships
- `project_api_surface.md` — API surface map

These files are the foundation for all subsequent agent sessions. An agent starting a new session that reads these files has a current, accurate mental model of the codebase without performing discovery steps.

---

## Index Freshness and Drift Detection

Indexes become stale as the codebase changes. The primary indicator of staleness is the `Last Updated` date on each memory file compared to the date of the most recent commits in the indexed area.

**Drift detection heuristic:**
Run Level 1 indexing. If git log shows more than 10 commits in a domain since the last index date for that domain, re-run Level 2 indexing for that domain before proceeding with implementation work.

**Automated drift warning (future):**
A pre-session hook that compares the commit timestamps in each domain with the `Last Updated` dates in the corresponding memory files and prints a warning if significant drift is detected. This is a planned enhancement for the explicit knowledge graph implementation.

---

## Indexing and the Knowledge Graph

Repository indexing is the practical implementation of the knowledge graph concept described in `vol-7-ai-engineering/06-knowledge-graph.md` until the explicit graph infrastructure is built. Each indexed domain summary is a manually constructed subgraph — it captures entities, their relationships, the handlers that operate on them, and the tests that verify them.

When the explicit knowledge graph is implemented, the Level 2 and Level 3 indexing steps described here will be replaced by automated graph queries. The Level 1 session bootstrap will remain — git log and git status are always relevant regardless of what graph infrastructure exists.

Until then, disciplined manual indexing is what enables AI agents to work correctly on a codebase that changes daily.
