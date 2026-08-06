# 05 — Approval Gates

*Encoded from Master Instructions §8.4 (draft → approval → final) and §8.5 (context-doc update proposals).*

---

## The Principle

> **All outputs are written as drafts. Nothing moves to final or ships without PMM admin approval. The system proposes; the human decides.**

This is the system's constitutional separation of powers. Agents and generators have unlimited capacity to *propose*; exactly one human has the authority to *promote*. The gate is implemented as a state machine with recorded transitions ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)) — there is no code path, skill, or agent instruction that writes a final without an approval event. A "small exception for urgent cases" is how governance systems die; there are no exceptions, and the urgent path is a fast approval, not a skipped one.

---

## Draft → Final Rules (§8.4)

1. **Everything enters as a draft.** Assets, foundation sections, answers destined for reuse, launch briefs, battlecards — anything that could reach a buyer or be treated as canon.
2. **A draft reaches the queue only after machine QA.** The asset-qa gate ([ch. 04](04-asset-generation-workflow.md)) runs first; the PMM's attention is spent on judgment, not on catching banned words a scan catches for free.
3. **The queue shows everything needed to decide on one screen:** the draft, its trace (source sections + versions), QA results, freshness warnings, requester and context, and — for revisions — a diff against the current final.
4. **Approve** promotes to final: actor, timestamp, version recorded; the asset becomes visible to its audience and enters the trace graph.
5. **Reject** returns to draft with notes; the notes travel into the regeneration context. Rejection is cheap and normal — a queue with a 100% approval rate is a rubber stamp, and the anti-metric in [Vol 1, ch. 06](../vol-1-product/06-success-metrics.md) says so.
6. **Approval latency is watched.** The gate must not become the new bottleneck the system was built to remove; queue latency is a dashboard metric with a same-day expectation for ad hoc deal assets.

---

## Who Approves What

| Output | Machine gate | Human approver |
|--------|-------------|----------------|
| Foundation sections | Validation vs. intelligence ([ch. 02](02-foundation-doc-workflow.md)) | PMM admin — per section |
| Buyer-facing assets (battlecards, one-pagers, RFP sections, copy) | asset-qa | PMM admin |
| Launch briefs and launch trees | asset-qa per artifact | PMM admin (Tier-1: PMM + leadership sign-off is a recommended convention, recorded as notes) |
| Intelligence reports (A-group syntheses) | Business-translation completeness check | PMM admin — approval marks them "validated," which is what opens the B-group gate |
| Context-doc updates | Diff well-formedness | PMM admin (§8.5, below) |
| Guardrail/config changes | — | PMM admin only; the change itself is audited |
| Engineering merges (building mode) | qa-reviewer gate ([Vol 4, ch. 04](../vol-4-agent-organization/04-build-agents.md)) | Human owner — separate lane entirely |

One approver by design at this stage: the PMM is accountable for every word in circulation, so the PMM holds the only stamp. If approval authority is ever delegated (regional PMMs, a marketing lead for channel copy), that is a Volume 5 change with an audit-trail design, not an informal handoff.

---

## Context-Doc Update Proposals (§8.5)

The second thing the gate governs: changes to the war room's canon. Any task that surfaces new insight **ends with proposed — not applied — updates** to the relevant context docs:

> "Suggest adding [new objection] to the objection library and [updated buyer language] to `our-customer.md` — approve to update."

Mechanics:

- Proposals are concrete diffs against named files, not vague suggestions ("consider updating personas" is not a proposal).
- They accumulate in the same approval queue, tagged by target file and proposing agent.
- Applying a proposal is a canon change: it versions the target section, which may cascade staleness flags to dependent assets — the queue shows this blast radius before the PMM clicks.
- Declined proposals are recorded with a reason; a proposal declined three times teaches the proposing agent's contract something, and C14 sees the pattern.
- The weekly review ritual ([ch. 07](07-session-rituals.md)) exists so proposals never silently pile up — an unreviewed proposal queue is deferred truth.

This mechanism is how the war room stays alive without becoming anyone's unaudited scratchpad: every fact in canon got there through the same door, with the same stamp.

---

## Why the Human Gate Is Permanent

The gate is not scaffolding for an immature system, to be removed when the models improve. It is the design. The PMM's approval is where accountability lives — the answer to "who decided this claim ships?" must always be a person. Better models will make drafts better and rejections rarer; they change the pass rate, not the constitution.

---

*Next: [06 — Always-On Programs](06-always-on-programs.md)*

Last updated: 2026-08-06
