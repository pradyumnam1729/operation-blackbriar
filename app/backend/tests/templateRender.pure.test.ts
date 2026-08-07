import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  type TemplateFormat,
  type TemplateSlot,
  buildDigestHtml,
  escapeForFormat,
  placeholderFills,
  renderTemplate,
  sanitizeTemplateBody,
  validateFills,
  validateTemplateDefinition,
} from "../src/services/templateRender";
import { cleanHtml, htmlToText } from "../src/services/html";
import { checkForbiddenWords } from "../src/services/guardrails";

const slot = (over: Partial<TemplateSlot> = {}): TemplateSlot => ({
  id: "headline",
  label: "Headline",
  purpose: "Test slot",
  max_chars: 60,
  required: true,
  render: "text",
  source_sections: ["B1"],
  ...over,
});

// fq_sections registry ids seeded in 0009 — the wiring vocabulary.
const KNOWN_SECTIONS = [
  "A1", "A2", "A3", "A4", "A5",
  "B1", "B2", "B3", "B4", "B5", "B6", "B7",
  "C1", "C2", "C3", "C4",
  "D1", "D2", "D3", "D4",
  "E1", "E2", "E3",
  "F1", "F2", "F3", "F4", "F5",
];

// ---------- seed templates (parsed straight out of migration 0011) ----------

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "..", "supabase", "migrations", "0011_template_library.sql"),
  "utf-8"
);
const seedBodies = [...MIGRATION.matchAll(/\$tpl\$([\s\S]*?)\$tpl\$/g)].map((m) => m[1]);
const seedSlots = [...MIGRATION.matchAll(/\$slots\$([\s\S]*?)\$slots\$/g)].map(
  (m) => JSON.parse(m[1]) as TemplateSlot[]
);
const SEED_FORMATS: TemplateFormat[] = ["html", "svg", "deck"];

// ---------- second seed wave (parsed straight out of migration 0015) ----------

const MIGRATION_0015 = fs.readFileSync(
  path.resolve(
    __dirname, "..", "..", "..", "supabase", "migrations", "0015_template_library_seeds_2.sql"
  ),
  "utf-8"
);
const seedBodies15 = [...MIGRATION_0015.matchAll(/\$tpl\$([\s\S]*?)\$tpl\$/g)].map((m) => m[1]);
const seedSlots15 = [...MIGRATION_0015.matchAll(/\$slots\$([\s\S]*?)\$slots\$/g)].map(
  (m) => JSON.parse(m[1]) as TemplateSlot[]
);
// faq (markdown), one-pager (html), brochure (html), battlecard (markdown)
const SEED_FORMATS_0015: TemplateFormat[] = ["markdown", "html", "html", "markdown"];

function fullFills(slots: TemplateSlot[]): Record<string, string> {
  const fills: Record<string, string> = {};
  for (const s of slots) {
    fills[s.id] =
      s.render === "lines"
        ? Array.from({ length: s.max_lines ?? 1 }, (_, i) => `Item ${i + 1}`).join("\n")
        : "Sample fill".slice(0, s.max_chars);
  }
  return fills;
}

test("migration 0011 carries three seed templates (body + slots pairs)", () => {
  assert.equal(seedBodies.length, 3);
  assert.equal(seedSlots.length, 3);
});

test("every seed template passes validateTemplateDefinition against the 0009 registry", () => {
  SEED_FORMATS.forEach((format, i) => {
    const issues = validateTemplateDefinition(format, seedBodies[i], seedSlots[i], KNOWN_SECTIONS);
    assert.deepEqual(issues, [], `seed ${i + 1} (${format}): ${issues.join(" | ")}`);
  });
});

test("renderTemplate leaves zero {{ in output for all three seeds with full fills", () => {
  SEED_FORMATS.forEach((format, i) => {
    const { payload, warnings } = renderTemplate(format, seedBodies[i], seedSlots[i], fullFills(seedSlots[i]));
    assert.ok(!payload.includes("{{"), `seed ${i + 1} (${format}) still has a placeholder`);
    assert.deepEqual(warnings, []);
  });
});

test("deck seed assembles six slides inside one HTML shell", () => {
  const i = SEED_FORMATS.indexOf("deck");
  const { payload } = renderTemplate("deck", seedBodies[i], seedSlots[i], fullFills(seedSlots[i]));
  assert.equal(payload.match(/<section class='slide/g)?.length, 6);
  assert.ok(payload.startsWith("<!doctype html>"));
  assert.ok(payload.includes("<style>"));
});

test("migration 0015 carries four seed templates (body + slots pairs)", () => {
  assert.equal(seedBodies15.length, 4);
  assert.equal(seedSlots15.length, 4);
});

test("every 0015 seed passes validateTemplateDefinition against the 0009 registry", () => {
  SEED_FORMATS_0015.forEach((format, i) => {
    const issues = validateTemplateDefinition(format, seedBodies15[i], seedSlots15[i], KNOWN_SECTIONS);
    assert.deepEqual(issues, [], `0015 seed ${i + 1} (${format}): ${issues.join(" | ")}`);
  });
});

test("renderTemplate leaves zero {{ in output for all four 0015 seeds with full fills", () => {
  SEED_FORMATS_0015.forEach((format, i) => {
    const { payload, warnings } = renderTemplate(
      format, seedBodies15[i], seedSlots15[i], fullFills(seedSlots15[i])
    );
    assert.ok(!payload.includes("{{"), `0015 seed ${i + 1} (${format}) still has a placeholder`);
    assert.deepEqual(warnings, []);
  });
});

test("0015 seed bodies and slot text carry zero forbidden words (static copy is guard-clean)", () => {
  SEED_FORMATS_0015.forEach((format, i) => {
    const slotText = seedSlots15[i].map((s) => `${s.label} ${s.purpose}`).join("\n");
    const guard = checkForbiddenWords(`${seedBodies15[i]}\n${slotText}`);
    assert.deepEqual(
      guard.violations, [],
      `0015 seed ${i + 1} (${format}) static copy violates the voice guard`
    );
  });
});

// ---------- validateFills ----------

test("validateFills flags over-limit fills with chars and max", () => {
  const s = slot({ max_chars: 10 });
  const { ok, over, missing } = validateFills([s], { headline: "x".repeat(15) });
  assert.deepEqual(over, [{ slot_id: "headline", chars: 15, max: 10 }]);
  assert.ok(!("headline" in ok));
  assert.deepEqual(missing, []);
});

test("validateFills reports required-but-empty slots as missing (fill kept as empty)", () => {
  const s = slot();
  const { ok, over, missing } = validateFills([s], {});
  assert.deepEqual(missing, ["headline"]);
  assert.equal(ok.headline, "");
  assert.deepEqual(over, []);
});

test("validateFills enforces max_lines for render:'lines'", () => {
  const s = slot({ id: "caps", render: "lines", max_chars: 500, max_lines: 2 });
  const { over } = validateFills([s], { caps: "one\ntwo\nthree" });
  assert.deepEqual(over, [{ slot_id: "caps", chars: 3, max: 2 }]);
  const { over: within } = validateFills([s], { caps: "one\ntwo" });
  assert.deepEqual(within, []);
});

test("validateFills accepts in-limit fills and drops unknown keys", () => {
  const s = slot({ max_chars: 20 });
  const { ok } = validateFills([s], { headline: "Fits fine", ghost: "dropped" });
  assert.equal(ok.headline, "Fits fine");
  assert.ok(!("ghost" in ok));
});

// ---------- escapeForFormat ----------

test("escapeForFormat html-escapes entities so model text can never open a tag", () => {
  const out = escapeForFormat("html", slot(), `<b>&"'x`);
  assert.equal(out, "&lt;b&gt;&amp;&quot;&#39;x");
});

test("escapeForFormat svg: XML-escapes and collapses newlines (svg text cannot wrap)", () => {
  const out = escapeForFormat("svg", slot(), "A & B\nsecond <line>");
  assert.equal(out, "A &amp; B second &lt;line&gt;");
});

test("escapeForFormat markdown escapes pipes and leading #", () => {
  const out = escapeForFormat("markdown", slot(), "# Head | cell\nplain # inline");
  assert.equal(out, "\\# Head \\| cell\nplain # inline");
});

test("escapeForFormat multiline joins paragraphs with <br>", () => {
  const s = slot({ render: "multiline" });
  const out = escapeForFormat("html", s, "Para one\nsame para\n\nPara two");
  assert.equal(out, "Para one<br>same para<br><br>Para two");
});

test("escapeForFormat lines wraps each non-empty line in <li>", () => {
  const s = slot({ render: "lines", max_lines: 3 });
  const out = escapeForFormat("html", s, "First\n\nSecond & third");
  assert.equal(out, "<li>First</li><li>Second &amp; third</li>");
});

// ---------- renderTemplate ----------

test("renderTemplate shows the ⚠ placeholder + missing warning for required-empty slots", () => {
  const s = slot();
  const { payload, warnings } = renderTemplate("html", "<h1>{{headline}}</h1>", [s], {});
  assert.ok(payload.includes("⚠ [Headline] — needs PMM input"));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].slot_id, "headline");
  assert.equal(warnings[0].kind, "missing");
});

test("renderTemplate leaves optional-empty slots blank with no warning", () => {
  const s = slot({ required: false });
  const { payload, warnings } = renderTemplate("html", "<h1>{{headline}}</h1>", [s], {});
  assert.equal(payload, "<h1></h1>");
  assert.deepEqual(warnings, []);
});

// ---------- sanitizeTemplateBody ----------

test("sanitizeTemplateBody strips <script>, on* attributes, javascript: URLs, <foreignObject>", () => {
  const dirty = [
    "<div onload=\"evil()\" class='x'>ok</div>",
    "<script>alert(1)</script>",
    '<a href="javascript:alert(1)">x</a>',
    "<foreignObject><body>bad</body></foreignObject>",
  ].join("\n");
  const clean = sanitizeTemplateBody("html", dirty);
  assert.ok(!/onload/i.test(clean));
  assert.ok(!/<script/i.test(clean));
  assert.ok(!/javascript:/i.test(clean));
  assert.ok(!/foreignObject/i.test(clean));
  assert.ok(clean.includes(">ok</div>"));
});

test("sanitizeTemplateBody cleans deck slide fragments and master css", () => {
  const deck = JSON.stringify({
    master: { css: "body{background:url('javascript:x')}" },
    slides: [{ role: "title", html: "<section onclick=\"evil()\">{{a}}<script>bad()</script></section>" }],
  });
  const clean = sanitizeTemplateBody("deck", deck);
  const parsed = JSON.parse(clean) as { master: { css: string }; slides: { html: string }[] };
  assert.ok(!/javascript:/i.test(parsed.master.css));
  assert.ok(!/onclick/i.test(parsed.slides[0].html));
  assert.ok(!/<script/i.test(parsed.slides[0].html));
  assert.ok(parsed.slides[0].html.includes("{{a}}"));
});

// ---------- validateTemplateDefinition ----------

test("validateTemplateDefinition catches ghost placeholders and unplaced slots", () => {
  const s = slot();
  const issues = validateTemplateDefinition("html", "<h1>{{ghost}}</h1>", [s], KNOWN_SECTIONS);
  assert.ok(issues.some((i) => i.includes('{{ghost}}')));
  assert.ok(issues.some((i) => i.includes('"headline" has no {{headline}}')));
});

test("validateTemplateDefinition rejects unknown source sections and bad slot ids", () => {
  const bad = [
    slot({ id: "Bad-Id" }),
    slot({ id: "wired", source_sections: ["Z9"] }),
  ];
  const issues = validateTemplateDefinition(
    "html",
    "<p>{{wired}}</p>",
    bad,
    KNOWN_SECTIONS
  );
  assert.ok(issues.some((i) => i.includes('Slot id "Bad-Id" is invalid')));
  assert.ok(issues.some((i) => i.includes('unknown section "Z9"')));
});

test("validateTemplateDefinition rejects a deck body that is not valid slide JSON", () => {
  const issues = validateTemplateDefinition("deck", "not json", [slot()], KNOWN_SECTIONS);
  assert.ok(issues.some((i) => i.includes("Deck body must be valid JSON")));
});

test("validateTemplateDefinition passes a well-formed definition", () => {
  const issues = validateTemplateDefinition("html", "<h1>{{headline}}</h1>", [slot()], KNOWN_SECTIONS);
  assert.deepEqual(issues, []);
});

// ---------- placeholderFills ----------

test("placeholderFills produces «label — max N chars» (lines: max_lines rows)", () => {
  const fills = placeholderFills([
    slot(),
    slot({ id: "caps", label: "Capabilities", render: "lines", max_chars: 540, max_lines: 4 }),
  ]);
  assert.equal(fills.headline, "«Headline — max 60 chars»");
  assert.equal(fills.caps.split("\n").length, 4);
  assert.ok(fills.caps.startsWith("«Capabilities — max 540 chars»"));
});

// ---------- buildDigestHtml ----------

test("buildDigestHtml survives cleanHtml with every fill word intact", () => {
  const slots = seedSlots[0];
  const fills = fullFills(slots);
  const digest = buildDigestHtml(
    "Masterworks AI Datasheet",
    { templateName: "Aurigo Datasheet — Overview (US Letter)", templateVersion: 3, productName: "Masterworks AI", docVersion: 2 },
    slots,
    fills,
    [{ slot_id: "proof", kind: "empty_section", detail: "Wired section(s) A4 are missing or empty in the messaging doc." }]
  );
  const cleaned = cleanHtml(digest);
  const text = htmlToText(cleaned);
  for (const value of Object.values(fills)) {
    for (const line of value.split("\n")) {
      assert.ok(text.includes(line), `digest lost "${line}" after cleanHtml`);
    }
  }
  assert.ok(text.includes("Masterworks AI Messaging Doc v2"));
  assert.ok(text.includes("empty in the messaging doc"));
});
