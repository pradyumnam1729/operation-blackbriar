import { supabase } from "./db";
import { ask } from "./claude";
import { cleanHtml, markdownToHtml } from "./html";
import {
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";
import { getLatestFramework } from "./frameworks";

// ELT competitive digest (Phase 1). Assembles window events + the latest
// threat board + battlecard staleness into one leadership-framed document via
// the admin-tunable `competitive-digest` agent. "Nothing material changed" is
// a valid, explicitly-stated digest. Stored as a row; exportable to the
// artifact library as a draft (never final — §8.4).

export interface Digest {
  id: string;
  windowStart: string;
  windowEnd: string;
  contentHtml: string;
  evidence: unknown[];
  createdAt: string;
}

interface DigestRow {
  id: string;
  window_start: string;
  window_end: string;
  content_html: string;
  evidence: unknown[] | null;
  created_at: string;
}

const COLS = "id, window_start, window_end, content_html, evidence, created_at";

function rowToDigest(r: DigestRow): Digest {
  return {
    id: r.id,
    windowStart: r.window_start,
    windowEnd: r.window_end,
    contentHtml: r.content_html,
    evidence: r.evidence ?? [],
    createdAt: r.created_at,
  };
}

const DIGEST_SUFFIX = `Write the digest as bulleted markdown, max 200 words TOTAL. Bold headline
(max 12 words) then max 30 words of so-what per item. Ground every item in
the events and analyses above — if the window is empty, the whole digest is
the one-sentence no-change statement plus any "Attention needed" line.`;

export async function buildDigest(windowDays: number, userId: string): Promise<Digest> {
  const sb = supabase()!;
  const cfg = await getAgentConfig("competitive-digest");
  assertAgentEnabled(cfg);

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 3_600_000);

  const { data: events } = await sb
    .from("competitor_events")
    .select("event_type, severity, title, summary_md, created_at, competitors(name)")
    .gte("created_at", windowStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(60);
  const eventLines = (events ?? []).map((e) => {
    const name = (e as unknown as { competitors: { name: string } | null }).competitors?.name ?? "?";
    return `- ${String(e.created_at).slice(0, 10)} [${e.severity}/${e.event_type}] ${name}: ${e.title}${e.summary_md ? ` — ${String(e.summary_md).slice(0, 240)}` : ""}`;
  });

  const tiers = await getLatestFramework("threat-tiers");
  const tierBlock = tiers
    ? `=== LATEST THREAT BOARD (built ${tiers.createdAt.slice(0, 10)}) ===\n${JSON.stringify(tiers.result)}`
    : "=== LATEST THREAT BOARD ===\nNot built yet.";

  const { data: staleCards } = await sb
    .from("battlecard_links")
    .select("stale, stale_reason, competitors(name)")
    .eq("stale", true);
  const staleBlock =
    staleCards && staleCards.length > 0
      ? `=== STALE BATTLECARDS ===\n${staleCards
          .map((b) => {
            const name = (b as unknown as { competitors: { name: string } | null }).competitors?.name ?? "?";
            return `- ${name}: ${b.stale_reason ?? "underlying sources changed"}`;
          })
          .join("\n")}`
      : "=== STALE BATTLECARDS ===\nNone.";

  const suffix = [
    DIGEST_SUFFIX,
    `Digest window: ${windowStart.toISOString().slice(0, 10)} to ${windowEnd.toISOString().slice(0, 10)} (${windowDays} days).`,
    events && events.length > 0
      ? `=== CHANGE EVENTS IN WINDOW ===\n${eventLines.join("\n")}`
      : "=== CHANGE EVENTS IN WINDOW ===\nNone detected.",
    tierBlock,
    staleBlock,
  ].join("\n\n");

  const md = await ask(composeAgentPrompt(cfg, {}, suffix), {
    maxTokens: 2500,
    model: resolveModel(cfg),
  });

  const { data, error } = await sb
    .from("digests")
    .insert({
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      content_html: markdownToHtml(md),
      evidence: [
        { events_in_window: events?.length ?? 0 },
        { threat_board: tiers ? tiers.createdAt : null },
        { stale_battlecards: staleCards?.length ?? 0 },
      ],
      created_by: userId,
    })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not store the digest");
  return rowToDigest(data as DigestRow);
}

export async function listDigests(limit = 10): Promise<Digest[]> {
  const sb = supabase()!;
  const { data } = await sb
    .from("digests")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 24));
  return ((data ?? []) as DigestRow[]).map(rowToDigest);
}

export async function getDigest(id: string): Promise<Digest | null> {
  const sb = supabase()!;
  const { data } = await sb.from("digests").select(COLS).eq("id", id).maybeSingle();
  return data ? rowToDigest(data as DigestRow) : null;
}

/** Export to the artifact library as a DRAFT — the approval gate stays. */
export async function saveDigestAsArtifact(id: string, userId: string): Promise<string> {
  const sb = supabase()!;
  const digest = await getDigest(id);
  if (!digest) throw new Error("Digest not found");
  const title = `Competitive digest — ${digest.windowStart.slice(0, 10)} to ${digest.windowEnd.slice(0, 10)}`;
  const { data: artifact, error } = await sb
    .from("artifacts")
    .insert({
      title,
      asset_type: "competitive-digest",
      persona: "Leadership",
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !artifact) throw new Error(error?.message ?? "Save failed");
  await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: 1,
    content_html: cleanHtml(`<h1>${title}</h1>${digest.contentHtml}`),
    note: "Generated from the competitive delta feed",
    created_by: userId,
  });
  return artifact.id;
}
