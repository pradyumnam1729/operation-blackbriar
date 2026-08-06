# 02 — The Positioning → Messaging → Copy Chain

*Sources: Aatir Abdul Rauf, Zach Messler. Encoded from Master Instructions §3.2.*

---

## The Three Layers

Positioning, messaging, and copy are three distinct artifacts with a strict dependency order. Most messaging chaos in companies comes from collapsing them — writing copy directly from positioning (or from nothing) and calling the result "messaging."

| Layer | What it is | Question it answers | Varies by | Who sees it |
|-------|-----------|--------------------|-----------|-------------|
| **Positioning** | How you want to be seen: category, who it's for, what it solves, what it replaces, why it's better | *How should the market see us?* | Product line | Internal — debated with sales, product, leadership |
| **Messaging** | What you want to say: the key takeaways, built from positioning plus value propositions in the [§7.4 schema](04-value-prop-schema.md) | *What must this audience take away?* | Audience, funnel stage, channel | Internal — the bridge document |
| **Copy** | How you say it: on-brand words per channel and medium, in brand voice and tone | *What does the customer actually read?* | Asset (homepage, ad, one-pager, email) | The customer |

Positioning is an *input* to messaging. Messaging is an *input* to copy. Information flows down the chain; it never skips a layer.

---

## The Rule

> **The system never jumps from positioning straight to copy. Messaging is always the bridge.**

Why the middle layer is non-negotiable:

1. **Positioning is too abstract to write from.** "We are the intelligence layer above EAM systems" is a stance, not a sentence a buyer should read. Copy written directly from positioning produces category-speak that no specific audience recognizes as being about them.
2. **Copy without messaging is unanchored.** If the homepage, the battlecard, and the RFP response were each written directly "from the brand," they drift independently. Messaging is the shared intermediate representation that makes consistency possible at all — you cannot enforce consistency between two pieces of copy; you can enforce that both derive from the same message.
3. **Audience adaptation happens at the messaging layer.** One positioning, many messages: the same product positions once but messages differently to a DOT Director than to a county engineer, differently at top-of-funnel than in a proposal. Doing this adaptation in copy (per asset) multiplies work and error; doing it in messaging does it once per audience.

And a rule about direction of construction: **begin with deep research on audience needs, existing customers, and the product** — the chain consumes validated intelligence at the top; it is not a paraphrasing exercise.

---

## What Each Transition Adds

**Positioning → Messaging** adds:
- Value propositions in the full six-field schema (use case + context, problem, capability, value, benefit, cost of inaction)
- Audience and funnel-stage variants
- Proof points attached to claims
- Objection anticipation (fed by A4 win/loss and A1 voice-of-market)

**Messaging → Copy** adds:
- Brand voice and tone per `../../GTM-War-Room/BRAND-DNA/brand-voice.md` and `../../Voice of Aurigo - Standards Reference.md`
- Channel constraints (a LinkedIn post is not an email is not a hero headline)
- Raw customer language from `our-customer.md` — the file that makes copy non-generic
- Format and length per asset template (Vol 9)

---

## How the Chain Lives in the System

- **In the foundational doc:** positioning is the first section; the messaging library (value props in schema, per audience) is built on it. The doc's structure *is* the chain ([Vol 3, ch. 02](../vol-3-architecture/02-data-model.md)).
- **In generation:** the asset generator composes copy from messaging entries, never from positioning directly. A request for a one-pager pulls the audience's messaging variant, then renders it through the template in brand voice.
- **In validation:** the PostToolUse consistency check (§5.2) asks explicitly: does this output follow the chain? Copy that introduces a claim absent from the messaging layer is flagged — either the claim is wrong, or the messaging library has a gap to fill upstream.
- **In agent contracts:** B6 (product-to-market translator) owns positioning → messaging; activation agents producing assets own messaging → copy. No agent's contract spans the full chain in one step ([Vol 4, ch. 02](../vol-4-agent-organization/02-activation-group.md)).

---

## Failure Smells

| Smell | Diagnosis |
|-------|-----------|
| A "messaging doc" full of taglines and adjectives | It is copy wearing messaging's clothes. Rebuild from positioning with the schema. |
| The same paragraph on the homepage and in the RFP | Copy is being reused across channels instead of re-derived from messaging per channel. |
| Sales asks "what do we actually say?" after reading the positioning | Expected — positioning is not for saying. The messaging layer is missing or unfindable. |
| An asset claim with no messaging-library source | Chain skip. Trace fails; the asset does not pass the gate. |

---

*Next: [03 — Narrative Arc](03-narrative-arc.md)*

Last updated: 2026-08-06
