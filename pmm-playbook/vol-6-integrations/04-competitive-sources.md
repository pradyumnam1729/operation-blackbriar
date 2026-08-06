# Chapter 4 — Competitive Sources

**Volume 6 · PMM Agent Playbook · 2026-08-06**

---

## What This Source Is For

The competitive-intel agent (A3, Master Instructions §12) exists to keep battlecards alive and positioning honest. Its raw material is public: what competitors publish, what their customers say, and what their hiring reveals. This chapter defines which sources we monitor, what each one is evidence of, and the cadence.

Everything lands in `GTM-War-Room/MARKET-INTELLIGENCE/competitive/`, organized as one dossier per competitor plus a weekly sweep note. The dossier is the durable artifact; the sweep note is the changelog that keeps it current. Battlecards in `GTM-War-Room/PLAYBOOKS-AND-ASSETS/battlecards/` are generated from dossiers, never directly from raw sources — the dossier is the validated middle layer that keeps sales-facing claims traceable.

For Aurigo, the standing competitor set covers the capital program management space (Oracle Primavera Unifier, Kahua, e-Builder/Trimble, Procore for owner-side deals) plus whoever the CRM competitive field and call transcripts surface on live deals. The set is reviewed quarterly; dead cards come out per the continuous battlecard loop in §12 B8.

## Source Types and What Each Proves

| Source | What it is evidence of | What to extract |
|--------|------------------------|-----------------|
| **Pricing pages** | Packaging strategy, target segment, how they frame value | Tiers, pricing model (per user / per program / enterprise), what is gated behind which tier, changes since last capture |
| **Release notes / changelogs** | Actual product direction (not the roadmap they market) | Shipped capabilities, cadence, which of our differentiators they are closing on, AI claims and what specifically backs them |
| **G2 / review sites** | Their customers' words: what delights and what hurts | Verbatim complaints (these become our landmine questions), verbatim praise (these are their real strengths — respect them in the battlecard), reviewer segment and role |
| **Job postings** | Strategy 6–12 months out | New verticals (a Kahua posting for a public-sector AE in a new state), new capabilities (ML engineer postings before an AI launch), scale signals |
| **Analyst reports** | How the category is being framed for buyers | Category definitions, inclusion criteria, our placement vs. theirs, the evaluation criteria buyers will copy into RFPs |
| **Their marketing site & webinars** | The story they tell | Positioning claims, named customers, proof points, the objections their messaging is pre-answering (which reveals what they lose deals on) |

The G2 rule deserves emphasis: review verbatims are the competitive equivalent of `our-customer.md` — raw language, not summaries. "Support takes days to respond" from a verified reviewer is a usable landmine question. "They have weak support" as our paraphrase is trash-talk, and the battlecard standard (7.2 anti-pattern: no trash-talk) forbids it.

## Cadence

Per Master Instructions §11, competitive intelligence runs **weekly plus event-triggered**:

- **Weekly sweep (standing, batch).** Check monitored sources for each active competitor, diff against the dossier, write the sweep note. Most weeks the note is short; that is a feature. The sweep brief lives at `pmm-playbook/vol-10-prompts/03-weekly-competitive-sweep.md`.
- **Event triggers (immediate).** A pricing change, a major release, an acquisition, an analyst report publication, or a competitive mention spike in call transcripts triggers an out-of-cycle dossier update and a proposed battlecard refresh. At GA, URL monitors fire these automatically; at MVP, the trigger is a human noticing.
- **Quarterly deep refresh.** Full dossier review per competitor: retire stale claims, re-verify every fact sales might repeat, prune the competitor set.

## The Dossier Structure

Each `MARKET-INTELLIGENCE/competitive/<competitor>.md` dossier carries:

1. **Snapshot** — who they are, segment focus, pricing model, last-verified date per section.
2. **Where they win / where we win** — validated against win-loss data from `MARKET-INTELLIGENCE/win-loss/`, not just our own assessment.
3. **Claims register** — every claim they make that touches our positioning, with our response and the proof behind it.
4. **Signal log** — dated entries from sweeps and triggers, newest first.
5. **Sources** — the monitored URLs and the date each was last captured.

## Rules

1. **Public sources only, honestly obtained.** Published pages, public reviews, public filings, analyst material we license. Nothing else.
2. **Date every fact.** A competitor fact without a capture date is unusable; pricing and packaging claims older than one quarter are flagged stale automatically.
3. **Respect their strengths.** A dossier that shows the competitor losing everywhere fails the credibility test and gets our reps ambushed. Where they genuinely win is the most valuable section.
4. **No claim reaches a battlecard without a dossier citation.** The chain is source → dossier → battlecard, and each hop is dated.
5. **Route, don't hoard.** Sweep findings with positioning implications go to the product-to-market agent; findings that explain lost deals go to win-loss; everything follows §3.3 business translation before routing.
