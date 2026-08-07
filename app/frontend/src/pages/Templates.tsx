import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
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
          <h1 className="pagetitle">Template library</h1>
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
