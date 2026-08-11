import { apiGet, getArtifactRender } from "./api";

// Shared new-tab viewers for finalized content (blueprint workspace-tabs §5).
// Moved out of Studio so the PMM Workspace finalized tables use the exact same
// render paths — html/svg/deck renders first, brand-styled digest fallback.
// Callers catch thrown errors and surface them in their own error banner.

// Single source for the brand-styled HTML shell both viewers share.
const BRAND_STYLE =
  "<style>body{font-family:Roboto,Arial,sans-serif;color:#20282B;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.65}h1{color:#053445}h2{color:#015F74}a{color:#015F74}table{border-collapse:collapse;width:100%}th,td{border:1px solid #E1E6E9;padding:8px 10px;text-align:left}th{background:#F5F7F8}</style>";

/** Blob-URL documents are same-origin with the app — user-authored titles must
 *  never reach the markup unescaped. contentHtml is server-sanitized output. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function openBrandShell(title: string, bodyHtml: string): void {
  const html = [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    BRAND_STYLE,
    "</head><body>",
    bodyHtml,
    "</body></html>",
  ].join("");
  window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
}

/** Opens a finalized artifact's true laid-out render in a new tab
 *  (artifact_renders payload for template-generated artifacts); the flat
 *  digest is only the fallback for rich-text artifacts. Formerly Studio's
 *  viewFinal(). */
export async function openArtifactRender(a: { id: string; title: string }): Promise<void> {
  const r = await apiGet<{ contentHtml: string; hasRender?: boolean }>(`/api/artifacts/${a.id}`);
  if (r.hasRender) {
    try {
      const render = await getArtifactRender(a.id);
      if (render.format === "html" || render.format === "email" || render.format === "deck") {
        window.open(URL.createObjectURL(new Blob([render.payload], { type: "text/html" })), "_blank");
        return;
      }
      if (render.format === "svg") {
        window.open(URL.createObjectURL(new Blob([render.payload], { type: "image/svg+xml" })), "_blank");
        return;
      }
      // markdown and anything else: fall through to the digest shell.
    } catch {
      // render fetch failed — fall back to the digest below
    }
  }
  // Digest fallback: it already opens with its own <h1>, so no extra title.
  openBrandShell(
    a.title,
    r.contentHtml === "" ? `<h1>${escapeHtml(a.title)}</h1><p>(no rendered content)</p>` : r.contentHtml
  );
}

/** Opens an approved messaging document as brand-styled HTML in a new tab.
 *  Formerly Studio's viewDoc(). */
export async function openMessagingDoc(d: { id: string }): Promise<void> {
  const r = await apiGet<{ doc: { title: string; content_html: string } }>(
    `/api/messaging-docs/doc/${d.id}`
  );
  openBrandShell(r.doc.title, r.doc.content_html);
}
