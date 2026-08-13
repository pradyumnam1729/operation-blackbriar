import test from "node:test";
import assert from "node:assert/strict";
import {
  API_SCOPES,
  generateApiKey,
  hashApiKey,
  isValidScopeSet,
} from "../src/services/apiKeys";
import { evaluateApiKeyAccess, extractPresentedKey } from "../src/middleware/apiKey";
import {
  buildMeta,
  downloadContentType,
  isValidIso,
  parsePagination,
  slugify,
} from "../src/routes/publicApi";
import { OPENAPI_SPEC } from "../src/services/openapiSpec";
import { renderDocsHtml } from "../src/services/openapiDocs";

// ---------- generateApiKey / hashApiKey ----------

test("generateApiKey: pmm_live_ + 40 hex, 49 chars, prefix 15", () => {
  const { plaintext, hash, prefix } = generateApiKey();
  assert.match(plaintext, /^pmm_live_[0-9a-f]{40}$/);
  assert.equal(plaintext.length, 49);
  assert.equal(prefix, plaintext.slice(0, 15));
  assert.equal(prefix.length, 15);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hashApiKey(plaintext));
});

test("generateApiKey: keys are unique across calls", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(generateApiKey().plaintext);
  assert.equal(seen.size, 200);
});

test("hashApiKey: deterministic and collision-sensitive", () => {
  assert.equal(hashApiKey("pmm_live_abc"), hashApiKey("pmm_live_abc"));
  assert.notEqual(hashApiKey("pmm_live_abc"), hashApiKey("pmm_live_abd"));
});

// ---------- isValidScopeSet ----------

test("isValidScopeSet: accepts a non-empty subset, rejects the rest", () => {
  assert.equal(isValidScopeSet(["assets:read"]), true);
  assert.equal(isValidScopeSet([...API_SCOPES]), true);
  assert.equal(isValidScopeSet([]), false);
  assert.equal(isValidScopeSet(["nope"]), false);
  assert.equal(isValidScopeSet(["assets:read", "nope"]), false);
  assert.equal(isValidScopeSet("assets:read"), false);
  assert.equal(isValidScopeSet(undefined), false);
});

// ---------- extractPresentedKey ----------

test("extractPresentedKey: Bearer, X-API-Key, precedence, none", () => {
  assert.equal(extractPresentedKey({ authorization: "Bearer pmm_live_x" }), "pmm_live_x");
  assert.equal(extractPresentedKey({ "x-api-key": "pmm_live_y" }), "pmm_live_y");
  // Bearer wins when both are present.
  assert.equal(
    extractPresentedKey({ authorization: "Bearer pmm_live_a", "x-api-key": "pmm_live_b" }),
    "pmm_live_a"
  );
  assert.equal(extractPresentedKey({}), null);
  assert.equal(extractPresentedKey({ authorization: "Basic abc" }), null);
  // A multi-valued x-api-key header is ignored (only string form accepted).
  assert.equal(extractPresentedKey({ "x-api-key": ["a", "b"] }), null);
});

// ---------- evaluateApiKeyAccess ----------

const key = (scopes: string[]) => ({ id: "k", name: "n", team: "t", scopes });

test("evaluateApiKeyAccess: null key → 401, never distinguishing unknown vs revoked", () => {
  assert.deepEqual(evaluateApiKeyAccess(null, "assets:read"), {
    status: 401,
    error: "Invalid or revoked API key",
  });
});

test("evaluateApiKeyAccess: missing scope → 403", () => {
  assert.deepEqual(evaluateApiKeyAccess(key(["messaging:read"]), "assets:read"), {
    status: 403,
    error: "This key does not have the 'assets:read' scope",
  });
});

test("evaluateApiKeyAccess: present scope → 200", () => {
  assert.deepEqual(evaluateApiKeyAccess(key(["assets:read", "ask"]), "ask"), { status: 200 });
});

// ---------- parsePagination ----------

test("parsePagination: defaults when absent", () => {
  assert.deepEqual(parsePagination(undefined, undefined), { ok: true, page: 1, per_page: 25 });
  assert.deepEqual(parsePagination("", ""), { ok: true, page: 1, per_page: 25 });
});

test("parsePagination: valid integers", () => {
  assert.deepEqual(parsePagination("3", "50"), { ok: true, page: 3, per_page: 50 });
});

test("parsePagination: rejects garbage, zero, negatives, decimals, and per_page > 100", () => {
  for (const bad of [
    ["abc", "10"],
    ["1", "0"],
    ["0", "10"],
    ["-1", "10"],
    ["1.5", "10"],
    ["1", "101"],
    ["1", "1000"],
  ] as [string, string][]) {
    const r = parsePagination(bad[0], bad[1]);
    assert.equal(r.ok, false, `expected reject for ${JSON.stringify(bad)}`);
  }
  // Boundary: per_page = 100 is allowed.
  assert.deepEqual(parsePagination("1", "100"), { ok: true, page: 1, per_page: 100 });
});

// ---------- buildMeta ----------

test("buildMeta: total_pages = ceil(total/per_page), 0 when empty", () => {
  assert.deepEqual(buildMeta(1, 25, 12), { page: 1, per_page: 25, total: 12, total_pages: 1 });
  assert.deepEqual(buildMeta(1, 25, 26), { page: 1, per_page: 25, total: 26, total_pages: 2 });
  assert.deepEqual(buildMeta(1, 25, 0), { page: 1, per_page: 25, total: 0, total_pages: 0 });
  assert.deepEqual(buildMeta(2, 10, 20), { page: 2, per_page: 10, total: 20, total_pages: 2 });
});

// ---------- isValidIso ----------

test("isValidIso: accepts ISO 8601, rejects garbage/empty", () => {
  assert.equal(isValidIso("2026-08-12T14:03:00Z"), true);
  assert.equal(isValidIso("2026-08-12"), true);
  assert.equal(isValidIso("not-a-date"), false);
  assert.equal(isValidIso(""), false);
});

// ---------- downloadContentType ----------

test("downloadContentType: per-format content type + extension", () => {
  assert.deepEqual(downloadContentType("html"), { contentType: "text/html; charset=utf-8", ext: "html" });
  assert.deepEqual(downloadContentType("deck"), { contentType: "text/html; charset=utf-8", ext: "html" });
  assert.deepEqual(downloadContentType("email"), { contentType: "text/html; charset=utf-8", ext: "html" });
  assert.deepEqual(downloadContentType("digest"), { contentType: "text/html; charset=utf-8", ext: "html" });
  assert.deepEqual(downloadContentType("markdown"), { contentType: "text/markdown; charset=utf-8", ext: "md" });
  assert.deepEqual(downloadContentType("svg"), { contentType: "image/svg+xml", ext: "svg" });
});

test("slugify: kebab-cases and never returns empty", () => {
  assert.equal(slugify("Aurigo Masterworks vs Kahua — battlecard"), "aurigo-masterworks-vs-kahua-battlecard");
  assert.equal(slugify("!!!"), "asset");
});

// ---------- renderDocsHtml ----------

test("renderDocsHtml: contains every spec.paths key", () => {
  const html = renderDocsHtml(OPENAPI_SPEC);
  for (const path of Object.keys((OPENAPI_SPEC as { paths: Record<string, unknown> }).paths)) {
    assert.ok(html.includes(path), `docs page is missing path ${path}`);
  }
});

test("renderDocsHtml: no <script> and no external URL in any src/href", () => {
  const html = renderDocsHtml(OPENAPI_SPEC);
  assert.equal(/<script/i.test(html), false, "docs page must contain no <script>");
  // The only http(s) URLs allowed are inside example <code>/<pre> blocks — never
  // in a src/href attribute (qa-reviewer stage 5 grep).
  assert.equal(
    /(?:src|href)\s*=\s*"[^"]*https?:/i.test(html),
    false,
    "docs page must not reference an external URL in a src/href"
  );
});

test("renderDocsHtml: brand — Dark Teal and sharp corners", () => {
  const html = renderDocsHtml(OPENAPI_SPEC);
  assert.ok(html.includes("#015F74"), "expected Aurigo Dark Teal");
  assert.ok(html.includes("border-radius: 0"), "expected sharp corners");
  assert.ok(/font-family:\s*Roboto/i.test(html), "expected Roboto system stack");
});
