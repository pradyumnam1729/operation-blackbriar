import { diffWords } from "diff";
import { htmlToText } from "./html";

/**
 * Word-level diff between two HTML versions, rendered as user-ready HTML
 * with <ins>/<del> marks (styled by the frontend). Diffs the visible text,
 * not the markup, so formatting changes don't drown content changes.
 */
export function diffVersionsHtml(oldHtml: string, newHtml: string): string {
  const parts = diffWords(htmlToText(oldHtml), htmlToText(newHtml));
  return parts
    .map((p) => {
      const safe = p.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (p.added) return `<ins>${safe}</ins>`;
      if (p.removed) return `<del>${safe}</del>`;
      return safe;
    })
    .join("");
}
