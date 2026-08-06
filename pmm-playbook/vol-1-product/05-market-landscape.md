# 05 — Market Landscape

---

## Overview

The PMM Agent does not sit cleanly in an existing software category, which is exactly why the adjacent categories matter. Buyers (and hackathon judges) will pattern-match us to the nearest thing they know. This chapter maps the four adjacent categories, what each does well, where each stops, and why an in-house foundational-doc plus query engine is a different answer to a different question.

The one-line position: **adjacent tools distribute, monitor, or decorate the product story. None of them owns the story itself.** The PMM Agent starts where they all stop — at the foundation.

---

## Category 1 — Competitive Intelligence Platforms (Klue, Crayon)

**What they do well:** Track competitor moves at scale — pricing pages, release notes, review sites, job postings — and maintain battlecards inside a dedicated workspace. Strong alerting, decent CRM integrations, mature battlecard templates.

**Where they stop:** They are a lens on the *outside* world. Competitive intel is one section of a foundation, not the foundation. Klue can tell you what Kahua shipped last week; it cannot tell you your own positioning, your value props in a rigorous schema, or what your proposal team should write on Friday. Battlecards in these tools still depend on someone supplying the "why we win" — and that someone is the queue-bound PMM of [chapter 02](02-problem-statement.md).

**Relationship to the PMM Agent:** Our A3 competitive-intel agent (`../../.claude/agents/competitive-intel.md`) does this category's job as one worker among fourteen, feeding the same foundation everything else feeds. A future integration could ingest a Klue feed as a data source (Volume 6).

---

## Category 2 — Sales Enablement Platforms (Highspot, Seismic)

**What they do well:** Distribute content to the field, surface it in CRM context, track which assets get opened and used in deals, deliver training and plays. Mature analytics on content engagement.

**Where they stop:** They distribute whatever is loaded into them. A stale deck in Highspot is a stale deck with excellent analytics. These platforms measure usage of content; they do not create it, validate it against a foundation, or notice that it contradicts the positioning approved last month. They solve failure mode 3 (folder archaeology) and partially measure failure mode 2 (stale decks) — they cannot solve failure modes 4 and 5.

**Relationship to the PMM Agent:** Complementary at maturity. The PMM Agent is the factory and the source; an enablement platform could be a distribution channel for finalized assets. Our C11 messaging-effectiveness agent covers the "is it being used" question for the MVP without a platform purchase.

---

## Category 3 — AI Content Tools (generic LLM chat, AI writing assistants)

**What they do well:** Produce fluent first drafts of anything, instantly, cheaply. Genuinely useful in skilled hands with good context.

**Where they stop:** No validated foundation, no guardrails, no provenance, no approval workflow. Master Instructions §2.1 is blunt: if the system doesn't know your world, it produces generic output. A generic tool given a vague prompt produces exactly the outputs §8.2 tells us to avoid — feature-led messaging, me-too competitive slides, generic AI blog content — at unprecedented speed. Worse, every rep with a chat window becomes failure mode 4 (sales invents its own messaging) with better grammar.

**Relationship to the PMM Agent:** We use the same underlying model class (Claude), but the product is everything wrapped around it: the enforced foundation, the fourteen specialized agents, deterministic guardrails as code, the draft → approval gate, and citations on every output. The moat is not the model; it is the codified context and the discipline (see [Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)).

---

## Category 4 — GTM Service Firms (e.g., ONEGTMLAB's productized model)

**What they do well:** This is the most instructive adjacent category. Firms like ONEGTMLAB productize senior PMM judgment as a service: strategy and execution in one system, anchored on the principle our own constitution quotes as its North Star — *"Fix the core story so everything else converts. If positioning is off, every channel becomes expensive and noisy."* They deliver the rigor most in-house teams lack: real positioning work first, then the assets that flow from it.

**Where they stop:** The engagement ends. The deliverables are documents; the judgment goes home with the consultants. Six months later the docs are stale, the queue reforms, and the client either re-engages or drifts. The service model proves the demand for exactly what we build — foundational rigor plus execution from it — but it cannot leave behind a *live* system, and it prices senior judgment per engagement rather than amortizing it across every future question.

**Relationship to the PMM Agent:** We are the in-house, always-on instantiation of the same thesis. The frameworks a firm like this applies by hand (positioning first, messaging as the bridge, narrative arc, anti-generic discipline) are encoded in [Volume 2](../vol-2-domain-knowledge/README.md) and enforced by software. Where a firm fixes the core story once, the PMM Agent keeps it fixed.

---

## Why the In-House Foundational-Doc + Query Engine Differs

| Dimension | CI platforms | Enablement platforms | AI content tools | GTM service firms | PMM Agent |
|-----------|-------------|----------------------|------------------|-------------------|-----------|
| Owns the core story | No | No | No | During engagement | **Yes, permanently** |
| Enforces a framework | Battlecards only | No | No | By hand | **In software** |
| Answers role questions | No | Search only | Ungrounded | Not after handoff | **Grounded + cited** |
| Generates assets | Battlecards | No | Ungrounded | Per engagement | **From foundation, gated** |
| Stays current | Competitor feed only | No | No | No | **Always-on programs** |
| Consistency guarantee | No | No | No | Snapshot only | **Trace to source, enforced** |

The structural difference is the dependency order. Every adjacent category assumes the core story exists somewhere and builds services around that assumption. The PMM Agent makes the core story a first-class, versioned, approved object — and refuses to operate without it. That refusal is what makes the 100%-consistency claim mechanical rather than aspirational.

---

## Honest Boundaries

- We do not beat Klue at competitive monitoring breadth, Highspot at distribution analytics, or a top consultancy at bespoke strategy judgment. We do not need to. Each of those is one organ; we are the organism.
- The category risk worth watching: enablement platforms adding "AI content agents" on top of their content stores. Their structural weakness is the same as ever — no enforced foundation, no framework rigor — but the demo will look similar. Our counter is provenance and the framework canon: show the trace, show the schema, show the gate.

---

*Next: [06 — Success Metrics](06-success-metrics.md)*

Last updated: 2026-08-06
