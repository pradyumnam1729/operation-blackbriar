import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { ask } from "../services/claude";
import { markdownToHtml } from "../services/html";
import { checkForbiddenWords, GuardrailResult } from "../services/guardrails";
import { logActivity } from "../services/activity";

// Asset Studio backend: template gallery (mock Canva previews until the
// canva_live flag + OAuth land), prompt library, and template+prompt-driven
// generation into the artifact library. Generation targets the in-app editor;
// the Canva Connect push happens once OAuth is granted.
export const studioRouter = Router();

// GET /templates?asset_type=&product_line= — approved templates only.
studioRouter.get("/templates", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { asset_type, product_line } = req.query as Record<string, string | undefined>;
  let query = sb
    .from("templates")
    .select("id, name, asset_type, product_line, preview_color, canva_id")
    .eq("approved", true)
    .order("name");
  if (asset_type && asset_type.trim() !== "") query = query.eq("asset_type", asset_type);
  if (product_line && product_line.trim() !== "") query = query.eq("product_line", product_line);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ templates: data ?? [] });
});

// GET /prompts?asset_type= — prompt library.
studioRouter.get("/prompts", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { asset_type } = req.query as Record<string, string | undefined>;
  let query = sb.from("prompt_library").select("id, name, asset_type, body").order("name");
  if (asset_type && asset_type.trim() !== "") query = query.eq("asset_type", asset_type);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ prompts: data ?? [] });
});

const SCAFFOLD_SECTIONS: Record<string, string[]> = {
  datasheet: ["Overview", "Key capabilities", "Proof point", "Next step"],
  deck: ["Narrative arc", "Slide outline", "Speaker notes", "Call to action"],
  faq: ["Top questions", "Product answers", "Objection handling", "Where to learn more"],
  "one-pager": ["Program outcomes", "Differentiated capabilities", "Proof point", "The decision"],
};

/** Fallback content when the model is unavailable — a clean scaffold the editor can build on. */
function scaffoldMarkdown(title: string, assetType: string, productName: string | null): string {
  const sections = SCAFFOLD_SECTIONS[assetType] ?? ["Overview", "Details", "Next step"];
  const lines = [`# ${title}`, ""];
  if (productName) lines.push(`*Product: ${productName}*`, "");
  for (const s of sections) {
    lines.push(`## ${s}`, "", "_Draft this section in the editor._", "");
  }
  return lines.join("\n");
}

// POST /generate — {template_id, prompt_id, product_id, title, extra_brief?}
studioRouter.post("/generate", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const user = req.user!;
  const { template_id, prompt_id, product_id, title, extra_brief } = req.body as {
    template_id?: string;
    prompt_id?: string;
    product_id?: string;
    title?: string;
    extra_brief?: string;
  };
  if (!template_id || !prompt_id || !title || title.trim() === "") {
    return res.status(400).json({ error: "template_id, prompt_id and title are required" });
  }

  const [{ data: template }, { data: prompt }] = await Promise.all([
    sb.from("templates").select("id, name, asset_type, product_line").eq("id", template_id).single(),
    sb.from("prompt_library").select("id, name, asset_type, body").eq("id", prompt_id).single(),
  ]);
  if (!template) return res.status(404).json({ error: "Template not found" });
  if (!prompt) return res.status(404).json({ error: "Prompt not found" });

  interface ProductRow {
    id: string;
    name: string;
    line: string | null;
    module: string | null;
  }
  let product: ProductRow | null = null;
  if (product_id && product_id.trim() !== "") {
    const { data } = await sb.from("products").select("id, name, line, module").eq("id", product_id).single();
    product = (data as ProductRow | null) ?? null;
    if (!product) return res.status(404).json({ error: "Product not found" });
  }

  let html: string;
  let guard: GuardrailResult = { ok: true, violations: [] };
  let degraded = false;

  try {
    const userPrompt = [
      `Asset type: ${template.asset_type}. Template: "${template.name}".`,
      product
        ? `Product context: ${product.name} (${product.line ?? ""} line, ${product.module ?? ""} module). Ground every claim in this product's context.`
        : "Product context: Aurigo portfolio (no single product selected).",
      `Working title: ${title.trim()}`,
      `Task: ${prompt.body}`,
      extra_brief && extra_brief.trim() !== "" ? `Additional brief from the requester: ${extra_brief.trim()}` : "",
      "Return only the finished content in Markdown with proper headings — no preamble, no meta-commentary.",
    ]
      .filter((l) => l !== "")
      .join("\n\n");
    const md = await ask(userPrompt, { maxTokens: 8000 });
    guard = checkForbiddenWords(md);
    html = markdownToHtml(md);
  } catch (err) {
    // No API credits / model unavailable: create a starter scaffold instead.
    console.error("studio generate degraded:", (err as Error).message);
    degraded = true;
    guard = { ok: true, violations: [] };
    html = markdownToHtml(scaffoldMarkdown(title.trim(), template.asset_type, product?.name ?? null));
  }

  const { data: artifact, error: artErr } = await sb
    .from("artifacts")
    .insert({
      title: title.trim(),
      asset_type: template.asset_type,
      product_id: product?.id ?? null,
      status: "draft",
      template_id: template.id,
      prompt_id: prompt.id,
      current_version: 1,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (artErr || !artifact) return res.status(500).json({ error: artErr?.message ?? "Artifact insert failed" });

  const { error: verErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: 1,
    content_html: html,
    note: degraded ? "Scaffold created (AI unavailable)" : `Generated in Studio via "${prompt.name}"`,
    created_by: user.id,
  });
  if (verErr) return res.status(500).json({ error: verErr.message });

  void logActivity("artifact", artifact.id, user.id, "generated_in_studio", {
    template: template.name,
    prompt: prompt.name,
    asset_type: template.asset_type,
    degraded,
    guard_ok: guard.ok,
  });

  res.status(201).json(degraded ? { artifactId: artifact.id, guard, degraded: true } : { artifactId: artifact.id, guard });
});
