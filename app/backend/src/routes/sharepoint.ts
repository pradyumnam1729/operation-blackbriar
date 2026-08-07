import { Router } from "express";
import { isAdmin, requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import {
  getGraphCreds,
  invalidateGraphCreds,
  listChildren,
  resolveSite,
  syncIntegration,
} from "../services/sharepoint";

// Admin surface for the Microsoft Graph SharePoint connector.
export const sharepointRouter = Router();

// GET /api/sharepoint/status — credential + flag state for the UI.
sharepointRouter.get("/status", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data: flag } = await sb
    .from("feature_flags")
    .select("enabled")
    .eq("key", "sharepoint_graph")
    .single();
  const { data: connections } = await sb
    .from("integrations")
    .select("id, name, config, enabled")
    .eq("kind", "sharepoint_graph")
    .order("created_at");
  const creds = await getGraphCreds();
  res.json({
    configured: creds !== null,
    // Connector config is admin-only; everyone else just sees the boolean.
    credentials:
      creds && isAdmin(req)
        ? { source: creds.source, tenantId: creds.tenantId, clientId: creds.clientId }
        : null,
    flagEnabled: flag?.enabled ?? false,
    requiredPermission: "Sites.Read.All (application, admin-consented)",
    connections: (connections ?? []).map((c) => {
      const cfg = c.config as {
        siteUrl?: string;
        folderPath?: string;
        doc_type?: string;
        product_line?: string;
        lastSync?: string;
        lastResult?: string;
      };
      return {
        id: c.id,
        name: c.name,
        enabled: c.enabled,
        siteUrl: cfg.siteUrl,
        folderPath: cfg.folderPath,
        docType: cfg.doc_type,
        productLine: cfg.product_line,
        lastSync: cfg.lastSync ?? null,
        lastResult: cfg.lastResult ?? null,
      };
    }),
  });
});

// PUT /api/sharepoint/credentials — save Graph credentials from the UI (admin).
sharepointRouter.put("/credentials", requireAuth, requireAdmin, async (req, res) => {
  const { tenantId, clientId, clientSecret } = req.body as {
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  };
  if (!tenantId?.trim() || !clientId?.trim() || !clientSecret?.trim()) {
    return res.status(400).json({ error: "tenantId, clientId, and clientSecret are required" });
  }
  const sb = supabase()!;
  // Oldest row wins; retried/concurrent saves update it and stray duplicates
  // are removed (the 0006 unique index prevents new ones).
  const { data: existingRows } = await sb
    .from("integrations")
    .select("id")
    .eq("kind", "sharepoint_credentials")
    .order("created_at", { ascending: true });
  const existing = existingRows?.[0] ?? null;
  const config = {
    tenantId: tenantId.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
  };
  let credId: string;
  if (existing) {
    const { error } = await sb.from("integrations").update({ config }).eq("id", existing.id);
    if (error) return res.status(500).json({ error: error.message });
    credId = existing.id;
    const duplicates = (existingRows ?? []).slice(1).map((r) => r.id);
    if (duplicates.length > 0) {
      await sb.from("integrations").delete().in("id", duplicates);
    }
  } else {
    const { data, error } = await sb
      .from("integrations")
      .insert({
        kind: "sharepoint_credentials",
        name: "SharePoint Graph credentials",
        enabled: true,
        config,
      })
      .select("id")
      .single();
    if (error || !data) return res.status(500).json({ error: error?.message ?? "insert failed" });
    credId = data.id;
  }
  invalidateGraphCreds();
  void logActivity("integration", credId, req.user!.id, "sharepoint_credentials_saved", {
    tenantId: config.tenantId,
    clientId: config.clientId,
  });
  res.json({ ok: true });
});

// DELETE /api/sharepoint/credentials — remove stored credentials (admin).
sharepointRouter.delete("/credentials", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const { data: rows } = await sb
    .from("integrations")
    .select("id")
    .eq("kind", "sharepoint_credentials");
  const { error } = await sb.from("integrations").delete().eq("kind", "sharepoint_credentials");
  if (error) return res.status(500).json({ error: error.message });
  invalidateGraphCreds();
  for (const row of rows ?? []) {
    void logActivity("integration", row.id, req.user!.id, "sharepoint_credentials_cleared", {});
  }
  res.json({ ok: true });
});

// POST /api/sharepoint/test — verify credentials + site access.
sharepointRouter.post("/test", requireAuth, requireAdmin, async (req, res) => {
  const { siteUrl } = req.body as { siteUrl?: string };
  if (!siteUrl) return res.status(400).json({ error: "siteUrl is required" });
  try {
    const site = await resolveSite(siteUrl);
    res.json({
      ok: true,
      webUrl: site.webUrl,
      driveId: site.driveId,
      suggestedFolderPath: site.suggestedFolderPath ?? null,
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// POST /api/sharepoint/connections — add a connection (admin).
sharepointRouter.post("/connections", requireAuth, requireAdmin, async (req, res) => {
  const { name, siteUrl, folderPath, docType, productLine } = req.body as {
    name?: string;
    siteUrl?: string;
    folderPath?: string;
    docType?: string;
    productLine?: string;
  };
  if (!name || !siteUrl || docType === undefined) {
    return res.status(400).json({ error: "name, siteUrl, and docType are required" });
  }
  const sb = supabase()!;
  const { data, error } = await sb
    .from("integrations")
    .insert({
      kind: "sharepoint_graph",
      name,
      enabled: true,
      config: {
        siteUrl,
        folderPath: folderPath ?? "",
        doc_type: docType,
        product_line: productLine ?? null,
        deltaLink: null,
      },
    })
    .select("id")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("integration", data.id, req.user!.id, "sharepoint_connected", {
    siteUrl,
    folderPath,
  });
  res.json({ id: data.id });
});

// DELETE /api/sharepoint/connections/:id
sharepointRouter.delete("/connections/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const { error } = await sb
    .from("integrations")
    .delete()
    .eq("id", req.params.id)
    .eq("kind", "sharepoint_graph");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/sharepoint/connections/:id/sync — run a delta sync now.
sharepointRouter.post("/connections/:id/sync", requireAuth, requireAdmin, async (req, res) => {
  try {
    const log = await syncIntegration(req.params.id);
    res.json({ log });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
