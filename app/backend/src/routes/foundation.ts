import { Router } from "express";
import { loadCorpus, readWarRoomFile } from "../services/warRoom";

export const foundationRouter = Router();

// The foundational doc = the structured war-room sections for a product.
foundationRouter.get("/", (_req, res) => {
  const sections = loadCorpus("BRAND-DNA").map((d) => ({
    path: d.relPath,
    title: d.relPath.replace("BRAND-DNA/", "").replace(".md", ""),
    preview: d.content.slice(0, 400),
  }));
  const context = ["about-me.md", "competitors.md", "personas.md", "strategy.md", "product-wiki.md"]
    .map((f) => ({ path: f, exists: readWarRoomFile(f) !== null }));
  res.json({ sections, context });
});

foundationRouter.get("/file", (req, res) => {
  const rel = String(req.query.path ?? "");
  const content = readWarRoomFile(rel);
  if (content === null) return res.status(404).json({ error: "not found" });
  res.json({ path: rel, content });
});
