# Chapter 6 — Product Truth

**Volume 6 · PMM Agent Playbook · 2026-08-06**

---

## The Problem This Solves

Every marketing claim ultimately rests on a factual claim about what the product does. When those facts live in tribal knowledge, marketing drifts from reality in both directions: assets under-claim capabilities that shipped quarters ago, and over-claim capabilities that were cut in planning. Both are expensive — the first loses deals, the second loses trust and, in public-sector procurement, can sink a bid on a compliance answer.

The PMM Agent solves this by designating a single feature-truth source and refusing to let product claims originate anywhere else.

## The Feature-Truth Source

For Aurigo, product truth lives in the engineering playbook:

- **`engineering-playbook/vol-2-product-knowledge/`** — the canonical corpus: domain entities, feature modules, personas and jobs to be done, and acceptance vocabulary for the product lines. When a PMM agent needs to know what the product actually does, this is where it reads.
- **`engineering-playbook/vol-1-company/`** — company and portfolio context: what Aurigo builds, the Plan-Build-Maintain arc, how the products relate (Masterworks, Essentials, Primus, and Lumina as the foundational engine per `Voice of Aurigo - Standards Reference.md`).
- **`engineering-playbook/vol-6-integration-strategy/`** — the integration model (Integrated/Hybrid/Native), which is itself a positioning-relevant fact: "sits above your existing EAM, does not replace it" is a differentiation claim that must stay synchronized with what engineering actually supports.

The war room carries a digest of this corpus in `GTM-War-Room/product-wiki.md` — feature descriptions, roadmap, recent releases, written in market language. The digest exists because most PMM tasks need the summary, not the corpus. But the direction of authority is fixed: **the engineering playbook is upstream; `product-wiki.md` is a derived view.** When they disagree, the engineering playbook wins and the wiki gets a correction, never the reverse.

## The Claim Chain

The dependency order for any product statement in a customer-facing asset:

```
engineering-playbook/vol-2-product-knowledge/   (what is true)
        ↓
GTM-War-Room/product-wiki.md                    (what is true, in market language)
        ↓
messaging library / battlecards / assets        (what we say, per audience)
```

An asset generator citing `product-wiki.md` in its frontmatter `sources` is making a checkable claim. An asset asserting a capability found in neither the wiki nor the corpus fails review — that is the definition of an unsupported claim under the content-governance agent's audit (C12, Master Instructions §12).

Voice rules apply at the translation step: the corpus may say "lifecycle" internally, but market language follows `Voice of Aurigo - Standards Reference.md` — "life cycle" as two words, "AI-native" as the only AI modifier, Lumina framed as the foundational engine and never a standalone product.

## The Product-Update Trigger

The product-to-market agent (B6, Master Instructions §12) is on-demand, "triggered by product update." This chapter defines that trigger concretely:

**A product update is a meaningful change to `engineering-playbook/vol-2-product-knowledge/` or a release-notes publication for any product line.**

When the trigger fires, the product-to-market agent runs its standing sequence:

1. **Diff the truth.** What capability changed, was added, or was retired? Cite the changed file and section.
2. **Gate check.** Per §3.1, confirm the intelligence inputs exist to translate this into buyer terms — which persona feels this, which validated pain does it answer. If they do not exist, the run stops and says what is missing.
3. **Translate.** Buyer problem → business value → differentiation → messaging, through the positioning → messaging → copy chain (§3.2), producing value propositions in the §7.4 schema.
4. **Propose downstream updates.** Which assets does this change touch? A retired capability triggers proposed edits to every asset that claims it (the content-governance agent supplies the list). A significant new capability may warrant a launch recommendation, routed to the launch-orchestration agent.
5. **Update the wiki.** Propose the `product-wiki.md` delta for PMM admin approval.

At MVP the trigger is manual: a human notices the corpus changed and briefs the agent. At beta, a repo watch on `engineering-playbook/vol-2-product-knowledge/` files the trigger automatically (see `pmm-playbook/vol-8-roadmap/02-beta.md`).

## Retirement Is Also News

The under-appreciated half of this pipeline: capabilities that are deprecated or repositioned. A battlecard claiming a capability the product no longer emphasizes is worse than a missing battlecard. The trigger fires on removals with the same priority as additions, and the content-governance sweep (monthly, §11) cross-checks every asset's product claims against the wiki as a standing backstop.

## Rules

1. One feature-truth source: `engineering-playbook/vol-2-product-knowledge/`. `product-wiki.md` is derived; assets cite one of these two, always.
2. No product claim in a customer-facing asset without a traceable source in the chain above.
3. Corpus changes trigger the product-to-market agent; the agent proposes, the PMM admin approves (§8.4, §8.5).
4. Market translation obeys the voice standards; engineering vocabulary never leaks into customer-facing copy unverified.
