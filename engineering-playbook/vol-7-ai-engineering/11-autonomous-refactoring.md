# Autonomous Refactoring

Technical debt is the accumulated cost of past shortcuts. Every codebase accumulates it. The question is not whether a codebase will have technical debt but how quickly it accumulates and how effectively it is addressed. At Aurigo, AI agents are a tool for identifying debt systematically and executing refactoring safely — with the constraint that observable behavior must not change and all tests must pass after the refactoring.

This document covers the refactoring workflow: how debt is identified, how refactoring is scoped, how AI agents execute transformations, and the validation steps that ensure refactoring does not introduce regressions.

---

## Refactoring Triggers

Refactoring should be triggered by a specific observable need, not by a general desire for "cleaner code." Common triggers at Aurigo:

**Code review identification:** A code reviewer identifies a pattern violation during PR review. "This controller contains business logic — it should be in a handler." The finding is logged as a technical debt item and addressed in a dedicated refactoring story, not in the same PR.

**Architecture Review Agent finding:** The Architecture Review Agent runs on PR merge and produces a report of findings. Patterns flagged as violations are logged as technical debt items.

**Performance regression tracing:** A performance problem is traced to a code pattern (N+1 query, missing AsNoTracking, unindexed query). The fix is a refactoring.

**Monthly AI-assisted code quality scan:** Once per month, an AI agent scans the codebase for common anti-patterns across all active domains. This is a planned Level 3 indexing session with a specific focus on pattern compliance rather than feature state.

**Architecture change:** An ADR supersedes an existing pattern. All code implementing the old pattern must be refactored to the new pattern.

---

## Safe Refactoring Principles

**Never refactor and add features in the same PR.** Refactoring changes code structure; features change code behavior. Mixing the two makes it impossible to tell whether a test failure is due to the refactoring or the feature. Keep them separate.

**Refactoring must not change observable behavior.** This is the definition of refactoring. If the behavior changes, it is not a refactoring — it is a bug fix or a feature. Every refactoring PR should have a test suite that was green before the refactoring and remains green after.

**Large refactoring must start with a green test suite.** If the test suite has failing tests when the refactoring begins, it is impossible to tell whether new failures are caused by the refactoring. Fix failing tests first, then refactor.

**Large refactoring must be reviewed by Engineering Director.** Refactoring that spans more than 10 files or touches core architecture (changing how handlers work, changing the base entity structure, changing the EF configuration pattern) requires an architecture review before and after.

**Refactoring is incremental.** A refactoring that transforms 50 files at once is high-risk. Break large refactoring into stages: extract the new pattern, verify tests pass, migrate domain 1, verify, migrate domain 2, verify, remove the old pattern.

---

## Common Refactoring Patterns for Aurigo

The following are the most common technical debt patterns found in the Aurigo codebase and the correct replacements:

### Pattern 1: Business Logic in Controllers

**Anti-pattern:**
```csharp
[HttpPost]
public async Task<IActionResult> CreateInspection([FromBody] CreateInspectionRequest request)
{
    var asset = await _context.Assets.FirstOrDefaultAsync(a => a.Id == request.AssetId);
    if (asset == null) return NotFound();
    
    var inspection = new InspectionRecord 
    { 
        AssetId = request.AssetId,
        ConditionScore = request.ConditionScore,
        // ...
    };
    _context.InspectionRecords.Add(inspection);
    await _context.SaveChangesAsync();
    return Created($"/api/v1/inspections/{inspection.Id}", inspection.Id);
}
```

**Target pattern:**
```csharp
[HttpPost]
public async Task<IActionResult> CreateInspection([FromBody] CreateInspectionRecordCommand command)
{
    var id = await _mediator.Send(command);
    return Created($"/api/v1/inspections/{id}", id);
}
```

### Pattern 2: Missing AsNoTracking on Read Queries

**Anti-pattern:**
```csharp
var inspection = await _context.InspectionRecords
    .Include(i => i.DefectRecords)
    .FirstOrDefaultAsync(i => i.Id == id);
```

**Target pattern:**
```csharp
var inspection = await _context.InspectionRecords
    .AsNoTracking()
    .Include(i => i.DefectRecords)
    .FirstOrDefaultAsync(i => i.Id == id);
```

### Pattern 3: Lazy Loading of Navigation Properties

**Anti-pattern:**
```csharp
// Navigation property accessed without explicit loading
var defects = inspection.DefectRecords.Where(d => d.Severity > 2).ToList();
```

**Target pattern:**
```csharp
// Explicit loading in the query
var inspection = await _context.InspectionRecords
    .AsNoTracking()
    .Include(i => i.DefectRecords.Where(d => d.Severity > 2))
    .FirstOrDefaultAsync(i => i.Id == id);
```

### Pattern 4: Hard-Coded Role Strings

**Anti-pattern:**
```csharp
[Authorize(Roles = "Inspector")]
```

**Target pattern:**
```csharp
[Authorize(Roles = RoleConstants.Inspector)]
```

### Pattern 5: Entity Returned from Controller

**Anti-pattern:**
```csharp
return Ok(inspectionRecord); // returns Domain entity
```

**Target pattern:**
```csharp
var dto = _mapper.Map<InspectionRecordDto>(inspectionRecord);
return Ok(dto); // returns DTO
```

### Pattern 6: Duplicated Calculation Logic

**Anti-pattern:**
```csharp
// Same deterioration calculation duplicated in two handlers
var remainingLife = totalUsefulLife - (installedAge + (conditionScore / deteriorationRate));
```

**Target pattern:**
```csharp
// Extracted to RulCalculator
var remainingLife = _rulCalculator.CalculateRemainingUsefulLife(conditionScore, deteriorationRate, totalUsefulLife, installedAge);
```

---

## AI Refactoring Workflow

**Step 1 — Scope the refactoring**

Before writing any code, define the refactoring scope precisely:
- Which files contain the anti-pattern?
- What is the target pattern?
- Which reference file demonstrates the correct pattern?
- How many files are affected?

Produce a scoping document:
```markdown
## Refactoring: [Name]
Anti-pattern: [description]
Target pattern: [description]
Reference implementation: [file path]
Files affected: [list all files]
Estimated test impact: [tests that might fail, tests that need to be written]
```

**Step 2 — Ensure green test suite**

Run the full test suite. If any tests are failing, fix them before starting the refactoring. Log the pre-refactoring test counts: N tests, N passing, N failing.

**Step 3 — Run the AI refactoring agent**

```
You are the Refactoring Agent for Aurigo Software Technologies.

## Refactoring Task
Anti-pattern: [describe the anti-pattern]
Target pattern: [describe the target pattern]
Reference implementation: [file path] — read this file to understand the target pattern

## Files to Refactor
1. [file path] — [what needs to change in this file]
2. [file path] — [what needs to change in this file]

## Critical Constraints
- Do NOT change observable behavior. The refactoring transforms code structure; 
  the behavior (API responses, business logic outcomes, test assertions) must be identical.
- Do NOT modify files not listed above, even if you see opportunities for improvement.
- Do NOT add features. Only transform existing code to the target pattern.
- All existing tests must pass after the refactoring. If a test fails, investigate 
  whether the test was testing an internal implementation detail vs. observable behavior.
  Tests of internal implementation details may need to be updated. Tests of observable 
  behavior should not fail.
- After making changes, list any tests that might need updating and why.

## Deliverable
1. Refactored versions of each listed file
2. A brief explanation of each change made
3. A list of tests to verify (or update) after the refactoring
```

**Step 4 — Verify**

After the agent completes:
1. Run the full test suite
2. Compare before/after test counts: same number of passing tests (or more if new tests were added)
3. Review the git diff for any unintended changes to files not listed in the scope
4. Run the application and smoke test the affected endpoints

**Step 5 — PR and review**

The refactoring PR has a specific template:
- Title: `refactor: [brief description]`
- Label: `technical-debt`
- Description must include: what anti-pattern was removed, what pattern was applied, test results before and after

---

## Monthly Code Quality Scan

Once per month, an AI agent runs a scan of the full codebase for common anti-patterns. The scan is part of the Level 3 repository indexing session.

**Scan prompt:**
```
You are the Code Quality Agent for Aurigo Software Technologies.

Perform a code quality scan of the current codebase. Check for these anti-patterns:

1. Business logic in controllers (direct DbContext usage, validation logic)
2. Missing AsNoTracking on read-only queries
3. Hard-coded role strings (should use RoleConstants)
4. Domain entities returned from controllers (should use DTOs)
5. Duplicated calculation logic (same formula in multiple handlers)
6. Missing [Authorize] on non-public endpoints
7. Empty catch blocks
8. Any new namespace violations (Domain importing from Application or Infrastructure)

For each finding:
- File path and approximate line number
- Severity: Critical (must fix before next release), High (fix in next sprint), 
  Low (fix when in area)
- Description of the anti-pattern found
- Reference to the correct pattern

## Output Format
A technical debt report saved to: docs/technical-debt/[YYYY-MM]-scan.md

After the scan, identify the top 3 highest-priority items and add them to 
project memory for sprint planning consideration.
```

The output of the monthly scan feeds directly into sprint planning. Technical debt items with Critical or High severity are added to the product backlog and prioritized by the Engineering Director.

---

## Tracking Refactoring Progress

Technical debt is tracked in the product backlog like any other work. Each refactoring item has:
- The anti-pattern being removed
- The files affected
- The estimated complexity (story points)
- The priority (critical, high, low)

A technical debt ratio target helps prevent debt accumulation: in any sprint with 50+ total story points, at least 5 points should be allocated to technical debt reduction. This is not a hard rule that overrides product priorities, but it is a guideline that ensures debt does not compound indefinitely.

The Engineering Director reviews the technical debt backlog monthly and ensures that the top-priority items are being addressed. If the debt backlog is growing faster than it is being addressed, the team's velocity allocation for debt must increase.
