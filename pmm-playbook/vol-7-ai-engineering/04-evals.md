# Chapter 4 — Evals

**Volume 7 · PMM Agent Playbook · 2026-08-06**

---

## What We Are Actually Measuring

An eval regime for a marketing AI system has to answer two different questions and must not confuse them:

1. **Is the output good?** — specific, on-voice, differentiated, supported. Measured pre-ship, per asset.
2. **Is the system working?** — do the outputs get used and do they move deals? Measured post-ship, in aggregate.

The first without the second produces beautiful shelf-ware. The second without the first ships fast garbage until sales stops trusting the system. This chapter defines both halves.

## Pre-Ship Evals

### The Swap Test as an Automated Eval

The swap test (Master Instructions §8.1; `Voice of Aurigo - Standards Reference.md` test 6) is usually described as a human discipline: replace "Aurigo" with "Oracle", "Microsoft", or "Kahua" — if the sentence still works, the claim is not specific enough. It also happens to be the rare quality check that automates well, because it reduces to a per-sentence judgment with a binary outcome.

The automated form, run inside the `asset-qa` gate (see `03-guardrails.md`) and as a batch eval across the asset library:

1. Split the asset into claim-bearing sentences (skip structural text).
2. For each, perform the substitution and ask a cheap evaluation model one question: *does this sentence remain plausible as-is for the substituted company?*
3. Score the asset: % of claim sentences that fail the swap. Report failures by line.

The threshold is strict: a customer-facing asset should approach zero swappable claims in its headline, opening, and differentiation sections. Body context can carry some category-level statements; positioning statements cannot. Run in batch across `GTM-War-Room/PLAYBOOKS-AND-ASSETS/`, this doubles as a portfolio health metric — the swap-failure rate over time is a direct measurement of the anti-generic mandate.

### Consistency Checks Against positioning-and-icp.md

The consistency eval asks: does every asset say the same thing about who we are? Mechanically, the check extracts each asset's implicit positioning claims — category, audience, problem solved, differentiation — and compares them against `GTM-War-Room/BRAND-DNA/positioning-and-icp.md` as ground truth. Deviations are classified:

- **Contradiction** (asset claims a different category or audience) — fails, blocks promotion.
- **Drift** (asset paraphrases positioning in ways that weaken or blur it) — flagged for revision.
- **Staleness** (asset reflects a previous version of positioning) — routed to the content-governance agent's refresh queue.

This is the automated core of the content-governance audit (C12, monthly per §11), and it is why the war room's markdown-first design matters: the entire asset corpus is directly comparable text. When positioning changes, this eval run is the blast-radius report — every asset that now disagrees with the new positioning, listed by file.

### The Spot-Check Protocol

Automated evals sample everything shallowly; humans sample a little, deeply. The standing protocol:

- **Cadence:** monthly, alongside the content-governance audit; plus after any positioning change or template change.
- **Sample:** 5 assets — the 2 most-used that month (by usage data), 1 recent output from each asset class shipped that month, and 1 chosen at random.
- **Method:** the PMM admin reviews against the full §15 "What Good Looks Like" table and the five voice tests, blind to which agent or brief produced the asset.
- **Output:** a short note per asset — pass, or named failures — and, critically, a diagnosis when failures cluster: is it the brief, the template, the war-room context, or the model tier? Fixes go to the root cause, not just the asset.

Spot-checks are how eval blind spots get discovered. Every failure a spot-check catches that the automated layer missed becomes a candidate for a new automated check.

## Post-Ship: Asset Usage Rate as the Production Metric

The production metric for the whole system is the **asset usage rate**: the percentage of active deals in which approved PMM collateral is actually used (tracked by the messaging-effectiveness agent, C11, from CRM asset-activity data per `pmm-playbook/vol-6-integrations/03-crm.md`).

This is deliberately a demand-side metric. It cannot be gamed by producing more assets; it moves only when sales finds the assets worth pulling into real deals. Interpreted with its companions:

| Signal | Reading |
|--------|---------|
| Usage rate rising | The system is producing things sales wants; the 90%-faster value prop is being banked, not just claimed |
| Usage rate flat while asset count grows | Producing shelf-ware; revisit what sales actually asks for (the ask-war-room query log is the demand signal) |
| High usage, weak stage-conversion correlation | Assets are liked but not effective; messaging content problem, route to win-loss for diagnosis |
| Usage concentrated in few assets | The rest of the library is a candidate for pruning at the next governance audit |

Secondary production metrics: query volume and answer acceptance in the ask-war-room flow, time-to-asset (request to approved final, the direct measure of the 90% value prop), and swap-failure rate across the library. All reported monthly in the gtm-performance rollup, framed per stakeholder metric language (§3.3).

## Rules

1. Every asset class has both an automated pre-ship eval and a place in the spot-check rotation.
2. Eval results are recorded with the asset (frontmatter or sidecar), so approval decisions are informed, not vibes.
3. Production metrics are reported against absolute periods, and no percentage claims on samples too small to bear them.
4. When a shipped asset fails in the field (sales reports it, a deal contradicts it), the failure is run backward through the eval stack: which layer should have caught it, and what check gets added.
