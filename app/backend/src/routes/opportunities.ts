import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";

// Win/Loss module: read-only Salesforce mirror (mock data until the JWT-bearer
// Connected App is provisioned — see salesforce_live feature flag).
// Dashboard is visible to all authenticated roles.
export const opportunitiesRouter = Router();
opportunitiesRouter.use(requireAuth);

interface Opportunity {
  id: string;
  sf_id: string | null;
  name: string;
  account_name: string | null;
  product_line: string | null;
  stage: "closed_won" | "closed_lost";
  amount: number | null;
  competitor: string | null;
  loss_reason: string | null;
  closed_at: string | null;
  owner: string | null;
  synced_at: string;
}

const BANDS = ["<500K", "500K-1M", "1M-2M", ">2M"] as const;

function bandOf(amount: number | null): string {
  const n = amount ?? 0;
  if (n < 500_000) return "<500K";
  if (n < 1_000_000) return "500K-1M";
  if (n < 2_000_000) return "1M-2M";
  return ">2M";
}

interface Filters {
  product_line?: string;
  competitor?: string;
  stage?: string;
  band?: string;
  q?: string;
}

function readFilters(query: Record<string, unknown>): Filters {
  const pick = (key: string) => (typeof query[key] === "string" && query[key] ? (query[key] as string) : undefined);
  return {
    product_line: pick("product_line"),
    competitor: pick("competitor"),
    stage: pick("stage"),
    band: pick("band"),
    q: pick("q"),
  };
}

function applyFilters(rows: Opportunity[], f: Filters): Opportunity[] {
  return rows.filter((o) => {
    if (f.product_line && o.product_line !== f.product_line) return false;
    if (f.competitor && o.competitor !== f.competitor) return false;
    if (f.stage && o.stage !== f.stage) return false;
    if (f.band && bandOf(o.amount) !== f.band) return false;
    if (f.q) {
      const needle = f.q.toLowerCase();
      const hay = `${o.name} ${o.account_name ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

async function fetchAll(): Promise<{ rows: Opportunity[] | null; error: string | null }> {
  const sb = supabase();
  if (!sb) return { rows: null, error: "Database not configured" };
  const { data, error } = await sb
    .from("opportunities")
    .select("*")
    .order("closed_at", { ascending: false });
  if (error) return { rows: null, error: error.message };
  return { rows: (data ?? []) as Opportunity[], error: null };
}

// ---------- aggregates ----------
opportunitiesRouter.get("/summary", async (req, res) => {
  const { rows, error } = await fetchAll();
  if (error || !rows) return res.status(error === "Database not configured" ? 503 : 500).json({ error });

  const filtered = applyFilters(rows, readFilters(req.query as Record<string, unknown>));

  const wonRows = filtered.filter((o) => o.stage === "closed_won");
  const lostRows = filtered.filter((o) => o.stage === "closed_lost");
  const wonAmount = wonRows.reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const lostAmount = lostRows.reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const total = wonRows.length + lostRows.length;
  const winRate = total === 0 ? 0 : Math.round((wonRows.length / total) * 1000) / 10;

  const tally = (key: (o: Opportunity) => string | null) => {
    const map = new Map<string, { won: number; lost: number }>();
    for (const o of filtered) {
      const k = key(o);
      if (k === null) continue;
      const entry = map.get(k) ?? { won: 0, lost: 0 };
      if (o.stage === "closed_won") entry.won += 1;
      else entry.lost += 1;
      map.set(k, entry);
    }
    return map;
  };

  const byCompetitor = [...tally((o) => o.competitor ?? "Unknown").entries()]
    .map(([competitor, v]) => ({ competitor, ...v }))
    .sort((a, b) => b.won + b.lost - (a.won + a.lost));

  const lossCounts = new Map<string, number>();
  for (const o of lostRows) {
    if (!o.loss_reason) continue;
    lossCounts.set(o.loss_reason, (lossCounts.get(o.loss_reason) ?? 0) + 1);
  }
  const byLossReason = [...lossCounts.entries()]
    .map(([loss_reason, count]) => ({ loss_reason, count }))
    .sort((a, b) => b.count - a.count);

  const byProductLine = [...tally((o) => o.product_line ?? "Unknown").entries()]
    .map(([product_line, v]) => ({ product_line, ...v }))
    .sort((a, b) => a.product_line.localeCompare(b.product_line));

  const bandMap = tally((o) => bandOf(o.amount));
  const byBand = BANDS.map((band) => ({ band, ...(bandMap.get(band) ?? { won: 0, lost: 0 }) }));

  res.json({
    totals: { won: wonRows.length, lost: lostRows.length, wonAmount, lostAmount, winRate },
    byCompetitor,
    byLossReason,
    byProductLine,
    byBand,
  });
});

// ---------- last sync ----------
opportunitiesRouter.get("/last-sync", async (_req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { data, error } = await sb
    .from("sync_runs")
    .select("*")
    .eq("source", "salesforce")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ run: data ?? null });
});

// ---------- mock refresh (stub for the future Connected App sync) ----------
opportunitiesRouter.post("/refresh", async (_req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const now = new Date().toISOString();
  const { data: run, error } = await sb
    .from("sync_runs")
    .insert({
      source: "salesforce",
      status: "success",
      detail: "Mock sync — Salesforce Connected App not yet provisioned (salesforce_live flag off)",
      finished_at: now,
    })
    .select("*")
    .single();
  if (error || !run) return res.status(500).json({ error: error?.message ?? "Sync insert failed" });

  const { error: touchError } = await sb
    .from("opportunities")
    .update({ synced_at: now })
    .not("id", "is", null);
  if (touchError) console.error("opportunities synced_at touch failed:", touchError.message);

  res.json({ run });
});

// ---------- filtered list ----------
opportunitiesRouter.get("/", async (req, res) => {
  const { rows, error } = await fetchAll();
  if (error || !rows) return res.status(error === "Database not configured" ? 503 : 500).json({ error });
  const filtered = applyFilters(rows, readFilters(req.query as Record<string, unknown>));
  res.json({ opportunities: filtered });
});

// ---------- detail (keep last: /:id catches everything else) ----------
opportunitiesRouter.get("/:id", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { data, error } = await sb
    .from("opportunities")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Opportunity not found" });
  res.json({ opportunity: data });
});
