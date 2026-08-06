# 03 — Weekly Competitive Sweep

## When to Use

- The standing weekly run of the competitive-intel agent (Master Instructions §11: weekly + event-triggered). At beta this brief is the batch job's instruction; run manually until then.
- Out of cycle, when an event trigger fires: competitor pricing change, major release, acquisition, analyst publication, or a competitive-mention spike in calls.

## The Brief

Replace `[WEEK]` (e.g., 2026-08-03 to 2026-08-07). Paste in full:

---

Run the weekly competitive sweep for **[WEEK]**. Read all brand files first. Do not guess; report only what sources support.

**Context.** Read, in order:
1. `pmm-playbook/vol-6-integrations/04-competitive-sources.md` — source types and rules
2. Every dossier in `GTM-War-Room/MARKET-INTELLIGENCE/competitive/` — the current baseline and each dossier's monitored-sources list
3. This week's intake drops (new source captures), if any
4. `GTM-War-Room/MARKET-INTELLIGENCE/voice-of-market/` — this week's competitive mentions from calls

**End state.** Two artifacts:
1. A sweep note at `GTM-War-Room/MARKET-INTELLIGENCE/competitive/sweeps/[WEEK]-sweep.md`: per competitor, what changed since last capture (pricing, releases, reviews, hiring, analyst) — diffed against the dossier, each finding dated and sourced. A quiet week is reported as a quiet week.
2. Signal-log entries appended (proposed) to each affected dossier, plus proposed battlecard updates where a finding touches a sales-facing claim.

**Constraints.**
- Public sources only, honestly obtained; every fact carries its capture date.
- Respect their strengths: findings that favor a competitor are reported with the same rigor as ones that favor us.
- G2/review findings quoted verbatim with reviewer segment — paraphrase kills their battlecard value.
- Flag any dossier section now older than one quarter as stale.
- Business translation (§3.3) on every finding with implications: insight → action → named metric → stakeholder. Route positioning-relevant findings to the product-to-market agent's queue; deal-pattern findings to win-loss.
- All dossier and battlecard changes are proposals (§8.5), not applied edits.

---

## Expected Output

- The dated sweep note, findings sourced and translated.
- Proposed dossier/battlecard updates queued for PMM admin approval.
- A one-line health summary: sources checked, sources stale, dossiers needing quarterly refresh.

## Follow-Ups

- Approve/reject proposed dossier updates; approved battlecard changes trigger `04-deal-support.md`-style regeneration for affected cards.
- If the same competitor triggers events two weeks running, consider an out-of-cycle deep refresh of that dossier.
- Quarterly (2026-Q4 boundary next): full competitor-set review — dead cards out, per §12 B8.

### Variant: Event-Triggered Sweep

Same brief, scoped to one competitor, with the trigger named in the note's header ("Trigger: [COMPETITOR] pricing page change captured [DATE]") and battlecard-impact assessment mandatory rather than as-needed.
