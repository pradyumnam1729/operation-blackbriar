# Shared Memory Architecture

Every Claude Code session begins with no memory of previous sessions. The model has broad knowledge from training, and it can see the files in the repository, but it does not remember what was decided yesterday, what mistakes were corrected last week, or what state the implementation is in across the current sprint. Without a solution to this problem, every session requires re-establishing context from scratch — a significant overhead that compounds across many sessions and many engineers.

Shared memory is the solution. A set of structured markdown files stored persistently in the user's home directory outside the repository provides session-to-session continuity for the AI agents. When sessions are started with the right memory loaded, agents know who they are working with, what has been decided, what patterns are correct for this codebase, and what mistakes to avoid.

This document covers the design of the shared memory system, what to save and what not to save, the file structure and naming conventions, how to keep memory current, and the lifecycle of a memory from creation to deletion.

---

## The Problem Shared Memory Solves

Without shared memory, each Claude Code session suffers from these failure modes:

**Re-explanation overhead:** Every session begins with several minutes of context-setting. "I am building a .NET 8 API. The patterns are Clean Architecture. Multi-tenancy is enforced via EF query filters. Here is the current state of the feature I am implementing..." This is recoverable in a few minutes, but across hundreds of sessions it represents a significant waste.

**Repeated mistakes:** An agent was corrected in session 3 for returning Domain entities from controllers. In session 7, the same agent makes the same mistake. Without a memory of the correction, the agent has no way to know the pattern was wrong. The engineer must make the same correction again.

**Lost context at sprint boundaries:** At the end of a sprint, the implementation state is partially complete. A new session starting at the beginning of the next sprint has no memory of what was completed and what remains. The engineer must reconstruct this context manually.

**Inconsistent agent behavior:** Different engineers working with the same agent get different behavior because their session contexts are different. Shared memory standardizes agent behavior across the team.

---

## Memory File Structure

Memory files live in a project-specific directory under the user's home directory. Claude Code provides hooks to load memory files into the session context automatically.

```
~/.claude/projects/[project-hash]/memory/
├── MEMORY.md              ← Index file (loaded in every session context)
├── user_role.md           ← Who the user is, their expertise, preferences
├── project_scope.md       ← Locked-in tech and scope decisions
├── project_platform.md    ← Platform foundation context
├── project_state.md       ← Current implementation state by module
├── feedback_patterns.md   ← Behavioral corrections and confirmations
├── reference_resources.md ← External resource pointers
└── reference_plugins.md   ← Installed skill plugins and their capabilities
```

### MEMORY.md — The Index

The index file is critical. Every session context includes `MEMORY.md`. If the index is too long, it will not fit in the context window and the memory system fails. The index must be under 200 lines.

Format:
```markdown
# Memory Index

- [User role](user_role.md) — Aurigo backend engineer, prefers tests alongside implementation
- [Project scope](project_scope.md) — locked-in tech decisions from project kickoff
- [Platform context](project_platform.md) — which repos are app code vs deploy infra
- [Current state](project_state.md) — what modules are complete, in progress, pending
- [Patterns feedback](feedback_patterns.md) — corrections and confirmations from past sessions
- [External resources](reference_resources.md) — documentation URLs and file paths
```

Each line is: `- [Descriptive title](filename.md) — one-line description of relevance`

The description is the most important part — it tells the agent whether this memory is relevant to the current session. Good descriptions are specific: "corrections about handler patterns in the Application layer" is more useful than "backend patterns."

---

## Memory Types

### User Memories

User memories describe the person working with the agent. They persist across projects because they reflect the individual, not the project.

What to include:
- Role: "Senior backend engineer at Aurigo Software Technologies, building the Maintain product"
- Expertise: "Strong .NET background. Moderate TypeScript experience. Unfamiliar with PostGIS."
- Preferences: "Prefers unit tests written alongside implementation. Wants inline comments on complex calculations. Prefers handler patterns over repository patterns."
- Working style: "Reviews code diffs before accepting. Asks for explanations of non-obvious choices. Does not like agents that make unasked-for changes to other files."

What not to include:
- Personal information beyond the professional context
- Preferences that are project-specific (those go in project memories)
- Information that changes frequently (current task, current sprint)

### Project Memories

Project memories describe the current state of the specific project. They should be updated regularly as the project evolves.

What to include:
- The current implementation state of each module (complete, in progress, not started)
- Key architectural decisions made in the project (beyond what is in the ADRs — the reasoning and trade-offs that did not fit in the formal ADR)
- Known issues and their current status
- The current sprint focus

Example `project_state.md`:
```markdown
# Project State — Aurigo Maintain

Last Updated: 2026-07-18

## Module Status
- Asset Registry: Complete (entities, handlers, API, tests, basic UI)
- Inspections: Backend complete. Frontend: form complete, list page in progress.
- Capital Needs: Not started
- Risk Scoring: Not started
- EAM Integration: Cityworks adapter scaffolded, not functional

## Current Sprint (Sprint 4)
Focus: Inspections frontend — complete the list page, add photo upload, add mobile layout

## Known Issues
- The InspectionRecord entity does not yet have a Status field (Draft/Submitted/Approved) 
  — this was deferred to Sprint 5
- The migration AddInspectionIndex failed on the development database for one engineer 
  — the workaround is to drop and recreate the dev database

## Technical Debt Noted
- CreateAssetCommandHandler has a direct DbContext dependency injected through the 
  constructor rather than the IUnitOfWork pattern — refactor in Sprint 6
```

### Feedback Memories

Feedback memories are the most high-value memory type. They capture corrections (what the agent did wrong and how it should behave differently) and confirmations (what the agent did right and should continue doing).

Every correction should be saved as a feedback memory immediately after it occurs. If the engineer corrects the agent in session and does not save the memory, the same mistake will recur.

Format for a correction:
```markdown
## Correction: [Brief Title]
Date: YYYY-MM-DD
Context: [What task was being done when the mistake occurred]
Mistake: [What the agent did wrong]
Correct behavior: [What the agent should do instead]
Reference: [File or pattern that demonstrates the correct behavior]
```

Format for a confirmation:
```markdown
## Confirmation: [Brief Title]
Date: YYYY-MM-DD
Context: [What task demonstrated this]
Correct behavior: [What the agent did right that should be reinforced]
```

Example feedback entry:
```markdown
## Correction: AsNoTracking on Read Queries
Date: 2026-06-15
Context: Implementing GetInspectionsByAssetQueryHandler
Mistake: Agent used tracked queries (.Include(...)) for a read-only operation, causing 
unnecessary change tracking overhead.
Correct behavior: All read-only queries (any query handler that returns data but does 
not modify it) must call .AsNoTracking() on the DbSet or query root.
Reference: Application/Assets/Queries/GetAssetByIdQueryHandler.cs — line 18
```

### Reference Memories

Reference memories point to external resources. They prevent agents from searching for things that have already been found.

What belongs here:
- Documentation URLs for external libraries, APIs, and tools
- File paths for key patterns in the codebase that should always be referenced
- External system API documentation (Cityworks API, Maximo REST API)
- Links to the engineering playbook sections most relevant to the project

What does not belong here:
- Code snippets (those belong in the codebase itself)
- Temporary URLs (search result links, Stack Overflow answers — find the primary source)

---

## What Does NOT Get Saved to Memory

Memory files are not a substitute for code, documentation, or commit messages. Overloading the memory system with the wrong content makes it expensive to load and reduces its relevance.

**Code patterns:** Do not save code snippets to memory. The code itself is in the repository. "The correct handler pattern is [paste 50 lines of code]" wastes memory space that should be used for context and guidance. Instead: "The correct handler pattern is demonstrated in `Application/Assets/Commands/CreateAssetCommandHandler.cs`."

**Architecture documentation:** Architecture decisions belong in ADRs. If a decision is important enough to remember, it is important enough to get a proper ADR. Save the ADR reference in memory, not the content.

**Sprint-level task tracking:** What is in the current sprint, what tasks are in progress, what stories are blocked — this is ephemeral. Keep it in the sprint tracking tool. Memory is for durable context that outlasts the current sprint.

**Debugging session transcripts:** The fix for a bug belongs in the code. The explanation belongs in the commit message. Not in memory. The exception is if the debugging session revealed a systematic pattern issue that will recur — in that case, save a feedback memory about the pattern.

---

## Memory Maintenance

Memory files accumulate. Without active maintenance, they become stale, contradictory, or irrelevant. Stale memories are dangerous — an agent confidently acting on incorrect memory produces wrong outputs.

**Maintenance cadence:**
- End of every sprint: review `project_state.md` and update module status
- After a significant architecture decision: update relevant project memories and add the ADR reference
- After any agent correction: immediately add to `feedback_patterns.md`
- Monthly: review all memory files for staleness, remove outdated content

**Staleness indicators:**
- The memory describes a module state that has changed (e.g., "Inspections: not started" when it is now complete)
- The memory references a file path that no longer exists
- The memory references a pattern that was superseded by a new ADR
- The `Last Updated` date is more than two sprint cycles old

**Conflict resolution:** When two memory files contain contradictory information (a feedback memory says "do X" and a project memory says "the pattern is not-X"), the more recent entry wins. The conflicting older entry should be updated or deleted.

---

## Memory Lifecycle

```
Creation → Active Use → Update → Deprecation → Deletion
```

**Creation:** A new memory is created when a session produces context that should persist. Common creation triggers: first session on a project, a correction that reveals a systematic pattern, a new project decision.

**Active use:** The memory is loaded in sessions where it is relevant. The `MEMORY.md` index entry ensures it is surfaced when relevant.

**Update:** The memory is updated when the context changes. A project memory for module state is updated at the end of every sprint. A feedback memory may be updated if the pattern changes.

**Deprecation:** The memory is still present but marked stale. Add a note: "DEPRECATED: this pattern was superseded by ADR-007 on 2026-07-01." Keep it briefly so agents can see the supersession, then delete.

**Deletion:** After one sprint cycle with the deprecation notice, delete the memory file and remove its entry from `MEMORY.md`. Orphaned index entries cause the agent to look for files that do not exist.

---

## Memory Size Limits and Budgets

The memory system has real constraints. Exceeding them silently degrades every session that loads memory.

**Hard constraints:**

- `MEMORY.md` index file must be under 200 lines. This is loaded in every session; it must fit in the effective attention window at the top of every prompt.
- Any single memory file loaded via the index should be under 1,000 lines. Longer files should be split by topic and linked from the index with more specific descriptions so the agent can select what to load.
- Total memory directory size (all files combined) should be under 200 KB. Above this, load times slow and agents start to skip files.

**Soft budgets:**

- Feedback memories: 30-50 items maximum before consolidation. Group related corrections into one file per topic ("EF Core patterns," "handler patterns," "test patterns").
- Project state memories: one file per module. Consolidate quarterly.
- Reference memories: no hard cap, but audit annually — most external URL references become stale.

**Enforcement:**

- Pre-session check: if `MEMORY.md` exceeds 200 lines, session start warns the engineer.
- Monthly audit: engineering manager reviews the aggregate memory footprint per team member. Sustained growth without corresponding audit signals the engineer is not pruning.

---

## Cross-Session Continuity Protocol

The memory system is Aurigo's mechanism for continuity across sessions. The protocol for handoff:

**End of session:**

1. If any correction was made this session, write it to `feedback_patterns.md` before ending the session. Do this at the moment of the correction, not at end — end-of-session context is unreliable.
2. If the session produced durable knowledge (a summary of a module, a discovery of a system's structure, an evaluation of options), save it. Small items go to a memory file; larger items (multi-page discovery outputs) go to `vault/sessions/YYYY-MM-DD-topic.md` with a reference from a memory file.
3. If the session established a new pattern that all future work must follow, update `CLAUDE.md` — this is durable at the project level, not just for you.
4. Update `project_state.md` with any module status changes.

**Start of next session:**

1. Session automatically loads `MEMORY.md`. Verify the index reflects current reality — a stale index confidently misdirects.
2. Reference the relevant memory files by name in your first message ("read `feedback_patterns.md` for the EF Core corrections from last week").
3. If the session is continuing a specific in-progress task, reference the corresponding `vault/sessions/` file if one exists.

**Between sessions of different engineers:**

Memory is per-user by default (each engineer has their own `~/.claude/projects/[hash]/memory/`). To share knowledge across engineers, use durable project artifacts: ADRs, playbook updates, PR discussions, or files in `vault/`. Do not rely on cross-user memory synchronization — it is not automatic and duplicating memory files across users creates version-skew problems.

---

## Memory Audit Process

Memory audits happen at three cadences.

### Weekly self-audit (5 minutes)

At the end of the last working day each week, each engineer opens `feedback_patterns.md` and any project memory they updated. They:

- Delete entries that are no longer relevant.
- Consolidate duplicates.
- Verify `Last Updated` dates are current for entries they modified.

### Sprint retrospective audit (10 minutes, team level)

During the retrospective, the team reviews any memory changes shared during the sprint. Corrections that would benefit the whole team are promoted to CLAUDE.md or the playbook.

### Quarterly deep audit (1 hour, individual)

Each engineer performs a full audit of their memory directory each quarter:

- Read every file. Delete any file not touched in 90+ days unless it is still relevant.
- Reindex — rewrite `MEMORY.md` from scratch based on what actually exists.
- Consolidate similar files. Split files that have grown beyond 1,000 lines.
- Verify all URL references in reference memories still resolve.

The quarterly audit is not optional. Stale memory is worse than no memory because the agent will confidently follow outdated guidance.

### Audit signals

The following are signals that a memory audit is overdue:

- Agent behavior differs from what memory says it should do.
- Multiple memory files have `Last Updated` dates older than one quarter.
- New engineers on the team ask questions whose answers are in memory files they cannot see.
- Corrections in feedback memories are being made and re-made — indicates memory is not being loaded consistently or the index is out of date.
