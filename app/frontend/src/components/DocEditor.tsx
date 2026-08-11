import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { apiPost, ApiError, GuardCheck, saveArtifactVersion } from "../lib/api";
import { RichEditor } from "./RichEditor";
import { ChatEditPanel, ChatQuickAction } from "./ChatEditPanel";

// Document editor v2 (blueprint §5.1-4, §5.2): TipTap manual editing center +
// the shared AI chat panel right. The old one-shot AI action chips live in the
// chat panel as canned messages. Selection-scoped asks keep the existing
// /api/ai/edit behavior (a local, unsaved edit); full-document asks go through
// /chat-edit so every accepted edit is a version.

const QUICK_ACTIONS: ChatQuickAction[] = [
  {
    label: "Rewrite",
    icon: "fa-wand-magic-sparkles",
    message: "Rewrite this for clarity and impact, keeping every factual claim intact.",
  },
  {
    label: "Shorten",
    icon: "fa-minimize",
    message: "Shorten this without losing any load-bearing claim.",
  },
  {
    label: "Expand",
    icon: "fa-maximize",
    message: "Expand this with more concrete detail and proof.",
  },
  {
    label: "Fix voice",
    icon: "fa-spell-check",
    message:
      "Fix the voice per Aurigo standards: open from the reader's world, remove banned phrases, keep every claim.",
  },
  {
    label: "Executive tone",
    icon: "fa-user-tie",
    message: "Rewrite this in a crisp executive tone for a leadership reader.",
  },
];

interface DocEditorProps {
  artifactId: string;
  /** Server-side current content — flows into the editor whenever it is clean. */
  contentHtml: string;
  currentVersion: number;
  /** Reload artifact meta + version list (no full page reload). */
  onRefresh: () => Promise<void> | void;
}

export function DocEditor({ artifactId, contentHtml, currentVersion, onRefresh }: DocEditorProps) {
  const [html, setHtml] = useState(contentHtml);
  const [dirty, setDirty] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  const [saveNote, setSaveNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [guard, setGuard] = useState<GuardCheck | null>(null);

  // External updates (chat edit already applied locally, rollback, reload)
  // only flow in while there are no unsaved manual edits.
  useEffect(() => {
    if (!dirty && contentHtml !== html) setHtml(contentHtml);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHtml, dirty]);

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

  const handleEditor = (e: Editor | null) => {
    editorRef.current = e;
    if (e) {
      e.on("selectionUpdate", () => setHasSelection(!e.state.selection.empty));
    }
  };

  // Selection-scoped AI edit — unchanged /api/ai/edit behavior (§5.2): the
  // result replaces only the selected passage as a local, unsaved edit.
  const beforeSend = async (message: string): Promise<"handled" | "pass"> => {
    const editor = editorRef.current;
    if (!editor || editor.state.selection.empty) return "pass";
    const selection = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      " "
    );
    if (selection.trim() === "") {
      // A whitespace-only selection must not fall through to /chat-edit while
      // manual edits are unsaved — that would run against the last saved
      // version and silently clobber them (qa finding m3).
      if (dirty) {
        throw new Error("Save your manual edits first — this would run against the last saved version.");
      }
      return "pass";
    }
    const r = await apiPost<{ html: string }>("/api/ai/edit", {
      instruction: message,
      text: selection,
    });
    editor.chain().focus().deleteSelection().insertContent(r.html).run();
    return "handled";
  };

  const saveVersion = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedMsg(null);
    try {
      const r = await saveArtifactVersion(artifactId, {
        content_html: editorRef.current?.getHTML() ?? html,
        note: saveNote.trim() || undefined,
      });
      setGuard(r.guard ?? null);
      setDirty(false);
      setSaveNote("");
      setSavedMsg(`Saved as version ${r.version}`);
      await onRefresh();
    } catch (e) {
      setSaveError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "minmax(0, 1fr) 340px", alignItems: "start", marginBottom: 18 }}
    >
      <div className="card" style={{ marginBottom: 0 }}>
        <RichEditor
          valueHtml={html}
          onChange={(v) => {
            setHtml(v);
            setDirty(true);
            setSavedMsg(null);
          }}
          onEditor={handleEditor}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
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
            value={saveNote}
            onChange={(e) => setSaveNote(e.target.value)}
            placeholder="Version note (optional), e.g. “added proof point”"
          />
          <button
            className="btn btn-primary"
            style={{ whiteSpace: "nowrap" }}
            disabled={saving}
            onClick={() => void saveVersion()}
          >
            <i className="fa-solid fa-floppy-disk" />
            {saving ? "Saving…" : `Save version ${currentVersion + 1}`}
          </button>
        </div>
        {saveError !== null && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "#FCE8E8",
              borderRadius: "var(--r-md)",
              color: "#A32D2D",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {saveError}
          </div>
        )}
        {savedMsg !== null && (
          <p style={{ margin: "10px 0 0", color: "var(--teal-dark)", fontWeight: 500, fontSize: 13 }}>
            <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
            {savedMsg}
          </p>
        )}
        {guard !== null && !guard.ok && (
          <div
            style={{
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FCF0DA",
              color: "#8A5A0B",
              borderRadius: "var(--r-pill)",
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" />
            {guard.violations.length} banned word{guard.violations.length === 1 ? "" : "s"} — will
            block finalization: {guard.violations.join(", ")}
          </div>
        )}
        <p className="empty-note" style={{ padding: "10px 0 0", margin: 0 }}>
          Select text and ask the AI panel to act on just that passage; with nothing selected the
          whole document is edited and saved as a new version.
        </p>
      </div>

      <ChatEditPanel
        artifactId={artifactId}
        mode="document"
        dirty={dirty && !hasSelection}
        quickActions={QUICK_ACTIONS}
        beforeSend={beforeSend}
        onApplied={(r) => {
          setHtml(r.contentHtml);
          setDirty(false);
          setGuard(r.guard);
          void onRefresh();
        }}
      />
    </div>
  );
}
