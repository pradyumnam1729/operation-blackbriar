# 10 — Testing

Testing is not a phase that happens after development. It is not QA's responsibility alone. It is an integral part of the development process that happens continuously from the moment a story is picked up to the moment the PR is merged.

This document covers the testing philosophy, testing at each phase, coverage requirements, test data strategy, the flaky test policy, and worked examples.

---

## The Core Principle

**The engineer who writes the code writes the tests.** This is not about burden — it is about quality. The engineer implementing a feature understands the edge cases, the business rules, and the failure modes better than anyone else at that moment. Deferring test writing to "later" means deferring it until that understanding has faded.

QA's role is to verify the whole system behavior from a user perspective — not to discover bugs that testing during development should have caught. Production bugs that "should have been caught in testing" almost always trace back to tests never written, not tests that ran and passed.

---

## Testing at Each Development Phase

### During Story Implementation (TDD Optional, Encouraged)

Test-Driven Development means writing the test before writing the implementation. For calculation engines (RUL, ARV, Risk Score), TDD is the required approach — it is easier to specify a formula as a test than to implement it and then verify correctness.

For handler code, write the test alongside the implementation: implement the happy path, write a test for it, confirm it passes, then implement the first error case, write its test, and so on.

**Minimum tests during implementation:**
- One unit test per method in any Calculations/ class
- One unit test per validation rule (valid case + each invalid case)
- One unit test per handler covering the happy path

### Pre-PR: Full Suite + Manual Edge Cases

Before opening a PR, run the complete test suite locally:

```sh
# Backend
dotnet test

# Frontend
npm test

# E2E (if changed flows are covered by Playwright tests)
npm run e2e
```

All tests must pass. Zero failures, zero skipped tests that are relevant to the change.

Then manually test the complete workflow including the edge cases identified in product discovery (document 03):
- Empty state (no assets, no inspections)
- Maximum data (100+ items in a list)
- Validation errors (submit a form with each required field missing)
- Network error (simulate a 500 response and confirm the error state renders correctly)

### In CI

Every PR triggers the CI pipeline:
- `dotnet build` — must produce zero warnings (warnings-as-errors is enabled)
- `dotnet test` — all unit + integration tests
- `npm run build` — TypeScript compilation, must produce zero type errors
- `npm test` — Vitest unit tests
- `npm run e2e` — Playwright E2E tests (subset of critical flows)

CI failure is a hard gate. A PR with a failing CI cannot be merged. The author fixes the failure — they do not work around it by disabling the test.

---

## Coverage Requirements

Coverage targets are enforced by the CI pipeline. Coverage is measured on every PR. Coverage that drops below thresholds on changed code blocks the merge.

| Code Area | Coverage Target | Rationale |
|-----------|-----------------|-----------|
| `Application/Calculations/` | ≥ 90% line coverage | Calculation errors are compliance failures |
| `Domain/` | ≥ 80% line coverage | Domain rules are the core of the product |
| `Application/Features/` (handlers) | ≥ 70% line coverage | Handlers are the use case layer |
| `Infrastructure/` | ≥ 50% line coverage | Mostly wiring; hard to unit test without DB |
| `Api/` (controllers) | ≥ 50% line coverage | Controllers are thin; integration tests cover them |
| Frontend components | ≥ 60% statement coverage | UI logic, forms, error handling |

**Coverage is not the goal — correctness is.** A test that calls a method without asserting the output inflates coverage and provides no value. Tests must assert specific behavior. Coverage targets exist to catch test gaps, not to be gamed.

---

## Test Data Strategy

### No Production Data

Production data never enters test environments. Reasons: PII/data privacy, test isolation, data stability (production data changes).

### Test Builders (Backend)

Each entity has a corresponding test builder class in `UnitTests/Builders/` or `IntegrationTests/Builders/`. The builder uses the builder pattern to create valid entity instances with sensible defaults, with specific overrides per test.

```csharp
// Example: AssetBuilder
public class AssetBuilder
{
    private Guid _tenantId = Guid.NewGuid();
    private string _name = "Test Asset";
    private AssetType _assetType = AssetType.Pavement;
    private AssetStatus _status = AssetStatus.Active;
    private decimal _replacementCost = 100_000m;

    public AssetBuilder WithTenantId(Guid tenantId) { _tenantId = tenantId; return this; }
    public AssetBuilder WithName(string name) { _name = name; return this; }
    public AssetBuilder WithType(AssetType type) { _assetType = type; return this; }
    public AssetBuilder WithReplacementCost(decimal cost) { _replacementCost = cost; return this; }

    public Asset Build() => new Asset
    {
        Id = Guid.NewGuid(),
        TenantId = _tenantId,
        Name = _name,
        AssetType = _assetType,
        Status = _status,
        ReplacementCost = _replacementCost,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
}
```

This enables clean, readable test setup:
```csharp
var asset = new AssetBuilder()
    .WithTenantId(tenantA)
    .WithType(AssetType.Bridge)
    .WithReplacementCost(2_500_000m)
    .Build();
```

### Testcontainers for Integration Tests

All integration tests that touch the database use a real Postgres + PostGIS instance via Testcontainers. This means:
- No mocked DbContext in integration tests
- Tests run against the real schema after migrations
- Tests are isolated per test class (a new container or a fresh database per test class)
- The container is started once per test class and torn down after all tests in the class run

```csharp
public class InspectionApiTests : IAsyncLifetime
{
    private PostgreSqlContainer _dbContainer = null!;
    private WebApplicationFactory<Program> _factory = null!;

    public async Task InitializeAsync()
    {
        _dbContainer = new PostgreSqlBuilder()
            .WithImage("postgis/postgis:16-3.4")
            .Build();
        await _dbContainer.StartAsync();
        // Configure factory with container connection string...
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        await _dbContainer.DisposeAsync();
    }
}
```

---

## Flaky Test Policy

A flaky test is a test that sometimes passes and sometimes fails without any change to the code. Flaky tests are worse than no tests — they create false alarms, erode trust in the test suite, and cause engineers to ignore failures.

**Definition of a flaky test**: A test that fails 3 or more consecutive times in CI without a corresponding code change.

**Flaky test process:**
1. The test is immediately quarantined: marked with `[Trait("Category", "Quarantine")]` so it does not block CI
2. A task is filed with P2 priority to investigate and fix the test
3. The fix must be shipped within the next sprint
4. The quarantine attribute is removed when the fix is merged and the test passes 10 consecutive CI runs

**Common causes of flaky tests in Aurigo projects:**
- Time-dependent logic tested against `DateTime.Now` instead of an injected clock
- Race conditions in async tests (missing `await`, fire-and-forget without waiting)
- Testcontainers startup time variance (test runs before the DB is ready)
- Test data pollution (tests sharing a database and assuming clean state)
- Playwright tests that depend on animation timing

---

## Worked Example: Unit Test for RulCalculator

```csharp
// UnitTests/Calculations/RulCalculatorTests.cs

public class RulCalculatorTests
{
    private readonly RulCalculator _sut = new();

    [Fact]
    public void Calculate_WithNewAsset_ReturnsFullUsefulLife()
    {
        // Arrange
        var request = new RulCalculationRequest
        {
            InstallationDate = new DateOnly(2020, 1, 1),
            DesignLife = 20,           // years
            CurrentConditionRating = 10, // perfect condition
            EvaluationDate = new DateOnly(2020, 6, 1)  // 5 months in
        };

        // Act
        var result = _sut.Calculate(request);

        // Assert
        result.RemainingUsefulLifeYears.Should().BeCloseTo(19.6m, precision: 0.1m);
        result.PercentageLifeConsumed.Should().BeCloseTo(2m, precision: 0.5m);
    }

    [Fact]
    public void Calculate_WithEndOfLifeConditionRating_ReturnsZeroRUL()
    {
        // Arrange
        var request = new RulCalculationRequest
        {
            InstallationDate = new DateOnly(2010, 1, 1),
            DesignLife = 20,
            CurrentConditionRating = 1,  // worst condition
            EvaluationDate = new DateOnly(2025, 1, 1)
        };

        // Act
        var result = _sut.Calculate(request);

        // Assert
        result.RemainingUsefulLifeYears.Should().Be(0);
        result.PercentageLifeConsumed.Should().Be(100);
    }

    [Fact]
    public void Calculate_WhenChronologicalAgePastDesignLife_ClampsRULToZero()
    {
        // Arrange: asset is 25 years old with 20-year design life
        var request = new RulCalculationRequest
        {
            InstallationDate = new DateOnly(2000, 1, 1),
            DesignLife = 20,
            CurrentConditionRating = 4,
            EvaluationDate = new DateOnly(2025, 1, 1)
        };

        // Act
        var result = _sut.Calculate(request);

        // Assert: never negative
        result.RemainingUsefulLifeYears.Should().Be(0);
        result.IsOverdue.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(11)]
    public void Calculate_WithInvalidConditionRating_ThrowsArgumentOutOfRangeException(decimal rating)
    {
        // Arrange
        var request = new RulCalculationRequest
        {
            InstallationDate = DateOnly.FromDateTime(DateTime.Today.AddYears(-5)),
            DesignLife = 20,
            CurrentConditionRating = rating,
            EvaluationDate = DateOnly.FromDateTime(DateTime.Today)
        };

        // Act + Assert
        _sut.Invoking(c => c.Calculate(request))
            .Should().Throw<ArgumentOutOfRangeException>()
            .WithMessage("*condition rating*");
    }
}
```

---

## Worked Example: Integration Test for POST /api/v1/inspections

```csharp
// IntegrationTests/Inspections/CreateInspectionTests.cs

public class CreateInspectionTests : IAsyncLifetime
{
    private PostgreSqlContainer _db = null!;
    private HttpClient _clientTenantA = null!;
    private HttpClient _clientTenantB = null!;

    public async Task InitializeAsync()
    {
        _db = new PostgreSqlBuilder().WithImage("postgis/postgis:16-3.4").Build();
        await _db.StartAsync();
        // factory wiring omitted for brevity — see IntegrationTests/Infrastructure/WebAppFactory.cs
        _clientTenantA = BuildClient(tenantId: TenantIds.TenantA);
        _clientTenantB = BuildClient(tenantId: TenantIds.TenantB);
    }

    [Fact]
    public async Task POST_ValidInspection_Returns201WithCreatedInspection()
    {
        // Arrange: seed an asset for tenant A
        var assetId = await SeedAssetAsync(_clientTenantA);
        var request = new CreateInspectionDto
        {
            AssetId = assetId,
            InspectionDate = DateOnly.FromDateTime(DateTime.Today),
            OverallConditionRating = 7,
            Notes = "Annual inspection - good condition"
        };

        // Act
        var response = await _clientTenantA.PostAsJsonAsync("/api/v1/inspections", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<InspectionDto>();
        created.Should().NotBeNull();
        created!.AssetId.Should().Be(assetId);
        created.OverallConditionRating.Should().Be(7);
        response.Headers.Location.Should().NotBeNull();
    }

    [Fact]
    public async Task POST_InvalidConditionRating_Returns422()
    {
        var assetId = await SeedAssetAsync(_clientTenantA);
        var request = new CreateInspectionDto
        {
            AssetId = assetId,
            InspectionDate = DateOnly.FromDateTime(DateTime.Today),
            OverallConditionRating = 15  // invalid: max is 10
        };

        var response = await _clientTenantA.PostAsJsonAsync("/api/v1/inspections", request);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        problem!.Errors.Should().ContainKey("OverallConditionRating");
    }

    [Fact]
    public async Task POST_TenantA_InspectionNotVisibleToTenantB()
    {
        // Arrange: create inspection as tenant A
        var assetId = await SeedAssetAsync(_clientTenantA);
        var createResponse = await _clientTenantA.PostAsJsonAsync("/api/v1/inspections",
            new CreateInspectionDto { AssetId = assetId, InspectionDate = DateOnly.FromDateTime(DateTime.Today), OverallConditionRating = 8 });
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<InspectionDto>();

        // Act: try to read it as tenant B
        var getResponse = await _clientTenantB.GetAsync($"/api/v1/inspections/{created!.Id}");

        // Assert: tenant isolation — tenant B cannot see tenant A's record
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); }
}
```

These examples illustrate the key testing patterns: builder-created test data, specific assertions on response bodies, and an explicit tenant isolation test. Every integration test class for a POST endpoint should include these three test types as a minimum.
