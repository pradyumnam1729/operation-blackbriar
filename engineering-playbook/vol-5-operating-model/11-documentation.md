# 11 — Documentation

Documentation at Aurigo is treated as shipped code. It is written, reviewed, versioned, and maintained alongside the features it describes. Documentation that lives only in someone's head, only in a chat log, or only in a tool that is not the repository does not exist for engineering purposes.

This document defines what documentation is required for each type of change, who writes it, who reviews it, AI-assisted documentation workflows, and the anti-patterns that make documentation systems fail.

---

## The Standard: If It's Not in the Repo, It Doesn't Exist

This is not a philosophical position — it is a practical one. Aurigo is an AI-native organization using Claude Code. Agents operating on the codebase can read files in the repository. They cannot read Confluence pages, chat messages, or undocumented institutional knowledge in someone's memory.

Documentation that lives outside the repository:
- Is not available to AI agents doing discovery, implementation, or review
- Is not versioned with the code it describes (drift is inevitable)
- Is not subject to code review (quality cannot be maintained)
- Disappears when the person who wrote it leaves the organization

The repository is the source of truth. Confluence, Notion, and chat tools are communication surfaces — they can link to and summarize repository documentation, but they are not the authoritative record.

---

## Required Documentation by Change Type

| Change Type | Required Documentation | Who Writes | Who Reviews | Where |
|-------------|------------------------|------------|-------------|-------|
| New entity | Entity description in vault/domain/ | Engineer | Lead Engineer | `vault/domain/[Entity].md` |
| New API endpoint | Swagger annotations (`[ProducesResponseType]`, `[SwaggerOperation]`) | Engineer | Reviewer (in PR) | Controller file |
| New calculation | Calculation specification with formula, inputs, outputs, examples | Engineer + Domain Expert | Lead + Domain Expert | `vault/calculations/[Name].md` |
| New ADR | Architecture Decision Record | Lead Engineer | Peer Engineers | `engineering-playbook/vol-3-architecture/adrs/` |
| New external integration | Integration spec: what data flows, failure modes, stub behavior | Engineer | Lead Engineer | `vault/integrations/[Service].md` |
| Breaking API change | Migration guide for consumers | Engineer | PM + Lead Engineer | `vault/api-changelog/[version].md` |
| New feature (user-facing) | User guide section update | PM (with engineer review) | PM | `docs/user-guide/` |
| Performance optimization | Before/after metrics, approach taken | Engineer | Lead Engineer | ADR or commit message |
| Sprint retrospective findings | Retrospective notes | Scrum Master / AI agent | Team | `vault/retrospectives/sprint-[N].md` |
| Tech debt incurred (deliberate) | Tech debt ticket with context | Engineer | Lead Engineer | Backlog + code comment |

**The PR checklist (document 09, item G5)** enforces this: if a PR changes behavior and does not update the relevant documentation, that is a `blocker` in code review.

---

## Documentation by Layer

Aurigo's documentation lives in specific locations by type. Do not invent new locations without team agreement.

**`CLAUDE.md` (repo root)**: AI orientation for the project. Tech stack, directory layout, commands, conventions, DO NOT list. Updated when: new conventions are introduced, new commands are added, new modules are created.

**`engineering-playbook/`**: Standards and processes. Updated when: processes change, new standards are adopted, new phases are completed. Reviewed quarterly at the architecture summit.

**`vault/`**: Obsidian vault for domain knowledge, calculations, ADRs, personas, integrations. Updated continuously as decisions are made and domain understanding deepens.

**`docs/user-guide/`**: User-facing documentation. Updated when features are released.

**`infra/swagger/`**: The OpenAPI spec for the API. Updated automatically by running `dotnet swagger` or equivalent on the backend. Never hand-edited.

**Code-level documentation**: XML doc comments on public APIs (`///`), inline comments for non-obvious logic. Updated in the same PR as the code being documented.

---

## AI-Assisted Documentation Workflows

### API Documentation from Code

The Swagger/OpenAPI spec is generated from code annotations. The AI agent helps ensure annotations are complete:

```
Review all controllers in Api/Controllers/.
For each action method, verify:
1. [SwaggerOperation(Summary = "...", Description = "...")] is present
2. [ProducesResponseType(typeof(TDto), StatusCodes.Status200OK)] is present for each possible response
3. [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)] is present for write endpoints
4. Parameter descriptions are documented

For any missing annotations, generate the annotation text for the engineer to review and add.
```

### ADR from PR

When a PR contains an architectural decision that was not preceded by a formal RFC (small decisions), the AI agent drafts a lightweight ADR for the engineer to review and commit:

```
This PR [description] makes the following architectural decision: [decision].
Using the ADR template in engineering-playbook/vol-3-architecture/adrs/TEMPLATE.md,
draft a lightweight ADR for this decision. Include:
- Context (why was this change needed?)
- Decision (what was chosen?)
- Consequences (what changes as a result?)
- Alternatives considered (what else was evaluated?)
The engineer will review and finalize before committing.
```

### User Guide from Story

When a new user-facing feature is shipped, the AI agent drafts user guide content from the story's AC:

```
Using the Acceptance Criteria from story [TITLE], draft a user guide section for the feature.
Format: task-oriented guide (step 1, step 2, ...) with a note on what the user will see at each step.
Audience: [persona name] — assume technical literacy with enterprise software but no programming knowledge.
Location: docs/user-guide/[section]/[feature].md
The PM will review and finalize.
```

### Release Notes from Git Log

At the end of each sprint, an AI agent drafts release notes:

```
Run: git log [previous-release-tag]..HEAD --oneline
From the commit messages, draft user-facing release notes.
Format:
## New Features
- [Feature] — [1-sentence user-facing description]

## Improvements
- [Improvement] — [1-sentence description]

## Bug Fixes
- [Bug fix] — [1-sentence description]

Exclude: migration commits, tooling commits, refactors that have no user-visible impact.
The PM reviews, rewrites any engineering-speak into user language, and approves before publishing.
```

---

## Documentation Review Process

Documentation is reviewed alongside code in the same PR. The reviewer applies the same standard to documentation that they apply to code: is it accurate, complete, and clear?

**Documentation review checklist:**
- [ ] Does the new documentation match the code that was shipped? (Accuracy)
- [ ] Are there any behaviors in the code that are not documented? (Completeness)
- [ ] Would a new engineer (or AI agent) reading this documentation understand what to do? (Clarity)
- [ ] Are there links to related documents where relevant? (Navigability)
- [ ] Is the documentation in the correct location per the layer definitions above? (Location)

**A PR that ships a calculation engine without a vault/calculations/ spec is incomplete.** The reviewer rejects it with a `blocker`: "Add vault/calculations/[Name].md documenting the formula, inputs, outputs, and worked example before merging."

---

## Code-Level Documentation Standards

### When to Write Inline Comments

Write an inline comment when:
- The code is correct but non-obvious. Example: a `+ 1` that compensates for a 0-based index
- A business rule is being enforced that is not obvious from the code
- A workaround is applied for a known issue (always reference the issue/ticket)
- A performance optimization is applied that changes the obvious implementation

Do NOT write comments that restate the code:
```csharp
// Bad: this is obvious
// Increment the counter
counter++;

// Good: this explains the why
// Offset by 1 because fiscal years in TAMP reporting are 1-indexed
var fiscalYearIndex = year - _fiscalYearBase + 1;
```

### XML Doc Comments (C# Public API)

All public methods, properties, and classes in the Application layer must have XML doc comments. These are consumed by Swagger and by IDE tooling.

```csharp
/// <summary>
/// Calculates the Remaining Useful Life (RUL) in years for an asset.
/// </summary>
/// <param name="request">The calculation inputs including installation date, design life, and current condition rating.</param>
/// <returns>
/// A <see cref="RulCalculationResult"/> containing the RUL in years, percentage life consumed,
/// and a flag indicating if the asset is overdue for replacement.
/// </returns>
/// <exception cref="ArgumentOutOfRangeException">
/// Thrown when <paramref name="request.CurrentConditionRating"/> is outside the range [1, 10].
/// </exception>
public RulCalculationResult Calculate(RulCalculationRequest request)
```

---

## The Anti-Pattern: Documentation That Lives Only in Confluence

Confluence is a communication and collaboration tool, not a documentation repository. Documentation placed in Confluence:

- Is not versioned with the code it describes
- Is not subject to PR review
- Drifts from the code as soon as an update is made without updating Confluence
- Is not accessible to AI agents operating on the codebase
- Disappears when the Confluence space is reorganized or the company changes tools

**The correct use of Confluence** (and equivalent tools): communication, draft documents, links to repository documentation, meeting notes. Confluence can link to a vault/ document or a playbook page, but it cannot be the authoritative source.

**When you find documentation that only exists in Confluence**: create a task to migrate it to the appropriate location in the repository. Link the Confluence page to the repository location. The Confluence page becomes a pointer, not the document.

---

## Documentation Debt

Documentation debt is real debt. It accumulates when:
- Features ship without specification documentation
- Calculations change without updating vault/calculations/
- ADRs are not created for architectural decisions made in PRs
- CLAUDE.md falls behind the current project state

Documentation debt is identified in:
- Monthly backlog review (AI agent scans for undocumented features)
- Architecture discovery runs that produce gaps ("I cannot answer discovery question Q3 from reading the repo")
- Onboarding friction reports from new engineers or agents

Documentation debt is tracked with the `tech-debt` label and the `documentation` sub-label. It counts toward the 20% sprint capacity reservation.

---

## Living Documentation vs. Reference Documentation

**Living documentation** changes frequently as the system evolves: CLAUDE.md, API annotations, vault/calculations/, vault/domain/. These are updated in every relevant PR.

**Reference documentation** stabilizes quickly and rarely changes: ADRs, vault/decisions/, engineering-playbook/ volumes. These are reviewed quarterly but not updated with every feature change.

Knowing the difference prevents two failure modes:
1. Treating living documentation like reference documentation (it becomes stale immediately)
2. Treating reference documentation like living documentation (engineers fear changing it and leave it inaccurate)
