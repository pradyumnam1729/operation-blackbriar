# Technical Architect

## Mission

The Technical Architect makes and documents the architectural decisions that shape how the Maintain platform is built, ensuring those decisions are consistent, coherent, well-reasoned, and durable. In an AI-native engineering organization, the Architect's most critical function shifts from writing architecture documents that humans read to writing ADRs that AI agents can follow.

An ADR that a human can read and understand is a good ADR. An ADR that an AI agent can read and use to constrain code generation — clear enough, specific enough, machine-parseable enough — is a great ADR. In an AI-native org, the quality of architectural guidance is measured partly by how well it constrains AI agent behavior, not just human behavior.

---

## Responsibilities

### Architectural Decision Making

Draft, review, and publish Architecture Decision Records (ADRs) for every significant technical decision. An ADR is required whenever a decision:
- Affects the public API surface (endpoints, DTOs, versioning)
- Changes the data model in a way that affects multiple features
- Introduces a new external dependency or integration
- Changes a cross-cutting concern (authentication, multi-tenancy, caching, logging)
- Introduces a new pattern that should be followed consistently across the codebase

The ADR format must be followed consistently: Context, Decision, Consequences (positive and negative), and Alternatives Considered. ADRs are stored in `vault/decisions/` and are the authoritative record of architectural choices.

### Clean Architecture Enforcement

Maintain is built on Clean Architecture (Api / Application / Domain / Infrastructure layers). The Architect defines the rules for each layer and ensures they are enforced by automated tooling (architecture unit tests using NetArchTest) and by code review.

The rules:
- Domain layer: no external dependencies, no EF Core references, pure C# business logic and value objects
- Application layer: depends on Domain only, no Infrastructure concerns, no HTTP concerns
- Infrastructure layer: implements Application interfaces, owns EF Core, owns external client implementations
- API layer: thin controllers, DTOs only, delegates to Application layer immediately

In an AI-native team, the Architect proactively adds test assertions for these rules to the unit test suite, so that AI-generated code that violates them fails CI automatically.

### Technology Evaluation

When a new technology choice is required (a new library, a new AWS service, a new testing tool), the Architect leads the evaluation. This includes: researching options (AI-accelerated), defining evaluation criteria, running a time-boxed proof-of-concept, and producing an ADR with the recommendation and rationale.

Technology evaluations are not done unilaterally. The Architect consults the relevant lead (Backend Lead for .NET libraries, DevOps for infrastructure components) and produces a recommendation that the ED approves.

### Cross-Cutting Concern Ownership

The Architect owns the design of all cross-cutting concerns:
- Multi-tenancy implementation (EF Core global query filters, tenant ID propagation)
- Authentication and authorization (JWT claim shapes, policy-based authorization)
- Audit logging (EF SaveChangesInterceptor, audit log schema)
- Error handling and problem details (RFC 7807 standard error format)
- Caching strategy (in-memory vs. distributed, cache key conventions)
- Soft delete and temporal data patterns

These patterns are documented in the playbook and in the codebase (as base classes, interfaces, and extension methods that AI agents are expected to use rather than reinvent).

### AI Agent Constraint Documentation

Specifically for the AI-native context: the Architect maintains a set of "agent constraints" documents that describe patterns that AI agents must follow when generating code for this codebase. These are distinct from ADRs (which record decisions) — they are operational guides for code generation.

Examples:
- "When generating an EF Core query handler, always include `AsNoTracking()` for read-only queries and always filter by `TenantId` before any other predicate."
- "All new database tables must include `Id (uuid)`, `TenantId (uuid)`, `CreatedAt (timestamptz)`, `UpdatedAt (timestamptz)` columns."
- "Command handlers must not contain business logic. Business logic belongs in domain entities or domain services."

These constraint documents are referenced in the system prompt for the AI code generation agent. Their quality directly determines whether AI-generated code requires architectural rework.

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| ADR Currency | Every significant decision has an ADR within 5 business days | Monthly audit |
| Architecture Violation Rate | < 2 violations per 100 AI-generated PRs | Per sprint |
| Architectural Test Coverage | 100% of layer boundary rules have automated test assertions | Continuous |
| Tech Debt from Architecture Violations | < 5 violations accumulating in the backlog at any time | Weekly |
| ADR Agent Compliance Score | % of AI PRs that correctly follow ADR patterns without human correction | Quarterly |
| Cross-Cutting Concern Test Coverage | 100% of cross-cutting concerns (multi-tenancy, audit log, error format) have integration tests | Continuous |

---

## Authority

The Architect has authority to:
- Block a PR that violates an existing ADR
- Require a new ADR before implementing a decision that falls in ADR scope
- Mandate refactoring of a pattern violation before further development builds on it
- Define the system prompt content that constrains AI code generation agents

The Architect does not have authority to:
- Make product scope decisions
- Override the ED on team structure or delivery commitments
- Deploy to production (that is DevOps authority)

---

## Deliverables

**Per ADR**: Context, decision, consequences, alternatives, and the agent-facing constraints derived from the decision

**Weekly**: Architecture review notes (patterns observed in the week's PRs, emerging concerns)

**Monthly**: Technical health report: ADR coverage audit, architecture violation trend, agent constraint effectiveness assessment

**Quarterly**: Technology landscape review (are any stack choices due for reconsideration?), cross-cutting concern health audit

---

## Decision Making

The Architect uses a structured approach to evaluating technical choices:

1. **Fitness for purpose**: Does this technology do what we need?
2. **Ecosystem health**: Is the library/framework actively maintained? Does it have strong community support?
3. **Team capability**: Can the team (humans and AI agents) use this effectively?
4. **Agent-legibility**: Can AI agents generate code that correctly uses this technology? Technologies with complex or idiomatic usage patterns that AI agents frequently get wrong are a higher cost than their feature value suggests.
5. **Lock-in risk**: If we need to replace this in 3 years, how hard is it?

---

## Daily Workflow

**08:00–08:30** — Review overnight CI architecture test results. Any new violations? Any patterns in what AI agents are getting wrong?

**08:30–09:30** — PR review: focused on architectural patterns, not code details. Does this PR follow the ADR for its feature area? Does it use the correct base classes and cross-cutting patterns? Flag violations with specific ADR citations.

**09:30–11:00** — Active architecture work: drafting new ADRs, updating agent constraint documents, designing new patterns for upcoming features.

**11:00–12:00** — Consultation time: available for Backend Lead, Frontend Lead, DevOps to ask architecture questions. These conversations often surface the need for a new ADR or a pattern clarification.

**14:00–16:00** — Research and evaluation: technology evaluation, reading FHWA technical guidance (to understand domain constraints that affect architecture), reviewing peer open-source projects for pattern ideas.

**16:00–17:00** — Documentation: capturing decisions, updating the vault, ensuring the agent constraint documents reflect the day's decisions.

---

## Collaboration

**With Backend Lead**: Daily partner on .NET-specific architecture questions. The Architect designs the patterns; the Backend Lead implements them in the base classes and extension methods that engineers use. When AI-generated code violates patterns, they jointly investigate whether the constraint document needs improvement or the AI generation prompt needs adjustment.

**With Frontend Lead**: Same partnership for the React/TypeScript architecture. Particularly relevant for: TanStack Query patterns, component library conventions, type safety conventions for the generated API client.

**With DevOps Engineer**: Design of the deployment architecture, infrastructure-as-code patterns, environment configuration conventions.

**With Lifecycle Domain Expert**: Validation that the domain model accurately represents infrastructure asset management concepts. The Architect proposes the data model; the domain expert validates that it captures real-world semantics correctly.

---

## Escalation

The Architect escalates to the ED when:
- A significant architectural violation is blocking a sprint delivery
- A technology evaluation produces a recommendation that requires a significant investment
- An ADR is needed for a decision where consensus cannot be reached between leads

---

## Continuous Improvement

Monthly: review the agent constraint documents against the actual violations found in AI-generated code. If AI agents are consistently making the same mistake, the constraint document isn't clear enough — rewrite it.

Quarterly: run an ADR audit. For every significant architectural pattern in the codebase, is there a corresponding ADR? If not, write a retroactive ADR. Gaps create risk: when the engineer who made the decision leaves, the reasoning is lost.

---

## Example Scenarios

### Scenario 1: AI Agent Consistently Generates N+1 Queries

The Backend Lead reports that AI-generated query handlers frequently produce N+1 queries — they iterate a list and call the database inside the loop rather than using Include() or a batch query. This is causing performance issues in integration tests.

The Architect investigates the agent constraint document. It says "use EF Core efficiently" — far too vague for an AI agent to act on. The Architect rewrites the constraint as explicit rules with code examples:

"When loading a collection with related data: (1) Use `.Include()` to load related entities in a single query. (2) Never load a collection and then loop over it issuing per-item queries. (3) When you need aggregates, use `.GroupBy()` at the database level, not in-memory. Example of N+1 to avoid: [code example]. Example of correct approach: [code example]."

After the constraint document update, the N+1 violation rate drops from 8 per sprint to 0.

### Scenario 2: New Feature Requires a Cross-Cutting Cache Layer

The capital plan optimization feature will be computationally expensive. Product wants sub-second response times for re-running the optimization. The Architect needs to design a caching strategy.

The Architect evaluates options: in-memory cache (fast but not distributed, issues in multi-instance deployments), Redis (distributed, reliable), and materialized calculation results in the database (persistent, queryable). After a time-boxed evaluation, Redis wins for the optimization result cache.

The Architect drafts an ADR: context (optimization is expensive, sub-second response time required), decision (Redis cache for optimization results with a 1-hour TTL, cache invalidated on capital plan changes), consequences (requires Redis in the infrastructure stack), alternatives considered (in-memory rejected due to multi-instance concerns; DB materialization rejected due to schema coupling).

The ADR also updates the agent constraint documents: "Capital plan optimization results are cached in Redis. Do not call the optimizer directly from a controller. Always check the cache first and invalidate on plan changes."

### Scenario 3: Evaluating a New AI Framework for Backend AI Features

The AI Engineer proposes using a new AI framework (Microsoft.Extensions.AI) to unify AI service calls in the backend. The Architect leads the evaluation.

Evaluation criteria: (1) Is it production-stable? Check GitHub release history and NuGet download counts. (2) Does it work well with our existing DI container? Quick proof-of-concept in a branch. (3) Can AI agents generate correct code with it? Test by asking Claude to generate a service using the framework and see if the output is correct without coaching.

The evaluation takes 3 days. The Architect produces an ADR with the recommendation (adopt with specific usage constraints), registers the decision, and adds an agent constraint document for the framework's usage patterns.
