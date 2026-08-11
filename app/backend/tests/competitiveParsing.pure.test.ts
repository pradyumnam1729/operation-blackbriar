import test from "node:test";
import assert from "node:assert/strict";
import {
  AxesMismatchError,
  MapLike,
  computeMovement,
  parseSwot,
  parseThreatTiers,
} from "../src/services/competitiveParsing";

// ---------- threat tiers ----------

test("parseThreatTiers accepts a valid board and drops malformed entries", () => {
  const raw = JSON.stringify({
    entries: [
      { competitor: "Kahua", tier: 1, rationale: "AI overlap", trajectory: "rising", watch_items: ["Noa pricing", "DOT wins"] },
      { competitor: "", tier: 2, rationale: "x", trajectory: "stable" }, // empty name → dropped
      { competitor: "Procore", tier: 5, rationale: "x", trajectory: "stable" }, // bad tier → dropped
      { competitor: "e-Builder", tier: 2, rationale: "x", trajectory: "sideways" }, // bad trajectory → dropped
    ],
    skipped: [{ name: "Cityworks", reason: "integrate, don't compete" }],
    summary: "One rising threat.",
  });
  const parsed = parseThreatTiers(raw);
  assert.ok(parsed);
  assert.equal(parsed!.entries.length, 1);
  assert.equal(parsed!.entries[0].competitor, "Kahua");
  assert.equal(parsed!.skipped[0].name, "Cityworks");
});

test("parseThreatTiers returns null for prose, empty boards, and non-arrays", () => {
  assert.equal(parseThreatTiers("Here is my analysis..."), null);
  assert.equal(parseThreatTiers(JSON.stringify({ entries: [] })), null);
  assert.equal(parseThreatTiers(JSON.stringify({ entries: "Kahua" })), null);
});

// ---------- SWOT: the uncited-drop + fabricated-citation rules ----------

const ALLOWED = new Set(["https://kahua.com/product", "https://g2.com/products/kahua"]);

test("parseSwot keeps only S/W items citing a URL that actually fed the prompt", () => {
  const raw = JSON.stringify({
    strengths: [
      { text: "Configurable apps platform", evidence_url: "https://kahua.com/product" },
      { text: "Uncited claim" }, // no citation → dropped
      { text: "Fabricated citation", evidence_url: "https://kahua.com/made-up-page" }, // not in evidence → dropped
    ],
    weaknesses: [{ text: "No maintenance module named", evidence_url: "https://g2.com/products/kahua" }],
    opportunities: [{ text: "Lead with life cycle continuity" }],
    threats: [{ text: "AI narrative overlap" }],
    summary: "ok",
  });
  const parsed = parseSwot(raw, ALLOWED);
  assert.ok(parsed);
  assert.equal(parsed!.strengths.length, 1);
  assert.equal(parsed!.strengths[0].evidence_url, "https://kahua.com/product");
  assert.equal(parsed!.weaknesses.length, 1);
  assert.equal(parsed!.opportunities[0].evidence_url, null); // O/T never carry citations
});

test("parseSwot tolerates trailing slashes on citations and rejects empty results", () => {
  const withSlash = JSON.stringify({
    strengths: [{ text: "x", evidence_url: "https://kahua.com/product/" }],
    weaknesses: [],
    opportunities: [],
    threats: [],
  });
  const parsed = parseSwot(withSlash, ALLOWED);
  assert.ok(parsed);
  assert.equal(parsed!.strengths[0].evidence_url, "https://kahua.com/product");

  const allDropped = JSON.stringify({
    strengths: [{ text: "x", evidence_url: "https://elsewhere.com" }],
    weaknesses: [],
    opportunities: [],
    threats: [],
  });
  assert.equal(parseSwot(allDropped, ALLOWED), null); // nothing survived → not a usable SWOT
  assert.equal(parseSwot("not json", ALLOWED), null);
});

// ---------- map movement ----------

const mapAt = (id: string, points: MapLike["points"], lowHighFlipped = false): MapLike => ({
  id,
  createdAt: "2026-08-01T00:00:00Z",
  xAxis: { label: "Buyer focus", low: lowHighFlipped ? "Public" : "General", high: lowHighFlipped ? "General" : "Public" },
  yAxis: { label: "AI depth", low: "Bolt-on", high: "AI-native" },
  points,
});

test("computeMovement reports drift, entrants, and exits", () => {
  const from = mapAt("m1", [
    { name: "Masterworks", type: "aurigo", x: 80, y: 85 },
    { name: "Kahua", type: "competitor", x: 60, y: 50 },
    { name: "Planview", type: "competitor", x: 20, y: 30 },
  ]);
  const to = mapAt("m2", [
    { name: "Masterworks", type: "aurigo", x: 82, y: 86 },
    { name: "Kahua", type: "competitor", x: 65, y: 62 },
    { name: "Procore", type: "competitor", x: 40, y: 45 },
  ]);
  const mv = computeMovement(from, to);
  assert.equal(mv.moves[0].name, "Kahua"); // largest drift first
  assert.equal(mv.moves[0].dx, 5);
  assert.equal(mv.moves[0].dy, 12);
  assert.deepEqual(mv.entered, ["Procore"]);
  assert.deepEqual(mv.exited, ["Planview"]);
});

test("computeMovement refuses different axes — including swapped low/high ends", () => {
  const a = mapAt("m1", []);
  const differentLabel: MapLike = { ...a, id: "m2", xAxis: { label: "Scope", low: "Point", high: "Suite" } };
  assert.throws(() => computeMovement(a, differentLabel), AxesMismatchError);
  const flippedEnds = mapAt("m3", [], true); // same label, swapped low/high → sign-flipped drift
  assert.throws(() => computeMovement(a, flippedEnds), AxesMismatchError);
});
