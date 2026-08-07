import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";

// Integrations & feature flags module. Everyone signed in can see the state;
// only admins (PMMs) can flip anything.
export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

// ---------- GET / — integrations + feature flags ----------
integrationsRouter.get("/", async (_req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const [intRes, flagRes] = await Promise.all([
    // sharepoint_credentials holds the Graph client secret — never list it here.
    sb.from("integrations")
      .select("id, kind, name, config, enabled, created_at")
      .neq("kind", "sharepoint_credentials")
      .order("name"),
    sb.from("feature_flags").select("key, enabled, note").order("key"),
  ]);
  if (intRes.error) return res.status(500).json({ error: intRes.error.message });
  if (flagRes.error) return res.status(500).json({ error: flagRes.error.message });

  res.json({ integrations: intRes.data ?? [], flags: flagRes.data ?? [] });
});

// ---------- POST /flags/:key/toggle ----------
integrationsRouter.post("/flags/:key/toggle", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const key = req.params.key;
  const { data: flag } = await sb
    .from("feature_flags")
    .select("key, enabled")
    .eq("key", key)
    .single();
  if (!flag) return res.status(404).json({ error: "Feature flag not found" });

  const enabled = !flag.enabled;
  const { error } = await sb.from("feature_flags").update({ enabled }).eq("key", key);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ key, enabled });
});

// ---------- POST /:id/toggle — flip an integration ----------
integrationsRouter.post("/:id/toggle", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { data: integ } = await sb
    .from("integrations")
    .select("id, kind, name, enabled")
    .eq("id", req.params.id)
    .single();
  if (!integ) return res.status(404).json({ error: "Integration not found" });

  const enabled = !integ.enabled;
  const { error } = await sb.from("integrations").update({ enabled }).eq("id", integ.id);
  if (error) return res.status(500).json({ error: error.message });

  await logActivity("integration", integ.id, req.user?.id ?? null, enabled ? "enabled" : "disabled", {
    name: integ.name,
    kind: integ.kind,
  });

  res.json({ id: integ.id, enabled });
});
