import { Router } from "express";
import fs from "fs";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { extractText } from "../services/extract";
import { markdownToHtml } from "../services/html";
import { wrapExportHtml } from "../services/localFolders";
import { REPO_ROOT } from "../services/warRoom";

// Finalized-assets reference library: read-only browsing of the curated
// reference outputs folder. Files are viewed inline (PDF/video natively;
// docx/xlsx/pptx via extracted, brand-styled HTML) and exported to PDF —
// real PDFs download as-is, everything else opens a print-ready HTML view
// (?print=1) that the browser saves as PDF.
export const referenceAssetsRouter = Router();

const BASE_DIR = path.resolve(REPO_ROOT, "reference output", "Output");

const PREVIEWABLE = [".pdf", ".docx", ".txt", ".md", ".csv", ".xlsx", ".xls", ".pptx", ".vtt", ".srt"];
const VIDEO = [".mp4", ".mov"];

interface RefAsset {
  path: string; // relative, forward slashes — the API handle
  name: string;
  group: string; // top-level folder ("GTM", "Masterworks AI", ...)
  subgroup: string | null; // nested folder ("Datasheets", "Decks", ...)
  ext: string;
  kind: "document" | "video" | "other";
  sizeBytes: number;
  modified: string;
}

function walk(dir: string, rel: string, out: RefAsset[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(abs, childRel, out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    const stat = fs.statSync(abs);
    const parts = childRel.split("/");
    out.push({
      path: childRel,
      name: entry.name,
      group: parts.length > 1 ? parts[0] : "General",
      subgroup: parts.length > 2 ? parts[1] : null,
      ext,
      kind: VIDEO.includes(ext) ? "video" : PREVIEWABLE.includes(ext) ? "document" : "other",
      sizeBytes: stat.size,
      modified: stat.mtime.toISOString(),
    });
  }
}

/** Resolve a client-supplied relative path inside BASE_DIR — traversal-proof. */
function resolveSafe(rel: string): string | null {
  const abs = path.resolve(BASE_DIR, rel);
  if (!abs.startsWith(BASE_DIR + path.sep)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}

// GET /api/reference-assets — the full library listing.
referenceAssetsRouter.get("/", requireAuth, (_req, res) => {
  if (!fs.existsSync(BASE_DIR)) {
    return res.json({ assets: [], baseDir: BASE_DIR, missing: true });
  }
  const assets: RefAsset[] = [];
  walk(BASE_DIR, "", assets);
  assets.sort((a, b) => a.group.localeCompare(b.group) || a.path.localeCompare(b.path));
  res.json({ assets });
});

// GET /api/reference-assets/file?path=... — raw file (PDF renders inline,
// video streams, office formats download).
referenceAssetsRouter.get("/file", requireAuth, (req, res) => {
  const abs = resolveSafe(String(req.query.path ?? ""));
  if (!abs) return res.status(404).json({ error: "File not found" });
  res.sendFile(abs);
});

// GET /api/reference-assets/preview?path=...&print=1 — extracted content as a
// brand-styled standalone HTML page; print=1 auto-opens the print dialog so
// the browser's Save-as-PDF becomes the export path for non-PDF formats.
referenceAssetsRouter.get("/preview", requireAuth, async (req, res) => {
  const rel = String(req.query.path ?? "");
  const abs = resolveSafe(rel);
  if (!abs) return res.status(404).json({ error: "File not found" });
  const ext = path.extname(abs).toLowerCase();
  if (!PREVIEWABLE.includes(ext) || ext === ".pdf") {
    return res.status(400).json({ error: "No HTML preview for this file type — use /file" });
  }
  try {
    const { status, text } = await extractText(abs);
    if (status !== "done" || text.trim() === "") {
      return res.status(422).json({ error: `Extraction ${status} — nothing to preview` });
    }
    const name = path.basename(abs);
    let html = wrapExportHtml(
      name,
      `<h1>${name}</h1>\n${markdownToHtml(text)}`,
      `Reference output · ${rel} · Hive by Aurigo`
    );
    if (String(req.query.print ?? "") === "1") {
      html = html.replace("</body>", "<script>window.addEventListener('load',()=>window.print())</script></body>");
    }
    res.type("html").send(html);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
