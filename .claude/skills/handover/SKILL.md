---
name: handover
description: Write GTM-War-Room/HANDOVER.md at session end — what was worked on, decisions made, outstanding items, and the context the next session needs, plus proposed war-room updates awaiting approval. Use when the user says they're done, wrapping up, ending the session, asks for a handover or session summary, or when substantial PMM work is complete and no further tasks are queued.
---

# Handover — Session Close

Every session ends with HANDOVER.md (§5.3, CLAUDE.md rule 7). Its job is continuity: the
next session (human or agent) picks up without re-briefing. Its second job is governance:
it is the holding area for proposed context updates the PMM has not yet approved (§8.5) —
proposals must survive session boundaries, or they get silently lost.

## Required reading

1. The current `GTM-War-Room/HANDOVER.md`, if it exists — carry forward anything still open. Outstanding items and pending proposals from the previous handover that were not resolved this session must reappear in the new one; dropping them silently defeats the file's purpose.
2. This session's own history — tasks run, files written, questions asked, decisions the PMM made.

## Step 0 — Confirm before writing (AskUserQuestion, only if genuinely unclear)

1. **Anything decided off the record?** Decisions made in discussion but not written into any file are exactly what handovers exist to capture.
2. **Priority for next session?** If several items are outstanding, which comes first?
3. **Any proposal already approved verbally?** If the PMM already approved a context update this session, apply it now and record it as a decision instead of re-proposing it.

Skip the questions when the session record answers them — do not make ending a session tedious.

## Step 1 — Gather

- Files created or modified this session (with paths and their `stage`).
- Skills and agents run, and their outcomes.
- Decisions made by the PMM (approvals, rejections, tier choices, positioning calls) — with a one-line rationale each, so the next session doesn't relitigate them.
- Items started but unfinished, and exactly where they stopped.
- Proposed war-room updates raised this session (§8.5) that await approval — collect them verbatim from task endings.
- Gaps discovered (missing dossiers, stale intel, absent brand files) and which agent or skill fills each.

## Step 2 — Write the file

**Destination:** `GTM-War-Room/HANDOVER.md`. **Overwrite the previous file entirely** —
git keeps history; the handover is always the single current state, not an append-log.
(Create `GTM-War-Room/` if this is the first session.)

```markdown
---
date: 2026-08-06
session-focus: <one line>
mode: operating | building | mixed
---
# HANDOVER — 2026-08-06

## What was worked on
- <task> → <output file(s), stage> (skill/agent used)

## Decisions made
- <decision> — decided by PMM — rationale: <one line>

## Outstanding items (priority order)
1. <item> — state: <where it stopped> — next step: <concrete action> — owner: <skill/agent/PMM>

## Proposed war-room updates — AWAITING APPROVAL
- [ ] <target file>: <exact proposed change> (source: <this session's task>)
- [ ] Carried from 2026-08-01 handover: <still-pending proposal>

## Context the next session needs
- <the things that are true now but not written anywhere else: current focus,
  active launch and its target date, freshness state of key intel, who asked for what>

## Known gaps
- <missing/stale war-room content> → fill with <agent/skill>
```

## Writing rules

- Absolute dates only (YYYY-MM-DD). "Yesterday" is meaningless to the next session.
- Every outstanding item names a concrete next step and an owner. "Continue messaging work" is not a handover; "Draft Primus facility-owner value props — messaging-framework skill, blocked on positioning approval" is.
- Proposals are copied exactly as raised, as unchecked checkboxes. Never mark one applied unless it actually was.
- Keep it under roughly one page. A handover nobody reads is a handover that failed. Link to files instead of restating their content.
- The handover describes work; it is not customer-facing copy. Still keep Aurigo terminology correct out of habit ("life cycle", "AI-native") — sloppy internal language leaks into assets.

## Quality gate

1. Re-read the draft as if you were the next session with zero memory: can you resume every outstanding item without asking the PMM to repeat anything? If not, add the missing context.
2. Verify nothing from the previous handover was dropped without being either completed (listed under work done) or carried forward.
3. Verify every file path mentioned actually exists as written.
4. Verify the recurring-request signal: if the same ad-hoc request showed up across multiple handovers, flag it explicitly as a candidate for promotion to an Always-On program (§3.5) so the prioritization work sees it.
5. Confirm to the user: handover written, N outstanding items, M proposals awaiting approval — and name the top-priority next step.

## What this skill never does

It never applies the proposed war-room updates itself (the system proposes; the human
decides, §8.4–8.5), and it never summarizes so aggressively that decisions lose their
rationale. When in doubt, keep the extra line.
