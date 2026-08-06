# Documentation Engineer

## Mission

The Documentation Engineer owns the quality, completeness, and currency of all documentation produced by and for the Maintain platform: internal engineering documentation (playbook, ADRs, vault), external product documentation (API reference, user guides, release notes), and operational runbooks. In an AI-native engineering organization, this role transforms from a documentation writer into a documentation architect and quality reviewer.

AI writes documentation faster than any human. The Documentation Engineer's value is not writing speed — it is the judgment to know whether AI-generated documentation is accurate, complete, appropriate for its audience, and consistent with everything else in the documentation ecosystem. This requires deep familiarity with both the product and the documentation craft.

---

## Responsibilities

### Documentation Architecture

Define the documentation architecture: what documentation exists, where it lives, how it's organized, and how it's maintained. The current documentation architecture:

**Internal Engineering Documentation**
- `CLAUDE.md`: codebase context and conventions (owned by Engineering Director with Documentation Engineer maintenance)
- `engineering-playbook/`: this document set — the Engineering Playbook (owned by Documentation Engineer)
- `vault/`: Obsidian vault for domain knowledge, calculations, ADRs, phase plans (maintained collaboratively, quality-owned by Documentation Engineer)
- ADRs: Architecture Decision Records in `vault/decisions/` (authored by Tech Architect, reviewed by Documentation Engineer for clarity and completeness)

**External Product Documentation**
- API Reference (generated from OpenAPI spec + hand-written descriptions)
- User Guide (role-based: Asset Manager Guide, Inspector Guide, Administrator Guide)
- Integration Guide (EAM connector setup for Maximo, SAP, Cityworks, Infor)
- Release Notes (per release)
- FAQ and troubleshooting

**Operational Documentation**
- Runbooks (per incident type, maintained by DevOps with Documentation Engineer review)
- Deployment guide
- Database migration guide

The Documentation Engineer ensures every documentation type has a clear owner, a maintenance process, and a review cadence. Documentation without a maintenance process becomes stale and eventually harmful.

### AI-Assisted Documentation Generation Pipeline

Design and own the pipeline that uses AI to generate documentation drafts from primary sources (code, ADRs, PR descriptions, meeting notes). The human Documentation Engineer's time is then spent reviewing and improving the AI output, not producing the first draft.

**PR Merged → API Documentation Update**
When a PR modifies or adds API endpoints, an automated job extracts the OpenAPI annotations from the .NET controllers, generates a structured API documentation page using the Claude API, and creates a documentation PR for the Documentation Engineer to review. The Documentation Engineer reviews: is every parameter explained? Are the response examples realistic? Are the error codes documented?

**Sprint Completed → Release Notes**
When a sprint closes, an automated job collects all merged PR descriptions and titles from the sprint, invokes Claude to produce a user-facing release notes draft, and assigns the draft to the Documentation Engineer for review and editing. The Documentation Engineer reviews: are the right features highlighted? Is the language appropriate for agency staff (non-technical)? Are any breaking changes clearly called out?

**ADR Approved → Playbook Update**
When a new ADR is published, the Documentation Engineer reviews the playbook for any sections that should reference or be updated based on the new decision. If relevant, uses Claude to draft the updated playbook section and reviews it for accuracy.

**Feature Shipped → User Guide Update**
When a new feature ships, the Documentation Engineer uses Claude to draft the user guide section: "Given this feature brief and these acceptance criteria, write a user guide section explaining how an asset manager would use this feature. Include: what the feature does, step-by-step instructions, and a common mistake to avoid."

### Documentation Quality Standards

Define and enforce documentation quality standards:

**Accuracy**: Does the documentation describe what the software actually does? Inaccurate documentation is worse than no documentation — it erodes trust and wastes time.

**Completeness**: Are all parameters documented? Are all states described? Are error conditions explained?

**Audience fit**: Is the language appropriate for the intended reader? API documentation is for developers; user guides are for asset managers with no programming background; runbooks are for engineers under pressure in the middle of an incident.

**Currency**: Is the documentation updated within the same sprint as the code it documents? Documentation that lags more than one sprint behind the code is starting to become stale.

**Discoverability**: Can a user find the documentation they need? The Documentation Engineer maintains the documentation site navigation, search index, and cross-reference links.

### Knowledge Base Maintenance

Own the `vault/` Obsidian knowledge base as the authoritative repository for domain knowledge, calculation methodology, regulatory references, and architectural decisions. Responsibilities:

- Ensure every calculation engine has a corresponding methodology document in `vault/calculations/`
- Ensure every significant architectural decision has an ADR in `vault/decisions/`
- Ensure every phase plan in `vault/phases/` reflects actual (not planned) completion status
- Conduct a monthly "knowledge audit": are there areas of the product that are underdocumented in the vault?
- Flag documentation debt: when multiple engineers are making the same incorrect assumption (visible from PR comments), the vault is missing something — add it

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| Documentation Currency Lag | < 1 sprint behind code for all documentation types | Monthly |
| API Documentation Coverage | 100% of public endpoints have documented parameters, responses, and errors | Per release |
| User Guide Completeness | Every shipped feature has a corresponding user guide section | Monthly |
| Documentation Accuracy Issues | < 2 accuracy corrections reported per month | Monthly |
| ADR Documentation Rate | 100% of significant decisions captured within 5 days | Monthly |
| Release Notes Accuracy | < 2 corrections requested per release cycle | Per release |
| AI-Generated Documentation Review Throughput | All AI-generated documentation reviewed within 48 hours of generation | Weekly |
| Vault Currency | < 5 sections marked as "needs update" at any time | Monthly |

---

## Authority

The Documentation Engineer has authority to:
- Block a feature release if user-facing documentation is not complete
- Require ADR documentation before a significant technical decision is implemented
- Update any documentation in the repository
- Define documentation standards and enforce them through PR review

The Documentation Engineer does not have authority to:
- Make product or engineering decisions
- Override the Architect's ADR decisions (they can request clarification or completeness improvements)
- Access production systems

---

## Deliverables

**Per sprint**: Documentation update log, AI generation review report, release notes draft

**Per release**: Complete release notes (reviewed and approved), API reference update (all new endpoints documented), user guide update (all new features documented)

**Monthly**: Documentation currency report (which sections are lagging?), knowledge audit findings

**Quarterly**: Documentation architecture review (is the structure still serving the team's needs?), playbook major update

---

## Decision Making

When reviewing AI-generated documentation:

1. **Accuracy first**: Does the AI-generated text describe what the software actually does? The Documentation Engineer verifies against the actual code, the acceptance criteria, and subject matter expert review.

2. **Audience appropriateness**: Is the language appropriate? API docs should be developer-precise; user guides should be jargon-free.

3. **Completeness check**: Does the documentation cover all use cases? AI tends to document the happy path well and miss edge cases.

4. **Internal consistency**: Does this documentation contradict anything else in the documentation ecosystem?

5. **Discoverability**: Will a user looking for this information find it through the documentation navigation?

---

## Daily Workflow

**08:00–08:30** — Review the documentation generation queue: any AI-generated documentation PRs waiting for review? Any sprint activity from yesterday that should trigger documentation updates?

**08:30–10:00** — Documentation PR review: review AI-generated documentation PRs. Approve, request changes, or merge.

**10:00–11:30** — Active documentation work: vault maintenance, user guide updates for shipped features, release notes editing.

**11:30–12:00** — Team sync: check with Backend Lead and Frontend Lead about anything that shipped in the last day that affects documentation.

**14:00–16:00** — Deep documentation work: complex user guide sections, ADR reviews for completeness, documentation architecture improvements.

**16:00–17:00** — Knowledge audit work: identify documentation gaps, create tickets for documentation debt, update the vault currency tracker.

---

## Collaboration

**With Tech Architect**: ADR review and completeness. The Documentation Engineer reviews every ADR for: is the context clear? Is the decision stated unambiguously? Are the consequences specific enough to be useful? ADRs that are too vague to guide AI agent behavior are returned for improvement.

**With All Engineering Leads**: Feature documentation coordination. When a lead ships a feature, the Documentation Engineer receives the feature brief and acceptance criteria, uses AI to draft the documentation, and routes the draft to the lead for accuracy review before publishing.

**With PM**: Release notes coordination. The PM provides the customer-perspective framing ("what is the business value of this feature?"); the Documentation Engineer produces the technical content. Together they produce release notes that are technically accurate and customer-relevant.

**With DevOps Engineer**: Runbook maintenance. The DevOps Engineer writes runbook drafts after incident postmortems; the Documentation Engineer reviews for clarity, completeness, and consistency with other runbooks.

**With AI Engineer**: Documentation for AI capabilities. The AI capabilities (deterioration models, optimization, TAMP generation) are among the most complex to document correctly for non-technical users. The Documentation Engineer and AI Engineer jointly review the user-facing documentation for AI features.

---

## Escalation

The Documentation Engineer escalates to the ED when:
- A documentation gap is discovered that has caused or is likely to cause customer harm
- A documentation update request requires significant engineering input that isn't available (the Documentation Engineer can't review for accuracy without access to the relevant engineer)
- The documentation debt backlog is growing faster than the team can address it

---

## Continuous Improvement

Monthly: review the accuracy report. Every correction to published documentation is investigated: was this an AI generation error? A review error? A code change that wasn't communicated to documentation? Each error type suggests a different improvement.

Quarterly: run a documentation user survey. Ask a sample of internal users: which documentation do you use most? Which documentation is hardest to find? Which documentation do you wish existed? The survey results drive the quarterly documentation roadmap.

---

## Example Scenarios

### Scenario 1: Reviewing an AI-Generated API Reference Update

A PR merges that adds the capital plan optimization endpoint: `POST /api/v1/capital-plans/{id}/optimize`. The automated documentation pipeline generates a draft API reference page and creates a documentation PR for review.

The Documentation Engineer reviews: the endpoint description is accurate, the request parameters are documented, but there are two issues: (1) the `optimizationWeights` parameter has no explanation of what the weight values mean (what is the range? what does a weight of 0 vs. 1 do?), and (2) the 429 Too Many Requests response code is documented but doesn't explain the rate limit (the optimization endpoint has a 1-request-per-minute rate limit per tenant due to computational cost).

The Documentation Engineer requests changes: add a "Optimization Weights" section explaining that weights are 0–1 floats that sum to 1.0, with descriptions of each weight dimension; add the rate limit explanation to the 429 response documentation.

The AI Engineer reviews the changes and confirms accuracy. The documentation PR is merged.

### Scenario 2: Catching an Inconsistency in the User Guide

After a sprint that added the anomaly detection feature, the Documentation Engineer generates the user guide section using AI and reviews it. The AI correctly explains what an anomaly alert means and how to respond.

However, the Documentation Engineer notices an inconsistency: the user guide says anomaly alerts appear "in the Notifications tab" but the actual implementation (reviewed by checking the frontend code and the UX wireframes) places them in a dedicated "Anomaly Alerts" page accessible from the left sidebar. The AI generated the text based on a previous version of the specification where notifications were in a tab.

The Documentation Engineer corrects the user guide, then checks the AI generation prompt for the relevant section: the prompt references an outdated wireframe. The prompt is updated to always reference the shipped feature's actual navigation path, not the design-time wireframe.

### Scenario 3: Driving a Documentation Audit After Rapid AI-Generated Releases

After 3 months of AI-native development that shipped 8 features in 6 sprints, the Documentation Engineer runs a documentation currency audit. Findings:

- 3 features have user guide sections, but they describe the pre-release behavior (AC was changed during implementation and the user guide wasn't updated)
- The vault's `vault/phases/Phase-3.md` still shows all Phase 3 items as "in progress" even though 5 of them are shipped
- 2 ADRs reference patterns that have been superseded by subsequent ADRs, without a clear "see also" reference

The Documentation Engineer creates a documentation debt sprint item: 5 story points to address all three gaps. Using AI to draft the updated sections, then reviewing manually, the Documentation Engineer resolves all three gaps within one sprint.

The audit also reveals a systemic gap: there is no automated check to verify that every shipped feature has a corresponding documentation update. The Documentation Engineer designs and implements a simple check: a GitHub Actions job that verifies any PR touching `src/routes/` (new pages) also touches `docs/` (documentation), or is explicitly tagged with `docs-not-needed`. This prevents future gaps by making the check automatic.
