# Chapter 6 — Cost & Model Strategy

**Volume 7 · PMM Agent Playbook · 2026-08-06**

---

## The Economic Shape of the System

The PMM Agent's workload splits into two very different cost profiles:

- **High-volume, low-judgment work:** transcript extraction, competitive-sweep diffing, consistency scanning, swap-test evaluation. Thousands of small, schema-bound calls where the task is well-defined and errors are individually cheap and caught downstream.
- **Low-volume, high-judgment work:** positioning, launch narratives, deal-specific battlecard synthesis, exec briefs. Dozens of calls where quality is the product and an error ships to a customer or a boardroom.

A system that runs everything on a frontier model pays frontier prices for commodity extraction. A system that runs everything cheap ships mediocre positioning. The strategy is unremarkable in principle and valuable in discipline: match the model tier to the judgment content of the task, schedule the volume work as batches, and never pay twice for context that has not changed.

## Model Tiers per Task

Three tiers, assigned per task class. Agent definitions in `.claude/agents/` carry their tier; briefs do not override it casually.

| Tier | Character | Task classes |
|------|-----------|--------------|
| **Extraction tier** (small/cheap) | Fast, schema-bound, high volume | Transcript signal extraction (objections, buyer language, mentions), competitive-source diffing, forbidden-word and frontmatter checks beyond what pure pattern-matching hooks handle, swap-test per-sentence evaluation, tagging and routing |
| **Workhorse tier** (mid) | Solid synthesis at moderate cost | Weekly voice-of-market synthesis, sweep notes, win-loss monthly coding, consistency-eval classification, first-draft generation from strong templates (one-pagers, RFP answers from the approved library), ask-war-room answers over well-structured context |
| **Frontier tier** | Best judgment available | Positioning work, foundational-doc builds, launch narratives (7-step arc), deal-critical battlecard synthesis, exec briefs, anything the PMM admin will present upward, and the asset-qa reviewing pass for ship-bound assets |

Two rules keep the tiering honest:

1. **Judgment flows up, never silently down.** Escalation from a cheaper tier to a better one is always allowed when a task turns out harder than classed. The reverse — quietly running positioning on the extraction tier to save money — is a quality incident.
2. **The reviewer outranks the drafter.** Whatever tier drafts an asset, the ship-gating asset-qa pass runs at the tier that can actually catch subtle failures. Saving money on review is the most expensive saving available.

## Batch Scheduling for Always-On Programs

The always-on programs of Master Instructions §11 (voice-of-market weekly, competitive weekly, win-loss monthly, governance monthly, ICP quarterly) are the volume backbone of the system, and none of them are latency-sensitive. Nobody is waiting on a Tuesday-3am competitive sweep. Therefore:

- **All scheduled programs run as batch jobs**, using batch-priced API processing where available (typically half the interactive price) and off-peak windows.
- **Batches are shaped for cache efficiency:** all items of a run share their static context (see below), so the brand DNA and program instructions are paid for once per batch, not once per item.
- **Event-triggered runs stay interactive** — a live-deal battlecard request or a competitor pricing change is worth interactive latency and pricing.
- **Batch outputs are drafts and proposals like everything else;** scheduling changes cost, not governance. The morning after a batch, the PMM admin reviews the proposals queue.

The rocks/pebbles/sand allocation (§3.5) applies to spend as well as attention: always-on programs are budgeted (~15% of attention, and a bounded model spend), and a program whose batch cost creeps should be tuned — tighter extraction schemas, smaller diffs, better pre-filtering — before it is fed more budget.

## Caching the Stable Brand Context

The single largest recurring token cost in the system is also its most stable content: the SessionStart-injected brand DNA (`positioning-and-icp.md`, `brand-voice.md`, `our-customer.md`, `gtm-rules.md`, current OKRs — see `02-context-engineering.md`). Every session, every agent, every batch item carries it.

This is the textbook case for prompt caching:

- **Prefix-stable ordering.** The injected context is assembled in a fixed order (system instructions → brand DNA → task-specific files → the brief), so the expensive stable prefix is byte-identical across calls and cache hits are maximized. This ordering rule is enforced by the injection hook, not left to individual briefs.
- **Change discipline doubles as cache discipline.** Brand-DNA files change only by approved proposal (§8.5), which means the cache invalidates on real positioning changes and essentially never otherwise. The governance model and the cost model reinforce each other.
- **Warm windows for batches.** Scheduled runs group their items so the shared prefix stays warm across the whole batch.
- **Per-task files are not cached** — they are selected precisely because they vary per task (see `02-context-engineering.md`), and they ride behind the stable prefix.

## Budget Visibility

Model spend is reported monthly in the gtm-performance rollup alongside the production metrics: cost per asset class, cost per always-on program, and the trend. The number that matters for the business case is cost-per-approved-asset against the hours it replaced — the 90%-faster value prop has a denominator, and this is it. A cost anomaly (one program's spend doubling) is investigated like any other regression: usually a context leak (someone pasted a blob into a brief — see `01-prompt-standards.md`), a broken cache prefix, or a tier misassignment.
