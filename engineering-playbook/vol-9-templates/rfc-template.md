# RFC-[NNN]: [Title]

---

## Header

| Field | Value |
|-------|-------|
| **RFC Number** | RFC-[NNN] |
| **Title** | [Short declarative title] |
| **Status** | Draft / In Review / Accepted / Rejected / Superseded |
| **Author** | [Name] |
| **Date** | YYYY-MM-DD |
| **Review Deadline** | YYYY-MM-DD (5 business days from circulation) |
| **Reviewers** | [Name (role)], [Name (role)], [Name (role)] |
| **Decision Owner** | [Engineering Director name] |
| **Related ADR** | ADR-[NNN] (created after this RFC is accepted) |

---

## Summary

[Two paragraphs maximum. First paragraph: what is being proposed and what problem it solves. Second paragraph: the key trade-off or uncertainty that makes this worth an RFC rather than a direct implementation decision. A reader who only reads this section must understand whether this RFC is relevant to their work.]

---

## Background and Motivation

[Two to four paragraphs. Describe the current state of the system or process, why it is insufficient, and the pressures that are forcing a decision now. Include metrics where available (current latency, current cost, current failure rate). Do not propose solutions yet.]

### Current State

[Describe how the system works today. Diagrams or code snippets welcome.]

### Why This Cannot Continue

[Describe the specific failure mode, cost, or bottleneck that motivates change. Be concrete: latency numbers, error rates, developer friction, compliance risk.]

### Constraints

[List constraints that any solution must respect. Examples: must not break existing API contracts, must not require downtime, must fit within the existing .NET 8 / EF Core / PostgreSQL stack, must not require a new AWS service without ED approval.]

---

## Proposed Design

[Full technical description of the proposed solution. Use subsections freely. Include code examples for critical path changes. Link to spike branches or proof-of-concept repositories if available.]

### Overview

[High-level description in 2-4 sentences.]

### Detailed Design

[Step-by-step description of how the solution works. For a new service or component: describe its interface, its data flow, its failure modes. For a new pattern: show before and after code. For a new infrastructure dependency: describe the deployment model.]

### Code Example

```csharp
// Language appropriate to the change — C# for backend, TypeScript for frontend
// Show the critical path: the new interface, the registration, the usage site.
public interface IExampleService
{
    Task<Result> DoWorkAsync(Guid tenantId, CancellationToken ct = default);
}
```

### Configuration

[Any new configuration keys, feature flags, or environment variables introduced.]

### Migration Path

[If this change affects existing data or existing callers: describe how old and new coexist during the transition, and when the old behavior is retired.]

---

## Alternatives Considered

### Alternative A: [Name]

**Description:** [How this approach would work.]

**Pros:**
- [Pro 1]
- [Pro 2]

**Cons:**
- [Con 1]
- [Con 2]

**Why rejected:** [Reason this was not chosen as the proposal.]

---

### Alternative B: [Name]

**Description:** [How this approach would work.]

**Pros:**
- [Pro 1]

**Cons:**
- [Con 1]
- [Con 2]

**Why rejected:** [Reason this was not chosen as the proposal.]

---

### Alternative C: Do Nothing

**Description:** Continue with the current approach.

**Pros:**
- No implementation cost.

**Cons:**
- [The specific problem continues to worsen.]

**Why rejected:** [Quantify the ongoing cost of inaction.]

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk description] | Low / Medium / High | Low / Medium / High | [Specific mitigation action] |
| [Risk description] | Low / Medium / High | Low / Medium / High | [Specific mitigation action] |
| [Risk description] | Low / Medium / High | Low / Medium / High | [Specific mitigation action] |

---

## Implementation Plan

### Phase 1 — [Name] (estimated: [N] days)
- [ ] [Task 1]
- [ ] [Task 2]

### Phase 2 — [Name] (estimated: [N] days)
- [ ] [Task 1]
- [ ] [Task 2]

### Phase 3 — [Name] (estimated: [N] days, if applicable)
- [ ] [Task 1]

**Total estimated effort:** [N] engineer-days

---

## Impact Assessment

### Performance
[Describe the expected performance impact: latency change, throughput change, memory change. Provide before/after estimates where possible.]

### Security
[Does this change the attack surface? Does it introduce new data flows? Does it require new IAM permissions or secrets?]

### Operability
[What new monitoring, alerting, or runbook entries are needed? Does this change the on-call burden?]

### Testing
[What new tests are needed? What existing tests will need to change? Is a load test required?]

### Documentation
[What documentation must be updated: API docs, CLAUDE.md, vault notes, runbooks?]

---

## Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| Q-1 | [Question] | [Name] | YYYY-MM-DD |
| Q-2 | [Question] | [Name] | YYYY-MM-DD |

---

## Decision

*This section is filled in by the Decision Owner after the review period closes.*

**Decision:** Accepted / Rejected / Accepted with Modifications

**Decision Date:** YYYY-MM-DD

**Rationale:** [2-4 sentences from the ED summarising the key factors that drove the decision.]

**Conditions / Modifications (if any):**
- [Any changes required before or during implementation]

**Next Step:** Create ADR-[NNN] and begin Phase 1.

---
---

## Example: RFC-004 — Adding Redis Caching for RUL Computation Results

### Header

| Field | Value |
|-------|-------|
| **RFC Number** | RFC-004 |
| **Title** | Adding Redis Caching for RUL Computation Results |
| **Status** | Accepted |
| **Author** | Sanjay Venkataraman |
| **Date** | 2026-06-10 |
| **Review Deadline** | 2026-06-17 |
| **Reviewers** | Priya Nambiar (EM), Rohan Desai (Senior Engineer), Aditya Shetty (DevOps) |
| **Decision Owner** | Kiran Menon (ED) |
| **Related ADR** | ADR-012 |

### Summary

This RFC proposes adding an in-process Redis cache (AWS ElastiCache) for Remaining Useful Life (RUL) computation results, keyed by `(tenant_id, asset_id, computation_date)`. The cache TTL is 24 hours, invalidated on new inspection record write. The motivation is that RUL recomputation for a tenant with 50,000 assets currently takes 8-12 seconds on the dashboard load path, which violates our P95 < 2s SLA target.

The key trade-off is operational complexity: we add a new managed AWS service, a new failure mode (cache unavailability), and a new invalidation bug class. This RFC asks reviewers to evaluate whether targeted query optimization is a sufficient alternative before we accept that complexity.

### Background and Motivation

#### Current State

The `GET /api/v1/rul/summary` endpoint calls `RulCalculatorService.ComputeAll(tenantId)`, which fetches every active asset for the tenant, joins to the most recent inspection record, and runs the Weibull-based RUL formula for each. For a DOT with 50,000 road segments, this generates a 3-table JOIN across 150,000 rows and runs 50,000 individual Weibull calculations in a single request.

#### Why This Cannot Continue

Current measured P95 for `GET /api/v1/rul/summary` on the MnDOT staging tenant (48,000 assets): **9.4 seconds**. Dashboard design target is a single page load under 2 seconds. We have already applied index tuning (two new composite indexes added in Sprint 12). The bottleneck is now pure computation, not I/O.

#### Constraints

- Must not require downtime to deploy.
- Must not violate multi-tenancy isolation — cache entries must never be visible cross-tenant.
- Must degrade gracefully: if Redis is unavailable, fall back to live computation with a warning log; do not surface a 500 to the user.
- Cache must be invalidated synchronously when a new inspection record is saved for an asset.

### Proposed Design

#### Overview

A new `IRulCacheService` interface is registered in DI. The `RulSummaryQueryHandler` checks the cache before running computation. Cache keys are namespaced by tenant. Invalidation is triggered in `InspectionRecordCreatedHandler`.

#### Code Example

```csharp
// Application/Caching/IRulCacheService.cs
public interface IRulCacheService
{
    Task<RulResult?> GetAsync(Guid tenantId, Guid assetId, DateOnly date, CancellationToken ct = default);
    Task SetAsync(Guid tenantId, Guid assetId, DateOnly date, RulResult value, CancellationToken ct = default);
    Task InvalidateAsync(Guid tenantId, Guid assetId, CancellationToken ct = default);
}

// Infrastructure/Caching/RedisRulCacheService.cs
public sealed class RedisRulCacheService : IRulCacheService
{
    private readonly IConnectionMultiplexer _redis;

    private static string Key(Guid tenantId, Guid assetId, DateOnly date)
        => $"rul:{tenantId}:{assetId}:{date:yyyy-MM-dd}";

    public async Task<RulResult?> GetAsync(Guid tenantId, Guid assetId, DateOnly date, CancellationToken ct)
    {
        var db = _redis.GetDatabase();
        var raw = await db.StringGetAsync(Key(tenantId, assetId, date));
        return raw.HasValue ? JsonSerializer.Deserialize<RulResult>(raw!) : null;
    }
    // Set and Invalidate follow the same pattern
}
```

### Alternatives Considered

#### Alternative A: Pre-computed materialized view in PostgreSQL

A PostgreSQL materialized view `rul_summary_mv` refreshed nightly by a pg_cron job.

**Pros:** No new infrastructure dependency. Consistent with existing DB-centric approach.

**Cons:** Materialized view is stale for up to 24 hours; unacceptable for the "just submitted an inspection" workflow.

**Why rejected:** Staleness window is unacceptable for interactive use.

#### Alternative B: Do Nothing / Further Index Optimization

Additional covering indexes and window-function query rewrites.

**Pros:** Zero new infrastructure.

**Cons:** Spike showed maximum improvement of ~40% (9.4s to ~5.6s). Still far above 2s target.

**Why rejected:** Insufficient improvement, confirmed by spike in Sprint 13.

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Redis unavailable during deployment or failure | Low | Medium | Fall back to live compute; log warning; alert on elevated P95 |
| Cache invalidation bug causes stale RUL shown | Medium | High | Integration test: write inspection, assert cache miss on next read |
| Cross-tenant cache leak | Low | Critical | Key namespace includes tenant_id; integration test validates isolation |
| Cache warming cold-start on first deploy | Medium | Low | Background warm-up job runs at deploy time for top 10 tenants by asset count |

### Decision

**Decision:** Accepted

**Decision Date:** 2026-06-18

**Rationale:** The performance gap (9.4s vs. 2s target) cannot be closed with query optimization alone. Redis is already approved on our AWS platform for other services, so the infrastructure precedent is set. The graceful degradation requirement and the cross-tenant key isolation requirement together address the critical risks. The team will implement with an integration test specifically asserting tenant isolation.

**Next Step:** Create ADR-012. Sanjay to begin Phase 1 in Sprint 14.
