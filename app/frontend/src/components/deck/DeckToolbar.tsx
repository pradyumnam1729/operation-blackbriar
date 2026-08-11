import { useEffect, useRef, useState } from "react";
import { DECK_CAPS, SlideLayout } from "../../lib/api";

// Deck toolbar (blueprint §5.2): slide ops, layout switch, notes/chat toggles,
// Export .pptx, and the save controls (unsaved dot + note + "Save version N+1").
// Read-only mode shows only the position indicator and Export.

export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  title: "Title",
  agenda: "Agenda",
  section: "Section divider",
  "content-bullets": "Content bullets",
  "two-column": "Two column",
  quote: "Quote / proof",
  closing: "Closing",
};

const LAYOUT_ORDER: SlideLayout[] = [
  "title",
  "agenda",
  "section",
  "content-bullets",
  "two-column",
  "quote",
  "closing",
];

interface DeckToolbarProps {
  canEdit: boolean;
  slideCount: number;
  activeIndex: number;
  activeLayout: SlideLayout;
  dirty: boolean;
  saving: boolean;
  exporting: boolean;
  nextVersion: number;
  note: string;
  notesOpen: boolean;
  chatOpen: boolean;
  onNote: (v: string) => void;
  onAdd: (layout: SlideLayout) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onLayoutChange: (layout: SlideLayout) => void;
  onToggleNotes: () => void;
  onToggleChat: () => void;
  onSave: () => void;
  onExport: () => void;
}

export function DeckToolbar(props: DeckToolbarProps) {
  const {
    canEdit,
    slideCount,
    activeIndex,
    activeLayout,
    dirty,
    saving,
    exporting,
    nextVersion,
    note,
    notesOpen,
    chatOpen,
  } = props;

  // Add-slide layout picker popup.
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!addOpen) return;
    const close = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [addOpen]);

  const atCap = slideCount >= DECK_CAPS.slides;
  const lastSlide = slideCount <= 1;

  const position = (
    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
      Slide {activeIndex + 1} / {slideCount}
    </span>
  );

  const exportBtn = (
    <button
      className="btn btn-sm"
      disabled={exporting}
      title={
        dirty
          ? "Exports the last saved version — save your edits to include them"
          : "Download this deck as a branded .pptx"
      }
      onClick={props.onExport}
    >
      {exporting ? (
        <i className="fa-solid fa-spinner fa-spin" />
      ) : (
        <i className="fa-regular fa-file-powerpoint" />
      )}
      Export .pptx
    </button>
  );

  if (!canEdit) {
    return (
      <div className="card" style={{ padding: "12px 18px" }}>
        <div className="row-between">
          {position}
          {exportBtn}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "12px 18px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {position}

        <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />

        <div ref={addRef} style={{ position: "relative" }}>
          <button
            className="btn btn-sm"
            disabled={atCap}
            title={atCap ? `Decks cap at ${DECK_CAPS.slides} slides` : "Add a slide after this one"}
            onClick={() => setAddOpen((o) => !o)}
          >
            <i className="fa-solid fa-plus" /> Add slide
          </button>
          {addOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                zIndex: 30,
                background: "var(--bg-card)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-md)",
                boxShadow: "var(--shadow-2)",
                padding: 6,
                minWidth: 180,
              }}
            >
              {LAYOUT_ORDER.map((l) => (
                <button
                  key={l}
                  className="btn btn-sm"
                  style={{ display: "flex", width: "100%", border: "none", textAlign: "left" }}
                  onClick={() => {
                    setAddOpen(false);
                    props.onAdd(l);
                  }}
                >
                  {LAYOUT_LABELS[l]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="btn btn-sm"
          disabled={atCap}
          title={atCap ? `Decks cap at ${DECK_CAPS.slides} slides` : "Duplicate this slide"}
          onClick={props.onDuplicate}
        >
          <i className="fa-regular fa-clone" /> Duplicate
        </button>
        <button
          className="btn btn-sm"
          disabled={lastSlide}
          title={lastSlide ? "A deck needs at least one slide" : "Delete this slide"}
          onClick={props.onDelete}
        >
          <i className="fa-regular fa-trash-can" /> Delete
        </button>

        <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />

        <button
          className="btn btn-sm"
          disabled={activeIndex === 0}
          title="Move slide up"
          onClick={() => props.onMove(-1)}
        >
          <i className="fa-solid fa-arrow-up" />
        </button>
        <button
          className="btn btn-sm"
          disabled={activeIndex === slideCount - 1}
          title="Move slide down"
          onClick={() => props.onMove(1)}
        >
          <i className="fa-solid fa-arrow-down" />
        </button>

        <select
          style={{ width: "auto" }}
          value={activeLayout}
          title="Switch this slide's layout"
          aria-label="Slide layout"
          onChange={(e) => props.onLayoutChange(e.target.value as SlideLayout)}
        >
          {LAYOUT_ORDER.map((l) => (
            <option key={l} value={l}>
              {LAYOUT_LABELS[l]}
            </option>
          ))}
        </select>

        <button
          className={notesOpen ? "btn btn-sm btn-primary" : "btn btn-sm"}
          title={notesOpen ? "Hide speaker notes" : "Show speaker notes"}
          onClick={props.onToggleNotes}
        >
          <i className="fa-regular fa-comment-dots" /> Notes
        </button>
        <button
          className={chatOpen ? "btn btn-sm btn-primary" : "btn btn-sm"}
          title={chatOpen ? "Hide the AI panel" : "Show the AI panel"}
          onClick={props.onToggleChat}
        >
          <i className="fa-solid fa-wand-magic-sparkles" /> AI
        </button>

        {exportBtn}

        <span style={{ flex: 1 }} />

        {dirty && (
          <span
            title="Unsaved manual edits"
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--red)",
              flexShrink: 0,
            }}
          />
        )}
        <input
          value={note}
          onChange={(e) => props.onNote(e.target.value)}
          placeholder="Version note (optional)"
          style={{ width: 220 }}
        />
        <button
          className="btn btn-primary btn-sm"
          style={{ whiteSpace: "nowrap" }}
          disabled={saving || !dirty}
          title={dirty ? "Save your edits as a new version" : "No unsaved edits"}
          onClick={props.onSave}
        >
          <i className="fa-solid fa-floppy-disk" />
          {saving ? "Saving…" : `Save version ${nextVersion}`}
        </button>
      </div>
    </div>
  );
}
