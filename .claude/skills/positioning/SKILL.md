---
name: positioning
description: Run the positioning workshop for a product or product line — the six-step April Dunford build ending in the approved positioning statement. Use when the user asks to create, revisit, test, or debate positioning, says "positioning workshop", questions the category or differentiation, or when messaging-framework refuses to run because positioning is missing or unapproved.
---

# Positioning Workshop

Positioning is how we want to be seen: market category, who it's for, what it solves,
what it replaces, why it's better. It is an internal alignment tool, debated with sales,
product, and leadership — not customer copy. It sits at the top of the strict chain:
positioning → messaging → copy (§3.2). Everything downstream inherits its quality.

## Required reading

1. `PMM Agent — Master Instructions & Contex.md` — §3.2 (chain), §7.1 (positioning standard), §8.1 (anti-generic mandate).
2. `GTM-War-Room/BRAND-DNA/positioning-and-icp.md` and `our-customer.md` — current state and raw buyer language.
3. `GTM-War-Room/MARKET-INTELLIGENCE/competitive/` — you cannot position without knowing the alternatives. If dossiers are missing or older than 30 days (today: 2026-08-06), dispatch the `competitive-intel` agent first and wait for its output.
4. `engineering-playbook/vol-1-company/03-product-strategy.md` and `vol-2-product-knowledge/` for the product in scope.

## Step 0 — Intake (AskUserQuestion)

1. **Scope** — which product: Masterworks, Essentials, Primus, or the AI layer (Masterworks AI / Primus AI, running on Lumina)? Positioning varies per product line.
2. **Trigger** — why now? New market entry, losing deals to a specific competitor, category confusion, launch prep? The trigger shapes which step needs the most debate.
3. **Who must align** — which stakeholders (sales, product, leadership) will debate this? Note them for the influence-squad map (§7.5).
4. **Segment** — public owners (government agencies) or facility owners? This constrains vocabulary (program vs. portfolio) and the competitive set.

## The six-step build (§7.1)

Run each step as its own AskUserQuestion round. Draft candidate answers from the war room
and corpus first; present them with your reasoning; let the PMM pick, edit, or reject.
Do not advance a step until the current one is settled.

### Step 1 — Pick the category
The market frame buyers already understand. Candidates for Aurigo: capital program management, construction program management, asset life cycle software. Test: does the category set the right expectations and the right competitive set? Name what the product **replaces** (spreadsheets, Primavera, homegrown tools) — the enemy is part of the category choice.

### Step 2 — Narrow the audience
Not "everyone who builds things." Use the audience hierarchy: capital owners → public owners (federal / state & local government) or facility owners (data centers, manufacturing, life sciences, energy and utilities). Narrower audience, sharper claim.

### Step 3 — Frame outcomes, not tasks
What the audience *achieves*, not what the software *does*. "On-time program delivery, audit readiness, budget adherence" — not "document management and workflows." If a draft outcome names a feature, push it up one level to the result the buyer reports to their board or legislature.

### Step 4 — Describe the approach
The how, in one clause: the mechanism that makes the outcomes credible (e.g., one system across plan, build, operate, and maintain; AI-native agents on the Lumina data model). Approach explains, it does not sell.

### Step 5 — Showcase unique value
What only we can claim for this audience. Draft 3–5 candidates and kill the weak ones with the anti-pattern check below.

### Step 6 — Share proof
Named customers, numbers, dates. Proof must sit adjacent to the claim it supports. Pull from `GTM-War-Room/PLAYBOOKS-AND-ASSETS/case-studies/` and vol-1 customer docs; if none exists, flag the gap — unproven positioning ships as "draft, proof pending", never silently.

## Assemble the formula

> "We are a **[Category]** that helps **[Audience]** achieve **[Outcomes]** by **[Approach]**. What sets us apart is **[Differentiated Value]** backed by **[Proof]**."

One sentence pair, no more. If it needs a paragraph of caveats, a step above is unsettled — go back.

## Anti-pattern check (mandatory, before presenting the final statement)

For **every** claim in the statement, ask: could Oracle, Kahua, e-Builder, or Procore say
this word-for-word about themselves? If yes, the claim is not positioning, it is noise —
rewrite or delete. "Customer-obsessed", "end-to-end", and "trusted by leaders" always fail
this test. Specific beats generic every time (§7.1, §8.1). Also verify:

- Outcomes are outcomes (step 3), not renamed features.
- The audience term matches the approved hierarchy; "infrastructure owners" is retired.
- AI claims use "AI-native" only; the sole approved powered-by construction is "Masterworks AI, powered by Lumina".

## Output

Write to `GTM-War-Room/BRAND-DNA/positioning-and-icp.md` (create or update the product's
section) with frontmatter `product`, `audience: internal`, `stage: draft`, `sources`, `date`:

```markdown
## Positioning — <Product> (draft 2026-08-06)
**Statement:** We are a … backed by ….
**Category:** … | **Replaces:** … | **Enemy:** …
**Audience:** … | **Outcomes:** … | **Approach:** …
**Differentiated value:** … (each claim with the competitor it excludes)
**Proof:** … (named, numbered, dated)
**Rejected claims:** … (and which competitor could equally make them)
**Alignment plan (§7.5):** core champions / strategic partners / key influencers / adopters
```

Keep the rejected-claims list — it prevents relitigating them next quarter.

## Quality gate

1. Run the `asset-qa` skill on the written file; fix failures.
2. Swap test on the full statement: replace Aurigo with Oracle and with Kahua. If it still reads true, return to step 5.
3. State the approval requirement: positioning stays `draft` until the PMM marks it approved. The `messaging-framework` skill will refuse to run against an unapproved statement.
4. End with proposed updates to `competitors.md` or `our-customer.md` if the workshop surfaced new intelligence (§8.5).
