# 04 — API & Stack

---

## Stack Philosophy

The stack serves two masters: hackathon speed (a working demo by the deadline) and Aurigo standards (this is a real product candidate, not a throwaway). The resolution: a lean, boring stack whose every deviation from `../../engineering-playbook/vol-3-architecture/` is named and justified below. Boring is a feature — the novel risk budget is spent entirely on the AI layer and the domain model, not on infrastructure.

---

## Recommended Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + TypeScript, Vite | Matches Aurigo's frontend direction (React is the standard per the engineering playbook); Vite for dev speed |
| UI styling | Tailwind CSS over Aurigo brand tokens | Fast to build, easy to keep on-brand (tokens below) |
| Backend | Node.js + TypeScript (single service; Express or Fastify) | One language across the app; the workload is I/O-bound (file reads, Claude API calls) |
| AI | Claude API via the official SDK | See [chapter 03](03-ai-architecture.md); prompt caching for the brand-DNA bundle |
| Data | War-room Markdown as canon + SQLite for app state (users, logs, workflow states) | Canonical-files decision from [chapter 02](02-data-model.md); SQLite needs zero ops and migrates cleanly later |
| Auth | Session-based, two access levels (admin/consumer), stubbed identity for demo | Real SSO is a GA concern ([ch. 05](05-security-and-governance.md)) |
| Hosting | Local / single container for the hackathon | The demo runs on a laptop; nothing in the design prevents cloud deployment later |

---

## API Design

Follow `../../engineering-playbook/vol-3-architecture/03-api-standards.md` at the level that matters even for an MVP: resource-oriented REST, consistent JSON envelopes, meaningful status codes, versioned base path (`/api/v1`). The resource map falls straight out of the [data model](02-data-model.md):

```
/api/v1/products                          GET, POST
/api/v1/products/{id}/foundation          GET               (doc with sections + statuses)
/api/v1/products/{id}/foundation/{kind}   GET, PUT          (section edit → draft state)
/api/v1/assets                            GET, POST         (POST = generation request)
/api/v1/assets/{id}                       GET
/api/v1/queries                           POST              (question in; answer or escalation out)
/api/v1/approvals                         GET               (the queue)
/api/v1/approvals/{id}                    POST              (approve/reject with notes)
/api/v1/dashboard                         GET               (governance metrics)
```

Long-running generation and agent runs return `202` with a task resource to poll (or stream progress over SSE — nice for the demo, not required). All mutating endpoints record actor and timestamp for the audit trail.

## Acceptable MVP Deviations from Aurigo Standards

Named per the engineering playbook's own advice that undocumented deviation is the real sin:

| Aurigo standard | MVP deviation | Debt note |
|-----------------|--------------|-----------|
| Clean Architecture layering, per-service structure (`01-coding-standards.md`) | Single service, pragmatic module folders | Re-layer if the app outlives the hackathon; keep domain logic out of route handlers now to make that cheap |
| Enterprise database standards (`04-database-standards.md`) | SQLite + Markdown canon | Schema is defined in ch. 02; migration is mechanical |
| Full test pyramid | Tests on guardrails, trace validation, and workflow transitions only | These are the invariants the product's promises rest on; UI tests can wait |
| Microservices/events (`05-microservices.md`, `06-events.md`) | Not applicable at this scale | Revisit never, unless multi-tenant GA demands it |

Non-negotiable even at MVP: TypeScript strict mode, no secrets in the repo (Claude API key via environment), the deterministic guardrails shipped with tests, and the approval-gate invariant.

---

## UI — Aurigo Brand Standards

The UI must read as Aurigo from the first demo frame. Source: `../../Aurigo Brand Standards.md`. The tokens that matter:

- **Primary color: Dark Teal `#015F74`** — navigation, primary actions, key accents. Derive a restrained supporting palette (tints for backgrounds, a warning/stale amber, a draft/final status pair) rather than importing a rainbow.
- **Typeface: Roboto** throughout; weight for hierarchy, not extra fonts.
- **Sharp corners** — no border radius on cards, buttons, inputs. This single token does more to make the app look like Aurigo (and unlike every default component library) than anything else; configure it globally, not per component.
- Generous whitespace, restrained iconography, data-dense tables where PMMs work (approval queue, dashboard) — this is a professional tool, not a marketing site.

Status color language used consistently across the app: draft, final, stale, and escalated each get one color and keep it everywhere (dashboard, queue, asset lists).

---

## Build Agents

Engineering-mode work runs through the build agents ([Vol 4, ch. 04](../vol-4-agent-organization/04-build-agents.md)): `app-architect` holds this volume as its authority, `ui-engineer` holds the brand tokens above, `qa-reviewer` holds the deviation table and the non-negotiables. A PR that violates a non-negotiable does not merge, hackathon or not.

---

*Next: [05 — Security & Governance](05-security-and-governance.md)*

Last updated: 2026-08-06
