# Volume 7 — AI Engineering

**PMM Agent Playbook · Operation Blackbriar**
Version 1.0 · 2026-08-06

---

The PMM Agent is an AI system with a brand to protect. That combination is the entire engineering problem: large language models are excellent at producing plausible marketing language and indifferent to whether it is true, on-voice, or differentiated. This volume documents how we engineer around that — how tasks are briefed, how context reaches the model, how guardrails are layered so brand compliance never rests on model judgment alone, how outputs are evaluated, how content is structured for AI-search retrieval, and how model spend is kept proportionate to task value.

Read this volume before building or modifying anything in `.claude/agents/`, `.claude/skills/`, or `.claude/hooks/`, and before changing how any agent is briefed.

---

## Chapter Index

| # | File | Chapter | What It Covers |
|---|------|---------|----------------|
| 1 | `01-prompt-standards.md` | Prompt Standards | Brief-don't-prompt; Context + End State + Constraints; war-room paths over pasted blobs |
| 2 | `02-context-engineering.md` | Context Engineering | SessionStart injection of brand DNA, per-task file selection, why the war room is markdown-first |
| 3 | `03-guardrails.md` | Guardrails | The three layers: deterministic hooks → skill-level gates → human approval |
| 4 | `04-evals.md` | Evals | Swap test as automated eval, consistency checks, spot-check protocol, asset usage rate |
| 5 | `05-aeo-standard.md` | AEO Standard | Answer Engine Optimization per Master Instructions §8.3: structuring content so AI search retrieves and cites it |
| 6 | `06-cost-and-model-strategy.md` | Cost & Model Strategy | Model tiers per task, batch scheduling for always-on programs, caching stable brand context |

---

## The Governing Idea

Every chapter here is one instance of the same principle: **determinism where correctness matters, model judgment where synthesis matters, human judgment where the brand ships.** Forbidden words are caught by a hook, not by asking the model to be careful. Brand context arrives by injection, not by hoping the model reads the right files. Nothing customer-facing leaves draft without a human. The model does the work these mechanisms make safe to delegate.

## Related Material

- `PMM Agent — Master Instructions & Contex.md` §5 (hooks), §6 (intake protocol), §8 (quality standards & guardrails)
- `pmm-playbook/vol-3-architecture/` — where these mechanisms live in the app
- `pmm-playbook/vol-4-agent-organization/` — the 14 agents these standards govern
- `engineering-playbook/vol-10-claude-prompts/` — the engineering-side prompt library whose conventions this volume extends to PMM work
