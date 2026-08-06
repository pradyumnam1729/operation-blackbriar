---
stage: draft
date: 2026-08-06
sources:
  - "PMM Agent — Master Instructions & Contex.md (§4, §5, §8.4)"
---

# GTM War Room — Aurigo

This is the home directory for the PMM Agent system (Operation Blackbriar). Every agent reads the four BRAND-DNA files before executing any task. If the system does not know Aurigo's world, it produces generic output. That is a failure mode, not a starting point.

## How it is organized

| Path | What lives here |
|------|-----------------|
| `BRAND-DNA/` | The four minimum-viable-context files: positioning-and-icp, brand-voice, our-customer, gtm-rules. Injected into every session by the SessionStart hook. |
| `ACTIVE-LAUNCHES/` | One folder per launch: `[launch-name]/` with BRIEF.md, assets/, enablement/, channels/. See the README inside. |
| `PLAYBOOKS-AND-ASSETS/` | Evergreen activation output: messaging library, sales playbooks, battlecards, case studies. |
| `MARKET-INTELLIGENCE/` | Intelligence-agent output: competitive, win-loss, voice-of-market, icp-personas. |
| `about-me.md` | Operating context: company stage, portfolio, current priority. |
| `competitors.md` | Competitive landscape index and battlecard status. |
| `personas.md` | Named buyer personas with pains, goals, triggers, objections. |
| `strategy.md` | Current rocks, pebbles, and sand. Injected at session start. |
| `product-wiki.md` | Pointer map from each product to where feature truth lives. |
| `HANDOVER.md` | Written at the end of every session. Read at the start of the next. |

## Update rules

1. **Intelligence before activation.** No buyer-facing asset ships without validated upstream intelligence. Guessing is a failure mode.
2. **Draft → final gate (Master Instructions §8.4).** All outputs are written as drafts. Nothing is promoted to final or ships to users without PMM admin approval. The system proposes; the human decides.
3. **Propose, do not silently edit, context docs (§8.5).** When a task surfaces new insight, the agent proposes an update to the relevant context file and waits for approval.
4. **Voice compliance is enforced.** A PostToolUse hook scans every markdown write in this tree against the forbidden-words list. Fix violations before proceeding; do not work around the hook.
5. **Provenance is mandatory.** Every file carries frontmatter with `stage`, `sources`, and `date`, and a Validation status section separating sourced facts from placeholders.
6. **HANDOVER.md at every session close.** What was worked on, decisions made, outstanding items, context the next session needs.

## Validation status

- Sourced: structure and rules mirror the Master Instructions document.
- Placeholder: none.
