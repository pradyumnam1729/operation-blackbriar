import { Router } from "express";
import { ask } from "../services/claude";
import { loadCorpus } from "../services/warRoom";

// Persona output framing — Master Instructions §9.2. Every answer is shaped
// for the asker's role and their metric language (§3.3).
const ROLE_FRAMING: Record<string, string> = {
  sales:
    "The asker is in Sales, supporting an active deal. Frame the answer as talk tracks, objection handling, competitive proof points. Their metrics: SQLs, win rates, deal velocity, pipeline value, average deal size.",
  proposals:
    "The asker writes RFP and proposal responses. Frame the answer as compliant, differentiated response language with proof assets and use-case evidence.",
  marketing:
    "The asker runs campaigns and content. Frame the answer as messaging hierarchy, channel copy guidance, and campaign framing. Their metrics: MQLs, CPL, conversion rate.",
  leadership:
    "The asker is an executive. Lead with metric impact (MRR, NRR, win rate, pipeline) and strategic implications. Keep it brief and decision-oriented.",
  product:
    "The asker is in Product. Frame the answer as market signals, adoption barriers, feature positioning, and buyer feedback. Their metrics: activation rate, feature adoption, time-to-value.",
  cs: "The asker is in Customer Success. Frame the answer as adoption messaging, expansion talk tracks, and churn-risk signals.",
  sdr: "The asker is an SDR/BDR doing outbound. Frame the answer as persona-specific openers, pain-first copy, and objection one-liners.",
};

export const queryRouter = Router();

queryRouter.post("/", async (req, res) => {
  const { question, role } = req.body as { question?: string; role?: string };
  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  const framing =
    ROLE_FRAMING[(role ?? "").toLowerCase()] ??
    "Frame the answer for a general internal audience.";

  // Small corpus: load the whole war room beyond brand DNA as extra context.
  const corpus = loadCorpus()
    .filter((d) => !d.relPath.startsWith("BRAND-DNA")) // already in the system prompt
    .map((d) => `<file path="GTM-War-Room/${d.relPath}">\n${d.content}\n</file>`)
    .join("\n\n");

  try {
    const answer = await ask(
      `${framing}\n\nQuestion from the ${role ?? "internal"} team:\n${question}`,
      { extraContext: corpus }
    );
    res.json({ answer, role: role ?? "general" });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
