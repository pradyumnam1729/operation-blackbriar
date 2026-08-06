import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// SharePoint (Microsoft Graph) connector console. Admins configure Graph
// credentials from here, connect document libraries, and control live sync;
// everyone else can see the connection state.

function StatePill({ on, labels }: { on: boolean; labels: [string, string] }) {
  return <span className={`pill ${on ? "pill-live" : "pill-archived"}`}>{on ? labels[0] : labels[1]}</span>;
}

interface SpStatus {
  configured: boolean;
  credentials: { source: "database" | "env"; tenantId: string; clientId: string } | null;
  flagEnabled: boolean;
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

// ---------- Local folders (Input / Output) ----------

interface LocalFoldersStatus {
  configured: boolean;
  enabled?: boolean;
  inputPath?: string;
  outputPath?: string;
  docType?: string;
  productLine?: string | null;
  lastScan?: string | null;
  lastScanResult?: string | null;
  lastExport?: string | null;
  lastExportResult?: string | null;
}

function LocalFoldersSection({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<LocalFoldersStatus | null>(null);
  const [lfError, setLfError] = useState("");
  const [lfBusy, setLfBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [form, setForm] = useState({
    inputPath: "",
    outputPath: "",
    docType: "release_note",
    productLine: "Masterworks",
  });
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await apiGet<LocalFoldersStatus>("/api/local-folders");
      setStatus(s);
      if (s.configured) {
        setForm({
          inputPath: s.inputPath ?? "",
          outputPath: s.outputPath ?? "",
          docType: s.docType ?? "release_note",
          productLine: s.productLine ?? "Masterworks",
        });
      } else {
        setEditing(true); // nothing configured yet — open the form
      }
    } catch (e) {
      setLfError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setLfBusy(true);
    setLfError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setLfError((e as Error).message);
    } finally {
      setLfBusy(false);
    }
  };

  const save = () =>
    act(async () => {
      await apiPut("/api/local-folders", form);
      setEditing(false);
      setLog(["Folders saved — Input is being watched. Drop files in and they ingest automatically."]);
    });

  const scan = () =>
    act(async () => {
      const r = await apiPost<{ log: string[] }>("/api/local-folders/scan");
      setLog(r.log);
    });

  const exportNow = () =>
    act(async () => {
      const r = await apiPost<{ log: string[] }>("/api/local-folders/export");
      setLog(r.log);
    });

  const toggle = () =>
    act(async () => {
      await apiPost("/api/local-folders/toggle");
    });

  const canSave = form.inputPath.trim() !== "" && form.outputPath.trim() !== "";

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
          <i className="fa-solid fa-folder-tree" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
          Local folders (Input / Output)
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {status?.configured ? (
            <StatePill on={status.enabled ?? false} labels={["Watching Input", "Paused"]} />
          ) : (
            <span className="pill pill-pending">Not configured</span>
          )}
          {isAdmin && status?.configured && (
            <>
              <button className="btn btn-sm" onClick={toggle} disabled={lfBusy}>
                {status.enabled ? "Pause" : "Resume"}
              </button>
              <button className="btn btn-sm" onClick={() => setEditing((e) => !e)} disabled={lfBusy}>
                <i className="fa-solid fa-pen" /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        Files dropped into <strong>Input</strong> are ingested automatically — release notes flow to
        the Feature Catalog review queue, everything else becomes context docs pending approval.
        Approved <strong>final</strong> artifacts export to <strong>Output</strong> as ready-to-share
        HTML files.
      </p>

      {lfError && (
        <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {lfError}
        </div>
      )}

      {isAdmin && editing && (
        <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: 16, marginBottom: 14 }}>
          <div className="grid grid-2">
            <div>
              <label style={{ marginTop: 0 }}>Input folder path</label>
              <input
                value={form.inputPath}
                onChange={(e) => setForm({ ...form, inputPath: e.target.value })}
                placeholder="C:\\PMM\\Input"
              />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>Output folder path</label>
              <input
                value={form.outputPath}
                onChange={(e) => setForm({ ...form, outputPath: e.target.value })}
                placeholder="C:\\PMM\\Output"
              />
            </div>
            <div>
              <label>Input files ingest as</label>
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
              onClick={save}
              disabled={lfBusy || !canSave}
              title={canSave ? "Create the folders and start watching Input" : "Enter both folder paths first"}
            >
              <i className="fa-solid fa-link" /> {lfBusy ? "Saving…" : "Save & start watching"}
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 10 }}>
              Folders are created if they don't exist yet.
            </span>
          </p>
        </div>
      )}

      {status?.configured && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Folder</th>
                <th>Path</th>
                <th>Purpose</th>
                <th>Last activity</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 500 }}>
                  <i className="fa-solid fa-arrow-right-to-bracket" style={{ color: "var(--teal-dark)", marginRight: 6 }} />
                  Input
                </td>
                <td><code style={{ fontSize: 12.5 }}>{status.inputPath}</code></td>
                <td>
                  <span className="pill pill-review">{status.docType}</span>
                  {status.productLine && status.docType === "release_note" && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>{status.productLine}</span>
                  )}
                </td>
                <td style={{ fontSize: 12.5 }}>
                  {status.lastScan ? new Date(status.lastScan).toLocaleString() : "never scanned"}
                  {status.lastScanResult && (
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{status.lastScanResult}</div>
                  )}
                </td>
                {isAdmin && (
                  <td>
                    <button className="btn btn-sm" onClick={scan} disabled={lfBusy} title="Ingest new/changed files now">
                      <i className="fa-solid fa-rotate" /> Scan now
                    </button>
                  </td>
                )}
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>
                  <i className="fa-solid fa-arrow-right-from-bracket" style={{ color: "var(--teal-dark)", marginRight: 6 }} />
                  Output
                </td>
                <td><code style={{ fontSize: 12.5 }}>{status.outputPath}</code></td>
                <td><span className="pill pill-final">final artifacts</span></td>
                <td style={{ fontSize: 12.5 }}>
                  {status.lastExport ? new Date(status.lastExport).toLocaleString() : "never exported"}
                  {status.lastExportResult && (
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{status.lastExportResult}</div>
                  )}
                </td>
                {isAdmin && (
                  <td>
                    <button className="btn btn-sm" onClick={exportNow} disabled={lfBusy} title="Write all final artifacts to Output as HTML">
                      <i className="fa-solid fa-file-export" /> Export finals
                    </button>
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: "12px 16px", fontSize: 12.5, marginTop: 12 }}>
          {log.map((l, i) => (
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

  const [status, setStatus] = useState<SpStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // credentials form
  const [showCreds, setShowCreds] = useState(false);
  const [credsInitialised, setCredsInitialised] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [credsNote, setCredsNote] = useState("");

  // test / add-connection / sync
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
      const s = await apiGet<SpStatus>("/api/sharepoint/status");
      setStatus(s);
      if (s.credentials) {
        setTenantId(s.credentials.tenantId);
        setClientId(s.credentials.clientId);
      }
      setCredsInitialised((done) => {
        if (!done && !s.configured) setShowCreds(true); // auto-expand when nothing is configured yet
        return true;
      });
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

  const toggleLiveSync = () =>
    run(async () => {
      await apiPost("/api/integrations/flags/sharepoint_graph/toggle");
    });

  const saveCredentials = () =>
    run(async () => {
      setCredsNote("");
      await apiPut("/api/sharepoint/credentials", {
        tenantId: tenantId.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret,
      });
      setClientSecret("");
      setCredsNote("Credentials saved. Test a site URL below to confirm access.");
    });

  const clearCredentials = () =>
    run(async () => {
      if (!window.confirm("Clear the stored SharePoint credentials? If app/backend/.env still has MS_* values, those take over; otherwise live sync stops until new credentials are saved.")) return;
      setCredsNote("");
      await apiDelete("/api/sharepoint/credentials");
      setTenantId("");
      setClientId("");
      setClientSecret("");
    });

  const test = () =>
    run(async () => {
      setTestResult("");
      const r = await apiPost<{ ok: boolean; webUrl: string; suggestedFolderPath: string | null }>(
        "/api/sharepoint/test",
        { siteUrl: testUrl }
      );
      setTestResult(
        `Connected: ${r.webUrl}${r.suggestedFolderPath ? ` — folder detected: ${r.suggestedFolderPath}` : ""}`
      );
      // Pre-fill the add-connection form with what the test learned.
      setForm((f) => ({
        ...f,
        siteUrl: testUrl,
        folderPath: r.suggestedFolderPath ?? f.folderPath,
      }));
      setShowAdd(true);
    });

  const addConnection = () =>
    run(async () => {
      await apiPost("/api/sharepoint/connections", form);
      setShowAdd(false);
      setForm({ name: "", siteUrl: "", folderPath: "", docType: "release_note", productLine: "Masterworks" });
    });

  const syncNow = (id: string) =>
    run(async () => {
      setSyncLog([]);
      const r = await apiPost<{ log: string[] }>(`/api/sharepoint/connections/${id}/sync`);
      setSyncLog(r.log);
    });

  const toggleConnection = (id: string) =>
    run(async () => {
      await apiPost(`/api/integrations/${id}/toggle`);
    });

  const removeConnection = (id: string) =>
    run(async () => {
      if (!window.confirm("Remove this SharePoint connection?")) return;
      await apiDelete(`/api/sharepoint/connections/${id}`);
    });

  const canSaveCreds = tenantId.trim() !== "" && clientId.trim() !== "" && clientSecret !== "";

  return (
    <div>
      <h1 className="pagetitle">Integrations</h1>
      <p className="pagesub">
        SharePoint connector over Microsoft Graph. Configure app credentials, connect document
        libraries, and the platform ingests release notes and context docs into the war room.
      </p>

      {error && <p style={{ color: "var(--red)" }}>{error}</p>}

      <LocalFoldersSection isAdmin={isAdmin} />

      {status && (
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
              {isAdmin && (
                <button
                  className="btn btn-sm"
                  onClick={toggleLiveSync}
                  disabled={busy}
                  title={status.flagEnabled ? "Turn live sync off" : "Turn live sync on"}
                >
                  {status.flagEnabled ? "Turn off" : "Turn on"}
                </button>
              )}
            </div>
          </div>

          {/* ---------- credentials ---------- */}
          {isAdmin ? (
            <div style={{ marginBottom: 14 }}>
              <button className="btn btn-sm" onClick={() => setShowCreds((s) => !s)} disabled={busy}>
                <i className={`fa-solid fa-chevron-${showCreds ? "up" : "down"}`} /> Configure credentials
              </button>

              {showCreds && (
                <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: 16, marginTop: 10 }}>
                  {!status.configured && (
                    <p style={{ marginTop: 0, fontSize: 13, lineHeight: 1.6 }}>
                      <strong>Setup:</strong> register an app in Azure Portal, grant Microsoft Graph →
                      Application → <strong>{status.requiredPermission}</strong>, have an admin consent to
                      it, then paste the tenant ID, client ID, and client secret here.
                    </p>
                  )}
                  {status.credentials?.source === "env" && (
                    <p style={{ marginTop: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      Credentials currently come from <code>app/backend/.env</code>. Saving here stores
                      them in the database and overrides the .env values.
                    </p>
                  )}
                  <div className="grid grid-2">
                    <div>
                      <label style={{ marginTop: 0 }}>Tenant ID</label>
                      <input
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                      />
                    </div>
                    <div>
                      <label style={{ marginTop: 0 }}>Client ID</label>
                      <input
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                      />
                    </div>
                    <div>
                      <label>Client secret</label>
                      <input
                        type="password"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        placeholder="••••••••  (unchanged secret is not shown)"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <p style={{ marginBottom: 0, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={saveCredentials}
                      disabled={busy || !canSaveCreds}
                      title={canSaveCreds ? "Save credentials" : "All three fields are required — the secret must be re-entered on every save"}
                    >
                      <i className="fa-solid fa-key" /> Save credentials
                    </button>
                    {status.credentials?.source === "database" && (
                      <button className="btn btn-danger btn-sm" onClick={clearCredentials} disabled={busy}>
                        <i className="fa-solid fa-trash" /> Clear credentials
                      </button>
                    )}
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      The secret is stored on the backend and never shown again.
                    </span>
                  </p>
                  {credsNote && (
                    <p style={{ margin: "10px 0 0", color: "var(--teal-dark)", fontWeight: 500, fontSize: 13 }}>
                      {credsNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            !status.configured && (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                A PMM admin must configure the SharePoint credentials before live sync can run.
              </p>
            )
          )}

          {/* ---------- test + add connection ---------- */}
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

          {/* ---------- connections table ---------- */}
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
                          <button className="btn btn-sm" onClick={() => void toggleConnection(c.id)} disabled={busy}>
                            {c.enabled ? "Pause" : "Resume"}
                          </button>{" "}
                          <button className="btn btn-danger btn-sm" onClick={() => void removeConnection(c.id)} disabled={busy}>
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

          {/* ---------- sync log ---------- */}
          {syncLog.length > 0 && (
            <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: "12px 16px", fontSize: 12.5, marginTop: 12 }}>
              {syncLog.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
