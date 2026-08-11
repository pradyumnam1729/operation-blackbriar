import { useRef, useState } from "react";
import { ApiError, chatEditArtifact, ChatEditResponse, ChatTurn } from "../lib/api";

// Conversational AI editing panel (blueprint §5.2, §4.4) shared by the deck
// workspace and the document editor. Every accepted edit is a new version —
// the assistant turn shows the one-line summary plus a version chip. Guard
// violations render as amber chips and never block (§0.1-5); 502 shows a red
// strip with retry and the content stays untouched. Chat history is client
// session state only (§0.1-7) — the durable trail is the version log.

export interface ChatQuickAction {
  label: string;
  icon: string;
  message: string;
}

interface PanelTurn {
  role: "user" | "assistant";
  text: string;
  version?: number;
  guard?: string[];
  kind?: "error" | "local";
}

interface ChatEditPanelProps {
  artifactId: string;
  mode: "deck" | "document";
  /** Deck: 1-based number of the active slide, for the scope selector label. */
  activeSlideNumber?: number;
  /** Deck: id of the active slide — resolved as scope when "This slide" is picked. */
  activeSlideId?: string | null;
  /** Unsaved manual edits block sends — no silent merge (§5.2). */
  dirty: boolean;
  /** Document mode: canned messages rendered as chips above the input. */
  quickActions?: ChatQuickAction[];
  /** Document mode: selection-scoped /api/ai/edit interception. "handled" =
   *  the edit was applied locally (unsaved), skip /chat-edit. */
  beforeSend?: (message: string) => Promise<"handled" | "pass">;
  /** A chat edit landed as a new version — replace local state, refresh meta. */
  onApplied: (r: ChatEditResponse) => void;
}

export function ChatEditPanel({
  artifactId,
  mode,
  activeSlideNumber,
  activeSlideId,
  dirty,
  quickActions,
  beforeSend,
  onApplied,
}: ChatEditPanelProps) {
  const [turns, setTurns] = useState<PanelTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // 502 red strip: keeps the failed message for the retry affordance.
  const [aiDown, setAiDown] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<"all" | "slide">("all");
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () =>
    window.setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, 30);

  const append = (turn: PanelTurn) => {
    setTurns((t) => [...t, turn]);
    scrollToEnd();
  };

  const send = async (raw: string) => {
    const message = raw.trim();
    // dirty = unsaved manual edits — never merge silently (§5.2). The prop is
    // already selection-aware in document mode.
    if (message === "" || busy || dirty) return;
    setAiDown(null);
    setInput("");
    append({ role: "user", text: message });
    setBusy(true);
    try {
      if (beforeSend && (await beforeSend(message)) === "handled") {
        append({
          role: "assistant",
          kind: "local",
          text: "Applied to your selection — an unsaved manual edit. Save to keep it as a version.",
        });
        return;
      }
      // Context only: the last ≤6 real conversational turns (§4.4).
      const history: ChatTurn[] = turns
        .filter((t) => t.kind === undefined)
        .slice(-6)
        .map((t) => ({ role: t.role, text: t.text }));
      const scope =
        mode === "deck" && scopeMode === "slide" && activeSlideId ? activeSlideId : undefined;
      const r = await chatEditArtifact(artifactId, { message, scope, history });
      append({
        role: "assistant",
        text: r.summary || "Edit applied.",
        version: r.version,
        guard: r.guard.ok ? undefined : r.guard.violations,
      });
      onApplied(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 502) {
        setAiDown(message);
      } else if (e instanceof ApiError && e.status === 422) {
        const issues = Array.isArray(e.body.issues) ? (e.body.issues as string[]) : [];
        append({
          role: "assistant",
          kind: "error",
          text: `${e.message}${issues.length > 0 ? ` (${issues.join("; ")})` : ""}`,
        });
      } else if (e instanceof ApiError && e.status === 404) {
        append({
          role: "assistant",
          kind: "error",
          text: `${e.message} — refresh the page to load the latest version.`,
        });
      } else {
        append({ role: "assistant", kind: "error", text: (e as Error).message });
      }
    } finally {
      setBusy(false);
    }
  };

  const sendDisabled = busy || dirty || input.trim() === "";

  return (
    <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>
        <i
          className="fa-solid fa-wand-magic-sparkles"
          style={{ marginRight: 8, color: "var(--teal-light)" }}
        />
        Edit with AI
      </h3>

      <div
        ref={listRef}
        style={{ flex: 1, overflowY: "auto", maxHeight: 420, minHeight: 120, paddingRight: 2 }}
      >
        {turns.length === 0 && (
          <p className="empty-note" style={{ paddingTop: 0 }}>
            {mode === "deck"
              ? "Describe the change — e.g. “make the proof slide about DOTs, not generic owners”. Each accepted edit lands as a new version."
              : "Describe the change — e.g. “tighten the opening to two sentences”. Each accepted edit lands as a new version."}
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`chat-bubble ${t.role === "user" ? "user" : "bot"}`}>
            <div className="av">
              {t.role === "user" ? "You" : <i className="fa-solid fa-wand-magic-sparkles" />}
            </div>
            <div className="msg" style={t.kind === "error" ? { color: "#A32D2D" } : undefined}>
              {t.text}
              {t.version !== undefined && (
                <span className="pill pill-live" style={{ marginLeft: 8 }}>
                  v{t.version}
                </span>
              )}
              {t.guard !== undefined && t.guard.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#FCF0DA",
                    color: "#8A5A0B",
                    borderRadius: "var(--r-pill)",
                    padding: "3px 11px",
                    fontSize: 11.5,
                    fontWeight: 500,
                  }}
                >
                  <i className="fa-solid fa-triangle-exclamation" />
                  {t.guard.length} banned word{t.guard.length === 1 ? "" : "s"} — will block
                  finalization: {t.guard.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="chat-bubble bot">
            <div className="av">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </div>
            <div className="msg" style={{ color: "var(--text-secondary)" }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />
              Working…
            </div>
          </div>
        )}
      </div>

      {aiDown !== null && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "#FCE8E8",
            borderRadius: "var(--r-md)",
            color: "#A32D2D",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ flex: 1 }}>AI unavailable — your content is unchanged.</span>
          <button className="btn btn-sm" disabled={busy || dirty} onClick={() => void send(aiDown)}>
            <i className="fa-solid fa-rotate-right" /> Retry
          </button>
        </div>
      )}

      {quickActions !== undefined && quickActions.length > 0 && (
        <div className="chip-row" style={{ marginTop: 10 }}>
          {quickActions.map((a) => (
            <button
              key={a.label}
              className="sugg-chip"
              disabled={busy || dirty}
              title={a.message}
              onClick={() => void send(a.message)}
            >
              <i className={`fa-solid ${a.icon}`} style={{ marginRight: 6 }} />
              {a.label}
            </button>
          ))}
        </div>
      )}

      {mode === "deck" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
            Scope
          </span>
          <select
            style={{ width: "auto" }}
            value={scopeMode}
            aria-label="Edit scope"
            onChange={(e) => setScopeMode(e.target.value as "all" | "slide")}
          >
            <option value="all">Whole deck</option>
            <option value="slide" disabled={!activeSlideId}>
              This slide{activeSlideNumber !== undefined ? ` (${activeSlideNumber})` : ""}
            </option>
          </select>
        </div>
      )}

      <div className="chat-input-row" style={{ marginTop: 12 }}>
        <input
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "deck" ? "Describe the slide change…" : "Describe the change…"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !sendDisabled) void send(input);
          }}
        />
        <button
          type="button"
          className="chat-send"
          title={dirty ? "Save your manual edits first" : "Send"}
          disabled={sendDisabled}
          onClick={() => void send(input)}
        >
          {busy ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-arrow-up" />}
        </button>
      </div>
      {dirty && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            fontWeight: 500,
            color: "#8A5A0B",
          }}
        >
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />
          Save your manual edits first — AI edits always start from the last saved version.
        </p>
      )}
    </div>
  );
}
