# 04 — Users & Personas

---

## The Two-Tier User Model

The PMM Agent has one admin persona and eight consumer personas, defined in Master Instructions §9. The distinction is structural, not cosmetic: the admin shapes and approves the knowledge; consumers query it and receive outputs framed for their role. Nothing a consumer does can alter the foundation. Everything a consumer receives traces back to it.

---

## The PMM — Admin and Power User (§9.1)

The PMM is the system owner and simultaneously its heaviest user. As **admin**, the PMM:

- Builds and maintains the foundational doc per product and the GTM War Room context files (`../../GTM-War-Room/BRAND-DNA/`)
- Configures guardrails: forbidden-words lists, voice rules, stage-aware settings
- Approves every output before it moves from draft to final (§8.4) — the system proposes, the PMM decides
- Reviews proposed context-doc updates at session end (§8.5) and accepts or rejects them
- Monitors the governance dashboard: asset freshness, usage, consistency scores

As **power user**, the PMM runs the full agent organization directly: dispatching intelligence sweeps, commissioning launch plans, generating any asset without the consumer-facing constraints. The PMM's leverage question is always §3.5: is this task a rock, a pebble, sand, or an always-on program?

**What the app must give the PMM:** a structured section-by-section foundation editor that enforces the framework, a one-screen approval queue, staleness alerts, and evidence that consumers are actually using what was approved.

---

## Consumer Personas and Output Frames (§9.2)

Every answer and asset is framed in the consumer's own metric language (§3.3). The persona determines not just what is retrieved but how it is shaped.

| Persona | What they need | Output framing |
|---------|----------------|----------------|
| **Sales** | Active deal support | Talk tracks, objection handling, competitive battlecards, deal-specific proof points, business-case calculator. Metric language: win rates, deal velocity, pipeline value, average deal size. |
| **Proposals** | RFP / proposal responses | Differentiation framing, compliant answers, proof assets, use-case evidence — assembled from approved value props, never improvised. |
| **Product** | Roadmap intelligence | Market signals, adoption barriers, feature positioning, buyer feedback synthesis. Metric language: activation rate, feature adoption, time-to-value, trial-to-paid. |
| **Marketing** | Campaign and content inputs | Messaging hierarchy, channel copy, campaign briefs, ABM assets. Metric language: MQLs, CPL, conversion rate, ROAS. |
| **Leadership** | Strategic summaries | Metric impact (MRR, NRR, win rate, pipeline), strategic initiative briefs, KPI maps. Never raw observations — the business-translation pattern (§7.3) is mandatory. |
| **Customer Success** | Retention and expansion | Adoption messaging, expansion talk tracks, churn-risk signals framed as actions. |
| **SDR / BDR** | Outbound support | Persona-specific openers, pain-first copy, objection one-liners, sequencing guidance. Short, channel-ready. |
| **Founder** | GTM narrative and authority | Founder POV content, category narrative, investor-ready positioning. |

---

## Persona Rules the App Enforces

1. **Role-aware framing is not optional.** The same underlying fact — say, a win/loss finding about integration gaps — renders as an objection-handling line for Sales, a roadmap signal for Product, and an NRR-impact statement for Leadership. The knowledge engine applies the §3.3 metrics map at answer time.
2. **Consumers get answers, not access.** Sales queries the war room through the app; it does not browse or edit war-room files. This protects both the foundation's integrity and the consumer's time.
3. **Every persona sees citations.** The trust mechanism that stops reps rebuilding their own decks is provenance: every answer names the foundation sections and intelligence files it drew from.
4. **Escalation is honest.** When the war room cannot answer a persona's question, the system says so and routes an intelligence task — it never guesses (§2.1, and [Vol 5, ch. 03](../vol-5-operating-model/03-query-answer-workflow.md)). A wrong confident answer to a rep in a live deal is the worst output the system can produce.

---

## Aurigo Grounding

For the first customer, the personas above map to real audiences with real terminology rules (`../../Voice of Aurigo - Standards Reference.md`):

- Sales sells Masterworks and Essentials to **government agencies** (who run *programs*) and Primus to **facility owners** (who run *portfolios*) — the framing engine must never swap these.
- No ROI language in public-sector outputs; use "program outcomes" or "capital program performance."
- Buyer personas on the customer side (DOT Director, county engineer, data center VP) live in `../../GTM-War-Room/personas.md` and `../../engineering-playbook/vol-1-company/05-customers.md`. Those are the personas our assets speak *to*; this chapter's personas are the users the app serves.

---

*Next: [05 — Market Landscape](05-market-landscape.md)*

Last updated: 2026-08-06
