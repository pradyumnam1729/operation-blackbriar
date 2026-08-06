# API Design

---

## Header

| Field | Value |
|-------|-------|
| **Design ID** | API-[NNN] |
| **Method** | GET / POST / PUT / DELETE / PATCH |
| **Path** | `/api/v1/[resource]` |
| **Purpose** | [One sentence: what this endpoint enables] |
| **Author** | [Engineer name] |
| **Date** | YYYY-MM-DD |
| **Related Story** | [Story ID] |
| **Related PRD** | [PRD title] |
| **Status** | Draft / Reviewed / Implemented |

---

## Endpoint Overview

**Method:** `[HTTP_METHOD]`
**Full Path:** `/api/v1/[resource-name]`
**Summary:** [One sentence describing the operation]
**Description:** [Two to three sentences describing what the endpoint does, what data it operates on, and any important behavioral notes (idempotency, side effects, events published).]

---

## Authentication and Authorization

| Property | Value |
|----------|-------|
| Authentication required | Yes / No |
| Auth mechanism | JWT Bearer token |
| Required JWT claims | `tenant_id`, `sub` (user ID) |
| Required role | `[RoleName]` — e.g., `AssetManager`, `FieldInspector`, `ReadOnly`, `Admin` |
| Authorization policy | `[PolicyName]` if applicable |

**Authorization logic:** [Describe any resource-level authorization beyond role — e.g., "User may only access records belonging to their tenant (enforced via EF global query filter). Users with the ReadOnly role receive HTTP 403 on all mutation endpoints."]

---

## Request

### Query Parameters (for GET endpoints)

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `[param]` | string / int / guid / date / bool | Yes / No | [Description] | `[example]` |
| `[param]` | string / int / guid / date / bool | Yes / No | [Description] | `[example]` |

### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `[param]` | guid / int / string | Yes | [Description] | `3fa85f64-5717-4562-b3fc-2c963f66afa6` |

### Request Body (for POST / PUT / PATCH)

**Content-Type:** `application/json`

**Schema:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|-----------|-------------|
| `[fieldName]` | string / int / decimal / guid / bool / array / object | Yes / No | [e.g., MaxLength(200), > 0, Valid enum value] | [Description] |
| `[fieldName]` | string / int / decimal / guid / bool / array / object | Yes / No | [Validation] | [Description] |

**Example Request Body:**

```json
{
  "fieldName": "example value",
  "numericField": 42,
  "nestedObject": {
    "nestedField": "value"
  }
}
```

---

## Response

### Success Response

**HTTP Status:** `200 OK` / `201 Created` / `204 No Content`

**Content-Type:** `application/json`

**Schema:**

| Field | Type | Always Present | Description |
|-------|------|---------------|-------------|
| `[fieldName]` | string / int / decimal / guid / bool / array / object | Yes / No | [Description] |
| `[fieldName]` | string / int / decimal / guid / bool / array / object | Yes / No | [Description] |

**Example Response:**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "fieldName": "example value",
  "numericField": 42,
  "createdAt": "2026-07-15T10:30:00Z"
}
```

For paginated list responses, wrap results in the standard envelope:

```json
{
  "items": [],
  "totalCount": 0,
  "pageNumber": 1,
  "pageSize": 50,
  "hasNextPage": false
}
```

---

## Error Responses

| HTTP Status | When It Occurs | Response Body |
|------------|---------------|---------------|
| `400 Bad Request` | Request body fails JSON deserialization (malformed JSON) | `{ "type": "...", "title": "Bad Request", "status": 400 }` |
| `401 Unauthorized` | JWT token missing or expired | `{ "type": "...", "title": "Unauthorized", "status": 401 }` |
| `403 Forbidden` | Authenticated but insufficient role | `{ "type": "...", "title": "Forbidden", "status": 403 }` |
| `404 Not Found` | Resource with the given ID does not exist within the caller's tenant | `{ "type": "...", "title": "Not Found", "status": 404, "detail": "[Resource] with ID '{id}' was not found." }` |
| `422 Unprocessable Entity` | FluentValidation failure — request is valid JSON but fails business rules | `{ "type": "...", "title": "Validation Error", "status": 422, "errors": { "fieldName": ["Error message 1"] } }` |
| `409 Conflict` | Duplicate resource / optimistic concurrency conflict | `{ "type": "...", "title": "Conflict", "status": 409, "detail": "[Specific conflict description]" }` |
| `500 Internal Server Error` | Unhandled exception (should not normally be returned in production) | `{ "type": "...", "title": "Internal Server Error", "status": 500 }` |

---

## Rate Limiting

| Property | Value |
|----------|-------|
| Rate limit applied | Yes / No |
| Limit | [N] requests per minute per tenant |
| Header returned when limited | `Retry-After: [seconds]` |
| HTTP status when limited | `429 Too Many Requests` |

---

## Idempotency

| Property | Value |
|----------|-------|
| Is this endpoint idempotent? | Yes / No |
| Idempotency key | [Header name if applicable — e.g., `Idempotency-Key`, or "N/A"] |
| Key TTL | [e.g., "24 hours", "N/A"] |
| Behavior on duplicate key | [e.g., "Returns the original response without re-executing the operation"] |

---

## Versioning Notes

| Property | Value |
|----------|-------|
| API version | v1 |
| Is this a breaking change from a previous version? | Yes / No |
| Deprecates any existing field? | Yes / No — if Yes, list deprecated fields |
| Deprecation timeline | [Date when deprecated fields will be removed] |

---

## Business Rules Applied

*List the specific validation and business rules enforced by this endpoint. These are derived from the PRD functional requirements.*

| Rule ID | Rule Description |
|---------|-----------------|
| BR-1 | [Business rule, e.g., "An asset cannot have more than one open inspection record for the same date."] |
| BR-2 | [Business rule] |
| BR-3 | [Business rule] |

---

## Integration Notes

*Events published, downstream effects, cache invalidation, audit log entries.*

| Effect | Description |
|--------|-------------|
| Event published | [Event name] — consumed by [handler name] |
| Cache invalidated | [Cache key pattern invalidated] |
| Audit log | [What audit entry is written — entity type, action, fields logged] |
| Notification triggered | [If applicable — what notification is triggered] |

---

## Example cURL

```bash
curl -X POST "https://localhost:5000/api/v1/[resource]" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldName": "example value",
    "numericField": 42
  }'
```

**Example response (201 Created):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "fieldName": "example value",
  "numericField": 42,
  "createdAt": "2026-07-15T14:22:05Z"
}
```

---

## Integration Test Plan

*Test scenarios that must be covered in `Aurigo.AssetMaintenance.IntegrationTests` before this endpoint is production-ready.*

| # | Scenario | Expected Result |
|---|----------|----------------|
| IT-1 | Happy path: authenticated user with correct role submits a valid request | Expected HTTP status; record persisted; events published |
| IT-2 | Missing required field | 422 Unprocessable Entity with `errors.[fieldName]` populated |
| IT-3 | Resource ID does not exist in the tenant | 404 Not Found |
| IT-4 | Resource ID belongs to a different tenant | 404 Not Found (not 403 — 403 would confirm the ID exists) |
| IT-5 | Unauthenticated request (no JWT) | 401 Unauthorized |
| IT-6 | Authenticated with insufficient role | 403 Forbidden |
| IT-7 | Duplicate resource / uniqueness constraint violated | 409 Conflict |
| IT-8 | [Endpoint-specific edge case] | [Expected result] |

---
---

## Example: POST /api/v1/inspection-records

### Header

| Field | Value |
|-------|-------|
| **Design ID** | API-018 |
| **Method** | POST |
| **Path** | `/api/v1/inspection-records` |
| **Purpose** | Record a new field inspection observation for an asset |
| **Author** | Ravi Krishnaswamy |
| **Date** | 2026-06-20 |
| **Related Story** | MW-401 |
| **Status** | Implemented |

### Authentication and Authorization

| Property | Value |
|----------|-------|
| Authentication required | Yes |
| Auth mechanism | JWT Bearer token |
| Required JWT claims | `tenant_id`, `sub` |
| Required role | `FieldInspector` or higher (`AssetManager`, `Admin`) |
| Authorization policy | `CanRecordInspections` |

### Request Body

**Example:**

```json
{
  "assetId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "inspectionDate": "2026-07-15",
  "inspectorName": "Marcus Chen",
  "inspectorCertificationNumber": "NBIS-CA-00891",
  "overallConditionRating": "Fair",
  "notes": "Visible surface cracking on spans 2 and 3. Recommend follow-up in 6 months.",
  "elements": [
    {
      "elementType": "DeckConcrete",
      "conditionRating": "Fair",
      "quantityInspected": 1250.0,
      "quantityUnit": "SquareFeet"
    }
  ]
}
```

**Field table:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|-----------|-------------|
| `assetId` | guid | Yes | Must be a valid UUID | ID of the asset being inspected |
| `inspectionDate` | date (ISO 8601) | Yes | Must not be in the future | Date the inspection was performed |
| `inspectorName` | string | Yes | MaxLength(200) | Full name of the lead inspector |
| `inspectorCertificationNumber` | string | No | MaxLength(100) | NBIS or other certification number |
| `overallConditionRating` | string (enum) | Yes | One of: `Good`, `Fair`, `Poor`, `Serious`, `Critical` | Overall NBI condition rating |
| `notes` | string | No | MaxLength(4000) | Free-form inspection notes |
| `elements` | array | No | Max 50 elements | Element-level condition records |

### Success Response (201 Created)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "assetId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tenantId": "deadbeef-0000-0000-0000-000000000001",
  "inspectionDate": "2026-07-15",
  "inspectorName": "Marcus Chen",
  "inspectorCertificationNumber": "NBIS-CA-00891",
  "overallConditionRating": "Fair",
  "conditionScore": 62,
  "notes": "Visible surface cracking on spans 2 and 3. Recommend follow-up in 6 months.",
  "createdAt": "2026-07-15T14:22:05Z",
  "createdBy": "user-uuid-here"
}
```

### Business Rules Applied

| Rule ID | Rule Description |
|---------|-----------------|
| BR-1 | The asset referenced by `assetId` must exist and belong to the caller's tenant |
| BR-2 | Only one inspection record may exist per asset per inspection date. A second POST with the same `assetId` and `inspectionDate` returns 409 Conflict |
| BR-3 | `inspectionDate` must not be more than 365 days in the past (prevents accidental historical data entry without explicit override) |

### Integration Notes

| Effect | Description |
|--------|-------------|
| Event published | `InspectionRecordCreatedEvent` triggers async RUL recalculation for the asset |
| Cache invalidated | `rul:{tenantId}:{assetId}:*` — all RUL cache entries for this asset are invalidated |
| Audit log | `AuditLog` entry: entity=`InspectionRecord`, action=`Create`, tenantId, userId, timestamp |

### Example cURL

```bash
curl -X POST "https://localhost:5000/api/v1/inspection-records" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "inspectionDate": "2026-07-15",
    "inspectorName": "Marcus Chen",
    "inspectorCertificationNumber": "NBIS-CA-00891",
    "overallConditionRating": "Fair",
    "notes": "Visible surface cracking on spans 2 and 3."
  }'
```

### Integration Test Plan

| # | Scenario | Expected Result |
|---|----------|----------------|
| IT-1 | Authenticated FieldInspector submits a valid request | 201 Created; record persisted; `InspectionRecordCreatedEvent` published |
| IT-2 | `assetId` omitted | 422 with `errors.assetId` populated |
| IT-3 | `overallConditionRating` set to "Excellent" (not a valid enum value) | 422 with `errors.overallConditionRating` populated |
| IT-4 | Asset ID does not exist in the tenant | 404 Not Found |
| IT-5 | Asset ID belongs to a different tenant | 404 Not Found (tenant isolation verified) |
| IT-6 | No JWT token | 401 Unauthorized |
| IT-7 | Authenticated with `ReadOnly` role | 403 Forbidden |
| IT-8 | Same assetId + inspectionDate submitted twice | 409 Conflict on second request |
| IT-9 | Valid request; verify RUL cache invalidated after save | Cache miss on `GET /api/v1/rul/summary` for the affected asset |
