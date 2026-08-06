import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import {
  graphConfigured,
  listChildren,
  resolveSite,
  syncIntegration,
} from "../services/sharepoint";

// Admin surface for the Microsoft Graph SharePoint connector.
export const sharepointRouter = Router();

// GET /api/sharepoint/status — credential + flag state for the UI.
sharepointRouter.get("/status", requireAuth, async (_req, res) => {
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
  res.json({
    configured: graphConfigured(),
    flagEnabled: flag?.enabled ?? false,
    requiredEnv: ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"],
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

// POST /api/sharepoint/test — verify credentials + site access.
sharepointRouter.post("/test", requireAuth, requireAdmin, async (req, res) => {
  const { siteUrl } = req.body as { siteUrl?: string };
  if (!siteUrl) return res.status(400).json({ error: "siteUrl is required" });
  try {
    const site = await resolveSite(siteUrl);
    res.json({ ok: true, webUrl: site.webUrl, driveId: site.driveId });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// POST /api/sharepoint/browse — list folders/files at a path for folder picking.
sharepointRouter.post("/browse", requireAuth, requireAdmin, async (req, res) => {
  const { siteUrl, folderPath } = req.body as { siteUrl?: string; folderPath?: string };
  if (!siteUrl) return res.status(400).json({ error: "siteUrl is required" });
  try {
    const site = await resolveSite(siteUrl);
    const items = await listChildren(site.driveId, folderPath ?? "");
    res.json({
      items: items.map((i) => ({
        name: i.name,
        isFolder: Boolean(i.folder),
        webUrl: i.webUrl,
        modified: i.lastModifiedDateTime,
      })),
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
