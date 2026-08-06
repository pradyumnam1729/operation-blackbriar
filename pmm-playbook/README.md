# PMM Agent Playbook

This playbook is the operating system of the PMM Agent — the web app that gives product marketers a standardized framework to build one rigorous foundational doc per product, then turns that foundation into a live knowledge engine that Sales, Proposals, Marketing, and Leadership query in plain language for role-ready answers and customer-ready assets. If a decision about how we build or operate the PMM Agent was made but not documented here, it does not exist for the next contributor or AI agent.

It is the sibling of `../engineering-playbook/` and follows the same discipline: written for permanence, not for a specific sprint. The system constitution is `../PMM Agent — Master Instructions & Contex.md`; this playbook operationalizes it. Where the constitution says what must be true, the playbook says how we make it true — in the product, in the agent organization, and in the daily operating model.

---

## Why This Exists

Product marketing knowledge lives in three places: in assets, in the PMM's head, and in documentation. The first is scattered and goes stale. The second does not scale past one person and walks out the door. The third scales — if it is rigorous, current, and queryable.

The PMM Agent is a bet that the third kind can become a product. One PMM builds one foundational doc per product to a standardized framework. That doc becomes the source every downstream asset and answer traces back to. The value props we are building toward, and must be able to demo:

- **90% faster sales asset creation** — minutes instead of days for customer-ready collateral
- **100% messaging consistency** — every asset traces to the same approved foundation
- **3–5× more products, industries, and personas per PMM** — the framework scales, the PMM's judgment stays scarce
- **Faster response to new market opportunities** — a current foundation means activation starts today, not after a research sprint

Aurigo is the first customer. All seeded content uses the Aurigo portfolio (Masterworks, Essentials, Primus, Lumina) and obeys `../Voice of Aurigo - Standards Reference.md`.

---

## How to Use This Playbook

### If you are the PMM (admin and power user)

You own the system. Read in this order:

1. **Vol 1 — Product Context** — what the PMM Agent is, who it serves, how we measure it
2. **Vol 2 — Domain Knowledge** — the PMM frameworks canon the system enforces; this is your professional standard, codified
3. **Vol 5 — Operating Model** — intake, foundation-doc workflow, approval gates, always-on programs, session rituals
4. **Vol 4 — Agent Organization** — the 14 sub-agents that work for you, their contracts, and the routing rules
5. **Vol 9 — Templates** and **Vol 10 — Prompts** — bookmark both; you will use them daily

### If you are a consumer (Sales, Proposals, Marketing, Leadership, CS, SDR)

You do not need the whole playbook. Read:

- **Vol 1, chapter 04** — your persona, what the system gives you, and how answers are framed for your role
- **Vol 5, chapters 03 and 04** — how to ask a question and how to request an asset, including what happens when the war room cannot answer
- Everything else is the machinery behind your answer. Trust the citations; every answer names its sources.

### If you are an engineer building the app

1. `../CLAUDE.md` for repository conventions and the two modes of work
2. **Vol 3 — App Architecture** — components, data model, AI architecture, stack, security
3. **Vol 2 — Domain Knowledge** — the frameworks the app must encode as product behavior, not decoration
4. **Vol 8 — Roadmap** for what ships when; `../engineering-playbook/vol-3-architecture/` for base coding, API, and review standards

### If you are an AI agent starting a session

1. Read `../CLAUDE.md`, then `../PMM Agent — Master Instructions & Contex.md`, then the four brand files in `../GTM-War-Room/BRAND-DNA/`
2. Determine your mode: operating (PMM work) or building (engineering work) — see `../CLAUDE.md` "The two modes of work"
3. Operating mode: **Vol 5** is your procedure manual; your role contract is in **Vol 4** and your executable definition in `../.claude/agents/`
4. Building mode: **Vol 3** is your architecture reference; defer to `../engineering-playbook/` for base standards
5. At session close, write `../GTM-War-Room/HANDOVER.md` per Vol 5, chapter 07

---

## Volume Index

| # | Folder | Title | Description |
|---|--------|-------|-------------|
| 1 | `vol-1-product/` | Product Context | What the PMM Agent is: vision, the fragmentation problem it kills, the four value props in our own value-prop schema, the persona system, market landscape, and success metrics |
| 2 | `vol-2-domain-knowledge/` | PMM Domain Knowledge | The frameworks canon: positioning standard, the positioning → messaging → copy chain, the 7-step narrative arc, value-prop schema, business translation, JTBD and ICP, the war-room model, and the operating cadence |
| 3 | `vol-3-architecture/` | App Architecture | The web app: system components, data model, AI architecture (context injection, sub-agents, retrieval, deterministic guardrails), stack recommendation, and security/governance |
| 4 | `vol-4-agent-organization/` | Agent Organization | The 14-agent org: three groups, routing rules, per-agent I/O contracts, and the engineering build agents. The org-level view over `../.claude/agents/` |
| 5 | `vol-5-operating-model/` | Operating Model | How work flows: intake protocol, foundation-doc workflow, query/answer workflow, asset generation, approval gates, always-on programs, session rituals |
| 6 | `vol-6-integrations/` | Data & Integration Strategy | Connected data sources (call transcripts, CRM, competitive feeds, product docs), ingestion patterns, and the "connected data" prerequisite from Master Instructions §2.2 |
| 7 | `vol-7-ai-engineering/` | AI Engineering & Guardrails | Claude engineering standards for the app: prompt construction, evaluation, hook enforcement, failure modes, and cost/latency budgets |
| 8 | `vol-8-roadmap/` | Roadmap MVP→Beta→GA | What ships at each stage, the demo bar for the hackathon MVP, and the gate criteria between stages |
| 9 | `vol-9-templates/` | Asset & Doc Templates | Ready-to-use templates: foundational doc sections, battlecard, one-pager, launch brief, RFP response, exec brief, HANDOVER.md |
| 10 | `vol-10-prompts/` | Operating Prompt Library | Ready-to-use briefs (not prompts) for every recurring PMM task, encoding Context + End State + Constraints per Master Instructions §6 |

Volumes 6–10 are being written in parallel by another author. Their absence today (2026-08-06) does not make those topics optional; until they land, refer to the Master Instructions sections cited throughout volumes 1–5.

---

## Contributing to the Playbook

The playbook is part of the repository and is reviewed like code.

**Which volume to modify:**

| Type of change | Volume |
|----------------|--------|
| Value prop, persona, or metric definition changed | Vol 1 |
| New PMM framework adopted or standard revised | Vol 2 |
| Architectural decision locked in for the app | Vol 3 |
| Agent added, retired, or contract changed | Vol 4 (and `../.claude/agents/`) |
| Workflow, gate, or cadence changed | Vol 5 |
| New data source connected | Vol 6 |
| Guardrail or evaluation changed | Vol 7 |
| Scope moved between MVP/Beta/GA | Vol 8 |
| Template added or revised | Vol 9 |
| Brief added or improved | Vol 10 |

**Commit message format:**

```
docs(playbook): [vol-N] <change>

Examples:
docs(playbook): [vol-2] tighten anti-pattern check in positioning standard
docs(playbook): [vol-4] add pricing-packaging agent I/O contract
docs(playbook): [vol-5] add freshness check to asset generation workflow
```

**Rules:**

1. Make the change in a branch; explain in the PR what triggered it.
2. A playbook change that alters agent behavior must land in the same PR as the matching `../.claude/agents/` or `../.claude/skills/` change. The playbook and the executable definitions never drift.
3. Absolute dates only (YYYY-MM-DD). "Last quarter" is meaningless in twelve months.
4. Every chapter obeys `../Voice of Aurigo - Standards Reference.md`. The banned-words list applies to the playbook's own prose, not just customer-facing output.

---

This playbook is the operating system of the PMM Agent. If a decision was made but not documented here, it does not exist for the next contributor or AI agent.

---

## Last Updated

2026-08-06 — Volumes 1–5 written. Volumes 6–10 in progress by parallel author.
