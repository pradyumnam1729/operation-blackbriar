# 13 — Documentation Generation Prompts

Four complete prompts for generating different types of documentation from code, stories, and directory structures.

---

## Prompt 1: API Documentation from Code

Replace `[CONTROLLER_ACTION_PATH]` and `[HANDLER_PATH]`. Paste the full prompt:

---

You are generating API documentation for an endpoint in the Aurigo Maintain backend. You will produce two outputs: (1) C# XML doc comments for the controller action, and (2) a Markdown API reference section.

**Read these files before writing any documentation:**
1. The controller action: `[CONTROLLER_ACTION_PATH]`
2. The handler: `[HANDLER_PATH]`
3. The request DTO (find from the handler's IRequest<> type)
4. The response DTO (find from the handler's return type)
5. The FluentValidation validator for the request

**Output 1: C# XML Doc Comments**

Add these immediately above the controller action method:

```csharp
/// <summary>
/// [One sentence: what this endpoint does, in active voice, for a developer reading Swagger]
/// </summary>
/// <remarks>
/// [Optional: 1-3 sentences of additional context]
///
/// **Required Role:** [role or roles that can call this endpoint]
///
/// **Multi-tenancy:** Results are automatically scoped to the authenticated tenant.
/// </remarks>
/// <param name="[paramName]">[What this parameter is]</param>
/// <returns>[Description of the response body]</returns>
/// <response code="200">[Description of the 200 response]</response>
/// <response code="400">Validation failed. The response body contains field-level error messages.</response>
/// <response code="401">Not authenticated. Include a valid Bearer token in the Authorization header.</response>
/// <response code="403">Authenticated but not authorized.</response>
/// <response code="404">The requested [resource] was not found, or it belongs to a different tenant.</response>
```

**Output 2: Markdown API Reference Section**

```markdown
## [HTTP METHOD] [/api/v1/route]

[1-2 sentence description]

### Authentication
Bearer token required. `Authorization: Bearer <token>`
Required role: `[role]`

### Request

**Path Parameters** (if applicable)
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `uuid` | Yes | The unique identifier of the [resource] |

**Query Parameters** (if applicable)
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | `integer` | No | `1` | Page number (1-based) |
| `pageSize` | `integer` | No | `20` | Results per page (max: 100) |

**Request Body** (for POST/PUT/PATCH)
Content-Type: `application/json`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `[field]` | `[type]` | Yes/No | [e.g., "1-5", "max 200 chars"] | [description] |

### Response

**200 OK**
| Field | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | Unique identifier |
| `[field]` | `[type]` | [description] |

**Error Responses**
| Status | When | Response Body |
|--------|------|---------------|
| `400` | Validation failed | `{ "errors": { "[field]": ["[error message]"] } }` |
| `401` | Missing or invalid token | `{ "message": "Unauthorized" }` |
| `403` | Insufficient role | `{ "message": "Forbidden" }` |
| `404` | Resource not found | `{ "message": "[Resource] not found" }` |

### Example

**Request:**
```http
[HTTP METHOD] /api/v1/[route] HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "[field]": "[example value]"
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "[field]": "[example value]"
}
```
```

**File locations:**
- XML comments: directly in the controller file above the action method
- Markdown: `docs/api/[module]-api.md`

---

## Prompt 2: User Guide from Story

Replace `[STORY_TEXT]`, `[ACS]`, and optionally `[UI_DESCRIPTION]`. Paste the full prompt:

---

You are generating a step-by-step user guide for a feature in Aurigo Maintain.

**The completed user story:**
```
[STORY_TEXT]
```

**Acceptance Criteria:**
```
[ACS]
```

**UI description (optional):**
```
[UI_DESCRIPTION]
```

**Read these files for domain vocabulary:**
- `vol-2-product-knowledge/`
- Relevant vault documentation: `vault/calculations/` or `vault/domain/` if applicable

**Generate the user guide following these rules:**

- Title: Action-oriented ("Recording an Asset Condition Inspection" not "Condition Inspections")
- Write for the persona named in the story
- Use numbered steps for sequential actions, bullets for non-sequential information
- Every step describes exactly one action
- State the expected outcome at each step
- Use the exact UI labels from the acceptance criteria
- Do not use technical terms like "API", "POST request", "database"

```markdown
# [Action-oriented Title]

## Before You Begin
**Who can do this:** [Persona name(s)] with [required role]
**What you need:** [Prerequisites]

## Steps

1. **[Step title in active voice]**
   Navigate to [page path / menu location].
   _You will see:_ [what the user sees when they arrive]

2. **[Step title]**
   [Action description]
   _You will see:_ [expected outcome]

[continue for all steps]

[Last step]
   _Result:_ [What the system shows to confirm success]

## Tips and Best Practices
- [Tip 1]
- [Tip 2]

## What to Do If Something Goes Wrong

**[Error scenario 1]**
[What causes this and how to resolve it]

**[Error scenario 2]**
[What causes this and how to resolve it]

## Related Guides
- [Link to related guide 1]
```

**File location:** `docs/user-guides/[module]/[feature-name].md`

---

## Prompt 3: ADR Draft from PR

Replace `[PR_DESCRIPTION]` and `[DIFF_CONTENT]`. Paste the full prompt:

---

You are drafting an Architecture Decision Record (ADR) from a pull request that contains an architectural decision in the Aurigo Maintain codebase.

**PR Description:**
```
[PR_DESCRIPTION]
```

**PR Diff:**
```diff
[DIFF_CONTENT]
```

**Read these files before drafting:**
1. `vault/decisions/` — read all existing ADRs to understand the format and numbering
2. `vol-9-templates/adr-template.md` — the template to follow

**Your job:**

1. Identify the architectural decision embedded in this PR. Architectural decisions are choices about:
   - Which pattern to use
   - Which library to adopt or reject
   - How to handle a recurring concern
   - A constraint or convention that all future code must follow
   - A trade-off where alternatives were considered

2. If the PR does not contain an architectural decision, state: "No architectural decision identified — this PR is implementing a previously decided pattern" and do not draft an ADR.

3. If an architectural decision is found, draft the ADR following the template exactly.

```markdown
# ADR-[NEXT_NUMBER]: [Short title — state the decision, not the problem]

Date: [today's date]
Status: Proposed

## Context

[2-4 sentences: What is the situation or problem that required a decision?]

## Decision

[1-3 sentences: What was decided? State it clearly. "We will..." or "All [X] must..."]

## Rationale

[3-6 bullet points: Why was this decision made?]

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|----------------|
| [Alternative 1] | [Why it was rejected] |
| [Alternative 2] | [Why it was rejected] |

## Consequences

**Positive:**
- [What becomes easier because of this decision]

**Negative / Trade-offs:**
- [What becomes harder because of this decision]

**Neutral:**
- [Things that change but are neither positive nor negative]

## Compliance

How to check if code complies with this decision:
- [Specific check an engineer or AI agent can perform]

## References
- PR #[PR_NUMBER]
- [Link to vault note if applicable]
```

**File location:** `vault/decisions/ADR-[NEXT_NUMBER]-[kebab-case-title].md`

Note: the ADR is "Proposed" until reviewed by the team lead. Update status to "Accepted" after review.

---

## Prompt 4: README from Directory

Replace `[DIRECTORY_PATH]`. Paste the full prompt:

---

You are generating a README.md for a directory in the Aurigo Maintain codebase. The README must orient any engineer or AI agent who navigates to this directory.

**Directory to document:** `[DIRECTORY_PATH]`

**Step 1 — List the directory contents:**
List all files and subdirectories in `[DIRECTORY_PATH]`. Include subdirectory contents one level deep.

**Step 2 — Read a representative sample of files:**
Read 3-5 files from the directory to understand the patterns. Choose files that represent different types of content.

**Step 3 — Read context:**
Read `CLAUDE.md` and the relevant vault documentation for this directory's domain area.

**Generate the README following these rules:**
- Write for two audiences: a human engineer on their first day and an AI agent starting a new session
- Be specific about naming conventions and patterns observed in the actual files
- Include a "How to add a new [X]" section with numbered steps
- Do not repeat information that is already in CLAUDE.md — reference it instead
- Keep it concise: if someone can read it in 5 minutes, it is the right length

```markdown
# [Directory Name]

[1-2 sentences: What is the purpose of this directory?]

## Contents

| File/Directory | Purpose |
|----------------|---------|
| `[name]` | [what it does or contains] |
| `[name]/` | [what the subdirectory contains] |

## Organization

[2-4 sentences: How is content organized? What naming convention is used?]

## How to [Main Action — e.g., "Add a New Calculation Engine"]

1. [Step 1 with file path]
2. [Step 2]
3. [Step 3]
4. [How to verify your addition is correct]

## Naming Conventions

| Convention | Example | Rationale |
|------------|---------|-----------|
| [Convention description] | `[Example.cs]` | [Why this convention exists] |

## Related Documentation

- [Link to vault/ note or playbook volume]
- [Link to another related directory's README if applicable]

## Common Mistakes

- **[Mistake 1]:** [What goes wrong and how to avoid it]
- **[Mistake 2]:** [What goes wrong and how to avoid it]
```

**File location:** `[DIRECTORY_PATH]/README.md`

**Important:** Do not create the README if one already exists — update the existing one instead. Read the existing README first.

---
