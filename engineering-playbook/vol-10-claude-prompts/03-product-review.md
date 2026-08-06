# 03 — Product Review Prompt

Use these prompts to verify that an implemented feature matches its acceptance criteria, uses correct domain vocabulary, and handles edge cases and error states. Product review is complementary to architecture review — architecture review checks "did we build it right" and product review checks "did we build the right thing."

---

## When to Use

- **After implementation is complete** — before the PR is submitted, verify it against the story.
- **During QA** — use as a structured checklist to verify the feature end-to-end.
- **When acceptance criteria are ambiguous** — run the review to surface the ambiguity and get it resolved before demo.
- **Before a sprint demo** — verify that every story in the sprint was implemented as written.

---

## Standard Product Review Prompt (Masterworks / Public Sector)

Replace all `[PLACEHOLDER]` values. Paste the full prompt:

---

You are performing a product review of a recently implemented feature in the Aurigo Masterworks Maintain product (public-sector infrastructure owners: DOTs, cities, counties). Your goal is to verify that the implementation matches the acceptance criteria exactly, uses correct domain vocabulary, and handles edge cases and error states.

**The user story is:**
```
[USER_STORY_TEXT]

As a [PERSONA], I want to [GOAL] so that [BENEFIT].

Acceptance Criteria:
1. [AC_1]
2. [AC_2]
3. [AC_3]
[add all ACs]
```

**Step 1 — Read the backend implementation:**
Read the following files completely:
- Handler: `[PATH_TO_HANDLER]`
- Validator: `[PATH_TO_VALIDATOR]`
- Controller action: `[PATH_TO_CONTROLLER]` (read the relevant action method)
- Response DTO: `[PATH_TO_DTO]`

**Step 2 — Read the frontend implementation:**
Read the following files completely:
- Page component: `[PATH_TO_PAGE_COMPONENT]`
- Query/mutation hook(s): `[PATH_TO_HOOKS]`
- Form component (if applicable): `[PATH_TO_FORM_COMPONENT]`

**Step 3 — Read the tests:**
Read all test files related to this feature:
- Unit tests: `[PATH_TO_UNIT_TESTS]`
- Integration tests: `[PATH_TO_INTEGRATION_TESTS]`

**Step 4 — Verify each acceptance criterion:**

For each acceptance criterion (AC) listed in the story:

a) State the AC text exactly.
b) Identify the code that implements it (file:line).
c) Determine: IMPLEMENTED / PARTIALLY IMPLEMENTED / NOT IMPLEMENTED / CANNOT DETERMINE.
d) If PARTIALLY or NOT IMPLEMENTED: describe what is missing.
e) State whether this AC has a corresponding automated test. If not, flag it.

**Step 5 — Edge case and error state review:**

Check for these common edge cases and state whether each is handled:

- [ ] Empty state: what does the UI show when there is no data?
- [ ] Zero values: does the feature handle assets with condition = 0, cost = 0, age = 0?
- [ ] Maximum values: does the feature handle very large asset counts (> 10,000), very large dollar amounts (> $1B)?
- [ ] Authorization: does the feature correctly enforce role-based access? What happens if a read-only user tries a write operation?
- [ ] Concurrent modification: if two users edit the same record simultaneously, what happens?
- [ ] Network error: what does the frontend show if the API call fails?
- [ ] Partial failure: if a batch operation partially succeeds, is the user informed correctly?

**Step 6 — Domain vocabulary review:**

Aurigo Masterworks Maintain uses specific terminology for public-sector infrastructure. Check the implementation against this vocabulary:

- Asset types: Road, Bridge, Pillar, Pathway, Street, Sign, Drain (not "infrastructure item" or "resource")
- Condition: expressed as a numeric score 0-5 (not "health score" or "status rating")
- Remaining Useful Life: abbreviated RUL (not "lifespan remaining" or "expected life")
- Asset Replacement Value: abbreviated ARV (not "replacement cost estimate")
- Capital Needs: the specific term for a planned replacement or major rehabilitation (not "work order" or "project need")
- Deterioration Rate: expressed as condition points per year (not "degradation" or "wear rate")
- Inspection: the specific term for condition assessment (not "survey" or "evaluation" or "assessment")
- Risk Score: composite score from likelihood of failure x consequence of failure
- TAMP: Transportation Asset Management Plan — the document produced by DOT agencies

For each piece of user-facing text in the implementation (labels, headings, error messages, column headers, tooltips), verify it uses the correct Aurigo terminology. Flag any term that uses non-standard vocabulary.

**Produce a product review report:**

```
## Product Review: [STORY_TITLE]

### Acceptance Criteria Verification
| AC # | Text | Status | Test Exists? | Notes |
|------|------|--------|--------------|-------|
| 1 | [text] | IMPLEMENTED | Yes | |
| 2 | [text] | NOT IMPLEMENTED | No | Missing: [description] |

### Missing Tests
List each AC that has no automated test coverage.

### Edge Cases
| Edge Case | Handled? | Notes |
|-----------|----------|-------|
| Empty state | Yes/No | |
| Zero values | Yes/No | |

### Domain Vocabulary Issues
List any UI text that uses incorrect terminology, with the file:line and the correct term.

### Overall Assessment
[ ] Ready for demo — all ACs implemented and tested
[ ] Ready for demo with caveats — [list caveats]
[ ] Not ready — [list blocking gaps]

### Recommended Fixes
[Priority-ordered list of what needs to be fixed before this story is accepted]
```

---

## Primus Maintain Variant (Private Sector)

This variant adds private-sector domain vocabulary checks. Use for features built for Primus (manufacturing plants, data centers, utilities, airports, life sciences).

Replace the "Domain vocabulary review" step with the following step:

---

**Step 6 — Primus Domain Vocabulary Review:**

Primus Maintain targets private-sector infrastructure owners with different operational context. Check against this vocabulary:

- Asset types: Equipment, Facility, System, Component (not public-infrastructure terms)
- Condition: expressed as OEE (Overall Equipment Effectiveness) or a 1-5 scale depending on the industry vertical configured
- Remaining Useful Life: RUL (same abbreviation, but driven by equipment failure models, not deterioration curves)
- Replacement Value: Current Replacement Value (CRV) — insurance/accounting term used in private sector
- Capital Planning: Capital Expenditure planning (CapEx) — not TAMP
- Inspection: Inspection or Audit — both terms are used; verify which the current customer uses
- Risk: expressed as probability of failure x consequence to production (not public safety consequence)
- Work Request: the Primus equivalent of Capital Need (Primus integrates with EAM work orders)

Also check:
- [ ] No public-sector terminology (DOT, TAMP, highway, bridge rating) appears in UI text for Primus features
- [ ] The feature correctly handles the tenant's configured asset taxonomy (Primus is more configurable than Masterworks)
- [ ] Integration points reference the correct EAM stubs (not Masterworks-specific external clients)

---
