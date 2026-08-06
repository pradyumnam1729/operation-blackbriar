# Volume 6 — Integrations

**PMM Agent Playbook · Operation Blackbriar**
Version 1.0 · 2026-08-06

---

The PMM Agent is only as good as the signals it can see. `PMM Agent — Master Instructions & Contex.md` §2.2 names connected data sources as a hard prerequisite: if the system cannot access call transcripts, CRM data, competitive intelligence, or product docs, most of the value is locked out. This volume documents every data source the system consumes, every surface it publishes to, and the contract between them.

Read this volume when wiring a new source, when an intelligence agent's output looks thin (the cause is almost always an unconnected or stale source), or when deciding what MVP ships with versus what waits for GA connectors.

---

## Chapter Index

| # | File | Chapter | What It Covers |
|---|------|---------|----------------|
| 1 | `01-integration-overview.md` | Integration Overview | Why sources are a prerequisite, the MVP file-drop model vs. GA live connectors, the source-to-agent map |
| 2 | `02-call-intelligence.md` | Call Intelligence | Gong/Chorus/Fathom/Granola transcript ingestion and the voice-of-market extraction pipeline |
| 3 | `03-crm.md` | CRM | Salesforce opportunity data feeding win-loss analysis and messaging-effectiveness measurement |
| 4 | `04-competitive-sources.md` | Competitive Sources | Pricing pages, release notes, G2 reviews, job postings, analyst reports; monitoring cadence |
| 5 | `05-content-surfaces.md` | Content Surfaces | Where outputs go: slide export, doc export, Slack answers, proposal-tool handoff |
| 6 | `06-product-truth.md` | Product Truth | `engineering-playbook/vol-2-product-knowledge/` as the feature-truth source; product-update triggers |

---

## The One-Line Contract

Every integration in this volume follows the same contract:

**Raw signal in → structured markdown in `GTM-War-Room/` → agent consumes the markdown, never the raw feed.**

Agents do not query Salesforce, scrape a pricing page, or parse a transcript mid-task. Ingestion pipelines (manual at MVP, scheduled at GA) land normalized markdown files in the war room, and agents read those files. This keeps every output traceable to a named source file, keeps the war room auditable, and means the same agent brief works whether the source arrived by file-drop or live connector.

## Related Volumes

- `pmm-playbook/vol-3-architecture/` — where ingestion pipelines and connectors live in the app design
- `pmm-playbook/vol-4-agent-organization/` — which agents consume which sources
- `pmm-playbook/vol-8-roadmap/` — when each connector ships (MVP file-drop → beta import → GA live)
- `engineering-playbook/vol-6-integration-strategy/` — the engineering-side integration model this volume's conventions were adapted from
