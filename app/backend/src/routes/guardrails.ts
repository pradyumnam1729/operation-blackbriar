import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import { invalidateGuardrailCache, promptSuggestions } from "../services/guardrailFiles";

// Guardrails: admin-editable grounding files behind every AI output.
export const guardrailsRouter = Router();

// GET /api/guardrails — list (admin sees content; used by the admin page).
guardrailsRouter.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("guardrail_files")
    .select("id, name, description, content_md, active, sort, updated_at, editor:profiles!guardrail_files_updated_by_fkey(full_name)")
    .order("sort");
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    files: (data ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      content: f.content_md,
      active: f.active,
      sort: f.sort,
      updatedAt: f.updated_at,
      updatedBy:
        (f as unknown as { editor: { full_name: string } | null }).editor?.full_name ?? null,
    })),
  });
});

// GET /api/guardrails/prompts — parsed Prompt-library suggestions (any role).
guardrailsRouter.get("/prompts", requireAuth, async (_req, res) => {
  res.json({ suggestions: await promptSuggestions() });
});

// POST /api/guardrails — new file (admin).
guardrailsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, description, content } = req.body as {
    name?: string;
    description?: string;
    content?: string;
  };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const sb = supabase()!;
  const { data, error } = await sb
    .from("guardrail_files")
    .insert({
      name: name.trim(),
      description: description?.trim() || "Custom guardrail file.",
      content_md: content ?? "",
      updated_by: req.user!.id,
    })
    .select("id")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  invalidateGuardrailCache();
  void logActivity("guardrail", data.id, req.user!.id, "guardrail_created", { name });
  res.json({ id: data.id });
});

// PUT /api/guardrails/:id — edit (admin).
guardrailsRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { name, description, content, active } = req.body as {
    name?: string;
    description?: string;
    content?: string;
    active?: boolean;
  };
  const sb = supabase()!;
  const patch: Record<string, unknown> = {
    updated_by: req.user!.id,
    updated_at: new Date().toISOString(),
  };
  if (name?.trim()) patch.name = name.trim();
  if (description !== undefined) patch.description = description;
  if (content !== undefined) patch.content_md = content;
  if (active !== undefined) patch.active = active;
  const { error } = await sb.from("guardrail_files").update(patch).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  invalidateGuardrailCache();
  void logActivity("guardrail", req.params.id, req.user!.id, "guardrail_updated", {});
  res.json({ ok: true });
});

// DELETE /api/guardrails/:id — admin.
guardrailsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const { error } = await sb.from("guardrail_files").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  invalidateGuardrailCache();
  res.json({ ok: true });
});
