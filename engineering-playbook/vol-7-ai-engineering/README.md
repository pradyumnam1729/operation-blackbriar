# Volume 7 — AI Engineering

This volume covers how AI is engineered at Aurigo across two distinct but related dimensions: how AI agents are built and used to develop software, and how AI capabilities are embedded directly in the Maintain product to deliver intelligence to customers.

The distinction matters. When we talk about AI agents writing code, running tests, and generating documentation, we are talking about engineering tools — Claude Code and the agents that orchestrate it. When we talk about condition prediction, risk scoring, or natural language capital planning queries, we are talking about product features that customers pay for and rely on. The standards, safety requirements, and governance models differ between these two contexts, though the underlying principles overlap significantly.

This volume is mandatory reading for every engineer who uses Claude Code (which is everyone), and it is required reading for engineers building AI-powered features in the Maintain product.

---

## Contents

| File | Topic |
|------|-------|
| [01-prompt-engineering.md](01-prompt-engineering.md) | The CRAFT framework for writing effective prompts. How to write prompts by task type. Anti-patterns that produce poor results. |
| [02-claude-code-standards.md](02-claude-code-standards.md) | How Aurigo configures and uses Claude Code. CLAUDE.md best practices. Model selection. Quality checks for AI-generated code. |
| [03-agent-design.md](03-agent-design.md) | Principles for designing AI agents with single responsibilities. Agent prompt templates. Memory design. Isolation patterns. |
| [04-agent-collaboration.md](04-agent-collaboration.md) | Multi-agent workflows for complex features. Sequential vs. parallel agents. Information handoff. Conflict resolution. |
| [05-shared-memory.md](05-shared-memory.md) | How persistent memory enables AI agents to maintain context across sessions. What to save, what not to save, and how to keep memory current. |
| [06-knowledge-graph.md](06-knowledge-graph.md) | How Aurigo builds and maintains a queryable knowledge graph of the codebase, product, and decisions. Current and future implementation. |
| [07-repository-indexing.md](07-repository-indexing.md) | Strategies for keeping AI agents current with a changing codebase. Indexing levels, triggers, and artifacts. |
| [08-autonomous-planning.md](08-autonomous-planning.md) | How AI agents participate in sprint planning and backlog generation. Human gates and limitations. |
| [09-autonomous-testing.md](09-autonomous-testing.md) | How AI agents write tests for handlers, calculation engines, and UI components. Quality checks for AI-generated tests. |
| [10-autonomous-documentation.md](10-autonomous-documentation.md) | How AI agents keep documentation current as code changes. Triggers, workflows, and review checklists. |
| [11-autonomous-refactoring.md](11-autonomous-refactoring.md) | How AI agents identify and execute refactoring safely. Common patterns for the Aurigo codebase. |
| [12-autonomous-architecture-reviews.md](12-autonomous-architecture-reviews.md) | How AI agents perform architecture reviews against ADRs and playbook standards. Review report format. |
| [13-ai-safety.md](13-ai-safety.md) | The three risks of AI in software development. Correctness, security, and autonomy safeguards. The "explain yourself" principle. |
| [14-human-approval-gates.md](14-human-approval-gates.md) | The six approval gates that humans must pass AI work through before it proceeds. Who approves what and how. |
| [15-ai-cost-management.md](15-ai-cost-management.md) | Cost governance for Claude Code at scale. Per-engineer budgets, model-selection cost matrix, monitoring, attribution, and cost-optimization strategies. |
| [16-when-not-to-use-ai.md](16-when-not-to-use-ai.md) | The counter-playbook. Ten categories of task where AI makes things worse, plus red-flag signals that you should close Claude Code and think. |

---

## Guiding Principle

AI is a multiplier, not a replacement. An engineer paired with a well-configured AI agent can produce the output of two or three engineers without AI. But the engineer remains responsible for every line of code that ships. AI agents do not ship code — engineers ship code, some of which was written with AI assistance.

This distinction is not semantic. It has real implications: engineers cannot disclaim responsibility for code an AI generated. The quality standards, security requirements, and testing obligations apply equally to AI-assisted code and human-written code. "The AI wrote it" is never a defense for a bug that ships to production.

The payoff is real: teams that internalize this principle and build strong AI-assisted workflows consistently outperform teams that either avoid AI entirely or treat AI as an autonomous actor that removes them from the loop.
