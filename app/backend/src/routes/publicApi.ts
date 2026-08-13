import { Router } from "express";
import { logQuery, supabase } from "../services/db";
import { markdownToHtml } from "../services/html";
import { wrapExportHtml } from "../services/localFolders";
import { AgentError } from "../services/agents";
import { answerQuestion } from "../services/askPipeline";
import { requireApiKey } from "../middleware/apiKey";
import { OPENAPI_SPEC } from "../services/openapiSpec";
import { renderDocsHtml } from "../services/openapiDocs";

// The public, versioned, read-only-biased surface (blueprint open-api.md Â§3).
// SECURITY IS THE POINT:
//  - status='final' (or an approval equivalent) predicate in EVERY data query;
//  - explicit column allowlists everywhere â€” select("*") is BANNED in this file
//    (decision Â§0.1-2; qa-reviewer greps for it);
//  - 404 (not 403) for nonexistent OR non-final â€” the API never confirms a draft
//    exists;
//  - never exposed: user ids/emails, internal FKs, guard/gap fields, war-room
//    paths, agent config, prompts, AI drafting aids (rationale/confidence),
//    competitor notes/aliases/sources.
export const publicApiRouter = Router();

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested).

/** Parse & validate pagination params. Defaults page 1 / per_page 25; per_page
 *  capped at 100. Returns an error message for any non-positive-integer input. */
export function parsePagination(
  pageRaw: unknown,
  perPageRaw: unknown
): { ok: true; page: number; per_page: number } | { ok: false; error: string } {
  const err = {
    ok: false as const,
    error: "page and per_page must be positive integers (per_page â‰¤ 100)",
  };
  const parse = (v: unknown, dflt: number): number | null => {
    if (v === undefined || v === "") return dflt;
    const s = String(v);
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  };
  const page = parse(pageRaw, 1);
  const perPageParsed = parse(perPageRaw, 25);
  if (page === null || perPageParsed === null) return err;
  if (perPageParsed > 100) return err;
  return { ok: true, page, per_page: perPageParsed };
}

/** total_pages = ceil(total / per_page); 0 when total is 0. */
export function buildMeta(page: number, per_page: number, total: number) {
  return {
    page,
    per_page,
    total,
    total_pages: total === 0 ? 0 : Math.ceil(total / per_page),
  };
}

/** ISO 8601 validity (a Date that round-trips). */
export function isValidIso(s: string): boolean {
  if (typeof s !== "string" || s.trim() === "") return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

export type RenderFormat = "html" | "svg" | "deck" | "email" | "markdown" | "digest";

/** Content-Type + file extension per render format (Â§3.1 table). "digest" is the
 *  wrapped-HTML fallback for a final asset with no render row. */
export function downloadContentType(format: RenderFormat): { contentType: string; ext: string } {
  switch (format) {
    case "markdown":
      return { contentType: "text/markdown; charset=utf-8", ext: "md" };
    case "svg":
      return { contentType: "image/svg+xml", ext: "svg" };
    case "html":
    case "deck":
    case "email":
    case "digest":
    default:
      return { contentType: "text/html; charset=utf-8", ext: "html" };
  }
}

/** Kebab slug matching artifacts.ts:526. */
export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

/** Resolve a name filter to matching ids in `table`. Empty array (no match) is a
 *  valid "return nothing" signal â€” never an error. */
async function idsByName(
  sb: NonNullable<ReturnType<typeof supabase>>,
  table: "products" | "competitors",
  name: string
): Promise<string[]> {
  const { data } = await sb.from(table).select("id").ilike("name", `%${name}%`);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

function flattenName(joined: { name: string } | { name: string }[] | null | undefined): string | null {
  const j = Array.isArray(joined) ? joined[0] : joined;
  return j?.name ?? null;
}

// ===========================================================================
// Unauthenticated documentation (Â§6). Both live under /api/public so the Vite
// dev proxy serves them; neither exposes any data.

// Built once at module load (the spec is a constant).
const DOCS_HTML = renderDocsHtml(OPENAPI_SPEC);

publicApiRouter.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8").send(DOCS_HTML);
});

publicApiRouter.get("/v1/openapi.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json").send(JSON.stringify(OPENAPI_SPEC));
});

// ===========================================================================
// Â§3.1 Assets â€” scope assets:read

publicApiRouter.get("/v1/assets", requireApiKey("assets:read"), async (req, res) => {
  const sb = supabase()!;
  const { asset_type, product, updated_since } = req.query as Record<string, string | undefined>;

  const pg = parsePagination(req.query.page, req.query.per_page);
  if (!pg.ok) return res.status(400).json({ error: pg.error });
  if (updated_since !== undefined && !isValidIso(updated_since)) {
    return res.status(400).json({ error: "updated_since must be an ISO 8601 timestamp" });
  }

  let query = sb
    .from("artifacts")
    .select(
      "id, title, asset_type, persona, vertical, current_version, created_at, updated_at, products(name)",
      { count: "exact" }
    )
    .eq("status", "final")
    .order("updated_at", { ascending: false });

  if (asset_type) query = query.eq("asset_type", asset_type);
  if (updated_since) query = query.gte("updated_at", updated_since);
  if (product) {
    const ids = await idsByName(sb, "products", product);
    if (ids.length === 0) {
      return res.json({ data: [], meta: buildMeta(pg.page, pg.per_page, 0) });
    }
    query = query.in("product_id", ids);
  }

  query = query.range((pg.page - 1) * pg.per_page, pg.page * pg.per_page - 1);
  const { data, error, count } = await query;
  if (error) return res.status(503).json({ error: "Service unavailable" });

  const rows = (data ?? []) as Record<string, unknown>[];
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      asset_type: r.asset_type,
      product: flattenName(r.products as { name: string } | null),
      persona: r.persona ?? null,
      vertical: r.vertical ?? null,
      version: r.current_version,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    meta: buildMeta(pg.page, pg.per_page, count ?? 0),
  });
});

/** Finals-only artifact fetch shared by detail + download. null â†’ 404. */
async function fetchFinalArtifact(id: string) {
  const sb = supabase()!;
  const { data } = await sb
    .from("artifacts")
    .select(
      "id, title, asset_type, persona, vertical, current_version, created_at, updated_at, products(name)"
    )
    .eq("id", id)
    .eq("status", "final")
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

publicApiRouter.get("/v1/assets/:id", requireApiKey("assets:read"), async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchFinalArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Asset not found" });

  const version = artifact.current_version as number;
  const { data: current } = await sb
    .from("artifact_versions")
    .select("content_html")
    .eq("artifact_id", artifact.id)
    .eq("version", version)
    .maybeSingle();

  const { data: render } = await sb
    .from("artifact_renders")
    .select("format, templates(name), messaging_docs(title, version)")
    .eq("artifact_id", artifact.id)
    .eq("version", version)
    .maybeSingle();

  const renderRow = render as
    | {
        format: string;
        templates: { name: string } | { name: string }[] | null;
        messaging_docs: { title: string; version: number } | { title: string; version: number }[] | null;
      }
    | null;
  const tpl = renderRow ? (Array.isArray(renderRow.templates) ? renderRow.templates[0] : renderRow.templates) : null;
  const mdoc = renderRow
    ? Array.isArray(renderRow.messaging_docs)
      ? renderRow.messaging_docs[0]
      : renderRow.messaging_docs
    : null;

  res.json({
    data: {
      id: artifact.id,
      title: artifact.title,
      asset_type: artifact.asset_type,
      product: flattenName(artifact.products as { name: string } | null),
      persona: artifact.persona ?? null,
      vertical: artifact.vertical ?? null,
      version,
      created_at: artifact.created_at,
      updated_at: artifact.updated_at,
      content_html: current?.content_html ?? "",
      // Every final asset is downloadable â€” a render row when present, else the
      // wrapped-HTML "digest" fallback.
      download: { available: true, format: (renderRow?.format ?? "digest") as RenderFormat },
      provenance: {
        template: tpl?.name ?? null,
        messaging_doc: mdoc ? { title: mdoc.title, version: mdoc.version } : null,
      },
    },
  });
});

publicApiRouter.get("/v1/assets/:id/download", requireApiKey("assets:read"), async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchFinalArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Asset not found" });

  const version = artifact.current_version as number;
  const title = String(artifact.title ?? "asset");
  const slug = slugify(title);

  const { data: render } = await sb
    .from("artifact_renders")
    .select("format, payload")
    .eq("artifact_id", artifact.id)
    .eq("version", version)
    .maybeSingle();

  let format: RenderFormat;
  let body: string;
  if (render && typeof (render as { payload: string }).payload === "string") {
    format = ((render as { format: string }).format || "html") as RenderFormat;
    body = (render as { payload: string }).payload;
  } else {
    // Fallback: wrap the current version's content_html into a branded document.
    const { data: current } = await sb
      .from("artifact_versions")
      .select("content_html")
      .eq("artifact_id", artifact.id)
      .eq("version", version)
      .maybeSingle();
    format = "digest";
    body = wrapExportHtml(title, current?.content_html ?? "<p></p>", "Hive by Aurigo");
  }

  const { contentType, ext } = downloadContentType(format);
  res
    .status(200)
    .setHeader("Content-Type", contentType)
    .setHeader("Content-Disposition", `attachment; filename="${slug}.${ext}"`)
    .send(body);
});

// ===========================================================================
// Â§3.2 Messaging docs â€” scope messaging:read

publicApiRouter.get("/v1/messaging-docs", requireApiKey("messaging:read"), async (req, res) => {
  const sb = supabase()!;
  const { product } = req.query as Record<string, string | undefined>;

  const pg = parsePagination(req.query.page, req.query.per_page);
  if (!pg.ok) return res.status(400).json({ error: pg.error });

  let query = sb
    .from("messaging_docs")
    .select("id, version, title, approved_at, created_at, products(name)", { count: "exact" })
    .eq("status", "final")
    .order("approved_at", { ascending: false });

  if (product) {
    const ids = await idsByName(sb, "products", product);
    if (ids.length === 0) {
      return res.json({ data: [], meta: buildMeta(pg.page, pg.per_page, 0) });
    }
    query = query.in("product_id", ids);
  }

  query = query.range((pg.page - 1) * pg.per_page, pg.page * pg.per_page - 1);
  const { data, error, count } = await query;
  if (error) return res.status(503).json({ error: "Service unavailable" });

  const rows = (data ?? []) as Record<string, unknown>[];
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      product: flattenName(r.products as { name: string } | null),
      version: r.version,
      title: r.title,
      approved_at: r.approved_at ?? null,
      created_at: r.created_at,
    })),
    meta: buildMeta(pg.page, pg.per_page, count ?? 0),
  });
});

publicApiRouter.get("/v1/messaging-docs/:id", requireApiKey("messaging:read"), async (req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("messaging_docs")
    .select("id, version, title, approved_at, created_at, sections, content_html, products(name)")
    .eq("id", req.params.id)
    .eq("status", "final")
    .maybeSingle();
  if (error) return res.status(503).json({ error: "Service unavailable" });
  if (!data) return res.status(404).json({ error: "Messaging document not found" });

  const r = data as Record<string, unknown>;
  res.json({
    data: {
      id: r.id,
      product: flattenName(r.products as { name: string } | null),
      version: r.version,
      title: r.title,
      approved_at: r.approved_at ?? null,
      created_at: r.created_at,
      sections: r.sections ?? [],
      content_html: r.content_html ?? "",
    },
  });
});

// ===========================================================================
// Â§3.3 Competitive intel â€” scope intel:read. Only registry facts, FINAL CI
// reports, and FINAL market threats ship. Comparisons, news, events,
// frameworks, digests, positioning maps, and competitor notes/aliases/sources
// have NO route here (Â§4.3).

publicApiRouter.get("/v1/intel/competitors", requireApiKey("intel:read"), async (_req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("competitors")
    .select("id, name, category, website, aurigo_product")
    .order("name");
  if (error) return res.status(503).json({ error: "Service unavailable" });
  const rows = (data ?? []) as Record<string, unknown>[];
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category ?? null,
      website: r.website ?? null,
      aurigo_product: r.aurigo_product ?? null,
    })),
    meta: { total: rows.length },
  });
});

publicApiRouter.get("/v1/intel/reports", requireApiKey("intel:read"), async (req, res) => {
  const sb = supabase()!;
  const { competitor } = req.query as Record<string, string | undefined>;

  const pg = parsePagination(req.query.page, req.query.per_page);
  if (!pg.ok) return res.status(400).json({ error: pg.error });

  let query = sb
    .from("ci_reports")
    .select("id, title, aurigo_product, approved_at, created_at, competitors(name)", {
      count: "exact",
    })
    .eq("status", "final")
    .order("approved_at", { ascending: false });

  if (competitor) {
    const ids = await idsByName(sb, "competitors", competitor);
    if (ids.length === 0) {
      return res.json({ data: [], meta: buildMeta(pg.page, pg.per_page, 0) });
    }
    query = query.in("competitor_id", ids);
  }

  query = query.range((pg.page - 1) * pg.per_page, pg.page * pg.per_page - 1);
  const { data, error, count } = await query;
  if (error) return res.status(503).json({ error: "Service unavailable" });

  const rows = (data ?? []) as Record<string, unknown>[];
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      competitor: flattenName(r.competitors as { name: string } | null),
      aurigo_product: r.aurigo_product ?? null,
      approved_at: r.approved_at ?? null,
      created_at: r.created_at,
    })),
    meta: buildMeta(pg.page, pg.per_page, count ?? 0),
  });
});

publicApiRouter.get("/v1/intel/reports/:id", requireApiKey("intel:read"), async (req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("ci_reports")
    .select("id, title, aurigo_product, approved_at, created_at, content_html, competitors(name)")
    .eq("id", req.params.id)
    .eq("status", "final")
    .maybeSingle();
  if (error) return res.status(503).json({ error: "Service unavailable" });
  if (!data) return res.status(404).json({ error: "Report not found" });

  const r = data as Record<string, unknown>;
  res.json({
    data: {
      id: r.id,
      title: r.title,
      competitor: flattenName(r.competitors as { name: string } | null),
      aurigo_product: r.aurigo_product ?? null,
      approved_at: r.approved_at ?? null,
      created_at: r.created_at,
      content_html: r.content_html ?? "",
    },
  });
});

publicApiRouter.get("/v1/intel/threats", requireApiKey("intel:read"), async (_req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("market_threats")
    .select("id, name, category, aurigo_product, summary_html, source_url, approved_at")
    .eq("status", "final")
    .order("approved_at", { ascending: false });
  if (error) return res.status(503).json({ error: "Service unavailable" });
  const rows = (data ?? []) as Record<string, unknown>[];
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category ?? null,
      aurigo_product: r.aurigo_product ?? null,
      summary_html: r.summary_html ?? "",
      source_url: r.source_url ?? null,
      approved_at: r.approved_at ?? null,
    })),
    meta: { total: rows.length },
  });
});

// ===========================================================================
// Â§3.4 Ask â€” scope ask. Router disabled by construction: classifyAsk is never
// imported here; answerQuestion is called with role "general". No trace, no
// routing proposals. External-safe error strings only.

publicApiRouter.post("/v1/ask", requireApiKey("ask"), async (req, res) => {
  const { question } = (req.body ?? {}) as { question?: unknown };
  if (typeof question !== "string" || question.trim() === "" || question.length > 2000) {
    return res.status(400).json({ error: "question is required (string, â‰¤ 2000 characters)" });
  }

  let answer: string;
  try {
    const result = await answerQuestion(question, "general");
    answer = result.answer;
  } catch (err) {
    // Internal detail stays in the server console (07-security: errors never
    // leak internals). AgentError = ask-war-room disabled/unavailable.
    console.error("[public ask] failed:", (err as Error).message);
    if (err instanceof AgentError) {
      return res.status(503).json({ error: "Ask is temporarily unavailable" });
    }
    return res.status(502).json({ error: "The answer could not be generated â€” try again" });
  }

  void logQuery("api", question, answer); // C11/C13 metrics â€” API demand in the same stream
  res.json({
    data: {
      question,
      answer_markdown: answer,
      answer_html: markdownToHtml(answer),
    },
  });
});
