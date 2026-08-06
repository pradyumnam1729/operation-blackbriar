import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Editor } from "@tiptap/react";
import {
  apiDelete,
  apiGet,
  apiPost,
  ArtifactRender,
  getArtifactRender,
  getTemplate,
  TemplateDetail,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { RichEditor } from "../components/RichEditor";
import { Comments } from "../components/Comments";
import { TemplatePreview } from "../components/TemplatePreview";
import { SlotFillPanel } from "../components/SlotFillPanel";

type ArtifactStatus = "draft" | "in_review" | "final" | "archived";

interface ArtifactDetail {
  id: string;
  title: string;
  asset_type: string;
  product_id: string | null;
  product_name: string | null;
  persona: string | null;
  status: ArtifactStatus;
  current_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface VersionMeta {
  id: string;
  version: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

interface DetailResponse {
  artifact: ArtifactDetail;
  versions: VersionMeta[];
  contentHtml: string;
  /** True for template-generated artifacts — an artifact_renders row exists. */
  hasRender?: boolean;
}

const STATUS_LABELS: Record<ArtifactStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  final: "Final",
  archived: "Archived",
};

const STATUS_PILL: Record<ArtifactStatus, string> = {
  draft: "pill-draft",
  in_review: "pill-review",
  final: "pill-final",
  archived: "pill-archived",
};

/** Mirrors the backend transition map, with button labels. */
const TRANSITIONS: Record<ArtifactStatus, { to: ArtifactStatus; label: string }[]> = {
  draft: [{ to: "in_review", label: "Send to review" }, { to: "archived", label: "Archive" }],
  in_review: [
    { to: "final", label: "Mark final" },
    { to: "draft", label: "Back to draft" },
    { to: "archived", label: "Archive" },
  ],
  final: [
    { to: "in_review", label: "Reopen for review" },
    { to: "archived", label: "Archive" },
  ],
  archived: [{ to: "draft", label: "Restore to draft" }],
};

const AI_ACTIONS: { action: string; label: string; icon: string }[] = [
  { action: "rewrite", label: "Rewrite", icon: "fa-wand-magic-sparkles" },
  { action: "shorten", label: "Shorten", icon: "fa-minimize" },
  { action: "expand", label: "Expand", icon: "fa-maximize" },
  { action: "voice-fix", label: "Fix voice", icon: "fa-spell-check" },
  { action: "formalize", label: "Executive tone", icon: "fa-user-tie" },
];

// Red-tinted error strip (422 banned-words and other failures).
const errStrip: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  background: "#FCE8E8",
  borderRadius: "var(--r-md)",
  color: "#A32D2D",
  fontSize: 13,
  fontWeight: 500,
};

export function ArtifactEditor() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const navigate = useNavigate();
  const admin = me?.role === "admin";

  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [html, setHtml] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Template-generated artifacts: raw render + the template's slot definitions.
  const [render, setRender] = useState<ArtifactRender | null>(null);
  const [renderTpl, setRenderTpl] = useState<TemplateDetail | null>(null);
  const [viewRender, setViewRender] = useState<ArtifactRender | null>(null);

  const editorRef = useRef<Editor | null>(null);

  // AI
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");

  // save
  const [saveNote, setSaveNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // versions panel
  const [viewVersion, setViewVersion] = useState<{ version: number; content_html: string; note: string | null } | null>(null);
  const [compareFrom, setCompareFrom] = useState<number | "">("");
  const [compareTo, setCompareTo] = useState<number | "">("");
  const [diffHtml, setDiffHtml] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  // status
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiGet<DetailResponse>(`/api/artifacts/${id}`);
      setArtifact(data.artifact);
      setVersions(data.versions);
      setHtml(data.contentHtml);
      setLoadError(null);
      if (data.hasRender) {
        // Template-generated: mount the render surface instead of RichEditor.
        try {
          const r = await getArtifactRender(id);
          setRender(r);
          if (r.template_id) {
            // Slot definitions (labels, limits, wiring) live on the template.
            try {
              setRenderTpl(await getTemplate(r.template_id));
            } catch {
              setRenderTpl(null); // template deleted/hidden — editing disabled
            }
          } else {
            setRenderTpl(null);
          }
        } catch {
          setRender(null); // fall back to the classic editor surface
        }
      } else {
        setRender(null);
        setRenderTpl(null);
      }
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const canEdit = !!artifact && !!me && (admin || artifact.created_by === me.id);

  // ---------- AI actions ----------
  const runAi = async (payload: { action?: string; instruction?: string }, busyLabel: string) => {
    const editor = editorRef.current;
    setAiError(null);
    setAiBusy(busyLabel);
    const hasSelection = !!editor && !editor.state.selection.empty;
    const selectionText = hasSelection
      ? editor!.state.doc.textBetween(editor!.state.selection.from, editor!.state.selection.to, " ")
      : "";
    const text = selectionText.trim() !== "" ? selectionText : editor?.getHTML() ?? html;
    try {
      const r = await apiPost<{ html: string }>("/api/ai/edit", { ...payload, text });
      if (selectionText.trim() !== "" && editor) {
        // Replace only the selected passage; the rest of the doc is untouched.
        editor.chain().focus().deleteSelection().insertContent(r.html).run();
      } else if (editor) {
        editor.commands.setContent(r.html, { emitUpdate: true });
      } else {
        setHtml(r.html);
      }
    } catch (e) {
      // AI unavailable (e.g. no API credits) — surface the error, keep content.
      setAiError((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  };

  // ---------- save version ----------
  const saveVersion = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    setSavedMsg(null);
    try {
      const r = await apiPost<{ version: number }>(`/api/artifacts/${id}/versions`, {
        content_html: editorRef.current?.getHTML() ?? html,
        note: saveNote.trim() || undefined,
      });
      setSaveNote("");
      setSavedMsg(`Saved as version ${r.version}`);
      await load();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- version panel ----------
  const openVersion = async (v: number) => {
    if (!id) return;
    setPanelError(null);
    setDiffHtml(null);
    setViewRender(null);
    try {
      const r = await apiGet<{ version: { version: number; content_html: string; note: string | null } }>(
        `/api/artifacts/${id}/versions/${v}`
      );
      setViewVersion(r.version);
      if (render) {
        // Template-generated: also show that version's rendered payload.
        try {
          setViewRender(await getArtifactRender(id, v));
        } catch {
          setViewRender(null);
        }
      }
    } catch (e) {
      setPanelError((e as Error).message);
    }
  };

  const runCompare = async () => {
    if (!id || compareFrom === "" || compareTo === "") return;
    setPanelError(null);
    setViewVersion(null);
    setViewRender(null);
    try {
      const r = await apiGet<{ diffHtml: string }>(
        `/api/artifacts/${id}/diff?from=${compareFrom}&to=${compareTo}`
      );
      setDiffHtml(r.diffHtml);
    } catch (e) {
      setPanelError((e as Error).message);
    }
  };

  const rollback = async (v: number) => {
    if (!id) return;
    if (!window.confirm(`Roll back to version ${v}? Its content is copied forward as a new version — nothing is deleted.`)) return;
    setPanelError(null);
    try {
      await apiPost(`/api/artifacts/${id}/rollback`, { to: v });
      setViewVersion(null);
      setDiffHtml(null);
      setViewRender(null);
      await load();
    } catch (e) {
      setPanelError((e as Error).message);
    }
  };

  // ---------- status (admin) ----------
  const setStatus = async (to: ArtifactStatus) => {
    if (!id) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      await apiPost(`/api/artifacts/${id}/status`, { status: to });
      await load();
    } catch (e) {
      setStatusError((e as Error).message);
    } finally {
      setStatusBusy(false);
    }
  };

  const deleteArtifact = async () => {
    if (!id) return;
    if (!window.confirm("Delete this artifact and its full version history? This cannot be undone.")) return;
    try {
      await apiDelete(`/api/artifacts/${id}`);
      navigate("/library");
    } catch (e) {
      setStatusError((e as Error).message);
    }
  };

  // ---------- render ----------
  if (loading) {
    return <div className="empty-note">Loading artifact…</div>;
  }

  if (loadError || !artifact) {
    return (
      <div className="card">
        <h1 className="pagetitle">Artifact unavailable</h1>
        <div style={errStrip}>{loadError ?? "Artifact not found."}</div>
        <button className="btn" style={{ marginTop: 14 }} onClick={() => navigate("/library")}>
          <i className="fa-solid fa-arrow-left" /> Back to repository
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate("/library")}>
        <i className="fa-solid fa-arrow-left" /> Repository
      </button>

      <div className="row-between" style={{ alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h1 className="pagetitle" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {artifact.title}
            <span className={`pill ${STATUS_PILL[artifact.status]}`}>{STATUS_LABELS[artifact.status]}</span>
          </h1>
          <p className="pagesub" style={{ marginBottom: 0 }}>
            {artifact.product_name ?? "No product"} &middot; {artifact.asset_type}
            {artifact.persona ? <> &middot; {artifact.persona}</> : null} &middot; v
            {artifact.current_version} &middot; updated {new Date(artifact.updated_at).toLocaleString()}
          </p>
        </div>
        {admin && (
          <button className="btn btn-danger" onClick={deleteArtifact}>
            <i className="fa-solid fa-trash" /> Delete
          </button>
        )}
      </div>

      {admin && (
        <div className="card">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)", marginRight: 4 }}>
              Status
            </span>
            {TRANSITIONS[artifact.status].map((t, i) => (
              <button
                key={t.to}
                className={i === 0 ? "btn btn-primary btn-sm" : "btn btn-sm"}
                disabled={statusBusy}
                onClick={() => setStatus(t.to)}
              >
                <i
                  className={`fa-solid ${
                    t.to === "final"
                      ? "fa-circle-check"
                      : t.to === "archived"
                        ? "fa-box-archive"
                        : t.to === "in_review"
                          ? "fa-magnifying-glass"
                          : "fa-pen"
                  }`}
                />
                {t.label}
              </button>
            ))}
          </div>
          {statusError && <div style={errStrip}>{statusError}</div>}
        </div>
      )}

      {render !== null ? (
        <>
          {render.warnings.length > 0 && (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 16px",
                background: "#FCE8E8",
                borderRadius: "var(--r-md)",
                color: "#A32D2D",
                fontSize: 13,
              }}
              role="alert"
            >
              <b>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />
                {render.warnings.length} slot{render.warnings.length === 1 ? "" : "s"} need
                {render.warnings.length === 1 ? "s" : ""} PMM input
              </b>{" "}
              — the render shows &ldquo;⚠ needs PMM input&rdquo; placeholders until the text is
              supplied below.
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {render.warnings.map((w, i) => (
                  <li key={i}>
                    <b>{w.slot_id}</b>: {w.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {artifact.status === "final" && (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 16px",
                background: "#E4F4EE",
                borderRadius: "var(--r-md)",
                color: "#0E6B4E",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
              Final — the rendered file is exported to the Output folder with the next finals
              export. Use Download for a local copy.
            </div>
          )}

          {canEdit && !renderTpl && (
            <div className="card">
              <p className="empty-note" style={{ padding: 0, margin: 0 }}>
                The template behind this artifact is no longer available, so slot editing is
                disabled. The rendered file below still works — or generate a new draft from a
                current template in the Template library.
              </p>
            </div>
          )}

          <div
            className={canEdit && renderTpl ? "grid grid-2" : undefined}
            style={canEdit && renderTpl ? { alignItems: "start" } : undefined}
          >
            {canEdit && renderTpl && (
              <SlotFillPanel
                key={artifact.current_version}
                artifactId={artifact.id}
                slots={renderTpl.slots}
                fills={render.slot_fills}
                warnings={render.warnings}
                onSaved={load}
              />
            )}
            <div className="card">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
                  <i className="fa-solid fa-eye" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
                  Rendered artifact (v{artifact.current_version})
                </h3>
                {render.template_version !== null && (
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    template v{render.template_version}
                  </span>
                )}
              </div>
              <TemplatePreview format={render.format} payload={render.payload} title={artifact.title} />
            </div>
          </div>
        </>
      ) : canEdit ? (
        <>
          <div className="card">
            <div className="chip-row" style={{ marginTop: 0, alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)", marginRight: 4 }}>
                AI actions
              </span>
              {AI_ACTIONS.map((a) => (
                <button
                  key={a.action}
                  className="sugg-chip"
                  disabled={aiBusy !== null}
                  onClick={() => runAi({ action: a.action }, a.label)}
                >
                  <i className={`fa-solid ${a.icon}`} style={{ marginRight: 6 }} />
                  {aiBusy === a.label ? "Working…" : a.label}
                </button>
              ))}
            </div>
            <div className="chat-input-row" style={{ marginTop: 14 }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: "var(--teal-light)", fontSize: 15 }} />
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Or give the AI a specific instruction, e.g. “add a proof point section”"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && instruction.trim() && !aiBusy) {
                    runAi({ instruction: instruction.trim() }, "Instruction");
                  }
                }}
              />
              <button
                type="button"
                className="chat-send"
                title="Apply"
                disabled={aiBusy !== null || instruction.trim() === ""}
                onClick={() => runAi({ instruction: instruction.trim() }, "Instruction")}
              >
                {aiBusy === "Instruction" ? (
                  <i className="fa-solid fa-spinner fa-spin" />
                ) : (
                  <i className="fa-solid fa-arrow-up" />
                )}
              </button>
            </div>
            <p className="empty-note" style={{ padding: "8px 0 0", margin: 0 }}>
              Select text to act on a passage; with nothing selected the whole document is used.
            </p>
            {aiError && <div style={errStrip}>AI edit failed: {aiError} — your content is unchanged.</div>}
          </div>

          <div className="card">
            <RichEditor
              valueHtml={html}
              onChange={setHtml}
              onEditor={(e) => {
                editorRef.current = e;
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <input
                value={saveNote}
                onChange={(e) => setSaveNote(e.target.value)}
                placeholder="Version note (optional), e.g. “added proof point”"
              />
              <button
                className="btn btn-primary"
                style={{ whiteSpace: "nowrap" }}
                disabled={saving}
                onClick={saveVersion}
              >
                <i className="fa-solid fa-floppy-disk" />
                {saving ? "Saving…" : `Save version ${artifact.current_version + 1}`}
              </button>
            </div>
            {saveError && <div style={errStrip}>{saveError}</div>}
            {savedMsg && (
              <p style={{ margin: "10px 0 0", color: "var(--teal-dark)", fontWeight: 500, fontSize: 13 }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
                {savedMsg}
              </p>
            )}
          </div>
        </>
      ) : (
        <div
          className="prose"
          style={{ marginBottom: 18 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {/* ---------- version history ---------- */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
            Version history
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>Compare</span>
            <select
              style={{ width: "auto" }}
              value={compareFrom}
              onChange={(e) => setCompareFrom(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">from…</option>
              {versions.map((v) => (
                <option key={v.id} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>
            <span style={{ color: "var(--text-muted)" }}>&rarr;</span>
            <select
              style={{ width: "auto" }}
              value={compareTo}
              onChange={(e) => setCompareTo(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">to…</option>
              {versions.map((v) => (
                <option key={v.id} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>
            <button
              className="btn btn-sm"
              disabled={compareFrom === "" || compareTo === "" || compareFrom === compareTo}
              title={
                compareFrom === "" || compareTo === ""
                  ? "Pick two versions to compare"
                  : compareFrom === compareTo
                    ? "Pick two different versions"
                    : "Compare the selected versions"
              }
              onClick={runCompare}
            >
              <i className="fa-solid fa-code-compare" /> Compare
            </button>
            {(diffHtml !== null || viewVersion !== null) && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setDiffHtml(null);
                  setViewVersion(null);
                  setViewRender(null);
                }}
              >
                <i className="fa-solid fa-xmark" /> Close preview
              </button>
            )}
          </div>
        </div>

        {panelError && <div style={{ ...errStrip, marginTop: 0, marginBottom: 12 }}>{panelError}</div>}

        {diffHtml !== null && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 500, fontSize: 13 }}>
              Changes v{compareFrom} &rarr; v{compareTo}
            </p>
            <div className="prose" dangerouslySetInnerHTML={{ __html: diffHtml }} />
          </div>
        )}

        {viewVersion !== null && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 500, fontSize: 13 }}>
              Version {viewVersion.version} (read-only)
              {viewVersion.note ? ` — ${viewVersion.note}` : ""}
            </p>
            {viewRender !== null ? (
              <TemplatePreview
                format={viewRender.format}
                payload={viewRender.payload}
                title={`${artifact.title}-v${viewVersion.version}`}
              />
            ) : (
              <div className="prose" dangerouslySetInnerHTML={{ __html: viewVersion.content_html }} />
            )}
          </div>
        )}

        {versions.map((v) => (
          <div
            key={v.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: "10px 14px",
              marginBottom: 8,
            }}
          >
            <div className="row-between">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <b style={{ fontSize: 13, color: "var(--teal-dark)" }}>v{v.version}</b>
                {v.version === artifact.current_version && <span className="pill pill-live">Current</span>}
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{v.note ?? "—"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {new Date(v.created_at).toLocaleString()}
                </span>
                <button className="btn btn-sm" onClick={() => openVersion(v.version)}>
                  <i className="fa-solid fa-eye" /> View
                </button>
                {canEdit && v.version !== artifact.current_version && (
                  <button className="btn btn-sm" onClick={() => rollback(v.version)}>
                    <i className="fa-solid fa-rotate-left" /> Rollback
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Comments entityType="artifact" entityId={artifact.id} />
    </div>
  );
}
