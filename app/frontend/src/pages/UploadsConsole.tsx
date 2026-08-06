import { useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiUpload, getProducts, Product } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";

interface UploadRow {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  sensitive: boolean;
  extraction_status: string;
  promoted: boolean;
  promoted_at: string | null;
  created_at: string;
  request_id: string | null;
  uploader: { full_name: string | null; email: string } | null;
  request: { id: string; title: string } | null;
}

interface RequestOption {
  id: string;
  title: string;
}

const FILE_TYPES = ["pdf", "docx", "pptx", "txt", "md", "vtt", "srt"];
const DOC_TYPES = ["prd", "jtbd", "transcript", "release_note", "battlecard", "other"];
const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.vtt,.srt";

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function extractionPill(status: string) {
  const cls = status === "done" ? "pill-final" : status === "failed" ? "pill-lock" : "pill-pending";
  return <span className={`pill ${cls}`}>{status}</span>;
}

export function UploadsConsole() {
  const { me } = useAuth();
  const admin = me?.role === "admin";

  const [rows, setRows] = useState<UploadRow[]>([]);
  const [requests, setRequests] = useState<RequestOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // upload zone state
  const [dragOver, setDragOver] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [promotedFilter, setPromotedFilter] = useState("");

  // preview + promote state
  const [preview, setPreview] = useState<{ row: UploadRow; text: string; truncated: boolean } | null>(null);
  const [promoteRow, setPromoteRow] = useState<UploadRow | null>(null);
  const [promoteDocType, setPromoteDocType] = useState("other");
  const [promoteProduct, setPromoteProduct] = useState("");
  const [promoteTitle, setPromoteTitle] = useState("");
  const [promoting, setPromoting] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim() !== "") params.set("q", q.trim());
      if (typeFilter !== "") params.set("file_type", typeFilter);
      if (promotedFilter !== "") params.set("promoted", promotedFilter);
      const r = await apiGet<{ uploads: UploadRow[] }>(`/api/uploads?${params.toString()}`);
      setRows(r.uploads);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, typeFilter, promotedFilter]);

  useEffect(() => {
    const t = window.setTimeout(load, 300); // debounce the search box
    return () => window.clearTimeout(t);
  }, [load]);

  // Escape closes the preview drawer / promote modal (backdrop click and buttons also work).
  useEffect(() => {
    if (!preview && !promoteRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreview(null);
        setPromoteRow(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview, promoteRow]);

  useEffect(() => {
    // Requests dropdown — endpoint belongs to the requests module; parse defensively.
    apiGet<unknown>("/api/requests")
      .then((r) => {
        const list = Array.isArray(r) ? r : (r as { requests?: unknown[] })?.requests ?? [];
        const opts = (list as { id?: string; title?: string }[])
          .filter((x) => typeof x.id === "string" && typeof x.title === "string")
          .map((x) => ({ id: x.id as string, title: x.title as string }));
        setRequests(opts);
      })
      .catch(() => setRequests([]));
    getProducts().then(setProducts).catch(() => {});
  }, []);

  const doUpload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      if (sensitive) form.append("sensitive", "true");
      if (requestId !== "") form.append("request_id", requestId);
      const r = await apiUpload<{ uploads: UploadRow[] }>("/api/uploads", form);
      setNotice(`Uploaded ${r.uploads.length} file${r.uploads.length === 1 ? "" : "s"}.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const openPreview = async (row: UploadRow) => {
    try {
      const r = await apiGet<{ upload: UploadRow; preview: string; truncated: boolean }>(
        `/api/uploads/${row.id}/preview`
      );
      setPreview({ row, text: r.preview, truncated: r.truncated });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const download = async (row: UploadRow) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(`/api/uploads/${row.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (row: UploadRow) => {
    if (!window.confirm(`Delete "${row.filename}"? The file is removed from disk.`)) return;
    try {
      await apiDelete(`/api/uploads/${row.id}`);
      setNotice(`Deleted ${row.filename}.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const startPromote = (row: UploadRow) => {
    setPromoteRow(row);
    setPromoteDocType(row.file_type === "vtt" || row.file_type === "srt" ? "transcript" : "other");
    setPromoteProduct("");
    setPromoteTitle(row.filename.replace(/\.[^.]+$/, ""));
  };

  const confirmPromote = async () => {
    if (!promoteRow) return;
    setPromoting(true);
    setError("");
    try {
      await apiPost(`/api/uploads/${promoteRow.id}/promote`, {
        title: promoteTitle.trim(),
        doc_type: promoteDocType,
        product_id: promoteProduct === "" ? undefined : promoteProduct,
      });
      setNotice(`Promoted "${promoteRow.filename}" to the approved context library.`);
      setPromoteRow(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div>
      <h1 className="pagetitle">Uploads console</h1>
      <p className="pagesub">
        Drop source material — PRDs, JTBDs, call transcripts, release notes. Text is extracted automatically;
        promoting a file makes it approved AI context.
      </p>

      <div className="card">
        <div
          className={dragOver ? "dropzone drag" : "dropzone"}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            doUpload(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
        >
          <i className={`fa-solid ${uploading ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} />
          {uploading ? "Uploading…" : "Drag files here, or click to browse"}
          <br />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            PDF, DOCX, PPTX, TXT, MD, VTT, SRT — transcripts (.vtt/.srt) are marked sensitive automatically
          </span>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            style={{ display: "none" }}
            onChange={(e) => e.target.files && doUpload(e.target.files)}
          />
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <label
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 400,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
              style={{ width: "auto" }}
            />
            <i className="fa-solid fa-lock" style={{ color: "#A32D2D", fontSize: 11 }} />
            Mark as sensitive (uploader + PMM only)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>
              Link to request
            </span>
            <select value={requestId} onChange={(e) => setRequestId(e.target.value)} style={{ width: 280 }}>
              <option value="">— none —</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {notice && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "#E1F0F2",
            borderRadius: "var(--r-md)",
            color: "var(--teal-dark)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ marginRight: 8 }} />
          {notice}
        </div>
      )}
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

      <div className="card">
        <div className="row-between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <input
            placeholder="Search filename or extracted text…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: 1,
              minWidth: 220,
              borderRadius: "var(--r-pill)",
              padding: "8px 16px",
              fontSize: 13,
              width: "auto",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {FILE_TYPES.map((t) => (
                <option key={t} value={t}>
                  .{t}
                </option>
              ))}
            </select>
            <select value={promotedFilter} onChange={(e) => setPromotedFilter(e.target.value)}>
              <option value="">Promoted + not</option>
              <option value="true">Promoted only</option>
              <option value="false">Not promoted</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploader</th>
                <th>Date</th>
                <th>Request</th>
                <th>Extraction</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <span className="empty-note" style={{ padding: 0 }}>
                      No uploads match.
                    </span>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <i className="fa-solid fa-file" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
                    <span style={{ fontWeight: 500 }}>{r.filename}</span>
                    {r.sensitive && (
                      <span className="pill pill-lock" style={{ marginLeft: 8 }}>
                        <i className="fa-solid fa-lock" style={{ fontSize: 9 }} /> Restricted
                      </span>
                    )}
                    {r.promoted && (
                      <span className="pill pill-final" style={{ marginLeft: 8 }}>
                        In context
                      </span>
                    )}
                  </td>
                  <td>.{r.file_type}</td>
                  <td>{kb(r.size_bytes)}</td>
                  <td>{r.uploader?.full_name ?? r.uploader?.email ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                  <td>{r.request?.title ?? "—"}</td>
                  <td>{extractionPill(r.extraction_status)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-sm" title="Preview" onClick={() => openPreview(r)}>
                      <i className="fa-solid fa-eye" />
                    </button>{" "}
                    <button className="btn btn-sm" title="Download" onClick={() => download(r)}>
                      <i className="fa-solid fa-download" />
                    </button>
                    {admin && (
                      <>
                        {" "}
                        <button className="btn btn-danger btn-sm" title="Delete" onClick={() => remove(r)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </>
                    )}
                    {admin && !r.promoted && (
                      <>
                        {" "}
                        <button className="btn btn-sm" onClick={() => startPromote(r)}>
                          <i className="fa-solid fa-arrow-up-right-dots" /> Promote
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="overlay" onClick={() => setPreview(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{preview.row.filename}</h3>
              <button className="close" onClick={() => setPreview(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <span className="filechip">
                <i className="fa-solid fa-file" /> .{preview.row.file_type} · {kb(preview.row.size_bytes)}
              </span>
              {extractionPill(preview.row.extraction_status)}
            </div>
            {preview.text === "" ? (
              <div className="empty-note">No extracted text available for this file.</div>
            ) : (
              <pre className="answer">
                {preview.text}
                {preview.truncated ? "\n\n… (first 2,000 characters shown)" : ""}
              </pre>
            )}
          </div>
        </div>
      )}

      {promoteRow && (
        <div className="modalwrap" onClick={() => setPromoteRow(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Promote to context doc</h3>
            <p>
              <b>{promoteRow.filename}</b>&rsquo;s extracted content will become available to every agent in the
              system. Requires admin approval — this is the explicit approval gate.
            </p>
            <label>Title</label>
            <input value={promoteTitle} onChange={(e) => setPromoteTitle(e.target.value)} />
            <label>Document type</label>
            <select value={promoteDocType} onChange={(e) => setPromoteDocType(e.target.value)}>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <label>Product (optional)</label>
            <select value={promoteProduct} onChange={(e) => setPromoteProduct(e.target.value)}>
              <option value="">— none —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={() => setPromoteRow(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmPromote}
                disabled={promoting || promoteTitle.trim() === ""}
              >
                <i className="fa-solid fa-circle-check" />
                {promoting ? "Promoting…" : "Approve & promote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
