# 07 — The GTM War-Room Model

*Sources: Aatir Abdul Rauf, Richard King. Encoded from Master Instructions §4.*

---

## Folder as Knowledge Base

The war room is the deliberately low-tech heart of the system: one master folder, four subfolders, everything Markdown. This is not a placeholder awaiting a "real" database — it is a design position. A folder of plain-text files is diffable, version-controlled, reviewable like code, readable by humans and models alike, and immune to vendor lock-in. The app ([Volume 3](../vol-3-architecture/README.md)) builds structure *over* these files; it does not replace them.

The two hard prerequisites (§2) both point here: codified context docs (the war room populated) and connected data sources (feeds that keep it current). If the system doesn't know your world, it produces generic output. The war room is how it knows your world.

---

## The Structure

```
GTM-War-Room/
├── BRAND-DNA/                       ← the four brand files (minimum viable context)
│   ├── positioning-and-icp.md
│   ├── brand-voice.md
│   ├── our-customer.md
│   └── gtm-rules.md
├── ACTIVE-LAUNCHES/[launch-name]/   ← per-launch: BRIEF.md, assets/, enablement/, channels/
├── PLAYBOOKS-AND-ASSETS/            ← messaging-library/, sales-playbooks/, battlecards/, case-studies/
└── MARKET-INTELLIGENCE/             ← competitive/, win-loss/, voice-of-market/, icp-personas/
```

Plus root-level context files: `about-me.md` (role, product, stage, priorities), `competitors.md`, `personas.md`, `strategy.md` (current OKRs and rocks), `product-wiki.md`.

The four subfolders map to the system's data flow: intelligence lands in `MARKET-INTELLIGENCE/`, durable outputs live in `PLAYBOOKS-AND-ASSETS/`, time-bound campaigns live in `ACTIVE-LAUNCHES/`, and `BRAND-DNA/` governs everything.

---

## The Four Brand Files — Minimum Viable Context

Every agent reads these before any task; the SessionStart hook (`../../.claude/hooks/session-start.ps1`) injects them so the reading cannot be skipped.

| File | What it holds | Why it is irreplaceable |
|------|--------------|------------------------|
| **positioning-and-icp.md** | Market category, who it's for, what it solves, what it replaces, why it's better | The answer to "what is your product and who is your enemy?" — root of the [chain](02-positioning-messaging-copy-chain.md) |
| **brand-voice.md** | Tone rules, formatting preferences, banned buzzwords, per-channel voice profiles (LinkedIn ≠ email ≠ website ≠ one-pager) | The messaging → copy transition depends on it; for Aurigo it encodes `../../Voice of Aurigo - Standards Reference.md` |
| **our-customer.md** | **Raw customer language, not summaries.** What they say vs. what they feel; decision drivers, urgency, approval process, trust signals, exact buyer vocabulary | The source of all non-generic copy. Summarizing this file destroys its value — the verbatim phrasing *is* the asset |
| **gtm-rules.md** | Operating rules: output formats, forbidden-words list, "never sound like a SaaS brochure," stage-aware rules, PMM-set constraints | The guardrails, as data — the deterministic checks ([Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)) read from here |

The distinctive discipline is `our-customer.md`: most companies keep persona summaries; almost none keep a maintained corpus of verbatim buyer language. Yet verbatim language is what separates copy that lands from copy that could belong to anyone (§8.1). A1 (voice-of-market) is its primary feeder.

---

## Rules of the Room

1. **Freshness over completeness.** A missing file is honest; a stale file lies with confidence. Agents finding missing or stale inputs say so and propose how to populate them — guessing is a failure mode (`../../CLAUDE.md`).
2. **Update, never duplicate.** One dossier per competitor, one file per persona. Agents extend existing files; a second file on the same subject is a bug.
3. **Frontmatter on every asset:** `product`, `audience`, `persona`, `stage` (draft/final), `sources`, `date`. The `sources` field is what makes the consistency trace possible.
4. **Drafts before finals.** Outputs land as `stage: draft`; only PMM approval promotes them (§8.4). Directories do not contain unlabeled limbo files.
5. **Writes are proposed, applied on approval.** Context-doc changes surface as proposals at task end (§8.5); the PMM applies them. The war room has one editor of record.
6. **HANDOVER.md at the root** records session continuity ([Vol 5, ch. 07](../vol-5-operating-model/07-session-rituals.md)).

---

## The War Room and the App

In the app's terms ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)): the foundational doc's sections and the war-room files are two views of the same content — the app's FoundationDoc entity is materialized from, and writes back to, these files. The knowledge engine retrieves over them; the asset generator cites them; the governance dashboard measures their freshness. For the hackathon MVP, "database" and "war room" are the same Markdown, and that is a feature: the demo can show the file a claim came from.

---

*Next: [08 — Operating Cadence](08-operating-cadence.md)*

Last updated: 2026-08-06
