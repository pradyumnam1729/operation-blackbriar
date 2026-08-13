import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BLANK_STREAK,
  SheetMatrix,
  assembleFeatures,
  featureKey,
  normalizeName,
  resolveColumns,
  subProductKey,
} from "../src/services/featureImport";

const HEADER = [
  "Product Name",
  "Feature Name",
  "High-level capabilities",
  "1 line capbility summary", // deliberate typo, as in the real file
  "1 line value prop",
  "Primary Persona",
];

test("resolveColumns tolerates the header typo and maps every role", () => {
  const cols = resolveColumns(HEADER);
  assert.equal(cols.name, 1);
  assert.equal(cols.capabilities, 2);
  assert.equal(cols.summary, 3); // matched via "summary" despite "capbility"
  assert.equal(cols.value_prop, 4);
  assert.equal(cols.persona, 5);
});

test("resolveColumns tolerates reordered columns and returns -1 for absent roles", () => {
  const cols = resolveColumns(["Feature Name", "Primary Persona"]);
  assert.equal(cols.name, 0);
  assert.equal(cols.persona, 1);
  assert.equal(cols.value_prop, -1);
});

test("assembleFeatures groups continuation rows (empty Feature Name) under the open feature", () => {
  const sheet: SheetMatrix = [
    HEADER,
    ["E&B", "Bid Estimate Creation", "• Create bid estimate records", "Create estimates", "Fair costing", "Estimating Engineer"],
    ["E&B", null, "• Establish cost baselines"],
    ["E&B", "", "• Maintain estimate versions"],
    ["E&B", "Bid Analysis", "• Compare bids", "Analyze bids", "Value clarity", "Project Manager"],
  ];
  const features = assembleFeatures(sheet);
  assert.equal(features.length, 2);
  assert.equal(features[0].name, "Bid Estimate Creation");
  assert.equal(
    features[0].capabilities,
    "Create bid estimate records\nEstablish cost baselines\nMaintain estimate versions"
  );
  assert.equal(features[0].description, "Create estimates");
  assert.equal(features[0].value_prop, "Fair costing");
  assert.equal(features[0].persona, "Estimating Engineer");
  assert.equal(features[1].name, "Bid Analysis");
  assert.equal(features[1].capabilities, "Compare bids");
});

test("assembleFeatures strips bullet markers and \\r\\n, keeps typos in copy", () => {
  const sheet: SheetMatrix = [
    HEADER,
    ["CP", "Needs Management", "Define high level details\r\n• Capture needs", "Capture and prioritize capbility", "Ensures needs", "Planner"],
  ];
  const f = assembleFeatures(sheet)[0];
  assert.equal(f.capabilities, "Define high level details\nCapture needs");
  assert.equal(f.description, "Capture and prioritize capbility"); // typo preserved — PMM's job
});

test("assembleFeatures halts on a phantom range instead of scanning 100k+ blank rows", () => {
  const sheet: SheetMatrix = [HEADER, ["X", "Only Feature", "• a", "s", "v", "p"]];
  for (let i = 0; i < MAX_BLANK_STREAK + 10_000; i++) sheet.push([null, null, null, null, null, null]);
  const features = assembleFeatures(sheet);
  assert.equal(features.length, 1);
  assert.equal(features[0].name, "Only Feature");
});

test("assembleFeatures returns [] for a sheet without a Feature Name column or with no data", () => {
  assert.deepEqual(assembleFeatures([["Product Name", "Notes"], ["ROW"]]), []);
  assert.deepEqual(assembleFeatures([HEADER]), []); // header only
  assert.deepEqual(assembleFeatures([]), []);
});

test("idempotency keys are case/whitespace-stable", () => {
  assert.equal(normalizeName("  Fund   Management "), "fund management");
  assert.equal(subProductKey("p1", "Capital Planning"), subProductKey("p1", "capital planning"));
  assert.equal(featureKey("sp1", "Fund Management"), featureKey("sp1", "  fund   management  "));
  assert.notEqual(featureKey("sp1", "Fund Management"), featureKey("sp2", "Fund Management"));
});
