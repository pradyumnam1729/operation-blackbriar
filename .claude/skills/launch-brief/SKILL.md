---
name: launch-brief
description: Scaffold a launch — create the ACTIVE-LAUNCHES/[launch-name]/ tree with BRIEF.md, messaging, objections, enablement, and channel files, recommend the launch tier, and build the launch story on the 7-step narrative arc. Use when the user announces an upcoming launch or release, asks for a launch brief or launch plan, or when a product update needs a coordinated go-to-market push.
---

# Launch Brief — Scaffold and Plan

A launch is coordinated GTM action, not a launch-day social blitz. This skill creates the
full launch workspace per Master Instructions §4, recommends the tier, and drafts the
brief with the launch story on the 7-step narrative arc (§7.2). Asset production
(messaging, battlecards, channel copy) happens downstream in the scaffolded files,
gated on this brief's approval.

## Required reading

1. `PMM Agent — Master Instructions & Contex.md` — §4 (tree), §7.2 (narrative arc), §8.3 (AEO), §10 (stage-aware behavior), §12 (B7 Launch Orchestration).
2. `GTM-War-Room/BRAND-DNA/` — all four brand files; `about-me.md` for company stage.
3. Approved positioning for the product (`positioning-and-icp.md`) and the messaging library for the affected audiences. If positioning is unapproved, stop and route to the `positioning` skill — a launch cannot ship on unvalidated claims (§3.1).
4. Product truth for what's launching: `engineering-playbook/vol-2-product-knowledge/` and `GTM-War-Room/product-wiki.md`.

## Step 0 — Intake (AskUserQuestion)

1. **What is launching?** Product, capability, or release — and for which product line (Masterworks, Essentials, Primus, Masterworks AI / Primus AI on Lumina)?
2. **Target date and segment** — absolute date (YYYY-MM-DD); public owners or facility owners? Segment sets terminology and channels.
3. **Why does it matter to the buyer?** What breaks or costs money today without it? If nobody can answer, flag it: the launch story has no spine yet, and voice-of-market input is needed first.
4. **Evidence available** — beta customers, pilot numbers, reference candidates? Feeds arc step 7.
5. **Company stage** — confirm against `about-me.md` (0→$2M / $2M→$15M / $15M→$100M). Stage sets motion and deliverable depth (§10).

## Step 1 — Recommend the launch tier

Score against: revenue impact, strategic importance (traces to a company OKR? if not, flag as sand per §3.5), audience breadth, competitive significance.

- **Tier 1** — new product, new market, or repositioning. Full tree, all channels, analyst briefings, ABM plan.
- **Tier 2** — major capability for an existing audience. Full tree, selected channels, sales enablement mandatory.
- **Tier 3** — incremental improvement. BRIEF.md + messaging + one channel; no enablement build-out.

Present the recommendation with reasoning and confirm via AskUserQuestion. Adjust the scaffold to the confirmed tier — do not build Tier-1 scaffolding for a Tier-3 release.

## Step 2 — Scaffold the tree (§4)

Create under `GTM-War-Room/ACTIVE-LAUNCHES/<launch-name>/` (kebab-case):

```
ACTIVE-LAUNCHES/<launch-name>/
├── BRIEF.md
├── assets/
│   ├── messaging.md          ← stub: pointer to messaging-library source + launch-specific value props (schema §7.4)
│   └── objections.md         ← stub: anticipated objections, seeded from the objection library
├── enablement/
│   ├── battlecards/          ← empty dir + README line naming which competitor cards need refresh
│   └── one-pager.md          ← stub: audience, outcome, structure per narrative arc
└── channels/
    ├── email.md              ← stub: sequence plan, no copy yet
    └── social.md             ← stub: channel plan, no copy yet
```

Every stub carries frontmatter (`product`, `audience`, `stage: draft`, `sources`, `date`) and a one-line statement of what goes in it and which upstream approval it waits on. Stubs are honest scaffolding, not filler copy.

## Step 3 — Write BRIEF.md

```markdown
# Launch Brief — <name> (target: YYYY-MM-DD)
## Summary          — what ships, for whom, tier + rationale, OKR it traces to
## Launch story     — the 7-step arc (below)
## Audiences        — personas, segments, and what each must come to believe
## Deliverables     — per tier: owner, dependency, due date (absolute), status
## Channel plan     — stage-aware mix per §10; Tier 1 adds ABM + analyst briefings
## AEO plan         — see below
## Readiness gates  — what must be approved before launch-day (messaging, enablement, proof)
## Risks & open questions
```

**The launch story (7-step arc, §7.2)** — draft all seven steps, buyer-centered:
1. *The old way* — quantifiable status quo the buyer sees themselves in
2. *What changed* — specific, tied to their metrics (never "AI is changing everything")
3. *The tension* — the forced tradeoff they can feel
4. *Cost of inaction* — quantified, named risks
5. *Why alternatives aren't enough* — maturity model with ceilings, no trash-talk
6. *What success looks like* — capability stack, what becomes possible (no feature dump)
7. *Proof* — before/after, proof adjacent to claims, objections pre-answered

The story is the leave-behind logic that arms a champion to sell internally. It's about them, not us.

**AEO plan (§8.3)** — how launch content gets found when buyers ask an AI: the 3–5 natural-language questions this launch should be the answer to; which pages/FAQ entries answer each in the first 50 words; structured, citable facts (numbers, product names in full, dates); direct-answer formatting alongside the SEO plan.

## Quality gate

1. Run the `asset-qa` skill on BRIEF.md and all stubs; fix failures.
2. Arc check: all seven steps present, step 5 has no comparison-table dunking, proof sits next to claims.
3. Stage check: deliverables and channel mix match the company stage from `about-me.md`.
4. Chain check: no finished channel copy anywhere — channels/ files hold plans until messaging is approved.
5. Stage stays `draft`; the brief awaits PMM approval before any deliverable work starts. End with proposed war-room updates (§8.5) and record the launch in the next `handover`.
