import { Router } from "express";
import fs from "fs";
import path from "path";
import { isAdmin, requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity, notify } from "../services/activity";
import { markdownToHtml } from "../services/html";
import { ingestDocument } from "../services/ingestion";
import { getLocalFolders, wrapExportHtml } from "../services/localFolders";
import { PMM_PART_NAMES, PMM_STEPS, PmmAnswers, pmmProgress, pmmToMarkdown } from "../pmm/steps";

// PMM Workspace: Positioning & Messaging documents with a Director approval
// workflow. Admin-only module (PMMs are admins); the "Director" is any admin
// reviewing a doc they didn't submit (demo-grade role split).
export const pmmRouter = Router();

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Pending approval",
  changes: "Changes requested",
  approved: "Approved",
};

// GET /api/pmm/steps — the shared question set for the wizard.
pmmRouter.get("/steps", requireAuth, (_req, res) => {
  res.json({ steps: PMM_STEPS, partNames: PMM_PART_NAMES });
});

// GET /api/pmm — list with optional ?status= filter.
pmmRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  let q = sb
    .from("pmm_docs")
    .select("id, title, product, status, answers, updated_at, owner:profiles!pmm_docs_owner_id_fkey(full_name)")
    .order("updated_at", { ascending: false });
  const { status } = req.query as { status?: string };
  if (status && status in STATUS_LABEL) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    docs: (data ?? []).map((d) => {
      const progress = pmmProgress((d.answers as PmmAnswers) ?? {});
      return {
        id: d.id,
        title: d.title,
        product: d.product,
        status: d.status,
        updatedAt: d.updated_at,
        owner: (d as unknown as { owner: { full_name: string } | null }).owner?.full_name ?? null,
        progress,
      };
    }),
  });
});

// POST /api/pmm — create a draft (wizard setup step).
pmmRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { title, product } = req.body as { title?: string; product?: string };
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  if (!product || !["Masterworks", "Primus", "Lumina"].includes(product)) {
    return res.status(400).json({ error: "product must be Masterworks, Primus, or Lumina" });
  }
  const sb = supabase()!;
  const { data, error } = await sb
    .from("pmm_docs")
    .insert({ title: title.trim(), product, owner_id: req.user!.id, answers: {} })
    .select("id")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("pmm_doc", data.id, req.user!.id, "pmm_doc_created", { title, product });
  res.json({ id: data.id });
});

interface DocRow {
  id: string;
  title: string;
  product: string;
  status: string;
  answers: unknown;
  owner_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  last_edited_at: string | null;
  kb_document_id: string | null;
  created_at: string;
  updated_at: string;
  owner: { full_name: string } | null;
  approver: { full_name: string } | null;
  editor: { full_name: string } | null;
}

async function fetchDoc(id: string): Promise<DocRow | null> {
  const sb = supabase()!;
  const { data } = await sb
    .from("pmm_docs")
    .select(
      "id, title, product, status, answers, owner_id, submitted_at, approved_at, last_edited_at, kb_document_id, created_at, updated_at, " +
        "owner:profiles!pmm_docs_owner_id_fkey(full_name), " +
        "approver:profiles!pmm_docs_approved_by_fkey(full_name), " +
        "editor:profiles!pmm_docs_last_edited_by_fkey(full_name)"
    )
    .eq("id", id)
    .single();
  return data as unknown as DocRow | null;
}

// GET /api/pmm/:id — full doc: answers + rendered HTML + comments + files.
pmmRouter.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const d = await fetchDoc(req.params.id);
  if (!d) return res.status(404).json({ error: "Document not found" });
  const { data: comments } = await sb
    .from("pmm_doc_comments")
    .select("id, role_label, body, created_at, author:profiles!pmm_doc_comments_author_id_fkey(full_name)")
    .eq("doc_id", d.id)
    .order("created_at");
  const { data: files } = await sb
    .from("uploads")
    .select("id, filename, created_at")
    .eq("pmm_doc_id", d.id);
  const md = pmmToMarkdown(d.title, d.product, STATUS_LABEL[d.status], (d.answers as PmmAnswers) ?? {});
  res.json({
    doc: {
      id: d.id,
      title: d.title,
      product: d.product,
      status: d.status,
      answers: d.answers,
      ownerId: d.owner_id,
      owner: d.owner?.full_name ?? null,
      approvedBy: d.approver?.full_name ?? null,
      approvedAt: d.approved_at,
      lastEditedBy: d.editor?.full_name ?? null,
      lastEditedAt: d.last_edited_at,
      updatedAt: d.updated_at,
      progress: pmmProgress((d.answers as PmmAnswers) ?? {}),
      renderedHtml: markdownToHtml(md),
      comments: (comments ?? []).map((c) => ({
        id: c.id,
        who:
          (c as unknown as { author: { full_name: string } | null }).author?.full_name ??
          c.role_label,
        roleLabel: c.role_label,
        body: c.body,
        createdAt: c.created_at,
      })),
      files: files ?? [],
    },
  });
});

// PUT /api/pmm/:id/answers — autosave from the wizard (draft/changes; approved = admin edit).
pmmRouter.put("/:id/answers", requireAuth, requireAdmin, async (req, res) => {
  const { answers, title } = req.body as { answers?: PmmAnswers; title?: string };
  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "answers object is required" });
  }
  const sb = supabase()!;
  const d = await fetchDoc(req.params.id);
  if (!d) return res.status(404).json({ error: "Document not found" });
  if (d.status === "pending") {
    return res.status(409).json({ error: "Document is pending approval — approve or request changes first" });
  }
  const patch: Record<string, unknown> = {
    answers,
    updated_at: new Date().toISOString(),
  };
  if (title?.trim()) patch.title = title.trim();
  if (d.status === "approved") {
    patch.last_edited_by = req.user!.id;
    patch.last_edited_at = new Date().toISOString();
  }
  const { error } = await sb.from("pmm_docs").update(patch).eq("id", d.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, progress: pmmProgress(answers) });
});

// POST /api/pmm/:id/submit — draft/changes → pending.
pmmRouter.post("/:id/submit", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const d = await fetchDoc(req.params.id);
  if (!d) return res.status(404).json({ error: "Document not found" });
  if (d.status !== "draft" && d.status !== "changes") {
    return res.status(409).json({ error: `Cannot submit a document in status '${d.status}'` });
  }
  const { error } = await sb
    .from("pmm_docs")
    .update({
      status: "pending",
      submitted_by: req.user!.id,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", d.id);
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("pmm_doc", d.id, req.user!.id, "pmm_doc_submitted", { title: d.title });
  // Notify the other admins (the "Director" pool).
  const { data: admins } = await sb.from("profiles").select("id").eq("role", "admin");
  for (const a of admins ?? []) {
    if (a.id !== req.user!.id) {
      void notify(a.id, "pmm_doc_pending", { doc_id: d.id, title: d.title, by: req.user!.fullName });
    }
  }
  res.json({ ok: true });
});

// POST /api/pmm/:id/approve — Director approval. Ingests into the knowledge
// base (approved positioning becomes ground truth) and exports to Output.
pmmRouter.post("/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const d = await fetchDoc(req.params.id);
  if (!d) return res.status(404).json({ error: "Document not found" });
  if (d.status !== "pending") {
    return res.status(409).json({ error: `Only pending documents can be approved (status: '${d.status}')` });
  }
  const { error } = await sb
    .from("pmm_docs")
    .update({
      status: "approved",
      approved_by: req.user!.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", d.id);
  if (error) return res.status(500).json({ error: error.message });

  const md = pmmToMarkdown(d.title, d.product, "Approved", (d.answers as PmmAnswers) ?? {});
  const notes: string[] = [];

  // Knowledge base: replace any prior ingest of this doc, then chunk the new one.
  try {
    if (d.kb_document_id) await sb.from("documents").delete().eq("id", d.kb_document_id);
    const ingest = await ingestDocument({
      title: `${d.title} (approved P&M)`,
      filename: null as unknown as string | undefined,
      text: md,
      source: "manual",
      docType: "other",
      productName: d.product,
      createdBy: req.user!.id,
      aiEnabled: true,
    });
    await sb.from("pmm_docs").update({ kb_document_id: ingest.documentId }).eq("id", d.id);
    notes.push(`ingested into knowledge base (${ingest.chunkCount} chunks, AI-enabled)`);
  } catch (err) {
    notes.push(`knowledge-base ingest failed: ${(err as Error).message}`);
  }

  // Output folder export (when local folders are configured).
  try {
    const lf = await getLocalFolders();
    if (lf?.config.outputPath) {
      fs.mkdirSync(lf.config.outputPath, { recursive: true });
      const slug = d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
      const html = wrapExportHtml(
        d.title,
        markdownToHtml(md),
        `${d.product} · Positioning & Messaging · approved ${new Date().toISOString().slice(0, 10)} · Hive by Aurigo`
      );
      fs.writeFileSync(path.join(lf.config.outputPath, `${slug || d.id}.html`), html, "utf-8");
      notes.push("exported to Output folder");
    }
  } catch (err) {
    notes.push(`Output export failed: ${(err as Error).message}`);
  }

  void logActivity("pmm_doc", d.id, req.user!.id, "pmm_doc_approved", { title: d.title, notes });
  if (d.owner_id && d.owner_id !== req.user!.id) {
    void notify(d.owner_id, "pmm_doc_approved", { doc_id: d.id, title: d.title });
  }
  res.json({ ok: true, notes });
});

// POST /api/pmm/:id/request-changes — comment required.
pmmRouter.post("/:id/request-changes", requireAuth, requireAdmin, async (req, res) => {
  const { comment } = req.body as { comment?: string };
  if (!comment?.trim()) {
    return res.status(400).json({ error: "Add a comment describing what needs to change." });
  }
  const sb = supabase()!;
  const d = await fetchDoc(req.params.id);
  if (!d) return res.status(404).json({ error: "Document not found" });
  if (d.status !== "pending") {
    return res.status(409).json({ error: `Only pending documents can get change requests (status: '${d.status}')` });
  }
  await sb.from("pmm_doc_comments").insert({
    doc_id: d.id,
    author_id: req.user!.id,
    role_label: "Director of PMM",
    body: comment.trim(),
  });
  const { error } = await sb
    .from("pmm_docs")
    .update({ status: "changes", updated_at: new Date().toISOString() })
    .eq("id", d.id);
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("pmm_doc", d.id, req.user!.id, "pmm_doc_changes_requested", { title: d.title });
  if (d.owner_id && d.owner_id !== req.user!.id) {
    void notify(d.owner_id, "pmm_doc_changes", { doc_id: d.id, title: d.title, comment: comment.trim() });
  }
  res.json({ ok: true });
});

// GET /api/pmm/:id/markdown — Copy-as-Markdown payload.
pmmRouter.get("/:id/markdown", requireAuth, requireAdmin, async (req, res) => {
  const d = await fetchDoc(req.params.id);
  if (!d) return res.status(404).json({ error: "Document not found" });
  res.json({
    markdown: pmmToMarkdown(d.title, d.product, STATUS_LABEL[d.status], (d.answers as PmmAnswers) ?? {}),
  });
});

// DELETE /api/pmm/:id — drafts only.
pmmRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const d = await fetchDoc(req.params.id);
  if (!d) return res.status(404).json({ error: "Document not found" });
  if (d.status !== "draft") {
    return res.status(409).json({ error: "Only drafts can be deleted" });
  }
  if (!isAdmin(req) && d.owner_id !== req.user!.id) {
    return res.status(403).json({ error: "Not your draft" });
  }
  const { error } = await sb.from("pmm_docs").delete().eq("id", d.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
