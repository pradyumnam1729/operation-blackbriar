import { supabase } from "./db";
import { ask } from "./claude";
import { markdownToHtml } from "./html";
import { searchWeb, jinaConfigured } from "./jina";
import { logActivity } from "./activity";
import { CompetitorRow } from "./competitive";

// Daily competitor news feed: one automatic scan per tracked competitor
// every 24h, drafted candidates queued as "pending" for PMM approval before
// regular users see them. Same setInterval-on-boot pattern as
// startSharePointPolling() (services/sharepoint.ts) — no new scheduling
// mechanism needed.

export interface NewsItemRow {
  id: string;
  competitor_id: string | null;
  headline: string;
  summary_html: string;
  source_url: string | null;
  discovered_at: string;
  status: "pending" | "approved" | "dismissed";
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export const NEWS_CATEGORIES = [
  "News",
  "Press Release",
  "Acquisition",
  "AI Direction",
  "Bidding & RFP",
  "Webinar & Event",
] as const;

interface NewsCandidate {
  headline: string;
  summary: string;
  source_url: string | null;
  category: string | null;
  priority: "high" | "normal";
}

export function parseNewsCandidates(raw: string): NewsCandidate[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((p) => p as Record<string, unknown>)
    .filter((p) => typeof p.headline === "string" && typeof p.summary === "string")
    .slice(0, 3)
    .map((p) => ({
      headline: p.headline as string,
      summary: p.summary as string,
      source_url: typeof p.source_url === "string" ? p.source_url : null,
      category: NEWS_CATEGORIES.includes(p.category as (typeof NEWS_CATEGORIES)[number]) ? (p.category as string) : null,
      priority: p.priority === "high" ? "high" : "normal",
    }));
}

/** One competitor, one scan: search + summarize into 0-3 candidate news items. */
export async function scanCompetitorNews(competitor: CompetitorRow): Promise<number> {
  const sb = supabase()!;
  const hits = await searchWeb(`${competitor.name} news announcement release update`, 8);
  if (hits.length === 0) return 0;

  const hitsBlock = hits.map((h) => `${h.title} — ${h.url}\n${h.description}`).join("\n\n");
  const prompt = [
    `Here are recent search results about "${competitor.name}", a competitor in the construction / capital program management software market.`,
    "Identify up to 3 items that are genuinely newsworthy for a competitive-intel feed (product launches, funding, leadership changes, partnerships, notable losses/wins) — skip generic listicles, old content, or unrelated results.",
    `For each item, classify "category" as exactly one of: ${NEWS_CATEGORIES.join(", ")}.`,
    'Set "priority" to "high" only if this materially affects Aurigo\'s competitive position (e.g. a direct feature launch that overlaps Aurigo, a major funding round, an acquisition); otherwise "normal".',
    "Respond with ONLY a JSON array, no prose before or after:",
    '[{"headline": string, "summary": string (1-2 sentences), "source_url": string, "category": string, "priority": "high" | "normal"}]',
    "If nothing is genuinely newsworthy, respond with an empty array: []",
    "",
    hitsBlock,
  ].join("\n\n");

  const raw = await ask(prompt, { maxTokens: 1200 });
  const candidates = parseNewsCandidates(raw);
  for (const c of candidates) {
    // No approval gate — scanned items are visible to everyone automatically;
    // "dismissed" is the only moderation state admins can still set.
    await sb.from("news_items").insert({
      competitor_id: competitor.id,
      headline: c.headline,
      summary_html: markdownToHtml(c.summary),
      source_url: c.source_url,
      category: c.category,
      priority: c.priority,
      status: "approved",
    });
  }
  return candidates.length;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Scan every tracked competitor once a day for news candidates. */
export function startCompetitiveNewsPolling(): void {
  if (pollTimer) return;
  const tick = async () => {
    try {
      if (!jinaConfigured()) return;
      const sb = supabase();
      if (!sb) return;
      const { data: competitors } = await sb
        .from("competitors")
        .select("id, name, aliases, website, category, aurigo_product");
      for (const c of (competitors ?? []) as CompetitorRow[]) {
        try {
          const found = await scanCompetitorNews(c);
          if (found > 0) console.log(`[competitive-news] ${c.name}: ${found} candidate(s) queued`);
        } catch (err) {
          console.error(`[competitive-news] scan failed for ${c.name}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      console.error("[competitive-news] poll error:", (err as Error).message);
    }
  };
  pollTimer = setInterval(() => void tick(), ONE_DAY_MS);
  void tick();
  console.log("[competitive-news] daily polling scheduler armed (24h interval, gated on JINA_API_KEY)");
}

/** Everyone sees every non-dismissed item — no approval gate. */
export async function listNewsItems(): Promise<NewsItemRow[]> {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("news_items")
    .select("*")
    .neq("status", "dismissed")
    .order("discovered_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as NewsItemRow[];
}

/** Admin-only moderation: hide a bad scan. Nothing left to "approve". */
export async function dismissNewsItem(id: string, userId: string): Promise<NewsItemRow> {
  const sb = supabase()!;
  const { data: row, error } = await sb
    .from("news_items")
    .update({ status: "dismissed", approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Dismiss failed");
  void logActivity("news_item", id, userId, "dismissed", {});
  return row as NewsItemRow;
}
