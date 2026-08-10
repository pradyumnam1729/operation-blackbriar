import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import {
  CUSTOM_AGENT_COLS,
  CustomAgentRow,
  invokeCustomAgent,
} from "../services/customAgents";

// Custom connected agents — registration and lifecycle. Mounted at
// /api/agents/custom BEFORE the main agents router so its /:key routes never
// swallow these. Admin-only, same posture as the rest of the Agents tab.
export const customAgentsRouter = Router();

customAgentsRouter.use(requireAuth, requireAdmin);

function slugKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `custom-${slug || "agent"}`;
}

/** Redact the token before anything leaves the API. */
function publicRow(row: CustomAgentRow) {
  const { auth_token, ...rest } = row;
  return { ...rest, has_auth_token: !!auth_token };
}

// POST /api/agents/custom — register a team's agent endpoint.
customAgentsRouter.post("/", async (req, res) => {
  const { name, description, endpoint_url, auth_token, timeout_ms, owner_team } =
    (req.body ?? {}) as {
      name?: string;
      description?: string;
      endpoint_url?: string;
      auth_token?: string;
      timeout_ms?: number;
      owner_team?: string;
    };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  if (!endpoint_url?.trim() || !/^https?:\/\//i.test(endpoint_url.trim())) {
    return res.status(400).json({ error: "endpoint_url must be a full http(s) URL" });
  }
  if (!description?.trim()) {
    return res.status(400).json({
      error:
        "description is required — the Ask agent uses it to decide when to delegate to this agent",
    });
  }
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const key = slugKey(name);
  const { data, error } = await sb
    .from("agents")
    .insert({
      key,
      kind: "custom",
      name: name.trim(),
      description: description.trim(),
      endpoint_url: endpoint_url.trim(),
      auth_token: auth_token?.trim() || null,
      timeout_ms:
        Number.isFinite(Number(timeout_ms)) && Number(timeout_ms) > 0
          ? Math.min(120_000, Number(timeout_ms))
          : 20_000,
      owner_team: owner_team?.trim() || null,
      updated_by: req.user!.id,
    })
    .select(CUSTOM_AGENT_COLS)
    .single();
  if (error) {
    const msg = error.message.includes("duplicate")
      ? `An agent named "${name.trim()}" already exists (key ${key}). Rename it or delete the old one.`
      : error.message;
    return res.status(400).json({ error: msg });
  }
  void logActivity("agent", data.id, req.user!.id, "custom_agent_registered", {
    key,
    endpoint_host: new URL(endpoint_url.trim()).host,
  });
  res.json({ agent: publicRow(data as CustomAgentRow) });
});

// PUT /api/agents/custom/:key — update config / enable / disable.
customAgentsRouter.put("/:key", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { data: existing } = await sb
    .from("agents")
    .select(CUSTOM_AGENT_COLS)
    .eq("key", req.params.key)
    .eq("kind", "custom")
    .maybeSingle();
  if (!existing) return res.status(404).json({ error: "Unknown custom agent" });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_by: req.user!.id, updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.name === "string" && body.name.trim() !== "") patch.name = body.name.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.endpoint_url === "string") {
    if (!/^https?:\/\//i.test(body.endpoint_url.trim()))
      return res.status(400).json({ error: "endpoint_url must be a full http(s) URL" });
    patch.endpoint_url = body.endpoint_url.trim();
  }
  if (typeof body.auth_token === "string")
    patch.auth_token = body.auth_token.trim() === "" ? null : body.auth_token.trim();
  if (body.timeout_ms !== undefined && Number.isFinite(Number(body.timeout_ms)))
    patch.timeout_ms = Math.min(120_000, Math.max(1000, Number(body.timeout_ms)));

  const { data, error } = await sb
    .from("agents")
    .update(patch)
    .eq("key", req.params.key)
    .eq("kind", "custom")
    .select(CUSTOM_AGENT_COLS)
    .single();
  if (error || !data) return res.status(500).json({ error: error?.message ?? "Update failed" });
  void logActivity("agent", data.id, req.user!.id, "custom_agent_updated", {
    key: req.params.key,
    fields: Object.keys(patch).filter((k) => k !== "updated_by" && k !== "updated_at"),
  });
  res.json({ agent: publicRow(data as CustomAgentRow) });
});

// DELETE /api/agents/custom/:key — remove a custom agent (custom only; the
// built-in registry cannot be deleted).
customAgentsRouter.delete("/:key", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { data, error } = await sb
    .from("agents")
    .delete()
    .eq("key", req.params.key)
    .eq("kind", "custom")
    .select("id, name")
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Unknown custom agent" });
  void logActivity("agent", data.id, req.user!.id, "custom_agent_deleted", {
    key: req.params.key,
    name: data.name,
  });
  res.json({ ok: true });
});

// POST /api/agents/custom/:key/invoke — test the connection live.
customAgentsRouter.post("/:key/invoke", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { data: agent } = await sb
    .from("agents")
    .select(CUSTOM_AGENT_COLS)
    .eq("key", req.params.key)
    .eq("kind", "custom")
    .maybeSingle();
  if (!agent) return res.status(404).json({ error: "Unknown custom agent" });

  const { input } = (req.body ?? {}) as { input?: string };
  try {
    const r = await invokeCustomAgent(
      agent as CustomAgentRow,
      input?.trim() || "Connection test from Hive. Reply with a short confirmation.",
      null
    );
    void logActivity("agent", (agent as CustomAgentRow).id, req.user!.id, "custom_agent_tested", {
      key: req.params.key,
      latency_ms: r.latencyMs,
    });
    res.json({ output: r.output, latency_ms: r.latencyMs });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
