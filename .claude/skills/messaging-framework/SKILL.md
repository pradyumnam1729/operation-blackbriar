---
name: messaging-framework
description: Build the messaging layer from approved positioning — value propositions in the six-field schema, keyed by audience, funnel stage, and channel. Use when the user asks for messaging, a messaging framework, value props, key takeaways for a launch or campaign, or when an asset request has approved positioning but no messaging to build from. Refuses to run if positioning is not approved. Never produces final copy.
---

# Messaging Framework

Messaging is what we want to say: the key takeaways, expressed as value propositions.
It is the mandatory bridge in the chain positioning → messaging → copy (§3.2). Positioning
is its input; copy is its downstream consumer. This skill produces the bridge and nothing
past it.

## Hard gate — check before doing any work

Open `GTM-War-Room/BRAND-DNA/positioning-and-icp.md` and find the positioning for the
product in scope.

- **No positioning exists** → stop. Tell the user: "Messaging requires approved positioning. Run the `positioning` skill first." Offer to launch it.
- **Positioning exists but is `stage: draft`** → stop. Ask the PMM to approve it (or run the `positioning` skill to finish it). Do not build messaging on a draft — every downstream asset would inherit unvalidated claims.
- **Positioning is approved** → proceed, and treat it as fixed input. If the messaging work exposes a positioning flaw, pause and route back to the `positioning` skill; do not patch around it here.

This gate is not negotiable. Skipping it is the exact failure mode §3.2 exists to prevent.

## Required reading

1. `PMM Agent — Master Instructions & Contex.md` — §3.2, §7.4 (value prop schema), §3.3 (stakeholder metric language), §8.
2. `GTM-War-Room/BRAND-DNA/` — all four brand files, especially `our-customer.md` for raw buyer language.
3. `GTM-War-Room/MARKET-INTELLIGENCE/` — win-loss and voice-of-market inputs for the product; the foundational doc at `GTM-War-Room/PLAYBOOKS-AND-ASSETS/messaging-library/<product>-foundation.md` if it exists.
4. `Voice of Aurigo - Standards Reference.md` — terminology rules apply even to internal messaging docs.

## Step 0 — Intake (AskUserQuestion)

1. **Product and segment** — Masterworks / Essentials / Primus / AI layer; public owners or facility owners. Segment sets program-vs-portfolio vocabulary and whether ROI framing is permitted (never in public-sector messaging — use "program outcomes" or "capital program performance").
2. **Audiences** — which personas from `personas.md` / the foundational doc? One messaging set per persona, not one-size-fits-all.
3. **Funnel stages** — awareness / consideration / decision / expansion? Each stage changes what the takeaway must accomplish.
4. **Channels** — web, email, sales collateral, social, RFP responses? Channel changes emphasis, not truth.
5. **Trigger** — launch, campaign, refresh after win-loss findings? Note which intelligence inputs are validated and which are assumed; assumed inputs get flagged in the output.

## Method

1. **Decompose the positioning** — list the outcomes, differentiated value, and proof from the approved statement. Every value prop must trace to one of these; anything that doesn't is a new claim requiring positioning review.
2. **Mine buyer language** — for each audience, pull verbatim phrasing from `our-customer.md`, win-loss files, and the objection library. The problem statements in the schema must use the buyer's words, not ours.
3. **Draft value props** — for each (audience × funnel stage) cell the intake selected, write value props in the full §7.4 schema. All six fields, every time:
   - **Use case + context** — the specific scenario
   - **The problem to overcome** — what the buyer is stuck with, in their words
   - **The feature/product that solves it** — named (Masterworks, Primus, a named agent such as Prediction Agent — never "Agent" generically)
   - **How it delivers value** — the capability
   - **The benefit derived** — specific and, where possible, quantified
   - **The cost of not solving it** — named risk or number, not vague urgency
4. **Channel notes** — per value prop, one line per selected channel on emphasis and length. Notes, not copy. If you catch yourself writing a headline or an email sentence, stop: that is the copy layer, owned by activation work downstream and gated on this document's approval.
5. **Metric framing** — close each audience section with the business translation (§3.3, §7.3): which stakeholder metric this messaging is built to move (win rate, deal velocity for sales-facing; MQL/conversion for marketing-facing), stated in that stakeholder's language.

## Output

Destination: `GTM-War-Room/PLAYBOOKS-AND-ASSETS/messaging-library/<product>-<audience>-messaging.md`
(one file per audience; kebab-case). Frontmatter: `product`, `audience`, `persona`,
`stage: draft`, `sources` (list every war-room file used), `date` (YYYY-MM-DD, absolute).

```markdown
# Messaging — <Product> / <Audience>
Positioning source: BRAND-DNA/positioning-and-icp.md (approved <date>)

## <Funnel stage>
### VP-1: <short handle>
- Use case + context: …
- Problem to overcome: "…" (source: our-customer.md / win-loss/<file>)
- Solved by: <named product/feature>
- How it delivers value: …
- Benefit: …
- Cost of inaction: …
- Channel notes: web — … | email — … | sales — …

## Metric framing
[insight] → [action] → [named metric] → [stakeholder]
```

## Quality gate

1. Run the `asset-qa` skill on every file written; fix all failures before finishing.
2. Schema completeness: any value prop missing one of the six fields is unfinished — complete or cut it.
3. Anti-generic check (§8.1): delete any takeaway Oracle or Kahua could equally claim.
4. Chain check: confirm the file contains zero finished copy — no headlines, no CTAs, no email lines. Messaging documents brief the copywriter; they are not the copy.
5. Traceability: every value prop names which element of the approved positioning it derives from, and every problem statement cites its buyer-language source. An untraceable value prop is a guess wearing a schema.
6. Stage stays `draft`; state that copy work is blocked until the PMM approves this framework. End with proposed war-room updates (§8.5).

## Boundaries

This skill never edits positioning (route to `positioning`), never writes channel copy
(downstream activation, gated on this document's approval), and never invents proof
points — a benefit without evidence ships flagged as "claim pending proof", or not at all.
