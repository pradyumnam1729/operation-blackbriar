import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { ask } from "../services/claude";
import { markdownToHtml, htmlToText } from "../services/html";
import { loadCorpus } from "../services/warRoom";

// AI endpoints for the editor and generators. All output leaves this module as
// sanitized, user-ready HTML — the frontend never renders markdown.
export const aiRouter = Router();

const EDIT_ACTIONS: Record<string, string> = {
  rewrite: "Rewrite the passage to be clearer and stronger while preserving meaning.",
  shorten: "Shorten the passage substantially while keeping every load-bearing claim.",
  expand: "Expand the passage with more concrete detail, staying grounded in the provided context.",
  "voice-fix":
    "Rewrite the passage to comply with the Voice of Aurigo rules (reader-first opening, active voice, no banned words, no hedging).",
  formalize: "Rewrite the passage for an executive audience: metric-led, brief, decision-oriented.",
};

// POST /api/ai/edit  { action, text, instruction? } → { html }
aiRouter.post("/edit", requireAuth, async (req, res) => {
  const { action, text, instruction } = req.body as {
    action?: string;
    text?: string;
    instruction?: string;
  };
  if (!text || text.trim() === "") return res.status(400).json({ error: "text is required" });
  const directive = EDIT_ACTIONS[action ?? ""] ?? instruction;
  if (!directive) {
    return res.status(400).json({
      error: `action must be one of ${Object.keys(EDIT_ACTIONS).join(", ")} or provide an instruction`,
    });
  }
  try {
    const md = await ask(
      `${directive}\n\nReturn only the revised passage in Markdown — no preamble, no commentary.\n\nPassage:\n${htmlToText(text)}`,
      { maxTokens: 4000 }
    );
    res.json({ html: markdownToHtml(md) });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// POST /api/ai/generate  { brief, productName?, assetType?, persona? } → { html }
aiRouter.post("/generate", requireAuth, async (req, res) => {
  const { brief, productName, assetType, persona } = req.body as {
    brief?: string;
    productName?: string;
    assetType?: string;
    persona?: string;
  };
  if (!brief) return res.status(400).json({ error: "brief is required" });
  const corpus = loadCorpus()
    .filter((d) => !d.relPath.startsWith("BRAND-DNA"))
    .map((d) => `<file path="GTM-War-Room/${d.relPath}">\n${d.content}\n</file>`)
    .join("\n\n");
  try {
    const md = await ask(
      [
        `Produce a ${assetType ?? "document"} for product "${productName ?? "Aurigo"}"${persona ? `, persona: ${persona}` : ""}.`,
        `Brief: ${brief}`,
        "Return only the finished content in Markdown with proper headings — no preamble, no meta-commentary.",
      ].join("\n"),
      { extraContext: corpus }
    );
    res.json({ html: markdownToHtml(md) });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
