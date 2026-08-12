import { useEffect, useRef } from "react";
import { TemplateFormat } from "../lib/api";

// The one rendering primitive for template payloads (blueprint §4.2), reused by
// the Template Library page and the artifact editor. Payloads render in a
// sandboxed iframe: read-only mode is fully inert (sandbox=""); editable mode
// allows ONLY scripts (no same-origin — the frame keeps an opaque origin, so
// the auth token and parent DOM stay unreachable) to run the tiny injected
// editor that binds contentEditable to the payload's data-slot markers and
// postMessages edits back to the parent.

interface Props {
  format: TemplateFormat;
  payload: string;
  /** Basis for the download filename; falls back to "artifact". */
  title?: string;
  /** Hide the download control (e.g. inside the library preview drawer). */
  hideDownload?: boolean;
  /** Inline slot editing on the styled render (canEdit surfaces only). */
  editable?: boolean;
  /** One edited slot committed (blur): id + new plain text. */
  onSlotEdit?: (slotId: string, text: string) => void;
  /** How many editable slot regions the payload carries (0 = legacy render). */
  onEditableRegions?: (count: number) => void;
}

/** Injected into the editable frame. Marks [data-slot] regions editable and
 *  reports commits to the parent; runs with an opaque origin. */
const EDIT_SCRIPT = `<script>(function(){
  var els = document.querySelectorAll("[data-slot]");
  parent.postMessage({ hive: "slots-ready", count: els.length }, "*");
  els.forEach(function (el) {
    el.setAttribute("contenteditable", "true");
    el.style.outline = "1.5px dashed rgba(70,178,190,.6)";
    el.style.outlineOffset = "2px";
    el.style.cursor = "text";
    el.addEventListener("focus", function () {
      el.style.outline = "2px solid rgba(1,95,116,.9)";
      if (el.getAttribute("data-empty") === "1") {
        el.textContent = "";
        el.removeAttribute("data-empty");
      }
    });
    el.addEventListener("blur", function () {
      el.style.outline = "1.5px dashed rgba(70,178,190,.6)";
      var id = el.getAttribute("data-slot");
      var text;
      if (el.hasAttribute("data-line")) {
        // Lines slot: one <li> per line — reassemble the FULL slot text from
        // every line element, in DOM order, so the fill round-trips intact.
        var lines = [];
        document.querySelectorAll('[data-slot="' + id + '"]').forEach(function (lineEl) {
          lines.push(lineEl.innerText.replace(/\\n+/g, " ").trim());
        });
        text = lines.filter(function (l) { return l !== ""; }).join("\\n");
      } else {
        text = el.innerText;
      }
      parent.postMessage({ hive: "slot-edit", id: id, text: text }, "*");
    });
  });
})();</scr` + `ipt>`;

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

export function TemplatePreview({
  format,
  payload,
  title,
  hideDownload,
  editable,
  onSlotEdit,
  onEditableRegions,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!editable) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { hive?: string; count?: number; id?: string; text?: string };
      if (data?.hive === "slots-ready") onEditableRegions?.(Number(data.count) || 0);
      if (data?.hive === "slot-edit" && typeof data.id === "string" && typeof data.text === "string") {
        onSlotEdit?.(data.id, data.text);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editable, onSlotEdit, onEditableRegions]);

  const baseDoc = toSrcDoc(format, payload);
  const srcDoc = editable
    ? /<\/body>/i.test(baseDoc)
      ? baseDoc.replace(/<\/body>/i, `${EDIT_SCRIPT}</body>`)
      : baseDoc + EDIT_SCRIPT
    : baseDoc;

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
        ref={frameRef}
        sandbox={editable ? "allow-scripts" : ""}
        srcDoc={srcDoc}
        title="Rendered template preview"
        style={frameStyle(format)}
      />
      {!hideDownload && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-sm" onClick={download}>
            <i className="fa-solid fa-file-export" /> Export {EXTENSION[format].replace(/^-deck/, " deck")}
          </button>
        </div>
      )}
    </div>
  );
}
