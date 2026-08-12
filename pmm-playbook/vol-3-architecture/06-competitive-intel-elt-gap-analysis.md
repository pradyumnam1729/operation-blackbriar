---
product: PMM Agent (Hive) — Competitive Intel module
audience: internal — ELT, PMM admin, build team
persona: n/a
stage: draft
sources:
  - app/backend/src/services/competitive.ts
  - app/backend/src/routes/competitive.ts
  - app/backend/src/services/jina.ts
  - app/backend/src/services/agentPrompts.ts
  - app/frontend/src/pages/CompetitiveIntel.tsx
  - GTM-War-Room/competitors.md
  - GTM-War-Room/MARKET-INTELLIGENCE/ (competitive, win-loss)
  - engineering-playbook/vol-1-company/06-competitive-landscape.md
  - Committee reports: competitive-intel (A3), win-loss (A4), pricing-packaging (B10), sales-enablement (B8), gtm-performance (C13), app-architect, ui-engineer
date: 2026-08-11
---

# Competitive Intel → ELT-Grade: Full-Committee Gap Analysis

Seven-agent committee review (5 PMM sub-agents + 2 build agents) of the Competitive Intel
module, mandate: what is missing to make it extremely useful for ELT — exhaustive research,
user-initiated continuous background research, battlecard UI variants, and new analysis
frameworks. Every agent was grounded in the verified current state of the code.

## 1. Diagnosis (one paragraph)

The module today answers "what does the competitor say about themselves" (3 untyped scraped
URLs, refreshed only when a user clicks) and renders one framework (positioning map) and one
output (a prose-blob battlecard draft). Every question ELT actually asks — *what changed,
who is gaining, where are we losing and why, what did they pay* — is unanswerable, because
the module has **no change detection, no deal data, no source depth, no time dimension, and
no leadership surface**. The encouraging half of the diagnosis: several of the highest-value
fixes are nearly free because the data already exists unexploited (see §2), and the missing
intelligence inputs largely exist in the repo awaiting import (n=41 win/loss baseline,
six-reason loss taxonomy, escalation triggers in `competitors.md`).

## 2. Convergent findings (found independently by multiple agents)

1. **`content_hash` is computed on every scrape and never compared** (competitive.ts:134).
   Change detection — the #1 ELT feature — is one diff + one classifier call away.
   (Found by 5 of 7 agents.)
2. **Positioning-map history is already stored in the DB; only the latest is exposed.**
   QoQ movement, ghost trails, and a time scrubber are `ORDER BY created_at` away. (3 agents.)
3. **Public procurement records are the unfair-advantage source.** Aurigo's buyers procure in
   public: state DOT awards, GSA/NASPO price schedules, bid tabulations, council packets
   contain *transacted* competitor prices and deal sizes. No horizontal CI tool (Crayon/Klue/
   Kompyte) covers this vertical niche. (competitive-intel + pricing-packaging, independently.)
4. **The battlecard must become a structured JSON schema with a format family**, not a prose
   blob — one shared evidence bundle rendered into multiple variants so they can never
   contradict each other. (sales-enablement + ui-engineer, converging on near-identical specs.)
5. **Hard gates are missing:** the module will happily generate objection handling with zero
   win/loss input — the routing-rule violation (activation without validated intelligence).
   Gates must be schema-level locks rendered as visible placeholders, never prompt-level
   suggestions the model can drift past.
6. **The win/loss leg is empty but importable:** `opportunities` is a mock Salesforce mirror;
   zero deal objects join to the registry. But `engineering-playbook/vol-1-company/06`
   holds an n=41 loss baseline with six coded reasons (vendor-risk 33%, Cityworks/Esri
   incumbency 24%, vertical-lighthouse gap 19%, "wait for AI" 12%, implementation fear 8%,
   price 4%) — ingestion, not invention.
7. **"Status quo / no-decision" must be a first-class outcome** — most deals are lost to
   inertia, not vendors; a named-vendor-only registry tells ELT the wrong story.
8. **Threat needs stratification + parent rollup:** flat registry ≠ threat model. Tiers
   (Existential/Direct/Adjacent/Watch/Integrate-don't-compete) with written escalation
   triggers (already in competitors.md prose: "Trimble AgileAssets + Cityworks + Construction
   bundle → existential") and a `parent_company` rollup so Trimble reads as one threat, not three.
9. **Evidence-class labeling everywhere:** [CRM] / [WEB + scrape date] / [ANALYST] /
   confirmed / estimated / anecdotal. A claim without provenance does not render in an ELT view.
   "Not confirmed in available sources" becomes a first-class enum/badge, never a blank cell.
10. **ELT channel must be capped and honest:** top 3–5 items per digest, materiality
    thresholds, and "nothing material changed (verified DATE)" as an explicit trust-building
    output. An unfiltered firehose kills executive readership in weeks.

## 3. Unified backlog (rocks / pebbles / sand triage)

### Rocks — the ELT step-change
| # | Gap → Build | ELT question answered | Effort |
|---|---|---|---|
| R1 | No background research → **user-initiated Track + research-run engine + scheduler** (`competitor_watches`, `research_runs`, budget-capped Jina sweeps, boot recovery; reuses the SharePoint-polling pattern) | "Can I trust we'll know within a week — without anyone clicking Refresh?" | M |
| R2 | No change detection → **diff-on-rescrape + `competitor_events` delta feed** with model-classified severity and a noise gate (cosmetic re-renders emit nothing) | "What changed since the last board meeting?" | M |
| R3 | 3 untyped sources → **typed source model** (official/pricing/release_notes/reviews/news/jobs/procurement/analyst) with per-type cadence, enable/disable, reliability tags | "Are we watching the signals that matter, at the right rate?" | M |
| R4 | Prose-blob battlecard → **structured schema + format family** (§5), schema-level intelligence gates, staleness flags driven by the delta feed | "Is enablement current, and can I trust what sales says out loud?" | M/L |
| R5 | No leadership surface → **ELT dashboard + digest** (threat tiles, delta feed, map scrubber, weekly/monthly/quarterly digest with materiality thresholds, board-pack export) | "Give me the competitive state of the world in 90 seconds." | M/L |
| R6 | No deal data → **deal record joined to registry** (competitor, outcome incl. no-decision, coded reason stated-vs-probed, evidence tier) + n=41 baseline import → win-rate trend, loss Pareto, red-line monitor | "Where are we losing, why, and is it improving?" | M (S once schema lands) |

### Pebbles — high leverage, small builds
| # | Item | Note |
|---|---|---|
| P1 | Expose positioning-map history + movement endpoint + time scrubber UI | Data already stored; refuse cross-axis comparisons (422) |
| P2 | Threat-tier + `parent_company` fields + escalation-trigger matching | Rules already written in competitors.md prose |
| P3 | Evidence/reliability labeling in `EVIDENCE_RULES` + schema | Precondition for every ELT number |
| P4 | Route `buildPositioningMap` through the agents registry (`fw-positioning-map`) | Fixes admin-tunability/kill-switch bypass |
| P5 | Voice guardrail on competitive output (forbidden-words gate + auto "ROI"→"program outcomes" on public-sector cards) | Real leak risk: vol-1 source text contains "ROI" |
| P6 | Registry ↔ war-room dossier sync (`MARKET-INTELLIGENCE/competitive/<name>.md` as canonical, seeded from competitors.md) | Two disconnected brains today |
| P7 | Module health panel (coverage, freshness %, failures, per-role usage from existing `created_by`) | The trust layer |
| P8 | Red-line monitor: 3 consecutive same-vertical losses to one competitor → alert | Existing company policy, currently unwatched |
| P9 | Alert hook (`emitCompetitorAlert` + optional webhook) | Email/Slack V2 |
| P10 | Field-intel intake (sales note per competitor, provenance-tagged, never mixed with scraped facts) + proposed/watch triage on any-role adds | |

### Sand / deferred
Five Forces (needs a market-report evidence class — build when a real market-entry decision
is on the table) · share-of-voice (needs weeks of news collection first — chart on day 1
would be fabricated) · BCG matrix (cannot be honest without revenue-share data) · patents
(weak signal in this category) · SSE run progress, full source snapshots, CRM live sync
(external dependency — but add `created_date` + open stages to the mirror schema **now** so
day one of live sync yields cycle time and pipeline exposure).

## 4. Continuous background research — agreed design

- **User-initiated:** "Track this competitor" → drawer with source-type checklist →
  bootstrap run (day-1 deep sweep: typed sources, 12-mo release notes, careers snapshot,
  procurement search, press; baseline dossier written as draft) → recurring watch toggle
  with cadence.
- **Recurring watch cadences (per source type):** news 3d · release_notes/pricing 7d ·
  jobs/procurement 14d · official/reviews 30d · analyst 90d. Weekly floor per competitor.
- **Run engine:** single-flight in-process worker, idempotent enqueue (unique live-run
  index), phased progress (`discovering → scraping → analyzing → done`) polled by the UI,
  sequential Jina calls with spacing, per-run budgets + `JINA_DAILY_BUDGET` global cap,
  partial-on-budget-exhaustion is a valid `done`.
- **Delta triage:** ELT sees escalation-trigger hits, pricing/metric changes, procurement
  awards ≥ $1M or at named targets, M&A/leadership/AI-launch events at Direct+ tiers,
  win-rate moves >10 pts, tier changes. PMM keeps routine releases, copy tweaks,
  single reviews, sub-threshold noise.
- **Procurement watch (MVP):** USAspending + SAM.gov APIs + 5–10 pipeline-state portals +
  Legistar/Granicus keyword watch, manual-verify queue before anything reaches ELT.
  Full 50-state coverage is a buy-vs-build decision (GovWin et al.) for ELT.

## 5. Battlecard format family (one evidence bundle → seven renders)

| Format | Audience / moment | Gate |
|---|---|---|
| (a) Classic two-pager — canonical card, one per (competitor, product), updated in place with changelog | AE/SE deal prep; print/PDF per Brand Standards | §5 objections + §7 discovery locked on win/loss |
| (b) 30-second kill sheet (≤130 words, hard-capped at render) | AE live call | Derived from (a), no new gates |
| (c) Objection-flip cards (frequency-ordered, buyer verbatims, drill mode) | AE/SE mid-cycle, CS renewals | Fully gated on win/loss import |
| (d) Deal-stage cards: discovery / evaluation / procurement | AE by stage | Partially gated; procurement card carries the vendor-risk counter (33% loss share) |
| (e) Executive threat one-pager (tier, momentum, moves, counter, asks) | ELT monthly, board quarterly | Pipeline exposure shows "not tracked" until CRM |
| (f) RFP claims table (per-cell citations, confidence enum, ghosting guidance) | Proposals | **Ungated — ship first** |
| (g) Delta brief ("what changed since v3", diff-grounded, explicit no-change statements) | PMM refresh loop, ELT feed, seller change badges | **Ungated — ship first** |

Non-negotiables from the committee: schema-level gates with visible locked placeholders;
per-claim source dates (a card is as fresh as its stalest load-bearing claim); staleness
ladder (amber >30d, red/dead >2 cycles, excluded from kill-sheet generation); trust header
with verified-by stamp tied to draft→final approval; claim→proof→clearance pairing (unpaired
claims render as "proof needed — A5"); landmines derived from *source absences* phrased as
buyer questions (honest from scraping alone); no-trash-talk lint; regeneration always lands
as a draft version — `final` only changes through PMM admin re-approval.

## 6. Framework catalog (honesty-checked)

**Viable now:** feature/capability matrix (release notes + product pages; "not confirmed" as
first-class cell) · threat-tier board (rules-based, evidence-shown, admin-overridable with
recorded reason) · delta timeline (pure query over events — no model call, demo gold) ·
kill-sheet/battlecard split · parent-company rollup · packaging comparison matrix ·
loss-reason Pareto + win-rate trend + red-line monitor (once n=41 imports) · QoQ map movement
(canonical pinned-axis series rebuilt monthly; exploration maps stay separate).

**Viable with labeling discipline:** SWOT (S/W scraped-only, O/T labeled internal-inference)
· momentum score (labeled "market-activity momentum," never "business momentum"; components
report "no evidence," never zero) · price-positioning ladder (transacted-award anchors,
reliability-shaded bands).

**Deferred/refused:** Five Forces, share-of-voice (until collection runs), BCG, patents — see Sand.

## 7. UI restructure (five tabs, role-aware defaults)

**Overview** (ELT lands here: threat tiles, delta feed, map scrubber, digest bar) ·
**Compare** (existing hero, PMM default) · **Battlecards** (grid + format switcher, sales
lands here, final-only by default for sales) · **Research & sources** (registry, typed source
table, track drawer) · **Frameworks** (picker rail: map, SWOT, matrix, threat board, delta
timeline). Design ruling needed: app chrome keeps Hive tokens (rounded); exported PDFs
follow Brand Standards literally (sharp corners, Roboto Black/Bold, Dark Teal).

## 8. Phased build plan (app-architect, agreed by committee)

- **Phase 0 — hackathon slice:** "Track Kahua → system researches → deltas land."
  Migration 0019 (typed sources + watches + runs + events), run engine + scheduler +
  event summarizer agent, track/runs/events endpoints, Track button + run poller +
  Deltas tab. *QA: idempotent double-click; unchanged content emits zero events; budget
  exhaustion → done; disabled source never scraped.*
- **Phase 1 — ELT surface:** digests table + agent, map history/movement endpoints,
  events summary, elt-overview single-call endpoint, scrubber + digest UI.
- **Phase 2 — framework engine:** `framework_analyses`, shared evidence assembler,
  `fw-positioning-map` migration (fixes P4), threat-tiers + delta-timeline + SWOT,
  `framework-json` agent contract.
- **Phase 3 — battlecards:** schema + `battlecard_links` staleness + `battlecard-fill`
  agent + template variants + (f)/(g) first, then (b)/(a); win/loss import unlocks (c),
  (a)§5/§7, (d); then (e).
- **Parallel (non-code):** n=41 baseline import + verification into `MARKET-INTELLIGENCE/
  win-loss/` · dossier seeding from competitors.md · OKR anchor ratification (strategy.md)
  · WTP evidence intake process.

**Six ADRs to seed `pmm-playbook/vol-3-architecture/adrs/`:** A in-process run engine ·
B framework_analyses backfill · C change-detection storage · D Jina budget policy ·
E regeneration vs §8.4 approval boundary · F framework-json contract.

## 9. Open decisions (need the PMM admin / user)

1. Watch cadence default (weekly proposed) and whether `news` at 3 days is worth Jina spend at MVP.
2. Untrack/disable watches: any role or admin-only?
3. ELT overview: fourth CI tab or Studio dashboard card?
4. Phase 0 scope: include procurement/jobs sweeps (noisiest types) or defer to Phase 1?
5. Rounded (Hive tokens) vs sharp (Brand Standards) — ratify the chrome-vs-export split.
6. Ratify the company OKR anchor so the KPI tree stops floating (strategy.md).
7. Approve adding `created_date` + open-stage sync to the Salesforce mirror schema now.
8. Approve the n=41 baseline import (currently flagged "to verify"; loss percentages internal-only).

## 10. Proposed war-room updates (proposed, NOT applied — §8.5)

- `competitors.md`: add threat-tier, parent-company, escalation-trigger, pricing-posture columns.
- `strategy.md`: log the missing WTP evidence stream and OKR anchor as rock-level gaps.
- `MARKET-INTELLIGENCE/win-loss/`: import + verify the n=41 baseline (labeled "baseline,
  July 2026, internal").
- `MARKET-INTELLIGENCE/competitive/`: seed dossier stubs via the day-1 bootstrap run once
  plumbing exists — do not hand-write a second divergent source.
- Decide the kill-sheet/battlecard format split **before** the first card is produced.
