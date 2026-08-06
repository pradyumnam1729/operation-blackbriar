# 10 — Ask-War-Room Examples

## When to Use

- Reference queries for the ask-war-room flow (the `/ask-war-room` skill; the web app's query engine): what each persona actually asks, and what a role-ready answer looks like.
- Demo preparation (`pmm-playbook/vol-8-roadmap/01-hackathon-mvp.md` Beat 3) and query-flow testing — these examples double as an acceptance suite: if the seeded war room cannot answer them well, the seeding has gaps.

## How Answers Are Framed

Every answer follows the same contract regardless of persona (per `pmm-playbook/vol-6-integrations/05-content-surfaces.md`): the answer first, up to three supporting points, then source citations as war-room paths. Only `stage: final` assets are cited as outbound-usable; if only a draft exists, the answer says so. The *framing* shifts per the Master Instructions §9.2 output frames — the same underlying fact renders differently per role, which is the consistency guarantee in action: one source of facts, many framings, zero contradictions.

## Example Queries by Persona

### Sales — frame: talk tracks, objection handling, battlecards, deal-specific proof

- "What do I say when a DOT prospect tells me they already have e-Builder?"
  *Good answer: the objection one-liner from the battlecard, the reframe, one proof point — spoken language, ready to say on the call. Cites the battlecard and the objection library.*
- "Give me three discovery questions for a county capital program director evaluating us for the first time."
- "What proof do we have for [PRODUCT] in state DOTs over $1B program size — and which references are approved to name?"
- "I'm in a bake-off against Kahua at stage 3. What landmines should I plant?"

### Proposals — frame: compliant answers, differentiation framing, proof assets

- "Does Masterworks support federal-aid fund tracking? Give me RFP-ready language."
  *Good answer: the compliant answer first (direct yes/no/partial, product named in full, traceable to `product-wiki.md`), then the differentiation paragraph, then proof assets with reference status.*
- "What's our standard answer on data residency and security certifications, and when was it last verified?"
- "Which win themes are working in public-sector RFPs this year?"

### Marketing — frame: messaging hierarchy, channel copy inputs, campaign brief

- "What's the approved key takeaway for facility owners, and how does the tone shift between the product page and nurture email?"
  *Good answer: the takeaway from the messaging framework, the tone-per-channel rows that apply, and the terminology guard (portfolio, not program, for this audience). Cites the messaging framework.*
- "Which buyer questions should the [LAUNCH] web content answer, per the AEO plan?"
- "What verbatim customer language do we have about audit readiness?"

### Leadership — frame: metric impact, strategic summaries, KPI maps

- "What's our competitive position against Kahua this quarter, in one paragraph?"
  *Good answer: metric-first — win rate vs. them with period and counts, the one driver, the one action in flight with its owner. Cites the win-loss note and the dossier. No feature talk.*
- "Which launches this year moved pipeline, and what's the asset usage rate trend?"
- "If we enter [VERTICAL] next year, what does the war room say we'd need first?"

### Customer Success — frame: adoption messaging, expansion talk tracks, churn-risk signals

- "A customer's new program director is skeptical of the renewal. What's the adoption story and the expansion talk track for their segment?"

### SDR/BDR — frame: persona-specific openers, pain-first copy, objection one-liners

- "Give me a first-touch opener for a city public-works director — their world, not our product, per the cardinal rule."

## The Refusal Cases (equally load-bearing)

The flow must refuse well, not just answer well. Test these:

- **No source:** "What's our pricing against [COMPETITOR]?" when no dossier covers pricing → the answer says the war room cannot support this, names the missing file, and proposes the pipeline that would populate it (`pmm-playbook/vol-6-integrations/04-competitive-sources.md`). It does not improvise a comparison.
- **Draft-only:** the requested asset exists but at `stage: draft` → the answer says so and routes to the approval queue rather than quoting draft language as shippable.
- **Stale source:** the only supporting file predates a positioning change → the answer flags it, per the staleness rules.

Guessing is a failure mode (`CLAUDE.md`); a confident wrong answer to a rep walking into a call is the worst output this system can produce.

## Follow-Ups

- Any query the war room cannot answer is a seeding gap: route to `01-seed-war-room.md` follow-up flow or the owning intelligence pipeline.
- Recurring queries are asset demand: per §3.5, a question asked weekly becomes a standing asset, not a repeated answer.
- New good queries discovered in use belong in this file — add them under the right persona with a `### Variant:` note if the framing differs.
