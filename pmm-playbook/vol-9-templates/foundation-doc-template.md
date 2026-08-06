# Foundational Doc — [PRODUCT NAME]

> **What this is.** The one rigorous foundational document for this product — the standardized framework at the heart of the PMM Agent. Every answer the war room gives and every asset it generates for this product derives from this file. Build it carefully once; maintain it forever. Home: `GTM-War-Room/` (one per product). Refresh triggers: positioning change, ICP shift, major competitive move, quarterly review at minimum.

```yaml
---
product: "[Masterworks | Essentials | Primus | Masterworks AI | ...]"
audience: "internal — all agents and PMM team"
persona: "n/a (upstream of persona-specific assets)"
stage: draft
sources:
  - "GTM-War-Room/BRAND-DNA/positioning-and-icp.md"
  - "GTM-War-Room/BRAND-DNA/our-customer.md"
  - "GTM-War-Room/MARKET-INTELLIGENCE/win-loss/[files used]"
  - "GTM-War-Room/MARKET-INTELLIGENCE/voice-of-market/[files used]"
  - "GTM-War-Room/MARKET-INTELLIGENCE/competitive/[dossiers used]"
  - "GTM-War-Room/product-wiki.md"
date: [YYYY-MM-DD]
approved_by: "[PMM admin — required before stage: final]"
---
```

---

## 1. Positioning

> Guidance — Master Instructions §7.1 (April Dunford + Tamara Grominsky). Use the formula exactly; every bracket filled with something only this product can claim. Six-step build: pick category → narrow audience → frame desired outcomes (outcomes, not tasks) → describe approach → showcase unique value → share proof. **What good looks like:** a statement that fails when you substitute a competitor's name. Anti-pattern check: "Reject any claim that a competitor could equally make. 'Customer-obsessed' and 'revenue-driven' are not differentiators."

**Positioning statement:**

We are a **[CATEGORY]** that helps **[AUDIENCE]** achieve **[OUTCOMES]** by **[APPROACH]**. What sets us apart is **[DIFFERENTIATED VALUE]** backed by **[PROOF]**.

**Category:** [The market category we choose to be judged in, and why this one]
**What it replaces:** [The incumbent alternative — a competitor, a spreadsheet, a manual process]
**Why it's better:** [The 2–3 reasons, each specific to us]
**The enemy:** [What we position against — the status quo we name in the first paragraph of everything]

## 2. ICP (Ideal Customer Profile)

> Guidance — the answer to "who you serve and your enemy" (§4.1). Use the Aurigo audience hierarchy from `Voice of Aurigo - Standards Reference.md`: capital owners → public owners (government agencies) / facility owners. Never the retired term. **What good looks like:** an ICP a rep can disqualify against in one call — firmographic bounds, named triggers, named disqualifiers.

- **Segment:** [public owners / facility owners — and the sub-segment: federal agencies, state & local government, data centers, ...]
- **Organization profile:** [size, program/portfolio scale, regulatory context]
- **Buying triggers:** [the events that start an evaluation — funding cycle, audit finding, failed system, mandate]
- **Disqualifiers:** [who we do not serve well, stated honestly]
- **Environment:** [systems they already run, procurement path, approval chain]

## 3. Personas

> Guidance — one block per named persona. Source raw language from `GTM-War-Room/BRAND-DNA/our-customer.md` and call transcripts — "raw customer language, not summaries" (§4.1). **What good looks like:** each persona carries at least one verbatim quote, and the objections listed are ones we have actually heard, with dates.

### Persona: [NAME — e.g., Capital Program Director]

- **Role in the deal:** [economic buyer / champion / end user / blocker]
- **What they own:** [their metric, their risk]
- **Pains (their words):** "[verbatim quote, source + date]"
- **Goals:** [what a win looks like for them personally]
- **Buying triggers:** [what puts them in market]
- **Objections they raise:** [top 2–3, cross-referenced to §9 Objection Library]
- **Trust signals:** [what makes them believe — references, compliance, proof types]

*(Repeat per persona.)*

## 4. Jobs to Be Done

> Guidance — JTBD framework (Master Instructions §13), owned by the voice-of-market and icp-persona agents. Frame as progress the customer is trying to make, not features they might use. **What good looks like:** "When [situation], I want to [motivation], so I can [outcome]" — with the outcome quantifiable and the situation recognizable from real calls.

| # | When (situation) | I want to (motivation) | So I can (outcome) | Evidence source |
|---|------------------|------------------------|--------------------|-----------------|
| 1 | [ ] | [ ] | [ ] | [war-room file] |
| 2 | [ ] | [ ] | [ ] | [ ] |

## 5. Value Propositions

> Guidance — Master Instructions §7.4: every value proposition carries all six fields. No field skipped, no field generic. **What good looks like:** the "cost of not solving it" is quantified or named, and the capability line names a real product capability traceable to `GTM-War-Room/product-wiki.md`.

### Value Prop 1: [SHORT NAME]

1. **Use case + context:** [the specific scenario]
2. **The problem to overcome:** [what the buyer is stuck with]
3. **The feature/product that solves it:** [named capability, per product-wiki.md]
4. **How it delivers value (capability):** [the mechanism]
5. **The benefit derived:** [specific, named outcome — not "greater efficiency"]
6. **The cost of not solving it:** [quantified or named stakes]

*(Repeat — typically 3–5 value props per product, keyed to personas in §3.)*

## 6. Competitive Summary

> Guidance — summary layer only; full dossiers live in `GTM-War-Room/MARKET-INTELLIGENCE/competitive/` and battlecards in `PLAYBOOKS-AND-ASSETS/battlecards/`. **What good looks like:** the "where they win" column is honest (per `pmm-playbook/vol-6-integrations/04-competitive-sources.md`: a dossier showing the competitor losing everywhere gets our reps ambushed), and every claim carries a dossier citation.

| Competitor | Where we win | Where they win | One-line counter-position | Dossier |
|------------|--------------|----------------|---------------------------|---------|
| [Name] | [ ] | [honest] | [ ] | [path, date] |

**Status quo / no-decision** is a competitor. [How we sell against "do nothing": the cost-of-inaction case.]

## 7. Brand Guardrails

> Guidance — the product-specific application of `Voice of Aurigo - Standards Reference.md` and `GTM-War-Room/BRAND-DNA/gtm-rules.md`. Do not restate the full standards; record what is specific to *this* product. **What good looks like:** an agent reading only this section makes zero terminology errors for this product.

- **Segment terminology:** [program or portfolio — which applies, per the public/commercial rule]
- **Approved product naming:** [full name, first-use rules, approved constructions — e.g., "Masterworks AI, powered by Lumina" if applicable]
- **Claims requiring care:** [ROI ban if public-sector; compliance claims requiring legal; anything cleared/not-cleared]
- **Product-specific banned or watched phrases:** [beyond the global list]

## 8. Proof Points

> Guidance — every proof point validated by the customer-evidence agent, with reference-approval status. §15: "Insight source: validated from calls/interviews/data — not assumed." **What good looks like:** a claim + a number + a named or namable customer + an approval status. Unproven claims do not belong in this file; they belong in a backlog.

| Proof point | Metric/number | Customer/segment | Reference status | Source | Verified |
|-------------|---------------|------------------|------------------|--------|----------|
| [ ] | [ ] | [ ] | [approved / anonymous only / internal only] | [ ] | [YYYY-MM-DD] |

## 9. Objection Library

> Guidance — sourced from call transcripts and win-loss interviews via the pipelines in `pmm-playbook/vol-6-integrations/`. **What good looks like:** the objection is verbatim (what buyers actually say, not our paraphrase), the response follows acknowledge → reframe → proof, and each entry names its evidence.

### Objection: "[VERBATIM OBJECTION]"

- **Who raises it:** [persona] · **Heard:** [dates/frequency] · **Source:** [transcript/win-loss file]
- **What's really being asked:** [the concern under the words]
- **Response:** [acknowledge → reframe → proof point from §8]
- **One-liner version:** [for the battlecard]

*(Repeat — keep ranked by frequency; retire objections not heard in two quarters.)*

---

## Maintenance Log

> Guidance — this doc is alive or it is worthless. Every §8.5 approved update lands a row here.

| Date | Section | Change | Trigger | Approved by |
|------|---------|--------|---------|-------------|
| [YYYY-MM-DD] | [ ] | [ ] | [win-loss finding / competitive event / product update / quarterly review] | [ ] |
