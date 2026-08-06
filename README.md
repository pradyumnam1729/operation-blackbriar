# Operation Blackbriar — The PMM Agent

Product marketing knowledge lives in one PMM's head and a hundred stale decks — and every sales asset request waits days on it. The **PMM Agent** is a web app that gives product marketers a standardized framework to build one rigorous foundational doc per product (positioning, value props, competitive intel, brand guardrails, JTBDs), then turns that foundation into a live knowledge engine: Sales, Proposals, Marketing, and Leadership query it in plain language and get crisp, role-ready answers and customer-ready assets — battlecards, one-pagers, RFP responses, exec briefs, sales decks — in minutes. Aurigo (Masterworks, Essentials, Primus, Lumina) is the first customer; the seeded war room uses the Aurigo portfolio throughout.

## The Four Value Props

- **90% faster sales asset creation** — minutes instead of days for customer-ready collateral
- **100% messaging consistency** across customer-facing assets
- **3–5× more products, industries, and personas** supported per PMM
- **Faster response to new market opportunities**

## Repository Map

```
operation-blackbriar/
├── CLAUDE.md                                  ← workspace constitution (read first in any session)
├── PMM Agent — Master Instructions & Contex.md ← system constitution: philosophy, 14 agents, standards
├── Aurigo Brand Standards.md                  ← visual brand specs (colors, logo, type)
├── Voice of Aurigo - Standards Reference.md   ← voice, banned phrases, terminology
├── GTM-War-Room/                              ← the live knowledge base (the product's data)
│   ├── BRAND-DNA/                             ← 4 brand files — every agent reads these
│   ├── ACTIVE-LAUNCHES/[launch]/              ← per-launch briefs, assets, enablement
│   ├── PLAYBOOKS-AND-ASSETS/                  ← messaging library, battlecards, case studies
│   ├── MARKET-INTELLIGENCE/                   ← competitive, win-loss, voice-of-market, ICP
│   └── *.md                                   ← about-me, competitors, personas, strategy, product-wiki
├── pmm-playbook/                              ← how we build & operate the PMM Agent (10 volumes)
├── engineering-playbook/                      ← Aurigo engineering standards + product-knowledge corpus
├── reference output/                          ← exemplar outputs (quality bar for generated assets)
├── app/                                       ← the web application (created during build)
└── .claude/
    ├── agents/                                ← 14 PMM sub-agents + build agents
    ├── skills/                                ← repeatable PMM workflows (/battlecard, /asset-qa, …)
    └── hooks/                                 ← session-start context injection, forbidden-words guard
```

## Quickstart

1. **Open this repo in Claude Code.** The SessionStart hook injects the brand DNA (positioning, voice, customer language, GTM rules) into context automatically — every session starts with the same brand baseline.
2. **Ask the war room:** try `/ask-war-room` with a role question — *"What do I say when a DOT prospect says they already have e-Builder?"* — and get a role-ready, source-cited answer.
3. **Generate an asset:** try `/battlecard` for a live competitive deal. Output lands as a draft; nothing ships without PMM admin approval.

Two modes of work: **operating** (PMM outputs into `GTM-War-Room/`) and **building** (the web app in `app/`). `CLAUDE.md` defines both, plus the non-negotiable rules.

## Where to Go Next

- [`PMM Agent — Master Instructions & Contex.md`](<PMM Agent — Master Instructions & Contex.md>) — the system constitution every agent obeys
- [`pmm-playbook/`](pmm-playbook/) — 10 volumes on building and operating the PMM Agent (product, domain, architecture, agents, operating model, integrations, AI engineering, roadmap, templates, prompts)
- [`engineering-playbook/`](engineering-playbook/) — the Aurigo engineering standards base and the product-truth corpus the PMM agents draw facts from
