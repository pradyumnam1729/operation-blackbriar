# API Standards

> Volume 3 · Architecture · Document 03
> REST design rules, HTTP semantics, error formats, versioning, deprecation lifecycle, and controller patterns

A consistent API surface is essential for external consumers (EAM systems, mobile apps, third-party integrators) and for internal frontend development. When every endpoint follows the same conventions, the OpenAPI client can be generated once and used everywhere. When error responses always have the same shape, the frontend error-handling middleware handles them uniformly. This document defines those conventions for every API endpoint on the Aurigo Infrastructure Lifecycle Platform (Plan → Build → Maintain).

---

## REST Principles

### Resource Naming

- Resources are **nouns, plural, lowercase, hyphenated**. Never verbs.
- Hierarchy reflects ownership, not every relationship.
- IDs are path parameters, not query parameters, when they identify the primary resource.

**Correct:**
```
GET    /api/v1/assets
GET    /api/v1/assets/{assetId}
POST   /api/v1/assets
PUT    /api/v1/assets/{assetId}
PATCH  /api/v1/assets/{assetId}
DELETE /api/v1/assets/{assetId}

GET    /api/v1/assets/{assetId}/inspections
POST   /api/v1/assets/{assetId}/inspections

GET    /api/v1/capital-needs
GET    /api/v1/capital-needs/{needId}

GET    /api/v1/asset-classes
GET    /api/v1/inspection-records

GET    /api/v1/dashboard/summary
```

**Incorrect:**
```
GET  /api/v1/getAsset/{id}           — verb in path
GET  /api/v1/asset                   — singular
GET  /api/v1/AssetClasses            — PascalCase
POST /api/v1/assets/create           — redundant verb
GET  /api/v1/assets?id=abc123        — ID as query param for primary resource
```

### HTTP Methods

| Method | Semantics | Body | Idempotent |
|---|---|---|---|
| GET | Read resource(s) | None | Yes |
| POST | Create a new resource | Request DTO | No |
| PUT | Full replacement of a resource | Complete resource DTO | Yes |
| PATCH | Partial update of a resource | Partial update DTO | Yes (if applied correctly) |
| DELETE | Remove a resource | None (or soft-delete) | Yes |

**When to use PUT vs PATCH:**
Use `PUT` when the client always sends the complete resource state. Use `PATCH` when the client sends only the fields being changed. For our domain, most updates are `PATCH` — an inspector updating just the condition rating should not need to resend the entire asset record.

**Action endpoints** (operations that don't fit pure CRUD) use POST with a descriptive sub-path:
```
POST /api/v1/assets/{assetId}/decommission
POST /api/v1/inspections/{inspectionId}/complete
POST /api/v1/capital-needs/{needId}/approve
POST /api/v1/reports/tamp/generate
```

---

### HTTP Status Codes

| Code | When to use |
|---|---|
| 200 OK | Successful GET, PUT, PATCH (when returning the updated resource) |
| 201 Created | Successful POST that created a resource. **Must include `Location` header** pointing to the new resource. |
| 204 No Content | Successful DELETE, or PATCH/action when there is no response body |
| 400 Bad Request | Input validation failed (FluentValidation errors) |
| 401 Unauthorized | No valid JWT present |
| 403 Forbidden | JWT is valid but the role does not permit this operation |
| 404 Not Found | Resource with the given ID does not exist (or is in another tenant) |
| 409 Conflict | The requested state transition is invalid (e.g., completing an already-complete inspection) |
| 410 Gone | The endpoint version has been sunset. Response includes migration guidance. |
| 422 Unprocessable Entity | Business rule violation (semantically valid but domain rules reject it — e.g., asset replacement year before install date) |
| 429 Too Many Requests | Rate limit exceeded. Response includes `Retry-After` header. |
| 500 Internal Server Error | Unexpected server-side error. The `GlobalExceptionHandlerMiddleware` returns this for any unhandled exception. |
| 503 Service Unavailable | Downstream dependency (EAM connector, DocMgmt) is unhealthy and the operation cannot proceed. |

The distinction between 400 and 422 is important: 400 is for structural/type validation (missing required field, value out of allowed range, invalid format). 422 is for business rule violations that require domain knowledge to detect.

---

## API Versioning and Deprecation Policy

Aurigo Maintain is consumed by three audience classes with very different upgrade cadences:

1. **Aurigo web + mobile frontends** — deployed by us; upgrade within days of an API change.
2. **EAM customer integrations** (Maximo, SAP, Cityworks, Infor, Oracle EAM) — upgrade cycles measured in months; every change requires a customer-side project.
3. **Public infrastructure agency IT teams** — often 6–12 month change windows aligned with fiscal budgets.

This means every breaking change to a Maintain API can cost a Fortune-500 customer weeks of integration work. Our deprecation policy exists to protect customers from surprise breakage while still allowing the API to evolve.

### Versioning Rules

- **URL path versioning**: `/api/v1/...`
- The **entire API is versioned as a unit**. Individual endpoints are not versioned independently.
- Increment the version (`/api/v2/...`) only for breaking changes: removing fields, changing types, renaming resources, changing authentication schemes, tightening validation on existing fields.
- **Additive changes** (new optional fields, new endpoints, new optional query parameters, new response headers) are non-breaking and do not require a version increment.
- Behind the Aurigo API Gateway, the path is prefixed: `/api/asset-maintenance/v1/...` — but the service itself always uses `/api/v1/...`.

### Deprecation Lifecycle

Every API version follows a **five-stage lifecycle**. The timelines below are minimums; enterprise contracts may require longer windows and those override these defaults.

| Stage | Duration | Behavior | Communication |
|---|---|---|---|
| **1. Active** | Indefinite | Full support. All new development targets this version. | None required. |
| **2. Deprecation Announced** | ≥ 3 months | Endpoint continues to serve normally. `Deprecation` and `Sunset` headers added to every response. OpenAPI marks operations with `deprecated: true`. | Email to every registered API integrator + notice in customer success portal + PR to CLAUDE.md. |
| **3. Deprecated with Warnings** | ≥ 6 months | Endpoint continues to serve normally. Response body includes a `_deprecation` warning object. CloudWatch metric `api.deprecated_endpoint.calls` emitted per call for visibility into who is still calling. | Monthly reminder emails; customer success team engages high-volume callers directly. |
| **4. Sunset** | 1 month grace | Endpoint returns 410 Gone with a JSON body pointing to the replacement. A read-only bypass allowlist (per tenant) can be granted by the Engineering Director for critical outages. | Final 30-day notice; formal deprecation letter attached to enterprise contracts. |
| **5. Removed** | Permanent | Route is removed from the codebase. | Post-mortem note in ADR log. |

**Minimum total deprecation window: 12 months** from "Deprecation Announced" to "Removed" for a version. Longer windows (18 months) apply to any endpoint used by an enterprise customer on an active contract.

### Deprecation Headers (Stages 2–4)

Every response from a deprecated endpoint includes these headers ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594), draft-ietf-httpapi-deprecation-header):

```
HTTP/1.1 200 OK
Deprecation: Sun, 01 Nov 2026 00:00:00 GMT
Sunset: Sun, 01 Nov 2027 00:00:00 GMT
Link: </api/v2/assets>; rel="successor-version"
Link: <https://docs.aurigo.com/maintain/migration/v1-to-v2>; rel="deprecation"
Warning: 299 - "Aurigo-Maintain API v1 will be sunset 2027-11-01. Migrate to /api/v2/. See successor-version Link header."
```

Middleware implementation (registered per deprecated route or globally per version):

```csharp
// Api/Middleware/DeprecationHeaderMiddleware.cs
public class DeprecationHeaderMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IReadOnlyDictionary<string, DeprecationInfo> _deprecatedRoutes;

    public async Task InvokeAsync(HttpContext context)
    {
        var matched = _deprecatedRoutes.FirstOrDefault(
            r => context.Request.Path.StartsWithSegments(r.Key));

        if (matched.Value is not null)
        {
            context.Response.Headers["Deprecation"] = matched.Value.DeprecationDate.ToString("R");
            context.Response.Headers["Sunset"] = matched.Value.SunsetDate.ToString("R");
            context.Response.Headers.Append("Link", $"<{matched.Value.SuccessorUrl}>; rel=\"successor-version\"");
            context.Response.Headers.Append("Link", $"<{matched.Value.MigrationGuideUrl}>; rel=\"deprecation\"");
            context.Response.Headers["Warning"] = $"299 - \"{matched.Value.Message}\"";

            _metrics.RecordDeprecatedCall(context.Request.Path, context.User.FindFirst("tenantId")?.Value);
        }

        await _next(context);
    }
}
```

### Sunset Response Body (Stage 4)

After the sunset date, the endpoint returns HTTP 410 Gone with a structured RFC 7807 body:

```json
{
  "type": "https://docs.aurigo.com/maintain/errors/sunset-endpoint",
  "title": "This API version has been sunset",
  "status": 410,
  "detail": "GET /api/v1/assets was sunset on 2027-11-01. Use GET /api/v2/assets instead.",
  "successor": "/api/v2/assets",
  "migrationGuide": "https://docs.aurigo.com/maintain/migration/v1-to-v2",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
```

### Migration Timeline Example

Concrete example: sunsetting `/api/v1/capital-needs` (rewritten as `/api/v2/capital-needs` with a nested budget scenario model).

| Date | Stage | Action |
|---|---|---|
| 2026-11-01 | v2 launch + v1 Announced | v2 released. v1 responses gain `Deprecation` + `Sunset` headers. Email sent to 47 integrators. |
| 2027-02-01 | v1 Deprecated with Warnings | Response body gains `_deprecation` warning field. CloudWatch dashboard tracks calls per tenant. |
| 2027-08-01 | 90-day sunset warning | Final email round. CSMs directly engage top 10 callers still on v1. |
| 2027-10-01 | 30-day sunset warning | Escalation to executive sponsor at each remaining customer. |
| 2027-11-01 | Sunset | v1 returns 410 Gone. Allowlist entries considered per tenant on request. |
| 2027-12-01 | Removed | Code path removed from `main`. Routes deleted. |

**Total window from announcement to removal: 13 months.** No enterprise customer is caught unaware; every integrator has received at least four rounds of notice; usage telemetry drives outreach so we know who is affected.

### What Counts as Breaking

Rules for reviewers to apply during PR review:

**Non-breaking (safe within a major version):**
- Adding a new endpoint
- Adding a new optional field to a request DTO
- Adding a new field to a response DTO
- Adding a new optional query parameter
- Adding a new enum value **only if** clients are documented as tolerant readers (all Aurigo clients are)
- Loosening validation (accepting values that used to be rejected)

**Breaking (requires v-next):**
- Removing or renaming an endpoint
- Removing or renaming a field
- Changing a field's type (string → int, nullable → required)
- Tightening validation (rejecting values that used to be accepted)
- Changing HTTP status code semantics on an existing operation
- Changing authentication or authorization requirements
- Changing pagination shape

**Ambiguous cases** are decided by the Technical Architect. When in doubt, treat it as breaking.

---

## Authentication

- **Bearer JWT** in the `Authorization` header: `Authorization: Bearer <token>`.
- Tokens are issued by the Aurigo lambda-authorizer. The Maintain service validates the signature using the public key fetched from the JWKS endpoint.
- Never accept tenantId from the client as a header or query parameter. It comes only from the JWT claim.
- Tokens contain: `sub` (userId), `tenantId`, `role`, `email`, `exp`.

See [07 — Security](./07-security.md) for full JWT validation details and [ADR-005](./adrs/ADR-005-auth-strategy.md) for the auth strategy rationale.

---

## Multi-Tenancy

- Every API endpoint is scoped to the tenant extracted from the JWT.
- The `MultiTenantResolverMiddleware` reads `tenantId` from the JWT and sets it on the ambient context.
- EF Core global query filters enforce tenant isolation at the database level.
- An asset from Tenant A is never visible to Tenant B, even if Tenant B guesses the asset's UUID (they receive 404, not 403 — never leak existence).

---

## Pagination

All list endpoints **must** paginate. Unbounded queries are not allowed.

Query parameters:
- `page` (integer, default 1) — 1-based page number
- `pageSize` (integer, default 20, max 100)
- `sortBy` (string, optional) — field name to sort by
- `sortDir` (string, optional) — `asc` or `desc`, default `asc`

Response envelope:
```json
{
  "data": [ ... ],
  "total": 247,
  "page": 1,
  "pageSize": 20
}
```

Note: `total` is the count of all matching records (before pagination). The frontend uses this to render pagination controls.

---

## Filtering

- Simple filters via query string parameters: `?status=Active&assetClassCode=BRDG&conditionRating=Poor`
- Complex filters (date ranges, spatial bounding box, multi-select) via a `POST` search endpoint: `POST /api/v1/assets/search` with a filter DTO in the body.
- Never use `GET` with a request body for complex filters — some proxies and clients strip GET bodies.

---

## Error Response Format

All error responses follow [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807):

```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "name": ["Name is required."],
    "conditionIndex": ["Condition index must be between 0 and 5."]
  },
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
```

For 404:
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.4",
  "title": "Asset not found",
  "status": 404,
  "detail": "No asset with ID 'f47ac10b-58cc-4372-a567-0e02b2c3d479' exists in this tenant.",
  "traceId": "00-..."
}
```

For 500:
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.6.1",
  "title": "An unexpected error occurred.",
  "status": 500,
  "traceId": "00-..."
}
```

Note: 500 responses never include stack traces or internal error messages. The full exception is logged server-side with the `traceId` as the correlation key.

---

## Rate Limiting

Aurigo Maintain enforces per-tenant and per-user rate limits at the API Gateway. Limits are conservative by default and can be raised per tenant on request.

| Bucket | Default limit | Notes |
|---|---|---|
| Per user, per endpoint class (read) | 300 req/min | Anonymous limit is 0; login is exempt |
| Per user, per endpoint class (write) | 60 req/min | Applies to POST/PUT/PATCH/DELETE |
| Per tenant, aggregate | 5,000 req/min | Includes all users in the tenant |
| Bulk import endpoints | 5 req/hour | Each import can be up to 50,000 rows |
| Report generation | 20 req/hour | Reports run asynchronously; the limit is on submissions |

When a limit is exceeded, the API returns 429 with:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1753027230
```

---

## Controller Standards

### Structure

```csharp
// Api/Controllers/AssetsController.cs

[ApiController]
[Route("api/v1/assets")]
[Authorize]
[Produces("application/json")]
public sealed class AssetsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AssetsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>List all assets for the current tenant with pagination.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedList<AssetListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PagedList<AssetListItemDto>>> ListAssets(
        [FromQuery] ListAssetsQuery query,
        CancellationToken ct)
    {
        var result = await _mediator.Send(query, ct);
        return Ok(result);
    }

    /// <summary>Get a single asset by ID.</summary>
    [HttpGet("{assetId:guid}")]
    [ProducesResponseType(typeof(AssetDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AssetDetailDto>> GetAsset(
        Guid assetId,
        CancellationToken ct)
    {
        var result = await _mediator.Send(new GetAssetByIdQuery(assetId), ct);
        return Ok(result);
    }

    /// <summary>Create a new asset.</summary>
    [HttpPost]
    [Authorize(Roles = "AssetManager,Administrator")]
    [ProducesResponseType(typeof(AssetDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AssetDto>> CreateAsset(
        [FromBody] CreateAssetCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetAsset), new { assetId = result.Id }, result);
    }

    /// <summary>Decommission an asset.</summary>
    [HttpPost("{assetId:guid}/decommission")]
    [Authorize(Roles = "Administrator")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DecommissionAsset(
        Guid assetId,
        CancellationToken ct)
    {
        await _mediator.Send(new DecommissionAssetCommand(assetId), ct);
        return NoContent();
    }
}
```

### Controller Rules

- **One controller per aggregate root.** `AssetsController` handles everything under `/api/v1/assets`. Never put inspection endpoints in `AssetsController`.
- **Inject only `IMediator`.** No repository injection. No service injection directly. Everything goes through MediatR.
- **Return `ActionResult<T>` with typed results** on all action methods, not raw `IActionResult`.
- **No business logic.** If you write an `if` statement that is not about HTTP (checking route param, building a Location header), it does not belong in the controller.
- **`[Authorize]` on the class** — all endpoints require authentication by default. Specific role requirements via `[Authorize(Roles = "...")]` on individual actions.
- **`[ProducesResponseType]` on every action** — enables accurate Swagger documentation and client generation.
- **`[FromBody]`** for POST/PUT/PATCH bodies. **`[FromQuery]`** for query parameters. **`[FromRoute]`** (implicit via route template) for path parameters.

---

## Complete Example: Full Stack from Endpoint to Handler

### Scenario: Record an Inspection

**Request:**
```
POST /api/v1/assets/{assetId}/inspections
Authorization: Bearer <token>
Content-Type: application/json

{
  "inspectionType": "Routine",
  "inspectedAt": "2026-07-15T14:30:00Z",
  "inspector": "Jane Smith",
  "conditionIndex": 3.2,
  "notes": "Surface cracking observed on north face.",
  "defects": [
    {
      "type": "SurfaceCracking",
      "severity": "Minor",
      "locationDescription": "North face, upper third"
    }
  ]
}
```

**Controller action:**
```csharp
[HttpPost("{assetId:guid}/inspections")]
[Authorize(Roles = "Inspector,AssetManager,Administrator")]
[ProducesResponseType(typeof(InspectionDto), StatusCodes.Status201Created)]
[ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<InspectionDto>> RecordInspection(
    Guid assetId,
    [FromBody] RecordInspectionCommand command,
    CancellationToken ct)
{
    var result = await _mediator.Send(command with { AssetId = assetId }, ct);
    return CreatedAtAction("GetInspection", "Inspections", new { inspectionId = result.Id }, result);
}
```

**Command + Validator + Handler:**
```csharp
public record RecordInspectionCommand(
    Guid AssetId,
    InspectionType InspectionType,
    DateTimeOffset InspectedAt,
    string Inspector,
    decimal ConditionIndex,
    string? Notes,
    IReadOnlyList<DefectInput> Defects
) : IRequest<InspectionDto>;

public class RecordInspectionCommandValidator : AbstractValidator<RecordInspectionCommand>
{
    public RecordInspectionCommandValidator()
    {
        RuleFor(x => x.AssetId).NotEmpty();
        RuleFor(x => x.InspectedAt).LessThanOrEqualTo(DateTimeOffset.UtcNow);
        RuleFor(x => x.Inspector).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ConditionIndex).InclusiveBetween(0m, 5m);
        RuleFor(x => x.Notes).MaximumLength(2000);
        RuleForEach(x => x.Defects).SetValidator(new DefectInputValidator());
    }
}

public class RecordInspectionCommandHandler : IRequestHandler<RecordInspectionCommand, InspectionDto>
{
    // ... constructor and dependencies

    public async Task<InspectionDto> Handle(RecordInspectionCommand request, CancellationToken ct)
    {
        var asset = await _assetRepository.GetByIdAsync(new AssetId(request.AssetId), ct);
        if (asset is null)
            throw new AssetNotFoundException(request.AssetId);

        var inspection = asset.RecordInspection(
            request.InspectionType,
            request.InspectedAt,
            request.Inspector,
            request.ConditionIndex,
            request.Notes,
            request.Defects.Select(d => new Defect(d.Type, d.Severity, d.LocationDescription)).ToList());

        await _inspectionRepository.AddAsync(inspection, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return _mapper.Map<InspectionDto>(inspection);
    }
}
```

---

## OpenAPI / Swagger Standards

- Every controller and action has XML doc comments (`///`).
- All `[ProducesResponseType]` attributes are declared.
- Deprecated operations are marked with `[Obsolete]` and `deprecated: true` propagates to Swagger via Swashbuckle.
- Enum values are documented with their string representations.
- The Swagger JSON is committed to `infra/swagger/asset-maintenance-v1.json` after every API change.
- The frontend client is regenerated via `npm run gen:api` whenever the Swagger JSON changes.
- **CI enforcement:** if the Swagger JSON in the repository doesn't match the built API, the CI pipeline fails. A drift means either the code changed without regenerating Swagger or the frontend client is now stale.

---

## AuthController Special Case

The `AuthController` sits outside the normal versioning scheme. It handles login/logout/token refresh and is consumed by the frontend auth client. It uses route `[Route("auth")]` without the `/api/v1` prefix — this is consistent with the existing Aurigo lambda-authorizer pattern that all frontend clients already expect.

```csharp
[ApiController]
[Route("auth")]
public sealed class AuthController : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginCommand command, CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }
}
```

---

_See also: [01 — Coding Standards](./01-coding-standards.md) for C# naming, [08 — Authorization](./08-authorization.md) for role definitions, [07 — Security](./07-security.md) for JWT handling, [ADR-003](./adrs/ADR-003-api-strategy.md) for the REST vs GraphQL decision._
