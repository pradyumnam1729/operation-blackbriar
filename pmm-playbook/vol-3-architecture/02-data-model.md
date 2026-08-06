# 02 — Data Model

---

## Entities

Six core entities. For the MVP they are materialized over the war-room Markdown files ([Vol 2, ch. 07](../vol-2-domain-knowledge/07-war-room-model.md)) plus a lightweight application store for logs, users, and state; the model below is the contract either way.

### Product

The unit of foundation. One record per product line — for the seed customer: Masterworks, Essentials, Primus, Lumina.

| Field | Notes |
|-------|-------|
| id, name, description | Product naming obeys the voice standards (never misassign program/portfolio contexts) |
| stage | Company-stage context for stage-aware behavior (§10) |
| foundation_doc_id | Exactly one current FoundationDoc per product |

### FoundationDoc

The engine block. **Versioned at the section level**, because sections change at different rates and staleness is per-section, not per-doc.

| Field | Notes |
|-------|-------|
| id, product_id, version | Doc-level version increments on any section approval |
| sections[] | Fixed set, in chain order: `positioning`, `icp` (with personas and JTBDs), `jtbd`, `value_props`, `competitive`, `guardrails`, `proof` (plus `objections`) |

Each **FoundationSection**:

| Field | Notes |
|-------|-------|
| kind, content | `value_props` content is structured records (the six-field schema), not prose |
| status | `empty` → `draft` → `approved`; only `approved` sections are generation sources |
| version, approved_by, approved_at | Every approval is attributable |
| last_validated | Drives freshness alerts; validated ≠ merely edited |
| sources[] | War-room intelligence files this section was validated against |

### Asset

Anything generated for consumption: battlecard, one-pager, RFP response section, exec brief, talk track, channel copy.

| Field | Notes |
|-------|-------|
| id, product_id, type, audience, persona | Mirrors the war-room frontmatter convention (`../../CLAUDE.md`) |
| stage | `draft` → `final`; transition only via approval workflow, with actor and timestamp |
| content, template_id | Rendered from a Vol 9 template |
| **source_sections[]** | FoundationSection ids **with the section versions consumed** — the trace |
| sources[] | Additional war-room files cited |
| generated_by, generated_at, approved_by, approved_at | The audit fields ([ch. 05](05-security-and-governance.md)) |

### Query / Answer Log

Every knowledge-engine interaction, kept both for audit and for product signal.

| Field | Notes |
|-------|-------|
| id, user_id, role, question | Verbatim question — recurring questions are promotion candidates per §3.5 |
| answer, citations[] | Citations reference sections/files with versions |
| outcome | `answered` / `escalated` / `refused` — the coverage metric reads from this |
| escalation_task_id | Set when routed to an intelligence agent |

### Persona / Role

The consumer personas of [Vol 1, ch. 04](../vol-1-product/04-users-personas.md) as data: name, what-they-need, output framing rules, metric dialect (the §3.3 map row). The knowledge engine's framing layer is configured by these records — adding a persona is data entry, not code.

### User

id, name, email, role (persona reference), and access level: `admin` (PMM) or `consumer`. Access semantics in [chapter 05](05-security-and-governance.md).

---

## The Consistency Rule

The one invariant the schema exists to enforce:

> **Every asset traces to the foundation-doc sections it was generated from — by section id and section version.**

Consequences, all mechanical:

1. **Generation-time:** an asset cannot be created without `source_sections`; a generator that consumed nothing approved has nothing to write.
2. **Staleness propagation:** when a section gains a new approved version, every final asset tracing to the old version is flagged stale on the governance dashboard. Nothing is auto-rewritten — regeneration is proposed, the PMM decides.
3. **Answer citation:** the same rule applied to answers — no citation, no answer; the engine refuses rather than free-associates.
4. **The consistency score** ([Vol 1, ch. 06](../vol-1-product/06-success-metrics.md)) is a query over this data: finals whose traced section versions are current ÷ all finals.

---

## Relationship to the War Room

The FoundationDoc sections and the four brand files hold overlapping truth: `positioning-and-icp.md` ↔ positioning + ICP sections; `gtm-rules.md` ↔ guardrails section; `our-customer.md` feeds ICP/JTBD and the copy layer. MVP resolution: **the Markdown files are canonical**; the app reads them, renders them as sections, and writes back through the approval workflow. This keeps agents (who read files) and app users (who see sections) on one truth with zero sync machinery. If a later stage moves canon into a database, the war-room files become a generated export — that decision belongs in an ADR, not in this chapter.

---

## Deliberate MVP Simplifications

| Simplification | Upgrade path |
|----------------|--------------|
| Single tenant (Aurigo) | Tenant id on Product and User; see [ch. 05](05-security-and-governance.md) |
| Section content as Markdown blobs (except value props) | Structured sub-schemas per section kind as editors mature |
| Logs in the app store, not warehoused | Export path when C13 needs longitudinal analysis |

---

*Next: [03 — AI Architecture](03-ai-architecture.md)*

Last updated: 2026-08-06
