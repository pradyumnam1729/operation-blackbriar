import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function describe(n: Notification): string {
  const p = n.payload ?? {};
  const by = s(p.by) || "Someone";
  const title = s(p.entity_title) || s(p.title);
  const snippet = s(p.snippet);
  switch (n.type) {
    case "request_created":
      return `New request${title ? ` "${title}"` : ""}${s(p.by) || s(p.requester) ? ` from ${s(p.by) || s(p.requester)}` : ""}.`;
    case "comment":
      return `${by} commented on your ${s(p.entity_type) || "item"}${title ? ` "${title}"` : ""}${
        snippet ? `: "${snippet}"` : "."
      }`;
    case "mention":
      return `${by} mentioned ${s(p.team) ? `the ${s(p.team)} team` : "you"} in a comment${
        snippet ? `: "${snippet}"` : "."
      }`;
    case "status_change":
    case "status_changed":
    case "request_status_changed":
      return `${title ? `"${title}" ` : ""}status changed${s(p.status) ? ` to ${s(p.status)}` : ""}${
        s(p.by) || s(p.changed_by) ? ` by ${s(p.by) || s(p.changed_by)}` : ""
      }.`;
    default:
      return `${by}: ${n.type.replace(/_/g, " ")}${title ? ` — "${title}"` : ""}${snippet ? ` — "${snippet}"` : ""}`;
  }
}

function typeIcon(t: string): string {
  switch (t) {
    case "request_created":
      return "fa-upload";
    case "comment":
      return "fa-comment";
    case "mention":
      return "fa-at";
    case "status_change":
    case "status_changed":
    case "request_status_changed":
      return "fa-circle-check";
    default:
      return "fa-bell";
  }
}

/**
 * Where a notification leads. Newer rows carry entity_type + entity_id in the
 * payload; older rows may not — those return null and render without any link
 * affordance (clicking wouldn't be able to keep the navigation promise).
 */
function linkTarget(n: Notification): string | null {
  const p = n.payload ?? {};
  const entityType = s(p.entity_type);
  const entityId = s(p.entity_id);
  if (entityType === "artifact" && entityId) return `/library/${entityId}`;
  if (entityType === "request" && entityId) return "/requests";
  if (s(p.request_id)) return "/requests"; // older request notifications
  return null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ notifications: Notification[] }>("/api/comments/notifications");
      setItems(r.notifications);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, [load]);

  const markRead = async (id: string) => {
    try {
      await apiPost(`/api/comments/notifications/${id}/read`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const markAll = async () => {
    try {
      await apiPost("/api/comments/notifications/read-all");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Click on a linked notification: mark read, then jump to the entity. */
  const open = async (n: Notification, target: string) => {
    if (!n.read) {
      try {
        await apiPost(`/api/comments/notifications/${n.id}/read`);
      } catch (e) {
        setError((e as Error).message);
        return; // stay put so the error is visible
      }
    }
    navigate(target);
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="pagetitle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            Notifications
            {unread > 0 && <span className="pill pill-lock">{unread} unread</span>}
          </h1>
          <p className="pagesub" style={{ marginBottom: 0 }}>
            Mentions, comments, and request updates across your work.
          </p>
        </div>
        {unread > 0 && (
          <button className="btn btn-sm" onClick={markAll}>
            <i className="fa-solid fa-check-double" /> Mark all read
          </button>
        )}
      </div>
      <div className="empty-note" style={{ paddingTop: 4 }}>
        Email delivery is stubbed until SMTP is configured — everything arrives here in-app.
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
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
      {loading && <div className="empty-note">Loading…</div>}
      {!loading && items.length === 0 && !error && (
        <div className="empty-note">Nothing yet — mentions, comments, and request updates land here.</div>
      )}

      {items.map((n) => {
        const target = linkTarget(n);
        return (
          <div
            key={n.id}
            onClick={target ? () => void open(n, target) : undefined}
            role={target ? "link" : undefined}
            tabIndex={target ? 0 : undefined}
            onKeyDown={
              target
                ? (e) => {
                    if (e.key === "Enter") void open(n, target);
                  }
                : undefined
            }
            title={target ? "Open" : undefined}
            style={{
              background: n.read ? "#fff" : "#F2FAFB",
              border: "1px solid var(--border)",
              borderLeft: n.read ? "3px solid var(--border)" : "3px solid var(--teal-light)",
              borderRadius: "var(--r-md)",
              padding: "12px 16px",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: target ? "pointer" : "default",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: n.read ? "var(--bg-page)" : "#E1F0F2",
                color: n.read ? "var(--text-muted)" : "var(--teal-dark)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              <i className={`fa-solid ${typeIcon(n.type)}`} />
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 13.5,
                fontWeight: n.read ? 400 : 500,
                color: n.read ? "var(--text-secondary)" : "var(--text-primary)",
              }}
            >
              {describe(n)}
              {target && (
                <i
                  className="fa-solid fa-arrow-right"
                  style={{ fontSize: 10, marginLeft: 8, color: "var(--teal-dark)" }}
                />
              )}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: 12, flexShrink: 0 }}>{fmtDate(n.created_at)}</span>
            {!n.read && (
              <button
                className="btn btn-sm"
                style={{ flexShrink: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  void markRead(n.id);
                }}
              >
                <i className="fa-solid fa-check" /> Mark read
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
