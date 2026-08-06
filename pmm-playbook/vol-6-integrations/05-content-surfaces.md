# Chapter 5 — Content Surfaces

**Volume 6 · PMM Agent Playbook · 2026-08-06**

---

## What This Chapter Covers

The previous chapters cover signals coming in. This one covers assets going out. The war room is markdown-first (see `pmm-playbook/vol-7-ai-engineering/02-context-engineering.md`), but the people the system serves do not work in markdown: sales presents slides, proposals teams work in RFP tools, executives read documents, and everyone asks questions in Slack. A generated asset that never reaches its consumer in the format they work in is shelf-ware, and the asset usage rate (our production metric) will say so.

The rule that governs every surface: **the war-room markdown file is the canonical asset; every export is a rendering of it.** Edits happen in the war room and re-export, never in the exported copy. This is how the 100% messaging-consistency value prop survives contact with PowerPoint.

## The Four Surfaces

### 1. Slide Export

For battlecards, sales decks, and exec briefs presented live.

- **Format:** PPTX (Aurigo template) and PDF. Google Slides at GA if demand warrants.
- **Structure contract:** assets destined for slides are authored in slide-shaped markdown — one `##` heading per slide, tight bullets, speaker notes in a marked block. The battlecard template (`pmm-playbook/vol-9-templates/battlecard-template.md`) is already shaped this way: two pages, scannable in the 90 seconds before a call.
- **Brand:** visual specs come from `Aurigo Brand Standards.md` (colors, logo, type). The export pipeline owns brand application; authors own content only.
- **Footer stamp:** every exported deck carries the asset's war-room path, version date, and stage (draft/final) on the closing slide, so a stale deck in the wild can be traced and replaced.

### 2. Document Export

For one-pagers, launch briefs, case studies, and exec briefs read rather than presented.

- **Format:** PDF for anything customer-facing; DOCX where the consumer must edit (rare, and flagged, because edited exports fork from the canonical file).
- **Length contract per asset type:** sales one-pager renders to exactly one page; exec brief to one page; battlecard to two. If the markdown will not fit, the asset fails export and goes back for cutting — the pipeline does not shrink the font.
- **Frontmatter behavior:** war-room frontmatter (product, audience, persona, stage, sources, date) is stripped from the customer-facing render but embedded in PDF metadata for traceability.
- **Draft watermark:** any asset with `stage: draft` exports with a DRAFT watermark. The only way to remove it is PMM admin approval flipping the stage to final (§8.4). This is enforced by the pipeline, not by convention.

### 3. Slack Answers

For the ask-war-room query flow — Sales, Proposals, Marketing, or Leadership asking in plain language and getting a role-ready answer.

- **Format:** short-form answer in Slack markup: the answer first, then up to three supporting points, then source citations as war-room paths. No preamble.
- **Length contract:** the core answer fits in one Slack message without expanding. If the honest answer is long, the reply gives the summary plus a link to the full asset or offers to generate one.
- **Role framing:** answers are framed per the persona output frames in Master Instructions §9.2 — the same underlying fact renders as a talk track for sales, compliant answer language for proposals, and metric impact for leadership. Examples live in `pmm-playbook/vol-10-prompts/10-ask-war-room-examples.md`.
- **Draft discipline:** Slack answers cite only `stage: final` assets for outbound-usable language. If only a draft exists, the answer says so explicitly.

### 4. Proposal-Tool Handoff

For RFP responses moving into the proposals team's tool (Loopio-class response managers, or structured documents where the customer dictates format).

- **Format:** structured export — one answer block per RFP question, each carrying the question ID, the compliant answer, the differentiation paragraph, and named proof assets, per `pmm-playbook/vol-9-templates/rfp-response-template.md`.
- **Compliance-first ordering:** the direct compliant answer ("Yes, Masterworks provides…") always precedes differentiation framing, because proposal evaluators score compliance before they read anything else.
- **Reusable answer library:** approved RFP answers are also written back to `GTM-War-Room/PLAYBOOKS-AND-ASSETS/` tagged by question theme, so the next RFP starts from validated language instead of a blank page.

## Format Requirements Summary

| Surface | Formats | Hard limit | Draft handling |
|---------|---------|-----------|----------------|
| Slides | PPTX, PDF | Battlecard 2 pages; deck per brief | DRAFT watermark on every slide |
| Documents | PDF (DOCX by exception) | One-pager 1 page; exec brief 1 page | DRAFT watermark |
| Slack | Slack markup | One message, un-expanded | Draft status stated in the answer |
| Proposal tool | Per-question blocks | Customer's format governs | Drafts never leave the war room |

## Roadmap Note

At the hackathon MVP (2026-08-06), slide and document export plus the in-app query flow are in scope; the Slack surface and proposal-tool handoff are demonstrated as copy-out formats and become native integrations at beta/GA per `pmm-playbook/vol-8-roadmap/`.
