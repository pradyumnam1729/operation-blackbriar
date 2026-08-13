// Template Library rendering layer (blueprint §3.1). Pure and deterministic —
// no model calls, no database — so char limits, placeholder parity, escaping,
// and merging are unit-testable and model judgment is never the only defense.

export type TemplateFormat = "html" | "svg" | "deck" | "email" | "markdown";

export const TEMPLATE_FORMATS: readonly TemplateFormat[] = [
  "html",
  "svg",
  "deck",
  "email",
  "markdown",
];

export interface TemplateSlot {
  id: string;
  label: string;
  purpose: string;
  max_chars: number;
  required: boolean;
  render: "text" | "multiline" | "lines";
  max_lines?: number;
  source_sections: string[];
}

export interface RenderWarning {
  slot_id: string;
  kind: "over_limit" | "missing" | "empty_section";
  detail: string;
}

const SLOT_ID_RE = /^[a-z][a-z0-9_]*$/;
const PLACEHOLDER_RE = /\{\{([a-z][a-z0-9_]*)\}\}/g;
const SLOT_RENDERS = ["text", "multiline", "lines"] as const;

interface DeckBody {
  master: { css: string; [key: string]: unknown };
  slides: { role: string; html: string }[];
}

/** Deck bodies are JSON: a locked slide master + slides carrying {{slot}} fragments. */
function parseDeckBody(body: string): DeckBody | null {
  try {
    const parsed = JSON.parse(body) as DeckBody;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.master || typeof parsed.master.css !== "string") return null;
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) return null;
    for (const slide of parsed.slides) {
      if (!slide || typeof slide.role !== "string" || typeof slide.html !== "string") return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Distinct {{id}} tokens in the body (deck: across slide fragments). null = malformed deck body. */
function bodyPlaceholders(format: TemplateFormat, body: string): Set<string> | null {
  let targets: string[];
  if (format === "deck") {
    const deck = parseDeckBody(body);
    if (!deck) return null;
    targets = deck.slides.map((s) => s.html);
  } else {
    targets = [body];
  }
  const found = new Set<string>();
  for (const target of targets) {
    for (const match of target.matchAll(PLACEHOLDER_RE)) found.add(match[1]);
  }
  return found;
}

/** Template-save validation (routes #3/#4). Returns human-readable issues; [] = valid. */
export function validateTemplateDefinition(
  format: TemplateFormat,
  body: string,
  slots: TemplateSlot[],
  knownSectionIds: string[]
): string[] {
  const issues: string[] = [];
  if (!TEMPLATE_FORMATS.includes(format)) {
    issues.push(`Unknown format "${format}" — expected one of ${TEMPLATE_FORMATS.join(", ")}.`);
    return issues;
  }
  if (typeof body !== "string" || body.trim() === "") {
    issues.push("body is required — a template without a layout cannot generate.");
    return issues;
  }
  if (!Array.isArray(slots) || slots.length === 0) {
    issues.push("slots must be a non-empty array.");
    return issues;
  }

  const known = new Set(knownSectionIds);
  const seen = new Set<string>();
  for (const slot of slots) {
    const id = typeof slot?.id === "string" ? slot.id : String(slot?.id ?? "");
    if (!SLOT_ID_RE.test(id)) {
      issues.push(`Slot id "${id}" is invalid — expected lowercase snake_case starting with a letter.`);
      continue;
    }
    if (seen.has(id)) issues.push(`Duplicate slot id "${id}".`);
    seen.add(id);
    if (typeof slot.label !== "string" || slot.label.trim() === "") {
      issues.push(`Slot "${id}" needs a label.`);
    }
    if (typeof slot.purpose !== "string" || slot.purpose.trim() === "") {
      issues.push(`Slot "${id}" needs a purpose (it is fed verbatim to the model).`);
    }
    if (!Number.isInteger(slot.max_chars) || slot.max_chars < 1 || slot.max_chars > 2000) {
      issues.push(`Slot "${id}": max_chars must be an integer between 1 and 2000.`);
    }
    if (typeof slot.required !== "boolean") {
      issues.push(`Slot "${id}": required must be true or false.`);
    }
    if (!SLOT_RENDERS.includes(slot.render)) {
      issues.push(`Slot "${id}": render must be one of ${SLOT_RENDERS.join(", ")}.`);
    }
    if (slot.render === "lines" && (!Number.isInteger(slot.max_lines) || (slot.max_lines as number) < 1)) {
      issues.push(`Slot "${id}": render 'lines' requires max_lines of at least 1.`);
    }
    if (!Array.isArray(slot.source_sections) || slot.source_sections.length === 0) {
      issues.push(`Slot "${id}" must wire at least one source section.`);
    } else {
      for (const sectionId of slot.source_sections) {
        if (!known.has(sectionId)) {
          issues.push(`Slot "${id}" wires unknown section "${sectionId}" — not in the fq_sections registry.`);
        }
      }
    }
  }

  const placeholders = bodyPlaceholders(format, body);
  if (placeholders === null) {
    issues.push("Deck body must be valid JSON of the form {master:{css}, slides:[{role, html}]}.");
    return issues;
  }
  for (const slot of slots) {
    if (typeof slot?.id === "string" && SLOT_ID_RE.test(slot.id) && !placeholders.has(slot.id)) {
      issues.push(`Slot "${slot.id}" has no {{${slot.id}}} placeholder in the body.`);
    }
  }
  for (const token of placeholders) {
    if (!seen.has(token)) {
      issues.push(`Body references {{${token}}} but no slot "${token}" is defined.`);
    }
  }
  return issues;
}

/** Regex strip of active content in admin-authored layout (defense in depth —
 *  the sandboxed iframe is the second wall). */
function stripDangerousOnce(text: string): string {
  return (
    text
      .replace(/<(script|foreignObject|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<(script|foreignObject|iframe|object|embed)\b[^>]*\/?>/gi, "")
      // browsers accept "/" as an attribute separator (<svg/onload=...)
      .replace(/[\s/]on[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/[\s/]on[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/[\s/]on[a-z]+\s*=\s*[^\s>"'][^\s>]*/gi, "")
      // entity-encoded colon variants of javascript: URLs
      .replace(/&colon;|&#0*58;?|&#x0*3a;?/gi, ":")
      .replace(/javascript\s*:/gi, "")
      .replace(/data:\s*text\/html/gi, "")
  );
}

/** Iterate to a fixpoint so strip-remnant reassembly (<scr<script>ipt>) cannot
 *  reconstruct a dangerous token after a single pass. */
function stripDangerous(text: string): string {
  let prev = text;
  for (let i = 0; i < 10; i++) {
    const next = stripDangerousOnce(prev);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

/** Strip <script>, on* attributes, javascript: URLs, and (svg) <foreignObject>
 *  from a template body at save time. Deck: applied to master.css and each
 *  slide fragment (body re-serialized). */
export function sanitizeTemplateBody(format: TemplateFormat, body: string): string {
  if (format !== "deck") return stripDangerous(body);
  const deck = parseDeckBody(body);
  if (!deck) return stripDangerous(body); // validation rejects malformed decks before save
  const clean: DeckBody = {
    ...deck,
    master: { ...deck.master, css: stripDangerous(deck.master.css) },
    slides: deck.slides.map((s) => ({ ...s, html: stripDangerous(s.html) })),
  };
  return JSON.stringify(clean, null, 2);
}

/** Deterministic char/line validation — model judgment is never the only defense.
 *  over: fills exceeding max_chars (or max_lines for render:'lines' — chars then
 *  carries the line count). ok: every slot's usable fill (over-limit excluded). */
export function validateFills(
  slots: TemplateSlot[],
  fills: Record<string, string>
): {
  ok: Record<string, string>;
  over: { slot_id: string; chars: number; max: number }[];
  missing: string[];
} {
  const ok: Record<string, string> = {};
  const over: { slot_id: string; chars: number; max: number }[] = [];
  const missing: string[] = [];
  for (const slot of slots) {
    const fill = (fills[slot.id] ?? "").trim();
    if (fill === "") {
      if (slot.required) missing.push(slot.id);
      ok[slot.id] = "";
      continue;
    }
    if (fill.length > slot.max_chars) {
      over.push({ slot_id: slot.id, chars: fill.length, max: slot.max_chars });
      continue;
    }
    if (slot.render === "lines" && slot.max_lines !== undefined) {
      const lineCount = fill.split(/\r?\n/).filter((l) => l.trim() !== "").length;
      if (lineCount > slot.max_lines) {
        over.push({ slot_id: slot.id, chars: lineCount, max: slot.max_lines });
        continue;
      }
    }
    ok[slot.id] = fill;
  }
  return { ok, over, missing };
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

/** Escape + shape one fill for its host format. Model text can never open a tag. */
export function escapeForFormat(format: TemplateFormat, slot: TemplateSlot, text: string): string {
  if (format === "svg") {
    // SVG <text> cannot wrap — newlines collapse to spaces regardless of render mode.
    return escapeXml(text).replace(/\s*\r?\n\s*/g, " ");
  }
  if (format === "markdown") {
    // Table safety ('|') and heading safety (leading '#'); text stays markdown-native.
    return text.replace(/\|/g, "\\|").replace(/^#/gm, "\\#");
  }
  // html / deck / email — HTML-escape, then shape by render mode.
  const escaped = escapeXml(text);
  if (slot.render === "lines") {
    return escaped
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== "")
      .map((l) => `<li>${l}</li>`)
      .join("");
  }
  if (slot.render === "multiline") {
    return escaped
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim().replace(/\s*\r?\n\s*/g, "<br>"))
      .filter((p) => p !== "")
      .join("<br><br>");
  }
  return escaped.replace(/\s*\r?\n\s*/g, " ");
}

function missingPlaceholder(label: string): string {
  return `⚠ [${label}] — needs PMM input`;
}

/** Merge fills into the template. Every {{id}} replaced; required-but-empty slots
 *  get the visible ⚠ placeholder + a 'missing' warning; optional empties -> "".
 *  Never throws on content; throws only on a malformed deck body (guarded at save). */
export function renderTemplate(
  format: TemplateFormat,
  body: string,
  slots: TemplateSlot[],
  fills: Record<string, string>
): { payload: string; warnings: RenderWarning[] } {
  const warnings: RenderWarning[] = [];
  const rendered = new Map<string, string>();

  // Inline-editing markers: html/email payloads wrap each non-lines slot in a
  // <span data-slot="id"> so the editable preview can bind contentEditable
  // regions directly on the styled render. Invisible otherwise; the slot text
  // inside is already escaped, and slot ids are template-authored identifiers.
  const wrapSlot = (slot: TemplateSlot, value: string, empty: boolean): string => {
    if (format !== "html" && format !== "email") return value;
    const id = slot.id.replace(/["<>&]/g, "");
    if (slot.render === "lines") {
      // Each line is its own <li> — mark every one; the edit script reassembles
      // the full slot text (all lines, newline-joined) on commit.
      let line = 0;
      return value.replace(
        /<li>([\s\S]*?)<\/li>/g,
        (_m, inner: string) =>
          `<li><span data-slot="${id}" data-line="${line++}"${empty ? ' data-empty="1"' : ""}>${inner}</span></li>`
      );
    }
    return `<span data-slot="${id}"${empty ? ' data-empty="1"' : ""}>${value}</span>`;
  };

  for (const slot of slots) {
    const fill = (fills[slot.id] ?? "").trim();
    if (fill !== "") {
      rendered.set(slot.id, wrapSlot(slot, escapeForFormat(format, slot, fill), false));
      continue;
    }
    if (!slot.required) {
      rendered.set(slot.id, "");
      continue;
    }
    warnings.push({
      slot_id: slot.id,
      kind: "missing",
      detail: `Required slot "${slot.label}" has no content — a visible placeholder was rendered.`,
    });
    const placeholder = escapeForFormat(format, { ...slot, render: "text" }, missingPlaceholder(slot.label));
    rendered.set(
      slot.id,
      slot.render === "lines" && (format === "html" || format === "deck" || format === "email")
        ? wrapSlot(slot, `<li>${placeholder}</li>`, true)
        : wrapSlot(slot, placeholder, true)
    );
  }

  const merge = (fragment: string) =>
    fragment.replace(PLACEHOLDER_RE, (_m, id: string) => rendered.get(id) ?? "");

  if (format !== "deck") return { payload: merge(body), warnings };

  const deck = parseDeckBody(body);
  if (!deck) {
    throw new Error("Malformed deck template body — save-time validation should have rejected it.");
  }
  const payload = [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    `<style>${deck.master.css}</style>`,
    "</head>",
    "<body>",
    ...deck.slides.map((s) => merge(s.html)),
    "</body>",
    "</html>",
  ].join("\n");
  return { payload, warnings };
}

/** Brand chrome is PRODUCT-derived, never model judgment: a Masterworks
 *  Maintain datasheet must never render another product's wordmark. When the
 *  template carries a brand_wordmark slot, generation forces it from the
 *  artifact's product (force=true, overriding whatever the model filled);
 *  re-renders default it only when empty, so a deliberate human edit to the
 *  wordmark survives. Pure — unit-tested alongside the render layer. */
export function applyBrandDefaults(
  slots: TemplateSlot[],
  fills: Record<string, string>,
  productName: string,
  force: boolean
): Record<string, string> {
  if (!slots.some((s) => s.id === "brand_wordmark")) return fills;
  const current = (fills.brand_wordmark ?? "").trim();
  if (!force && current !== "") return fills;
  return { ...fills, brand_wordmark: productName.trim().toUpperCase() };
}

/** Placeholder fills for GET /preview: each slot -> «label — max N chars»
 *  ('lines': max_lines placeholder rows). */
export function placeholderFills(slots: TemplateSlot[]): Record<string, string> {
  const fills: Record<string, string> = {};
  for (const slot of slots) {
    const line = `«${slot.label} — max ${slot.max_chars} chars»`;
    fills[slot.id] =
      slot.render === "lines"
        ? Array.from({ length: slot.max_lines ?? 3 }, () => line).join("\n")
        : line;
  }
  return fills;
}

/** Sanitized digest for artifact_versions.content_html — contains EVERY generated
 *  word so the existing forbidden-words finalize gate covers template artifacts
 *  unchanged. Callers pass the result through cleanHtml() before insert. */
export function buildDigestHtml(
  title: string,
  meta: { templateName: string; templateVersion: number; productName: string; docVersion: number },
  slots: TemplateSlot[],
  fills: Record<string, string>,
  warnings: RenderWarning[]
): string {
  const parts = [
    `<h1>${escapeXml(title)}</h1>`,
    `<p><em>Generated from "${escapeXml(meta.templateName)}" v${meta.templateVersion} · ${escapeXml(meta.productName)} Messaging Doc v${meta.docVersion}</em></p>`,
  ];
  for (const slot of slots) {
    const fill = (fills[slot.id] ?? "").trim();
    parts.push(`<h3>${escapeXml(slot.label)}</h3>`);
    parts.push(
      fill === "" ? "<p><em>(empty)</em></p>" : `<p>${escapeXml(fill).replace(/\r?\n/g, "<br>")}</p>`
    );
  }
  if (warnings.length > 0) {
    parts.push(
      `<blockquote>${warnings.map((w) => escapeXml(`⚠ ${w.slot_id}: ${w.detail}`)).join("<br>")}</blockquote>`
    );
  }
  return parts.join("\n");
}
