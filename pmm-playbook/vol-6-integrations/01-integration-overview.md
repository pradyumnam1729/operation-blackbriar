# Chapter 1 — Integration Overview

**Volume 6 · PMM Agent Playbook · 2026-08-06**

---

## Why Sources Are a Prerequisite, Not a Feature

`PMM Agent — Master Instructions & Contex.md` §2 names two hard prerequisites before any agent produces output. The first is codified context (the GTM War Room). The second is connected data sources:

> "If the system can't access call transcripts, CRM data, competitive intelligence, or product docs, most of the value is locked out. Connect your stack before expecting intelligence-layer outputs."

The reason is structural, not aspirational. The Master Instructions §3.1 rule — intelligence before activation — means the activation agents (product-to-market, launch-orchestration, sales-enablement) are gated on validated inputs from the intelligence agents (voice-of-market, win-loss, competitive-intel, icp-persona). The intelligence agents have exactly one job: turn external signals into validated war-room files. No signal in, no validated file, no activation output. A PMM Agent with an empty integration layer is a very careful writer with nothing to write about.

Guessing is the failure mode we designed the whole system to prevent. An unconnected source does not degrade the system gracefully; it forces a choice between refusing to produce output and inventing it. The system refuses. That is correct behavior, and it is also why connecting sources is the first job of deployment, not a later enhancement.

## The Source Map

Four source families feed the intelligence layer. Each has a dedicated chapter in this volume and a landing zone in `GTM-War-Room/MARKET-INTELLIGENCE/`.

| Source family | Examples | Landing zone | Primary consumer |
|---------------|----------|--------------|------------------|
| Call intelligence | Gong, Chorus, Fathom, Granola transcripts | `MARKET-INTELLIGENCE/voice-of-market/` | voice-of-market agent |
| CRM | Salesforce opportunities, stage history, asset attachments | `MARKET-INTELLIGENCE/win-loss/` | win-loss, messaging-effectiveness agents |
| Competitive | Pricing pages, release notes, G2 reviews, job postings, analyst reports | `MARKET-INTELLIGENCE/competitive/` | competitive-intel agent |
| Product truth | `engineering-playbook/vol-1-company/`, `engineering-playbook/vol-2-product-knowledge/`, release notes | `GTM-War-Room/product-wiki.md` | product-to-market agent |

Outbound surfaces (where finished assets go) are the mirror image of this map and are covered in `05-content-surfaces.md`.

## MVP: File-Drop and Manual Import

At the hackathon MVP stage (2026-08-06, see `pmm-playbook/vol-8-roadmap/01-hackathon-mvp.md`), no live connectors exist. Every source arrives by one of two paths:

1. **File-drop.** A human exports the raw material (a transcript, a CRM report, a competitor's pricing page saved as text) and drops it into an intake folder. An intelligence agent is then briefed to process the drop into the correct war-room file.
2. **Manual seed.** For the demo war room, source material is curated by hand from the Aurigo corpus, primarily `engineering-playbook/vol-1-company/` and `engineering-playbook/vol-2-product-knowledge/`.

This is deliberately unglamorous. The file-drop path exercises the exact same pipeline the live connectors will feed later: raw signal → extraction → structured markdown → validation → war-room file. Building the pipeline against manual drops means GA connectors are a transport upgrade, not a redesign.

The MVP constraint to be honest about: freshness depends on a human remembering to export. A weekly competitive sweep briefed against a three-week-old pricing page produces three-week-old intelligence. Every war-room file carries a `date` field in its frontmatter for exactly this reason, and agents must flag staleness rather than silently working around it.

## GA: Live Connectors

At GA (see `pmm-playbook/vol-8-roadmap/03-ga.md`), the transport changes and the freshness problem goes away:

- **Call platforms** push or are polled for new transcripts on a schedule; the voice-of-market pipeline runs weekly as a batch job per Master Instructions §11.
- **CRM** sync pulls opportunity snapshots (stage, amount, competitor field, attached assets) on a schedule; closed-won and closed-lost events trigger the win-loss agent.
- **Competitive monitors** watch named URLs (pricing pages, release-note feeds, G2 profiles) and event-trigger the competitive-intel agent on change, in addition to the standing weekly sweep.
- **Product truth** updates arrive when `engineering-playbook/vol-2-product-knowledge/` changes, triggering the product-to-market agent (see `06-product-truth.md`).

What does not change at GA: agents still read markdown from the war room, never the raw feed. The connector's job ends when a normalized file lands in `MARKET-INTELLIGENCE/`. This keeps the audit chain intact — every claim in every asset traces to a named war-room file with a date, regardless of how that file arrived.

## Rules for Any New Integration

1. **Land in the war room, in markdown, with frontmatter.** Source files carry `sources` (origin system and identifier), `date` (of the signal, not the import), and the segment tags the consuming agent needs.
2. **Normalize on ingest, not on read.** Extraction and structuring happen in the pipeline. Agents consume clean files; they do not re-parse raw exports.
3. **One landing zone per source family.** No source writes outside its `MARKET-INTELLIGENCE/` subfolder or designated context file.
4. **Staleness is surfaced, never hidden.** If the freshest file in a landing zone is older than the program cadence (§11), the consuming agent says so in its output.
5. **Ingestion proposes, the human approves.** Pipeline output that would change a brand-DNA file or a battlecard follows the §8.5 rule: proposed updates, not applied ones.

## What This Chapter Locks In

Connected sources are a deployment prerequisite. The pipeline shape (raw → structured markdown → war room → agent) is fixed from MVP through GA; only the transport matures. Every downstream chapter in this volume is an instance of this pattern.
