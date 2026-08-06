import { Router } from "express";
import { isAdmin, requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { MessagingDocError, approveMessagingDoc } from "../services/messagingDoc";

// Messaging & Positioning documents: the questionnaire pipeline's output.
// Every authenticated role can read finals (they are the unified system
// consumers pull from); drafts and approval stay admin-only (§8.4).
export const messagingDocsRouter = Router();

messagingDocsRouter.use(requireAuth);

const LIST_COLS = "id, version, status, title, created_at, approved_at, war_room_path, exported_path";

// ---------- 7. version list per product ----------
// GET /api/messaging-docs/:productId
messagingDocsRouter.get("/:productId", async (req, res) => {
  const sb = supabase()!;
  let query = sb
    .from("messaging_docs")
    .select(LIST_COLS)
    .eq("product_id", req.params.productId)
    .order("version", { ascending: false });
  // Consumers only ever see published history — never drafts.
  if (!isAdmin(req)) query = query.in("status", ["final", "archived"]);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ docs: data ?? [] });
});

// ---------- 8. full document ----------
// GET /api/messaging-docs/doc/:id
messagingDocsRouter.get("/doc/:id", async (req, res) => {
  const sb = supabase()!;
  const { data: doc, error } = await sb
    .from("messaging_docs")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!doc) return res.status(404).json({ error: "Messaging doc not found" });
  if (doc.status === "draft" && !isAdmin(req)) {
    return res
      .status(403)
      .json({ error: "This document is not finalized yet — only PMM admins can view drafts." });
  }
  res.json({ doc });
});

// ---------- 9. approve & publish (admin, guard-gated) ----------
// POST /api/messaging-docs/doc/:id/approve
messagingDocsRouter.post("/doc/:id/approve", requireAdmin, async (req, res) => {
  const sb = supabase()!;
  try {
    const result = await approveMessagingDoc(req.params.id, req.user!.id);
    const { data: doc } = await sb
      .from("messaging_docs")
      .select("*")
      .eq("id", req.params.id)
      .single();
    res.json({
      doc,
      warRoomPath: result.warRoomPath,
      exportedPath: result.exportedPath,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (err) {
    if (err instanceof MessagingDocError) {
      return res.status(err.status).json({
        error: err.message,
        ...(err.violations.length > 0 ? { violations: err.violations } : {}),
      });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});
