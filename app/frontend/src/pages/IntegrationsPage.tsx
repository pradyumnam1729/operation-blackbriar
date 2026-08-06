import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// Integrations & feature flags console. Local folders stand in for SharePoint
// until Graph API access is granted; Salesforce, Canva, and SMTP wait on
// credentials. Admins flip switches; everyone else can see the state.

interface Integration {
  id: string;
  kind: string;
  name: string;
  config: { path?: string; doc_type?: string } & Record<string, unknown>;
  enabled: boolean;
}

interface Flag {
  key: string;
  enabled: boolean;
  note: string | null;
}

const FLAG_HINTS: Record<string, string> = {
  sharepoint_watcher:
    "Local folders stand in for SharePoint until Graph API access is granted. When on, the backend watches the folders listed above and ingests new release notes and context docs automatically.",
  salesforce_live:
    "Waiting on credentials — win/loss uses mock opportunity data until the Salesforce Connected App is provisioned.",
  canva_live:
    "Waiting on credentials — the template gallery is mocked until the Canva Connect OAuth app exists.",
  email_send:
    "Waiting on credentials — notifications are logged, not emailed, until the SMTP key is configured.",
};

function StatePill({ on, labels }: { on: boolean; labels: [string, string] }) {
  return <span className={`pill ${on ? "pill-live" : "pill-archived"}`}>{on ? labels[0] : labels[1]}</span>;
}

// ---------- SharePoint (Microsoft Graph) connector ----------

interface SpStatus {
  configured: boolean;
  flagEnabled: boolean;
  requiredEnv: string[];
  requiredPermission: string;
  connections: {
    id: string;
    name: string;
    enabled: boolean;
    siteUrl?: string;
    folderPath?: string;
    docType?: string;
    productLine?: string;
    lastSync: string | null;
    lastResult: string | null;
  }[];
}

function SharePointSection({
  isAdmin,
  busy,
  run,
  onToggleConnection,
}: {
  isAdmin: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  onToggleConnection: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<SpStatus | null>(null);
  const [spError, setSpError] = useState("");
  const [testUrl, setTestUrl] = useState("");
  const [testResult, setTestResult] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    siteUrl: "",
    folderPath: "",
    docType: "release_note",
    productLine: "Masterworks",
  });
  const [syncLog, setSyncLog] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setStatus(await apiGet<SpStatus>("/api/sharepoint/status"));
    } catch (e) {
      setSpError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const test = () =>
    run(async () => {
      setTestResult("");
      setSpError("");
      try {
        const r = await apiPost<{ ok: boolean; webUrl: string }>("/api/sharepoint/test", {
          siteUrl: testUrl,
        });
        setTestResult(`Connected: ${r.webUrl}`);
      } catch (e) {
        setSpError((e as Error).message);
      }
      await load();
    });

  const addConnection = () =>
    run(async () => {
      setSpError("");
      try {
        await apiPost("/api/sharepoint/connections", form);
        setShowAdd(false);
        setForm({ name: "", siteUrl: "", folderPath: "", docType: "release_note", productLine: "Masterworks" });
      } catch (e) {
        setSpError((e as Error).message);
      }
      await load();
    });

  const syncNow = (id: string) =>
    run(async () => {
      setSpError("");
      setSyncLog([]);
      try {
        const r = await apiPost<{ log: string[] }>(`/api/sharepoint/connections/${id}/sync`);
        setSyncLog(r.log);
      } catch (e) {
        setSpError((e as Error).message);
      }
      await load();
    });

  const remove = (id: string) =>
    run(async () => {
      if (!window.confirm("Remove this SharePoint connection?")) return;
      await apiDelete(`/api/sharepoint/connections/${id}`);
      await load();
    });

  if (!status) return null;

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
          <i className="fa-brands fa-microsoft" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
          SharePoint (Microsoft Graph)
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {status.configured ? (
            <span className="pill pill-live">
              <i className="fa-solid fa-circle-check" style={{ fontSize: 10 }} /> Credentials configured
            </span>
          ) : (
            <span className="pill pill-lock">
              <i className="fa-solid fa-lock" style={{ fontSize: 10 }} /> Credentials missing
            </span>
          )}
          <StatePill on={status.flagEnabled} labels={["Live sync on", "Live sync off"]} />
        </div>
      </div>

      {spError && (
        <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {spError}
        </div>
      )}

      {!status.configured && (
        <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: "14px 16px", fontSize: 13, lineHeight: 1.6 }}>
          <strong>To connect live SharePoint:</strong> register an app in Azure Portal, then set{" "}
          {status.requiredEnv.map((e, i) => (
            <span key={e}>
              <code>{e}</code>
              {i < status.requiredEnv.length - 1 ? ", " : " "}
            </span>
          ))}
          in <code>app/backend/.env</code> and restart the backend. Required Graph permission:{" "}
          <strong>{status.requiredPermission}</strong>. Until then, the watched local folders below stand in.
        </div>
      )}

      {status.configured && isAdmin && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <input
              style={{ maxWidth: 380 }}
              placeholder="https://yourtenant.sharepoint.com/sites/ProductMarketing"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
            />
            <button
              className="btn btn-sm"
              onClick={test}
              disabled={busy || testUrl.trim() === ""}
              title={testUrl.trim() === "" ? "Enter a SharePoint site URL first" : "Verify credentials + site access"}
            >
              <i className="fa-solid fa-plug" /> Test connection
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd((s) => !s)} disabled={busy}>
              <i className="fa-solid fa-plus" /> Add connection
            </button>
          </div>
          {testResult && <p style={{ color: "var(--teal-dark)", fontWeight: 500, fontSize: 13 }}>{testResult}</p>}

          {showAdd && (
            <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: 16, marginBottom: 14 }}>
              <div className="grid grid-2">
                <div>
                  <label style={{ marginTop: 0 }}>Connection name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masterworks release notes" />
                </div>
                <div>
                  <label style={{ marginTop: 0 }}>Site URL</label>
                  <input value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} placeholder="https://tenant.sharepoint.com/sites/PMM" />
                </div>
                <div>
                  <label>Folder path (blank = whole library)</label>
                  <input value={form.folderPath} onChange={(e) => setForm({ ...form, folderPath: e.target.value })} placeholder="Release Notes/Masterworks" />
                </div>
                <div>
                  <label>Document type</label>
                  <select value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })} style={{ width: "100%" }}>
                    <option value="release_note">Release notes → Feature catalog</option>
                    <option value="prd">PRDs → Context docs</option>
                    <option value="jtbd">JTBDs → Context docs</option>
                    <option value="transcript">Transcripts → Context docs</option>
                    <option value="other">Other → Context docs</option>
                  </select>
                </div>
                {form.docType === "release_note" && (
                  <div>
                    <label>Product line</label>
                    <select value={form.productLine} onChange={(e) => setForm({ ...form, productLine: e.target.value })} style={{ width: "100%" }}>
                      <option>Masterworks</option>
                      <option>Primus</option>
                    </select>
                  </div>
                )}
              </div>
              <p style={{ marginBottom: 0 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={addConnection}
                  disabled={busy || form.name.trim() === "" || form.siteUrl.trim() === ""}
                  title={
                    form.name.trim() === ""
                      ? "Name the connection first"
                      : form.siteUrl.trim() === ""
                        ? "Enter the site URL first"
                        : "Create the connection"
                  }
                >
                  <i className="fa-solid fa-link" /> Connect
                </button>
              </p>
            </div>
          )}
        </>
      )}

      {status.connections.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Connection</th>
                <th>Site / folder</th>
                <th>Ingests as</th>
                <th>Last sync</th>
                <th>State</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {status.connections.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ fontSize: 12.5 }}>
                    {c.siteUrl}
                    {c.folderPath ? ` / ${c.folderPath}` : ""}
                  </td>
                  <td>
                    <span className="pill pill-review">{c.docType}</span>
                    {c.productLine && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>{c.productLine}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {c.lastSync ? new Date(c.lastSync).toLocaleString() : "never"}
                    {c.lastResult && (
                      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{c.lastResult}</div>
                    )}
                  </td>
                  <td>
                    <StatePill on={c.enabled} labels={["Enabled", "Paused"]} />
                  </td>
                  {isAdmin && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => void syncNow(c.id)}
                        disabled={busy || !status.configured}
                        title={status.configured ? "Run a delta sync now" : "Configure credentials first"}
                      >
                        <i className="fa-solid fa-rotate" /> Sync now
                      </button>{" "}
                      <button className="btn btn-sm" onClick={() => void onToggleConnection(c.id)} disabled={busy}>
                        {c.enabled ? "Pause" : "Resume"}
                      </button>{" "}
                      <button className="btn btn-danger btn-sm" onClick={() => void remove(c.id)} disabled={busy}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status.connections.length === 0 && status.configured && (
        <p className="empty-note">No SharePoint connections yet — add one above.</p>
      )}

      {syncLog.length > 0 && (
        <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: "12px 16px", fontSize: 12.5, marginTop: 12 }}>
          {syncLog.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function IntegrationsPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === "admin";

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ integrations: Integration[]; flags: Flag[] }>("/api/integrations");
      setIntegrations(r.integrations);
      setFlags(r.flags);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
      await load();
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        msg.includes("Admin")
          ? "Only PMMs (admins) can change integration settings. Ask a PMM to flip this."
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleIntegration = (id: string) =>
    run(async () => {
      await apiPost(`/api/integrations/${id}/toggle`);
    });

  const toggleFlag = (key: string) =>
    run(async () => {
      const r = await apiPost<{ key: string; enabled: boolean }>(`/api/integrations/flags/${key}/toggle`);
      if (key === "sharepoint_watcher") {
        setInfo(
          r.enabled
            ? "Watcher turned on — enabled folders are being scanned now."
            : "Watcher turned off — folders are no longer being scanned."
        );
      }
    });

  const rescan = () =>
    run(async () => {
      const r = await apiPost<{ restarted: boolean; message: string }>("/api/integrations/watch-now");
      setInfo(r.message);
    });

  return (
    <div>
      <h1 className="pagetitle">Integrations</h1>
      <p className="pagesub">
        Connection points into the platform. SharePoint is stood in by watched local folders until
        Microsoft Graph API access is granted; the rest wait on credentials.
      </p>

      {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      {info && <p style={{ color: "var(--teal-dark)", fontWeight: 500 }}>{info}</p>}

      {/* ---------- SharePoint (Microsoft Graph) ---------- */}
      <SharePointSection
        isAdmin={isAdmin}
        busy={busy}
        run={run}
        onToggleConnection={(id) => toggleIntegration(id)}
      />

      {/* ---------- integrations ---------- */}
      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Local folder watchers</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Config path</th>
                <th>State</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {integrations.filter((i) => i.kind !== "sharepoint_graph").map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 500 }}>{i.name}</td>
                  <td>{i.kind}</td>
                  <td>
                    <code style={{ fontSize: 12.5 }}>{i.config.path ?? "—"}</code>
                    {i.config.doc_type && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                        ({String(i.config.doc_type)})
                      </span>
                    )}
                  </td>
                  <td>
                    <StatePill on={i.enabled} labels={["Enabled", "Disabled"]} />
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-sm" onClick={() => toggleIntegration(i.id)} disabled={busy}>
                        {i.enabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {integrations.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="empty-note">
                    No integrations configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- feature flags ---------- */}
      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Feature flags</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Flag</th>
                <th>Notes</th>
                <th>State</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => {
                const highlighted = f.key === "sharepoint_watcher";
                return (
                  <tr key={f.key} style={highlighted ? { background: "#F2FAFB" } : undefined}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <strong>{f.key}</strong>
                      {highlighted && (
                        <span className="pill pill-live" style={{ marginLeft: 8 }}>
                          <i className="fa-solid fa-circle-nodes" style={{ fontSize: 10 }} /> SharePoint
                          stand-in
                        </span>
                      )}
                    </td>
                    <td>
                      {f.note && <div>{f.note}</div>}
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                        {FLAG_HINTS[f.key] ?? ""}
                      </div>
                      {highlighted && isAdmin && (
                        <p style={{ margin: "10px 0 0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <button className="btn btn-primary btn-sm" onClick={rescan} disabled={busy}>
                            <i className="fa-solid fa-rotate" /> {busy ? "Working…" : "Rescan folders now"}
                          </button>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            Restarts the watchers — use after dropping files into the folders.
                          </span>
                        </p>
                      )}
                    </td>
                    <td>
                      <StatePill on={f.enabled} labels={["Enabled", "Disabled"]} />
                    </td>
                    {isAdmin && (
                      <td>
                        <button className="btn btn-sm" onClick={() => toggleFlag(f.key)} disabled={busy}>
                          {f.enabled ? "Turn off" : "Turn on"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {flags.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="empty-note">
                    No feature flags found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
