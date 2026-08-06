# Product Backlog — Aurigo Maintain / MW Platform 2.0

> Authoritative priority list. Last updated 2026-07-28.
> Framing: P0 = kills qualified pipeline before a demo completes. P1 = compliance bug hiding as feature. P2 = segment unlock. P3 = field integrity / UX debt. P4 = backlog.

---

## P0 — Pipeline killers (both must ship before any DOT or Maximo-house demo)

| ID | Build | Segment | Rationale |
|----|-------|---------|-----------|
| P0-A | **Live Maximo REST adapter** | All private + DOTs | Kills stage-2 POC failure; 40% of every target segment uses Maximo. No real asset data = no demo. |
| P0-B | **TAMP document engine** (4 required outputs: PDF export, Consistency Determination letter, Funding source breakdown, District investment summary) | State DOTs | Without it, no DOT procurement is closeable. Plan written 2026-07-28. Wave 1a (print CSS) in progress. |

---

## P1 — Compliance bugs (fix-sprint, not feature-sprint)

| ID | Build | Segment | Rationale |
|----|-------|---------|-----------|
| P1-A | **PM2/PM3 federal thresholds separated from tenant thresholds** | DOTs | Federal minimums (≤5% Interstate Poor, ≤10% Non-Interstate NHS Poor, ≤10% NHS bridge deck area Poor) must not be tenant-configurable. Compliance correctness bug. |
| P1-B | **NBI native rating as primary display, normalized as secondary** | DOTs | `nbiSourced` bool already on condition DTO; `avgIri` per class already computed. Neither rendered. Bridge engineer credibility bug, not a missing feature. |

---

## P2 — Segment unlocks (each opens a new buyer vertical)

| ID | Build | Segment | Rationale |
|----|-------|---------|-----------|
| P2-A | **Deferred maintenance backlog dollar figure (SLR)** | Counties | The number a commissioner takes to the county board. Unlocks county procurement motion. |
| P2-B | **PASER local road condition rating** | Counties | IRI thresholds are wrong scale for county roads. PASER 1–10 is the standard county engineers use. |
| P2-C | **Consequence-dollar risk score** | Utilities | Core Copperleaf gap. Required to win utility C-suite. *Blocked on: Copperleaf calibration methodology discovery.* |
| P2-D | **OSHA PSM mechanical integrity audit package** | Manufacturing | Closes the urgency-buying trigger for chemical/refinery buyers. |
| P2-E | **Data center domain profile template + ServiceNow read** | Data centers | 2–3 weeks config work; genuine white space vs competitors. *Blocked on: hyperscaler prospect discovery.* |

---

## P3 — Field integrity / UX debt

| ID | Build | Segment | Rationale |
|----|-------|---------|-----------|
| P3-A | **Inspection wizard refactor (step-level save)** | All field users | Field data integrity at rural water crossings, not UX polish. Loss of a partial inspection on connectivity drop is a data integrity problem. |
| P3-B | **Job order simplified to capital need approval → EAM push** | DOTs + Utilities | 7-stage state machine creates EAM conflict in procurement. Simplify to: Approved → push to EAM. |
| P3-C | **Primus nav scope filter (hide FHWA/TAMP modules)** | Private sector | One sprint; eliminates demo confusion for private-sector buyers seeing irrelevant public-agency screens. |
| P3-D | **Mapbox wiring** | All | Asset map layer wiring to live PostGIS data. |

---

## P4 — Backlog (no current sprint slot)

| ID | Build | Rationale |
|----|-------|-----------|
| P4-A | Weibull default parameters calibrated to element type + climate | Credibility gap with bridge engineers. |
| P4-B | ISO 55001 alignment checklist | Low effort, high RFP scoring value for manufacturing. |
| P4-C | Climate/resilience risk register chapter | BIL mandate; FHWA consistency criterion since 2024. |
| P4-D | Preventive maintenance scheduling engine | Depends on P0-A (Maximo adapter) for real work order push. |
| P4-E | Test coverage gaps (calc engines < 90% line coverage) | Unit + integration test backfill. |
| P4-F | Observability (OTel traces, dashboards, alerting) | OTel CVE patched at 1.17.0; infra ready but dashboards absent. |

---

## Open Discovery Items (block P2-C and P2-E specification)

| Item | Blocks | Owner | Status |
|------|--------|-------|--------|
| Copperleaf calibration methodology — how do they price consequence-dollar risk? | P2-C | Business Analyst | Open |
| Hyperscaler prospect — which cloud provider / data center operator is the target buyer? | P2-E | Product Manager | Open |
| Maximo version survey — what version(s) does the target segment run? (7.6.x vs MAS 8.x vs SaaS) | P0-A | Integration Strategist | **Complete (2026-07-28)** — adapter targets 7.6.1.3+ / MAS 8.x API-key; 6 bugs found and fixed (A–G). |

---

## Notes

- **P0-A and P0-B are co-equal.** Maximo adapter must be live before a TAMP demo means anything (no real asset data → no credible report). Build in parallel.
- **P1 items are budgeted as bug-fix time**, not feature sprints. Do not scope-creep them.
- **P2-C and P2-E cannot be fully specified until the three discovery items close.**
- Primus worktree ships first; masterworks back-ports follow within the same sprint.
