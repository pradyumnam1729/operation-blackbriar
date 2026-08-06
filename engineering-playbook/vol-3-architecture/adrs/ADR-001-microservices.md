# ADR-001 — Deploy Maintain as a Single Service with a Defined Microservices Decomposition Path

**Status:** Accepted  
**Date:** 2024-Q4  
**Deciders:** CTO, Principal Architect, Engineering Director  

---

## Context

When designing the initial architecture for Aurigo Maintain, the team faced a fundamental question: should we start with a microservices architecture, or deploy as a single service?

The microservices pattern had genuine appeal. It promises: independent deployment of components, independent scaling, technology heterogeneity, and clear bounded context boundaries. The Aurigo Platform already has multiple services (DocMgmt, Workflow, Notifications, Essentials), so there was organizational familiarity with operating services independently.

However, several forces pushed back against immediate decomposition:

**Domain boundaries are not proven.** Maintain is a new product. We know roughly where the boundaries are (Asset Registry, Inspections, Capital Planning, Work Orders, Integration, Reporting, AI/ML), but we have not implemented all of them. Domain boundaries discovered through implementation are often different from boundaries drawn on a whiteboard. If we commit to service boundaries before implementation, we risk the most expensive form of technical debt: distributed systems coupling.

**The team is small.** Operating 8+ microservices requires significant operational investment: separate CI/CD pipelines, separate deployment configurations, separate monitoring, separate database instances, service discovery, distributed tracing, network policies, and inter-service authentication. For a team of 2–6 engineers, this overhead would consume the majority of engineering capacity before any domain code was written.

**The customer base is not yet established.** We don't know the scale of the first customers. If the first customer has 5,000 assets and 3 concurrent users, the overhead of a 8-service deployment is pure waste. If the second customer has 500,000 assets and 200 concurrent users, we need different infrastructure. Starting with a single service gives us the data to make correct scaling decisions.

**AWS operational complexity.** Each additional microservice requires: an ECS service, a task definition, an RDS instance (for data isolation), security groups, IAM roles, service discovery records, CloudWatch log groups, and alert configurations. Multiplying this by 8 services in the first sprint is premature.

---

## Decision

**We deploy Aurigo Maintain as a single deployable service for the MVP and initial GA release.** The internal structure uses Clean Architecture with strict module boundaries that mirror the eventual microservice boundaries. Domain events are used for cross-module communication (even within the single process) to ensure that the coupling patterns needed for future extraction are already in place.

**The decomposition trigger is explicit:** when a single bounded context requires independent scaling, a different deployment cadence, or a different technology stack than the rest of the service, that context is extracted into an independent microservice. This trigger must be agreed upon by the Technical Architect and Engineering Director before extraction begins.

**The first candidate for extraction** is the AI/ML Service. It already has a distinct technology profile (may require GPU instances for model training, Python for ML frameworks), independent scaling requirements (model training is batch and compute-intensive while predictions need < 200ms latency), and a deployment cadence that may differ from the core service (models are retrained on a schedule, not on every code deploy).

**The second candidate** is the Reporting Service. Report generation is CPU-intensive and bursty (triggered by user action, not continuous). Extracting it would allow the core service to remain responsive during heavy report generation without requiring that the entire service be scaled up.

---

## Consequences

### Positive
- Operational simplicity for the first 12–18 months: one pipeline, one database, one ECS service, one log group.
- Faster development velocity: engineers work in a single repository with a single build, without needing to understand inter-service contracts for initial feature development.
- Internal module boundaries can be refined without the cost of changing service APIs.
- Real-world usage data informs which modules actually need independent scaling before we commit to extracting them.
- Fewer failure modes: no network partitions between modules, no service discovery issues, no distributed transaction problems.

### Negative / Trade-offs
- All modules scale together. If Capital Planning needs more CPU for a large RUL recalculation job, the entire service scales — even if Asset Registry doesn't need it. At small and medium scale, this is acceptable.
- Module isolation is enforced by convention (code review, architecture review), not by physical service boundaries. An engineer can write a handler that directly calls an EF query for a different domain's entities — this must be caught in code review.
- As the service grows, the single deployment artifact becomes larger. Build times may increase. CI pipeline time may increase.

### Neutral
- The event-driven patterns (domain events, EventBridge, SQS) are put in place from the start. When microservices are extracted, the event infrastructure is already there.
- The service exposes the same API whether deployed as a monolith or as multiple services — the Aurigo API Gateway routes to `/api/asset-maintenance/v1/...` regardless.

---

## Alternatives Considered

### Option A: Microservices from Day One

Extract all 8 bounded contexts into separate services at the start.

**Rejected because:** The operational overhead would consume the team's capacity before meaningful domain code was delivered. Domain boundaries would be guesses, not evidence-based. The first 6 months of the project would be spent on Kubernetes/ECS configuration, inter-service authentication, and distributed tracing setup rather than delivering asset management capabilities. We would also lock in boundaries before implementation revealed their correctness.

### Option B: Two Services (Core + AI)

Deploy the core domain (Asset Registry, Inspections, Capital Planning, Work Orders) as one service, and the AI/ML capabilities as a separate service from day one.

**Deferred, not rejected:** This decomposition makes sense eventually (AI/ML has a clearly different technology and deployment profile), but doing it on day one adds complexity before the AI capabilities are proven. The AI features are stubs in MVP. We will revisit this split when the AI features are production-ready. See the "first candidate for extraction" note above.

### Option C: Lambda Functions per Operation

Use AWS Lambda as the compute layer — one Lambda function per API handler. Extreme decomposition.

**Rejected because:** Lambda cold starts are unacceptable for the < 200ms latency target on read operations. Lambda function limits (15 minutes, 10 GB memory, 6 MB response payload) are problematic for report generation. The operational overhead of managing 50+ Lambda functions with separate IAM roles, CloudWatch log groups, and deployment configurations is worse than microservices. Lambda is appropriate for event consumers (lightweight transformations), not for the core synchronous API.

---

## References

- Sam Newman, "Building Microservices" — Chapter 3: How to Model Services (domain-based decomposition)
- Martin Fowler, "MonolithFirst" — https://martinfowler.com/bliki/MonolithFirst.html
- [05 — Microservices](../05-microservices.md) — target service topology and decomposition plan
