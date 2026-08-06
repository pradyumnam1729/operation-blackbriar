import { Router } from "express";
import { ask } from "../services/claude";
import { loadCorpus } from "../services/warRoom";
import { logQuery } from "../services/db";
import { markdownToHtml } from "../services/html";
import { requireAuth } from "../middleware/auth";
import { chunksToContext, retrieveChunks } from "../services/ingestion";
import {
  AgentError,
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "../services/agents";
import { ROLE_FRAMING } from "../services/agentPrompts";

// Persona output framing — Master Instructions §9.2 — now lives in
// services/agentPrompts.ts (ROLE_FRAMING) as the code fallback; the
// `ask-war-room` agent row's defaults.role_framing overrides it per role, and
// a full prompt_override collapses all roles into one preamble ({{role}}
// available). Question block stays the locked suffix (Agents blueprint §2.2-2).

export const queryRouter = Router();

queryRouter.post("/", requireAuth, async (req, res) => {
  const { question, role } = req.body as { question?: string; role?: string };
  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  let cfg;
  try {
    cfg = await getAgentConfig("ask-war-room");
    assertAgentEnabled(cfg);
  } catch (err) {
    const status = err instanceof AgentError ? err.status : 500;
    return res.status(status).json({ error: (err as Error).message });
  }

  const roleOverrides =
    cfg.defaults.role_framing && typeof cfg.defaults.role_framing === "object"
      ? (cfg.defaults.role_framing as Record<string, string>)
      : {};
  const framingMap: Record<string, string> = { ...ROLE_FRAMING, ...roleOverrides };
  const framing =
    cfg.prompt_override ?? framingMap[(role ?? "").toLowerCase()] ?? framingMap.general;

  // Context = war-room files + top-ranked chunks from AI-enabled knowledge-base
  // documents (local folder syncs, promoted uploads).
  const warRoom = loadCorpus()
    .filter((d) => !d.relPath.startsWith("BRAND-DNA")) // already in the system prompt
    .map((d) => `<file path="GTM-War-Room/${d.relPath}">\n${d.content}\n</file>`)
    .join("\n\n");
  const chunks = await retrieveChunks(question, 8);
  const corpus =
    chunks.length > 0
      ? `=== KNOWLEDGE BASE (most relevant excerpts) ===\n${chunksToContext(chunks)}\n\n${warRoom}`
      : warRoom;

  // Locked suffix: the question block. The body is the resolved per-role
  // framing (base_prompt is empty for this agent — special case, §2.2-2).
  const prompt = composeAgentPrompt(
    { base_prompt: framing, custom_instructions: cfg.custom_instructions, prompt_override: null },
    { role: role ?? "general" },
    `Question from the ${role ?? "internal"} team:\n${question}`
  );

  try {
    const answer = await ask(prompt, { extraContext: corpus, model: resolveModel(cfg) });
    void logQuery(role ?? "general", question, answer); // fire-and-forget; feeds C11/C13 metrics
    // The frontend renders formatted HTML only — never raw markdown.
    res.json({ answerHtml: markdownToHtml(answer), role: role ?? "general" });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
