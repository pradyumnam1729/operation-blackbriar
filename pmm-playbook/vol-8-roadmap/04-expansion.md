# Chapter 4 — Expansion (V2)

**Volume 8 · PMM Agent Playbook · 2026-08-06**

---

## Where V2 Comes From

The V2 scope was written before V1 shipped. Master Instructions §14 ("Coverage Notes") deliberately assigned several capabilities to existing agents "unless volume warrants" a dedicated one — pre-negotiated expansion slots, opened only when the operating data says the shared arrangement is saturated. That is the governing rule of this chapter: **V2 items are pulled by measured demand, not pushed by roadmap ambition.** The signal that opens each slot is named below, and the pmm-prioritization agent's recurring-request data (the §3.5 rule that repeated ad-hoc work gets promoted) is the trigger mechanism.

## The Four Expansion Tracks

### 1. Dedicated Campaign Agent

**V1 home:** campaign and channel execution is scoped into B7 Launch Orchestration (channel mix, ABM plan, AEO plan) per §14.

**What the dedicated agent adds:** always-on campaign operations decoupled from launches — standing demand-gen programs, ABM plays that run across quarters, channel-level testing and iteration, campaign-brief-to-asset pipelines that don't originate in a product launch. The agent would own the campaign brief as a first-class artifact, sequence multi-channel execution, and feed results back through gtm-performance.

**Opens when:** launch-orchestration runs show campaign work regularly arriving without a launch attached, or the launch tree's `channels/` outputs are being cloned and re-briefed for non-launch campaigns more than roughly once a month.

### 2. Content Production Agent

**V1 home:** content production is handled by B6/B7/B8 as part of their activation output per §14.

**What the dedicated agent adds:** volume content production as its own discipline — blog programs, web copy at scale, nurture sequences, social derivatives — with a production pipeline that takes approved messaging as input and emits channel-formatted drafts in bulk, each still passing the full guardrail stack of `pmm-playbook/vol-7-ai-engineering/03-guardrails.md`. The AEO standard (`pmm-playbook/vol-7-ai-engineering/05-aeo-standard.md`) becomes this agent's primary craft, since web-bound content is the main AEO surface. Cost-wise it is a workhorse-tier, batch-scheduled program per `pmm-playbook/vol-7-ai-engineering/06-cost-and-model-strategy.md`.

**Opens when:** activation agents spend a measurable share of their runs on derivative content formatting rather than their core synthesis work, or the marketing persona's ask-war-room queries are dominated by "turn this into [channel] copy" requests.

### 3. Analyst-Relations Automation

**V1 home:** analyst relations is an explicit mandate of B7 Launch Orchestration for Tier-1 launches, listed as a deliverable alongside media activities per §14.

**What automation adds:** the always-on version — a monitored analyst calendar (evaluation cycles, report publication dates as event triggers into `pmm-playbook/vol-6-integrations/04-competitive-sources.md` pipelines), briefing-book generation from the war room (positioning, proof points, customer evidence, roadmap narrative, assembled per analyst firm's evaluation criteria), inquiry-response drafting from the RFP answer library, and placement tracking as a gtm-performance input. Analyst briefing programs sit in the §8.2 underused-proven quadrant, which is why this track ranks above flashier options.

**Opens when:** Tier-1 launch cadence makes analyst deliverables a standing workload rather than an occasional one, or a formal evaluation (e.g., a construction-tech market guide cycle) puts a date on the calendar that the ad-hoc approach cannot meet well.

### 4. More Verticals and Industries

**V1 home:** the multiplier value prop — 3–5× more products, industries, and personas per PMM — proven at GA on Aurigo's portfolio and segments (public owners: federal, state and local government; facility owners: data centers, manufacturing, life sciences, energy and utilities).

**What expansion adds:** the same standardized framework instantiated for new verticals, in two directions. For Aurigo as tenant: deeper sub-vertical war rooms (airports, water, transit) with segment-specific personas, terminology rules, and competitive sets. For the PMM Agent as product: tenant onboarding kits for adjacent enterprise-software categories, where the framework (foundational doc, war room, agent roster) is category-neutral and only the seeded content and terminology configuration change. Each new vertical is a content and configuration exercise, not an engineering one — that separation was the point of the GA design in `03-ga.md`.

**Opens when:** the coverage analytics show existing PMMs saturated across current verticals with demand queued, or a tenant prospect arrives from outside the current category with the sources to satisfy the §2.2 prerequisite.

## Sequencing Discipline

V2 tracks are ranked by the same funnel every strategic opportunity passes through (§3.4: spot patterns → frame the problem → shape opportunity → validate and pitch), and each must trace to a company OKR like any other rock. The standing temptation this chapter exists to resist: building a V2 agent because it demos well. The §14 assignments are not gaps — they are working arrangements, and they stay in place until their replacement is justified by the numbers the governance agents already collect.
