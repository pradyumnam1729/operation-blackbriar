# 15 — Knowledge Management

Knowledge is the most valuable and most fragile asset in a software organization. It disappears faster than code: through engineer turnover, context switches, and the natural decay of memory. A team that does not actively manage knowledge becomes dependent on the few people who were there from the beginning, brittle to departures, and slow to onboard new contributors — whether human or AI.

This document defines Aurigo's six-layer knowledge architecture, the transfer protocol for new engineers, the capture protocol for decisions, and the anti-patterns that cause knowledge systems to fail.

---

## The Knowledge Problem

Knowledge at most software companies lives in three places: people's heads, chat logs, and video call recordings. None of these are reliable:

- **People's heads** disappear when people leave, forget, or become unavailable
- **Chat logs** are chronological (not organized for retrieval), unsearchable at scale, and expire
- **Video recordings** are nearly unsearchable and require 60 minutes of viewing to extract 5 minutes of information

The result: when a new engineer joins, they spend 2–4 weeks talking to the right people, getting bits and pieces of context. When an AI agent starts a session, it starts from zero. When a senior engineer leaves, critical context vanishes unless there is a proactive effort to capture it before they go.

Aurigo's knowledge architecture solves this by making the repository the authoritative knowledge store. If a decision is important enough to act on, it is important enough to write down where it will last.

---

## Six-Layer Knowledge Architecture

The knowledge architecture has six layers, each serving a distinct purpose. Knowing which layer to use for which type of knowledge prevents the common failure mode of putting everything in one place and finding nothing when needed.

### Layer 1: Code (Authoritative Behavioral Specification)

The code is the ground truth of how the system actually behaves. It is always current (by definition — if the code changes, the behavior changes). It is versioned, reviewable, and accessible to both humans and AI agents.

**What belongs here**: Every behavior of the system. If a business rule is enforced, the code enforces it. If a calculation is performed, the code performs it.

**What does NOT belong here**: Why the behavior exists, what alternatives were considered, what constraints shaped the implementation. Code communicates what; other layers communicate why.

**Maintenance**: Updated in every PR. Never stale if the PR process is followed.

### Layer 2: Tests (Behavioral Specification with Examples)

Tests are executable documentation. A well-written test suite tells you:
- What behaviors the system is intended to have
- What edge cases were considered
- What the expected output is for specific inputs

**What belongs here**: All specified behaviors in machine-executable form. Unit tests for individual components, integration tests for API contracts, E2E tests for critical user workflows.

**What does NOT belong here**: Tests that test implementation details (private methods, internal state). Tests that test the framework rather than the application.

**Maintenance**: Updated in the same PR as the code they test. Coverage gates enforce completeness.

### Layer 3: Engineering Playbook (Standards, Workflows, Templates)

The playbook is the team's operating manual. It defines how work is done, not what the system does or why specific architectural decisions were made.

**What belongs here**: Development processes (sprint planning, feature development, code review), coding standards, story templates, onboarding protocols, testing requirements.

**What does NOT belong here**: Domain knowledge, architectural decisions, product requirements. These belong in other layers.

**Maintenance**: Reviewed quarterly at the architecture summit. Updated when processes change. Never more than one quarter out of date.

**Location**: `engineering-playbook/`

### Layer 4: Architecture Decision Records (Architectural Rationale)

ADRs capture *why* the system is the way it is. They record the context, the decision, the alternatives considered, and the expected consequences.

**What belongs here**: Every significant architectural decision — technology choices, pattern selections, constraint definitions, rejected alternatives.

**What does NOT belong here**: Implementation details, product requirements, process documentation.

**Maintenance**: Created when a decision is made. Never modified after approval (new ADR to supersede). Permanent record.

**Location**: `engineering-playbook/vol-3-architecture/adrs/`

### Layer 5: AI Shared Memory (Cross-Session Agent Context)

AI agents operating on the codebase (Claude Code and future agents) accumulate context across sessions. The shared memory file makes that context persistent and available to any agent starting a new session.

**What belongs here**: Team conventions that are not obvious from the code, patterns introduced recently, common mistakes to avoid, domain knowledge shortcuts, sprint context.

**What does NOT belong here**: Architectural decisions (those belong in ADRs), process documentation (belongs in playbook), product requirements (belong in vault/).

**Maintenance**: Updated after every sprint by the lead engineer running the AI improvement loop (document 14). Never stale by more than one sprint.

**Location**: `memory/MEMORY.md` (or the project's AI memory file location)

### Layer 6: CLAUDE.md Files (Per-Project AI Orientation)

Every repository has a CLAUDE.md at its root. It is the first thing any AI agent reads when starting work on the project. It provides rapid orientation: what is this system, what tech stack, what are the conventions, what is explicitly prohibited.

**What belongs here**: Tech stack, directory layout, build commands, key conventions, DO NOT list, source-of-truth references.

**What does NOT belong here**: Deep architectural decisions (ADRs), detailed domain knowledge (vault/), process documentation (playbook/).

**Maintenance**: Updated whenever project fundamentals change: new dependency, new module, new convention, new DO NOT rule. Should take less than 30 minutes to read.

**Location**: Root of every repository.

---

## Knowledge Capture Protocol: Which Layer Does It Belong In?

When something important is learned or decided, use this decision tree to determine where to record it:

```
Was a decision made about HOW the system is built?
  └── Yes → Is it a significant architectural decision (new pattern, technology choice, constraint)?
        ├── Yes → Write an ADR (Layer 4)
        └── No → Add a code comment or inline documentation (Layer 1) and update CLAUDE.md if it's a new convention (Layer 6)

Was a decision made about WHY a feature works a specific way?
  └── Yes → Is it a reusable business rule or calculation?
        ├── Yes → vault/calculations/ or vault/domain/ (referenced from Layer 3)
        └── No → Story AC captures it; if it needs to persist beyond the story, add to vault/

Was a workflow or process updated?
  └── Yes → Update the relevant engineering-playbook/ volume (Layer 3)

Was an AI agent pattern found that improves output quality?
  └── Yes → Update memory/MEMORY.md (Layer 5) and vault/ai-prompts/ (Layer 3)

Was a key project-level convention established?
  └── Yes → Update CLAUDE.md (Layer 6)
```

If you are unsure which layer, default to vault/ with a clear file name. It can be reorganized later. The cardinal sin is not choosing the wrong layer — it is choosing no layer.

---

## Knowledge Transfer Protocol for New Engineers

A new engineer (or a new AI agent working on the project for the first time) follows this 5-step onboarding protocol before contributing production code.

### Step 1: Read CLAUDE.md (Day 1, 30 minutes)

Read the project CLAUDE.md completely. Note the DO NOT list. Note the technology choices. Note the directory structure. If anything is unclear, ask before assuming.

Expected output: You can answer "what does this system do, what tech does it use, and what are the hard constraints?"

### Step 2: Execute Repository Discovery (Day 1, 60 minutes)

Follow the protocol in document 01. Read the domain entities, the controllers, the existing tests. Map the domain model. Understand the API surface.

Expected output: You can answer the six discovery questions from document 01.

### Step 3: Execute Architecture Discovery (Day 1–2, 90 minutes)

Follow the protocol in document 02. Read all ADRs. Trace a complete request end-to-end. Understand the multi-tenancy pattern.

Expected output: You can explain the top 5 architectural patterns and the top 3 constraints.

### Step 4: Read Product Context (Day 2, 90 minutes)

Read playbook Volume 1 (company context) and Volume 2 (product requirements). Read the Feature Spec (Asset Maintenance Features.csv or equivalent). Read the personas documentation in vault/personas/.

Expected output: You can describe the target users, their jobs-to-be-done, and the modules of the product.

### Step 5: Implement a Small First Story (Day 2–3)

Pick a 1–2 point story from the backlog. Implement it following the feature development protocol (document 07). The purpose of the first story is calibration — confirming that the conventions are understood, the build/test loop works, and the PR process is clear.

Do not start with a 5–8 point story as the first contribution. The calibration step is too important.

---

## Knowledge Preservation Protocol

When a team member is leaving the project or the company:

**2 weeks before departure:**
- Identify knowledge the person holds that is not written down anywhere
- Prioritize by: how often is this knowledge needed? who else knows it?
- Create vault/ documents for the top-priority undocumented items

**1 week before departure:**
- Knowledge transfer sessions: the departing engineer walks through the top-priority areas with the team
- The sessions are documented (AI agent takes notes, summary added to vault/)
- Open tickets that only the departing engineer knows the context for are triaged and commented

**During final week:**
- Code ownership is formally transferred: GitHub codeowners file updated
- Any in-flight PRs are handed off with written context in the PR comments
- Final memory.md update to capture any institutional knowledge not yet documented

This is not a checklist that gets skipped under departure pressure. The 2-week notice period is the opportunity. After the person leaves, the knowledge is gone.

---

## Anti-Patterns in Knowledge Management

### Anti-Pattern 1: Verbal Decisions Never Documented

The most common knowledge failure. A team makes a decision in a meeting, agrees on an approach in a Slack thread, or settles on a pattern in a code review comment — and no one writes it down in a durable location.

Three months later: "Why is the code written this way?" "I don't remember — it was decided in a meeting." No one can find the reasoning. The decision gets revisited from scratch or, worse, quietly reversed by someone who was not in the original meeting.

**The fix**: Every decision that affects how the system is built or how the team works gets written into the appropriate layer before the meeting ends or the PR is merged. The meeting or the PR is not done until the decision is captured.

### Anti-Pattern 2: Documentation Created Once, Never Updated

A document is written when a feature ships. Six months later the feature has changed. The document has not. The document is now a liability — it misleads anyone who reads it.

**The fix**: Documentation is updated in the same PR as the code it describes. A PR that changes behavior without updating the relevant documentation is blocked in review (document 09, item G5).

### Anti-Pattern 3: Knowledge Centralized in One Person

"Ask [name] — they know everything about how the condition recording works." This person is a single point of failure. When they are on vacation, sick, or have left, the team is blocked.

**The fix**: The bus factor rule. If there is only one person who knows how something works, write it down immediately. The goal is a team where any engineer can answer any question about the system by reading the repository — without needing to ask a specific person.

### Anti-Pattern 4: The Documentation Graveyard

A Confluence space full of pages that were created years ago, are almost certainly wrong, and are never visited. Engineers learn not to trust it. The documentation exists but provides no value.

**The fix**: Documentation lives in the repository. It is versioned with the code. It is reviewed in PRs. It is maintained or deleted. There is no graveyard because there is no stale documentation that is left in place unchallenged.

### Anti-Pattern 5: AI Context That Resets Every Session

An AI agent starts every session from scratch, re-reading CLAUDE.md, re-running discovery, re-encountering the same pitfalls. Each session produces the same mistakes because there is no mechanism to carry learning forward.

**The fix**: The AI Shared Memory layer (Layer 5) and the CLAUDE.md (Layer 6) carry context across sessions. After every sprint, the memory is updated with learnings. The agent's effective knowledge base grows over time rather than resetting.

---

## Measuring Knowledge Management Effectiveness

Knowledge management is working when:

- A new engineer can answer the six discovery questions within their first day
- An AI agent starting a new session can begin implementation planning without clarifying questions within 10 minutes
- "I don't know — go ask [name]" is rare (< 1 occurrence per sprint)
- The time to resolve "why was this decision made?" is under 15 minutes (the ADR can be found)
- Post-incident reviews rarely conclude with "we didn't know this was possible" (the domain knowledge was documented)

These are observable signals, not hard metrics. Track them through retrospective feedback and onboarding experiences.

---

## The Knowledge Hierarchy Summary

```
Layer 6: CLAUDE.md            → What is this project? How do I start?
Layer 5: AI Shared Memory     → What has the team learned that agents need to know?
Layer 4: ADRs                 → Why is the system structured the way it is?
Layer 3: Engineering Playbook → How does the team work?
Layer 2: Tests                → What behavior is expected, with examples?
Layer 1: Code                 → What does the system actually do?
```

Each layer answers a different question. Together, they provide complete knowledge coverage for anyone — human or AI — who needs to understand, extend, or maintain the system.
