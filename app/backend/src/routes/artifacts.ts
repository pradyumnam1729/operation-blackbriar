import { Router } from "express";
import { isAdmin, requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { cleanHtml, htmlToText } from "../services/html";
import { logActivity } from "../services/activity";
import { diffVersionsHtml } from "../services/versionDiff";
import { checkForbiddenWords } from "../services/guardrails";
import { TemplateGenError, reRenderWithFills } from "../services/templateGenerate";
import { DeckDoc, deckToText, slidesToHtml, validateDeckDoc } from "../services/deck";
import { buildDeckPptx } from "../services/deckPptx";
import { markdownToHtml } from "../services/html";
import { ask } from "../services/claude";
import {
  ChatTurn,
  DeckAiParseError,
  chatEditSlides,
  htmlToSlides,
} from "../services/deckAi";

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
    .select("content_html, slides_json")
    .eq("artifact_id", artifact.id)
    .eq("version", artifact.current_version)
    .maybeSingle();

  // Template-generated artifacts carry raw renders (blueprint §2) — the editor
  // mounts the render surface instead of the rich editor when one exists.
  const { count: renderCount } = await sb
    .from("artifact_renders")
    .select("id", { count: "exact", head: true })
    .eq("artifact_id", artifact.id);

  res.json({
    artifact: flatten(artifact),
    versions: versions ?? [],
    contentHtml: current?.content_html ?? "",
    hasRender: (renderCount ?? 0) > 0,
    // Deck Studio (deck-studio.md §4.1): current version's structured slides.
    slides: (current?.slides_json as DeckDoc | null) ?? null,
  });
});

// ---------- render payload (template-generated artifacts) ----------
// GET /api/artifacts/:id/render?version= → { render } (renders inherit the artifact's visibility)
artifactsRouter.get("/:id/render", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canRead(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Not authorized to view this artifact" });
  }

  let version = artifact.current_version;
  if (req.query.version !== undefined) {
    const v = Number(req.query.version);
    if (!Number.isInteger(v) || v < 1) return res.status(400).json({ error: "Invalid version number" });
    version = v;
  }

  const { data, error } = await sb
    .from("artifact_renders")
    .select("format, payload, slot_fills, warnings, template_id, template_version, messaging_doc_id")
    .eq("artifact_id", artifact.id)
    .eq("version", version)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "No render for this artifact" });
  res.json({ render: data });
});

// ---------- slot edits (deterministic re-render, no model call) ----------
// POST /api/artifacts/:id/slots { fills: {slot_id: text}, note? }
artifactsRouter.post("/:id/slots", requireAuth, async (req, res) => {
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canEdit(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Only the creator or a PMM admin can edit this artifact" });
  }

  const { fills, note } = req.body as { fills?: Record<string, unknown>; note?: string };
  if (!fills || typeof fills !== "object" || Array.isArray(fills)) {
    return res.status(400).json({ error: "fills object is required" });
  }
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(fills)) {
    if (typeof value === "string") clean[key] = value;
  }

  try {
    const { version } = await reRenderWithFills(artifact.id, clean, note, req.user!.id);
    res.status(201).json({ version });
  } catch (err) {
    if (err instanceof TemplateGenError) {
      return res
        .status(err.status)
        .json(err.over ? { error: err.message, over: err.over } : { error: err.message });
    }
    res.status(500).json({ error: (err as Error).message });
  }
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
    .select("version, content_html, slides_json, note, created_at")
    .eq("artifact_id", artifact.id)
    .eq("version", v)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: `Version ${v} not found` });
  const { slides_json, ...rest } = data as { slides_json: DeckDoc | null } & Record<string, unknown>;
  res.json({ version: { ...rest, slides: slides_json ?? null } });
});

// ---------- save new version ----------
// POST /api/artifacts/:id/versions — exactly one of { content_html } | { slides }
// (deck-studio.md §4.2). Deck saves derive content_html server-side; the guard
// result rides the response but never blocks a draft save (§0.1-5).
artifactsRouter.post("/:id/versions", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canEdit(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Only the creator or a PMM admin can edit this artifact" });
  }

  const { content_html, slides, note } = req.body as {
    content_html?: string;
    slides?: unknown;
    note?: string;
  };
  if ((content_html === undefined) === (slides === undefined)) {
    return res.status(400).json({ error: "Provide exactly one of content_html or slides" });
  }

  let html: string;
  let slidesJson: DeckDoc | null = null;
  let guardText: string;
  if (slides !== undefined) {
    // Slides are a deck-only structure. Template-rendered artifacts only
    // accept slides once converted (their CURRENT version carries slides_json)
    // — a slot-fill artifact mid-render never silently switches worlds.
    if (artifact.asset_type !== "deck") {
      return res.status(409).json({ error: "Only deck artifacts accept structured slides" });
    }
    const { data: currentVer } = await sb
      .from("artifact_versions")
      .select("slides_json")
      .eq("artifact_id", artifact.id)
      .eq("version", artifact.current_version)
      .maybeSingle();
    if (!currentVer?.slides_json) {
      const { count: renderCount } = await sb
        .from("artifact_renders")
        .select("id", { count: "exact", head: true })
        .eq("artifact_id", artifact.id);
      if ((renderCount ?? 0) > 0) {
        return res.status(409).json({
          error: "This template deck has no structured slides yet — use Convert to slides first",
        });
      }
    }
    const result = validateDeckDoc(slides);
    if ("issues" in result) {
      return res.status(400).json({ error: "Invalid slides", issues: result.issues });
    }
    slidesJson = result.deck;
    html = slidesToHtml(result.deck); // client HTML is never trusted for decks
    guardText = deckToText(result.deck);
  } else {
    html = cleanHtml(content_html!);
    guardText = htmlToText(html);
  }

  const newVersion = artifact.current_version + 1;
  const { error: vErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: newVersion,
    content_html: html,
    slides_json: slidesJson,
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
  res.status(201).json({ version: newVersion, guard: checkForbiddenWords(guardText) });
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
    .select("content_html, slides_json")
    .eq("artifact_id", artifact.id)
    .eq("version", to)
    .maybeSingle();
  if (tErr) return res.status(500).json({ error: tErr.message });
  if (!target) return res.status(404).json({ error: `Version ${to} not found` });

  const newVersion = artifact.current_version + 1;
  // slides_json rides along (deck-studio.md §4.7) — otherwise rolling back a
  // deck silently strips its structure and kills .pptx export.
  const { error: vErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: newVersion,
    content_html: target.content_html,
    slides_json: target.slides_json ?? null,
    note: `Rolled back to v${to}`,
    created_by: req.user!.id,
  });
  if (vErr) return res.status(500).json({ error: vErr.message });

  // Template-rendered artifacts: carry the target version's render forward too,
  // else the rollback silently strips the rendered payload (export would fall
  // back to the digest with no warning).
  const { data: targetRender } = await sb
    .from("artifact_renders")
    .select("format, payload, slot_fills, warnings, template_version, messaging_doc_id")
    .eq("artifact_id", artifact.id)
    .eq("version", to)
    .maybeSingle();
  if (targetRender) {
    const { error: rErr } = await sb.from("artifact_renders").insert({
      artifact_id: artifact.id,
      version: newVersion,
      ...targetRender,
    });
    if (rErr) return res.status(500).json({ error: rErr.message });
  }

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

// ---------- .pptx export (deck-studio.md §4.3) ----------
// GET /api/artifacts/:id/export.pptx?version= — canRead; finals exportable by every role.
artifactsRouter.get("/:id/export.pptx", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canRead(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Not authorized to view this artifact" });
  }

  let version = artifact.current_version;
  if (req.query.version !== undefined) {
    const v = Number(req.query.version);
    if (!Number.isInteger(v) || v < 1) return res.status(400).json({ error: "Invalid version number" });
    version = v;
  }

  const { data: row, error: rowErr } = await sb
    .from("artifact_versions")
    .select("slides_json")
    .eq("artifact_id", artifact.id)
    .eq("version", version)
    .maybeSingle();
  if (rowErr) return res.status(500).json({ error: rowErr.message });
  if (!row) return res.status(404).json({ error: `Version ${version} not found` });
  const deck = (row.slides_json as DeckDoc | null) ?? null;
  if (!deck) {
    return res
      .status(409)
      .json({ error: "This deck has no structured slides yet — convert it to slides first." });
  }

  try {
    const buffer = await buildDeckPptx(deck, artifact.title, flatten(artifact).product_name);
    const kebab = artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "deck";
    void logActivity("artifact", artifact.id, req.user!.id, "exported_pptx", { version });
    res
      .status(200)
      .setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
      .setHeader("Content-Disposition", `attachment; filename="${kebab}-v${version}.pptx"`)
      .send(buffer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------- conversational AI editing (deck-studio.md §4.4) ----------
// POST /api/artifacts/:id/chat-edit { message, scope?, history? }
artifactsRouter.post("/:id/chat-edit", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canEdit(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Only the creator or a PMM admin can edit this artifact" });
  }

  const { message, scope, history } = req.body as {
    message?: string;
    scope?: string;
    history?: ChatTurn[];
  };
  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "message is required" });
  }
  const turns: ChatTurn[] = Array.isArray(history)
    ? history
        .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
        .slice(-6)
    : [];

  // Render branch: template-generated artifacts (slot-fill datasheets etc.)
  // chat-edit through the SLOT pipeline — the model proposes new slot fills,
  // reRenderWithFills re-renders the styled file deterministically, and the
  // rendered view the user sees always reflects the chat edit.
  const { data: renderRow } = await sb
    .from("artifact_renders")
    .select("slot_fills, template_id")
    .eq("artifact_id", artifact.id)
    .eq("version", artifact.current_version)
    .maybeSingle();
  if (renderRow?.template_id) {
    const { data: tpl } = await sb
      .from("templates")
      .select("slots")
      .eq("id", renderRow.template_id)
      .maybeSingle();
    const slots = ((tpl?.slots ?? []) as {
      id: string;
      label: string;
      purpose: string;
      max_chars: number;
    }[]).filter((s) => s && typeof s.id === "string");
    if (slots.length > 0) {
      const fills = (renderRow.slot_fills ?? {}) as Record<string, string>;
      const historyBlock =
        turns.length > 0
          ? `Recent conversation (context only):\n${turns
              .map((t) => `${t.role === "user" ? "User" : "You"}: ${t.text}`)
              .join("\n")}\n\n`
          : "";
      try {
        const raw = await ask(
          [
            "You are editing a templated marketing asset by rewriting its text slots. Apply the user's instruction and return ONLY a JSON object:",
            '{"summary": "≤120 chars, imperative past tense", "fills": {"<slot_id>": "new plain text", …}}',
            "Rules:",
            "- Include ONLY the slots you changed. Never invent customer names, quotes, or numbers not already present.",
            "- Respect each slot's max_chars hard limit. Plain text only — no markdown, no HTML.",
            historyBlock,
            `=== SLOTS (id, label, purpose, max_chars, current text) ===\n${JSON.stringify(
              slots.map((s) => ({
                id: s.id,
                label: s.label,
                purpose: s.purpose,
                max_chars: s.max_chars,
                current: fills[s.id] ?? "",
              }))
            )}`,
            `=== USER INSTRUCTION ===\n${message.trim()}`,
          ]
            .filter((s) => s !== "")
            .join("\n\n"),
          { maxTokens: 4000 }
        );

        let text = raw.trim();
        const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fence) text = fence[1].trim();
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start === -1 || end <= start) throw new DeckAiParseError(["no JSON object in reply"]);
        let outer: Record<string, unknown>;
        try {
          outer = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
        } catch (parseErr) {
          throw new DeckAiParseError([`JSON parse failed: ${(parseErr as Error).message}`]);
        }
        const summary =
          typeof outer.summary === "string" && outer.summary.trim() !== ""
            ? outer.summary.trim().slice(0, 120)
            : "AI edit";
        const byId = new Map(slots.map((s) => [s.id, s]));
        const changed: Record<string, string> = {};
        for (const [key, value] of Object.entries(
          (outer.fills ?? {}) as Record<string, unknown>
        )) {
          const slot = byId.get(key);
          if (!slot || typeof value !== "string") continue;
          changed[key] = value.trim().slice(0, slot.max_chars);
        }
        if (Object.keys(changed).length === 0) {
          return res.status(422).json({
            error: "The AI did not identify any slot to change — try a more specific instruction.",
          });
        }

        const { version } = await reRenderWithFills(
          artifact.id,
          changed,
          `AI: ${summary}`,
          req.user!.id
        );
        const { data: nv } = await sb
          .from("artifact_versions")
          .select("content_html")
          .eq("artifact_id", artifact.id)
          .eq("version", version)
          .maybeSingle();
        void logActivity("artifact", artifact.id, req.user!.id, "chat_edited", {
          version,
          summary,
          slots: Object.keys(changed),
        });
        return res.status(201).json({
          version,
          summary,
          guard: checkForbiddenWords(Object.values({ ...fills, ...changed }).join("\n")),
          slides: null,
          contentHtml: nv?.content_html ?? "",
          renderUpdated: true,
        });
      } catch (err) {
        if (err instanceof DeckAiParseError) {
          return res.status(422).json({
            error: "The AI reply could not be parsed into slot edits — no changes were saved.",
            issues: err.issues,
          });
        }
        if (err instanceof TemplateGenError) {
          return res
            .status(err.status)
            .json(err.over ? { error: err.message, over: err.over } : { error: err.message });
        }
        return res.status(502).json({ error: (err as Error).message });
      }
    }
  }

  const { data: current } = await sb
    .from("artifact_versions")
    .select("content_html, slides_json")
    .eq("artifact_id", artifact.id)
    .eq("version", artifact.current_version)
    .maybeSingle();
  const currentDeck = (current?.slides_json as DeckDoc | null) ?? null;

  try {
    let newHtml: string;
    let newSlides: DeckDoc | null = null;
    let summary: string;
    let guardText: string;

    if (currentDeck) {
      const requestedScope = scope?.trim() || "all";
      if (requestedScope !== "all" && !currentDeck.slides.some((s) => s.id === requestedScope)) {
        return res
          .status(404)
          .json({ error: `Slide '${requestedScope}' not found in the current version` });
      }
      const r = await chatEditSlides(currentDeck, message.trim(), requestedScope, turns);
      newSlides = r.deck;
      summary = r.summary;
      newHtml = slidesToHtml(r.deck);
      guardText = deckToText(r.deck);
    } else {
      // Document branch: full revised document in markdown, SUMMARY: first line.
      const historyBlock =
        turns.length > 0
          ? `Recent conversation (context only):\n${turns
              .map((t) => `${t.role === "user" ? "User" : "You"}: ${t.text}`)
              .join("\n")}\n\n`
          : "";
      const raw = await ask(
        [
          "You are editing a document. Apply the user's instruction to the FULL document and return the complete revised document in clean markdown.",
          "First line of your reply MUST be: SUMMARY: <one line, ≤120 chars, imperative past tense>. Everything after that line is the document.",
          "Never invent customer names, quotes, or numbers that are not already in the document.",
          historyBlock,
          `=== CURRENT DOCUMENT (HTML) ===\n${current?.content_html ?? ""}`,
          `=== USER INSTRUCTION ===\n${message.trim()}`,
        ].join("\n\n"),
        { maxTokens: 8000 }
      );
      const summaryMatch = raw.match(/^\s*SUMMARY:\s*(.+)$/m);
      summary = summaryMatch ? summaryMatch[1].trim().slice(0, 120) : "AI edit";
      const body = summaryMatch ? raw.slice(raw.indexOf(summaryMatch[0]) + summaryMatch[0].length) : raw;
      newHtml = markdownToHtml(body.trim());
      guardText = htmlToText(newHtml);
    }

    const newVersion = artifact.current_version + 1;
    const { error: vErr } = await sb.from("artifact_versions").insert({
      artifact_id: artifact.id,
      version: newVersion,
      content_html: newHtml,
      slides_json: newSlides,
      note: `AI: ${summary}`,
      created_by: req.user!.id,
    });
    if (vErr) return res.status(500).json({ error: vErr.message });
    const { error: uErr } = await sb
      .from("artifacts")
      .update({ current_version: newVersion, updated_at: new Date().toISOString() })
      .eq("id", artifact.id);
    if (uErr) return res.status(500).json({ error: uErr.message });

    void logActivity("artifact", artifact.id, req.user!.id, "chat_edited", {
      version: newVersion,
      summary,
    });
    res.status(201).json({
      version: newVersion,
      summary,
      guard: checkForbiddenWords(guardText),
      slides: newSlides,
      contentHtml: newHtml,
    });
  } catch (err) {
    if (err instanceof DeckAiParseError) {
      return res.status(422).json({
        error: "The AI reply could not be parsed into valid slides — no changes were saved.",
        issues: err.issues,
      });
    }
    res.status(502).json({ error: (err as Error).message });
  }
});

// ---------- legacy deck conversion (deck-studio.md §4.6) ----------
// POST /api/artifacts/:id/convert-to-slides
artifactsRouter.post("/:id/convert-to-slides", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const artifact = await fetchArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });
  if (!canEdit(req.user!.id, isAdmin(req), artifact)) {
    return res.status(403).json({ error: "Only the creator or a PMM admin can edit this artifact" });
  }
  if (artifact.asset_type !== "deck") {
    return res.status(409).json({ error: "Only deck artifacts can be converted to slides" });
  }

  const { data: current } = await sb
    .from("artifact_versions")
    .select("content_html, slides_json")
    .eq("artifact_id", artifact.id)
    .eq("version", artifact.current_version)
    .maybeSingle();
  if (current?.slides_json) {
    return res.status(409).json({ error: "This deck already has structured slides" });
  }
  // Template-generated decks convert too (supersedes the earlier slot-fill
  // deferral): the new slides version wins the editor dispatch; old rendered
  // versions stay in history and rollback restores them.

  try {
    const { deck, summary } = await htmlToSlides(current?.content_html ?? "", artifact.title);
    const newVersion = artifact.current_version + 1;
    const { error: vErr } = await sb.from("artifact_versions").insert({
      artifact_id: artifact.id,
      version: newVersion,
      content_html: slidesToHtml(deck),
      slides_json: deck,
      note: "Converted to structured slides (AI)",
      created_by: req.user!.id,
    });
    if (vErr) return res.status(500).json({ error: vErr.message });
    const { error: uErr } = await sb
      .from("artifacts")
      .update({ current_version: newVersion, updated_at: new Date().toISOString() })
      .eq("id", artifact.id);
    if (uErr) return res.status(500).json({ error: uErr.message });

    void logActivity("artifact", artifact.id, req.user!.id, "converted_to_slides", {
      version: newVersion,
      slides: deck.slides.length,
    });
    res.status(201).json({
      version: newVersion,
      slides: deck,
      guard: checkForbiddenWords(deckToText(deck)),
      summary,
    });
  } catch (err) {
    if (err instanceof DeckAiParseError) {
      return res.status(422).json({
        error: "The AI could not produce valid slides from this document — nothing was changed.",
        issues: err.issues,
      });
    }
    res.status(502).json({ error: (err as Error).message });
  }
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
