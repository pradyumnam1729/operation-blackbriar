// Hand-maintained OpenAPI 3.0.3 spec for the Open API (blueprint open-api.md
// §6.1). One exported constant, no OpenAPI tooling dependency, served verbatim
// by GET /api/public/v1/openapi.json. The spec and the routes/publicApi.ts
// handlers must agree exactly (§3 tables). Every operation carries x-scope, and
// x-example-curl / x-example-response feed the generic docs renderer (§6.2).

const HOST = "http://localhost:3001"; // demo host for curl examples (§11 open decision 3)

const META_SCHEMA = {
  type: "object",
  properties: {
    page: { type: "integer" },
    per_page: { type: "integer" },
    total: { type: "integer" },
    total_pages: { type: "integer" },
  },
};

const PAGINATION_PARAMS = [
  {
    name: "page",
    in: "query",
    required: false,
    schema: { type: "integer", minimum: 1, default: 1 },
    description: "1-based page number.",
  },
  {
    name: "per_page",
    in: "query",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
    description: "Items per page (max 100).",
  },
];

export const OPENAPI_SPEC: Record<string, unknown> = {
  openapi: "3.0.3",
  info: {
    title: "Hive by Aurigo — PMM Open API",
    version: "1.0.0",
    description:
      "Read access to FINALIZED, PMM-approved marketing content (assets, messaging, competitive intel) and a plain-language Ask endpoint. Draft content is never exposed. Server-to-server use only — never embed keys in a browser or mobile app.",
  },
  servers: [{ url: "/api/public/v1" }],
  security: [{ bearerKey: [] }, { headerKey: [] }],
  components: {
    securitySchemes: {
      bearerKey: {
        type: "http",
        scheme: "bearer",
        description: "Authorization: Bearer pmm_live_…",
      },
      headerKey: { type: "apiKey", in: "header", name: "X-API-Key" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      Meta: META_SCHEMA,
      Asset: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          asset_type: { type: "string" },
          product: { type: "string", nullable: true },
          persona: { type: "string", nullable: true },
          vertical: { type: "string", nullable: true },
          version: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      AssetDetail: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          asset_type: { type: "string" },
          product: { type: "string", nullable: true },
          persona: { type: "string", nullable: true },
          vertical: { type: "string", nullable: true },
          version: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
          content_html: { type: "string" },
          download: {
            type: "object",
            properties: {
              available: { type: "boolean" },
              format: {
                type: "string",
                enum: ["html", "svg", "deck", "email", "markdown", "digest"],
              },
            },
          },
          provenance: {
            type: "object",
            properties: {
              template: { type: "string", nullable: true },
              messaging_doc: {
                type: "object",
                nullable: true,
                properties: {
                  title: { type: "string" },
                  version: { type: "integer" },
                },
              },
            },
          },
        },
      },
      MessagingDoc: {
        type: "object",
        properties: {
          id: { type: "string" },
          product: { type: "string", nullable: true },
          version: { type: "integer" },
          title: { type: "string" },
          approved_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      MessagingDocDetail: {
        type: "object",
        properties: {
          id: { type: "string" },
          product: { type: "string", nullable: true },
          version: { type: "integer" },
          title: { type: "string" },
          approved_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                markdown: { type: "string" },
              },
            },
          },
          content_html: { type: "string" },
        },
      },
      Competitor: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string", nullable: true },
          website: { type: "string", nullable: true },
          aurigo_product: { type: "string", nullable: true },
        },
      },
      IntelReport: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          competitor: { type: "string", nullable: true },
          aurigo_product: { type: "string", nullable: true },
          approved_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      IntelReportDetail: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          competitor: { type: "string", nullable: true },
          aurigo_product: { type: "string", nullable: true },
          approved_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
          content_html: { type: "string" },
        },
      },
      Threat: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string", nullable: true },
          aurigo_product: { type: "string", nullable: true },
          summary_html: { type: "string" },
          source_url: { type: "string", nullable: true },
          approved_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      AskRequest: {
        type: "object",
        properties: { question: { type: "string", maxLength: 2000 } },
        required: ["question"],
      },
      AskAnswer: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer_markdown: { type: "string" },
          answer_html: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/assets": {
      get: {
        summary: "List finalized assets",
        description:
          "Finalized artifacts only (battlecards, datasheets, decks, one-pagers…), newest first. Draft, in-review, and archived assets are never returned.",
        "x-scope": "assets:read",
        parameters: [
          {
            name: "asset_type",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter by asset type (e.g. battlecard, datasheet, deck).",
          },
          {
            name: "product",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Product name (case-insensitive, partial match). No UUIDs needed.",
          },
          {
            name: "updated_since",
            in: "query",
            required: false,
            schema: { type: "string", format: "date-time" },
            description: "ISO 8601 timestamp — only assets updated at or after it.",
          },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          "200": {
            description: "A page of finalized assets.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Asset" } },
                    meta: { $ref: "#/components/schemas/Meta" },
                  },
                },
              },
            },
          },
          "400": { description: "Bad params", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the assets:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/assets?asset_type=battlecard&product=Masterworks"`,
        "x-example-response": JSON.stringify(
          {
            data: [
              {
                id: "5e2c0000-0000-0000-0000-000000000001",
                title: "Aurigo Masterworks vs Kahua — battlecard",
                asset_type: "battlecard",
                product: "Masterworks",
                persona: "Sales",
                vertical: "Transportation",
                version: 3,
                created_at: "2026-08-10T09:12:00Z",
                updated_at: "2026-08-12T14:03:00Z",
              },
            ],
            meta: { page: 1, per_page: 25, total: 12, total_pages: 1 },
          },
          null,
          2
        ),
      },
    },
    "/assets/{id}": {
      get: {
        summary: "Get a finalized asset",
        description:
          "Full asset with rendered content_html, download availability, and provenance. Returns 404 for a nonexistent OR non-final id (indistinguishable — the API never confirms a draft exists).",
        "x-scope": "assets:read",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "The asset.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/AssetDetail" } },
                },
              },
            },
          },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the assets:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found or not finalized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/assets/5e2c0000-0000-0000-0000-000000000001"`,
        "x-example-response": JSON.stringify(
          {
            data: {
              id: "5e2c0000-0000-0000-0000-000000000001",
              title: "Aurigo Masterworks vs Kahua — battlecard",
              asset_type: "battlecard",
              product: "Masterworks",
              persona: "Sales",
              vertical: "Transportation",
              version: 3,
              created_at: "2026-08-10T09:12:00Z",
              updated_at: "2026-08-12T14:03:00Z",
              content_html: "<h1>Aurigo Masterworks vs Kahua</h1>…",
              download: { available: true, format: "html" },
              provenance: {
                template: "Insights battlecard",
                messaging_doc: { title: "Masterworks — Positioning & Messaging", version: 2 },
              },
            },
          },
          null,
          2
        ),
      },
    },
    "/assets/{id}/download": {
      get: {
        summary: "Download a finalized asset",
        description:
          "Serves the current version's render payload with a per-format Content-Type and a Content-Disposition attachment filename. Falls back to branded wrapped HTML when a final asset has no render row. Non-envelope response (raw file). 404 for nonexistent or non-final ids.",
        "x-scope": "assets:read",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description:
              "The file. Content-Type is text/html, text/markdown, or image/svg+xml per the render format.",
            content: {
              "text/html": { schema: { type: "string" } },
              "text/markdown": { schema: { type: "string" } },
              "image/svg+xml": { schema: { type: "string" } },
            },
          },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the assets:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found or not finalized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/assets/5e2c0000-0000-0000-0000-000000000001/download" -O`,
        "x-example-response":
          "(binary/text file — e.g. text/html; charset=utf-8, Content-Disposition: attachment; filename=\"aurigo-masterworks-vs-kahua-battlecard.html\")",
      },
    },
    "/messaging-docs": {
      get: {
        summary: "List final messaging documents",
        description:
          "Approved Positioning & Messaging documents, most-recently-approved first. Archived (superseded) versions are excluded — external consumers only ever see the currently approved messaging.",
        "x-scope": "messaging:read",
        parameters: [
          {
            name: "product",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Product name (case-insensitive, partial match).",
          },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          "200": {
            description: "A page of final messaging docs.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/MessagingDoc" } },
                    meta: { $ref: "#/components/schemas/Meta" },
                  },
                },
              },
            },
          },
          "400": { description: "Bad params", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the messaging:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/messaging-docs?product=Masterworks"`,
        "x-example-response": JSON.stringify(
          {
            data: [
              {
                id: "9a1f0000-0000-0000-0000-000000000001",
                product: "Masterworks",
                version: 2,
                title: "Masterworks — Positioning & Messaging",
                approved_at: "2026-08-11T10:00:00Z",
                created_at: "2026-08-09T16:40:00Z",
              },
            ],
            meta: { page: 1, per_page: 25, total: 3, total_pages: 1 },
          },
          null,
          2
        ),
      },
    },
    "/messaging-docs/{id}": {
      get: {
        summary: "Get a final messaging document",
        description:
          "Full document with sections[] and content_html. War-room paths, guard/gap fields, content_md, and user ids are never exposed. 404 for nonexistent or non-final ids.",
        "x-scope": "messaging:read",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "The messaging doc.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/MessagingDocDetail" } },
                },
              },
            },
          },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the messaging:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found or not finalized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/messaging-docs/9a1f0000-0000-0000-0000-000000000001"`,
        "x-example-response": JSON.stringify(
          {
            data: {
              id: "9a1f0000-0000-0000-0000-000000000001",
              product: "Masterworks",
              version: 2,
              title: "Masterworks — Positioning & Messaging",
              approved_at: "2026-08-11T10:00:00Z",
              created_at: "2026-08-09T16:40:00Z",
              sections: [
                { id: "A1", title: "The Why (Golden Circle)", markdown: "…" },
              ],
              content_html: "<h1>Masterworks — Positioning & Messaging</h1>…",
            },
          },
          null,
          2
        ),
      },
    },
    "/intel/competitors": {
      get: {
        summary: "List tracked competitors (registry)",
        description:
          "Pure registry facts the company tracks — no claims, no internal notes/aliases/sources. Small list, no pagination.",
        "x-scope": "intel:read",
        parameters: [],
        responses: {
          "200": {
            description: "The competitor registry.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Competitor" } },
                    meta: { type: "object", properties: { total: { type: "integer" } } },
                  },
                },
              },
            },
          },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the intel:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/intel/competitors"`,
        "x-example-response": JSON.stringify(
          {
            data: [
              {
                id: "c7d30000-0000-0000-0000-000000000001",
                name: "Kahua",
                category: "Capital program management",
                website: "https://kahua.com",
                aurigo_product: "Masterworks",
              },
            ],
            meta: { total: 8 },
          },
          null,
          2
        ),
      },
    },
    "/intel/reports": {
      get: {
        summary: "List approved competitive intelligence reports",
        description:
          "CI reports that a PMM admin approved (final only, guard-gated). Most-recently-approved first.",
        "x-scope": "intel:read",
        parameters: [
          {
            name: "competitor",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Competitor name (case-insensitive, partial match).",
          },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          "200": {
            description: "A page of approved CI reports.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/IntelReport" } },
                    meta: { $ref: "#/components/schemas/Meta" },
                  },
                },
              },
            },
          },
          "400": { description: "Bad params", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the intel:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/intel/reports?competitor=Kahua"`,
        "x-example-response": JSON.stringify(
          {
            data: [
              {
                id: "b1a20000-0000-0000-0000-000000000001",
                title: "Kahua — competitive intelligence report",
                competitor: "Kahua",
                aurigo_product: "Masterworks",
                approved_at: "2026-08-11T12:00:00Z",
                created_at: "2026-08-10T08:00:00Z",
              },
            ],
            meta: { page: 1, per_page: 25, total: 4, total_pages: 1 },
          },
          null,
          2
        ),
      },
    },
    "/intel/reports/{id}": {
      get: {
        summary: "Get an approved competitive intelligence report",
        description:
          "Full approved report with content_html. Generation inputs and user ids are never exposed. 404 for nonexistent or non-final ids.",
        "x-scope": "intel:read",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "The CI report.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/IntelReportDetail" } },
                },
              },
            },
          },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the intel:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found or not finalized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/intel/reports/b1a20000-0000-0000-0000-000000000001"`,
        "x-example-response": JSON.stringify(
          {
            data: {
              id: "b1a20000-0000-0000-0000-000000000001",
              title: "Kahua — competitive intelligence report",
              competitor: "Kahua",
              aurigo_product: "Masterworks",
              approved_at: "2026-08-11T12:00:00Z",
              created_at: "2026-08-10T08:00:00Z",
              content_html: "<h1>Kahua — competitive intelligence report</h1>…",
            },
          },
          null,
          2
        ),
      },
    },
    "/intel/threats": {
      get: {
        summary: "List approved market threats",
        description:
          "New entrants / market threats a PMM admin approved (final only). AI drafting aids (rationale, confidence) are never exposed. Small list, no pagination.",
        "x-scope": "intel:read",
        parameters: [],
        responses: {
          "200": {
            description: "Approved market threats.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Threat" } },
                    meta: { type: "object", properties: { total: { type: "integer" } } },
                  },
                },
              },
            },
          },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the intel:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  "${HOST}/api/public/v1/intel/threats"`,
        "x-example-response": JSON.stringify(
          {
            data: [
              {
                id: "d4e50000-0000-0000-0000-000000000001",
                name: "BuilderCo AI",
                category: "New entrant",
                aurigo_product: "Masterworks",
                summary_html: "<p>…</p>",
                source_url: "https://example.com/builderco",
                approved_at: "2026-08-11T13:00:00Z",
              },
            ],
            meta: { total: 2 },
          },
          null,
          2
        ),
      },
    },
    "/ask": {
      post: {
        summary: "Ask the PMM knowledge engine",
        description:
          "Plain-language question over PMM-approved context; returns an answer only (no artifact routing, no trace). Uses AI tokens.",
        "x-scope": "ask",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/AskRequest" } },
          },
        },
        responses: {
          "200": {
            description: "The answer, in markdown and rendered HTML.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/AskAnswer" } },
                },
              },
            },
          },
          "400": { description: "Missing / too-long question", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Missing / invalid / revoked key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Key lacks the ask scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "502": { description: "The answer could not be generated", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "503": { description: "Ask is temporarily unavailable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
        "x-example-curl": `curl -X POST -H "X-API-Key: pmm_live_EXAMPLE000000" \\\n  -H "Content-Type: application/json" \\\n  -d '{"question":"What proof points do we have for Masterworks in transportation?"}' \\\n  "${HOST}/api/public/v1/ask"`,
        "x-example-response": JSON.stringify(
          {
            data: {
              question: "What proof points do we have for Masterworks in transportation?",
              answer_markdown: "Twelve state DOTs run their capital programs on Masterworks…",
              answer_html: "<p>Twelve state DOTs run their capital programs on Masterworks…</p>",
            },
          },
          null,
          2
        ),
      },
    },
  },
  // 429 rate limiting is reserved for a future version (decision §0.1-5).
  "x-reserved-status-codes": { "429": "Rate limiting is reserved for a future version." },
};
