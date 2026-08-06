# Chapter 1 — Hackathon MVP (2026-08-06)

**Volume 8 · PMM Agent Playbook · 2026-08-06**

---

## The Scope, Exactly

Today's build target: a demo-ready slice of the PMM Agent that proves the core loop end to end — foundational doc in, role-ready answers and customer-ready assets out, with the quality gates visibly working. Everything below is in scope for 2026-08-06; everything not listed is explicitly deferred to `02-beta.md` or later.

### In Scope

1. **Foundational-doc builder, one product: Masterworks AI.** The guided flow that walks a PMM through building the standardized foundational doc per `pmm-playbook/vol-9-templates/foundation-doc-template.md` — positioning (Dunford formula), ICP, personas, JTBDs, value props in the §7.4 schema, competitive summary, brand guardrails, proof points, objection library. One product keeps the demo narrative tight, and Masterworks AI is the product with the richest seeded material.
2. **Ask-war-room query flow, three personas.** Plain-language questions answered role-ready for **Sales** (talk tracks, objection handling), **Proposals** (compliant answer + differentiation framing), and **Leadership** (metric-first summaries), per the Master Instructions §9.2 output frames. Every answer cites its war-room sources by path.
3. **Two asset generators.** The **battlecard** (2-page, per `pmm-playbook/vol-9-templates/battlecard-template.md`) and the **exec one-pager** (per `pmm-playbook/vol-9-templates/exec-brief-template.md`). Two generators are enough to prove the pattern generalizes; ten would prove nothing extra today.
4. **The draft → approval gate.** Generated assets land as `stage: draft`, visibly watermarked; a PMM admin approval action flips them to final. This is in the MVP on purpose — the governance story is a differentiator, not overhead, and the demo must show the human deciding.
5. **The seeded Aurigo war room.** `GTM-War-Room/` populated from the Aurigo corpus: the four brand-DNA files, competitor dossiers for the demo competitor set, persona files, `product-wiki.md` derived from `engineering-playbook/vol-2-product-knowledge/`, and enough voice-of-market and win-loss material for answers to be specific. Seeding follows `pmm-playbook/vol-10-prompts/01-seed-war-room.md`.

### Out of Scope Today (and where it lands)

Multi-product support, the full 14-agent wiring, always-on schedules, CRM/transcript import (beta, `02-beta.md`); live connectors, multi-tenancy, analytics, enterprise auth (GA, `03-ga.md`); campaign/content-production agents (V2, `04-expansion.md`). At MVP, integrations are file-drop only per `pmm-playbook/vol-6-integrations/01-integration-overview.md`.

## The Demo Script

The demo exists to prove the four value props, in order of impact. Roughly twelve minutes.

**Beat 1 — The problem (1 min).** Open from the audience's world: a sales rep has a Masterworks AI deal against a named competitor and a call in an hour. Today that means pinging a PMM and waiting days, or improvising off a stale deck.

**Beat 2 — The foundation (2 min).** Show the foundational doc for Masterworks AI in the builder — not building it from scratch live, but walking its sections: positioning, personas, objection library. One message: *one rigorous doc per product, built once, on a standardized framework.*

**Beat 3 — Ask the war room (3 min).** Three live queries, one per persona, same underlying facts, three different role-ready framings:
- Sales: "What do I say when a DOT prospect says they already have e-Builder?"
- Proposals: "Does Masterworks support federal-aid fund tracking? Give me RFP language."
- Leadership: "What's our competitive position against Kahua this quarter, in one paragraph?"
Point at the source citations under each answer. *Proves: role-ready answers, messaging consistency (same facts, never contradicting).*

**Beat 4 — Generate an asset, timed (3 min).** The headline beat. Start a visible timer. Brief the battlecard generator for the live deal from Beat 1. While it runs, narrate what the guardrails are doing (forbidden-words hook, swap test in asset-qa). Timer stops when the draft renders: **minutes, against the days-long status quo. This is the 90%-faster value prop, measured on stage, not asserted.** Then generate the exec one-pager from the same war-room facts to show consistency across asset types.

**Beat 5 — The human decides (2 min).** Show the draft watermark. Approve the battlecard as PMM admin; watch it flip to final and export clean. Try to sneak a banned phrase ("seamless") into an edit and let the hook catch it live. *Proves: governance is enforced, not promised.*

**Beat 6 — The multiplier (1 min).** Close on the math: this war room took one PMM. The same framework, repeated per product and vertical, is the 3–5× products-per-PMM claim — and a new competitive signal dropped into the war room this morning would flow to every asset from here. *Faster market response, same team.*

## Definition of Done for Today

- All five in-scope items work against the seeded war room without hand-holding.
- The Beat 4 timed generation completes in single-digit minutes, draft to screen, reliably.
- Every demo answer and asset cites real seeded sources; nothing is hard-coded demo theater.
- The forbidden-words hook demonstrably blocks a banned phrase live.
- `GTM-War-Room/HANDOVER.md` written at session end, per `CLAUDE.md` rule 7.
