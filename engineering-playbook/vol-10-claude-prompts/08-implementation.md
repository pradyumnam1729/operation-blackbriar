# 08 — Implementation Prompt

Two complete prompts: one for backend (.NET 8 / Clean Architecture) and one for frontend (React 18 / TypeScript). Run the backend prompt first, then run the frontend prompt — the frontend prompt depends on the API endpoints established by the backend.

---

## Backend Implementation Prompt

Replace all `[PLACEHOLDER]` values. Paste the full prompt:

---

You are implementing a backend feature for the Aurigo Maintain product. The stack is .NET 8, Clean Architecture (Api / Application / Domain / Infrastructure), EF Core 8, PostgreSQL 16 + PostGIS. Follow Aurigo's conventions exactly.

**User Story:**
```
As a [PERSONA], I want to [GOAL] so that [BENEFIT].
```

**Acceptance Criteria:**
```
[PASTE ALL ACCEPTANCE CRITERIA HERE]
```

**Step 1 — Read the domain context:**
Read these files before writing any code:
- `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/[RELEVANT_ENTITY].cs`
- If there is a related entity: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/[RELATED_ENTITY].cs`
- `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/AssetMaintenanceDbContext.cs`

**Step 2 — Read a reference handler for pattern:**
Read this existing handler as the pattern you will follow:
`[PATH_TO_SIMILAR_EXISTING_HANDLER]`

**Step 3 — Read the existing controller for this module (if applicable):**
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Api/Controllers/[MODULE]Controller.cs`

**Now implement the feature in this exact order:**

**3a. Domain changes (if needed):**
If the story requires a new property on an existing entity, add it to the entity class.
If the story requires a new entity, create it in `Domain/Entities/` following this pattern:
- Inherit from `BaseEntity` or `AuditableEntity` as appropriate
- Include `TenantId` as a required property
- Use private setters for properties that have business rules
- No EF Core attributes on domain entities — use Fluent API in the DbContext configuration

**3b. Application layer — Command or Query class:**
Determine: is this a write operation (command) or read operation (query)?
- Write: create in `Application/[MODULE]/Commands/[CommandName]/[CommandName].cs`
- Read: create in `Application/[MODULE]/Queries/[QueryName]/[QueryName].cs`

The command/query class is a record (or class) implementing `IRequest<[ResponseType]>`.

**3c. FluentValidation Validator:**
Create the validator in the same directory as the command/query: `[CommandName]Validator.cs`
Rules:
- Validate every user-controlled property
- Use `.WithMessage()` for every rule — messages must be user-friendly
- Do not validate TenantId (it comes from the JWT claim, not user input)
- Do not duplicate validation in the handler

**3d. MediatR Handler:**
Create in the same directory: `[CommandName]Handler.cs`

Follow these EF Core patterns — mandatory, not optional:
- Read queries: always use `.AsNoTracking()` before `.FirstOrDefaultAsync()` or `.ToListAsync()`
- Only `.Include()` what you actually need
- No lazy loading: do not access navigation properties without a prior explicit `.Include()`
- Pagination: use `.Skip((page - 1) * pageSize).Take(pageSize)`
- Multi-tenancy: DO NOT manually add `.Where(x => x.TenantId == tenantId)` — the global query filter handles this
- Async all the way: every EF Core call must be awaited. No `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`
- No business logic in the handler beyond orchestration: if there is a calculation, call the calculation engine

**3e. Response DTO:**
Create in `Application/[MODULE]/[Feature]/[FeatureResponseDto].cs`.
Never return a domain entity from a handler. Always map to a DTO.

**3f. AutoMapper Profile:**
Add the mapping to the existing AutoMapper profile for this module in `Application/[MODULE]/Mappers/[Module]MappingProfile.cs`.

**3g. Controller Action:**
Add to `Api/Controllers/[MODULE]Controller.cs`:
- Route following `/api/v1/[resource]` convention
- Always `[Authorize]`
- Extract TenantId from JWT claim: `var tenantId = User.GetTenantId();`
- Create the command/query, send via MediatR
- Add `[ProducesResponseType]` attributes for every possible status code
- No business logic in the controller

**3h. EF Core Migration (if model changed):**
```bash
dotnet ef migrations add [MigrationName] --project src/Aurigo.AssetMaintenance.Infrastructure --startup-project src/Aurigo.AssetMaintenance.Api
```
Verify the migration file is not empty and the SQL generated is correct.

**3i. DI Registration:**
If you created a new service or repository, register it in `Application/DependencyInjection.cs` or `Infrastructure/DependencyInjection.cs`.
MediatR handlers register automatically via assembly scanning.

**Step 4 — Write tests:**

**Unit tests** (for any new calculation logic ONLY):
File: `tests/Aurigo.AssetMaintenance.UnitTests/Calculations/[CalculationEngine]Tests.cs`

**Integration test** (for the new API endpoint):
File: `tests/Aurigo.AssetMaintenance.IntegrationTests/[MODULE]/[Feature]IntegrationTests.cs`
Use `WebApplicationFactory<Program>` and Testcontainers (never mock the database).
Include a test that verifies tenant isolation: data from tenant A should not appear in a request authenticated as tenant B.

**Constraints that cannot be violated:**
- Do not manually filter by TenantId in queries — the global EF Core query filter handles it
- Do not use `AsTracking` on read-only queries
- Do not put business logic in controllers
- Do not validate the same thing in both the validator and the handler
- Do not return domain entities from handlers or controllers
- Do not introduce any new NuGet package without noting it in the PR description with justification

**After completing the implementation, provide:**

```
## Implementation Summary

### Files Created
- [path/to/file.cs] — [what it does]

### Files Modified
- [path/to/file.cs] — [what was changed and why]

### Migration
- [MigrationName] — [what schema change it makes]

### API Endpoint(s)
- [HTTP METHOD] [/api/v1/route] — [description]
- Request: [shape of request body or query params]
- Response: [shape of response body]
- Auth: [required roles]

### Test Coverage
- Unit tests: [list of test scenarios]
- Integration tests: [list of test scenarios]

### Known Gaps / Follow-up Required
- [anything not implemented due to missing information]
```

---

## Frontend Implementation Prompt

Run this after the backend implementation is complete. Replace all `[PLACEHOLDER]` values. Paste the full prompt:

---

You are implementing a frontend feature for the Aurigo Maintain product. The stack is React 18, TypeScript 5, Vite 5, TanStack Router (file-based), TanStack Query, Tailwind CSS, shadcn/ui, react-hook-form + zod. Follow Aurigo's frontend conventions exactly.

**User Story:**
```
As a [PERSONA], I want to [GOAL] so that [BENEFIT].
```

**API Endpoints (from the backend implementation):**
```
[HTTP METHOD] [/api/v1/route]
Request: [shape]
Response: [shape]
Auth: Bearer JWT required
```

**Step 1 — Read context:**
Read these files before writing any code:
- `frontend/asset-maintenance-web/src/routeTree.gen.ts` — understand the existing route tree
- `frontend/asset-maintenance-web/src/features/[MODULE]/` — read existing feature files for pattern
- Read one existing page component as a reference: `frontend/asset-maintenance-web/src/routes/[SIMILAR_PAGE].tsx`
- Read one existing TanStack Query hook as a reference: `frontend/asset-maintenance-web/src/features/[MODULE]/hooks/[SIMILAR_HOOK].ts`

**Step 2 — Generate/update the API client (if new endpoints were added):**
```bash
cd frontend/asset-maintenance-web && npm run gen:api
```

**Now implement the feature in this exact order:**

**2a. TanStack Query Hooks:**
Create in `src/features/[MODULE]/hooks/`:

For READ operations:
```typescript
export function use[Feature]([params]: [ParamTypes]) {
  return useQuery({
    queryKey: ['[feature-key]', params],
    queryFn: () => apiClient.[endpoint]([params]),
  })
}
```

For WRITE operations:
```typescript
export function use[Action][Feature]() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: apiClient.[endpoint],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['[feature-key]'] })
      toast({ title: '[User-friendly success message]' })
    },
    onError: () => {
      toast({ title: 'Error', description: '[User-friendly error message]', variant: 'destructive' })
    },
  })
}
```

**2b. Route File:**
Create the route file at the correct path in `src/routes/` following TanStack Router file-based routing conventions.

**2c. Page Component:**
Create in `src/features/[MODULE]/[PageName].tsx`.

MANDATORY: Every async operation must have explicit handling for all three states:

```tsx
function [PageName]() {
  const { data, isLoading, isError, error } = use[Feature]()

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>
  }

  if (isError) {
    return <div className="text-destructive">Failed to load [feature name]. {error?.message}</div>
  }

  if (!data || data.length === 0) {
    return <EmptyState title="No [items] yet" description="[Helpful guidance]" />
  }

  return (/* normal render */)
}
```

Use shadcn/ui components for all UI elements.

**2d. Form Component (if required):**
Use react-hook-form + zod:

```typescript
const [formName]Schema = z.object({
  fieldName: z.string().min(1, 'Field is required'),
  numericField: z.number().min(0).max(5, 'Must be between 0 and 5'),
})

type [FormName]Values = z.infer<typeof [formName]Schema>
```

**2e. Mobile Viewport:**
Verify (or instruct the engineer to verify) that the feature works at 375px width. No horizontal scroll, no truncated buttons, no unreadable text.

**Constraints that cannot be violated:**
- Never use `useEffect` for data fetching — always use TanStack Query hooks
- Never call the API client directly in a component — always use a custom hook
- Never use uncontrolled inputs — all forms use react-hook-form
- Never use TypeScript `any` type
- Every async operation must have loading, error, and empty states

**After completing the implementation, provide:**

```
## Frontend Implementation Summary

### Files Created
- [src/features/.../file.tsx] — [what it does]
- [src/routes/[route].tsx] — [route path]

### Route Added
- Path: /[route/path]
- Component: [PageComponent]

### Hooks Created
- [hookName] — [what it fetches/mutates]

### Mobile Viewport
[Confirmed | Needs manual verification] at 375px

### Known Gaps
- [anything not implemented]
```

---
