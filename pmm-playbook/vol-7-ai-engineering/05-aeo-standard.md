# Chapter 5 — The AEO Standard

**Volume 7 · PMM Agent Playbook · 2026-08-06**

---

## Why AEO Is a First-Class Standard

Master Instructions §8.3 makes the mandate explicit:

> "All content and asset outputs must be optimized not just for human readers and SEO, but for LLM/AI-search retrieval (AEO — Answer Engine Optimization). When buyers ask AI for answers, we must be the one they find."

The buying behavior behind the mandate: a growing share of capital-program software evaluations now starts with a question typed into an AI assistant — "what software do state DOTs use to manage capital programs?", "alternatives to e-Builder for a city capital program". The answer engines composing those responses retrieve, extract, and cite content. Content structured for extraction gets cited; content structured only for human skimming gets paraphrased away or skipped. AEO is the discipline of writing so that the machine reading on the buyer's behalf can find, lift, and attribute our answer.

The §15 quality table already scores "AEO readiness" on every output; this chapter defines what passes. The voice standards' AI-visibility test — "Could an LLM pull a clean, accurate, standalone summary from this page?" — is the one-line version of everything below.

## The Three Core Techniques

### 1. Natural-Language Questions as Headings

Answer engines match questions to questions. A heading phrased the way a buyer actually asks — "How does Masterworks handle federal-aid fund tracking?" — is a retrieval target; a heading phrased as a label — "Fund Management Capabilities" — is not. Rules:

- FAQ-bearing content (product pages, launch FAQs, RFP answer libraries) uses complete natural-language questions as headings, in the buyer's vocabulary from `GTM-War-Room/BRAND-DNA/our-customer.md`, not our internal feature names.
- One question per heading; the answer directly beneath it, not three paragraphs later.
- Question phrasing matches how each persona asks (voice standards: "Natural language questions, AI-visible structure, product name in full").

### 2. Standalone Extractable Answers

An answer engine lifts a passage out of its page. A passage that depends on the two paragraphs above it ("As mentioned above, this approach…") extracts as nonsense and gets skipped. Every answer block must survive extraction alone:

- **First sentence answers the question completely.** The direct answer in the first 50 words (the voice standards' SEO-blog rule, generalized to everything). Elaboration follows; it never precedes.
- **No orphan references.** No "as discussed above", no bare "it" whose antecedent lives in a prior section, no "the platform" where a product name belongs.
- **Full product names on first use per section.** "Aurigo Masterworks", not "the product" — because the section, not the page, is the unit of extraction, and an uncited product name is an uncitable claim.
- **Self-contained length.** Roughly 40–120 words per answer block: long enough to be complete, short enough to be quoted whole.

### 3. Named Facts

Engines cite what they can attribute. Vague claims ("significantly faster", "many agencies") are unciteable; named facts — a number, a named product, a named segment, a named outcome — are what retrieval systems prefer and what composed answers keep:

- Every claim carries its specifics: which product, which audience segment, which measured outcome. This is the voice standards' specificity test doing double duty.
- Stable facts get stable phrasing. The same fact worded identically across our content corpus reinforces retrieval confidence; five paraphrases of the same claim compete with each other. The messaging library is the canonical phrasing source — another consistency argument.
- Structure carries facts well: tables for comparisons, lists for enumerable capabilities, prose for narrative. Engines parse all three, but a fact buried mid-paragraph in a 200-word block is the likeliest to be lost.

## Where AEO Applies, and How Hard

| Output class | AEO weight | Notes |
|--------------|-----------|-------|
| Web-bound content (product pages, FAQs, blog) | Full standard | This is the primary AEO surface |
| Launch content and case studies | Full standard | Launch briefs carry an AEO plan alongside the channel plan (Master Instructions §12 B7) |
| RFP answer library | Full standard | Same properties make answers reusable by the proposals team and extractable by evaluators' AI tools |
| Battlecards, internal enablement | Structure only | Not public; but extractable structure serves the ask-war-room retrieval flow identically |
| War-room intelligence files | Structure only | The consumer is our own agents — the same techniques make internal retrieval precise |

That last row is the quiet payoff: AEO discipline and context engineering (see `02-context-engineering.md`) converge. Content written so an external answer engine can extract it is also content our own query flow answers from cleanly. One writing standard serves both.

## The AEO Checklist (run inside asset-qa)

1. Are headings for answer-bearing sections phrased as natural-language buyer questions?
2. Does each section's first sentence answer its heading completely, standalone?
3. Would any block, extracted alone, be accurate and attributable (product named, claim specific)?
4. Are comparisons and capability lists structured (tables/lists), not buried in prose?
5. Do stable facts use the canonical phrasing from the messaging library?
6. Zero orphan references anywhere.

Voice rules are unaffected: AEO never licenses keyword stuffing, banned words, or product-first openings. A page can open from the reader's world (the cardinal rule) and still answer its questions crisply two headings later — the two standards are compatible, and both are mandatory.
