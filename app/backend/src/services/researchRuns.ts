import crypto from "crypto";
import { diffLines } from "diff";
import { supabase } from "./db";
import { ask } from "./claude";
import { jinaConfigured, readUrl, searchWeb } from "./jina";
import { logActivity } from "./activity";
import {
  composeAgentPrompt,
  getAgentConfig,
  parseEventEnvelope,
  resolveModel,
} from "./agents";
import { EVENT_SUMMARY_LOCKED_SUFFIX } from "./agentPrompts";
import {
  MAX_SOURCES_PER_TYPE,
  SOURCE_POLICY,
  SWEPT_TYPES,
  SourceType,
  isDue,
} from "./sourcePolicy";

// Background research engine (Phase 0 of the competitive ELT gap analysis).
// The USER initiates tracking; the system keeps it fresh. Mirrors the
// in-process scheduler shape of startSharePointPolling(): module-level timer,
// single-flight worker, console line per action, everything survives on
// best-effort (a dead process loses in-flight runs; boot recovery re-queues).

const TICK_MS = 60_000;
// A full run can legitimately take several minutes (40 reads × 1.5 s spacing
// + model calls); 30 min is safely past that. The sweep only fires when the
// single-flight worker is idle, so an in-flight run in THIS process can never
// be swept — only runs orphaned by a dead process (QA SF-2).
const STUCK_RUN_MINUTES = 30;
const SCRAPE_SPACING_MS = 1_500;
const DEFAULT_BUDGET = { max_search_calls: 20, max_read_calls: 40 };
const DAILY_BUDGET = Number(process.env.JINA_DAILY_BUDGET ?? 300);

export interface RunProgress {
  phase?: "discovering" | "scraping" | "analyzing" | "done";
  discovered?: number;
  scraped?: number;
  changed?: number;
  events_emitted?: number;
  search_calls?: number;
  read_calls?: number;
  budget_exhausted?: boolean;
}

interface RunRow {
  id: string;
  competitor_id: string | null;
  kind: "bootstrap" | "refresh" | "sweep";
  status: string;
  progress: RunProgress;
  budget: { max_search_calls?: number; max_read_calls?: number };
}

interface WatchSourceRow {
  id: string;
  url: string;
  label: string | null;
  content_md: string | null;
  content_hash: string | null;
  status: string;
  scraped_at: string | null;
  source_type: string;
  enabled: boolean;
  refresh_hours: number | null;
}

/** Normalize before hashing/diffing so cosmetic whitespace and image/tracking
 *  churn don't register as competitive change. */
function normalizeForDiff(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/** THE content hash for cross-run comparison. Every service that persists
 *  competitor_sources.content_hash must use this one helper (QA SF-1): a
 *  second computation site with different pre-processing makes change
 *  detection flip-flop between pipelines. */
export function contentHash(text: string): string {
  return sha256(normalizeForDiff(text));
}

/** Changed-lines excerpt, capped — the model summarizes THIS, not the page,
 *  so it cannot hallucinate a change that isn't in the diff. */
export function diffExcerpt(oldMd: string, newMd: string, cap = 2_000): string {
  const parts = diffLines(normalizeForDiff(oldMd), normalizeForDiff(newMd));
  const out: string[] = [];
  let used = 0;
  for (const p of parts) {
    if (!p.added && !p.removed) continue;
    const prefix = p.added ? "+ " : "- ";
    for (const line of p.value.split("\n")) {
      if (line.trim() === "") continue;
      const entry = prefix + line.trim();
      if (used + entry.length > cap) return out.join("\n");
      out.push(entry);
      used += entry.length + 1;
    }
  }
  return out.join("\n");
}

// ---------- enqueue (idempotent) ----------

export async function enqueueRun(
  competitorId: string,
  kind: "bootstrap" | "refresh",
  triggerBy: "user" | "schedule",
  userId: string | null
): Promise<{ runId: string; existing: boolean }> {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("research_runs")
    .insert({
      competitor_id: competitorId,
      kind,
      trigger_by: triggerBy,
      budget: DEFAULT_BUDGET,
      requested_by: userId,
    })
    .select("id")
    .single();
  if (!error && data) return { runId: data.id, existing: false };

  // Unique live-run index hit → return the run that's already going.
  const { data: live } = await sb
    .from("research_runs")
    .select("id")
    .eq("competitor_id", competitorId)
    .eq("kind", kind)
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();
  if (live) return { runId: live.id, existing: true };
  throw new Error(error?.message ?? "Could not enqueue the research run");
}

// ---------- the worker ----------

let working = false; // single-flight, process-wide

async function jinaSpentToday(): Promise<number> {
  const sb = supabase()!;
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data } = await sb
    .from("research_runs")
    .select("progress")
    .gte("created_at", since);
  return ((data ?? []) as { progress: RunProgress }[]).reduce(
    (sum, r) => sum + (r.progress?.search_calls ?? 0) + (r.progress?.read_calls ?? 0),
    0
  );
}

async function setProgress(runId: string, progress: RunProgress): Promise<void> {
  const sb = supabase()!;
  await sb.from("research_runs").update({ progress }).eq("id", runId);
}

/** Classify a diff into a delta-feed event. Degrades, never blocks: a
 *  disabled or failing summarizer yields a raw content_changed event. */
async function classifyChange(
  competitorName: string,
  sourceUrl: string,
  sourceType: string,
  excerpt: string
): Promise<{ event_type: string; severity: string; title: string; summary: string | null; changed: boolean }> {
  const fallback = {
    changed: true,
    event_type: "content_changed",
    severity: "info",
    title: `${competitorName}: ${sourceType} source changed`,
    summary: null,
  };
  try {
    const cfg = await getAgentConfig("competitive-event-summary");
    if (!cfg.enabled) return fallback; // kill switch degrades to raw events
    const suffix = [
      EVENT_SUMMARY_LOCKED_SUFFIX,
      `Competitor: ${competitorName}`,
      `Source: ${sourceUrl} (type: ${sourceType})`,
      "=== CHANGED LINES (- removed / + added) ===",
      excerpt,
    ].join("\n\n");
    const raw = await ask(composeAgentPrompt(cfg, {}, suffix), {
      maxTokens: 600,
      model: resolveModel(cfg),
    });
    const parsed = parseEventEnvelope(raw);
    if (!parsed) return fallback;
    if (!parsed.changed) {
      return { changed: false, event_type: "content_changed", severity: "info", title: "", summary: null };
    }
    return {
      changed: true,
      event_type: parsed.event_type ?? "content_changed",
      severity: parsed.severity ?? "info",
      title: parsed.title ?? fallback.title,
      summary: parsed.summary ?? null,
    };
  } catch (err) {
    console.error(`event summary failed for ${sourceUrl}:`, (err as Error).message);
    return fallback;
  }
}

async function emitCompetitorAlert(event: {
  competitor_id: string;
  event_type: string;
  severity: string;
  title: string;
}): Promise<void> {
  void logActivity("competitor", event.competitor_id, null, "competitor_event", {
    event_type: event.event_type,
    severity: event.severity,
    title: event.title,
  });
  const webhook = process.env.COMPETITIVE_ALERT_WEBHOOK_URL;
  if (webhook && (event.severity === "notable" || event.severity === "high")) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `[competitive] ${event.title}` }),
      });
    } catch (err) {
      console.error("alert webhook failed:", (err as Error).message);
    }
  }
}

async function executeRun(run: RunRow): Promise<void> {
  const sb = supabase()!;
  const progress: RunProgress = {
    phase: "discovering",
    discovered: 0,
    scraped: 0,
    changed: 0,
    events_emitted: 0,
    search_calls: 0,
    read_calls: 0,
  };
  const budget = { ...DEFAULT_BUDGET, ...run.budget };
  await sb
    .from("research_runs")
    .update({ status: "running", started_at: new Date().toISOString(), progress })
    .eq("id", run.id);

  const finish = async (status: "done" | "failed", error?: string) => {
    await sb
      .from("research_runs")
      .update({ status, error: error ?? null, finished_at: new Date().toISOString(), progress })
      .eq("id", run.id);
  };

  try {
    const { data: competitor } = await sb
      .from("competitors")
      .select("id, name, website")
      .eq("id", run.competitor_id)
      .single();
    if (!competitor) return void (await finish("failed", "Competitor no longer exists"));

    const domain = competitor.website
      ? new URL(competitor.website).hostname.replace(/^www\./, "")
      : null;

    // Phase 1 — expand typed sources (bootstrap only; refresh re-scrapes what exists).
    if (run.kind === "bootstrap") {
      if (competitor.website) {
        await sb.from("competitor_sources").upsert(
          {
            competitor_id: competitor.id,
            url: competitor.website.replace(/\/+$/, ""),
            source_type: "official",
            discovered_by: "sweep",
            status: "pending",
          },
          { onConflict: "competitor_id,url", ignoreDuplicates: true }
        );
      }
      for (const type of SWEPT_TYPES) {
        const policy = SOURCE_POLICY[type as SourceType];
        for (const query of policy.sweepQueries(competitor.name)) {
          if ((progress.search_calls ?? 0) >= budget.max_search_calls) {
            progress.budget_exhausted = true; // search-capped runs report it too
            break;
          }
          try {
            const hits = await searchWeb(query, 6);
            progress.search_calls = (progress.search_calls ?? 0) + 1;
            const kept = hits.filter((h) => policy.accept(h.url, domain)).slice(0, MAX_SOURCES_PER_TYPE);
            for (const hit of kept) {
              const { error: upErr } = await sb.from("competitor_sources").upsert(
                {
                  competitor_id: competitor.id,
                  url: hit.url.replace(/\/+$/, ""),
                  source_type: type,
                  discovered_by: "sweep",
                  status: "pending",
                },
                { onConflict: "competitor_id,url", ignoreDuplicates: true }
              );
              if (!upErr) progress.discovered = (progress.discovered ?? 0) + 1;
            }
          } catch (err) {
            console.error(`sweep query failed (${type}) for ${competitor.name}:`, (err as Error).message);
          }
          await setProgress(run.id, progress);
        }
      }
    }

    // Phase 2 — scrape due sources, sequentially, budget-capped.
    progress.phase = "scraping";
    await setProgress(run.id, progress);
    const { data: sources } = await sb
      .from("competitor_sources")
      .select("id, url, label, content_md, content_hash, status, scraped_at, source_type, enabled, refresh_hours")
      .eq("competitor_id", competitor.id);

    for (const s of (sources ?? []) as WatchSourceRow[]) {
      if (!s.enabled) continue;
      const due = s.status !== "ok" || !s.content_md || isDue(s.scraped_at, s.source_type, s.refresh_hours);
      if (!due) continue;
      if ((progress.read_calls ?? 0) >= budget.max_read_calls) {
        progress.budget_exhausted = true; // partial run is a valid run
        break;
      }
      try {
        const page = await readUrl(s.url);
        progress.read_calls = (progress.read_calls ?? 0) + 1;
        progress.scraped = (progress.scraped ?? 0) + 1;
        const newHash = contentHash(page.content);
        // Recompute the old hash from stored content instead of trusting the
        // stored hash's provenance — rows written before the shared helper
        // existed carry raw-content hashes (QA SF-1 belt-and-suspenders).
        const oldHash = s.content_md ? contentHash(s.content_md) : null;
        const changed = oldHash !== null && oldHash !== newHash;
        const firstScrape = oldHash === null;

        // Phase 3 — detect + summarize BEFORE overwriting the old content.
        if (changed) {
          progress.phase = "analyzing";
          progress.changed = (progress.changed ?? 0) + 1;
          await setProgress(run.id, progress);
          const excerpt = diffExcerpt(s.content_md ?? "", page.content);
          if (excerpt.trim() !== "") {
            const verdict = await classifyChange(competitor.name, s.url, s.source_type, excerpt);
            if (verdict.changed) {
              const { data: ev } = await sb
                .from("competitor_events")
                .insert({
                  competitor_id: competitor.id,
                  source_id: s.id,
                  run_id: run.id,
                  event_type: verdict.event_type,
                  severity: verdict.severity,
                  title: verdict.title,
                  summary_md: verdict.summary,
                  diff_excerpt: excerpt,
                  evidence: [{ url: s.url, scraped_at: new Date().toISOString() }],
                })
                .select("id")
                .single();
              if (ev) {
                progress.events_emitted = (progress.events_emitted ?? 0) + 1;
                await emitCompetitorAlert({
                  competitor_id: competitor.id,
                  event_type: verdict.event_type,
                  severity: verdict.severity,
                  title: verdict.title,
                });
                // Phase 3 staleness loop: a notable+ delta marks this
                // competitor's battlecards stale until a PMM-reviewed
                // regeneration lands (drafts only — §8.4).
                if (verdict.severity === "notable" || verdict.severity === "high") {
                  await sb
                    .from("battlecard_links")
                    .update({
                      stale: true,
                      stale_reason: verdict.title,
                      triggering_event_id: ev.id,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("competitor_id", competitor.id);
                }
              }
            }
          }
        }

        await sb
          .from("competitor_sources")
          .update({
            content_md: page.content,
            content_hash: newHash,
            label: page.title.slice(0, 200),
            status: "ok",
            error: null,
            scraped_at: new Date().toISOString(),
            ...(changed || firstScrape ? { last_changed_at: new Date().toISOString() } : {}),
          })
          .eq("id", s.id);
        progress.phase = "scraping";
        await setProgress(run.id, progress);
      } catch (err) {
        const msg = (err as Error).message;
        await sb.from("competitor_sources").update({ status: "failed", error: msg }).eq("id", s.id);
        console.error(`watch scrape failed for ${s.url}: ${msg}`);
      }
      await new Promise((r) => setTimeout(r, SCRAPE_SPACING_MS));
    }

    progress.phase = "done";
    await finish("done");
    await sb
      .from("competitor_watches")
      .update({ last_run_at: new Date().toISOString() })
      .eq("competitor_id", competitor.id);
    console.log(
      `research run ${run.kind} for ${competitor.name}: ${progress.scraped ?? 0} scraped, ${progress.events_emitted ?? 0} events`
    );
  } catch (err) {
    await finish("failed", (err as Error).message);
    console.error(`research run ${run.id} failed:`, (err as Error).message);
  }
}

// ---------- scheduler ----------

async function tick(): Promise<void> {
  if (working) return;
  const sb = supabase();
  if (!sb || !jinaConfigured()) return;
  working = true;
  try {
    // Recover runs orphaned by a dead process (QA SF-2). Safe while live: the
    // `working` guard means this never runs concurrently with executeRun in
    // this process, and STUCK_RUN_MINUTES is far past a legitimate run.
    await sb
      .from("research_runs")
      .update({ status: "queued", started_at: null })
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - STUCK_RUN_MINUTES * 60_000).toISOString());

    // One daily-budget read per tick (QA SF-4 + N7): gates BOTH scheduled
    // enqueues and queue execution, so user-initiated runs cannot blow past
    // the daily cap — they stay queued until spend frees up.
    const spentToday = await jinaSpentToday();
    const overBudget = spentToday >= DAILY_BUDGET;

    // Enqueue refreshes for due watches.
    const now = new Date().toISOString();
    const { data: due } = await sb
      .from("competitor_watches")
      .select("competitor_id, cadence_hours")
      .eq("enabled", true)
      .or(`next_run_at.is.null,next_run_at.lte.${now}`);
    for (const w of due ?? []) {
      if (overBudget) {
        console.log("competitive watch: daily Jina budget reached — skipping scheduled runs");
        break;
      }
      await enqueueRun(w.competitor_id, "refresh", "schedule", null);
      await sb
        .from("competitor_watches")
        .update({ next_run_at: new Date(Date.now() + w.cadence_hours * 3_600_000).toISOString() })
        .eq("competitor_id", w.competitor_id);
    }

    // Work the queue: oldest queued run first, one per tick.
    if (!overBudget) {
      const { data: queued } = await sb
        .from("research_runs")
        .select("id, competitor_id, kind, status, progress, budget")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (queued) await executeRun(queued as RunRow);
    }
  } catch (err) {
    console.error("competitive watch tick failed:", (err as Error).message);
  } finally {
    working = false;
  }
}

/** Kick the worker soon (called after a user-initiated enqueue so the run
 *  starts in seconds, not at the next minute tick). */
export function nudgeScheduler(): void {
  setTimeout(() => void tick(), 250);
}

let timer: NodeJS.Timeout | null = null;

export function startResearchScheduler(): void {
  if (timer) return;
  const sb = supabase();
  if (!sb) {
    console.log("competitive watch: database not configured — scheduler not started");
    return;
  }
  // Boot recovery: in-process runs die with the process; re-queue stuck ones.
  void sb
    .from("research_runs")
    .update({ status: "queued" })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - STUCK_RUN_MINUTES * 60_000).toISOString())
    .then(({ error }) => {
      if (error) console.error("run boot recovery failed:", error.message);
    });
  timer = setInterval(() => void tick(), TICK_MS);
  console.log("competitive watch scheduler started (tick 60s)");
}
