# 11 — Refactoring Prompt

Use this prompt to perform AI-assisted refactoring of a specific anti-pattern across one or more files. The prompt ensures safe, surgical changes: read the current code, identify all instances of the pattern, produce the refactored code, explain each change, and confirm that existing tests still pass.

---

## When to Use

- When the code review prompt identifies a widespread anti-pattern.
- During dedicated tech debt sprints (the 20% buffer time from each sprint).
- When a new architectural convention is adopted and existing code needs to be brought into compliance.

## How to Use

1. Identify the anti-pattern (ideally from a code review report).
2. Select the variant below that matches, or use the generic prompt.
3. Replace the `[SCOPE]` placeholder with the specific files or directory to refactor.
4. Run the prompt and review each change before accepting.
5. Run the test suite after every refactoring session: `dotnet test` and `npm test`.

---

## Generic Refactoring Prompt

Replace all `[PLACEHOLDER]` values. Paste the full prompt:

---

You are performing a surgical refactoring in the Aurigo Maintain codebase. Your goal is to fix a specific anti-pattern without changing any behavior. This is a refactoring — no new features, no behavior changes, only structural improvement.

**Anti-pattern to fix:**
```
[DESCRIPTION OF THE ANTI-PATTERN — be specific]
```

**Target pattern (what it should look like after refactoring):**
```
[DESCRIPTION OF THE CORRECT PATTERN. Reference an existing file that already does it correctly.]
```

**Reference implementation (already correct — use this as the pattern):**
`[PATH_TO_EXISTING_FILE_WITH_CORRECT_PATTERN]`

**Scope (files to refactor):**
```
[LIST OF FILES OR DIRECTORY PATH]
```

**Step 1 — Read the reference implementation.**

**Step 2 — Read every file in scope.** Do not skip any.

**Step 3 — Identify all instances of the anti-pattern:**
For each file, list every location where the anti-pattern appears (file:line).

**Step 4 — Produce the refactored code:**
For each instance:
- Show the before code (5-10 lines of context around the problem)
- Show the after code
- Explain in one sentence why this change is correct
- Confirm that the behavior is identical

**Step 5 — Identify tests that need updating:**
If any of the refactored code is directly tested, list the test files that may need updates.

**Step 6 — Produce a summary:**

```
## Refactoring Summary

### Anti-pattern: [name]
### Files changed: [N]
### Instances fixed: [N]

### Changes by file:
[filename.cs]
- Line [N]: [brief description of change]

### Tests to verify:
- [test file]: run to confirm [behavior] is unchanged

### Behavior guarantee:
[Statement confirming the refactoring is transparent]

### Remaining instances (if scope was limited):
[Any known instances outside the scope that should be addressed in a follow-up]
```

---

## Variant 1: Move Business Logic from Controller to MediatR Handler

---

You are refactoring a controller action in the Aurigo Maintain backend to move business logic from the controller to a MediatR handler. This is a Clean Architecture boundary fix.

**The violating controller action is:**
`[PATH_TO_CONTROLLER_FILE]` — method `[METHOD_NAME]`

**Read these files before starting:**
1. The controller file: `[PATH_TO_CONTROLLER_FILE]`
2. A reference handler: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/[ANY_MODULE]/Commands/[ANY_HANDLER].cs`
3. The domain entity: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/[ENTITY_NAME].cs`
4. Existing tests for this controller action (if any)

**The refactoring:**

After refactoring, the controller action must only:
1. Extract claims from the JWT (`User.GetTenantId()`, `User.GetUserId()`)
2. Create the command or query object
3. Call `await _mediator.Send(command)`
4. Return the appropriate HTTP response

All other logic moves to a new (or existing) MediatR handler.

**Produce:**
- The refactored controller action code (minimal, clean)
- The new or modified handler code (containing the logic moved from the controller)
- The validator for any new command class
- Any AutoMapper mapping needed
- Confirmation that the external API behavior (HTTP status codes, response shape) is unchanged

---

## Variant 2: Add AsNoTracking to Read-Only EF Core Queries

---

You are adding `.AsNoTracking()` to read-only EF Core queries in the Aurigo Maintain backend.

**Rule:** Every query that reads data and does not subsequently call `SaveChangesAsync()` on the result must use `.AsNoTracking()`. Queries that read an entity for the purpose of updating it must NOT use AsNoTracking.

**Scope:**
`[DIRECTORY OR FILE LIST]`

**Read each file in scope. For each EF Core query found:**

1. Determine if this is a read-only query or a read-for-update query.

2. If read-only: add `.AsNoTracking()` immediately after `_db.[DbSet]` and before any `.Where()` or `.Include()`:
```csharp
var assets = await _db.Assets
    .AsNoTracking()
    .Where(a => a.IsActive)
    .Include(a => a.AssetType)
    .ToListAsync(cancellationToken);
```

3. If read-for-update: do NOT add AsNoTracking. Note the file:line.

**Produce the changes for each file and a count of instances fixed.**

---

## Variant 3: Replace useEffect + useState Data Fetching with TanStack Query

---

You are refactoring frontend components to replace `useEffect + useState` data fetching with TanStack Query hooks.

**Scope:**
`[DIRECTORY OR FILE LIST]`

**Anti-pattern to find:**
```typescript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)
useEffect(() => {
  apiClient.getAssets().then(setData).catch(setError).finally(() => setLoading(false))
}, [])
```

**Refactoring steps for each instance:**

1. Create a custom hook in `src/features/[module]/hooks/use[Feature].ts`:
```typescript
export function use[Feature]([params]) {
  return useQuery({
    queryKey: ['[feature-key]', params],
    queryFn: () => apiClient.[method]([params]),
  })
}
```

2. In the component, replace the useState/useEffect with the hook:
```typescript
const { data, isLoading, isError, error } = use[Feature](params)
```

3. Update loading, error, and empty states to use `isLoading` and `isError`.

4. Remove all useState/useEffect imports that are no longer used.

**Produce the refactored component code, the new custom hook file, and confirm behavior is unchanged.**

---

## Variant 4: Extract Duplicated Calculation Logic to a Shared Utility

---

You are extracting duplicated calculation logic into a shared calculation engine class in `Application/Calculations/`.

**Read these files to find all instances of the duplication:**
`[LIST OF FILES WHERE THE DUPLICATION EXISTS]`

**The duplicated calculation is:**
```
[DESCRIBE THE CALCULATION]
```

**Refactoring:**

1. Create a new calculation engine class at:
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Calculations/[CalculationName].cs`

The class must be:
- Pure C# — no constructor dependencies, no I/O, no EF Core
- Stateless — no instance fields that hold state
- Documented with an XML comment referencing `vault/calculations/[corresponding vault note]`

```csharp
/// <summary>
/// Calculates [what it calculates].
/// Formula: [state the formula explicitly].
/// See vault/calculations/[FileName].md for full specification.
/// </summary>
public static class [CalculationName]Calculator
{
    public static [ReturnType] Calculate([params]) { ... }
}
```

2. In each handler that contained the duplicated logic, replace the inline calculation with a call to the new engine.

3. Create unit tests: `tests/Aurigo.AssetMaintenance.UnitTests/Calculations/[CalculationName]CalculatorTests.cs`

---

## Variant 5: Add Nullable Reference Type Compliance

---

You are fixing nullable reference type warnings in the Aurigo Maintain backend. The project has nullable reference types enabled.

**Scope:**
`[DIRECTORY OR FILE LIST]`

**Read each file in scope. Common patterns and their fixes:**

1. **Property might be null (CS8618):**
```csharp
// Before
public string Name { get; set; }

// After (option A: required keyword)
public required string Name { get; set; }

// After (option B: default value)
public string Name { get; set; } = string.Empty;

// After (option C: make nullable if it legitimately can be null)
public string? Name { get; set; }
```

2. **Possible null dereference (CS8602):**
```csharp
// Before
var name = user.Name.ToUpper(); // warning if Name is string?

// After (null check)
var name = user.Name?.ToUpper() ?? string.Empty;

// After (assertion — use only with a comment explaining why it is safe)
var name = user.Name!.ToUpper();
```

3. **Return type mismatch (CS8603):**
```csharp
// Before: method returns string? but declared as returning string
public string GetName() => _name;

// After: update return type
public string? GetName() => _name;
```

**For each fix:**
- Apply the most semantically correct fix (do not just add `!` suppressors everywhere)
- If making a property nullable changes how callers use it, update the callers too
- Add a brief comment if you use `!` suppressor to explain why null is impossible at that point

**Produce the fixed files and a count of warnings resolved.**

---
