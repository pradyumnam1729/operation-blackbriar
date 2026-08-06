# 03 — Query/Answer Workflow

---

## The Contract

A consumer asks a plain-language question; the system returns an answer that is **war-room-grounded, role-framed, and cited** — or it says honestly that it cannot, and routes the gap to an intelligence agent. There is no third outcome. The `/ask-war-room` skill is the prototype; the app's knowledge engine is the product form ([Vol 3, ch. 01](../vol-3-architecture/01-system-overview.md)).

```
Question (role known)
   → select relevant war-room files / foundation sections
   → can they answer it?
        ├─ yes → compose answer → frame for role → attach citations → deliver → log
        └─ no  → say so → route intelligence task → log escalation → notify when resolved
```

---

## Step by Step

**1. The question arrives with a role.** The asker's persona ([Vol 1, ch. 04](../vol-1-product/04-users-personas.md)) is known from their account; it determines framing later, and access boundaries always ([Vol 3, ch. 05](../vol-3-architecture/05-security-and-governance.md)).

**2. Source selection.** Deterministic where possible (named competitor → that dossier; product question → that product's sections), a cheap selection pass over the war-room index where not ([Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)). Whole files are loaded — the corpus is small, and whole files make citations exact.

**3. Grounding check.** The hard rule: **the answer may contain only what the sources support.** The model's general knowledge may organize and phrase; it may not supply facts, claims, numbers, or competitor characterizations. A question the sources cannot support goes to escalation, not to eloquence.

**4. Role-aware composition.** The same truth, rendered in the asker's dialect per the metrics map ([Vol 2, ch. 05](../vol-2-domain-knowledge/05-business-translation.md)) and output frame: Sales gets talk-track shape with objection handling; Proposals gets compliant-answer shape with proof; Leadership gets metric impact; SDR gets openers and one-liners. Voice rules apply when the answer text is destined for buyer contact (program vs. portfolio, no public-sector ROI framing).

**5. Citations, always.** Every answer names the files and sections (with versions) it drew from. Citations are the trust mechanism: a rep who can click through to the approved source stops second-guessing the system and stops maintaining a private stash of homemade answers.

**6. Logging.** Question, answer, citations, outcome — into the Query/Answer log. The log is product signal: recurring questions are self-serve or always-on candidates (§3.5 promotion); unanswered clusters are foundation gaps with names.

---

## Escalation — When the War Room Cannot Answer

The defining design choice, from §2.1 and `../../CLAUDE.md`: **guessing is a failure mode.** When sources are missing, stale, or contradictory:

1. **Say so, specifically.** "The war room has no win/loss data on water-utility deals; the competitive dossier on Brightly was last validated 2026-05-12." Not a shrug — a diagnosis.
2. **Route, don't drop.** The gap becomes a task for the owning intelligence agent (A1–A5 per subject), briefed per [chapter 01](01-intake-protocol.md), logged with the originating query.
3. **Give the asker a path.** Expected resolution time; anything partial that *is* supported, clearly bounded ("what we can say today, from sources X and Y…").
4. **Close the loop.** When the intelligence lands and is approved, the asker is notified and the answer is generated properly.

An escalation is a good outcome. It is the system converting an unknown-unknown into a scheduled known — and the escalation rate falling over time is the foundation getting genuinely complete, not the system getting braver ([Vol 1, ch. 06](../vol-1-product/06-success-metrics.md), answer coverage).

---

## Quality Rules

| Rule | Rationale |
|------|-----------|
| No citation, no answer | Uncited text is indistinguishable from guessing, which it usually is |
| Stale sources are disclosed inline | "Per the 2026-05-12 dossier" lets the asker weigh currency; hiding the date fakes freshness |
| Competitive answers use maturity framing, never trash-talk | Answers get repeated verbatim in deals; arc step 5 discipline applies at answer time ([Vol 2, ch. 03](../vol-2-domain-knowledge/03-narrative-arc.md)) |
| Answers are answers, not asset dumps | If the real need is an asset, say so and hand off to the [asset workflow](04-asset-generation-workflow.md) |
| The worst output is a wrong confident answer to a rep in a live deal | Every rule above exists because of this sentence |

---

*Next: [04 — Asset Generation Workflow](04-asset-generation-workflow.md)*

Last updated: 2026-08-06
