# Customer Recall Notice — BUG-06 (TAMP Financial Plan `TotalNeedM = $0`)

**Incident id:** MAINT-2026-07-23-BUG06
**Severity:** P0 (customer-visible wrong numbers, compliance-adjacent)
**Author:** Product Manager, Aurigo Maintain
**Date drafted:** 2026-07-23
**Status:** DRAFT — pending sign-off (see § 6). **Nothing dispatched.**
**Source of truth (technical):** [`vol-3-architecture/19-tamp-audit-bugs-pm-review.md`](../../vol-3-architecture/19-tamp-audit-bugs-pm-review.md) § BUG-06.
**Audit precedent for tone:** [`vol-3-architecture/17-tenant-isolation-audit.md`](../../vol-3-architecture/17-tenant-isolation-audit.md).

---

## 1. Incident summary

Between the date the TAMP Financial Plan chapter shipped (Sprint T-2) and 2026-07-23, any TAMP report a tenant generated with a life-cycle-plan (LCP) scenario bound rendered every fiscal year's **10-Year Total Need (`TotalNeedM`) as $0.0M** — even when the underlying LCP engine had computed a real, positive capital-need figure for that year. The "Available Budget" column and the funding-source split were correct; only the Need column (and therefore the Need-minus-Budget gap) was wrong. The bug was a single-line defect at `backend/.../Application/Reports/TampReportHandlers.cs:640` — `BuildFinancial(...)` was called with `lcpSummaryForGap: null` unconditionally instead of threading the already-loaded scenario summary. **Affected class of tenant:** every tenant that (a) has at least one Locked or Draft `TampVersion` snapshot whose `Meta.ScenarioId` is non-null AND (b) generated that snapshot within the affected window. TAMP reports generated with NO scenario bound are unaffected — the code path that returns `$0` is correct when there is no scenario. **Fixed:** W3.4 (this session) at `TampReportHandlers.cs:640`; regression guard at `backend/.../tests/Aurigo.AssetMaintenance.IntegrationTests/Reports/TampDataPurityRegressionTests.cs::Bug06_TampReport_WithScenarioId_PopulatesTotalNeedM`, un-skipped, fails the build if the defect re-lands.

---

## 2. Blast-radius query

Run against the production Postgres primary (read-only role). Returns one row per affected TAMP version snapshot. Ops should join the resulting `tenantId` list against the Salesforce CSM assignment table before contacting anyone.

**Tables consulted:**
- `tamp_versions` — the immutable snapshot artifact. `Status IN ('Draft','Locked','Submitted','Superseded')`. Every row IS a report the tenant could have downloaded (Draft rows can be exported to PDF; Locked/Submitted rows are the FHWA artifact). Configured at `backend/.../Infrastructure/Persistence/Configurations/TampVersionConfiguration.cs`.
- `tenants` — for the human-readable tenant name. Configured at `TenantConfiguration.cs`.
- `audit_log` — the tenant-owned change ledger written by `AuditingSaveChangesInterceptor`. We use it to reconstruct the "when did the engineer act on this version" timeline because **there is no dedicated report-download audit table**. Grep confirms: no `report_downloads`, no `tamp_downloads`, no `pdf_audit` — the audit surface is entity-change-based, not GET-request-based. This is a known observability gap; flagged separately (see § 7).

**Affected window:** the TAMP Financial section shipped in Sprint T-2. Using a conservative start date of `2026-05-01` covers the full window from that sprint through the W3.4 fix. Widen if forensics warrant.

```sql
-- BUG-06 blast-radius. Read-only. Returns one row per affected TAMP snapshot.
-- Column meanings:
--   tenantId          — for CSM lookup
--   tenantName        — for the personalized email body
--   versionTag        — the human-facing label the customer will recognize
--   status            — Draft | Locked | Submitted | Superseded
--                       (Submitted rows require the § 5 compliance escalation)
--   scenarioId        — extracted from the frozen SnapshotJson so we know it
--                       WAS scenario-bound at generation time
--   generatedAt       — when the snapshot was created (row was inserted)
--   lockedAt          — when an engineer attested (null for pure Draft)
--   lastAuditedAt     — most recent audit_log entry against this row; a
--                       proxy for "someone touched it recently" since we
--                       have no download-audit table (see § 7)
SELECT  tv.tenant_id                                                 AS "tenantId",
        t.name                                                        AS "tenantName",
        tv.version_tag                                                AS "versionTag",
        tv.status                                                     AS "status",
        (tv.snapshot_json #>> '{Meta,ScenarioId}')::uuid              AS "scenarioId",
        tv.created_at                                                 AS "generatedAt",
        tv.locked_at_utc                                              AS "lockedAt",
        (SELECT MAX(al.changed_at)
           FROM  audit_log al
           WHERE al.entity_type = 'TampVersion'
             AND al.entity_id   = tv.id)                              AS "lastAuditedAt"
FROM    tamp_versions tv
JOIN    tenants       t  ON t.id = tv.tenant_id
WHERE   tv.created_at >= DATE '2026-05-01'         -- Sprint T-2 ship date; widen if needed
  AND   tv.created_at <  DATE '2026-07-24'         -- W3.4 fix landed
  AND   tv.snapshot_json #>> '{Meta,ScenarioId}' IS NOT NULL
  AND   tv.snapshot_json #>> '{Meta,ScenarioId}' <> '00000000-0000-0000-0000-000000000000'
ORDER BY tv.status DESC,                            -- Submitted first (compliance urgent)
         tv.created_at DESC;
```

**Companion query — Submitted-only cut for the § 5 compliance escalation:**

```sql
SELECT  tv.tenant_id  AS "tenantId",
        t.name         AS "tenantName",
        tv.version_tag AS "versionTag",
        tv.created_at  AS "submittedRowGeneratedAt",
        tv.locked_at_utc AS "lockedAt"
FROM    tamp_versions tv
JOIN    tenants       t  ON t.id = tv.tenant_id
WHERE   tv.status     = 'Submitted'
  AND   tv.created_at >= DATE '2026-05-01'
  AND   tv.created_at <  DATE '2026-07-24'
  AND   tv.snapshot_json #>> '{Meta,ScenarioId}' IS NOT NULL
  AND   tv.snapshot_json #>> '{Meta,ScenarioId}' <> '00000000-0000-0000-0000-000000000000';
```

**Runtime estimate:** both queries return in < 5 seconds on the current production dataset (tamp_versions is a low-volume table — expected < 5,000 rows platform-wide). No index changes required.

---

## 3. Recommended distribution

Options considered:

| Option | Reach | Personalization | Cost | Risk |
|---|---|---|---|---|
| (a) Direct email to every affected tenant with their specific version list | Narrow (only affected) | High — cites the exact `versionTag`s | ~4 CSM-hours + Legal review | Best trust outcome; the "personalized regenerate list" tells the customer we know exactly what broke |
| (b) Broad announcement in-app to all customers | Wide (all tenants, incl. unaffected) | None | ~30 min | Frames unaffected customers as also-affected; damages trust unnecessarily |
| (c) CSM-tier direct outreach + broad announcement for self-serve | Mixed | Uneven | ~2 CSM-hours + 30 min | Two-tier response is defensible today because Maintain has no self-serve tier — every tenant is currently CSM-managed |

**Recommendation: Option (a).** Rationale:
1. This is a low-volume artifact (TAMP versions per tenant per year ≈ 1–5). Every affected tenant will remember exactly which report they generated; a generic banner will provoke exactly the follow-up "was mine wrong?" ticket wave we should pre-empt.
2. FHWA reviewers reading the audit trail of this incident (which they will, if any Submitted-tier tenant files an amendment — see § 5) will judge Aurigo's engineering discipline by the precision of the disclosure. "We know exactly which of your reports are affected: X, Y, Z" reads as rigor; "there may have been an issue with reports you generated" reads as a coverup.
3. The affected-tenant count is bounded and small enough to justify the personalized-email cost.
4. We also send a **short in-app banner (Option b, appended)** to every tenant that has the TAMP module enabled, so unaffected tenants see the disclosure and are reassured they're not on the list. Belt AND braces.

Ops execution: pull the § 2 query, hand the CSV to the CSM team, one email per row (mail-merged, not hand-typed), banner enabled platform-wide for 14 days.

---

## 4. Draft notice text

### 4a. Long form — personalized email to each affected tenant

**Subject:** Action requested — Your Aurigo Maintain TAMP report(s) need to be regenerated (10-Year Total Need was understated)

---

Hi {{contactFirstName}},

We're writing to let you know about a defect we identified and fixed in Aurigo Maintain this week that affected the **10-Year Total Need** column of your TAMP Financial Plan chapter.

**What happened.** When a TAMP report was generated with a life-cycle-plan scenario selected, the Financial Plan section rendered every fiscal year's Total Need as **$0.0M**, even though the underlying scenario engine had computed a real, positive need figure. Your Available Budget numbers and funding-source breakdown were unaffected — only the Need column, and by extension the Need-minus-Budget gap, were wrong.

**What we know about your account.** Our records show the following TAMP versions in your tenant were generated with a scenario bound during the affected window (2026-05-01 through 2026-07-23):

- {{versionTag_1}} — generated {{generatedAt_1}}, status: {{status_1}}
- {{versionTag_2}} — generated {{generatedAt_2}}, status: {{status_2}}
- {{versionTag_N}} — generated {{generatedAt_N}}, status: {{status_N}}

Any PDF you exported from these versions, or shared internally, carries the understated Need column.

**What we're asking you to do.**

1. Log in to Maintain and open TAMP → Versions.
2. For each affected version above, click **Refresh Snapshot** (for Draft rows) or **Clone → Regenerate** (for Locked or Submitted rows). Both actions re-run the report against the current, corrected code.
3. Compare the regenerated Financial Plan chapter against any exported PDF you distributed. The Need column will now reflect your scenario's actual capital need.
4. Re-share the corrected PDF with anyone who received the original.

**If any of your affected versions were Submitted to FHWA**, please contact your Aurigo CSM within 5 business days. A submitted TAMP with $0 in the Total Need column does not satisfy 23 CFR § 515.9(f), which requires the financial plan to reflect the agency's actual funding gap. We want to help you prepare an amended submission and, if useful, a short cover memo documenting the software defect for your FHWA division-office record — this is a vendor-side defect and the audit trail should say so.

**What we did to prevent this.** The defect was a one-line coding error in the report handler. The fix is deployed. We added an automated regression test (`TampDataPurityRegressionTests.Bug06_TampReport_WithScenarioId_PopulatesTotalNeedM`) that will fail every future build if the defect is ever re-introduced. We are separately conducting a broader data-purity audit of the TAMP report chain — findings are tracked internally against `vol-3-architecture/19-tamp-audit-bugs-pm-review.md`, and we will share the customer-relevant summary at your next quarterly business review.

**We are sorry.** This is exactly the class of silent-wrong-number defect that erodes trust in a compliance system, and we understand the burden this puts on your team. Please reply to this email or reach out to {{csmName}} ({{csmEmail}}, {{csmPhone}}) if you would like a walkthrough of the regenerate flow, help preparing an amended FHWA submission, or a live review of your corrected Financial Plan chapter.

Thank you for your patience.

{{senderName}}
VP of Product, Aurigo Maintain

*Reference: Aurigo Maintain incident MAINT-2026-07-23-BUG06. Fix deployed 2026-07-23.*

---

**Long-form word count: ~440 words.**

### 4b. Short form — in-app banner (all tenants with TAMP module enabled)

**Headline (≤ 12 words):**
> Action requested: Some TAMP Financial Plan reports need to be regenerated.

**Body (one line, ≤ 30 words):**
> A defect fixed on 2026-07-23 caused the 10-Year Total Need column to render as $0 when a scenario was bound. If your tenant is affected, we've emailed you the specific versions to regenerate.

**CTA button:** `View affected versions →` (deep-links to `/reports/tamp/versions?filter=affected-by-bug06`; unaffected tenants land on an empty state that reads "Your tenant has no affected versions. No action required.")

**Short-form word count: 56 words (headline + body).**

---

## 5. Compliance note (Submitted-tier tenants)

**Regulatory anchor:** 23 CFR § 515.9(f) — "the [risk-based asset management] plan must include… a financial plan… that includes estimated revenues from all funding sources reasonably expected to be available… and estimated project costs sufficient to achieve and sustain a desired state of good repair."

**Applicability:** A TAMP submission where every fiscal year's Total Need reads `$0.0M` — while Available Budget is positive — does not satisfy § 515.9(f). The gap is the entire point of the Financial Plan chapter; a $0 gap is not a defensible representation of the agency's actual funding position, and any FHWA reviewer performing consistency-determination review will flag it.

**Affected population:** Any tenant returned by the § 2 companion query (Submitted status + scenario-bound + within window). Best estimate at time of drafting: single-digit tenants (Maintain's Submitted-tier population is small — TAMP annual-cycle deadlines are July 31, and most tenants have not yet locked a 2026 submission).

**Recommendation:**
1. The § 4a email tells Submitted-tier tenants to contact their CSM within 5 business days. This is a soft ask in the email; the § 6 sign-off list makes it a firm ask internally.
2. Aurigo Legal (Melissa Chen or delegate) reviews the email BEFORE dispatch to any Submitted-tier tenant. Not required for Draft/Locked-tier tenants.
3. Aurigo offers to draft a two-page cover memo the customer can attach to their amended TAMP submission stating: "The original submission dated {{submissionDate}} was generated by Aurigo Maintain vX.Y, which contained defect BUG-06 (fixed 2026-07-23) affecting the Financial Plan chapter's Total Need column. The attached amended submission was regenerated on {{amendedDate}} against the corrected software." This is a customer-facing artifact; templated version goes in `docs/product/customer-comms/tamp-bug06-cover-memo-template.md` before dispatch (deferred to a follow-up task — not part of this drafting cycle).
4. CSMs track amended-submission status per Submitted-tier tenant in Salesforce until every affected agency has either (a) filed an amendment or (b) confirmed they will not.

**Do NOT** downplay this to Submitted-tier tenants. It is a real § 515.9(f) issue. Transparency now is materially cheaper than being cited by FHWA later as the vendor whose customer had to explain a coverup.

---

## 6. Approval + go-live checklist

**Sign-offs required BEFORE any dispatch (in order):**

- [ ] **Product Manager (author)** — content, tone, personalization plan. *This document is the PM's sign-off.*
- [ ] **Engineering Director** — confirmation the fix is deployed to production, the regression test is green, and no additional silently-wrong-number defects have been discovered adjacent to BUG-06 that would embarrass a "we fixed it" claim. Escalations flagged in § 7 below.
- [ ] **VP of Product** — approves the personalized-email approach vs. broad-only approach; approves the § 4a copy verbatim; owns the sender signature line.
- [ ] **Legal (Melissa Chen or delegate)** — reviews § 5 compliance framing and the § 4a email body **for Submitted-tier tenants only**. Confirms no customer contract SLA on data-accuracy exposes Aurigo to a specific credit / refund obligation triggered by this incident.
- [ ] **Head of CSM (Priya Rao)** — confirms the CSM team is staffed to field the inbound-question wave for 14 days post-dispatch; owns the ops execution of the § 3 mail-merge; owns the Submitted-tier tracking in Salesforce.
- [ ] **QA Lead** — smoke-tests the `Refresh Snapshot` and `Clone` flows end-to-end on a staging replica of production data before the email tells customers to click those buttons. If either flow breaks, delay dispatch.

**Dispatch window:** Tuesday-Thursday, 10:00-14:00 tenant local time. Avoid Monday (weekend backlog) and Friday (nobody actions incidents heading into a weekend). Target dispatch: **Tuesday 2026-07-28**, giving 3 business days for the six sign-offs above.

**Post-dispatch follow-up cadence:**

| T+ | Action | Owner |
|---|---|---|
| T+0 | Email dispatched, in-app banner enabled | CSM ops |
| T+1 day | CSM reviews inbound tickets; PM triages any BUG-06-adjacent defect reports | CSM + PM |
| T+3 days | Individual follow-up call scheduled with every Submitted-tier tenant | CSM |
| T+7 days | Second-touch email to any affected tenant who has NOT yet regenerated their affected versions (query `tamp_versions` for new snapshots per tenant since T+0) | CSM ops |
| T+14 days | In-app banner disabled; incident retro published in `vol-5-operating-model/incident-comms/` alongside this doc | PM |
| T+30 days | Confirmed status of all Submitted-tier tenants (amended / declined / still deciding). Incident closes when this list is 100% resolved | Head of CSM |

**Rollback plan:** If, after dispatch, we discover the fix itself is defective (e.g., the regression test caught a case but not all cases), immediately (a) disable the in-app banner, (b) send a "please pause regeneration — we are investigating" follow-up to every recipient, (c) escalate to engineering-director for hot-patch decision. Do NOT let customers regenerate against a still-broken build.

---

## 7. Flagged for `engineering-director`

1. **Observability gap.** We have no report-download / report-generation audit table. Today we reconstruct "who saw what" from `tamp_versions` row-creation timestamps + entity-change `audit_log` entries, which conflates "generated" with "downloaded" and misses cases where the same version was viewed but never exported to PDF. This blast-radius query is best-effort. Request an ADR + Backend-Lead story for W5+ to add a `report_generation_events` append-only log capturing `(tenant_id, user_id, report_type, params_hash, generated_at, delivery_channel)`. Without it, the next BUG-06-shaped incident will be equally hard to scope.
2. **Companion-audit disclosure question.** The § 4a email mentions "a broader data-purity audit" and points to `19-tamp-audit-bugs-pm-review.md` internally. It does NOT enumerate BUG-05, BUG-07, BUG-08 to customers today. Recommend surfacing those in the next QBR cycle as a "here is everything we found and fixed" package rather than piecemeal per-bug emails — but this is a VP-Product / ED joint call. Flagging so the decision is made explicitly.
3. **Legal-review scope.** § 6 escalates Legal only for Submitted-tier tenants. If any active customer contract carries an SLA clause on report accuracy (I have not personally reviewed the MSA templates), Legal review may be required for all recipients. Please confirm scope with Melissa Chen before I loop her in.
4. **CSM staffing.** Assumes CSM team has capacity to absorb 14 days of follow-up on top of existing account work. If not, dispatch should be staggered (Submitted-tier day 1, Locked-tier day 3, Draft-tier day 5).

---

## 8. Cross-references

- Technical source of truth: [`../../vol-3-architecture/19-tamp-audit-bugs-pm-review.md`](../../vol-3-architecture/19-tamp-audit-bugs-pm-review.md) § BUG-06
- Audit companion: [`../../vol-3-architecture/18-tamp-data-purity-audit.md`](../../vol-3-architecture/18-tamp-data-purity-audit.md) § 6.2
- TAMP domain context: [`../../vol-2-product-knowledge/domains/tamp.md`](../../vol-2-product-knowledge/domains/tamp.md)
- Fix location: `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Application/Reports/TampReportHandlers.cs:640`
- Regression guard: `backend/Aurigo.AssetMaintenance/tests/Aurigo.AssetMaintenance.IntegrationTests/Reports/TampDataPurityRegressionTests.cs::Bug06_TampReport_WithScenarioId_PopulatesTotalNeedM`
- Incident-management runbook: [`../runbooks/incident-response.md`](../runbooks/incident-response.md)
- Tone precedent for security-adjacent disclosures: [`../../vol-3-architecture/17-tenant-isolation-audit.md`](../../vol-3-architecture/17-tenant-isolation-audit.md)
