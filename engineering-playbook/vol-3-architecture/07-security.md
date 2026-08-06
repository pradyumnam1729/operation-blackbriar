# Security Standards

> Volume 3 · Architecture · Document 07  
> Authentication, input validation, injection prevention, secrets management, audit, and compliance

Security is not a checklist applied at the end of development — it is built into every layer of the architecture. This document covers the security model for Aurigo Maintain from the outer edge (JWT validation at the API Gateway) to the inner layer (parameterized queries preventing SQL injection) and through the data lifecycle (audit log, soft delete, right to erasure). Read this document before implementing any authentication, authorization, or user-input handling.

---

## Authentication

### JWT Bearer Tokens

All API requests to Aurigo Maintain must include a valid JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokens are issued by the **Aurigo lambda-authorizer** — the existing shared authentication service used across all Aurigo platform services. The Maintain service does not issue tokens in production. It validates them.

### JWT Claims Shape

| Claim | Type | Description |
|---|---|---|
| `sub` | string (UUID) | The authenticated user's unique identifier |
| `tenantId` | string (UUID) | The tenant this user belongs to |
| `role` | string | User's role within the tenant (see [08 — Authorization](./08-authorization.md)) |
| `email` | string | User's email address (for display and audit logging) |
| `exp` | integer (Unix timestamp) | Token expiry |
| `iat` | integer (Unix timestamp) | Token issued-at time |

The Maintain service **trusts the lambda-authorizer** to have validated credentials before issuing the token. The service only validates: signature (using JWKS public key), `exp` claim, and that `tenantId` and `role` are present.

### Token Lifetime

| Token type | Lifetime | Storage |
|---|---|---|
| Access token | 8 hours | In-memory (JavaScript) for web; SecureStorage for mobile |
| Refresh token | 30 days | httpOnly cookie for web (prevents XSS theft); SecureStorage for mobile |

The 8-hour access token lifetime balances security (short enough to limit exposure if stolen) and usability (long enough for a full work shift without re-login).

### JWT Validation in .NET

```csharp
// Program.cs — JWT validation configuration
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Auth:Authority"];  // JWKS endpoint
        options.Audience = builder.Configuration["Auth:Audience"];
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)  // 5-minute clock skew tolerance
        };
    });
```

The JWKS public key URL and audience are in configuration, never hardcoded. Rotating the signing key in the lambda-authorizer requires updating the JWKS endpoint URL in configuration — no code change.

---

## Input Validation

All input to the API **must** be validated at the API boundary using FluentValidation. The `ValidationBehavior` MediatR pipeline behavior runs validators automatically before any handler processes a command or query.

### What to Validate

- **Required fields**: Use `RuleFor(x => x.Name).NotEmpty()`.
- **Length limits**: Use `MaximumLength(200)` on all string inputs. No unbounded string inputs.
- **Range constraints**: Use `InclusiveBetween(0m, 5m)` for condition index.
- **Format constraints**: Use `Matches(regex)` for structured strings (postal code, phone number). Use `.Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))` for URLs.
- **Cross-field constraints**: Use `Must()` with context for relationships (`InstallDate` must be before `ReplacementYear`).
- **Enum values**: Automatically validated when using `[ApiController]` attribute with enum model binding.

### What NOT to Validate at This Layer

Do not re-validate in domain entities things that have already been validated at the API boundary. Domain entities should enforce **invariants** (business rules about state), not repeat field validation.

```csharp
// Correct: validate at boundary
public class CreateAssetCommandValidator : AbstractValidator<CreateAssetCommand>
{
    public CreateAssetCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.InstallDate).LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow))
            .WithMessage("Install date cannot be in the future.");
        RuleFor(x => x.ConditionIndex).InclusiveBetween(0m, 5m);
    }
}
```

### String Sanitization

React's built-in JSX escaping prevents most XSS in the frontend — never use `dangerouslySetInnerHTML` with user-provided content. On the backend, all string inputs stored in the database are retrieved and displayed through the templating system — they are not rendered as HTML by the backend.

For rich text inputs (notes, descriptions), use a sanitization library to strip disallowed HTML tags before storage. The `HtmlSanitizer` NuGet package is approved for this purpose.

---

## Injection Prevention

### SQL Injection

SQL injection is prevented by using EF Core's parameterized query generation exclusively. EF Core never interpolates user input into SQL strings.

**Correct:**
```csharp
// EF Core LINQ — safe, parameterized
var asset = await _context.Assets
    .Where(a => a.Name == request.Name)
    .FirstOrDefaultAsync(ct);
```

**Incorrect:**
```csharp
// NEVER do this — raw SQL with string interpolation
var assets = await _context.Assets
    .FromSqlRaw($"SELECT * FROM assets WHERE name = '{request.Name}'")
    .ToListAsync(ct);
```

If raw SQL is necessary (complex geospatial queries, performance-critical aggregations), use parameterized `FromSqlRaw`:
```csharp
// Safe: parameterized raw SQL
var assets = await _context.Assets
    .FromSqlRaw("SELECT * FROM assets WHERE name = {0}", request.Name)
    .ToListAsync(ct);
```

### Cross-Site Scripting (XSS)

- React's JSX escaping handles all rendered content automatically.
- Content Security Policy (CSP) headers are set by the CloudFront distribution and restrict script sources.
- `dangerouslySetInnerHTML` is banned — ESLint rule enforced.
- User-provided content that will be rendered in emails or PDFs is sanitized before rendering.

### SSRF (Server-Side Request Forgery)

The Integration Gateway makes outbound HTTP calls to EAM systems. All outbound URLs are validated against a configured allowlist before the request is made. Unrecognized hostnames are rejected.

```csharp
private void ValidateOutboundUrl(string url)
{
    if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        throw new InvalidIntegrationUrlException(url);

    if (!_allowedHosts.Contains(uri.Host))
        throw new BlockedIntegrationHostException(uri.Host);
}
```

---

## Secrets Management

**All secrets are in AWS Secrets Manager.** The application code and configuration files contain no secrets.

| What | Where |
|---|---|
| Database connection string | AWS Secrets Manager |
| JWT signing key reference | AWS Secrets Manager |
| EAM API keys and credentials | AWS Secrets Manager |
| Mapbox API key | AWS Secrets Manager (injected as env var at build time for frontend) |
| AWS service credentials | IAM role attached to ECS task (no keys) |

`appsettings.json` contains the **shape** of configuration (key names with empty or example values). `appsettings.Development.json` contains local development values (not secrets — just connection strings for local Docker Compose PostgreSQL). Production configuration is injected via environment variables sourced from Secrets Manager at container startup.

**Never commit secrets to git.** Pre-commit hooks check for common secret patterns (high-entropy strings, connection string patterns). GitHub secret scanning is enabled on the repository.

---

## Transport Security

- All traffic is **TLS 1.2 minimum**. TLS 1.0 and 1.1 are disabled at the CloudFront and ALB layers.
- **HSTS** (HTTP Strict Transport Security) is set with `max-age=31536000; includeSubDomains; preload`.
- TLS certificates are managed by **AWS Certificate Manager** (auto-renewal, no manual certificate management).
- Internal service-to-service traffic (within the VPC) also uses TLS — the service mesh enforces mutual TLS for service-to-service authentication.

---

## Audit Log

Every mutation to the database (INSERT, UPDATE, DELETE) is captured automatically by the `AuditInterceptor`. This is not optional and cannot be bypassed.

The audit log captures:
- `entity_type` — which table was modified
- `entity_id` — the UUID of the modified record
- `operation` — INSERT, UPDATE, or DELETE
- `old_values` — JSON snapshot of the record before the change
- `new_values` — JSON snapshot of the record after the change
- `user_id` — the authenticated user who triggered the change (from JWT `sub` claim)
- `tenant_id` — the tenant that owns the record
- `changed_at` — UTC timestamp
- `request_id` — the HTTP request correlation ID (enables tracing a change back to an HTTP request)

Audit records are stored in the `audit.audit_log` table. They are **never updated or deleted** — the table has no UPDATE or DELETE grants for the application user. Right to erasure (GDPR) is implemented by suppressing the PII fields in audit log responses to the data subject, not by deleting records.

---

## File Upload Security

File uploads (inspection photos, report attachments) are subject to:

1. **Type validation**: only accepted MIME types are allowed (JPEG, PNG, PDF). Validated by file signature (magic bytes), not file extension.
2. **Size limit**: maximum 10 MB per file, maximum 50 MB per inspection.
3. **Virus scanning**: AWS Macie or a third-party antivirus Lambda scans uploaded files before they are made accessible.
4. **Storage**: files are stored in S3 with private ACL. Pre-signed URLs with 15-minute expiry are issued for download.
5. **Filename sanitization**: original filenames are not stored as-is. A UUID-based key is used for S3 storage. The original filename is stored in the database metadata only.

---

## Compliance

### SOC 2 Type II

The Aurigo Maintain service is designed to support SOC 2 Type II certification for the trust services criteria:

- **Security (CC6–CC9):** Access controls, encryption in transit and at rest, change management via CI/CD pipeline, incident response runbook.
- **Availability (A1):** Multi-AZ RDS, ECS auto-scaling, CloudWatch monitoring and alerting.
- **Confidentiality (C1):** Tenant data isolation, encrypted S3 storage, encrypted RDS instances.

### Data Residency

Customer data is stored in the AWS region designated at tenant provisioning time. Data never crosses regional boundaries without explicit customer consent.

### GDPR / CCPA Right to Erasure

When a data subject requests erasure of their personal data:

1. The `TenantAdminController` provides a `POST /api/v1/admin/users/{userId}/gdpr-erasure` endpoint (Administrator role required).
2. The handler redacts PII fields (name, email) from user records and replaces them with a tombstone marker.
3. The original values are retained in the audit log (required for legal compliance) but are not returned in any API response for the data subject.
4. S3 inspection photos uploaded by the user are tagged for deletion after the legally-required retention period.

---

## Security Review Requirements

The following changes require explicit security review before merge (in addition to standard code review):

- Any change to JWT validation logic
- Any change to EF Core global query filters (multi-tenancy or soft delete)
- Any new endpoint that accepts `[AllowAnonymous]`
- Any raw SQL usage
- Any change to file upload handling
- Any change to secrets or environment variable handling
- Any new external HTTP client

Security reviews are documented as a comment on the PR and tagged with the `security-reviewed` label.

---

_See also: [08 — Authorization](./08-authorization.md) for role definitions and row-level security, [ADR-005 — Auth Strategy](./adrs/ADR-005-auth-strategy.md) for the lambda-authorizer integration decision._
