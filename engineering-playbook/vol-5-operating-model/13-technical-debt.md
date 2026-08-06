# 13 — Technical Debt

Technical debt is not a sign of bad engineering. It is a sign of real-world engineering — where time, knowledge, and priorities are always finite. The question is not whether to incur technical debt, but how to manage it deliberately: tracking it, prioritizing it, and paying it down systematically before it compounds into a structural problem.

Teams that refuse to acknowledge debt don't have less of it. They have invisible debt, which is far more dangerous.

---

## What Technical Debt Is (and Is Not)

**Technical debt IS:**
- A deliberate trade-off: "We will implement this in a simpler, less optimal way now to ship faster, and we will improve it later"
- A code pattern that was the right choice when written but is now the wrong choice as the system has grown
- A missing abstraction that makes a frequently-changed area harder to change
- An undocumented behavior that has become load-bearing

**Technical debt IS NOT:**
- A bug. Bugs are defects. Debt is suboptimal but functional code.
- Poor coding. Debt is managed trade-offs. Poor coding is carelessness.
- Every opportunity to rewrite something. Rewriting for its own sake is waste.
- An excuse to never ship. Some debt is always acceptable.

The key attribute of managed technical debt: it is tracked, understood, and has a plan for resolution.

---

## Debt Categories

### 1. Architecture Debt

The system's structure diverges from its intended architecture. Examples:
- Business logic in controllers (should be in Application handlers)
- Direct EF queries in a controller (bypasses MediatR, no validation pipeline)
- A module that grew to own data it should not own (domain boundary violation)

**Aurigo example**: An early implementation of the dashboard that queries the database directly from a controller action instead of going through a MediatR query handler. It works, but it bypasses the validation pipeline, the audit interceptor, and the multi-tenancy global filter.

**Risk if unaddressed**: The pattern gets copied. New engineers follow the "precedent" and create more controller-level queries. The MediatR pattern becomes inconsistently applied, making the codebase harder to understand and maintain.

### 2. Code Quality Debt

Code that is functionally correct but hard to understand, test, or modify. Examples:
- A method that is 200 lines long and does 6 different things
- A class with 15 dependencies (constructor injection with 15 parameters)
- Deeply nested conditionals (arrow code)
- Copy-paste duplication across handlers

**Aurigo example**: The RulCalculator originally had a single `Calculate` method of 180 lines. It was refactored to extract `CalculateChronologicalAge`, `AdjustForCondition`, and `ClampToZero` private methods, each testable in isolation.

**Risk if unaddressed**: Changes to a complex method take longer, introduce more bugs, and require the author to hold the entire method in their head to safely modify a small part.

### 3. Test Debt

Insufficient or missing test coverage for existing code. Examples:
- A calculation engine with 40% coverage (Aurigo standard: ≥90%)
- Integration tests that mock the database instead of using Testcontainers
- Tests that test implementation details rather than behavior

**Aurigo example**: An early version of the risk scorer had no integration tests. The unit tests were present but they tested private methods directly rather than the public API. When the internal implementation changed, all unit tests broke even though the behavior was correct.

**Risk if unaddressed**: Changes to undertested code are high-risk. Engineers slow down or avoid touching the area. Bugs ship to production that would have been caught.

### 4. Documentation Debt

Code whose behavior is not documented. Examples:
- A calculation formula with no corresponding vault/calculations/ spec
- A complex multi-step workflow with no sequence diagram
- An ADR that was never written for an architectural decision made in a PR

**Aurigo example**: The ARV calculation was implemented without a vault/calculations/AssetReplacementValue.md file. Two sprints later, a PM asked why ARVs were showing unexpected values. The formula had to be reverse-engineered from the code.

**Risk if unaddressed**: New engineers and AI agents cannot understand the intended behavior. Changes are made without understanding implications. Bugs are introduced when the implementation diverges from the (undocumented) intent.

### 5. Dependency Debt

Third-party libraries that are outdated, unmaintained, or have known security vulnerabilities. Examples:
- A NuGet package version locked to a specific version due to a known incompatibility
- An npm package with a moderate security vulnerability (no critical patch available yet)
- A framework version behind the LTS release

**Aurigo example**: An early prototype locked to a specific NetTopologySuite version that was incompatible with the latest Npgsql. Upgrading either required updating both, which required testing all PostGIS interactions.

**Risk if unaddressed**: Security vulnerabilities accumulate. Breaking changes in ecosystem dependencies become larger jumps. AWS SDK updates that should be routine become multi-day efforts.

### 6. Data Model Debt

The database schema no longer optimally represents the domain model. Examples:
- A column that was added as a workaround and is now load-bearing but poorly named
- A table that was split in the domain model but not yet in the database (the schema lags behind)
- Indexes that are missing on frequently-queried columns
- A JSON column that should be a proper normalized table

**Aurigo example**: The `inspections` table initially stored all observation data in a `notes` text column. As the feature expanded, individual fields were added (condition_rating, runtime_hours, last_test_date) but the `notes` column persisted, sometimes containing structured data that had been migrated to proper columns.

**Risk if unaddressed**: Query performance degrades. Data integrity issues emerge. New features built on the model inherit the inconsistencies.

---

## Tracking Technical Debt

Every piece of known technical debt is tracked in the product backlog with:
- **Label**: `tech-debt`
- **Sub-label**: one of `architecture`, `code-quality`, `test`, `documentation`, `dependency`, `data-model`
- **Priority**: calculated using the prioritization formula below
- **Location**: specific file path(s) and class/method names

Additionally, the code itself is annotated with a comment when a known debt item is introduced deliberately:

```csharp
// DEBT[AM-234]: This calculation is a simplified linear model.
// The full Markov-chain deterioration model is in vault/calculations/DeteriorationModels.md
// and should replace this when the Phase 3 calculation engine is implemented.
private decimal SimplifiedDeteriorationRate(decimal age, decimal designLife)
```

The comment references the backlog ticket (`AM-234`) and explains why the simpler approach was chosen. When the debt is paid, the comment is removed along with the old implementation.

---

## The 20% Sprint Capacity Rule

Every sprint, 20% of committed story points are allocated to tech debt items. This is not optional and not subject to negotiation by the PM. It is a commitment to engineering quality that is as important as feature delivery.

Rationale:
- Debt left unaddressed compounds. A 1-point debt item today becomes a 3-point item in 6 months when more code has been built around it.
- Teams that do not reserve capacity for debt will eventually have to stop feature work entirely to address a debt crisis. The 20% rule prevents the crisis.
- Debt reduction has a measurable impact on future velocity. Teams that pay down debt consistently ship faster over time.

If the PM wants to use the 20% capacity for features in a given sprint, the response is: "We can do that. Here is the current tech debt backlog and the items whose deferral increases risk." The PM makes an informed decision, and the deferral is tracked.

---

## Monthly Debt Review Meeting

On the last Thursday of each month, a 60-minute technical debt review meeting is held.

**Agenda:**
1. AI agent runs the debt scan (see below) — 10 min review
2. New debt items identified this month: review and confirm
3. Deferred debt from previous months: re-prioritize
4. Tech debt items completed this month: celebrate and confirm impact
5. Prioritize the next sprint's 20% capacity debt allocation

**AI agent debt scan:**
```
Scan the codebase for indicators of technical debt:
1. Methods longer than 100 lines
2. Classes with more than 8 constructor parameters
3. TODO/FIXME/HACK/DEBT comments
4. Test coverage below thresholds for Calculations/ (90%), Domain/ (80%), Application/ (70%)
5. NuGet and npm packages more than 2 major versions behind current
6. Endpoints without complete Swagger annotations
7. Entities without corresponding vault/domain/ documentation

For each finding, report: location, debt category, estimated severity (low/medium/high), estimated remediation effort in story points.
```

---

## Debt Prioritization Formula

Not all debt is equal. Debt that affects frequently-changed code is far more costly than debt in a stable, rarely-touched module.

```
Debt Priority Score = Severity × Spread × ChangeFrequency

Where:
  Severity: 1 (low risk) to 5 (high risk — blocks features, creates security exposure)
  Spread: 1 (localized to 1 file) to 5 (affects 10+ files or a core shared abstraction)
  ChangeFrequency: 1 (almost never changed) to 5 (changed every sprint)
```

**Example prioritization:**
```
Debt A: Missing indexes on inspection queries
  Severity: 4 (performance degrades at scale — customer-visible)
  Spread: 2 (2 query files affected)
  ChangeFrequency: 3 (queries updated monthly)
  Score: 4 × 2 × 3 = 24

Debt B: Controller that bypasses MediatR
  Severity: 3 (bypasses audit and validation)
  Spread: 1 (1 controller, 3 endpoints)
  ChangeFrequency: 2 (rarely changed)
  Score: 3 × 1 × 2 = 6

Debt C: Outdated documentation for ARV calculation
  Severity: 2 (risk of incorrect implementation when changed)
  Spread: 3 (ARV feeds risk score, capital needs, reports)
  ChangeFrequency: 4 (updated almost every sprint)
  Score: 2 × 3 × 4 = 24
```

In this example, both A and C score 24 and are higher priority than B (score 6). Both should be in the next sprint's 20% allocation. B is scheduled when capacity allows.

---

## Debt That Was Never Incurred: Proactive Avoidance

Some debt is best avoided entirely. Before introducing a deliberate trade-off:

1. Confirm it is genuinely a trade-off, not a lack of knowledge about the right approach
2. Document it immediately (backlog ticket + code comment) so it cannot become invisible debt
3. Estimate when it needs to be addressed (before Phase N? before scaling to 1000 tenants? never?)
4. Get the lead engineer's agreement before shipping the trade-off

Invisible debt — debt that is neither tracked nor acknowledged — is the most dangerous kind. The goal is not zero debt; it is zero surprise debt.
