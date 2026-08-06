import { Router } from "express";
import { isAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";

// Knowledge-base management: list ingested documents, preview chunks,
// enable/disable for AI features, delete. Admins manage everything;
// uploaders manage documents that came from their own uploads.
export const documentsRouter = Router();

async function canManage(req: Express.Request & { user?: { id: string; role: string } }, docId: string): Promise<boolean> {
  if (isAdmin(req as never)) return true;
  const sb = supabase()!;
  const { data } = await sb
    .from("documents")
    .select("created_by, uploads(uploader_id)")
    .eq("id", docId)
    .single();
  if (!data) return false;
  const uploaderId = (data as unknown as { uploads: { uploader_id: string } | null }).uploads
    ?.uploader_id;
  return data.created_by === req.user?.id || uploaderId === req.user?.id;
}

// GET /api/documents — list (admin: all; others: their own).
documentsRouter.get("/", requireAuth, async (req, res) => {
  const sb = supabase()!;
  let q = sb
    .from("documents")
    .select("id, title, filename, source, doc_type, ai_enabled, chunk_count, created_at, products(name), uploads(uploader_id)")
    .order("created_at", { ascending: false });
  const { source, doc_type, ai } = req.query as Record<string, string | undefined>;
  if (source) q = q.eq("source", source);
  if (doc_type) q = q.eq("doc_type", doc_type);
  if (ai === "enabled") q = q.eq("ai_enabled", true);
  if (ai === "disabled") q = q.eq("ai_enabled", false);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  const rows = (data ?? []).filter((d) => {
    if (isAdmin(req)) return true;
    const uploaderId = (d as unknown as { uploads: { uploader_id: string } | null }).uploads
      ?.uploader_id;
    return uploaderId === req.user!.id;
  });
  res.json({
    documents: rows.map((d) => ({
      id: d.id,
      title: d.title,
      filename: d.filename,
      source: d.source,
      docType: d.doc_type,
      aiEnabled: d.ai_enabled,
      chunkCount: d.chunk_count,
      createdAt: d.created_at,
      product: (d as unknown as { products: { name: string } | null }).products?.name ?? null,
    })),
  });
});

// GET /api/documents/:id/chunks — chunk preview.
documentsRouter.get("/:id/chunks", requireAuth, async (req, res) => {
  if (!(await canManage(req, req.params.id))) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const sb = supabase()!;
  const { data, error } = await sb
    .from("document_chunks")
    .select("chunk_index, heading, token_estimate, content")
    .eq("document_id", req.params.id)
    .order("chunk_index");
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    chunks: (data ?? []).map((c) => ({
      index: c.chunk_index,
      heading: c.heading,
      tokens: c.token_estimate,
      preview: c.content.slice(0, 400),
    })),
  });
});

// POST /api/documents/:id/toggle-ai — enable/disable for AI features.
documentsRouter.post("/:id/toggle-ai", requireAuth, async (req, res) => {
  if (!(await canManage(req, req.params.id))) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const sb = supabase()!;
  const { data: doc } = await sb.from("documents").select("ai_enabled").eq("id", req.params.id).single();
  if (!doc) return res.status(404).json({ error: "not found" });
  const { error } = await sb
    .from("documents")
    .update({ ai_enabled: !doc.ai_enabled, updated_at: new Date().toISOString() })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("document", req.params.id, req.user!.id, doc.ai_enabled ? "ai_disabled" : "ai_enabled");
  res.json({ aiEnabled: !doc.ai_enabled });
});

// DELETE /api/documents/:id — remove document + chunks (cascade).
documentsRouter.delete("/:id", requireAuth, async (req, res) => {
  if (!(await canManage(req, req.params.id))) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const sb = supabase()!;
  const { error } = await sb.from("documents").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("document", req.params.id, req.user!.id, "document_deleted");
  res.json({ ok: true });
});
