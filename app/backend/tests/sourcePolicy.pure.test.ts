import test from "node:test";
import assert from "node:assert/strict";
import { SOURCE_POLICY, SWEPT_TYPES, isDue, refreshHoursFor } from "../src/services/sourcePolicy";

test("refreshHoursFor: per-source override wins; unknown types fall back to 'other'", () => {
  assert.equal(refreshHoursFor("pricing", null), 24 * 7);
  assert.equal(refreshHoursFor("pricing", 12), 12);
  assert.equal(refreshHoursFor("mystery-type", null), SOURCE_POLICY.other.refreshHours);
});

test("isDue: never-scraped is always due; fresh within cadence is not; stale is", () => {
  assert.equal(isDue(null, "news", null), true);
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  assert.equal(isDue(oneHourAgo, "news", null), false);
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3_600_000).toISOString();
  assert.equal(isDue(eightDaysAgo, "news", null), true);
});

test("Phase-0 sweep set is the conservative subset (no jobs/procurement/analyst yet)", () => {
  assert.deepEqual(SWEPT_TYPES, ["pricing", "release_notes", "reviews", "news"]);
  for (const t of SWEPT_TYPES) {
    assert.ok(SOURCE_POLICY[t].sweepQueries("Kahua").length > 0, t);
  }
  assert.equal(SOURCE_POLICY.jobs.sweepQueries("Kahua").length, 0);
  assert.equal(SOURCE_POLICY.procurement.sweepQueries("Kahua").length, 0);
});

test("domain acceptance is a real hostname check, not a substring match (QA SF-3)", () => {
  const accept = SOURCE_POLICY.pricing.accept;
  assert.equal(accept("https://www.kahua.com/pricing", "kahua.com"), true);
  assert.equal(accept("https://app.kahua.com/pricing-plans", "kahua.com"), true);
  assert.equal(accept("https://evil.example/pricing?ref=kahua.com", "kahua.com"), false);
  assert.equal(accept("https://notkahua.com/pricing", "kahua.com"), false);
  assert.equal(accept("not a url", "kahua.com"), false);
  assert.equal(accept("https://www.kahua.com/pricing", null), false);
});
