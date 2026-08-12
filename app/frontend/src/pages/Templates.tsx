import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  apiGet,
  apiGetBlob,
  deleteTemplate,
  getTemplate,
  listTemplates,
  previewTemplate,
  TemplateDetail,
  TemplatePreviewPayload,
  TemplateSummary,
} from "../lib/api";
import { TemplatePreview } from "../components/TemplatePreview";
import { TemplateEditor } from "../components/TemplateEditor";
import { SlideStage } from "../components/deck/SlideCanvas";
import type { DeckSlide } from "../lib/api";

// Template Library (blueprint §4.2): browse layout-locked, slot-based templates,
// preview them in a sandboxed iframe, and author them (PMM-admin only).
// Generation is consolidated in the Asset studio — the drawer's Generate button
// deep-links there with the template preselected (/studio?template=<id>).

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "datasheet", label: "Datasheet" },
  { key: "banner", label: "Banner" },
  { key: "deck", label: "Deck" },
  { key: "email", label: "Email" },
  { key: "battlecard", label: "Battlecard" },
  { key: "one-pager", label: "One-pager" },
  { key: "faq", label: "FAQ" },
  { key: "brochure", label: "Brochure" },
];

const FORMAT_ICONS: Record<string, string> = {
  html: "fa-file-lines",
  svg: "fa-image",
  deck: "fa-display",
  email: "fa-envelope",
  markdown: "fa-file-code",
};

/** Slot count + distinct wired section ids, derived from the template detail. */
interface CardMeta {
  slotCount: number;
  sections: string[];
}

const errStrip: React.CSSProperties = {
  marginBottom: 16,
  padding: "12px 16px",
  background: "#FCE8E8",
  borderRadius: "var(--r-md)",
  color: "#A32D2D",
  fontSize: 13,
  fontWeight: 500,
};

const basename = (p: string) => p.split(/[\\/]/).pop() ?? p;

// ---------- Preview drawer ----------

interface PreviewDrawerProps {
  summary: TemplateSummary;
  admin: boolean;
  onClose: () => void;
  onEdit: (t: TemplateDetail) => void;
  onGenerate: (t: TemplateSummary) => void;
}

function PreviewDrawer({ summary, admin, onClose, onEdit, onGenerate }: PreviewDrawerProps) {
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [preview, setPreview] = useState<TemplatePreviewPayload | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPreview(null);
    setPreviewError(null);
    setDetail(null);
    Promise.allSettled([getTemplate(summary.id), previewTemplate(summary.id)]).then(
      ([d, p]) => {
        if (!alive) return;
        if (d.status === "fulfilled") setDetail(d.value);
        if (p.status === "fulfilled") setPreview(p.value);
        else setPreviewError((p.reason as Error).message);
        setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, [summary.id]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="drawer"
        style={{ width: 760, maxWidth: "94%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>{summary.name}</h2>
          <button className="close" aria-label="Close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-secondary)" }}>
          {summary.asset_type}
          {summary.format ? ` · ${summary.format}` : ""} · v{summary.template_version}
          {summary.audience ? ` · ${summary.audience}` : ""}
          {summary.persona ? ` · ${summary.persona}` : ""}
          {summary.funnel_stage ? ` · ${summary.funnel_stage}` : ""}
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {summary.generation_ready && summary.approved && (
            <button
              className="btn btn-primary"
              title="Generation happens in the Asset studio — this opens it with the template preselected"
              onClick={() => onGenerate(summary)}
            >
              <i className="fa-solid fa-wand-magic-sparkles" /> Generate in Asset studio
            </button>
          )}
          {admin && detail && (
            <button className="btn" onClick={() => onEdit(detail)}>
              <i className="fa-solid fa-pen" /> Edit
            </button>
          )}
        </div>

        {loading && <div className="empty-note">Rendering preview…</div>}

        {!loading && preview && (
          <TemplatePreview format={preview.format} payload={preview.payload} hideDownload />
        )}
        {!loading && !preview && (
          <div className="empty-note">
            {summary.generation_ready
              ? `Preview unavailable: ${previewError ?? "unknown error"}`
              : "This is a legacy mock template with no layout body — it cannot be previewed or generated here. Use the Asset studio prompt path, or a PMM admin can add a layout body to make it slot-driven."}
          </div>
        )}

        {detail && detail.slots.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 500 }}>
              Slots ({detail.slots.length})
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Slot</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Purpose</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Max chars</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Wired sections</th>
                </tr>
              </thead>
              <tbody>
                {detail.slots.map((s) => (
                  <tr key={s.id}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {s.label}
                    </td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      {s.purpose}
                    </td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                      {s.max_chars}
                      {s.render === "lines" && s.max_lines !== undefined ? ` · ${s.max_lines} lines` : ""}
                    </td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {s.source_sections.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {summary.exemplar_path && (
          <p
            className="empty-note"
            style={{ padding: "12px 0 0" }}
            title={summary.exemplar_path}
          >
            Exemplar: {basename(summary.exemplar_path)}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- Page ----------

// ---- Brand theme card: the corporate PPT template that governs every deck ----

interface BrandTheme {
  source: string;
  extracted: string;
  available: boolean;
  sizeBytes: number | null;
  colors: Record<string, string>;
  fonts: { pptx: string; web: string };
  slide: { widthIn: number; heightIn: number };
  layouts: { key: string; label: string; dark: boolean }[];
}

const SWATCH_ORDER: [string, string][] = [
  ["tealDark", "Dark teal"],
  ["ink", "Ink"],
  ["tealLight", "Teal light"],
  ["tealMid", "Teal mid"],
  ["mist", "Mist"],
  ["charcoal", "Charcoal"],
  ["red", "Accent red"],
  ["green", "Green"],
  ["orange", "Orange"],
];

/** Seven sample slides — one per layout — for the in-app theme preview.
 *  Copy stays clear of the forbidden-words list. */
const THEME_SAMPLE_SLIDES: DeckSlide[] = [
  { id: "t1", layout: "title", title: "Deliver More With the Team You Have", subtitle: "How the corporate theme frames every deck" },
  { id: "t2", layout: "agenda", title: "What We'll Cover", body: ["Where programs stand today", "What changed", "The path forward"] },
  { id: "t3", layout: "section", title: "Part One", subtitle: "The market shift" },
  { id: "t4", layout: "content-bullets", title: "The Old Way", body: ["Program records scattered across systems", "Reports assembled by hand each quarter", "Risks surface after they cost money"] },
  {
    id: "t5",
    layout: "two-column",
    title: "Where Point Tools Stop",
    columns: [
      { heading: "Recording tools", items: ["Track what already happened", "Stop at the project boundary"] },
      { heading: "A unified system", items: ["Connects planning through maintenance", "Surfaces risk before it lands"] },
    ],
  },
  { id: "t6", layout: "quote", title: "Proof", quote: { text: "We deliver a growing program with the same team.", attribution: "Capital Program Director" } },
  { id: "t7", layout: "closing", title: "The Next Step", subtitle: "A working session on your own program data" },
];

function BrandThemeCard() {
  const [theme, setTheme] = useState<BrandTheme | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiGet<BrandTheme>("/api/templates/brand-theme")
      .then(setTheme)
      .catch(() => setTheme(null));
  }, []);

  const download = async () => {
    if (!theme) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await apiGetBlob("/api/templates/brand-theme/download");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = theme.source;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(
        `Download failed: ${(e as Error).message}. Check that the backend is running and try again.`
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!theme) return null;

  // A regular template card — identical chrome to every other card in the
  // grid; the corporate theme is nothing special in the library, it just
  // happens to be the theme every deck wears.
  return (
    <div
      className="template-card"
      role="button"
      tabIndex={0}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
      }}
    >
      <div
        className="thumb"
        style={{ background: `linear-gradient(135deg, #${theme.colors.ink}, #${theme.colors.tealDark})` }}
      >
        <i className="fa-regular fa-file-powerpoint" style={{ color: "#fff" }} />
      </div>
      <div className="tname" style={{ paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {theme.source}
          <span className="pill pill-live">pptx</span>
          <span className="pill pill-final">Corporate theme</span>
        </div>
        <div style={{ fontWeight: 400, fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
          deck · {theme.layouts.length} layouts · {theme.fonts.pptx} · governs every generated deck
          and .pptx export
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          {SWATCH_ORDER.slice(0, 6)
            .filter(([key]) => theme.colors[key])
            .map(([key]) => (
              <span
                key={key}
                title={`#${theme.colors[key]}`}
                style={{
                  width: 14,
                  height: 14,
                  background: `#${theme.colors[key]}`,
                  border: "1px solid var(--border)",
                  display: "inline-block",
                }}
              />
            ))}
        </div>
        {downloadError && (
          <div style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 6 }}>{downloadError}</div>
        )}
      </div>

      {open && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4, 32, 39, 0.55)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            cursor: "default",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              width: "min(96vw, 1000px)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px 26px",
              boxShadow: "0 24px 60px rgba(0,0,0,.35)",
            }}
          >
            <div className="row-between" style={{ marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                <i className="fa-regular fa-file-powerpoint" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
                {theme.source} — the seven deck layouts
              </h3>
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <button className="btn btn-sm" onClick={() => void download()} disabled={downloading}>
                  <i className={`fa-solid ${downloading ? "fa-spinner fa-spin" : "fa-download"}`} /> Download source
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    border: "none",
                    background: "var(--bg-page)",
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.55 }}>
              Rendered live by the same engine that draws the deck editor and the .pptx export —
              what you see here is exactly what generated decks look like. Its theme rides verbatim
              inside every exported file. Extracted {theme.extracted} · {theme.slide.widthIn}&Prime;
              × {theme.slide.heightIn}&Prime; · {theme.fonts.pptx} in exports, {theme.fonts.web} on
              the web canvas.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              {SWATCH_ORDER.filter(([key]) => theme.colors[key]).map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span
                    title={`#${theme.colors[key]}`}
                    style={{
                      width: 20,
                      height: 20,
                      background: `#${theme.colors[key]}`,
                      border: "1px solid var(--border)",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                    {label}
                    <span style={{ color: "var(--text-muted)", fontFamily: "Consolas, monospace", marginLeft: 5 }}>
                      #{theme.colors[key]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {THEME_SAMPLE_SLIDES.map((s) => (
                <div key={s.id}>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      overflow: "hidden",
                      position: "relative",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        width: 1280,
                        height: 720,
                        transform: "scale(var(--theme-thumb-scale, 0.2344))",
                        transformOrigin: "top left",
                        position: "absolute",
                      }}
                      ref={(el) => {
                        if (el && el.parentElement) {
                          const w = el.parentElement.clientWidth;
                          el.style.setProperty("--theme-thumb-scale", String(w / 1280));
                          el.style.transform = `scale(${w / 1280})`;
                        }
                      }}
                    >
                      <SlideStage slide={s} editable={false} kicker="Aurigo" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 5, fontWeight: 500 }}>
                    {theme.layouts.find((l) => l.key === s.layout)?.label ?? s.layout}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Templates() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const admin = me?.role === "admin";

  const [typeFilter, setTypeFilter] = useState("");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [meta, setMeta] = useState<Record<string, CardMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TemplateSummary | null>(null);
  const [editing, setEditing] = useState<TemplateDetail | null | "new">(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTemplates(typeFilter === "" ? undefined : { asset_type: typeFilter });
      setTemplates(rows);
      // Slot count + wiring chips need the detail rows (list excludes slots by
      // contract) — fetch details for generation-ready templates only.
      const ready = rows.filter((t) => t.generation_ready);
      const results = await Promise.allSettled(ready.map((t) => getTemplate(t.id)));
      const m: Record<string, CardMeta> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          const sections = [...new Set(r.value.slots.flatMap((s) => s.source_sections))].sort();
          m[ready[i].id] = { slotCount: r.value.slots.length, sections };
        }
      });
      setMeta(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // /templates?preview=<id> deep link (ask-to-artifact card's Preview link):
  // once the list is in, open the existing preview drawer for that template.
  // Handled once so closing the drawer doesn't re-open it on reloads.
  const [searchParams] = useSearchParams();
  const previewHandled = useRef(false);
  useEffect(() => {
    if (previewHandled.current || templates.length === 0) return;
    const pid = searchParams.get("preview");
    if (pid === null) return;
    previewHandled.current = true;
    const t = templates.find((x) => x.id === pid);
    if (t) setSelected(t);
  }, [templates, searchParams]);

  const remove = async (t: TemplateSummary) => {
    if (!window.confirm(`Delete template “${t.name}”? Artifacts already generated from it keep their renders.`)) return;
    try {
      await deleteTemplate(t.id);
      if (selected?.id === t.id) setSelected(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const noneReady = templates.length > 0 && templates.every((t) => !t.generation_ready);

  return (
    <div>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 className="pagetitle">
            Template library{" "}
            <span className="pill pill-lock" style={{ marginLeft: 6 }}>
              <i className="fa-solid fa-lock" style={{ fontSize: 9 }} /> Admin only
            </span>
          </h1>
          <p className="pagesub">
            Layout-locked templates filled from each product&rsquo;s approved messaging document —
            one document fans out to every artifact type.
          </p>
        </div>
        {admin && (
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <i className="fa-solid fa-plus" /> New template
          </button>
        )}
      </div>

      <div className="step-pills">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            className={typeFilter === f.key ? "step-pill active" : "step-pill"}
            onClick={() => setTypeFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div style={errStrip}>{error}</div>}

      {loading && <div className="empty-note">Loading templates…</div>}

      {!loading && templates.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <i
            className="fa-regular fa-object-group"
            style={{ fontSize: 30, color: "var(--teal-light)", marginBottom: 10, display: "block" }}
          />
          <h2 style={{ margin: "0 0 6px" }}>No templates yet</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            {admin
              ? "Create the first layout-locked template — its slots wire to messaging-doc sections."
              : "PMM admins create templates here. Check back once the first one is published."}
          </p>
          {admin && (
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setEditing("new")}>
              <i className="fa-solid fa-plus" /> New template
            </button>
          )}
        </div>
      )}

      {!loading && noneReady && (
        <div className="empty-note" style={{ paddingTop: 0 }}>
          None of these templates carries a layout body yet — they generate via the Asset studio
          prompt path only. {admin ? "Add a body and slots to make one slot-driven." : ""}
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="grid grid-2">
          {(typeFilter === "" || typeFilter === "deck") && <BrandThemeCard />}
          {templates.map((t) => {
            const m = meta[t.id];
            return (
              <div
                key={t.id}
                className="template-card"
                role="button"
                tabIndex={0}
                onClick={() => setSelected(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(t);
                  }
                }}
              >
                <div
                  className="thumb"
                  style={
                    t.preview_color
                      ? { background: `linear-gradient(135deg, ${t.preview_color}, #CFE8EA)` }
                      : undefined
                  }
                >
                  <i className={`fa-regular ${FORMAT_ICONS[t.format ?? ""] ?? "fa-file-lines"}`} />
                </div>
                <div className="tname" style={{ paddingBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {t.name}
                    {t.format && <span className="pill pill-live">{t.format}</span>}
                    {t.generation_ready && <span className="pill pill-final">Slot-driven</span>}
                    {admin && !t.approved && <span className="pill pill-draft">Unapproved</span>}
                  </div>
                  <div style={{ fontWeight: 400, fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                    {t.asset_type}
                    {t.audience ? ` · ${t.audience}` : ""}
                    {t.persona ? ` · ${t.persona}` : ""}
                    {t.funnel_stage ? ` · ${t.funnel_stage}` : ""}
                    {m ? ` · ${m.slotCount} slots` : ""}
                  </div>
                  {m && m.sections.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {m.sections.map((s) => (
                        <span key={s} className="filechip" title={`Wired to messaging-doc section ${s}`}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {!t.generation_ready && (
                    <div style={{ fontWeight: 400, fontSize: 11.5, color: "var(--text-secondary)", marginTop: 6 }}>
                      Legacy mock template — no layout body, so it cannot generate here. It still
                      works with the Asset studio prompt path.
                    </div>
                  )}
                  {t.exemplar_path && (
                    <div
                      style={{ fontWeight: 400, fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}
                      title={t.exemplar_path}
                    >
                      Exemplar: {basename(t.exemplar_path)}
                    </div>
                  )}
                  {admin && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          getTemplate(t.id)
                            .then((d) => setEditing(d))
                            .catch((err) => setError((err as Error).message));
                        }}
                      >
                        <i className="fa-solid fa-pen" /> Edit
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void remove(t);
                        }}
                      >
                        <i className="fa-solid fa-trash" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <PreviewDrawer
          summary={selected}
          admin={admin}
          onClose={() => setSelected(null)}
          onEdit={(d) => {
            setSelected(null);
            setEditing(d);
          }}
          onGenerate={(t) => navigate(`/studio?template=${t.id}`)}
        />
      )}

      {editing !== null && (
        <TemplateEditor
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

    </div>
  );
}
