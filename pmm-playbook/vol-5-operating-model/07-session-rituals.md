# 07 — Session Rituals

*Encoded from Master Instructions §5 (session hooks — always-on, non-negotiable).*

---

## Rituals Are Deterministic

The session rituals are hooks, not habits: they fire regardless of model judgment (§5). A ritual that depends on remembering is a ritual that eventually stops; the ones below are wired into the machinery — `../../.claude/hooks/` today, the app's session layer tomorrow. Three rituals bracket every session: injection at start, the guard during, the handover at close. A fourth runs weekly.

---

## SessionStart — Context Injection (§5.1)

At the start of every session, the SessionStart hook (`../../.claude/hooks/session-start.ps1`) injects into context:

1. `BRAND-DNA/positioning-and-icp.md`
2. `BRAND-DNA/brand-voice.md`
3. `BRAND-DNA/our-customer.md`
4. `BRAND-DNA/gtm-rules.md`
5. Current quarter's OKRs and rocks from `strategy.md`
6. `GTM-War-Room/HANDOVER.md` — the previous session's close

The injection is why "read the brand files first" never depends on compliance: the files are simply *there*, in every session, before the first task. The app replicates the pattern per model call ([Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)) — brand DNA travels with every request, cached, current as of last approval.

What a session does with the injection: confirm mode (operating vs. building, per `../../CLAUDE.md`), read the handover, and only then take work. A session that starts executing before orienting produces the classic re-briefing waste the ritual exists to kill.

## During — The Messaging Guard (§5.2)

Every messaging-document edit fires the PostToolUse hook (`../../.claude/hooks/messaging-guard.ps1`, list in `forbidden-words.txt`): forbidden words, chain compliance, competitor-claimable claims, customer-language presence. This is C12's continuous tripwire ([Vol 4, ch. 03](../vol-4-agent-organization/03-governance-group.md)) — the audit that runs at edit time instead of month-end, when fixing costs one keystroke instead of one recall.

## Session Close — HANDOVER.md (§5.3)

At the end of every session, write `GTM-War-Room/HANDOVER.md` (the `/handover` skill formalizes it):

| Section | Content |
|---------|---------|
| **What was worked on** | Tasks, agents dispatched, files touched — specific, dated |
| **Decisions made** | What was decided and by whom, including approvals granted and proposals declined |
| **Outstanding items** | Drafts awaiting approval, escalations in flight, blocked generations with their populate-plans |
| **Context the next session needs** | The judgment calls, half-formed threads, and warnings that live nowhere else — the section that separates a handover from a changelog |
| **Proposed updates awaiting approval** | The §8.5 queue snapshot, so pending truth is never invisible |

HANDOVER.md is overwritten each session, not appended — it is a baton, not a log; the audit trail and git history keep the past. The test of a good handover: the next session (or a different person) continues without re-briefing. Continuity across stateless sessions is precisely what the file buys, and it costs five minutes.

## Weekly — Review of Proposed Context Updates

Once a week, the PMM works the proposal queue ([ch. 05](05-approval-gates.md)) to empty or to explicit deferral:

1. Review each proposed diff with its blast radius (which assets go stale if applied)
2. Apply, decline-with-reason, or defer-with-date — no silent skips
3. Note patterns: clusters of proposals against one file signal a section due for a full refresh ([ch. 02](02-foundation-doc-workflow.md)); repeatedly declined proposals signal an agent contract to tune ([Vol 4](../vol-4-agent-organization/README.md))

The weekly rhythm matters because proposals are perishable: a buyer-language update from a Monday call is canon-worthy that week and archaeology a month later. An aging proposal queue is the system's freshness silently decaying with the lights on — the ritual keeps decay visible and priced.

---

## The Rituals as a System

| Ritual | Frequency | What it protects |
|--------|-----------|------------------|
| SessionStart injection | Every session | Anti-generic output; correct current context |
| Messaging guard | Every messaging edit | Voice and consistency at the moment of writing |
| HANDOVER.md | Every session close | Continuity; no re-briefing tax |
| Proposal review | Weekly | Living canon; a proposal queue that means something |

Together they close the loop the whole operating model draws: context flows in at start, discipline holds during, learning flows out at close, and the canon absorbs the learning weekly — so the next session starts smarter than this one did.

---

*Back to [Volume 5 index](README.md). This completes volumes 1–5; volumes 6–10 are indexed in the [playbook README](../README.md).*

Last updated: 2026-08-06
