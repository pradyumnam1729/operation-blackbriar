# Runbook: Incident response (first 15 minutes)

> Version: `v0.1 — 2026-07-23` • Owner: Incident Commander rotation • Reviewed: `2026-07-23`

You have been paged. Read this first, always. This is the checklist for the first 15
minutes — enough structure that a tired responder does the right things without thinking
too hard.

---

## Symptom

Any of these:

- PagerDuty alert on your phone.
- Customer report escalated via Slack from support (`#cust-escalations`).
- A teammate says "prod looks weird" and shares a screenshot.
- You noticed something wrong via a dashboard while doing something unrelated.

If none of these are true, close this runbook — you don't have an incident yet.

---

## Severity + expected TTR

Determined at step 4 below. Cite the SLO from `README.md § Expected SLOs` when you
declare severity — the responder needs to know what "acceptable" looks like.

---

## Preconditions

- You are the on-call primary, secondary, or IC.
- You have a laptop and network. If you don't, escalate to secondary IMMEDIATELY and
  ack the page anyway so PagerDuty doesn't escalate the ladder further.

---

## The first-15-minutes checklist

Numbered. Do these in order. Do not skip. Do not deep-dive into diagnosis until step 6.

### 1. Ack the page (target: within 2 min of page)

- PagerDuty: hit `Acknowledge` on your phone.
- This stops the escalation ladder from firing while you get to a laptop.

### 2. Open the incident channel (target: within 5 min)

- Create Slack channel `#incident-YYYYMMDD-<short-summary>`.
  - `YYYYMMDD` = today's date UTC.
  - `<short-summary>` = 2–4 words, kebab-case, describing the visible symptom. Examples:
    `#incident-20260723-tamp-500`, `#incident-20260723-login-503`,
    `#incident-20260723-cityworks-sync-lag`. NOT `#incident-20260723-investigation`.
- Invite: `@eng-oncall` group, `@incident-commanders` group. Support team can self-join
  if they follow up.
- Pin the first message: link to the PagerDuty alert.

### 3. Assign roles (target: within 5 min)

Explicit, written-down role assignment. Post in the incident channel:

```
Roles for this incident:
- Incident Commander (IC): @<name>  — drives the response, makes decisions
- Comms Lead: @<name>               — updates customers + internal stakeholders
- Scribe: @<name>                   — logs everything into this channel with timestamps
```

Rules:

- IC MUST NOT be the responder actively typing commands into prod. If you are the only
  person online, ack the page as IC AND explicitly say "acting as IC only, awaiting hands
  on keyboard from secondary."
- Comms Lead can be the same person as IC for Sev-3/4. For Sev-1/2 they MUST be different
  people.
- Scribe timestamps every observation and action, format:
  `[HH:MM UTC] <action or observation> — @<who>`.

### 4. Declare severity (target: within 10 min)

Look at `README.md § Severity + TTR reference` and pick a band. Post in the channel:

```
Severity: <Critical | High | Medium | Low>
Protecting SLO: <name of SLO from README>
Expected ack: <met | missed>
Target TTR: <from table>
Basis for severity: <one sentence — e.g. "3 of 8 tenants report login 503; matches
   Critical because > 25% tenant impact.">
```

When in doubt, declare HIGHER. Downgrading later is cheap; upgrading later loses trust.

### 5. Publish the first status update (target: within 30 min)

Comms Lead posts to:

- Internal: `#eng-status` (auto-crossposts to `#exec-updates` for Sev-1/2).
- External: customer status page + email to affected tenants' primary contacts (Support
  runs the customer email; Comms Lead confirms it went out).

Template:

```
Aurigo Maintain — Incident in progress
Severity: <band>
Started: HH:MM UTC
Symptom: <one sentence customer-visible description — NOT the root cause>
Impact: <who / how many tenants / which features affected>
Current action: Investigating.
Next update: HH:MM UTC (30 min from now).
```

Do NOT speculate about root cause in the first update. "Investigating" is honest.
Speculation quoted back at a post-mortem is expensive.

### 6. Diagnose

Now start the actual work. Pick the runbook that matches the symptom:

- Deploy just happened, symptom looks like a regression → `deploy.md § Common failures`
  or jump straight to `rollback.md § Decision flow`.
- DB slow / connections saturated → check `db-migration.md § How to handle a hung
  migration` (a stuck migration is a common DB-slow trigger).
- Integration sync failing → check the specific integration's runbook (Cityworks,
  Maximo, Aurigo Plan — separate runbooks to be added; until then log the sync error
  and page the integrations team).
- Login broken → check whether the JWT signing key rotation or the Aurigo
  `lambda-authorizer` upstream is the cause. Login SLO is 99.9%, so this jumps to
  Critical fast.
- TAMP publish broken → known problem area (report generation is synchronous and can
  timeout on Texas-scale tenants — see `execution-plan.md § Phase 7`). Check the async
  job queue depth first.

If no runbook covers the symptom, that's a runbook gap — file a `#runbook-feedback` post
after the fire is out.

### 7. Continue updates every 30 minutes

Even if no change. "No new information; still investigating; next update HH:MM UTC" is
a valid update. Silence is worse than no news. Comms Lead owns the timer.

### 8. Resolve

When customer-visible symptom is gone and monitoring confirms:

- Comms Lead publishes resolution note:
  ```
  Aurigo Maintain — Incident resolved
  Severity: <band>
  Started: HH:MM UTC   Resolved: HH:MM UTC   Duration: <hh:mm>
  Symptom: <one sentence>
  Resolution: <one sentence — what fixed it, without speculating on contributing factors>
  Post-mortem: scheduled for YYYY-MM-DD, will be shared in <channel>.
  ```
- IC schedules the post-mortem meeting: within 5 business days. Attendees: everyone who
  touched the incident + Engineering Manager + Comms Lead + one senior engineer NOT
  involved in the incident (fresh eyes).

---

## Post-mortem

Blameless. Public within the engineering org. Format below.

### Template

```markdown
# Post-mortem — <symptom summary> — YYYY-MM-DD

## Summary
2–3 sentences. What broke, for whom, for how long.

## Timeline
[HH:MM UTC] event  (all events with timestamps, cut-and-pasted from the incident channel;
                    Scribe's log is the source of truth)

## Impact
- Tenants affected: <count + names if named accounts>
- Duration of customer-visible impact: hh:mm
- SLO burn: <X% of monthly budget for <SLO name>>
- Any customer commitments made during the incident

## Contributing factors (PLURAL — not "root cause")
1. <factor>
2. <factor>
3. <factor>

Systems fail because multiple things line up. Force yourself to list at least three.
"Root cause" language pushes toward blame and stops at the first plausible answer.

## What went well
- <thing>

## What went badly
- <thing>

## Action items
| # | Action | Owner | Due | Ticket |
|---|--------|-------|-----|--------|
| 1 | ... | @who | YYYY-MM-DD | link |

Every action item MUST have a named owner (not "the team") and a due date. Follow up in
the next weekly on-call handoff (see `oncall-handoff.md`).

## Related
- Incident channel: `#incident-YYYYMMDD-<summary>`
- Runbook(s) used: <list>
- Any runbook edits that landed as a result
```

**Blameless rule:** the post-mortem does NOT name individuals as "cause." Individuals
appear only as `@handle` next to actions they took or will take. If someone typed the
command that broke prod, the contributing factor is "the tool allowed a destructive
action without a confirmation gate," not "@name ran the wrong command."

---

## Security-flavored incidents

Any incident where the symptom or investigation touches:

- Credential compromise (leaked API key, JWT signing key rotated unexpectedly).
- Data exfiltration suspected (unusual read volume from an ID that isn't a known bulk
  export job).
- WAF blocking real attack traffic (not a false-positive — see `deploy.md § WAF
  false-positive block`).
- Cross-tenant data leak reported (a user seeing another tenant's data). Tenant
  isolation lives in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.
  Infrastructure/Persistence/AssetMaintenanceDbContext.cs:24` (`CurrentTenantId`
  instance property) and the global query filter at line 135
  (`HasQueryFilter(e => e.TenantId == CurrentTenantId)`). Any leak means either the
  filter was bypassed via `IgnoreQueryFilters()` on a code path the tests didn't cover,
  or `CurrentTenantId` was set to the wrong value on entry.

For these:

- Skip the L1→L2→L3 ladder. Page L4 (Engineering Manager) + Security Lead in parallel
  immediately.
- Do NOT post publicly-visible details (customer names, data samples) in the incident
  channel — keep the channel to `@eng-oncall`-restricted membership until Security Lead
  approves broader visibility.
- Preserve evidence: do NOT delete logs, do NOT rotate keys, do NOT restart services
  until Security Lead confirms evidence is captured.
- The post-mortem is legal-privileged for security incidents — schedule with Legal in
  attendance.

---

## Post-incident actions

- [ ] Resolution note published (step 8 above).
- [ ] Post-mortem meeting scheduled within 5 business days.
- [ ] Runbook edits filed for any gap surfaced during the incident.
- [ ] Follow-up tickets created for each action item, with owner + due date.
- [ ] Handoff meeting agenda updated for next Monday (see `oncall-handoff.md`).

---

## Related runbooks

- All of them. This is the entry point.
- Especially: [`rollback.md`](./rollback.md), [`deploy.md`](./deploy.md),
  [`db-migration.md`](./db-migration.md).

## Related dashboards

- Grafana `Prod overview` (5xx, p95, SLO burn, DB pool).
- CloudWatch `Prod alarms — active`.
- PagerDuty `Incident timeline`.

## Related alerts

- Any alert can trigger this runbook. Every alert should link back to it in its
  description.

---

## Runbook feedback

Did this runbook help? Was a step wrong? Post in Slack `#runbook-feedback` with:

```
Runbook: incident-response.md
Version: v0.1 — 2026-07-23
Incident: #incident-YYYYMMDD-<summary>
What worked:
What was wrong or missing:
Severity of the incident:
Suggested edit (optional):
```
