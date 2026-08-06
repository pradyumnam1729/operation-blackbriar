# 04 — The Value Proposition Schema

*Encoded from Master Instructions §7.4. Lives at the messaging layer of the [chain](02-positioning-messaging-copy-chain.md).*

---

## Why a Schema

A value proposition is the atomic unit of the messaging library — the thing the asset generator assembles copy from and the query engine cites when a consumer asks "why us?" If value props are free-form paragraphs, they cannot be validated, versioned, traced, or reliably rendered per audience. So each one is a structured record with six mandatory fields. A value prop with an empty field is a draft, not an entry.

---

## The Six Fields

| # | Field | What it must contain | Test |
|---|-------|---------------------|------|
| 1 | **Use case + context** | The specific scenario in the buyer's world where this applies — who is doing what, under what pressure | Could a rep recognize a live deal from this description? |
| 2 | **The problem to overcome** | What the buyer is stuck with today, concretely | Is it the buyer's problem, stated in their terms — not our product's absence? |
| 3 | **The feature/product that solves it** | The named capability, named correctly (product naming rules apply) | Exactly one named thing, not "our platform" |
| 4 | **How it delivers value (capability)** | The mechanism — what the feature actually does that changes the situation | Does it explain *how*, or just re-assert *that*? |
| 5 | **The benefit derived** | What is better in the buyer's world, in outcome terms | Would the buyer's boss care about this sentence? |
| 6 | **The cost of not solving it** | What staying stuck costs — quantified where possible | Does it create honest urgency (arc step 4)? |

Fields 1–2 are about them. Field 3 names us. Fields 4–5 connect mechanism to outcome. Field 6 makes it urgent. The order is also the persuasion order — a value prop read top to bottom is a miniature of the [narrative arc](03-narrative-arc.md).

---

## Worked Example (Aurigo, Masterworks Maintain, DOT audience)

| Field | Content |
|-------|---------|
| Use case + context | A state DOT asset management office must produce a TAMP-compliant report and defend its 10-year capital plan to FHWA and the legislature. |
| Problem | Condition data is scattered across inspection systems and spreadsheets; the capital plan cannot show its evidence trail. |
| What solves it | Masterworks Maintain — condition tracking, deterioration modeling, and TAMP report generation on one data model. |
| Capability | Every inspection feeds the deterioration model; the capital plan is generated from current condition data with the full trail from observation to funding recommendation. |
| Benefit | The agency answers "why this bridge, why now, why this amount" with evidence — transparent and accountable program delivery. |
| Cost of inaction | Non-compliant TAMP reporting risks federal funding eligibility; deferred-until-failure replacements cost three to five times planned replacement. |

Note the terminology discipline: government audience, so *program* (not portfolio), no ROI language, "FHWA" without "the." Schema validation and voice validation are separate gates; both run.

For the schema applied to our own product, see [Vol 1, ch. 03](../vol-1-product/03-value-props.md) — the four PMM Agent value props are maintained in this exact format.

---

## Authoring Rules

1. **One scenario per value prop.** If field 1 contains "and also," split it. Coverage comes from many sharp props, not a few broad ones.
2. **Field 2 is never "they lack our product."** The problem exists in the buyer's world independent of us; a problem statement that presupposes the solution is circular and fails the anti-generic check.
3. **Field 6 is researched, not invented.** Costs of inaction come from win/loss (A4), voice-of-market (A1), and customer evidence (A5). An invented number in field 6 is the most dangerous kind of guess — it will be repeated in deals.
4. **Every prop is tagged** with product, audience/persona, funnel stage, and sources — the tags drive retrieval and role-aware rendering.
5. **Every prop survives the swap test.** Run field 4 and 5 through the competitor-name swap; if they still read true, the prop is not differentiated and goes back for rework against the [positioning standard](01-positioning-standard.md).

---

## How the System Uses the Schema

- **The foundation-doc editor renders these as forms**, not free text — the six fields are input fields with validation ([Vol 3, ch. 01](../vol-3-architecture/01-system-overview.md)). This is the clearest example of "framework as product behavior."
- **The asset generator** selects props by tag (audience, stage), then renders them through channel templates: a one-pager renders fields 1→6 as a narrative block; an SDR opener may render only fields 1, 2, and 6; an RFP answer leads with 3 and 4.
- **The query engine** cites props by ID; "why do we win against Kahua on TAMP" returns the relevant props with their sources, framed per the asker's role.
- **B6 (product-to-market translator)** is the producing agent: every product update it processes terminates in new or revised schema entries — that is its definition of done ([Vol 4, ch. 02](../vol-4-agent-organization/02-activation-group.md)).

---

*Next: [05 — Business Translation](05-business-translation.md)*

Last updated: 2026-08-06
