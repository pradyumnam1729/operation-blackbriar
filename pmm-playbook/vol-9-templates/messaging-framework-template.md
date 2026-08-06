# Messaging Framework — [PRODUCT] — [SCOPE: launch / evergreen / campaign]

> **What this is.** The messaging layer — the bridge the §3.2 chain requires between approved positioning and any copy: "The system never jumps from positioning straight to copy. Messaging is always the bridge." This framework holds the key takeaways per audience, the value props in the §7.4 schema, the proof that backs them, and the tone contract per channel. Copywriters (human or agent) work from this file; they do not work from the positioning statement directly. Home: `GTM-War-Room/PLAYBOOKS-AND-ASSETS/messaging-library/` or a launch tree's `assets/messaging.md`.

```yaml
---
product: "[product line]"
audience: "[audiences covered — one framework can carry several, sectioned]"
persona: "[personas covered]"
stage: draft
sources:
  - "GTM-War-Room/[foundational doc]  # positioning must be stage: final"
  - "GTM-War-Room/BRAND-DNA/our-customer.md"
  - "GTM-War-Room/MARKET-INTELLIGENCE/voice-of-market/[validating files]"
date: [YYYY-MM-DD]
positioning_version: "[date of the positioning this derives from — stale positioning = stale framework]"
---
```

---

## Positioning Input (reference, not restatement)

> Guidance: link, don't copy — per `pmm-playbook/vol-7-ai-engineering/01-prompt-standards.md`, a pasted positioning block is a fork waiting to go stale. Confirm the upstream is approved; if positioning is draft, this framework is premature.

- **Positioning source:** `GTM-War-Room/[foundational doc]` §1, approved [YYYY-MM-DD]
- **Scope of this framework:** [what it covers; what it deliberately does not]

## Per-Audience Messaging

> Guidance — messaging "varies per audience / funnel stage / channel" (§3.2); one undifferentiated message block is the one-size-fits-all anti-pattern (§8.2). Repeat this whole section per audience. Key takeaway = the single sentence this audience must retain even if they forget everything else.

### Audience: [SEGMENT + PERSONA — e.g., public owners / Capital Program Director]

**Key takeaway (one sentence):** [what this audience must remember]

**Funnel-stage notes:** [how emphasis shifts: problem-aware → evaluating → deciding]

#### Value Propositions

> Guidance — full §7.4 schema, every field, per value prop. Compression into headlines happens at the copy layer, not here — this is the complete argument the copy will compress. Buyer language from `our-customer.md` in the problem field, verbatim.

**VP-[n]: [SHORT NAME]**

1. **Use case + context:** [the specific scenario this audience is in]
2. **The problem to overcome:** [in their words: "[verbatim]"]
3. **The feature/product that solves it:** [named, per `product-wiki.md`]
4. **How it delivers value (capability):** [the mechanism]
5. **The benefit derived:** [named, specific — the precision constant: "on-time delivery, audit readiness, budget adherence," never "greater efficiency"]
6. **The cost of not solving it:** [quantified/named stakes]

*(Repeat per value prop for this audience; then repeat the audience section per audience.)*

#### Proof Points for This Audience

> Guidance: proof matched to what *this* audience trusts (trust signals from the persona file) — a DOT director and a data-center VP are convinced by different evidence. Reference-approved only.

| Claim it supports | Proof | Source | Reference status |
|-------------------|-------|--------|------------------|
| VP-[n] benefit | [ ] | [case study path / metric] | [ ] |

#### Objections to Pre-Empt

> Guidance: from the foundational doc §9, filtered to this audience — messaging that pre-answers the known objection outperforms copy that waits for it.

- "[Objection]" → [the messaging move that defuses it]

## Tone per Channel

> Guidance — voice is constant, tone shifts by surface: encode the `Voice of Aurigo - Standards Reference.md` tone table for the channels this framework feeds. This is the contract the copy layer inherits; channel copy that ignores it fails asset-qa.

| Channel | Tone | Sentence length | Watch-outs |
|---------|------|-----------------|------------|
| Web/product page | Authoritative, specific, benefit-first | Short–medium | Buyer pain visible; outcome leads; product named correctly for vertical |
| Email (nurture) | Advisory | Short–medium | One CTA; reader's situation opens; insight before product mention |
| Sales collateral | Persuasive, outcome-specific, persona-matched | Mixed | Correct product name; specific proof point |
| Social/LinkedIn | [per brand-voice.md channel profile] | Short | [ ] |
| [Channel] | [ ] | [ ] | [ ] |

## Terminology Guard for This Framework

> Guidance: the segment-conditional rules that apply to everything derived from this file — stated here so the copy layer cannot miss them.

- [program vs. portfolio — which, per segment]
- [ROI permitted? No if public sector — "program outcomes" instead]
- [AI language: "AI-native" only; agents named specifically; Lumina as foundational engine only]
- [Other product-specific rules from foundational doc §7]

---

> **Pre-flight (delete before final):** every VP carries all six §7.4 fields? Every audience has its own takeaway? Every claim has proof or is flagged? Survives the swap test? Positioning version current? Passed `/asset-qa`?
