import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";
import { supabase } from "../lib/supabase";

// Reference output library (Asset studio → Finalized assets): every curated
// file in reference output/Output, grouped by folder, viewable inline and
// exportable to PDF. Real PDFs download as-is; docx/xlsx/pptx open a
// print-ready brand-styled HTML view where the browser's print dialog is the
// PDF exporter. Videos stream in a new tab.

interface RefAsset {
  path: string;
  name: string;
  group: string;
  subgroup: string | null;
  ext: string;
  kind: "document" | "video" | "other";
  sizeBytes: number;
  modified: string;
}

const EXT_ICON: Record<string, string> = {
  ".pdf": "fa-file-pdf",
  ".docx": "fa-file-word",
  ".pptx": "fa-file-powerpoint",
  ".xlsx": "fa-file-excel",
  ".xls": "fa-file-excel",
  ".md": "fa-file-lines",
  ".txt": "fa-file-lines",
  ".mp4": "fa-file-video",
  ".mov": "fa-file-video",
};

const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

async function authedBlob(url: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.blob();
}

export function ReferenceLibrary() {
  const [assets, setAssets] = useState<RefAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyPath, setBusyPath] = useState("");

  useEffect(() => {
    apiGet<{ assets: RefAsset[] }>("/api/reference-assets")
      .then((r) => setAssets(r.assets))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, RefAsset[]>();
    for (const a of assets) {
      const key = a.subgroup ? `${a.group} · ${a.subgroup}` : a.group;
      (m.get(key) ?? m.set(key, []).get(key)!).push(a);
    }
    return [...m.entries()];
  }, [assets]);

  const act = async (a: RefAsset, mode: "view" | "pdf") => {
    setBusyPath(a.path);
    setError("");
    try {
      const fileUrl = `/api/reference-assets/file?path=${encodeURIComponent(a.path)}`;
      const previewUrl = `/api/reference-assets/preview?path=${encodeURIComponent(a.path)}`;
      if (a.ext === ".pdf") {
        const blob = await authedBlob(fileUrl);
        const url = URL.createObjectURL(blob);
        if (mode === "view") {
          window.open(url, "_blank");
        } else {
          const el = document.createElement("a");
          el.href = url;
          el.download = a.name;
          document.body.appendChild(el);
          el.click();
          el.remove();
        }
      } else if (a.kind === "video" || a.kind === "other") {
        const blob = await authedBlob(fileUrl);
        window.open(URL.createObjectURL(blob), "_blank");
      } else {
        const blob = await authedBlob(mode === "pdf" ? `${previewUrl}&print=1` : previewUrl);
        window.open(URL.createObjectURL(blob), "_blank");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyPath("");
    }
  };

  return (
    <div style={{ marginTop: 28 }}>
      <div className="section-label">Reference library</div>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-secondary)" }}>
        The curated reference outputs — the quality bar generated assets are measured against. View
        any file; Export to PDF uses the browser&rsquo;s print dialog for office formats.
      </p>

      {error && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#FCE8E8", borderRadius: "var(--r-md)", color: "#A32D2D", fontSize: 13 }}>
          {error}
        </div>
      )}
      {loading && <div className="empty-note">Loading reference library…</div>}
      {!loading && assets.length === 0 && !error && (
        <div className="empty-note">The reference output folder is empty or missing.</div>
      )}

      {groups.map(([label, files]) => (
        <div key={label} style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 500, color: "var(--teal-dark)" }}>
            <i className="fa-solid fa-folder-open" style={{ marginRight: 6 }} />
            {label}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {files.length}</span>
          </h3>
          <div className="grid grid-3">
            {files.map((a) => (
              <div
                key={a.path}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)",
                  padding: 14,
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  boxShadow: "var(--shadow-1)",
                }}
              >
                <div className="row-between" style={{ alignItems: "flex-start", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
                    <i
                      className={`fa-solid ${EXT_ICON[a.ext] ?? "fa-file"}`}
                      style={{ color: "var(--teal-dark)", fontSize: 18, marginTop: 2 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflowWrap: "anywhere" }} title={a.path}>
                        {a.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {a.ext.slice(1)} · {kb(a.sizeBytes)} · {new Date(a.modified).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <button
                    className="btn btn-sm"
                    disabled={busyPath === a.path}
                    onClick={() => void act(a, "view")}
                    title={a.kind === "document" ? "Open in a new tab" : "Open / play in a new tab"}
                  >
                    <i className="fa-solid fa-eye" /> View
                  </button>
                  {a.kind === "document" && (
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={busyPath === a.path}
                      onClick={() => void act(a, "pdf")}
                      title={a.ext === ".pdf" ? "Download the PDF" : "Open print-ready view — save as PDF from the print dialog"}
                    >
                      <i className="fa-solid fa-file-export" /> Export to PDF
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
