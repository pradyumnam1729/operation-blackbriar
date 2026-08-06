# Volume 8 — Roadmap

**PMM Agent Playbook · Operation Blackbriar**
Version 1.0 · 2026-08-06

---

This volume is the build sequence for the PMM Agent: what ships at each stage, what is deliberately deferred, and what each stage must prove before the next begins. It exists so scope decisions are made once, in writing, instead of re-litigated in every session — and so anyone can tell the difference between "not built yet" and "not planned."

Four stages, each with a chapter:

| # | File | Stage | One-line scope |
|---|------|-------|----------------|
| 1 | `01-hackathon-mvp.md` | Hackathon MVP (2026-08-06) | One product, three personas, two asset generators, the approval gate, a seeded Aurigo war room — demo-ready today |
| 2 | `02-beta.md` | Beta | Multi-product, all 14 agents wired, always-on schedules, CRM and call-transcript import, governance dashboard |
| 3 | `03-ga.md` | GA | Live connectors, multi-tenant, production analytics, enterprise auth |
| 4 | `04-expansion.md` | Expansion (V2) | The Master Instructions §14 deferrals: campaign agent, content production agent, analyst-relations automation, more verticals |

---

## The Sequencing Logic

The order is not arbitrary. Each stage proves the riskiest remaining assumption before the next stage spends on scale:

1. **MVP proves the core loop** — that one rigorous foundational doc plus a seeded war room can generate role-ready answers and customer-ready assets that survive the quality gates, fast enough to demo the 90%-faster value prop live.
2. **Beta proves the operating model** — that the full 14-agent organization (see `pmm-playbook/vol-4-agent-organization/`) runs on real schedules against imported real data without drowning the PMM admin in approval queues.
3. **GA proves the product** — that the system works for a tenant we do not sit next to, on live data feeds, with the analytics to demonstrate the value props from the customer's own numbers.
4. **Expansion spends the surplus** — new agents and verticals only after the core is banking value, per the §14 coverage notes that scoped them out of V1 deliberately.

Aurigo is the first customer at every stage: the MVP war room is seeded with Aurigo content, beta runs on Aurigo's real GTM data, and GA's first external tenant onboards against the playbook Aurigo's deployment wrote.

## What Never Changes Across Stages

Stage gates change transport, scale, and automation — never governance. At every stage: intelligence before activation (Master Instructions §3.1), draft → approval → final (§8.4), the layered guardrails of `pmm-playbook/vol-7-ai-engineering/03-guardrails.md`, and the war room as the markdown-first source of record. A roadmap item that requires weakening one of these is not a roadmap item; it is a constitution change and goes through `PMM Agent — Master Instructions & Contex.md` first.
