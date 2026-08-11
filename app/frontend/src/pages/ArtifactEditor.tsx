import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  apiDelete,
  apiPost,
  ArtifactDetail,
  ArtifactRender,
  ArtifactStatus,
  ArtifactVersionMeta,
  convertToSlides,
  DeckDoc,
  getArtifactDetail,
  getArtifactRender,
  getTemplate,
  TemplateDetail,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { ChatEditPanel } from "../components/ChatEditPanel";
import { Comments } from "../components/Comments";
import { TemplatePreview } from "../components/TemplatePreview";
import { SlotFillPanel } from "../components/SlotFillPanel";
import { DeckWorkspace } from "../components/deck/DeckWorkspace";
import { DocEditor } from "../components/DocEditor";
import { VersionHistoryPanel } from "../components/VersionHistoryPanel";

// Artifact editor shell + dispatcher (blueprint deck-studio.md §5.1). Keeps the
// header, admin status transitions (422 finalize violations), delete, version
// history, and Comments; the content surface dispatches by precedence:
//   1. structured slides       → DeckWorkspace (read-only viewer for non-editors)
//   2. template render         → SlotFillPanel + TemplatePreview (byte-identical)
//   3. legacy HTML-only deck   → DocEditor + "Convert to slides" banner
//   4. everything else         → DocEditor (canEdit) or read-only prose

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
  const [versions, setVersions] = useState<ArtifactVersionMeta[]>([]);
  const [html, setHtml] = useState("");
  const [slides, setSlides] = useState<DeckDoc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Template-generated artifacts: raw render + the template's slot definitions.
  const [render, setRender] = useState<ArtifactRender | null>(null);
  const [renderTpl, setRenderTpl] = useState<TemplateDetail | null>(null);

  // status
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  // legacy deck → structured slides conversion (§4.6)
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Render-backed artifacts (slot-fill datasheets etc.) use the deck-style
  // workspace: page rail | styled editable render | AI chat, toolbar on top.
  // The manual slot form toggles open below the workspace.
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [inlineNote, setInlineNote] = useState("");

  // History + comments are compact, collapsed-by-default panels (they were
  // crowding the working surface).
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Inline slot editing on the styled render: edits collect here until saved
  // through the slot pipeline (POST /slots → deterministic re-render).
  const [pendingFills, setPendingFills] = useState<Record<string, string>>({});
  const [editableRegions, setEditableRegions] = useState<number | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const saveInlineEdits = async () => {
    if (!id || Object.keys(pendingFills).length === 0) return;
    setInlineSaving(true);
    setInlineError(null);
    try {
      await apiPost(`/api/artifacts/${id}/slots`, {
        fills: pendingFills,
        note: inlineNote.trim() || "Inline edits on the rendered view",
      });
      setPendingFills({});
      setInlineNote("");
      await load();
    } catch (e) {
      setInlineError((e as Error).message);
    } finally {
      setInlineSaving(false);
    }
  };

  // Legacy renders predate the data-slot markers — one no-op re-render adds them.
  const refreshRender = async () => {
    if (!id) return;
    setInlineSaving(true);
    setInlineError(null);
    try {
      await apiPost(`/api/artifacts/${id}/slots`, { fills: {} });
      await load();
    } catch (e) {
      setInlineError((e as Error).message);
    } finally {
      setInlineSaving(false);
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getArtifactDetail(id);
      setArtifact(data.artifact);
      setVersions(data.versions);
      setHtml(data.contentHtml);
      setSlides(data.slides ?? null);
      setLoadError(null);
      if (data.hasRender) {
        // Template-generated: mount the render surface instead of the editor.
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

  // ---------- legacy deck conversion ----------
  const runConvert = async () => {
    if (!id) return;
    setConverting(true);
    setConvertError(null);
    try {
      await convertToSlides(id);
      await load(); // slides now present → the canvas mounts
    } catch (e) {
      // 422/502 — content unchanged, the banner stays (§4.6).
      setConvertError((e as Error).message);
    } finally {
      setConverting(false);
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

  const legacyDeck = slides === null && render === null && artifact.asset_type === "deck";

  // Page-thumbnail geometry for the render workspace rail (mirrors the deck
  // thumb rail): a scaled, inert iframe of the payload.
  const thumbBase = render?.format === "svg" ? { w: 1200, h: 628 } : { w: 816, h: 1056 };
  const thumbScale = 148 / thumbBase.w;
  const thumbDoc =
    render === null
      ? ""
      : render.format === "svg"
        ? `<!doctype html><html><head><style>html,body{margin:0;padding:0}svg{display:block;width:100%;height:auto}</style></head><body>${render.payload}</body></html>`
        : render.payload;
  const pendingCount = Object.keys(pendingFills).length;

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

      {slides !== null ? (
        /* 1. Structured slides → the deck workspace (read-only for non-editors). */
        <DeckWorkspace
          artifactId={artifact.id}
          title={artifact.title}
          productName={artifact.product_name}
          currentVersion={artifact.current_version}
          canEdit={canEdit}
          slides={slides}
          onRefresh={load}
        />
      ) : render !== null ? (
        /* 2. Template-generated: the deck-style workspace — page rail | styled
           editable render | AI chat, toolbar on top, slot form toggled below. */
        <>
          {artifact.status === "final" && (
            <div
              style={{
                marginBottom: 14,
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

          {/* toolbar — mirrors the deck toolbar */}
          <div className="card" style={{ padding: "12px 18px" }}>
            <div className="row-between" style={{ flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="pill pill-review">
                  Template{render.template_version !== null ? ` v${render.template_version}` : ""}
                </span>
                {canEdit && renderTpl && (
                  <button
                    className={slotsOpen ? "btn btn-sm btn-primary" : "btn btn-sm"}
                    onClick={() => setSlotsOpen((o) => !o)}
                  >
                    <i className="fa-solid fa-table-cells-large" /> Slots
                  </button>
                )}
                {render.warnings.length > 0 && (
                  <span
                    className="pill pill-pending"
                    title={render.warnings.map((w) => `${w.slot_id}: ${w.detail}`).join("\n")}
                  >
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 10 }} />{" "}
                    {render.warnings.length} slot{render.warnings.length === 1 ? "" : "s"} need input
                  </span>
                )}
                {canEdit && editableRegions === 0 && (
                  <button className="btn btn-sm" disabled={inlineSaving} onClick={() => void refreshRender()}>
                    <i className={`fa-solid ${inlineSaving ? "fa-spinner fa-spin" : "fa-rotate"}`} />{" "}
                    Enable inline editing
                  </button>
                )}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {pendingCount > 0 && (
                    <>
                      <span
                        title="Unsaved inline edits"
                        style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--red)", flexShrink: 0 }}
                      />
                      <button
                        className="btn btn-sm"
                        disabled={inlineSaving}
                        onClick={() => {
                          setPendingFills({});
                          void load();
                        }}
                      >
                        Discard
                      </button>
                    </>
                  )}
                  <input
                    value={inlineNote}
                    onChange={(e) => setInlineNote(e.target.value)}
                    placeholder="Version note (optional)"
                    style={{ width: 220 }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ whiteSpace: "nowrap" }}
                    disabled={inlineSaving || pendingCount === 0}
                    title={
                      pendingCount === 0
                        ? "Click any highlighted text on the render to edit it, then save"
                        : `Save ${pendingCount} inline edit${pendingCount === 1 ? "" : "s"}`
                    }
                    onClick={() => void saveInlineEdits()}
                  >
                    <i className={`fa-solid ${inlineSaving ? "fa-spinner fa-spin" : "fa-floppy-disk"}`} />{" "}
                    Save version {artifact.current_version + 1}
                  </button>
                </div>
              )}
            </div>
          </div>

          {inlineError && <div style={{ ...errStrip, marginTop: 0, marginBottom: 14 }}>{inlineError}</div>}

          <div
            className="deck-workspace"
            style={{
              gridTemplateColumns: canEdit ? "168px minmax(0, 1fr) 340px" : "168px minmax(0, 1fr)",
              marginBottom: 18,
            }}
          >
            {/* page rail — mirrors the slide thumb rail */}
            <div className="deck-rail">
              <div
                style={{
                  position: "relative",
                  width: 152,
                  height: Math.round(thumbBase.h * thumbScale) + 4,
                  border: "2px solid var(--teal-dark)",
                  background: "#fff",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <iframe
                  sandbox=""
                  srcDoc={thumbDoc}
                  title="Page thumbnail"
                  style={{
                    width: thumbBase.w,
                    height: thumbBase.h,
                    transform: `scale(${thumbScale})`,
                    transformOrigin: "top left",
                    border: 0,
                    pointerEvents: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 6,
                    bottom: 6,
                    background: "var(--teal-dark)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                  }}
                >
                  1
                </span>
              </div>
            </div>

            {/* styled render — inline-editable */}
            <div>
              {canEdit && editableRegions !== null && editableRegions > 0 && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
                  <i className="fa-solid fa-i-cursor" style={{ marginRight: 6 }} />
                  Click any highlighted text to edit it directly on the render.
                </p>
              )}
              <TemplatePreview
                format={render.format}
                payload={render.payload}
                title={artifact.title}
                editable={canEdit}
                onSlotEdit={(slotId, text) => setPendingFills((f) => ({ ...f, [slotId]: text }))}
                onEditableRegions={setEditableRegions}
              />
            </div>

            {canEdit && (
              <ChatEditPanel
                artifactId={artifact.id}
                mode="document"
                dirty={pendingCount > 0}
                onApplied={() => {
                  setPendingFills({});
                  void load();
                }}
              />
            )}
          </div>

          {slotsOpen && canEdit && renderTpl && (
            <div className="grid grid-2">
              <SlotFillPanel
                key={artifact.current_version}
                artifactId={artifact.id}
                slots={renderTpl.slots}
                fills={render.slot_fills}
                warnings={render.warnings}
                onSaved={load}
              />
              {render.warnings.length > 0 ? (
                <div className="card">
                  <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 500 }}>Slots needing PMM input</h3>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {render.warnings.map((w, i) => (
                      <li key={i}>
                        <b>{w.slot_id}</b>: {w.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div />
              )}
            </div>
          )}
        </>
      ) : canEdit ? (
        /* 3 + 4. Document editor v2; legacy decks get the convert banner first. */
        <>
          {legacyDeck && (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 16px",
                background: "#E1F0F2",
                borderRadius: "var(--r-md)",
                color: "var(--teal-dark)",
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: 1 }}>
                <i className="fa-regular fa-file-powerpoint" style={{ marginRight: 8 }} />
                This deck predates structured slides. Convert it to edit slide-by-slide and export
                a branded .pptx.
              </span>
              <button className="btn btn-sm" disabled={converting} onClick={() => void runConvert()}>
                {converting ? (
                  <i className="fa-solid fa-spinner fa-spin" />
                ) : (
                  <i className="fa-solid fa-table-columns" />
                )}
                {converting ? "Converting…" : "Convert to slides"}
              </button>
            </div>
          )}
          {convertError !== null && (
            <div style={{ ...errStrip, marginTop: 0, marginBottom: 18 }} role="alert">
              {convertError} — your content is unchanged.
            </div>
          )}
          <DocEditor
            artifactId={artifact.id}
            contentHtml={html}
            currentVersion={artifact.current_version}
            onRefresh={load}
          />
        </>
      ) : (
        <div
          className="prose"
          style={{ marginBottom: 18 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {/* Compact, collapsed-by-default footer — history and comments are
          reference material, not the working surface. */}
      <div style={{ display: "flex", gap: 10, marginTop: 4, marginBottom: 10, flexWrap: "wrap" }}>
        <button
          className="btn btn-sm"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((o) => !o)}
        >
          <i className={`fa-solid ${showHistory ? "fa-chevron-down" : "fa-clock-rotate-left"}`} />{" "}
          Version history ({versions.length})
        </button>
        <button
          className="btn btn-sm"
          aria-expanded={showComments}
          onClick={() => setShowComments((o) => !o)}
        >
          <i className={`fa-solid ${showComments ? "fa-chevron-down" : "fa-comments"}`} /> Comments
        </button>
      </div>

      {showHistory && (
        <VersionHistoryPanel
          artifactId={artifact.id}
          artifactTitle={artifact.title}
          currentVersion={artifact.current_version}
          versions={versions}
          canEdit={canEdit}
          isRenderArtifact={render !== null}
          productName={artifact.product_name}
          onChanged={load}
        />
      )}

      {showComments && <Comments entityType="artifact" entityId={artifact.id} />}
    </div>
  );
}
