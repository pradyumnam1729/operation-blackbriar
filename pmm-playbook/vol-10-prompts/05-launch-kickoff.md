# 05 — Launch Kickoff

## When to Use

- A product update warrants a coordinated launch (typically arriving via the product-truth trigger, `pmm-playbook/vol-6-integrations/06-product-truth.md`, or a planned release date).
- The `/launch-brief` skill encodes this brief; use the skill in operating sessions.
- Not for Tier-3 changes that only need release notes and a wiki update — check tier first, and say so if the honest answer is "this is not a launch."

## The Brief

Replace `[LAUNCH-NAME]`, `[PRODUCT]`, `[WHAT IS LAUNCHING]`, `[TARGET DATE]`. Paste in full:

---

I want to kick off the launch **[LAUNCH-NAME]** for **[PRODUCT]**: [WHAT IS LAUNCHING], targeting [TARGET DATE]. Read all brand files first. Ask me clarifying questions using AskUserQuestion before you execute — at minimum: confirm the tier recommendation with me, the primary audience, and any date constraints. Do not guess.

**Context.** Read, in order:
1. `GTM-War-Room/product-wiki.md` — the factual basis for what is launching
2. `GTM-War-Room/[product]-foundation.md` — positioning, personas, value props this launch draws on
3. `GTM-War-Room/MARKET-INTELLIGENCE/voice-of-market/` and `win-loss/` — the validated evidence that this matters to buyers (§3.1 gate: if no intelligence supports buyer demand for this, stop and say so)
4. `GTM-War-Room/about-me.md` — company stage, for §10 stage-aware behavior
5. `pmm-playbook/vol-9-templates/launch-brief-template.md` — the structure, exactly

**End state.** The launch tree scaffolded per Master Instructions §4:
```
GTM-War-Room/ACTIVE-LAUNCHES/[launch-name]/
├── BRIEF.md          ← per the template, all nine sections, 7-step arc complete
├── assets/messaging.md      ← scaffolded, marked "blocked on brief approval"
├── assets/objections.md     ← scaffolded
├── enablement/battlecards/  ← folder + refresh list
├── enablement/one-pager.md  ← scaffolded
└── channels/email.md, social.md ← scaffolded per the tier's channel mix
```
BRIEF.md carries the tier recommendation with rationale, the full 7-step narrative arc (§7.2), deliverables/owners/dependencies, the channel + AEO plan (buyer questions phrased per `pmm-playbook/vol-7-ai-engineering/05-aeo-standard.md`), readiness checklist, and named success metrics with owners (§3.3).

**Constraints.**
- The brief contains story and plan, never channel copy — the §3.2 chain runs brief → messaging → copy, gated at each step.
- Arc discipline: every step filled per the §7.2 Do column; reject generic status-quo framing and "AI is changing everything" (§7.2 Don'ts).
- Tier honesty: recommend the tier the evidence supports, not the tier that flatters the feature.
- Enablement dates precede external dates in the deliverables table, always.
- Downstream files are scaffolds with owners and dependencies — they get built by their own briefs after this brief is approved.

---

## Expected Output

- The scaffolded launch tree with BRIEF.md at `stage: draft`.
- The tier recommendation, argued from evidence, awaiting my confirmation.
- The dependency map showing which deliverables are blocked on which intelligence or approvals.

## Follow-Ups

- On brief approval: build `assets/messaging.md` per `pmm-playbook/vol-9-templates/messaging-framework-template.md`; then channel copy derives from it.
- Tier-1: schedule the analyst deliverables and the ABM plan build.
- Post-launch: gtm-performance measures against the §9 success metrics table; findings feed the next launch's brief.
