import { Router } from "express";
import { logQuery } from "../services/db";
import { markdownToHtml } from "../services/html";
import { requireAuth } from "../middleware/auth";
import { AgentError } from "../services/agents";
import { classifyAsk } from "../services/askRouter";
import { answerQuestion } from "../services/askPipeline";

// Persona output framing — Master Instructions §9.2 — now lives in
// services/agentPrompts.ts (ROLE_FRAMING) as the code fallback; the
// `ask-war-room` agent row's defaults.role_framing overrides it per role, and
// a full prompt_override collapses all roles into one preamble ({{role}}
// available). Question block stays the locked suffix (Agents blueprint §2.2-2).
//
// Response is a discriminated union (ask-to-artifact blueprint §3.1):
// {kind:"answer", answerHtml, role} — the pre-existing fields verbatim — or
// {kind:"routing", role, proposal} when the ask-router classifies the request
// as an artifact request (no answer model call is made). mode:"question" skips
// classification entirely (escape hatch, §0.1-7); every router failure mode
// degrades to the answer path inside classifyAsk — the router never errors.

export const queryRouter = Router();

queryRouter.post("/", requireAuth, async (req, res) => {
  const { question, role, mode } = req.body as {
    question?: string;
    role?: string;
    mode?: string;
  };
  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  // Classify-first gate (§4.3). Unknown mode values are treated as "auto".
  if (mode !== "question") {
    const routed = await classifyAsk(question, (role ?? "general").toLowerCase());
    if (routed.intent === "artifact") {
      // The only side effect on the routing path — C11/C13 metrics capture
      // asset demand arriving through Ask (§0.1-6). Nothing else persists
      // until the human confirms via POST /api/templates/:id/generate.
      void logQuery(
        role ?? "general",
        question,
        `[routed → ${routed.proposal.asset_type}: ${routed.proposal.template.name}]`
      );
      return res.json({ kind: "routing", role: role ?? "general", proposal: routed.proposal });
    }
  }

  // Post-classification pipeline now lives in services/askPipeline.ts
  // (answerQuestion), shared verbatim with the public /ask endpoint. Config
  // errors surface as AgentError (its status); a single-shot fallback failure
  // surfaces as a plain Error → 502 — matching the pre-refactor behavior.
  let result: { answer: string; trace?: import("../services/askAgent").TraceStep[] };
  try {
    result = await answerQuestion(question, role ?? "general");
  } catch (err) {
    const status = err instanceof AgentError ? err.status : 502;
    return res.status(status).json({ error: (err as Error).message });
  }

  void logQuery(role ?? "general", question, result.answer); // fire-and-forget; feeds C11/C13 metrics
  // The frontend renders formatted HTML only — never raw markdown. `trace` is
  // included only when the agentic path produced one (fallback omits it).
  const body: Record<string, unknown> = {
    kind: "answer",
    answerHtml: markdownToHtml(result.answer),
    role: role ?? "general",
  };
  if (result.trace !== undefined) body.trace = result.trace;
  res.json(body);
});
