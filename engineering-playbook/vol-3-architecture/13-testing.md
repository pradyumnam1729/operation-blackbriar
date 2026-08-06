# Testing Standards

> Volume 3 · Architecture · Document 13  
> Testing pyramid, unit/integration/E2E strategy, test data management, and worked examples

---

## The Testing Pyramid

```
           /\
          /  \
         / E2E \         Few, slow, high confidence in user journeys
        /--------\
       / Integration \   Moderate count, Testcontainers, full stack
      /--------------\
     /  Unit Tests    \  Many, fast, pure logic — the foundation
    /------------------\
```

The pyramid shape reflects cost, speed, and where bugs are most economically caught:
- **Unit tests** are fast (milliseconds) and cheap to write. They catch logic errors in calculation engines and domain rules before the code leaves the developer's machine.
- **Integration tests** are slower (seconds) because they spin up real databases. They catch wiring errors, EF Core configuration mistakes, and multi-layer interaction bugs.
- **E2E tests** are slowest because they require a running application and browser. They provide confidence that the most important user journeys work end-to-end.

The ratio in Aurigo Maintain: roughly 80% unit tests, 15% integration tests, 5% E2E tests.

---

## Unit Tests (.NET)

### Scope

Unit tests cover:
- `Application/Calculations/` — all calculation engines (RUL, ARV, risk scoring, deterioration). Target: **≥ 90% line coverage**.
- `Domain/` — entity invariants, domain event raising, value object behavior. Target: **≥ 80% line coverage**.

Unit tests do **not** cover:
- Controllers (tested in integration)
- Handlers (tested in integration)
- EF Core (tested in integration)
- External clients (tested with mocks in integration)

### Framework

- **xUnit** — test runner
- **FluentAssertions** — assertion library (produces readable failure messages)
- **NSubstitute** — mocking library (for domain service interfaces in the rare cases where unit tests need them)

### Test Structure: Arrange-Act-Assert

Every test method follows the Arrange-Act-Assert pattern, separated by blank lines:

```csharp
[Fact]
public void Calculate_WhenConditionIsGoodAndAssetIsMidLife_ReturnsPositiveRemainingYears()
{
    // Arrange
    var calculator = new RulCalculator();
    var assetClass = AssetClassBuilder.Create()
        .WithWeibullShape(2.5m)
        .WithDesignLife(50)
        .Build();
    var installDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-15));

    // Act
    var result = calculator.Calculate(
        conditionIndex: 3.5m,
        installDate: installDate,
        assetClass: assetClass);

    // Assert
    result.RemainingYears.Should().BeGreaterThan(0);
    result.RemainingYears.Should().BeLessThan(50);
    result.IsReliable.Should().BeTrue();
}
```

### Test Naming

`MethodName_Scenario_ExpectedResult` — all three parts are required:

```
Calculate_WhenConditionIsZero_ReturnsZeroYears
Calculate_WhenConditionExceedsMax_ThrowsArgumentException
RecordInspection_WhenAssetIsDecommissioned_ThrowsDomainException
Score_WhenRiskIsHighAndConditionIsCritical_ReturnsCriticalRisk
```

### Parameterized Tests for Boundary Conditions

```csharp
[Theory]
[InlineData(0.0, 0)]      // completely failed asset
[InlineData(0.5, 2)]      // near-failed — very few remaining years
[InlineData(3.0, 15)]     // fair condition — moderate remaining life
[InlineData(4.5, 32)]     // good condition — most of design life remaining
[InlineData(5.0, 35)]     // new-equivalent condition — maximum remaining life
public void Calculate_ConditionIndexBoundaries_ReturnsExpectedRange(
    double conditionIndex,
    int expectedMinYears)
{
    // Arrange
    var calculator = new RulCalculator();
    var assetClass = AssetClassBuilder.Create().WithDesignLife(35).WithWeibullShape(2.5m).Build();
    var installDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-5));

    // Act
    var result = calculator.Calculate((decimal)conditionIndex, installDate, assetClass);

    // Assert
    result.RemainingYears.Should().BeGreaterThanOrEqualTo(expectedMinYears);
}
```

### Test Builders

Test builders (builder pattern) create valid domain objects with defaults, allowing tests to override only the properties relevant to the scenario:

```csharp
// tests/UnitTests/TestBuilders/AssetClassBuilder.cs
public class AssetClassBuilder
{
    private string _code = "TEST-ASSET";
    private string _name = "Test Asset Class";
    private decimal _weibullShape = 2.5m;
    private decimal _weibullScale = 1.0m;
    private int _designLife = 50;
    private decimal _defaultDeteriorationRate = 0.1m;

    public static AssetClassBuilder Create() => new();

    public AssetClassBuilder WithCode(string code) { _code = code; return this; }
    public AssetClassBuilder WithName(string name) { _name = name; return this; }
    public AssetClassBuilder WithWeibullShape(decimal shape) { _weibullShape = shape; return this; }
    public AssetClassBuilder WithDesignLife(int years) { _designLife = years; return this; }
    public AssetClassBuilder WithDefaultDeteriorationRate(decimal rate) { _defaultDeteriorationRate = rate; return this; }

    public AssetClass Build() => new(
        AssetClassId.New(),
        _code,
        _name,
        _weibullShape,
        _weibullScale,
        _designLife,
        _defaultDeteriorationRate);
}
```

---

## Full Unit Test Example: RulCalculator

```csharp
// tests/UnitTests/Calculations/RulCalculatorTests.cs
public class RulCalculatorTests
{
    private readonly RulCalculator _sut = new();

    [Fact]
    public void Calculate_WhenConditionIndexIsZero_ReturnsZeroRemainingYears()
    {
        // Arrange
        var assetClass = AssetClassBuilder.Create().WithDesignLife(50).Build();
        var installDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-10));

        // Act
        var result = _sut.Calculate(conditionIndex: 0m, installDate, assetClass);

        // Assert
        result.RemainingYears.Should().Be(0);
        result.ReplacementYear.Should().Be(DateTime.UtcNow.Year);
    }

    [Fact]
    public void Calculate_WhenAssetIsNew_ReturnsFullDesignLife()
    {
        // Arrange
        var designLife = 50;
        var assetClass = AssetClassBuilder.Create().WithDesignLife(designLife).Build();
        var installDate = DateOnly.FromDateTime(DateTime.UtcNow);

        // Act
        var result = _sut.Calculate(conditionIndex: 5m, installDate, assetClass);

        // Assert
        result.RemainingYears.Should().BeCloseTo(designLife, precision: 2);
    }

    [Fact]
    public void Calculate_WhenConditionIndexExceedsMaximum_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        var assetClass = AssetClassBuilder.Create().Build();
        var installDate = DateOnly.FromDateTime(DateTime.UtcNow);

        // Act
        var act = () => _sut.Calculate(conditionIndex: 6m, installDate, assetClass);

        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("conditionIndex");
    }

    [Fact]
    public void Calculate_WhenInstallDateIsInTheFuture_ThrowsArgumentException()
    {
        // Arrange
        var assetClass = AssetClassBuilder.Create().Build();
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));

        // Act
        var act = () => _sut.Calculate(conditionIndex: 3m, futureDate, assetClass);

        // Assert
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData(5.0, 2.5, 50, 0,  true)]   // new asset, short age — reliable
    [InlineData(1.0, 2.5, 50, 45, false)]  // nearly failed, well past design life — unreliable
    public void Calculate_IsReliableFlag_ReflectsDataQuality(
        double conditionIndex,
        double weibullShape,
        int designLife,
        int ageYears,
        bool expectedIsReliable)
    {
        // Arrange
        var assetClass = AssetClassBuilder.Create()
            .WithWeibullShape((decimal)weibullShape)
            .WithDesignLife(designLife)
            .Build();
        var installDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-ageYears));

        // Act
        var result = _sut.Calculate((decimal)conditionIndex, installDate, assetClass);

        // Assert
        result.IsReliable.Should().Be(expectedIsReliable);
    }
}
```

---

## Integration Tests (.NET)

### Scope

Integration tests cover the full HTTP stack: HTTP request → controller → MediatR pipeline → handler → EF Core → real PostgreSQL → response. They test:
- Correct HTTP status codes and response bodies
- Database state after mutations
- Multi-tenancy enforcement (Tenant A cannot read Tenant B's data)
- EF Core query correctness (no N+1, global filters applied)
- Validation rejection of invalid inputs

### Framework

- **Testcontainers for .NET** — spins up a real PostgreSQL container for each test class
- **WebApplicationFactory\<Program\>** — in-process ASP.NET Core test server
- **HttpClient** — actual HTTP requests to the in-process server
- **NSubstitute** — for external integration stubs (CMMS, notifications — these are already stubbed in Infrastructure; the test can override the stub if needed)

```csharp
// tests/IntegrationTests/Fixtures/ApplicationFactory.cs
public class AssetMaintenanceApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgis/postgis:16-3.4")
        .Build();

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
    }

    public new async Task DisposeAsync()
    {
        await _dbContainer.StopAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = _dbContainer.GetConnectionString(),
            });
        });

        builder.ConfigureServices(services =>
        {
            // Apply migrations on startup
            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AssetMaintenanceDbContext>();
            db.Database.Migrate();
        });
    }
}
```

### Full Integration Test Example: Asset Creation

```csharp
// tests/IntegrationTests/Api/Assets/CreateAssetTests.cs
public class CreateAssetTests : IClassFixture<AssetMaintenanceApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _adminUserId = Guid.NewGuid();

    public CreateAssetTests(AssetMaintenanceApplicationFactory factory)
    {
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", JwtTestHelper.CreateToken(
                userId: _adminUserId,
                tenantId: _tenantId,
                role: "AssetManager"));
    }

    [Fact]
    public async Task CreateAsset_WithValidData_Returns201WithLocation()
    {
        // Arrange
        var command = new
        {
            name = "Bridge 001 - Main Street",
            assetClassCode = "BRDG",
            conditionIndex = 4.2,
            installDate = "2000-06-15",
            location = new { longitude = -122.4194, latitude = 37.7749 }
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/assets", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();
        response.Headers.Location!.ToString().Should().StartWith("/api/v1/assets/");

        var body = await response.Content.ReadFromJsonAsync<AssetDto>();
        body.Should().NotBeNull();
        body!.Name.Should().Be("Bridge 001 - Main Street");
        body.ConditionIndex.Should().Be(4.2m);
    }

    [Fact]
    public async Task CreateAsset_WithMissingName_Returns400WithValidationError()
    {
        // Arrange
        var command = new
        {
            assetClassCode = "BRDG",
            conditionIndex = 4.2,
            installDate = "2000-06-15"
            // name is missing
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/assets", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        problem!.Errors.Should().ContainKey("name");
    }

    [Fact]
    public async Task CreateAsset_FromDifferentTenant_CannotSeeNewAsset()
    {
        // Arrange — create asset as Tenant A
        var tenantACommand = new { name = "Tenant A Asset", assetClassCode = "BRDG",
            conditionIndex = 4.0, installDate = "2010-01-01" };
        var createResponse = await _client.PostAsJsonAsync("/api/v1/assets", tenantACommand);
        createResponse.EnsureSuccessStatusCode();
        var createdAsset = await createResponse.Content.ReadFromJsonAsync<AssetDto>();

        // Act — try to read it as Tenant B
        var tenantBClient = /* factory.CreateClient with Tenant B JWT */;
        var getResponse = await tenantBClient.GetAsync($"/api/v1/assets/{createdAsset!.Id}");

        // Assert — should be 404 (tenant isolation — not a 403)
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
```

---

## Frontend Tests

### Component Unit Tests (Vitest + React Testing Library)

Test observable behavior, not implementation:

```typescript
// features/assets/AssetCard.test.tsx
describe('AssetCard', () => {
  it('renders asset name and condition rating', () => {
    const asset = buildAsset({ name: 'Bridge 001', conditionIndex: 3.2 });
    render(<AssetCard asset={asset} onSelect={vi.fn()} />);

    expect(screen.getByText('Bridge 001')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();  // 3.2 → 'Fair'
  });

  it('calls onSelect with asset ID when clicked', async () => {
    const onSelect = vi.fn();
    const asset = buildAsset({ id: 'test-id' });
    render(<AssetCard asset={asset} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith('test-id');
  });

  it('shows selected state when isSelected is true', () => {
    const asset = buildAsset();
    render(<AssetCard asset={asset} onSelect={vi.fn()} isSelected />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
```

### E2E Tests (Playwright)

E2E tests exercise complete user journeys against the running application:

```typescript
// tests/e2e/create-inspection.spec.ts
test('inspector can record an inspection for an existing asset', async ({ page, baseURL }) => {
  // Setup: login as Inspector
  await page.goto(`${baseURL}/auth/login`);
  await page.fill('[aria-label="Email"]', 'inspector@test-tenant.com');
  await page.fill('[aria-label="Password"]', process.env.TEST_INSPECTOR_PASSWORD!);
  await page.click('[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);

  // Navigate to an asset
  await page.goto(`${baseURL}/assets`);
  await page.click('[data-testid="asset-row"]:first-child');
  await expect(page).toHaveURL(/\/assets\/.+/);

  // Open inspection form
  await page.click('[aria-label="Record inspection"]');
  await expect(page.getByRole('dialog')).toBeVisible();

  // Fill in inspection details
  await page.fill('[aria-label="Inspector name"]', 'Jane Smith');
  await page.fill('[aria-label="Condition index"]', '3.2');
  await page.click('[aria-label="Inspection type"]');
  await page.click('[role="option"][data-value="Routine"]');
  await page.fill('[aria-label="Notes"]', 'Surface cracking on north face.');

  // Submit
  await page.click('[type="submit"]');

  // Verify success
  await expect(page.getByText('Inspection recorded successfully')).toBeVisible();
  await expect(page.getByText('Jane Smith')).toBeVisible();  // appears in inspection history
});
```

---

## Test Data Management

### Principle: No Shared State Between Tests

Each integration test class gets a fresh Testcontainers PostgreSQL instance. Tests do not share database state. The `IClassFixture<ApplicationFactory>` pattern starts the container once per class and shares it across tests in the class — this is a performance optimization. Different test classes have fully isolated databases.

### Test Builders for Frontend

```typescript
// tests/builders/assetBuilder.ts
interface AssetOverrides {
  id?: string;
  name?: string;
  conditionIndex?: number;
  status?: 'Active' | 'Inactive' | 'Decommissioned';
}

export function buildAsset(overrides: AssetOverrides = {}): AssetListItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'Test Asset',
    conditionIndex: overrides.conditionIndex ?? 3.5,
    conditionRating: conditionIndexToRating(overrides.conditionIndex ?? 3.5),
    status: overrides.status ?? 'Active',
    assetClassName: 'Bridge',
    installDate: '2010-01-01',
    tenantId: 'test-tenant-id',
  };
}
```

---

## Coverage Requirements

| Layer | Target | CI-Enforced? | Measurement |
|---|---|---|---|
| `Application/Calculations/` | ≥ 90% line coverage | **Yes** — build fails if below | dotnet test --collect:"XPlat Code Coverage" |
| `Domain/` | ≥ 80% line coverage | **No** — aspirational target; tracked but not yet a hard gate | Same |
| Integration test API surface | All public endpoints have at least one happy-path and one error-path test | Manual review in PR | Code review checklist |
| Frontend critical user journeys | E2E tests for: create asset, record inspection, view dashboard, generate report | Playwright report | Playwright CI job |

`Application/Calculations/` coverage is enforced in CI — a drop below 90% fails the build. `Domain/` 80% is the aspirational target but is not yet a hard CI gate; it is reviewed manually during PR code review. Add the `Domain/` gate to `ci.yml` when coverage is consistently above 80% across the full `Domain/` namespace.

---

_See also: [01 — Coding Standards](./01-coding-standards.md) for test naming conventions, [14 — CI/CD](./14-cicd.md) for how tests run in the pipeline._
