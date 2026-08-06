# Volume 3 — Architecture

> Engineering Playbook · Volume 3 of 10

This volume is the authoritative technical reference for every engineer working on Aurigo Maintain (and, by extension, any service on the Aurigo Infrastructure Lifecycle Platform). It covers two broad areas: **standards** (how we write code, design APIs, model data, and structure directories) and **quality processes** (how we test, ship, monitor, and define completion). Read it when you are starting a new feature, reviewing a pull request, or making a decision that will outlast the current sprint.

---

## Structure of This Volume

### Coding & Architecture Standards

| Document | Description |
|---|---|
| [01 — Coding Standards](./01-coding-standards.md) | Authoritative C# / .NET and TypeScript / React coding rules with correct and incorrect examples |
| [02 — Folder Standards](./02-folder-standards.md) | Directory layout for backend (Clean Architecture) and frontend (Vite/React) with rationale |
| [03 — API Standards](./03-api-standards.md) | REST design rules, HTTP status codes, error format, versioning, controller patterns, OpenAPI |
| [04 — Database Standards](./04-database-standards.md) | PostgreSQL schema design, EF Core patterns, migration workflow, query performance rules |
| [05 — Microservices](./05-microservices.md) | Current monolith-to-microservices strategy, service boundary definitions, communication patterns |
| [06 — Events](./06-events.md) | Event-driven architecture, event schema, AWS EventBridge/SQS patterns, key domain events |
| [07 — Security](./07-security.md) | Authentication, input validation, injection prevention, secrets management, HTTPS, audit log |
| [08 — Authorization](./08-authorization.md) | Role hierarchy, permission matrix, row-level security, frontend authorization patterns |

### Performance, Scalability, and Observability

| Document | Description |
|---|---|
| [09 — Performance](./09-performance.md) | API, frontend, database, and map performance targets and optimization techniques |
| [10 — Scalability](./10-scalability.md) | Horizontal scaling, multi-tenant isolation at scale, database scaling, event processing scale |
| [11 — Logging](./11-logging.md) | Serilog structured logging, required properties, log levels, sensitive data handling |
| [12 — Observability](./12-observability.md) | Metrics, traces, alerting, CloudWatch dashboards, health checks |

### Quality Processes

| Document | Description |
|---|---|
| [13 — Testing](./13-testing.md) | Testing pyramid, unit/integration/E2E strategy, test data management, full worked examples |
| [14 — CI/CD](./14-cicd.md) | GitHub Actions workflows, environment strategy, rollback, secrets in CI |
| [15 — Documentation Standards](./15-documentation-standards.md) | Code comments, API docs, architecture docs, runbooks, anti-patterns |
| [16 — Definition of Done](./16-definition-of-done.md) | The quality gate every user story must pass before it is considered complete |

### Architecture Decision Records

| Document | Description |
|---|---|
| [ADRs — README](./adrs/README.md) | ADR process: when to write one, who reviews, how superseded ADRs are marked |
| [ADR-001 — Microservices](./adrs/ADR-001-microservices.md) | Deploy as a single service with a defined decomposition path |
| [ADR-002 — Database Strategy](./adrs/ADR-002-database-strategy.md) | PostgreSQL 16 + PostGIS 3.4 as the primary database |
| [ADR-003 — API Strategy](./adrs/ADR-003-api-strategy.md) | REST as primary API style; GraphQL deferred |
| [ADR-004 — Event Architecture](./adrs/ADR-004-event-architecture.md) | AWS EventBridge + SQS for async event processing |
| [ADR-005 — Auth Strategy](./adrs/ADR-005-auth-strategy.md) | Reuse Aurigo lambda-authorizer JWT claim shape |

---

## How to Use This Volume

**Starting a new feature?** Read [02 — Folder Standards](./02-folder-standards.md) to know where files go, [01 — Coding Standards](./01-coding-standards.md) for language-level rules, and [03 — API Standards](./03-api-standards.md) if you are designing a new endpoint.

**Reviewing a pull request?** Use [16 — Definition of Done](./16-definition-of-done.md) as your checklist. Check [01 — Coding Standards](./01-coding-standards.md) for specific code-level feedback phrasing.

**Making an architectural decision?** Read [ADRs — README](./adrs/README.md) first. Review existing ADRs to avoid overturning locked choices. Write a new ADR if your decision will outlast the sprint.

**Debugging a production issue?** Start with [12 — Observability](./12-observability.md) for where to look, [11 — Logging](./11-logging.md) for what should have been logged, and [09 — Performance](./09-performance.md) for how to diagnose slow queries.

**Designing for scale?** Read [10 — Scalability](./10-scalability.md) and [05 — Microservices](./05-microservices.md) together.

---

## Maintenance

This volume is version-controlled in the main repository. Every time an architectural decision is made, an ADR is written and the relevant standard documents are updated. PRs that change architecture must include documentation updates — this is a hard requirement in [16 — Definition of Done](./16-definition-of-done.md).

Owners: Technical Architect + Backend Lead (backend/database/API standards), Frontend Lead (TypeScript/React standards), DevOps Engineer (CI/CD, observability). The Engineering Director has final authority on all standards.

---

_Volume 3 of 10 · Aurigo Engineering Playbook · Last updated: 2026-07-18_
