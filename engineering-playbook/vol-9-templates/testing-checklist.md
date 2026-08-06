# Testing Checklist

**Engineering Playbook · Aurigo Software Technologies**
Version 1.0 · July 2026

Use this checklist as part of your PR description. Copy the section(s) relevant to the type of change you are making. All required items must be checked before the PR is marked Ready for Review.

---

## How to Use

1. Identify which change types apply to your PR. A single PR may span multiple change types.
2. Copy the relevant sections into your PR description.
3. Check off each item as you complete it.
4. Leave unchecked items with a brief explanation of why they do not apply. Write `N/A — [reason]` next to the checkbox rather than leaving it blank.

---

## New API Endpoint

*Apply when you are adding a new HTTP endpoint to any controller.*

### Unit Tests — Handler / Query Handler

- [ ] Handler/command handler has a dedicated unit test class in `UnitTests/`
- [ ] Happy path: handler processes a valid request and returns the expected result
- [ ] Validation boundary: handler receives an already-validated input (validator is tested separately)
- [ ] Cross-tenant safety: handler rejects or ignores data outside the current tenant scope
- [ ] Domain event: if the handler publishes a domain event, the event is asserted in tests

**Tools:** xUnit, FluentAssertions, Moq (for interfaces); no EF or HTTP dependencies in unit tests.

**Done looks like:** All unit tests pass in CI. No `[Skip]` attributes on tests.

### Integration Tests — Endpoint

- [ ] Happy path: authenticated request with valid body returns expected HTTP status and response shape
- [ ] Edge case 1: required field missing from request body returns 422 with `errors.[fieldName]` populated
- [ ] Edge case 2: referenced resource (e.g., asset ID) does not exist in tenant returns 404
- [ ] Edge case 3: resource belongs to a different tenant returns 404 (not 403 — 403 would confirm the ID exists)
- [ ] Edge case 4: resource already exists / uniqueness constraint violated returns 409
- [ ] Authorization: unauthenticated request (no JWT) returns 401
- [ ] Authorization: authenticated with insufficient role returns 403
- [ ] Authorization: authenticated with correct role on wrong tenant's resource returns 404

**Tools:** `WebApplicationFactory<Program>` with Testcontainers for PostgreSQL. No mocks for the DB in integration tests.

**Done looks like:** All 8 scenarios above have explicit test methods. Tests run against a real Postgres Testcontainer.

### FluentValidation Tests

- [ ] Validator class has a dedicated test class using `TestValidate()` / `ShouldHaveValidationErrorFor()`
- [ ] All required fields: test that omitting each required field produces the expected error
- [ ] String length constraints: test at max+1 characters
- [ ] Numeric range constraints: test at boundary values (min-1, min, max, max+1)
- [ ] Enum fields: test an invalid string value produces a validation error
- [ ] Cross-field rules (if any): test valid and invalid combinations

**Tools:** `FluentValidation.TestHelper`

**Done looks like:** Every validation rule has at least one test that asserts the error is produced and one that asserts it is not produced on valid input.

### Swagger Documentation

- [ ] Endpoint has XML documentation comment (`/// <summary>`) visible in Swagger UI
- [ ] Request DTO has XML comments on all public properties
- [ ] Response DTO has XML comments on all public properties
- [ ] `[ProducesResponseType]` attributes present for all possible HTTP status codes
- [ ] Endpoint appears correctly in `infra/swagger/asset-maintenance-v1.json` after `npm run gen:api`

**Done looks like:** `npm run gen:api` runs without errors. New endpoint is visible in Swagger UI at `/swagger`.

---

## New UI Component

*Apply when you are adding or significantly modifying a React component in the frontend.*

### React Testing Library Tests

- [ ] Happy path: component renders correct content given typical props
- [ ] Error state: component renders an error message when an API error prop is passed
- [ ] Empty state: component renders the designed empty state when data is an empty array or null
- [ ] Loading state: component renders a loading skeleton or spinner while data is undefined
- [ ] Interaction: primary user interactions (button clicks, form inputs) are tested with `userEvent`

**Tools:** Vitest, React Testing Library (`@testing-library/react`), `@testing-library/user-event`

**Done looks like:** All 5 test scenarios pass. No `console.error` calls in test output.

### Accessibility Check

- [ ] All interactive elements are reachable via Tab key (test with keyboard only, no mouse)
- [ ] All icon-only buttons have an `aria-label` attribute
- [ ] All form inputs have an associated `<label>` (not just placeholder)
- [ ] Color contrast checked for new colors using browser DevTools accessibility panel (target: >= 4.5:1 for normal text)
- [ ] Focus indicator is visible on all interactive elements
- [ ] `axe-core` run via `@axe-core/react` in development; zero critical or serious violations

**Tools:** Browser keyboard navigation, Chrome DevTools Accessibility panel, `@axe-core/react` in dev mode

**Done looks like:** No `axe-core` critical/serious violations in browser console. Manual keyboard nav test completed by the engineer.

### Mobile Viewport

- [ ] Component tested at 375px viewport width (iPhone SE) in browser DevTools
- [ ] No horizontal scroll at 375px
- [ ] Touch targets are visually at least 44x44px
- [ ] Text is readable without zoom (minimum 16px effective font size for body text)

**Done looks like:** Screenshot at 375px attached to PR or confirmed in design review.

### Loading State

- [ ] Skeleton placeholder or spinner renders when `isLoading === true`
- [ ] Skeleton matches the approximate layout of the loaded content (not a generic spinner for complex components)
- [ ] Loading state is tested in the RTL test suite

---

## New Calculation Engine

*Apply when you are adding or modifying a class in `Application/Calculations/`.*

### Unit Test Coverage

- [ ] Calculation engine has a dedicated test class in `UnitTests/Calculations/`
- [ ] Line coverage for the new class is >= 90% (verified with `dotnet test --collect:"XPlat Code Coverage"`)
- [ ] Branch coverage for all conditional logic (if/else, switch, ternary) >= 80%

### Boundary Conditions

- [ ] Input at minimum valid value tested
- [ ] Input at maximum valid value tested
- [ ] Input of exactly zero tested (if zero is meaningful for the domain)
- [ ] Null / missing optional inputs tested
- [ ] Inputs that produce the theoretical boundary output (e.g., RUL = 0 years, RUL = useful-life years) tested

### Floating-Point Precision

- [ ] Results compared with a tolerance, not exact equality: use `value.Should().BeApproximately(expected, precision: 0.001)`
- [ ] No precision loss from integer division where decimal result is expected
- [ ] Results are rounded to the appropriate number of decimal places for the domain (e.g., currency to 2dp, RUL to 1dp)

### Performance Test

- [ ] Performance test demonstrates that computing the result for 1,000 assets runs in under 10ms total (use `Stopwatch` in a test, or `BenchmarkDotNet` for critical engines)
- [ ] No database calls, no I/O, no external dependencies in the calculation engine (verified by code review and the absence of constructor-injected services other than `ILogger`)

**Tools:** xUnit, FluentAssertions, `dotnet test --collect:"XPlat Code Coverage"`, optionally BenchmarkDotNet

**Done looks like:** Coverage report shows >= 90% line coverage. Performance test result logged in PR description.

---

## New Database Migration

*Apply when you are adding an EF Core migration.*

### Migration Runs on Clean Database

- [ ] Migration runs successfully on a fresh Postgres database: `dotnet ef database update` from a blank schema produces no errors
- [ ] Integration tests that use Testcontainers all pass after the migration (Testcontainers starts fresh each run)

### Migration is Idempotent

- [ ] Running the migration twice does not produce errors (EF Core handles this by default; verify if the migration contains `migrationBuilder.Sql()` calls)
- [ ] If the migration contains `migrationBuilder.Sql()`, raw SQL is wrapped with existence checks (`IF NOT EXISTS`, etc.)

### Existing Data Integrity

- [ ] If adding a NOT NULL column to an existing table, a default value or migration-time backfill is included
- [ ] If removing a column, all code references to the column have been removed or made nullable-safe first
- [ ] If renaming a column, the rename is done in two migrations (add new column, deploy, migrate data, remove old column) to avoid breaking rollback

### Index Created for New Foreign Keys

- [ ] Every new foreign key column has an index created in the same migration
- [ ] Composite indexes (multi-column) are created where JOIN/filter patterns require them (document the query justifying the index in a migration comment)

### Migration is Reversible

- [ ] The `Down()` method correctly reverses all changes made by `Up()`
- [ ] If `Down()` is intentionally left empty, this is documented with a comment: `// Down() intentionally empty — data removed in Up() cannot be recovered`
- [ ] Rollback tested: `dotnet ef database update [PreviousMigrationName]` succeeds without errors

**Done looks like:** CI runs `dotnet ef database update` on a Testcontainer as part of the integration test suite. All integration tests pass.

---

## New Integration Connector

*Apply when you are adding or modifying a connector in `Infrastructure/ExternalClients/` or the EAM integration adapter layer.*

### Connectivity Test

- [ ] Unit test verifies that the client correctly constructs the HTTP request (method, path, headers, auth) for the EAM system's API
- [ ] Unit test verifies that the client correctly maps a successful EAM response body to the Aurigo canonical model
- [ ] Integration test (against a mock EAM server using `WireMock.Net`) verifies end-to-end connectivity

### Initial Load Test

- [ ] Test executes an initial load simulation with a synthetic dataset of at least 1,000 records
- [ ] All 1,000 records are persisted correctly (spot-check: first, last, and 5 random records)
- [ ] Duplicate detection: running the initial load twice does not create duplicate records
- [ ] Performance: 1,000 records complete within 5 minutes (log elapsed time in test output)

### Delta Sync Test

- [ ] Test simulates a new record created in EAM appearing in Aurigo within the expected sync window
- [ ] Test simulates a record updated in EAM updating correctly in Aurigo (no old data retained)
- [ ] Soft delete: a record deleted in EAM is soft-deleted in Aurigo (IsDeleted = true, not hard-deleted)

### Error Handling Tests

- [ ] EAM returns HTTP 500: connector logs the error, increments a failure metric, and retries with exponential backoff
- [ ] EAM returns HTTP 429 (rate limited): connector respects the `Retry-After` header and backs off
- [ ] EAM returns malformed JSON: connector logs the error and skips the record without crashing the sync job
- [ ] EAM is unreachable (timeout): connector logs the error and exits gracefully; next sync will retry

### Rate Limit Behavior

- [ ] Connector respects the EAM system's documented rate limit (requests per minute)
- [ ] If no rate limit is documented, connector defaults to a conservative 30 requests/minute with configurable override

**Tools:** xUnit, WireMock.Net, Testcontainers (for DB side)

**Done looks like:** All tests above pass in CI. Error handling tests use WireMock.Net to simulate error responses.

---

## Security-Sensitive Change

*Apply when your change touches authentication, authorization, query construction, or sensitive data.*

### SQL Injection Test

- [ ] All user-supplied strings are passed as parameterized query values (EF Core handles this by default; flag any `FromSqlRaw` or `ExecuteSqlRaw` usage)
- [ ] If `FromSqlRaw` is used, all parameters are passed via `SqlParameter`, not string interpolation
- [ ] Integration test: attempt to inject a SQL fragment via a string input field; verify the DB receives the literal string, not interpreted SQL

### Auth Bypass Test

- [ ] Integration test: request to all new endpoints without a JWT token returns 401
- [ ] Integration test: request with a valid JWT but wrong tenant ID returns 404 or 403 as appropriate (never 200 with another tenant's data)
- [ ] Integration test: request with a forged JWT (tampered signature) returns 401

### Role Escalation Test

- [ ] Integration test: user with the lowest role (ReadOnly) cannot access mutation endpoints (POST/PUT/DELETE) — returns 403
- [ ] Integration test: user cannot elevate their own role (no endpoint allows self-modification of JWT claims)

### Sensitive Data in Logs Test

- [ ] Code review: no `_logger.Log*` calls include JWT tokens, passwords, connection strings, or full names/emails in message templates
- [ ] Code review: exception handlers do not include raw exception messages from EF Core (which may contain query parameters) in API responses

**Done looks like:** All 4 categories above have at least one automated test. Code review confirms no sensitive data in logs.

---

## Performance-Sensitive Change

*Apply when your change touches a dashboard load path, a bulk export, or any query that scales with the number of assets.*

### Load Test with k6

- [ ] k6 load test script written and run locally: [N] virtual users, [N] seconds duration
- [ ] Target RPS achieved without error rate > 0.1%
- [ ] P95 latency meets the target defined in the PRD or NFR (default: 2,000ms for dashboard paths, 5,000ms for export paths)
- [ ] k6 results summary included in PR description

### P95 Latency Check

- [ ] API endpoint tested under realistic data volume (at least the expected largest tenant size)
- [ ] P95 latency measured under 20 concurrent users (representative of peak dashboard usage)
- [ ] Result compared against the target in the NFR table; PR description states the measured P95

### No New N+1 Queries

- [ ] EF Core SQL logging enabled during integration tests; query count per request verified
- [ ] No new SELECT statements inside a loop (each loop iteration must not execute a query)
- [ ] All new related entity loads use `.Include()` or explicit projection, not lazy loading triggers

### Memory Usage Stable

- [ ] For bulk operations: memory usage does not grow linearly with dataset size (streaming / pagination used)
- [ ] For large exports: response is streamed, not buffered entirely in memory before sending
- [ ] No large collections held in memory across request scope (e.g., no `List<Asset>` with 100k items in a request handler)

**Done looks like:** k6 results attached to PR. Query log confirms no N+1. Memory usage documented in PR description.
