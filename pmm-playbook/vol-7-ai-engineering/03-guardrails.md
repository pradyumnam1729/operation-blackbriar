# Chapter 3 — Guardrails

**Volume 7 · PMM Agent Playbook · 2026-08-06**

---

## The Principle: Never Model Judgment Alone

A language model asked to "follow the brand voice" will follow it most of the time. Most of the time is not a brand standard. The CEO-confirmed rules in `Voice of Aurigo - Standards Reference.md` — "AI-native" as the only approved modifier, "life cycle" as two words, no ROI in public-sector copy — are binary rules, and binary rules deserve binary enforcement.

So the PMM Agent layers three guardrail types, ordered from cheapest and most deterministic to most expensive and most judgment-laden. Each layer catches what the previous one cannot, and no layer is skipped because an earlier one "probably caught it."

```
Layer 1: Deterministic hooks        (pattern matching — catches rule violations)
Layer 2: Skill-level gates          (model-assisted review — catches quality failures)
Layer 3: Human approval             (judgment — catches everything else, owns the ship decision)
```

## Layer 1 — Deterministic Hooks

Hooks (in `.claude/hooks/`, specified in Master Instructions §5) fire on events, regardless of what any model decides. They are code, not prompts.

**The forbidden-words guard (PostToolUse).** Every write or edit to a messaging document is scanned against the banned list compiled from `Voice of Aurigo - Standards Reference.md` and `GTM-War-Room/BRAND-DNA/gtm-rules.md`. The list includes hard bans ("seamless", "hassle-free", "effortlessly", "circle back", filler closers), mechanical rules ("lifecycle" → "life cycle", "infrastructures" → never), retired terminology, and context-conditional bans (ROI flagged in any file tagged public-sector; "portfolio" flagged in Masterworks/Essentials content; "AI-powered" and its siblings flagged in body copy). A hit blocks or flags the write with the violated rule named.

**The SessionStart injection** (see `02-context-engineering.md`) is also a guardrail: it makes "the agent didn't know the rule" impossible, since the rules are in context before any task.

What hooks are good at: rules expressible as patterns, applied uniformly at zero marginal judgment cost, with no bad days. What they cannot catch: a perfectly voiced, banned-word-free paragraph that is generic, unsupported, or positioned like a competitor. That is Layer 2's job.

## Layer 2 — Skill-Level Gates

The `asset-qa` skill (in `.claude/skills/`, invoked as `/asset-qa`) is the mandatory quality gate before any output is proposed for promotion. It runs the checks that require reading comprehension, encoded as an explicit checklist so the review is consistent:

1. **Swap test** (§8.1 / Voice standards test 6): replace "Aurigo" with "Oracle", "Microsoft", or "Kahua". Any sentence that still works is flagged for rewrite.
2. **Anti-generic mandate** (§8.1): could this output belong to another brand? Does it make a claim a competitor could equally make?
3. **Customer-language check**: does the asset use verbatim buyer language traceable to `GTM-War-Room/BRAND-DNA/our-customer.md`?
4. **Claim-chain check**: does every product claim trace to `GTM-War-Room/product-wiki.md` or `engineering-playbook/vol-2-product-knowledge/` (per `pmm-playbook/vol-6-integrations/06-product-truth.md`)? Does every competitive claim trace to a dossier?
5. **Chain-of-custody check** (§3.2): did this copy come through messaging, or did it jump straight from positioning?
6. **Voice five-tests** (from `Voice of Aurigo - Standards Reference.md`): reader-first opening, specificity, active voice, AEO structure (see `05-aeo-standard.md`), em-dash and contrast-framing limits.
7. **Frontmatter completeness**: product, audience, persona, stage, sources, date — all present.

The gate's output is a pass, or a named list of failures with locations. An asset that fails does not proceed to Layer 3; it goes back for revision. Skill gates use model judgment, but constrained judgment: a fixed checklist, applied fresh, by a reviewing pass that is not invested in the draft it is reviewing.

## Layer 3 — Human Approval

Master Instructions §8.4, restated in `CLAUDE.md` as non-negotiable rule 3: all outputs are written as drafts, and nothing moves to final or ships without PMM admin approval. The system proposes; the human decides.

This layer is not a rubber stamp on the first two. The human owns exactly the judgments no automated layer can: Is this claim strategically wise, not just supportable? Is now the time? Does this promise something sales cannot deliver? Is this the story we want to lead with against this competitor? The export pipeline enforces the gate mechanically — draft-stage assets render with a DRAFT watermark and are never cited as outbound-usable by the query flow (see `pmm-playbook/vol-6-integrations/05-content-surfaces.md`). Approval is a recorded event: who approved, when, which version.

The same logic governs context updates: agents propose changes to war-room files (§8.5); only the PMM admin applies them. Brand DNA is written by humans, informed by agents — never the reverse.

## Why the Ordering Matters

Each layer is also a cost filter for the next. Hooks are effectively free and run on everything. The asset-qa gate costs a model pass and runs on every asset that intends to ship. Human attention is the scarcest resource in the system and is spent only on assets that already passed both machine layers — so the human reviews for strategy, not for typos and banned words. A system that routes forbidden-word catching to the human wastes its best reviewer on its most automatable check.

## Rules

1. No banned-word compliance by model promise. The hook checks, every write.
2. No promotion proposal without an `asset-qa` pass recorded.
3. No customer-facing ship without human approval flipping `stage: draft` to `stage: final`.
4. Guardrail bypasses do not exist. A "quick one-off asset" that skips the gates is how inconsistency re-enters the system the value props claim to have eliminated.
