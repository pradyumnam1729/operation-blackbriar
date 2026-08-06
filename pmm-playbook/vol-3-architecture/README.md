# Volume 3 — App Architecture

This volume is the architecture reference for the PMM Agent **web app** — the product built in `../../app/` during engineering-mode sessions (`../../CLAUDE.md`, "The two modes of work"). It describes the system components, the data model, the AI architecture, the stack, and the security and governance model. It plays the role that `../../engineering-playbook/vol-3-architecture/` plays for Aurigo's core products; where this volume is silent on general engineering standards (coding style, API conventions, review checklists), that playbook is the authority.

The volume's organizing idea: **the app is the operating model, encoded.** Every workflow in [Volume 5](../vol-5-operating-model/README.md) and every framework in [Volume 2](../vol-2-domain-knowledge/README.md) appears here as a component, a schema constraint, or a workflow state — not as a suggestion in a help page.

---

## Contents

| # | Document | Description |
|---|----------|-------------|
| 01 | [System Overview](01-system-overview.md) | The six components: foundational-doc builder, knowledge engine, asset generator, agent orchestration layer, approval workflow, governance dashboard — and how they connect. |
| 02 | [Data Model](02-data-model.md) | Entities: Product, FoundationDoc (versioned sections), Asset, Query/Answer log, Persona/Role, User — and the consistency rule that every asset traces to its foundation sections. |
| 03 | [AI Architecture](03-ai-architecture.md) | Claude API usage: always-on context injection, sub-agents as specialized system prompts, whole-file retrieval for a small corpus, deterministic guardrails as code, and the human approval gate as a workflow state. |
| 04 | [API & Stack](04-api-and-stack.md) | The lean hackathon stack, its relationship to Aurigo engineering standards, acceptable MVP deviations, and Aurigo brand standards for the UI. |
| 05 | [Security & Governance](05-security-and-governance.md) | Role-based access (admin vs. consumers), the audit trail of who generated and approved what, and tenant thinking for the multi-product future. |

---

## How to Read This Volume

Read 01 and 02 together — the components and the entities are two views of one design. Chapter 03 is the heart: it explains why the AI layer is deliberately simple (context injection + specialized prompts + deterministic checks) and where model judgment is explicitly *not* trusted. Chapters 04 and 05 are the build-and-run practicalities.

---

## Audience

| Reader | Focus on |
|--------|----------|
| Engineer / build agents (`app-architect`, `ui-engineer`, `qa-reviewer`) | All five, plus `../../engineering-playbook/vol-3-architecture/01-coding-standards.md` and `03-api-standards.md` |
| PMM admin | 01 and 05 — what the components do for you and who can do what |
| AI agent in building mode | 01–03 as design authority; deviations require a note in the PR, not silent divergence |

---

## Design Tenets

1. **Foundation-first, always.** No component generates customer-facing content from anything but approved foundation sections and validated intelligence. This is the architecture-level form of the §3.1 gate.
2. **Provenance is load-bearing.** Traces from asset to source section are not metadata garnish; they are what the consistency value prop is made of.
3. **Deterministic where possible, model where necessary.** Forbidden words, trace validation, and staleness are code. Drafting, framing, and synthesis are model work. Never swap the two.
4. **The human gate is a state machine, not a habit.** Draft → approved → final transitions live in the data model with an actor and a timestamp.
5. **MVP simplicity is a choice, not a debt.** Markdown corpus, whole-file retrieval, one tenant. Each has a named upgrade path in its chapter; none blocks the demo.

---

Last updated: 2026-08-06
