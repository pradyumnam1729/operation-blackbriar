# Autonomous Test Generation

Testing is one of the highest-value applications of AI agents in software development. Tests are structured, follow predictable patterns, and require thorough coverage of code paths that humans consistently undercover. An AI agent given the method under test, the framework, and a reference pattern can generate test suites that cover more code paths more quickly than manual test writing, and often achieve better coverage because the agent is systematic rather than intuitive.

This document covers the test generation workflow for Aurigo's codebase: calculation engine tests (the highest-priority target), command handler tests, query handler tests, API integration tests, and frontend component and E2E tests.

---

## Test Generation Philosophy

Aurigo's testing philosophy, as defined in Volume 3, requires:
- ≥90% line coverage on `Application/Calculations/` and `Domain/`
- Integration tests for every API endpoint
- Unit tests for all validators and calculation logic
- E2E tests for critical user workflows (inspection submission, capital plan generation)

AI agents are a tool for achieving this standard efficiently. But the standard applies equally to human-written and AI-generated tests. AI tests that do not meaningfully cover code paths are not acceptable just because they were fast to produce.

The test generation workflow always ends with a human running the tests locally and verifying that they pass, that they would catch the bugs they are meant to catch, and that they cover the acceptance criteria from the story.

---

## Calculation Engine Tests (Highest Priority)

Calculation engines in `Application/Calculations/` are pure C# functions: no database access, no I/O, no external dependencies. They are the ideal test generation target because:
1. All inputs and outputs are simple value types (double, int, DateTimeOffset)
2. The domain rules are well-defined (RUL cannot be negative; condition score is 0-5)
3. Boundary conditions are clearly identifiable
4. An AI agent can reason about the math and verify the expected outputs independently

**Test generation prompt for calculation engines:**

```
You are the Test Generation Agent for Aurigo Software Technologies.

## Method Under Test
File: Application/Calculations/RulCalculator.cs
Read this file first.

## Framework
xUnit + FluentAssertions. No mocking needed — this is a pure function.
Test file path: tests/Aurigo.AssetMaintenance.UnitTests/Calculations/RulCalculatorTests.cs
Reference structure: tests/Aurigo.AssetMaintenance.UnitTests/Calculations/[existing test file]

## Code Paths to Cover

Happy Path:
1. Standard asset in service: conditionScore=4.0, deteriorationRate=0.15/year, 
   totalUsefulLife=50, installedAge=20 — expected RUL calculated to X years

Boundary Conditions:
2. Asset at condition zero (total deterioration): RUL must be 0, not negative
3. New asset (age=0): RUL should equal totalUsefulLife
4. Asset at exact end of useful life: RUL should be 0

Invalid Inputs:
5. conditionScore < 0 → ArgumentOutOfRangeException
6. conditionScore > 5 → ArgumentOutOfRangeException
7. deteriorationRate <= 0 → ArgumentOutOfRangeException
8. totalUsefulLife <= 0 → ArgumentOutOfRangeException
9. installedAge < 0 → ArgumentOutOfRangeException

Large Value Scenarios:
10. Very long-lived asset: totalUsefulLife=100, installedAge=1, conditionScore=5
11. Very rapid deterioration: deteriorationRate=1.0/year

## Test Structure Requirements
- Each test method is named: [Method]_[Scenario]_[Expected] 
  Example: CalculateRemainingUsefulLife_AtConditionZero_ReturnsZero
- Use [Theory] + [InlineData] for parameterized happy path tests
- Use [Fact] for exception tests
- Use FluentAssertions for all assertions (result.Should().Be(expected))
- No magic numbers — define constants for test inputs at the top of the test class

## Deliverable
The complete RulCalculatorTests.cs file.
Target: 100% line coverage on RulCalculator.cs.
```

---

## Command Handler Tests

Command handlers interact with the database and domain events. They require more complex test setup but follow a predictable pattern across all handlers.

**Test structure for command handlers:**

Command handler tests are unit tests that use mocked dependencies (DbContext via InMemory provider, or a test double for IPublisher). The test structure:

```csharp
public class CreateInspectionRecordCommandHandlerTests
{
    private readonly AssetMaintenanceDbContext _context;
    private readonly Mock<IPublisher> _publisher;
    private readonly CreateInspectionRecordCommandHandler _handler;

    public CreateInspectionRecordCommandHandlerTests()
    {
        // Arrange common test infrastructure
        var options = new DbContextOptionsBuilder<AssetMaintenanceDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new AssetMaintenanceDbContext(options);
        _publisher = new Mock<IPublisher>();
        _handler = new CreateInspectionRecordCommandHandler(_context, _publisher.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_PersistsInspectionRecord()
    {
        // Arrange
        var asset = AssetBuilder.New().Build();
        _context.Assets.Add(asset);
        await _context.SaveChangesAsync();

        var command = new CreateInspectionRecordCommand 
        { 
            AssetId = asset.Id,
            InspectorId = Guid.NewGuid(),
            ConditionScore = 4,
            // ... 
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeEmpty();
        _context.InspectionRecords.Should().ContainSingle(i => i.Id == result);
    }
}
```

**Test cases for command handlers:**

1. Happy path: valid command → entity persisted → correct ID returned
2. Domain event: valid command → `InspectionCompleted` event published
3. Not found: non-existent AssetId → NotFoundException thrown
4. Validator: null required field → validation failure (test via MediatR pipeline behavior)
5. Concurrency: two simultaneous commands with the same data → both succeed (or one fails predictably)

**Test generation prompt for command handlers:**

```
You are the Test Generation Agent for Aurigo Software Technologies.

## Handler Under Test
File: Application/Inspections/Commands/CreateInspectionRecordCommandHandler.cs
Read this file.
Also read: Domain/Entities/Inspections/InspectionRecord.cs
Also read: tests/Aurigo.AssetMaintenance.UnitTests/Assets/CreateAssetCommandHandlerTests.cs
  (use as pattern reference)

## Framework
xUnit + FluentAssertions + Moq. Use InMemory DbContext (not Testcontainers for unit tests).
Test file: tests/Aurigo.AssetMaintenance.UnitTests/Inspections/CreateInspectionRecordCommandHandlerTests.cs

## Test Builders Available
Read: tests/Aurigo.AssetMaintenance.UnitTests/Builders/AssetBuilder.cs
Create a similar InspectionRecordBuilder if one does not exist.

## Required Test Cases
[list specific scenarios from the story acceptance criteria]

## Deliverable
Complete test file. All tests must pass with the current implementation.
```

---

## API Integration Tests

Integration tests verify the full HTTP request-response cycle against a real database. In Aurigo's test suite, integration tests use Testcontainers to spin up a real PostgreSQL instance.

**Integration test structure:**

```csharp
public class InspectionsControllerTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebApplicationFactory _factory;

    public InspectionsControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAuthenticatedClient(TenantId, UserId, role: "Inspector");
    }

    [Fact]
    public async Task CreateInspection_ValidRequest_Returns201WithId()
    {
        // Arrange
        var asset = await _factory.SeedAssetAsync(TenantId);
        var request = new CreateInspectionRecordRequest { AssetId = asset.Id, ... };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/inspections", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var result = await response.Content.ReadFromJsonAsync<Guid>();
        result.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateInspection_UnauthorizedRole_Returns403()
    {
        var clientAsReadOnly = _factory.CreateAuthenticatedClient(TenantId, UserId, role: "ReadOnly");
        var response = await clientAsReadOnly.PostAsJsonAsync("/api/v1/inspections", new {});
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
```

**Integration test generation prompt:**

```
You are the Test Generation Agent for Aurigo Software Technologies.

## Endpoint Under Test
Controller: Api/Controllers/InspectionsController.cs
Read this file.
Handler: Application/Inspections/Commands/CreateInspectionRecordCommandHandler.cs
Read this file.

## Integration Test Infrastructure
Read: tests/Aurigo.AssetMaintenance.IntegrationTests/TestWebApplicationFactory.cs
Read: tests/Aurigo.AssetMaintenance.IntegrationTests/Assets/AssetsControllerTests.cs
  (use as pattern reference)

The integration tests use Testcontainers — a real PostgreSQL container is started 
for each test class. Do NOT use InMemory database for integration tests.

## Test Cases Required (from acceptance criteria)
1. POST /api/v1/inspections with valid body → 201 with inspection ID
2. POST /api/v1/inspections with invalid AssetId → 404
3. POST /api/v1/inspections with conditionScore = 6 → 422 validation error
4. POST /api/v1/inspections unauthenticated → 401
5. POST /api/v1/inspections with ReadOnly role → 403
6. POST /api/v1/inspections from different tenant cannot see assets of original tenant → 404

## Deliverable
Complete integration test file at:
tests/Aurigo.AssetMaintenance.IntegrationTests/Inspections/InspectionsControllerTests.cs
```

---

## Frontend Component Tests

Frontend tests use Vitest + React Testing Library. They test that components render correctly, respond to user interactions, and call the right API hooks.

**Frontend test generation prompt:**

```
You are the Test Generation Agent for Aurigo Software Technologies, working on the 
React 18 + TypeScript frontend.

## Component Under Test
File: frontend/src/features/inspections/components/InspectionForm.tsx
Read this file.
Also read: frontend/src/features/assets/components/AssetForm.tsx (pattern reference)

## Framework
Vitest + React Testing Library. 
Test file: frontend/src/features/inspections/components/InspectionForm.test.tsx

## Test Cases Required
1. Renders all required fields
2. Shows validation errors when required fields are empty and form is submitted
3. Calls the create mutation when all required fields are filled and submitted
4. Disables the submit button while the mutation is pending
5. Shows success toast when mutation succeeds
6. Shows error toast when mutation fails

## Mock Strategy
Mock the TanStack Query hooks at the hook level using vi.mock().
Do NOT make real HTTP calls in component tests.

## Deliverable
Complete test file with all cases passing.
```

---

## Test Quality Verification Checklist

Before accepting any AI-generated test suite:

**Execution:** Run all tests locally. All tests must pass. Tests that do not run are worse than no tests.

**Coverage:** Open the coverage report (run `dotnet test --collect:"XPlat Code Coverage"` or `npm run test -- --coverage`). Verify the target coverage is achieved.

**Edge case completeness:** Re-read the acceptance criteria. Is every acceptance criterion covered by at least one test? Edge cases and error states are the most commonly missed.

**Pattern compliance:**
- [ ] Tests use test builders (AssetBuilder, not raw `new Asset(...)`)
- [ ] Tests use FluentAssertions for all assertions (not xUnit's Assert.Equal)
- [ ] Test method names follow the [Method]_[Scenario]_[Expected] convention
- [ ] Tests do not share mutable state between test methods
- [ ] Integration tests do not use InMemory database — they use Testcontainers

**Mutation test:** Mentally introduce a small bug in the implementation (flip a condition, remove a guard). Does a test fail? If no test would catch the introduced bug, the test suite is not testing what it claims to test.

**No false confidence:** Tests that always pass regardless of the implementation are worse than no tests. Common false confidence traps: assertions that only verify the response is not null (rather than verifying specific fields), mocks that return predefined responses without verifying the right call was made, tests that skip the authorization scenario.
