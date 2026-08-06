# Runbook: On-call handoff

> Version: `v0.1 — 2026-07-23` • Owner: Engineering Manager • Reviewed: `2026-07-23`

Weekly rotation cadence, role definitions, response-time expectations, and the handoff
meeting agenda. Read this on your first rotation and every time you're about to hand off.

---

## Symptom

Not a fire-fighting runbook. Read when:

- You are joining the on-call rotation for the first time.
- You are the outgoing primary preparing for Monday handoff.
- You are the incoming primary preparing to receive handoff.
- You need to look up the SLA/TTR for a severity band you are about to declare.

---

## Severity + expected TTR

Not incident-scoped. This runbook establishes the response-time contract.

---

## Preconditions

- You are named on the rotation (see PagerDuty schedule `Aurigo-Maintain-Primary` /
  `-Secondary`).
- You have completed on-call onboarding: read every runbook in this folder, shadowed one
  full rotation as secondary, been added to the `#eng-oncall` and `#runbook-feedback`
  Slack channels.

---

## Rotation cadence

- **Length:** 1 week (Monday 09:00 local → next Monday 09:00 local, timezone = primary's
  home tz).
- **Handoff meeting:** Monday 09:00 – 09:30 local, weekly, standing invite. Cancelling
  the meeting is not permitted — no meeting means no handoff means no rotation change.
- **Roles per week:**
  - **Primary:** carries the pager 24/7 for the week. Acks first, drives resolution.
  - **Secondary:** backup pager. Ackable if primary silent 15 min. Takes over if primary
    starts a task requiring focus (e.g. Incident Commander on a Critical).
  - **Incident Commander (IC):** rotates monthly across senior engineers. Owns the
    process during any declared Sev-1/2 incident. Not paged for individual alerts.
- **Fair-share rule:** no engineer carries primary more than 1 week in any 4-week
  period. Track via the PagerDuty schedule audit log.

---

## Response times per severity

Mirrors `README.md § Severity + TTR reference`. Reproduced here as the on-call contract.

| Severity | Definition | Ack | TTR |
|---|---|---|---|
| Critical | Full outage, data loss risk, security breach, or > 25% of tenants affected. | 15 min | 1 hr |
| High | Major feature broken for one tenant, or degradation across many. TAMP publish blocked. | 30 min | 4 hr |
| Medium | Non-critical feature broken; workaround exists. Slow queries, minor UI regressions. | 4 hr (business hours) | Next business day |
| Low | Cosmetic, documentation, single-user report. | 3 business days | 3 business days |

**Ack** = you acknowledge the page in PagerDuty AND post in `#eng-oncall`
(`"acking <alert> — investigating"`).

**TTR** = customer-visible symptom is resolved OR downgraded to a lower severity with an
approved workaround. Not "root cause identified" — that comes in the post-mortem.

### Ack expectations by hour

- Business hours (09:00 – 18:00 local): meet the ack targets above.
- Evenings / overnight (18:00 – 09:00): Critical still 15 min; High becomes 60 min (page
  primary + secondary in parallel via PagerDuty escalation policy).
- Weekends: Critical still 15 min; High becomes 90 min.
- Medium and Low never page overnight — they wait for business hours.

Missed ack targets trigger PagerDuty escalation: primary silent 15 min → secondary paged
→ secondary silent 15 min → IC paged → IC silent 10 min → EM paged.

---

## The handoff meeting

**Length:** 30 minutes. **Attendees required:** outgoing primary, incoming primary,
outgoing secondary (optional), incoming secondary, IC (any month, for continuity),
Engineering Manager (monthly, or ad-hoc if the previous week burned budget).

### Agenda (fixed order — do not skip)

1. **Open incidents (5 min).**
   - Every incident still in `investigating` or `mitigating` state.
   - Ownership: does it stay with outgoing primary, or transfer?
   - Any customer commitments made (e.g. "we'll update you by end of day Tuesday").

2. **Weekly SLO burn (5 min).**
   - Pull the Grafana `SLO burn — 7d` view.
   - Report each SLO's actual vs budgeted burn for the week.
   - Flag any SLO within 25% of monthly budget as at-risk. Discuss reliability follow-ups.
   - If any monthly budget is exhausted, deploy freeze is in effect — the incoming
     primary must know.

3. **Planned deploys for the week (5 min).**
   - What's in the release pipeline: features, migrations, integration changes.
   - Any change flagged as "Read `db-migration.md` first"?
   - Any deploy with unusual customer-facing impact (e.g. schema change to `Assets`
     table)? Line up extra eyes.

4. **Expected customer touchpoints (5 min).**
   - Scheduled maintenance windows for the week.
   - Customer demos / partner integration tests that could look like real traffic.
   - Any customer running a tenant migration or bulk import (higher DB load window).

5. **Runbook feedback triage (5 min).**
   - Skim `#runbook-feedback` posts from the previous week.
   - Assign owner + due-date for any runbook edit.
   - If a runbook was cited as wrong or missing during an incident, bump its "Reviewed"
     date only after the edit lands.

6. **Explicit pager handoff (5 min).**
   - Outgoing primary sets themselves to `off duty` in PagerDuty.
   - Incoming primary sets themselves to `on duty` in PagerDuty.
   - Both post in `#eng-oncall`:
     `"Pager handoff complete. Primary: @<incoming>. Secondary: @<incoming-sec>."`
   - No handoff is complete without this Slack confirmation. If the incoming primary
     is a no-show, outgoing continues to hold pager until Monday 12:00; escalate to EM
     for coverage.

---

## What the outgoing primary MUST do before handoff

- [ ] Every alert paged during the week is documented in the incident channel
      (`#incident-YYYYMMDD-<summary>`) — even if resolved fast, the timeline exists.
- [ ] Any temporary WAF exception, feature flag flip, or maintenance-mode toggle applied
      during the week is either (a) reverted or (b) documented with an expiry date in
      `#eng-oncall`.
- [ ] Any manual DB fix (e.g. `psql` edits done during an incident) is written up in the
      post-mortem draft.
- [ ] Every open follow-up ticket has an assignee (not "unassigned — someone will grab
      it").

---

## What the incoming primary MUST do at handoff

- [ ] Verify pager routes correctly: `pd oncall` CLI or PagerDuty web shows you as
      primary.
- [ ] Read the last 7 days of `#eng-oncall` and any open `#incident-*` channels.
- [ ] Skim the top of every runbook in this folder for version bumps since your last
      rotation.
- [ ] Confirm your on-call laptop is charged, tethered, and can reach the AWS console +
      GitHub + Grafana + PagerDuty.

---

## Post-incident actions

Not applicable — this is a process runbook. But note: any incident during a rotation
becomes an item in the NEXT handoff meeting (agenda item 1).

---

## Related runbooks

- [`incident-response.md`](./incident-response.md) — what to do when the pager fires.
- [`README.md`](./README.md) — escalation ladder, SLO table.

## Related dashboards

- Grafana `SLO burn — 7d` (weekly review).
- PagerDuty `Aurigo Maintain — schedule audit` (fair-share verification).

## Related alerts

- Not applicable — no alert triggers this runbook.

---

## Runbook feedback

Did this runbook help? Was a step wrong? Post in Slack `#runbook-feedback` with:

```
Runbook: oncall-handoff.md
Version: v0.1 — 2026-07-23
Handoff date: YYYY-MM-DD
What worked:
What was wrong or missing:
Suggested edit (optional):
```
