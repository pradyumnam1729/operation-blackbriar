import { cleanHtml } from "./html";

// Deck Studio slide model (blueprint app/docs/blueprints/deck-studio.md §1).
// Pure and deterministic: validation, derived-HTML rendering, guard text,
// the degraded scaffold, and model-output JSON extraction. No DB, no model.

export type SlideLayout =
  | "title"
  | "agenda"
  | "section"
  | "content-bullets"
  | "two-column"
  | "quote"
  | "closing";

export const SLIDE_LAYOUTS: SlideLayout[] = [
  "title",
  "agenda",
  "section",
  "content-bullets",
  "two-column",
  "quote",
  "closing",
];

export interface SlideColumn {
  heading: string;
  items: string[];
}

export interface SlideQuote {
  text: string;
  attribution: string;
}

export interface DeckSlide {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  body?: string[];
  columns?: [SlideColumn, SlideColumn];
  quote?: SlideQuote;
  notes?: string;
}

export interface DeckDoc {
  schema: 1;
  theme: "aurigo-2026";
  slides: DeckSlide[];
}

const CAPS = {
  slides: 40,
  title: 200,
  subtitle: 300,
  bodyItems: 20,
  bodyItem: 500,
  columnHeading: 120,
  columnItems: 10,
  columnItem: 300,
  quoteText: 600,
  quoteAttribution: 200,
  notes: 2000,
} as const;

type ValidationResult = { deck: DeckDoc } | { issues: string[] };

function asTrimmedString(v: unknown): string | null {
  return typeof v === "string" ? v.trim() : null;
}

function validateColumn(v: unknown, slideId: string, n: number, issues: string[]): SlideColumn {
  const o = (v ?? {}) as Record<string, unknown>;
  const heading = asTrimmedString(o.heading) ?? "";
  if (heading === "") issues.push(`slide ${slideId}: column ${n} needs a heading`);
  if (heading.length > CAPS.columnHeading)
    issues.push(`slide ${slideId}: column ${n} heading exceeds ${CAPS.columnHeading} chars`);
  const rawItems = Array.isArray(o.items) ? o.items : [];
  const items = rawItems
    .map((i) => asTrimmedString(i))
    .filter((i): i is string => i !== null && i !== "");
  if (items.length === 0) issues.push(`slide ${slideId}: column ${n} needs at least one item`);
  if (items.length > CAPS.columnItems)
    issues.push(`slide ${slideId}: column ${n} exceeds ${CAPS.columnItems} items`);
  for (const item of items) {
    if (item.length > CAPS.columnItem)
      issues.push(`slide ${slideId}: a column ${n} item exceeds ${CAPS.columnItem} chars`);
  }
  return { heading: heading.slice(0, CAPS.columnHeading), items };
}

/** Blueprint §1.1: strict shape, hard caps, layout-field coherence. Unknown keys stripped. */
export function validateDeckDoc(value: unknown): ValidationResult {
  const issues: string[] = [];
  const root = value as Record<string, unknown> | null;
  if (!root || typeof root !== "object") return { issues: ["not an object"] };
  if (root.schema !== 1) issues.push("schema must be 1");
  if (root.theme !== "aurigo-2026") issues.push('theme must be "aurigo-2026"');
  if (!Array.isArray(root.slides)) return { issues: [...issues, "slides must be an array"] };
  if (root.slides.length < 1) issues.push("deck needs at least 1 slide");
  if (root.slides.length > CAPS.slides) issues.push(`deck exceeds ${CAPS.slides} slides`);

  const seenIds = new Set<string>();
  const slides: DeckSlide[] = [];
  root.slides.forEach((raw, idx) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const id = asTrimmedString(o.id) ?? "";
    const label = id || `#${idx + 1}`;
    if (id === "") issues.push(`slide #${idx + 1}: missing id`);
    else if (seenIds.has(id)) issues.push(`slide ${id}: duplicate id`);
    seenIds.add(id);

    const layout = o.layout as SlideLayout;
    if (!SLIDE_LAYOUTS.includes(layout)) {
      issues.push(`slide ${label}: unknown layout "${String(o.layout)}"`);
      return;
    }

    const title = asTrimmedString(o.title) ?? "";
    if (title === "") issues.push(`slide ${label}: title is required`);
    if (title.length > CAPS.title) issues.push(`slide ${label}: title exceeds ${CAPS.title} chars`);

    const slide: DeckSlide = { id, layout, title: title.slice(0, CAPS.title) };

    const subtitle = asTrimmedString(o.subtitle);
    if (subtitle !== null && subtitle !== "") {
      if (!["title", "section", "closing"].includes(layout))
        issues.push(`slide ${label}: subtitle only allowed on title/section/closing`);
      if (subtitle.length > CAPS.subtitle)
        issues.push(`slide ${label}: subtitle exceeds ${CAPS.subtitle} chars`);
      slide.subtitle = subtitle.slice(0, CAPS.subtitle);
    }

    if (o.body !== undefined) {
      if (!["agenda", "content-bullets"].includes(layout))
        issues.push(`slide ${label}: body only allowed on agenda/content-bullets`);
      const rawBody = Array.isArray(o.body) ? o.body : [];
      const body = rawBody
        .map((b) => asTrimmedString(b))
        .filter((b): b is string => b !== null && b !== "");
      if (body.length > CAPS.bodyItems)
        issues.push(`slide ${label}: body exceeds ${CAPS.bodyItems} items`);
      for (const item of body) {
        if (item.length > CAPS.bodyItem)
          issues.push(`slide ${label}: a body item exceeds ${CAPS.bodyItem} chars`);
      }
      slide.body = body;
    }
    if (["agenda", "content-bullets"].includes(layout) && (slide.body?.length ?? 0) === 0) {
      issues.push(`slide ${label}: ${layout} needs at least one body item`);
    }

    if (o.columns !== undefined) {
      if (layout !== "two-column")
        issues.push(`slide ${label}: columns only allowed on two-column`);
      const cols = Array.isArray(o.columns) ? o.columns : [];
      if (cols.length !== 2) issues.push(`slide ${label}: two-column needs exactly 2 columns`);
      slide.columns = [
        validateColumn(cols[0], label, 1, issues),
        validateColumn(cols[1], label, 2, issues),
      ];
    } else if (layout === "two-column") {
      issues.push(`slide ${label}: two-column needs columns`);
    }

    if (o.quote !== undefined) {
      if (layout !== "quote") issues.push(`slide ${label}: quote only allowed on quote layout`);
      const q = (o.quote ?? {}) as Record<string, unknown>;
      const text = asTrimmedString(q.text) ?? "";
      const attribution = asTrimmedString(q.attribution) ?? "";
      if (text === "") issues.push(`slide ${label}: quote text is required`);
      if (text.length > CAPS.quoteText)
        issues.push(`slide ${label}: quote exceeds ${CAPS.quoteText} chars`);
      if (attribution.length > CAPS.quoteAttribution)
        issues.push(`slide ${label}: quote attribution exceeds ${CAPS.quoteAttribution} chars`);
      slide.quote = {
        text: text.slice(0, CAPS.quoteText),
        attribution: attribution.slice(0, CAPS.quoteAttribution),
      };
    } else if (layout === "quote") {
      issues.push(`slide ${label}: quote layout needs a quote`);
    }

    const notes = asTrimmedString(o.notes);
    if (notes !== null && notes !== "") {
      if (notes.length > CAPS.notes) issues.push(`slide ${label}: notes exceed ${CAPS.notes} chars`);
      slide.notes = notes.slice(0, CAPS.notes);
    }

    slides.push(slide);
  });

  if (issues.length > 0) return { issues };
  return { deck: { schema: 1, theme: "aurigo-2026", slides } };
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Deterministic derived rendering stored as content_html. Emits only
 * sanitizer-whitelisted tags (services/html.ts) so diff, search, the finalize
 * guard, and read-only fallbacks all keep working on content_html unchanged.
 */
export function slidesToHtml(deck: DeckDoc): string {
  const parts: string[] = [];
  deck.slides.forEach((s, i) => {
    if (i > 0) parts.push("<hr>");
    parts.push(`<h2>${esc(s.title)}</h2>`);
    if (s.subtitle) parts.push(`<h3>${esc(s.subtitle)}</h3>`);
    if (s.body && s.body.length > 0) {
      parts.push(`<ul>${s.body.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
    }
    if (s.columns) {
      for (const col of s.columns) {
        parts.push(`<h3>${esc(col.heading)}</h3>`);
        parts.push(`<ul>${col.items.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
      }
    }
    if (s.quote) {
      parts.push(
        `<blockquote><p>${esc(s.quote.text)}</p>${s.quote.attribution ? `<p>— ${esc(s.quote.attribution)}</p>` : ""}</blockquote>`
      );
    }
    if (s.notes) parts.push(`<p><em>Speaker notes:</em> ${esc(s.notes)}</p>`);
  });
  return cleanHtml(parts.join("\n"));
}

/** Guard input: every customer-visible string INCLUDING speaker notes (they ship in the .pptx). */
export function deckToText(deck: DeckDoc): string {
  const out: string[] = [];
  for (const s of deck.slides) {
    out.push(s.title);
    if (s.subtitle) out.push(s.subtitle);
    if (s.body) out.push(...s.body);
    if (s.columns) for (const c of s.columns) out.push(c.heading, ...c.items);
    if (s.quote) out.push(s.quote.text, s.quote.attribution);
    if (s.notes) out.push(s.notes);
  }
  return out.join("\n");
}

/**
 * Deterministic 8-slide arc skeleton for the degraded Studio path (AI
 * unavailable). Placeholder text carries no forbidden words by construction.
 */
export function scaffoldDeck(title: string, productName: string | null): DeckDoc {
  const product = productName ?? "Aurigo";
  const placeholder = "Draft this slide in the editor.";
  return {
    schema: 1,
    theme: "aurigo-2026",
    slides: [
      { id: "s1", layout: "title", title, subtitle: product },
      { id: "s2", layout: "content-bullets", title: "The old way", body: [placeholder] },
      { id: "s3", layout: "content-bullets", title: "What changed", body: [placeholder] },
      { id: "s4", layout: "content-bullets", title: "The cost of standing still", body: [placeholder] },
      {
        id: "s5",
        layout: "two-column",
        title: "Where alternatives hit their ceiling",
        columns: [
          { heading: "Where they stop", items: [placeholder] },
          { heading: `Where ${product} continues`, items: [placeholder] },
        ],
      },
      { id: "s6", layout: "content-bullets", title: "What success looks like", body: [placeholder] },
      {
        id: "s7",
        layout: "quote",
        title: "Proof",
        quote: { text: placeholder, attribution: "Add a validated customer proof point" },
      },
      { id: "s8", layout: "closing", title: "The next step", subtitle: placeholder },
    ],
  };
}

/** Strip code fences / stray prose, parse, validate. Shared by generation, chat-edit, convert. */
export function extractDeckJson(modelText: string): ValidationResult {
  let text = modelText.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { issues: ["no JSON object found in the reply"] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return { issues: [`JSON parse failed: ${(err as Error).message}`] };
  }
  return validateDeckDoc(parsed);
}
