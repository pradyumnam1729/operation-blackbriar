# 06 — RFP Response

## When to Use

- The proposals team has an RFP (or a section of one) to answer against a deadline — the Proposals persona's core need per Master Instructions §9.2: "differentiation framing, compliant answers, proof assets, use-case evidence."
- Also for security/procurement questionnaires that follow the same question-answer-proof shape.

## The Brief

Replace `[OPPORTUNITY]`, `[PRODUCT]`, `[ISSUER]`, and attach or point to the question set. Paste in full:

---

I need RFP response drafts for **[OPPORTUNITY]** — issuer: **[ISSUER]**, product: **[PRODUCT]**, due **[YYYY-MM-DD]**. The questions are in [path or attachment — this is legitimate one-off task input per `pmm-playbook/vol-7-ai-engineering/01-prompt-standards.md`]. Read all brand files first. Ask me clarifying questions using AskUserQuestion before you execute — at minimum: the incumbent/competitive context, the evaluation criteria if known, and which questions are must-win versus commodity. Do not guess.

**Context.** Read, in order:
1. `GTM-War-Room/product-wiki.md` — the only source of capability claims (`pmm-playbook/vol-6-integrations/06-product-truth.md`)
2. `GTM-War-Room/[product]-foundation.md` — differentiation, proof points, objection library
3. `GTM-War-Room/PLAYBOOKS-AND-ASSETS/` answer library — reuse validated answers before writing new ones
4. `pmm-playbook/vol-9-templates/rfp-response-template.md` — the structure, exactly

**End state.** A response file per the template at `GTM-War-Room/PLAYBOOKS-AND-ASSETS/rfp/[opportunity]-[YYYY-MM-DD].md`: the win themes section first (2–3, derived from our differentiation and this issuer's context), then one block per question — compliant answer first (direct, standalone, product named in full), differentiation framing where real, proof assets with reference status, internal compliance notes. Formatted for the proposal-tool handoff per `pmm-playbook/vol-6-integrations/05-content-surfaces.md`.

**Constraints.**
- **Accuracy outranks persuasion.** Every "yes" traces to `product-wiki.md`. Where the honest answer is "partial" or "no," write it as partial or no with the strongest true framing — an over-claim in a public-sector RFP is a contract risk. Uncertain capability questions go on an escalation list for product confirmation, not into confident prose.
- Issuer terminology: mirror the RFP's vocabulary; public-sector issuer → program language, no ROI framing, "government agencies," org abbreviations without "the."
- No forced differentiation on commodity questions — omit the paragraph deliberately rather than pad.
- Swap test on every differentiation paragraph.
- Run `/asset-qa`; deliver at `stage: draft` with the escalation list on top.

---

## Expected Output

- The response file: win themes + per-question blocks, draft stage.
- The escalation list: questions needing product/legal confirmation before submission, each with what is needed and from whom.
- The answer-library write-back table: which new answers should join the reusable library after approval (§8.5).

## Follow-Ups

- Resolve escalations, PMM admin approval, then handoff to the proposals tool.
- After submission: apply the write-back so the next RFP starts further ahead.
- After the decision: this opportunity is a win-loss interview candidate (`pmm-playbook/vol-9-templates/win-loss-interview-guide.md`) — RFP losses carry unusually specific competitive intelligence.
