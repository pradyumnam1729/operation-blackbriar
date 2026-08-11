import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut, Role } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// User Management (modeled on Aurigo Essentials' UM module): invite users
// with a role, assign/change roles inline, lock/unlock, share reset links,
// remove accounts. Admin-only — the backend 403s regardless of the nav.

interface ManagedUser {
  id: string;
  email: string;
  fullName: string | null;
  role: Role | null;
  status: "active" | "invited" | "locked";
  lastSignIn: string | null;
  createdAt: string;
}

const STATUS_PILL: Record<ManagedUser["status"], { cls: string; label: string }> = {
  active: { cls: "pill-live", label: "Active" },
  invited: { cls: "pill-pending", label: "Invited" },
  locked: { cls: "pill-lost", label: "Locked" },
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "PMM Admin",
  sales: "Sales",
  marketing: "Marketing",
  elt: "ELT",
};

interface InviteResult {
  delivered: "email" | "temp_password";
  tempPassword: string | null;
  email: string;
}

export function UsersAdmin() {
  const { me } = useAuth();
  const admin = me?.role === "admin";

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>(["admin", "sales", "marketing", "elt"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyRow, setBusyRow] = useState("");

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invRole, setInvRole] = useState<Role>("sales");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);

  // Reset links, shown per-row after generation.
  const [resetLinks, setResetLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ users: ManagedUser[]; roles: Role[] }>("/api/users");
      setUsers(r.users);
      setRoles(r.roles);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!admin) return;
    void load();
  }, [admin, load]);

  const invite = async () => {
    setInviting(true);
    setError("");
    setInviteResult(null);
    try {
      const r = await apiPost<{ delivered: "email" | "temp_password"; tempPassword: string | null }>(
        "/api/users/invite",
        { email: invEmail, full_name: invName, role: invRole }
      );
      setInviteResult({ ...r, email: invEmail.trim().toLowerCase() });
      setInvEmail("");
      setInvName("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const setRole = async (u: ManagedUser, role: Role) => {
    setBusyRow(u.id);
    setError("");
    try {
      await apiPut(`/api/users/${u.id}`, { role });
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, role } : x)));
    } catch (e) {
      setError((e as Error).message);
      await load();
    } finally {
      setBusyRow("");
    }
  };

  const toggleLock = async (u: ManagedUser) => {
    setBusyRow(u.id);
    setError("");
    try {
      await apiPost(`/api/users/${u.id}/lock`, { locked: u.status !== "locked" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyRow("");
    }
  };

  const resetLink = async (u: ManagedUser) => {
    setBusyRow(u.id);
    setError("");
    try {
      const r = await apiPost<{ link: string }>(`/api/users/${u.id}/reset-link`);
      setResetLinks((l) => ({ ...l, [u.id]: r.link }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyRow("");
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const remove = async (u: ManagedUser) => {
    if (!window.confirm(`Remove ${u.email}? Their content stays; their sign-in is deleted.`)) return;
    setBusyRow(u.id);
    setError("");
    try {
      await apiDelete(`/api/users/${u.id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyRow("");
    }
  };

  if (!admin) {
    return (
      <div>
        <h1 className="pagetitle">User management</h1>
        <div className="card">
          <div className="empty-note">User management is a PMM-admin surface.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row-between" style={{ alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h1 className="pagetitle">
            User management{" "}
            <span className="pill pill-lock" style={{ marginLeft: 6 }}>
              <i className="fa-solid fa-lock" style={{ fontSize: 9 }} /> Admin only
            </span>
          </h1>
          <p className="pagesub">
            Invite teammates with a role, manage access, and lock or remove accounts. Roles decide
            what each person sees: PMM admins run the platform, everyone else consumes finalized
            content.
          </p>
        </div>
        <button
          className={showInvite ? "btn" : "btn btn-primary"}
          onClick={() => {
            setShowInvite((s) => !s);
            setInviteResult(null);
          }}
        >
          <i className={`fa-solid ${showInvite ? "fa-xmark" : "fa-user-plus"}`} />
          {showInvite ? "Cancel" : "Invite user"}
        </button>
      </div>

      {error !== "" && (
        <div
          style={{
            background: "#FCE8E8",
            color: "#A32D2D",
            borderRadius: "var(--r-md)",
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {showInvite && (
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>Invite a teammate</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 12 }}>
            <div>
              <label style={{ marginTop: 0 }}>Email</label>
              <input
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="name@aurigo.com"
              />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>Full name (optional)</label>
              <input
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                placeholder="e.g. Kiran (Sales — West)"
              />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>Role</label>
              <select value={invRole} onChange={(e) => setInvRole(e.target.value as Role)}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p style={{ margin: "14px 0 0" }}>
            <button
              className="btn btn-primary"
              onClick={() => void invite()}
              disabled={inviting || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invEmail.trim())}
              title={
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invEmail.trim())
                  ? "Send the invite"
                  : "Enter a valid email first"
              }
            >
              <i className={`fa-solid ${inviting ? "fa-spinner fa-spin" : "fa-paper-plane"}`} />{" "}
              {inviting ? "Inviting…" : "Send invite"}
            </button>
          </p>
          {inviteResult && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 16px",
                background: "#E4F4EE",
                borderRadius: "var(--r-md)",
                color: "#0E6B4E",
                fontSize: 13,
              }}
            >
              {inviteResult.delivered === "email" ? (
                <>
                  <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
                  Invite email sent to <b>{inviteResult.email}</b> — they set their password from
                  the link.
                </>
              ) : (
                <>
                  <i className="fa-solid fa-key" style={{ marginRight: 6 }} />
                  Account created for <b>{inviteResult.email}</b>. Email delivery isn&rsquo;t
                  configured, so share this one-time password with them directly — it is shown only
                  now:
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <code
                      style={{
                        background: "#fff",
                        border: "1px solid var(--border)",
                        padding: "6px 12px",
                        fontSize: 13,
                      }}
                    >
                      {inviteResult.tempPassword}
                    </code>
                    <button
                      className="btn btn-sm"
                      onClick={() => void copy("invite", inviteResult.tempPassword ?? "")}
                    >
                      <i className={`fa-solid ${copied === "invite" ? "fa-check" : "fa-copy"}`} />{" "}
                      {copied === "invite" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty-note">Loading users…</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === me?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {u.fullName ?? u.email}
                          {isSelf && (
                            <span className="pill pill-review" style={{ marginLeft: 8 }}>
                              you
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email}</div>
                        {resetLinks[u.id] && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginTop: 6,
                              fontSize: 11.5,
                            }}
                          >
                            <span style={{ color: "var(--teal-dark)", fontWeight: 500 }}>
                              Reset link ready
                            </span>
                            <button
                              className="btn btn-sm"
                              onClick={() => void copy(u.id, resetLinks[u.id])}
                            >
                              <i
                                className={`fa-solid ${copied === u.id ? "fa-check" : "fa-copy"}`}
                              />{" "}
                              {copied === u.id ? "Copied" : "Copy link"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <select
                          value={u.role ?? ""}
                          disabled={busyRow === u.id || (isSelf && u.role === "admin")}
                          title={
                            isSelf && u.role === "admin"
                              ? "You cannot remove your own admin role"
                              : "Change role"
                          }
                          onChange={(e) => void setRole(u, e.target.value as Role)}
                          style={{ minWidth: 130 }}
                        >
                          {u.role === null && <option value="">— no role —</option>}
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`pill ${STATUS_PILL[u.status].cls}`}>
                          {STATUS_PILL[u.status].label}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                        {u.lastSignIn ? new Date(u.lastSignIn).toLocaleString() : "never"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-sm"
                          disabled={busyRow === u.id || isSelf}
                          title={
                            isSelf
                              ? "You cannot lock your own account"
                              : u.status === "locked"
                                ? "Unlock — sign-in restored"
                                : "Lock — sign-in blocked until unlocked"
                          }
                          onClick={() => void toggleLock(u)}
                        >
                          <i
                            className={`fa-solid ${u.status === "locked" ? "fa-lock-open" : "fa-lock"}`}
                          />{" "}
                          {u.status === "locked" ? "Unlock" : "Lock"}
                        </button>{" "}
                        <button
                          className="btn btn-sm"
                          disabled={busyRow === u.id}
                          title="Generate a password-reset link to share with them"
                          onClick={() => void resetLink(u)}
                        >
                          <i className="fa-solid fa-key" /> Reset
                        </button>{" "}
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={busyRow === u.id || isSelf}
                          title={isSelf ? "You cannot delete your own account" : "Delete this account"}
                          onClick={() => void remove(u)}
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
