# 07 — Exec Brief

## When to Use

- Leadership needs a decision or a strategic update: competitive position, launch results, a strategic-opportunity pitch coming out of the §3.4 funnel, quarterly GTM performance.
- A leadership ask-war-room query deserves a page rather than an answer.

## The Brief

Replace `[TOPIC]` and `[DECISION-MAKER]`. Paste in full:

---

I need an exec brief on **[TOPIC]** for **[DECISION-MAKER / leadership team]**. Read all brand files first. Ask me clarifying questions using AskUserQuestion before you execute — at minimum: is a decision being asked (and which), by when, and what does this audience already know. Do not guess.

**Context.** Read, in order:
1. `GTM-War-Room/strategy.md` — current OKRs; the brief must trace to one (§3.5: anything that can't is sand, and sand does not go in front of executives)
2. The analyses this brief rests on: `GTM-War-Room/MARKET-INTELLIGENCE/[relevant files]` — name them; if the supporting analysis does not exist, stop and tell me what needs to run first
3. `pmm-playbook/vol-9-templates/exec-brief-template.md` — the structure, exactly

**End state.** A one-page brief at `GTM-War-Room/PLAYBOOKS-AND-ASSETS/exec-briefs/[topic]-[YYYY-MM-DD].md` per the template: metric-first headline (the number and the ask in line one), the numbers table (named metrics from the §3.3 exec taxonomy — MRR, NRR, win rate, pipeline — with periods, baselines, leading/lagging tags), drivers with sources, the decision asked, 2–3 real options including do-nothing with its quantified cost of inaction, and one recommendation with a named owner and first step.

**Constraints.**
- Named metrics only; absolute periods; small-number honesty (counts where percentages would overclaim, per `pmm-playbook/vol-6-integrations/03-crm.md`).
- Every driver cites a war-room source — §15: validated from data, never assumed. No unsourced claims survive to the draft.
- Options are real: if you cannot argue option B sincerely, find the real option B or present two options honestly rather than three theatrically.
- One page, hard limit. One decision per brief.
- Confident and direct on the recommendation — no "may/could/potentially" hedging (voice constants).
- Run `/asset-qa`; deliver at `stage: draft`.

---

## Expected Output

- The one-page brief, draft stage, asset-qa attached.
- A stated OKR trace: which company OKR this decision serves.
- If the analysis exposed gaps, a pre-brief note saying what is known thinly and how confidence could be raised before the decision date.

## Follow-Ups

- PMM admin approval, then delivery per the doc-export surface (`pmm-playbook/vol-6-integrations/05-content-surfaces.md`).
- After the decision: record it and the rationale in `GTM-War-Room/strategy.md` (proposed update, §8.5) and close the loop — the named metric gets a review date, and gtm-performance picks it up.
