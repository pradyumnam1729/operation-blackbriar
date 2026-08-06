# 01 — System Overview

---

## The Six Components

The PMM Agent web app is six components around one asset: the foundational doc. Three components put rigor in (builder, orchestration, approval); three get value out (knowledge engine, asset generator, governance dashboard).

```
                    ┌─────────────────────────────┐
   PMM admin ──────►│  1. Foundational-Doc Builder │──── writes ────┐
                    └─────────────────────────────┘                 ▼
                    ┌─────────────────────────────┐        ┌────────────────┐
   All roles ──────►│  2. Knowledge Engine (Q&A)   │◄─reads─┤  War Room /    │
                    └─────────────────────────────┘        │  FoundationDoc │
                    ┌─────────────────────────────┐        │  (versioned)   │
   All roles ──────►│  3. Asset Generator          │◄─reads─┤                │
                    └──────────────┬──────────────┘        └────────▲───────┘
                                   │ drafts                          │ validated
                    ┌──────────────▼──────────────┐        ┌────────┴───────┐
   PMM admin ──────►│  5. Approval Workflow        │        │ 4. Agent       │
                    └──────────────┬──────────────┘        │  Orchestration │
                                   │ finals                 │  (14 agents)   │
                    ┌──────────────▼──────────────┐        └────────────────┘
   PMM admin ──────►│  6. Governance Dashboard     │
                    └─────────────────────────────┘
```

---

## 1. Foundational-Doc Builder

A structured, section-by-section editor that encodes the standardized framework — the app-native form of the `/foundation-doc` skill (`../../.claude/skills/`). Sections, in chain order ([Vol 2, ch. 02](../vol-2-domain-knowledge/02-positioning-messaging-copy-chain.md)): positioning, ICP and personas, JTBDs, value props, competitive summary, brand guardrails, proof points, objection library.

The builder is opinionated by design:

- Value props render as six-field forms with validation, not free text ([Vol 2, ch. 04](../vol-2-domain-knowledge/04-value-prop-schema.md))
- Positioning uses the Dunford formula slots; the anti-pattern check runs on save
- Sections carry status (empty / draft / approved) and freshness dates; downstream components read these
- An interview mode drives authoring: the system asks, the PMM answers, a draft section results — brief-don't-prompt applied to the PMM's own input

## 2. Knowledge Engine

Retrieval over war-room content with **role-aware answer framing**. A consumer asks in plain language; the engine selects relevant foundation sections and intelligence files, composes an answer, frames it in the asker's metric language ([Vol 2, ch. 05](../vol-2-domain-knowledge/05-business-translation.md)), and cites every source by file and section. When the war room cannot answer, it says so and routes an intelligence task — never guesses ([Vol 5, ch. 03](../vol-5-operating-model/03-query-answer-workflow.md)). The `/ask-war-room` skill is this component's prototype.

## 3. Asset Generator

Battlecards, one-pagers, RFP responses, and exec briefs, generated from **templates (Vol 9) plus war-room truth** — never from the model's general knowledge. Each generation records the asset type, audience, and the exact foundation sections consumed; the record is the trace that powers the consistency guarantee. Generation checks foundation freshness first and warns or refuses on staleness ([Vol 5, ch. 04](../vol-5-operating-model/04-asset-generation-workflow.md)).

## 4. Agent Orchestration Layer

The 14 sub-agents ([Volume 4](../vol-4-agent-organization/README.md)) as workers behind the other components: the builder dispatches interview and validation work, the generator dispatches activation agents, escalations dispatch intelligence agents, and scheduled runs dispatch the always-on programs. The orchestrator enforces the routing rules — above all, intelligence before activation — and triages per the §3.5 buckets. Executable definitions live in `../../.claude/agents/`; the app invokes them, it does not redefine them.

## 5. Approval Workflow

The draft → final gate (§8.4) as a state machine. Every generated output enters as a draft; the PMM's approval queue shows drafts with their traces, guardrail results, and diffs; approve promotes to final, reject returns with notes. Context-doc update proposals (§8.5) flow through the same queue. No code path writes a final without a recorded human approval.

## 6. Governance Dashboard

The PMM's instrument panel: foundation freshness per section, assets by stage, trace coverage, guardrail rejection rates, query volume by persona, unanswered-query escalations, and the [Vol 1, ch. 06](../vol-1-product/06-success-metrics.md) metrics. It surfaces C12 (content-governance) audit results and C13 (gtm-performance) rollups rather than computing its own truths.

---

## The One Diagram Worth Memorizing

Data flows in one direction with one loop:

1. **Intelligence in:** always-on programs and connected sources (Vol 6) → `MARKET-INTELLIGENCE/`
2. **Foundation curated:** PMM, via the builder, turns intelligence into approved foundation sections
3. **Value out:** knowledge engine answers and asset generator drafts, both citing the foundation
4. **Gate:** approval workflow promotes drafts to finals
5. **Loop:** governance measures usage and freshness; findings return to step 2 as proposed updates

Any proposed feature should be locatable on this flow. A feature that cannot be placed on it — for example, free-form generation that skips steps 2 and 4 — is off-architecture ([Vol 1, ch. 01](../vol-1-product/01-vision-mission.md), "How the Vision Constrains Product Decisions").

---

*Next: [02 — Data Model](02-data-model.md)*

Last updated: 2026-08-06
