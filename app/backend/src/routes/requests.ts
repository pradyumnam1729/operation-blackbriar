import { Router } from "express";
import { requireAuth, isAdmin } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity, notify } from "../services/activity";

// Requests intake module: consumers file requests, PMMs (admins) triage them.
// File attachments are written by the uploads module (POST /api/uploads with
// request_id) — here we only read the uploads table.
export const requestsRouter = Router();
requestsRouter.use(requireAuth);

const REQUEST_TYPES = ["asset", "answer", "update", "other"] as const;
const STATUSES = ["open", "in_progress", "fulfilled", "closed"] as const;

const REQUEST_SELECT =
  "id, title, request_type, product_id, description, due_date, status, requester_id, created_at, updated_at, " +
  "product:products(id, name, line, module), requester:profiles!requests_requester_id_fkey(id, full_name, email)";

/** Shape returned by REQUEST_SELECT (the supabase type parser can't infer joined selects). */
interface RequestRecord {
  id: string;
  title: string;
  request_type: string;
  product_id: string | null;
  description: string | null;
  due_date: string | null;
  status: string;
  requester_id: string | null;
  created_at: string;
  updated_at: string;
  product: { id: string; name: string; line: string; module: string } | null;
  requester: { id: string; full_name: string | null; email: string } | null;
}

// ---------- list ----------
requestsRouter.get("/", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  let query = sb.from("requests").select(REQUEST_SELECT).order("created_at", { ascending: false });
  if (!isAdmin(req)) query = query.eq("requester_id", req.user!.id);

  const status = typeof req.query.status === "string" ? req.query.status : "";
  if (status) {
    if (!(STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    }
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ requests: data });
});

// ---------- create ----------
requestsRouter.post("/", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { title, request_type, product_id, description, due_date } = (req.body ?? {}) as {
    title?: string;
    request_type?: string;
    product_id?: string;
    description?: string;
    due_date?: string;
  };

  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  const type = request_type ?? "asset";
  if (!(REQUEST_TYPES as readonly string[]).includes(type)) {
    return res.status(400).json({ error: `request_type must be one of: ${REQUEST_TYPES.join(", ")}` });
  }

  const { data, error } = await sb
    .from("requests")
    .insert({
      title: title.trim(),
      request_type: type,
      product_id: product_id || null,
      description: description || null,
      due_date: due_date || null,
      requester_id: req.user!.id,
    })
    .select(REQUEST_SELECT)
    .single();
  if (error || !data) return res.status(500).json({ error: error?.message ?? "Insert failed" });
  const created = data as unknown as RequestRecord;

  void logActivity("request", created.id, req.user!.id, "request_created", {
    title: created.title,
    request_type: created.request_type,
  });

  // Notify every PMM (admin) about the new request.
  const { data: admins } = await sb.from("profiles").select("id").eq("role", "admin");
  for (const admin of admins ?? []) {
    if (admin.id === req.user!.id) continue;
    void notify(admin.id, "request_created", {
      entity_type: "request",
      entity_id: created.id,
      request_id: created.id,
      title: created.title,
      request_type: created.request_type,
      by: req.user!.fullName ?? req.user!.email,
      requester: req.user!.fullName ?? req.user!.email,
    });
  }

  res.status(201).json({ request: created });
});

// ---------- detail (incl. linked uploads + artifacts) ----------
requestsRouter.get("/:id", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { data, error } = await sb
    .from("requests")
    .select(REQUEST_SELECT)
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Request not found" });
  const request = data as unknown as RequestRecord;
  if (!isAdmin(req) && request.requester_id !== req.user!.id) {
    return res.status(403).json({ error: "You can only view your own requests" });
  }

  const [{ data: uploads }, { data: artifacts }] = await Promise.all([
    sb
      .from("uploads")
      .select("id, filename, file_type, size_bytes, created_at")
      .eq("request_id", request.id)
      .order("created_at", { ascending: false }),
    sb
      .from("artifacts")
      .select("id, title, status")
      .eq("request_id", request.id)
      .order("updated_at", { ascending: false }),
  ]);

  res.json({ request, uploads: uploads ?? [], artifacts: artifacts ?? [] });
});

// ---------- status change ----------
requestsRouter.post("/:id/status", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const status = (req.body ?? {}).status as string | undefined;
  if (!status || !(STATUSES as readonly string[]).includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }

  const { data: existing, error: fetchError } = await sb
    .from("requests")
    .select("id, title, status, requester_id")
    .eq("id", req.params.id)
    .maybeSingle();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!existing) return res.status(404).json({ error: "Request not found" });

  const isOwner = existing.requester_id === req.user!.id;
  const allowed = isAdmin(req) || (isOwner && status === "closed");
  if (!allowed) {
    return res.status(403).json({ error: "Only PMMs can change status (requesters may close their own requests)" });
  }

  const { data, error } = await sb
    .from("requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select(REQUEST_SELECT)
    .single();
  if (error || !data) return res.status(500).json({ error: error?.message ?? "Update failed" });

  void logActivity("request", existing.id, req.user!.id, "request_status_changed", {
    from: existing.status,
    to: status,
  });
  if (existing.requester_id && existing.requester_id !== req.user!.id) {
    void notify(existing.requester_id, "request_status_changed", {
      entity_type: "request",
      entity_id: existing.id,
      request_id: existing.id,
      title: existing.title,
      status,
      by: req.user!.fullName ?? req.user!.email,
      changed_by: req.user!.fullName ?? req.user!.email,
    });
  }

  res.json({ request: data });
});
