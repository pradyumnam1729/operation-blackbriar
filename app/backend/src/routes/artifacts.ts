import { Router } from "express";
import { isAdmin, requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { cleanHtml, htmlToText } from "../services/html";
import { logActivity } from "../services/activity";
import { diffVersionsHtml } from "../services/versionDiff";
import { checkForbiddenWords } from "../services/guardrails";

// Artifact Library: versioned rich-content assets. All content is sanitized
// HTML — markdown never crosses this boundary. Non-admin roles (sales,
// marketing, elt) only see finalized artifacts, plus their own drafts.
export const artifactsRouter = Router();

const STATUSES = ["draft", "in_review", "final", "archived"] as const;
type ArtifactStatus = (typeof STATUSES)[number];

/** Allowed lifecycle moves (admin-only endpoint enforces these). */
const TRANSITIONS: Record<ArtifactStatus, ArtifactStatus[]> = {
  draft: ["in_review", "archived"],
  in_review: ["draft", "final", "archived"],
  final: ["in_review", "archived"],
  archived: ["draft"],
};

const ARTIFACT_COLS =
  "id, title, asset_type, product_id, persona, status, request_id, template_id, prompt_id, current_version, created_by, created_at, updated_at";

interface ArtifactRow {
  id: string;
  title: string;
  asset_type: string;
  product_id: string | null;
  persona: string | null;
  status: ArtifactStatus;
  request_id: string | null;
  template_id: string | null;
  prompt_id: string | null;
  current_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  products?: { name: string } | { name: string }[] | null;
}

/** Flatten the products(name) join into product_name. */
function flatten(row: ArtifactRow) {
  const { products, ...rest } = row;
  const joined = Array.isArray(products) ? products[0] : products;
  return { ...rest, product_name: joined?.name ?? null };
}

async function fetchArtifact(id: string): Promise<ArtifactRow | null> {
  const sb = supabase()!;
  const { data } = await sb
    .from("artifacts")
    .select(`${ARTIFACT_COLS}, products(name)`)
    .eq("id", id)
    .maybeSingle();
  return (data as ArtifactRow | null) ?? null;
}

function canRead(userId: string, admin: boolean, artifact: ArtifactRow): boolean {
  return admin || artifact.status === "final" || artifact.created_by === userId;
}

function canEdit(userId: string, admin: boolean, artifact: ArtifactRow): boolean {
  return admin || artifact.created_by === userId;
}

// ---------- list ----------
// GET /api/artifacts?product_id=&asset_type=&persona=&status=&q=&mine=1
artifactsRouter.get("/", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { product_id, asset_type, persona, status, q, mine } = req.query as Record<
    string,
    string | undefined
  >;
  const admin = isAdmin(req);

  let query = sb
    .from("artifacts")
    .select(`${ARTIFACT_COLS}, products(name)`)
    .order("updated_at", { ascending: false });

  if (product_id) query = query.eq("product_id", product_id);
  if (asset_type) query = query.eq("asset_type", asset_type);
  if (persona) query = query.ilike("persona", `%${persona}%`);
  if (q) query = query.ilike("title", `%${q}%`);

  if (mine === "1") {
    // "My artifacts" — any status, but only ones this user created.
    query = query.eq("created_by", req.user!.id);
    if (status && STATUSES.includes(status as ArtifactStatus)) {
      query = query.eq("status", status);
    }
  } else if (admin) {
    if (status && STATUSES.includes(status as ArtifactStatus)) {
      query = query.eq("status", status);
    }
  } else {
    // Consumers only ever browse finalized artifacts.
    query = query.eq("status", "final");
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ artifacts: ((data ?? []) as ArtifactRow[]).map(flatten) });
});

// ---------- create ----------
// POST /api/artifacts { title, asset_type, product_id, persona, request_id?, template_id?, prompt_id?, content_html? }
artifactsRouter.post("/", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { title, asset_type, product_id, persona, request_id, template_id, prompt_id, content_html } =
    req.body as {
      title?: string;
      asset_type?: string;
      product_id?: string;
      persona?: string;
      request_id?: string;
      template_id?: string;
      prompt_id?: string;
      content_html?: string;
    };
  if (!title || title.trim() === "") return res.status(400).json({ error: "title is required" });
  if (!asset_type || asset_type.trim() === "")
    return res.status(400).json({ error: "asset_type is required" });

  const html = cleanHtml(content_html ?? "<p></p>");

  const { data: artifact, error } = await sb
    .from("artifacts")
    .insert({
      title: title.trim(),
      asset_type,
      product_id: product_id ?? null,
      persona: persona ?? null,
      request_id: request_id ?? null,
      template_id: template_id ?? null,
      prompt_id: prompt_id ?? null,
      current_version: 1,
      status: "draft",
      created_by: req.user!.id,
    })
    .select(ARTIFACT_COLS)
    .single();
  if (error || !artifact) {
    return res.status(500).json({ error: error?.message ?? "Insert failed" });
  }

  const { error: vErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: 1,
    content_html: html,
    note: "Initial version",
    created_by: req.user!.id,
  });
  if (vErr) return res.status(500).json({ error: vErr.message });

  void logActivity("artifact", artifact.id, req.user!.id, "created", { title, asset_type });
  res.status(201).json({ artifact });
});

// ---------- detail ----------
// GET /api/artifacts/:id → artifact + version metadata + current content
artifactsRouter.get("/:id", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canRead(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "This artifact is not finalized yet — only its creator and PMM admins can view it." });
  }

  const { data: versions, error: vErr } = await sb
    .from("artifact_versions")
    .select("id, version, note, created_by, created_at")
    .eq("artifact_id", artifact.id)
    .order("version", { ascending: false });
  if (vErr) return res.status(500).json({ error: vErr.message });

  const { data: current } = await sb
    .from("artifact_versions")
    .select("content_html")
    .eq("artifact_id", artifact.id)
    .eq("version", artifact.current_version)
    .maybeSingle();

  res.json({
    artifact: flatten(artifact),
    versions: versions ?? [],
    contentHtml: current?.content_html ?? "",
  });
});

// ---------- single version content ----------
// GET /api/artifacts/:id/versions/:v
artifactsRouter.get("/:id/versions/:v", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canRead(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Not authorized to view this artifact" });
  }
  const v = Number(req.params.v);
  if (!Number.isInteger(v) || v < 1) return res.status(400).json({ error: "Invalid version number" });

  const { data, error } = await sb
    .from("artifact_versions")
    .select("version, content_html, note, created_at")
    .eq("artifact_id", artifact.id)
    .eq("version", v)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: `Version ${v} not found` });
  res.json({ version: data });
});

// ---------- save new version ----------
// POST /api/artifacts/:id/versions { content_html, note? }
artifactsRouter.post("/:id/versions", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canEdit(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Only the creator or a PMM admin can edit this artifact" });
  }

  const { content_html, note } = req.body as { content_html?: string; note?: string };
  if (content_html === undefined) return res.status(400).json({ error: "content_html is required" });

  const html = cleanHtml(content_html);
  const newVersion = artifact.current_version + 1;

  const { error: vErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: newVersion,
    content_html: html,
    note: note?.trim() || null,
    created_by: req.user!.id,
  });
  if (vErr) return res.status(500).json({ error: vErr.message });

  const { error: uErr } = await sb
    .from("artifacts")
    .update({ current_version: newVersion, updated_at: new Date().toISOString() })
    .eq("id", artifact.id);
  if (uErr) return res.status(500).json({ error: uErr.message });

  void logActivity("artifact", artifact.id, req.user!.id, "version_saved", {
    version: newVersion,
    note: note ?? null,
  });
  res.status(201).json({ version: newVersion });
});

// ---------- diff two versions ----------
// GET /api/artifacts/:id/diff?from=1&to=2 → { diffHtml }
artifactsRouter.get("/:id/diff", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canRead(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Not authorized to view this artifact" });
  }

  const from = Number(req.query.from);
  const to = Number(req.query.to);
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return res.status(400).json({ error: "from and to version numbers are required" });
  }

  const { data, error } = await sb
    .from("artifact_versions")
    .select("version, content_html")
    .eq("artifact_id", artifact.id)
    .in("version", [from, to]);
  if (error) return res.status(500).json({ error: error.message });

  const rows = (data ?? []) as { version: number; content_html: string }[];
  const oldV = rows.find((r) => r.version === from);
  const newV = rows.find((r) => r.version === to);
  if (!oldV || !newV) return res.status(404).json({ error: "One or both versions not found" });

  res.json({ diffHtml: diffVersionsHtml(oldV.content_html, newV.content_html) });
});

// ---------- rollback (copies old content forward as a NEW version) ----------
// POST /api/artifacts/:id/rollback { to }
artifactsRouter.post("/:id/rollback", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canEdit(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Only the creator or a PMM admin can roll back this artifact" });
  }

  const to = Number((req.body as { to?: number }).to);
  if (!Number.isInteger(to) || to < 1) return res.status(400).json({ error: "to version is required" });

  const { data: target, error: tErr } = await sb
    .from("artifact_versions")
    .select("content_html")
    .eq("artifact_id", artifact.id)
    .eq("version", to)
    .maybeSingle();
  if (tErr) return res.status(500).json({ error: tErr.message });
  if (!target) return res.status(404).json({ error: `Version ${to} not found` });

  const newVersion = artifact.current_version + 1;
  const { error: vErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: newVersion,
    content_html: target.content_html,
    note: `Rolled back to v${to}`,
    created_by: req.user!.id,
  });
  if (vErr) return res.status(500).json({ error: vErr.message });

  const { error: uErr } = await sb
    .from("artifacts")
    .update({ current_version: newVersion, updated_at: new Date().toISOString() })
    .eq("id", artifact.id);
  if (uErr) return res.status(500).json({ error: uErr.message });

  void logActivity("artifact", artifact.id, req.user!.id, "rolled_back", {
    to,
    newVersion,
  });
  res.status(201).json({ version: newVersion });
});

// ---------- status transitions (admin only, guardrail-gated into final) ----------
// POST /api/artifacts/:id/status { status }
artifactsRouter.post("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });

  const status = (req.body as { status?: string }).status as ArtifactStatus | undefined;
  if (!status || !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }
  if (!TRANSITIONS[artifact.status].includes(status)) {
    return res.status(400).json({
      error: `Cannot move from '${artifact.status}' to '${status}'. Allowed: ${TRANSITIONS[artifact.status].join(", ") || "none"}`,
    });
  }

  // Deterministic voice guard before anything goes final.
  if (status === "final") {
    const { data: current } = await sb
      .from("artifact_versions")
      .select("content_html")
      .eq("artifact_id", artifact.id)
      .eq("version", artifact.current_version)
      .maybeSingle();
    const guard = checkForbiddenWords(htmlToText(current?.content_html ?? ""));
    if (!guard.ok) {
      return res.status(422).json({
        error: `Cannot finalize — banned words found: ${guard.violations.join(", ")}`,
        violations: guard.violations,
      });
    }
  }

  const { data: updated, error } = await sb
    .from("artifacts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", artifact.id)
    .select(ARTIFACT_COLS)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  void logActivity("artifact", artifact.id, req.user!.id, "status_changed", {
    from: artifact.status,
    to: status,
  });
  res.json({ artifact: updated });
});

// ---------- delete (admin only; versions cascade) ----------
artifactsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });

  const { error } = await sb.from("artifacts").delete().eq("id", artifact.id);
  if (error) return res.status(500).json({ error: error.message });

  void logActivity("artifact", artifact.id, req.user!.id, "deleted", { title: artifact.title });
  res.json({ ok: true });
});
