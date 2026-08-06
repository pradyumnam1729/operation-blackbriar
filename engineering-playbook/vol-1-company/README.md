# Volume 1 — Company

This volume defines who Aurigo is, what we build, why we build it, and how we think. Every engineer at Aurigo should read this volume during onboarding and return to it whenever a decision feels ambiguous. The documents here are not marketing material — they are the intellectual foundation of the engineering organization.

---

## Contents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Vision & Mission](01-vision-mission.md) | The long-term aspiration and the specific mission that drives daily work. Why lifecycle continuity matters, what the world looks like when Aurigo wins, and how engineers connect their daily code to a 10-year outcome. |
| 02 | [History](02-history.md) | Aurigo's founding story, the evolution from on-premise capital program management to cloud-native SaaS, and the strategic decisions that led to building Maintain. A 20-year arc of domain depth that competitors cannot replicate. |
| 03 | [Product Strategy](03-product-strategy.md) | The Infrastructure Lifecycle Platform strategy. Why Plan + Build + Maintain is a defensible moat, how the three deployment modes work, the land-and-expand sales motion, and how AI amplifies every phase of the platform. |
| 04 | [Market](04-market.md) | Full market analysis for both public sector (Masterworks) and private sector (Primus). Covers IIJA, TAMP mandates, vertical-specific private sector dynamics, TAM/SAM/SOM analysis, and buying process differences. |
| 05 | [Customers](05-customers.md) | Detailed persona analysis for the 8 primary buyer and user personas across public and private sectors. Includes role definitions, pain points, jobs-to-be-done, and success metrics for each. |
| 06 | [Competitive Landscape](06-competitive-landscape.md) | Full competitive analysis covering EAM platforms (Maximo, SAP, Oracle, Cityworks), CMMS tools (MaintainX, UpKeep), capital program management competitors (Oracle Unifier, Kahua, e-Builder, Procore), and why Aurigo wins. |
| 07 | [Success Metrics](07-success-metrics.md) | The complete metrics framework: business metrics (ARR, NRR, CAC, LTV), product metrics (adoption, data quality, AI utilization), engineering metrics (DORA, test coverage, AI productivity multiplier), and customer success metrics. |
| 08 | [Core Values](08-core-values.md) | Aurigo's seven engineering core values — written not as slogans but as behavioral standards with concrete examples of what good looks like and what anti-patterns to avoid. |
| 09 | [Engineering Culture](09-engineering-culture.md) | How engineering works at Aurigo: AI-native collaboration, documentation-first culture, code review standards, blameless post-mortems, onboarding expectations, and the anti-patterns that erode culture over time. |
| 10 | [AI Strategy](10-ai-strategy.md) | Aurigo's three-layer AI strategy: AI-assisted development (Claude Code + defined agent roles), AI-powered product (Maintain's intelligence layer), and autonomous engineering (2026+ roadmap). Includes AI safety principles and guardrails. |

---

## How to Read This Volume

Read documents 01 through 03 first — they establish context that makes everything else coherent. Documents 04 and 05 ground the strategy in real market dynamics and real customer pain. Documents 06 and 07 make the strategy testable. Documents 08 through 10 describe how Aurigo engineers operate day-to-day.

This volume is a living document. When the company makes a strategic pivot, an ADR should reference the relevant volume and explain what changed and why. The history of those changes is as valuable as the current state.

---

## Audience

| Reader | What to focus on |
|--------|------------------|
| New engineer (week 1) | Read all 10 files in order. Confirm mental model in a 1:1 with your manager. |
| Product manager | 01, 03, 04, 05, 06, 07 — everything that shapes the "why" of the roadmap. |
| Sales / CS | 04, 05, 06, 07 — market, personas, competition, and how we measure customer success. |
| Executive / board | 01, 03, 04, 07, 10 — vision, strategy, market, metrics, AI leverage. |
| AI agents (Claude Code) | 01, 03, 08, 10 — vision, product strategy, values, AI operating model. Use these as system context. |

---

## Cross-References to Other Volumes

| If you are asking… | Go to |
|--------------------|-------|
| What are we building? | [Volume 2 — Product Knowledge](../vol-2-product-knowledge/README.md) |
| How do we build it? | [Volume 3 — Architecture](../vol-3-architecture/README.md) |
| How is the AI-native org structured? | [Volume 4 — AI Organization](../vol-4-ai-organization/README.md) |
| How do we run engineering day-to-day? | [Volume 5 — Operating Model](../vol-5-operating-model/README.md) |
| How do we connect to customer systems? | [Volume 6 — Integration Strategy](../vol-6-integration-strategy/README.md) |
| How do we use Claude Code? | [Volume 7 — AI Engineering](../vol-7-ai-engineering/README.md) |
| What ships next quarter? | [Volume 8 — Roadmaps](../vol-8-roadmaps/README.md) |
| Where are the templates? | [Volume 9 — Templates](../vol-9-templates/README.md) |
| Which prompts do we use? | [Volume 10 — Claude Prompts](../vol-10-claude-prompts/README.md) |

---

## Governance & Versioning

- **Owner:** CEO + CTO co-own this volume. No file ships without both signatures on material changes.
- **Review cadence:** Quarterly at the strategy offsite; ad-hoc after any material market or competitive event.
- **Change protocol:** Non-trivial changes require an ADR in `vol-3-architecture/adrs/` cross-referencing the affected file. Slogan-level rewrites are forbidden without a business reason documented in the commit.
- **Freshness signals:** Every file carries a `last-reviewed` line in the frontmatter. If any file is older than 180 days it is considered stale and must be re-audited.

---

*See also: [Volume 2 — Product Knowledge](../vol-2-product-knowledge/README.md)*
