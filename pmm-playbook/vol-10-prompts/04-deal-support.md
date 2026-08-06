# 04 — Deal Support (Live-Deal Battlecard + Talk Track)

## When to Use

- Sales faces a named competitor in a live deal and needs support now — the classic ad-hoc request (§3.5 sand, tightly scoped for exactly that reason).
- A rep asks the war room a competitive question that deserves a full asset rather than an answer.
- The `/battlecard` skill encodes this brief; use the skill in operating sessions.

## The Brief

Replace `[COMPETITOR]`, `[PRODUCT]`, and the deal fields. Paste in full:

---

I need deal support: a battlecard and talk track for a live **[PRODUCT]** deal against **[COMPETITOR]**. Read all brand files first. Ask me clarifying questions using AskUserQuestion before you execute — at minimum confirm: buyer segment and persona, deal stage, what the competitor has already shown or claimed, and the rep's deadline. Do not guess.

**Context.** Read, in order:
1. `GTM-War-Room/MARKET-INTELLIGENCE/competitive/[competitor].md` — if this dossier is missing or `dossier_last_verified` is older than 30 days, stop and tell me; a battlecard from a stale dossier is worse than none
2. `GTM-War-Room/[product]-foundation.md` — §6 competitive summary, §8 proof points, §9 objection library
3. `GTM-War-Room/MARKET-INTELLIGENCE/win-loss/` — recent notes implicating this competitor
4. `pmm-playbook/vol-9-templates/battlecard-template.md` — the structure, exactly

**End state.**
1. A 2-page battlecard at `GTM-War-Room/PLAYBOOKS-AND-ASSETS/battlecards/[competitor]-[YYYY-MM-DD].md` per the template: snapshot, where we win / where they win (honest), talk track, landmines to plant and avoid, objection one-liners, proof — tuned to this deal's segment and stage.
2. A deal-specific talk track section: the 60-second story for *this* buyer, on the §7.2 arc in miniature, in words the rep can say aloud, using this segment's terminology (program vs. portfolio — check before writing).

**Constraints.**
- Every claim cites the dossier or foundation doc; landmines only from verified weaknesses; no trash-talk (§7.2).
- Proof points: reference-approved only for anything the rep will show the buyer.
- Swap test on "where we win" — rewrite anything a competitor could equally claim.
- Public-sector deal: no ROI framing; "program outcomes" / "capital program performance."
- Run `/asset-qa`; deliver as `stage: draft` with the results — flag clearly that the rep gets it after PMM admin approval, and optimize for that approval happening inside the rep's deadline.

---

## Expected Output

- The deal-tuned battlecard draft with asset-qa results, ready for same-day approval.
- The spoken talk track, one screen.
- Proposed updates (§8.5): anything this deal taught us — a new objection heard, a competitor claim not in the dossier — queued for the war room.

## Follow-Ups

- After the deal closes (either way): trigger the win-loss interview per `pmm-playbook/vol-9-templates/win-loss-interview-guide.md` — deal-support requests are the best interview candidates.
- If this competitor generates deal-support requests repeatedly, that is the §3.5 signal: promote to a standing refreshed battlecard rather than regenerating ad hoc.
