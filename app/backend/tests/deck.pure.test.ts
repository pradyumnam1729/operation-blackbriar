import test from "node:test";
import assert from "node:assert/strict";
import {
  DeckDoc,
  deckToText,
  extractDeckJson,
  scaffoldDeck,
  slidesToHtml,
  validateDeckDoc,
} from "../src/services/deck";
import { cleanHtml } from "../src/services/html";
import { checkForbiddenWords } from "../src/services/guardrails";

const GOOD: DeckDoc = {
  schema: 1,
  theme: "aurigo-2026",
  slides: [
    { id: "s1", layout: "title", title: "Deck", subtitle: "Sub" },
    { id: "s2", layout: "content-bullets", title: "Points", body: ["one", "two"] },
    {
      id: "s3",
      layout: "two-column",
      title: "Compare",
      columns: [
        { heading: "Left", items: ["a"] },
        { heading: "Right", items: ["b"] },
      ],
    },
    { id: "s4", layout: "quote", title: "Proof", quote: { text: "Great", attribution: "Someone" }, notes: "say it slowly" },
    { id: "s5", layout: "closing", title: "Next step" },
  ],
};

test("validateDeckDoc accepts a well-formed deck", () => {
  const r = validateDeckDoc(GOOD);
  assert.ok("deck" in r, JSON.stringify(r));
});

test("validateDeckDoc rejects structural violations with named issues", () => {
  const bad = {
    schema: 1,
    theme: "aurigo-2026",
    slides: [
      { id: "s1", layout: "content-bullets", title: "" }, // no title, no body
      { id: "s1", layout: "nope", title: "x" }, // dup id + unknown layout
      { id: "s3", layout: "title", title: "t", columns: [] }, // columns on wrong layout
    ],
  };
  const r = validateDeckDoc(bad);
  assert.ok("issues" in r);
  const text = r.issues.join(" | ");
  assert.match(text, /title is required/);
  assert.match(text, /at least one body item/);
  assert.match(text, /duplicate id/);
  assert.match(text, /unknown layout/);
});

test("validateDeckDoc enforces slide count and length caps", () => {
  const over = {
    schema: 1,
    theme: "aurigo-2026",
    slides: [{ id: "s1", layout: "title", title: "x".repeat(300) }],
  };
  const r = validateDeckDoc(over);
  assert.ok("issues" in r);
  assert.match(r.issues.join(" "), /exceeds 200/);
  assert.ok("issues" in validateDeckDoc({ schema: 1, theme: "aurigo-2026", slides: [] }));
});

test("slidesToHtml is deterministic and sanitizer-stable", () => {
  const a = slidesToHtml(GOOD);
  const b = slidesToHtml(GOOD);
  assert.equal(a, b);
  assert.equal(cleanHtml(a), a); // only whitelisted tags survive round-trip
  assert.match(a, /<h2>Deck<\/h2>/);
  assert.match(a, /<blockquote>/);
});

test("deckToText includes speaker notes (guard scope)", () => {
  assert.match(deckToText(GOOD), /say it slowly/);
});

test("scaffoldDeck passes the forbidden-words guard", () => {
  const deck = scaffoldDeck("A Deck", "Masterworks");
  const v = validateDeckDoc(deck);
  assert.ok("deck" in v);
  assert.equal(checkForbiddenWords(deckToText(deck)).ok, true);
});

test("extractDeckJson strips fences and validates", () => {
  const fenced = "Here you go:\n```json\n" + JSON.stringify(GOOD) + "\n```";
  const r = extractDeckJson(fenced);
  assert.ok("deck" in r);
  assert.ok("issues" in extractDeckJson("no json here"));
});
