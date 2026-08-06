# Coding Standards

> Volume 3 · Architecture · Document 01  
> Authoritative reference for all C# / .NET and TypeScript / React code at Aurigo

This document is the single source of truth for code style, naming, structure, and safety rules across all Aurigo Maintain services. Every rule here has been chosen deliberately. Where a rule might seem arbitrary (naming case, comment style), consistency is the goal — a codebase that reads uniformly is faster to navigate for both humans and AI agents. Where a rule has a correctness or performance implication (async patterns, EF Core tracking, null safety), the explanation is given so engineers understand the intent, not just the constraint.

---

## C# / .NET Standards

### Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Types (class, interface, enum, struct, record) | PascalCase | `AssetClass`, `IAssetRepository` |
| Methods | PascalCase | `GetByTenantAsync`, `CalculateRul` |
| Properties | PascalCase | `TenantId`, `ConditionIndex` |
| Local variables | camelCase | `assetClass`, `calculationResult` |
| Private instance fields | `_camelCase` | `_repository`, `_logger` |
| Constants | PascalCase | `MaxConditionIndex`, `DefaultPageSize` |
| Interfaces | `I` prefix + PascalCase | `IAssetRepository`, `IRulCalculator` |
| Generic type parameters | `T` prefix (single letter when obvious) | `T`, `TEntity`, `TRequest` |
| Enums | PascalCase (type and values) | `ConditionRating.Poor` |
| Test methods | `MethodName_Scenario_ExpectedResult` | `CalculateRul_WhenConditionIsZero_ReturnsZeroYears` |

**Correct:**
```csharp
public class AssetConditionService
{
    private readonly IAssetRepository _assetRepository;
    private readonly ILogger<AssetConditionService> _logger;

    public AssetConditionService(
        IAssetRepository assetRepository,
        ILogger<AssetConditionService> logger)
    {
        _assetRepository = assetRepository;
        _logger = logger;
    }

    public async Task<ConditionSummary> GetLatestConditionAsync(AssetId assetId, CancellationToken ct)
    {
        var asset = await _assetRepository.GetByIdAsync(assetId, ct);
        var conditionIndex = asset?.LatestConditionIndex ?? 0;
        return new ConditionSummary(assetId, conditionIndex);
    }
}
```

**Incorrect:**
```csharp
public class assetConditionService  // wrong: type name must be PascalCase
{
    private IAssetRepository AssetRepository;  // wrong: private field must use _camelCase

    public async Task<ConditionSummary> getLatestCondition(Guid id)  // wrong: method must be PascalCase
    {
        var Asset = await AssetRepository.GetByIdAsync(id);  // wrong: local variable must be camelCase
        return new ConditionSummary(id, Asset?.LatestConditionIndex ?? 0);
    }
}
```

---

### File Organization

- **One public type per file.** Private nested types are allowed.
- **File name matches the type name exactly.** `AssetConditionService.cs` contains `class AssetConditionService`.
- **Namespace mirrors folder structure.** A file at `src/Aurigo.AssetMaintenance.Domain/Entities/Asset.cs` has namespace `Aurigo.AssetMaintenance.Domain.Entities`.
- Use file-scoped namespaces (C# 10+): `namespace Aurigo.AssetMaintenance.Domain.Entities;`

**Correct:**
```csharp
// File: src/Aurigo.AssetMaintenance.Domain/Entities/Asset.cs
namespace Aurigo.AssetMaintenance.Domain.Entities;

public class Asset : AggregateRoot
{
    // ...
}
```

**Incorrect:**
```csharp
// File: src/Aurigo.AssetMaintenance.Domain/Entities/Asset.cs
namespace Aurigo.AssetMaintenance.Application;  // wrong: namespace doesn't match folder

public class Asset { }
public class AssetClass { }  // wrong: second public type in the same file
```

---

### Records vs. Classes

| Use case | Type |
|---|---|
| DTOs (data transfer objects returned from queries) | `record` |
| Value objects (strongly-typed IDs, money, coordinates) | `record` |
| Domain entities (have identity, mutable state, lifecycle) | `class` |
| Services, repositories, handlers | `class` |
| Configuration objects bound from appsettings | `record` |

**Correct:**
```csharp
// Value object — use record
public record AssetId(Guid Value);

// DTO — use record
public record AssetDto(Guid Id, string Name, ConditionRating ConditionRating, DateOnly InstallDate);

// Entity — use class (has identity, mutable lifecycle)
public class Asset : AggregateRoot
{
    public AssetId Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    // ...
    public void UpdateCondition(ConditionRating rating) { /* ... */ }
}
```

---

### Nullable Reference Types

Nullable reference types are **enabled project-wide** via `<Nullable>enable</Nullable>` in every `.csproj`. This is non-negotiable.

Rules:
- A non-nullable reference type (`string Name`) means: this value will never be null. Honor this contract.
- A nullable reference type (`string? Description`) means: this may be null. Check before use.
- Do not use the null-forgiving operator (`!`) to suppress warnings unless you can prove the value is non-null at that point. If you must use it, add an explanatory comment.
- Entity properties that are not set by constructors must have `= null!` (for EF Core navigation properties) or provide an initializer. Document EF Core navigation properties clearly.

**Correct:**
```csharp
public class Asset : AggregateRoot
{
    public string Name { get; private set; } = string.Empty;  // always initialized
    public string? Description { get; private set; }           // explicitly nullable
    public AssetClass AssetClass { get; private set; } = null!; // EF Core navigation — set by EF
}

// Usage
if (asset.Description is not null)
{
    logger.LogInformation("Description: {Description}", asset.Description);
}
```

**Incorrect:**
```csharp
public class Asset
{
    public string Name { get; set; }  // warning: non-nullable not initialized
    public string Description { get; set; }  // should be nullable if it can be absent

    public void Log(ILogger logger)
    {
        logger.LogInformation(Description.ToUpper());  // potential NullReferenceException
    }
}
```

---

### Async / Await

All I/O-bound operations **must** be async. Synchronous blocking on async code is a deadlock risk and is forbidden.

- All repository methods return `Task<T>` or `ValueTask<T>` and are `async`.
- All handler methods return `Task<T>` and are `async`.
- All controller action methods return `Task<IActionResult>` or `Task<ActionResult<T>>`.
- Accept `CancellationToken ct` as the last parameter on all async methods.
- **Never** use `.Result`, `.Wait()`, `.GetAwaiter().GetResult()` on a `Task`.
- **Never** use `async void` (exception for event handlers only, with documented rationale).

**Correct:**
```csharp
public async Task<AssetDto?> GetAssetAsync(AssetId id, CancellationToken ct)
{
    var asset = await _context.Assets
        .AsNoTracking()
        .Where(a => a.Id == id)
        .Select(a => new AssetDto(a.Id.Value, a.Name, a.ConditionRating, a.InstallDate))
        .FirstOrDefaultAsync(ct);
    return asset;
}
```

**Incorrect:**
```csharp
public AssetDto? GetAsset(AssetId id)
{
    // wrong: blocking on async, deadlock risk
    var asset = _context.Assets.FirstOrDefaultAsync(a => a.Id == id).Result;
    return asset is null ? null : new AssetDto(asset.Id.Value, asset.Name, asset.ConditionRating, asset.InstallDate);
}
```

---

### Error Handling

- **FluentValidation** at the API boundary validates all input DTOs. Do not re-validate in handlers or domain methods for things already validated at the boundary.
- **Throw specific exceptions**, never `throw new Exception("message")`. Use or create domain-specific exception types (`AssetNotFoundException`, `DuplicateInspectionException`).
- **Global exception middleware** in `Api/Middleware/GlobalExceptionHandler.cs` catches unhandled exceptions and returns RFC 7807 problem details. Do not catch-and-swallow exceptions in handlers.
- Return results using the Result pattern (or MediatR-based errors) for expected failure modes. Reserve exceptions for truly exceptional conditions.

**Correct:**
```csharp
// Application/Assets/Queries/GetAssetById/GetAssetByIdHandler.cs
public async Task<AssetDto> Handle(GetAssetByIdQuery request, CancellationToken ct)
{
    var asset = await _repository.GetByIdAsync(new AssetId(request.Id), ct);

    if (asset is null)
        throw new AssetNotFoundException(request.Id);

    return _mapper.Map<AssetDto>(asset);
}
```

**Incorrect:**
```csharp
public async Task<AssetDto> Handle(GetAssetByIdQuery request, CancellationToken ct)
{
    try
    {
        var asset = await _repository.GetByIdAsync(new AssetId(request.Id), ct);
        return _mapper.Map<AssetDto>(asset);
    }
    catch (Exception ex)
    {
        // wrong: swallowing the exception, losing the stack trace
        _logger.LogError("Something went wrong");
        return null!;
    }
}
```

---

### LINQ

- Prefer **method syntax** over query syntax for consistency.
- Build filters incrementally on `IQueryable<T>` before calling terminal operations — do not call `ToList()` before filtering.
- Do not chain `.Select(...).Where(...)` when a single expression combining them is clearer.
- Always paginate: use `.Skip().Take()` for list queries.
- Use `.AnyAsync()` for existence checks, not `.CountAsync() > 0`.

**Correct:**
```csharp
var assets = await _context.Assets
    .AsNoTracking()
    .Where(a => a.Status == AssetStatus.Active)
    .Where(a => a.AssetClassId == request.AssetClassId)
    .OrderBy(a => a.Name)
    .Skip((request.Page - 1) * request.PageSize)
    .Take(request.PageSize)
    .Select(a => new AssetListItemDto(a.Id.Value, a.Name, a.ConditionRating))
    .ToListAsync(ct);
```

**Incorrect:**
```csharp
// wrong: loads ALL records into memory then filters
var allAssets = await _context.Assets.ToListAsync(ct);
var filtered = allAssets
    .Where(a => a.Status == AssetStatus.Active)
    .Select(a => new AssetListItemDto(a.Id.Value, a.Name, a.ConditionRating))
    .ToList();
```

---

### EF Core

- **Never eager-load navigation properties by default.** Explicit `.Include()` only when you need the related data.
- **Always use `AsNoTracking()`** on read-only queries. Change tracking is expensive and unnecessary for queries that will not mutate entities.
- **Strongly-typed IDs** via value objects. `AssetId`, `TenantId`, `InspectionId` — prevents accidentally passing a bridge ID where an asset ID is expected.
- **Entity configurations** in separate `IEntityTypeConfiguration<T>` classes in `Infrastructure/Persistence/Configurations/` — never inline in `OnModelCreating`.
- **Global query filters** for multi-tenancy and soft delete. Never bypass except via explicitly named `IgnoreQueryFilters()` calls with a comment explaining why.

**Correct:**
```csharp
// Infrastructure/Persistence/Configurations/AssetConfiguration.cs
public class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id)
            .HasConversion(id => id.Value, value => new AssetId(value));
        builder.Property(a => a.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(a => new { a.TenantId, a.Status });
        builder.HasQueryFilter(a => a.TenantId == EF.Property<Guid>(a, "_currentTenantId")
            && a.DeletedAt == null);
    }
}
```

---

### Comments and Documentation

- Write **XML doc comments** on all public types and members in `Application/` and `Domain/`. Inline comments only for non-obvious invariants.
- Comments explain **WHY**, not WHAT. The code explains what it does.
- Do not comment out code. Use git to preserve history.

**Correct:**
```csharp
/// <summary>
/// Calculates the Remaining Useful Life of an asset using the Weibull deterioration model.
/// </summary>
/// <param name="currentConditionIndex">Condition index on 0–5 scale (0 = failed, 5 = new).</param>
/// <param name="installDate">Date the asset was placed in service.</param>
/// <param name="assetClass">Asset class containing Weibull shape and scale parameters.</param>
/// <returns>Estimated remaining life in decimal years. Returns 0 if the asset is already failed.</returns>
public RulResult Calculate(decimal currentConditionIndex, DateOnly installDate, AssetClass assetClass)
{
    // Weibull uses age from install date — condition alone is insufficient without age context.
    var ageYears = (decimal)(DateOnly.FromDateTime(DateTime.UtcNow) - installDate).TotalDays / 365.25m;
    // ...
}
```

---

### Test Naming and Structure

```csharp
// MethodName_Scenario_ExpectedResult
[Fact]
public void Calculate_WhenConditionIndexIsZero_ReturnsZeroYears()
{
    // Arrange
    var calculator = new RulCalculator();
    var assetClass = AssetClassBuilder.Create().WithWeibullShape(2.5m).Build();

    // Act
    var result = calculator.Calculate(conditionIndex: 0m, installDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-10)), assetClass);

    // Assert
    result.RemainingYears.Should().Be(0);
}
```

---

## TypeScript / React Standards

### Type System

- **Always explicit return types** on exported functions and component render functions.
- **Prefer `interface` for object shapes**, `type` for unions, intersections, and mapped types.
- **No `any`** except at external API boundaries with justification comment. Use `unknown` for truly unknown types and narrow with guards.
- Enable `strict: true` in `tsconfig.json`. All strict checks must pass. Zero TypeScript errors at build time.

**Correct:**
```typescript
interface AssetListResponse {
  data: AssetListItem[];
  total: number;
  page: number;
  pageSize: number;
}

type AssetStatus = 'Active' | 'Inactive' | 'Decommissioned';

export function formatConditionRating(rating: number): string {
  if (rating >= 4) return 'Good';
  if (rating >= 3) return 'Fair';
  if (rating >= 2) return 'Poor';
  return 'Failed';
}
```

**Incorrect:**
```typescript
// wrong: using any
export function formatConditionRating(rating: any): any {
  return rating >= 4 ? 'Good' : 'Poor';
}

// wrong: no return type
export function getAssetDisplayName(asset) {
  return asset.name;
}
```

---

### Components

- **Functional components only.** No class components.
- Props interface named `[ComponentName]Props`.
- Export components as named exports, not default exports (enables better tooling support).
- Keep components focused: if a component does rendering + data fetching + formatting, split it.

**Correct:**
```typescript
interface AssetCardProps {
  asset: AssetListItem;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

export function AssetCard({ asset, onSelect, isSelected = false }: AssetCardProps): JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={cn('rounded-lg border p-4 cursor-pointer', isSelected && 'border-blue-500')}
      onClick={() => onSelect(asset.id)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(asset.id)}
    >
      <h3 className="font-semibold text-sm">{asset.name}</h3>
      <p className="text-xs text-muted-foreground">{formatConditionRating(asset.conditionIndex)}</p>
    </div>
  );
}
```

**Incorrect:**
```typescript
// wrong: class component
class AssetCard extends React.Component {
  render() { return <div>{this.props.asset.name}</div>; }
}

// wrong: default export, no props interface, implicit any return
export default function AssetCard(props) {
  return <div>{props.asset.name}</div>;
}
```

---

### Custom Hooks

- Prefixed with `use`.
- Return typed objects, not tuples (except useState-pattern paired `[value, setter]`).
- Never call hooks conditionally.

**Correct:**
```typescript
interface UseAssetResult {
  asset: AssetDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useAsset(id: string): UseAssetResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['assets', id],
    queryFn: () => api.getAsset(id),
    staleTime: 30_000,
  });

  return { asset: data, isLoading, isError, error: error as Error | null };
}
```

**Incorrect:**
```typescript
// wrong: returns tuple (not a useState-pattern hook)
export function useAsset(id: string): [AssetDetail | undefined, boolean] {
  const [asset, setAsset] = useState<AssetDetail>();
  // wrong: raw fetch in a hook without TanStack Query
  useEffect(() => {
    fetch(`/api/v1/assets/${id}`).then(r => r.json()).then(setAsset);
  }, [id]);
  return [asset, false];
}
```

---

### State Management

- **TanStack Query** for all server state (data fetched from the API).
- **React `useState` / `useReducer`** for local UI state (modals open/closed, form drafts not yet submitted, transient selection state).
- **No global state management library** (Redux, Zustand, MobX) unless a pattern genuinely requires cross-route shared mutable state that cannot be expressed as URL params or server state.

**Correct:**
```typescript
// Server state — TanStack Query
export function AssetList(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.listAssets({ page: 1, pageSize: 20 }),
    staleTime: 30_000,
  });

  // Local UI state
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ...
}
```

---

### Routing

- TanStack Router file-based routes in `src/routes/`.
- Always use the generated `Link` component and `navigate` function — never string path navigation.
- Route params and search params are typed — use the type-safe accessors.

**Correct:**
```typescript
// Navigate with type-safe params
import { Link } from '@tanstack/react-router';
<Link to="/assets/$assetId" params={{ assetId: asset.id }}>View</Link>
```

**Incorrect:**
```typescript
// wrong: string navigation bypasses type safety
window.location.href = `/assets/${asset.id}`;
// also wrong:
history.push(`/assets/${asset.id}`);
```

---

### Styling

- **Tailwind utility classes** for all styling.
- **No CSS modules**, no CSS-in-JS, no `styled-components`.
- No inline styles except for truly dynamic values (e.g., a width calculated from a number).
- Use **`cn()`** (clsx + twMerge) for conditional class combinations.
- Use shadcn/ui components as primitives — do not reimplement Dialog, Button, Card, etc.

---

### Async Operations

- All async operations go through TanStack Query queries (reads) or mutations (writes).
- No raw `useState` + `useEffect` for data fetching.
- Handle loading, error, and empty states explicitly — never assume data is present.

---

### Import Organization

Enforced by ESLint `import/order` rule. Order:

1. Node.js built-ins (rare in frontend)
2. External packages (`react`, `@tanstack/react-query`, `zod`, etc.)
3. Internal `@/` aliased imports (`@/features/assets/AssetCard`, `@/lib/formatters`)
4. Relative imports (`./AssetForm`, `../hooks/useAssets`)

---

## Anti-Patterns Reference

### C# Anti-Patterns

| Anti-pattern | Why it's wrong | Correct alternative |
|---|---|---|
| `.Result` or `.Wait()` on a Task | Deadlock risk in ASP.NET; blocks thread pool | `await` the Task |
| Business logic in controllers | Untestable, violates Clean Architecture | Move to MediatR handler |
| `new Exception(message)` | No specific type for catch filtering | Create a domain exception class |
| `ToList()` before `Where()` | Loads entire table into memory | Filter in the IQueryable chain |
| `IEnumerable` repository return | Deferred execution across boundaries is confusing | Return `List<T>` or `IReadOnlyList<T>` from repositories |
| Lazy loading enabled | Silent N+1 queries in production | Explicit `Include()` only when needed |
| Entity returned from controller | Leaks domain internals, breaks separation | Map to DTO; return DTO |
| Empty catch block | Swallows errors silently | Log + rethrow, or handle specifically |
| `#pragma warning disable` without explanation | Hides real issues | Fix the issue or add a clear justification comment |

### TypeScript / React Anti-Patterns

| Anti-pattern | Why it's wrong | Correct alternative |
|---|---|---|
| `useEffect` for data fetching | Race conditions, no caching, no deduplication | TanStack Query |
| `any` type | Defeats TypeScript's type system | Use `unknown` + type guard, or explicit type |
| Class component | Legacy pattern, harder to compose with hooks | Functional component |
| Default export components | Harder to refactor/rename; worse tree-shaking | Named export |
| Testing internal state | Brittle; breaks on refactoring | Test observable behavior (what the user sees) |
| CSS modules or inline styles | Inconsistent with Tailwind approach | Tailwind utility classes |
| Business logic in components | Untestable in isolation | Extract to custom hook or utility function |
| Hardcoded route strings | Not type-safe; breaks silently on rename | TanStack Router type-safe navigation |
| `console.log` in production code | Noise in browser console, potential data leak | Remove before merging; use structured logging |

---

_See also: [02 — Folder Standards](./02-folder-standards.md) for where to put files, [03 — API Standards](./03-api-standards.md) for controller patterns._
