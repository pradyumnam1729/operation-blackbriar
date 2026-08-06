# Volume 4 — Agent Organization

This volume is the org-level view of the PMM Agent's workforce: the 14 PMM sub-agents specified in Master Instructions §12, plus the three engineering build agents. It documents what each agent consumes, produces, and feeds — the contracts and data flow between them — and the routing rules that make fourteen specialists behave as one organization.

**This volume does not duplicate prompts.** The executable definitions live in `../../.claude/agents/*.md` — those files are the agents; they contain the system prompts, tool lists, and per-task instructions, and they are loaded directly by both Claude Code sessions and the app's orchestration layer ([Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)). This volume is the map above them: when a contract here changes, the matching agent file changes in the same commit, and vice versa.

---

## Contents

| # | Document | Description |
|---|----------|-------------|
| 00 | [Org Overview](00-org-overview.md) | The 14-agent org chart, the three groups, the routing rules (intelligence before activation — the hard gate), and orchestrator triage. |
| 01 | [Intelligence Group (A1–A5)](01-intelligence-group.md) | Voice-of-market, ICP/persona, competitive-intel, win/loss, customer-evidence: I/O contracts, cadences, consumers. |
| 02 | [Activation Group (B6–B10)](02-activation-group.md) | Product-to-market, launch-orchestration, sales-enablement, adoption-expansion, pricing-packaging: same treatment. |
| 03 | [Governance Group (C11–C14)](03-governance-group.md) | Messaging-effectiveness, content-governance, gtm-performance, pmm-prioritization: same treatment. |
| 04 | [Build Agents](04-build-agents.md) | app-architect, ui-engineer, qa-reviewer — the engineering-mode crew that builds the app itself. |

---

## How to Read This Volume

Read 00 first; the routing rules are the organization. Then read the group chapter for whichever agent you are working with — each agent entry follows a fixed shape (inputs, outputs, destinations, cadence, consumers) so contracts are comparable at a glance. Chapter 04 stands apart: build agents serve engineering mode and never touch PMM outputs.

---

## Audience

| Reader | Focus on |
|--------|----------|
| PMM admin | 00 for routing and triage; group chapters when commissioning or auditing an agent's work |
| An agent (reading its own contract) | Your entry in the group chapter + your file in `../../.claude/agents/` — the file wins on wording, this volume wins on data flow |
| Engineer building orchestration | 00 (the gate logic) and every "destination" column — they define the write paths the app must honor |

---

## Contract Change Protocol

1. Change the agent's `.claude/agents/*.md` file and the corresponding entry here in one commit: `docs(playbook): [vol-4] <change>` plus the agent-file change.
2. A new agent requires: an entry in the group chapter, the agent file, and a routing note in 00. An agent nobody routes to is a file, not a worker.
3. Retirement is explicit: mark the entry retired with a date and the reason; do not silently delete data-flow history.

---

Last updated: 2026-08-06
