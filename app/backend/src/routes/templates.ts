import { Router } from "express";
import { isAdmin, requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import {
  TEMPLATE_FORMATS,
  TemplateFormat,
  TemplateSlot,
  placeholderFills,
  renderTemplate,
  sanitizeTemplateBody,
  validateTemplateDefinition,
} from "../services/templateRender";
import { TemplateGenError, generateFromTemplate } from "../services/templateGenerate";
import { checkForbiddenWords } from "../services/guardrails";
import { htmlToText } from "../services/html";

// Template Library (blueprint §2): layout-locked, slot-based templates filled
// from the latest FINAL messaging doc. Browsing is all-roles; authoring is the
// PMM admin's boundary — templates are the brand-enforcement mechanism (vol-3 08).
export const templatesRouter = Router();

const FUNNEL_STAGES = ["awareness", "consideration", "decision", "expansion"] as const;

/** Static template copy ships in every export but the finalize gate only sees
 *  generated fills (the digest) — so the forbidden-words check must run on the
 *  template body at save time. Deck bodies: check the slide fragments' text. */
function checkTemplateBodyWords(
  format: TemplateFormat,
  body: string
): { ok: boolean; violations: string[] } {
  let text = body;
  if (format === "deck") {
    try {
      const deck = JSON.parse(body) as { slides?: { html?: string }[] };
      text = (deck.slides ?? []).map((s) => s.html ?? "").join("\n");
    } catch {
      // malformed decks are rejected by validateTemplateDefinition before this runs
    }
  }
  return checkForbiddenWords(htmlToText(text));
}

const LIST_COLS =
  "id, name, asset_type, format, orientation, product_line, preview_color, audience, persona, funnel_stage, exemplar_path, template_version, approved, body";

interface TemplateListRow {
  id: string;
  name: string;
  asset_type: string;
  format: string | null;
  orientation: string;
  product_line: string | null;
  preview_color: string | null;
  audience: string | null;
  persona: string | null;
  funnel_stage: string | null;
  exemplar_path: string | null;
  template_version: number;
  approved: boolean;
  body: string | null;
}

interface TemplateInput {
  name?: string;
  asset_type?: string;
  format?: string;
  body?: string;
  slots?: unknown;
  product_line?: string | null;
  audience?: string | null;
  persona?: string | null;
  funnel_stage?: string | null;
  exemplar_path?: string | null;
  preview_color?: string | null;
  approved?: boolean;
}

async function knownSectionIds(): Promise<string[]> {
  const sb = supabase()!;
  const { data } = await sb.from("fq_sections").select("id");
  return ((data ?? []) as { id: string }[]).map((s) => s.id);
}

// ---------- list ----------
// GET /api/templates?asset_type=&format= — body/slots excluded; generation_ready = body is not null.
templatesRouter.get("/", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { asset_type, format } = req.query as Record<string, string | undefined>;
  let query = sb.from("templates").select(LIST_COLS).order("name");
  if (!isAdmin(req)) query = query.eq("approved", true);
  if (asset_type && asset_type.trim() !== "") query = query.eq("asset_type", asset_type);
  if (format && format.trim() !== "") query = query.eq("format", format);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  const templates = ((data ?? []) as TemplateListRow[]).map(({ body, ...rest }) => ({
    ...rest,
    generation_ready: body !== null,
  }));
  res.json({ templates });
});

// ---------- detail (all columns incl. body, slots) ----------
templatesRouter.get("/:id", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb.from("templates").select("*").eq("id", req.params.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || (!isAdmin(req) && !data.approved)) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.json({ template: data });
});

// ---------- create (admin) ----------
templatesRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const input = req.body as TemplateInput;
  if (!input.name || input.name.trim() === "") return res.status(400).json({ error: "name is required" });
  if (!input.asset_type || input.asset_type.trim() === "")
    return res.status(400).json({ error: "asset_type is required" });
  if (!input.format || !TEMPLATE_FORMATS.includes(input.format as TemplateFormat)) {
    return res.status(400).json({ error: `format must be one of ${TEMPLATE_FORMATS.join(", ")}` });
  }
  if (typeof input.body !== "string" || input.body.trim() === "")
    return res.status(400).json({ error: "body is required" });
  if (!Array.isArray(input.slots)) return res.status(400).json({ error: "slots must be an array" });
  if (
    input.funnel_stage !== undefined &&
    input.funnel_stage !== null &&
    !FUNNEL_STAGES.includes(input.funnel_stage as (typeof FUNNEL_STAGES)[number])
  ) {
    return res.status(400).json({ error: `funnel_stage must be one of ${FUNNEL_STAGES.join(", ")}` });
  }

  const format = input.format as TemplateFormat;
  const slots = input.slots as TemplateSlot[];
  const issues = validateTemplateDefinition(format, input.body, slots, await knownSectionIds());
  if (issues.length > 0) return res.status(400).json({ error: "Template definition is invalid", issues });
  const bodyGuard = checkTemplateBodyWords(format, input.body);
  if (!bodyGuard.ok) {
    return res.status(400).json({
      error: "Template body contains forbidden words — static template copy ships in every export.",
      issues: bodyGuard.violations,
    });
  }

  const { data: template, error } = await sb
    .from("templates")
    .insert({
      name: input.name.trim(),
      asset_type: input.asset_type.trim(),
      format,
      body: sanitizeTemplateBody(format, input.body),
      slots,
      product_line: input.product_line ?? null,
      audience: input.audience ?? null,
      persona: input.persona ?? null,
      funnel_stage: input.funnel_stage ?? null,
      exemplar_path: input.exemplar_path ?? null,
      preview_color: input.preview_color ?? null,
      // Unapproved by default (0002 column default is true — must stay explicit):
      // review-then-publish per §8.4; only approved templates list for non-admins.
      approved: input.approved ?? false,
      template_version: 1,
      created_by: req.user!.id,
    })
    .select("*")
    .single();
  if (error || !template) return res.status(500).json({ error: error?.message ?? "Insert failed" });

  void logActivity("template", template.id, req.user!.id, "created", {
    name: template.name,
    template_version: 1,
  });
  res.status(201).json({ template });
});

// ---------- update (admin; template_version bumps on every edit) ----------
templatesRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const { data: existing, error: eErr } = await sb
    .from("templates")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (eErr) return res.status(500).json({ error: eErr.message });
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const input = req.body as TemplateInput;
  if (input.format !== undefined && !TEMPLATE_FORMATS.includes(input.format as TemplateFormat)) {
    return res.status(400).json({ error: `format must be one of ${TEMPLATE_FORMATS.join(", ")}` });
  }
  if (input.slots !== undefined && !Array.isArray(input.slots)) {
    return res.status(400).json({ error: "slots must be an array" });
  }
  if (
    input.funnel_stage !== undefined &&
    input.funnel_stage !== null &&
    !FUNNEL_STAGES.includes(input.funnel_stage as (typeof FUNNEL_STAGES)[number])
  ) {
    return res.status(400).json({ error: `funnel_stage must be one of ${FUNNEL_STAGES.join(", ")}` });
  }

  const format = (input.format ?? existing.format) as TemplateFormat | null;
  let body = (input.body !== undefined ? input.body : existing.body) as string | null;
  const slots = (input.slots ?? existing.slots ?? []) as TemplateSlot[];

  // Legacy rows (body null) may still have metadata/approved toggled; anything
  // with a layout is re-validated as a whole definition.
  if (body !== null) {
    if (!format) return res.status(400).json({ error: "format is required when the template has a body" });
    const issues = validateTemplateDefinition(format, body, slots, await knownSectionIds());
    if (issues.length > 0) {
      return res.status(400).json({ error: "Template definition is invalid", issues });
    }
    const bodyGuard = checkTemplateBodyWords(format, body);
    if (!bodyGuard.ok) {
      return res.status(400).json({
        error: "Template body contains forbidden words — static template copy ships in every export.",
        issues: bodyGuard.violations,
      });
    }
    body = sanitizeTemplateBody(format, body);
  }

  const templateVersion = ((existing.template_version as number | null) ?? 1) + 1;
  const { data: template, error } = await sb
    .from("templates")
    .update({
      name: input.name != null ? input.name.trim() : existing.name,
      asset_type: input.asset_type != null ? input.asset_type.trim() : existing.asset_type,
      format,
      body,
      slots,
      product_line: input.product_line !== undefined ? input.product_line : existing.product_line,
      audience: input.audience !== undefined ? input.audience : existing.audience,
      persona: input.persona !== undefined ? input.persona : existing.persona,
      funnel_stage: input.funnel_stage !== undefined ? input.funnel_stage : existing.funnel_stage,
      exemplar_path: input.exemplar_path !== undefined ? input.exemplar_path : existing.exemplar_path,
      preview_color: input.preview_color !== undefined ? input.preview_color : existing.preview_color,
      approved: input.approved !== undefined ? input.approved : existing.approved,
      template_version: templateVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error || !template) return res.status(500).json({ error: error?.message ?? "Update failed" });

  void logActivity("template", template.id, req.user!.id, "updated", {
    name: template.name,
    template_version: templateVersion,
  });
  res.json({ template });
});

// ---------- delete (admin; artifacts.template_id / artifact_renders.template_id set null) ----------
templatesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase()!;
  const { data: existing } = await sb
    .from("templates")
    .select("id, name")
    .eq("id", req.params.id)
    .maybeSingle();
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const { error } = await sb.from("templates").delete().eq("id", existing.id);
  if (error) return res.status(500).json({ error: error.message });

  void logActivity("template", existing.id, req.user!.id, "deleted", { name: existing.name });
  res.json({ ok: true });
});

// ---------- preview (deterministic placeholder fills; sandboxed iframe on the frontend) ----------
templatesRouter.get("/:id/preview", requireAuth, async (req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("templates")
    .select("id, approved, format, orientation, body, slots")
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || (!isAdmin(req) && !data.approved)) {
    return res.status(404).json({ error: "Template not found" });
  }
  if (!data.body || !data.format) {
    return res.status(422).json({ error: "This template has no layout body yet." });
  }
  const slots = (data.slots ?? []) as TemplateSlot[];
  try {
    const { payload } = renderTemplate(
      data.format as TemplateFormat,
      data.body as string,
      slots,
      placeholderFills(slots)
    );
    res.json({ format: data.format, orientation: data.orientation, payload });
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

// ---------- generate (any role drafts; approval stays admin — §8.4) ----------
// POST /api/templates/:id/generate { product_id, title, extra_brief? }
templatesRouter.post("/:id/generate", requireAuth, async (req, res) => {
  const { product_id, title, extra_brief } = req.body as {
    product_id?: string;
    title?: string;
    extra_brief?: string;
  };
  if (!product_id || product_id.trim() === "") {
    return res
      .status(400)
      .json({ error: "product_id is required — template generation runs from that product's final messaging doc" });
  }
  if (!title || title.trim() === "") return res.status(400).json({ error: "title is required" });

  try {
    const result = await generateFromTemplate(
      req.params.id,
      product_id,
      title.trim(),
      extra_brief,
      req.user!.id
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof TemplateGenError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("template generate failed:", (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
});
