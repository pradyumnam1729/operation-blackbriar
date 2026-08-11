import { DECK_CAPS } from "../../lib/api";

// Collapsible speaker-notes strip under the canvas (blueprint §5.2). Notes ship
// inside the exported .pptx, so they are customer-facing and guard-scanned —
// the hint keeps that honest.

interface SpeakerNotesProps {
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}

export function SpeakerNotes({ value, editable, onChange }: SpeakerNotesProps) {
  const nearCap = value.length >= Math.floor(DECK_CAPS.notes * 0.8);
  return (
    <div className="card" style={{ marginTop: 16, marginBottom: 0, padding: "14px 18px" }}>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
          <i
            className="fa-regular fa-comment-dots"
            style={{ marginRight: 8, color: "var(--teal-dark)" }}
          />
          Speaker notes
        </h3>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          Internal while editing — ships inside the exported .pptx file
        </span>
      </div>
      <textarea
        value={value}
        readOnly={!editable}
        onChange={(e) => onChange(e.target.value)}
        placeholder={editable ? "What the presenter says on this slide…" : ""}
        aria-label="Speaker notes"
        style={{ minHeight: 84 }}
      />
      {nearCap && (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12,
            fontWeight: 500,
            color: value.length > DECK_CAPS.notes ? "var(--red)" : "var(--text-secondary)",
            textAlign: "right",
          }}
        >
          {value.length}/{DECK_CAPS.notes}
        </p>
      )}
    </div>
  );
}
