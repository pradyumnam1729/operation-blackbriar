# Architecture Decision Records

> Volume 3 · Architecture · ADRs

Architecture Decision Records (ADRs) are short documents that capture a significant architectural decision made during the design and development of Aurigo Maintain. They answer the question that haunts every engineering team: "Why does this work the way it does?" Without ADRs, that knowledge lives in the heads of the engineers who made the decision — and leaves with them.

---

## What is an ADR?

An ADR documents:
1. The **context** — what problem were we solving? What constraints applied?
2. The **decision** — what did we choose?
3. The **consequences** — what does this decision make easier, harder, or impossible?
4. The **alternatives considered** — what else did we evaluate, and why did we reject it?
5. The **status** — is this decision still in force, or has it been superseded?

ADRs are intentionally short. The target is 500–800 words, not a treatise. The goal is to give a future engineer enough context to understand the decision in 5 minutes.

---

## When to Write an ADR

Write an ADR when the decision:
- Involves a technology choice that will be difficult to reverse (database, framework, cloud service, auth mechanism)
- Establishes a pattern applied across the whole codebase (Clean Architecture, CQRS, global query filters)
- Overturns a previous approach (if you're reversing a previous decision, document why)
- Was debated in a design review — if it was worth arguing about, it's worth documenting
- Will confuse a future engineer who doesn't know why it was done this way

Do NOT write an ADR for:
- Routine implementation choices that are obvious from the code
- Preferences (code style) that are handled by automated linting
- Decisions that will be reversed in the same sprint

**Rule of thumb:** If someone asks "why is it done this way?" in a code review and the answer takes more than 2 sentences, an ADR should exist.

---

## Who Writes ADRs

Any engineer can propose an ADR. The Technical Architect reviews and approves. For cross-cutting decisions (auth strategy, database choice, event architecture), the Engineering Director and CTO are consulted before the ADR is accepted.

Process:
1. Engineer drafts the ADR as a PR, using the template below.
2. The PR description notes: "This is a proposed ADR — seeking review before implementation."
3. Team reviews the ADR in the PR. Discussion happens in PR comments.
4. Technical Architect approves (or requests changes).
5. PR is merged with status "Accepted."
6. Implementation begins after the ADR is merged (not before).

For time-sensitive decisions, steps 1–4 can happen asynchronously in a single working day. Do not let the ADR process become a blocker.

---

## ADR Lifecycle

| Status | Meaning |
|---|---|
| **Proposed** | Under discussion. Implementation has not started. |
| **Accepted** | Decision is in force. Implementation may proceed. |
| **Superseded** | This decision has been replaced by a newer ADR. Link to the superseding ADR. |
| **Deprecated** | The decision is no longer relevant (e.g., the feature was removed). |

When an ADR is superseded, update the status and add a link: `Superseded by [ADR-012 — New Auth Strategy](./ADR-012-new-auth-strategy.md)`. Do not delete superseded ADRs — they explain the history of why the system is the way it is.

---

## ADR Template

```markdown
# ADR-XXX — [Short Title]

**Status:** Proposed / Accepted / Superseded / Deprecated  
**Date:** YYYY-MM-DD  
**Deciders:** [Names or roles — who was in the room]  
**Supersedes:** [ADR-YYY if this replaces a previous decision]

## Context

[What is the problem we are solving? What constraints apply? What forces are at play?
Be specific about the requirements that drove this decision.]

## Decision

[What did we decide? State it clearly in one sentence, then explain.]

## Consequences

### Positive
- [What becomes easier?]

### Negative / Trade-offs
- [What becomes harder? What do we give up?]

### Neutral
- [What changes without being clearly good or bad?]

## Alternatives Considered

### Option A: [Name]
[What was this alternative? Why did we reject it?]

### Option B: [Name]
[What was this alternative? Why did we reject it?]

## References
- [Links to relevant documentation, articles, or prior art]
```

---

## Existing ADRs

| ADR | Title | Status |
|---|---|---|
| [ADR-001](./ADR-001-microservices.md) | Deploy as single service with defined decomposition path | Accepted |
| [ADR-002](./ADR-002-database-strategy.md) | PostgreSQL 16 + PostGIS 3.4 as primary database | Accepted |
| [ADR-003](./ADR-003-api-strategy.md) | REST as primary API style; GraphQL deferred | Accepted |
| [ADR-004](./ADR-004-event-architecture.md) | AWS EventBridge + SQS for async event processing | Accepted |
| [ADR-005](./ADR-005-auth-strategy.md) | Reuse Aurigo lambda-authorizer JWT claim shape | Accepted |

---

_See also: [15 — Documentation Standards](../15-documentation-standards.md) for the broader documentation philosophy._
