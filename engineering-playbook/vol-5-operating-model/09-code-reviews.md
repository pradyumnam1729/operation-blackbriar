# 09 — Code Reviews

Code review is the primary mechanism for maintaining code quality, sharing knowledge, and catching bugs before they reach production. The goal is not to find as many issues as possible — it is to ship correct, maintainable code efficiently. A code review that blocks a PR for two days over stylistic preferences is not a quality mechanism; it is a bottleneck.

This document defines who reviews what, the complete review checklist, turnaround SLAs, feedback labeling conventions, how to give specific feedback, the AI-assisted first pass, and anti-patterns in code review culture.

---

## Who Reviews What

| Change Type | Minimum Reviewers | Approval Required From |
|-------------|-------------------|----------------------|
| Bug fix (small, < 5 files) | 1 engineer | Any engineer with domain knowledge |
| New feature (standard) | 2 engineers | 1 backend + 1 frontend (as appropriate) |
| New entity or migration | 2 engineers | Lead engineer mandatory |
| Security change (auth, permissions) | 2 engineers | Lead engineer mandatory + security reviewer |
| Architecture change | See document 08 | RFC approval → ADR → then standard PR |
| Tech debt refactor | 1 engineer | Lead engineer if touches core patterns |
| Calculation engine change | 2 engineers | Lead engineer + domain expert sign-off on formula |
| Frontend-only UI change | 1 engineer | Any frontend-literate engineer |
| DevOps / infra | 1 engineer | Lead engineer or DevOps owner |

"Lead engineer" means the technical lead. If the lead is the PR author, assign a different senior engineer.

**Self-review is not a substitute for peer review.** Complete the self-review checklist in document 07 before requesting peer review, but do not close a PR with only self-approval.

---

## Turnaround SLA

Code reviews must be completed within **24 business hours** of the review request. This is not aspirational — it is a team commitment that prevents the compounding cost of blocked work.

| PR Size | First Response SLA | Complete Review SLA |
|---------|-------------------|---------------------|
| Small (< 200 lines changed) | 4 business hours | 8 business hours |
| Medium (200–500 lines) | 8 business hours | 16 business hours |
| Large (500–1000 lines) | 8 business hours | 24 business hours |
| XL (> 1000 lines) | Discuss: split the PR | Discuss: split the PR |

PRs over 1000 lines of substantive change (not counting generated code, migrations, or JSON specs) should be split. A reviewer cannot effectively review a 2000-line PR — they will miss things. If the feature genuinely requires this many changes, split it into a backend PR and a frontend PR, or split by entity.

**When you are assigned a review:**
- Acknowledge within 2 hours during business hours ("On it — will review by [time]")
- If you cannot review within the SLA due to a planned blocker, reassign immediately

---

## Feedback Labeling Convention

Every comment on a PR is labeled with one of four prefixes. This makes the author's response action clear.

**nit:** A minor suggestion that does not affect correctness, behavior, or maintainability significantly. The author can take or leave this. Do not block a PR on a `nit`.

Example: `nit: Consider naming this variable 'conditionRating' instead of 'rating' for clarity.`

**suggestion:** An improvement that the reviewer believes is worthwhile but is not blocking. The author should consider it seriously and either implement it or explain why they disagree.

Example: `suggestion: This query loads all columns but only uses Name and Id. Consider projecting to reduce data transfer.`

**question:** A request for clarification. The reviewer is not sure the code is wrong, but needs explanation before they can form a judgment.

Example: `question: Why is this check done after the save rather than before? I want to understand the sequence.`

**blocker:** A required change before the PR can be approved. The reviewer believes the code as written has a bug, a security issue, a performance problem, a pattern violation, or is incorrect behavior relative to the AC. The author must either fix it or convince the reviewer their concern is mistaken.

Example: `blocker: This query does not filter by TenantId. If the global query filter is not applied to this entity, this returns cross-tenant data.`

**Rule**: A PR with unresolved `blocker` comments cannot be merged. A PR with unresolved `suggestion` or `question` comments can be merged at the author's discretion, ideally with a response explaining the decision.

---

## Complete Code Review Checklist

### Architecture (5 checks)

- [ ] **A1 — Layer boundaries respected**: No business logic in controllers. No EF/SQL in Domain. No external HTTP calls in Application. Each layer does only what it is responsible for.
- [ ] **A2 — No new patterns introduced without ADR**: If the PR introduces a pattern that differs from the existing codebase (e.g., a new base class, a new service abstraction, a new way to return errors), confirm there is an ADR or RFC. If not, flag as a `blocker`.
- [ ] **A3 — Multi-tenancy preserved**: Every new entity implements `IMultiTenantEntity`. Every new query is scoped by the global filter (not manually). No `.IgnoreQueryFilters()` without explicit justification and lead engineer approval.
- [ ] **A4 — External services behind interfaces**: No direct HTTP calls to external services from Application layer. Any new external dependency is behind `I[Service]Client`.
- [ ] **A5 — CQRS respected**: Commands return a result (not void). Queries do not modify state. Handlers are not calling other handlers (no handler chaining).

### Database (5 checks)

- [ ] **D1 — Migration reviewed**: Read the migration file. Confirm it creates the correct schema. Confirm there are no unexpected changes to existing tables. Confirm indexes are present for foreign keys and tenant-scoped queries.
- [ ] **D2 — No N+1 queries**: Review all DbContext queries in new handlers. Any `foreach` that contains a DbContext call is a potential N+1. Use `Include`/`ThenInclude` or batch queries.
- [ ] **D3 — Pagination for list queries**: List endpoints return paginated results. No endpoint returns an unbounded list. Confirm `Skip`/`Take` and total count are returned.
- [ ] **D4 — Geometry SRID**: Any geometry column is typed as `geometry(Geometry, 4326)`. Any geometry created in code uses SRID 4326.
- [ ] **D5 — No raw SQL in application code**: Migrations may contain raw SQL. Application code uses EF Core LINQ. If raw SQL is present in a handler, it is a `blocker` unless there is a documented performance exception.

### Security (5 checks)

- [ ] **S1 — Authorization on all endpoints**: Every new controller action has either `[Authorize]` with the correct policy/role, or `[AllowAnonymous]` with a written justification in the PR description. No unauthenticated endpoints by default.
- [ ] **S2 — No sensitive data in logs**: No JWT tokens, passwords, PII, or API keys logged anywhere in the changed code.
- [ ] **S3 — Input validation present**: Every write endpoint has a FluentValidation validator. Every field has appropriate constraints (max length, format, range).
- [ ] **S4 — No hardcoded secrets**: No connection strings, API keys, or credentials in code or config files committed to the repo.
- [ ] **S5 — No cross-tenant data access**: Verify with integration tests (see checklist item T3) that tenant isolation is preserved.

### Testing (5 checks)

- [ ] **T1 — Unit tests present**: All new calculation logic, validator rules, and handler logic have unit tests. Coverage for Calculations/ ≥ 90%, Domain ≥ 80%.
- [ ] **T2 — Integration tests present**: At least one integration test for each new endpoint, covering the happy path and at least two error cases.
- [ ] **T3 — Tenant isolation tested**: At least one integration test verifies that data from one tenant is not accessible to another.
- [ ] **T4 — All tests passing**: CI is green. No previously passing tests have been broken.
- [ ] **T5 — No test shortcuts**: No `// TODO: add test`, no empty test methods, no tests with only `Assert.True(true)`.

### Frontend (5 checks)

- [ ] **F1 — All data states handled**: Loading, error, empty, and data states are all rendered. No component crashes on undefined/null data.
- [ ] **F2 — Forms use react-hook-form + zod**: No uncontrolled inputs, no manual state management for form fields. Zod schema mirrors backend validator rules.
- [ ] **F3 — Generated client not hand-edited**: `src/api/` contains no manual changes. If the API client needed updating, `gen:api` was run and the regenerated files are committed.
- [ ] **F4 — No console errors in the running app**: The changed pages produce no console errors or warnings in Chrome DevTools.
- [ ] **F5 — Mobile viewport usable**: At 375px width, the changed pages are usable without horizontal scroll. Interactive elements meet minimum tap target size.

### General (5 checks)

- [ ] **G1 — No debugging artifacts**: No `console.log`, no `debugger`, no `TODO: remove`, no commented-out code blocks.
- [ ] **G2 — Naming follows conventions**: C# uses PascalCase for types and methods, camelCase for parameters/locals. TypeScript follows existing project conventions. Table names are snake_case.
- [ ] **G3 — PR is scoped to the story**: The diff contains only changes necessary for the stated story. Unrelated changes are in a separate PR.
- [ ] **G4 — AC coverage confirmed**: Every Gherkin AC in the story has a corresponding test or a clear implementation path in the code. No AC is silently dropped.
- [ ] **G5 — Docs updated**: If this PR changes an API contract, the Swagger annotations are updated. If it changes a behavior documented in the playbook or vault, the relevant doc is updated in the same PR.

---

## How to Give Specific, Actionable Feedback

**Vague feedback (avoid):**
> "This doesn't look right."
> "Can you clean this up?"
> "I'm not sure about this."

Vague feedback forces the author to guess what you mean. It starts conversations that could be PR comments. It slows down the review cycle.

**Specific feedback (use):**
> `blocker: GetAssetsByConditionQuery loads all Inspection records with .Include(a => a.Inspections) but only uses the most recent inspection for the rating. This will load thousands of rows for assets with long inspection histories. Use a subquery or pagination to load only the latest inspection per asset.`

Specific feedback tells the author exactly what the problem is, where it is, and (ideally) how to fix it or what direction to explore.

**The specific feedback formula:**
1. **Label** (`nit`, `suggestion`, `question`, `blocker`)
2. **State the problem**, not the preference
3. **Explain why** it matters (performance, correctness, security, maintainability)
4. **Suggest a direction** if you have one (not always required for `question`)

---

## AI-Assisted First Pass

Before the PR is reviewed by a human, a Claude Code agent runs a first-pass review against the checklist. This catches mechanical issues so human reviewers can focus on design, intent, and domain correctness.

**AI first-pass prompt:**
```
Review this PR using the code review checklist in engineering-playbook/vol-5-operating-model/09-code-reviews.md.

Check every item in sections: Architecture, Database, Security, Testing, Frontend, General.
For each failing check, output a labeled comment (nit/suggestion/question/blocker) with:
- Which checklist item failed
- File path and line number
- Explanation of the issue
- Suggested fix if applicable

Do NOT comment on style preferences not covered by the checklist.
Do NOT approve the PR — output your findings as a list for human review.
```

**What the AI first pass catches well:**
- Missing authorization attributes
- Unhandled error states in frontend components
- N+1 query patterns
- Missing pagination on list queries
- Console.log debugging artifacts
- Checklist items that are missing (no unit tests, no migration reviewed)

**What humans focus on (after AI first pass):**
- Domain correctness (is this the right business rule?)
- AC coverage (does the implementation actually do what the story asked?)
- Design quality (is this the right abstraction? Will this be easy to change?)
- Edge cases the author may not have considered
- Consistency with team patterns and direction

---

## Anti-Patterns in Code Review Culture

**Anti-pattern 1: Rubber-stamping**
Approving PRs without reading them. This happens when reviewers are overloaded or when there is social pressure to not slow down colleagues. Rubber-stamped PRs are the source of most production bugs that "should have been caught in review."

Resolution: Review SLAs exist so reviewers have time. If you do not have time to review properly, say so and the PR gets reassigned.

**Anti-pattern 2: Style nitpicking without a formatter**
Spending review cycles on formatting, whitespace, import order, or naming preferences that a formatter would handle automatically. These comments demoralize authors and waste reviewer time.

Resolution: All style questions are resolved by the formatter (Prettier for TypeScript, dotnet-format for C#). Style is not a valid `blocker`. If the formatter does not enforce it, it is a `nit` at most.

**Anti-pattern 3: The Long PR Backlog**
A team that lets PRs sit for 3–5 days before review has effectively increased its cycle time by 3–5 days per feature. Engineers context-switch to new work and then have to re-context-switch when review feedback arrives. PRs pile up. Merge conflicts accumulate.

Resolution: The 24-hour SLA is the fix. Teams that respect it ship faster than teams that do not.

**Anti-pattern 4: Review Comments as Arguments**
Back-and-forth disagreement in PR comments that goes to 5+ rounds without resolution. The PR becomes a debate forum.

Resolution: After two rounds of back-and-forth on a comment, take it offline (10-minute call or chat conversation). Reach a decision. Document the decision in the PR comment and move on.

**Anti-pattern 5: Scope Creep in Reviews**
Using the review as an opportunity to request changes that are not related to the PR's purpose. "While you are in here, can you also fix X?"

Resolution: File a new story for X. The PR's job is to ship the stated story correctly, not to be a vehicle for accumulated wishlist items.

---

## Author vs Reviewer Disagreement — Tiebreaker Protocol

Reasonable engineers disagree in good faith. When they cannot reach agreement in a PR review, the following protocol resolves the tie.

### Step 1: In-Line Discussion (max 2 rounds)

Author and reviewer exchange comments up to 2 rounds. The author either:
- Implements the change
- Explains why they disagree, with reasoning

The reviewer either:
- Withdraws the blocker (if convinced)
- Restates the block with additional reasoning
- Downgrades from blocker to suggestion (if the concern is less firm than initially stated)

### Step 2: Voice Sync (10-15 minutes)

If unresolved after 2 rounds of in-line discussion, the author and reviewer schedule a 10-15 minute voice call. This is a hard rule — do not exceed 2 rounds of typed back-and-forth.

Meeting format:
1. Author states their approach and the reasoning
2. Reviewer states the concern and the reasoning
3. Both explore whether there is a third option that satisfies both
4. If a resolution is reached, one party writes the decision as a PR comment for the record

### Step 3: Bring in a Third Reviewer

If the voice sync does not resolve, both parties agree on a third reviewer (usually a Lead Engineer or the Tech Architect, unless one of them is already involved). The third reviewer reads the PR, the discussion, and gives an independent opinion.

The third reviewer's decision is final for the PR. If they lean toward the reviewer, the author implements the change. If they lean toward the author, the reviewer withdraws the block.

### Step 4: Escalation to Lead Engineer or ED

If step 3 does not resolve (rare — only for fundamental philosophical disagreements), the Lead Engineer or ED breaks the tie. The escalation is documented so future engineers can learn from the pattern.

**Time boxes**:
- Steps 1–2 should complete within the PR review SLA
- Step 3 within 1 additional business day
- Step 4 within 1 additional business day

If steps take longer than these boxes, the PR is blocked and the author works on other stories in the meantime. A stalled review does not become a scope creep for the PR.

### Categories of Disagreement and How They Usually Resolve

| Disagreement type | Usual tiebreaker principle |
|---|---|
| Style preference (formatting, naming) | Formatter wins; if formatter has no opinion, existing codebase convention wins |
| Pattern choice (repository vs direct DbContext) | Existing ADR wins; if no ADR, tiebreaker is the Tech Architect |
| Performance vs simplicity | If actually measured to be a problem, performance wins; if theoretical, simplicity wins |
| "This will make future changes harder" (speculative) | Author position usually wins; do not build for hypothetical futures |
| Test coverage adequacy | QA Lead's judgment is authoritative |
| Domain correctness | Domain Expert's judgment is authoritative |
| Security concern | Security reviewer's judgment is authoritative; err toward the block |
| Multi-tenancy concern | Backend Lead + Tech Architect judgment is authoritative; always block until resolved |

### Cultural Guardrails

- **The author is not always right, but they own the code**: they will maintain it, they wrote the tests, and they will fix bugs that arise. A reviewer overriding the author frequently creates ownership dilution.
- **The reviewer is not always right, but they have a fresh perspective**: they see what the author has become blind to. Habitually siding with the author against reviewers creates confirmation bias.
- **Disagreement is healthy; deadlock is not**: the goal of the tiebreaker protocol is to prevent deadlock, not to prevent disagreement.
- **The tiebreaker record matters**: track disagreements resolved by escalation. If the same two people escalate repeatedly, there is a pairing or personality issue that the ED should address in 1:1s.
