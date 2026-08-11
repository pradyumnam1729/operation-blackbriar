import { useState } from "react";
import {
  apiGet,
  apiPost,
  ArtifactRender,
  ArtifactVersionMeta,
  DeckDoc,
  getArtifactRender,
} from "../lib/api";
import { TemplatePreview } from "./TemplatePreview";
import { SlideCanvas } from "./deck/SlideCanvas";
import { SlideThumbRail } from "./deck/SlideThumbRail";

// Version history (blueprint §5.2) — extracted from the ArtifactEditor inline
// block with identical view/compare/rollback logic. Viewing an old deck version
// renders a read-only slide canvas from that version's slides when present,
// else its content_html prose.

interface ViewedVersion {
  version: number;
  content_html: string;
  note: string | null;
  /** Present when the backend returns the version's slides_json. */
  slides?: DeckDoc | null;
}

interface VersionHistoryPanelProps {
  artifactId: string;
  artifactTitle: string;
  currentVersion: number;
  versions: ArtifactVersionMeta[];
  canEdit: boolean;
  /** Template-generated artifact: old versions also fetch their rendered payload. */
  isRenderArtifact: boolean;
  productName: string | null;
  /** Reload the editor after a rollback. */
  onChanged: () => Promise<void> | void;
}

/** Read-only mini deck viewer for an old version: rail + canvas, nothing else. */
function DeckVersionViewer({ deck, productName }: { deck: DeckDoc; productName: string | null }) {
  const [active, setActive] = useState(0);
  const slide = deck.slides[Math.min(active, deck.slides.length - 1)];
  return (
    <div
      className="deck-workspace"
      style={{ gridTemplateColumns: "168px minmax(0, 1fr)", marginTop: 4 }}
    >
      <SlideThumbRail slides={deck.slides} active={active} onSelect={setActive} kicker={productName} />
      <SlideCanvas slide={slide} editable={false} kicker={productName} />
    </div>
  );
}

export function VersionHistoryPanel({
  artifactId,
  artifactTitle,
  currentVersion,
  versions,
  canEdit,
  isRenderArtifact,
  productName,
  onChanged,
}: VersionHistoryPanelProps) {
  const [viewVersion, setViewVersion] = useState<ViewedVersion | null>(null);
  const [viewRender, setViewRender] = useState<ArtifactRender | null>(null);
  const [compareFrom, setCompareFrom] = useState<number | "">("");
  const [compareTo, setCompareTo] = useState<number | "">("");
  const [diffHtml, setDiffHtml] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  const openVersion = async (v: number) => {
    setPanelError(null);
    setDiffHtml(null);
    setViewRender(null);
    try {
      const r = await apiGet<{ version: ViewedVersion }>(
        `/api/artifacts/${artifactId}/versions/${v}`
      );
      setViewVersion(r.version);
      if (isRenderArtifact) {
        // Template-generated: also show that version's rendered payload.
        try {
          setViewRender(await getArtifactRender(artifactId, v));
        } catch {
          setViewRender(null);
        }
      }
    } catch (e) {
      setPanelError((e as Error).message);
    }
  };

  const runCompare = async () => {
    if (compareFrom === "" || compareTo === "") return;
    setPanelError(null);
    setViewVersion(null);
    setViewRender(null);
    try {
      const r = await apiGet<{ diffHtml: string }>(
        `/api/artifacts/${artifactId}/diff?from=${compareFrom}&to=${compareTo}`
      );
      setDiffHtml(r.diffHtml);
    } catch (e) {
      setPanelError((e as Error).message);
    }
  };

  const rollback = async (v: number) => {
    if (!window.confirm(`Roll back to version ${v}? Its content is copied forward as a new version — nothing is deleted.`)) return;
    setPanelError(null);
    try {
      await apiPost(`/api/artifacts/${artifactId}/rollback`, { to: v });
      setViewVersion(null);
      setDiffHtml(null);
      setViewRender(null);
      await onChanged();
    } catch (e) {
      setPanelError((e as Error).message);
    }
  };

  return (
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
            onClick={() => void runCompare()}
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

      {panelError !== null && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            background: "#FCE8E8",
            borderRadius: "var(--r-md)",
            color: "#A32D2D",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {panelError}
        </div>
      )}

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
              title={`${artifactTitle}-v${viewVersion.version}`}
            />
          ) : viewVersion.slides !== undefined && viewVersion.slides !== null ? (
            <DeckVersionViewer deck={viewVersion.slides} productName={productName} />
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
              {v.version === currentVersion && <span className="pill pill-live">Current</span>}
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{v.note ?? "—"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {new Date(v.created_at).toLocaleString()}
              </span>
              <button className="btn btn-sm" onClick={() => void openVersion(v.version)}>
                <i className="fa-solid fa-eye" /> View
              </button>
              {canEdit && v.version !== currentVersion && (
                <button className="btn btn-sm" onClick={() => void rollback(v.version)}>
                  <i className="fa-solid fa-rotate-left" /> Rollback
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
