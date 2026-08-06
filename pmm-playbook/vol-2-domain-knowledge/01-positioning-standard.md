# 01 — Positioning Standard

*Sources: April Dunford (Obviously Awesome), Tamara Grominsky. Encoded from Master Instructions §7.1.*

---

## What Positioning Is

Positioning is how you want to be seen: the market category you claim, who the product is for, what it solves, what it replaces, and why it is better. It is an internal alignment tool first — debated with sales, product, and leadership before any buyer sees a word derived from it. It varies per product line, and it is the root node of everything: messaging is built on positioning, copy is built on messaging, and nothing skips a layer ([chapter 02](02-positioning-messaging-copy-chain.md)).

Positioning answers one blunt question: **what is your product, and who is your enemy?** The "enemy" is the alternative the buyer would otherwise choose — a competitor, a spreadsheet, doing nothing. A positioning statement that names no enemy has not made a choice, and positioning that chooses nothing positions nothing.

---

## The Formula

> "We are a **[Category]** that helps **[Audience]** achieve **[Outcomes]** by **[Approach]**. What sets us apart is **[Differentiated Value]** backed by **[Proof]**."

Worked example, our own product ([Vol 1, ch. 03](../vol-1-product/03-value-props.md)):

> We are an **in-house product marketing knowledge engine** that helps **PMM teams at multi-product B2B companies** achieve **consistent, on-demand go-to-market support for every role** by **enforcing one rigorous foundational doc per product and generating every answer and asset from it**. What sets us apart is **mechanical consistency — every output traces to an approved source — backed by** minutes-not-days turnaround measured in our own asset logs.

Every slot must be filled with a choice, not a hedge. "Companies of all sizes" is not an audience. "Better outcomes" is not an outcome.

---

## The Six-Step Build

| Step | Instruction | Common failure |
|------|-------------|----------------|
| 1. Pick the category | Choose the market frame the buyer already understands, or deliberately reframe. The category sets every default assumption. | Inventing a category nobody searches for (undifferentiated category creation — §8.2's avoid list). |
| 2. Narrow the audience | Name who it is for so precisely that it excludes people. Exclusion is the point. | "For everyone who…" — an audience with no edges. |
| 3. Frame desired outcomes | Outcomes, not tasks. What is true in the buyer's world after adoption. | Listing features as outcomes ("get dashboards"). |
| 4. Describe the approach | How the product produces those outcomes, in one breath. | Architecture tours. The approach is a mechanism, not a diagram. |
| 5. Showcase unique value | The claim only you can make. This is where the enemy matters: unique relative to whom? | Claims from the shared-adjective pool (below). |
| 6. Share proof | Evidence near the claim: numbers, named customers, measurable before/after. | Proof stapled at the end, unlinked to any claim. |

Work the steps in order. Steps 5 and 6 are worthless if steps 1 and 2 were skipped, because "unique" and "proven" are relative to a category and an audience.

---

## The Anti-Pattern Check

Before any positioning output is accepted, run the rejection test from §7.1:

**Reject any claim a competitor could equally make.**

- "Customer-obsessed" — every vendor claims it. Rejected.
- "Revenue-driven" — same. Rejected.
- "Easy to use," "trusted by industry leaders," "innovative" — the shared-adjective pool. Rejected.

The operational form is the **swap test** (`../../Voice of Aurigo - Standards Reference.md`): replace our name with a competitor's name. If the sentence still works, the claim is not positioning — it is wallpaper. Rewrite until the sentence is only true of us.

Specific beats generic every time. "Reduces asset turnaround from days to minutes, with every asset traced to an approved source" survives the swap test. "Streamlines your marketing workflow" does not.

---

## Rules the System Enforces

1. **Positioning is per product line.** Masterworks, Essentials, Primus, and Lumina each carry their own positioning section in their foundational doc; they share a company story but not a statement.
2. **Positioning is versioned and approved.** It lives as the first section of the foundational doc ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)); changes invalidate downstream messaging until re-validated.
3. **Positioning is fed, not guessed.** Inputs come from validated intelligence — win/loss (A4), competitive (A3), ICP (A2) — per the intelligence-before-activation gate (§3.1).
4. **The anti-pattern check is a gate, not advice.** The asset-qa skill and C12 run it on every positioning-derived output before draft → final.

---

## Reference Example in This Repo

Aurigo's own positioning discipline is visible in `../../engineering-playbook/vol-1-company/06-competitive-landscape.md`: the "six strategic lenses" section is positioning practice at work — name the lens, then the gap, then the answer; never name the feature first. Use it as the worked example when seeding the Aurigo foundational docs.

---

*Next: [02 — Positioning → Messaging → Copy Chain](02-positioning-messaging-copy-chain.md)*

Last updated: 2026-08-06
