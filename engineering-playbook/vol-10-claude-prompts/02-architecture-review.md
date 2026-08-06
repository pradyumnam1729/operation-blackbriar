# 02 — Architecture Review Prompt

Use these prompts to review code against Aurigo's architecture standards. Architecture review is mandatory before merging any PR that: adds a new domain entity, adds a new API endpoint, introduces a new external dependency, modifies the EF Core model, or changes authentication/authorization logic.

---

## When to Use

- **Before submitting a PR for human review** — run the "feature branch" variant, fix any blockers, then submit.
- **When reviewing another engineer's PR** — run the "PR diff" variant, share the structured report as a PR comment.
- **Quick sanity check on a single file** — run the "quick check" variant.
- **After major refactoring** — run the "feature branch" variant to verify no regressions.

## Architecture Review Checklist Reference

The full checklist lives in `vol-5-operating-model/09-code-reviews.md`. The prompts below encode that checklist directly, but refer to that file for the authoritative list.

---

## Variant 1: Review a Feature Branch (Before PR Submission)

Replace `[BRANCH_NAME]` and `[FEATURE_DESCRIPTION]` with your values. Paste the full prompt:

---

You are performing an architecture review of a feature branch for the Aurigo Maintain codebase (.NET 8 / React 18 / PostgreSQL). The branch is `[BRANCH_NAME]` and it implements `[FEATURE_DESCRIPTION]`.

**Step 1 — Read the ADRs (architectural ground rules):**
Read all files in `vault/decisions/`. Note any decision that is relevant to this feature.

**Step 2 — Read the changed files:**
Run `git diff main...HEAD --name-only` to list changed files.
Then read every changed file completely.

**Step 3 — Read reference implementations for comparison:**
- Read one existing handler that is similar to any new handler in this branch. Use it as the pattern reference.
- Read `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/AssetMaintenanceDbContext.cs` to check EF configuration.
- Read `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Api/Program.cs` to check DI registration.

**Step 4 — Run the architecture checklist:**

Check each item below. For each item, report: PASS, FAIL (with file:line), or N/A (not applicable to this change).

**Clean Architecture Boundaries:**
- [ ] No reference from Domain to Application, Infrastructure, or Api
- [ ] No reference from Application to Infrastructure or Api
- [ ] No EF Core types (DbContext, DbSet, IQueryable) used in Application or Domain layer
- [ ] No HTTP types (HttpContext, IActionResult) used outside of Api layer
- [ ] No controller contains business logic (controllers only call MediatR Send)

**Multi-Tenancy:**
- [ ] Every new aggregate root entity has a `TenantId` property
- [ ] No new query filters added manually for tenant_id (the global filter handles it)
- [ ] No raw SQL bypasses the global query filter
- [ ] JWT tenant claim is not accessed in Application or Domain layer (only in Api layer)

**EF Core Patterns:**
- [ ] All read-only queries use `.AsNoTracking()`
- [ ] No `.Include()` chains deeper than 2 levels without justification in a comment
- [ ] No `ToList()` or `ToArray()` called before filtering (filter before materializing)
- [ ] No lazy loading (no virtual navigation properties without explicit justification)
- [ ] No synchronous EF calls (no `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`)
- [ ] New migrations exist for any model changes and are not empty

**API Standards:**
- [ ] Routes follow `/api/v1/[resource]` pattern (kebab-case, plural nouns)
- [ ] All endpoints have `[Authorize]` attribute or explicit `[AllowAnonymous]` with comment
- [ ] Response DTOs used — no domain entities returned from controllers
- [ ] `[ProducesResponseType]` attributes present on all action methods
- [ ] FluentValidation validator exists for every command/request with user input
- [ ] Validation is not duplicated in the handler (only at API boundary)

**Application Layer:**
- [ ] Command/Query classes are in correct subdirectory (`Commands/` or `Queries/`)
- [ ] Handlers use AutoMapper or explicit mappers — no manual property mapping in handlers
- [ ] Handlers do not call other handlers (no handler chaining via MediatR.Send)
- [ ] No static state or singleton state in handlers

**Security:**
- [ ] No secrets or connection strings in source code
- [ ] No user-controlled values interpolated into raw SQL
- [ ] Sensitive fields (SSN, credentials) not logged
- [ ] File upload endpoints (if any) validate file type and size

**Frontend (if applicable):**
- [ ] No TypeScript `any` types introduced
- [ ] No `useEffect` used for data fetching (use TanStack Query)
- [ ] Loading, error, and empty states handled for all async operations
- [ ] No API calls made directly in components (use query/mutation hooks)
- [ ] Forms use react-hook-form + zod — no uncontrolled inputs
- [ ] New routes registered in TanStack Router file-based routing convention

**Testing:**
- [ ] New calculation logic has unit tests
- [ ] New API endpoint has at least one integration test
- [ ] No tests deleted without replacement
- [ ] Test builders used for complex object creation (no large inline object literals)

**Produce a structured report:**

```
## Architecture Review: [BRANCH_NAME]

### Blockers (must fix before merge)
- [item]: [file:line] — [explanation of why this violates the standard]

### Warnings (should fix, acceptable to defer with comment)
- [item]: [explanation]

### Info (observations, not violations)
- [observation]

### Approved Patterns (reinforce what was done well)
- [pattern]: [file] — [why this is the right approach]

### ADR Alignment
- [ADR title]: [how this change aligns or conflicts]

### Recommendation
[ ] Approve — no blockers, ready for human review
[ ] Request Changes — blockers listed above must be addressed first
```

---

## Variant 2: Review a PR Diff

Replace `[PR_NUMBER]` and `[DIFF_CONTENT]` with your values. Paste the full prompt:

---

You are performing an architecture review of PR #[PR_NUMBER] in the Aurigo Maintain codebase.

**The PR diff is provided below between the markers:**

```diff
[DIFF_CONTENT]
```

**Step 1 — Read context files:**
Read all files in `vault/decisions/` to load the ADRs.
Read `CLAUDE.md` to load the architecture conventions.

**Step 2 — For any file in the diff that references another file you have not seen, read that file.**
For example: if the diff adds a new handler, read an existing similar handler for comparison.

**Step 3 — Apply the full architecture checklist** (same checklist as the feature branch variant above: Clean Architecture Boundaries, Multi-Tenancy, EF Core Patterns, API Standards, Application Layer, Security, Frontend, Testing).

**Produce the same structured report format** (Blockers / Warnings / Info / Approved Patterns / ADR Alignment / Recommendation).

For each finding, include the exact file and line number from the diff. Format file:line references as `filename.cs:42` so they are easy to locate.

---

## Variant 3: Quick Check — Single File

Replace `[FILE_PATH]` with the absolute path to the file. Paste this prompt:

---

You are performing a quick architecture check on a single file in the Aurigo Maintain codebase.

Read this file completely: `[FILE_PATH]`

Also read `CLAUDE.md` for the architecture conventions.

Check for these specific issues and report any violations with line numbers:

1. **Layer boundary violations** — does this file import from a layer it should not depend on?
2. **Missing tenant scoping** — if this is an entity, does it have TenantId? If this is a query, does it rely on the global query filter (correct) or manually filter tenant_id (flag for review)?
3. **EF Core anti-patterns** — missing AsNoTracking, synchronous calls, lazy loading, premature materialization.
4. **Business logic in wrong layer** — logic that belongs in a handler found in a controller, or logic that belongs in a calculation engine found in a handler.
5. **Missing validation** — user input accepted without FluentValidation.
6. **TypeScript issues** (if .tsx/.ts file) — `any` types, useEffect for data fetching, missing loading/error states.
7. **Security issues** — raw SQL interpolation, secrets in code, missing authorization.

Format: one line per issue, with `file:line — issue description`. If no issues found, state "No issues found."

---
