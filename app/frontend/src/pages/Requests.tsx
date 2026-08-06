import { FormEvent, useEffect, useRef, useState } from "react";
import { apiGet, apiPost, apiUpload, getProducts, Product } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { Comments } from "../components/Comments";

// Requests intake: consumers file requests to PMM; PMMs (admins) triage all.

type RequestStatus = "open" | "in_progress" | "fulfilled" | "closed";
type RequestType = "asset" | "answer" | "update" | "other";

interface RequestRow {
  id: string;
  title: string;
  request_type: RequestType;
  product_id: string | null;
  description: string | null;
  due_date: string | null;
  status: RequestStatus;
  requester_id: string | null;
  created_at: string;
  product: { id: string; name: string; line: string; module: string } | null;
  requester: { id: string; full_name: string | null; email: string } | null;
}

interface UploadRow {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  created_at: string;
}

interface ArtifactRow {
  id: string;
  title: string;
  status: "draft" | "in_review" | "final" | "archived";
}

interface RequestDetail {
  request: RequestRow;
  uploads: UploadRow[];
  artifacts: ArtifactRow[];
}

const STATUS_PILL: Record<RequestStatus, string> = {
  open: "pill-pending",
  in_progress: "pill-review",
  fulfilled: "pill-final",
  closed: "pill-archived",
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  closed: "Closed",
};

const TYPE_LABELS: Record<RequestType, string> = {
  asset: "Asset",
  answer: "Answer",
  update: "Update",
  other: "Other",
};

const ARTIFACT_PILL: Record<ArtifactRow["status"], string> = {
  draft: "pill-draft",
  in_review: "pill-review",
  final: "pill-final",
  archived: "pill-archived",
};

function StatusPill({ status }: { status: RequestStatus }) {
  return <span className={`pill ${STATUS_PILL[status]}`}>{STATUS_LABELS[status]}</span>;
}

function fileIcon(hint: string): string {
  const s = hint.toLowerCase();
  if (s.includes("pdf")) return "fa-solid fa-file-pdf";
  if (s.includes("doc")) return "fa-solid fa-file-word";
  if (s.includes("ppt")) return "fa-solid fa-file-powerpoint";
  if (s.includes("vtt") || s.includes("srt") || s.includes("txt") || s.includes("text"))
    return "fa-solid fa-file-lines";
  return "fa-solid fa-file";
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

export function Requests() {
  const { me } = useAuth();
  const admin = me?.role === "admin";

  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  // new-request form
  const [title, setTitle] = useState("");
  const [type, setType] = useState<RequestType>("asset");
  const [productId, setProductId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadList = async () => {
    setLoadingList(true);
    try {
      const r = await apiGet<{ requests: RequestRow[] }>("/api/requests");
      setRequests(r.requests);
      setListError(null);
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      setDetail(await apiGet<RequestDetail>(`/api/requests/${id}`));
      setDetailError(null);
    } catch (e) {
      setDetail(null);
      setDetailError((e as Error).message);
    }
  };

  useEffect(() => {
    void loadList();
    getProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    setDetail(null);
    setDetailError(null);
    setUploadNote(null);
    setDragOver(false);
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId]);

  // Escape closes the request drawer (backdrop click and the X also work).
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Give the request a title.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const r = await apiPost<{ request: RequestRow }>("/api/requests", {
        title: title.trim(),
        request_type: type,
        product_id: productId || undefined,
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
      });
      setTitle("");
      setType("asset");
      setProductId("");
      setDueDate("");
      setDescription("");
      await loadList();
      setSelectedId(r.request.id); // show the new request right away
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (id: string, status: RequestStatus) => {
    setStatusBusy(true);
    try {
      await apiPost(`/api/requests/${id}/status`, { status });
      await Promise.all([loadDetail(id), loadList()]);
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setStatusBusy(false);
    }
  };

  const uploadFiles = async (id: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadBusy(true);
    setUploadNote(null);
    try {
      const form = new FormData();
      for (const file of Array.from(files)) form.append("files", file);
      form.append("request_id", id);
      await apiUpload("/api/uploads", form);
      await loadDetail(id);
      setUploadNote("Files attached.");
    } catch (e) {
      setUploadNote(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploadBusy(false);
    }
  };

  const detailReq = detail?.request;
  const canClose =
    detailReq && detailReq.status !== "closed" && (admin || detailReq.requester_id === me?.id);

  const selectedRow = requests.find((r) => r.id === selectedId) ?? null;
  const drawerReq = detailReq ?? selectedRow;

  return (
    <div>
      <h1 className="pagetitle">Requests &amp; intake</h1>
      <p className="pagesub">
        File a request to the PMM team and attach source material — transcripts, decks, briefs.
      </p>

      {/* ---------- new request ---------- */}
      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>New request</h3>
        <form onSubmit={submit}>
          <label htmlFor="req-title">Title</label>
          <input
            id="req-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. One-pager for Northgate Airport renewal"
          />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px" }}>
              <label htmlFor="req-type">Type</label>
              <select id="req-type" value={type} onChange={(e) => setType(e.target.value as RequestType)}>
                {(Object.keys(TYPE_LABELS) as RequestType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <label htmlFor="req-product">Product</label>
              <select id="req-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— none —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <label htmlFor="req-due">Due date</label>
              <input id="req-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <label htmlFor="req-desc">Description</label>
          <textarea
            id="req-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What do you need, for whom, and why?"
          />
          {formError && <p style={{ color: "var(--red)" }}>{formError}</p>}
          <div style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <i className="fa-solid fa-paper-plane" /> {submitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      </div>

      {/* ---------- list ---------- */}
      <div className="card" style={{ overflowX: "auto" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>
          {admin ? "All requests" : "My requests"}
        </h3>
        {listError && <p style={{ color: "var(--red)" }}>{listError}</p>}
        {loadingList && <p className="empty-note">Loading…</p>}
        {!loadingList && requests.length === 0 && !listError && (
          <p className="empty-note">No requests yet — file the first one above.</p>
        )}
        {requests.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Product</th>
                <th>Status</th>
                <th>Due</th>
                {admin && <th>Requester</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="rowhover"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                >
                  <td style={{ fontWeight: 500 }}>{r.title}</td>
                  <td>{TYPE_LABELS[r.request_type]}</td>
                  <td>{r.product?.name ?? "—"}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.due_date)}</td>
                  {admin && <td>{r.requester?.full_name ?? r.requester?.email ?? "Unknown requester"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- detail drawer ---------- */}
      {selectedId && (
        <div className="overlay" onClick={() => setSelectedId(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>{drawerReq?.title ?? "Request"}</h2>
              <button className="close" aria-label="Close" onClick={() => setSelectedId(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            {drawerReq && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                <StatusPill status={drawerReq.status} />
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                  {TYPE_LABELS[drawerReq.request_type]}
                  {drawerReq.product ? ` · ${drawerReq.product.name}` : ""}
                  {` · Due ${fmtDate(drawerReq.due_date)}`}
                </span>
              </div>
            )}

            {detailError && <p style={{ color: "var(--red)" }}>{detailError}</p>}
            {!detail && !detailError && <p className="empty-note">Loading…</p>}

            {detail && detail.request.id === selectedId && (
              <>
                <p style={{ marginTop: 0, whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55 }}>
                  {detail.request.description || <em>No description provided.</em>}
                </p>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  Filed {fmtDate(detail.request.created_at)}
                  {admin && detail.request.requester && (
                    <> by {detail.request.requester.full_name ?? detail.request.requester.email}</>
                  )}
                </p>

                <h3 style={{ fontSize: 14, fontWeight: 500, margin: "18px 0 8px" }}>Linked files</h3>
                {detail.uploads.length === 0 ? (
                  <p className="empty-note" style={{ padding: 0, marginTop: 0 }}>
                    No files attached yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                    {detail.uploads.map((u) => (
                      <span key={u.id} className="filechip">
                        <i className={fileIcon(`${u.file_type} ${u.filename}`)} />
                        {u.filename}
                        <span style={{ color: "var(--text-muted)" }}>({fmtDate(u.created_at)})</span>
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={dragOver ? "dropzone drag" : "dropzone"}
                  style={{ marginTop: 12, padding: "24px 16px" }}
                  onClick={() => !uploadBusy && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    void uploadFiles(selectedId, e.dataTransfer.files);
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-up" />
                  Drag files here, or <a>browse</a>
                  <br />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    PDF, DOCX, PPTX, TXT, VTT, SRT
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  disabled={uploadBusy}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    void uploadFiles(selectedId, e.target.files);
                    e.target.value = "";
                  }}
                />
                {uploadBusy && <p className="empty-note" style={{ padding: "6px 0 0" }}>Uploading…</p>}
                {uploadNote && (
                  <p
                    className="empty-note"
                    style={{
                      padding: "6px 0 0",
                      ...(uploadNote.startsWith("Upload failed") ? { color: "var(--red)", fontWeight: 500 } : {}),
                    }}
                  >
                    {uploadNote}
                  </p>
                )}

                <h3 style={{ fontSize: 14, fontWeight: 500, margin: "18px 0 8px" }}>Linked artifacts</h3>
                {detail.artifacts.length === 0 ? (
                  <p className="empty-note" style={{ padding: 0, marginTop: 0 }}>
                    No artifacts produced from this request yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detail.artifacts.map((a) => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                        <span>{a.title}</span>
                        <span className={`pill ${ARTIFACT_PILL[a.status]}`}>{a.status.replace("_", " ")}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ fontSize: 14, fontWeight: 500, margin: "18px 0 8px" }}>Status</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {admin ? (
                    (Object.keys(STATUS_LABELS) as RequestStatus[])
                      .filter((s) => s !== detail.request.status)
                      .map((s) => (
                        <button
                          key={s}
                          className="btn btn-sm"
                          disabled={statusBusy}
                          onClick={() => void changeStatus(selectedId, s)}
                        >
                          Mark {STATUS_LABELS[s].toLowerCase()}
                        </button>
                      ))
                  ) : canClose ? (
                    <button
                      className="btn btn-sm"
                      disabled={statusBusy}
                      onClick={() => void changeStatus(selectedId, "closed")}
                    >
                      Close request
                    </button>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      The PMM team updates status as work progresses.
                    </span>
                  )}
                </div>

                <div style={{ marginTop: 18 }}>
                  <Comments entityType="request" entityId={selectedId} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
