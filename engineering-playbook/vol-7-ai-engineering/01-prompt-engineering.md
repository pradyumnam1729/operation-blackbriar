# Prompt Engineering Standards for Aurigo

Prompt engineering is the practice of writing instructions that produce high-quality, consistent outputs from an AI model. At Aurigo, prompts are treated like code: they are versioned, reviewed, refined, and stored in the prompt library (Volume 10). A poorly written prompt is a bug. A well-written prompt is an asset that can be reused across many tasks and many engineers.

This document establishes the standards Aurigo uses for all prompts directed at Claude Code and other Claude-based AI agents. It covers the CRAFT framework for structuring prompts, the context layers every effective Aurigo prompt must include, prompt patterns by task type, anti-patterns to avoid, iteration methodology, and token efficiency techniques.

---

## The CRAFT Framework

Every effective prompt for Aurigo work follows the CRAFT structure. CRAFT is not a rigid template — it is a checklist of dimensions that, when all present, reliably produce high-quality outputs.

### C — Context

Give the agent everything it needs to understand the world it is operating in. An AI agent with no context will produce generic, syntactically correct code that violates your patterns, ignores your constraints, and fits no particular codebase well.

Context for Aurigo work has four layers:
1. **Company context** — Aurigo Software Technologies builds enterprise SaaS for infrastructure owners. The buyer is either a public agency (DOT, city, county) or a private owner (manufacturer, utility, data center). The product manages the full infrastructure lifecycle: Plan → Build → Maintain.
2. **Product context** — Which product is affected (Masterworks or Primus)? Which module (Asset Registry, Inspections, Capital Needs, Risk Scoring, EAM Integration)? Which deployment mode (Integrated, Hybrid, Native)?
3. **Technical context** — .NET 8 Clean Architecture. EF Core 8 + PostgreSQL 16 + PostGIS. React 18 + TanStack Router + shadcn/ui. Multi-tenant (tenant_id enforced globally via EF query filter). JWT authentication. Specific file paths and existing patterns to follow.
4. **Task context** — The specific user story being implemented, the acceptance criteria, the constraints that apply to this story (performance, security, backward compatibility).

### R — Role

Define who the agent is. An agent that knows it is "the Backend Lead for Aurigo Maintain, responsible for implementing MediatR handlers following Clean Architecture patterns" will produce better code than an agent told only to "write a handler."

The role defines the agent's expertise, its responsibilities, and — importantly — what it should refuse to do. A backend agent should decline to make frontend architecture decisions. A test generation agent should decline to write production code. Boundary enforcement prevents agents from drifting into areas where their outputs are unreliable.

### A — Action

The action must be specific and unambiguous. Vague actions produce vague results.

Compare:
- Vague: "Handle the inspection creation feature."
- Specific: "Write a MediatR command handler (CreateInspectionRecordCommandHandler) that persists a new InspectionRecord entity, enforces tenant isolation, publishes an InspectionCompleted domain event, and returns the new inspection ID. Follow the same implementation pattern as CreateAssetCommandHandler."

A specific action includes: a named operation, the exact files to create or modify, the patterns to follow, and the output format.

### F — Format

Specify how the output should be structured. Without a format instruction, agents may produce output in whatever form seems natural to them — which may not match what you need.

Format instructions for Aurigo work:
- "Create the file at path: `Application/Inspections/Commands/CreateInspectionRecordCommandHandler.cs`"
- "The class must implement `IRequestHandler<CreateInspectionRecordCommand, Guid>`"
- "Write unit tests following the Arrange-Act-Assert pattern used in `UnitTests/Assets/CreateAssetCommandHandlerTests.cs`"
- "Return a markdown document with sections: Summary, Technical Analysis, Recommendation"

### T — Tone

Production-quality output. No placeholder text. No "TODO: implement this" comments in generated code. No "lorem ipsum" in generated documentation. Authoritative, not speculative. If the agent does not know something, it should say so and ask — not generate plausible-sounding content that may be wrong.

The tone instruction is often implicit in the context, but making it explicit — "This is production code for a paying enterprise customer" — noticeably improves output quality.

---

## Context Layers in Practice

Aurigo prompts must always include all four context layers. Here is the contrast between insufficient and complete context:

**Insufficient context:**
```
Write a handler for creating inspections.
```

This produces: a generic handler that probably doesn't use MediatR, doesn't enforce tenant isolation, doesn't publish domain events, doesn't follow Aurigo's handler naming conventions, and creates files in the wrong locations.

**Complete context:**
```
You are the Backend Lead for Aurigo Software Technologies, implementing a feature on 
Aurigo Maintain.

## Company Context
Aurigo Maintain is an asset intelligence platform for infrastructure owners (DOTs, cities, 
counties). The codebase uses .NET 8 Clean Architecture with layers: Api, Application, 
Domain, Infrastructure. Every aggregate root has a tenant_id enforced by EF Core global 
query filters. Authentication is JWT with claims: tenantId, userId, role.

## Tech Stack
- .NET 8 Web API
- MediatR (CQRS — commands in Application/[Domain]/Commands/, handlers co-located)
- EF Core 8 + Npgsql + PostGIS
- PostgreSQL 16
- FluentValidation (validators in Application/[Domain]/Validators/)
- AutoMapper (profiles in Application/[Domain]/Mappers/)

## Task
Implement the CreateInspectionRecord feature.

The MediatR command CreateInspectionRecordCommand should contain:
- AssetId (Guid, required)
- InspectorId (Guid, required — must be a user with Inspector role in tenant)
- InspectedAt (DateTimeOffset, required, cannot be in the future)
- ConditionScore (int, required, range 0-5)
- Notes (string, optional, max 2000 chars)
- DefectRecords (List<CreateDefectRecordDto>, optional)

The handler must:
1. Verify the asset exists in the current tenant (throw NotFoundException if not)
2. Create a new InspectionRecord entity
3. Add any DefectRecords from the command
4. Save via DbContext
5. Publish InspectionCompleted domain event via IPublisher
6. Return the new inspection's Guid

## Files to Create
1. `Application/Inspections/Commands/CreateInspectionRecordCommand.cs`
2. `Application/Inspections/Commands/CreateInspectionRecordCommandHandler.cs`
3. `Application/Inspections/Validators/CreateInspectionRecordCommandValidator.cs`
4. `Domain/Events/InspectionCompleted.cs` (if not already exists)

## Pattern Reference
Follow the same structure as:
- `Application/Assets/Commands/CreateAssetCommand.cs`
- `Application/Assets/Commands/CreateAssetCommandHandler.cs`
- `Application/Assets/Validators/CreateAssetCommandValidator.cs`

## Constraints
- Never expose Domain entities from the handler return — return the Guid only
- The global EF query filter handles tenant isolation; do not add manual tenant_id 
  filtering in handler logic
- FluentValidation handles all input validation; do not throw ArgumentException from 
  the handler body
- Follow the existing namespace conventions exactly
```

The second prompt takes longer to write but produces implementation-ready code on the first pass. The time invested in prompt writing is recovered in reduced iteration cycles.

---

## Prompt Patterns by Task Type

### 1. New Feature Prompt

A new feature prompt always includes:
- All four CRAFT dimensions
- The user story (as a user, I want..., so that...)
- The acceptance criteria in Gherkin or equivalent
- The exact files to create or modify
- A reference to the most similar existing feature ("follow the same pattern as X")
- Constraints specific to this feature (performance requirements, backward compatibility, permissions)

### 2. Bug Fix Prompt

A bug fix prompt includes:
- The exact error message and stack trace
- The reproduction steps (what inputs, what environment)
- The file and line number where the bug is located
- The expected behavior vs. actual behavior
- A constraint not to change behavior elsewhere ("fix only this bug, do not refactor unrelated code")

Example:
```
## Bug Report
Error: NullReferenceException at InspectionController.cs:47
Stack trace: [paste]
Reproduction: POST /api/v1/inspections with DefectRecords: null

Expected: Handler accepts null DefectRecords and creates inspection with empty defect list
Actual: Throws NullReferenceException when accessing DefectRecords.Count

File: Application/Inspections/Commands/CreateInspectionRecordCommandHandler.cs
Line: ~47

Fix only this null handling. Do not refactor any other part of the handler.
```

### 3. Refactoring Prompt

A refactoring prompt includes:
- The specific anti-pattern to remove
- The specific pattern to apply
- The files affected (list them all)
- A clear statement that observable behavior must not change
- A requirement to run and pass all existing tests after the refactoring

Example:
```
## Refactoring Target
Anti-pattern: Direct EF queries in InspectionController (business logic in controller layer)
Target pattern: Move all queries to MediatR queries in Application/Inspections/Queries/

Files with the anti-pattern:
- Api/Controllers/InspectionsController.cs — contains direct DbContext usage

Target files:
- Application/Inspections/Queries/GetInspectionsByAssetQuery.cs (create)
- Application/Inspections/Queries/GetInspectionsByAssetQueryHandler.cs (create)
- Api/Controllers/InspectionsController.cs (remove direct DbContext, send query via mediator)

Constraint: Do not change any controller action signatures or response DTOs.
All existing integration tests must pass after the refactoring.
```

### 4. Test Generation Prompt

A test generation prompt includes:
- The method under test (file path, class, method name)
- All code paths to cover (happy path, each validation failure, error states, boundaries)
- The testing framework (xUnit, FluentAssertions, Testcontainers or Vitest, RTL)
- The test builder patterns available in the project
- A constraint not to write tests that only pass when the implementation is mocked out incorrectly

Example:
```
## Method Under Test
File: Application/Calculations/RulCalculator.cs
Method: CalculateRemainingUsefulLife(double currentConditionScore, double deteriorationRate, 
        double totalUsefulLifeYears, double installedAge)

## Code Paths to Cover
1. Normal calculation: condition 4.0, rate 0.2, life 50, age 10 → expected RUL
2. Asset at end of life: condition 0, rate 0.2, life 50, age 50 → RUL = 0 (not negative)
3. New asset: age = 0, condition = 5 → RUL = totalUsefulLifeYears
4. Invalid inputs: negative deterioration rate → throws ArgumentOutOfRangeException
5. Invalid inputs: condition > 5 → throws ArgumentOutOfRangeException
6. Zero useful life → throws ArgumentOutOfRangeException

## Framework
xUnit + FluentAssertions. No mocking needed (pure function).
Test file: UnitTests/Calculations/RulCalculatorTests.cs
Follow the same structure as UnitTests/Calculations/ArvCalculatorTests.cs
```

### 5. Architecture Review Prompt

An architecture review prompt includes:
- The specific PR or change to review
- The ADRs that are most relevant
- The checklist to evaluate against
- The format for the review report

See Volume 10 (`vol-10-claude-prompts/02-architecture-review.md`) for the complete, ready-to-use architecture review prompt.

---

## Anti-Patterns in Prompts

The following prompt patterns consistently produce poor results. They should never be used in Aurigo prompt library entries.

**Vague actions:** "Fix the issue," "Make it better," "Update the component." These produce outputs that technically respond to the instruction but do not solve the actual problem.

**Missing context:** Prompts that do not specify the tech stack, the Clean Architecture layer, or the file location. The agent invents conventions that feel plausible but conflict with the existing codebase.

**Missing constraints:** Prompts that do not specify what the agent must NOT do. Without constraints, agents optimize for features they find interesting or for patterns from their training data that conflict with Aurigo's conventions. Critical constraints to always include: multi-tenancy requirement, security requirements (all endpoints need [Authorize]), EF Core read-query patterns (AsNoTracking), not returning Domain entities from controllers.

**Missing file references:** Prompts that describe what to do but not where. "Create a handler" without specifying the path produces files in unpredictable locations.

**Missing pattern references:** Prompts that ask for new functionality without referencing an existing implementation to follow. Agents will invent patterns. Some will be good. Many will not. Reference patterns eliminate this variance.

**Overly long prompts with pasted code:** Pasting the full content of a 300-line handler to explain context consumes large amounts of the context window unnecessarily. Instead, reference the file by path and let the agent read it: "read `Application/Assets/Commands/CreateAssetCommandHandler.cs` and follow its structure."

---

## Prompt Iteration

Even well-written prompts sometimes produce outputs that miss the mark. The iteration protocol:

1. **Identify what was missing.** Did the agent misunderstand the task (action problem)? Produce code for the wrong stack (context problem)? Create files in the wrong location (format problem)? Ignore a constraint (constraint problem)?

2. **Add the missing piece.** Do not simply re-run the same prompt. Add the specific context, constraint, or format instruction that was absent.

3. **Re-run.** Check whether the output addresses the original failure mode.

4. **Update the prompt library.** If the improved prompt produces significantly better results, update the corresponding entry in Volume 10 so every future engineer benefits.

5. **Do not chase a bad prompt forever.** If two iterations have not produced an acceptable output, switch approaches: start fresh with a different framing, try a different task decomposition, or handle the complex part manually.

---

## Token Efficiency

Claude Code has a context window that can be filled quickly with large codebases. Efficient prompts leave room for the agent to think and produce good output.

**Front-load constraints.** The most important constraints should appear first, not buried in a long prompt. Agents read prompts from the top; constraints at the bottom are more likely to be missed.

**Reference files by path, do not paste them.** "Read `Application/Assets/Commands/CreateAssetCommandHandler.cs`" is far more efficient than pasting the entire file. The agent reads the file directly and this also ensures it sees the current version of the file, not a stale paste.

**Use "follow the same pattern as" freely.** This single phrase can replace pages of specification. "Follow the same pattern as the CreateAsset feature" communicates naming conventions, file structure, handler patterns, validator structure, and mapper patterns in six words.

**Chain agents.** A single prompt that asks an agent to research the codebase, design the implementation, write all code, and write all tests is doing too much. Break this into a research agent (low context cost), a design agent (moderate context cost), an implementation agent (moderate context cost), and a test agent (lower context cost). Each agent starts fresh and focused.

**Summarize previous context.** When starting a new agent session that depends on work from a previous session, write a brief context summary rather than pasting the previous conversation. "In the previous session, we implemented the CreateInspectionRecord command. Today we are implementing the UpdateInspectionRecord command. The InspectionRecord entity has: [fields]."

---

## Prompt Quality Checklist

Before adding a prompt to the Volume 10 library, verify:

- [ ] Company context included (Aurigo, infrastructure lifecycle, public/private sector)
- [ ] Product context included (Maintain, which module, which deployment mode if relevant)
- [ ] Technical context included (stack, Clean Architecture layer, specific patterns)
- [ ] Task action is specific and unambiguous
- [ ] Files to create or modify are listed with full relative paths
- [ ] A reference implementation is cited ("follow the same pattern as...")
- [ ] Critical constraints are listed explicitly (multi-tenancy, auth, no returning entities)
- [ ] Output format is specified
- [ ] No placeholder text in the prompt itself
- [ ] The prompt has been tested and produces acceptable output

Prompts that pass this checklist are promoted to the Volume 10 library. Prompts that fail remain in draft until they are improved.

---

## Context Window Management

Claude's context window is finite. A long session that reads dozens of files, accepts many edits, and iterates on prompts eventually fills the effective attention window and begins to lose earlier content — a phenomenon that shows up as "the agent forgot the constraint I stated three prompts ago."

At Aurigo, context window discipline is part of prompt engineering, not a separate concern.

**Signs the context window is getting tight:**

- The agent starts re-asking for information you already provided.
- The agent produces output inconsistent with a decision made earlier in the session.
- The agent's plans start missing files it edited earlier.
- Response quality drops mid-session even though the task complexity did not.

**Mitigations:**

- **Checkpoint summaries every 30 minutes of active work.** Ask the agent to summarize what has been done, decided, and remains. Paste that summary back as your next user message. This refreshes the important content in recent-attention position.
- **Split long tasks across sessions with a written handoff.** A research session produces a summary. An implementation session starts fresh, reads the summary, and works. Each session runs on a focused, current context.
- **Compact memory files.** Anything durable should be in `MEMORY.md`-linked files, not in the session. `MEMORY.md` is small and always loaded; large session content is not.
- **Retire finished sub-tasks from the working context.** If a sub-task is done and reviewed, remove it from the working set — do not keep referencing it, because the agent will keep re-considering it.

The CLAUDE.md structure itself is Aurigo's primary context-window strategy: by keeping the top-level project context concise (under 200 lines) and linking to detail rather than embedding it, we ensure agents always have the essential ground rules loaded without paying token cost for content they may not need this session.

---

## Token Cost Awareness

Prompt engineering is also cost engineering. A prompt that produces the right result in 5,000 output tokens is better than one that produces the right result in 50,000 — not just because of raw cost, but because a shorter output is easier to review, more likely to be reviewed carefully, and less likely to hide subtle errors in verbose scaffolding.

Rough Aurigo cost rules for prompt authors:

- **Every 1,000 input tokens costs a few tenths of a cent on Sonnet, tens of cents on Opus.** Ten cached prompts of 5,000 tokens each is negligible; one uncached prompt of 100,000 tokens is not.
- **Every 1,000 output tokens costs roughly 5x the input rate.** Output-heavy prompts (long code generation, verbose reviews) dominate cost.
- **Cache hit vs cache miss on the same prefix is a 10x cost difference.** Structuring prompts so the stable prefix comes first is a real optimization, not a stylistic preference.

For the full cost model, see `15-ai-cost-management.md`.

### Compact prompt patterns

The following patterns produce good outputs at lower cost:

- **"Read X, then do Y"** is cheaper than pasting X into the prompt.
- **"Follow the pattern in Z"** is cheaper than describing the pattern in detail.
- **"List the files you would modify, then wait"** is cheaper than asking for a full implementation up front — you can correct the plan before spending output tokens on wrong code.
- **"Produce output in markdown with these sections: A, B, C"** is cheaper than open-ended "produce a report" — the structure caps output length.

### Prompts that should be short

- Bug fixes with a clear stack trace: the diagnosis should not need a page of context.
- Test generation for a single method: the method itself is the primary input; extensive setup is a smell.
- Documentation for a single endpoint: the code is the source; a short prompt suffices.

### Prompts that legitimately need to be long

- Feature implementation with multi-layer coordination and explicit constraints.
- Architecture review of a large PR (the diff itself dominates length).
- RFC drafting (produces long structured output as designed).
