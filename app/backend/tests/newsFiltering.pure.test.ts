import test from "node:test";
import assert from "node:assert/strict";
import { filterNewsItems, NewsItemRow } from "../src/services/competitiveNews";

const NOW = new Date("2026-08-11T00:00:00Z");

function item(overrides: Partial<NewsItemRow>): NewsItemRow {
  return {
    id: "id",
    competitor_id: null,
    headline: "h",
    summary_html: "<p>s</p>",
    source_url: null,
    discovered_at: NOW.toISOString(),
    status: "approved",
    approved_by: null,
    approved_at: null,
    created_at: NOW.toISOString(),
    category: "News",
    priority: "normal",
    ...overrides,
  };
}

test("latest view excludes items older than 14 days and excludes Site Change", () => {
  const recent = item({ id: "recent", discovered_at: "2026-08-05T00:00:00Z" });
  const old = item({ id: "old", discovered_at: "2026-07-01T00:00:00Z" });
  const siteChange = item({ id: "sc", category: "Site Change", discovered_at: "2026-08-05T00:00:00Z" });
  const result = filterNewsItems([recent, old, siteChange], "latest", "all", NOW);
  assert.deepEqual(result.map((r) => r.id), ["recent"]);
});

test("past view includes only items older than 14 days, excluding Site Change", () => {
  const recent = item({ id: "recent", discovered_at: "2026-08-05T00:00:00Z" });
  const old = item({ id: "old", discovered_at: "2026-07-01T00:00:00Z" });
  const result = filterNewsItems([recent, old], "past", "all", NOW);
  assert.deepEqual(result.map((r) => r.id), ["old"]);
});

test("site_changes view includes only Site Change items regardless of age", () => {
  const sc = item({ id: "sc", category: "Site Change", discovered_at: "2026-01-01T00:00:00Z" });
  const news = item({ id: "n", category: "News", discovered_at: "2026-08-05T00:00:00Z" });
  const result = filterNewsItems([sc, news], "site_changes", "all", NOW);
  assert.deepEqual(result.map((r) => r.id), ["sc"]);
});

test("priority=high narrows any view to high-priority items only", () => {
  const high = item({ id: "high", priority: "high", discovered_at: "2026-08-05T00:00:00Z" });
  const normal = item({ id: "normal", priority: "normal", discovered_at: "2026-08-05T00:00:00Z" });
  const result = filterNewsItems([high, normal], "latest", "high", NOW);
  assert.deepEqual(result.map((r) => r.id), ["high"]);
});
