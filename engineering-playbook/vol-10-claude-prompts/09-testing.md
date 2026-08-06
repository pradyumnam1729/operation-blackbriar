# 09 — Test Generation Prompts

Four complete prompts for generating tests at each layer of the Aurigo stack.

---

## Prompt 1: Unit Tests for Calculation Engine

Use when adding tests for a class in `Application/Calculations/`. Replace `[CALCULATION_CLASS_PATH]` and `[CALCULATION_CLASS_NAME]`. Paste the full prompt:

---

You are generating comprehensive xUnit unit tests for a calculation engine in the Aurigo Maintain backend. Calculation engines are pure C# classes in `Application/Calculations/`. They have no dependencies, no I/O, and no database access. They must have >= 90% line coverage.

**Read the calculation class:**
`[CALCULATION_CLASS_PATH]`

Also read the vault documentation for this calculation:
`vault/calculations/[RELEVANT_FILE].md`

If a test file already exists for this class, read it first:
`backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.UnitTests/Calculations/[CALCULATION_CLASS_NAME]Tests.cs`

**Generate comprehensive xUnit tests following these rules:**

**Structure:**
- One test class per calculation class: `[CalculationClassName]Tests`
- Follow Arrange-Act-Assert pattern strictly — label each section with a comment
- Use `[Theory]` + `[InlineData]` for data-driven tests
- Use `[Fact]` for single-scenario tests
- Test method names: `[MethodName]_[Scenario]_[ExpectedBehavior]`

**Coverage requirements — test every code path:**

1. **Happy path tests:** Call each public method with valid, typical inputs.

2. **Boundary condition tests — mandatory for every numeric input:**
   - Minimum valid value (conditionScore = 0, age = 0, rate = 0.0)
   - Maximum valid value (conditionScore = 5, age = usefulLife, rate = 1.0)
   - Value at exactly the decision boundary
   - One value in the middle of the valid range

3. **Null and default value tests:**
   - If any parameter is nullable, test passing null
   - Test the zero value for every numeric parameter
   - If the calculation uses DateTime, test DateTime.MinValue and DateTime.MaxValue

4. **Arithmetic precision tests:**
   - For calculations involving division, test that the result is not NaN or Infinity (divisor = 0 case)
   - For calculations returning percentages, assert the result is within [0, 1] or [0, 100] range
   - For financial calculations, assert rounding is applied correctly (round to 2 decimal places)
   - Use `result.Should().BeApproximately(expected, precision: 0.001)` — never use `==` for floating-point

5. **Performance test:**
   ```csharp
   [Fact]
   public void Calculate_WithTypicalInputs_CompletesUnder10msFor1000Iterations()
   {
       var calc = new [CalculationClassName]();
       var stopwatch = Stopwatch.StartNew();
       for (int i = 0; i < 1000; i++)
       {
           calc.Calculate([typical inputs]);
       }
       stopwatch.Stop();
       stopwatch.ElapsedMilliseconds.Should().BeLessThan(10);
   }
   ```

6. **Exception tests (if the class throws for invalid input):**
   - Use `Action act = () => calc.Calculate([invalid input]);`
   - Assert with `act.Should().Throw<ArgumentOutOfRangeException>().WithMessage("*expected text*");`

**Use test builders if the calculation takes complex objects:**
```csharp
public class AssetBuilder
{
    private readonly Asset _asset = new();
    public AssetBuilder WithConditionScore(double score) { _asset.ConditionScore = score; return this; }
    public AssetBuilder WithAge(int years) { _asset.AgeInYears = years; return this; }
    public Asset Build() => _asset;
}
```

**File location:** `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.UnitTests/Calculations/[CalculationClassName]Tests.cs`

**After writing all tests, provide:**
- Total number of test methods generated
- Code path coverage estimate
- List of any edge cases you identified that are NOT handled by the calculation class itself (potential bugs)

---

## Prompt 2: Integration Tests for API Endpoint

Replace `[CONTROLLER_NAME]`, `[ACTION_NAME]`, `[HTTP_METHOD]`, `[ROUTE]`. Paste the full prompt:

---

You are generating Testcontainers-based integration tests for an API endpoint in the Aurigo Maintain backend.

**Read the following files before writing any tests:**
1. The controller action: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Api/Controllers/[CONTROLLER_NAME].cs`
2. The handler: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/[MODULE]/[Commands|Queries]/[HandlerName].cs`
3. The validator: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/[MODULE]/[Commands|Queries]/[ValidatorName].cs`
4. An existing integration test for reference: `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.IntegrationTests/[ANY_EXISTING_TEST].cs`
5. The relevant entity: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Entities/[ENTITY_NAME].cs`

**Generate integration tests following these rules:**

**Test Class Setup:**
```csharp
public class [FeatureName]IntegrationTests : IClassFixture<IntegrationTestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly IntegrationTestWebAppFactory _factory;

    public [FeatureName]IntegrationTests(IntegrationTestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }
}
```

**Authentication Setup:**
```csharp
_client.AddTestJwt(tenantId: TestConstants.TenantId, role: "[RequiredRole]", userId: TestConstants.UserId);
```

**Data Seeding:**
```csharp
private async Task<[EntityName]> Seed[EntityName]Async([EntityName]Builder? builder = null)
{
    using var scope = _factory.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AssetMaintenanceDbContext>();
    var entity = (builder ?? new [EntityName]Builder()).Build();
    db.[EntityName]s.Add(entity);
    await db.SaveChangesAsync();
    return entity;
}
```

**Required Test Scenarios:**

1. **Happy path:** Seed required data, make request with valid inputs, assert HTTP 200 (or 201/204), assert response body fields are correct.

2. **Not found:** Make request for a resource ID that does not exist, assert HTTP 404.

3. **Validation failure:** Make request with invalid inputs, assert HTTP 400, assert the error message references the invalid field.

4. **Unauthorized — no token:** Make request without JWT, assert HTTP 401.

5. **Forbidden — wrong role:** Make request with JWT of an insufficient role, assert HTTP 403.

6. **Tenant isolation (critical):** Seed data for tenant A, authenticate as tenant B, request the same resource, assert HTTP 404. This verifies the global EF query filter is working correctly.

7. **Database state (for write operations only):** After a successful POST/PUT/PATCH/DELETE, use the DbContext directly to query the database and assert the expected state change occurred.

8. **Concurrent modification (for update operations, if applicable):** Two requests to update the same resource — if optimistic concurrency is used, the second should return HTTP 409.

**Assertions:**
- HTTP status: `response.StatusCode.Should().Be(HttpStatusCode.[Expected]);`
- Do not use `.Result` or `.Wait()` anywhere in tests — async all the way

**File location:** `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.IntegrationTests/[MODULE]/[Feature]IntegrationTests.cs`

---

## Prompt 3: React Component Tests

Replace `[COMPONENT_PATH]` and `[COMPONENT_NAME]`. Paste the full prompt:

---

You are generating React Testing Library tests for a component in the Aurigo Maintain frontend.

**Read the following files before writing any tests:**
1. The component: `frontend/asset-maintenance-web/[COMPONENT_PATH]`
2. The query/mutation hooks used by the component
3. An existing component test for reference (search for any `*.test.tsx` file in `src/features/`)

**Test File Location:** `[COMPONENT_PATH].test.tsx` (same directory as the component)

**Test Setup:**
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { [ComponentName] } from './[ComponentName]'

vi.mock('@/features/[module]/hooks/use[Feature]', () => ({
  use[Feature]: vi.fn(),
}))

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}
```

**Required Test Scenarios:**

1. **Renders correctly with data:** Mock the hook to return data, assert key UI elements are present.

2. **Loading state:** Mock `isLoading: true`, assert loading indicator is visible, content is not displayed.

3. **Error state:** Mock `isError: true`, assert an error message is visible.

4. **Empty state:** Mock `data: []`, assert the empty state UI is visible.

5. **User interaction — click:**
```typescript
it('opens dialog when Add button is clicked', async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /add/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
```

6. **User interaction — form fill and submit:**
```typescript
it('submits form with correct values', async () => {
  const user = userEvent.setup()
  const mockMutate = vi.fn()
  vi.mocked(use[Action][Feature]).mockReturnValue({ mutate: mockMutate, isPending: false })
  renderWithProviders(<[ComponentName] />)
  await user.type(screen.getByLabelText(/field label/i), 'input value')
  await user.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ field: 'input value' })))
})
```

7. **Form validation:** Test that submitting with invalid input shows validation error messages.

8. **Keyboard navigation:** Test that the component is keyboard-navigable.

9. **Accessibility — ARIA roles:** Assert that elements with important ARIA roles are present.

**File location:** Same directory as the component, with `.test.tsx` extension.

---

## Prompt 4: End-to-End Playwright Tests

Replace `[JOURNEY_NAME]`, `[START_ROUTE]`, and `[JOURNEY_DESCRIPTION]`. Paste the full prompt:

---

You are generating a Playwright E2E test for a user journey in the Aurigo Maintain frontend.

**Journey:** `[JOURNEY_DESCRIPTION]`

**Read these files before writing the test:**
1. The relevant route files: `frontend/asset-maintenance-web/src/routes/[ROUTE_PATH].tsx`
2. An existing Playwright test for reference: `frontend/asset-maintenance-web/tests/`
3. `frontend/asset-maintenance-web/playwright.config.ts`

**File location:** `frontend/asset-maintenance-web/tests/[feature-name].spec.ts`

**Structure:**
```typescript
import { test, expect } from '@playwright/test'
import { seedTestData, cleanupTestData } from './helpers/data-helpers'

test.describe('[Feature Name] — [Persona] journey', () => {
  let seededData: { [entityName]: { id: string } }

  test.beforeEach(async ({ request }) => {
    seededData = await seedTestData(request, {
      tenantId: process.env.TEST_TENANT_ID!,
    })
  })

  test.afterEach(async ({ request }) => {
    await cleanupTestData(request, seededData)
  })

  test('[JOURNEY_NAME]', async ({ page }) => {
    // 1. Start from login
    await page.goto('/login')
    await page.fill('[data-testid="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('[data-testid="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('[data-testid="login-submit"]')
    await expect(page).toHaveURL('/dashboard')

    // 2. Navigate to the feature
    await page.goto('[START_ROUTE]')
    await expect(page).toHaveURL('[START_ROUTE]')

    // 3. Complete each step of the user journey
    // Final assertion: verify the journey outcome
    await expect(page.getByRole('[role]', { name: '[expected element]' })).toBeVisible()
  })

  test('handles error gracefully when [error condition]', async ({ page }) => {
    // Test error state in the journey
  })
})
```

**Required test scenarios:**

1. **Happy path:** Complete the full user journey from login to outcome.

2. **Navigation verification:** Assert that navigating to each step lands on the correct URL.

3. **Data persistence:** After a write operation, reload the page and assert the data is still visible.

4. **Error handling:** Simulate an error condition and assert the error state is displayed gracefully.

5. **Screenshot on failure:**
```typescript
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await page.screenshot({ path: `test-results/failure-${testInfo.title}.png`, fullPage: true })
  }
})
```

**Selectors priority (in order of preference):**
1. `getByRole('button', { name: /label/i })` — best for accessibility and resilience
2. `getByLabel(/label/i)` — for form fields
3. `getByText('exact text')` — for content assertions
4. `[data-testid="..."]` — only when semantic selectors do not work
5. CSS class selectors — never use

**Waiting strategy:**
- Never use `page.waitForTimeout()` — use `await expect(element).toBeVisible()` or `await page.waitForURL()`
- After mutations, wait for the UI to reflect the change

---
