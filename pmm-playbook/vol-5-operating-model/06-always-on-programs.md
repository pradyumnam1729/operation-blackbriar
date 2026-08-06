# 06 — Always-On Programs

*Operationalizes the Master Instructions §11 cadence table.*

---

## Why Scheduled, Not On-Demand

The war room's freshness cannot depend on someone remembering to ask. Always-on programs are the ~15% bucket (§3.5) running on schedule: intelligence sweeps and audits that fire whether or not anyone requested them, so that when the on-demand workflows run, their inputs are already current. This is the supply chain behind the freshness checks in [chapter 04](04-asset-generation-workflow.md) — every "pass" at generation time was earned by a scheduled run days earlier.

---

## The Program Table, Operationalized

| Program | Agent | Cadence | Dispatch | Outputs land in | Then |
|---------|-------|---------|----------|-----------------|------|
| Voice-of-Market | A1 | Weekly | Scheduled batch, Mondays | `MARKET-INTELLIGENCE/voice-of-market/` (dated synthesis) | Proposals to `our-customer.md` + objection library → queue |
| Competitive Intelligence | A3 | Weekly + event-triggered | Scheduled sweep, Mondays; events any day (competitor launch, pricing change, analyst report, sales escalation) | `MARKET-INTELLIGENCE/competitive/` (dossier deltas + `weekly-brief-YYYY-MM-DD.md`) | Battlecard update recommendations → B8; positioning flags → PMM |
| Win/Loss Analysis | A4 | Monthly | First week of month, on the prior month's closed deals | `MARKET-INTELLIGENCE/win-loss/` (monthly synthesis) | Implications routed to B8, C11, C13; language proposals → queue |
| Content Governance audit | C12 | Monthly (+ hook-triggered continuously) | Mid-month full audit; `messaging-guard` hook fires on every messaging edit | Governance dashboard findings | Stale/unsupported assets → regeneration or retirement proposals → queue |
| GTM Performance review | C13 | Monthly | Month-end, after C11/C12 runs | Dashboard + Leadership brief | Feeds C14 and quarterly planning |
| ICP/Persona validation | A2 | Quarterly | First month of quarter | `MARKET-INTELLIGENCE/icp-personas/` | Proposals to `personas.md`, `positioning-and-icp.md` → queue |
| HANDOVER.md | session ritual | Every session end | Session close ([ch. 07](07-session-rituals.md)) | `GTM-War-Room/HANDOVER.md` | Read by the next session's start |

Ordering within the month is deliberate: intelligence runs (A1, A3 weekly; A4 early-month) precede the governance audit (mid-month), which precedes the performance review (month-end) — each layer audits and aggregates the one before it.

---

## How a Scheduled Run Works

Each run is a normal task with a standing brief — Context + End State + Constraints pre-written per agent contract ([Vol 4](../vol-4-agent-organization/README.md)) — so scheduled work gets the same intake rigor as requested work:

1. **Dispatch** at the scheduled time (today: the PMM or a session starts the run via the agent or skill; in the app: the orchestration layer's scheduler).
2. **Delta discipline:** weekly runs process what changed since the last run, updating existing files — never duplicating them ([Vol 2, ch. 07](../vol-2-domain-knowledge/07-war-room-model.md)). A weekly brief with no deltas says "no material changes," which is itself information.
3. **Outputs land as drafts** in the destinations above, with dated filenames where the table shows them; canon changes go through the proposal mechanism ([ch. 05](05-approval-gates.md)) like everything else. Scheduled ≠ pre-approved.
4. **Routing fires:** each program's "then" column — the downstream notifications and flags — is part of the run's definition of done, not a courtesy.

Event triggers (A3's mid-week competitor event, C12's hook) run the same machinery off-schedule; the schedule is the floor, not the ceiling.

---

## Program Health

- **Quarterly review, per §11:** "Streamline and build repeating rituals. Review programs quarterly and pause as needed." Each program justifies itself with usage evidence: did its outputs feed decisions, assets, or approved proposals this quarter? A program feeding nothing is paused deliberately — visible on the dashboard as paused, not silently skipped.
- **Promotion in:** C14 flags recurring ad hoc requests as program candidates (§3.5); the third hand-built request for the same thing is a schedule entry waiting to be written.
- **Missed runs are visible.** The dashboard shows last-run dates per program; a program overdue is a freshness risk announcing itself before it becomes a blocked generation in [chapter 04](04-asset-generation-workflow.md).

---

*Next: [07 — Session Rituals](07-session-rituals.md)*

Last updated: 2026-08-06
