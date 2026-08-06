import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

// The frontend never sees markdown. Model output (markdown) is converted to
// sanitized HTML here; editor-authored HTML is sanitized on save.

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "p", "br", "hr", "strong", "em", "u", "s",
    "ul", "ol", "li", "blockquote", "a", "table", "thead", "tbody", "tr",
    "th", "td", "code", "pre", "span",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["style"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedStyles: {
    span: { "background-color": [/^#[0-9a-f]{3,8}$/i], color: [/^#[0-9a-f]{3,8}$/i] },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

/** Model/markdown output → clean, user-ready HTML. */
export function markdownToHtml(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(raw, SANITIZE_OPTS);
}

/** Editor-authored HTML → sanitized HTML (defense against pasted scripts). */
export function cleanHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTS);
}

/** Strip tags for search indexing and diffing. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
