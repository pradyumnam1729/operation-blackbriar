# Autonomous Architecture Reviews

Architecture reviews ensure that code changes comply with established architectural decisions, maintain the boundaries defined in Clean Architecture, and do not introduce patterns that will cause maintenance problems at scale. Traditionally, architecture reviews are performed manually by senior engineers — a valuable but time-consuming process that can become a bottleneck as the team scales.

AI agents can perform a first-pass architecture review automatically, checking code against the ADRs and playbook standards faster than any human reviewer. This does not replace human judgment on complex design questions, but it reliably catches the common categories of violations — business logic in controllers, missing tenant isolation, wrong layer dependencies — before they reach a human reviewer.

This document covers the triggers for automated architecture reviews, the checklist the AI agent evaluates, the format for review reports, and how findings are escalated from the AI reviewer to human engineers.

---

## Automated Architecture Review Triggers

An automated architecture review runs when:

**A PR is opened against main or a release branch.** The PR reviewer agent runs the architecture review checklist against the diff. The review report is posted as a PR comment.

**A new file is created in a core Clean Architecture layer.** Adding a new controller, handler, entity, or infrastructure service deserves an architecture review to verify the file is in the right layer, follows the right pattern, and does not introduce violations.

**A new package is added to a project file.** New dependencies can violate layer boundaries. If `Aurigo.AssetMaintenance.Domain.csproj` adds a dependency on `Microsoft.EntityFrameworkCore`, that is an architecture violation — the Domain layer must not depend on EF Core.

**A migration file is added.** Database migrations deserve special attention: they affect all tenants simultaneously, they can lock tables, and mistakes are hard to reverse.

**Monthly code quality scan** (see also `11-autonomous-refactoring.md`). The monthly scan includes an architecture compliance check across all recently changed files.

---

## Architecture Review Checklist

The following checklist is the canonical set of checks performed by the Architecture Review Agent. Each check includes: what it verifies, how to detect a violation, and the severity.

### Check 1 — Clean Architecture Layer Boundaries

**Verifies:** The dependency rules of Clean Architecture are respected. Dependencies point inward: Api → Application → Domain. Infrastructure → Domain. Infrastructure → Application. Nothing points outward.

**Violation examples:**
- `Aurigo.AssetMaintenance.Domain` imports from `Aurigo.AssetMaintenance.Application` — Critical
- `Aurigo.AssetMaintenance.Domain` imports from `Aurigo.AssetMaintenance.Infrastructure` — Critical
- `Aurigo.AssetMaintenance.Application` imports from `Aurigo.AssetMaintenance.Infrastructure` — Critical
- `Aurigo.AssetMaintenance.Api` directly imports a Domain entity type without going through Application — Warning

**How to detect:** Inspect the `.csproj` project references. Inspect `using` directives in changed files for namespace violations.

**Severity:** Critical (cannot merge)

### Check 2 — Business Logic in Controllers

**Verifies:** Controllers contain only: route mapping, request parsing, sending MediatR commands/queries, returning HTTP results. No database queries, no business rule evaluation, no calculation logic.

**Violation examples:**
- Controller method contains `_context.Assets.FirstOrDefaultAsync(...)` — direct DB access
- Controller method contains an if/else with business rules ("if asset.Type == 'Bridge' then...")
- Controller method returns a Domain entity (not a DTO)

**How to detect:** In the changed controller files, check for any namespace imports of `DbContext` type, any direct entity manipulation, any business logic conditions.

**Severity:** Critical (cannot merge)

### Check 3 — Multi-Tenancy

**Verifies:** Tenant isolation is maintained. All data access goes through the EF global query filter which automatically applies `WHERE tenant_id = @tenantId`.

**Violation examples:**
- Raw SQL (FromSqlRaw, ExecuteSqlRaw) that does not include a `tenant_id` where clause
- Queries that bypass the DbContext entirely (reading from a different data source without tenant filtering)
- Admin endpoints that intentionally bypass tenant filtering must be explicitly documented and approved by Engineering Director

**How to detect:** Search changed files for `FromSqlRaw`, `ExecuteSqlRaw`, `FromSql`, and `Database.ExecuteSql`. For each occurrence, verify that `tenant_id` filtering is applied.

**Severity:** Critical (cannot merge)

### Check 4 — Authentication and Authorization

**Verifies:** All new API endpoints are protected.

**Violation examples:**
- New `[HttpGet]`, `[HttpPost]`, `[HttpPut]`, `[HttpDelete]` action without `[Authorize]` on the action or the controller class
- New controller class without `[Authorize]` at the class level and no action-level `[Authorize]` attributes

**How to detect:** For each new or modified action method in controller files, check for `[Authorize]` on the action or the controller class. Check if there is a documented business reason to make an endpoint public.

**Severity:** Critical (cannot merge)

### Check 5 — EF Core Read Query Patterns

**Verifies:** Read-only queries use AsNoTracking.

**Violation examples:**
- Query handler that loads data without `AsNoTracking()` when the data will not be modified

**How to detect:** In query handler files (not command handlers), look for `DbSet.Include(...)`, `DbSet.Where(...)`, or `DbSet.FirstOrDefaultAsync(...)` without `AsNoTracking()`.

**Severity:** Warning (should fix, not blocking)

### Check 6 — N+1 Query Detection

**Verifies:** No N+1 query patterns exist in new code.

**Violation example:**
```csharp
// N+1: loads assets, then for each asset makes a separate DB call for inspections
var assets = await _context.Assets.ToListAsync();
foreach (var asset in assets)
{
    var inspections = await _context.InspectionRecords
        .Where(i => i.AssetId == asset.Id).ToListAsync(); // N DB calls
}
```

**How to detect:** Look for await calls inside foreach loops that access the database.

**Severity:** High (should fix before merge)

### Check 7 — FluentValidation on API Boundary

**Verifies:** New command/query types have corresponding validators.

**Violation example:** A new `CreateCapitalNeedCommand` exists with no corresponding `CreateCapitalNeedCommandValidator`.

**How to detect:** For each new `*Command.cs` or `*Query.cs` file in the diff, verify a corresponding `*Validator.cs` file exists.

**Severity:** High (should fix before merge)

### Check 8 — DTO vs. Entity Discipline

**Verifies:** Domain entities are not returned from controllers.

**Violation example:** Controller action returns `InspectionRecord` (a Domain entity) instead of `InspectionRecordDto`.

**How to detect:** In controller return types and `Ok(...)` calls, check whether the type is from the Domain namespace or the Application DTOs namespace.

**Severity:** Critical (cannot merge)

### Check 9 — ADR Compliance

**Verifies:** The PR does not violate any existing ADR.

**How to detect:** The Architecture Review Agent reads all ADRs in `vol-3-architecture/adrs/` and checks whether any ADR's compliance rules are violated by the PR's changes.

**Severity:** Depends on the ADR (each ADR specifies its compliance requirements)

### Check 10 — Migration Review

**Verifies:** New migration files are safe to apply to production.

**Checks:**
- Does the migration have a corresponding `Down()` method? (Is it reversible?)
- Does the migration add a NOT NULL column without a default value to an existing table? (Will break existing data)
- Does the migration rename or drop a column? (Could break dependent queries)
- Does the migration add an index on a large table? (Could lock the table for minutes)

**Severity:** All migration issues are Critical — requires Engineering Director review

---

## Architecture Review Report Format

```markdown
## Architecture Review: PR #[number] — [PR Title]
Review Date: [YYYY-MM-DD]
Reviewer: Architecture Review Agent (AI)
Human Sign-off Required: [Yes/No — Yes for any Critical or migration findings]

---

### Summary
[1-2 sentence summary: how many violations were found and what categories]

---

### Critical Violations (Block Merge)

#### [Violation 1 Title]
**Check:** [which check identified this]
**File:** [file path]
**Line:** [approximate line number]
**Issue:** [description of the violation]
**Required Fix:** [exactly what must change]
**ADR Reference:** [ADR-XXX if applicable]

---

### High Findings (Fix Before Merge)

#### [Finding 1 Title]
[Same structure]

---

### Warnings (Fix When Convenient)

#### [Warning 1 Title]
[Same structure]

---

### Approved Patterns
[List of patterns that were verified as correct — this section builds confidence]
- Multi-tenancy correctly applied to all new query handlers
- All new endpoints have [Authorize]
- FluentValidation present for all new commands
- DTOs correctly used — no Domain entities in controller responses

---

### Migration Assessment (if applicable)
[If no migration in PR: "No migration in this PR."]
[If migration present:]
- Is the migration reversible? [Yes/No]
- Risk of table lock? [None/Low/Medium/High]
- Requires Engineering Director review: [Yes/No]

---

### Recommendation
[One of:]
- Approve: No violations found. Ready to merge after human code review.
- Approve with conditions: Minor warnings only. Merge after addressing [specific items].
- Request changes: [N] critical violations must be addressed before merge.
- Architecture review required: This PR introduces new patterns requiring Engineering 
  Director review before merge.
```

---

## Escalation Path

**No critical violations:** The architecture review is complete. The human code reviewer proceeds with the functional review.

**Critical violations (blocking):** The PR author is notified. The PR cannot be merged until all critical violations are fixed. The author fixes the violations and pushes a new commit. The Architecture Review Agent runs again automatically.

**Migration risks:** Any migration with Medium or High lock risk is escalated to the Engineering Director for approval. The engineer provides a migration plan: when will it run (off-hours), what is the estimated duration, is there a rollback plan?

**New architectural patterns:** If the PR introduces a pattern not covered by an existing ADR (for example, a new caching strategy, a new approach to external API calls), the Architecture Review Agent flags it as "requires ADR review." The PR is not blocked, but an ADR must be drafted and approved within the sprint.

---

## Continuous Architecture Health

Architecture reviews on individual PRs catch violations at the point of introduction. Monthly architecture health scans catch drift that accumulated over time. Together, they maintain the architectural integrity of the codebase as it grows.

The Engineering Director reviews the architecture health report monthly. Metrics tracked:
- Number of critical violations caught by the automated review (trend: should decrease as patterns are established)
- Number of ADRs added in the month
- Number of ADR compliance violations found in the monthly scan
- Technical debt items opened vs. closed

Consistently high violation rates indicate that the team does not have the patterns internalized. The response is not more reviews — it is better training, better CLAUDE.md instructions, and better reference implementations for agents and engineers to follow.
