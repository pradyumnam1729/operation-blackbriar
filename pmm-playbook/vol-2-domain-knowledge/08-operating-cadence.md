# 08 — Operating Cadence

*Sources: Tamara Grominsky (time allocation, 6-level planning, rocks/pebbles/sand via EOS). Encoded from Master Instructions §3.5, §3.6, §10, §11.*

---

## The System Defends Focus

A PMM's default fate is to be consumed by whoever asks loudest. The cadence standards exist so that focus is defended structurally — by classification, allocation, and schedule — rather than by willpower. The PMM Agent's orchestrator applies these rules at intake ([Vol 5, ch. 01](../vol-5-operating-model/01-intake-protocol.md)); C14 (pmm-prioritization) audits against them.

---

## Time Allocation — The Four Buckets (§3.5)

Every incoming request is classified before dispatch:

| Work type | Allocation | Examples |
|-----------|-----------|----------|
| Company-level initiatives | ~50% | Repositioning, new market entry, Tier-1 launch, pricing overhaul |
| Team-level initiatives | ~25% | Persona refresh, message testing, sales enablement updates |
| Always-on programs | ~15% | Win/loss, competitive intel, voice-of-customer, content governance |
| Ad hoc requests | ~10% | Battlecard for a live deal, board slides, one-pager for a call |

Two rules with teeth:

1. **Sand must not fill the jar before rocks.** The 10% ad hoc budget is a ceiling, not a suggestion. When the system automates ad hoc fulfillment (Value Prop 1), the human PMM's ad hoc share should fall *below* 10% — that recovered time is the whole point.
2. **Recurring sand gets promoted.** If the same ad hoc request recurs, it becomes an always-on program or a self-serve capability. The third "refresh the Kahua battlecard" request is not a task; it is a signal that battlecard refresh belongs on the weekly competitive schedule.

And the tracing rule: **every recommended action must trace to a company OKR.** Anything that cannot is flagged as sand, whatever its urgency.

---

## The OKR Cascade (§3.6)

Work is sized and placed at the right altitude:

```
Company OKR → Team OKR → Monthly Priorities → 1–2 Weekly Projects → 1–2 Daily Tasks → Timeblocks
```

C14 outputs a **traceable tree, not a flat ranked list** — every action links up through its monthly priority and quarterly rock to a company OKR. A flat top-ten list hides the question that matters: what does this serve? The tree makes orphans visible, and orphans are cut.

**Rocks / Pebbles / Sand sizing per quarter:**

- **Rock:** 1 major quarterly initiative (for this repo, 2026-Q3: ship the PMM Agent MVP)
- **Pebbles:** 2–3 supporting projects
- **Sand:** reactive work, tightly limited

Current OKRs and rocks live in `../../GTM-War-Room/strategy.md`, injected at SessionStart so every agent triages against the real quarter, not a remembered one.

---

## Always-On Programs (§11)

Scheduled programs run on cadence, not on demand — they are how the war room stays fresh without anyone remembering to ask:

| Program | Cadence | Feeds |
|---------|---------|-------|
| Voice-of-Market (call analysis) | Weekly | Voice-of-market intel, objection library |
| Competitive Intelligence | Weekly + event-triggered | Battlecards, positioning |
| Win/Loss Analysis | Monthly | GTM strategy, messaging, sales playbooks |
| Content Governance audit | Monthly | Messaging library, content inventory |
| GTM Performance review | Monthly | Strategy, prioritization |
| ICP/Persona validation | Quarterly | Persona docs, segmentation |
| HANDOVER.md | Every session end | Continuity |

Programs are reviewed quarterly and paused when they stop earning their keep — a ritual that no longer feeds decisions is ballast. Operational detail (dispatch, output destinations) lives in [Vol 5, ch. 06](../vol-5-operating-model/06-always-on-programs.md).

---

## Stage-Aware Behavior (§10)

The cadence flexes with company stage; the system reads `about-me.md` for the current stage and adapts channel mix, launch tier, and messaging complexity:

| Stage | Primary motion | PMM focus |
|-------|---------------|-----------|
| 0 → $2M | Founder-led, outbound, ICP definition | Core positioning, first battlecard, 1-pager, launch narrative |
| $2M → $15M | Sales-assisted, demand gen | Messaging library, sales playbooks, case studies, ABM |
| $15M → $100M | Product-led + enterprise | Multi-product narrative, analyst relations, pricing/packaging, expansion |

The practical consequence: the same request means different work at different stages. "Prepare a launch" at 0→$2M is a founder-led narrative and a one-pager; at $15M→$100M it is a Tier-1 orchestration with analyst briefings. Agents that ignore stage produce correct-looking, wrong-sized output. (Aurigo, as first customer, operates with the maturity of the third stage; the PMM Agent product itself is at hackathon-MVP stage — the two contexts must not be confused in seeded content.)

---

## The Cadence in One Sentence

Classify every request into the four buckets, size it as rock, pebble, or sand, trace it to an OKR or flag it, let the scheduled programs keep the foundation fresh, and let the stage decide the shape of the work.

---

*Back to [Volume 2 index](README.md). Next volume: [Volume 3 — App Architecture](../vol-3-architecture/README.md)*

Last updated: 2026-08-06
