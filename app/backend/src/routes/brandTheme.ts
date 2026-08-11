import { Router } from "express";
import fs from "fs";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { DECK_THEME } from "../services/deckTheme";

// The corporate PPT theme surface: AURIGO_PPT_TEMPLATE_2026.pptx (repo root)
// governs every generated deck and .pptx export. This exposes it to the
// Template library — theme metadata for the Brand theme card and the source
// file itself for download. Mounted at /api/templates/brand-theme BEFORE the
// templates router so its /:id never swallows these.
export const brandThemeRouter = Router();

brandThemeRouter.use(requireAuth);

export const TEMPLATE_PPTX_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "AURIGO_PPT_TEMPLATE_2026.pptx"
);

const LAYOUTS = [
  { key: "title", label: "Title", dark: true },
  { key: "agenda", label: "Agenda", dark: false },
  { key: "section", label: "Section separator", dark: true },
  { key: "content-bullets", label: "Content bullets", dark: false },
  { key: "two-column", label: "Two column", dark: false },
  { key: "quote", label: "Proof / quote", dark: true },
  { key: "closing", label: "Closing", dark: true },
];

// GET /api/templates/brand-theme — palette, fonts, layouts, source metadata.
brandThemeRouter.get("/", (_req, res) => {
  let sizeBytes: number | null = null;
  try {
    sizeBytes = fs.statSync(TEMPLATE_PPTX_PATH).size;
  } catch {
    sizeBytes = null;
  }
  res.json({
    source: DECK_THEME.source,
    extracted: DECK_THEME.extracted,
    available: sizeBytes !== null,
    sizeBytes,
    colors: DECK_THEME.colors,
    fonts: DECK_THEME.fonts,
    slide: DECK_THEME.slide,
    layouts: LAYOUTS,
  });
});

// GET /api/templates/brand-theme/download — the source .pptx itself.
brandThemeRouter.get("/download", (_req, res) => {
  if (!fs.existsSync(TEMPLATE_PPTX_PATH)) {
    return res.status(404).json({ error: "The template file is not present on this server." });
  }
  res
    .setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
    .setHeader("Content-Disposition", `attachment; filename="${DECK_THEME.source}"`);
  fs.createReadStream(TEMPLATE_PPTX_PATH).pipe(res);
});
