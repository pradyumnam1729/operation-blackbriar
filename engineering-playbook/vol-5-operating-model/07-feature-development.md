# 07 — Feature Development

This document is the end-to-end guide for implementing a feature from story assignment to merged PR. It covers five phases: Setup, Backend, Frontend, Integration, and PR. Each phase has explicit outputs and a definition of "ready to proceed to the next phase."

Follow this guide in order. Skipping phases creates the most common engineering failures: implementing the wrong thing, missing tests, broken integration, and PRs that fail review on obvious issues.

---

## Branch Naming Convention

All feature branches follow this format:

```
[type]/[issue-number]-[short-description]

Types: feature, fix, chore, refactor, spike, docs
```

Examples:
```
feature/AM-143-tamp-pavement-report
fix/AM-167-inspector-rating-validation
chore/AM-171-upgrade-npgsql-8
refactor/AM-155-extract-risk-calculator
```

Branch from `main` unless working on a feature that depends on another in-progress branch (rare — coordinate with lead engineer if this arises).

---

## Phase 1 — Setup

**Duration**: 30–60 minutes. Do not skip under time pressure.

### 1.1 Read the Story

Read the full story anatomy including all AC, Out of Scope, Dependencies, and Technical Notes. If any section is missing or vague, file a comment on the story and wait for clarification before proceeding. Implementing against a vague story is the most expensive form of waste.

### 1.2 Execute Repository Discovery

Run the discovery protocol from document 01. Even if you have worked on this codebase recently, confirm:
- No new migrations have landed that change the schema you are working with
- No other in-progress branches touch the same files
- The current main is the right base (check git log)

### 1.3 Identify All Files to Change

Before creating the branch, map out every file you expect to create or modify. Be specific about file paths.

Template:
```
Backend creates:
- Domain/Entities/[NewEntity].cs (new)
- Infrastructure/Persistence/Configurations/[NewEntity]Configuration.cs (new)
- Application/Features/[Feature]/Commands/[CommandName].cs (new)
- Application/Features/[Feature]/Commands/[CommandName]Handler.cs (new)
- Application/Features/[Feature]/Queries/[QueryName].cs (new)

Backend modifies:
- Infrastructure/Persistence/[DbContext].cs (add DbSet)
- Infrastructure/DependencyInjection.cs (if new service registration needed)

Migrations:
- Infrastructure/Migrations/[timestamp]_[MigrationName].cs (new)

Frontend creates:
- src/routes/[area]/[page].tsx (new)
- src/features/[area]/components/[Component].tsx (new)
- src/features/[area]/hooks/use[Feature].ts (new)

Frontend modifies:
- src/api/ (regenerated after backend changes)

Tests creates:
- UnitTests/[Feature]/[Handler]Tests.cs (new)
- IntegrationTests/[Feature]/[Endpoint]Tests.cs (new)
```

If the list of files looks unexpectedly large (> 15 files), the story may be too big. Raise this with the lead engineer.

### 1.4 Write an Implementation Plan

Write a short implementation plan (bullet list, not prose) covering the order of operations. The plan prevents you from implementing the frontend before the backend is working, or running migrations before the entity configuration is correct.

### 1.5 Create the Feature Branch

```sh
git checkout main
git pull origin main
git checkout -b feature/AM-[number]-[description]
```

---

## Phase 2 — Backend Implementation

Work in this order within the backend. Do not skip steps.

### 2.1 Domain Entity

If the story requires a new entity:
1. Create the entity class in `Domain/Entities/`
2. Implement required interfaces: `IAuditableEntity`, `IMultiTenantEntity` (required for almost all entities), `ISoftDeletable` if needed
3. Add navigation properties for relationships
4. Do not add validation logic to the entity — validation belongs at the FluentValidation boundary
5. Keep the entity clean: no EF-specific attributes, no DTOs, no services

### 2.2 EF Configuration

1. Create `[Entity]Configuration.cs` in `Infrastructure/Persistence/Configurations/`
2. Implement `IEntityTypeConfiguration<TEntity>`
3. Set: table name (`snake_case`), primary key, column types, nullability, indexes, foreign keys
4. For geometry columns: configure `HasColumnType("geometry(Geometry, 4326)")`
5. Verify the multi-tenancy index: `HasIndex(e => new { e.TenantId, e.Id })` on all aggregate roots
6. Add DbSet to DbContext
7. Apply global query filter if the entity is `IMultiTenantEntity`

### 2.3 Migration

```sh
dotnet ef migrations add [MigrationName] \
  --project src/[ProjectName].Infrastructure \
  --startup-project src/[ProjectName].Api
```

Review the generated migration file before proceeding:
- Does it create the correct table name?
- Does it have the correct column types?
- Does it create all expected indexes?
- Are there any unexpected changes to existing tables? (This signals a configuration error)

Run the migration locally:
```sh
dotnet ef database update \
  --project src/[ProjectName].Infrastructure \
  --startup-project src/[ProjectName].Api
```

Confirm the schema in the database matches expectations.

### 2.4 Command/Query and Handler

Following CQRS with MediatR:

**For a write operation (Command):**
1. Create `[Action][Entity]Command.cs` — a record with the input properties
2. Create `[Action][Entity]CommandHandler.cs` — implements `IRequestHandler<TCommand, TResult>`
3. Create `[Action][Entity]CommandValidator.cs` — FluentValidation rules
4. Register the validator in `Application/DependencyInjection.cs` if auto-registration is not configured

**For a read operation (Query):**
1. Create `Get[Entity/Entities]Query.cs` — a record with filter/pagination parameters
2. Create `Get[Entity/Entities]QueryHandler.cs`
3. Create the DTO: `[Entity]Dto.cs` in `Application/DTOs/` or `Application/Features/[Feature]/`
4. Create the mapper: either AutoMapper profile or hand-written static mapper

**Handler implementation checklist:**
- [ ] Constructor receives DbContext and IMapper (no other services unless truly needed)
- [ ] All DbContext queries are async (`ToListAsync`, `FirstOrDefaultAsync`, etc.)
- [ ] No N+1 queries — use `Include` and `ThenInclude` deliberately
- [ ] Pagination is implemented for list queries (`Skip`, `Take`, return total count)
- [ ] Return type is `Result<TDto>` (or project-specific result wrapper) — no exceptions for not-found
- [ ] Multi-tenancy is automatic via global filter — do not add `Where(e => e.TenantId == ...)` manually

### 2.5 Controller

1. Add action method to existing controller (preferred) or create a new controller for a new domain area
2. Use `[HttpPost]`, `[HttpGet]`, `[HttpPut]`, `[HttpDelete]` with explicit route
3. Map HTTP response from Result: 200/201 on success, 400 on validation errors, 404 on not-found, 409 on conflict
4. Add `[ProducesResponseType]` attributes for Swagger
5. The controller does nothing except translate HTTP ↔ MediatR. No business logic.

### 2.6 Unit Tests

Write unit tests in `UnitTests/` for:
- All calculation logic (see document 10 for coverage requirements)
- Handler logic with mocked DbContext (or in-memory DbContext for simple cases)
- Validators: test each rule — valid input, each invalid case

Run tests: `dotnet test` — all must pass before moving to the frontend phase.

### 2.7 Integration Tests

Write integration tests in `IntegrationTests/` for:
- The complete HTTP call flow (using `WebApplicationFactory` + Testcontainers Postgres)
- The happy path (201/200 with expected body)
- At least two error cases (400 validation, 404 not found)
- Tenant isolation: verify that data created by tenant A is not returned to tenant B

Run integration tests locally: `dotnet test --filter Category=Integration` — all must pass.

---

## Phase 3 — Frontend Implementation

### 3.1 Regenerate API Client

```sh
npm run gen:api
```

This regenerates `src/api/` from the Swagger spec published by the backend. Do not write or edit this directory manually. After regeneration, the TypeScript types for new endpoints are available.

### 3.2 TanStack Query Hooks

Create query/mutation hooks in `src/features/[area]/hooks/`:

```typescript
// Query hook
export function useInspections(assetId: string) {
  return useQuery({
    queryKey: ['inspections', assetId],
    queryFn: () => apiClient.inspections.getByAsset({ assetId }),
  });
}

// Mutation hook
export function useCreateInspection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInspectionDto) =>
      apiClient.inspections.create({ body: data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspections', variables.assetId] });
    },
  });
}
```

### 3.3 Route and Page Component

1. Create the route file in `src/routes/` — TanStack Router uses file-based routing
2. The route file defines: the route (via export), loader (for data fetching on navigation), and the page component
3. Update `routeTree.gen.ts` by running: `npm run routes:generate` (or whatever the project's route generation command is)

### 3.4 Feature Components

Build components in `src/features/[area]/components/`:
- One component per logical UI block (form, table, detail panel, map)
- Use shadcn/ui primitives from `src/components/ui/` — do not build from scratch what shadcn already provides
- Tailwind for all styling — no inline styles, no CSS modules
- Forms use `react-hook-form` + `zod` — the schema mirrors the backend validator rules

### 3.5 Required States

Every data-dependent component must handle all states:

| State | What to Render |
|-------|---------------|
| Loading | Skeleton or spinner — use shadcn `Skeleton` |
| Error | Error message with retry option — use shadcn `Alert` |
| Empty | Helpful empty state — explain why it is empty and what to do next |
| Data | The intended UI |

Missing empty state and error state are the two most common frontend issues caught in code review.

### 3.6 Mobile Test

View the new UI at 375px width (iPhone SE size). All features must be usable on a tablet or phone:
- Forms must be scrollable without horizontal scroll
- Tables must either scroll horizontally or stack into cards
- Buttons must be tap-target-sized (minimum 44px height)
- Map views must be pinch-zoomable

---

## Phase 4 — Integration and Manual Testing

### 4.1 Full Test Suite

```sh
dotnet test          # All backend tests
npm test             # Frontend unit tests
npm run e2e          # Playwright end-to-end tests
```

All tests must pass. If any test fails that was passing before your changes, you introduced a regression. Fix it before proceeding.

### 4.2 Manual Testing of Complete Workflow

Run the application locally (`docker compose up -d`, `dotnet run`, `npm run dev`) and manually test:

1. The complete happy path from UI to database and back
2. All error states (submit invalid form, request with wrong auth, delete non-existent record)
3. The edge cases identified in product discovery (empty state, large data, offline EAM)
4. Cross-browser: Chrome and Firefox minimum
5. Console — no JavaScript errors or warnings

### 4.3 Verify Tenant Isolation

Using two different JWTs with different tenant IDs, confirm that:
- Data created by tenant A is not visible to tenant B
- Attempting to access tenant A's record ID from tenant B's session returns 404

This is a mandatory check, not optional.

---

## Phase 5 — Pull Request

### 5.1 Write the PR Description

A PR description is not a git log summary. It answers: what does this change do, why does it do it that way, and how do I test it?

Required sections:
- **Summary**: 2–3 sentences, what the PR delivers
- **Story**: link to the story ticket
- **Testing**: step-by-step instructions for a reviewer to test the change locally
- **Notes**: anything unusual about the implementation, known limitations, future work
- **Screenshots** (for UI changes): before/after screenshots

### 5.2 Self-Review

Before requesting review, review your own PR:
- Does the diff contain any debugging code (`console.log`, `TODO: remove`, hardcoded values)?
- Are there any files changed that are not related to this story?
- Is the migration clean (no unexpected changes)?
- Are all new files following the naming conventions?

### 5.3 CI Must Pass

Do not request review until CI passes. Every PR must pass:
- Build: `dotnet build` + `npm run build` — zero warnings
- Tests: all unit + integration tests green
- Lint: `npm run lint` — zero errors

### 5.4 Request Reviews

Assign reviewers based on change type:
- Backend-only: 1 backend engineer + lead engineer if touching domain or security
- Frontend-only: 1 frontend engineer
- Full-stack: 1 backend + 1 frontend reviewer
- Architecture change (new entity, new service, pattern change): lead engineer mandatory + architecture review (document 08)

---

## Common Mistakes and Consequences

1. **Skipping product discovery** → Build the wrong thing, full rework required
2. **No mapping of AC to endpoints** → Miss implementing a required behavior, bug found in QA
3. **N+1 query in handler** → Correct behavior, unacceptable performance at scale
4. **Missing `IMultiTenantEntity` on new entity** → Global query filter not applied, tenant data leakage
5. **Editing generated API client files** → Files overwritten on next `gen:api` run, changes lost
6. **Missing empty state** → Blank white screen for new users, support ticket filed
7. **Missing error state** → Unhandled promise rejection crashes the page, user sees a white screen
8. **Hardcoded tenant ID in handler** → Works in development, fails in all production tenants
9. **Missing integration test for tenant isolation** → Data leakage not caught until a security audit
10. **Frontend committed before backend is merged** → Frontend calling endpoints that do not exist in CI, failing E2E tests

---

## Merge Strategy for Backend + Frontend PRs

When a single feature requires both backend and frontend changes, the two PRs must be coordinated. This is one of the most common sources of broken main branches.

### Sequential Merge (Default)

The default policy: **backend merges first, then frontend**. The reasons:
- The generated API client depends on the backend Swagger, which only exists after the backend merges
- E2E tests fail if the frontend calls endpoints that do not exist in the deployed backend
- Rollback is safer: if the frontend has a bug, revert only the frontend; the backend endpoint is inert until called

**Process**:

1. Backend PR is opened first
2. Backend PR passes review and CI
3. Backend PR merges to main
4. Frontend PR runs `npm run gen:api` to regenerate the API client against the merged backend
5. Frontend PR is opened with the regenerated client committed
6. Frontend PR passes review and CI
7. Frontend PR merges to main

### Parallel Development, Sequential Merge

For faster iteration, backend and frontend can be developed in parallel:

1. Both engineers agree on the API contract at story kickoff (see doc 04 DoR)
2. The API contract is committed to the backend PR as an OpenAPI spec, even if the implementation is not complete
3. Frontend engineer regenerates the API client from the draft OpenAPI spec (in their local branch, not committed)
4. Both engineers implement in parallel against the agreed contract
5. Backend PR merges first
6. Frontend engineer rebases, regenerates the API client, commits, and merges the frontend PR

**Rule**: the API contract, once agreed, does not change without both engineers re-agreeing. If it must change (e.g., a field is renamed or a validation rule is discovered mid-implementation), the change is communicated immediately, both PRs update, and the merge order is re-verified.

### The "Single Combined PR" Exception

For very small features (e.g., adding one new field to an existing endpoint and one new form input in the UI), a single combined PR is acceptable if:
- Total change < 200 lines
- Change affects one backend file + one frontend file (typical)
- Both a backend engineer and a frontend engineer review

Do not combine PRs when the change is large. The reviewer cannot effectively review a 1000-line PR that touches multiple concerns.

### When Backend and Frontend PRs Conflict

If two engineers modify the same generated files or the same shared types, conflict is possible. Resolution:

1. **Communicate immediately**: the second-to-merge PR is not the winner; the two engineers pair to resolve
2. **Rebase, don't merge**: the second PR rebases onto the merged first PR, resolves conflicts locally, re-runs `npm run gen:api`, re-runs tests, then re-requests review
3. **Never force-merge with conflicts**: even if CI passes, silent conflict resolution creates hidden bugs

### API Contract Change Mid-Implementation

If a change to the API contract is required after both engineers have started implementation (e.g., an edge case reveals a needed field):

1. The engineer who discovers the need proposes the change in the PR comments and pings the other
2. Both engineers stop implementing on the affected paths
3. A 15-minute sync happens (voice, not slack) to agree on the change
4. The updated contract is committed to the backend PR
5. Both engineers resume implementation against the updated contract
6. The story acceptance criteria are updated if the contract change reflects a scope change

**Anti-pattern**: silent divergence. If the backend engineer changes a field name without telling the frontend engineer, the frontend PR will fail CI after the backend merges. Both engineers waste time. The 15-minute sync is always cheaper than the divergence.

### Multi-PR Coordination for Large Features

For features requiring more than 2 PRs (e.g., a new module with 5+ endpoints and 3+ pages), the story is oversized. Split into multiple stories, each with its own PR pair, and merge incrementally.

The exception: a "foundation PR" pattern, where a small PR lands the base classes, DI registrations, or shared types first (this PR is standalone; it does not add user-visible functionality), then feature PRs build on top. Foundation PRs should be reviewed like any architectural change (Vol 5, doc 08).
