import test from "node:test";
import assert from "node:assert/strict";
import { parseNewsCandidates, NEWS_CATEGORIES } from "../src/services/competitiveNews";

test("parseNewsCandidates extracts category and priority per candidate", () => {
  const raw = JSON.stringify([
    { headline: "Kahua raises Series C", summary: "Funding round.", source_url: "https://x.com/a", category: "Acquisition", priority: "high" },
    { headline: "Kahua webinar next week", summary: "Product demo.", source_url: null, category: "Webinar & Event", priority: "normal" },
  ]);
  const candidates = parseNewsCandidates(raw);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].category, "Acquisition");
  assert.equal(candidates[0].priority, "high");
  assert.equal(candidates[1].category, "Webinar & Event");
  assert.equal(candidates[1].priority, "normal");
});

test("parseNewsCandidates defaults an unrecognized category to null and priority to normal", () => {
  const raw = JSON.stringify([
    { headline: "Something happened", summary: "Vague.", source_url: null, category: "Not A Real Category", priority: "extreme" },
  ]);
  const candidates = parseNewsCandidates(raw);
  assert.equal(candidates[0].category, null);
  assert.equal(candidates[0].priority, "normal");
});

test("NEWS_CATEGORIES matches the fixed taxonomy from the design spec", () => {
  assert.deepEqual(NEWS_CATEGORIES, [
    "News",
    "Press Release",
    "Acquisition",
    "AI Direction",
    "Bidding & RFP",
    "Webinar & Event",
  ]);
});
