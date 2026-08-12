import { supabase } from "./db";
import { ask } from "./claude";
import { parseModelJson } from "./questionnaire";
import {
  AgentError,
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";
import { cleanHtml, htmlToText } from "./html";
import { checkForbiddenWords, GuardrailResult } from "./guardrails";
import { logActivity } from "./activity";
import type { MessagingDocRow } from "./messagingDoc";
import {
  RenderWarning,
  TemplateFormat,
  TemplateSlot,
  buildDigestHtml,
  renderTemplate,
  validateFills,
} from "./templateRender";

// Template-driven generation (blueprint §3.2). Claude fills named slots ONLY,
// sourced from the latest FINAL messaging doc (§3.1: drafts never qualify);
// the deterministic renderer merges fills into the locked layout. Generated
// artifacts enter the existing draft -> in_review -> final machine (§8.4).

export interface TemplateRow {
  id: string;
  name: string;
  asset_type: string;
  product_line: string | null;
  format: TemplateFormat;
  body: string;
  slots: TemplateSlot[];
  audience: string | null;
  persona: string | null;
  funnel_stage: string | null;
  template_version: number;
  approved: boolean;
}

export interface ProductRow {
  id: string;
  name: string;
  line: string | null;
}

/** Service-level failure with the HTTP status the route should return
 *  (mirrors MessagingDocError). `over` rides along for the 400 slot-edit case. */
export class TemplateGenError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly over?: { slot_id: string; chars: number; max: number }[]
  ) {
    super(message);
  }
}

/** status='final' order by version desc limit 1 — drafts NEVER qualify (§3.1). */
export async function getLatestFinalMessagingDoc(productId: string): Promise<MessagingDocRow | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb
    .from("messaging_docs")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "final")
    .order("version", { ascending: false })
    .limit(1);
  return (((data ?? [])[0] as MessagingDocRow | undefined) ?? null);
}

/** Only the sections wired by this template's slots (union of source_sections),
 *  wrapped <section id="B1" title="…">{markdown}</section>. Sections missing or
 *  empty in the doc are skipped here and surface later as 'empty_section' warnings. */
export function wiredSectionsXml(
  doc: MessagingDocRow,
  slots: TemplateSlot[]
): { xml: string; missingSectionIds: string[] } {
  const wired: string[] = [];
  for (const slot of slots) {
    for (const sectionId of slot.source_sections) {
      if (!wired.includes(sectionId)) wired.push(sectionId);
    }
  }
  const byId = new Map(doc.sections.map((s) => [s.id, s]));
  const parts: string[] = [];
  const missing: string[] = [];
  for (const sectionId of wired) {
    const section = byId.get(sectionId);
    if (!section || section.markdown.trim() === "") {
      missing.push(sectionId);
      continue;
    }
    const safeTitle = section.title.replace(/"/g, "&quot;");
    parts.push(`<section id="${sectionId}" title="${safeTitle}">\n${section.markdown.trim()}\n</section>`);
  }
  return { xml: parts.join("\n\n"), missingSectionIds: missing };
}

/** The {{placeholder}} map for the `template-slot-fill` agent body (Agents
 *  blueprint §2.2-4). Nullable audience/persona/funnel_stage render as
 *  "not specified", matching the original prompt. */
export function buildSlotFillVars(
  template: TemplateRow,
  product: ProductRow,
  doc: MessagingDocRow
): Record<string, string> {
  return {
    product_name: product.name,
    product_line: product.line ?? product.name,
    asset_type: template.asset_type,
    template_name: template.name,
    audience: template.audience ?? "not specified",
    persona: template.persona ?? "not specified",
    funnel_stage: template.funnel_stage ?? "not specified",
    doc_title: doc.title,
    doc_version: String(doc.version),
  };
}

/** LOCKED contract suffix for `template-slot-fill`: optional requester brief
 *  (runtime, never config), the slot lines, and the JSON tail that
 *  parseModelJson + validateFills consume. Appended unconditionally by
 *  composeAgentPrompt — a prompt override can never remove it. */
export function buildSlotFillSuffix(
  slots: TemplateSlot[],
  extraBrief: string | undefined
): string {
  const slotLines = slots
    .map((s) => {
      const shape =
        s.render === "lines"
          ? `One item per line, at most ${s.max_lines ?? 1} lines.`
          : "Single line of plain text.";
      const multiline =
        s.render === "multiline" ? " Short paragraphs separated by blank lines are allowed." : "";
      return [
        `- ${s.id}: ${s.purpose}. Source section(s): ${s.source_sections.join(", ")}. HARD LIMIT ${s.max_chars}`,
        "  characters — count them; shorter is fine, longer is rejected by a validator.",
        `  ${shape}${multiline}`,
      ].join("\n");
    })
    .join("\n");
  const firstSlotId = slots[0]?.id ?? "slot_id";
  const briefLine =
    extraBrief && extraBrief.trim() !== "" ? `Requester's brief: ${extraBrief.trim()}\n\n` : "";
  return `${briefLine}Slots to fill:
${slotLines}

Return ONLY valid JSON — no fences, no commentary:
{"fills": {"${firstSlotId}": "...", ... one key per slot id listed above}}`;
}

/** Trim-retry prompt (blueprint §3.2, exact draft — sent once when over.length > 0). */
export function buildTrimPrompt(
  over: { slot_id: string; chars: number; max: number }[],
  fills: Record<string, string>
): string {
  const lines = over
    .map(
      (o) =>
        `- ${o.slot_id}: yours was ${o.chars} characters, the limit is ${o.max}. Your text: "${fills[o.slot_id] ?? ""}"`
    )
    .join("\n");
  return `These slot fills exceeded their hard character limits. Rewrite ONLY the slots listed,
each within its limit. Cut words and clauses — never facts, numbers, or names. Return
ONLY JSON of the form {"fills": {...}} containing exactly these slots and no others.

${lines}`;
}

interface FillEnvelope {
  fills?: Record<string, unknown>;
}

/** ask() + parseModelJson (reused from questionnaire.ts) with one repair retry. */
export async function askFills(
  prompt: string,
  extraContext: string,
  model?: string
): Promise<Record<string, string>> {
  const opts = { extraContext, maxTokens: 8000, model };
  let parsed: FillEnvelope;
  try {
    parsed = parseModelJson<FillEnvelope>(await ask(prompt, opts));
  } catch {
    const repaired = `${prompt}\nYour previous reply was not valid JSON. Return only the JSON object.`;
    parsed = parseModelJson<FillEnvelope>(await ask(repaired, opts));
  }
  const fills: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.fills ?? {})) {
    if (typeof value === "string") fills[key] = value;
  }
  return fills;
}

/** Orchestration for POST /api/templates/:id/generate (blueprint route #7). */
export async function generateFromTemplate(
  templateId: string,
  productId: string,
  title: string,
  extraBrief: string | undefined,
  userId: string
): Promise<{
  artifactId: string;
  guard: GuardrailResult;
  warnings: RenderWarning[];
  messagingDocVersion: number;
}> {
  const sb = supabase();
  if (!sb) throw new TemplateGenError("Database not configured", 503);

  const { data: templateData } = await sb
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (!templateData) throw new TemplateGenError("Template not found", 404);
  const template = templateData as TemplateRow & { body: string | null; format: TemplateFormat | null };
  if (!template.body || !template.format) {
    throw new TemplateGenError("This template has no layout body yet — it cannot generate.", 422);
  }
  if (!template.approved) {
    throw new TemplateGenError("This template is not approved for generation yet.", 422);
  }

  const { data: productData } = await sb
    .from("products")
    .select("id, name, line")
    .eq("id", productId)
    .maybeSingle();
  if (!productData) throw new TemplateGenError("Product not found", 404);
  const product = productData as ProductRow;

  // §3.1 gate: no final messaging doc -> no generation. Drafts never qualify.
  const doc = await getLatestFinalMessagingDoc(productId);
  if (!doc) {
    throw new TemplateGenError(
      "No approved messaging document for this product. Generate and approve one in the Foundation Questionnaire first — template generation only runs from a final doc.",
      409
    );
  }

  // Agent config (Agents tab). Disabled -> 409 naming the tab (§0.1-5);
  // AgentError is re-thrown as TemplateGenError so the route maps the status.
  let cfg;
  try {
    cfg = await getAgentConfig("template-slot-fill");
    assertAgentEnabled(cfg);
  } catch (err) {
    if (err instanceof AgentError) throw new TemplateGenError(err.message, err.status);
    throw err;
  }
  const model = resolveModel(cfg);

  const slots = (template.slots ?? []) as TemplateSlot[];
  const { xml, missingSectionIds } = wiredSectionsXml(doc, slots);
  const prompt = composeAgentPrompt(
    cfg,
    buildSlotFillVars(template as TemplateRow, product, doc),
    buildSlotFillSuffix(slots, extraBrief)
  );

  let modelFills: Record<string, string>;
  try {
    modelFills = await askFills(prompt, xml, model);
  } catch (err) {
    // No degraded scaffold: a half-filled locked layout is worse than no artifact.
    throw new TemplateGenError(
      `Slot filling failed: ${(err as Error).message}. Nothing was created — try again.`,
      502
    );
  }

  const warnings: RenderWarning[] = [];
  const { ok, over } = validateFills(slots, modelFills);

  // Over-limit: ONE retry with an explicit trim instruction (only failing slots),
  // then hard-fail still-over slots to blank + warning. Never silent truncation —
  // trimming copy is a human decision (route #9).
  if (over.length > 0) {
    let retried: Record<string, string> = {};
    try {
      retried = await askFills(buildTrimPrompt(over, modelFills), xml, model);
    } catch {
      retried = {};
    }
    const overSlots = slots.filter((s) => over.some((o) => o.slot_id === s.id));
    const second = validateFills(overSlots, retried);
    for (const o of over) {
      const rescued = (second.ok[o.slot_id] ?? "").trim();
      if (rescued !== "") {
        ok[o.slot_id] = rescued;
      } else {
        ok[o.slot_id] = "";
        warnings.push({
          slot_id: o.slot_id,
          kind: "over_limit",
          detail: `Fill exceeded ${o.max} chars after retry — left blank for PMM input.`,
        });
      }
    }
  }

  // Wired-section drift: a slot left empty because every wired section is
  // missing/empty in this final doc degrades to a visible warning, never invention.
  for (const slot of slots) {
    if ((ok[slot.id] ?? "").trim() !== "") continue;
    if (warnings.some((w) => w.slot_id === slot.id)) continue;
    if (
      slot.source_sections.length > 0 &&
      slot.source_sections.every((id) => missingSectionIds.includes(id))
    ) {
      warnings.push({
        slot_id: slot.id,
        kind: "empty_section",
        detail: `Wired section(s) ${slot.source_sections.join(", ")} are missing or empty in the messaging doc.`,
      });
    }
  }

  const { payload, warnings: renderWarnings } = renderTemplate(
    template.format,
    template.body,
    slots,
    ok
  );
  const flagged = new Set(warnings.map((w) => w.slot_id));
  for (const w of renderWarnings) {
    if (!flagged.has(w.slot_id)) warnings.push(w);
  }

  // Digest carries every generated word so the existing finalize gate covers
  // template artifacts with zero changes to artifacts.ts (decision §0.1-2).
  const digest = cleanHtml(
    buildDigestHtml(
      title,
      {
        templateName: template.name,
        templateVersion: template.template_version,
        productName: product.name,
        docVersion: doc.version,
      },
      slots,
      ok,
      warnings
    )
  );
  const guard = checkForbiddenWords(htmlToText(digest));

  const { data: artifact, error: artErr } = await sb
    .from("artifacts")
    .insert({
      title,
      asset_type: template.asset_type,
      product_id: product.id,
      persona: template.persona,
      status: "draft",
      template_id: template.id,
      current_version: 1,
      created_by: userId,
    })
    .select("id")
    .single();
  if (artErr || !artifact) {
    throw new TemplateGenError(artErr?.message ?? "Artifact insert failed", 500);
  }
  const artifactId = artifact.id as string;

  const { error: verErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifactId,
    version: 1,
    content_html: digest,
    note: `AI: generated from template "${template.name}" v${template.template_version}`,
    created_by: userId,
  });
  if (verErr) throw new TemplateGenError(verErr.message, 500);

  const { error: renErr } = await sb.from("artifact_renders").insert({
    artifact_id: artifactId,
    version: 1,
    format: template.format,
    payload,
    slot_fills: ok,
    warnings,
    template_id: template.id,
    template_version: template.template_version,
    messaging_doc_id: doc.id,
    created_by: userId,
  });
  if (renErr) throw new TemplateGenError(renErr.message, 500);

  void logActivity("artifact", artifactId, userId, "generated_from_template", {
    template: template.name,
    template_version: template.template_version,
    messaging_doc_version: doc.version,
    warnings: warnings.length,
    guard_ok: guard.ok,
  });

  return { artifactId, guard, warnings, messagingDocVersion: doc.version };
}

interface RenderRow {
  slot_fills: Record<string, string>;
  template_id: string | null;
  messaging_doc_id: string | null;
}

/** Re-render for POST /api/artifacts/:id/slots (route #9 — no model call):
 *  merge submitted fills over stored fills, validate (400 on over — the human
 *  gets the real limits, no silent trim), re-render, new version pair. */
export async function reRenderWithFills(
  artifactId: string,
  fills: Record<string, string>,
  note: string | undefined,
  userId: string
): Promise<{ version: number }> {
  const sb = supabase();
  if (!sb) throw new TemplateGenError("Database not configured", 503);

  const { data: artifactData } = await sb
    .from("artifacts")
    .select("id, title, product_id, current_version")
    .eq("id", artifactId)
    .maybeSingle();
  if (!artifactData) throw new TemplateGenError("Artifact not found", 404);
  const artifact = artifactData as {
    id: string;
    title: string;
    product_id: string | null;
    current_version: number;
  };

  const { data: renderData } = await sb
    .from("artifact_renders")
    .select("slot_fills, template_id, messaging_doc_id")
    .eq("artifact_id", artifact.id)
    .eq("version", artifact.current_version)
    .maybeSingle();
  if (!renderData) {
    throw new TemplateGenError(
      "This artifact has no render — slot editing only applies to template-generated artifacts.",
      409
    );
  }
  const render = renderData as RenderRow;
  if (!render.template_id) {
    throw new TemplateGenError(
      "The template behind this artifact no longer exists — regenerate from a current template.",
      409
    );
  }

  const { data: templateData } = await sb
    .from("templates")
    .select("*")
    .eq("id", render.template_id)
    .maybeSingle();
  const template = templateData as (TemplateRow & { body: string | null }) | null;
  if (!template || !template.body || !template.format) {
    throw new TemplateGenError(
      "The template behind this artifact no longer exists — regenerate from a current template.",
      409
    );
  }
  const slots = (template.slots ?? []) as TemplateSlot[];

  const merged = { ...(render.slot_fills ?? {}), ...fills };
  const { ok, over } = validateFills(slots, merged);
  if (over.length > 0) {
    throw new TemplateGenError("One or more fills exceed their character limits.", 400, over);
  }

  const { payload, warnings } = renderTemplate(template.format, template.body, slots, ok);

  let productName = "Aurigo";
  if (artifact.product_id) {
    const { data: product } = await sb
      .from("products")
      .select("name")
      .eq("id", artifact.product_id)
      .maybeSingle();
    productName = (product as { name: string } | null)?.name ?? productName;
  }
  let docVersion = 0;
  if (render.messaging_doc_id) {
    const { data: doc } = await sb
      .from("messaging_docs")
      .select("version")
      .eq("id", render.messaging_doc_id)
      .maybeSingle();
    docVersion = (doc as { version: number } | null)?.version ?? 0;
  }

  const digest = cleanHtml(
    buildDigestHtml(
      artifact.title,
      {
        templateName: template.name,
        templateVersion: template.template_version,
        productName,
        docVersion,
      },
      slots,
      ok,
      warnings
    )
  );

  const newVersion = artifact.current_version + 1;
  const { error: verErr } = await sb.from("artifact_versions").insert({
    artifact_id: artifact.id,
    version: newVersion,
    content_html: digest,
    note: note?.trim() || "Slot edits",
    created_by: userId,
  });
  if (verErr) throw new TemplateGenError(verErr.message, 500);

  const { error: renErr } = await sb.from("artifact_renders").insert({
    artifact_id: artifact.id,
    version: newVersion,
    format: template.format,
    payload,
    slot_fills: ok,
    warnings,
    template_id: template.id,
    template_version: template.template_version,
    messaging_doc_id: render.messaging_doc_id,
    created_by: userId,
  });
  if (renErr) throw new TemplateGenError(renErr.message, 500);

  const { error: updErr } = await sb
    .from("artifacts")
    .update({ current_version: newVersion, updated_at: new Date().toISOString() })
    .eq("id", artifact.id);
  if (updErr) throw new TemplateGenError(updErr.message, 500);

  void logActivity("artifact", artifact.id, userId, "slots_edited", {
    slots: Object.keys(fills),
  });

  return { version: newVersion };
}
