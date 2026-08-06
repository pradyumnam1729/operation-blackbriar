# ADR-003 — REST as Primary API Style; GraphQL Deferred

**Status:** Accepted  
**Date:** 2024-Q4  
**Deciders:** Principal Architect, Frontend Lead  

---

## Context

The Aurigo Maintain API must serve three distinct consumers:
1. The Maintain web application (React/TypeScript)
2. Mobile applications (field inspector app)
3. EAM integrations (IBM Maximo, SAP EAM, Oracle EAM, Cityworks — all external systems)

Each consumer has different access patterns, different data requirements, and different technical constraints.

The choice of API style affects:
- **Developer experience** — how easy is it to understand, consume, and evolve the API?
- **Tooling** — what code generation, documentation, and testing tools are available?
- **Over-fetching/under-fetching** — does the client get exactly the data it needs, or does it get too much or too little?
- **Caching** — how easily can HTTP caching be applied?
- **EAM integration compatibility** — can all the EAM systems we need to integrate with consume the API?

---

## Decision

**We use REST as the primary API style for all Aurigo Maintain APIs.** The API follows the standards defined in [03 — API Standards](../03-api-standards.md): versioned at `/api/v1/`, resource-oriented URLs, standard HTTP methods and status codes, RFC 7807 error responses, and pagination.

**GraphQL is deferred.** It is not rejected permanently, but it will not be implemented in MVP or initial GA. The decision to adopt GraphQL will be revisited when the conditions described in the "When to Revisit GraphQL" section below are met.

---

## Consequences

### Positive
- **Simplicity.** REST is understood by every HTTP client library, every EAM system's integration team, and every developer on the team. No new concepts to learn.
- **HTTP caching.** GET requests are cacheable at the CDN (CloudFront), browser, and TanStack Query levels. This is straightforward with REST. GraphQL uses POST for queries, bypassing HTTP caching.
- **Swagger/OpenAPI tooling.** The TypeScript client is generated automatically from the OpenAPI spec via `npm run gen:api`. This is mature, well-supported tooling. GraphQL has code generation (graphql-codegen), but it's an additional layer to configure and maintain.
- **EAM integration compatibility.** Every EAM system that Aurigo will integrate with (Maximo, SAP, Cityworks, Infor) exposes and consumes REST APIs. Their integration teams are fluent in REST.
- **Standard error handling.** RFC 7807 problem details provide a consistent error format. Every consumer handles errors the same way.
- **Versioning is straightforward.** `/api/v1/` prefix for the entire API. When breaking changes are needed, `/api/v2/` is introduced. GraphQL's versioning strategy is more complex (schema evolution, deprecation at the field level).

### Negative / Trade-offs
- **Over-fetching on complex views.** The dashboard page may need data from assets, inspections, capital needs, and risk scores. With REST, this requires multiple API calls or a custom aggregation endpoint. With GraphQL, a single query fetches exactly what's needed.
- **Under-fetching on detail views.** The asset detail page may need the asset, its inspection history, its capital needs, and its RUL score. REST requires either multiple calls (waterfall), or a custom fat endpoint that returns all of this together. Neither is ideal.
- **N+1 at the API layer.** The frontend may make multiple sequential requests when one flexible query would suffice. We mitigate this by designing richer endpoints for common UI patterns (the asset detail endpoint includes related data) and by using TanStack Query for request deduplication and caching.

### Neutral
- REST and GraphQL can coexist if we choose to add GraphQL later. The REST API does not need to be dismantled; GraphQL can be added as an additional layer on top of the same handlers.

---

## Alternatives Considered

### Option A: GraphQL from Day One

Implement a GraphQL API alongside or instead of REST.

**Deferred because:**
1. **Operational complexity.** GraphQL requires a schema, resolvers, dataloader for N+1 prevention, and authorization at the field level (not just the endpoint level). This is significant additional infrastructure for an MVP.
2. **EAM integration.** EAM systems do not consume GraphQL. Any EAM integration connector would need to be wrapped to translate GraphQL to the EAM's expected REST/SOAP format. REST-to-REST is simpler.
3. **Team familiarity.** REST is universally understood. GraphQL requires schema design skills and resolver implementation knowledge. Training the team takes time.
4. **Over-fetching in our domain is manageable.** The asset management domain does not have the complex, highly variable query patterns that make GraphQL compelling (those tend to arise in social graph applications, e-commerce, and public APIs with many third-party consumers). Our frontend components have relatively predictable data requirements.

### Option B: gRPC

Binary protocol, strong typing, efficient for service-to-service communication.

**Rejected for client-facing API because:**
1. **Browser compatibility.** gRPC-Web requires a special proxy (Envoy). Direct browser gRPC is not universally supported.
2. **EAM integration.** EAM systems speak REST/SOAP, not gRPC.
3. **Tooling.** The REST/OpenAPI ecosystem (Swagger UI, client generation, Postman) is more mature and accessible.

gRPC remains a valid choice for **internal service-to-service communication** in the future microservices architecture, where browser compatibility is not a concern and efficient binary serialization matters.

### Option C: REST + GraphQL (Dual API)

Expose both REST (for EAM integrations and external consumers) and GraphQL (for the web frontend).

**Deferred for the same reasons as Option A.** The frontend's current data requirements do not justify the complexity of maintaining two API styles. We will reconsider when the frontend team encounters concrete, recurring over-fetching problems that cannot be solved with richer REST endpoints or endpoint composition.

---

## When to Revisit GraphQL

The decision to add GraphQL should be revisited when **two or more** of the following conditions are true:

1. **The frontend team is consistently building custom aggregation endpoints** for dashboard and detail views — endpoints that exist only because the standard resource endpoints don't return enough data in one call.
2. **Mobile bandwidth optimization becomes a customer complaint.** Field inspectors in rural areas with 2G/3G connections are downloading significantly more data than they need.
3. **Third-party developers are building applications on the Maintain API**, and they have highly variable, unpredictable query patterns that REST endpoints cannot efficiently serve.
4. **The frontend team grows to > 3 engineers**, each building different views with very different data needs.

If these conditions are met, the recommendation is to add a GraphQL layer on top of the existing MediatR handlers — not to replace the REST API. The REST API remains for EAM integrations and external consumers.

---

## References

- [03 — API Standards](../03-api-standards.md) — REST design rules and controller patterns
- Roy Fielding, "Architectural Styles and the Design of Network-based Software Architectures" (REST dissertation)
- Principled GraphQL: https://principledgraphql.com
