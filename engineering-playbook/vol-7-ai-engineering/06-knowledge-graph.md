# Knowledge Graph Architecture

A knowledge graph is a structured representation of entities and relationships. In the context of Aurigo's engineering organization, the knowledge graph captures what exists in the codebase — classes, methods, relationships, patterns — and the broader product knowledge that sits above the code — domains, business rules, integration mappings, and architecture decisions. Together, these enable an AI agent to answer questions like "which entities reference the InspectionRecord?" or "what ADRs apply to this type of change?" with precision that would otherwise require manual search.

This document describes the distinction between the knowledge graph and the memory system, the current implicit implementation, and the roadmap for an explicit queryable knowledge graph.

---

## Knowledge Graph vs. Memory: The Distinction

Memory is episodic: it captures events in time — decisions made, corrections applied, project state as of a certain date. Memory answers questions like "what was decided?" and "what mistakes have been made before?"

The knowledge graph is semantic: it captures structural relationships — what things are, how they relate to each other, what rules govern them. The knowledge graph answers questions like "what are the dependencies of the InspectionRecord entity?" and "which query handlers produce data that is consumed by the capital planning module?"

Together, they give an AI agent both the historical context (memory) and the structural understanding (knowledge graph) needed to make good decisions.

**Without a knowledge graph:** An agent implementing a feature that depends on the InspectionRecord entity must read multiple files to understand the entity's structure, its relationships to other entities, the validation rules applied to it, and the indexes on it. This is doable but slow and error-prone — the agent may miss a relationship.

**With a knowledge graph:** The agent can query "describe the InspectionRecord entity and all its relationships" and get a complete, structured answer in one step, derived from the authoritative graph that was built by analyzing the codebase.

---

## What the Knowledge Graph Captures

The full knowledge graph has five categories of nodes:

### 1. Code Entities

Every significant code artifact is a node:
- **Classes:** Domain entities, application handlers, infrastructure services, API controllers
- **Methods:** Handler.Handle(), CalculateRemainingUsefulLife(), PostAsync()
- **Properties:** Entity fields with their types and constraints
- **Relationships:** "InspectionRecord has many DefectRecords," "CreateInspectionRecordCommandHandler depends on AssetMaintenanceDbContext"

Edges between code entities include:
- *depends-on:* Class A uses Class B
- *implements:* Handler implements IRequestHandler<TCommand, TResponse>
- *inherits-from:* Entity inherits from AggregateRoot
- *configures:* EntityTypeConfiguration configures Entity
- *tests:* TestClass tests Handler

### 2. Architecture Decisions

Every ADR is a node, with edges to:
- The code entities that implement the decision
- The code entities that must comply with the decision
- Other ADRs that the decision depends on or supersedes

Example: ADR-001 (Clean Architecture) connects to every controller, handler, and entity in the codebase. A query against this node reveals everything that must comply with Clean Architecture boundaries.

### 3. Product Knowledge

Domain concepts are nodes:
- **Domains:** Asset Registry, Inspections, Capital Planning, Risk Scoring
- **Business Rules:** "ConditionScore must be in range 0-5," "A capital need can only be approved if the asset condition is below the threshold"
- **Regulatory Requirements:** "TAMP compliance requires pavement and bridge condition reporting in federal format"

Edges connect business rules to the code entities that enforce them and the tests that verify them.

### 4. Integration Patterns

EAM adapters are nodes with edges to:
- The canonical data model entities they map to
- The sync direction (push, pull, bidirectional)
- The conflict resolution strategy
- The field mappings (Cityworks Work Order Status → Aurigo Job Order Status)

This subgraph enables an agent implementing a new integration to immediately understand what patterns exist, what the canonical model looks like, and how similar integrations handle edge cases.

### 5. Test Coverage

Test nodes connect to the code they test:
- Which handlers have unit tests?
- Which calculation engines have 90%+ line coverage?
- Which API endpoints have integration tests?
- Which frontend components have component tests?
- What is untested?

The coverage subgraph enables targeted test generation: "generate tests for the nodes with no test coverage in the RiskScoring domain."

---

## Current Implementation: Implicit Knowledge Graph

In the current phase of Aurigo's development, the knowledge graph is implicit — it exists in the file structure, the CLAUDE.md, and the playbook documents. Agents build their mental model of the codebase through repository discovery (reading files, analyzing patterns, building understanding through exploration).

This is sufficient for a small team with a moderate-size codebase. The limitation is that it is slow (agents must read many files to answer structural questions) and it is incomplete (agents may miss relationships they did not encounter during discovery).

**How the implicit graph is structured today:**

The CLAUDE.md provides the top-level architecture: layers, patterns, constraints, key commands. The playbook (Volume 2) provides domain knowledge: what each module does, what the entities are, how the business rules work. The ADRs (Volume 3) provide the decision graph. The code itself provides the complete structural details.

An agent performing a full repository discovery (see `vol-7-ai-engineering/07-repository-indexing.md`) reads all of these sources and builds an in-context mental model that approximates the knowledge graph. This works, but the model is private to the session and must be rebuilt in every session.

---

## Phase 3: Explicit Knowledge Graph

When the codebase reaches sufficient maturity (100+ domain entities, 500+ test files, multiple integration adapters), the implicit knowledge graph becomes too expensive to build in every session. At that point, Aurigo will implement an explicit queryable knowledge graph.

**Implementation components:**

*Code analysis pipeline:*
Triggered on every merge to main. Runs static analysis on the codebase to extract:
- All class definitions, their base classes, implemented interfaces, and dependencies
- All method signatures and their callers
- All entity configurations (EF Core `IEntityTypeConfiguration`) to extract relationship information
- All test classes and their relationships to the classes they test

*ADR graph builder:*
Parses all ADR markdown files to extract:
- ADR number and title
- Status (accepted, deprecated, superseded)
- Compliance rules (what code patterns must or must not exist to comply)
- Supersession chains

*Coverage graph builder:*
Parses xUnit and Vitest test output to map test coverage to code entities.

*Query interface:*
A natural language or structured query interface that agents can call:
- "Which handlers depend on the InspectionRecord entity?"
- "Which ADRs apply to adding a new database index?"
- "Which calculation engines have less than 90% test coverage?"
- "What are the field mappings for the Cityworks work order adapter?"

**Technology options:**

*Embedded graph (for prototype):* A JSON document generated by the analysis pipeline, stored in the repository at `.graph/knowledge-graph.json`. Agents read this file and query it by parsing the JSON. Simple, no infrastructure required, adequate for moderate-scale.

*Neo4j (for scale):* A dedicated graph database with Cypher query language. Enables complex relationship traversal queries. Required when the graph has millions of nodes and edges (large enterprise codebase). Infrastructure overhead is significant.

*Vector database with knowledge graph (for semantic queries):* Combine graph structure with vector embeddings of code descriptions. Enables semantic queries: "find code that does something similar to the RUL calculation" — useful for code reuse discovery and pattern matching.

---

## Knowledge Graph Maintenance

A knowledge graph is only valuable if it is current. A stale knowledge graph is worse than no graph — it confidently misleads agents about the current state of the codebase.

**Automated maintenance:**
- Code analysis pipeline runs on every merge to main
- ADR graph updates when new ADRs are committed
- Coverage graph updates on every test run in CI

**Manual maintenance triggers:**
- Major refactoring (rename of entities, restructuring of layers)
- Addition of a new domain or module
- Integration of a new EAM adapter
- Quarterly review for semantic correctness (the graph is structurally accurate but the labels and descriptions may be stale)

**Freshness indicators:**
- Graph generation timestamp: when was the graph last built?
- Staleness warnings: if a graph was built more than 7 days ago, agents should note this and consider whether the graph reflects the current state
- Delta report: the analysis pipeline should produce a delta report showing what changed since the last graph build

---

## Practical Use Today: Repository Discovery Protocol

Until the explicit knowledge graph is built, agents build their mental model through structured repository discovery. The protocol is documented in `vol-7-ai-engineering/07-repository-indexing.md` and the corresponding ready-to-use prompt is in `vol-10-claude-prompts/01-repository-discovery.md`.

Engineers should run a repository discovery session:
- At the start of every significant feature implementation
- After any major merge that affected the area being worked in
- When a new engineer joins the team for the first time on the codebase

The output of a discovery session should be saved to the project memory (`project_state.md`) so that subsequent sessions can benefit from the discovered context without re-running the full discovery.
