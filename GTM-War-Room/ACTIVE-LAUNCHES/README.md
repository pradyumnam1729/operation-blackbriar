---
stage: draft
date: 2026-08-06
sources:
  - "PMM Agent — Master Instructions & Contex.md (§4)"
---

# ACTIVE-LAUNCHES

One folder per launch, named `[launch-name]/`, created by the Launch Orchestration agent (B7). No launches are active in this war room yet.

## Required tree per launch (Master Instructions §4)

```
[launch-name]/
├── BRIEF.md              ← launch tier, audience, deliverables, owners, dependencies, readiness
├── assets/
│   ├── messaging.md      ← value propositions in the §7.4 schema; 7-step narrative arc
│   └── objections.md     ← predicted objections + counters
├── enablement/
│   ├── battlecards/
│   └── one-pager.md
└── channels/
    ├── email.md
    └── social.md
```

Rules: launch tier recommended by the agent and approved by PMM admin; channel mix adapts to company stage (see `../about-me.md`); Tier-1 launches include an ABM plan, analyst outreach, and an AEO optimization plan alongside SEO. No channel copy before validated messaging exists in assets/messaging.md. Everything starts as draft; the §8.4 gate applies before anything ships. When a launch completes, archive learnings via a HANDOVER note and propose updates to the BRAND-DNA files.
