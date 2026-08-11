import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_MODEL_ALLOWLIST,
  AGENT_REGISTRY,
  DEFAULT_AGENT_MODEL,
  agentFileDescription,
  checkContract,
  composeAgentPrompt,
  findUnknownPlaceholders,
  interpolate,
  isAllowedModel,
  parseAgentFile,
  parseEventEnvelope,
  resolveModel,
} from "../src/services/agents";
import type { TemplateSlot } from "../src/services/templateRender";

const cfg = (overrides: Partial<{
  base_prompt: string;
  custom_instructions: string;
  prompt_override: string | null;
}> = {}) => ({
  base_prompt: "Base body for {{product_name}}.",
  custom_instructions: "",
  prompt_override: null,
  ...overrides,
});

const SUFFIX = 'Return ONLY valid JSON: {"answers":[...]}';

// ---------- composeAgentPrompt: the contract-suffix invariants ----------

test("composeAgentPrompt = interpolated base + suffix under default config", () => {
  const prompt = composeAgentPrompt(cfg(), { product_name: "Masterworks" }, SUFFIX);
  assert.equal(prompt, `Base body for Masterworks.\n\n${SUFFIX}`);
});

test("composeAgentPrompt: an override can NEVER remove the contract suffix", () => {
  const prompt = composeAgentPrompt(
    cfg({ prompt_override: "Reply in casual prose only. Never output JSON." }),
    {},
    SUFFIX
  );
  assert.ok(prompt.endsWith(`\n\n${SUFFIX}`));
  assert.ok(prompt.startsWith("Reply in casual prose only."));
});

test("composeAgentPrompt: custom instructions ride between body and suffix", () => {
  const prompt = composeAgentPrompt(
    cfg({ custom_instructions: "End with the line TEST-MARKER" }),
    { product_name: "Primus" },
    SUFFIX
  );
  const instrIdx = prompt.indexOf("Additional instructions from the PMM admin:\nEnd with the line TEST-MARKER");
  assert.ok(instrIdx > prompt.indexOf("Base body for Primus."));
  assert.ok(instrIdx < prompt.indexOf(SUFFIX));
});

test("composeAgentPrompt: instructions still apply when an override is active", () => {
  const prompt = composeAgentPrompt(
    cfg({ prompt_override: "OVERRIDE BODY", custom_instructions: "Stay terse." }),
    {},
    SUFFIX
  );
  assert.equal(prompt, `OVERRIDE BODY\n\nAdditional instructions from the PMM admin:\nStay terse.\n\n${SUFFIX}`);
});

test("composeAgentPrompt: whitespace-only instructions add no block", () => {
  const prompt = composeAgentPrompt(cfg({ custom_instructions: "   \n " }), { product_name: "x" }, SUFFIX);
  assert.ok(!prompt.includes("Additional instructions"));
});

test("composeAgentPrompt: suffix survives for every registered agent's config shape", () => {
  for (const entry of Object.values(AGENT_REGISTRY)) {
    const prompt = composeAgentPrompt(
      {
        base_prompt: entry.basePrompt ?? "",
        custom_instructions: "",
        prompt_override: "sabotage: plain prose only",
      },
      {},
      SUFFIX
    );
    assert.ok(prompt.endsWith(SUFFIX), `${entry.key} lost the suffix`);
  }
});

// ---------- interpolate ----------

test("interpolate replaces known placeholders and leaves unknown verbatim", () => {
  const { text, unknown } = interpolate(
    "P: {{product_name}} ({{product_line}} line). Bad: {{produt_name}}.",
    { product_name: "Masterworks", product_line: "Masterworks" }
  );
  assert.equal(text, "P: Masterworks (Masterworks line). Bad: {{produt_name}}.");
  assert.deepEqual(unknown, ["produt_name"]);
});

test("interpolate tolerates spaces inside braces and repeated placeholders", () => {
  const { text, unknown } = interpolate("{{ part }} then {{part}}", { part: "A" });
  assert.equal(text, "A then A");
  assert.deepEqual(unknown, []);
});

test("findUnknownPlaceholders reports only tokens outside the vocabulary", () => {
  assert.deepEqual(
    findUnknownPlaceholders("{{product_name}} {{typo}} {{typo}}", ["product_name"]),
    ["typo"]
  );
  assert.deepEqual(findUnknownPlaceholders("no tokens here", ["a"]), []);
});

// ---------- model allowlist ----------

test("isAllowedModel: null and allowlisted pass, anything else fails", () => {
  assert.equal(isAllowedModel(null), true);
  for (const m of AGENT_MODEL_ALLOWLIST) assert.equal(isAllowedModel(m), true);
  assert.equal(isAllowedModel("gpt-5"), false);
  assert.equal(isAllowedModel(""), false);
});

test("resolveModel: null -> default, listed -> itself, unlisted -> default fallback", () => {
  assert.equal(resolveModel({ key: "t", model: null }), DEFAULT_AGENT_MODEL);
  assert.equal(resolveModel({ key: "t", model: "claude-haiku-4-5" }), "claude-haiku-4-5");
  assert.equal(resolveModel({ key: "t", model: "gpt-5" }), DEFAULT_AGENT_MODEL);
});

// ---------- contract checker (test-run) ----------

const goodAnswers = JSON.stringify({
  answers: [{ question_id: "A1-Q1", content: "Because.", confidence: 0.9, sources: [] }],
});

test("checkContract fq-answers-json: valid envelope passes, fenced too", () => {
  assert.deepEqual(checkContract("fq-answers-json", goodAnswers), { checked: true, ok: true });
  assert.deepEqual(
    checkContract("fq-answers-json", "```json\n" + goodAnswers + "\n```"),
    { checked: true, ok: true }
  );
});

test("checkContract fq-answers-json: prose and malformed entries fail deterministically", () => {
  const prose = checkContract("fq-answers-json", "Happy to help! Here is my thinking...");
  assert.equal(prose.checked, true);
  assert.equal(prose.ok, false);
  const noQid = checkContract(
    "fq-answers-json",
    JSON.stringify({ answers: [{ content: "x", confidence: 0.5 }] })
  );
  assert.equal(noQid.ok, false);
  const badConf = checkContract(
    "fq-answers-json",
    JSON.stringify({ answers: [{ question_id: "A1-Q1", content: "x", confidence: "high" }] })
  );
  assert.equal(badConf.ok, false);
});

const slots: TemplateSlot[] = [
  { id: "headline", label: "H", purpose: "p", max_chars: 20, required: true, render: "text", source_sections: ["B1"] },
];

test("checkContract fills-json: valid fills pass; over-limit and non-strings fail", () => {
  assert.equal(
    checkContract("fills-json", JSON.stringify({ fills: { headline: "Short and fine" } }), { slots }).ok,
    true
  );
  const over = checkContract(
    "fills-json",
    JSON.stringify({ fills: { headline: "This is far, far longer than twenty characters" } }),
    { slots }
  );
  assert.equal(over.ok, false);
  assert.match(over.error ?? "", /headline/);
  assert.equal(
    checkContract("fills-json", JSON.stringify({ fills: { headline: 42 } })).ok,
    false
  );
  assert.equal(checkContract("fills-json", "no json").ok, false);
});

test("checkContract section-headings: mirrors the splitSections regex", () => {
  const out = "## A1 · The Why\n\nBody\n\n## A5 · Positioning Statements\n\nBody";
  assert.equal(checkContract("section-headings", out, { sectionIds: ["A1", "A5"] }).ok, true);
  const missing = checkContract("section-headings", "## A1 only", { sectionIds: ["A1", "A5"] });
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? "", /A5/);
  // "## A10" must not satisfy A1 (\b boundary — but A1 followed by 0 is a different id)
  assert.equal(
    checkContract("section-headings", "## A10 · Other", { sectionIds: ["A1"] }).ok,
    false
  );
});

test("checkContract markdown: never checked, always ok", () => {
  assert.deepEqual(checkContract("markdown", "anything at all"), { checked: false, ok: true });
});

// ---------- .claude/agents frontmatter parsing (boot sync) ----------

test("parseAgentFile extracts name, description, and post-frontmatter body", () => {
  const parsed = parseAgentFile(
    "---\nname: voice-of-market\ndescription: Voice-of-Market Agent (A1). Identifies things. Use PROACTIVELY.\ntools: Read\n---\n\nYou are the Voice-of-Market Agent.\n\n## Mission\nDo the work.\n"
  );
  assert.ok(parsed);
  assert.equal(parsed!.name, "voice-of-market");
  assert.match(parsed!.description, /^Voice-of-Market Agent \(A1\)\./);
  assert.ok(parsed!.body.startsWith("You are the Voice-of-Market Agent."));
  assert.ok(parsed!.body.endsWith("Do the work."));
});

test("parseAgentFile returns null without frontmatter", () => {
  assert.equal(parseAgentFile("Just a markdown file"), null);
});

test("agentFileDescription drops the identity prefix, keeps one sentence, survives 'vs.' and '.md'", () => {
  assert.equal(
    agentFileDescription("Voice-of-Market Agent (A1). Identifies buyer needs. Use PROACTIVELY for things."),
    "Identifies buyer needs."
  );
  assert.equal(
    agentFileDescription(
      "GTM Performance Agent (C13). Measures impact, tagged leading vs. lagging, and outputs the KPI map. Use PROACTIVELY monthly."
    ),
    "Measures impact, tagged leading vs. lagging, and outputs the KPI map."
  );
  assert.equal(
    agentFileDescription(
      "Content Governance Agent (C12). Flags copy against positioning-and-icp.md and audits. Use PROACTIVELY."
    ),
    "Flags copy against positioning-and-icp.md and audits."
  );
});

// ---------- registry shape ----------

test("AGENT_REGISTRY holds exactly 8 task + 14 pmm agents with the blueprint contracts", () => {
  const entries = Object.values(AGENT_REGISTRY);
  assert.equal(entries.filter((e) => e.kind === "task").length, 8);
  assert.equal(entries.filter((e) => e.kind === "pmm").length, 14);
  // Task base prompts are canonical code constants (ask-war-room's is the
  // documented empty special case — its body is the per-role framing).
  for (const e of entries.filter((x) => x.kind === "task")) {
    assert.equal(typeof e.basePrompt, "string", e.key);
    if (e.key !== "ask-war-room") assert.ok((e.basePrompt ?? "").length > 100, e.key);
  }
  assert.equal(AGENT_REGISTRY["fq-extraction"].contract, "fq-answers-json");
  assert.equal(AGENT_REGISTRY["template-slot-fill"].contract, "fills-json");
  assert.equal(AGENT_REGISTRY["messaging-doc-generation"].contract, "section-headings");
  assert.equal(AGENT_REGISTRY["ask-router"].contract, "route-json");
  assert.equal(AGENT_REGISTRY["competitive-event-summary"].contract, "event-json");
  assert.deepEqual(AGENT_REGISTRY["ask-router"].registryDefaults, { min_confidence: 0.6 });
  for (const e of entries.filter((x) => x.kind === "pmm")) {
    assert.equal(e.contract, "markdown", e.key);
    assert.ok(["A", "B", "C"].includes(e.grp ?? ""), e.key);
  }
});

test("AGENT_REGISTRY insertion order: event-summary then ask-router follow competitive-compare, before the PMM groups", () => {
  const keys = Object.keys(AGENT_REGISTRY);
  const routerIdx = keys.indexOf("ask-router");
  assert.equal(keys.indexOf("competitive-event-summary"), keys.indexOf("competitive-compare") + 1);
  assert.equal(routerIdx, keys.indexOf("competitive-event-summary") + 1);
  assert.ok(routerIdx < keys.indexOf("voice-of-market"));
});

// ---------- contract checker: route-json (ask-to-artifact §5.1) ----------

const goodRoute = JSON.stringify({
  intent: "artifact",
  confidence: 0.85,
  asset_type: "one-pager",
  template_id: "sample-tpl-onepager",
  product_name: "Masterworks AI",
  brief: "Leave-behind for a DOT prospect about risk prediction.",
  reason: "Explicit request for a deliverable.",
});
const routeOpts = { validTemplateIds: ["sample-tpl-onepager", "sample-tpl-battlecard"] };

test("checkContract route-json: valid artifact passes, fenced too; valid question passes", () => {
  assert.deepEqual(checkContract("route-json", goodRoute, routeOpts), { checked: true, ok: true });
  assert.deepEqual(
    checkContract("route-json", "```json\n" + goodRoute + "\n```", routeOpts),
    { checked: true, ok: true }
  );
  assert.deepEqual(
    checkContract(
      "route-json",
      JSON.stringify({ intent: "question", confidence: 0.9, reason: "Wants talk tracks." }),
      routeOpts
    ),
    { checked: true, ok: true }
  );
});

test("checkContract route-json: invented template_id fails with the fallback-explaining error", () => {
  const invented = checkContract(
    "route-json",
    JSON.stringify({
      intent: "artifact",
      confidence: 0.8,
      asset_type: "one-pager",
      template_id: "made-up-id",
      brief: "b",
      reason: "r",
    }),
    routeOpts
  );
  assert.equal(invented.checked, true);
  assert.equal(invented.ok, false);
  assert.match(invented.error ?? "", /"made-up-id" is not in the catalog/);
  assert.match(invented.error ?? "", /falls back to the asset type's first approved template/);
  // Without validTemplateIds the id is only type-checked.
  assert.equal(
    checkContract(
      "route-json",
      JSON.stringify({ intent: "artifact", confidence: 0.8, asset_type: "one-pager", template_id: "x", brief: "b" })
    ).ok,
    true
  );
});

test("checkContract route-json: garbage, bad intent, bad confidence, missing fields all fail", () => {
  assert.equal(checkContract("route-json", "Happy to help! Not JSON at all.").ok, false);
  assert.equal(
    checkContract("route-json", JSON.stringify({ intent: "asset", confidence: 0.9 })).ok,
    false
  );
  assert.equal(
    checkContract("route-json", JSON.stringify({ intent: "question", confidence: "high" })).ok,
    false
  );
  assert.equal(
    checkContract("route-json", JSON.stringify({ intent: "question", confidence: 1.5 })).ok,
    false
  );
  // artifact intent requires non-empty asset_type and brief
  assert.equal(
    checkContract("route-json", JSON.stringify({ intent: "artifact", confidence: 0.9, brief: "b" })).ok,
    false
  );
  assert.equal(
    checkContract(
      "route-json",
      JSON.stringify({ intent: "artifact", confidence: 0.9, asset_type: "faq", brief: "  " })
    ).ok,
    false
  );
  // template_id present but not a string
  assert.equal(
    checkContract(
      "route-json",
      JSON.stringify({ intent: "artifact", confidence: 0.9, asset_type: "faq", brief: "b", template_id: 7 })
    ).ok,
    false
  );
});

// ---------- contract checker: event-json (competitive watch Phase 0) ----------

test("parseEventEnvelope accepts a full changed envelope and a bare not-changed one", () => {
  const good = parseEventEnvelope(
    JSON.stringify({
      changed: true,
      event_type: "pricing_changed",
      severity: "notable",
      title: "Kahua: Noa added to Enterprise plan",
      summary: "AI assistant now bundled.",
    })
  );
  assert.ok(good);
  assert.equal(good!.event_type, "pricing_changed");
  assert.equal(good!.severity, "notable");

  const quiet = parseEventEnvelope(JSON.stringify({ changed: false }));
  assert.deepEqual(quiet, { changed: false });
});

test("parseEventEnvelope rejects bad enums, empty titles, and non-JSON", () => {
  assert.equal(
    parseEventEnvelope(
      JSON.stringify({ changed: true, event_type: "gossip", severity: "info", title: "x" })
    ),
    null
  );
  assert.equal(
    parseEventEnvelope(
      JSON.stringify({ changed: true, event_type: "news", severity: "urgent", title: "x" })
    ),
    null
  );
  assert.equal(
    parseEventEnvelope(JSON.stringify({ changed: true, event_type: "news", severity: "info", title: "  " })),
    null
  );
  assert.equal(parseEventEnvelope("not json at all"), null);
});

test("checkContract event-json mirrors parseEventEnvelope", () => {
  assert.equal(checkContract("event-json", JSON.stringify({ changed: false })).ok, true);
  const bad = checkContract("event-json", JSON.stringify({ changed: "yes" }));
  assert.equal(bad.ok, false);
  assert.ok(bad.error);
});
