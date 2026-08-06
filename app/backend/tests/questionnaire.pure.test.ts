import test from "node:test";
import assert from "node:assert/strict";
import {
  batchDocs,
  parseModelJson,
  reduceCandidates,
  type Candidate,
  type SourceDoc,
} from "../src/services/questionnaire";

const doc = (id: string, chars: number): SourceDoc => ({
  id,
  title: `doc-${id}`,
  content: "x".repeat(chars),
});

test("batchDocs truncates individual docs to 30k chars", () => {
  const [batch] = batchDocs([doc("a", 50_000)]);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].content.length, 30_000);
});

test("batchDocs packs greedily up to the 80k boundary", () => {
  // 3 × 30k: first two fit (60k), the third would cross 80k → new batch.
  const batches = batchDocs([doc("a", 30_000), doc("b", 30_000), doc("c", 30_000)]);
  assert.equal(batches.length, 2);
  assert.deepEqual(
    batches.map((b) => b.map((d) => d.id)),
    [["a", "b"], ["c"]]
  );
});

test("batchDocs never splits a single oversized doc across batches", () => {
  const batches = batchDocs([doc("a", 30_000)], 10_000);
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].content.length, 30_000);
});

test("batchDocs on empty input returns no batches", () => {
  assert.deepEqual(batchDocs([]), []);
});

test("parseModelJson handles plain, fenced, and prose-wrapped JSON", () => {
  const obj = { answers: [{ question_id: "A1-Q1" }] };
  const json = JSON.stringify(obj);
  assert.deepEqual(parseModelJson(json), obj);
  assert.deepEqual(parseModelJson("```json\n" + json + "\n```"), obj);
  assert.deepEqual(parseModelJson("Here you go:\n" + json + "\nHope that helps!"), obj);
});

test("parseModelJson survives nested braces", () => {
  const obj = { a: { b: { c: "}{" } } };
  assert.deepEqual(parseModelJson(JSON.stringify(obj)), obj);
});

test("parseModelJson throws on garbage", () => {
  assert.throws(() => parseModelJson("no json here"));
  assert.throws(() => parseModelJson("{truncated"));
});

const cand = (confidence: number): Candidate => ({ content: "c", confidence, sources: [] });

test("reduceCandidates keeps the higher-confidence candidate", () => {
  assert.equal(reduceCandidates(cand(0.4), cand(0.9))?.confidence, 0.9);
  assert.equal(reduceCandidates(cand(0.9), cand(0.4))?.confidence, 0.9);
});

test("reduceCandidates handles nulls and ties (first wins on tie)", () => {
  const a = cand(0.5);
  assert.equal(reduceCandidates(null, a), a);
  assert.equal(reduceCandidates(a, null), a);
  assert.equal(reduceCandidates(null, null), null);
  const b = cand(0.5);
  assert.equal(reduceCandidates(a, b), a);
});
