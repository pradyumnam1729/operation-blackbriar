---
name: foundation-doc
description: Build or refresh the foundational doc for a product — the one rigorous document (positioning, ICP and personas, JTBDs, value props, competitive summary, brand guardrails, proof points, objection library) that everything else derives from. Use when the user says "foundational doc", "foundation doc", "set up the war room for [product]", "onboard a new product", or when any other skill finds the brand files missing or stale. This is the workflow the web app's foundational doc builder encodes.
---

# Foundation Doc — Build or Refresh

This is the core PMM workflow. The foundational doc is the upstream source for every
battlecard, launch brief, message, and answer the system produces. Rigor here compounds;
gaps here become generic output everywhere downstream. Keep the section framework exactly
as specified — the web app standardizes on it.

## Required reading (in order, before anything else)

1. `PMM Agent — Master Instructions & Contex.md` — §4 (war room), §6 (intake), §7 (five standards), §8 (quality gates).
2. `Voice of Aurigo - Standards Reference.md` — voice constants, terminology, banned phrases.
3. Existing `GTM-War-Room/BRAND-DNA/` files, if present — this may be a refresh, not a build. Never overwrite validated content without showing the PMM the diff.
4. Source corpus for the product:
   - `engineering-playbook/vol-1-company/` — vision, product strategy, customers, success metrics, AI strategy.
   - `engineering-playbook/vol-2-product-knowledge/` — `masterworks/`, `primus/`, and `domains/` for feature-level truth.
   - `GTM-War-Room/MARKET-INTELLIGENCE/` and `GTM-War-Room/*.md` (competitors, personas, product-wiki) if populated.

If a needed source is missing, say so and propose how to populate it. Guessing is a failure mode (§2.1).

## Step 0 — Intake (AskUserQuestion, one question set)

Ask before executing (§6). Minimum:

1. **Which product?** Masterworks / Essentials / Primus / Lumina-layer (Masterworks AI, Primus AI). One foundational doc per product.
2. **Build or refresh?** If refresh: which sections changed and why (new win/loss data, competitor move, repositioning)?
3. **Primary segment for this doc?** Public owners (government agencies) vs. facility owners — this drives program/portfolio terminology and whether ROI language is allowed.
4. **What validated intelligence exists?** Call transcripts, win/loss interviews, G2 reviews, analyst input — or none yet.

## Step 1 — Interview the PMM, section by section

Work through the eight sections below **in order, one AskUserQuestion round per section**.
For each: (a) draft from the source corpus first, (b) present the draft plus what you could
not source, (c) ask targeted questions to fill gaps and confirm. Do not ask questions the
corpus already answers — that wastes the PMM's time. Do not silently invent answers the
corpus does not contain.

## Step 2 — The eight sections (standardized framework)

### 1. Positioning
April Dunford formula (§7.1): "We are a [Category] that helps [Audience] achieve [Outcomes] by [Approach]. What sets us apart is [Differentiated Value] backed by [Proof]."
Include: market category, who it's for, what it replaces, why it's better, the enemy.
For a full workshop, run the `positioning` skill and embed its approved output here.
Anti-pattern check: reject any claim a competitor (Oracle, Kahua, e-Builder, Procore) could equally make.

### 2. ICP & personas
Named segments per the audience hierarchy (capital owners → public owners / facility owners), firmographics, and named buyer personas: role, pains, goals, buying triggers, objections, exact vocabulary they use. Raw customer language, not summaries.

### 3. Jobs to be done
3–7 JTBDs: "When [situation], I want to [motivation], so I can [outcome]." Tie each to the persona who hires the product for it and the evidence source (call, interview, review).

### 4. Value propositions
Each per the §7.4 schema — all six fields, no exceptions:
use case + context / the problem to overcome / the feature or product that solves it / how it delivers value (capability) / the benefit derived / the cost of not solving it.

### 5. Competitive intel summary
Per competitor: category, where we win, where they win, landmines to plant, landmines to avoid. Source from `GTM-War-Room/MARKET-INTELLIGENCE/competitive/` dossiers. If a dossier is missing or older than 30 days (today: 2026-08-06), dispatch the `competitive-intel` agent to refresh before summarizing.

### 6. Brand guardrails
Product-specific voice rules layered on the Voice of Aurigo standard: terminology (program vs. portfolio for this segment), approved AI framing ("AI-native"; "Masterworks AI, powered by Lumina" is the only approved powered-by construction), claims requiring proof, claims never to make.

### 7. Proof points
Quantified, sourced, dated. Each: claim → number → named customer or evidence source → date → which persona it lands with. No orphan claims.

### 8. Objection library
Each objection: verbatim buyer phrasing → root cause → one-line response → supporting proof point → escalation path if the one-liner fails.

## Step 3 — Write the outputs

Two destinations, both markdown with frontmatter (`product`, `audience`, `persona`, `stage: draft`, `sources`, `date` YYYY-MM-DD):

1. **Brand DNA (shared layer)** — create or update in `GTM-War-Room/BRAND-DNA/`:
   `positioning-and-icp.md`, `brand-voice.md`, `our-customer.md`, `gtm-rules.md`.
   Fold sections 1–2 and 6 into these. On refresh, show a before/after diff and get explicit approval per file.
2. **Per-product foundational doc** — `GTM-War-Room/PLAYBOOKS-AND-ASSETS/messaging-library/<product>-foundation.md`
   containing all eight sections under these exact H2 headings:
   `## Positioning`, `## ICP & Personas`, `## Jobs to Be Done`, `## Value Propositions`,
   `## Competitive Intel Summary`, `## Brand Guardrails`, `## Proof Points`, `## Objection Library`.

## Step 4 — Quality gate (before finishing)

1. Run the `asset-qa` skill on every file written. Fix all failures.
2. Verify every value prop has all six §7.4 fields and every proof point has a source and date.
3. Verify the positioning survives the swap test (§8.1).
4. Stage stays `draft`. State plainly: "This foundational doc awaits PMM approval before anything downstream uses it as validated input."
5. End with proposed (not applied) updates to other war-room files this work surfaced (§8.5), then note the session in the next `handover` run.
