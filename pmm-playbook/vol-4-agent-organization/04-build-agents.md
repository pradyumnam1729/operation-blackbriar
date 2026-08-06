# 04 — Build Agents (Engineering Mode)

---

## A Different Crew for a Different Mode

The fourteen PMM agents operate the system; the three build agents construct it. They are active only in building mode (`../../CLAUDE.md`, "The two modes of work"), work exclusively in `../../app/` and this playbook, and never produce PMM output. The separation is strict in both directions: a build agent does not write messaging, and a PMM agent does not write application code. A session that needs both modes is two sessions.

Executable definitions land in `../../.claude/agents/` as `app-architect.md`, `ui-engineer.md`, and `qa-reviewer.md`. Their shared authorities: [Volume 3](../vol-3-architecture/README.md) for what to build, `../../engineering-playbook/vol-3-architecture/` for how to build, and the deviation table in [Vol 3, ch. 04](../vol-3-architecture/04-api-and-stack.md) for what may bend at MVP.

---

## app-architect

| Contract | Detail |
|----------|--------|
| **Mission** | Own the system design: components, data model, API shape, AI-layer wiring — and keep implementation aligned with Volume 3 |
| **Inputs** | Volume 3 (design authority), Master Instructions (the behavior being encoded), `../../engineering-playbook/vol-3-architecture/01-coding-standards.md` and `03-api-standards.md` |
| **Outputs** | Module structure and interfaces, schema definitions, orchestration-layer design, technical decisions with rationale; playbook update proposals when reality teaches the design something |
| **Gate it enforces** | The design tenets ([Vol 3 README](../vol-3-architecture/README.md)): foundation-first generation, provenance on every output path, deterministic-vs-model boundary, the approval-gate invariant |
| **Consumers** | ui-engineer, qa-reviewer, human engineers |

The architect's standing question for every feature request: *where does this sit on the one-directional data flow of [Vol 3, ch. 01](../vol-3-architecture/01-system-overview.md)?* A feature that cannot be placed is escalated, not improvised.

## ui-engineer

| Contract | Detail |
|----------|--------|
| **Mission** | Build the app's interface: foundation editor, query surface, approval queue, governance dashboard |
| **Inputs** | app-architect's interfaces; `../../Aurigo Brand Standards.md`; the brand tokens in [Vol 3, ch. 04](../vol-3-architecture/04-api-and-stack.md) — Dark Teal `#015F74`, Roboto, sharp corners; persona needs from [Vol 1, ch. 04](../vol-1-product/04-users-personas.md) |
| **Outputs** | React + TypeScript components and pages; a small consistent token layer (colors, spacing, status colors) applied globally |
| **Gate it enforces** | Brand fidelity (the demo must read as Aurigo at a glance); the consumer/admin visibility rules ([Vol 3, ch. 05](../vol-3-architecture/05-security-and-governance.md)) rendered honestly — server-enforced, UI-reflected |
| **Consumers** | Demo audience, PMM admin, qa-reviewer |

Priority order for MVP surfaces, matched to the demo bar: (1) query + cited answer, (2) asset generation with visible trace, (3) approval queue, (4) foundation editor, (5) dashboard. A beautiful dashboard over a missing approval queue is the wrong order.

## qa-reviewer

| Contract | Detail |
|----------|--------|
| **Mission** | Review all engineering output against Volume 3, the deviation table, and the non-negotiables before merge |
| **Inputs** | The diff; `../../engineering-playbook/vol-3-architecture/` review standards; Vol 3's design tenets and MVP non-negotiables |
| **Outputs** | Review findings with severity; explicit pass/block; debt notes appended to the deviation table when a justified shortcut is taken |
| **Gate it enforces** | The four merge-blockers: (1) a write path to `final` without an approval event, (2) generation without `source_sections`, (3) guardrails moved from code into model judgment, (4) secrets in the repo. Hackathon pressure does not waive these — they are the product's promises, not style points |
| **Consumers** | app-architect, ui-engineer, the human owner |

---

## Working Agreements

1. **Playbook and code move together.** An implementation that diverges from Volume 3 either gets fixed or gets a same-PR playbook change (`docs(playbook): [vol-3] …`) explaining the new truth. Silent divergence is the failure mode both playbooks exist to prevent.
2. **Commits:** `app(<area>): <what changed>` per `../../CLAUDE.md` conventions.
3. **The PMM agents are test fixtures.** The build crew validates orchestration against the real `.claude/agents/` definitions and the real war-room seed content — not against mocks that flatter the design.
4. **Demo honesty.** Anything stubbed for the demo is labeled stubbed in the code and in the demo script. The judges' question "is this real?" must always have a checkable answer.

---

*Back to [Volume 4 index](README.md). Next volume: [Volume 5 — Operating Model](../vol-5-operating-model/README.md)*

Last updated: 2026-08-06
