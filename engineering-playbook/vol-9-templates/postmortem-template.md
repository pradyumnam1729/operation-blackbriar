# Incident Postmortem

**Engineering Playbook · Aurigo Software Technologies**
Version 1.0 · July 2026

A postmortem is a blameless, written record of an incident. Its purpose is not to assign fault — it is to make the system more resilient than it was before the incident. Every Sev-1 or Sev-2 incident requires a postmortem within 5 business days of resolution.

---

## How to Use

1. Copy this template into `docs/postmortems/YYYY-MM-DD-[short-slug].md` in the affected product repo.
2. The Incident Commander for the event is the postmortem owner by default.
3. Fill the template collaboratively during the postmortem meeting (typically 60-90 minutes, scheduled within 72 hours of resolution).
4. All action items must land in Jira with owner and due date before the postmortem is considered complete.
5. Publish the finished postmortem to the internal Confluence "Incidents" space and link it from the on-call channel.

**Blameless principle:** Refer to roles, systems, and decisions — never individuals. Write "the on-call engineer" not "Ravi." The goal is to make it psychologically safe to speak the truth so we can learn.

---

## Incident Summary

| Field | Value |
|-------|-------|
| **Incident ID** | INC-YYYY-NNNN *(e.g., INC-2026-0042)* |
| **Title** | *[Short, factual description — e.g., "Masterworks Maintain API 5xx errors after RDS failover"]* |
| **Severity** | Sev-1 / Sev-2 / Sev-3 |
| **Status** | Resolved / Monitoring / Post-mortem pending |
| **Product** | Masterworks Maintain / Masterworks Plan / Primus Build / Platform |
| **Environment** | Production / Staging |
| **Regions Affected** | us-east-1 / us-west-2 / eu-west-1 |
| **Detection Time (UTC)** | YYYY-MM-DD HH:MM:SS |
| **Resolution Time (UTC)** | YYYY-MM-DD HH:MM:SS |
| **Total Duration** | *[hours:minutes]* |
| **Time to Detect (TTD)** | *[minutes from onset to first alert]* |
| **Time to Acknowledge (TTA)** | *[minutes from alert to human ack]* |
| **Time to Resolve (TTR)** | *[minutes from ack to full resolution]* |
| **Incident Commander** | *[Role — e.g., Backend On-Call Lead]* |
| **Postmortem Owner** | *[Role]* |
| **Contributors** | *[Roles who worked the incident]* |

### One-paragraph summary

*[Write 3-5 sentences that a VP could read and understand. What happened, who was affected, what was the customer impact, how was it resolved, when did it end. Example: On 2026-07-14 between 14:22 and 15:48 UTC, the Masterworks Maintain API returned 5xx errors for 82% of requests in us-east-1. The root cause was that an RDS Aurora writer failover left cached DB connections in Fargate tasks pointing at a stale endpoint. Impact: 47 tenants (approximately 8,900 users) could not create or update work orders for 86 minutes. Recovery was manual — Fargate tasks were force-restarted at 15:44 UTC. The underlying fix (connection resilience via Npgsql retry policy + shorter connection lifetime) is tracked as ACTN-01.]*

---

## Impact Assessment

### Users Affected

| Segment | Count | % of Segment | Notes |
|---------|-------|--------------|-------|
| Tenants impacted | *[N]* | *[N]%* | *[Which segments — Masterworks DOTs, city agencies, etc.]* |
| End users impacted | *[N]* | *[N]%* | *[Concurrent users during the window]* |
| Sessions dropped | *[N]* | — | *[Sessions that received 5xx or timed out]* |
| Data-mutating requests failed | *[N]* | — | *[POST/PUT/PATCH that returned 5xx]* |
| Data-mutating requests succeeded but not confirmed | *[N]* | — | *[Requests that mutated data server-side but did not return 2xx to client — potential data-integrity concern]* |

### Business Impact

| Impact Type | Value | Notes |
|-------------|-------|-------|
| SLA breach | Yes / No | *[Which SLA — e.g., 99.9% availability breached this month]* |
| SLA credits owed | *[$ estimate]* | *[Based on contract terms per affected tenant]* |
| Revenue at risk | *[$ estimate]* | *[If applicable — e.g., renewal conversations in progress]* |
| Support tickets opened | *[N]* | *[Direct incident-related tickets]* |
| Escalations to CSM/Sales | *[N]* | *[Named accounts that escalated]* |
| Press / social media coverage | Yes / No | *[If yes, link to coverage]* |
| Regulatory disclosure required | Yes / No | *[e.g., if PII was exposed]* |

### Data Integrity

- [ ] **No data loss** — all mutations either committed or failed cleanly with error returned to client.
- [ ] **No silent data corruption** — no requests that mutated data server-side without an error returned to client.
- [ ] **No cross-tenant leak** — no tenant saw data from another tenant.
- [ ] **Audit log intact** — all mutations during the window are present in the audit log.

*If any of the above is unchecked, explain and reference the remediation:*

*[e.g., "During the window, 34 work order updates were written to the DB but returned 5xx to the client. We identified these via correlation IDs. The affected tenants were notified individually. Reconciliation was completed by 2026-07-15 EOD."]*

---

## Timeline (UTC)

*Every entry must have a timestamp. Use HH:MM:SS format. Include external signals (customer reports, monitoring alerts) as well as internal actions (deploys, restarts, config changes).*

| Time (UTC) | Actor | Event |
|-----------|-------|-------|
| **14:20:11** | System | RDS Aurora automated maintenance triggered writer failover (us-east-1) |
| **14:22:04** | Monitoring | Datadog alert `maintain-api-5xx-rate` fired (>5% 5xx over 2 min) |
| **14:22:41** | Monitoring | PagerDuty paged Backend On-Call |
| **14:24:12** | On-Call Eng | Acknowledged page. Joined `#inc-2026-0042` bridge. |
| **14:25:30** | On-Call Eng | Confirmed 5xx spike in Grafana. Started incident channel. |
| **14:28:00** | IC | Declared Sev-2. Paged EM and CSM lead. |
| **14:31:00** | On-Call Eng | Identified `Npgsql.NpgsqlException: connection refused` in ECS task logs |
| **14:34:00** | Platform Eng | Confirmed RDS writer failover completed at 14:20 — endpoint had new IP |
| **14:38:00** | IC | Hypothesis: Fargate tasks have stale DNS-cached connections |
| **14:42:00** | IC | Escalated to Sev-1 (customer escalations arriving via Support) |
| **14:48:00** | Platform Eng | Attempted `SIGHUP` to worker processes — no effect |
| **14:55:00** | Platform Eng | Attempted rolling restart via ECS service update — slow (600s deploy window) |
| **15:20:00** | IC | Decision: force-restart all Fargate tasks in parallel via `aws ecs stop-task` |
| **15:38:00** | Platform Eng | Force-restart initiated across all `maintain-api` tasks |
| **15:44:00** | Platform Eng | New tasks healthy. 5xx rate returning to baseline. |
| **15:48:00** | On-Call Eng | 5xx rate below 0.1%. Confirmed with synthetic monitoring. |
| **15:50:00** | IC | Declared Resolved. Started monitoring window. |
| **16:20:00** | IC | Monitoring window complete. Incident closed. |
| **16:45:00** | Postmortem Owner | Postmortem meeting scheduled for 2026-07-16 15:00 UTC |

---

## Detection, Response, and Recovery Timeline (Summary)

| Phase | Duration | Notes |
|-------|----------|-------|
| **Detection** *(onset to first alert)* | 1m 53s | Alert fired within 2 min of failover — target is <2 min. **On target.** |
| **Acknowledgement** *(alert to human ack)* | 2m 08s | On-Call responded within 3 min. Target <5 min. **On target.** |
| **Diagnosis** *(ack to root cause identified)* | 13m 30s | Root cause identified in logs quickly. **On target.** |
| **Mitigation Attempt 1** *(SIGHUP)* | 7 min | Ineffective — added time to recovery. |
| **Mitigation Attempt 2** *(rolling restart)* | 25 min | Too slow due to default ECS deploy config. |
| **Mitigation Attempt 3** *(force restart)* | 6 min | Effective. Should have been attempt 1. |
| **Total Recovery** *(ack to resolved)* | 1h 25m | Target <30 min for Sev-1. **Missed target by 55 min.** |

---

## Root Cause Analysis

### 5 Whys

**1. Why did Maintain API return 5xx errors?**
> Because Fargate tasks could not open new DB connections to RDS Aurora.

**2. Why couldn't they open new connections?**
> Because Npgsql held cached connections to the old writer endpoint IP, which no longer accepted connections after failover. New connection attempts were routed to the same stale endpoint via `.NET`'s process-level DNS cache.

**3. Why was DNS cached at the process level?**
> Because `System.Net.ServicePointManager.DnsRefreshTimeout` defaults to `120000ms` (2 minutes), and Npgsql pooled connections were reusing resolved IPs indefinitely without re-resolving on failure.

**4. Why did we not have a retry policy on connection failures?**
> Because our Npgsql connection string does not enable connection resiliency (`EnableRetryOnFailure` in EF Core), and we do not set `Connection Idle Lifetime` — connections live until the pool is disposed.

**5. Why did we not know this was a risk?**
> Because we have not run a game day exercising an RDS failover in production-like conditions. The last DR test (Q1 2026) tested backup restore, not writer failover.

### Fishbone (Ishikawa) Analysis

```
                    Incident: Maintain API 5xx after RDS failover
                                   |
     ---------------------------------------------------------------
     |             |               |              |              |
   PEOPLE       PROCESS         TECHNOLOGY     TOOLS         ENVIRONMENT
     |             |               |              |              |
- On-call ramp  - No game     - No conn        - ECS deploy    - RDS writer
  onto RDS        day for       resiliency       config too      failover
  failover        RDS           in Npgsql/EF     slow for        default
  scenarios      failover      - No DNS TTL      incident        maintenance
                - Runbook       override         response        window
                  missing     - Connection                       triggered
                  "force        Idle Lifetime                    unexpectedly
                  restart"      not set
                  option
```

### Primary Root Cause

*[One paragraph. Be precise.]*

*The primary root cause was the absence of connection resiliency in the Npgsql client configuration. When RDS Aurora failed over the writer, existing pooled connections became unusable, and new connection attempts to the cached endpoint IP were rejected. Neither Npgsql nor EF Core was configured to detect this and re-resolve DNS or retry with exponential backoff.*

### Contributing Factors

Contributing factors made the incident worse than it needed to be. They are separate from the root cause but must be addressed.

1. **Rolling restart via ECS service update was too slow** (25 min minimum) — the incident runbook did not mention `aws ecs stop-task` for immediate parallel restart.
2. **No game day for RDS failover** — the team had no muscle memory for this scenario. Diagnosis took 13 min; with prior exposure it would have taken <5 min.
3. **DNS refresh timeout is not tuned** — the default 120s is too long for a service that depends on RDS endpoints.
4. **Alert did not include RDS event correlation** — the on-call had to manually check RDS events to link the API failure to the failover.
5. **Two mitigation attempts failed** before the effective one was tried — no decision tree in the runbook to guide mitigation order.

---

## Lessons Learned

### What went well

- Alerts fired quickly and paged the right person.
- The incident bridge was joined by the right roles within 5 minutes.
- The Incident Commander made a clear decision to escalate to Sev-1 when customer escalations arrived — no debate.
- The audit log confirmed no data was silently corrupted.
- Communication with CSMs and affected tenants was proactive and timely.

### What went poorly

- Diagnosis took longer than it should have because no one had seen this failure mode.
- Recovery took 3 attempts. The first two burned 32 minutes.
- No customer status page update was posted until 15:20 UTC — 58 minutes into the incident.
- The runbook did not cover this scenario at all.
- We did not know our Npgsql/EF connection resiliency posture until we needed it.

### What we got lucky on

- The failover happened at 14:20 UTC (10:20 EDT) — mid-morning US East, but not peak US West traffic. Peak-hour impact would have been 3-4x worse.
- No writes were silently lost — all failed writes returned errors to the client.
- We had a recent snapshot; had the failover been a full DB failure, we had a known-good rollback point.

---

## Action Items

*Every action item has an owner, a due date, and a priority. Track in Jira. Link Jira ticket in the last column.*

### Priority definitions

- **P0** — must ship within 1 week. Prevents recurrence directly.
- **P1** — must ship within 1 sprint. Materially reduces likelihood or blast radius.
- **P2** — must ship within 1 quarter. Improves resilience or observability broadly.
- **P3** — nice to have, tracked in backlog.

| ID | Action Item | Owner (role) | Priority | Due Date | Jira |
|----|-------------|--------------|----------|----------|------|
| ACTN-01 | Enable Npgsql retry policy (`EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)`) in all Maintain DbContexts | Backend Lead | P0 | 2026-07-21 | MAINT-4218 |
| ACTN-02 | Set `Connection Idle Lifetime=300` and `Connection Pruning Interval=10` on all Npgsql connection strings | Backend Lead | P0 | 2026-07-21 | MAINT-4219 |
| ACTN-03 | Set `System.Net.ServicePointManager.DnsRefreshTimeout=30000` at app startup for all services depending on RDS | Platform Eng | P0 | 2026-07-21 | PLAT-1102 |
| ACTN-04 | Add "force restart" playbook step to `runbooks/rds-failover-response.md` with exact `aws ecs stop-task` command | On-Call Lead | P1 | 2026-07-28 | OPS-882 |
| ACTN-05 | Schedule quarterly game day: RDS Aurora writer failover in staging | EM (Platform) | P1 | 2026-08-15 | PLAT-1103 |
| ACTN-06 | Add Datadog monitor for RDS `DBInstanceFailover` event, correlated with API 5xx rate | SRE | P1 | 2026-08-01 | OPS-883 |
| ACTN-07 | Publish customer status page update within 15 min of Sev-1 declaration — automate from PagerDuty | Support Lead | P1 | 2026-08-15 | SUP-441 |
| ACTN-08 | Add ECS deployment config `minimumHealthyPercent: 0` for emergency drain scenarios (behind feature flag) | Platform Eng | P2 | 2026-09-30 | PLAT-1104 |
| ACTN-09 | Rewrite the "Resilient DB Connections" section in vol-3-architecture/09-performance.md with the new defaults | Backend Lead | P2 | 2026-08-31 | DOC-207 |

### Prevention Measures (Systemic)

Beyond individual action items, these systemic changes reduce entire classes of similar incidents:

1. **Every new service that connects to RDS must set connection resiliency defaults** — added to the service scaffold template and to the code review checklist.
2. **Every Sev-1 postmortem produces at least one game day scenario** — the scenario becomes part of the quarterly game day rotation.
3. **Every runbook must include a decision tree for mitigation ordering** — fastest-recovery option first, safest option first documented separately.

---

## Communication Log

*Record every external communication during the incident.*

| Time (UTC) | Channel | Audience | Message Summary | Author |
|-----------|---------|----------|-----------------|--------|
| 14:32 | Slack `#customer-support` | Support team | "Sev-2 declared, Maintain API 5xx errors, investigating" | IC |
| 14:45 | Slack `#csm-alerts` | CSM team | "Escalated to Sev-1, we will keep you posted" | IC |
| 15:20 | status.aurigo.com | External customers | "We are experiencing errors with Masterworks Maintain and are working on a fix" | Support Lead |
| 15:52 | status.aurigo.com | External customers | "The issue has been resolved. Monitoring for stability." | Support Lead |
| 16:30 | status.aurigo.com | External customers | "Incident fully resolved. A summary will be posted within 5 business days." | Support Lead |
| 17:00 | Email | Affected tenant admins (47 orgs) | Personalized incident notification with reference number for support | CSM Lead |
| Next day 09:00 | Email | Affected tenant admins | Preliminary root cause and next steps | Product Marketing |
| Postmortem + 1 day | Confluence + Slack | All internal | Full postmortem published | Postmortem Owner |
| Postmortem + 3 days | Email | Named accounts requesting detail | Sanitized external postmortem shared under NDA | Sales Ops |

---

## Sign-Off

The postmortem is complete when:

- [ ] All timeline entries verified against Slack logs, PagerDuty, and CloudTrail
- [ ] All action items have owners and Jira tickets
- [ ] Communication log includes all customer-facing messages
- [ ] Reviewed by Incident Commander
- [ ] Reviewed by Engineering Manager for the affected product
- [ ] Reviewed by Head of Support / CSM lead
- [ ] Reviewed by VP Engineering (Sev-1 only)
- [ ] Published to `docs/postmortems/` in the affected repo
- [ ] Linked from the on-call channel and the internal Incidents index

| Reviewer | Role | Date | Sign-off |
|----------|------|------|----------|
| *[Name]* | Incident Commander | YYYY-MM-DD | Approved |
| *[Name]* | EM — [Product] | YYYY-MM-DD | Approved |
| *[Name]* | Head of Support | YYYY-MM-DD | Approved |
| *[Name]* | VP Engineering | YYYY-MM-DD | Approved *(Sev-1 only)* |

---

_Template maintained in vol-9-templates/postmortem-template.md. Update with lessons from each incident cycle._
