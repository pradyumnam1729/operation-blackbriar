# Chapter 2 — Context Engineering

**Volume 7 · PMM Agent Playbook · 2026-08-06**

---

## The Problem Context Engineering Solves

A model with the wrong context produces generic output no matter how good the brief is. A model with all possible context drowns the signal in noise and burns budget. Context engineering is the discipline of getting exactly the right files in front of the model at exactly the right time — and it is the mechanism behind the Master Instructions §2.1 prerequisite: "If the system doesn't know your world, it produces generic output."

Three mechanisms do the work: always-on injection for the brand core, per-task selection for everything else, and a markdown-first store that makes both cheap and auditable.

## The SessionStart Injection Pattern

Per Master Instructions §5.1, every session begins with a deterministic hook (in `.claude/hooks/`) that injects the brand DNA into context before any task runs:

- `GTM-War-Room/BRAND-DNA/positioning-and-icp.md`
- `GTM-War-Room/BRAND-DNA/brand-voice.md`
- `GTM-War-Room/BRAND-DNA/our-customer.md`
- `GTM-War-Room/BRAND-DNA/gtm-rules.md`
- Current quarter's OKRs and rocks from `GTM-War-Room/strategy.md`

The design decision worth understanding: this is a **hook, not an instruction**. We do not tell agents "always read the brand files first" and trust them to comply. The hook fires deterministically at session start, every session, regardless of model behavior. An agent physically cannot begin a task without the positioning, the voice rules, the raw customer language, and the operating rules already in context.

This one pattern carries a disproportionate share of the 100% messaging-consistency value prop. Consistency failures in multi-session AI systems are rarely dramatic; they are drift — session 14 describing the audience slightly differently than session 2 because it read a different subset of files. Injection eliminates the variance at the root: every session starts from an identical brand baseline.

The injected set is deliberately small — roughly the minimum viable context of §4.1. Everything else arrives per task.

## Per-Task File Selection

Beyond the injected core, agents read only the files their brief names (see `01-prompt-standards.md`) plus what their agent definition in `.claude/agents/` specifies. A battlecard task reads the competitor dossier and recent win-loss notes; it does not read three launch folders and the case-study library.

Selection discipline matters for three reasons:

1. **Relevance beats volume.** Model attention is finite. The competitive dossier competes for attention with everything else in context; padding the context with unrelated files measurably dilutes output specificity.
2. **Traceability.** The asset's frontmatter `sources` list is the selection, recorded. Reviewers audit what the agent read; that only works when the read set was deliberate.
3. **Cost.** Context tokens are the dominant cost of always-on programs (see `06-cost-and-model-strategy.md`).

The selection map — which agent reads which war-room zones — lives with the agent definitions and is documented in `pmm-playbook/vol-4-agent-organization/`. The intake protocol handles gaps: when a named file is missing or stale, the agent stops and says so rather than substituting its own knowledge.

## Why the War Room Is Markdown-First

The entire knowledge store — brand DNA, intelligence, assets, playbooks — is plain markdown files in `GTM-War-Room/`. This is an architectural commitment, not a hackathon shortcut, for three reasons:

**LLM-legible.** Markdown is the format models read best: structure survives (headings, tables, lists carry meaning), there is no parsing layer to fail, and a file's section can be quoted verbatim into an output with its provenance intact. A database row needs a retrieval layer and a serialization decision before a model sees it; a markdown file is already in the model's native format. The war room needs no retrieval infrastructure between the knowledge and the model — a path reference in a brief is the retrieval system.

**Versionable.** The war room lives in git. Every positioning change, every battlecard revision, every approved edit to `our-customer.md` is a commit with an author and a date. Rollback is `git revert`. "What did our messaging say on 2026-06-15?" is a checkout, not an archaeology project. The draft → final gate (§8.4) leaves a visible trail.

**Auditable.** When the content-governance agent (C12) audits messaging consistency, its corpus is grep-able text. When a human asks "where did this claim come from," the answer is a file path and a line. Hooks can enforce rules deterministically (the forbidden-words guard is, at bottom, pattern matching over text) precisely because the substrate is text.

The trade-off accepted: markdown files do not enforce schemas. Frontmatter conventions (per `CLAUDE.md`: product, audience, persona, stage, sources, date) are enforced by hooks and review, not by a database. At GA scale this may earn an index layered on top; the files remain the source of record.

## Rules

1. Brand DNA arrives by SessionStart hook, never by hoping. Changing the injected set is a `gtm-rules.md`-level decision for the PMM admin.
2. Task context is selected, named in the brief, and recorded in output frontmatter `sources`.
3. Missing context stops the task; it is never silently substituted.
4. All knowledge lands as markdown in the war room; anything an agent should ever read has a path.
