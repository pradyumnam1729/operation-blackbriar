import { ask } from "./claude";
import { loadCorpus } from "./warRoom";
import { chunksToContext, retrieveChunks } from "./ingestion";
import {
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";
import { ROLE_FRAMING } from "./agentPrompts";
import { TraceStep, answerWithTools } from "./askAgent";

// The ask pipeline AFTER routing/classification (blueprint open-api.md §5),
// extracted VERBATIM from routes/query.ts:60–119 so the in-app Ask and the
// public /ask share one brain. Classification (the router) stays in query.ts —
// the public path never calls it (router disabled by construction, §0.1-3).
//
// Steps: agent config + kill-switch → per-role framing merge → composeAgentPrompt
// with the locked question suffix → agentic answerWithTools → degraded single-shot
// fallback over the full corpus. Throws AgentError when ask-war-room is
// disabled/unavailable; throws a plain Error when the single-shot fallback fails.

/** Returns the raw markdown answer. `trace` is present only on the agentic path
 *  (the degraded single-shot fallback has none) — mirroring query.ts, which
 *  included `trace` in the answer response only when the agentic loop succeeded.
 *  The public caller ignores trace entirely (answers only, §0.1-3). */
export async function answerQuestion(
  question: string,
  role: string
): Promise<{ answer: string; trace?: TraceStep[] }> {
  const cfg = await getAgentConfig("ask-war-room");
  assertAgentEnabled(cfg);

  const roleOverrides =
    cfg.defaults.role_framing && typeof cfg.defaults.role_framing === "object"
      ? (cfg.defaults.role_framing as Record<string, string>)
      : {};
  const framingMap: Record<string, string> = { ...ROLE_FRAMING, ...roleOverrides };
  const framing = cfg.prompt_override ?? framingMap[role.toLowerCase()] ?? framingMap.general;

  // Locked suffix: the question block. The body is the resolved per-role framing
  // (base_prompt is empty for this agent — special case, agents §2.2-2).
  const prompt = composeAgentPrompt(
    { base_prompt: framing, custom_instructions: cfg.custom_instructions, prompt_override: null },
    { role },
    `Question from the ${role} team:\n${question}`
  );

  // Agentic path: the model gathers its own evidence via tools and returns a
  // trace of what it consulted.
  try {
    const { answer, trace } = await answerWithTools(prompt, { model: resolveModel(cfg) });
    return { answer, trace };
  } catch (err) {
    console.error(
      "[ask] agentic loop failed, falling back to single-shot:",
      (err as Error).message
    );
  }

  // Degraded fallback: the pre-agentic single-shot path over the full corpus.
  const warRoom = loadCorpus()
    .filter((d) => !d.relPath.startsWith("BRAND-DNA")) // already in the system prompt
    .map((d) => `<file path="GTM-War-Room/${d.relPath}">\n${d.content}\n</file>`)
    .join("\n\n");
  const chunks = await retrieveChunks(question, 8);
  const corpus =
    chunks.length > 0
      ? `=== KNOWLEDGE BASE (most relevant excerpts) ===\n${chunksToContext(chunks)}\n\n${warRoom}`
      : warRoom;

  const answer = await ask(prompt, { extraContext: corpus, model: resolveModel(cfg) });
  return { answer };
}
