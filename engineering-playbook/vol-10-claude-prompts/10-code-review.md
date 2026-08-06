# 10 — Code Review Prompt

Use this prompt to perform a comprehensive AI-assisted code review of a PR diff. The output is a structured review report ready to post as a PR comment.

---

## When to Use

- As the author before requesting human review — catch your own issues first.
- As a reviewer to structure your feedback before reading the diff manually.
- When reviewing a PR that touches multiple layers (backend + frontend).
- When onboarding a reviewer who is unfamiliar with Aurigo's patterns.

---

## Code Review Prompt

Replace `[PR_NUMBER]`, `[PR_TITLE]`, `[PR_DESCRIPTION]`, and `[DIFF_CONTENT]`. Paste the full prompt:

---

You are performing a comprehensive code review for the Aurigo Maintain codebase (.NET 8 / React 18 / PostgreSQL). Review this PR against Aurigo's full code review checklist. Be specific — every finding must include a file:line reference and a clear explanation of why it is an issue.

**PR Information:**
- PR Number: `[PR_NUMBER]`
- Title: `[PR_TITLE]`
- Description: `[PR_DESCRIPTION]`

**The diff:**
```diff
[DIFF_CONTENT]
```

**Step 1 — Read context files before reviewing:**
1. Read `CLAUDE.md` — conventions, architecture, constraints
2. Read `vault/decisions/` — all ADRs (a finding that contradicts an ADR is a Blocker)
3. For each file in the diff: if the file references a class or interface you have not seen, read it before continuing

**Step 2 — Run the full review checklist:**

Severity:
- **Blocker**: Must be fixed before merge. Violates a hard rule (security, architecture boundary, data integrity, breaking change without migration).
- **Warning**: Should be fixed. Degrades quality, performance, or maintainability.
- **Nit**: Optional improvement.
- **Approved Pattern**: Something done well that should be reinforced.

**CLEAN ARCHITECTURE BOUNDARIES**
- [ ] No reference from Domain layer to Application, Infrastructure, or Api
- [ ] No reference from Application layer to Infrastructure or Api
- [ ] No EF Core types (DbContext, DbSet, Include, IQueryable<T>) referenced in Application or Domain
- [ ] No HttpContext, IActionResult, or other HTTP types used outside of Api layer
- [ ] No controller action method contains business logic beyond: extract claims, create command, send via MediatR, return result
- [ ] No repository or database concern leaked into Application

Severity: Any violation = **Blocker**

**MULTI-TENANCY**
- [ ] Every new aggregate root entity includes a `TenantId` property of type `Guid`
- [ ] No new manually-added `.Where(x => x.TenantId == tenantId)` clause in queries
- [ ] No raw SQL execution that bypasses the global query filter
- [ ] TenantId is not accepted from user input — it comes from the JWT claim only

Severity: Missing TenantId on aggregate root = **Blocker**. TenantId from user input = **Blocker** (security issue).

**EF CORE PATTERNS**
- [ ] All read-only queries use `.AsNoTracking()`
- [ ] No `.Include()` chain longer than 2 levels without a comment
- [ ] No `.ToList()` or `.ToArray()` called before filtering
- [ ] No lazy loading — no navigation property accessed without a prior explicit `.Include()`
- [ ] No synchronous EF Core calls: no `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`
- [ ] No `.Select()` that pulls more data than needed
- [ ] Pagination applied to all list endpoints
- [ ] New entities added to DbContext configuration
- [ ] Migration file present if entity model changed; migration is not empty

Severity: Missing AsNoTracking = **Warning**. Synchronous EF call = **Blocker** (deadlock risk). Missing pagination = **Warning**. Missing migration = **Blocker**.

**API STANDARDS**
- [ ] Routes follow convention: `/api/v1/[resource]` — plural nouns, kebab-case
- [ ] All controller actions have `[Authorize]` or explicit `[AllowAnonymous]` with a comment
- [ ] No domain entities returned from controllers — only DTOs
- [ ] All action methods have `[ProducesResponseType]` attributes for every possible status code
- [ ] HTTP verbs used correctly
- [ ] Controller constructor injects only: IMediator, ILogger
- [ ] No try-catch in controllers for business exceptions — use a global exception handler

Severity: Missing authorization = **Blocker**. Returning domain entity = **Warning**.

**VALIDATION**
- [ ] FluentValidation validator exists for every command and every request DTO with user input
- [ ] No duplicate validation in handlers
- [ ] Validation messages are user-friendly
- [ ] No validation of TenantId or UserId

Severity: Missing validator for user input = **Warning**.

**SECURITY**
- [ ] No hardcoded secrets, connection strings, or API keys anywhere in source code
- [ ] No user-controlled string values interpolated into raw SQL
- [ ] No PII logged at Debug or Info level
- [ ] File upload endpoints (if any) validate file type and size
- [ ] JWT claims are read from `User.Claims` in the controller, not accepted as API parameters

Severity: SQL injection = **Blocker**. Hardcoded secret = **Blocker**. PII in logs = **Warning**.

**APPLICATION LAYER**
- [ ] Handlers are stateless — no instance state, no static fields
- [ ] No handler calls another handler via `_mediator.Send()`
- [ ] AutoMapper or explicit mapping used — no manual property-by-property mapping in handler code
- [ ] Response DTOs created in `Application/[Module]/`

Severity: Handler-to-handler call = **Warning**.

**FRONTEND**
- [ ] No TypeScript `any` type introduced
- [ ] No `useEffect` used for data fetching
- [ ] No direct API client calls inside components — all API calls are in custom hooks
- [ ] Every async operation has explicit loading, error, and empty states
- [ ] No uncontrolled inputs — all forms use react-hook-form
- [ ] Zod schema validation matches the backend FluentValidation rules
- [ ] No `console.log()` statements left in committed code

Severity: Missing loading/error states = **Warning**. TypeScript `any` = **Warning**. useEffect for data fetching = **Warning**. console.log = **Nit**.

**TESTING**
- [ ] New calculation logic has unit tests
- [ ] New API endpoint has at least one integration test covering happy path and tenant isolation
- [ ] No tests deleted without replacement
- [ ] No flaky test patterns: no `Thread.Sleep()`, no `Task.Delay()`, no test-order dependencies
- [ ] Test assertions are specific
- [ ] Test builders used for complex object creation

Severity: Missing integration test for new endpoint = **Warning**. Flaky test pattern = **Warning**.

**DOCUMENTATION**
- [ ] New public API methods have XML doc comments
- [ ] Complex business logic has an inline comment referencing the vault/ spec
- [ ] Breaking changes are called out in the PR description
- [ ] New environment variables are documented in `appsettings.json`

Severity: Undocumented breaking change = **Warning**.

**Produce the structured review report:**

```
## Code Review: PR #[PR_NUMBER] — [PR_TITLE]

### Blockers (must fix before merge)
- **[Check Name]** `filename.cs:42` — [Explanation]. Suggested fix: [specific fix].

### Warnings (should fix, does not block)
- **[Check Name]** `filename.cs:17` — [Explanation]. Suggested fix: [specific fix].

### Nits (optional improvement)
- **[Check Name]** `filename.tsx:88` — [Suggestion].

### Approved Patterns
- **[Pattern Name]** `filename.cs:23` — [Why this is the correct approach].

### ADR Compliance
- [ADR Title]: [Compliant | Non-compliant — explanation]

### Summary
**Changed files:** [N]
**Blockers found:** [N]
**Warnings found:** [N]
**Nits found:** [N]

### Recommendation
- [ ] **Approve** — no blockers found
- [ ] **Request Changes** — [N] blockers listed above must be resolved

_Reviewed using Aurigo Code Review Prompt v1 (vol-10-claude-prompts/10-code-review.md)_
```

---
