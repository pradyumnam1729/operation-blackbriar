import { useState } from "react";
import { ApiError, RenderWarning, saveArtifactSlots, TemplateSlot } from "../lib/api";

// Per-slot editor for template-generated artifacts (blueprint §4.3).
// Saving triggers a deterministic re-render on the backend — no model call —
// so limits are enforced server-side too; the 400 body's per-slot detail is
// surfaced next to the offending slot. Over-limit is never silently trimmed:
// trimming copy is the human's decision, made here.

interface OverDetail {
  slot_id: string;
  chars: number;
  max: number;
}

interface Props {
  artifactId: string;
  slots: TemplateSlot[];
  fills: Record<string, string>;
  warnings: RenderWarning[];
  onSaved: () => void | Promise<void>;
}

const WARNING_LABELS: Record<RenderWarning["kind"], string> = {
  over_limit: "Over limit at generation",
  missing: "Needs PMM input",
  empty_section: "Source section empty",
};

const errStrip: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  background: "#FCE8E8",
  borderRadius: "var(--r-md)",
  color: "#A32D2D",
  fontSize: 13,
  fontWeight: 500,
};

export function SlotFillPanel({ artifactId, slots, fills, warnings, onSaved }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of slots) init[s.id] = fills[s.id] ?? "";
    return init;
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overBySlot, setOverBySlot] = useState<Record<string, OverDetail>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const warningsFor = (slotId: string) => warnings.filter((w) => w.slot_id === slotId);

  const lineCount = (text: string) =>
    text.split("\n").filter((l) => l.trim() !== "").length;

  const save = async () => {
    setSaving(true);
    setError(null);
    setOverBySlot({});
    setSavedMsg(null);
    try {
      const r = await saveArtifactSlots(artifactId, draft, note.trim() || undefined);
      setNote("");
      setSavedMsg(`Re-rendered as version ${r.version}`);
      await onSaved();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body.over)) {
        const map: Record<string, OverDetail> = {};
        for (const o of e.body.over as OverDetail[]) map[o.slot_id] = o;
        setOverBySlot(map);
      }
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500 }}>
        <i className="fa-solid fa-pen-ruler" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
        Slot text
      </h3>
      <p className="empty-note" style={{ padding: "0 0 12px" }}>
        The layout is locked by the template — you edit only the text in each slot. Saving
        re-renders the artifact as a new version.
      </p>

      {slots.map((slot) => {
        const value = draft[slot.id] ?? "";
        const over = value.length > slot.max_chars;
        const linesOver =
          slot.render === "lines" &&
          slot.max_lines !== undefined &&
          lineCount(value) > slot.max_lines;
        const serverOver = overBySlot[slot.id];
        const slotWarnings = warningsFor(slot.id);
        return (
          <div key={slot.id} style={{ marginBottom: 14 }}>
            <div className="row-between" style={{ alignItems: "baseline" }}>
              <label htmlFor={`slot-${slot.id}`} title={slot.purpose} style={{ cursor: "help" }}>
                {slot.label}
                {slot.required && (
                  <span style={{ color: "var(--red)", marginLeft: 3 }} aria-hidden="true">
                    *
                  </span>
                )}
              </label>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: over ? "var(--red)" : "var(--text-muted)",
                }}
              >
                {value.length}/{slot.max_chars}
                {slot.render === "lines" && slot.max_lines !== undefined && (
                  <span style={{ marginLeft: 8, color: linesOver ? "var(--red)" : undefined }}>
                    {lineCount(value)}/{slot.max_lines} lines
                  </span>
                )}
              </span>
            </div>
            {slotWarnings.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "2px 0 6px" }}>
                {slotWarnings.map((w, i) => (
                  <span key={i} className="pill pill-lock" title={w.detail}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 5 }} />
                    {WARNING_LABELS[w.kind]}
                  </span>
                ))}
              </div>
            )}
            <textarea
              id={`slot-${slot.id}`}
              value={value}
              onChange={(e) => {
                setDraft((d) => ({ ...d, [slot.id]: e.target.value }));
                setSavedMsg(null);
              }}
              rows={slot.render === "text" ? 2 : slot.render === "lines" ? (slot.max_lines ?? 4) : 4}
              style={over || serverOver ? { borderColor: "var(--red)" } : undefined}
              aria-invalid={over || !!serverOver}
            />
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
              {slot.purpose} &middot; sources {slot.source_sections.join(", ")}
              {slot.render === "lines" ? " · one item per line" : ""}
            </div>
            {serverOver && (
              <div style={{ fontSize: 12, color: "#A32D2D", fontWeight: 500, marginTop: 2 }}>
                Rejected: {serverOver.chars} characters against a hard limit of {serverOver.max}.
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Version note (optional), e.g. “tightened the headline”"
        />
        <button
          className="btn btn-primary"
          style={{ whiteSpace: "nowrap" }}
          disabled={saving}
          onClick={save}
        >
          <i className="fa-solid fa-rotate" />
          {saving ? "Re-rendering…" : "Save & re-render"}
        </button>
      </div>
      {error && <div style={errStrip}>{error}</div>}
      {savedMsg && (
        <p style={{ margin: "10px 0 0", color: "var(--teal-dark)", fontWeight: 500, fontSize: 13 }}>
          <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
          {savedMsg}
        </p>
      )}
    </div>
  );
}
