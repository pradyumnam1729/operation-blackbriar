# QA Lead

## Mission

The QA Lead owns testing strategy, quality culture, and the testing infrastructure that ensures every shipped feature works as designed, at scale, and under adversarial conditions. In an AI-native engineering organization, the QA Lead's role shifts fundamentally: from manually writing and executing tests to designing the test architecture and supervising AI-generated tests.

The key insight: AI can write tests faster than any human. AI can write many tests that look correct but don't actually test what they claim to test. The QA Lead's most critical skill is distinguishing real test coverage from theatrical test coverage — tests that give false confidence. This requires a mutation-testing mindset: if you deleted the code under test, would the test catch it?

---

## Responsibilities

### Testing Strategy

Define and own the testing pyramid for Maintain:

**Unit Tests (70% of test count)**
- Calculation engines in `Application/Calculations/` — pure functions, full branch coverage, property-based tests for edge cases
- Domain entity logic (value objects, entity state machines)
- Validation rules (FluentValidation)
- Target: > 90% line coverage on Calculations/ and Domain/

**Integration Tests (25% of test count)**
- API endpoints (controller through handler through EF Core to PostgreSQL via Testcontainers)
- Multi-tenancy boundary tests (tenant isolation verification)
- EF Core migrations (apply and verify)
- External service contracts (CMMS integration contracts, not real external calls)
- Target: > 85% of API endpoints covered

**E2E Tests (5% of test count)**
- Critical user journeys: complete an inspection, create a work order from a defect, run capital plan optimization, generate a report
- Mobile inspector journey at 375px viewport
- Target: core user journeys covered; not exhaustive feature coverage

The QA Lead enforces this pyramid actively. When the team starts adding more E2E tests than unit tests (test pyramid inversion), the QA Lead redirects: E2E tests are expensive and flaky; push coverage down to the unit level.

### AI-Generated Test Supervision

Supervise the quality of AI-generated tests. This is the most important and most subtle QA function in an AI-native org.

AI agents excel at generating test scaffolding — setting up mocks, writing happy path assertions, following the Arrange/Act/Assert pattern. They are weak at:
- Generating tests that would catch a wrong formula (they test the output of the formula with the formula's own logic, creating tautologies)
- Generating negative test cases that test what the system should NOT do
- Generating tests for race conditions, concurrent modifications, and eventual consistency
- Generating tests that test boundary conditions (off-by-one, null/empty, max values)

The QA Lead reviews AI-generated tests with a mutation mindset: if I changed this line of the implementation, would any of these tests catch it? If the answer is "no," the tests are providing false coverage.

### Test Infrastructure Ownership

Own the CI test pipeline: what runs on every PR (unit tests, fast integration tests), what runs on merge to main (full integration suite), what runs nightly (full E2E suite). Configure and maintain Testcontainers for integration tests. Configure and maintain Playwright for E2E tests.

Flaky tests are a specific ownership responsibility. A test that fails intermittently (without a code change) is worse than no test — it erodes trust in the entire test suite. The QA Lead has a zero-tolerance policy for known flaky tests. They are either fixed within 24 hours or quarantined (marked with a skip attribute, filed as a bug, removed from the blocking CI gate).

### Quality Gates

Define and enforce quality gates that apply at specific points in the delivery pipeline:

- **PR gate**: unit tests pass, TypeScript compiles, architecture tests pass, no new linting errors
- **Merge to main gate**: full integration tests pass, code coverage does not decrease below thresholds
- **Staging gate**: full E2E suite passes, no P1 accessibility violations
- **Production gate**: performance benchmarks within tolerance, no new security findings

The QA Lead is the authority for these gates. An ED or PM cannot override a failing quality gate to ship faster — they can create an exception, which must be documented with a risk acknowledgment and a remediation plan.

### BDD Scenario Development

Translate product acceptance criteria into BDD scenarios (Given/When/Then) that serve as the specification for both test implementation and product behavior. Use AI to generate initial BDD scenarios from user stories; review and correct for domain accuracy.

The BDD scenarios are the bridge between the PM's acceptance criteria and the QA's test implementations. When the scenarios are ambiguous or missing, both the tests and the product behavior will be ambiguous. The QA Lead resolves scenario ambiguity before testing begins, not after.

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| Unit Test Coverage (Calculations + Domain) | > 90% line coverage | Per CI run |
| Integration Test Coverage | > 85% of API endpoints | Monthly |
| E2E Test Pass Rate | > 99% on stable main branch | Daily |
| Flaky Test Count | Zero known flaky tests in active suite | Weekly |
| Test-to-Code Ratio | > 1.2 (more test lines than production lines) | Monthly |
| Defect Escape Rate | < 2 P1/P2 bugs per sprint reaching production | Monthly |
| QA Gate Overrides | < 1 per quarter (with documented risk acceptance) | Quarterly |
| AI Test Quality Score | > 80% of AI-generated tests catch a deliberate mutation | Quarterly |

---

## Authority

The QA Lead has authority to:
- Block any deployment (PR, staging, or production) that does not meet quality gate criteria
- Require additional test coverage before a feature ships
- Quarantine flaky tests unilaterally
- Define the test toolchain (Vitest, Playwright, Testcontainers, FluentAssertions, etc.)

The QA Lead does not have authority to:
- Change product scope or acceptance criteria (PM authority)
- Override the Architect on test architecture decisions that affect Clean Architecture
- Access production systems to execute tests

---

## Deliverables

**Per sprint**: Test coverage report, violation log (tests that failed and why), AI-generated test quality spot check

**Weekly**: Flaky test status, quality gate health report

**Monthly**: Test pyramid health (unit/integration/E2E distribution), mutation testing score

**Quarterly**: Testing strategy review, toolchain update assessment

---

## Decision Making

When evaluating a new test suite from AI generation:

1. **Run mutation testing on a sample**: Use Stryker.NET to mutate 5 methods in the code under test and verify that the AI-generated tests catch the mutations. If mutation detection is below 80%, the tests are inadequate.

2. **Check the negative test coverage**: For every "should succeed" test, is there at least one "should fail" test? Negative tests (invalid input, boundary violations, permission denials) are the most commonly missed.

3. **Check the integration test boundary**: Are tests using a real database (via Testcontainers) for data access tests, or are they mocking the database? Database mocks in integration tests are a code smell — they can't catch EF Core query mistakes.

4. **Check for hardcoded expected values**: Tests that hardcode expected output values from the formula being tested create circular dependency. Tests for calculations should use known-good input/output pairs from domain literature or manual calculation.

---

## Daily Workflow

**08:00–08:30** — Review overnight CI and E2E test results. Any failures? Flaky tests? Triage with priority.

**08:30–09:30** — Test PR review: review AI-generated test PRs for quality. Apply the mutation mindset.

**09:30–10:30** — Flaky test investigation (when active): pair with the responsible engineer to diagnose and fix.

**10:30–12:00** — BDD scenario development for upcoming sprint stories. Work from PM's acceptance criteria, ask clarifying questions, produce testable scenarios.

**14:00–15:30** — E2E test maintenance: Playwright tests need regular maintenance as the UI evolves. Fix broken selectors, update test data, add coverage for new journeys.

**15:30–17:00** — Test infrastructure work: Testcontainers setup, CI pipeline configuration, toolchain updates.

---

## Collaboration

**With PM**: Daily partnership on acceptance criteria. The QA Lead reviews every story's AC before sprint planning and flags any criteria that are not testable ("the system should be fast" is not testable; "all list endpoints should respond within 200ms at P95 with 10,000 records" is testable).

**With Backend Lead**: Integration test strategy for API endpoints. The Backend Lead implements backend logic; the QA Lead designs the integration test coverage strategy.

**With Frontend Lead**: E2E test strategy for user journeys. The Frontend Lead implements frontend features; the QA Lead designs the Playwright tests that cover the resulting user journeys.

**With AI Engineer**: Specific attention to calculation testing. AI-generated calculation tests are particularly prone to the tautology problem (testing a formula with itself). The QA Lead and AI Engineer jointly define known-good test vectors from domain literature.

---

## Escalation

The QA Lead escalates to the ED when:
- A quality gate override is requested (documents the risk, requires ED sign-off)
- Test infrastructure is blocking the CI pipeline for more than 2 hours
- A pattern of defect escapes suggests a systematic gap in the testing strategy

---

## Continuous Improvement

Monthly: run mutation testing on the Calculations/ layer. Track the mutation detection rate. Any rate below 90% is a priority improvement item.

Quarterly: review the testing pyramid distribution. Are we trending toward more E2E tests and fewer unit tests? Redirect investment.

Quarterly: review defect escape rates by feature area. Which areas produce the most production bugs? Those areas need targeted testing improvement.

---

## Example Scenarios

### Scenario 1: Catching a Tautological Calculation Test

The AI Engineer submits a PR with unit tests for the RUL calculator. The tests look comprehensive — 15 test cases, happy path and edge cases. The QA Lead runs Stryker.NET mutation testing on the RulCalculator class.

Stryker mutates the deterioration rate formula: changes `(currentCondition - threshold) / deteriorationRate` to `(currentCondition - threshold) * deteriorationRate`. The mutation survives — not one test catches it.

The reason: all 15 AI-generated tests were generated using the formula itself to compute the expected output. The test says "given condition 60, threshold 40, rate 2.0, expected RUL is 10.0" — but 10.0 was computed by the same formula the test is testing. When the formula is mutated, the expected value changes, and the test still passes.

The QA Lead adds tests with known-good values from AASHTO literature: "For a bridge deck with condition 60, rehabilitation threshold 40, and historical deterioration rate of 2.0 points/year, AASHTO guidance predicts 10 years to rehabilitation. The RUL calculator must produce 10 ± 0.1 years." Now the test is anchored to an external truth, not the formula itself.

### Scenario 2: Quality Gate Override Request

It's Friday afternoon before a customer demo Monday morning. A P1 bug has been found in staging: the capital plan optimization crashes when there are zero candidate projects. The ED asks the QA Lead if the production deployment can proceed anyway (the demo tenant won't have zero projects).

The QA Lead documents the risk: the crash is reproducible, it affects the capital plan page (the primary demo page), and there is a non-zero probability the demo tenant ends up with zero projects if seed data isn't exactly right. The QA Lead's recommendation: fix the bug (it's a null check, 30 minutes), run the integration tests, deploy with the fix.

The override is not granted; the fix is implemented. The QA Lead writes a regression test for the zero-project edge case.

### Scenario 3: Redesigning the E2E Test Suite for Stability

After 3 months of Playwright E2E test development (primarily AI-generated), the nightly E2E suite has a 72% pass rate — 28% failure rate due to flaky tests. The QA Lead conducts a root cause analysis.

Findings: (1) AI-generated tests use fragile CSS selectors (`.btn-primary`) that break when Tailwind class names change. (2) Tests depend on specific seed data that gets modified by other tests running in parallel. (3) Tests use fixed timeouts (sleep 2000ms) instead of waiting for network activity to settle.

The QA Lead defines three fixes: (1) all selectors must use data-testid attributes, which are stable and intentionally added; (2) each E2E test creates its own isolated test data and cleans it up; (3) replace all fixed sleeps with `waitForResponse()` and `waitForSelector()` patterns.

After 6 weeks of applying these fixes (AI-accelerated: the QA Lead prompts Claude to rewrite each flaky test using the new patterns), the E2E pass rate is 98.5%.
