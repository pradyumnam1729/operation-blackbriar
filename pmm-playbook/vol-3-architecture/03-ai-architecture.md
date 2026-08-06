# 03 — AI Architecture

---

## The Shape of the AI Layer

The app's AI layer is deliberately conservative: Claude API calls with carefully constructed context, specialized system prompts per agent role, whole-file retrieval over a small corpus, deterministic guardrails in code, and a human gate as a workflow state. No fine-tuning, no vector database, no autonomous publishing. Every one of those absences is a decision, recorded here so nobody "fixes" them by accident.

The design mirrors what already works in this repository: the app is the productized form of the `.claude/` setup — hooks, agents, skills — not a reinvention of it.

---

## 1. Context Injection — the SessionStart Pattern

The repo's SessionStart hook (`../../.claude/hooks/session-start.ps1`) injects the four brand files and current OKRs into every session (§5.1). The app replicates this exactly: **every model call carries the brand DNA in context** — `positioning-and-icp.md`, `brand-voice.md`, `our-customer.md`, `gtm-rules.md`, plus the relevant product's approved foundation sections.

This is the anti-generic mandate implemented at the transport layer. A model that always has the brand DNA in context cannot produce brandless output by accident; a model that must "remember" to retrieve it will eventually not. The brand-DNA bundle is a few thousand tokens — trivially affordable to send always, and a natural fit for prompt caching since it changes only on PMM approval.

## 2. Sub-Agents as Specialized System Prompts

Each of the 14 agents is a system prompt encoding a role contract: mission, mandatory reading, method, output destination and format, quality gates, cadence — exactly the structure of `../../.claude/agents/competitive-intel.md`. The app's orchestration layer selects the agent, assembles its context (brand DNA + its contract's task-specific files), and runs the task.

Rules:

- **One source of truth:** the `.claude/agents/*.md` files are the agent definitions. The app loads them; it does not maintain parallel copies. A contract change is one edit, effective everywhere.
- **Agents do not chain freely:** routing follows the org rules in [Volume 4](../vol-4-agent-organization/00-org-overview.md) — intelligence before activation is enforced by the orchestrator checking input freshness before dispatching an activation agent, not by hoping the prompt complies.
- **AskUserQuestion is preserved:** where an agent contract requires clarification before execution (§6), the app surfaces the question to the user rather than letting the model assume.

## 3. Retrieval — Whole Files, Not Vector Search

The war room is a small corpus: dozens of Markdown files, most under a few thousand tokens. At this scale, **load the whole relevant files** selected by the data model's explicit structure (product → sections; competitor → dossier; persona → persona file). Skip embedding pipelines, chunking policies, and similarity thresholds entirely — for the MVP they add failure modes, not recall.

Selection is mostly deterministic: a battlecard request for Kahua needs the positioning and value-prop sections, `competitors.md`, and `MARKET-INTELLIGENCE/competitive/kahua.md`. Where the mapping is ambiguous (open-ended questions), a cheap first model pass selects files from the war-room index, then the answer pass runs with those files loaded. Citations then come free: the engine cites files it actually loaded, not chunks a similarity score guessed at.

**Revisit trigger:** when the corpus outgrows the context budget (many products × many verticals), introduce retrieval — as an ADR, with the citation guarantee preserved.

## 4. Deterministic Guardrails — Code, Not Model Judgment

Checks with objective answers run as code, mirroring the PostToolUse hook pattern (`../../.claude/hooks/messaging-guard.ps1`, `forbidden-words.txt`):

| Check | Kind | Why code |
|-------|------|----------|
| Forbidden words and banned phrases (`gtm-rules.md`, Voice standards) | String/regex scan | A model asked "any banned words?" will sometimes miss; a scan never does |
| Terminology rules (life cycle as two words, program vs. portfolio by product, no "the" before org abbreviations) | Rule scan | Same |
| Em-dash and binary-contrast limits | Counter | Same |
| Trace completeness (asset has source_sections; answer has citations) | Schema validation | Structural, not stylistic |
| Section freshness before generation | Date comparison | Structural |

Model judgment is reserved for what only judgment can do — the swap test, arc integrity, "does this use raw customer language" — and even those run as a *separate reviewer call* (the asset-qa pattern, `../../.claude/skills/`) whose verdict is shown to the PMM, never silently trusted. Layered: deterministic checks first (cheap, certain), model review second (judgment), human gate last (accountability).

## 5. The Human Gate as a Workflow State

Draft → approval → final (§8.4) is a state machine in the data model ([ch. 02](02-data-model.md)), not an etiquette. Properties the implementation must keep:

- No API path writes `stage: final` without a recorded approval event (actor, timestamp, version approved)
- Rejection carries notes and returns the draft to its generating workflow with the notes as context
- Context-doc update proposals (§8.5) are the same mechanism pointed at foundation sections: agents propose diffs, the queue shows them, the PMM applies or declines
- The gate is per-output, not per-session — a session producing five drafts yields five queue items

---

## Failure Modes Designed Against

| Failure mode | Defense |
|--------------|---------|
| Fluent, generic output | Brand DNA always in context; anti-generic review pass; swap test in asset-qa |
| Confident answers from a stale or silent war room | Freshness checks in code; refuse-and-escalate outcome in the query workflow |
| Guardrail drift ("the model usually catches it") | Deterministic checks are code with tests; the model is never the enforcement layer for objective rules |
| Prompt/contract divergence between repo and app | Single source: `.claude/agents/` files loaded at runtime |
| Silent autonomous publishing | No write path to final without an approval event |

Cost and latency budgets, evaluation harnesses, and prompt-engineering standards belong to Volume 7 (parallel author).

---

*Next: [04 — API & Stack](04-api-and-stack.md)*

Last updated: 2026-08-06
