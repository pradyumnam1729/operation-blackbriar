# 00 — Org Overview

---

## The Org Chart

Fourteen PMM agents in three groups, one orchestrator above them, one human above everything.

```
                          PMM ADMIN (approves everything)
                                    │
                              ORCHESTRATOR
                    (triage per §3.5 → route per the gate)
                                    │
   ┌────────────────────────────────┼────────────────────────────────┐
   │ GROUP A — INTELLIGENCE         │ GROUP B — ACTIVATION           │ GROUP C — GOVERNANCE
   │ (validated insight in)         │ (buyer-facing output out)      │ (audit everything)
   │                                │                                │
   │ A1 voice-of-market             │ B6 product-to-market           │ C11 messaging-effectiveness
   │ A2 icp-persona                 │ B7 launch-orchestration        │ C12 content-governance
   │ A3 competitive-intel           │ B8 sales-enablement            │ C13 gtm-performance
   │ A4 win-loss                    │ B9 adoption-expansion          │ C14 pmm-prioritization
   │ A5 customer-evidence           │ B10 pricing-packaging          │
   └────────────┬───────────────────┴───────────▲────────────────────┘
                │      validated intelligence   │
                └───────────────────────────────┘
                   A feeds B. B cannot ship without A. C audits A and B.
```

Executable definitions: `../../.claude/agents/<name>.md` (as of 2026-08-06, `voice-of-market`, `icp-persona`, and `competitive-intel` exist; the remainder land as they are authored — an agent listed here without a file is not yet dispatchable, and the group chapters mark the contract that file must implement).

---

## The Three Groups

| Group | Job | Output character | Failure it prevents |
|-------|-----|------------------|--------------------|
| **A — Market & Customer Intelligence** | Know the world: buyers, segments, competitors, deal outcomes, proof | Validated insight, business-translated (§7.3), never buyer-facing | Guessing |
| **B — GTM Strategy & Activation** | Turn foundation + intelligence into positioning, launches, enablement, and assets | Buyer-facing drafts, framework-compliant, gated | Generic or unfounded output |
| **C — Governance & Optimization** | Measure, audit, and prioritize the whole system | Audits, KPI maps, priority trees — aimed at the PMM | Drift, staleness, sand filling the jar |

---

## The Hard Gate: Intelligence Before Activation

The one routing rule that is enforced, not encouraged (§3.1):

> **No activation output ships without validated upstream intelligence.** B-group agents cannot produce buyer-facing assets until the relevant A-group agents have supplied validated inputs. Guessing is a failure mode.

Mechanically, in both the repo and the app ([Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)):

1. Every B-agent contract names its required intelligence inputs (e.g., B8's battlecard requires a current A3 dossier; the `/battlecard` skill dispatches A3 first if the dossier is missing or older than 30 days).
2. The orchestrator checks input existence and freshness **before** dispatching a B agent. Missing or stale → the intelligence task runs first, or the request returns honestly blocked with a populate-plan. Blocked-with-a-plan beats fluent-and-wrong, every time.
3. C12's audits catch anything that slipped through: a buyer-facing asset whose sources contain no A-group output is a finding.

The gate is also the answer to "why fourteen agents instead of one clever prompt": the separation makes the dependency checkable.

---

## Orchestrator Triage (§3.5)

Every incoming request is classified before any agent runs:

| Step | Action |
|------|--------|
| 1. Classify | Company-level (~50%) / team-level (~25%) / always-on (~15%) / ad hoc (~10%) — the four buckets of [Vol 2, ch. 08](../vol-2-domain-knowledge/08-operating-cadence.md) |
| 2. Trace | Which company OKR (from `strategy.md`) does this serve? Untraceable → flagged as sand, and said so |
| 3. Gate-check | Which intelligence inputs does fulfillment require, and are they fresh? |
| 4. Route | Dispatch the owning agent(s) with a brief per §6 (Context + End State + Constraints) |
| 5. Watch for promotion | A recurring ad hoc request is flagged to C14 as an always-on candidate |

Triage output is visible to the requester: what bucket, what trace, what's dispatched, what's blocked and why. The transparency is deliberate — it teaches the organization what the system protects.

---

## Cross-Group Data Flow (Summary)

| From | To | What flows |
|------|----|-----------|
| A1, A4 | B6, B8, C11 | Buyer language, objections, deal drivers |
| A2 | All B, positioning work | ICP, personas, JTBDs |
| A3 | B8 (battlecards), B6, A4 | Competitive deltas, positioning implications |
| A5 | B8, B7, B9 | Proof points, evidence by persona/segment |
| B6 | Messaging library, B7, B8 | Value props in schema, launch narrative |
| C11, C13 | C14, PMM, Leadership | Usage and performance, translated |
| C12 | Everyone | Staleness and consistency findings |
| C14 | PMM | The traceable priority tree |

Per-agent detail in chapters [01](01-intelligence-group.md), [02](02-activation-group.md), [03](03-governance-group.md).

---

*Next: [01 — Intelligence Group](01-intelligence-group.md)*

Last updated: 2026-08-06
