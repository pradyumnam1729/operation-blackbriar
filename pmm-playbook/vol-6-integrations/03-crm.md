# Chapter 3 — CRM

**Volume 6 · PMM Agent Playbook · 2026-08-06**

---

## What This Source Is For

The CRM is where messaging meets money. Call intelligence tells us what buyers say; the CRM tells us what they did — which deals closed, which stalled, at what stage, against which competitor, and with which of our assets in play. Two intelligence programs depend on it:

1. **Win-loss analysis** (win-loss agent, A4, monthly per Master Instructions §11): why deals are won, lost, or stalled, correlated with interview data.
2. **Messaging effectiveness** (messaging-effectiveness agent, C11, monthly): whether approved messaging is actually used in deals and whether it moves them.

Without CRM data, both programs run on anecdote. With it, the system can answer the questions leadership actually asks: does the new Masterworks AI positioning correlate with better stage conversion? Which battlecard shows up in won deals? Is the asset usage rate — the % of deals where PMM collateral is used, the system's production metric per `pmm-playbook/vol-7-ai-engineering/04-evals.md` — going up?

## What We Pull

Salesforce is the reference CRM (Aurigo's own stack). The fields below are the contract; any CRM that can export them works.

| Data | Fields | Feeds |
|------|--------|-------|
| Opportunity core | Account, segment (public owners / facility owners), product line (Masterworks, Essentials, Primus), amount, stage, close date, outcome | Win-loss base table |
| Stage history | Stage entry/exit dates, time-in-stage | Stage-conversion analysis; where messaging stalls |
| Competitive field | Named competitor(s) on the deal | Win-loss by competitor; battlecard prioritization |
| Loss reason | Rep-entered reason code + free text | Win-loss coding (treated as a hypothesis, validated against interviews) |
| Asset activity | Which PMM assets were attached, sent, or presented per opportunity | Asset usage rate; messaging-effectiveness correlation |
| Contact roles | Buyer roles on the deal (economic buyer, champion, end user) | Persona validation for the icp-persona agent |

**MVP path:** a monthly opportunity report exported to CSV, dropped into intake, normalized into `GTM-War-Room/MARKET-INTELLIGENCE/win-loss/`. **GA path:** scheduled sync, with closed-won/closed-lost events triggering the win-loss agent immediately rather than waiting for the monthly batch.

## Win-Loss: How CRM Data Gets Used

CRM data frames the win-loss program; interviews fill it in. The monthly run:

1. Builds the month's closed-deal table: outcome, segment, product line, competitor, amount, cycle length, stage where lost deals died.
2. Compares against the trailing baseline: win rate by segment, by competitor, by deal size band.
3. Selects interview candidates — the interesting deals: losses to a named competitor, wins against the run of play, stalls at the same stage three deals in a row. The interview itself follows `pmm-playbook/vol-9-templates/win-loss-interview-guide.md`.
4. Writes the monthly win-loss note to `MARKET-INTELLIGENCE/win-loss/`, translating per §3.3: every finding lands as insight → action → named metric → stakeholder.

Rep-entered loss reasons are a starting hypothesis, never a conclusion. "Price" as a loss code usually decodes, on interview, into "didn't believe the value at that price" — a messaging problem, not a pricing problem. The CRM tells us where to dig; interviews tell us what is actually there.

## Messaging Effectiveness: How CRM Data Gets Used

The messaging-effectiveness agent joins asset activity to outcomes:

- **Asset usage rate.** Of deals active this month, in what % was any approved PMM asset used? This is the honest adoption metric: if sales does not pull the assets, nothing downstream matters.
- **Usage-to-outcome correlation.** Do deals where the battlecard was used convert stage 3→4 at a higher rate? Correlation, not causation — reported as such, but a battlecard nobody uses in won deals and everybody used in lost ones is telling us something.
- **Stage-stall mapping.** Deals consistently dying at the same stage against the same competitor points at a specific asset gap (usually an objection unanswered), which routes to the sales-enablement agent as a prioritized fix.

Findings are framed in the stakeholder's metric language (§3.3): win rate and deal velocity for sales leadership, pipeline and NRR for the exec brief.

## Rules

1. **Aggregate in the war room, detail in the CRM.** War-room win-loss files carry patterns, segment-level numbers, and anonymized deal references. Full account detail stays in the CRM. Any deal cited for customer-facing proof goes through the customer-evidence agent's reference-approval check first.
2. **Absolute periods.** Every analysis names its window (e.g., 2026-07-01 to 2026-07-31), never "last month."
3. **Small-number honesty.** Aurigo's enterprise deal volume is modest; a month with four closed deals does not support a percentage claim. Report counts, and only claim trends across quarters.
4. **No raw dumps.** CRM exports are intake material. Only synthesized, translated notes land in `MARKET-INTELLIGENCE/win-loss/`.
5. **Segment discipline.** Public-sector and commercial deals are analyzed separately. A blended win rate across Masterworks and Primus hides more than it shows, and the messaging implications never blend.
