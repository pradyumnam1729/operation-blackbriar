# Launch Brief — [LAUNCH NAME]

> **What this is.** The BRIEF.md at the root of `GTM-War-Room/ACTIVE-LAUNCHES/[launch-name]/` — the single document the whole launch tree derives from. Created by the launch-orchestration agent (Master Instructions §12 B7); gated on validated intelligence inputs per §3.1. The launch story is built on the 7-step narrative arc (§7.2) before any channel copy exists.

```yaml
---
product: "[product line]"
audience: "[launch target audience/segment]"
persona: "[primary persona(s) this launch speaks to]"
stage: draft
sources:
  - "GTM-War-Room/[foundational doc]"
  - "GTM-War-Room/MARKET-INTELLIGENCE/voice-of-market/[validating evidence]"
  - "GTM-War-Room/product-wiki.md"
date: [YYYY-MM-DD]
launch_date: [YYYY-MM-DD]
tier: "[1 | 2 | 3]"
---
```

---

## 1. Launch Tier & Rationale

> Guidance: tier drives everything downstream — deliverable count, channel mix, analyst involvement. Tier 1: new product / major repositioning — full channel mix, ABM plan, analyst briefings. Tier 2: significant capability — targeted channels, sales enablement refresh. Tier 3: incremental — release notes, wiki update, existing-asset refresh. State why this tier, and what stage-aware behavior applies (§10 — read `GTM-War-Room/about-me.md` for current stage).

**Tier:** [1/2/3] — **Because:** [rationale in two sentences]

## 2. What Is Launching

> Guidance: the factual layer, traceable to `product-wiki.md` per `pmm-playbook/vol-6-integrations/06-product-truth.md`. What exists now that did not before? No marketing language in this section — facts here, story in §4.

[Capability description, availability date, packaging/pricing changes, segments it applies to.]

## 3. Audience

> Guidance: who this launch is for (and explicitly not for). Segment per the audience hierarchy in `Voice of Aurigo - Standards Reference.md` — and check the terminology: program for public owners, portfolio for facility owners.

- **Primary:** [segment + persona, from foundational doc §3]
- **Secondary:** [ ]
- **Explicitly not:** [who should not hear this framing, and why]

## 4. The Launch Story — 7-Step Narrative Arc

> Guidance — Master Instructions §7.2 (Talya Heller G.). Fill every step; the arc is the story's load-bearing structure. The "Don't" column of §7.2 is the failure list: generic status quo, "AI is changing everything," problem→solution jumps, feature dumps, logo walls. The deck built from this arc is a leave-behind that arms a champion to sell internally — "It's about them, not you."

1. **The old way** ("That's how we do it"): [quantifiable status quo the buyer sees themselves in]
2. **What changed** ("That's why it's been harder"): [specific shift, tied to their metrics]
3. **The tension** ("We're stuck between…"): [the forced tradeoff they can feel]
4. **Cost of inaction** ("This costs us every month"): [quantified, named risks and stakes]
5. **Why alternatives aren't enough** ("The usual fixes won't work"): [maturity model with ceilings — no comparison-table trash-talk]
6. **What success looks like** ("Here's what is possible"): [capability stack, what becomes possible — not a feature dump]
7. **Proof we can deliver** ("Here's who this works for and why"): [before/after, proof near claims, objections pre-answered]

## 5. Messaging Pointer

> Guidance — §3.2: this brief links to messaging; it does not contain copy. Value props in the §7.4 schema live in `assets/messaging.md` in this launch tree; objection handling in `assets/objections.md`. Copy for each channel derives from those, never from this brief directly.

- Messaging: `ACTIVE-LAUNCHES/[launch-name]/assets/messaging.md` — [status]
- Objections: `ACTIVE-LAUNCHES/[launch-name]/assets/objections.md` — [status]

## 6. Deliverables, Owners, Dependencies

> Guidance: every deliverable has one owner and a date. Intelligence dependencies listed explicitly — an unchecked dependency blocks its deliverables per §3.1 (no activation without validated intelligence).

| Deliverable | Path in launch tree | Owner | Due | Depends on | Status |
|-------------|--------------------|-------|-----|------------|--------|
| Messaging framework | `assets/messaging.md` | [ ] | [YYYY-MM-DD] | validated VoM + persona files | [ ] |
| Battlecard refresh | `enablement/battlecards/` | [ ] | [ ] | competitive dossier current | [ ] |
| One-pager | `enablement/one-pager.md` | [ ] | [ ] | messaging approved | [ ] |
| Email sequence | `channels/email.md` | [ ] | [ ] | messaging approved | [ ] |
| [Tier-1 only] Analyst briefing book | [ ] | [ ] | [ ] | [ ] | [ ] |

## 7. Channel + AEO Plan

> Guidance — §12 B7: Tier-1 launches include channel mix, ABM plan, and an AEO plan alongside SEO. For AEO, apply `pmm-playbook/vol-7-ai-engineering/05-aeo-standard.md`: which buyer questions will web content answer, phrased as the buyer asks them?

**Channels:** [per tier and stage: web, email, ABM, social, PR, events — with dates]

**AEO plan:**
| Buyer question (natural language) | Content answering it | Surface | Owner |
|-----------------------------------|----------------------|---------|-------|
| "[How buyers actually ask]" | [page/FAQ/post] | [ ] | [ ] |

## 8. Readiness & Risks

> Guidance: launch-readiness is a checklist, not a feeling. Enablement delivered before external dates, always.

- [ ] Intelligence inputs validated (list them)
- [ ] Messaging approved (§8.4 gate passed)
- [ ] Sales enablement delivered + reps briefed — [date]
- [ ] Assets through `/asset-qa`
- [ ] Known risks: [what could slip, and the fallback]

## 9. Success Metrics

> Guidance — §3.3: named metrics with owners, leading and lagging, framed in each stakeholder's language. "Awareness" is not a metric.

| Metric | Type | Baseline | Target | Owner |
|--------|------|----------|--------|-------|
| [pipeline / SQLs / usage rate / coverage] | [leading/lagging] | [ ] | [ ] | [named stakeholder] |
