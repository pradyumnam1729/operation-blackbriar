# When NOT to Use AI

The rest of Volume 7 is about how to use AI well. This document is the counter-playbook: when to close Claude Code and think manually. Knowing when not to use AI is as valuable as knowing how to use it. An engineer who reflexively opens Claude Code for every task is losing skill, wasting money, and — in specific scenarios documented below — actively producing worse work than they would produce without AI.

The general principle: **AI is a multiplier on clarity, not a substitute for it.** When you are clear about what you want, AI accelerates you dramatically. When you are unclear, AI generates confidently wrong output very quickly. Recognizing the second case and stopping is a professional skill.

---

## Category 1: Underspecified Problems

**Signature:** You cannot yet write a one-paragraph statement of the problem, the constraints, and what success looks like.

**Why AI makes it worse:** Given an underspecified prompt, the model fills gaps with plausible-sounding assumptions. Those assumptions are invisible in the output. You end up implementing a solution to a problem that is subtly different from your actual problem. The gap surfaces during code review, testing, or worse — in production.

**What to do instead:** Think it through on paper or in a text file. Write the problem statement. Write the acceptance criteria. Write what you would do if AI did not exist. Then open Claude Code with a specific prompt.

**Example failure mode:** A PM asked Claude to "generate stories for the new capital planning feature." Claude generated 12 well-formed stories that assumed a specific optimization model, a specific budget scenario UI, and a specific EAM integration path. Two sprints in, engineering realized the stories were for a feature the PM had not actually defined — the PM was hoping Claude would define it. Cost: ~half a sprint of rework.

**Rule of thumb:** If you cannot write the acceptance criteria yourself, do not ask an AI to generate the story. Define the acceptance criteria first (with domain experts, customers, or thinking), then use AI to formalize.

---

## Category 2: Novel Territory in the Codebase

**Signature:** The task involves creating a pattern that does not yet exist in the Aurigo codebase — a new architectural approach, a new integration category, a new domain module.

**Why AI makes it worse:** Aurigo prompts rely heavily on "follow the pattern in file X." When there is no reference pattern, the agent invents one from training data. Invented patterns are almost always subtly wrong for our stack: wrong DI style, wrong error handling convention, wrong test infrastructure, wrong file layout.

**What to do instead:** Design the pattern yourself first. Write the reference implementation for one instance — deliberately, with review. Once one instance exists and has been reviewed as the pattern, use AI to apply the pattern elsewhere.

**Example:** Adding the first EAM integration adapter (Cityworks). The first adapter should be hand-designed by a senior engineer with EM review. Adapters #2-#N (Maximo, SAP, Infor, etc.) can and should use AI heavily, referencing the Cityworks adapter as the pattern.

**Rule of thumb:** For a first-of-its-kind, do it manually. For copies of an established pattern, use AI enthusiastically.

---

## Category 3: Security-Critical, Small-Surface Code

**Signature:** The change touches code that has a small change surface but severe consequences if wrong. Specifically: JWT validation middleware, tenant extraction logic, authorization policy configuration, cryptographic operations, secrets access, IAM policy generation.

**Why AI makes it worse:** The consequences of a subtle bug are catastrophic (cross-tenant data exposure, auth bypass, key leakage). The code is small — you can write it yourself in an afternoon with full comprehension. AI assistance saves 30 minutes and adds review overhead that must be paranoid, not routine, because the failure modes are silent.

**What to do instead:** Write it yourself. Have it reviewed by two senior engineers. Add exhaustive tests including negative scenarios. Do not use AI-generated code in these files without independent line-by-line audit — and if you are going to audit line-by-line anyway, you might as well write it.

**Files that fall in this category at Aurigo Maintain:**
- `Api/Middleware/JwtValidationMiddleware.cs` (or equivalent)
- `Application/Services/TenantContextService.cs`
- `Infrastructure/Persistence/TenantQueryFilterExtensions.cs`
- Anything under `Infrastructure/Security/`
- IAM policy YAML/JSON in `infra/terraform/security/`
- Cryptographic code (encryption, key derivation, IV generation) — use standard .NET APIs; do not have AI "simplify" or "improve" them

**Rule of thumb:** If a subtle bug in this code could produce a headline, do not accept AI-generated code without an audit that is more expensive than writing it yourself would have been.

---

## Category 4: Accountability-Critical Code

**Signature:** The code produces output that a regulator, auditor, or licensed professional signs off on. Any TAMP output field, any bridge structural sufficiency calculation, any capital plan number that goes into a submission a customer signs.

**Why AI makes it worse:** Accountability requires understanding. If an FHWA auditor asks why a specific IRI value in a TAMP submission was calculated the way it was, "an AI wrote it" is not an acceptable answer. The engineer signing off must be able to explain every step of the derivation, and the customer (a licensed engineer) must be able to defend the output professionally.

**What to do instead:** Use AI as a research assistant (find the FHWA formula, cite the section), but implement the calculation code with full comprehension. Write the calculation as though you were teaching it to a colleague. Include comments that cite the exact regulatory source. Independently verify against reference values from published documents.

**Rule of thumb:** If you would not be comfortable defending this code in a regulatory hearing, do not ship it. If you cannot explain it, you cannot defend it.

---

## Category 5: Real-World Domain Knowledge AI Does Not Have

**Signature:** The task requires knowing something specific and current that is not in the model's training data. Current Maximo REST API quirks. The exact behavior of Cityworks 15.4.3 vs 15.4.2. Current FHWA reporting deadlines. Current customer-specific configurations.

**Why AI makes it worse:** The model produces plausible answers to questions it cannot possibly know. "The Maximo REST API endpoint for asset attribute updates is `POST /oslc/os/mxasset/{assetnum}/attributes`" — this is the kind of statement Claude will produce with confidence, and it may or may not be true for the version of Maximo the customer runs.

**What to do instead:** Read the vendor documentation for the specific version. Test against a real instance in staging. Ask the customer's admin. Use AI to help you write the client code once you have confirmed the actual API shape.

**Rule of thumb:** For any statement about a specific third-party system or a specific current fact, verify against a primary source before shipping.

---

## Category 6: Feedback Loop Is Slow or Broken

**Signature:** You cannot quickly verify whether the AI output is correct. Maybe the test suite is slow. Maybe the deployment cycle is long. Maybe the observable behavior only appears in production.

**Why AI makes it worse:** AI is a rapid generator of plausible output. The value comes from a fast loop of generate-verify-correct. Without a fast verification path, the loop degenerates into "generate-and-hope," which is worse than manual code because there is no thinking baked into the output.

**What to do instead:** Fix the feedback loop first. Speed up the test. Add local reproduction. Add better observability. Then use AI. The time invested in a fast loop pays off across every subsequent AI-assisted task.

**Rule of thumb:** If you cannot verify AI output in under 5 minutes, invest in the loop before continuing with AI.

---

## Category 7: You Are Learning the Codebase

**Signature:** You are new to the Aurigo Maintain codebase or new to a specific module. You want to understand how something works.

**Why AI makes it worse (partially):** Asking Claude "explain the RUL calculator" produces a plausible summary that may or may not reflect the actual implementation. Reading the actual code produces genuine understanding that will pay off across many future sessions.

**What to do instead:** Read the code yourself first. Use AI as a debugger for specific confusions ("why does this test seed data use `AssetBuilder.WithConditionScore(0)` instead of `1`?") once you have context. Use AI to summarize *after* you have read, to check your understanding against a second view — never as a substitute for reading.

**Rule of thumb:** Learning benefits from friction. Do not outsource your own comprehension. AI acceleration for a task you already understand is powerful; AI substitution for understanding is a skill drain.

---

## Category 8: Small Tasks Where AI Overhead Dominates

**Signature:** The task is small enough that writing it yourself takes less time than writing a good prompt for it.

**Why AI makes it worse:** Prompt overhead has a floor. Writing a good prompt, waiting for the agent, reviewing the output, and integrating it takes 2-5 minutes minimum. If the task itself takes 3 minutes to type manually, AI is a net negative.

**Common examples:**
- Renaming a variable
- Adding a `[Authorize]` attribute you know exactly where to put
- Adjusting a single Tailwind class
- Fixing a typo in a comment

**What to do instead:** Just do it. Save AI for tasks large enough to justify the coordination overhead.

**Rule of thumb:** If you can complete the task before you finish writing the prompt, don't write the prompt.

---

## Category 9: You Are Debugging Something Intermittent

**Signature:** A bug reproduces sometimes but not always. Timing, concurrency, network flakiness, or state-dependent behavior.

**Why AI makes it worse:** Intermittent bugs require careful observation of the specific failure conditions. AI produces plausible hypotheses that are hard to distinguish from real diagnoses. Following an AI-suggested fix for an intermittent bug often produces a "fix" that appears to work (because the bug is intermittent and did not reproduce in the test) but did not actually address the root cause.

**What to do instead:** Reproduce the bug reliably first. Add logging, add tracing, understand the actual failure mode. Then use AI to help with the fix — with a clear reproduction and a clear diagnosis.

**Rule of thumb:** Do not fix bugs you cannot reproduce. AI cannot compensate for lack of a reproduction.

---

## Category 10: Content That Ships Externally Without Review

**Signature:** The output goes to customers, regulators, or the public with no further human review — customer emails, in-product tooltips shown verbatim, API error messages returned to clients, published documentation, press statements.

**Why AI makes it worse:** AI-generated language occasionally includes subtle inaccuracies, hallucinated features, or off-brand voice. If a human reviews the output before it ships, these can be caught. If the output ships directly (some auto-generated release notes flows, some auto-generated status messages), any mistake reaches customers.

**What to do instead:** Never auto-ship AI-generated external-facing content. AI drafts are excellent starting points; PM or Customer Success reviews and adjusts before publication.

**Rule of thumb:** Anything customers see verbatim must be approved by a human who is accountable for the wording.

---

## Red Flags: Signals You Should Stop and Think

The following are patterns that suggest you should close Claude Code and reflect for 5 minutes.

- **You are on your third iteration of a prompt for the same task.** The prompt is probably not the problem. Your understanding of the task is the problem. Re-derive from scratch on paper.
- **You are copying long stretches of AI output without reading it carefully.** You cannot review what you did not read. Slow down or stop.
- **The AI output looks great and you don't fully understand it.** This is the highest-risk moment. Ask for an explanation. If the explanation is vague, reject the output and rewrite manually.
- **You are asking the agent to explain the same concept for the third time.** You are not learning it via prompt. Close the session and read a book, a spec, or the source.
- **You are prompting the agent to reassure you that a scary change is safe.** The agent will oblige. Its reassurance is worth nothing. Get a human review for scary changes.
- **You have re-run the same prompt with the same result and are hoping for something different.** This is the AI equivalent of hitting F5 hoping the compiler will change its mind. Change the approach.

---

## The One-Sentence Test

Before starting an AI-assisted task, complete this sentence out loud or in writing:

> "I am asking the AI to do X, because I have already done Y, and the constraint I most need it to respect is Z."

If you cannot complete this sentence, close Claude Code and think. AI is a tool for well-formed tasks, not a substitute for the thinking that makes a task well-formed.

---

## Related documents

- Safety framework: `13-ai-safety.md`
- Failure mode catalog: `02-claude-code-standards.md` (AI Agent Failure Mode Catalog section)
- Human approval gates: `14-human-approval-gates.md`
- Cost governance: `15-ai-cost-management.md`
