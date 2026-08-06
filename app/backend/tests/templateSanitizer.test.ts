import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeTemplateBody } from "../src/services/templateRender";

// Regression payloads from the QA sanitizer-bypass review. Wall 2 of the
// three-wall design: admin-authored bodies open un-sandboxed from disk exports.

test("strips slash-separated event handlers (<svg/onload=...>)", () => {
  const out = sanitizeTemplateBody("svg", '<svg/onload=alert(1)><rect width="10"/></svg>');
  assert.ok(!/onload/i.test(out));
});

test("strip-remnant reassembly cannot reconstruct <script>", () => {
  const out = sanitizeTemplateBody("html", "<scr<script>ipt>alert(1)</scr</script>ipt>");
  assert.ok(!/<script/i.test(out));
});

test("entity-encoded javascript: URLs are neutralized", () => {
  for (const payload of [
    '<a href="javascript&colon;alert(1)">x</a>',
    '<a href="javascript&#58;alert(1)">x</a>',
    '<a href="javascript&#x3a;alert(1)">x</a>',
    '<a href="javascript  :alert(1)">x</a>',
  ]) {
    const out = sanitizeTemplateBody("html", payload);
    assert.ok(!/javascript\s*:/i.test(out), `survived: ${payload}`);
  }
});

test("iframe, object, embed, and data:text/html are stripped", () => {
  const out = sanitizeTemplateBody(
    "html",
    '<iframe src="https://x"></iframe><object data="x"></object><embed src="x"><a href="data:text/html,<script>1</script>">x</a>'
  );
  assert.ok(!/<iframe|<object|<embed|data:\s*text\/html/i.test(out));
});

test("legitimate template markup survives sanitization", () => {
  const body = '<div class="hero" style="color:#015F74">{{headline}}</div><svg viewBox="0 0 10 10"><text x="1" y="1">{{line_1}}</text></svg>';
  assert.equal(sanitizeTemplateBody("html", body), body);
});
