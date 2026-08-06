# Standing review-gate pattern — proposal

**Author:** engineering-director
**Date:** 2026-07-23
**Doctrine anchors:** `../vol-5-operating-model/09-code-reviews.md` (labels + who-reviews-what), `../vol-7-ai-engineering/04-agent-collaboration.md` (multi-agent handoff model).
**Trigger:** the 2026-07-23 quality audit produced 12 Critical findings, most of which should have been surfaced by a review pass on the PR that introduced them. Instead, they were discovered by the product owner during demo prep. This proposal ships a standing gate so this class of miss doesn't repeat.

---

## Problem statement

The current agent flow ends with the primary implementer's output being treated as done. Playbook § 04 already documents a Review Agent as the final pass, but it is not enforced in dispatch; the primary agent's own "self-review" is passed off as the review. The result:

- **Silent-mutation bugs** (FE-01 / BE-02 — tabs that save to nowhere) — no reviewer with a fresh perspective walked the round-trip.
- **UX regressions** (UX-05 — dashboard KPIs show $0) — no ux-strategist looked at the empty-state case.
- **Orphan enum values** (BE-02 — 5 unused narrative sections) — no backend reviewer traced the read side.
- **Missing tests** (TC-01/02/03) — no qa-lead was dispatched with a "would this regression be caught?" prompt.

The doctrine to prevent this is already in the playbook (§ 04-agent-collaboration + § 09-code-reviews) but it is not operationalised. This document operationalises it.

---

## Standing review-gate: the pattern

Every non-trivial feature (see "Scope" below) MUST pass through **three parallel reviewers** in a **single Wave-2 dispatch** immediately after the primary implementer signals "done":

```
Wave-1: primary-implementer(s)  →  produces code + self-review
              │
              ▼
Wave-2: three parallel reviewers, one Agent dispatch message
       ├── ux-strategist       (looks at every user-visible change)
       ├── qa-lead             (looks at test coverage of every behavior change)
       └── role-specific       (backend-lead / frontend-lead / lifecycle-domain-expert / integration-strategist — chosen by the ED based on the change area)
              │
              ▼
Wave-3: engineering-director consolidates the 3 review reports
        → PR merged only if no `blocker` (§ 09 semantics) remains open
```

The three reviewers operate on the **same commit** the primary implementer signed off on. Each produces a short review report using the `blocker` / `suggestion` / `question` / `nit` labels from `../vol-5-operating-model/09-code-reviews.md`. Reports are saved under `docs/reviews/[feature]-[YYYY-MM-DD]-review.md`.

### The role-specific slot

Chosen by the ED based on change area. Not a blanket "add a second frontend-lead" — the point is to bring a different specialty. Examples:

| Change area | Role-specific reviewer |
|---|---|
| TAMP / FHWA report | lifecycle-domain-expert |
| New calculation engine | tech-architect + lifecycle-domain-expert (2 slots — this is exception territory) |
| Aurigo Plan / Build integration | integration-strategist |
| Auth / permissions | tech-architect + security review (per § 09) |
| DevOps / infra | devops |
| Pure UI feature | frontend-lead (yes, a second one — but with a different prompt: "review the primary implementer's PR against the design system") |

### The three reviewer prompts (standardised)

Every review dispatch uses the same **three prompt templates** so the outputs are comparable across features:

**ux-strategist prompt (excerpt):**
> Read the diff at [commit-sha]. For every user-visible change, evaluate: (1) empty state, (2) loading state, (3) error state, (4) disabled state, (5) mobile responsiveness at 375px, (6) tooltip presence on non-obvious actions, (7) design-system fidelity. Use the `blocker/suggestion/question/nit` labels from `vol-5-operating-model/09-code-reviews.md`. Save review to `docs/reviews/[feature]-ux.md`.

**qa-lead prompt (excerpt):**
> Read the diff at [commit-sha]. For every behavior change (endpoint added, mutation added, form submitted, background job triggered), evaluate: (1) does a test cover the happy path, (2) does a test cover the sad path (auth, validation, 5xx), (3) does a test assert the round-trip effect (mutation → visible-on-refresh), (4) does a test guard the specific finding class in the last audit. Use the `blocker/suggestion/question/nit` labels. Save review to `docs/reviews/[feature]-qa.md`.

**role-specific prompt (excerpt):**
> Read the diff at [commit-sha]. Focus on: [ED-specified concern — e.g. "orphan enum values", "cross-controller route inconsistency", "null-argument passing", "handler chaining"]. Use the `blocker/suggestion/question/nit` labels. Save review to `docs/reviews/[feature]-[role].md`.

### The consolidation gate

The ED reads all three reports in a **single dispatch**. Rules:

- **Any Critical `blocker`** → PR reverted or fix committed before merge, no exceptions.
- **Any 2+ `blocker`s in the same review** → primary implementer redoes the work with the reviewer's findings in the prompt.
- **Any `blocker` that surfaces a pattern violation** (e.g. "third markdown renderer in the codebase") → open a ticket to consolidate the pattern in a separate PR.
- **All `suggestion`s** → the primary implementer either addresses or writes a one-liner explaining why not.
- The ED writes the merge decision to `docs/reviews/[feature]-decision.md` (imperative form: "Merged. FE-01 addressed inline. UX-XX-related suggestion punted to Wave-3 backlog item #NNN.").

---

## Scope: what triggers the gate

**MUST gate:**
- Any change that touches a controller, handler, or MediatR command.
- Any change that adds a route, tab, sidebar entry, or navigable surface.
- Any change that touches a calculation engine.
- Any change that touches an integration client / stub.
- Any change touching authorization, tenant filter, or JWT claims.

**MAY skip the gate (single reviewer sufficient, per § 09 "small bug fix"):**
- Fixing a typo in copy.
- Renaming a private helper.
- Bumping a package version with no code change.
- Purely additive test-only PRs (still needs qa-lead approval, but the other two are noise).

**MUST get an extended gate (add tech-architect + security):**
- Any change to `Persistence/`, DbContext configuration, EF query filters.
- Any auth / role / permission change.
- Any new external HTTP dependency.

---

## Why this fits the existing doctrine

- **§ 09 already defines the labels + SLAs.** This proposal doesn't invent new vocabulary. It operationalises § 09's "who reviews what" table by making the reviewers PARALLEL agents rather than sequential humans, so the wall-clock cost is 1 agent-turn instead of 3.
- **§ 04 already defines the file-based handoff format.** Review reports go into `docs/reviews/[feature]-[role].md`, matching the existing `docs/reviews/[feature-name]-review.md` convention already documented in § 04 (line 51).
- **§ 04's Review Agent is currently one role doing everything.** This proposal splits it into three specialists because a single reviewer cannot equally weight UX + test-coverage + role-specific concerns — that's exactly why the current single-review pattern lets the bug classes above through.

---

## Cost / benefit

**Cost:** 3 additional agent dispatches per gated PR. In wall-clock terms (parallel), this is ~1 agent-turn of latency added. In cost terms, ~3× the primary implementer's review budget per feature.

**Benefit (measured against this audit):**
- All 3 Critical bugs of the "silent mutation" class (FE-01/BE-02/UJ-10) would have been caught by ux-strategist review on the PR that introduced them.
- All 3 Critical test gaps (TC-01/02/03) would have been caught by qa-lead review.
- BE-01 (`lcpSummaryForGap: null`) would have been caught by a role-specific backend-lead reviewer prompted with "look for null unconditional arguments".

If 3 of the 12 Critical findings had been caught pre-merge, the ROI is already positive vs. the cost of tracking, communicating, and fixing them post-hoc.

---

## Rollout

1. **This week:** ED adds a `review-gate-required` label to the primus repo's PR template. Any PR labelled `review-gate-required` cannot merge without three review reports linked in the PR description.
2. **Sprint W3.6:** ED codifies the three standard prompts in `vol-10-claude-prompts/` alongside the existing SDLC prompt templates.
3. **Sprint W3.7:** Backfill review reports for the three Critical fixes coming out of this audit (BE-01, FE-01, UX-05). This gives us three template exemplars.
4. **Sprint W4.1:** Retrospective — did the gate catch anything? Adjust reviewer prompts based on hit rate.

---

## Open questions the ED should route

- **QA-lead capacity:** the qa-lead agent is currently under-dispatched. Are we blocking on QA reviewer bandwidth if every gated PR pulls one? Answer: no — the review is a fixed-shape ~10-min dispatch, and QA already dispatches on cadence for release testing. Adding review is additive not conflicting.
- **Role-specific fatigue:** if 8 PRs / week each require a backend-lead review, we double-book the same agent 8× / week. Mitigation: rotate the "role-specific" seat among leads.
- **ADR needed?** This proposal is a process change, not a code architecture change. It fits under `../vol-5-operating-model/` rather than `vault/decisions/`. Recommend adding as a new section in `../vol-5-operating-model/09-code-reviews.md` labelled "Standing review gate for AI-implemented features" — no ADR needed.
