# AI Cost Management

AI-assisted engineering has variable direct costs. Unlike compilers, IDEs, or CI runners, every prompt has a metered price attached. At scale — dozens of engineers running Claude Code sessions daily — cost governance becomes an engineering-leadership responsibility, not an afterthought. Left unmanaged, AI spend at Aurigo could easily reach five to six figures per month with no clear line between cost that produced value and cost that was waste.

This document defines Aurigo's AI cost governance model: per-engineer budgets, monitoring, attribution, cost-optimization techniques, escalation paths when spend exceeds budget, and the review cadence that keeps the model working.

The principle: **AI cost should scale with value delivered, not with sloppy usage.** An engineer spending $500 a month on Claude and shipping three features a sprint is delivering ROI. An engineer spending $500 a month running redundant discovery sessions on the same files day after day is not.

---

## Token Pricing Reference

Model pricing changes over time. The current list, valid as of this document's Last Reviewed date, is maintained in `docs/ai-costs/pricing-current.md`. The relative ratios are more stable than the absolute prices and are used for engineering decisions.

**Approximate relative cost per input token (with prompt caching applied):**

| Model | Input cost | Output cost | With cache write | With cache hit |
|-------|-----------|-------------|------------------|----------------|
| claude-haiku-4-5 | 1x | 5x | 1.25x | 0.1x |
| claude-sonnet-4-6 | ~4x | ~20x | 5x | 0.4x |
| claude-opus-4-7 | ~20x | ~100x | 25x | 2x |

The ratio Aurigo engineers should internalize: **a cache hit is roughly a 90% discount on the input token cost.** Prompts that are re-used with the same prefix (CLAUDE.md, common context blocks) are dramatically cheaper when caching is enabled. See "Cost Optimization Strategies" below.

Output tokens are the more expensive dimension across all models. Prompts that ask for very long output (a full architecture review of a large diff, an extensive code generation task) are dominated by output cost, not input cost.

---

## Cost per Engineering Task Type

The following are Aurigo's observed cost ranges per task type on Sonnet at typical prompt lengths. Numbers are approximate and update quarterly.

| Task Type | Typical Cost | Notes |
|-----------|--------------|-------|
| Quick question with codebase context | $0.03 - $0.10 | Cheapest; benefits most from caching |
| Single handler + validator + unit tests | $0.20 - $0.50 | Standard implementation task |
| Full feature (BE + FE + tests) | $1.50 - $4.00 | If done in a single long session; better decomposed |
| Full repository discovery (Level 3) | $0.50 - $2.00 | Cache the CLAUDE.md and ADRs to reduce cost |
| Architecture review of a PR | $0.30 - $1.20 | Depends on diff size |
| RFC drafting | $0.50 - $2.00 | Opus recommended; expect 3-5x cost |
| Prompt engineering / iteration | $0.10 - $0.30 per iteration | Consider using Haiku for early iteration |
| Test generation for a calculation engine | $0.10 - $0.40 | Very cost-effective — high output value |
| Refactoring across 10 files | $1.00 - $3.00 | Break into per-file agents if possible |

Costs above $5 for a single task should surface as a signal to review the approach. Either the task is doing too much, or the prompt is inefficient, or the wrong model was chosen.

---

## Budget Model

### Per-engineer budgets

| Role | Default monthly budget | Rationale |
|------|------------------------|-----------|
| Individual Contributor (junior/mid) | $150 | Standard daily usage; caching keeps this comfortable |
| Senior Engineer / Tech Lead | $250 | Higher volume of architecture and review work; some Opus usage |
| Engineering Manager | $200 | Heavier RFC and review work; less code generation |
| Principal / Staff Engineer | $350 | Significant Opus usage for cross-cutting design |
| Product Manager (using Claude for PRDs, backlog) | $80 | Mostly Sonnet, moderate volume |
| Designer (occasional prompt use) | $50 | Ad-hoc |

Budgets are per-engineer, not per-team. Team leaders track team aggregate spend but do not gate individual engineers on within-budget usage.

### Feature-level budgets

For large features or research programs (any effort >2 sprints of engineering), a feature-level AI budget is included in the PRD. The budget is tracked separately from engineer budgets and represents the additional AI spend expected for this specific effort.

Example: An RFC-driven exploration of the digital twin architecture (Innovation Roadmap #1) has an AI budget of $1,500 for a 2-week prototype phase. This tracks separately so that engineers assigned to it are not caught in a personal budget overrun.

### Team envelope

Each product team has an aggregate monthly envelope (roughly the sum of per-engineer budgets plus 20% headroom). If a team's aggregate is at 80% of envelope mid-month, the EM investigates before the last week.

---

## Cost Monitoring

### Data source

Anthropic's Console usage dashboard is the source of truth for spend. Aurigo pulls the daily usage export via the Anthropic Usage API and stores it in the `ai-cost-monitor` internal service. This enables attribution beyond what the Console UI provides.

### Attribution

Every Claude Code session emits usage data tagged with:
- **Engineer email** (from the API key metadata)
- **Model** (Haiku / Sonnet / Opus)
- **Session ID** (correlates all messages in a session)
- **Task tag** (optional, engineer-supplied; enables per-feature attribution)

Task tagging is opt-in but strongly encouraged for any work above 1 hour. Convention: `[FEATURE_ID]` at the start of the first user message in a session, or set via the `--tag` flag. This enables per-feature and per-story cost analysis at retrospective.

### Reports

**Daily dashboard.** Team leads see a daily summary of team spend by model.

**Weekly report.** Engineering Director receives a weekly report: total spend, spend by team, top-10 sessions by cost, notable anomalies.

**Monthly review.** First Monday of each month, the Engineering Director reviews the prior month's total. Per-engineer overages are flagged. Consistent overspend is discussed with the engineer's manager — this is a coaching conversation about workflow efficiency, not a punishment.

**Per-story cost.** Where task tagging was applied, the sprint retrospective includes AI cost per completed story. This surfaces stories where AI usage was heavy relative to output (candidates for prompt improvement) or where AI usage was efficient (patterns to replicate).

---

## Cost Optimization Strategies

The following strategies reduce cost without reducing quality. All Aurigo engineers should know them.

### 1. Prompt caching

Prompt caching provides ~90% discount on repeated prefixes. Aurigo's usage pattern:

- The stable prefix (CLAUDE.md, primary ADRs, project structure summary) is cached at the start of every session.
- The prefix is refreshed only when the underlying files change — usually a weekly rhythm.
- Any long-lived agent (architecture review agent, monthly code quality scan) uses caching for its system prompt.

Caching is enabled by structuring the prompt with stable content at the top and variable content at the bottom. The Claude Code CLI handles this automatically when the CLAUDE.md structure is respected.

### 2. Model tier down when possible

The model selection decision tree in `02-claude-code-standards.md` guides this. Common wasted spend patterns:
- Using Opus for CRUD scaffolding (Sonnet is sufficient)
- Using Sonnet for a one-line factual question (Haiku is sufficient)
- Using Opus for iteration on a prompt (Haiku is sufficient for the iteration; move to Sonnet or Opus for the final run)

The rule: **use the cheapest model that produces the required quality**, not the most powerful model available.

### 3. Prompt efficiency

- Front-load constraints; don't burden the model with pages of context it does not need for the specific task.
- Reference files by path instead of pasting file contents. Pasting a 500-line file costs 5-10x more than telling the agent to read it and letting caching handle repeated reads.
- Break large tasks into agents with focused contexts. A 30-minute Sonnet session on one large problem often costs more than three 10-minute Sonnet sessions on parts of the problem, because context accumulates.

### 4. Session hygiene

Long sessions accumulate context. Once a session has read 50 files, every subsequent prompt processes those 50 files' worth of tokens. Start fresh sessions for unrelated tasks. Use memory files to bridge context between sessions rather than keeping the same session alive for a day.

### 5. Avoid redundant discovery

The Level 1 / Level 2 / Level 3 indexing framework in `07-repository-indexing.md` exists partly to avoid redundant discovery. If yesterday's session indexed the Inspections module and saved the summary to memory, today's session should not re-index it. Load the summary from memory instead.

### 6. Cache-friendly file organization

Files that are read in many prompts (CLAUDE.md, primary ADRs, key entities) benefit most from caching. Keep them stable. A CLAUDE.md that is edited daily loses the caching discount.

### 7. Batch when appropriate

For tasks that need to run over many items (generate tests for 20 handlers, review 50 files for a specific pattern), the Anthropic Batch API is 50% cheaper than real-time. Use it for anything that does not need immediate results. Aurigo's monthly code quality scan is a batch job.

---

## When Costs Exceed Budget

### Individual overage (single month, single engineer)

Not a problem by itself. Engineers who are heads-down on a hard problem often burn budget for a stretch. The Engineering Manager notes it in the monthly review; if it recurs next month, they have a conversation.

### Sustained overage (2+ consecutive months, same engineer)

Coaching conversation. Not disciplinary. Common findings:
- Engineer is defaulting to Opus for tasks that Sonnet would handle (fix: model selection guidance).
- Engineer is using long sessions and re-reading the same files (fix: session hygiene training).
- Engineer is not using the memory system (fix: memory setup review).
- Engineer's projects genuinely require high AI usage and the budget should be adjusted (fix: budget change request).

### Team envelope overage

Engineering Manager reviews the top-cost sessions from the team's month. Common findings:
- One large research effort (e.g., a spike) consumed more than allocated. Reallocate to feature-level budget going forward.
- A specific prompt is inefficient and is being run frequently. Fix the prompt in `vol-10-claude-prompts/` — the improvement benefits everyone.
- A CI-hosted agent (autonomous testing, architecture review) is running more often than expected. Reduce trigger frequency.

### Company-wide overage

Engineering Director communicates the situation. Options:
- Freeze new discretionary AI features (research, exploration) until the next month.
- Tighten model selection guidance (temporarily default certain task types to Sonnet only, no Opus).
- Investigate whether the overage is signal (we're getting more value from AI, budget should grow) or noise (we're just being sloppy).

There is no automated cutoff. Cutting off an engineer mid-task destroys more value than the overage costs.

---

## Cost Attribution Reports

Monthly, Engineering leadership receives an attribution report showing:

**By team:**
- Total spend
- Model mix (Haiku / Sonnet / Opus share)
- Spend per engineer average
- Spend per story point completed (rough productivity signal)

**By feature (where task tagging was used):**
- Total spend for the feature
- Ratio of AI spend to engineer time saved (self-reported and rough)
- Notable patterns (e.g., "this feature had 3x higher AI spend than a comparable feature — investigate why")

**By task type:**
- Which task types (implementation, review, refactoring, testing) consumed the most spend
- Trend over time

These reports drive the quarterly AI ROI conversation between Engineering leadership and the CFO's office.

---

## Cost Optimization Roadmap

Aurigo's cost efficiency improves over time as tooling and practice mature. The current roadmap:

**Q1 - Baseline.** Full attribution in place. Monthly per-engineer reporting.

**Q2 - Caching audit.** Verify prompt caching is being used across all agents. Add caching to any prompt that runs more than 10 times per week.

**Q3 - Batch pipeline.** Move all non-realtime AI workflows (monthly scan, weekly documentation refresh, nightly test-coverage analysis) to the Batch API.

**Q4 - Automated cost regression detection.** Alert when a specific prompt's per-run cost increases by more than 25% between weeks — usually a signal that the prompt has drifted longer or is caching less.

---

## Related documents

- Model selection guidance: `02-claude-code-standards.md`
- Prompt efficiency: `01-prompt-engineering.md` (Token Efficiency section)
- Memory to reduce redundant discovery: `05-shared-memory.md`
- Indexing to reduce redundant re-reads: `07-repository-indexing.md`
- Anthropic Console: https://console.anthropic.com (internal only — link to the shared team account)
