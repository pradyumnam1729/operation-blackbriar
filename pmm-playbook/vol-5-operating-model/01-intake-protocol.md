# 01 — The Intake Protocol

*Encoded from Master Instructions §6 (brief, don't prompt) and §3.5 (triage).*

---

## Brief, Don't Prompt

Every task in the system — human-initiated or scheduled — begins with a brief, not a prompt. The difference is the difference between delegation and wishing:

**Bad (a prompt):** "Help me create a battlecard for Competitor X."

**Good (a brief):** "Read `/BRAND-DNA/positioning-and-icp.md` and `/MARKET-INTELLIGENCE/competitive/competitorX.md`. Produce a 2-page battlecard: strengths, weaknesses, talk track, landmines. Save as .md in `/PLAYBOOKS-AND-ASSETS/battlecards/`. Match `brand-voice.md`."

The Prompt Formula every brief completes:

| Element | Content |
|---------|---------|
| **Context** | What the agent needs to know: read brand files + the named task-specific inputs |
| **End State** | What the output looks like: format, length, destination file |
| **Constraints** | Rules, forbidden words, channel, persona, audience |

A brief missing any element is returned for completion — by the orchestrator to a human requester, or by an agent to the orchestrator. The system never charitably fills gaps with assumptions; assumptions are where generic output comes from.

---

## Clarify Before Executing

The standing pattern (§6): *"Read all brand files first. Ask me clarifying questions using AskUserQuestion before you execute. Do not guess."*

Rules of engagement for the clarification step:

1. **Questions come before work, not during.** One round of well-chosen questions beats an interrupted execution. Agents batch their questions.
2. **Only questions the war room cannot answer.** "Who is our ICP?" is not a clarifying question — it is in `positioning-and-icp.md`. Asking the user what the system should know is an intake failure in the other direction.
3. **Ambiguity of scope, audience, or product is always worth a question.** Which competitor, which deal, which product line, which persona — these change everything downstream and cost one question each. (See the mandatory-clarification step in `../../.claude/agents/competitive-intel.md`.)
4. **In the app**, this pattern is the request form plus follow-up prompts: asset type, product, audience, and deal context are structured inputs, and the orchestration layer surfaces agent questions to the requester before generation starts ([Vol 3, ch. 03](../vol-3-architecture/03-ai-architecture.md)).

---

## Triage — Classification Before Dispatch

Before any agent runs, the orchestrator classifies the request into the §3.5 buckets:

| Bucket | Budget | Typical requests | Handling |
|--------|--------|------------------|----------|
| Company-level initiative | ~50% | Repositioning, market entry, Tier-1 launch, pricing overhaul | Full workflow, PMM closely involved, multiple agents |
| Team-level initiative | ~25% | Persona refresh, message testing, enablement updates | Standard workflow, single owning agent |
| Always-on program | ~15% | Scheduled runs ([ch. 06](06-always-on-programs.md)) | Dispatched by schedule, not by request |
| Ad hoc | ~10% | Live-deal battlecard, board slides, one-pager for a call | Fast path — but gated and logged like everything else |

The triage steps, applied to every request:

1. **Classify** into a bucket.
2. **Trace** to a company OKR from `strategy.md`. Untraceable → flagged as sand and said so to the requester. The flag is information, not refusal — but a jar full of unflagged sand is how PMM functions drown ([Vol 2, ch. 08](../vol-2-domain-knowledge/08-operating-cadence.md)).
3. **Gate-check:** name the required intelligence inputs and verify freshness ([Vol 4, ch. 00](../vol-4-agent-organization/00-org-overview.md)). Stale or missing → the intelligence task is dispatched first, and the requester is told the honest sequence.
4. **Dispatch** with a complete brief.
5. **Log for promotion review:** the triage log feeds C14; an ad hoc request seen three times is an always-on candidate.

---

## Why Intake Is a Workflow, Not Politeness

Every downstream failure the system guards against enters at intake: generic output enters as a vague brief, guessing enters as an unasked question, sand enters as an unclassified request, and unfounded assets enter as a skipped gate-check. Ten disciplined minutes at intake are cheaper than any amount of downstream QA. This is also why the app's request surfaces are forms rather than chat boxes: the structure *is* the protocol.

---

*Next: [02 — Foundation-Doc Workflow](02-foundation-doc-workflow.md)*

Last updated: 2026-08-06
