# Definition of Done

> Volume 3 · Architecture · Document 16  
> The quality gate every user story must pass before it is considered complete

---

## Purpose

The Definition of Done (DoD) is the shared, non-negotiable standard that the entire team agrees every user story must meet before it leaves the sprint. It exists because "done" is not a subjective state — either the criteria are met or the story stays in the sprint.

The DoD prevents:
- Features that "work on my machine" but fail in staging
- Features that pass happy-path scenarios but have no error state handling
- Features that pass tests but are inaccessible to keyboard-only users
- Features deployed without observability (no logs, no metrics)
- Database changes without migrations
- API changes without Swagger updates

**A story is DONE when ALL of the following are true.** A partial DoD is not done.

---

## Code Quality

- [ ] **Code reviewed and approved** by at least one team member who is not the author. The reviewer has checked coding standards ([01 — Coding Standards](./01-coding-standards.md)), not just test pass/fail.
- [ ] **All CI checks pass**: lint, build, unit tests, integration tests, security scan.
- [ ] **No new linting errors or warnings** introduced. If an existing warning is resolved, even better.
- [ ] **No new security vulnerabilities** flagged by Trivy or `dotnet list package --vulnerable`.
- [ ] **TypeScript: zero errors** at build time (`npm run type-check` passes with no errors).
- [ ] **Test coverage not decreased** below the CI-enforced baseline for `Application/Calculations/` (90% — hard gate in CI). `Domain/` 80% is the aspirational target and is reviewed in PR but not yet a hard CI gate.
- [ ] **No `any` types introduced** in TypeScript without an explicit justification comment at the call site.
- [ ] **No commented-out code** committed.
- [ ] **No TODO comments** committed to the main branch. If something is deferred, it must be a tracked story in the backlog.

---

## Functionality

- [ ] **Feature behaves as described in all acceptance criteria.** PM has reviewed and confirmed. Each acceptance criterion is a verifiable test — not a vague description.
- [ ] **Edge cases identified and handled.** Empty states (no data), boundary values (condition index = 0 and = 5), large datasets (pagination works), concurrent operations (no race conditions on critical paths).
- [ ] **Error states handled and tested.** API errors return the correct status code and RFC 7807 error body. The frontend shows a meaningful error message, not an empty screen or a generic "Something went wrong" with no recovery path.
- [ ] **Loading states render correctly.** Skeleton loaders or spinners while data is fetching. No content layout shift between loading and loaded states that causes jarring UI movement.
- [ ] **Responsive on mobile.** Minimum viewport 375px. All interactive elements are tappable (44×44px minimum touch target). No horizontal scroll on mobile. Tested in browser DevTools mobile simulation and (for critical paths) on a real device.
- [ ] **Accessible.** All interactive elements have appropriate ARIA labels. Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text. Keyboard navigable (Tab through all interactive elements in logical order, Enter/Space activates buttons and links). Screen reader tested for key flows.

---

## Documentation

- [ ] **New API endpoints documented in Swagger.** XML doc comments on all new controller actions. `[ProducesResponseType]` for all response codes. `infra/swagger/asset-maintenance-v1.json` regenerated and committed.
- [ ] **Frontend client regenerated.** If Swagger changed, `npm run gen:api` was run and the updated client is committed.
- [ ] **Complex logic has explanatory comments.** Calculation engines have inline comments explaining the mathematical reasoning. Non-obvious invariants are documented. The standard is: would a competent engineer need to spend more than 5 minutes understanding why this code is written this way? If yes, add a comment.
- [ ] **README updated** if the story added new directories, changed conventions, or introduced new tooling.
- [ ] **ADR created** if the story required an architectural decision (technology choice, design pattern, structural change, reversal of a previous decision). The ADR is reviewed as part of the PR.
- [ ] **CLAUDE.md updated** if the story changed a coding convention, added a dependency, or established a new rule that AI agents need to know about.

---

## Database

- [ ] **Migration created** for all schema changes. No manual database modifications.
- [ ] **Migration tested on a clean database.** CI integration tests apply all migrations from scratch using Testcontainers — if this passes, the migration is clean.
- [ ] **Migration is forward-compatible.** The migration does not break the currently-deployed application version (additive-only or two-step for destructive changes). Allows blue/green deployment overlap.
- [ ] **Index created** for all new foreign key columns and for new query patterns identified in the feature. Reviewed with `EXPLAIN ANALYZE` if the table will have > 10,000 rows.
- [ ] **Seed data updated** if the story added new reference data (new asset class, new condition rating scale, new configuration default).
- [ ] **No direct `SET` statements in migrations** for data mutations. Data changes use idempotent SQL that is safe to run multiple times.

---

## Security

- [ ] **Input validated** at the API boundary for all new or modified endpoints. FluentValidation rules cover: required fields, length limits, range constraints, format constraints.
- [ ] **Authorization applied** to all new endpoints. No new endpoint is `[AllowAnonymous]` without an explicit security review. Role requirements match the permission matrix in [08 — Authorization](./08-authorization.md).
- [ ] **No sensitive data logged.** New log statements do not include JWT tokens, passwords, or raw PII (email, name in high-volume error logs).
- [ ] **No secrets in code.** No new API keys, connection strings, or credentials in any source file or configuration file committed to the repository.
- [ ] **EF Core global query filters not bypassed** without an explanatory comment and explicit security review.

---

## Observability

- [ ] **Key operations logged** at the appropriate level. New handler operations have `LogInformation` at start (or completion) and `LogError` with exception on failure.
- [ ] **Metrics emitted** for new business operations. New calculation engines have a histogram metric for their execution duration. New job types have a counter for success and failure.
- [ ] **Health check updated** if the story adds a new external dependency (new integration, new cache region, new queue). The `/health` endpoint must reflect the new dependency's status.
- [ ] **X-Correlation-ID propagated** through any new service-to-service call introduced by the story.

---

## Performance

- [ ] **No N+1 queries introduced.** New LINQ queries reviewed for implicit navigation property access without `.Include()`. Load test or manual review for queries on large tables.
- [ ] **AsNoTracking() used** on all new read-only queries.
- [ ] **Pagination added** to all new list queries. No unbounded `ToListAsync()` calls.
- [ ] **Frontend load time** not significantly degraded. New route components are lazy-loaded. New heavy dependencies (charting libraries, PDF renderers) are in their own dynamic import chunk.

---

## Testing

- [ ] **Unit tests** cover new calculation engine methods at the boundary conditions.
- [ ] **Integration tests** cover new API endpoints: at least one happy path and one error path.
- [ ] **E2E test added** for new critical user journeys (journeys that directly deliver user value — creating an asset, recording an inspection, generating a report). Non-critical UI changes do not need E2E.
- [ ] **Tests are deterministic.** No flaky tests. If a test fails intermittently during the PR, it must be fixed before merging.

---

## External Integrations

*Apply this section only to stories that introduce or modify a call to an external API (Aurigo Plan, Aurigo Build, Maximo, Cityworks, any third-party HTTP endpoint).*

- [ ] **Spec read directly in this session.** The OpenAPI spec or API documentation for the external system was opened and read in the current working session — not from a prior agent's summary, not from the canonical example in the playbook, not from the existing mapper code. The spec URL or file path is cited in the PR description.
- [ ] **Request shape verified against the spec.** Field names (exact casing), required vs. optional fields, Content-Type header, authentication scheme, and any required query parameters were confirmed against the spec — not inferred from existing code.
- [ ] **Authentication scheme confirmed.** Bearer token vs. PublicApi scheme verified (`appsettings.json` `HeaderScheme` value matches the spec's security requirement). Token endpoint and grant type confirmed.
- [ ] **Stub flag audited.** `UseStub` setting in `appsettings.json` is correct for the target environment. The real integration was tested against the live endpoint, not only against the stub.
- [ ] **No mapper built from a prior mapper without spec verification.** If an existing payload mapper was used as a starting point, it was independently verified against the current spec before use. Drift between mapper and spec is the most common source of silent integration failures.

> **Why this section exists:** In multi-session and multi-agent work, the payload mapper may have been built from a prior session's compressed reading of the spec. By the time a POST fails, the spec may have been out of context for two or more agent generations. This checklist forces a fresh spec read at the point of integration work — not at the point of debugging a failure.  
> See `SKILLS.md` § "Debugging external API integration failures" for the debugging protocol.

---

## Release Readiness

- [ ] **Feature flag** in place if the feature is being deployed incrementally or needs to be disabled without a rollback.
- [ ] **Rollback plan documented** if the change involves a complex migration or external API contract change that cannot be automatically rolled back by ECS blue/green.
- [ ] **PM sign-off** — the Product Manager has reviewed the feature in the dev environment and confirmed it meets the acceptance criteria.

---

## Checklist Template

Copy this into the PR description for every user story:

```markdown
## Definition of Done Checklist

### Code Quality
- [ ] Code reviewed and approved by at least one team member
- [ ] All CI checks pass
- [ ] No new linting errors
- [ ] TypeScript: zero errors
- [ ] No commented-out code or TODOs

### Functionality
- [ ] All acceptance criteria verified by PM
- [ ] Edge cases handled and tested
- [ ] Error states handled (API + UI)
- [ ] Loading states render correctly
- [ ] Responsive at 375px
- [ ] Keyboard navigable and accessible

### Documentation
- [ ] Swagger updated (if API changed)
- [ ] Frontend client regenerated (if Swagger changed)
- [ ] ADR written (if architectural decision made)
- [ ] CLAUDE.md updated (if conventions changed)

### Database
- [ ] Migration created for schema changes
- [ ] Migration tested on clean DB (CI passes)
- [ ] New indexes added for FK and query patterns

### Security
- [ ] Input validation added for new endpoints
- [ ] Authorization applied to new endpoints
- [ ] No sensitive data in logs
- [ ] No secrets in code

### Observability
- [ ] Key operations logged at appropriate level
- [ ] Metrics emitted for new operations

### Performance
- [ ] No N+1 queries
- [ ] AsNoTracking() on read queries
- [ ] New list endpoints paginated

### Testing
- [ ] Unit tests for new calculation logic
- [ ] Integration tests for new endpoints
- [ ] E2E test for critical new user journey (if applicable)

### External Integrations (omit if story has no external API calls)
- [ ] Spec read directly in this session (cite URL or file path in PR)
- [ ] Request shape verified against spec (field names, required fields, Content-Type, auth scheme)
- [ ] Stub flag audited — real endpoint tested, not only stub
- [ ] No mapper built from prior mapper without independent spec verification
```

---

_See also: [13 — Testing](./13-testing.md) for test requirements, [15 — Documentation Standards](./15-documentation-standards.md) for documentation requirements._
