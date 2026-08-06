# 06 — JTBD & ICP

*Sources: JTBD framework (various practitioners), persona methods per Master Instructions §12 (A2's mandate). Consumed by every activation agent.*

---

## Two Instruments, One Subject

The ICP (ideal customer profile) and personas answer *who*; jobs-to-be-done answers *why now and toward what*. The PMM Agent uses both, deliberately, because each covers the other's blind spot:

| Instrument | Unit of analysis | Answers | Blind spot |
|------------|-----------------|---------|------------|
| **ICP** | The account | Which organizations we serve best: segment, size, stage, regulatory context, stack | Says nothing about the humans or the moment of purchase |
| **Personas** | The person | Who influences and decides: pains, goals, buying triggers, objections, vocabulary | Can decay into demographic trivia detached from purchase behavior |
| **JTBD** | The job | What progress the buyer is trying to make, in what circumstance, against what anxieties | Says nothing about which accounts to target or who signs |

A2 (icp-persona agent, `../../.claude/agents/icp-persona.md`) owns all three, using JTBD alongside traditional persona methods — not instead of them.

---

## JTBD, the Working Version

A job statement has a fixed grammar:

> **When [circumstance], I want to [motivation], so I can [expected outcome].**

Example, Aurigo buyer: *"When my legislature questions next year's capital program, I want to show the condition evidence behind every funded project, so I can defend the program without relying on my staff's memory."*

Example, our own buyer: *"When my portfolio doubles but my PMM team doesn't, I want every role to get approved answers without queuing on one person, so I can grow coverage without growing headcount linearly."*

Working rules:

1. **Jobs are stable; solutions churn.** The DOT director's job predates Aurigo and will outlive any product cycle. Positioning against a job ages far better than positioning against a feature gap.
2. **Circumstance is the trigger.** The "when" clause is what makes JTBD actionable for SDR sequencing and campaign timing — it names the moment the buyer becomes a buyer.
3. **Capture forces, not just desire.** Every job carries a push (pain of the status quo), a pull (appeal of the new), anxiety (what could go wrong), and habit (inertia of the current way). Anxieties and habits are objection-handling fuel; §7.2 step 5 and battlecard landmines come straight from here.
4. **Jobs come from evidence.** Sources: win/loss interviews (A4), call analysis (A1), customer interviews. A job statement without a source quote in `our-customer.md` is a hypothesis, labeled as such.

---

## Personas, Kept Honest

Personas in the war room (`../../GTM-War-Room/personas.md`, `MARKET-INTELLIGENCE/icp-personas/`) are named buyer roles with: pains, goals, buying triggers, objections, and — critically — their exact vocabulary. The §8.2 warning applies: **persona overload docs are an anti-pattern**. A persona earns its existence by being referenced in messaging tags and asset requests; a persona nothing is tagged to gets merged or retired at the quarterly validation.

The test for a healthy persona file: could an SDR write a credible pain-first opener from it in five minutes? If not, it is a demographics sheet, not a persona.

---

## The ICP, Continuously Validated

The ICP is not written once. A2 runs **quarterly validation** (§11) against customer, usage, and opportunity data: which segments actually close, retain, and expand? Stale ICP decks are on the §8.2 avoid list for good reason — an ICP that no longer matches the win/loss record silently misroutes every downstream choice, from campaign targeting to battlecard priorities.

Validation output follows [business translation](05-business-translation.md): not "the ICP has shifted" but "mid-size regional agencies close 2× faster than federal — shift SDR capacity accordingly — pipeline velocity — Sales."

---

## How the Three Combine in the Foundational Doc

The foundational doc's ICP/JTBD section ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)) holds:

- The ICP definition with its evidence and last-validated date
- Named personas, each with pains, triggers, objections, vocabulary, and sources
- Job statements linked to personas and to the value props that serve them

The linkage is what pays: a query like "how do I open with a county engineer evaluating pavement tools?" resolves persona → jobs → value props → raw language, and the answer assembles itself with citations. Roadmap implication sections are mandatory in A2 and A1 syntheses (§14) — ICP/JTBD findings feed Product, not just Marketing.

---

## Failure Smells

| Smell | Diagnosis |
|-------|-----------|
| Personas with stock photos and age ranges | Demographic theater. Rebuild from call evidence. |
| A job statement mentioning our product | Jobs are product-independent by definition. Rewrite. |
| ICP unchanged for four quarters while win/loss shifted | Validation skipped. Run A2. |
| Messaging tagged to personas nobody queries | Persona overload. Merge or retire. |

---

*Next: [07 — War-Room Model](07-war-room-model.md)*

Last updated: 2026-08-06
