---
name: ask-war-room
description: Answer a plain-language question from Sales, Proposals, Marketing, Leadership, Customer Success, or SDR using only GTM-War-Room content, framed for that role with cited sources. Use when someone asks a GTM question ("what do I say when...", "how do we beat...", "what's our story on..."), when a non-PMM role needs a fast answer, or to test what the war room can and cannot support. Prototype of the web app's query engine.
---

# Ask the War Room — Role-Aware Q&A

This skill is the query engine in workflow form: a plain-language question in, a crisp,
role-ready answer out — built **only** from war-room content, framed in the asker's
language, with sources cited. Its other job is equally important: knowing when the war
room *cannot* answer, saying so, and routing to the right intelligence agent instead of
guessing. Guessing is a failure mode (§2.1); an invented answer here becomes a wrong
claim in a live deal.

## Required reading

1. `PMM Agent — Master Instructions & Contex.md` — §3.3 (stakeholder metric language), §9.2 (persona output frames).
2. `GTM-War-Room/BRAND-DNA/` — all four brand files.
3. Then only the war-room files the question actually needs (see retrieval, below).

## Step 0 — Identify the asker and the ask (AskUserQuestion if unclear)

1. **Role** — Sales / Proposals / Product / Marketing / Leadership / Customer Success / SDR-BDR / Founder. The role determines the output frame; never answer role-blind.
2. **Context** — live deal (which competitor, which segment), RFP deadline, campaign, board meeting? Context sets depth and urgency.
3. **Product and segment** — Masterworks / Essentials / Primus; public owners or facility owners. This gates terminology (program vs. portfolio) and whether ROI language is allowed in the answer (never for public sector — use "program outcomes").

If the question names its role and context clearly, skip the questions and answer.

## Step 1 — Retrieve (war room only)

Search `GTM-War-Room/` for the files that bear on the question: BRAND-DNA, the product's
foundational doc and messaging in `PLAYBOOKS-AND-ASSETS/messaging-library/`, battlecards,
case studies, `MARKET-INTELLIGENCE/` (competitive, win-loss, voice-of-market,
icp-personas), and the root context files (`competitors.md`, `personas.md`,
`product-wiki.md`, `strategy.md`).

**Boundary rule:** the answer's substance comes from war-room files only. Engineering
playbooks and general knowledge may help you *understand* the question, but any claim in
the answer must trace to a war-room file. Prefer `stage: final` (approved) content; if
only drafts exist, say so in the answer.

## Step 2 — Frame per role (§9.2 + §3.3)

| Role | Give them | In their metric language |
|---|---|---|
| Sales | Talk track, objection handling, battlecard pointer, deal-specific proof | win rate, deal velocity, pipeline, deal size |
| Proposals | Differentiation framing, compliant answer language, use-case evidence | compliance, evaluation criteria, proof |
| Product | Market signals, adoption barriers, feature positioning, buyer feedback | activation, adoption, time-to-value |
| Marketing | Messaging hierarchy, channel guidance, campaign framing | MQLs, CPL, conversion rate |
| Leadership | Strategic summary, metric impact, initiative framing | MRR, NRR, win rate, pipeline |
| Customer Success | Adoption messaging, expansion talk track, churn-risk signals | retention, expansion, adoption |
| SDR / BDR | Persona-specific opener, pain-first framing, objection one-liners | replies, meetings booked |
| Founder | Category narrative, POV framing, investor-ready positioning | category, narrative, authority |

Same underlying truth, different frame. A Sales answer leads with what to say next call;
a Leadership answer leads with the metric and the so-what.

## Step 3 — Answer format

```markdown
**Answer for [Role]** — <one-line direct answer first>

<2–6 short paragraphs or bullets in the role's frame. Verbatim customer language quoted
where it helps. Absolute dates. Public-sector answers: no ROI framing, "program" not
"portfolio", no "the" before org abbreviations.>

**Use it like this:** <one concrete next step — the line to say, the section to paste,
the slide to build>

**Sources:** GTM-War-Room/<file> (stage, date) · GTM-War-Room/<file> (stage, date)
**Confidence:** validated / draft-only / partial — <one line why>
```

Every answer cites the specific war-room files it came from. No citation, no claim.

## Step 4 — When the war room can't support the answer

Do not fill gaps from general knowledge. Say plainly what is missing, then route:

- Competitor facts missing/stale → `competitive-intel` agent (`.claude/agents/`)
- Why we win/lose, buyer decision drivers → win-loss program (Master Instructions §12 A4; run inline per §12 if the agent file doesn't exist yet)
- Buyer language, objections, trends → voice-of-market (A1)
- Persona/segment questions → icp-persona (A2)
- Proof points, references → customer-evidence (A5)
- No foundational doc for the product at all → the `foundation-doc` skill

Format: "The war room can't support this yet. Missing: <what>. I can dispatch <agent> to
build it — expect <output> in <where>. Proceed?" A partial answer is fine if labeled:
answer what is supported, mark the rest as a gap.

## Quality gate

1. Trace check: every claim maps to a cited war-room file; delete anything that doesn't.
2. Frame check: metric language matches the role's row; terminology matches the segment.
3. Voice spot-check: no banned phrases, "AI-native" only, correct product names ("Masterworks AI, powered by Lumina" is the only approved powered-by construction).
4. If the same question has now arrived repeatedly, note it as a candidate for an Always-On program or a standing asset (§3.5) in the next `handover`.
