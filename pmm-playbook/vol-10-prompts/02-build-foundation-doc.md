# 02 — Build the Foundational Doc

## When to Use

- A product enters the war room and needs its foundational doc — the standardized framework the PMM Agent exists to enforce.
- A full refresh: positioning change, ICP shift, or the quarterly review found the doc stale.
- The `/foundation-doc` skill encodes this brief with the workflow attached; use the skill in operating sessions, this brief when working manually or adapting it.

## The Brief

Replace `[PRODUCT]`. Paste in full:

---

I want to build the foundational doc for **[PRODUCT]**. Read all brand files first. Ask me clarifying questions using AskUserQuestion before you execute. Do not guess.

**Context.** Read, in order:
1. `GTM-War-Room/product-wiki.md` and `GTM-War-Room/personas.md`
2. `GTM-War-Room/MARKET-INTELLIGENCE/voice-of-market/` and `GTM-War-Room/MARKET-INTELLIGENCE/win-loss/` — the validated intelligence this doc must rest on (§3.1: intelligence before activation)
3. `GTM-War-Room/MARKET-INTELLIGENCE/competitive/` — current dossiers
4. `pmm-playbook/vol-9-templates/foundation-doc-template.md` — the structure, exactly

**End state.** `GTM-War-Room/[product]-foundation.md` per the template: all nine sections filled — positioning (Dunford formula, §7.1), ICP, personas with verbatim language, JTBDs, value props in the full §7.4 schema, competitive summary with dossier citations, brand guardrails specific to this product, proof points with reference status, objection library with evidence. Frontmatter complete, `stage: draft`, template guidance blocks deleted.

**Constraints.**
- Positioning first, and debated: draft the §1 positioning statement, present it to me with the anti-pattern check applied (reject any claim a competitor could equally make), and get my confirmation before filling the downstream sections — everything else derives from it.
- Verbatim or gapped: persona quotes and objections come from `our-customer.md`, transcripts, or win-loss files with citations. No evidence, no entry — write a `> GAP:` marker instead.
- Every product claim traces to `product-wiki.md`; every competitive claim to a dated dossier; every proof point carries reference status.
- Swap test on §1, §5, and §6 before you present the draft: replace "Aurigo" with "Oracle"/"Kahua" and rewrite whatever survives.
- Run `/asset-qa` on the completed draft and include the results.

---

## Expected Output

- The complete foundational doc at `stage: draft`, with asset-qa results attached.
- A gap list for sections the intelligence could not support, each routed to the pipeline that closes it.
- Proposed updates (per §8.5) to any war-room file the build surfaced corrections for.

## Follow-Ups

- PMM admin review and approval (§8.4) — the doc is the upstream of everything; it gets the most careful review in the system.
- Once final: messaging frameworks (`pmm-playbook/vol-9-templates/messaging-framework-template.md`) can be built per audience; battlecards and one-pagers unlock.
- Log the refresh trigger conditions in the doc's maintenance log; the content-governance agent watches them.
