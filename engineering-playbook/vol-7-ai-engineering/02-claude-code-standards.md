# Claude Code Standards for Aurigo

Claude Code is Aurigo's primary AI development tool. Every engineer has Claude Code installed and uses it daily. This document covers how Aurigo configures Claude Code, which models to use for which tasks, how memory is structured, quality checks for AI-generated code, and the protocols that ensure AI-assisted work meets the same standards as purely human-written code.

Claude Code is not an optional tool that some engineers happen to use. It is part of the standard engineering workflow, like git or dotnet CLI. Engineers who have not internalized Claude Code are operating at reduced capacity and should prioritize getting up to speed.

---

## CLAUDE.md Configuration

Every project root has a `CLAUDE.md` file. Claude Code automatically loads this file at the start of every session, injecting it into the agent's context. The `CLAUDE.md` is the most important piece of Claude Code configuration and the first file any engineer should read when joining a project.

### What CLAUDE.md Contains

A complete `CLAUDE.md` has these sections:

**What this is** — A 3-5 sentence description of the project. What does it do? Who uses it? What problem does it solve? This gives the agent the "why" that shapes all of its decisions.

**Tech stack (locked)** — An authoritative table of every technology in use. Include the specific version. "React 18" not "React". "EF Core 8" not "Entity Framework". The "locked" label signals to the agent that it should not suggest replacing these technologies.

**Directory layout** — The canonical directory structure. Not every file, but every significant directory with a one-line description of what it contains. This prevents agents from creating files in the wrong locations.

**Commands** — The exact commands to build, test, and run the application. Agents use these to verify that their changes work. An agent that cannot find the test command will skip testing.

**Build phases** — A brief description of the current build phase and what has been implemented. This tells the agent what already exists and prevents it from re-implementing things that are already done.

**Conventions** — The coding conventions that must be followed. Include: naming, patterns, and critical DO-NOTs. Every DO-NOT should have a reason; without a reason, agents reason around the constraint.

**DO NOT section** — The most important guard rails. Be specific. "Do not use SQL Server" not "use the right database."

### CLAUDE.md Best Practices

**Keep it under 200 lines.** A `CLAUDE.md` that exceeds 200 lines is a sign that it is trying to do too much. Move detailed content to `SKILLS.md` (how-to recipes) or the playbook, and link to it. An agent that cannot read the full `CLAUDE.md` in one pass will miss critical instructions.

**Every DO-NOT must have a reason.** Bad: "DO NOT use raw SQL." Good: "DO NOT use raw SQL — all data access goes through EF Core so the global tenant_id query filter is always applied. Bypassing EF Core bypasses multi-tenancy." The reason prevents the agent from overriding the constraint when it seems like the "obvious" thing to do.

**Link, do not embed.** Instead of pasting the contents of a complex script or a long pattern example into `CLAUDE.md`, reference `SKILLS.md` or a specific playbook file. `CLAUDE.md` should be a navigation document, not a documentation dump.

**Update when conventions change.** Stale instructions in `CLAUDE.md` are more dangerous than no instructions, because agents will confidently follow them. When a pattern changes, update `CLAUDE.md` on the same day. Assign this responsibility to the engineer who changed the pattern.

**The Aurigo Maintain CLAUDE.md** lives at `backend/Aurigo.AssetMaintenance/CLAUDE.md`. Verify it reflects the current state of the codebase before starting any significant agent-assisted development session.

---

## Model Selection

Aurigo uses three Claude models. Each has a different cost-capability tradeoff. Choose the right model for the task.

**claude-sonnet-4-6 (default):**
Use for all day-to-day development work: writing handlers, components, tests, documentation, migration code, prompt improvement. It is fast, high quality, and economical enough to use without hesitation for standard engineering tasks. When in doubt, use Sonnet.

**claude-opus-4-7 (architecture and complex design):**
Reserve for: complex architecture decisions, reviewing an RFC with significant tradeoffs, designing a system from scratch, evaluating competing approaches for a difficult problem, analyzing security implications. Opus is substantially more capable for complex reasoning but costs more per token. Do not use Opus for writing a CRUD handler.

**claude-haiku-4-5 (quick lookups and simple tasks):**
Use for: answering a quick question about a library, looking up a specific syntax, explaining a short code snippet, rephrasing a sentence. Haiku is fast and cheap but less capable for complex tasks. Do not use Haiku for implementation work.

**Model selection heuristic:**
- "I need to write or modify code" → Sonnet
- "I am making a design decision that will be hard to reverse" → Opus
- "I have a quick question with a factual answer" → Haiku

---

## Agent Types in Use

Claude Code supports several agent types that differ in their default behaviors.

**General-purpose agent (claude):** The default. Use for tasks that do not fit a specialized pattern. The general-purpose agent can read, write, execute commands, and make changes to the codebase.

**Explore agent:** Read-only. Use when you want the agent to analyze the codebase without making any changes. Safe to use when you are uncertain — if the agent cannot write files, it cannot make mistakes. Use Explore for: "What files implement the RUL calculation?", "What DTOs are returned by the Inspections API?", "Which controllers do not have [Authorize]?"

**Plan agent:** Use for designing implementation strategies before writing code. The Plan agent reads the codebase, reads the requirements, and produces an implementation plan. The plan is reviewed by a human before the implementation agent is run. Prevents the common failure mode of writing code for 30 minutes only to discover it needs to be restructured.

**Sub-agents spawned by the main session:** When using the Agents feature in Claude Code, sub-agents can be spawned with focused contexts. A parent agent handling a large feature can spawn a backend sub-agent and a frontend sub-agent in parallel, then review their outputs and merge them.

---

## Memory Architecture

Claude Code sessions are stateless — a new session has no memory of previous sessions. Shared memory files bridge this gap. The memory system is a set of markdown files stored in a project-specific directory under the user's home directory.

**Memory file location:**
```
~/.claude/projects/[project-hash]/memory/
├── MEMORY.md          ← index (loaded automatically in session context)
├── user_role.md       ← who is working, their expertise
├── project_*.md       ← current state of the project
├── feedback_*.md      ← corrections and confirmations from past sessions
└── reference_*.md     ← external resource pointers
```

The `MEMORY.md` index file is critical. Claude Code loads this file into the session context. It must be a concise index — one line per memory file — that points to the relevant memories for a given session. If the index is too long, it will not fit in context and the memory system fails.

**Memory types:**

*User memories* describe who is working: their role, expertise level, preferences, and working style. Example: "I am a backend engineer on the Aurigo Maintain team. I prefer detailed code comments on complex calculations. I want tests written alongside implementation, not after."

*Project memories* describe the current state of the project: what has been implemented, what is in progress, what key decisions have been made. Example: "The Asset Registry module is complete. The Inspections module is in progress — command handlers are done, query handlers are not yet implemented."

*Feedback memories* capture behavioral corrections and confirmations. Example: "Agent previously returned Domain entities from controllers — this was corrected. Always use DTOs." Or: "Agent correctly enforced tenant isolation in all query handlers — this pattern is confirmed correct."

*Reference memories* point to external resources: URLs, file paths, external system documentation. Example: "Cityworks API documentation: [URL]. PostGIS geometry type reference: [URL]."

---

## Session Starting Protocol

The beginning of a Claude Code session sets the quality of everything that follows. Follow this protocol at the start of every session:

**1. Load context:** Claude Code automatically loads `CLAUDE.md` and (if configured) `MEMORY.md`. Read the agent's context loading confirmation before starting work.

**2. State the current task clearly:** Before issuing any instructions, tell the agent what you are working on today in one sentence. "Today we are implementing the GetInspectionsByAsset query handler and the corresponding API endpoint." This focuses the agent's attention and prevents it from surfacing irrelevant patterns.

**3. Reference the task tracking:** "The task is story [ID] in the current sprint." If the agent can read the task tracking system, it should. If not, paste the relevant acceptance criteria.

**4. Run discovery if in unfamiliar territory:** If working in a module or area you have not touched recently, ask the agent to run a brief discovery before implementing. "Before we start, read the Inspections domain — the entity, the controller, the existing handlers — and summarize what is there." This discovery takes 2-3 minutes and prevents misaligned implementations.

**5. Review the plan before the implementation:** For stories of 5 points or more, have the agent write a brief implementation plan ("list the files you will create or modify and what you will do in each one") before writing any code. Review the plan. Correct it if needed. Then proceed.

---

## Quality Checks for AI-Generated Code

AI-generated code must pass the same quality bar as human-written code. The following checklist must be run on every AI-assisted PR before it is approved. Engineers are responsible for verifying these points — the reviewer is not solely responsible.

**Architecture:**
- [ ] The code follows Clean Architecture layer boundaries (no Domain imports in Infrastructure, no Infrastructure imports in Application, no direct Domain use in Controllers)
- [ ] Business logic lives in the Application layer (handlers, calculation engines), not in controllers
- [ ] Entities are not returned from controllers — DTOs are used

**Multi-Tenancy:**
- [ ] The EF global query filter is not bypassed (no raw SQL or FromSqlRaw calls that skip tenant filtering)
- [ ] Any manually constructed queries include tenant_id filtering
- [ ] Cross-tenant data access is not possible through the new code

**EF Core Patterns:**
- [ ] Read-only queries use `.AsNoTracking()`
- [ ] Related entities are loaded explicitly with `.Include()`, not through lazy loading (lazy loading is disabled)
- [ ] No N+1 queries (data required in a loop is loaded before the loop, not inside it)
- [ ] Pagination is applied before `.ToListAsync()` for queries that return potentially large result sets

**Security:**
- [ ] New API endpoints are decorated with `[Authorize]` (or have a documented reason for not being)
- [ ] Role-based authorization is applied where relevant (`[Authorize(Roles = "Inspector")]`)
- [ ] Input validation is implemented with FluentValidation
- [ ] No sensitive data (passwords, tokens, connection strings) is logged

**Tests:**
- [ ] New calculation logic has unit tests (target: 90%+ line coverage on `Calculations/`)
- [ ] New API endpoints have integration tests
- [ ] Edge cases from the acceptance criteria are covered in tests
- [ ] Tests pass locally

**Documentation:**
- [ ] New endpoints have Swagger XML comments (`/// <summary>`)
- [ ] Complex business logic has inline comments explaining the "why"
- [ ] The story acceptance criteria are verified (not just the code-level tests)

---

## Common Claude Code Failure Modes and Fixes

**Failure: Agent creates files in wrong locations.**
Fix: Add explicit file paths with full relative paths from the project root to the prompt. "Create file at: `src/Aurigo.AssetMaintenance.Application/Inspections/Commands/CreateInspectionRecordCommand.cs`"

**Failure: Agent ignores multi-tenancy.**
Fix: Add to the prompt: "Multi-tenancy is enforced via EF Core global query filters — tenant_id is applied automatically for all DbContext queries. Do not add manual tenant_id where conditions to EF queries. Do add tenant_id when writing manual SQL."

**Failure: Agent returns Domain entities from controllers.**
Fix: Explicitly reference the mapper pattern. "Return a DTO, not the entity. Follow the mapper pattern in `Application/Assets/Mappers/AssetProfile.cs`."

**Failure: Agent writes lazy-loaded navigation properties.**
Fix: "Lazy loading is disabled. Explicitly load all navigation properties using `.Include()` in queries. See `Application/Assets/Queries/GetAssetByIdQueryHandler.cs` for the correct pattern."

**Failure: Agent skips tests.**
Fix: Add tests to the deliverables explicitly. "Deliverables: 1. Handler implementation. 2. Validator. 3. Unit tests for the validator. 4. Integration test for the API endpoint. Tests are not optional."

**Failure: Agent modifies unrelated code.**
Fix: Add a constraint: "Only create or modify the files listed in this prompt. Do not change any other files, even if you see improvements."

---

## Model Selection Decision Tree

Model selection has a direct impact on cost, latency, and quality. Use this decision tree at the start of every significant task. When in doubt, start with Sonnet — it is the default because it hits the best balance of the three dimensions for our engineering workload.

```
Is the task a quick factual lookup or short rephrase?
├── Yes → Haiku (claude-haiku-4-5)
└── No → Continue

Does the task involve a decision that is hard to reverse
(architecture, security posture, evaluation of competing designs,
production migration strategy)?
├── Yes → Opus (claude-opus-4-7)
└── No → Continue

Does the task involve writing or modifying production code,
tests, or documentation for the Aurigo Maintain codebase?
├── Yes → Sonnet (claude-sonnet-4-6)
└── No → Continue

Does the task exceed 30 minutes of expected work or require
multiple tool-use steps and file reads/writes?
├── Yes → Sonnet
└── No → Haiku is acceptable if the task is well-scoped
```

### Cost / Capability / Speed Matrix

| Dimension | Haiku 4.5 | Sonnet 4.6 | Opus 4.7 |
|-----------|-----------|------------|----------|
| Relative cost per token | 1x | ~4x | ~20x |
| Relative capability on complex reasoning | Adequate for narrow tasks | Strong across the board | Best-in-class for hard problems |
| Relative speed (tokens/second) | Fastest | Fast | Slowest |
| Best-fit tasks | Quick lookups, syntax questions, short rephrases, single-file grep-then-answer | All standard engineering work: handlers, components, tests, docs, prompt drafts | Architecture design, RFC review, security analysis, deep debugging of intractable bugs |
| Wrong-fit tasks | Multi-file refactor, calculation formulas, security review | Novel architecture without any reference | Writing CRUD boilerplate — wastes cost |

### Cost floors and ceilings

- **Never use Opus for CRUD, boilerplate, standard tests, or routine documentation.** The cost premium is not justified.
- **Never use Haiku for calculation logic in `Application/Calculations/`.** Domain math is the highest-stakes code we ship — use Sonnet or Opus.
- **Never use Haiku for security-adjacent code (auth, tenant filtering, JWT handling).** Security review by Sonnet or Opus is mandatory.

---

## AI Cost Governance

Detailed budgets, monitoring, and enforcement live in `15-ai-cost-management.md`. The short version that every engineer must know:

- Every engineer has a monthly Claude Code budget (default: $150/engineer/month for individual contributors, $250/month for senior engineers and leads).
- Budgets are tracked via the Anthropic Console usage dashboard, reviewed monthly by the Engineering Director.
- Sustained overrun (more than one month at 150% of budget) triggers a conversation about workflow — usually the engineer is defaulting to Opus for tasks that Sonnet would handle, or is not using the CLAUDE.md properly and forcing the agent to re-discover context each session.
- Cost governance is not about restricting AI use. It is about ensuring that AI use is efficient. An engineer spending $500/month on Claude Code but shipping 3x the output of an engineer spending $50/month is doing the right thing.

---

## CLAUDE.md Maintenance and Ownership

The `CLAUDE.md` file is not "someone else's problem." It is the primary configuration surface for AI-assisted work at Aurigo. Stale `CLAUDE.md` produces confidently wrong output every day until it is corrected.

**Ownership.** Each project's `CLAUDE.md` has a named owner (recorded in the file itself, in a comment at the top). The owner is the Engineering Manager for the project by default, but responsibility can be delegated to a Tech Lead.

**Review cadence.** The owner reviews the `CLAUDE.md`:
- At the end of every sprint (5-minute review during retrospective preparation)
- After any ADR is accepted that affects patterns referenced in `CLAUDE.md`
- After any migration that renames a project, directory, or namespace
- Monthly, a full read-through for staleness

**Change protocol.** Every engineer can propose a `CLAUDE.md` change via PR. Reviewers are the owner plus one other senior engineer. Changes that add DO-NOT rules require an ADR or a link to an incident that motivated the rule (rules without a documented reason accumulate as noise).

**Freshness signal.** The top of `CLAUDE.md` records a `Last Reviewed:` date. Any date more than 30 days old is a signal to the owner and to any engineer opening the file that a review is due.

---

## Session Starting Protocol (Detailed)

The session start protocol described earlier is expanded here with the specific commands and checks.

**1. Confirm context loaded.** After Claude Code launches, verify in the first message that `CLAUDE.md` was loaded (the agent should reference at least one specific detail from it in its first reply — the tech stack version, a DO-NOT rule, a project structure element). If the agent's first reply does not reference `CLAUDE.md`, ask explicitly: "Confirm you have loaded CLAUDE.md and list the top three DO-NOT rules."

**2. State the task in one sentence.** "Today we are implementing X on branch Y." This anchors the session and provides a header for any transcript-review later.

**3. Level 1 indexing.** Run `git log --oneline -10` and `git status` to align session context with codebase state. This costs less than 30 seconds of agent time and prevents entire categories of misalignment.

**4. Reference the ticket.** If the task has a story ID, paste it or state it. The agent should re-read the acceptance criteria in its own words to confirm understanding.

**5. Plan first for stories >=5 points.** For any story sized 5 points or larger, require the agent to produce a plan (list of files, order of changes, testing approach) before writing code. This is not overhead — plans that miss a constraint are much cheaper to correct than half-written implementations that miss the same constraint.

## Session Ending Protocol

Sessions end well by capturing durable outputs before the session context is gone.

**1. Save any research or discovery outputs to memory or vault.** If the agent produced a summary, architecture map, or evaluation, save it to `vault/sessions/YYYY-MM-DD-topic.md` or to a memory file.

**2. Save corrections to feedback memory.** Any correction that would prevent a recurrence in a future session goes to `feedback_patterns.md`. Do this at the moment the correction happens, not at the end — end-of-session context is unreliable for reconstructing corrections.

**3. Commit or stash cleanly.** Do not leave a session with the agent's partial output uncommitted and unlabeled. Either commit to a WIP branch with a clear message, or stash with a description.

**4. Update CLAUDE.md if a new locked-in choice was made.** If the session established a new pattern that all future work must follow, update `CLAUDE.md` in the same commit as the pattern's first use.

**5. Update the task tracker.** State-of-work in the tracker is the durable record. Do not rely on session memory to survive.

---

## AI Agent Failure Mode Catalog

The following failure modes have been observed in Aurigo's Claude Code usage. Each has a signature, a root cause, and a mitigation. Extending this catalog is the responsibility of any engineer who identifies a new mode via retrospective or incident.

### 1. Hallucinated Library APIs

**Signature:** Code compiles-clean-in-your-head but fails to compile in reality, referencing a method or overload that does not exist. Or code compiles but the runtime throws MethodNotFoundException or MissingMethodException.

**Root cause:** Model drift between library versions; training data contained a similar API from a different library or version.

**Mitigation:** Always name the specific version in `CLAUDE.md` and in prompts ("EF Core 8.0.10, not 7.x"). When accepting a method call, confirm it exists in the installed version via `dotnet` API docs or `nuget.org` before running.

### 2. Wrong Library Version References

**Signature:** Prompt succeeds in producing code that uses a version different from the one installed.

**Root cause:** Model defaults to whatever version was most represented in training data.

**Mitigation:** Reference `Directory.Packages.props` or `package.json` in the prompt: "The version of MediatR in use is 12.x — do not use pre-12 syntax."

### 3. Invented Patterns

**Signature:** Agent produces a plausible-looking pattern that is not used anywhere in the Aurigo codebase — a new dependency injection style, a new query base class, a new error handling convention.

**Root cause:** Prompt did not reference an existing pattern to follow; the agent filled the gap with a pattern from training data.

**Mitigation:** Every implementation prompt names a reference file ("follow the pattern in `Application/Assets/Commands/CreateAssetCommandHandler.cs`").

### 4. Context Loss Mid-Session

**Signature:** Agent behavior changes partway through a session — patterns from earlier in the session are forgotten, prior corrections are re-made.

**Root cause:** Context window pressure. Long sessions with many file reads and edits eventually push earlier content out of the effective attention window.

**Mitigation:** For long sessions, produce a checkpoint summary every 30 minutes and paste it as a user message to bring key details back into recent context. For very long tasks, split into a research session (output = summary) and an implementation session (input = the summary), so each session runs on a focused, fresh context.

### 5. Silent Constraint Violation

**Signature:** Agent produces code that appears correct but violates a constraint stated at the top of the prompt (multi-tenancy, no domain entities returned, no lazy loading).

**Root cause:** Constraints buried in a long prompt; agent optimized for the visible task and lost track of the constraint.

**Mitigation:** Front-load critical constraints. State the top 3 constraints in the first paragraph and re-state them next to the specific instruction. For repeated violations, add the constraint to `CLAUDE.md` as a DO-NOT.

### 6. Over-Refactoring

**Signature:** Agent modifies files that were not in the requested change set, "improving" them along the way, sometimes breaking behavior.

**Root cause:** No explicit constraint against out-of-scope changes.

**Mitigation:** State explicitly: "Modify only the files listed. Do not change other files even if you see improvements. List any improvements you noticed as a follow-up in your summary." This shifts opportunistic edits from silent action to explicit report.

### 7. False Confidence in Test Results

**Signature:** Agent reports "all tests pass" but did not actually run the tests, or ran only a subset.

**Root cause:** Agent generates a plausible summary rather than executing.

**Mitigation:** Require explicit test command output in the agent's response ("paste the tail of the `dotnet test` output"). If the output is not present or looks fabricated, run the tests yourself.

### 8. Regulatory / Domain Citation Fabrication

**Signature:** Agent produces a formula, a default parameter value, or a compliance claim citing FHWA, AASHTO, ISO, or NBI without a specific document, section, or table number.

**Root cause:** These citations are ambient in training data; the model produces plausible references without verification.

**Mitigation:** Require a specific citation ("cite the exact FHWA circular and page") or reject the reference. For default parameter values, require the source to be verifiable by reading a document at a URL the agent can access.

### 9. Prompt Injection via User-Supplied Content

**Signature:** Agent behavior changes after processing a specific user-supplied record (inspection note, defect description, imported document). Agent takes actions or produces outputs not requested by the current user.

**Root cause:** Untrusted content entered the system prompt or a tool response and was interpreted as instructions.

**Mitigation:** See `13-ai-safety.md` — prompt injection threat model. User-supplied content is passed as data, never as instruction. Any agent that reads customer content has constrained tools and cannot execute arbitrary actions.

---

## When NOT to Use AI

A full treatment is in `16-when-not-to-use-ai.md`. Summary rules:

- **Do not use AI for JWT validation middleware, tenant extraction, or authorization policy code.** These have small change surfaces and severe consequences. Senior engineer, deep human review, no AI-generated code accepted without independent verification.
- **Do not use AI for cryptographic operations.** Use the established .NET APIs exactly as documented.
- **Do not use AI when the problem is genuinely underspecified.** Ask the human first. Garbage in, garbage out — with confidence.
- **Do not use AI for regulatory or legal text that will be sent externally without human review.** TAMP narrative, contract language, incident disclosures.
- **Do not use AI when you would not understand and be able to defend the output.** If you cannot explain it, you cannot ship it.
