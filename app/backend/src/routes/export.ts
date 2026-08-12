import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { markdownToHtml } from "../services/html";
import { wrapExportHtml } from "../services/localFolders";
import { renderHtmlToPdf } from "../services/pdf";

// POST /api/export/pdf — turns a rendered artifact payload (studio/template
// preview) into a real downloadable PDF instead of the raw html/md file.
export const exportRouter = Router();

type ExportFormat = "html" | "deck" | "email" | "markdown";

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "artifact";
}

exportRouter.post("/pdf", requireAuth, async (req, res) => {
  const { format, payload, title, wrap } = req.body as {
    format?: ExportFormat;
    payload?: string;
    title?: string;
    /** true for a bare content fragment (e.g. artifact content_html from the
     *  freeform studio path) — needs the brand shell, unlike a Template
     *  Library "html" payload which already IS a complete document. */
    wrap?: boolean;
  };
  if (typeof payload !== "string" || payload.trim() === "") {
    return res.status(400).json({ error: "payload is required" });
  }
  if (format !== "html" && format !== "deck" && format !== "email" && format !== "markdown") {
    return res.status(400).json({ error: "svg is not exportable as a PDF" });
  }

  const html =
    format === "markdown"
      ? wrapExportHtml(title ?? "Artifact", markdownToHtml(payload), "Hive by Aurigo")
      : wrap
        ? wrapExportHtml(title ?? "Artifact", payload, "Hive by Aurigo")
        : payload; // Template Library html/deck/email payloads are already complete documents

  try {
    const pdf = await renderHtmlToPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slugify(title ?? "artifact")}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
