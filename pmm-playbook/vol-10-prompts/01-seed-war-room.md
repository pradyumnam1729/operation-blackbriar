# 01 — Seed the War Room

## When to Use

- Standing up `GTM-War-Room/` for a new product line (or, at GA, a new tenant's first run).
- The hackathon-MVP seeding of the Aurigo war room (`pmm-playbook/vol-8-roadmap/01-hackathon-mvp.md`).
- After a major corpus change, to verify the war room still covers what agents need.

This brief satisfies the Master Instructions §2.1 prerequisite: codified context before any agent produces output. Run it before anything else; every other brief in this library assumes a seeded war room.

## The Brief

Replace `[PRODUCT]` and `[SOURCE CORPUS]`. Paste in full:

---

I want to seed the GTM War Room for **[PRODUCT]**. Read all brand files first. Ask me clarifying questions using AskUserQuestion before you execute. Do not guess.

**Context.** Read, in order:
1. `PMM Agent — Master Instructions & Contex.md` §4 (the war-room structure and the four brand files)
2. `Voice of Aurigo - Standards Reference.md` (terminology, banned phrases, audience hierarchy)
3. The source corpus: `[SOURCE CORPUS — e.g., engineering-playbook/vol-1-company/ and engineering-playbook/vol-2-product-knowledge/]`
4. `reference output/` for the quality bar

**End state.** The `GTM-War-Room/` tree per §4, populated for [PRODUCT]:
- The four `BRAND-DNA/` files: `positioning-and-icp.md`, `brand-voice.md` (derived from the Voice standards, not duplicating them — reference and extend), `our-customer.md` (verbatim customer language only — where the corpus has none, leave a marked gap, do not invent quotes), `gtm-rules.md` (operating rules + forbidden-words list compiled from the Voice standards).
- Context files: `about-me.md` (company stage per §10), `competitors.md`, `personas.md`, `strategy.md` (current OKRs — ask me for them), `product-wiki.md` (market-language digest of the corpus per `pmm-playbook/vol-6-integrations/06-product-truth.md`).
- Skeleton folders with README stubs: `ACTIVE-LAUNCHES/`, `PLAYBOOKS-AND-ASSETS/`, `MARKET-INTELLIGENCE/` (all four subfolders).
- Every file carries frontmatter (`product`, `audience`, `persona`, `stage: draft`, `sources`, `date`) per `CLAUDE.md` conventions.

**Constraints.**
- Every fact traces to the source corpus; cite the source file in each war-room file's frontmatter. No invented customers, quotes, metrics, or competitor claims.
- Where the corpus cannot support a required section, write a `> GAP:` marker naming what is missing and how to get it (transcript import, win-loss interview, etc.) — per `CLAUDE.md`, guessing is a failure mode.
- Voice rules apply to any customer-facing language drafted; "life cycle" two words, "AI-native" only, program/portfolio by segment.
- End with a seeding report: what was populated, what is gapped, and the proposed order for closing gaps.

---

## Expected Output

- A populated `GTM-War-Room/` tree, all files `stage: draft`, every file sourced.
- A seeding report listing coverage and gaps, with a prioritized gap-closing plan.
- No proposed content silently applied to brand DNA — the PMM admin reviews the four brand files line by line before any other brief runs against them.

## Follow-Ups

- Run `02-build-foundation-doc.md` for the product once brand DNA is approved.
- Route gap items to their owning pipelines: transcript gaps to `pmm-playbook/vol-6-integrations/02-call-intelligence.md` intake, competitive gaps to `03-weekly-competitive-sweep.md`.
- Schedule the first governance audit (`09-content-audit.md`) 30 days out to catch seeding drift.
