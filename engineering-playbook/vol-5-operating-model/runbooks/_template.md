# Runbook: <short symptom sentence>

> Version: `v0.1 — YYYY-MM-DD` • Owner: `<team or individual>` • Reviewed: `YYYY-MM-DD`

Fill every section. If a section does not apply, write `Not applicable — <one sentence
reason>` so the next reader knows you thought about it. Do not delete sections.

---

## Symptom

What the user or monitoring actually sees. Be concrete — quote the alert text, paste the
error message, or describe the visual behavior. If there are multiple ways the symptom
manifests, list all of them.

Examples of good symptoms:

- "PagerDuty alert `TAMP-Generate-P95-Burn` firing. Grafana panel `TAMP generation p95`
  showing > 60 s for the last 15 minutes."
- "Customer reports the Job Order list page shows a red toast `Failed to load` and stays
  empty. Browser DevTools shows `GET /api/v1/job-orders` returning 500."

Bad symptom (too vague): "TAMP is slow."

---

## Severity + expected TTR

State the severity band this runbook targets and the expected time-to-recovery.
Cite the SLO it protects (from `README.md § Expected SLOs`).

Example: `Severity: High. TTR target: 4 hours. Protects the "Write APIs" SLO (99.5%
availability, p95 < 1 s).`

---

## Preconditions

What must be true before you run this runbook. If a precondition fails, stop and escalate
per the ladder in `README.md`. Common preconditions:

- You are on-call primary or secondary (do not run destructive steps out-of-band).
- You have `kubectl` / AWS console / DB access at the required IAM role.
- The incident channel is open (`incident-response.md § Open the channel`).
- You have confirmed the symptom in a monitoring dashboard, not just a customer report.

---

## Diagnosis steps

Numbered. Each step states:

- The command or check to run (copy-pasteable).
- The expected output (what "green" looks like).
- The failure output (what tells you to move to Recovery).

Example:

1. **Check ECS service health.**
   ```
   aws ecs describe-services --cluster maintain-prod --services maintain-api \
     --query "services[0].{running:runningCount,desired:desiredCount,pending:pendingCount}"
   ```
   - Expected: `running == desired`, `pending == 0`.
   - Failure: `running < desired` for > 5 min → move to Recovery step 1.

2. **Check RDS connection saturation.**
   ```
   aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name DatabaseConnections \
     --dimensions Name=DBInstanceIdentifier,Value=maintain-prod --start-time <now-10m> \
     --end-time <now> --period 60 --statistics Maximum
   ```
   - Expected: `Maximum < 80` (pool max is 100).
   - Failure: `Maximum >= 95` → move to Recovery step 2.

---

## Recovery steps

Numbered. Each step states:

- The action to take (copy-pasteable command or explicit UI click path).
- The verification (how you know it worked).
- The rollback (what to do if the step fails or makes things worse).

Example:

1. **Restart the ECS service to clear connection leaks.**
   ```
   aws ecs update-service --cluster maintain-prod --service maintain-api \
     --force-new-deployment
   ```
   - Verify: `aws ecs wait services-stable --cluster maintain-prod --services maintain-api`
     returns within 10 min.
   - Rollback if step fails: If the new tasks fail their health check, scale to 0 and go to
     `rollback.md § Frontend-only rollback` or `§ Backend rollback with data-compatible
     migration` depending on the last deploy.

---

## Post-incident actions

What to do after the fire is out. Common items:

- [ ] Update the incident channel with the resolution note and root-cause hypothesis.
- [ ] Schedule the post-mortem within 5 business days (see
  `incident-response.md § Post-mortem`).
- [ ] File a follow-up ticket for any manual step that should be automated.
- [ ] Update this runbook if a diagnosis or recovery step was wrong or missing.
- [ ] Bump this runbook's version + reviewed date at the top.

---

## Related runbooks

- List every runbook a responder might jump into from here.

## Related dashboards

- Link to the Grafana / CloudWatch dashboard panels used in the diagnosis steps.

## Related alerts

- List the PagerDuty alert names that can trigger this runbook.

---

## Runbook feedback

Did this runbook help? Was a step wrong? Post in Slack `#runbook-feedback` with:

```
Runbook: <filename>
Version: <version at top>
Date used: YYYY-MM-DD
What worked:
What was wrong or missing:
Severity of the incident:
Suggested edit (optional):
```
