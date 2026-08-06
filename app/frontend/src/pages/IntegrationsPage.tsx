import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
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

      {/* ---------- integrations ---------- */}
      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Integrations</h3>
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
              {integrations.map((i) => (
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
