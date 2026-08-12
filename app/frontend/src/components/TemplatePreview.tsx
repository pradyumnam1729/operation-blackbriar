import { useEffect, useRef, useState } from "react";
import { apiPostBlob, TemplateFormat } from "../lib/api";

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

// html/email/deck templates are authored at a fixed US-Letter-ish canvas
// (816x1056, per the locked brand CSS in supabase/migrations/0011 & 0015) —
// the iframe below is sized to that intrinsic canvas, then scaled to fit
// whatever panel it's rendered in so nothing needs horizontal scrolling.
const CANVAS_W = 816;
const CANVAS_H = 1056;
const FIXED_WIDTH_FORMATS: TemplateFormat[] = ["html", "email", "deck"];

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

const SVG_MIME = "image/svg+xml";

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Non-fixed-width formats keep their previous responsive box. */
function frameStyle(format: TemplateFormat): React.CSSProperties {
  const base: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--border)",
    background: "#fff",
    display: "block",
  };
  if (format === "svg") return { ...base, aspectRatio: "1200/628" };
  return { ...base, height: 460 }; // markdown
}

export function TemplatePreview({ format, payload, title, hideDownload }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const fixedWidth = FIXED_WIDTH_FORMATS.includes(format);
  const canvasHeight = format === "deck" ? 620 : CANVAS_H; // decks stay a fixed scrollable box

  useEffect(() => {
    if (!fixedWidth || !wrapperRef.current) return;
    const el = wrapperRef.current;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / CANVAS_W));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fixedWidth]);

  const download = async () => {
    setDownloadError("");
    const slug =
      (title ?? "artifact")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "artifact";

    if (format === "svg") {
      triggerDownload(new Blob([payload], { type: SVG_MIME }), `${slug}.svg`);
      return;
    }
    setDownloading(true);
    try {
      const pdf = await apiPostBlob("/api/export/pdf", { format, payload, title });
      triggerDownload(pdf, `${slug}.pdf`);
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      {fixedWidth ? (
        <div
          ref={wrapperRef}
          style={{ width: "100%", overflow: "hidden", height: canvasHeight * scale }}
        >
          <iframe
            sandbox=""
            srcDoc={toSrcDoc(format, payload)}
            title="Rendered template preview"
            style={{
              width: CANVAS_W,
              height: canvasHeight,
              border: "1px solid var(--border)",
              background: "#fff",
              display: "block",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      ) : (
        <iframe
          sandbox=""
          srcDoc={toSrcDoc(format, payload)}
          title="Rendered template preview"
          style={frameStyle(format)}
        />
      )}
      {!hideDownload && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginTop: 8 }}>
          <button className="btn btn-sm" onClick={() => void download()} disabled={downloading}>
            <i className={`fa-solid ${downloading ? "fa-spinner fa-spin" : "fa-download"}`} />{" "}
            {downloading ? "Rendering…" : format === "svg" ? "Download .svg" : "Download PDF"}
          </button>
          {downloadError && (
            <div style={{ fontSize: 12.5, color: "#A32D2D" }}>{downloadError}</div>
          )}
        </div>
      )}
    </div>
  );
}
