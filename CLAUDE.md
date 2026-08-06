# Operation Blackbriar — The PMM Agent

This repository is the workspace for building and operating the **PMM Agent**: a web app that gives product marketers a standardized framework to build one rigorous foundational doc per product (positioning, value props, competitive intel, brand guardrails, JTBDs) — and turns that foundation into a live knowledge engine that Sales, Proposals, Marketing, and Leadership can query in plain language to get crisp, role-ready answers and customer-ready assets in minutes.

**Value props we are building toward (and must be able to demo):**
- 90% faster sales asset creation — minutes instead of days for customer-ready collateral
- 100% messaging consistency across customer-facing assets
- Support 3–5× more products, industries, and personas per PMM
- Faster response to new market opportunities

Aurigo is the first customer of this system. All seeded content uses Aurigo (Masterworks, Essentials, Primus, Lumina) as the reference product portfolio.

---

## Read this before anything else

Read order for any new session or sub-agent:

1. `PMM Agent — Master Instructions & Contex.md` — the system constitution. Philosophy, frameworks, guardrails, the 14 sub-agents, quality standards. Every agent obeys it.
2. `GTM-War-Room/BRAND-DNA/` — the four brand files (positioning-and-icp, brand-voice, our-customer, gtm-rules). Minimum viable context for any output.
3. `Voice of Aurigo - Standards Reference.md` — voice constants, banned phrases, terminology rules. Applies to every word of customer-facing output.
4. Task-specific war-room files (competitive, win-loss, personas, product-wiki) as directed by the sub-agent definition.

If the war-room files needed for a task are missing or stale, say so and propose how to populate them. **Guessing is a failure mode.** No activation output ships without validated upstream intelligence.

## Repository map

```
operation-blackbriar/
├── CLAUDE.md                                  ← you are here
├── PMM Agent — Master Instructions & Contex.md ← system constitution (read first)
├── Aurigo Brand Standards.md                  ← visual brand specs (colors, logo, type)
├── Voice of Aurigo - Standards Reference.md   ← voice, banned phrases, terminology
├── GTM-War-Room/                              ← the live knowledge base (the product's data)
│   ├── BRAND-DNA/                             ← 4 brand files — every agent reads these
│   ├── ACTIVE-LAUNCHES/[launch]/              ← per-launch briefs, assets, enablement
│   ├── PLAYBOOKS-AND-ASSETS/                  ← messaging library, battlecards, case studies
│   ├── MARKET-INTELLIGENCE/                   ← competitive, win-loss, voice-of-market, ICP
│   └── *.md                                   ← about-me, competitors, personas, strategy, product-wiki
├── pmm-playbook/                              ← how we build & operate the PMM Agent (10 volumes)
├── engineering-playbook/                      ← Aurigo engineering base standards + product-knowledge corpus
├── reference output/                          ← exemplar outputs (quality bar for generated assets)
├── app/
│   ├── backend/                               ← Express + TypeScript API (Claude API, war-room retrieval, guardrails)
│   └── frontend/                              ← React + Vite UI (foundation builder, ask, assets, approvals)
└── .claude/
    ├── agents/                                ← 14 PMM sub-agents + build agents
    ├── skills/                                ← repeatable PMM workflows (/battlecard, /asset-qa, …)
    └── hooks/                                 ← session-start context injection, forbidden-words guard
```

## The two modes of work

This repo hosts two kinds of sessions. Know which one you are in.

**1. Operating mode (PMM work).** Producing positioning, messaging, battlecards, launch plans, answers to role-based queries. Use the PMM sub-agents in `.claude/agents/` and the skills in `.claude/skills/`. All outputs land in `GTM-War-Room/` — drafts first, never straight to final.

**2. Building mode (engineering work).** Designing and building the PMM Agent web app in `app/`. Follow `pmm-playbook/vol-3-architecture/` for the app architecture and `engineering-playbook/` (vol-3 architecture standards, vol-9 templates) for coding, review, and documentation standards. The app encodes the operating-mode rules as product behavior: foundational-doc builder, role-aware query engine, asset generator, approval gates.

App stack: `app/backend` is Express + TypeScript wrapping the Claude API (`claude-opus-4-8`, adaptive thinking, brand DNA as a cached system-prompt prefix); it reads/writes `GTM-War-Room/` directly, so the app and this workspace share one knowledge base. `app/frontend` is React + Vite styled per Aurigo Brand Standards (Dark Teal `#015F74`, Roboto, sharp corners — never rounded). Backend dev: `cd app/backend && npm run dev` (port 3001, needs `ANTHROPIC_API_KEY` in `.env`). Frontend dev: `cd app/frontend && npm run dev` (port 5173, proxies `/api`).

## Non-negotiable rules (both modes)

1. **Positioning → messaging → copy.** Never jump from positioning straight to copy. Messaging is always the bridge (Master Instructions §3.2).
2. **The anti-generic mandate.** Before promoting any output: Could this belong to another brand? Does it survive the swap test (replace "Aurigo" with "Oracle"/"Kahua" — if the sentence still works, rewrite)? Does it use raw customer language from `our-customer.md`? (§8.1)
3. **Draft → approval → final.** All outputs are written as drafts. Nothing moves to final or ships without PMM admin approval. The system proposes; the human decides. (§8.4)
4. **Business translation.** Every insight ends as: [customer insight] → [specific action] → [named metric] → [stakeholder who owns it]. No raw observations. (§3.3, §7.3)
5. **Brief, don't prompt.** Every task starts with the intake protocol: read brand files, ask clarifying questions via AskUserQuestion before executing, state Context + End State + Constraints. (§6)
6. **Propose context updates.** Any task that surfaces new insight ends with proposed (not applied) updates to the relevant war-room files. (§8.5)
7. **HANDOVER.md.** At session end, write `GTM-War-Room/HANDOVER.md`: what was worked on, decisions made, outstanding items, context the next session needs.

## Aurigo voice — the rules most often violated

The full list lives in `Voice of Aurigo - Standards Reference.md`. These are enforced by the PostToolUse hook and must never appear in customer-facing output:

- **"AI-native" is the only approved AI modifier.** Never AI-powered / AI-driven / AI-enabled (body copy).
- **"life cycle"** — two words, never "lifecycle". **"infrastructure"** — never pluralized.
- **Program vs. portfolio:** government agencies run *programs* (Masterworks/Essentials); facility owners run *portfolios* (Primus). Never swap.
- **No ROI in public-sector copy** — use "program outcomes" or "capital program performance".
- **Never "the" before org abbreviations** ("FHWA requires…", not "the FHWA requires…").
- **Open from the reader's world**, not from Aurigo or the product. This is the cardinal rule.
- Banned: hassle-free, effortlessly, seamless, circle back, "single source of truth" (use "unified system"), "infrastructure owners" (retired term).
- Em dashes: max 1–2 per page. Binary contrast framing ("This is not X. It is Y."): max once per piece.

## Sub-agent roster

The 14 PMM sub-agents (defined in `.claude/agents/`, specified in Master Instructions §12):

| Group | Agents |
|-------|--------|
| A — Intelligence | voice-of-market, icp-persona, competitive-intel, win-loss, customer-evidence |
| B — Activation | product-to-market, launch-orchestration, sales-enablement, adoption-expansion, pricing-packaging |
| C — Governance | messaging-effectiveness, content-governance, gtm-performance, pmm-prioritization |

Build agents for engineering mode: `app-architect`, `ui-engineer`, `qa-reviewer`.

**Routing rule:** Intelligence agents feed activation agents; activation agents cannot produce buyer-facing assets without validated intelligence inputs. Governance agents audit everything. When a request arrives, triage it per the rocks/pebbles/sand allocation (§3.5) before dispatching.

## Skills

Invoke with `/name` or the Skill tool: `foundation-doc` (build/refresh the foundational doc), `positioning`, `messaging-framework`, `battlecard`, `launch-brief`, `ask-war-room` (role-aware Q&A), `asset-qa` (voice + anti-generic gate — run before any output is promoted), `handover`.

## Conventions

- Everything is Markdown. Assets carry a frontmatter block: `product`, `audience`, `persona`, `stage` (draft/final), `sources` (war-room files used), `date`.
- Dates are absolute (YYYY-MM-DD). Today's stage: hackathon MVP.
- File names: kebab-case. Launch folders: `ACTIVE-LAUNCHES/<launch-name>/` per the tree in Master Instructions §4.
- Commit messages: `pmm(<area>): <what changed>` for war-room/content, `app(<area>): <what changed>` for the web app, `docs(playbook): [vol-N] <what changed>` for playbooks.
