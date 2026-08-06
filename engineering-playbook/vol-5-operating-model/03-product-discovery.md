# 03 — Product Discovery Protocol

Product discovery is what happens between reading a story ticket and writing the first line of code. It ensures you are building what the product actually needs, not what you assume it needs. Skipped product discovery is the single largest source of rework in software development: you build the wrong thing correctly.

This protocol applies to any story larger than a 1-point bug fix. AI agents running in automated implementation mode must execute product discovery before beginning implementation planning.

---

## Priority Order of Product Truth

When you have conflicting information about what a feature should do, resolve the conflict by following this priority order. Higher priority sources override lower ones.

1. **Engineering Playbook Volume 2** — product principles, module definitions, persona JTBD. The canonical definition of what this product is.
2. **Product Requirements Document (PRD) / Feature Spec** — the written specification for the feature. In Aurigo, this is often `Asset Maintenance Features.csv` or a Notion/Confluence PRD.
3. **User Stories with Acceptance Criteria** — the implementation contract. Must have AC before work starts.
4. **Domain Expert input** — for domain-specific rules (TAMP compliance, cost basis calculation, deterioration curves) that are not fully specified in written documents.
5. **Product Manager** — for priority, scope, and business intent clarification.

If the story says X but the PRD says Y, clarify before coding. The story is derived from the PRD; if they conflict, the PRD is more likely correct, but confirm.

---

## Step 1 — Identify All Personas

Every story is written from a persona's perspective. Before implementation, name every persona who interacts with the feature — both those who initiate actions and those who are affected by the results.

**Aurigo Maintain personas (Masterworks target):**
- **Asset Manager** — owns the asset portfolio, responsible for TAMP compliance, approves capital plans
- **Field Inspector** — records condition data, works on tablet/mobile, may have intermittent connectivity
- **Capital Planner** — converts condition data into replacement and rehabilitation recommendations
- **Finance Officer** — reviews budget impact of capital needs, approves funding allocations
- **Agency Director** — executive view, interested in liability exposure and budget summary

**Aurigo Maintain personas (Primus target):**
- **Facility Manager** — owns the asset register, coordinates with maintenance teams
- **Maintenance Technician** — records condition observations, schedules work
- **Reliability Engineer** — analyzes failure modes, sets inspection intervals
- **Asset Analyst** — produces reports for regulatory compliance (ISO 55001, NERC CIP)

For each story, identify:
- **Primary persona**: the role taking the initiating action
- **Secondary personas**: roles that see the results, approve steps, or are notified
- **System actors**: external systems (EAM, GIS, CMMS) that interact with this flow

If the story's "As a [persona]" does not match any defined persona, flag it. The story may need rewriting or the persona catalog needs updating.

---

## Step 2 — Map Every AC to a Specific API Endpoint or UI Behavior

Acceptance criteria (AC) written in Gherkin format (`Given / When / Then`) must be translatable to observable system behavior. Each AC should map to exactly one of:
- An API endpoint response (status code, response body shape)
- A UI state transition (form submits, table updates, validation error appears)
- A business rule enforced at the API boundary (400 with specific error message)
- A background calculation result (field value computed and stored)

**Mapping exercise for each AC:**

```
AC: "Given a bridge inspection is submitted with a condition rating below 3,
     When the system processes the submission,
     Then a High-Priority capital need is automatically created"

Maps to:
- POST /api/v1/inspections → handler logic
- Handler must check: does any InspectionItem have rating < 3?
- If yes: create CapitalNeed with Priority = High, AssetId = inspection.AssetId
- The capital need creation must be atomic with the inspection submission (same transaction)

API behavior: POST /api/v1/inspections returns 201 with the created inspection
              AND confirms the capital need was created (either in response body or via GET /api/v1/capital-needs?assetId=X)
```

If you cannot map an AC to a specific observable behavior, the AC is not implementable. Stop and clarify with the PM or Domain Expert.

**Red flag: Vague AC**
"The system should handle errors gracefully" is not an AC. It cannot be tested. Push back: what specific errors? What does graceful mean? What does the user see?

---

## Step 3 — Identify Data Sources

Every feature consumes or produces data. For each data element in the story:
- Where does it come from? (user input, calculated, pulled from EAM, from another Aurigo module)
- What is its type and valid range? (string, decimal, enum, geometry — and constraints)
- Who owns it? (which aggregate, which table)
- Is it pre-existing data or new data this feature creates?

For features that read data from external systems (EAM platforms like Maximo, IBM APM, SAP PM):
- Confirm the external system is behind an `I[Service]Client` interface stub
- Confirm the stub returns realistic test data
- Do not design the feature assuming real-time EAM connectivity — the EAM may be offline, slow, or returning stale data

**Data lineage for Asset Maintenance:**
```
Field Inspector records condition rating (new data)
  → Stored in Inspections table
  → Condition rating triggers RUL calculation (derived data, stored or computed)
  → RUL feeds ARV calculation (derived from RUL + replacement cost)
  → ARV feeds Risk Score (derived from ARV + probability of failure)
  → Risk Score feeds Capital Needs prioritization (business decision)
  → Capital Needs feed TAMP report (regulatory output)
```

Understanding this lineage tells you: a change to how condition ratings are stored will cascade through all downstream calculations. Changes to entities early in this chain require extra care.

---

## Step 4 — Identify Edge Cases

Edge cases are the scenarios that reveal whether an implementation is production-ready. For every feature, evaluate:

**Volume edge cases:**
- **Empty state**: no data yet. The UI must display a helpful empty state, not a blank screen or a JavaScript error.
- **Single record**: does the feature work with exactly one item?
- **Large dataset**: what happens with 1 million assets? Does the query have appropriate pagination? Are there missing indexes? Does the API return within 500ms?

**Connectivity edge cases:**
- **EAM integration offline**: if the feature reads from an external system and that system is unavailable, does it fail gracefully with a clear message? Does it use a cached value?
- **Partial network failure**: a form submission that succeeds server-side but the response is lost — does the user see an error and retry, creating a duplicate?

**Data quality edge cases:**
- **Missing required data**: asset without a replacement cost when ARV is computed
- **Out-of-range values**: a condition rating of -1, or a cost of $0
- **Future dates**: an inspection date in the future
- **Duplicate records**: what happens if the same inspection is submitted twice?

**Authorization edge cases:**
- **Cross-tenant access**: does tenant A's data appear in tenant B's queries? (This must always be NO)
- **Role boundary**: can a Field Inspector approve a Capital Need? (They should not be able to)
- **Resource ownership**: can a user from Agency A view Agency B's assets?

Document the edge cases and confirm how each one is handled before implementation begins.

---

## Step 5 — Identify Business Rules

Business rules are constraints on data or behavior that come from the domain, not from engineering preferences. Aurigo Maintain has several critical business rules:

**TAMP Compliance Rules (Masterworks):**
- Transportation Asset Management Plans (TAMP) require documented condition assessments at specified intervals. The system must enforce minimum inspection frequencies for TAMP-covered assets.
- Condition ratings must follow the standard scale (typically 1–10 or 0–10 depending on asset type). Custom scales require explicit configuration and must document the mapping.
- TAMP reports must be generated in the required format (federal specification). The output format is not negotiable.

**Budget Enforcement Rules:**
- Capital needs cannot be funded above the approved budget envelope for the planning period. The system must warn (or block, depending on configuration) when a funding allocation would exceed the budget.
- Budget approval thresholds: allocations above a threshold (configured per agency) require approval from a Finance Officer or Agency Director. The approval workflow must be triggered automatically.

**Asset Lifecycle Rules:**
- Remaining Useful Life (RUL) cannot be negative. If calculated RUL < 0, clamp to 0 and flag the asset for immediate replacement review.
- Asset Replacement Value (ARV) must use the configured replacement cost basis. Manually overriding ARV must be logged and flagged in reports.
- Risk scores must be recalculated whenever a new inspection is recorded or when the asset's replacement cost is updated. Stale risk scores are a data quality issue.

**For each business rule encountered in a story:**
1. Confirm the rule in writing (which document defines it?)
2. Identify where it is enforced (API boundary? domain entity? calculation engine?)
3. Identify the error message or behavior when the rule is violated
4. Write an AC that tests the rule explicitly

---

## Red Flags: When to Stop Before Coding

Stop and escalate before writing any code when you encounter:

**No Acceptance Criteria**
A story with no AC is not ready to implement. The engineer or agent cannot know what "done" means. Return the story to the backlog with a comment requesting AC before it can be picked up.

**AC References an Undefined Calculation**
"The risk score is calculated based on condition and probability of failure" without a formula is not implementable. Reference `vault/calculations/` for Aurigo Maintain calculation specs. If the formula is not documented, escalate to Domain Expert before coding.

**Feature Bypasses Multi-Tenancy**
Any story that requires returning data across tenant boundaries requires an architecture review. Examples: "show all agencies' assets on a single map" (requires explicit multi-tenant scope handling), "aggregate statistics across all tenants" (requires a separate analytics context with tenant bypass).

**Story Assumes Non-Existent Infrastructure**
If a story assumes a real-time EAM sync that does not exist, a notification channel that has not been wired, or a third-party API integration that is only stubbed, escalate. Do not invent the infrastructure to make the story work.

**Story Scope Creep**
If implementing the story as written would require changing more than 3 entities or more than 5 files outside the story's stated scope, flag scope creep. Either the story is too large (split it) or it has undocumented dependencies (surface them).

---

## Product Discovery Checklist

Before moving to implementation, confirm:

- [ ] All personas identified (primary + secondary + system actors)
- [ ] Every AC mapped to a specific API endpoint or UI behavior
- [ ] All data sources identified and data ownership confirmed
- [ ] Empty state, large dataset, and offline edge cases addressed
- [ ] Business rules identified, formula sources confirmed
- [ ] No red flags present (no AC, undefined calculations, multi-tenancy bypass)
- [ ] Story is ≤ 8 points OR has been split into smaller stories
- [ ] Dependencies on other stories or systems are listed and those stories exist in the backlog
