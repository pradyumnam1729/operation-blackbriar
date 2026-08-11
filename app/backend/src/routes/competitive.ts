import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import {
  approveCiReport,
  approveMarketThreat,
  buildPositioningMap,
  compare,
  CompetitiveIntelError,
  draftMarketThreat,
  ensureSources,
  generateCiReport,
  getLatestPositioningMap,
} from "../services/competitive";
import { dismissNewsItem, listNewsItems } from "../services/competitiveNews";
import { AgentError } from "../services/agents";
import { jinaConfigured } from "../services/jina";
import { cleanHtml } from "../services/html";

const isAdmin = (req: { user?: { role: string } }) => req.user?.role === "admin";

// Competitive Intelligence API. Any authenticated role can compare and add
// competitors (sales adds one mid-deal); deletion is admin-only.
export const competitiveRouter = Router();

// GET /api/competitive/competitors — registry with source freshness.
competitiveRouter.get("/competitors", requireAuth, async (_req, res) => {
  const sb = supabase()!;
  const { data: competitors, error } = await sb
    .from("competitors")
    .select("id, name, aliases, website, category, aurigo_product, notes")
    .order("name");
  if (error) return res.status(500).json({ error: error.message });
  const { data: sources } = await sb
    .from("competitor_sources")
    .select("competitor_id, url, label, status, scraped_at");
  res.json({
    jinaConfigured: jinaConfigured(),
    competitors: (competitors ?? []).map((c) => ({
      ...c,
      sources: (sources ?? []).filter((s) => s.competitor_id === c.id),
    })),
  });
});

// POST /api/competitive/competitors — add a competitor to the registry.
competitiveRouter.post("/competitors", requireAuth, async (req, res) => {
  const { name, website, category, aurigoProduct } = req.body as {
    name?: string;
    website?: string;
    category?: string;
    aurigoProduct?: string;
  };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const sb = supabase()!;
  const { data, error } = await sb
    .from("competitors")
    .insert({
      name: name.trim(),
      website: website?.trim() || null,
      category: category?.trim() || null,
      aurigo_product: aurigoProduct && ["Primus", "Masterworks"].includes(aurigoProduct) ? aurigoProduct : null,
    })
    .select("id")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("competitor", data.id, req.user!.id, "competitor_added", { name });
  res.json({ id: data.id });
});

// DELETE /api/competitive/competitors/:id — admin only.
competitiveRouter.delete("/competitors/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const { error } = await sb.from("competitors").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/competitive/competitors/:id/sources — add a source URL manually.
competitiveRouter.post("/competitors/:id/sources", requireAuth, async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url?.trim() || !/^https?:\/\//i.test(url.trim())) {
    return res.status(400).json({ error: "A full http(s) URL is required" });
  }
  const sb = supabase()!;
  const { error } = await sb
    .from("competitor_sources")
    .upsert(
      { competitor_id: req.params.id, url: url.trim(), status: "pending" },
      { onConflict: "competitor_id,url" }
    );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/competitive/competitors/:id/refresh — discover + (re)scrape sources now.
competitiveRouter.post("/competitors/:id/refresh", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data: competitor } = await sb
    .from("competitors")
    .select("id, name, aliases, website, category, aurigo_product")
    .eq("id", req.params.id)
    .single();
  if (!competitor) return res.status(404).json({ error: "Competitor not found" });
  try {
    // Force re-scrape by clearing freshness.
    await sb
      .from("competitor_sources")
      .update({ scraped_at: null })
      .eq("competitor_id", competitor.id);
    const sources = await ensureSources(competitor);
    res.json({
      ok: true,
      scraped: sources.length,
      sources: sources.map((s) => ({ url: s.url, label: s.label, scrapedAt: s.scraped_at })),
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// POST /api/competitive/compare — the core: grounded competitive answer.
competitiveRouter.post("/compare", requireAuth, async (req, res) => {
  const { question, competitorId, product } = req.body as {
    question?: string;
    competitorId?: string;
    product?: string;
  };
  if (!question?.trim()) return res.status(400).json({ error: "question is required" });
  if (!jinaConfigured()) {
    return res.status(503).json({ error: "JINA_API_KEY is not configured in app/backend/.env" });
  }
  try {
    const result = await compare(
      question.trim(),
      competitorId ?? null,
      product && ["Primus", "Masterworks"].includes(product) ? product : null,
      req.user!.id
    );
    res.json(result);
  } catch (err) {
    // Disabled agent (Agents tab kill switch) -> 409; everything else stays 502.
    const status = err instanceof AgentError ? err.status : 502;
    res.status(status).json({ error: (err as Error).message });
  }
});

// GET /api/competitive/positioning-map — the latest stored map (live view).
competitiveRouter.get("/positioning-map", requireAuth, async (_req, res) => {
  try {
    const map = await getLatestPositioningMap();
    res.json({ map });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/competitive/positioning-map/refresh — rebuild from current
// scraped sources + knowledge base. Body carries the tunable parameters:
// { xAxis?, yAxis?, products?, competitorIds? }.
competitiveRouter.post("/positioning-map/refresh", requireAuth, async (req, res) => {
  const { xAxis, yAxis, products, competitorIds } = (req.body ?? {}) as {
    xAxis?: { label: string; low: string; high: string };
    yAxis?: { label: string; low: string; high: string };
    products?: string[];
    competitorIds?: string[];
  };
  try {
    const map = await buildPositioningMap(req.user!.id, {
      xAxis: xAxis?.label ? xAxis : undefined,
      yAxis: yAxis?.label ? yAxis : undefined,
      products: Array.isArray(products) ? products : undefined,
      competitorIds: Array.isArray(competitorIds) ? competitorIds : undefined,
    });
    void logActivity("positioning_map", map.id, req.user!.id, "positioning_map_built", {
      points: map.points.length,
      skipped: map.skipped.length,
    });
    res.json({ map });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// GET /api/competitive/comparisons — recent history.
competitiveRouter.get("/comparisons", requireAuth, async (_req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("comparisons")
    .select("id, question, aurigo_product, status, created_at, competitors(name)")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    comparisons: (data ?? []).map((c) => ({
      id: c.id,
      question: c.question,
      aurigoProduct: c.aurigo_product,
      status: c.status,
      createdAt: c.created_at,
      competitor: (c as unknown as { competitors: { name: string } | null }).competitors?.name ?? null,
    })),
  });
});

// GET /api/competitive/comparisons/:id — full stored comparison.
competitiveRouter.get("/comparisons/:id", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("comparisons")
    .select("id, question, aurigo_product, answer_html, sources, aurigo_evidence, status, error, created_at, competitors(name)")
    .eq("id", req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: "Comparison not found" });
  res.json({
    comparison: {
      ...data,
      competitor: (data as unknown as { competitors: { name: string } | null }).competitors?.name ?? null,
    },
  });
});

// POST /api/competitive/comparisons/:id/battlecard — save as a draft artifact.
competitiveRouter.post("/comparisons/:id/battlecard", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data: cmp } = await sb
    .from("comparisons")
    .select("id, question, aurigo_product, answer_html, sources, competitors(name)")
    .eq("id", req.params.id)
    .single();
  if (!cmp || !cmp.answer_html) {
    return res.status(404).json({ error: "Comparison not found or has no answer" });
  }
  const competitorName =
    (cmp as unknown as { competitors: { name: string } | null }).competitors?.name ?? "Competitor";
  const productName = cmp.aurigo_product ? `Aurigo ${cmp.aurigo_product}` : "Aurigo";
  const title = `${productName} vs ${competitorName} — battlecard`;
  const sourceList = (cmp.sources as { url: string }[])
    .map((s) => `<li><a href="${s.url}">${s.url}</a></li>`)
    .join("");
  const contentHtml = cleanHtml(
    `<h1>${title}</h1><p><strong>Question answered:</strong> ${cmp.question}</p>${cmp.answer_html}<h2>Competitor sources scraped</h2><ul>${sourceList}</ul><p>Generated ${new Date().toISOString().slice(0, 10)} from live competitive intelligence. Review before promoting to final.</p>`
  );

  const { data: product } = cmp.aurigo_product
    ? await sb.from("products").select("id").ilike("name", `${cmp.aurigo_product}%`).limit(1).maybeSingle()
    : { data: null };

  const { data: artifact, error } = await sb
    .from("artifacts")
    .insert({
      title,
      asset_type: "battlecard",
      product_id: product?.id ?? null,
      persona: "Sales",
      status: "draft",
      created_by: req.user!.id,
    })
    .select("id")
    .single();
  if (error || !artifact) return res.status(500).json({ error: error?.message ?? "Save failed" });
  await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: 1,
    content_html: contentHtml,
    note: "Generated from Competitive Intel comparison",
    created_by: req.user!.id,
  });
  void logActivity("artifact", artifact.id, req.user!.id, "battlecard_from_comparison", {
    comparison_id: cmp.id,
  });
  res.json({ artifactId: artifact.id });
});

// ---------------------------------------------------------------------------
// CI Reports — admin-curated; battlecards generate FROM an approved report.

// GET /api/competitive/ci-reports — admins see everything, everyone else final-only.
competitiveRouter.get("/ci-reports", requireAuth, async (req, res) => {
  const sb = supabase()!;
  let query = sb
    .from("ci_reports")
    .select("id, competitor_id, aurigo_product, title, status, created_by, approved_by, approved_at, created_at, competitors(name)")
    .order("created_at", { ascending: false });
  if (!isAdmin(req)) query = query.eq("status", "final");
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    reports: (data ?? []).map((r) => ({
      ...r,
      competitor: (r as unknown as { competitors: { name: string } | null }).competitors?.name ?? null,
    })),
  });
});

// GET /api/competitive/ci-reports/:id — full report (content included).
competitiveRouter.get("/ci-reports/:id", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("ci_reports")
    .select("*, competitors(name)")
    .eq("id", req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: "CI report not found" });
  if (data.status !== "final" && !isAdmin(req)) {
    return res.status(403).json({ error: "This report is still in draft" });
  }
  res.json({
    report: {
      ...data,
      competitor: (data as unknown as { competitors: { name: string } | null }).competitors?.name ?? null,
    },
  });
});

// POST /api/competitive/ci-reports — generate a draft (admin-only).
competitiveRouter.post("/ci-reports", requireAuth, requireAdmin, async (req, res) => {
  const { competitorId, product, extraBrief } = req.body as {
    competitorId?: string;
    product?: string;
    extraBrief?: string;
  };
  if (!competitorId) return res.status(400).json({ error: "competitorId is required" });
  if (!jinaConfigured()) {
    return res.status(503).json({ error: "JINA_API_KEY is not configured in app/backend/.env" });
  }
  try {
    const report = await generateCiReport(
      competitorId,
      product && ["Primus", "Masterworks"].includes(product) ? product : null,
      extraBrief?.trim() || null,
      req.user!.id
    );
    res.status(201).json({ report });
  } catch (err) {
    const status = err instanceof CompetitiveIntelError ? err.status : 502;
    res.status(status).json({ error: (err as Error).message });
  }
});

// POST /api/competitive/ci-reports/:id/approve — admin-only.
competitiveRouter.post("/ci-reports/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const report = await approveCiReport(req.params.id, req.user!.id);
    res.json({ report });
  } catch (err) {
    const status = err instanceof CompetitiveIntelError ? err.status : 500;
    const violations = err instanceof CompetitiveIntelError ? err.violations : undefined;
    res.status(status).json({ error: (err as Error).message, violations });
  }
});

// POST /api/competitive/ci-reports/:id/battlecard — only from a FINAL report (§ routing gate).
competitiveRouter.post("/ci-reports/:id/battlecard", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data: report } = await sb
    .from("ci_reports")
    .select("id, title, status, content_html, aurigo_product, competitors(name)")
    .eq("id", req.params.id)
    .single();
  if (!report) return res.status(404).json({ error: "CI report not found" });
  if (report.status !== "final") {
    return res.status(409).json({ error: "This CI report must be approved before a battlecard can be generated from it." });
  }
  const competitorName =
    (report as unknown as { competitors: { name: string } | null }).competitors?.name ?? "Competitor";
  const title = `${report.title} — battlecard`;
  const contentHtml = cleanHtml(
    `<h1>${title}</h1>${report.content_html}<p>Generated ${new Date().toISOString().slice(0, 10)} from an approved CI report on ${competitorName}. Review before promoting to final.</p>`
  );
  const { data: product } = report.aurigo_product
    ? await sb.from("products").select("id").ilike("name", `${report.aurigo_product}%`).limit(1).maybeSingle()
    : { data: null };
  const { data: artifact, error } = await sb
    .from("artifacts")
    .insert({
      title,
      asset_type: "battlecard",
      product_id: product?.id ?? null,
      persona: "Sales",
      status: "draft",
      created_by: req.user!.id,
    })
    .select("id")
    .single();
  if (error || !artifact) return res.status(500).json({ error: error?.message ?? "Save failed" });
  await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: 1,
    content_html: contentHtml,
    note: "Generated from an approved CI report",
    created_by: req.user!.id,
  });
  void logActivity("artifact", artifact.id, req.user!.id, "battlecard_from_ci_report", {
    ci_report_id: report.id,
  });
  res.json({ artifactId: artifact.id });
});

// ---------------------------------------------------------------------------
// Daily news — auto-scanned, visible to everyone automatically (no approval
// gate); admins can still dismiss a bad scan.

// GET /api/competitive/news — everyone sees every non-dismissed item.
competitiveRouter.get("/news", requireAuth, async (req, res) => {
  const view = req.query.view === "past" || req.query.view === "site_changes" ? req.query.view : "latest";
  const priority = req.query.priority === "high" ? "high" : "all";
  try {
    const items = await listNewsItems(view, priority);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/competitive/news/:id/dismiss — admin-only moderation.
competitiveRouter.post("/news/:id/dismiss", requireAuth, requireAdmin, async (req, res) => {
  try {
    const item = await dismissNewsItem(req.params.id, req.user!.id);
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// Market threats / new entrants — AI-drafted with confidence + rationale,
// admin approves before user-visible.

// GET /api/competitive/threats — admins see all, everyone else final-only.
competitiveRouter.get("/threats", requireAuth, async (req, res) => {
  const sb = supabase()!;
  let query = sb
    .from("market_threats")
    .select("id, name, aurigo_product, category, summary_html, rationale, confidence, source_url, status, approved_at, created_at")
    .order("created_at", { ascending: false });
  if (!isAdmin(req)) query = query.eq("status", "final");
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ threats: data ?? [] });
});

// POST /api/competitive/threats/draft — admin-only.
competitiveRouter.post("/threats/draft", requireAuth, requireAdmin, async (req, res) => {
  const { name, product, url } = req.body as { name?: string; product?: string; url?: string };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  try {
    const threat = await draftMarketThreat(
      name.trim(),
      product && ["Primus", "Masterworks"].includes(product) ? product : null,
      url?.trim() || null,
      req.user!.id
    );
    res.status(201).json({ threat });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// POST /api/competitive/threats/:id/approve — admin-only.
competitiveRouter.post("/threats/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const threat = await approveMarketThreat(req.params.id, req.user!.id);
    res.json({ threat });
  } catch (err) {
    const status = err instanceof CompetitiveIntelError ? err.status : 500;
    res.status(status).json({ error: (err as Error).message });
  }
});
