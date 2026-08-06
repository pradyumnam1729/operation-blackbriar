import { Router } from "express";
import fs from "fs";
import path from "path";
import { ask } from "../services/claude";
import { checkForbiddenWords } from "../services/guardrails";
import { loadCorpus, WAR_ROOM_DIR } from "../services/warRoom";
import { markAssetApproved, recordAsset } from "../services/db";

export const assetsRouter = Router();

const ASSET_SPECS: Record<string, { dir: string; brief: string }> = {
  battlecard: {
    dir: "PLAYBOOKS-AND-ASSETS/battlecards",
    brief:
      "Produce a 2-page competitive battlecard: snapshot, where we win / where they win (evidence-backed), talk track, landmines to plant, landmines to avoid, objection one-liners, proof points. No trash-talk; maturity-model framing.",
  },
  "one-pager": {
    dir: "PLAYBOOKS-AND-ASSETS/sales-playbooks",
    brief:
      "Produce a sales one-pager: reader-first opening (their decision, their constraint), persona-matched outcomes, differentiated capability claims that survive the swap test, one proof point per claim, clear next step.",
  },
  "exec-brief": {
    dir: "PLAYBOOKS-AND-ASSETS/sales-playbooks",
    brief:
      "Produce an executive brief: lead with named metrics (win rate, pipeline, NRR), the decision being asked, options with a recommendation. One page maximum.",
  },
};

// Generate a draft asset. Drafts land in the war room with stage: draft
// frontmatter; nothing ships without approval (Master Instructions §8.4).
assetsRouter.post("/generate", async (req, res) => {
  const { type, product, audience } = req.body as {
    type?: string;
    product?: string;
    audience?: string;
  };
  const spec = ASSET_SPECS[type ?? ""];
  if (!spec) {
    return res
      .status(400)
      .json({ error: `type must be one of: ${Object.keys(ASSET_SPECS).join(", ")}` });
  }

  const corpus = loadCorpus("MARKET-INTELLIGENCE")
    .concat(loadCorpus("PLAYBOOKS-AND-ASSETS"))
    .map((d) => `<file path="GTM-War-Room/${d.relPath}">\n${d.content}\n</file>`)
    .join("\n\n");

  try {
    const body = await ask(
      `${spec.brief}\n\nProduct: ${product ?? "Masterworks"}\nAudience: ${audience ?? "public owners (government agencies)"}\n\nReturn only the asset content in Markdown, no preamble.`,
      { extraContext: corpus }
    );

    const guard = checkForbiddenWords(body);
    const slug = `${type}-${(product ?? "masterworks").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const relPath = `${spec.dir}/${slug}.md`;
    const frontmatter = [
      "---",
      `product: ${product ?? "Masterworks"}`,
      `audience: ${audience ?? "public owners"}`,
      "stage: draft",
      `date: ${new Date().toISOString().slice(0, 10)}`,
      "sources: generated from GTM-War-Room via PMM Agent",
      "---",
      "",
    ].join("\n");

    const abs = path.resolve(WAR_ROOM_DIR, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, frontmatter + body, "utf-8");

    void recordAsset({
      type: type!,
      product: product ?? "Masterworks",
      audience: audience ?? "public owners",
      warRoomPath: relPath,
      guardOk: guard.ok,
      guardViolations: guard.violations,
    });

    res.json({ path: relPath, stage: "draft", guard, content: body });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// List drafts awaiting the PMM admin's approval.
assetsRouter.get("/", (_req, res) => {
  const drafts = loadCorpus("PLAYBOOKS-AND-ASSETS")
    .filter((d) => /^---[\s\S]*?stage:\s*draft/m.test(d.content))
    .map((d) => ({ path: d.relPath, preview: d.content.slice(0, 300) }));
  res.json({ drafts });
});

// Approve: flip stage draft → final. The system proposes; the human decides.
assetsRouter.post("/approve", (req, res) => {
  const rel = String((req.body as { path?: string }).path ?? "");
  const abs = path.resolve(WAR_ROOM_DIR, rel);
  if (!abs.startsWith(WAR_ROOM_DIR) || !fs.existsSync(abs)) {
    return res.status(404).json({ error: "not found" });
  }
  const content = fs.readFileSync(abs, "utf-8");
  const guard = checkForbiddenWords(content);
  if (!guard.ok) {
    return res.status(422).json({
      error: "Draft contains banned words — fix before approval.",
      guard,
    });
  }
  fs.writeFileSync(abs, content.replace(/stage:\s*draft/, "stage: final"), "utf-8");
  void markAssetApproved(rel);
  res.json({ path: rel, stage: "final" });
});
