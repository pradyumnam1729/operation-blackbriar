import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import { ask } from "../services/claude";
import { markdownToHtml } from "../services/html";
import { checkForbiddenWords } from "../services/guardrails";
import { chunksToContext, retrieveChunks } from "../services/ingestion";
import {
  AGENT_MODEL_ALLOWLIST,
  AGENT_REGISTRY,
  AgentConfig,
  AgentError,
  AgentRegistryEntry,
  ContractCheckOptions,
  DEFAULT_AGENT_MODEL,
  SAMPLE_ACCEPTED_ANSWERS_CONTEXT,
  SAMPLE_COMPETITOR_XML,
  SAMPLE_EXTRACTION_VARS,
  SAMPLE_MERGE_ITEMS,
  SAMPLE_MESSAGING_SECTIONS,
  SAMPLE_MESSAGING_VARS,
  SAMPLE_QUESTIONS,
  SAMPLE_ROUTER_CANDIDATES,
  SAMPLE_ROUTER_QUESTION,
  SAMPLE_SECTION_XML,
  SAMPLE_SLOTS,
  SAMPLE_SLOT_FILL_VARS,
  SAMPLE_TRANSCRIPT_XML,
  assertAgentEnabled,
  bustAgentCache,
  checkContract,
  composeAgentPrompt,
  findUnknownPlaceholders,
  getAgentConfig,
  isAllowedModel,
  resolveModel,
} from "../services/agents";
import { ROLE_FRAMING } from "../services/agentPrompts";
import { buildExtractionSuffix, buildMergeSuffix } from "../services/questionnaire";
import { buildRouterSuffix } from "../services/askRouter";
import { buildSlotFillSuffix } from "../services/templateGenerate";
import { SECTION_INSTRUCTIONS, buildProduceSuffix } from "../services/messagingDoc";

// Agents tab admin API (blueprint §2.4). Every endpoint is PMM-admin-only —
// configuration of the system's brain is the §8.4 boundary. Error bodies are
// {error}; unknown :key -> 404; disabled-agent test-run -> 409; unlisted
// model on write -> 400. Test runs execute a CANDIDATE config against static
// samples and never persist anything.
export const agentsRouter = Router();

agentsRouter.use(requireAuth, requireAdmin);

const MODEL_ERROR = `model must be one of: ${AGENT_MODEL_ALLOWLIST.join(", ")} (or null for the default)`;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Registry display order (6 task agents, then groups A, B, C). */
const REGISTRY_ORDER = new Map(Object.keys(AGENT_REGISTRY).map((k, i) => [k, i]));

/** Contract-suffix preview built with static sample runtime — shows the admin
 *  the code-owned seam an override can never remove (§2.4 endpoint 2). */
function contractSuffixPreview(entry: AgentRegistryEntry): string {
  switch (entry.key) {
    case "fq-extraction":
      return buildExtractionSuffix(SAMPLE_QUESTIONS);
    case "fq-merge":
      return buildMergeSuffix(SAMPLE_MERGE_ITEMS);
    case "messaging-doc-generation":
      return buildProduceSuffix(sampleSectionLines({}));
    case "template-slot-fill":
      return buildSlotFillSuffix(SAMPLE_SLOTS, undefined);
    case "ask-war-room":
      return "Question from the sales team:\n<the asker's question>";
    case "competitive-compare":
      return [
        "Registry hint: this competitor is usually compared against Aurigo <product>. Override only if the question clearly targets a different market.",
        "=== SCRAPED COMPETITOR SOURCES ===\n<scraped competitor pages>",
        "=== AURIGO KNOWLEDGE BASE (ground truth) ===\n<knowledge-base excerpts>",
        "=== QUESTION (from a GTM teammate) ===\nCompetitor: <name>\n<the question>",
      ].join("\n\n");
    case "ask-router":
      return buildRouterSuffix(SAMPLE_ROUTER_CANDIDATES, "<the request>", "general");
    default:
      return "Task brief from the PMM admin:\n<the brief>";
  }
}

function sampleSectionLines(overrides: Record<string, string>): string {
  const instructions = { ...SECTION_INSTRUCTIONS, ...overrides };
  return SAMPLE_MESSAGING_SECTIONS.map(
    (s) => `- "## ${s.id} · ${s.title}": ${instructions[s.id] ?? "Synthesize from the approved answers."}`
  ).join("\n");
}

// ---------- 1. GET /api/agents — list ----------

agentsRouter.get("/", async (_req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { data, error } = await sb
    .from("agents")
    .select(
      "key, kind, grp, name, description, model, enabled, prompt_override, custom_instructions, endpoint_url, updated_at, updated_by, updated_by_profile:profiles!agents_updated_by_fkey(full_name)"
    );
  // Table missing (migration 0013 not run) or empty -> [] and the UI renders
  // the migration note; pipelines keep working on synthetic defaults.
  const rows = error ? [] : data ?? [];

  const agents = rows
    .map((r) => {
      const row = r as unknown as {
        key: string;
        kind: string;
        grp: string | null;
        name: string;
        description: string;
        model: string | null;
        enabled: boolean;
        prompt_override: string | null;
        custom_instructions: string;
        endpoint_url: string | null;
        updated_at: string;
        updated_by_profile: { full_name: string } | null;
      };
      return {
        key: row.key,
        kind: row.kind,
        grp: row.grp,
        name: row.name,
        description: row.description,
        model: row.model,
        enabled: row.enabled,
        overridden: row.prompt_override !== null,
        has_custom_instructions: (row.custom_instructions ?? "").trim() !== "",
        endpoint_url: row.endpoint_url ?? null,
        updated_at: row.updated_at,
        updated_by_name: row.updated_by_profile?.full_name ?? null,
      };
    })
    .sort(
      (a, b) => (REGISTRY_ORDER.get(a.key) ?? 999) - (REGISTRY_ORDER.get(b.key) ?? 999)
    );

  res.json({ agents, default_model: DEFAULT_AGENT_MODEL, model_allowlist: AGENT_MODEL_ALLOWLIST });
});

// ---------- 2. GET /api/agents/:key — detail + meta ----------

agentsRouter.get("/:key", async (req, res) => {
  const entry = AGENT_REGISTRY[req.params.key];
  if (!entry) return res.status(404).json({ error: "Unknown agent" });

  let cfg: AgentConfig;
  try {
    cfg = await getAgentConfig(entry.key);
  } catch (err) {
    const status = err instanceof AgentError ? err.status : 500;
    return res.status(status).json({ error: (err as Error).message });
  }

  res.json({
    agent: cfg,
    meta: {
      contract: entry.contract,
      contract_suffix_preview: contractSuffixPreview(entry),
      placeholders: entry.placeholders,
      defaults_schema: entry.defaultsSchema,
      registry_defaults: entry.registryDefaults,
      model_allowlist: AGENT_MODEL_ALLOWLIST,
      default_model: DEFAULT_AGENT_MODEL,
    },
  });
});

// ---------- 3. PUT /api/agents/:key — partial config update ----------

agentsRouter.put("/:key", async (req, res) => {
  const entry = AGENT_REGISTRY[req.params.key];
  if (!entry) return res.status(404).json({ error: "Unknown agent" });
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const fields: string[] = [];

  if ("custom_instructions" in body) {
    if (typeof body.custom_instructions !== "string") {
      return res.status(400).json({ error: "custom_instructions must be a string" });
    }
    patch.custom_instructions = body.custom_instructions;
    fields.push("custom_instructions");
  }
  if ("prompt_override" in body) {
    if (body.prompt_override !== null && typeof body.prompt_override !== "string") {
      return res.status(400).json({ error: "prompt_override must be a string or null" });
    }
    patch.prompt_override =
      typeof body.prompt_override === "string" && body.prompt_override.trim() !== ""
        ? body.prompt_override
        : null;
    fields.push("prompt_override");
  }
  if ("model" in body) {
    const model = body.model ?? null;
    if (model !== null && typeof model !== "string") {
      return res.status(400).json({ error: MODEL_ERROR });
    }
    if (!isAllowedModel(model as string | null)) {
      return res.status(400).json({ error: MODEL_ERROR });
    }
    patch.model = model;
    fields.push("model");
  }
  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }
    patch.enabled = body.enabled;
    fields.push("enabled");
  }
  if ("defaults" in body) {
    if (!isPlainObject(body.defaults)) {
      return res.status(400).json({ error: "defaults must be a JSON object" });
    }
    patch.defaults = body.defaults;
    fields.push("defaults");
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: "No recognized fields to update" });
  }

  const { data: existing } = await sb
    .from("agents")
    .select("id")
    .eq("key", entry.key)
    .maybeSingle();
  if (!existing) {
    return res
      .status(404)
      .json({ error: "Agent row not found — run migration 0013 (or restart to let the boot sync seed it)." });
  }

  patch.updated_by = req.user!.id;
  patch.updated_at = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("agents")
    .update(patch)
    .eq("id", existing.id as string)
    .select("*")
    .single();
  if (error || !updated) return res.status(500).json({ error: error?.message ?? "Update failed" });

  bustAgentCache(entry.key);

  const warnings: string[] = [];
  if (typeof patch.prompt_override === "string") {
    for (const name of findUnknownPlaceholders(patch.prompt_override, entry.placeholders)) {
      warnings.push(
        `Unknown placeholder {{${name}}} — it will be left verbatim at run time. Known: ${
          entry.placeholders.length > 0
            ? entry.placeholders.map((p) => `{{${p}}}`).join(", ")
            : "none for this agent"
        }.`
      );
    }
  }

  void logActivity("agent", existing.id as string, req.user!.id, "agent_updated", {
    key: entry.key,
    fields,
    model: (updated as { model: string | null }).model,
  });
  res.json({ agent: updated, warnings });
});

// ---------- 4. POST /api/agents/:key/revert — back to stock prompt ----------

agentsRouter.post("/:key/revert", async (req, res) => {
  const entry = AGENT_REGISTRY[req.params.key];
  if (!entry) return res.status(404).json({ error: "Unknown agent" });
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { data: existing } = await sb
    .from("agents")
    .select("id")
    .eq("key", entry.key)
    .maybeSingle();
  if (!existing) {
    return res
      .status(404)
      .json({ error: "Agent row not found — run migration 0013 (or restart to let the boot sync seed it)." });
  }

  // §0.1-4: clear the delta, keep the identity. `enabled` is untouched —
  // revert is "back to stock prompt", not "turn it on".
  const { data: updated, error } = await sb
    .from("agents")
    .update({
      prompt_override: null,
      custom_instructions: "",
      model: null,
      defaults: entry.registryDefaults,
      updated_by: req.user!.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id as string)
    .select("*")
    .single();
  if (error || !updated) return res.status(500).json({ error: error?.message ?? "Revert failed" });

  bustAgentCache(entry.key);
  void logActivity("agent", existing.id as string, req.user!.id, "agent_reverted", {
    key: entry.key,
  });
  res.json({ agent: updated });
});

// ---------- 5. POST /api/agents/:key/test-run — candidate config, never persisted ----------

agentsRouter.post("/:key/test-run", async (req, res) => {
  const entry = AGENT_REGISTRY[req.params.key];
  if (!entry) return res.status(404).json({ error: "Unknown agent" });

  let stored: AgentConfig;
  try {
    stored = await getAgentConfig(entry.key);
    assertAgentEnabled(stored); // disabled agent -> 409, even for test runs
  } catch (err) {
    const status = err instanceof AgentError ? err.status : 500;
    return res.status(status).json({ error: (err as Error).message });
  }

  const body = req.body as {
    custom_instructions?: unknown;
    prompt_override?: unknown;
    model?: unknown;
    defaults?: unknown;
    input?: { question?: unknown; role?: unknown; brief?: unknown };
    compose_only?: unknown;
  };

  // Candidate config: request-body fields layered over the stored row.
  const candidate: AgentConfig = {
    ...stored,
    custom_instructions:
      typeof body.custom_instructions === "string" ? body.custom_instructions : stored.custom_instructions,
    prompt_override:
      "prompt_override" in body
        ? typeof body.prompt_override === "string" && body.prompt_override.trim() !== ""
          ? body.prompt_override
          : null
        : stored.prompt_override,
    model: "model" in body ? (typeof body.model === "string" ? body.model : null) : stored.model,
    defaults: isPlainObject(body.defaults) ? body.defaults : stored.defaults,
  };
  // Same allowlist gate as PUT — a silent fallback here would show the admin a
  // test result from a model they didn't pick.
  if (candidate.model !== null && !isAllowedModel(candidate.model)) {
    return res.status(400).json({ error: MODEL_ERROR });
  }
  const composeOnly = body.compose_only === true;
  const question = typeof body.input?.question === "string" ? body.input.question.trim() : "";
  const role = typeof body.input?.role === "string" && body.input.role.trim() !== "" ? body.input.role.trim() : "general";
  const brief = typeof body.input?.brief === "string" ? body.input.brief.trim() : "";

  // Per-agent sample assembly (§2.3): static inputs, no DB rows, no scraping.
  let prompt: string;
  let extraContext: string | undefined;
  let contractOpts: ContractCheckOptions = {};
  try {
    switch (entry.key) {
      case "fq-extraction":
        prompt = composeAgentPrompt(candidate, SAMPLE_EXTRACTION_VARS, buildExtractionSuffix(SAMPLE_QUESTIONS));
        extraContext = SAMPLE_TRANSCRIPT_XML;
        break;
      case "fq-merge":
        prompt = composeAgentPrompt(candidate, {}, buildMergeSuffix(SAMPLE_MERGE_ITEMS));
        break;
      case "messaging-doc-generation": {
        const overrides = isPlainObject(candidate.defaults.section_instructions)
          ? (candidate.defaults.section_instructions as Record<string, string>)
          : {};
        prompt = composeAgentPrompt(
          candidate,
          SAMPLE_MESSAGING_VARS,
          buildProduceSuffix(sampleSectionLines(overrides))
        );
        extraContext = SAMPLE_ACCEPTED_ANSWERS_CONTEXT;
        contractOpts = { sectionIds: SAMPLE_MESSAGING_SECTIONS.map((s) => s.id) };
        break;
      }
      case "template-slot-fill":
        prompt = composeAgentPrompt(candidate, SAMPLE_SLOT_FILL_VARS, buildSlotFillSuffix(SAMPLE_SLOTS, undefined));
        extraContext = SAMPLE_SECTION_XML;
        contractOpts = { slots: SAMPLE_SLOTS };
        break;
      case "ask-war-room": {
        if (question === "") {
          return res.status(400).json({ error: "input.question is required for this agent's test run" });
        }
        const roleOverrides = isPlainObject(candidate.defaults.role_framing)
          ? (candidate.defaults.role_framing as Record<string, string>)
          : {};
        const framingMap: Record<string, string> = { ...ROLE_FRAMING, ...roleOverrides };
        const framing =
          candidate.prompt_override ?? framingMap[role.toLowerCase()] ?? framingMap.general;
        prompt = composeAgentPrompt(
          { base_prompt: framing, custom_instructions: candidate.custom_instructions, prompt_override: null },
          { role },
          `Question from the ${role} team:\n${question}`
        );
        // Keep test runs cheap: top-4 chunks only, and none on compose_only.
        if (!composeOnly) {
          const chunks = await retrieveChunks(question, 4);
          extraContext = chunks.length > 0 ? chunksToContext(chunks) : undefined;
        }
        break;
      }
      case "competitive-compare": {
        if (question === "") {
          return res.status(400).json({ error: "input.question is required for this agent's test run" });
        }
        const suffix = [
          "=== SCRAPED COMPETITOR SOURCES ===",
          SAMPLE_COMPETITOR_XML,
          `=== QUESTION (from a GTM teammate) ===\nCompetitor: Kahua (static sample)\n${question}`,
        ].join("\n\n");
        prompt = composeAgentPrompt(candidate, {}, suffix);
        break;
      }
      case "ask-router": {
        // Static sample default — no 400; the admin can still type their own
        // (ask-to-artifact blueprint §5.3). No extraContext: the router never
        // sees the corpus. Expected sample result: intent "artifact",
        // template_id "sample-tpl-onepager" — the canonical demo line
        // round-trips on the Agents tab.
        const routerQuestion = question !== "" ? question : SAMPLE_ROUTER_QUESTION;
        prompt = composeAgentPrompt(
          candidate,
          {},
          buildRouterSuffix(SAMPLE_ROUTER_CANDIDATES, routerQuestion, role)
        );
        contractOpts = { validTemplateIds: SAMPLE_ROUTER_CANDIDATES.map((c) => c.id) };
        break;
      }
      default: {
        // Any PMM sub-agent: config + test-run only in MVP (§0.1-1).
        if (brief === "") {
          return res.status(400).json({ error: "input.brief is required for this agent's test run" });
        }
        prompt = composeAgentPrompt(candidate, {}, `Task brief from the PMM admin:\n${brief}`);
        if (!composeOnly) {
          const chunks = await retrieveChunks(brief, 6);
          extraContext = chunks.length > 0 ? chunksToContext(chunks) : undefined;
        }
        break;
      }
    }
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }

  const modelUsed = resolveModel(candidate);

  if (composeOnly) {
    return res.json({
      prompt,
      contract: { checked: false, ok: true },
      guard: { ok: true, violations: [] },
      model_used: modelUsed,
      duration_ms: 0,
    });
  }

  const started = Date.now();
  let raw: string;
  try {
    // Mirror the runtime cap for the router (askRouter.ts uses 500).
    const maxTokens = entry.key === "ask-router" ? 500 : 8000;
    raw = await ask(prompt, { extraContext, maxTokens, model: modelUsed });
  } catch (err) {
    return res.status(502).json({ error: `Test run failed: ${(err as Error).message}` });
  }
  const durationMs = Date.now() - started;

  const contract = checkContract(entry.contract, raw, contractOpts);
  const guard = checkForbiddenWords(raw); // §8.1 surfaced early — informational

  // activity_log.entity_id is uuid — log only when a real row backs this agent.
  if (stored.id !== "") {
    void logActivity("agent", stored.id, req.user!.id, "agent_test_run", {
      key: entry.key,
      with_override: candidate.prompt_override !== null,
      contract_ok: contract.ok,
    });
  }

  res.json({
    prompt,
    output_raw: raw,
    ...(entry.contract === "markdown" ? { output_html: markdownToHtml(raw) } : {}),
    contract,
    guard,
    model_used: modelUsed,
    duration_ms: durationMs,
  });
});
