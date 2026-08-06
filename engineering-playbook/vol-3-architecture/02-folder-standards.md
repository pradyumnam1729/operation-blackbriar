# Folder Standards

> Volume 3 · Architecture · Document 02  
> Directory layout for backend (Clean Architecture) and frontend (Vite/React)

Every directory in the codebase has a defined purpose. If you know the type of artifact you are creating, you should know exactly where it goes without asking. This document defines those rules and explains the rationale so that, when you encounter a situation not covered explicitly, you can derive the correct placement from first principles.

---

## Backend — .NET Clean Architecture

The backend follows Clean Architecture strictly. The key principle: **dependencies flow inward**. Domain has no dependencies. Application depends on Domain. Infrastructure depends on Application and Domain. Api depends on Application (and occasionally on Infrastructure for DI wiring only).

```
src/
  Aurigo.AssetMaintenance.Api/
  Aurigo.AssetMaintenance.Application/
  Aurigo.AssetMaintenance.Domain/
  Aurigo.AssetMaintenance.Infrastructure/
tests/
  Aurigo.AssetMaintenance.UnitTests/
  Aurigo.AssetMaintenance.IntegrationTests/
```

---

### Api Layer (`Aurigo.AssetMaintenance.Api/`)

The **entry point** of the application. Owns HTTP concerns only.

```
Aurigo.AssetMaintenance.Api/
  Controllers/
    AssetsController.cs
    InspectionsController.cs
    CapitalNeedsController.cs
    JobOrdersController.cs
    DashboardController.cs
    AuthController.cs
  Middleware/
    GlobalExceptionHandlerMiddleware.cs
    RequestLoggingMiddleware.cs
    MultiTenantResolverMiddleware.cs
  Program.cs
  appsettings.json
  appsettings.Development.json
  Aurigo.AssetMaintenance.Api.csproj
```

**Rules:**
- One controller per aggregate root. `AssetsController` handles everything under `/api/v1/assets`. Do not put inspection endpoints in `AssetsController` because they are related domain-wise — inspections are their own aggregate root.
- Controllers inject `IMediator` (MediatR). Nothing else directly. No repository injection in controllers.
- Middleware handles cross-cutting concerns: exception handling, request correlation IDs, tenant resolution from JWT.
- `Program.cs` is the DI composition root. It calls `builder.Services.AddApplicationServices()` and `builder.Services.AddInfrastructureServices()`. The wiring for each layer lives in that layer's own `DependencyInjection.cs`.
- `appsettings.json` contains configuration shape (keys with empty or example values). `appsettings.Development.json` contains local overrides (real connection strings for local Postgres, etc.). Neither file ever contains production secrets.

**What does NOT go here:**
- Business logic. Never.
- Database queries. Never.
- Validation rules. Only the registration of FluentValidation and the `[ApiController]` attribute's model state auto-validation.

---

### Application Layer (`Aurigo.AssetMaintenance.Application/`)

The **use case layer**. Orchestrates the flow from HTTP request to domain operation to persistence. No framework dependencies except MediatR and FluentValidation.

```
Aurigo.AssetMaintenance.Application/
  Assets/
    Commands/
      CreateAsset/
        CreateAssetCommand.cs
        CreateAssetCommandHandler.cs
        CreateAssetCommandValidator.cs
      UpdateAsset/
        UpdateAssetCommand.cs
        UpdateAssetCommandHandler.cs
        UpdateAssetCommandValidator.cs
      DecommissionAsset/
        DecommissionAssetCommand.cs
        DecommissionAssetCommandHandler.cs
    Queries/
      GetAssetById/
        GetAssetByIdQuery.cs
        GetAssetByIdQueryHandler.cs
      ListAssets/
        ListAssetsQuery.cs
        ListAssetsQueryHandler.cs
    DTOs/
      AssetDto.cs
      AssetListItemDto.cs
      AssetDetailDto.cs
    Mappers/
      AssetMappingProfile.cs
  Inspections/
    Commands/
      RecordInspection/
        RecordInspectionCommand.cs
        RecordInspectionCommandHandler.cs
        RecordInspectionCommandValidator.cs
    Queries/
      GetInspectionHistory/
        GetInspectionHistoryQuery.cs
        GetInspectionHistoryQueryHandler.cs
    DTOs/
      InspectionDto.cs
      InspectionListItemDto.cs
    Mappers/
      InspectionMappingProfile.cs
  CapitalNeeds/
    Commands/
    Queries/
    DTOs/
    Mappers/
  Calculations/
    RulCalculator.cs
    ArvCalculator.cs
    RiskScorer.cs
    DeteriorationEngine.cs
  Common/
    Behaviors/
      ValidationBehavior.cs
      LoggingBehavior.cs
    Interfaces/
      ICurrentUserService.cs
      IDateTimeProvider.cs
    Models/
      PagedList.cs
      PaginationQuery.cs
      Result.cs
    Exceptions/
      AssetNotFoundException.cs
      InspectionNotFoundException.cs
      ValidationException.cs
  DependencyInjection.cs
```

**Rules for each subdirectory:**

**`[Module]/Commands/[CommandName]/`** — Each command gets its own folder containing: the `IRequest<T>` command record, the `IRequestHandler<T>` implementation, and the `AbstractValidator<T>`. Three files minimum, all co-located.

**`[Module]/Queries/[QueryName]/`** — Same pattern as commands but for reads. Queries should never mutate state.

**`[Module]/DTOs/`** — All DTO records for this module. DTOs flow outward (returned from queries). Never return domain entities from query handlers.

**`[Module]/Mappers/`** — AutoMapper profiles that map Domain entities to DTOs. One profile per module (or one per entity if the module is large).

**`Calculations/`** — Pure calculation engines. These classes have **zero** dependencies on EF Core, HTTP, logging, or any infrastructure concern. They take inputs and return outputs. They are the most testable code in the application. Coverage target: ≥ 90% line coverage. See [01 — Coding Standards](./01-coding-standards.md) and [13 — Testing](./13-testing.md).

**`Common/`** — Cross-cutting application concerns: behaviors (MediatR pipeline behaviors for logging and validation), interfaces that the application layer depends on but the infrastructure layer implements (`ICurrentUserService`, `IDateTimeProvider`), shared models (`PagedList<T>`, `Result<T>`), and shared exception types.

**What does NOT go here:**
- EF Core `DbContext` references. The Application layer depends on repository interfaces (`IAssetRepository`) defined in `Domain/Interfaces/` — not on EF Core directly.
- External HTTP calls. Those are in Infrastructure via stubbed interfaces.
- Domain logic. `Asset.UpdateCondition()` lives on the `Asset` entity in Domain, not in a handler.

---

### Domain Layer (`Aurigo.AssetMaintenance.Domain/`)

The **heart of the model**. Pure C#. Zero framework dependencies.

```
Aurigo.AssetMaintenance.Domain/
  Entities/
    Asset.cs
    AssetClass.cs
    Inspection.cs
    InspectionDefect.cs
    CapitalNeed.cs
    JobOrder.cs
  ValueObjects/
    AssetId.cs
    TenantId.cs
    InspectionId.cs
    CapitalNeedId.cs
    ConditionIndex.cs
    Money.cs
    GeoCoordinate.cs
  Enums/
    ConditionRating.cs
    AssetStatus.cs
    InspectionType.cs
    CapitalNeedPriority.cs
    RiskLevel.cs
  Events/
    AssetRegisteredEvent.cs
    InspectionCompletedEvent.cs
    ConditionUpdatedEvent.cs
    AssetDecommissionedEvent.cs
  Interfaces/
    IAssetRepository.cs
    IInspectionRepository.cs
    ICapitalNeedRepository.cs
    IUnitOfWork.cs
  Common/
    AggregateRoot.cs
    Entity.cs
    ValueObject.cs
    DomainEvent.cs
```

**Rules:**
- Entities own their invariants. `Asset.UpdateCondition()` validates the condition index range. `Inspection.Complete()` ensures the inspection is in the right state before transitioning.
- Value objects are immutable. Use C# `record` types.
- Domain events are raised inside entity methods and collected on `AggregateRoot`. The Infrastructure layer dispatches them after `SaveChanges`.
- Repository interfaces define the contract. Implementation is in Infrastructure. The Domain does not know about EF Core.

**What does NOT go here:**
- EF Core attributes. No `[Key]`, `[Required]`, `[Column]`. Entity configuration lives in `Infrastructure/Persistence/Configurations/`.
- FluentValidation. API boundary validation lives in Application validators.
- DTOs. The Domain returns Domain objects. Mapping to DTOs happens in Application handlers.

---

### Infrastructure Layer (`Aurigo.AssetMaintenance.Infrastructure/`)

The **outer ring**. Implements interfaces defined in Domain and Application.

```
Aurigo.AssetMaintenance.Infrastructure/
  Persistence/
    AssetMaintenanceDbContext.cs
    Configurations/
      AssetConfiguration.cs
      AssetClassConfiguration.cs
      InspectionConfiguration.cs
      InspectionDefectConfiguration.cs
      CapitalNeedConfiguration.cs
      JobOrderConfiguration.cs
      AuditLogConfiguration.cs
    Migrations/
      20241201_InitialSchema.cs
      20241215_Add_Inspections.cs
      20250103_Add_CapitalNeeds.cs
    Repositories/
      AssetRepository.cs
      InspectionRepository.cs
      CapitalNeedRepository.cs
    Interceptors/
      AuditInterceptor.cs
      DomainEventDispatchInterceptor.cs
    SeedRunner.cs
  ExternalClients/
    CmmsClient/
      ICmmsClient.cs
      StubCmmsClient.cs
    NotificationsClient/
      INotificationsClient.cs
      StubNotificationsClient.cs
    DocumentManagementClient/
      IDocumentManagementClient.cs
      StubDocumentManagementClient.cs
  Services/
    CurrentUserService.cs
    DateTimeProvider.cs
  DependencyInjection.cs
```

**Rules:**

**`Persistence/Configurations/`** — One `IEntityTypeConfiguration<T>` class per entity. All EF Core mapping (column names, indexes, foreign keys, value conversions, owned entities) goes here. `OnModelCreating` in the DbContext only calls `modelBuilder.ApplyConfigurationsFromAssembly(...)`.

**`Persistence/Repositories/`** — EF Core implementations of the domain repository interfaces. Repositories use `AsNoTracking()` for all reads. For writes, they load the entity, hand it to the handler, and the handler calls the mutating domain method. The DbContext tracks the changes automatically.

**`Persistence/Interceptors/`** — `AuditInterceptor` hooks into `SaveChanges` to capture mutations into the audit table. `DomainEventDispatchInterceptor` collects domain events from aggregate roots and dispatches them via MediatR after the transaction commits.

**`ExternalClients/`** — Each external integration has: an interface defining the contract, and a stub implementation that returns plausible in-memory data. The stub implements the same interface as the real client. `DependencyInjection.cs` registers the stub unless a real client configuration is provided. Swapping stub for real is a one-file change.

**`SeedRunner.cs`** — Seeds reference data (asset classes, condition rating scales, sample tenant data). Called from `Program.cs` only in the Development environment. All seed operations are idempotent (check before insert).

---

### Tests (`tests/`)

```
tests/
  Aurigo.AssetMaintenance.UnitTests/
    Calculations/
      RulCalculatorTests.cs
      ArvCalculatorTests.cs
      RiskScorerTests.cs
      DeteriorationEngineTests.cs
    Domain/
      AssetTests.cs
      InspectionTests.cs
      CapitalNeedTests.cs
    TestBuilders/
      AssetBuilder.cs
      InspectionBuilder.cs
      AssetClassBuilder.cs
    Aurigo.AssetMaintenance.UnitTests.csproj
  Aurigo.AssetMaintenance.IntegrationTests/
    Api/
      Assets/
        CreateAssetTests.cs
        ListAssetsTests.cs
        GetAssetByIdTests.cs
      Inspections/
        RecordInspectionTests.cs
      CapitalNeeds/
        ListCapitalNeedsTests.cs
    Infrastructure/
      AssetRepositoryTests.cs
    Fixtures/
      DatabaseFixture.cs
      ApplicationFactory.cs
    TestBuilders/
      HttpClientExtensions.cs
    Aurigo.AssetMaintenance.IntegrationTests.csproj
```

**Rules:**
- Unit tests mirror the `Application/Calculations/` and `Domain/` folder structure exactly.
- Integration tests mirror the `Api/Controllers/` structure — each controller gets a test folder with one test class per action group.
- `TestBuilders/` contains the builder pattern classes for creating test data. Builders follow the same convention in both unit and integration test projects.
- `Fixtures/` contains shared Testcontainers setup (start PostgreSQL once per test class, not per test).

---

## Frontend — Vite / React

```
frontend/asset-maintenance-web/
  src/
    api/
    routes/
    features/
    components/
    lib/
    hooks/
  public/
  index.html
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
```

---

### `src/api/` — Generated API Client

This directory is **generated by `npm run gen:api`** from the OpenAPI Swagger JSON. It is not hand-written. It is committed to the repository so that the CI pipeline does not need to run the generator.

```
src/api/
  client.ts         — generated axios client
  types.ts          — generated TypeScript types for all API DTOs
  index.ts          — re-exports
```

**Rule:** Never edit files in `src/api/` by hand. If the API changes, regenerate. If the types look wrong, fix the OpenAPI spec in the backend and regenerate.

---

### `src/routes/` — TanStack Router File-Based Pages

```
src/routes/
  __root.tsx             — Root layout: AppShell, providers, error boundary
  index.tsx              — Dashboard (/)
  assets/
    index.tsx            — Asset list (/assets)
    $assetId.tsx         — Asset detail (/assets/:assetId)
    new.tsx              — Create asset (/assets/new)
  inspections/
    index.tsx
    $inspectionId.tsx
    new.tsx
  capital-needs/
    index.tsx
    $needId.tsx
  job-orders/
    index.tsx
    $jobOrderId.tsx
  reports/
    index.tsx
    tamp.tsx
  settings/
    index.tsx
    asset-classes.tsx
    model-settings.tsx
  auth/
    login.tsx
    logout.tsx
```

**Rules:**
- Route files are **page-level components only**. They wire the feature components together, handle URL params and search params, and set the page title.
- Route files do **not** contain business logic, data fetching hooks (these go in `features/`), or presentational components.
- The file name is the URL segment. `$assetId.tsx` creates a dynamic segment `:assetId`.

---

### `src/features/` — Feature-Collocated Logic

```
src/features/
  assets/
    AssetCard.tsx
    AssetForm.tsx
    AssetDetail.tsx
    AssetMap.tsx
    AssetFilters.tsx
    useAssets.ts
    useAsset.ts
    useCreateAsset.ts
    useUpdateAsset.ts
    assetUtils.ts
  inspections/
    InspectionCard.tsx
    InspectionForm.tsx
    InspectionHistory.tsx
    useInspections.ts
    useRecordInspection.ts
  capital-needs/
    CapitalNeedsTable.tsx
    CapitalNeedCard.tsx
    PriorityBadge.tsx
    useCapitalNeeds.ts
  job-orders/
    JobOrderCard.tsx
    JobOrderTimeline.tsx
    useJobOrders.ts
  dashboard/
    SummaryCard.tsx
    ConditionDistributionChart.tsx
    CapitalNeedsByYearChart.tsx
    RiskHeatmap.tsx
    useDashboardMetrics.ts
  ai/
    RulPanel.tsx
    RiskPanel.tsx
    AiInsightCard.tsx
    useAiRecommendations.ts
```

**Rules:**
- Feature components live alongside their hooks. `AssetCard.tsx` and `useAsset.ts` are in the same directory.
- Hooks named `use[Entity].ts` return a single entity; `use[Entities].ts` (or `use[Entity]List.ts`) return lists.
- Mutation hooks are named `use[Verb][Entity].ts`: `useCreateAsset`, `useUpdateAsset`, `useDecommissionAsset`.
- A feature component should not import from another feature's directory. Shared components go in `components/shared/`.
- `[entity]Utils.ts` contains pure utility functions for this feature (formatters, transformers, calculations specific to this domain).

---

### `src/components/` — Shared UI Components

```
src/components/
  ui/
    button.tsx      — shadcn/ui Button
    card.tsx        — shadcn/ui Card
    dialog.tsx      — shadcn/ui Dialog
    input.tsx       — shadcn/ui Input
    table.tsx       — shadcn/ui Table
    badge.tsx       — shadcn/ui Badge
    (... all shadcn primitives ...)
  layout/
    AppShell.tsx    — Main layout: sidebar + topbar + content
    Sidebar.tsx     — Navigation sidebar
    TopBar.tsx      — Header with breadcrumb, user menu
    PageHeader.tsx  — Consistent page heading with title + actions slot
  shared/
    DataTable.tsx   — Generic paginated table with sort/filter
    MapView.tsx     — Mapbox GL wrapper
    FilterBar.tsx   — Reusable filter row component
    ConditionBadge.tsx
    StatusBadge.tsx
    ConfirmDialog.tsx
    EmptyState.tsx
    LoadingSpinner.tsx
    ErrorBoundary.tsx
    PaginationBar.tsx
```

**Rules:**
- `components/ui/` is managed by the shadcn/ui CLI. Do not edit these files directly — customize via Tailwind tokens in `tailwind.config.ts`.
- `components/layout/` contains the application shell. Only one `AppShell` instance per application.
- `components/shared/` contains reusable components that are not specific to any domain feature. `DataTable` is reused by assets, inspections, capital needs, and job orders.

---

### `src/lib/` — Utilities and Helpers

```
src/lib/
  api.ts           — axios instance, JWT interceptors, apiFetch wrapper
  auth.ts          — login, logout, useCurrentUser, token storage
  mapbox.ts        — Mapbox GL map helpers, layer configs
  formatters.ts    — date, currency, condition index formatters
  validators.ts    — shared Zod schemas (reused across forms)
  queryClient.ts   — TanStack Query client configuration
  utils.ts         — cn() utility (clsx + twMerge), misc helpers
  constants.ts     — app-wide constants (page sizes, condition thresholds)
```

**Rules:**
- `lib/` contains **pure utility functions and configuration** — no React components, no hooks.
- `formatters.ts` is imported by feature components for display formatting. It has no side effects.
- `api.ts` configures the axios instance with the JWT bearer token interceptor and base URL. It is the single place to change API base URL or auth header format.

---

### `src/hooks/` — Global Custom Hooks

```
src/hooks/
  useCurrentUser.ts
  useHasRole.ts
  useMediaQuery.ts
  useLocalStorage.ts
  useDebounce.ts
  usePaginationState.ts
```

**Rules:**
- Only truly global hooks go here — hooks that are used across multiple features and have no feature-specific logic.
- Feature-specific hooks (e.g., `useAssets`) go in `src/features/[feature]/`.

---

## Anti-Patterns Reference

Understanding what NOT to do is as important as knowing the rules.

| Anti-pattern | Consequence | Correct approach |
|---|---|---|
| Business logic in Controllers | Untestable, violates Clean Architecture | Move to MediatR handler in Application |
| EF Core `DbContext` in Application layer | Couples use cases to persistence implementation | Use repository interface from Domain |
| API calls (`fetch`, `axios`) directly in React components | No caching, race conditions, duplicated loading state | Use TanStack Query hooks in `features/` |
| Domain entity returned from an API endpoint | Exposes domain internals, breaks separation | Map to DTO in handler |
| Placing a new feature file in `components/shared/` | Shared components should not know about domain features | Put in `features/[feature]/` |
| Validation rules in Domain entities (duplicating API boundary validation) | Validates twice; unclear where the truth is | Validate at API boundary in FluentValidation validators |
| Hard-coding connection strings in `appsettings.json` | Secrets in source control | Use environment variables or Secrets Manager |
| Mixing `Commands` and `Queries` in the same folder | Violates CQRS intent; harder to navigate | Strict separation in `Commands/` and `Queries/` subdirectories |
| Importing from another feature's directory in frontend | Hidden coupling between features | Use `components/shared/` for truly shared components |
| Editing files in `src/api/` | Regeneration will overwrite changes | Fix the OpenAPI spec in the backend and regenerate |

---

_See also: [01 — Coding Standards](./01-coding-standards.md) for naming rules, [03 — API Standards](./03-api-standards.md) for controller design._
