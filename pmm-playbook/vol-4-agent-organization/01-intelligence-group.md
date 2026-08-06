# 01 — Group A: Market & Customer Intelligence

Five agents whose shared mandate is validated insight. None of them produces buyer-facing copy — their consumers are activation agents, governance agents, and the PMM. Every output terminates in the business-translation pattern (§7.3) and, per §14, A1 and A2 syntheses carry a mandatory **roadmap implication** section for Product. Executable definitions in `../../.claude/agents/`; contract shape per agent below.

---

## A1 · Voice-of-Market (`voice-of-market.md` — exists)

| Contract | Detail |
|----------|--------|
| **Mission** | Identify buyer needs, objections, trends, and messaging gaps from customer and sales inputs |
| **Inputs** | Call transcripts (Gong/Chorus/Fathom/Granola class sources — Vol 6), customer interviews, support tickets; brand DNA for contrast against current messaging |
| **Outputs** | Voice-of-market synthesis: themes with verbatim quotes, objection candidates, messaging-gap findings, roadmap implications — each finding business-translated |
| **Destinations** | `GTM-War-Room/MARKET-INTELLIGENCE/voice-of-market/`; proposed additions to `BRAND-DNA/our-customer.md` (raw language) and the objection library — proposals, never direct edits (§8.5) |
| **Cadence** | Weekly batch ([Vol 5, ch. 06](../vol-5-operating-model/06-always-on-programs.md)) |
| **Consumers** | B6 (translator), C11 (messaging-effectiveness), A2, A4 |

The distinctive obligation: **preserve verbatim language.** A1 that summarizes has destroyed its own cargo — `our-customer.md` runs on quotes, not paraphrase ([Vol 2, ch. 07](../vol-2-domain-knowledge/07-war-room-model.md)).

## A2 · ICP & Persona Intelligence (`icp-persona.md` — exists)

| Contract | Detail |
|----------|--------|
| **Mission** | Refine target segments and personas using customer, usage, and opportunity data; JTBD alongside persona methods ([Vol 2, ch. 06](../vol-2-domain-knowledge/06-jtbd-and-icp.md)) |
| **Inputs** | Win/loss record (A4), voice-of-market themes (A1), CRM/opportunity data (Vol 6), existing persona docs |
| **Outputs** | Validated ICP with evidence and date; persona files (pains, triggers, objections, vocabulary, sources); job statements linked to personas; segmentation implications; roadmap implications |
| **Destinations** | `MARKET-INTELLIGENCE/icp-personas/`; proposed updates to `personas.md` and `BRAND-DNA/positioning-and-icp.md` |
| **Cadence** | Quarterly validation + on-demand for new-segment work |
| **Consumers** | All B agents; positioning work; C14 (segment priorities) |

Quality gate: personas earn existence by being referenced — A2 recommends merges and retirements, not just additions (anti persona-overload, §8.2).

## A3 · Competitive Intelligence (`competitive-intel.md` — exists)

| Contract | Detail |
|----------|--------|
| **Mission** | Track competitor moves and translate them into positioning and sales implications |
| **Inputs** | Public web (pricing pages, release notes, G2 reviews, job postings, analyst coverage); `competitors.md`; win/loss competitive reasons (A4); baseline landscape in `../../engineering-playbook/vol-1-company/06-competitive-landscape.md` |
| **Outputs** | One dossier per competitor (snapshot → dated moves → claimed differentiation → where we/they win → landmines both directions → implications → battlecard update recommendations); weekly brief on sweep |
| **Destinations** | `MARKET-INTELLIGENCE/competitive/<competitor>.md`, `weekly-brief-YYYY-MM-DD.md`; proposed updates to `competitors.md` and affected battlecards |
| **Cadence** | Weekly sweep + event-triggered (competitor launch, pricing change, analyst report, sales escalation) |
| **Consumers** | B8 (the battlecard loop: win/loss in → competitive shifts in → dead cards out), B6, A4 |

Quality gates worth repeating org-wide: every claim carries a source and date (no folklore); a weakness that applies to every vendor in the category is not intelligence; findings feed maturity-model framing, never trash-talk (arc step 5).

## A4 · Win/Loss Intelligence (contract — file to be authored as `win-loss.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Identify why deals are won, lost, or stalled; surface buyer language, decision drivers, trust signals, objections |
| **Inputs** | Win/loss interviews, CRM opportunity data (Vol 6), sales debriefs; A3 dossiers for competitive-loss context. For the seed customer, the framework already operating in `engineering-playbook/vol-1-company/06-competitive-landscape.md` ("Why Aurigo Loses", the 21-day debrief protocol) is both input and model |
| **Outputs** | Monthly win/loss synthesis: reason taxonomy with frequencies, verbatim buyer language, competitive patterns, messaging and enablement implications — business-translated with named metrics |
| **Destinations** | `MARKET-INTELLIGENCE/win-loss/`; proposed updates to battlecards (via A3/B8), `our-customer.md`, positioning claims |
| **Cadence** | Monthly |
| **Consumers** | B8, A1, C11, C13; Leadership (translated) |

## A5 · Customer Evidence (contract — file to be authored as `customer-evidence.md`)

| Contract | Detail |
|----------|--------|
| **Mission** | Surface validated proof points, measurable outcomes, reference candidates, case-study opportunities; track evidence by persona, segment, use case |
| **Inputs** | Customer outcomes data, CS signals, A4 wins, existing case studies |
| **Outputs** | Evidence register (claim ↔ proof ↔ customer ↔ consent status); case-study briefs; proof-point packs per persona/segment feeding value-prop field 6 and arc step 7 |
| **Destinations** | `GTM-War-Room/PLAYBOOKS-AND-ASSETS/case-studies/`; evidence tags consumed by the asset generator |
| **Cadence** | On-demand + monthly refresh |
| **Consumers** | B8 (deal proof), B7 (launch proof), B9 (expansion stories) |

The register's discipline: **no proof, no claim.** A claim in the foundation without an evidence-register entry is flagged by C12 as unsupported.

---

*Next: [02 — Activation Group](02-activation-group.md)*

Last updated: 2026-08-06
