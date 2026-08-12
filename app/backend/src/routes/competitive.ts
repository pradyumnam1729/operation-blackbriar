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
import {
  FRAMEWORK_KEYS,
  FrameworkKey,
  buildFramework,
  getLatestFramework,
} from "../services/frameworks";
import { buildDigest, listDigests, saveDigestAsArtifact } from "../services/digest";
import { enqueueRun, nudgeScheduler } from "../services/researchRuns";
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

// POST /api/competitive/competitors — add a competitor to the registry. PMM-only:
// this drives what the daily news/threat schedulers track, not a general-user action.
competitiveRouter.post("/competitors", requireAuth, requireAdmin, async (req, res) => {
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

// POST /api/competitive/competitors/:id/sources — add a source URL manually. PMM-only.
competitiveRouter.post("/competitors/:id/sources", requireAuth, requireAdmin, async (req, res) => {
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

// POST /api/competitive/competitors/:id/refresh — discover + (re)scrape sources now. PMM-only.
competitiveRouter.post("/competitors/:id/refresh", requireAuth, requireAdmin, async (req, res) => {
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
  const { competitorId, product, extraBrief, priorityUrls } = req.body as {
    competitorId?: string;
    product?: string;
    extraBrief?: string;
    priorityUrls?: string[];
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
      Array.isArray(priorityUrls) ? priorityUrls.filter((u) => typeof u === "string" && u.trim() !== "") : [],
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

// ---------------------------------------------------------------------------
// Competitor watch, delta events, frameworks, digest, ELT overview — ported
// from the watch lineage (2360a25). Tables come from migrations
// 0019_competitive_watch.sql and 0020_competitive_elt.sql.

// POST /api/competitive/competitors/:id/track — start (or resume) watching:
// upsert the watch, enqueue a bootstrap sweep on first track, refresh after.
// Any authenticated role — sales starts tracking mid-deal, same rationale as
// competitor adds.
competitiveRouter.post("/competitors/:id/track", requireAuth, async (req, res) => {
  if (!jinaConfigured()) {
    return res.status(503).json({ error: "JINA_API_KEY is not configured in app/backend/.env" });
  }
  const sb = supabase()!;
  const { data: competitor } = await sb
    .from("competitors")
    .select("id, name")
    .eq("id", req.params.id)
    .single();
  if (!competitor) return res.status(404).json({ error: "Competitor not found" });

  const cadenceHours = 168; // weekly default — conservative
  const { error: watchErr } = await sb.from("competitor_watches").upsert(
    {
      competitor_id: competitor.id,
      enabled: true,
      cadence_hours: cadenceHours,
      next_run_at: new Date(Date.now() + cadenceHours * 3_600_000).toISOString(),
      created_by: req.user!.id,
    },
    { onConflict: "competitor_id" }
  );
  if (watchErr) return res.status(500).json({ error: watchErr.message });

  const { data: prior } = await sb
    .from("research_runs")
    .select("id")
    .eq("competitor_id", competitor.id)
    .eq("kind", "bootstrap")
    .eq("status", "done")
    .limit(1)
    .maybeSingle();
  const kind = prior ? ("refresh" as const) : ("bootstrap" as const);
  try {
    const { runId, existing } = await enqueueRun(competitor.id, kind, "user", req.user!.id);
    nudgeScheduler();
    void logActivity("competitor", competitor.id, req.user!.id, "watch_started", { kind });
    res.json({ ok: true, runId, kind, existing });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// DELETE /api/competitive/competitors/:id/track — pause the watch (soft;
// sources, runs, and events all stay).
competitiveRouter.delete("/competitors/:id/track", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { error } = await sb
    .from("competitor_watches")
    .update({ enabled: false })
    .eq("competitor_id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("competitor", req.params.id, req.user!.id, "watch_paused", {});
  res.json({ ok: true });
});

// GET /api/competitive/watches — watch state per competitor (frontend merges
// into the registry table by competitor_id).
competitiveRouter.get("/watches", requireAuth, async (_req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("competitor_watches")
    .select("competitor_id, enabled, cadence_hours, last_run_at, next_run_at");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ watches: data ?? [] });
});

// POST /api/competitive/runs — manual run. 200 with the live run when one is
// already going (idempotent double-click).
competitiveRouter.post("/runs", requireAuth, async (req, res) => {
  const { competitorId, kind } = req.body as { competitorId?: string; kind?: string };
  if (!competitorId) return res.status(400).json({ error: "competitorId is required" });
  const runKind = kind === "bootstrap" ? "bootstrap" : "refresh";
  try {
    const { runId, existing } = await enqueueRun(competitorId, runKind, "user", req.user!.id);
    nudgeScheduler();
    res.json({ ok: true, runId, existing });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// GET /api/competitive/runs — recent runs, optionally per competitor.
competitiveRouter.get("/runs", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
  let q = sb
    .from("research_runs")
    .select("id, competitor_id, kind, trigger_by, status, progress, error, started_at, finished_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (typeof req.query.competitorId === "string" && req.query.competitorId !== "") {
    q = q.eq("competitor_id", req.query.competitorId);
  }
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ runs: data ?? [] });
});

// GET /api/competitive/runs/:id — progress detail (frontend polls this).
competitiveRouter.get("/runs/:id", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("research_runs")
    .select("id, competitor_id, kind, trigger_by, status, progress, error, started_at, finished_at, created_at")
    .eq("id", req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: "Run not found" });
  res.json({ run: data });
});

// GET /api/competitive/events — the delta feed.
competitiveRouter.get("/events", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
  let q = sb
    .from("competitor_events")
    .select(
      "id, competitor_id, source_id, event_type, severity, title, summary_md, diff_excerpt, evidence, acknowledged_by, acknowledged_at, created_at, competitors(name)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (typeof req.query.competitorId === "string" && req.query.competitorId !== "") {
    q = q.eq("competitor_id", req.query.competitorId);
  }
  if (typeof req.query.severity === "string" && ["info", "notable", "high"].includes(req.query.severity)) {
    q = q.eq("severity", req.query.severity);
  }
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    events: (data ?? []).map((e) => ({
      ...e,
      competitor: (e as unknown as { competitors: { name: string } | null }).competitors?.name ?? null,
      competitors: undefined,
    })),
  });
});

// POST /api/competitive/events/:id/ack — mark an event read (who + when).
competitiveRouter.post("/events/:id/ack", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { error } = await sb
    .from("competitor_events")
    .update({ acknowledged_by: req.user!.id, acknowledged_at: new Date().toISOString() })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// GET /api/competitive/events/summary — window aggregation for the ELT view.
competitiveRouter.get("/events/summary", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const days = Math.min(Number(req.query.days ?? 7) || 7, 90);
  const since = new Date(Date.now() - days * 24 * 3_600_000).toISOString();
  const { data, error } = await sb
    .from("competitor_events")
    .select("competitor_id, severity, event_type, title, created_at, competitors(name)")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const rows = data ?? [];
  const byCompetitor = new Map<string, { competitor: string; info: number; notable: number; high: number }>();
  for (const e of rows) {
    const name = (e as unknown as { competitors: { name: string } | null }).competitors?.name ?? "?";
    if (!byCompetitor.has(name)) byCompetitor.set(name, { competitor: name, info: 0, notable: 0, high: 0 });
    const bucket = byCompetitor.get(name)!;
    if (e.severity === "high") bucket.high += 1;
    else if (e.severity === "notable") bucket.notable += 1;
    else bucket.info += 1;
  }
  res.json({
    days,
    total: rows.length,
    byCompetitor: [...byCompetitor.values()].sort((a, b) => b.high * 100 + b.notable * 10 + b.info - (a.high * 100 + a.notable * 10 + a.info)),
    top: rows
      .filter((e) => e.severity !== "info")
      .slice(0, 5)
      .map((e) => ({
        competitor: (e as unknown as { competitors: { name: string } | null }).competitors?.name ?? "?",
        severity: e.severity,
        title: e.title,
        createdAt: e.created_at,
      })),
  });
});

// ---------- ELT digest ----------

competitiveRouter.post("/digest", requireAuth, async (req, res) => {
  const windowDays = Math.min(Math.max(Number((req.body as { windowDays?: number })?.windowDays ?? 7) || 7, 1), 90);
  try {
    const digest = await buildDigest(windowDays, req.user!.id);
    void logActivity("digest", digest.id, req.user!.id, "digest_built", { windowDays });
    res.json({ digest });
  } catch (err) {
    const status = err instanceof AgentError ? err.status : 502;
    res.status(status).json({ error: (err as Error).message });
  }
});

competitiveRouter.post("/digests/:id/save-as-artifact", requireAuth, async (req, res) => {
  try {
    const artifactId = await saveDigestAsArtifact(req.params.id, req.user!.id);
    res.json({ artifactId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------- framework engine ----------

competitiveRouter.post("/frameworks/:key/build", requireAuth, async (req, res) => {
  const key = req.params.key as FrameworkKey;
  if (!FRAMEWORK_KEYS.includes(key)) return res.status(404).json({ error: "Unknown framework" });
  const { competitorId, competitorIds } = (req.body ?? {}) as {
    competitorId?: string;
    competitorIds?: string[];
  };
  try {
    const analysis = await buildFramework(key, { competitorId, competitorIds }, req.user!.id);
    void logActivity("framework", analysis.id, req.user!.id, "framework_built", { key });
    res.json({ analysis });
  } catch (err) {
    const status = err instanceof AgentError ? err.status : 502;
    res.status(status).json({ error: (err as Error).message });
  }
});

competitiveRouter.get("/frameworks/:key/latest", requireAuth, async (req, res) => {
  const key = req.params.key as FrameworkKey;
  if (!FRAMEWORK_KEYS.includes(key)) return res.status(404).json({ error: "Unknown framework" });
  try {
    const analysis = await getLatestFramework(key, {
      competitorId: typeof req.query.competitorId === "string" ? req.query.competitorId : undefined,
    });
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Generic, safe HTML rendering of a framework result object (headings from
 *  keys, lists from string arrays); sanitized as a whole before storage. */
function frameworkResultHtml(value: unknown, depth = 2): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `<p>${String(value)}</p>`;
  }
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return `<ul>${value.map((v) => `<li>${String(v)}</li>`).join("")}</ul>`;
    }
    return value.map((v) => frameworkResultHtml(v, depth)).join("");
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => {
      const label = k.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const tag = `h${Math.min(depth, 4)}`;
      return `<${tag}>${label}</${tag}>${frameworkResultHtml(v, depth + 1)}`;
    })
    .join("");
}

// POST /api/competitive/frameworks/:key/save-as-artifact — the framework
// generators get the same save-to-workspace affordance as the digest
// (three sibling generators, one persistence model).
competitiveRouter.post("/frameworks/:key/save-as-artifact", requireAuth, async (req, res) => {
  const key = req.params.key as FrameworkKey;
  if (!FRAMEWORK_KEYS.includes(key)) return res.status(404).json({ error: "Unknown framework" });
  try {
    const analysis = await getLatestFramework(key, {
      competitorId:
        typeof (req.body ?? {}).competitorId === "string" ? (req.body.competitorId as string) : undefined,
    });
    if (!analysis) {
      return res.status(404).json({ error: "No analysis to save — build the framework first" });
    }
    const sb = supabase()!;
    const title = `${key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — competitive analysis`;
    const html = cleanHtml(
      `<h1>${title}</h1>${analysis.summaryHtml ?? ""}${frameworkResultHtml(analysis.result)}<p>Generated ${analysis.createdAt.slice(0, 10)} from live competitive intelligence. Review before promoting to final.</p>`
    );
    const { data: artifact, error } = await sb
      .from("artifacts")
      .insert({
        title,
        asset_type: "other",
        persona: "Leadership",
        status: "draft",
        current_version: 1,
        created_by: req.user!.id,
      })
      .select("id")
      .single();
    if (error || !artifact) return res.status(500).json({ error: error?.message ?? "Save failed" });
    const { error: vErr } = await sb.from("artifact_versions").insert({
      artifact_id: artifact.id,
      version: 1,
      content_html: html,
      note: `AI: generated from the ${key} framework analysis`,
      created_by: req.user!.id,
    });
    if (vErr) return res.status(500).json({ error: vErr.message });
    void logActivity("artifact", artifact.id, req.user!.id, "framework_saved_as_artifact", { key });
    res.json({ artifactId: artifact.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------- one-call ELT overview ----------

competitiveRouter.get("/elt-overview", requireAuth, async (_req, res) => {
  const sb = supabase()!;
  try {
    const [{ data: watches }, tiers, { data: staleCards }, digests] = await Promise.all([
      sb.from("competitor_watches").select("competitor_id, enabled, last_run_at, competitors(name)"),
      getLatestFramework("threat-tiers"),
      sb
        .from("battlecard_links")
        .select("artifact_id, stale, stale_reason, competitors(name), artifacts(title)")
        .eq("stale", true),
      listDigests(1),
    ]);
    res.json({
      tracking: (watches ?? []).length > 0,
      watches: (watches ?? []).map((w) => ({
        competitorId: w.competitor_id,
        competitor: (w as unknown as { competitors: { name: string } | null }).competitors?.name ?? "?",
        enabled: w.enabled,
        lastRunAt: w.last_run_at,
      })),
      threatBoard: tiers,
      staleBattlecards: (staleCards ?? []).map((b) => ({
        artifactId: (b as unknown as { artifact_id: string }).artifact_id,
        competitor: (b as unknown as { competitors: { name: string } | null }).competitors?.name ?? "?",
        title: (b as unknown as { artifacts: { title: string } | null }).artifacts?.title ?? null,
        reason: (b as unknown as { stale_reason: string | null }).stale_reason,
      })),
      lastDigest: digests[0] ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Append a CHECKED draft version to a canonical battlecard and advance
 *  `current_version` (the pointer every consumer reads). Rules:
 *  - only the card's creator or a PMM admin may update it;
 *  - every write is checked — a failed insert reports failure, never a
 *    silent success with a cleared staleness flag;
 *  - a `final` card demotes to `in_review`: the new draft is visible, but the
 *    card must pass PMM re-approval before it is final again (§8.4). */
async function appendBattlecardVersion(
  sb: NonNullable<ReturnType<typeof supabase>>,
  artifactId: string,
  contentHtml: string,
  note: string,
  user: { id: string; role: string }
): Promise<{ ok: true; version: number } | { ok: false; status: number; error: string }> {
  const { data: artifact } = await sb
    .from("artifacts")
    .select("id, current_version, status, created_by")
    .eq("id", artifactId)
    .maybeSingle();
  if (!artifact) return { ok: false, status: 404, error: "Artifact not found" };
  if (user.role !== "admin" && artifact.created_by !== user.id) {
    return {
      ok: false,
      status: 403,
      error: "Only the card's creator or a PMM admin can update the canonical battlecard.",
    };
  }
  const newVersion = (Number(artifact.current_version) || 1) + 1;
  const { error: vErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifactId,
    version: newVersion,
    content_html: contentHtml,
    note,
    created_by: user.id,
  });
  if (vErr) return { ok: false, status: 500, error: vErr.message };
  const { error: aErr } = await sb
    .from("artifacts")
    .update({
      current_version: newVersion,
      updated_at: new Date().toISOString(),
      ...(artifact.status === "final" ? { status: "in_review" } : {}),
    })
    .eq("id", artifactId);
  if (aErr) return { ok: false, status: 500, error: aErr.message };
  return { ok: true, version: newVersion };
}

/** Battlecard HTML from a stored comparison (shared by save + regenerate). */
function battlecardHtml(
  title: string,
  question: string,
  answerHtml: string,
  sources: { url: string }[]
): string {
  const sourceList = sources.map((s) => `<li><a href="${s.url}">${s.url}</a></li>`).join("");
  return cleanHtml(
    `<h1>${title}</h1><p><strong>Question answered:</strong> ${question}</p>${answerHtml}<h2>Competitor sources scraped</h2><ul>${sourceList}</ul><p>Generated ${new Date().toISOString().slice(0, 10)} from live competitive intelligence. Review before promoting to final.</p>`
  );
}

// POST /api/competitive/battlecards/:artifactId/regenerate — re-run the
// card's stored question against fresh sources; the result lands as a NEW
// DRAFT VERSION on the same artifact (final is never mutated — §8.4).
competitiveRouter.post("/battlecards/:artifactId/regenerate", requireAuth, async (req, res) => {
  if (!jinaConfigured()) {
    return res.status(503).json({ error: "JINA_API_KEY is not configured in app/backend/.env" });
  }
  const sb = supabase()!;
  const { data: link } = await sb
    .from("battlecard_links")
    .select("artifact_id, competitor_id, aurigo_product, question, competitors(name)")
    .eq("artifact_id", req.params.artifactId)
    .maybeSingle();
  if (!link) return res.status(404).json({ error: "No battlecard link for that artifact" });
  const question =
    link.question ?? `Strengths and weaknesses vs Aurigo ${link.aurigo_product ?? ""}`.trim();
  try {
    const result = await compare(question, link.competitor_id, link.aurigo_product, req.user!.id);
    const competitorName =
      (link as unknown as { competitors: { name: string } | null }).competitors?.name ?? result.competitor;
    const productName = link.aurigo_product ? `Aurigo ${link.aurigo_product}` : "Aurigo";
    const title = `${productName} vs ${competitorName} — battlecard`;
    const contentHtml = battlecardHtml(title, question, result.answerHtml, result.sources);
    const appended = await appendBattlecardVersion(
      sb,
      link.artifact_id,
      contentHtml,
      "AI: regenerated after competitor change (draft — review before promoting)",
      req.user!
    );
    if (!appended.ok) return res.status(appended.status).json({ error: appended.error });
    const { error: linkErr } = await sb
      .from("battlecard_links")
      .update({ stale: false, stale_reason: null, updated_at: new Date().toISOString() })
      .eq("artifact_id", link.artifact_id);
    if (linkErr) return res.status(500).json({ error: linkErr.message });
    void logActivity("artifact", link.artifact_id, req.user!.id, "battlecard_regenerated", {
      version: appended.version,
    });
    res.json({ artifactId: link.artifact_id, version: appended.version });
  } catch (err) {
    const status = err instanceof AgentError ? err.status : 502;
    res.status(status).json({ error: (err as Error).message });
  }
});
