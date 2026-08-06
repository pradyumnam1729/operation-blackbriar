import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

// Shared collaboration panel: threaded comments with @mentions, resolve state,
// and a collapsible activity feed. Mounted by artifact and request pages as
// <Comments entityType="artifact" entityId={id} />.

interface MentionRef {
  label: string;
  type: "user" | "team";
}

interface CommentNode {
  id: string;
  parent_id: string | null;
  body: string;
  resolved: boolean;
  created_at: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  resolved_by_name: string | null;
  mentions: MentionRef[];
  children: CommentNode[];
}

interface MentionTarget {
  label: string;
  type: "user" | "team";
}

interface ActivityEntry {
  id: string;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
  actor_name: string;
}

const MENTION_RE = /(@[A-Za-z0-9._'-]+)/g;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  const parts = name.replace(/[(),]/g, "").split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

const avatarStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  background: "var(--teal-light)",
  color: "var(--teal-darkest)",
  fontSize: 11,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 500,
  flexShrink: 0,
};

function renderBody(body: string, mentions: MentionRef[]) {
  return body.split(MENTION_RE).map((part, i) => {
    if (part.startsWith("@")) {
      const label = part.slice(1);
      const isTeam = mentions.some((m) => m.type === "team" && m.label.toLowerCase() === label.toLowerCase());
      return (
        <span key={i} className={isTeam ? "mention team" : "mention"}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function RoleChip({ role }: { role: string }) {
  if (!role) return null;
  return (
    <span className="pill pill-archived" style={{ fontSize: 10.5, textTransform: "uppercase" }}>
      {role}
    </span>
  );
}

function actionText(a: ActivityEntry): string {
  const d = a.detail ?? {};
  switch (a.action) {
    case "commented":
      return `commented${d.snippet ? `: "${String(d.snippet)}"` : ""}`;
    case "comment_resolved":
      return "resolved a comment thread";
    case "comment_unresolved":
      return "reopened a comment thread";
    case "file_uploaded":
      return `uploaded ${String(d.filename ?? "a file")}`;
    case "promoted_to_context":
      return `promoted ${String(d.title ?? "a file")} to context`;
    case "generated_in_studio":
      return `generated this asset in Studio (${String(d.asset_type ?? "asset")})`;
    default:
      return String(a.action).replace(/_/g, " ");
  }
}

export function Comments(props: { entityType: "artifact" | "request"; entityId: string }) {
  const { entityType, entityId } = props;
  const [threads, setThreads] = useState<CommentNode[]>([]);
  const [targets, setTargets] = useState<MentionTarget[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ comments: CommentNode[] }>(
        `/api/comments?entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`
      );
      setThreads(r.comments);
      const a = await apiGet<{ activity: ActivityEntry[] }>(
        `/api/comments/activity?entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`
      );
      setActivity(a.activity);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
    apiGet<{ targets: MentionTarget[] }>("/api/comments/mention-targets")
      .then((r) => setTargets(r.targets))
      .catch(() => {});
    const t = window.setInterval(load, 20000);
    return () => window.clearInterval(t);
  }, [load]);

  // ---- @ helper: when the draft ends in "@partial", offer matching targets ----
  const mentionMatch = useMemo(() => {
    const m = draft.match(/(?:^|[\s(])@([A-Za-z0-9._'-]*)$/);
    return m ? m[1] : null;
  }, [draft]);

  const suggestions = useMemo(() => {
    if (mentionMatch === null) return [];
    const q = mentionMatch.toLowerCase();
    return targets.filter((t) => t.label.toLowerCase().startsWith(q)).slice(0, 8);
  }, [mentionMatch, targets]);

  const insertMention = (label: string) => {
    setDraft((d) => d.replace(/@([A-Za-z0-9._'-]*)$/, `@${label} `));
    composerRef.current?.focus();
  };

  const submit = async () => {
    if (draft.trim() === "") return;
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/comments", {
        entity_type: entityType,
        entity_id: entityId,
        parent_id: replyTo?.id,
        body: draft.trim(),
      });
      setDraft("");
      setReplyTo(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleResolve = async (c: CommentNode) => {
    try {
      await apiPost(`/api/comments/${c.id}/${c.resolved ? "unresolve" : "resolve"}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const renderComment = (c: CommentNode, topLevel: boolean) => {
    const inner = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={avatarStyle}>{initials(c.author_name)}</div>
          <b style={{ fontSize: 12.5 }}>{c.author_name}</b>
          <RoleChip role={c.author_role} />
          <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{fmtDate(c.created_at)}</span>
          {topLevel && c.resolved && (
            <span className="pill pill-final">
              <i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} /> Resolved
              {c.resolved_by_name ? ` by ${c.resolved_by_name}` : ""}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            margin: "0 0 8px",
            whiteSpace: "pre-wrap",
            color: c.resolved ? "var(--text-muted)" : "var(--text-primary)",
          }}
        >
          {renderBody(c.body, c.mentions)}
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          <a
            style={{ cursor: "pointer", fontWeight: 500 }}
            onClick={() => {
              setReplyTo({ id: c.parent_id ?? c.id, author: c.author_name });
              composerRef.current?.focus();
            }}
          >
            Reply
          </a>
          {topLevel && (
            <a style={{ cursor: "pointer", fontWeight: 500 }} onClick={() => toggleResolve(c)}>
              {c.resolved ? "Unresolve" : "Resolve"}
            </a>
          )}
        </div>
        {c.children.map((child) => renderComment(child, false))}
      </>
    );

    if (topLevel) {
      return (
        <div key={c.id} className={c.resolved ? "thread resolved" : "thread"}>
          {inner}
        </div>
      );
    }
    return (
      <div
        key={c.id}
        style={{
          marginLeft: 24,
          marginTop: 10,
          paddingLeft: 12,
          borderLeft: "2px solid var(--border)",
        }}
      >
        {inner}
      </div>
    );
  };

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>
        <i className="fa-solid fa-comments" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
        Comments
      </h3>
      {error && (
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
          {error}
        </div>
      )}
      {threads.length === 0 && <div className="empty-note">No comments yet. Start the thread.</div>}
      {threads.map((c) => renderComment(c, true))}

      <div style={{ marginTop: 16 }}>
        {replyTo && (
          <p style={{ fontSize: 12.5, margin: "0 0 6px", color: "var(--text-secondary)" }}>
            <i className="fa-solid fa-reply" style={{ marginRight: 6 }} />
            Replying to <b>{replyTo.author}</b>{" "}
            <a style={{ color: "var(--red)", cursor: "pointer" }} onClick={() => setReplyTo(null)}>
              (cancel)
            </a>
          </p>
        )}
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment — type @ to mention a person or team (Sales, Marketing, Product, ELT)"
          style={{ minHeight: 72 }}
        />
        {suggestions.length > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-2)",
              marginTop: 6,
              padding: 6,
              maxWidth: 360,
            }}
          >
            {suggestions.map((t) => (
              <div
                key={`${t.type}-${t.label}`}
                onClick={() => insertMention(t.label)}
                style={{
                  padding: "7px 10px",
                  cursor: "pointer",
                  fontSize: 13,
                  borderRadius: "var(--r-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-page)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
              >
                <span className={t.type === "team" ? "mention team" : "mention"}>@{t.label}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                  {t.type === "team" ? "team" : "person"}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-primary" onClick={submit} disabled={busy || draft.trim() === ""}>
            <i className="fa-solid fa-paper-plane" />
            {busy ? "Posting…" : replyTo ? "Post reply" : "Post comment"}
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }}>
        <a
          style={{ cursor: "pointer", fontWeight: 500, fontSize: 13 }}
          onClick={() => setActivityOpen((o) => !o)}
        >
          <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 7 }} />
          {activityOpen ? "Hide activity" : `Activity (${activity.length})`}
        </a>
        {activityOpen && (
          <div style={{ marginTop: 8 }}>
            {activity.length === 0 && <div className="empty-note">No activity recorded yet.</div>}
            {activity.map((a) => (
              <div
                key={a.id}
                style={{
                  fontSize: 12.5,
                  padding: "6px 0",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <b style={{ color: "var(--text-primary)" }}>{a.actor_name}</b> {actionText(a)}
                <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11.5 }}>
                  {fmtDate(a.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
