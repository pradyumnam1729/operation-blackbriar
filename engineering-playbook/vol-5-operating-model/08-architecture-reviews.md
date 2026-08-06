# 08 — Architecture Reviews

Architecture reviews exist to protect the integrity of the system over time. Without them, every engineer makes local decisions that are individually reasonable but collectively create an inconsistent, hard-to-maintain system. Architecture reviews are not bureaucratic gatekeeping — they are the mechanism by which the team's collective judgment is applied to decisions that affect everyone.

This document covers when reviews are required, the RFC process, required content, participants, the role of AI agents, and what happens when a review is skipped.

---

## When an Architecture Review Is Required

An architecture review is required for any change that meets one or more of the following triggers:

**Trigger 1: New aggregate root entity**
Adding a new entity that is an aggregate root (not a child of an existing aggregate) affects the domain model, the database schema, the API surface, and multi-tenancy. These are not routine changes.

**Trigger 2: New external service dependency**
Adding a dependency on any service outside the application boundary: a new third-party API, a new AWS service, a new database (even if it's Postgres), a new message queue. This includes adding a new stubbed `I[Service]Client` if it represents a real planned integration.

**Trigger 3: Change to multi-tenancy strategy**
Any change to how tenant scoping works: modifying the global query filter, changing how tenant ID is extracted from the JWT, adding a bypass for cross-tenant queries. This is the highest-risk category — errors create data leakage.

**Trigger 4: New authentication or authorization mechanism**
Adding a new JWT claim, a new role, a new policy, or any change to how permissions are checked. Includes adding `[AllowAnonymous]` to any endpoint.

**Trigger 5: New cross-cutting concern**
Adding a new MediatR pipeline behavior, a new ASP.NET middleware, a new EF interceptor, a new background service. These affect all requests or all entities, not just the feature being implemented.

**Trigger 6: Change to the EF Core setup**
Modifying DbContext inheritance, changing how `ApplyConfigurationsFromAssembly` works, changing the database provider, adding a new owned entity type pattern.

**Trigger 7: New calculation methodology**
Any change to how RUL, ARV, or Risk Score is calculated must be reviewed against `vault/calculations/` documentation. Calculation engines affect compliance outputs (TAMP reports) and capital planning decisions.

**Trigger 8: Performance-motivated schema change**
Adding or removing a column, changing a column type for performance reasons, denormalizing a table, or adding a materialized view. These changes are often irreversible and affect multiple consumers.

---

## The Decision Tree: Does This Change Require a Review?

```
Does your change introduce or modify any of the following?
  ├── New entity that is an aggregate root → YES
  ├── New external API or service call → YES
  ├── Change to tenant ID extraction or global query filter → YES
  ├── New JWT claim, role, or authorization policy → YES
  ├── New MediatR behavior, middleware, or EF interceptor → YES
  ├── Change to calculation formula (RUL, ARV, Risk) → YES
  ├── Schema change motivated by performance (not feature) → YES
  └── None of the above → No review required
          └── But still follow code review (document 09)
```

When in doubt, ask the lead engineer. The cost of an unnecessary review is 30 minutes. The cost of a skipped review that should have happened is measured in weeks of refactoring or, in the worst case, a security incident.

---

## The RFC Process

RFC stands for Request for Comments. It is a structured proposal document that captures the architectural decision being made, the alternatives considered, and the rationale for the chosen approach.

**Step 1: Author Writes the RFC**

The engineer proposing the change writes the RFC using the template in the next section. The RFC must be written before any implementation begins — not as documentation of a decision already made.

**Step 2: RFC is Posted for Async Review (3-Day Window)**

The RFC is shared in the team's engineering channel. All relevant engineers have 3 business days to review and comment asynchronously. Reviewers use written comments — no verbal-only feedback.

Review feedback categories:
- **Approve**: "I support this approach as written"
- **Approve with conditions**: "I support this approach if [specific change] is made before implementation"
- **Concern**: "I have a concern about [aspect], here is my reasoning. I am not blocking but want this addressed."
- **Block**: "I believe this approach has a fundamental problem: [clear statement]. We should not proceed until this is resolved."

**Step 3: Meeting if Needed**

If there is a Block or unresolved Concerns after the async review period, a 60-minute synchronous meeting is scheduled. The meeting's purpose is to reach a decision — not to re-read the RFC aloud.

A meeting is explicitly NOT needed if:
- All reviewers have approved (or approved with conditions that have been addressed)
- The RFC has no blocks or concerns

**Step 4: ADR Creation**

Once the RFC is approved (with or without conditions), the lead engineer creates an ADR (Architecture Decision Record) in `engineering-playbook/vol-3-architecture/adrs/`. The ADR format is defined in Volume 3.

The RFC is linked from the ADR. The ADR is the permanent record; the RFC is the decision-making artifact.

---

## RFC Required Content

An RFC must contain all of the following sections. Missing sections are grounds for rejection.

**Title**: Short, specific. `RFC-[NN]: [What is being decided]`

**Status**: Draft | Under Review | Approved | Rejected | Superseded

**Author and Date**

**Problem Statement**
What problem are we solving? What is the business or technical driver? Why now? (2–4 paragraphs)

**Constraints**
What constraints limit our solution space? Examples: must use EF Core (not raw SQL), must maintain multi-tenancy, must not break existing API consumers, must complete within one sprint.

**Proposed Solution**
The recommended approach in enough detail that an engineer could implement it from this document. Include:
- High-level architecture change
- Data model changes (if any)
- API changes (if any)
- Impact on existing code

**Alternatives Considered**
At least two alternatives must be documented with their trade-offs. If only one option was ever considered, the RFC is not complete.

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|

**Risks and Mitigations**
What could go wrong? For each risk: likelihood, severity, mitigation action.

**Implementation Plan**
Phase the implementation if complex. Identify the migration path from current state to new state.

**Open Questions**
Any unresolved questions that reviewers should weigh in on.

---

## Review Participants by Change Type

Not every architecture review requires the same participants. Over-inviting wastes time; under-inviting misses critical perspectives.

| Change Type | Required Reviewers | Optional Reviewers |
|-------------|--------------------|--------------------|
| New aggregate root | Lead Engineer, 1 backend engineer | PM (for domain correctness) |
| New external dependency | Lead Engineer, DevOps/Infra engineer | Security reviewer |
| Multi-tenancy change | Lead Engineer, 2 backend engineers | Security reviewer (mandatory if auth-adjacent) |
| New auth mechanism | Lead Engineer, Security reviewer | PM |
| Cross-cutting concern | Lead Engineer, 1 backend engineer | Frontend engineer if UI-facing |
| Calculation methodology | Lead Engineer, Domain Expert | PM, Finance Officer representative |
| Performance schema change | Lead Engineer, 1 backend engineer | DBA if available |

"Lead Engineer" means the technical lead for the Aurigo Maintain project. If the tech lead is the author, a senior engineer from another team reviews instead.

---

## AI Agent Role in Architecture Reviews

Claude Code agents assist with the RFC process in three ways:

**Drafting the RFC:**
```
I am proposing [CHANGE]. Using the RFC template in engineering-playbook/vol-5-operating-model/08-architecture-reviews.md,
draft a complete RFC including:
1. Problem statement based on [CONTEXT]
2. Proposed solution for [APPROACH]
3. Two alternatives with trade-offs
4. Risks and mitigations
5. Implementation plan

Read engineering-playbook/vol-3-architecture/adrs/ first and flag any existing decisions that this RFC would supersede or contradict.
```

**Comparing Against Existing ADRs:**
```
I am proposing [CHANGE]. Read all ADRs in engineering-playbook/vol-3-architecture/adrs/.
Identify any ADR whose decision this change would contradict, supersede, or depend on.
For each relevant ADR: explain the relationship and whether the proposed change is consistent.
```

**Researching Alternatives:**
```
For RFC [TITLE], research alternatives to [PROPOSED APPROACH].
Consider: ecosystem conventions for .NET 8 + EF Core 8 + PostgreSQL, Aurigo's existing patterns, performance implications, maintainability.
Do not invent approaches — only include alternatives that are documented in the ecosystem.
```

---

## What Happens When a Review Is Skipped

Architecture reviews are occasionally skipped, usually under time pressure. The consequences are predictable:

**Immediate consequence**: The change is merged. It works. Nothing breaks immediately.

**Short-term consequence** (1–3 sprints): The change creates confusion. Other engineers encounter the new pattern and do not know whether to follow it or ignore it. PRs reference the change without context. Tech debt accumulates around the inconsistency.

**Medium-term consequence** (1–6 months): A second change is made that assumes the first pattern is intentional and permanent. Now two features depend on the undocumented pattern. Refactoring requires touching both.

**Long-term consequence**: The system develops multiple competing patterns for the same problem. Code reviews become debates about which pattern is correct. Onboarding time increases. The architecture discovery protocol (document 02) becomes harder to execute because the architecture is now inconsistent.

**The process for skipped reviews:**

When a change that should have had an architecture review is merged without one:
1. A post-hoc architecture review is triggered immediately
2. The RFC is written retroactively to document the decision
3. If the review concludes the change was wrong: a refactoring story is added to the backlog with P2 priority
4. If the review concludes the change was right: an ADR is created and the decision is documented

The engineer who merged without review is not blamed — the process is at fault for not catching it. But the process is fixed: the triggering conditions in this document are made more explicit, and the PR checklist (document 09) is updated to include the trigger check.

Post-hoc reviews are not a shortcut. They do not retroactively make skipping the review acceptable. They are the damage control mechanism.

---

## When the RFC Is Rejected but the Author Disagrees

Architecture reviews can produce disagreements that the async process cannot resolve. This section defines the escalation path when the RFC author believes the review outcome is wrong.

### The Disagreement Resolution Ladder

**Step 1: Written Reconciliation (1 business day)**

Before escalating, the RFC author writes a "response to reviewer concerns" section in the RFC. This section addresses each blocking concern with either:
- Additional evidence or arguments not present in the original RFC
- A modified proposal that addresses the concern
- A specific reason the reviewer's concern is based on a misunderstanding of the proposal

The reviewer who raised the block reads the response. If it addresses the concern, the block is lifted and the RFC proceeds.

**Step 2: Facilitated Discussion (2 business days)**

If the reviewer is not satisfied with the written response, a 30-minute facilitated discussion is scheduled. The Tech Architect (if not the author or blocking reviewer) facilitates. If the Tech Architect is one of the parties, the ED facilitates.

Rules for the discussion:
- Both parties present their position for 5 minutes each, uninterrupted
- The facilitator asks clarifying questions
- The parties explore alternatives that both could accept
- If a compromise is reached, the RFC is updated and the block is lifted

**Step 3: ED Decision (1 business day)**

If facilitation does not produce agreement, the ED reads the RFC, the written response, and the discussion notes, and makes the decision. The ED's decision is documented in the ADR with the reasoning.

The ED's decision may be:
- Approve the RFC as written
- Approve the RFC with specific modifications
- Reject the RFC, defer to a later date with more information
- Reject the RFC permanently, with the alternative approach documented in a new ADR

**Step 4: Escalation to VP Engineering (final)**

If either party believes the ED's decision is fundamentally wrong (e.g., it violates a compliance requirement or contradicts a company-level architecture principle), they can escalate to the VP Engineering. VP decisions are final.

### What the Author Should Do After a Rejection

- **Do not silently work around the decision**: implementing a rejected pattern in a smaller PR is a career-limiting move. The decision applies until formally reversed.
- **Do document the rejection**: the RFC status becomes "Rejected" with the reason. Future engineers reading it will understand why this path was not chosen.
- **Do explore alternatives**: often a rejection reveals a constraint the author did not know about. Use the constraint to propose a different approach.
- **Do come back with new evidence**: if 6 months later, new data or a new use case makes the rejected approach clearly correct, a new RFC is welcome. Precedent does not bind future decisions.

### What the Reviewer Who Blocked Should Do

- **Be specific about what would unblock**: "This is blocked because X, and it would be unblocked if Y." Vague blocks are hard to resolve.
- **Consider whether the block is truly a block**: often "I would prefer differently" is a `suggestion`, not a `blocker`. Reserve `blocker` for correctness, security, or fundamental architectural contradiction.
- **Be willing to change position with new evidence**: reviewers who never change their minds create a chilling effect on future RFC authoring.

### Anti-Patterns in Architecture Disagreement

- **The "silent shift"**: author implements a slightly different pattern in a subsequent PR that is close to the rejected approach without explicitly re-opening the discussion. This creates precedent by fait accompli.
- **The "gatekeeper"**: reviewer blocks every RFC that does not exactly match their preferred style, regardless of merit. Recognized when the reviewer's block rate is significantly higher than peers.
- **The "escalation-only-when-losing"**: author only escalates when their proposal is rejected, never escalating rejections of others. This is a political move, not a technical one.

The Tech Architect and ED watch for these patterns in the quarterly architecture review meta-retrospective.
