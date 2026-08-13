import { Fragment, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  ApiKeySummary,
  ApiKeyUsageRow,
  createApiKey,
  deleteApiKey,
  getApiKeyUsage,
  listApiKeys,
  toggleApiKey,
} from "../lib/api";

// API access drawer — key management for the Open API (blueprint
// app/docs/blueprints/open-api.md §7.2). Self-loads on mount, dirty-guards on
// close (an in-progress create form or an undismissed one-time key), and reports
// every mutation back to the page via onChanged. Two auth domains: this drawer
// speaks the Supabase-JWT admin API (/api/api-keys); it manages the keys that
// unlock the separate key-auth public surface (/api/public/v1). A 403 on load
// means the caller is not an admin — the drawer falls back to the docs-only view.

// Mirror of SCOPE_DESCRIPTIONS in app/backend/src/services/apiKeys.ts (§2.1) —
// keep the wording identical so the checkbox labels match the docs page.
const API_SCOPES = ["assets:read", "messaging:read", "intel:read", "ask"] as const;
type ApiScope = (typeof API_SCOPES)[number];

const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "assets:read": "List and download finalized assets (battlecards, datasheets, decks…)",
  "messaging:read": "Read approved Positioning & Messaging documents",
  "intel:read": "Read approved competitive intelligence (registry, CI reports, market threats)",
  ask: "Ask the PMM knowledge engine plain-language questions (uses AI tokens)",
};

const DOCS_URL = "/api/public/docs";
const SPEC_URL = "/api/public/v1/openapi.json";

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  isAdmin: boolean;
  onClose: () => void;
  /** Fired after any successful mutation so the page refreshes the card pill/stat. */
  onChanged: () => void;
}

export function ApiAccessDrawer({ isAdmin, onClose, onChanged }: Props) {
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [forbidden, setForbidden] = useState(false); // 403 on load → docs-only view
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // inline usage panel
  const [openUsage, setOpenUsage] = useState<string | null>(null);
  const [usage, setUsage] = useState<ApiKeyUsageRow[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([]);

  // one-time key reveal (plaintext lives ONLY here + the clipboard — never logged)
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [revealedName, setRevealedName] = useState("");
  const [copied, setCopied] = useState(false);

  const effectiveAdmin = isAdmin && !forbidden;

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return; // non-admin: skip the call, it would 403
    }
    try {
      const r = await listApiKeys();
      setKeys(r.keys);
      setForbidden(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true); // render docs-only view, no error noise
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeKeyCount = keys?.filter((k) => k.enabled).length ?? 0;

  const createFormDirty = name.trim() !== "" || team.trim() !== "" || scopes.length > 0;
  const dirty = createFormDirty || plaintext !== null;

  const attemptClose = () => {
    if (dirty && !window.confirm("Discard unsaved changes? Any one-time key not yet stored will be lost.")) return;
    onClose();
  };

  // Escape closes (through the dirty guard).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const toggleScope = (s: ApiScope) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const canCreate = name.trim() !== "" && scopes.length > 0 && !busy;

  const submitCreate = async () => {
    if (!canCreate) return;
    setBusy(true);
    setError("");
    try {
      const r = await createApiKey({ name: name.trim(), team: team.trim() || undefined, scopes });
      // Reveal the plaintext exactly once; clear the form so it is not "dirty"
      // beyond the undismissed key itself.
      setPlaintext(r.plaintext_key);
      setRevealedName(r.key.name);
      setCopied(false);
      setName("");
      setTeam("");
      setScopes([]);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dismissReveal = () => {
    setPlaintext(null); // drop plaintext from state — it is now unrecoverable
    setRevealedName("");
    setCopied(false);
  };

  const copyPlaintext = async () => {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
    } catch {
      setError("Could not copy automatically — select the key and copy it manually.");
    }
  };

  const doToggle = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await toggleApiKey(id);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (k: ApiKeySummary) => {
    if (
      !window.confirm(
        `Revoke and delete '${k.name}'? Systems using it lose access immediately.`
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await deleteApiKey(k.id);
      if (openUsage === k.id) setOpenUsage(null);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleUsage = async (id: string) => {
    if (openUsage === id) {
      setOpenUsage(null);
      return;
    }
    setOpenUsage(id);
    setUsage([]);
    setUsageLoading(true);
    try {
      const r = await getApiKeyUsage(id);
      setUsage(r.requests);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUsageLoading(false);
    }
  };

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div className="drawer" role="dialog" aria-label="API access" style={{ width: 640 }}>
        {/* ---------- header ---------- */}
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>
            <i className="fa-solid fa-key" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
            API access
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn btn-sm"
              onClick={() => window.open(DOCS_URL, "_blank", "noopener")}
              title="Open the API documentation in a new tab"
            >
              <i className="fa-solid fa-book" /> Documentation
            </button>
            <button className="close" aria-label="Close" onClick={attemptClose}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {/* copyable spec URL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: "var(--text-secondary)",
            marginBottom: 16,
          }}
        >
          <span>OpenAPI spec:</span>
          <code
            style={{
              fontFamily: "Consolas, monospace",
              fontSize: 12,
              background: "var(--bg-page)",
              padding: "3px 8px",
              borderRadius: "var(--r-sm)",
              color: "var(--teal-dark)",
            }}
          >
            {SPEC_URL}
          </code>
          <button
            className="btn btn-sm"
            onClick={() => void navigator.clipboard.writeText(SPEC_URL).catch(() => undefined)}
            title="Copy the spec URL"
          >
            <i className="fa-regular fa-copy" /> Copy
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

        {loading && <div className="empty-note">Loading API keys…</div>}

        {/* ---------- non-admin / forbidden: docs-only view ---------- */}
        {!loading && !effectiveAdmin && (
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            <p style={{ marginTop: 0 }}>
              Other teams integrate through PMM-issued API keys. The Open API exposes
              finalized assets, approved messaging, and cleared competitive intel — and a
              plain-language Ask endpoint — for tools that live outside this app.
            </p>
            <p>
              Browse the documentation to see what is available and how to call it. Ask a PMM
              admin to issue a key for your team.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => window.open(DOCS_URL, "_blank", "noopener")}
            >
              <i className="fa-solid fa-book" /> Read the API documentation
            </button>
          </div>
        )}

        {/* ---------- one-time key reveal ---------- */}
        {plaintext !== null && (
          <div
            style={{
              background: "var(--teal-darkest)",
              color: "#fff",
              borderRadius: "var(--r-md)",
              padding: 18,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: "var(--yellow)" }} />
              Key created for “{revealedName}” — shown ONCE
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.6, color: "#cde6ea" }}>
              Copy it now — this key is shown once and cannot be recovered. Store it in the
              consuming system's secret manager, never in a browser, a repository, or a log.
            </p>
            <div
              style={{
                fontFamily: "Consolas, monospace",
                fontSize: 13,
                background: "rgba(0,0,0,0.28)",
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                wordBreak: "break-all",
                marginBottom: 12,
              }}
            >
              {plaintext}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-sm" onClick={() => void copyPlaintext()}>
                <i className="fa-regular fa-copy" /> {copied ? "Copied" : "Copy key"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={dismissReveal}>
                I've stored it
              </button>
            </div>
          </div>
        )}

        {/* ---------- admin: key list ---------- */}
        {!loading && effectiveAdmin && (
          <>
            {keys !== null && keys.length === 0 ? (
              <p className="empty-note">
                No keys yet — create the first one for a team that wants API access.
              </p>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: 18 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Team</th>
                      <th>Key</th>
                      <th>Scopes</th>
                      <th>Last used</th>
                      <th>Enabled</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys?.map((k) => (
                      <Fragment key={k.id}>
                        <tr
                          role="button"
                          tabIndex={0}
                          aria-expanded={openUsage === k.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => void toggleUsage(k.id)}
                          onKeyDown={(e) => {
                            // Nested toggle/delete buttons keep native Enter/Space.
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void toggleUsage(k.id);
                            }
                          }}
                        >
                          <td style={{ fontWeight: 500 }}>{k.name}</td>
                          <td style={{ fontSize: 12.5 }}>{k.team || "—"}</td>
                          <td>
                            <code style={{ fontFamily: "Consolas, monospace", fontSize: 11.5 }}>
                              {k.key_prefix}…
                            </code>
                          </td>
                          <td>
                            <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {k.scopes.map((s) => (
                                <span key={s} className="pill pill-review" style={{ fontSize: 10.5 }}>
                                  {s}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{relTime(k.last_used_at)}</td>
                          <td>
                            <button
                              className={`pill ${k.enabled ? "pill-live" : "pill-lost"}`}
                              style={{ border: "none", cursor: "pointer" }}
                              disabled={busy}
                              title={k.enabled ? "Revoke (takes effect on the next request)" : "Re-enable this key"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void doToggle(k.id);
                              }}
                            >
                              {k.enabled ? "Enabled" : "Revoked"}
                            </button>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={busy}
                              title={`Revoke and delete '${k.name}'`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void doDelete(k);
                              }}
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          </td>
                        </tr>
                        {openUsage === k.id && (
                          <tr>
                            <td colSpan={7} style={{ background: "var(--bg-page)", padding: "12px 16px" }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>
                                Recent requests (last 50)
                              </div>
                              {usageLoading ? (
                                <div className="empty-note" style={{ padding: 0 }}>
                                  Loading usage…
                                </div>
                              ) : usage.length === 0 ? (
                                <div className="empty-note" style={{ padding: 0 }}>
                                  No requests recorded yet for this key.
                                </div>
                              ) : (
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Method</th>
                                      <th>Path</th>
                                      <th>Status</th>
                                      <th>When</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {usage.map((u, i) => (
                                      <tr key={i}>
                                        <td style={{ fontFamily: "Consolas, monospace", fontSize: 11.5 }}>{u.method}</td>
                                        <td style={{ fontFamily: "Consolas, monospace", fontSize: 11.5 }}>{u.path}</td>
                                        <td style={{ fontSize: 12.5 }}>{u.status ?? "—"}</td>
                                        <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{relTime(u.created_at)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- create form ---------- */}
            <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Issue a new key</div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Name, team, and scopes are fixed once created. To change what a key can reach,
                create a new key and revoke the old one.
              </p>
              <div className="grid grid-2">
                <div>
                  <label style={{ marginTop: 0 }}>Name (required)</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Proposals RFP bot"
                  />
                </div>
                <div>
                  <label style={{ marginTop: 0 }}>Team</label>
                  <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Proposals" />
                </div>
              </div>
              <label>Scopes (grant at least one)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {API_SCOPES.map((s) => (
                  <label
                    key={s}
                    style={{
                      display: "flex",
                      gap: 9,
                      alignItems: "flex-start",
                      margin: 0,
                      fontWeight: 400,
                      cursor: "pointer",
                      color: "var(--text-primary)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(s)}
                      onChange={() => toggleScope(s)}
                      style={{ width: "auto", marginTop: 2 }}
                    />
                    <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                      <code style={{ fontFamily: "Consolas, monospace", fontSize: 11.5, color: "var(--teal-dark)" }}>
                        {s}
                      </code>{" "}
                      — {SCOPE_DESCRIPTIONS[s]}
                    </span>
                  </label>
                ))}
              </div>
              <p style={{ margin: "14px 0 0" }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canCreate}
                  onClick={() => void submitCreate()}
                  title={
                    name.trim() === ""
                      ? "Name the key first"
                      : scopes.length === 0
                        ? "Grant at least one scope"
                        : "Create the key"
                  }
                >
                  <i className="fa-solid fa-key" /> Create key
                </button>
                {activeKeyCount > 0 && (
                  <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-muted)" }}>
                    {activeKeyCount} active key{activeKeyCount === 1 ? "" : "s"}
                  </span>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
