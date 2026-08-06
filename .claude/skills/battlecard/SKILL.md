---
name: battlecard
description: Create or update a two-page competitive battlecard. Use when sales faces a competitor in a live deal, when the user asks for a battlecard, when competitive dossiers change, or when win-loss findings implicate a competitor. Requires fresh competitive intelligence — dispatches the competitive-intel agent if the dossier is missing or older than 30 days.
---

# Battlecard — Create or Update

A battlecard arms a rep for a specific competitive conversation: what to say, what to
plant, what to avoid, and the proof to back it. It is internal sales enablement — direct
and candid — but it feeds buyer-facing conversation, so claims must be evidence-backed
and free of trash-talk (the narrative-arc rule: "why alternatives aren't enough" is a
maturity model with ceilings, not a comparison-table dunk).

## Required reading

1. `PMM Agent — Master Instructions & Contex.md` — §6, §7.2 (step 5), §8, §12 (B8 continuous update loop).
2. `GTM-War-Room/BRAND-DNA/positioning-and-icp.md` and `our-customer.md`.
3. `GTM-War-Room/MARKET-INTELLIGENCE/competitive/<competitor>.md` — the dossier for this competitor.
4. `GTM-War-Room/MARKET-INTELLIGENCE/win-loss/` — losses and wins against this competitor.
5. The existing battlecard in `GTM-War-Room/PLAYBOOKS-AND-ASSETS/battlecards/`, if one exists — update, never fork.

## Freshness gate (before drafting)

Check the `date` in the competitor's dossier frontmatter against today (2026-08-06):

- **Dossier missing, or older than 30 days** → dispatch the `competitive-intel` agent (`.claude/agents/competitive-intel.md`) to sweep this competitor first. Wait for its refreshed dossier; do not draft from stale intelligence. Tell the user this is happening and why.
- **Dossier fresh** → proceed.

A battlecard built on stale intel gets a rep ambushed in a live deal. Never skip this gate.

## Step 0 — Intake (AskUserQuestion)

1. **Competitor** — which one? (Typical set: Oracle Primavera/Unifier, Kahua, e-Builder/Trimble, Procore — validate against `GTM-War-Room/competitors.md`.)
2. **Context** — live deal (which segment, which product — Masterworks/Essentials for public owners, Primus for facility owners) or scheduled refresh? A deal-triggered card gets deal-specific proof points; a refresh updates the standing card.
3. **What triggered this?** Rep report, competitor announcement, lost deal? The trigger tells you which sections need the most attention.
4. **Deadline** — live deals are sand (§3.5): tightly scoped, fast turnaround. Confirm scope.

## The two-page structure

Page limit is a feature: if it doesn't fit on two pages, reps won't use it. Every claim
about the competitor carries a source and date from the dossier. Sections, in order:

```markdown
---
product: <ours in this matchup>
audience: internal-sales
competitor: <name>
stage: draft
sources: [competitive/<competitor>.md, win-loss/<files>, ...]
date: 2026-08-06
---
# Battlecard — <Competitor> vs. <Aurigo product>

## Snapshot (5 lines max)
Who they are, category, target buyer, pricing model, where we most often meet them.

## Their strengths (be honest)
3–5, evidence-backed. A card that pretends the competitor has no strengths gets ignored
after the first deal where the rep discovers otherwise.

## Their weaknesses
3–5, each with the ceiling it creates for the buyer — not adjectives. Skip any weakness
every vendor in the category shares; that is not intelligence (§8.1).

## Talk track
The 60-second framing a rep uses when this competitor comes up. Reader-first: open from
the buyer's constraint, not from our product. Follows the maturity-model logic — where
the competitor's approach tops out and what becomes possible past that ceiling.

## Landmines to plant
Questions the rep seeds that the competitor answers badly ("Ask them how change orders
flow to the capital plan without re-keying"). Each landmine: the question + why it hurts
them + the follow-up when the buyer relays their answer.

## Landmines to avoid
Topics where the competitor beats us. For each: the trap + the honest reframe. Never
coach a rep to bluff.

## Objection one-liners
Top 3–5 objections a buyer raises when leaning toward this competitor. Verbatim buyer
phrasing (from win-loss / our-customer.md) → one-line response → proof point.

## Kill points
The 2–3 claims that most reliably end this competitor's bid in our segments, each with
its proof adjacent. These must survive the swap test — a kill point they could claim
against us is not a kill point.

## Proof
Named customers, numbers, dates that back the card. No orphan claims anywhere above.
```

## Output

Save to `GTM-War-Room/PLAYBOOKS-AND-ASSETS/battlecards/<competitor>-vs-<product>.md`
(kebab-case). On update, preserve the file name and note changes in a `## Changelog`
line at the bottom (`2026-08-06: refreshed weaknesses + kill points after <trigger>`).

## Quality gate

1. Run the `asset-qa` skill on the card; fix all failures.
2. Freshness: confirm every competitor claim cites the dossier or a dated source.
3. Honesty: strengths section is non-empty and real; landmines-to-avoid is non-empty.
4. Two pages: roughly 700–900 words. Cut, don't shrink the font.
5. Stage stays `draft` until PMM approval (§8.4). End by proposing updates to `competitors.md` and the objection library if the work surfaced new intelligence (§8.5), and flag any positioning claim the intel weakened.
