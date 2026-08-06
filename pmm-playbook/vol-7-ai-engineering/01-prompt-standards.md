# Chapter 1 — Prompt Standards

**Volume 7 · PMM Agent Playbook · 2026-08-06**

---

## Brief, Don't Prompt

The Master Instructions §6 draw the line that governs everything in this chapter:

> Bad: "Help me create a battlecard for Competitor X"
> Good: "Read /BRAND-DNA/positioning-and-icp.md and /MARKET-INTELLIGENCE/competitive/competitorX.md. Produce a 2-page battlecard: strengths, weaknesses, talk track, landmines. Save as .md in /PLAYBOOKS-AND-ASSETS/battlecards/. Match brand-voice.md."

A prompt asks the model to figure out what you want. A brief tells the agent what to read, what to produce, and what rules bind it. The difference is not politeness or length; it is whether the output is reproducible. The same brief against the same war-room state produces substantially the same asset. A vague prompt produces whatever the model felt like that day, which is fatal to the 100% messaging-consistency value prop.

Every operating brief in `pmm-playbook/vol-10-prompts/` follows this standard, and every agent definition in `.claude/agents/` expects to be briefed this way.

## The Formula: Context + End State + Constraints

Per Master Instructions §6, every brief carries three parts, explicitly:

**Context — what the agent must read before doing anything.**
Named war-room paths, in read order. The four brand-DNA files are implicit (they arrive by SessionStart injection, see `02-context-engineering.md`); the brief names the task-specific files: which competitive dossier, which win-loss note, which persona file. If the context an agent needs does not exist yet, the brief says so and the agent's first output is a request to populate it — per `CLAUDE.md`, guessing is a failure mode.

**End State — what exists when the task is done.**
Format, length, structure, destination path, and stage. "A 2-page battlecard per `pmm-playbook/vol-9-templates/battlecard-template.md`, saved as a draft to `GTM-War-Room/PLAYBOOKS-AND-ASSETS/battlecards/kahua.md`." An end state that names a template is worth ten adjectives about quality.

**Constraints — the rules that bind the output.**
Audience and persona, voice mode per `Voice of Aurigo - Standards Reference.md`, segment terminology (program vs. portfolio), forbidden-word list reference, and any task-specific limits ("no pricing claims — legal has not cleared the comparison").

A brief missing any of the three is underspecified. The vol-10 rule from the engineering playbook applies verbatim: if the agent needs more than one clarifying follow-up, fix the brief, not the agent.

## Reference Paths, Never Paste Blobs

The single most important mechanical rule: **agent briefs reference war-room paths; they do not paste content.**

Bad: a brief containing 400 lines of pasted positioning doc, competitor notes, and persona description.

Good: a brief containing `Read GTM-War-Room/BRAND-DNA/positioning-and-icp.md and GTM-War-Room/MARKET-INTELLIGENCE/competitive/kahua.md.`

The reasons compound:

1. **One version of the truth.** A pasted blob is a fork. The moment the war-room file is updated, every brief carrying the old paste is now briefing agents with stale positioning. Paths always resolve to the current file.
2. **Auditability.** When an asset's frontmatter lists `sources: [positioning-and-icp.md, competitive/kahua.md]`, a reviewer can check the claim chain. "Sources: whatever was pasted that day" cannot be audited.
3. **Reusable briefs.** Path-based briefs are stable text. The whole `vol-10-prompts` library only works because a brief written on 2026-08-06 still runs correctly after every war-room file it names has been revised.
4. **Caching and cost.** Stable file-based context is cacheable; ad-hoc pastes are not (see `06-cost-and-model-strategy.md`).

The narrow exception: genuinely one-off task input that has no war-room home — the text of a specific RFP question, an email thread to respond to. Even then, if it will be needed twice, it gets a war-room file first.

## The Intake Protocol

Briefs are the input half of the Master Instructions §6 intake protocol. The agent's side:

1. Read the named context (brand DNA is already injected; read the task-specific paths).
2. Ask clarifying questions via AskUserQuestion **before** executing — audience, deal context, deadline — when the brief leaves them open. Do not guess.
3. Restate Context + End State + Constraints in one short block at the top of the working session, so the human can catch a misread before the work happens.
4. Execute; write output as a draft; end with proposed context updates per §8.5.

## Quality Bar for Briefs

- Names every file it depends on, by full path from repo root.
- Names the template the output must follow, when one exists in `pmm-playbook/vol-9-templates/`.
- Names the destination path and stage (`drafts`, `stage: draft`).
- States the audience and persona explicitly — "for Sales" is not a persona; "for an AE in a live Masterworks deal against Kahua, stage 3" is.
- Fits on one screen. If a brief is longer than the asset it requests, the missing piece is a war-room file, not a longer brief.
