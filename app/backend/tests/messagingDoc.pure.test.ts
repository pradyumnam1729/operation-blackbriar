import test from "node:test";
import assert from "node:assert/strict";
import { assembleDoc, buildGapList } from "../src/services/messagingDoc";
import type { AnswerRow, QuestionRow } from "../src/services/questionnaire";

const q = (id: string): QuestionRow =>
  ({ id, section_id: id.split("-")[0], ord: 1, prompt: `Prompt ${id}`, guidance: null }) as QuestionRow;

const a = (question_id: string, status: string, extra: Partial<AnswerRow> = {}): AnswerRow =>
  ({ id: `ans-${question_id}`, question_id, status, final_answer: null, feedback: null, ...extra }) as AnswerRow;

test("buildGapList includes gaps, rejections, and accepted answers with conflict markers", () => {
  const questions = [q("A1-Q1"), q("A2-Q1"), q("A3-Q1"), q("A4-Q1")];
  const answers = [
    a("A1-Q1", "gap"),
    a("A2-Q1", "rejected", { feedback: "wrong product" }),
    a("A3-Q1", "accepted", { final_answer: "Fine answer. [Conflict: dates disagree]" }),
    a("A4-Q1", "accepted", { final_answer: "Clean accepted answer." }),
  ];
  const gaps = buildGapList(answers, questions);
  assert.deepEqual(
    gaps.map((g) => g.question_id),
    ["A1-Q1", "A2-Q1", "A3-Q1"]
  );
  assert.match(gaps[1].note, /wrong product/);
});

test("buildGapList ignores answers whose question is not in the bank", () => {
  assert.deepEqual(buildGapList([a("ZZ-Q9", "gap")], [q("A1-Q1")]), []);
});

test("assembleDoc emits frontmatter, title, and sections in order", () => {
  const { md, html } = assembleDoc(
    {
      productName: "Masterworks AI",
      title: "Masterworks AI — Positioning & Messaging",
      stage: "draft",
      sources: ["call-1.vtt", "prd.docx"],
      date: "2026-08-06",
    },
    [
      { id: "A1", title: "The Why", markdown: "Why body." },
      { id: "A2", title: "Market", markdown: "Market body." },
    ]
  );
  assert.ok(md.startsWith("---\nproduct: Masterworks AI\n"));
  assert.match(md, /stage: draft/);
  assert.match(md, /  - call-1\.vtt\n  - prd\.docx/);
  assert.ok(
    md.indexOf("# Masterworks AI — Positioning & Messaging") <
      md.indexOf("## A1 · The Why") &&
      md.indexOf("## A1 · The Why") < md.indexOf("## A2 · Market")
  );
  // Frontmatter must not bleed into the rendered HTML (in-app view / export).
  assert.ok(!html.includes("audience: internal-gtm"));
  assert.match(html, /The Why/);
});
