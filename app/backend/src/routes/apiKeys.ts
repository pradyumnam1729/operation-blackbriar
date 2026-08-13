import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import { API_SCOPES, ApiScope, generateApiKey, isValidScopeSet } from "../services/apiKeys";

// Admin key management (blueprint open-api.md §2.3). This lives in the
// Supabase-JWT domain: issuing credentials that bypass user auth is the tightest
// boundary in the app (vol-3 08). Every endpoint is requireAuth + requireAdmin.
// Plaintext is returned ONLY in the 201 create response; activity_log detail
// carries key_prefix, NEVER the key or hash.
export const apiKeysRouter = Router();

apiKeysRouter.use(requireAuth, requireAdmin);

// Columns safe to echo back — never key_hash, never plaintext.
const ROW_COLS =
  "id, name, team, key_prefix, scopes, enabled, created_at, last_used_at, created_by";

interface KeyRow {
  id: string;
  name: string;
  team: string;
  key_prefix: string;
  scopes: string[];
  enabled: boolean;
  created_at: string;
  last_used_at: string | null;
  created_by: string | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
}

/** Flatten the profiles(full_name) join into created_by_name; drop created_by
 *  (a user id — never exposed). */
function toSummary(row: KeyRow) {
  const { profiles, created_by, ...rest } = row;
  const joined = Array.isArray(profiles) ? profiles[0] : profiles;
  return { ...rest, created_by_name: joined?.full_name ?? null };
}

// ---------- 1. list ----------
// GET /api/api-keys → { keys: [...] } newest first
apiKeysRouter.get("/", async (_req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("api_keys")
    .select(`${ROW_COLS}, profiles:created_by(full_name)`)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ keys: ((data ?? []) as KeyRow[]).map(toSummary) });
});

// ---------- 2. create (the ONLY response carrying plaintext) ----------
// POST /api/api-keys { name, team?, scopes: string[] }
apiKeysRouter.post("/", async (req, res) => {
  const sb = supabase()!;
  const { name, team, scopes } = req.body as {
    name?: string;
    team?: string;
    scopes?: unknown;
  };
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "name is required" });
  }
  if (!isValidScopeSet(scopes)) {
    return res
      .status(400)
      .json({ error: `scopes must be a non-empty subset of: ${API_SCOPES.join(", ")}` });
  }
  const uniqueScopes = [...new Set(scopes)] as ApiScope[];

  const { plaintext, hash, prefix } = generateApiKey();
  const { data, error } = await sb
    .from("api_keys")
    .insert({
      name: name.trim(),
      team: team?.trim() || "",
      key_prefix: prefix,
      key_hash: hash,
      scopes: uniqueScopes,
      created_by: req.user!.id,
    })
    .select(ROW_COLS)
    .single();
  if (error || !data) {
    return res.status(500).json({ error: error?.message ?? "Insert failed" });
  }

  // Detail carries the prefix — NEVER the key or hash.
  void logActivity("api_key", data.id, req.user!.id, "api_key_created", {
    name: data.name,
    team: data.team,
    scopes: uniqueScopes,
    key_prefix: prefix,
  });

  res.status(201).json({ key: toSummary(data as KeyRow), plaintext_key: plaintext });
});

// ---------- 3. toggle enabled (revoke / re-enable) ----------
// POST /api/api-keys/:id/toggle → { key }
apiKeysRouter.post("/:id/toggle", async (req, res) => {
  const sb = supabase()!;
  const { data: current, error: fErr } = await sb
    .from("api_keys")
    .select("id, name, enabled, key_prefix")
    .eq("id", req.params.id)
    .maybeSingle();
  if (fErr) return res.status(500).json({ error: fErr.message });
  if (!current) return res.status(404).json({ error: "API key not found" });

  const enabled = !current.enabled;
  const { data, error } = await sb
    .from("api_keys")
    .update({ enabled })
    .eq("id", req.params.id)
    .select(`${ROW_COLS}, profiles:created_by(full_name)`)
    .single();
  if (error || !data) return res.status(500).json({ error: error?.message ?? "Update failed" });

  void logActivity(
    "api_key",
    current.id,
    req.user!.id,
    enabled ? "api_key_enabled" : "api_key_revoked",
    { name: current.name, key_prefix: current.key_prefix }
  );
  res.json({ key: toSummary(data as KeyRow) });
});

// ---------- 4. delete (hard revoke; request-log rows cascade) ----------
// DELETE /api/api-keys/:id → { ok: true }
apiKeysRouter.delete("/:id", async (req, res) => {
  const sb = supabase()!;
  const { data: current, error: fErr } = await sb
    .from("api_keys")
    .select("id, name, key_prefix")
    .eq("id", req.params.id)
    .maybeSingle();
  if (fErr) return res.status(500).json({ error: fErr.message });
  if (!current) return res.status(404).json({ error: "API key not found" });

  const { error } = await sb.from("api_keys").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  void logActivity("api_key", current.id, req.user!.id, "api_key_deleted", {
    name: current.name,
    key_prefix: current.key_prefix,
  });
  res.json({ ok: true });
});

// ---------- 5. usage (drawer usage panel) ----------
// GET /api/api-keys/:id/usage?limit= (default 50, max 200) → { requests: [...] }
apiKeysRouter.get("/:id/usage", async (req, res) => {
  const sb = supabase()!;
  const { data: current, error: fErr } = await sb
    .from("api_keys")
    .select("id")
    .eq("id", req.params.id)
    .maybeSingle();
  if (fErr) return res.status(500).json({ error: fErr.message });
  if (!current) return res.status(404).json({ error: "API key not found" });

  const raw = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 200) : 50;

  const { data, error } = await sb
    .from("api_request_log")
    .select("method, path, status, duration_ms, created_at")
    .eq("key_id", req.params.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ requests: data ?? [] });
});
