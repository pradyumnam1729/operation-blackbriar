import { useState } from "react";
import { FeatureRecord, FeatureStatus } from "../../lib/api";

// Card view for the Feature Catalog. Leads with buyer value (value_prop as the
// hero line) per PMM presentation guidance; capabilities stay behind a Details
// toggle so cards keep a uniform height across a row.

const STATUS_PILL: Record<FeatureStatus, { cls: string; label: string }> = {
  active: { cls: "pill-live", label: "Live" },
  changed: { cls: "pill-changed", label: "Changed" },
  deprecated: { cls: "pill-deprecated", label: "Deprecated" },
};

/** Comma-separated persona string → trimmed, de-duped list. */
export function splitPersonas(persona: string | null): string[] {
  if (!persona) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of persona.split(",")) {
    const p = raw.trim();
    if (p && !seen.has(p.toLowerCase())) {
      seen.add(p.toLowerCase());
      out.push(p);
    }
  }
  return out;
}

/** capabilities is a newline-joined bullet list → individual <li> strings. */
export function splitCapabilities(capabilities: string | null): string[] {
  if (!capabilities) return [];
  return capabilities
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l.length > 0);
}

function isImported(f: FeatureRecord): boolean {
  return f.origin === "xlsx_import";
}

/** Seeded rows carry placeholder example.com URLs — dead destinations, not sources. */
function hasRealSource(url: string | null): url is string {
  return !!url && !url.toLowerCase().includes("example.com");
}

interface CardProps {
  feature: FeatureRecord;
  isAdmin: boolean;
  busy: boolean;
  onDelete: (id: string, name: string) => void;
  onGoToNote: (releaseNoteId: string | null) => void;
}

function FeatureCardItem({ feature: f, isAdmin, busy, onDelete, onGoToNote }: CardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const personas = splitPersonas(f.persona);
  const caps = splitCapabilities(f.capabilities);
  const status = STATUS_PILL[f.status];

  return (
    <div
      className="feature-card"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <div className="top" style={{ alignItems: "flex-start" }}>
        <h4 style={{ fontSize: 14.5 }}>{f.name}</h4>
        <span style={{ display: "inline-flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isImported(f) && (
            <span
              className="pill pill-changed"
              title="Imported from spreadsheet — not yet PMM-validated"
            >
              <i className="fa-solid fa-file-import" style={{ fontSize: 9 }} /> Imported
            </span>
          )}
          <span className={`pill ${status.cls}`}>{status.label}</span>
        </span>
      </div>

      {f.value_prop && (
        <p
          style={{
            margin: "8px 0 4px",
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.4,
            color: "var(--text-primary)",
          }}
        >
          {f.value_prop}
        </p>
      )}

      {f.description && (
        <p style={{ margin: "4px 0 12px" }}>{f.description}</p>
      )}

      {(personas.length > 0 || f.sub_product_name) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {f.sub_product_name && <span className="pill pill-live">{f.sub_product_name}</span>}
          {personas.map((p) => (
            <span key={p} className="pill pill-archived">
              <i className="fa-solid fa-user" style={{ fontSize: 9 }} /> {p}
            </span>
          ))}
        </div>
      )}

      {caps.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button
            className="btn btn-sm"
            style={{ padding: "4px 10px" }}
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
          >
            <i className={`fa-solid fa-chevron-${showDetails ? "up" : "down"}`} style={{ fontSize: 10 }} />{" "}
            {showDetails ? "Hide details" : `Details (${caps.length})`}
          </button>
          {showDetails && (
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {caps.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        className="meta"
        style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--border)" }}
      >
        <span>{f.category ?? "Uncategorized"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {hasRealSource(f.source_url) ? (
            <a href={f.source_url} target="_blank" rel="noopener noreferrer">
              <i className="fa-solid fa-arrow-up-right-from-square" /> Source
            </a>
          ) : f.release_note_id ? (
            <a
              role="button"
              tabIndex={0}
              title="Jump to the release note below"
              style={{ cursor: "pointer" }}
              onClick={() => onGoToNote(f.release_note_id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onGoToNote(f.release_note_id);
              }}
            >
              <i className="fa-solid fa-file-lines" /> Release note
            </a>
          ) : null}
          {isAdmin && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onDelete(f.id, f.name)}
              disabled={busy}
            >
              Delete
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

interface FeatureCardsProps {
  features: FeatureRecord[];
  isAdmin: boolean;
  busy: boolean;
  onDelete: (id: string, name: string) => void;
  onGoToNote: (releaseNoteId: string | null) => void;
}

export function FeatureCards({ features, isAdmin, busy, onDelete, onGoToNote }: FeatureCardsProps) {
  return (
    <div className="grid grid-3" style={{ marginBottom: 18, alignItems: "stretch" }}>
      {features.map((f) => (
        <FeatureCardItem
          key={f.id}
          feature={f}
          isAdmin={isAdmin}
          busy={busy}
          onDelete={onDelete}
          onGoToNote={onGoToNote}
        />
      ))}
    </div>
  );
}
