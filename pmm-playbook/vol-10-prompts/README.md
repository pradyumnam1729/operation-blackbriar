# Volume 10 — PMM Prompt Library

**PMM Agent Playbook · Operation Blackbriar**
Version 1.0 · 2026-08-06

---

## What This Is

Ready-to-paste operating briefs for the PMM Agent's recurring work, in the same spirit as `engineering-playbook/vol-10-claude-prompts/`: not descriptions of what a brief should contain, but the actual brief text, refined so any PMM or agent gets consistent results without reinventing the approach.

Every brief follows the standards in `pmm-playbook/vol-7-ai-engineering/01-prompt-standards.md`: Context + End State + Constraints, war-room paths instead of pasted content, and the Master Instructions §6 intake protocol (clarifying questions via AskUserQuestion before executing — do not guess). The four brand-DNA files arrive by SessionStart injection and are not restated in briefs.

## How to Use a Brief

1. **Open the relevant file** from the table below.
2. **Replace all `[PLACEHOLDER]` values** — `[COMPETITOR]`, `[PRODUCT]`, `[LAUNCH-NAME]`, etc.
3. **Paste into a session** (or invoke the corresponding skill from `.claude/skills/` where one exists — the skill encodes the same brief with the workflow attached).
4. **Answer the clarifying questions** the agent asks before it executes; a brief that provokes more than one round of clarification should be improved in place, per the engineering playbook's rule.
5. **Review the output as a draft.** Everything lands at `stage: draft` awaiting the §8.4 gate.

## Brief Index

| # | File | Brief | Use When |
|---|------|-------|----------|
| 01 | `01-seed-war-room.md` | Seed the War Room | Standing up `GTM-War-Room/` for a new product or tenant; first-run onboarding |
| 02 | `02-build-foundation-doc.md` | Build the Foundational Doc | A product needs its foundational doc created or fully refreshed |
| 03 | `03-weekly-competitive-sweep.md` | Weekly Competitive Sweep | The standing weekly run; also after any competitive event trigger |
| 04 | `04-deal-support.md` | Deal Support | Sales faces a live competitive deal and needs a battlecard + talk track now |
| 05 | `05-launch-kickoff.md` | Launch Kickoff | A product update warrants a coordinated launch; scaffolds the launch tree |
| 06 | `06-rfp-response.md` | RFP Response | The proposals team has RFP questions to answer against a deadline |
| 07 | `07-exec-brief.md` | Exec Brief | Leadership needs a metric-first decision brief |
| 08 | `08-quarterly-prioritization.md` | Quarterly Prioritization | Quarter boundary; building the traceable priority tree |
| 09 | `09-content-audit.md` | Content Audit | The monthly governance sweep; also after any positioning change |
| 10 | `10-ask-war-room-examples.md` | Ask-War-Room Examples | Reference queries per persona for the query flow; demo and testing |

## Contributing an Improved Brief

Same rule as the engineering library: if a modified brief produced a better result, update the file so the next person benefits, document variants under a `### Variant:` heading, and treat brief quality like production code quality. Commit as `docs(playbook): [vol-10] <what changed>`.
