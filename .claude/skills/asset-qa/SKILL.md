---
name: asset-qa
description: The promotion gate. Run on any draft before it moves to final or ships — battlecards, messaging, briefs, one-pagers, channel copy, web copy. Use when the user asks for a review, QA, or voice check, when any skill reaches its quality-gate step, or before changing any asset's stage from draft to final. Outputs pass/fail per check with the exact offending lines and rewrites.
---

# Asset QA — The Promotion Gate

Nothing moves from draft to final without passing this gate (§8.4). The gate does not
edit taste; it enforces the standards that keep output irreplaceably Aurigo. Output is a
verdict per check with the exact offending line and a proposed rewrite — actionable, not
a lecture.

## Required reading

1. The asset under review — in full, including frontmatter.
2. `Voice of Aurigo - Standards Reference.md` — the authoritative rules list.
3. `.claude/hooks/forbidden-words.txt` — the enforced banned list.
4. `GTM-War-Room/BRAND-DNA/` — `positioning-and-icp.md`, `our-customer.md`, `gtm-rules.md` (needed for checks A and D).
5. `PMM Agent — Master Instructions & Contex.md` — §8.1, §7.2, §3.2.

If the asset's frontmatter is missing `product`, `audience`, `stage`, `sources`, or
`date`, that is an automatic finding before any content check runs.

## The five checks — run all, in order, even after the first failure

### Check A — Anti-generic (§8.1)
1. **Brand test**: could this belong to another brand? If any paragraph reads true for a generic enterprise vendor, fail it.
2. **Company-name swap test**: replace "Aurigo" (and product names) with "Oracle" and again with "Kahua". Any sentence that still reads as true fails — the claim is not specific enough. Quote each failing sentence.
3. **Customer-language test**: does the asset use raw buyer language from `our-customer.md`? Buyer-facing assets with zero verbatim customer vocabulary fail.
4. **Competitor-parity test**: flag every claim a competitor could equally make ("customer-obsessed", "end-to-end platform", "trusted partner").

### Check B — The six Voice of Aurigo pre-publish tests
1. **Reader test** — does the first line open from the reader's world (their decision, constraint, risk), not from Aurigo or the product? The cardinal rule.
2. **Specificity test** — every claim backed by a number, named product, named audience, or concrete outcome. "Better outcomes" and "greater efficiency" fail.
3. **Banned phrase test** — scan against `forbidden-words.txt` plus the additions in the standards reference (filler closers, "know more", British/Indian spellings). Quote each hit.
4. **Active voice test** — find passive constructions and buried leads; flip them.
5. **AI visibility test (AEO)** — could an LLM pull a clean, standalone, citable summary? Key facts named and structured, product names in full, questions answered directly in the first 50 words where the format calls for it.
6. **Swap test** — as in Check A.2; it is deliberately double-counted because it is the single strongest filter.

### Check C — Terminology rules
- **"life cycle"** — two words, always. "lifecycle" is a violation.
- **Program vs. portfolio by sector** — government agencies (Masterworks/Essentials content) run *programs*; facility owners (Primus content) run *portfolios*. Flag "portfolio" in public-sector copy and "program" in commercial copy.
- **AI modifiers** — "AI-native" only. AI-powered / AI-driven / AI-enabled / AI-based fail in body copy (SEO meta fields are the sole exception). "Masterworks AI, powered by Lumina" is the only approved powered-by construction; any other "powered by" fails. Agents named specifically (Prediction Agent, Execution Agent), never "Agent" generically.
- **No ROI in public-sector copy** — use "program outcomes" or "capital program performance".
- **No "the" before org abbreviations** — "FHWA requires…", never "the FHWA requires…".
- Also: "infrastructure" never pluralized; "infrastructure owners" is retired (use capital/public/facility owners); "government agencies" not the vague alternative; "in the field" / "in the cloud"; "unified system" not the banned truth-source cliché; "paper-based audit trail"; em dashes max 1–2 per page; binary contrast framing ("This is not X. It is Y.") max once per piece.

### Check D — Dependency chain (§3.2)
Trace the asset's lineage: copy must derive from approved messaging; messaging from
approved positioning. Verify via frontmatter `sources` and the stage of each upstream
file. An asset whose upstream is missing or still `draft` fails with the finding
"promotion blocked: upstream <file> is <missing/draft>" — route to the `positioning` or
`messaging-framework` skill. Also verify claims in the asset don't exceed the approved
positioning (new claims need a positioning review, not a copy edit).

### Check E — Narrative arc conformance (buyer-facing narratives only)
For decks, one-pagers, launch stories, and deal narratives: map the content to the 7-step
arc (§7.2). Fail on: missing steps, problem→solution jumps that skip the tension, an
unquantified cost of inaction, step 5 done as comparison-table trash-talk, step 6 as a
feature dump, or proof separated from the claims it supports. Not applicable to internal
docs — mark "N/A" rather than skipping silently.

## Output format

Return the report in-chat (and, if the user wants it kept, append to the asset under
`## QA Report 2026-08-06` — never overwrite content):

```markdown
# Asset QA — <file> — 2026-08-06
Verdict: PASS / FAIL (N of 5 checks passed)

## A. Anti-generic — PASS/FAIL
- [FAIL] line 12: "Aurigo delivers end-to-end visibility" — survives the swap test.
  Rewrite: "Masterworks connects the change order to the capital plan it draws from,
  so NDOT sees program impact the day the order lands."

## B. Voice tests — PASS/FAIL (6 sub-results)
## C. Terminology — PASS/FAIL
## D. Dependency chain — PASS/FAIL
## E. Narrative arc — PASS/FAIL/N-A

## Required before promotion
1. <ordered fix list>
```

Every FAIL carries the exact offending line (quoted, with location) and a concrete
rewrite that passes. A finding without a rewrite is unfinished work.

## After the report

- **All checks pass** → state that the asset is eligible for promotion, pending PMM approval (§8.4). The gate qualifies; the human promotes.
- **Any check fails** → the asset stays `draft`. Offer to apply the rewrites; re-run the full gate after edits — fixes can introduce new violations.
- If the review surfaced reusable intelligence (a new objection, better buyer phrasing), end with proposed war-room updates (§8.5).
