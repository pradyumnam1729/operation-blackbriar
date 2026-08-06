# Volume 9 — Templates

**PMM Agent Playbook · Operation Blackbriar**
Version 1.0 · 2026-08-06

---

This volume contains the production fill-in templates for every recurring PMM asset the system generates. Each template is pre-wired to the standards in `PMM Agent — Master Instructions & Contex.md` and `Voice of Aurigo - Standards Reference.md`: the section scaffold enforces the right structure, and inline guidance (in blockquotes) quotes the specific standard each section must satisfy, so the first time you fill one in you know exactly what "good" looks like.

These templates are used by humans and agents identically. Asset-generator briefs in `pmm-playbook/vol-10-prompts/` name a template as their end state; the `asset-qa` gate checks outputs against the template's guidance.

---

## Templates Index

| # | File | Template | When to Use |
|---|------|----------|-------------|
| 1 | `foundation-doc-template.md` | **Foundational Doc** | Onboarding a product into the war room; the one rigorous doc everything else derives from. The standardized framework the PMM Agent exists to enforce. |
| 2 | `battlecard-template.md` | **Battlecard** | Sales faces a named competitor in a live deal; refreshed continuously per the Master Instructions §12 B8 loop. |
| 3 | `launch-brief-template.md` | **Launch Brief** | Any launch entering `GTM-War-Room/ACTIVE-LAUNCHES/`; created by the launch-orchestration agent. |
| 4 | `sales-one-pager-template.md` | **Sales One-Pager** | A persona-matched leave-behind for an active conversation or event. |
| 5 | `rfp-response-template.md` | **RFP Response** | The proposals team answering an RFP section; compliant answer first, differentiation second. |
| 6 | `exec-brief-template.md` | **Exec Brief** | Leadership needs a decision or an update; metric-first, one page. |
| 7 | `win-loss-interview-guide.md` | **Win-Loss Interview Guide** | Interviewing a buyer after a closed deal; feeds `GTM-War-Room/MARKET-INTELLIGENCE/win-loss/`. |
| 8 | `case-study-template.md` | **Case Study** | A customer outcome is validated and reference-approved; feeds `GTM-War-Room/PLAYBOOKS-AND-ASSETS/case-studies/`. |
| 9 | `messaging-framework-template.md` | **Messaging Framework** | Building the messaging layer between approved positioning and any copy; per-audience value props in the §7.4 schema. |
| 10 | `handover-template.md` | **Handover** | Every session end, no exceptions; written to `GTM-War-Room/HANDOVER.md`. |

---

## How to Use These Templates

1. **Copy the file** to its destination in `GTM-War-Room/` (each template names its home).
2. **Fill in the frontmatter completely.** Every asset carries `product`, `audience`, `persona`, `stage`, `sources`, `date` per `CLAUDE.md` conventions. `stage` starts as `draft`, always. `sources` lists the war-room files the content actually derives from — it is the audit trail, not decoration.
3. **Replace all `[PLACEHOLDER]` tokens.** A placeholder surviving into a draft is an asset-qa failure.
4. **Delete the blockquote guidance** (`> Guidance:` blocks) before the asset leaves draft. Guidance is scaffolding, not content.
5. **Run `/asset-qa`** before proposing promotion to final. No exceptions; see `pmm-playbook/vol-7-ai-engineering/03-guardrails.md`.

## Rules That Apply to Every Template

- **Voice:** all six constants and the banned list from `Voice of Aurigo - Standards Reference.md`. Reader-first openings. "Life cycle" two words. "AI-native" only. Program (public) vs. portfolio (commercial), never swapped.
- **Chain of custody:** copy derives from messaging, messaging from positioning (§3.2). A template being filled without its upstream layer approved is being filled too early.
- **Swap test:** every claim-bearing section must survive replacing "Aurigo" with "Oracle", "Microsoft", or "Kahua" (§8.1).
- **Absolute dates** everywhere, YYYY-MM-DD.
