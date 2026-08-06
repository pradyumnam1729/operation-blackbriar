import { TemplateFormat } from "../lib/api";

// The one rendering primitive for template payloads (blueprint §4.2), reused by
// the Template Library page and the artifact editor. Payloads always render in
// a fully sandboxed iframe (sandbox="" — no scripts, no same-origin, no top
// navigation): the payload came through the authed JSON API, the token never
// touches the frame, and even a hostile payload stays inert.

interface Props {
  format: TemplateFormat;
  payload: string;
  /** Basis for the download filename; falls back to "artifact". */
  title?: string;
  /** Hide the download control (e.g. inside the library preview drawer). */
  hideDownload?: boolean;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** svg/markdown payloads need a minimal html shell before srcDoc. */
function toSrcDoc(format: TemplateFormat, payload: string): string {
  if (format === "svg") {
    return `<!doctype html><html><head><style>html,body{margin:0;padding:0}svg{display:block;width:100%;height:auto}</style></head><body>${payload}</body></html>`;
  }
  if (format === "markdown") {
    return `<!doctype html><html><head><style>body{margin:0;padding:18px;font-family:ui-monospace,Consolas,monospace;font-size:13px;white-space:pre-wrap;color:#20282b}</style></head><body>${escapeHtml(payload)}</body></html>`;
  }
  return payload; // html / deck / email payloads are complete documents
}

const EXTENSION: Record<TemplateFormat, string> = {
  html: ".html",
  svg: ".svg",
  deck: "-deck.html",
  email: ".html",
  markdown: ".md",
};

const MIME: Record<TemplateFormat, string> = {
  html: "text/html",
  svg: "image/svg+xml",
  deck: "text/html",
  email: "text/html",
  markdown: "text/markdown",
};

function frameStyle(format: TemplateFormat): React.CSSProperties {
  const base: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--border)",
    background: "#fff",
    display: "block",
  };
  if (format === "svg") return { ...base, aspectRatio: "1200/628" };
  if (format === "deck") return { ...base, height: 620 }; // slides stack — taller, scrolls
  if (format === "markdown") return { ...base, height: 460 };
  return { ...base, aspectRatio: "816/1056" }; // html / email — US Letter proportions
}

export function TemplatePreview({ format, payload, title, hideDownload }: Props) {
  const download = () => {
    const slug =
      (title ?? "artifact")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "artifact";
    const blob = new Blob([payload], { type: MIME[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}${EXTENSION[format]}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <iframe
        sandbox=""
        srcDoc={toSrcDoc(format, payload)}
        title="Rendered template preview"
        style={frameStyle(format)}
      />
      {!hideDownload && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-sm" onClick={download}>
            <i className="fa-solid fa-download" /> Download {EXTENSION[format].replace(/^-deck/, " deck")}
          </button>
        </div>
      )}
    </div>
  );
}
