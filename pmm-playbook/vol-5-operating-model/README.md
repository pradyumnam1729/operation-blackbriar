# Volume 5 — Operating Model

This volume describes how work actually flows through the PMM Agent system, end to end: how requests come in, how the foundational doc is built and kept alive, how questions become cited answers, how assets are generated and gated, and the rituals that give the system memory. It is the procedural counterpart to Volume 2 (the standards) and Volume 4 (the workforce) — those say what and who; this volume says when and how.

Everything here applies in both incarnations of the system: today's Claude Code sessions over the war room, and the web app that encodes these same workflows as product behavior ([Volume 3](../vol-3-architecture/README.md)). When the two disagree, this volume and the Master Instructions win, and the app has a bug.

---

## Contents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Intake Protocol](01-intake-protocol.md) | Brief, don't prompt: Context + End State + Constraints, clarifying questions before execution, and triage into the 50/25/15/10 buckets. (§6, §3.5) |
| 02 | [Foundation-Doc Workflow](02-foundation-doc-workflow.md) | End to end: interview → draft sections → validate against intelligence → PMM approval → publish to war room → queryable. |
| 03 | [Query/Answer Workflow](03-query-answer-workflow.md) | Role question in, war-room-grounded answer out with citations — and honest escalation when the war room cannot answer. |
| 04 | [Asset Generation Workflow](04-asset-generation-workflow.md) | Request → freshness check → draft → asset-qa gate → PMM approval → final. The 90%-faster promise and its dependency on a current foundation. |
| 05 | [Approval Gates](05-approval-gates.md) | Draft → final rules, who approves what, and context-doc update proposals. (§8.4, §8.5) |
| 06 | [Always-On Programs](06-always-on-programs.md) | The §11 cadence table operationalized: how each run is dispatched and where outputs land. |
| 07 | [Session Rituals](07-session-rituals.md) | SessionStart context injection, HANDOVER.md at close, and the weekly review of proposed context updates. |

---

## How to Read This Volume

Chapters 01 and 05 bracket everything: every workflow starts with intake and ends at a gate. Chapters 02–04 are the three core value paths (build the foundation, query it, generate from it). Chapters 06 and 07 are the rhythm section — the scheduled and per-session rituals that keep the other five workflows supplied with fresh truth.

---

## Audience

| Reader | Focus on |
|--------|----------|
| PMM admin | All seven; 05 and 07 define your recurring obligations |
| Consumers | 03 and 04 — how to ask and how to request |
| Agents | 01 (how you receive work), your workflow chapter, 05 (how your output exits), 07 (how sessions start and end) |
| Engineers | Each chapter is a functional spec for the corresponding app workflow |

---

## The One-Line Version of Each Workflow

1. **Intake:** classify and brief before executing; never execute a vague request.
2. **Foundation:** interview the PMM, draft in the framework, validate against intelligence, approve per section, publish.
3. **Query:** answer only from the war room, cite everything, escalate honestly.
4. **Assets:** generate only from fresh foundations, gate twice (machine, then human), then final.
5. **Gates:** the system proposes, the PMM decides — for outputs and for context updates alike.
6. **Programs:** the war room refreshes on schedule, not on memory.
7. **Rituals:** every session starts with injected context and ends with a handover.

---

Last updated: 2026-08-06
