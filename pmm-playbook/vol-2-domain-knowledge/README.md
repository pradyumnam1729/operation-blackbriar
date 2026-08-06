# Volume 2 — PMM Domain Knowledge

This volume is the frameworks canon: the product marketing standards the PMM Agent enforces, distilled from Master Instructions §3 (philosophy and operating principles) and §7 (the five reusable standards) into teachable reference chapters. Volume 2 is to the PMM Agent what a domain-knowledge volume is to an engineering playbook — the vocabulary and rules that everything else (the app in Volume 3, the agents in Volume 4, the workflows in Volume 5) must encode rather than reinvent.

These are not our inventions. Each chapter names its practitioner sources (April Dunford, Aatir Abdul Rauf, Zach Messler, Talya Heller G., Tamara Grominsky, and others per Master Instructions §13). Our contribution is the distillation and the enforcement: a framework that lives in software and gates output is worth ten that live in bookmarks.

---

## Contents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Positioning Standard](01-positioning-standard.md) | The April Dunford formula, the six-step build, and the anti-pattern check that rejects claims any competitor could make. |
| 02 | [Positioning → Messaging → Copy Chain](02-positioning-messaging-copy-chain.md) | The three layers, their strict dependency order, and why the system never jumps from positioning to copy. (§3.2) |
| 03 | [Narrative Arc](03-narrative-arc.md) | The 7-step buyer narrative with do/don't per step, and the champion leave-behind principle. (§7.2) |
| 04 | [Value Prop Schema](04-value-prop-schema.md) | The six-field schema every value proposition must complete before it enters the messaging library. (§7.4) |
| 05 | [Business Translation](05-business-translation.md) | The cross-functional metrics map and the insight → action → metric → owner pattern. No raw observations ship. (§3.3, §7.3) |
| 06 | [JTBD & ICP](06-jtbd-and-icp.md) | Jobs-to-be-done alongside persona methods: what each answers, how they combine, and how the ICP stays validated. |
| 07 | [War-Room Model](07-war-room-model.md) | The folder-as-knowledge-base model: one master folder, four subfolders, and the four brand files that are minimum viable context. (§4) |
| 08 | [Operating Cadence](08-operating-cadence.md) | Time allocation, the OKR cascade, rocks/pebbles/sand, always-on programs, and stage-aware behavior. (§3.5, §3.6, §10, §11) |

---

## How to Read This Volume

Chapters 01–05 are the output-quality canon: they define what good positioning, messaging, narrative, value props, and recommendations look like, in that dependency order. Chapters 06–08 are the input-and-rhythm canon: who we serve, where knowledge lives, and when work happens. A new PMM (or a new agent) should read all eight in order; the whole volume is a two-hour read that replaces years of scattered folklore.

---

## Audience

| Reader | Focus on |
|--------|----------|
| PMM admin | All eight. This is your professional standard, codified — you will be held to it by your own guardrails. |
| Agents (all 14) | 01–05 before producing any output; 07 for where inputs and outputs live; 08 for cadence. |
| Engineer building the app | 02, 04, 07 especially — the chain, the schema, and the war-room model are data-model constraints, not documentation. |
| Consumers | Optional. If you want to know why the system refuses to skip steps, chapter 02 is the answer. |

---

## Enforcement Map

A framework in this volume is only real where software enforces it:

| Framework | Enforced by |
|-----------|-------------|
| Positioning standard, anti-pattern check | asset-qa skill; C12 content-governance agent; §8.1 checklist before draft → final |
| Positioning → messaging → copy chain | Foundation-doc section ordering ([Vol 3, ch. 01](../vol-3-architecture/01-system-overview.md)); B6 gate |
| Narrative arc | Asset templates (Vol 9); asset-qa review |
| Value-prop schema | Foundation-doc editor field validation ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)) |
| Business translation | Answer-framing layer of the knowledge engine; C13 reporting format |
| War-room model | Repository structure of `../../GTM-War-Room/`; SessionStart hook |
| Operating cadence | Orchestrator triage ([Vol 5, ch. 01](../vol-5-operating-model/01-intake-protocol.md)); C14 prioritization agent |

---

Last updated: 2026-08-06
