import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  DeckDoc,
  DeckSlide,
  GuardCheck,
  SlideLayout,
  downloadArtifactPptx,
  saveArtifactVersion,
} from "../../lib/api";
import { ChatEditPanel } from "../ChatEditPanel";
import { DeckToolbar } from "./DeckToolbar";
import { SlideCanvas } from "./SlideCanvas";
import { SlideThumbRail } from "./SlideThumbRail";
import { SpeakerNotes } from "./SpeakerNotes";

// Deck workspace (blueprint §5.1-1, §5.2): left thumbnail rail, center 16:9
// editable canvas, right collapsible AI chat panel. Manual edits mutate local
// DeckDoc state (dirty flag + beforeunload warning); "Save version N+1" posts
// {slides, note}; chat edits save server-side and replace local state.
// Read-only mode (non-canEdit): rail + canvas + Export only.

interface DeckWorkspaceProps {
  artifactId: string;
  title: string;
  productName: string | null;
  currentVersion: number;
  canEdit: boolean;
  slides: DeckDoc;
  /** Reload artifact meta + version list after a save/chat edit (no full page reload). */
  onRefresh: () => Promise<void> | void;
}

function newSlideId(deck: DeckDoc): string {
  let max = 0;
  for (const s of deck.slides) {
    const m = /^s(\d+)$/.exec(s.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max > 0 ? `s${max + 1}` : `s${deck.slides.length + 1}-${Date.now()}`;
}

function blankSlide(id: string, layout: SlideLayout): DeckSlide {
  const slide: DeckSlide = { id, layout, title: "" };
  if (layout === "agenda" || layout === "content-bullets") slide.body = [];
  if (layout === "two-column")
    slide.columns = [
      { heading: "", items: [] },
      { heading: "", items: [] },
    ];
  if (layout === "quote") slide.quote = { text: "", attribution: "" };
  return slide;
}

/** All customer-facing text on a slide, lowercased — for guard-hit mapping. */
function slideText(s: DeckSlide): string {
  return [
    s.title,
    s.subtitle,
    ...(s.body ?? []),
    ...(s.columns?.flatMap((c) => [c.heading, ...c.items]) ?? []),
    s.quote?.text,
    s.quote?.attribution,
    s.notes,
  ]
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .toLowerCase();
}

// Red-tinted error strip (mirrors the editor shell's).
const errStrip: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  background: "#FCE8E8",
  borderRadius: "var(--r-md)",
  color: "#A32D2D",
  fontSize: 13,
  fontWeight: 500,
};

export function DeckWorkspace({
  artifactId,
  title,
  productName,
  currentVersion,
  canEdit,
  slides,
  onRefresh,
}: DeckWorkspaceProps) {
  const [deck, setDeck] = useState<DeckDoc>(slides);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveIssues, setSaveIssues] = useState<string[]>([]);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [guard, setGuard] = useState<GuardCheck | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // External updates (rollback, reload) flow in only when there are no unsaved
  // manual edits — dirty local state is never silently clobbered.
  const propJson = JSON.stringify(slides);
  useEffect(() => {
    if (dirty) return;
    if (JSON.stringify(deck) === propJson) return;
    const next = JSON.parse(propJson) as DeckDoc;
    setDeck(next);
    setActive((a) => Math.min(a, next.slides.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propJson, dirty]);

  // Dirty flag → warn before the tab closes (§5.2 save model).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const activeSlide = deck.slides[Math.min(active, deck.slides.length - 1)];

  // ---- local mutations (manual editing) ----
  // All ops originate from discrete user events, so they compute from the
  // current render's deck (keeps setActive out of state updaters).
  const apply = (next: DeckDoc) => {
    setDeck(next);
    setDirty(true);
    setSavedMsg(null);
  };

  /**
   * Layout switches must convert fields, not just relabel — the server
   * hard-rejects layout-incoherent slides (qa finding B2). Carries content
   * across where it maps (body ↔ columns ↔ quote), seeds required fields,
   * and drops what the target layout forbids.
   */
  const convertLayout = (s: DeckSlide, layout: SlideLayout): DeckSlide => {
    if (layout === s.layout) return s;
    const next: DeckSlide = { id: s.id, layout, title: s.title };
    if (s.notes) next.notes = s.notes;
    const flatBody =
      s.body ??
      (s.columns ? s.columns.flatMap((c) => c.items) : undefined) ??
      (s.quote ? [s.quote.text] : undefined);
    if (layout === "agenda" || layout === "content-bullets") {
      next.body = flatBody && flatBody.length > 0 ? flatBody : ["Draft this slide in the editor."];
    } else if (layout === "two-column") {
      if (s.columns) {
        next.columns = s.columns;
      } else {
        const items = flatBody ?? [];
        const mid = Math.ceil(items.length / 2);
        next.columns = [
          { heading: "Column one", items: items.slice(0, mid).length > 0 ? items.slice(0, mid) : ["Draft this column."] },
          { heading: "Column two", items: items.slice(mid).length > 0 ? items.slice(mid) : ["Draft this column."] },
        ];
      }
    } else if (layout === "quote") {
      next.quote = s.quote ?? { text: flatBody?.[0] ?? s.title, attribution: "" };
    } else {
      // title | section | closing — subtitle carries over or absorbs the first body line.
      const subtitle = s.subtitle ?? flatBody?.[0];
      if (subtitle) next.subtitle = subtitle;
    }
    return next;
  };

  const patchActive = (patch: Partial<DeckSlide>) =>
    apply({
      ...deck,
      slides: deck.slides.map((s, i) => (i === active ? { ...s, ...patch } : s)),
    });

  const addSlide = (layout: SlideLayout) => {
    const slide = blankSlide(newSlideId(deck), layout);
    const at = active + 1;
    apply({ ...deck, slides: [...deck.slides.slice(0, at), slide, ...deck.slides.slice(at)] });
    setActive(at);
  };

  const duplicateSlide = () => {
    const copy = JSON.parse(JSON.stringify(deck.slides[active])) as DeckSlide;
    copy.id = newSlideId(deck);
    const at = active + 1;
    apply({ ...deck, slides: [...deck.slides.slice(0, at), copy, ...deck.slides.slice(at)] });
    setActive(at);
  };

  const deleteSlide = () => {
    if (deck.slides.length <= 1) return; // toolbar blocks this; belt and braces
    const next = deck.slides.filter((_, i) => i !== active);
    apply({ ...deck, slides: next });
    setActive(Math.min(active, next.length - 1));
  };

  const moveSlide = (dir: -1 | 1) => {
    const to = active + dir;
    if (to < 0 || to >= deck.slides.length) return;
    const next = [...deck.slides];
    const [s] = next.splice(active, 1);
    next.splice(to, 0, s);
    apply({ ...deck, slides: next });
    setActive(to);
  };

  // ---- save version N+1 ----
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveIssues([]);
    setSavedMsg(null);
    try {
      const r = await saveArtifactVersion(artifactId, {
        slides: deck,
        note: note.trim() || undefined,
      });
      setGuard(r.guard ?? null);
      setDirty(false);
      setNote("");
      setSavedMsg(`Saved as version ${r.version}`);
      await onRefresh();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body.issues)) {
        setSaveError(e.message);
        setSaveIssues(e.body.issues as string[]);
      } else {
        setSaveError((e as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- export .pptx (authed blob download, §5.4) ----
  const exportPptx = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadArtifactPptx(artifactId, title, currentVersion);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  // Amber dots on the rail: slides whose text contains a guard violation.
  const guardSlideIds = useMemo(() => {
    if (guard === null || guard.ok) return new Set<string>();
    const hits = guard.violations.map((v) => v.toLowerCase());
    return new Set(
      deck.slides.filter((s) => hits.some((h) => slideText(s).includes(h))).map((s) => s.id)
    );
  }, [guard, deck]);

  const showChat = canEdit && chatOpen;

  return (
    <div>
      <DeckToolbar
        canEdit={canEdit}
        slideCount={deck.slides.length}
        activeIndex={active}
        activeLayout={activeSlide.layout}
        dirty={dirty}
        saving={saving}
        exporting={exporting}
        nextVersion={currentVersion + 1}
        note={note}
        notesOpen={notesOpen}
        chatOpen={chatOpen}
        onNote={setNote}
        onAdd={addSlide}
        onDuplicate={duplicateSlide}
        onDelete={deleteSlide}
        onMove={moveSlide}
        onLayoutChange={(layout) =>
          apply({
            ...deck,
            slides: deck.slides.map((s, i) => (i === active ? convertLayout(s, layout) : s)),
          })
        }
        onToggleNotes={() => setNotesOpen((o) => !o)}
        onToggleChat={() => setChatOpen((o) => !o)}
        onSave={() => void save()}
        onExport={() => void exportPptx()}
      />

      {(saveError !== null || exportError !== null) && (
        <div style={{ ...errStrip, marginTop: 0, marginBottom: 14 }} role="alert">
          {saveError ?? exportError}
          {saveIssues.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 20, fontWeight: 400 }}>
              {saveIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {savedMsg !== null && (
        <p style={{ margin: "0 0 12px", color: "var(--teal-dark)", fontWeight: 500, fontSize: 13 }}>
          <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
          {savedMsg}
        </p>
      )}
      {guard !== null && !guard.ok && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#FCF0DA",
            color: "#8A5A0B",
            borderRadius: "var(--r-pill)",
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 14,
          }}
        >
          <i className="fa-solid fa-triangle-exclamation" />
          {guard.violations.length} banned word{guard.violations.length === 1 ? "" : "s"} — will
          block finalization: {guard.violations.join(", ")}
        </div>
      )}

      <div
        className="deck-workspace"
        style={{
          gridTemplateColumns: showChat ? "168px minmax(0, 1fr) 340px" : "168px minmax(0, 1fr)",
          marginBottom: 18,
        }}
      >
        <SlideThumbRail
          slides={deck.slides}
          active={active}
          onSelect={setActive}
          guardSlideIds={guardSlideIds}
          kicker={productName}
        />

        <div>
          <SlideCanvas
            slide={activeSlide}
            editable={canEdit}
            kicker={productName}
            onPatch={patchActive}
          />
          {canEdit && notesOpen && (
            <SpeakerNotes
              value={activeSlide.notes ?? ""}
              editable={canEdit}
              onChange={(v) => patchActive({ notes: v === "" ? undefined : v })}
            />
          )}
        </div>

        {showChat && (
          <ChatEditPanel
            artifactId={artifactId}
            mode="deck"
            activeSlideNumber={active + 1}
            activeSlideId={activeSlide.id}
            dirty={dirty}
            onApplied={(r) => {
              const next = r.slides;
              if (next !== null) {
                setDeck(next);
                setDirty(false);
                setGuard(r.guard);
                setActive((a) => Math.min(a, next.slides.length - 1));
              }
              void onRefresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
