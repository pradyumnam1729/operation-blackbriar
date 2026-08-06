# 02 — Foundation-Doc Workflow

---

## The Workflow at a Glance

Building (or refreshing) the foundational doc for a product is the system's most consequential workflow — everything else generates from its output. Six stages, none skippable:

```
1. Interview → 2. Draft sections → 3. Validate against intelligence
      → 4. PMM approval (per section) → 5. Publish to war room → 6. Queryable
```

The `/foundation-doc` skill (`../../.claude/skills/`) is the executable form; the app's foundational-doc builder ([Vol 3, ch. 01](../vol-3-architecture/01-system-overview.md)) is the productized form. Both implement exactly this sequence.

---

## Stage 1 — Interview

The system interviews the PMM; the PMM does not stare at a blank template. Questions follow the framework order — positioning first ([Vol 2, ch. 01](../vol-2-domain-knowledge/01-positioning-standard.md)), then ICP/personas/JTBDs, then value props, competitive, guardrails, proof, objections — and each question is specific: not "describe your positioning" but "what category does the buyer already understand you in?", "who exactly is this for — and who is it *not* for?", "what would the customer use if you didn't exist?"

Inputs consulted before asking: existing war-room files (never re-ask what is already codified — confirm it instead), `about-me.md` for stage context, any prior foundation version. For Aurigo seeding, `../../engineering-playbook/vol-1-company/` provides deep raw material; the interview's job is selection and sharpening, not rediscovery.

## Stage 2 — Draft Sections

Each section is drafted in its framework shape: positioning in the Dunford formula, value props as six-field schema records, personas with pains/triggers/objections/vocabulary, competitive as per-competitor summaries pointing to A3 dossiers, guardrails as explicit rule lists, proof linked to the evidence register. Drafts carry `status: draft` and name their sources. Free-text blobs where structure is prescribed are returned to draft — the structure is what makes the doc executable rather than merely readable ([Vol 1, ch. 01](../vol-1-product/01-vision-mission.md)).

## Stage 3 — Validate Against Intelligence

Before any section reaches the PMM for approval, it is checked against the war room's validated intelligence — this is the §3.1 gate applied to the foundation itself:

| Section | Validated against |
|---------|-------------------|
| Positioning | A3 competitive dossiers (do our "why better" claims survive current competitor reality?), anti-pattern check, swap test |
| ICP / personas / JTBDs | A2's latest validation, A4 win/loss record (do we actually win where the ICP says we should?) |
| Value props | Schema completeness; field 6 costs sourced, not invented; A1 language present |
| Competitive | Dossier freshness (≤ 30 days for active competitors) |
| Proof | Every claim has an evidence-register entry (A5); no proof, no claim |
| Guardrails | Consistency with `gtm-rules.md` and voice standards |

Discrepancies do not silently resolve: the workflow surfaces them ("positioning claims X; the last three losses cite X as a weakness") and the PMM decides. Where intelligence is missing, the section is marked **provisional** with a named populate-plan — visible honesty instead of confident gaps.

## Stage 4 — PMM Approval, Per Section

Approval is per section, not per doc, because sections mature at different speeds and a doc-level gate would hold hostage-ready sections hostage. Each approval records actor, timestamp, and version ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)); rejection returns the section to draft with notes. Only `approved` sections become generation sources — a product can be partially live, with the queryable surface growing section by section.

## Stage 5 — Publish to War Room

Approved sections materialize into the war-room files (`BRAND-DNA/positioning-and-icp.md`, `gtm-rules.md`, the messaging library, `personas.md`), keeping agents and app on one truth ([Vol 2, ch. 07](../vol-2-domain-knowledge/07-war-room-model.md)). Publication increments section versions — which is the event that flags downstream assets stale per the consistency rule.

## Stage 6 — Queryable

The moment sections publish, the knowledge engine can cite them and the asset generator can consume them. There is no separate "activation" step: being in the foundation *is* being live. This is also the demo moment — foundation approved at minute one, battlecard generated from it at minute two.

---

## Refresh, Not Just Build

The workflow reruns in three modes: **full build** (new product), **section refresh** (triggered by staleness alerts, §8.5 proposals, or intelligence contradicting an approved section), and **extension** (new industry/persona — the Value Prop 3 motion: extend, validate, approve, and the whole asset catalog lights up for the new segment). Refresh runs stages 3–6 only; the interview is reserved for what the war room genuinely cannot know.

---

*Next: [03 — Query/Answer Workflow](03-query-answer-workflow.md)*

Last updated: 2026-08-06
