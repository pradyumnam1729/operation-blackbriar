# 08 — Quarterly Prioritization

## When to Use

- The quarter boundary (next: 2026-10-01 for Q4 planning) — the pmm-prioritization agent's planning-cycle run per Master Instructions §12 C14.
- Mid-quarter, when the request load has visibly drifted from plan and the allocation needs re-checking.

## The Brief

Replace `[QUARTER]`. Paste in full:

---

Run quarterly prioritization for **[QUARTER]**. Read all brand files first. Ask me clarifying questions using AskUserQuestion before you execute — at minimum: confirm the company OKRs for the quarter and any known fixed commitments (launch dates, renewals, events). Do not guess.

**Context.** Read, in order:
1. `GTM-War-Room/strategy.md` — company and team OKRs (if stale, stop; prioritization against stale OKRs is theater)
2. `GTM-War-Room/MARKET-INTELLIGENCE/` — the quarter's intelligence: gtm-performance rollups, win-loss patterns, competitive events
3. The request backlog and last quarter's HANDOVER trail — what was asked for, what recurred
4. `GTM-War-Room/HANDOVER.md` — outstanding items carried forward

**End state.** A priority tree at `GTM-War-Room/strategy-[quarter].md` — a **traceable tree, not a flat ranked list** (§3.6): Company OKR → Team OKR → Monthly Priorities → 1–2 Weekly Projects, with every recommended action linking up through its monthly priority and quarterly rock to a company OKR. Sized per §3.5/§3.6:
- **Rock:** 1 major quarterly initiative
- **Pebbles:** 2–3 supporting projects
- **Sand:** reactive capacity, tightly limited
- Checked against the ~50/25/15/10 allocation (company initiatives / team initiatives / always-on programs / ad hoc)

Each item carries the C14 ranking factors: revenue impact, strategic importance, urgency, effort.

**Constraints.**
- Anything that cannot trace to a company OKR is flagged as sand, explicitly, even if someone senior asked for it.
- Recurring ad-hoc requests from last quarter are named as promotion candidates to Always-On programs (§3.5) — list them with their recurrence count.
- Always-on programs (§11) are budgeted inside the 15%, not squeezed out by rocks; if the rock genuinely requires pausing a program, say so as a decision for me, not a silent cut.
- The §2.2 prerequisite check rides along: if a planned initiative depends on a source we have not connected, the dependency appears in the tree.
- Deliver as a proposal (`stage: draft`) — the tree is a recommendation; the PMM admin and leadership own the final allocation.

---

## Expected Output

- The priority tree, traceable top to bottom, with the rock/pebbles/sand sizing and allocation math shown.
- The promotion-candidate list (ad hoc → always-on) with evidence.
- The flagged-as-sand list, with the OKR each item failed to trace to — the conversation starter, not the verdict.

## Follow-Ups

- Review with leadership; approved tree replaces `strategy.md`'s quarterly section (§8.5 proposal flow).
- Feed the rock and pebbles into monthly priorities; the gtm-performance agent measures against this tree at quarter end.
- Revisit mid-quarter only on a trigger (lost rock dependency, major market event), not on mood.
