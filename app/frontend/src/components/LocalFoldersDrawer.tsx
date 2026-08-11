import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../lib/api";

// Local folders (Input / Output) config drawer — extracted from IntegrationsPage
// per blueprint connectors-cards.md §3.2. All state and handlers moved verbatim;
// the drawer self-loads status on mount and reports every successful mutation
// back to the page via onChanged so the card pills/stats refresh.

interface LocalFoldersStatus {
  configured: boolean;
  enabled?: boolean;
  inputPath?: string;
  outputPath?: string;
  docType?: string;
  productLine?: string | null;
  lastScan?: string | null;
  lastScanResult?: string | null;
  lastIngest?: string | null;
  lastIngestResult?: string | null;
  lastExport?: string | null;
  lastExportResult?: string | null;
}

interface LfForm {
  inputPath: string;
  outputPath: string;
  docType: string;
  productLine: string;
}

const EMPTY_FORM: LfForm = {
  inputPath: "",
  outputPath: "",
  docType: "release_note",
  productLine: "Masterworks",
};

function StatePill({ on, labels }: { on: boolean; labels: [string, string] }) {
  return <span className={`pill ${on ? "pill-live" : "pill-archived"}`}>{on ? labels[0] : labels[1]}</span>;
}

interface Props {
  isAdmin: boolean;
  onClose: () => void;
  /** Fired after any successful mutation so the page refreshes card pills/stats. */
  onChanged: () => void;
}

export function LocalFoldersDrawer({ isAdmin, onClose, onChanged }: Props) {
  const [status, setStatus] = useState<LocalFoldersStatus | null>(null);
  const [lfError, setLfError] = useState("");
  const [lfBusy, setLfBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [form, setForm] = useState<LfForm>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<LfForm>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await apiGet<LocalFoldersStatus>("/api/local-folders");
      setStatus(s);
      if (s.configured) {
        const loaded: LfForm = {
          inputPath: s.inputPath ?? "",
          outputPath: s.outputPath ?? "",
          docType: s.docType ?? "release_note",
          productLine: s.productLine ?? "Masterworks",
        };
        setForm(loaded);
        setBaseline(loaded);
      } else {
        setBaseline(EMPTY_FORM);
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
      onChanged();
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

  // Narrow dirty guard (blueprint §3): only prompt when the form is open AND
  // differs from what was loaded — an untouched drawer never prompts.
  const dirty =
    editing &&
    (form.inputPath !== baseline.inputPath ||
      form.outputPath !== baseline.outputPath ||
      form.docType !== baseline.docType ||
      form.productLine !== baseline.productLine);

  const attemptClose = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
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

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div className="drawer" role="dialog" aria-label="Configure Local folders connector">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>
            <i className="fa-solid fa-hard-drive" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
            Local folders (Input / Output)
          </h2>
          <button className="close" aria-label="Close" onClick={attemptClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {status === null && lfError === "" && <div className="empty-note">Loading folder status…</div>}

        {status !== null && (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              {status.configured ? (
                <StatePill on={status.enabled ?? false} labels={["Watching Input", "Paused"]} />
              ) : (
                <span className="pill pill-pending">Not configured</span>
              )}
              {isAdmin && status.configured && (
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

            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Files dropped into <strong>Input</strong> are ingested automatically. Each file's type
              (release note, PRD, JTBD, transcript, battlecard) is detected from its filename — release
              notes flow to the Feature Catalog review queue, everything else becomes AI-ready context
              docs. Approved <strong>final</strong> artifacts export to <strong>Output</strong> as
              ready-to-share HTML files.
            </p>
          </>
        )}

        {lfError && (
          <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
            {lfError}
          </div>
        )}

        {status !== null && (
          <>
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
                    <label>Default type for unrecognized files</label>
                    <select value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })} style={{ width: "100%" }}>
                      <option value="release_note">Release notes → Feature catalog</option>
                      <option value="prd">PRDs → Context docs</option>
                      <option value="jtbd">JTBDs → Context docs</option>
                      <option value="transcript">Transcripts → Context docs</option>
                      <option value="other">Other → Context docs</option>
                    </select>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Types are auto-detected per file from the filename; this only applies when detection
                      finds no match.
                    </span>
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

            {status.configured && (
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
                        <span className="pill pill-review">auto-detect</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>
                          default: {status.docType}
                          {status.productLine && status.docType === "release_note" ? ` (${status.productLine})` : ""}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {status.lastScan ? new Date(status.lastScan).toLocaleString() : "never scanned"}
                        {status.lastScanResult && (
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{status.lastScanResult}</div>
                        )}
                        {status.lastIngestResult && status.lastIngestResult !== status.lastScanResult && (
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                            Last ingest{status.lastIngest ? ` (${new Date(status.lastIngest).toLocaleString()})` : ""}: {status.lastIngestResult}
                          </div>
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
          </>
        )}
      </div>
    </div>
  );
}
