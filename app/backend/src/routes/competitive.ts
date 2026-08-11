import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import {
  buildPositioningMap,
  compare,
  ensureSources,
  getLatestPositioningMap,
} from "../services/competitive";
import { AgentError } from "../services/agents";
import { jinaConfigured } from "../services/jina";
import { cleanHtml } from "../services/html";
import { enqueueRun, nudgeScheduler } from "../services/researchRuns";

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
      aurigo_product: aurigoProduct && ["Primus", "Masterworks", "Essentials"].includes(aurigoProduct) ? aurigoProduct : null,
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

// ---------- watch & background research (Phase 0, gap analysis §8) ----------

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

  const cadenceHours = 168; // weekly default (open decision #1 — conservative)
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
      product && ["Primus", "Masterworks", "Essentials"].includes(product) ? product : null,
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
