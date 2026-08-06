# 09 — Content Audit

## When to Use

- The monthly content-governance run (Master Instructions §11; agent C12).
- Immediately after any positioning change — the audit is the blast-radius report for what now disagrees with the new positioning.
- Before a major launch or analyst cycle, to certify the library clean.

## The Brief

Replace `[PERIOD]`. Paste in full:

---

Run the content audit for **[PERIOD]**. Read all brand files first. Do not guess; every flag cites the file, the line, and the rule violated.

**Context.** Read, in order:
1. `GTM-War-Room/BRAND-DNA/positioning-and-icp.md` and `GTM-War-Room/BRAND-DNA/gtm-rules.md` — the ground truth being audited against
2. `Voice of Aurigo - Standards Reference.md` — terminology and banned-phrase rules
3. The audit corpus: everything in `GTM-War-Room/PLAYBOOKS-AND-ASSETS/`, active launch trees in `GTM-War-Room/ACTIVE-LAUNCHES/`, and `GTM-War-Room/product-wiki.md`
4. `pmm-playbook/vol-7-ai-engineering/04-evals.md` — the consistency-check and swap-test methodology

**End state.** An audit report at `GTM-War-Room/MARKET-INTELLIGENCE/governance/[period]-audit.md` covering, per C12's mandate, four flag classes across the corpus:
1. **Outdated** — assets contradicting current positioning or product-wiki (staleness per each asset's `date` and `sources` against upstream change dates)
2. **Inconsistent** — assets disagreeing with each other or with `positioning-and-icp.md` (contradiction / drift / staleness classification per the eval methodology)
3. **Unsupported** — claims tracing to no war-room source: product claims absent from `product-wiki.md`, proof points without reference status, competitive claims without a dated dossier
4. **Incomplete** — missing frontmatter, placeholder tokens surviving in drafts, template guidance blocks not deleted, one-pagers over a page

Plus the library-wide metrics: swap-failure rate (batch swap test over claim sentences), banned-phrase count by rule, asset counts by stage and age.

**Constraints.**
- Every flag is actionable: file, location, rule, and the proposed fix (edit, refresh trigger, or retire).
- Retirement is a first-class recommendation — a stale battlecard that "just needs updating" for the third audit running should be proposed for retirement per the §12 B8 dead-cards-out loop.
- Fixes are proposals (§8.5); the audit changes nothing itself.
- Rank the fix list by exposure: customer-facing finals first, high-usage assets (per messaging-effectiveness data) before shelf-ware.

---

## Expected Output

- The audit report with the four flag classes, library metrics, and the ranked fix list.
- A trend line against previous audits: is the swap-failure rate falling? Is the stale fraction shrinking?
- Proposed retirements, separately listed — they need explicit PMM admin sign-off.

## Follow-Ups

- Approved fixes route to the owning agents (battlecard fixes to sales-enablement, messaging fixes to product-to-market).
- Recurring flag patterns are systemic: same rule violated across many assets means the template or the brief needs the fix, not the assets one by one — route to `pmm-playbook/vol-9-templates/` or this library.
- Library metrics feed the monthly gtm-performance rollup and, at GA, the messaging-consistency score (`pmm-playbook/vol-8-roadmap/03-ga.md`).
