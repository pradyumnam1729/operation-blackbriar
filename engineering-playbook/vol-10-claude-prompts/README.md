# Volume 10 — Claude Prompt Library

## What This Is

This is the Aurigo Engineering Prompt Library: a curated collection of ready-to-use prompts for Claude Code that cover every recurring task in the software development lifecycle at Aurigo.

Each prompt is the result of real usage — written, refined, and standardized so that any engineer or AI agent can achieve consistent, high-quality results without re-inventing the approach each time. The prompts encode Aurigo's architecture decisions, domain vocabulary, coding conventions, and quality standards directly into the instructions.

These are not templates that describe what a prompt should contain. They are the actual prompt text, ready to copy and run.

## How to Use a Prompt

1. **Open the relevant `.md` file** from the table below.
2. **Copy the prompt text** — each file contains one or more clearly delimited prompts.
3. **Replace all `[PLACEHOLDER]` values** with the specific context for your task. Placeholders look like `[MODULE_NAME]`, `[STORY_TEXT]`, `[PR_NUMBER]`, etc.
4. **Paste into Claude Code** and run. You can paste directly into the chat input or use `/run` with a file path.
5. **Save useful output** — if the agent produces a discovery summary, architecture review, or ADR draft, save it to the appropriate directory in the repo (`vault/`, `docs/`, etc.) before ending the session.

## How to Contribute an Improved Prompt

If you run a prompt and find that it produced a better result when you modified it, please update the prompt file so the next person benefits:

1. Edit the relevant file in `vol-10-claude-prompts/`.
2. If you added a new variant, document it under a `### Variant:` heading.
3. In your PR description, include a section `### Prompt Improvement` that explains what you changed and why the new version works better (e.g., "Added instruction to check for missing AsNoTracking — the original prompt was missing this and reviewers kept catching it manually").
4. Treat prompt quality with the same care as production code quality. A poorly-worded prompt creates more rework than a poorly-worded code comment.

## Prompt Index

| # | File | Prompt Name | Use When |
|---|------|-------------|----------|
| 01 | `01-repository-discovery.md` | Repository Discovery | Start of a new session, before working in an unfamiliar module, after a long gap |
| 02 | `02-architecture-review.md` | Architecture Review | Before submitting a PR, when starting a major feature, when reviewing another engineer's branch |
| 03 | `03-product-review.md` | Product Review | After implementation, to verify feature matches acceptance criteria and domain vocabulary |
| 04 | `04-competitor-analysis.md` | Competitor Analysis | Before a sales engagement, product roadmap review, or when a competitor comes up in a deal |
| 05 | `05-backlog-generation.md` | Backlog Generation | When turning a feature brief or PRD into executable user stories |
| 06 | `06-sprint-planning.md` | Sprint Planning | At the start of each sprint to plan capacity and sequence work |
| 07 | `07-story-generation.md` | Story Generation | When writing a single, well-formed user story from a feature description |
| 08 | `08-implementation.md` | Implementation (BE + FE) | When implementing a feature end-to-end following Aurigo's stack conventions |
| 09 | `09-testing.md` | Test Generation | When generating unit, integration, component, or E2E tests for any layer |
| 10 | `10-code-review.md` | Code Review | When performing an AI-assisted review of a PR diff |
| 11 | `11-refactoring.md` | Refactoring | When fixing a specific anti-pattern across one or more files |
| 12 | `12-release.md` | Release Preparation | When preparing release notes, deployment checklist, and customer communication |
| 13 | `13-documentation.md` | Documentation Generation | When generating API docs, user guides, ADRs, or directory READMEs from code or stories |

## A Note on Prompt Quality

A well-written prompt is specific, ordered, and grounded. It tells the agent what to read first, what to produce, and in what format. It references real file paths and real Aurigo conventions rather than speaking in generalities. It gives the agent enough context to succeed without a follow-up question.

If a prompt requires more than one follow-up clarification from the agent to complete the task, the prompt is underspecified. Fix it.
