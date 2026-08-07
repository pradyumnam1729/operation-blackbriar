import test from "node:test";
import assert from "node:assert/strict";
import { buildRouterSuffix, decideRoute } from "../src/services/askRouter";
import type { RouterCandidate } from "../src/services/agents";
import { SAMPLE_ROUTER_CANDIDATES } from "../src/services/agents";

// Pure pieces of the ask router (ask-to-artifact blueprint §4.2): the
// parse/threshold/validation-ladder decision and the locked suffix builder.
// classifyAsk's I/O shell (config, model call, product lookup) is exercised in
// stage-3 QA; everything decidable without a DB or model lives here.

const candidates: RouterCandidate[] = [
  { id: "tpl-bc", name: "Battlecard A", asset_type: "battlecard", product_line: "Masterworks",
    audience: null, persona: null, funnel_stage: null },
  { id: "tpl-op-1", name: "One-Pager A", asset_type: "one-pager", product_line: "Masterworks",
    audience: "public-sector agencies", persona: null, funnel_stage: "decision" },
  { id: "tpl-op-2", name: "One-Pager B", asset_type: "one-pager", product_line: "Primus",
    audience: null, persona: null, funnel_stage: null },
];

const artifact = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    intent: "artifact",
    confidence: 0.9,
    asset_type: "one-pager",
    template_id: "tpl-op-1",
    product_name: "Masterworks AI",
    brief: "A leave-behind for a DOT prospect about risk prediction.",
    reason: "Explicit deliverable request.",
    ...over,
  });

// ---------- validation ladder (§4.2-6) ----------

test("ladder a: valid template_id routes to that candidate, no fallback", () => {
  const d = decideRoute(artifact(), candidates, 0.6);
  assert.equal(d.intent, "artifact");
  if (d.intent !== "artifact") return;
  assert.equal(d.template.id, "tpl-op-1");
  assert.equal(d.template_fallback_used, false);
  assert.equal(d.confidence, 0.9);
  assert.equal(d.product_name, "Masterworks AI");
});

test("ladder a: the chosen candidate's OWN asset_type wins over the model's", () => {
  const d = decideRoute(artifact({ asset_type: "datasheet", template_id: "tpl-bc" }), candidates, 0.6);
  assert.equal(d.intent, "artifact");
  if (d.intent !== "artifact") return;
  assert.equal(d.template.id, "tpl-bc");
  assert.equal(d.template.asset_type, "battlecard"); // not "datasheet"
  assert.equal(d.template_fallback_used, false);
});

test("ladder b: invented template_id falls back to the asset type's first candidate in deterministic order", () => {
  const d = decideRoute(artifact({ template_id: "invented-id" }), candidates, 0.6);
  assert.equal(d.intent, "artifact");
  if (d.intent !== "artifact") return;
  assert.equal(d.template.id, "tpl-op-1"); // first one-pager in load order
  assert.equal(d.template_fallback_used, true);
});

test("ladder b: absent template_id also falls back by asset_type", () => {
  const d = decideRoute(artifact({ template_id: undefined }), candidates, 0.6);
  assert.equal(d.intent, "artifact");
  if (d.intent !== "artifact") return;
  assert.equal(d.template.id, "tpl-op-1");
  assert.equal(d.template_fallback_used, true);
});

test("ladder c: no id match and no type match degrades to question", () => {
  const d = decideRoute(artifact({ template_id: "nope", asset_type: "webinar-deck" }), candidates, 0.6);
  assert.equal(d.intent, "question");
});

// ---------- degradation-to-question decisions (§0.1-4 / §4.2) ----------

test("degrade: unparseable output is a question, never a throw", () => {
  assert.equal(decideRoute("Sure! I'd route this to a one-pager.", candidates, 0.6).intent, "question");
  assert.equal(decideRoute("", candidates, 0.6).intent, "question");
});

test("degrade: question intent and unknown intent are questions", () => {
  assert.equal(
    decideRoute(JSON.stringify({ intent: "question", confidence: 0.95, reason: "info ask" }), candidates, 0.6).intent,
    "question"
  );
  assert.equal(decideRoute(JSON.stringify({ intent: "banana", confidence: 0.95 }), candidates, 0.6).intent, "question");
});

test("degrade: missing/non-numeric/low confidence are questions; at-threshold routes", () => {
  assert.equal(decideRoute(artifact({ confidence: undefined }), candidates, 0.6).intent, "question");
  assert.equal(decideRoute(artifact({ confidence: "high" }), candidates, 0.6).intent, "question");
  assert.equal(decideRoute(artifact({ confidence: 0.59 }), candidates, 0.6).intent, "question");
  assert.equal(decideRoute(artifact({ confidence: 0.6 }), candidates, 0.6).intent, "artifact");
});

test("degrade: fenced JSON still parses (parseModelJson reuse)", () => {
  const d = decideRoute("```json\n" + artifact() + "\n```", candidates, 0.6);
  assert.equal(d.intent, "artifact");
});

test("assembly: brief capped at 500 chars, reason at 200, empty brief allowed, blank product_name → null", () => {
  const d = decideRoute(
    artifact({ brief: "x".repeat(900), reason: "y".repeat(900), product_name: "  " }),
    candidates,
    0.6
  );
  assert.equal(d.intent, "artifact");
  if (d.intent !== "artifact") return;
  assert.equal(d.brief.length, 500);
  assert.equal(d.reason.length, 200);
  assert.equal(d.product_name, null);

  const empty = decideRoute(artifact({ brief: undefined, reason: undefined }), candidates, 0.6);
  assert.equal(empty.intent, "artifact");
  if (empty.intent !== "artifact") return;
  assert.equal(empty.brief, "");
  assert.equal(empty.reason, "");
});

// ---------- locked suffix (§1.2) ----------

test("buildRouterSuffix carries the catalog JSON, the request, and the JSON contract", () => {
  const suffix = buildRouterSuffix(SAMPLE_ROUTER_CANDIDATES, "I need a leave-behind", "sales");
  assert.ok(suffix.startsWith("Template catalog - generation-ready, approved templates."));
  assert.ok(suffix.includes(JSON.stringify(SAMPLE_ROUTER_CANDIDATES)));
  assert.ok(suffix.includes("Request from the sales team:\nI need a leave-behind"));
  assert.ok(suffix.includes('{"intent": "question" | "artifact", "confidence": 0.0-1.0'));
  assert.ok(suffix.endsWith('When intent is "question", include only intent, confidence, and reason.'));
});
