---
stage: draft
date: 2026-08-06
sources:
  - ".claude/hooks/forbidden-words.txt"
  - "Voice of Aurigo - Standards Reference.md (June 2026)"
  - "PMM Agent — Master Instructions & Contex.md (§5, §8, §10)"
---

# GTM Rules — operating constraints for every agent

Never sound like a SaaS brochure. These rules are enforced; the PostToolUse hook rejects writes that violate the forbidden list.

## Forbidden words and phrases (mirror of `.claude/hooks/forbidden-words.txt`)

hassle-free · effortlessly · seamless · circle back · single source of truth · best-in-class · cutting-edge · world-class · game-changing · AI-powered · AI-driven · AI-enabled · AI-based · lifecycle (one word) · infrastructures · infrastructure owners · on the cloud · on the field · paper trail · public agencies · best regards · warm regards · kind regards · feel free to reach out · hope this finds you well · looking forward to hearing from you · know more

Standard replacements: "lifecycle" → **life cycle** (two words, always) · "single source of truth" → **unified system** (BUILD/delivery context only, never PLAN) · "AI-powered/driven/enabled/based" → **AI-native** (sole approved modifier; "AI-powered" allowed only in meta descriptions/SEO fields, never body copy) · "infrastructure owners" → **capital owners / public owners / facility owners** · "public agencies" → **government agencies** · "paper trail" → **paper-based audit trail** · "on the cloud/field" → **in the cloud / in the field** · "know more" → **learn more**.

## Terminology rules (apply before any content is approved)

- **Life cycle** — two words, always: capital life cycle, asset life cycle, project life cycle.
- **Program vs. portfolio** — *program* in public-sector content (Masterworks, Essentials); *portfolio* in commercial content (Primus). A state DOT manages a program; a data center VP manages a portfolio. Flag any swap.
- **Audience terms** — capital owners (umbrella only, never a single segment); public owners = government agencies (federal + state & local); "local and regional agencies" for Essentials buyers (never "small and medium"); facility owners for Primus only. Retired: the banned two-word owner term above.
- **No "ROI" in public-sector content** — use "program outcomes" or "capital program performance." ROI is fine in Primus/commercial content.
- **No "the" before org abbreviations** — "NDOT manages...", "FHWA requires...", never "the NDOT."
- **AI messaging** — AI-native only. Name agent types specifically (Risk Prediction Agent, Funding Agent), never generic "Agent." Lumina is the foundational engine, not a standalone product; "Masterworks AI, powered by Lumina" is the ONLY approved "powered by" construction. Public sector: "do more with the same people" — never headcount reduction. Deterministic/inference framing: ~60% of capital program work is deterministic (agents handle it); ~40% is inference and humans stay in the loop.
- **Other usage** — infrastructure is uncountable; right of way unhyphenated standalone ("right-of-way management" acceptable attributively); do not pluralize contingency/cash flow/validation; avoid "on time, on budget" as a standalone claim; "defensible" never in government-sector content ("transparent and accountable program delivery"); "end users" not "clients" in public sector; "such as" not "like" in Enterprise voice; "in the field," "in the cloud."
- **American English only** — learn more, toward, American spellings. No filler closers. Binary contrast framing max once per piece; em dashes max one to two per external page.

## Output format rules

Every produced asset is markdown with frontmatter:

```yaml
---
product: masterworks | essentials | primus | lumina | masterworks-ai
audience: public-owners | facility-owners | capital-owners
persona: (from personas.md, e.g. capital-program-director)
stage: draft | final
sources: [files/transcripts/docs actually used]
date: YYYY-MM-DD
---
```

- Positioning → messaging → copy chain, in order. Never jump from positioning straight to copy.
- Every claim passes the swap test (Oracle/Microsoft/Kahua) and uses raw language from our-customer.md.
- No invented customer quotes, win rates, or numbers. If a number is not in a source, flag it as a placeholder.
- No firm pricing externally (pricing not locked). Competitive claims stay internal until cleared.

## Draft → final gate (Master Instructions §8.4)

All outputs are written as `stage: draft`. Promotion to `stage: final` requires PMM admin approval after the anti-generic checklist: could this belong to another brand? forbidden words? actual customer language? claim a competitor could equally make? The system proposes; the human decides.

## Stage-aware behavior

Read `../about-me.md` for current stage. Aurigo operates on the **$15M → $100M+ enterprise playbook** (Master Instructions §10): multi-product narrative, analyst relations, pricing/packaging, expansion motions — not founder-led 0→$2M plays. Channel mix, launch tiers, and messaging complexity calibrate accordingly.

## Validation status

- Sourced: forbidden list mirrors the hook file verbatim; terminology rules from the June 2026 voice standards; gates from the Master Instructions.
- Placeholder: frontmatter taxonomy values (product/audience/persona enums) are a proposed convention — PMM admin to ratify.
