import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { logActivity } from "../services/activity";
import {
  exportFinals,
  getLocalFolders,
  saveLocalFolders,
  scanInput,
  setLocalFoldersEnabled,
} from "../services/localFolders";

export const localFoldersRouter = Router();

// GET /api/local-folders — current configuration + status.
localFoldersRouter.get("/", requireAuth, async (_req, res) => {
  const row = await getLocalFolders();
  if (!row) return res.json({ configured: false });
  const c = row.config;
  res.json({
    configured: true,
    enabled: row.enabled,
    inputPath: c.inputPath,
    outputPath: c.outputPath,
    docType: c.docType,
    productLine: c.productLine ?? null,
    lastScan: c.lastScan ?? null,
    lastScanResult: c.lastScanResult ?? null,
    lastIngest: c.lastIngest ?? null,
    lastIngestResult: c.lastIngestResult ?? null,
    lastExport: c.lastExport ?? null,
    lastExportResult: c.lastExportResult ?? null,
  });
});

// PUT /api/local-folders — save the folder pair (admin). Creates the folders.
localFoldersRouter.put("/", requireAuth, requireAdmin, async (req, res) => {
  const { inputPath, outputPath, docType, productLine } = req.body as {
    inputPath?: string;
    outputPath?: string;
    docType?: string;
    productLine?: string;
  };
  if (!inputPath?.trim() || !outputPath?.trim()) {
    return res.status(400).json({ error: "inputPath and outputPath are required" });
  }
  if (inputPath.trim() === outputPath.trim()) {
    return res.status(400).json({ error: "Input and Output must be different folders" });
  }
  try {
    await saveLocalFolders({
      inputPath: inputPath.trim(),
      outputPath: outputPath.trim(),
      docType: docType ?? "release_note",
      productLine: productLine ?? null,
    });
    void logActivity("integration", "00000000-0000-0000-0000-000000000000", req.user!.id, "local_folders_saved", {
      inputPath,
      outputPath,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/local-folders/toggle — pause/resume the input watcher (admin).
localFoldersRouter.post("/toggle", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const row = await getLocalFolders();
    if (!row) return res.status(400).json({ error: "Local folders are not configured yet." });
    await setLocalFoldersEnabled(!row.enabled);
    res.json({ enabled: !row.enabled });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/local-folders/scan — ingest new/changed Input files now (admin).
localFoldersRouter.post("/scan", requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json({ log: await scanInput() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/local-folders/export — write all final artifacts to Output (admin).
localFoldersRouter.post("/export", requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json({ log: await exportFinals() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
