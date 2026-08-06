# Volume 9 — Templates

**Engineering Playbook · Aurigo Software Technologies**
Version 1.0 · July 2026

---

This volume contains the official, production-ready templates for every recurring artifact produced by Aurigo engineering teams. Each template is pre-wired to the conventions in Volumes 1–8 and includes a completely filled-in example so that the first time you use it, you know exactly what "good" looks like.

---

## Templates Index

| # | File | Template | When to Use |
|---|------|----------|-------------|
| 1 | `prd-template.md` | **Product Requirements Document** | Kick off any feature that requires engineering effort; created by PM, reviewed by EM and ED before sprint planning. |
| 2 | `rfc-template.md` | **Request for Comments** | Propose a significant architectural or cross-team technical change; circulated for 5-business-day async review before a decision meeting. |
| 3 | `adr-template.md` | **Architecture Decision Record** | Capture a decided-upon architectural choice that is intended to last at least one major version; created by EM or senior engineer, stored in `vault/decisions/`. |
| 4 | `user-story-template.md` | **User Story** | Define a single deliverable unit of user value for grooming and sprint commitment; written by PM, elaborated with the implementing engineer. |
| 5 | `architecture-review-template.md` | **Architecture Review** | Gate any pull request or feature branch that touches Clean Architecture layer boundaries, multi-tenancy patterns, security, or introduces a new infrastructure dependency. |
| 6 | `design-review-template.md` | **UI/UX Design Review** | Gate any frontend change that touches layout, new components, color, or user flows before implementation begins; ensures WCAG 2.1 AA compliance and design-system consistency. |
| 7 | `sprint-review-template.md` | **Sprint Review** | Structure the end-of-sprint demo meeting; drives story-by-story acceptance verification and produces the releasability decision. |
| 8 | `retrospective-template.md` | **Sprint Retrospective** | Structured team reflection on the sprint; produces a ranked action-item list with owners and due dates. |
| 9 | `release-notes-template.md` | **Release Notes** | Communicate every production release to internal stakeholders and customers; required for every version tag pushed to main. |
| 10 | `api-design-template.md` | **API Design** | Document a new or modified REST endpoint before implementation; reviewed by EM as part of architecture review; schema drives OpenAPI spec and generated client. |
| 11 | `testing-checklist.md` | **Testing Checklist** | Verify that every required test category has been addressed before a PR is marked ready for review; organized by change type. |
| 12 | `integration-checklist.md` | **EAM Integration Deployment Checklist** | Sequential go-live checklist for onboarding a customer's EAM system; signed off by Aurigo implementation engineer and customer before production sync is enabled. |

---

## How to Use These Templates

1. **Copy the file** into the appropriate location (PRDs to `vault/features/`, ADRs to `vault/decisions/`, user stories to your project management tool, checklists to PR description or deployment ticket).
2. **Replace all `[PLACEHOLDER]` tokens** with real content.
3. **Delete sections** marked `<!-- omit if not applicable -->` only when genuinely not applicable — do not delete sections you have not thought about.
4. **Filled-in examples** appear at the bottom of each template under an `---` rule labelled `## Example`. Remove the example section before submitting the real artifact.

---

## Template Ownership

| Template | Owner | Review Cadence |
|----------|-------|----------------|
| PRD | Product Manager | Before every sprint 0 / planning session |
| RFC | Proposing engineer | As needed; never skip for infra changes |
| ADR | Engineering Manager | After every RFC decision |
| User Story | Product Manager | Sprint grooming session |
| Architecture Review | Engineering Manager | Per PR for architecture-touching changes |
| Design Review | Lead Frontend Engineer | Before frontend implementation begins |
| Sprint Review | Scrum Master / EM | Last day of every sprint |
| Retrospective | Scrum Master / EM | Last day of every sprint |
| Release Notes | EM + PM | Every production deployment |
| API Design | Implementing Engineer | Before writing handler code |
| Testing Checklist | Implementing Engineer | As part of PR description |
| Integration Checklist | Implementation Engineer | Every customer EAM onboarding |
