import { SCOPE_DESCRIPTIONS } from "./apiKeys";

// Self-contained Open API docs page (blueprint open-api.md §6.2). renderDocsHtml
// walks the spec and produces ONE complete HTML file with a single inline
// <style> block and NO <script>, NO CDN, NO webfont — it must survive
// "Save page as" and open offline. Brand: Roboto system fallback, Dark Teal
// #015F74, sharp corners (border-radius: 0). The ONLY http(s) URLs appear inside
// <pre>/<code> example blocks — never in a src/href attribute.

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const METHOD_BADGE_STYLE: Record<string, string> = {
  get: "badge-get",
  post: "badge-post",
};

interface Operation {
  summary?: string;
  description?: string;
  "x-scope"?: string;
  parameters?: {
    name: string;
    in: string;
    required?: boolean;
    schema?: { type?: string };
    description?: string;
  }[];
  "x-example-curl"?: string;
  "x-example-response"?: string;
}

const GROUPS: { title: string; test: (p: string) => boolean }[] = [
  { title: "Assets", test: (p) => p.startsWith("/assets") },
  { title: "Messaging documents", test: (p) => p.startsWith("/messaging-docs") },
  { title: "Competitive intelligence", test: (p) => p.startsWith("/intel") },
  { title: "Ask", test: (p) => p === "/ask" },
];

function renderOperation(path: string, method: string, op: Operation): string {
  const badge = METHOD_BADGE_STYLE[method] ?? "badge-get";
  const scope = op["x-scope"];
  const params = op.parameters ?? [];

  const paramsTable =
    params.length > 0
      ? `<table class="params">
          <thead><tr><th>Parameter</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
          <tbody>${params
            .map(
              (pr) =>
                `<tr><td><code>${esc(pr.name)}</code></td><td>${esc(pr.in)}</td><td>${esc(
                  pr.schema?.type ?? ""
                )}</td><td>${pr.required ? "yes" : "no"}</td><td>${esc(pr.description ?? "")}</td></tr>`
            )
            .join("")}</tbody>
        </table>`
      : `<p class="muted">No parameters.</p>`;

  const curl = op["x-example-curl"]
    ? `<div class="example"><div class="example-label">Example request</div><pre><code>${esc(
        op["x-example-curl"]
      )}</code></pre></div>`
    : "";
  const sample = op["x-example-response"]
    ? `<div class="example"><div class="example-label">Sample response</div><pre><code>${esc(
        op["x-example-response"]
      )}</code></pre></div>`
    : "";

  return `<div class="endpoint">
    <div class="endpoint-head">
      <span class="badge ${badge}">${esc(method.toUpperCase())}</span>
      <code class="path">${esc(path)}</code>
      ${scope ? `<span class="scope-pill">${esc(scope)}</span>` : ""}
    </div>
    ${op.summary ? `<div class="endpoint-summary">${esc(op.summary)}</div>` : ""}
    ${op.description ? `<p>${esc(op.description)}</p>` : ""}
    ${paramsTable}
    ${curl}
    ${sample}
  </div>`;
}

export function renderDocsHtml(spec: Record<string, unknown>): string {
  const info = (spec.info ?? {}) as { title?: string; version?: string; description?: string };
  const servers = (spec.servers ?? []) as { url?: string }[];
  const baseUrl = servers[0]?.url ?? "/api/public/v1";
  const paths = (spec.paths ?? {}) as Record<string, Record<string, Operation>>;

  const scopeRows = Object.entries(SCOPE_DESCRIPTIONS)
    .map(([scope, desc]) => `<tr><td><code>${esc(scope)}</code></td><td>${esc(desc)}</td></tr>`)
    .join("");

  const errorRows = [
    ["400", "Bad params or body", "{ \"error\": \"<specific message>\" }"],
    ["401", "Missing, unknown, or revoked key", "{ \"error\": \"Invalid or revoked API key\" }"],
    ["403", "Valid key, missing scope", "{ \"error\": \"This key does not have the '<scope>' scope\" }"],
    ["404", "Nonexistent OR non-final resource", "{ \"error\": \"<Resource> not found\" }"],
    ["429", "Reserved (rate limiting is a future version)", "—"],
    ["502", "Upstream model failure (ask)", "{ \"error\": \"The answer could not be generated — try again\" }"],
    ["503", "Service unavailable (DB); ask agent disabled returns \"Ask is temporarily unavailable\"", "{ \"error\": \"Service unavailable\" }"],
  ]
    .map(
      ([code, when, body]) =>
        `<tr><td><code>${esc(code)}</code></td><td>${esc(when)}</td><td><code>${esc(body)}</code></td></tr>`
    )
    .join("");

  // Endpoint reference, grouped and rendered by walking spec.paths.
  const seen = new Set<string>();
  const groupSections = GROUPS.map((group) => {
    const items = Object.entries(paths)
      .filter(([p]) => group.test(p))
      .flatMap(([p, ops]) =>
        Object.entries(ops)
          .filter(([m]) => ["get", "post", "put", "delete", "patch"].includes(m))
          .map(([m, op]) => {
            seen.add(p);
            return renderOperation(p, m, op);
          })
      )
      .join("");
    if (!items) return "";
    return `<h3 class="group-title">${esc(group.title)}</h3>${items}`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(info.title ?? "Open API")} — Documentation</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #20282B; margin: 0; line-height: 1.6; background: #FFFFFF;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 0 24px 64px; }
  .band {
    background: #015F74; color: #FFFFFF; padding: 32px 24px; border-radius: 0;
  }
  .band .wrap { padding-bottom: 0; }
  .band h1 { margin: 0 0 4px; font-size: 26px; font-weight: 700; }
  .band .version { opacity: 0.85; font-size: 14px; }
  .band .purpose { margin: 12px 0 0; max-width: 720px; }
  h2 { color: #015F74; border-bottom: 2px solid #E1E6E9; padding-bottom: 6px; margin-top: 44px; }
  h3.group-title { color: #053445; margin-top: 32px; }
  a { color: #015F74; }
  code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    background: #F5F7F8; padding: 1px 5px; border-radius: 0; font-size: 13px; }
  pre { background: #F5F7F8; padding: 14px 16px; border-radius: 0; overflow-x: auto;
    border-left: 3px solid #015F74; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; }
  th, td { border: 1px solid #E1E6E9; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 14px; }
  th { background: #F5F7F8; }
  .muted { color: #8D979A; }
  .callout { background: #F2FAFB; border-left: 3px solid #46B2BE; padding: 12px 16px; margin: 16px 0; }
  .badge { display: inline-block; color: #FFFFFF; font-weight: 700; font-size: 12px;
    padding: 3px 9px; border-radius: 0; letter-spacing: 0.5px; }
  .badge-get { background: #015F74; }
  .badge-post { background: #053445; }
  .scope-pill { display: inline-block; background: #E1F0F2; color: #015F74; border: 1px solid #46B2BE;
    font-size: 12px; padding: 2px 8px; border-radius: 0; margin-left: 8px; }
  .endpoint { border: 1px solid #E1E6E9; border-radius: 0; padding: 16px 18px; margin: 16px 0; }
  .endpoint-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .path { font-size: 15px; background: none; padding: 0; }
  .endpoint-summary { font-weight: 700; margin-top: 8px; }
  .example-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #8D979A; margin: 12px 0 4px; }
  footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid #E1E6E9; color: #8D979A; font-size: 13px; }
</style>
</head>
<body>
  <div class="band">
    <div class="wrap">
      <h1>${esc(info.title ?? "Open API")}</h1>
      <div class="version">Version ${esc(info.version ?? "1.0.0")}</div>
      <p class="purpose">${esc(info.description ?? "")}</p>
    </div>
  </div>
  <div class="wrap">

    <h2>Overview</h2>
    <p>This API exposes <strong>finalized, PMM-approved</strong> marketing content — assets, positioning &amp; messaging documents, and competitive intelligence — plus a plain-language Ask endpoint, so teams that live in their own tools can consume the same approved content without opening this app.</p>
    <div class="callout"><strong>If it isn't PMM-approved, it isn't in this API.</strong> Draft, in-review, and archived content is never exposed. A nonexistent id and a non-final id return the same 404 — the API never confirms a draft exists.</div>
    <p>Base URL: <code>${esc(baseUrl)}</code></p>

    <h2>Authentication</h2>
    <p>Every data endpoint requires an API key issued by a PMM admin. Ask the PMM team for one. Present it either way:</p>
    <pre><code>Authorization: Bearer pmm_live_EXAMPLE000000</code></pre>
    <pre><code>X-API-Key: pmm_live_EXAMPLE000000</code></pre>
    <div class="callout"><strong>Key handling.</strong> Keys are server-to-server credentials — never embed one in a browser, mobile app, or public repository, and never log it. A key is shown exactly once at creation; store it in your secret manager. Revocation is immediate: a revoked key fails on its next request.</div>

    <h2>Scopes</h2>
    <p>Each key is granted one or more scopes. A request to an endpoint outside the key's scopes returns <code>403</code>.</p>
    <table><thead><tr><th>Scope</th><th>Grants</th></tr></thead><tbody>${scopeRows}</tbody></table>

    <h2>Conventions</h2>
    <p>Successful data responses use an envelope: <code>{ "data": … }</code>, with <code>{ "meta": { "page", "per_page", "total", "total_pages" } }</code> on paginated lists. Every error is <code>{ "error": "<message>" }</code> with the appropriate status. Downloads are the one exception — they return the raw file with a <code>Content-Disposition</code> attachment header.</p>
    <p>Paginated lists accept <code>page</code> (default 1) and <code>per_page</code> (default 25, max 100). <code>product</code> and <code>competitor</code> filters accept a name (case-insensitive, partial match) — no UUIDs required. <code>updated_since</code> is an ISO 8601 timestamp.</p>
    <table><thead><tr><th>Status</th><th>When</th><th>Body</th></tr></thead><tbody>${errorRows}</tbody></table>
    <div class="callout"><strong>Fair use.</strong> There is no hard rate limit yet (<code>429</code> is reserved), but the Ask endpoint consumes AI tokens — call it deliberately. Usage is logged per key and visible to the PMM admin.</div>

    <h2>Endpoint reference</h2>
    ${groupSections}

    <footer>
      Maintained by the PMM team · ${esc(info.title ?? "Hive by Aurigo")}<br>
      Machine-readable spec: <a href="${esc(baseUrl)}/openapi.json">${esc(baseUrl)}/openapi.json</a><br>
      Generated ${esc(new Date().toISOString().slice(0, 10))}
    </footer>
  </div>
</body>
</html>`;
}
