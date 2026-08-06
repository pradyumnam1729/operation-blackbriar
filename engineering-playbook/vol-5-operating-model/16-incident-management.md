# 16 — Incident Management

An incident is any unplanned interruption or degradation of the Aurigo Maintain service that affects customers, or any security event that could result in unauthorized access to customer data. This document defines how incidents are detected, triaged, resolved, communicated, and learned from.

The goal is not to eliminate incidents — every complex system has incidents. The goal is to detect them quickly, resolve them predictably, and never see the same incident twice.

---

## Severity Levels

Incidents are classified into four severity levels within the first 15 minutes of detection. The severity determines the response time SLA, the paging behavior, the required participants, and the customer communication cadence.

### P0 — Total Outage

**Definition**: The Aurigo Maintain service is completely unavailable to all tenants, or a security incident has resulted in confirmed unauthorized data access, or customer data has been lost.

**Examples**:
- Production API returns 5xx for all tenants for > 2 minutes
- Production database is unreachable
- All frontend loads fail with a blank page
- A tenant reports data from another tenant appearing in their view
- Backup and replication have both failed and data is at risk

**Response time SLA**: Ack within 5 minutes. Mitigation started within 15 minutes. Full resolution target: within 2 hours.

**Paging**: PagerDuty pages the DevOps on-call primary + secondary + ED simultaneously.

**Communication cadence**: Customer status page updated within 15 minutes. Customer notifications every 30 minutes until resolved.

### P1 — Critical Degradation

**Definition**: A core Maintain capability is broken for one or more tenants, or the service is partially degraded across many tenants. A customer's operations are meaningfully blocked.

**Examples**:
- Asset list endpoint returns 5xx for one specific tenant for > 5 minutes
- Capital plan optimization consistently times out or fails
- Inspection form cannot be submitted (data loss risk for field inspectors)
- Real-time EAM sync is failing and diverging by > 4 hours
- Elevated error rate (> 2%) across the entire service for > 10 minutes
- A P2 issue that has been unresolved for > 24 hours

**Response time SLA**: Ack within 15 minutes. Mitigation started within 1 hour. Full resolution target: within 4 hours.

**Paging**: PagerDuty pages DevOps on-call primary. If not acknowledged in 10 minutes, pages secondary + ED.

**Communication cadence**: Customer status page updated within 30 minutes. Affected tenants notified via email within 1 hour. Updates every 2 hours until resolved.

### P2 — Significant Impact

**Definition**: A specific feature or workflow is degraded for some users, but a workaround exists. Business continuity is not blocked.

**Examples**:
- Report generation is slower than SLA but still completing
- One EAM adapter is returning stale data (delta sync failing but nightly reconciliation catching)
- Dashboard chart intermittently fails to load
- A specific report format (e.g., PDF export) is broken but CSV export works
- Non-critical accessibility issue (a WCAG AA violation on a rarely-used page)

**Response time SLA**: Ack within 1 business hour. Mitigation started within 4 business hours. Full resolution target: within 2 business days.

**Paging**: Slack alert only during business hours. Email during off-hours (do not page overnight for P2).

**Communication cadence**: Affected tenants notified within 4 business hours if customer-facing. Weekly summary in the customer newsletter.

### P3 — Minor Issue

**Definition**: A minor bug or issue that is noticeable but does not meaningfully impact operations. Cosmetic issues, minor performance regressions within tolerance, low-frequency edge case failures.

**Examples**:
- Loading spinner appears longer than expected on one page
- A tooltip is truncated on mobile
- A specific low-usage feature has a minor UX flaw
- Log messages formatted inconsistently
- One-time transient sync error that self-recovered

**Response time SLA**: Filed as a bug in the backlog. Prioritized in normal backlog process. No immediate response required.

**Paging**: None. Enters the standard bug triage flow.

**Communication cadence**: Included in release notes if fixed.

---

## Detection Sources

Incidents are detected from multiple sources. Each source has different triage implications.

| Source | Detection Latency | Confidence | Triage Note |
|---|---|---|---|
| CloudWatch Alarm | < 2 minutes | High (metric-based) | Automatic paging. Investigate the alarming metric first. |
| Synthetic Monitoring (Datadog/Pingdom) | < 2 minutes | High (user-perspective) | Confirms real customer impact. Check monitoring dashboard. |
| Application Logs (ERROR level spike) | 2–10 minutes | Medium | Confirm real user impact before declaring incident. |
| Customer Support Ticket | 5 minutes – hours | High but delayed | Ask reporter for tenant ID, timestamp, browser, and screenshot. |
| Customer Status Report (via CSM) | Hours | High | Often reveals systemic issues that other detection missed. |
| Engineer Discovery (during work) | Variable | High | Engineer files immediately, does not wait for customer report. |
| Slack Channel Alert (from other services) | < 5 minutes | Medium | Verify against production before escalating. |
| Security Alert (WAF, GuardDuty) | < 5 minutes | High | Always treat as P1 minimum until confirmed benign. |

**Golden rule**: If two independent sources detect the same issue, it is definitely real. If one source detects it, verify with a second source (dashboard, direct test, logs) before declaring incident.

---

## Triage Process — First 15 Minutes

The first 15 minutes of an incident determine the total impact. Follow this checklist exactly.

### Minute 0–2: Acknowledge and Verify

1. On-call engineer acknowledges the page in PagerDuty (stops the escalation clock)
2. Open the CloudWatch dashboard for the affected service
3. Verify the issue is real by hitting the affected endpoint or feature from a test tenant
4. If false positive: silence the alert, note the false positive in the alert tuning backlog, done
5. If real: proceed to minute 3

### Minute 3–5: Assess Scope

1. Determine: is this affecting one tenant, some tenants, or all tenants?
2. Determine: is this a hard failure (5xx) or a degradation (slow, wrong data, partial function)?
3. Check the recent deployment history: was anything deployed in the last 60 minutes?
4. Check the recent infrastructure change history: was there any Terraform apply or manual change?
5. Assign initial severity (P0, P1, P2, P3) based on scope + severity of impact

### Minute 6–10: Open Incident and Assemble Team

1. Open the incident record in the incident tracking tool (`#incidents` Slack channel + PagerDuty incident)
2. Post the initial incident message: severity, symptom, current scope, initial hypothesis, incident commander
3. For P0/P1: page the ED (if not already paged) and the Tech Architect
4. Assign roles: Incident Commander (usually ED for P0, DevOps for P1), Communicator (usually PM for customer-facing), Technical Lead (usually Backend Lead or Frontend Lead depending on where the issue is)

### Minute 11–15: Initial Response

1. Incident Commander confirms the team is assembled and communicating in the incident channel
2. Communicator drafts the initial customer status message (see templates below)
3. Technical Lead begins root cause investigation using the runbook for the alerting service (if one exists)
4. If a recent deployment is the suspected cause: initiate rollback (do not wait for confirmation — rollback is safer than continued degradation for P0/P1)

### Golden Rules for Triage

- **Rollback before repair**: For P0/P1 caused by a recent deployment, roll back first, then diagnose. A rolled-back service is better than a debugging session on production.
- **One person at a time on the incident channel**: Multiple engineers typing simultaneously produces noise, not signal. The Incident Commander orchestrates who speaks when.
- **Time-box hypotheses**: If a hypothesis is not confirmed within 15 minutes of pursuing it, move to the next hypothesis. Do not fixate.
- **Preserve evidence**: Take screenshots of dashboards, save log queries, snapshot the current state before any remediation. Postmortem will need this.

---

## Escalation Matrix

| Situation | Page 1st | Escalate at | Page 2nd | Escalate at | Involve |
|---|---|---|---|---|---|
| P0 detected | DevOps primary + secondary + ED | Immediate | — | — | Tech Architect, PM, VP Engineering |
| P1 detected | DevOps primary | +10 min if no ack | DevOps secondary + ED | +20 min | Tech Architect, PM |
| P2 detected (business hours) | DevOps primary via Slack | +2 hours if not acked | ED | +4 hours | PM |
| Security incident (any severity) | CISO + DevOps + ED | Immediate | — | — | Legal, VP Engineering |
| Customer-reported incident that engineering has not detected | PM notifies DevOps | +15 min | DevOps + ED | +30 min | Tech Architect |
| Incident open > 4 hours (any severity) | Auto-escalate to ED | Immediate | VP Engineering | +2 hours | CTO if P0 |
| Incident open > 12 hours | CTO | Immediate | CEO | +2 hours if data exposure | Legal, Comms |

**PagerDuty configuration**:
- Primary on-call: 1 week rotation, DevOps + Backend Lead pool
- Secondary on-call: 1 week rotation, offset by 3 days from primary
- ED and Tech Architect are always in the escalation policy, no rotation
- CISO is a separate rotation of security-cleared engineers
- Rotations shift on Wednesdays at 10am local (never on Mondays to avoid weekend handoff confusion)

---

## Communication Templates

### Internal Incident Channel Opening (Slack)

```
INCIDENT DECLARED — {SEVERITY}
Time detected: {TIME}
Symptom: {ONE SENTENCE}
Current scope: {TENANTS AFFECTED / FEATURES AFFECTED}
Incident Commander: @{NAME}
Communicator: @{NAME}
Technical Lead: @{NAME}
Initial hypothesis: {SUSPECTED CAUSE OR "UNKNOWN — INVESTIGATING"}
Status page: {URL}
Runbook: {URL if exists, or "NONE — writing"}

All incident communication in this thread. No side-channel decisions.
```

### Customer Notification — Initial (Email or Status Page)

```
Subject: Aurigo Maintain — Service Issue Alert

We are currently investigating a {SYMPTOM DESCRIPTION IN CUSTOMER LANGUAGE} affecting {SCOPE — "your tenant" | "some customers" | "all customers"}.

What is affected: {FEATURES OR CAPABILITIES}
What is not affected: {WHAT STILL WORKS}
Estimated impact: {WORKAROUND IF ANY}

Our engineering team is actively investigating. We will provide an update within {30 min for P0 | 2 hours for P1 | 4 business hours for P2}.

For questions, contact support@aurigo.com or your Customer Success Manager.

Status page: https://status.aurigo.com
Incident ID: {INC-YYYYMMDD-NNN}
```

### Customer Notification — Update

```
Subject: [Update] Aurigo Maintain Incident {INC-ID}

Status: {STILL INVESTIGATING | MITIGATED | RESOLVED}
Time since last update: {N} minutes

What we have learned: {ROOT CAUSE OR CURRENT HYPOTHESIS}
What we have done: {ACTIONS TAKEN}
What is next: {NEXT STEPS AND ETA}

Next update: {TIME}
```

### Customer Notification — Resolved

```
Subject: [Resolved] Aurigo Maintain Incident {INC-ID}

The incident has been resolved as of {TIME UTC}.

Summary:
- What happened: {NON-TECHNICAL SUMMARY}
- Impact: {WHO WAS AFFECTED, FOR HOW LONG}
- Root cause: {ONE PARAGRAPH IN PLAIN LANGUAGE}
- What we did to fix it: {ACTION TAKEN}
- What we are doing to prevent recurrence: {PREVENTIVE ACTIONS PLANNED}

We are conducting a full postmortem and will share the results with affected customers within 5 business days.

If you experienced data loss or need reconciliation assistance, contact support@aurigo.com and reference incident ID {INC-ID}.

We apologize for the disruption and thank you for your patience.
```

### Internal Status Update (Every 30 min for P0, 2 hours for P1)

```
INCIDENT UPDATE — {INC-ID} — {TIME}

STATUS: {INVESTIGATING | MITIGATING | MONITORING | RESOLVED}
DURATION: {N} minutes since detection
SCOPE (change since last update): {ANY CHANGE}
ACTIONS SINCE LAST UPDATE:
  - {ACTION 1}
  - {ACTION 2}
CURRENT HYPOTHESIS: {WHERE WE THINK THE PROBLEM IS}
NEXT STEPS:
  1. {ACTION}
  2. {ACTION}
BLOCKED ON: {NOTHING | WAITING FOR X | NEED Y APPROVAL}
ETA TO RESOLUTION: {ESTIMATE OR "UNKNOWN — WILL RE-ESTIMATE IN 30 MIN"}
```

---

## Resolution Process

An incident is "mitigated" when the customer impact stops. It is "resolved" when the underlying cause is fixed and cannot recur without a new failure. These are different states — do not close an incident at mitigation.

### Mitigation

Options in order of preference:

1. **Rollback the recent deployment** — fastest, safest if the incident was caused by a deployment
2. **Failover to backup infrastructure** — invoke a runbook, verify healthy, monitor
3. **Isolate the affected tenant** — put a specific tenant into read-only mode while investigating (prevents further damage)
4. **Scale up** — if the cause is capacity, add more ECS tasks, increase RDS instance size, expand connection pool
5. **Circuit-breaker a downstream dependency** — if an EAM integration or third-party is causing the incident, degrade to a stub or last-known-good cache
6. **Manual fix in production** — always last resort; requires two engineers, one implementing, one reviewing each keystroke

### Between Mitigation and Resolution

Once mitigated, the incident channel switches to "MONITORING" status. During this phase:

- Update the customer status page: "Service is restored. We are monitoring."
- Continue to watch key metrics for 30 minutes minimum (2 hours for P0)
- Do not close the incident even if metrics look normal — the root cause is still unknown
- Begin the root cause analysis in parallel

### Resolution

An incident is resolved when:

1. Root cause is identified (not just "the deployment caused it" but why the deployment caused it)
2. A fix is in production (either a patch, a rollback with a follow-up fix planned, or a configuration change)
3. All monitoring metrics are back to baseline for at least 30 minutes
4. The customer status page is updated to "Resolved"
5. The customer resolution notification has been sent
6. A postmortem is scheduled

Do not skip step 6. Every P0 and P1 requires a postmortem. P2 postmortems are at the ED's discretion; a pattern of related P2s automatically triggers a joint postmortem.

---

## Blameless Postmortem Process

The purpose of a postmortem is to learn, not to blame. Postmortems that assign blame to individuals produce fear, and fear-driven teams hide information — which produces more incidents. Postmortems that focus on systems produce learning, and learning teams improve.

### Timing

- Postmortem meeting scheduled within 5 business days of resolution
- Draft postmortem document circulated 24 hours before the meeting
- Meeting duration: 60 minutes for P1, 90 minutes for P0

### Participants

**Required**: Incident Commander, Technical Lead, DevOps engineer, ED, PM (if customer-facing), everyone directly involved in resolution.

**Optional but recommended**: Tech Architect (for architectural insights), one engineer from another team (for cross-team pattern recognition), Documentation Engineer (to capture runbook updates).

### Template (draft before the meeting)

```markdown
# Postmortem: {INCIDENT ID} — {SHORT DESCRIPTION}

## Summary

**Date/time of incident**: {START} to {END} ({DURATION})
**Severity**: {P0 | P1 | P2}
**Customer impact**: {AFFECTED TENANTS, USERS, WORKFLOWS}
**Detected by**: {SOURCE}
**Resolved by**: {ACTION}

## What happened (Narrative)

A blow-by-blow account of the incident in chronological order. Include specific times.

Example:
- 14:32 UTC — CloudWatch alarm fires for elevated 5xx rate on `/api/v1/assets`
- 14:34 UTC — DevOps on-call acknowledges page
- 14:37 UTC — DevOps confirms real impact via test tenant, opens incident channel
- 14:42 UTC — Initial hypothesis: recent deployment at 14:28 UTC (14 minutes before symptoms)
- 14:47 UTC — Rollback initiated
- 14:52 UTC — Metrics return to baseline
- 15:02 UTC — Root cause identified: query missing tenant filter
- 15:15 UTC — Customer status page updated to "Resolved"

## Root cause

The technical root cause. Not "a bug" — the specific mechanism.

Example: "The AI-generated query handler for `GetPortfolioSummaryQuery` used `_context.Assets.Where(...)` directly rather than the repository method that applies the tenant filter. The global query filter was correctly configured but was bypassed by the direct DbContext access. When one tenant with 15,000 assets ran the endpoint, the query returned all tenants' data (over 200,000 rows), overwhelming the database connection pool."

## Contributing factors

The systemic reasons the root cause was not caught earlier. Multiple factors are usually present.

Example:
- The pattern of "always use repository, never DbContext directly" was documented in the constraint document but not enforced by an automated check
- Code review did not catch it because the reviewer scanned quickly and did not notice the missing repository call
- The integration test for this endpoint used a single-tenant fixture, so cross-tenant data leakage was not exercised
- The AI code generation prompt did not include a concrete example of the anti-pattern to avoid

## Detection

How quickly and effectively did we detect the issue?

- What alerted us: {SOURCE}
- How long between customer impact and detection: {MINUTES}
- What would have detected it faster: {IF ANY}

## Response

How well did we respond?

- Time to first response (page ack): {MINUTES}
- Time to mitigation: {MINUTES}
- Time to resolution: {MINUTES}
- What went well: {THINGS THAT WORKED}
- What could improve: {THINGS THAT DID NOT}

## Preventive actions

Specific, assigned, time-bounded actions to prevent this class of incident.

| Action | Owner | Due |
|---|---|---|
| Add an automated architecture test that blocks any direct `_context.Assets` access outside repositories | Tech Architect | 2 sprints |
| Update the code review checklist item D2 with a concrete example of this pattern | Backend Lead | 1 sprint |
| Add a multi-tenant integration test fixture used by all portfolio-summary tests | QA Lead | 1 sprint |
| Update the AI constraint document with a concrete counter-example | Tech Architect | 1 sprint |
| Add a CloudWatch alarm for connection pool exhaustion (early warning) | DevOps | 1 sprint |

## What we learned

Free-form section: what did this incident teach us about our systems, our processes, our tools, our team?

## What went well

Explicit call-out of what worked. Recognition matters.

Example: "The DevOps on-call acknowledged within 2 minutes. The Incident Commander decision to rollback before diagnosis saved an estimated 45 minutes of customer impact. The Backend Lead's runbook for connection pool exhaustion was accurate and helpful."

## Timeline of communication

| Time | Channel | Audience | Message |
|---|---|---|---|
| 14:37 | #incidents | Engineering | Incident declared |
| 14:45 | Status page | Public | Investigating |
| 15:00 | Email | Affected customers | Investigating with detail |
| 15:15 | Status page | Public | Resolved |
| 15:30 | Email | Affected customers | Resolved with summary |
```

### Meeting Agenda (60–90 min)

1. **Rules of engagement (5 min)**: Read aloud "This is blameless. We are looking at systems, not individuals. No 'X should have known better' — only 'What system change would have caught this earlier?'"
2. **Narrative walkthrough (15 min)**: Incident Commander walks through the timeline. Team confirms or corrects.
3. **Root cause discussion (15 min)**: Team confirms the root cause statement. Discusses whether there are other contributing causes not yet captured.
4. **Detection and response review (10 min)**: Was this detected fast enough? Was the response effective? What would have been better?
5. **Preventive actions (20 min)**: Brainstorm actions. Prioritize. Assign owners. Set due dates.
6. **Learning capture (5 min)**: What is the one-sentence lesson we want the whole team to remember? Write it down.

### After the Meeting

- Finalize the postmortem document with everyone's edits
- Publish to the internal wiki, tagged `#postmortem`
- Update runbooks with any new discoveries
- File preventive action tickets in the backlog with the postmortem linked
- Add to the quarterly "postmortem trends" review

---

## Post-Incident Action Tracking

Preventive actions from postmortems are the primary output of incident learning. If they are not tracked and completed, the same incidents recur.

**Rules**:
- Every preventive action becomes a ticket in the backlog with the postmortem linked
- Preventive actions are prioritized above P3 bug work (they prevent future P0/P1)
- The ED reviews all open preventive actions monthly
- Actions overdue by > 1 sprint are escalated in the next retrospective
- A dashboard shows: number of preventive actions open, mean age, completion rate

**Quarterly review**: The ED runs a 30-minute review of the last quarter's incidents. Questions:
- Are we seeing repeat root causes? (indicates preventive actions did not work)
- Is our MTTR (mean time to resolution) improving? (indicates response process is working)
- Is our MTTD (mean time to detection) improving? (indicates monitoring is improving)
- Is our incident rate decreasing? (indicates system is stabilizing)

If any of these trends are negative for two consecutive quarters, it triggers a full engineering-wide review of the operating model.

---

## Security Incident Response

Security incidents follow a modified process due to legal and compliance requirements.

**Definition of a security incident**: Any event that indicates or could indicate unauthorized access to systems or data, exposure of credentials, or malicious activity against the platform.

**Examples**:
- WAF alerts on unusual traffic patterns
- GuardDuty alerts on suspicious IAM activity
- A customer reports seeing another tenant's data (tenant isolation failure)
- A credential is discovered in a public repo or logs
- Suspected phishing or social engineering targeting engineers

**Modified process**:

1. **All security incidents start at P1 minimum** until proven benign
2. **CISO is paged in addition to DevOps** on every declared security incident
3. **Legal is notified within 4 hours** if there is any suspicion of data exposure
4. **Evidence preservation is mandatory** — no logs deleted, no systems reimaged until the security team has captured forensic data
5. **Customer notification requires Legal review** — do not send security incident notifications directly, route through Legal + PM
6. **Postmortem is confidential** by default — shared only with the incident team, ED, CISO, and Legal, unless customer notification is required
7. **Regulatory disclosure timelines apply** — GDPR (72 hours to authorities), state data breach laws (varies, typically 30–60 days), FedRAMP (1 hour for incident notification if we hold a Federal ATO)

The security incident response process is aligned with the NIST SP 800-61 framework and is audited annually as part of SOC 2 Type II certification.

---

## On-Call Rotation Structure

**Primary on-call rotation**:
- Pool: DevOps engineers + senior Backend/Frontend leads
- Duration: 1 week (Wednesday 10am to next Wednesday 10am)
- Compensation: $200 per week on-call stipend + comp time for any incident work outside business hours
- Handoff: 30-minute meeting between outgoing and incoming primary, covering: open incidents, open preventive actions, recent alarms and their meaning, any planned maintenance in the coming week

**Secondary on-call rotation**:
- Pool: Same as primary
- Offset: 3 days behind primary (secondary starts Saturday 10am)
- Purpose: Backup for primary; escalation target if primary does not ack in 10 minutes
- Also serves as the "shadow" for the primary during their first two weeks on-call

**Tertiary (ED)**:
- The Engineering Director is always in the escalation chain
- Paged only when primary + secondary have both failed to respond, or when incident is P0
- Serves as the Incident Commander for P0

**On-call handoff checklist** (Wednesday morning):
- [ ] Review open incidents in the tracker
- [ ] Review open preventive actions and their status
- [ ] Review any active production alerts
- [ ] Review the deployment history for the past week
- [ ] Check that PagerDuty schedule is correct
- [ ] Confirm the incoming on-call has the runbook library, dashboard access, and Secrets Manager access
- [ ] Log the handoff in the on-call log for audit purposes

**On-call is not a 24/7 stare at the screen job**. Between pages, the on-call engineer works on normal sprint work. The expectation is: acknowledge pages within SLA, respond appropriately, and log everything.

---

## Runbook Library

Every P1-worthy scenario has a runbook. Runbooks are stored in the wiki under `/runbooks/`. Each runbook follows this template:

```markdown
# Runbook: {SCENARIO NAME}

## When to use this runbook
{The exact alert or symptom that indicates this runbook applies}

## Detection
- CloudWatch alarm: {NAME}
- Symptom: {WHAT USERS EXPERIENCE}
- Related metrics: {LIST}

## Immediate actions (first 5 minutes)
1. {STEP}
2. {STEP}
3. {STEP}

## Investigation steps
{ORDERED LIST OF CHECKS AND WHAT EACH TELLS YOU}

## Common causes and fixes
| Cause | How to confirm | How to fix |
|---|---|---|
| {CAUSE} | {CHECK} | {ACTION} |

## Escalation
If the above steps do not resolve within {TIME}, escalate to: {PERSON/ROLE}

## Related runbooks
- {LINK}

## Postmortem findings that improved this runbook
- {LINK TO POSTMORTEM, DATE, WHAT WAS ADDED}
```

**Runbook maintenance**:
- After every incident, review the runbook used (if any). Update with what was learned.
- If no runbook existed and one should have, write one.
- Test runbooks quarterly: pick a runbook, walk through it with a junior engineer, confirm it is accurate and executable.
- Runbooks that have not been used or reviewed in 12 months are archived (they may reflect obsolete infrastructure).

---

## Incident Metrics and SLOs

Aurigo tracks these metrics monthly:

| Metric | Target | Escalation |
|---|---|---|
| Mean Time to Detection (MTTD) | < 5 minutes | > 10 minutes triggers monitoring review |
| Mean Time to Acknowledgement (MTTA) | < 5 minutes | > 15 minutes triggers PagerDuty review |
| Mean Time to Mitigation (MTTM) | < 30 minutes P0, < 2 hours P1 | > 2x target triggers runbook review |
| Mean Time to Resolution (MTTR) | < 2 hours P0, < 4 hours P1 | > 2x target triggers escalation review |
| Incident Rate | < 2 P0 per quarter, < 8 P1 per quarter | Exceeded triggers full ops review |
| Preventive Action Completion Rate | > 90% within 2 sprints | < 80% triggers ED intervention |
| Repeat Root Cause Rate | 0 in a rolling 6-month window | Any repeat triggers a systemic review |
| Postmortem Quality Score | > 4/5 on peer rating | < 3/5 triggers coaching |

These metrics are reviewed in the monthly engineering health meeting and reported to the CTO quarterly.

---

## AI-Assisted Incident Response

Claude Code agents assist incident response in three ways:

**Log analysis during triage**:
```
Analyze these CloudWatch logs from the {SERVICE} between {START} and {END}.
Elevated {SYMPTOM} rate started at {TIME}.
Identify the most likely root cause. Correlate error patterns.
Do not speculate — cite specific log lines that support your hypothesis.
```

**Runbook drafting after postmortem**:
```
Given this postmortem, draft a runbook that would help the next on-call engineer
recognize and respond to the same class of incident.
Use the runbook template in engineering-playbook/vol-5-operating-model/16-incident-management.md.
Reference the postmortem sections for detection, investigation, and preventive actions.
```

**Postmortem drafting from the incident channel transcript**:
```
Given this Slack transcript from the incident channel, draft a postmortem document
in the format specified in engineering-playbook/vol-5-operating-model/16-incident-management.md.
Preserve the timeline of events, actions taken, and any decisions made.
Highlight areas where the transcript is unclear so the human author can clarify.
```

The human incident commander reviews all AI-drafted incident artifacts before they are shared. AI does not participate in the incident channel directly — the human owns communication.
