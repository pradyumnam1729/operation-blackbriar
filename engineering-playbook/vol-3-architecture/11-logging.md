# Logging Standards

> Volume 3 · Architecture · Document 11  
> Serilog structured logging, required properties, log levels, sensitive data, and AWS CloudWatch

---

## Why Structured Logging

Traditional string-based logging (`logger.LogInformation("Asset {Id} updated by user {User}")`) produces human-readable output but is difficult to query programmatically. When an incident occurs at 2am and you need to find all events for a specific asset across multiple log streams, free-text search fails you.

Structured logging attaches named properties to log entries. When stored in a structured format (JSON), every property is queryable. CloudWatch Logs Insights can answer: "How many asset updates failed for tenant `f47ac10b` in the last hour?" in seconds.

Serilog is the logging framework. It supports structured properties natively and outputs JSON to AWS CloudWatch Logs.

---

## Required Log Properties

Every log entry must contain these properties. The Serilog middleware and context enrichers populate them automatically — engineers should not set them manually.

| Property | Type | Source | Description |
|---|---|---|---|
| `timestamp` | ISO-8601 | Serilog UTC timestamp | When the log entry was created |
| `level` | string | Serilog | Verbose, Debug, Information, Warning, Error, Fatal |
| `messageTemplate` | string | Serilog | The structured message template (not the rendered message) |
| `tenantId` | UUID string | `MultiTenantResolverMiddleware` → Serilog enricher | The tenant making the request |
| `userId` | UUID string | `JwtBearerEvents.OnTokenValidated` → Serilog enricher | The authenticated user |
| `requestId` | string | `X-Correlation-ID` HTTP header → Serilog enricher | Correlation ID for tracing across services |
| `serviceName` | string | `appsettings.json` | The service producing the log |
| `serviceVersion` | string | Assembly version | The deployed version |
| `traceId` | string | OpenTelemetry | Distributed trace ID (links logs to traces in X-Ray) |
| `spanId` | string | OpenTelemetry | Span ID within the distributed trace |
| `machineName` | string | Environment | ECS task ID for instance-specific troubleshooting |

### Configuration

```csharp
// Program.cs
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Is(isProduction ? LogEventLevel.Information : LogEventLevel.Debug)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("ServiceName", "asset-maintenance")
    .Enrich.WithProperty("ServiceVersion", Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0")
    .Enrich.WithMachineName()
    .WriteTo.Console(formatter: new JsonFormatter())
    .WriteTo.AmazonCloudWatch(new CloudWatchSinkOptions
    {
        LogGroupName = $"/aurigo/asset-maintenance/{environment}",
        MinimumLogEventLevel = LogEventLevel.Information,
        BatchSizeLimit = 100,
        QueueSizeLimit = 10_000,
    })
    .CreateLogger();
```

```csharp
// Middleware/RequestLoggingMiddleware.cs
// Enrich the Serilog context for every request
using (LogContext.PushProperty("RequestId", correlationId))
using (LogContext.PushProperty("TenantId", currentUser.TenantId))
using (LogContext.PushProperty("UserId", currentUser.UserId))
{
    await _next(context);
}
```

---

## Log Levels

Choosing the wrong log level is the most common logging mistake. Log everything at Information and CloudWatch costs escalate; log nothing at Information and you can't diagnose incidents.

### Verbose / Debug

Development and deep diagnostic use only. **Never in production unless troubleshooting a specific issue.** Set `SERILOG__MINIMUMLEVEL=Debug` as an environment variable temporarily — do not change the appsettings default.

```csharp
_logger.LogDebug("EF Core query generated: {Sql}", sql);
_logger.LogDebug("Cache miss for key {Key}; computing value", cacheKey);
```

### Information

Normal, expected operations. Every significant event that an operator would want to know about during a post-incident review. Not every method call — think about what would make a postmortem faster.

```csharp
_logger.LogInformation("Asset {AssetId} created by user {UserId}", asset.Id.Value, userId);
_logger.LogInformation("Inspection {InspectionId} completed with condition index {ConditionIndex}", id, conditionIndex);
_logger.LogInformation("Capital need recalculation triggered for {AssetCount} assets in tenant {TenantId}", count, tenantId);
_logger.LogInformation("Report {ReportId} generation started (type={ReportType})", reportId, reportType);
_logger.LogInformation("Report {ReportId} generation completed in {DurationMs}ms", reportId, elapsed.TotalMilliseconds);
```

### Warning

Something unexpected happened, but the system recovered and the request succeeded. An operator should investigate — it may be a leading indicator of a problem.

```csharp
_logger.LogWarning("Integration sync retry attempt {Attempt} of {MaxAttempts} for tenant {TenantId}", attempt, max, tenantId);
_logger.LogWarning("Validation failed for request {RequestType} from user {UserId}: {Errors}", requestType, userId, errors);
_logger.LogWarning("Cache deserialization failed for key {Key}; falling back to database", cacheKey);
_logger.LogWarning("JWT token expiring within 30 minutes for user {UserId}", userId);
```

### Error

An operation failed. The system is still running, but this request did not complete successfully. A user experienced an error. An operator must investigate.

```csharp
_logger.LogError(ex, "Failed to record inspection {InspectionId} for asset {AssetId} in tenant {TenantId}",
    inspectionId, assetId, tenantId);
_logger.LogError(ex, "EAM sync failed for tenant {TenantId} after {Attempts} attempts", tenantId, attempts);
_logger.LogError(ex, "Report {ReportId} generation failed with error {ErrorType}", reportId, ex.GetType().Name);
```

Note: **always pass the exception as the first argument** to `LogError(Exception ex, ...)`. This ensures the full exception stack trace is included in the structured log entry, not just the message.

### Fatal

The service cannot continue. This should never happen during normal operation. If it does, PagerDuty fires immediately.

```csharp
_logger.LogCritical(ex, "Database connection failed — service cannot start");
_logger.LogCritical("Required configuration missing: {Key}. Service cannot start.", configKey);
```

---

## Sensitive Data Rules

Certain data must never appear in logs. A log entry is observable by anyone with CloudWatch read access in the AWS account, and log data may be shared with support teams.

### Never Log

- JWT tokens (access tokens, refresh tokens)
- Passwords or password hashes
- Full credit card numbers, SSNs, or other PII that could enable fraud
- AWS access keys or secret keys
- EAM API credentials

### Log with Caution (Information Level Only)

- Email addresses — log only at Information level, never at Error or above where it would be included in incident reports shared externally
- User names — acceptable in audit context but not in high-volume operational logs
- Asset names — acceptable; not PII

### Log Correlation, Not PII

When you need to correlate a log entry to a specific user or record, log the **ID**, not the name or email:

```csharp
// Correct: log the ID, not the email
_logger.LogError(ex, "Failed to update user {UserId}", userId);

// Incorrect: email in error log
_logger.LogError(ex, "Failed to update user {UserEmail}", userEmail);
```

---

## Request/Response Logging

The `RequestLoggingMiddleware` logs every HTTP request and response at Information level:

```json
{
  "timestamp": "2026-07-15T14:35:22.347Z",
  "level": "Information",
  "messageTemplate": "HTTP {Method} {Path} responded {StatusCode} in {DurationMs}ms",
  "method": "POST",
  "path": "/api/v1/assets/f47ac10b/inspections",
  "statusCode": 201,
  "durationMs": 87,
  "requestId": "req-7a8b9c0d",
  "tenantId": "tenant-uuid",
  "userId": "user-uuid"
}
```

**Never log request bodies.** Request bodies may contain user input that includes PII or sensitive data. Log only the path, method, status code, and duration.

---

## Log Queries (CloudWatch Logs Insights)

Common queries for incident investigation:

**All errors for a specific request ID:**
```
fields @timestamp, level, message, requestId
| filter requestId = "req-7a8b9c0d"
| sort @timestamp asc
```

**Error rate by endpoint in the last hour:**
```
fields @timestamp, path, statusCode
| filter statusCode >= 500
| stats count() as errorCount by path
| sort errorCount desc
```

**Slow requests (> 500ms) in the last 24 hours:**
```
fields @timestamp, path, durationMs, requestId
| filter durationMs > 500
| sort durationMs desc
| limit 50
```

**All activity for a specific tenant:**
```
fields @timestamp, level, message, userId
| filter tenantId = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
| filter level in ["Warning", "Error"]
| sort @timestamp desc
```

---

## Log Retention

| Environment | Retention period | Rationale |
|---|---|---|
| Development | 7 days | Low value, high volume during active development |
| Staging | 30 days | Enough for pre-release debugging |
| Production | 90 days | Sufficient for incident postmortems |
| Audit log (separate) | 7 years | Legal compliance for public infrastructure agencies |

The application audit log (in the database) is separate from the CloudWatch Logs. The CloudWatch logs are operational (debugging, performance). The database audit log is the legal record of all data mutations.

---

_See also: [12 — Observability](./12-observability.md) for metrics and traces that complement logging, [07 — Security](./07-security.md) for sensitive data handling._
