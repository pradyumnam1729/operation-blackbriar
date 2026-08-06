# Product Manager

## Mission

The Product Manager bridges customer needs and engineering execution. In an AI-native organization, the PM uses AI agents to dramatically accelerate the traditionally slow parts of product management — user story writing, backlog analysis, competitive research, release notes — while spending more time on the parts that AI cannot do: building relationships with customers, developing domain intuition, and making judgment calls about what to build next.

The PM is not a requirements transcriptionist. The PM is the person who understands why customers buy infrastructure asset management software, what their biggest operational problems are, and how to sequence a backlog that delivers maximum value with the available engineering capacity. AI accelerates execution of those decisions; it does not make them.

---

## Responsibilities

### Customer Understanding

Spend at minimum 4 hours per week in direct contact with customers and prospects. This is non-negotiable regardless of workload. AI can analyze customer feedback and cluster themes; it cannot pick up the signal in a frustrated customer's tone of voice or notice that a city engineer winced when the topic of TAMP preparation came up.

Maintain a personal customer contact log. After every customer call, spend 15 minutes documenting: what did they say, what do I think they actually meant, what did this change in my understanding of the product? These notes are the raw material for AI-accelerated analysis.

### Backlog Management

Own the product backlog. Every item in the backlog has a clear description, acceptance criteria, and priority rationale. The PM is responsible for ensuring the backlog is always in a state where the top 20 items could be picked up by engineering with no additional clarification required.

Use AI to accelerate story writing: a feature brief (2–3 paragraphs describing the customer need) goes into Claude, and 10 user stories with acceptance criteria come out in 30 minutes. The PM's job is to write the feature brief (requires domain knowledge and customer understanding) and to review the output for accuracy and completeness (requires judgment). The mechanical writing task is delegated to AI.

### Competitive and Market Analysis

Monitor the competitive landscape monthly. Use AI to research competitor feature announcements, product marketing, and pricing changes. Synthesize into a quarterly competitive intelligence report. The PM reads the AI synthesis and adds context from customer conversations ("Customer X mentioned they evaluated Cartegraph and found it lacking in X").

### Release Management

Produce release notes for every production deployment. Use AI: feed the git log (commit messages + PR titles/descriptions from the last sprint) to Claude, and request a user-facing release notes draft. Review and edit for accuracy, customer-relevant framing, and tone. The mechanical task (summarizing technical changes in customer language) is AI-delegated; the judgment about what matters to customers is human.

### Stakeholder Communication

Produce a bi-weekly product update for leadership covering: what shipped, what is in flight, what is on the horizon, and what risks/decisions require leadership attention. Use AI to draft from structured notes; human to review and refine.

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| Backlog Health | Top 20 items always sprint-ready (no missing AC) | Weekly |
| Story Lead Time | Feature brief to sprint-ready stories < 2 hours | Per story |
| Customer Contact Hours | > 4 hours/week | Weekly |
| Customer NPS (product-specific) | > 40 | Quarterly |
| Feature Adoption Rate | > 60% of shipped features used by > 50% of active users within 90 days | Per release |
| Release Notes Accuracy Rate | < 2 customer corrections per release cycle | Per release |
| Competitive Intelligence Currency | Updated within 2 weeks of competitor announcements | Monthly |
| Backlog Prioritization Stability | < 20% reprioritization churn between sprint planning sessions | Per sprint |

---

## Authority

The PM has final authority on:
- Backlog priority order
- Scope of any given release (what is in, what is deferred)
- User story acceptance criteria
- Feature deprecation decisions

The PM does not have authority on:
- Technical implementation approach (engineering decision)
- Delivery timelines without ED agreement
- Commitments to customers about specific release dates without ED and QA Lead sign-off
- Scope increases mid-sprint without ED agreement

---

## Deliverables

**Per sprint**: Sprint-ready backlog (top 20 items), sprint goal statement, release notes draft for review

**Weekly**: Customer contact log update, blocker/decision log

**Monthly**: Competitive intelligence update, feature adoption report

**Quarterly**: Product roadmap update (6-month horizon), customer satisfaction summary, prioritization retrospective

---

## Decision Making

The PM uses the RICE framework for backlog prioritization:
- **Reach**: How many users are affected by this feature per quarter?
- **Impact**: How much does this feature move the needle for those users? (1=minimal, 2=low, 3=medium, 5=high, 8=massive)
- **Confidence**: How confident are we in the Reach and Impact estimates? (Expressed as a percentage)
- **Effort**: How many engineer-sprint-weeks will this take?

`RICE Score = (Reach x Impact x Confidence) / Effort`

RICE scores are computed by Claude from a structured input template. The PM reviews and may override when RICE doesn't capture strategic importance (regulatory requirements, customer commitments, platform dependencies that unlock future features).

---

## AI-Accelerated Workflows

### Workflow 1: Customer Ticket Cluster Analysis

**Situation**: 200 customer support tickets have accumulated over the past quarter. The PM needs to identify the top 10 product improvement themes.

**AI-native approach**:
1. Export tickets to CSV (summary + resolution text)
2. Prompt Claude: "Analyze these 200 support tickets. Identify the top 10 recurring themes. For each theme: count of tickets, example quotes, severity distribution (P1/P2/P3), affected user roles (inspector/manager/executive). Format as a table."
3. Claude produces the cluster analysis in 3 minutes
4. PM reviews: validates clusters against customer call notes, adds qualitative color, identifies which clusters represent product debt vs. new feature needs
5. PM writes a 1-page prioritization recommendation for leadership

**Time without AI**: 2 days
**Time with AI**: 90 minutes

### Workflow 2: Feature Brief to Sprint-Ready Stories

**Situation**: A major DOT customer has requested TAMP section-level editing with tracked changes. The PM needs to produce sprint-ready stories.

**AI-native approach**:
1. PM writes a feature brief (300 words): user problem, desired outcome, key constraints, out of scope
2. Prompt Claude: "Generate 10 user stories with full BDD acceptance criteria (Given/When/Then) for the following feature brief. Include: 1 happy path story per major user action, edge cases (concurrent editing, large document, permissions), and a negative test story for each business rule."
3. Claude produces 10 stories with full acceptance criteria in 5 minutes
4. PM reviews each story against the customer brief and the domain knowledge from the Lifecycle Domain Expert
5. PM edits 3 stories where Claude got the domain nuance wrong (TAMP structure requires specific FHWA section numbering — Claude missed this without the regulatory context)
6. Stories are ready for sprint planning

**Time without AI**: 4 hours
**Time with AI**: 45 minutes

### Workflow 3: Release Notes from Git Log

**Situation**: Sprint 14 has closed. 23 pull requests were merged. The PM needs release notes for the customer-facing changelog and the internal release brief.

**AI-native approach**:
1. Run: `git log --oneline --merges sprint-13..sprint-14` to get PR titles
2. For each PR, fetch the PR description from GitHub
3. Prompt Claude: "You are writing release notes for infrastructure asset management software used by government agencies. Audience: asset managers and inspectors (non-technical). Here are 23 PR descriptions from the last sprint. Write: (1) a 3-bullet executive summary of the biggest changes, (2) a feature-by-feature changelog in customer-friendly language, (3) a 'known limitations' section for the 2 items marked WIP."
4. Claude produces the draft
5. PM edits for accuracy (2 of the 23 PRs were backend refactors that customers don't care about — remove them), adds a screenshot description for the new dashboard feature, adjusts tone

**Time without AI**: 3 hours
**Time with AI**: 30 minutes

---

## Daily Workflow

**08:00–08:30** — Review overnight customer feedback (support tickets, in-app surveys, email). Flag anything urgent.

**08:30–09:00** — Read the AI agent's nightly digest (if configured): any anomalies in user behavior data, new support ticket clusters, competitive news. Spend 15 minutes on triage decisions: which items need action today?

**09:00–10:00** — Backlog maintenance: review and update top 20 stories based on yesterday's decisions and new information. Use AI to fill out acceptance criteria for any stories that need it.

**10:00–11:30** — Customer calls (2–3 per week in this slot). Document notes immediately after.

**11:30–13:00** — Sprint ceremonies (planning, review, or retro depending on sprint phase) or cross-functional syncs with ED and QA Lead.

**14:00–15:30** — Deep work: roadmap thinking, feature briefs, competitive analysis. This block is protected from meetings.

**15:30–17:00** — Stakeholder communication: draft the weekly update, respond to leadership questions, review engineering blockers that need PM decisions.

---

## Collaboration

**With Engineering Director**: Daily partnership on scope vs. capacity trade-offs. The PM brings the customer perspective; the ED brings the delivery reality. Neither has veto over the other — disagreements are resolved by jointly escalating to leadership.

**With Lifecycle Domain Expert**: Critical partnership for anything involving regulatory compliance (TAMP, NBI, FAA), calculation methodology, or domain terminology. The PM does not write stories about TAMP compliance without a domain expert review.

**With QA Lead**: The PM writes acceptance criteria; the QA Lead writes test cases from them. Regular sync to ensure AC is sufficiently precise to be testable.

**With UX Strategist**: Feature briefs become wireframe descriptions become stories. The PM owns the "what and why"; UX owns the "how it looks and feels."

**With Customers**: Direct relationship with 5–10 named customer contacts at active accounts. Regular calls, product previews, beta feedback sessions.

---

## Escalation

The PM escalates to the ED when:
- An engineering trade-off decision is required that impacts a customer commitment
- The backlog is blocked waiting for a domain decision that requires engineering input

The PM escalates to the VP of Product when:
- A customer is requesting scope that would require a product direction change
- A competitive threat requires a strategic response that changes the roadmap

---

## Continuous Improvement

Monthly: review the accuracy of story acceptance criteria. How many stories came back from QA with "AC doesn't match what was built"? This is a signal that stories are ambiguous or that AI-generated AC has domain gaps.

Quarterly: review the RICE scoring model against actual feature adoption. Did high-RICE features actually deliver high impact? Calibrate the model.

---

## Example Scenarios

### Scenario 1: Responding to a Federal Compliance Requirement Change

FHWA publishes updated TAMP guidance that adds a new required section. The PM receives a heads-up from the Lifecycle Domain Expert before the customer base starts calling.

The PM uses AI to summarize the regulatory change, identify which Maintain features are affected, and draft 5 initial stories. The domain expert reviews and adds 3 stories that the AI missed (specific data requirements in the new section that require new fields). The PM prioritizes the stories into the next available sprint, notifies the ED, and proactively emails the customer base with a timeline.

### Scenario 2: Prioritizing a New Feature Request vs. Technical Debt

Two items are competing for the next sprint: a new dashboard widget that 3 customers have requested, and a technical debt item that the Backend Lead says is slowing every new feature by 20%. The PM runs RICE on the dashboard widget. The ED models the cost-of-delay for the technical debt.

Together they conclude: the technical debt item has a higher effective RICE score when you factor in the productivity multiplier it unlocks for all future features. The dashboard widget is deferred by one sprint. The PM communicates this to the requesting customers with an honest explanation and a committed timeline.

### Scenario 3: Competitive Threat Analysis

A competitor announces a new NLP-powered inspection assistant. The PM has 48 hours before the CEO asks "are we behind?"

The PM uses AI to analyze the competitor's announcement (marketing page, demo video transcript, LinkedIn posts from their engineering team). AI produces a feature gap analysis in 20 minutes. The PM adds context from 2 customer calls: neither customer mentioned it unprompted, and one customer said they'd wait to see if it worked before getting excited. The PM's conclusion: this is a real capability but they're 12–18 months from GA, and Maintain's AI Feature 9 (Inspection Photo Analysis) is a direct response in the roadmap. No panic; maintain the plan.
