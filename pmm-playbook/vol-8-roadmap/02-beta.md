# Chapter 2 — Beta

**Volume 8 · PMM Agent Playbook · 2026-08-06**

---

## What Beta Is For

The MVP proved the core loop on one product with a hand-seeded war room. Beta proves the operating model: that the full agent organization runs on schedules against imported real data, across the whole Aurigo portfolio, without the PMM admin becoming the bottleneck. Beta's user is still Aurigo — one tenant, real workload, us in the room. Everything that breaks here breaks cheaply.

## Beta Scope

### 1. Multi-Product War Room

The foundational-doc builder and war room extend from Masterworks AI to the full portfolio: **Masterworks, Essentials, Primus, and Lumina** (Lumina framed as the foundational engine per `Voice of Aurigo - Standards Reference.md`, never a standalone product). What this forces, and why it is the first beta item:

- Per-product foundational docs with shared brand DNA — the file layout must separate what is portfolio-constant (voice, company positioning) from what is per-product (positioning, personas, competitors).
- Segment-aware guardrails get real: the program/portfolio terminology split, no-ROI-in-public-sector, and facility-owner vs. public-owner framing now have live content on both sides of every rule.
- Cross-product queries ("which product for a county DOT vs. a data-center owner?") test whether positioning boundaries hold under questioning.

### 2. All 14 Agents Wired

MVP shipped the asset-generation slice. Beta wires the full roster from Master Instructions §12 as working agents in `.claude/agents/`, per the organization design in `pmm-playbook/vol-4-agent-organization/`: the five intelligence agents (A1–A5), the five activation agents (B6–B10), and the four governance agents (C11–C14) — including the routing rule that activation agents refuse to produce buyer-facing assets without validated intelligence inputs, and the pmm-prioritization agent triaging incoming requests per the §3.5 rocks/pebbles/sand allocation.

### 3. Always-On Schedules

The §11 programs move from "run when briefed" to scheduled batch execution per `pmm-playbook/vol-7-ai-engineering/06-cost-and-model-strategy.md`: voice-of-market weekly, competitive-intel weekly plus event-triggered, win-loss monthly, content-governance monthly, ICP validation quarterly, gtm-performance monthly. Each run ends in a proposals queue, not applied changes — which makes the governance dashboard (below) load-bearing from day one.

### 4. CRM + Call-Transcript Import

Integrations advance from MVP file-drop to structured import per `pmm-playbook/vol-6-integrations/`: transcript batches from Gong/Chorus/Fathom/Granola exports feeding the voice-of-market pipeline (`02-call-intelligence.md`), and Salesforce opportunity exports feeding win-loss and messaging-effectiveness (`03-crm.md`). Still not live connectors — the import is a repeatable, validated pipeline with a human pressing the button. The pipeline being import-shaped now is what makes GA's connectors a transport swap rather than a rebuild. The product-truth trigger also automates here: a repo watch on `engineering-playbook/vol-2-product-knowledge/` fires the product-to-market agent per `pmm-playbook/vol-6-integrations/06-product-truth.md`.

### 5. Governance Dashboard

With fourteen agents proposing on schedules, the PMM admin needs a control surface, not a folder of diffs:

- **Approval queue** — pending drafts and proposed context updates, oldest first, with eval results (asset-qa pass, swap-test score) attached to each item so approval is informed.
- **Freshness board** — every war-room zone against its §11 cadence; stale zones flagged before they poison downstream assets.
- **Program health** — last run, output volume, and cost per always-on program.
- **Library status** — asset counts by stage, swap-failure rate trend, assets touched by any pending positioning change.

## What Beta Must Prove (Exit Criteria)

1. **The admin scales.** Weekly approval workload stays inside a sustainable budget (target: under 2 hours/week steady-state). If the queue grows without bound, the fix is better pre-filtering and eval quality — not weakening the §8.4 gate.
2. **Schedules survive neglect.** Four consecutive weeks of always-on programs running without manual rescue, with staleness honestly surfaced when imports lapse.
3. **Real data holds up.** Imported transcripts and CRM data produce intelligence notes the sales team recognizes as true — validated by spot-check with named reps.
4. **Multi-product consistency.** The content-governance audit runs clean across all four product lines: no cross-segment terminology violations, no positioning contradictions between products.
5. **The production metric exists.** Asset usage rate is being computed from imported CRM data (per `pmm-playbook/vol-7-ai-engineering/04-evals.md`) — beta does not need the number to be high; it needs the number to be real, because GA's analytics story depends on it.

Beta ends when these hold and the remaining gaps are all transport, tenancy, and auth — which is precisely the GA scope of `03-ga.md`.
