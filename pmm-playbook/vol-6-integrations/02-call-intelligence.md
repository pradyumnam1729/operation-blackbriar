# Chapter 2 — Call Intelligence

**Volume 6 · PMM Agent Playbook · 2026-08-06**

---

## What This Source Is For

Sales and customer calls are the richest source of raw buyer language the system has access to. The Master Instructions are emphatic that `our-customer.md` contains "raw customer language, not summaries" (§4.1) and that it is "the source of all non-generic copy." That raw language does not come from a workshop. It comes from transcripts: how a state DOT program director actually describes their audit problem, the exact phrasing of the objection that stalled a Masterworks deal, the words a facility owner used when comparing Primus to a spreadsheet.

Call intelligence feeds the voice-of-market agent (A1 in Master Instructions §12), which runs weekly as a batch job and writes to `GTM-War-Room/MARKET-INTELLIGENCE/voice-of-market/`.

## Supported Platforms

| Platform | MVP path | GA path |
|----------|----------|---------|
| Gong | Manual transcript export → file-drop | API pull on weekly schedule |
| Chorus | Manual transcript export → file-drop | API pull on weekly schedule |
| Fathom | Shared transcript link → paste/drop | API pull on weekly schedule |
| Granola | Meeting notes export → file-drop | Workspace sync |

The pipeline is platform-agnostic past ingestion. A transcript is a transcript: speaker-attributed turns with a date, an account, and a deal context. Normalization strips platform formatting and lands a clean file in the intake area with frontmatter identifying account, opportunity (if known), call type (discovery, demo, negotiation, QBR), date, and participants by role, not name, when the file will feed customer-facing work.

## What Gets Extracted

The weekly voice-of-market run processes new transcripts and extracts five signal types. Each has a defined destination:

| Signal | What it looks like in a transcript | Destination |
|--------|-----------------------------------|-------------|
| **Objections** | "We already have e-Builder", "Procurement won't approve another system this year", "Who else at a DOT our size uses this?" | Objection library in `voice-of-market/`; proposed additions to relevant battlecards |
| **Buyer language** | The customer's own vocabulary for their problem: "we can't defend our capital plan to the legislature", "our inspectors are drowning in paper" | Proposed additions to `GTM-War-Room/BRAND-DNA/our-customer.md` |
| **Trends** | The same theme surfacing across three or more unrelated calls in a period | Trend note in `voice-of-market/`, flagged for the §3.4 strategic opportunity funnel |
| **Competitive mentions** | Named competitors, how the buyer characterizes them, feature comparisons the buyer volunteers | Routed to `MARKET-INTELLIGENCE/competitive/` for the competitive-intel agent |
| **Trust signals & decision drivers** | What made the buyer lean in: a named reference, a compliance capability, a proof point that landed | `voice-of-market/`; routed to win-loss when the deal closes |

Extraction is a cheap-model task (see `pmm-playbook/vol-7-ai-engineering/06-cost-and-model-strategy.md`): high volume, well-defined schema, low judgment. Synthesis — deciding that three objections are actually one trend with a roadmap implication — is where the frontier model and the human come back in.

## The Pipeline, End to End

1. **Ingest.** Transcript lands in the intake folder (MVP: human drop; GA: scheduled pull).
2. **Normalize.** Strip platform artifacts, attribute speakers, attach frontmatter (account, call type, date, product line).
3. **Extract.** Cheap-model pass pulls the five signal types into structured notes, each quoting the transcript verbatim. Paraphrase at this stage destroys the asset; the whole point is verbatim buyer language.
4. **Synthesize.** Weekly batch: cluster the week's signals, detect recurrences, write the voice-of-market weekly note to `MARKET-INTELLIGENCE/voice-of-market/` with a roadmap-implication section (mandated by Master Instructions §14).
5. **Propose.** Per §8.5, the run ends with proposed (not applied) updates: new objections for the objection library, new verbatim language for `our-customer.md`, competitive mentions handed to the competitive-intel agent. The PMM admin approves before anything changes brand-DNA files.

## Quality Rules

- **Verbatim or nothing.** Extracted buyer language is quoted, with call date and context. A summarized objection is an opinion; a quoted one is evidence.
- **Public vs. commercial tagging.** Every extracted signal is tagged by segment (public owners vs. facility owners) so downstream messaging never crosses the program/portfolio terminology line in `Voice of Aurigo - Standards Reference.md`.
- **Three-call threshold for trends.** One call is an anecdote. A pattern claim requires at least three unrelated calls, cited by date, before it enters a war-room file as a trend.
- **Privacy.** Customer names and personal details are kept in intake files only; war-room signal files reference accounts by segment and role unless the account has approved reference use (tracked by the customer-evidence agent).
- **Business translation before routing.** Per §3.3, no signal ships as a raw observation. Each synthesized insight terminates in insight → action → named metric → owning stakeholder.

## Failure Modes to Watch

- An empty week is reported as an empty week, not padded with re-synthesis of old calls.
- If transcripts stop arriving (export lapsed, connector broken), the weekly note leads with the staleness warning rather than quietly shrinking.
- Extraction that returns only generic objections ("too expensive", "no budget") usually means the call-type mix is wrong — demo calls, not discovery calls, carry the specific language. Flag it; do not compensate by inventing specificity.
