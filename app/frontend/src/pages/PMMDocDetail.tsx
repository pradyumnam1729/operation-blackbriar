import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// PMM doc detail: rendered document, Director review actions, comments,
// reference files, Copy as Markdown (per hive 1.html).

interface PmmDocFull {
  id: string;
  title: string;
  product: string;
  status: "draft" | "pending" | "changes" | "approved";
  ownerId: string | null;
  owner: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
  updatedAt: string;
  renderedHtml: string;
  progress: { answered: number; total: number };
  comments: { id: string; who: string; roleLabel: string; body: string; createdAt: string }[];
  files: { id: string; filename: string; created_at: string }[];
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "pill-draft" },
  pending: { label: "Pending approval", cls: "pill-pending" },
  changes: { label: "Changes requested", cls: "pill-deprecated" },
  approved: { label: "Approved", cls: "pill-final" },
};

export function PMMDocDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [doc, setDoc] = useState<PmmDocFull | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewComment, setReviewComment] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ doc: PmmDocFull }>(`/api/pmm/${id}`);
      setDoc(r.doc);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const approve = () =>
    act(async () => {
      const r = await apiPost<{ notes: string[] }>(`/api/pmm/${id}/approve`);
      setInfo(`Approved. ${r.notes.join("; ")}`);
    });

  const requestChanges = () =>
    act(async () => {
      await apiPost(`/api/pmm/${id}/request-changes`, { comment: reviewComment });
      setReviewComment("");
    });

  const deleteDraft = () =>
    act(async () => {
      if (!window.confirm("Delete this draft?")) return;
      await apiDelete(`/api/pmm/${id}`);
      navigate("/library?tab=pmm");
    });

  const copyMarkdown = () =>
    act(async () => {
      const r = await apiGet<{ markdown: string }>(`/api/pmm/${id}/markdown`);
      await navigator.clipboard.writeText(r.markdown);
      setInfo("Markdown copied to clipboard.");
    });

  if (!doc) return <div className="empty-note">{error || "Loading…"}</div>;

  const m = STATUS_META[doc.status];
  const isOwner = doc.ownerId === me?.id;

  return (
    <div>
      <button
        className="btn btn-sm"
        style={{ marginBottom: 16 }}
        onClick={() => navigate("/library?tab=pmm")}
      >
        <i className="fa-solid fa-arrow-left" /> PMM Workspace
      </button>

      <div className="row-between" style={{ marginBottom: 6 }}>
        <div>
          <h1 className="pagetitle" style={{ marginBottom: 2 }}>{doc.title}</h1>
          <p className="pagesub" style={{ margin: 0 }}>
            {doc.product} · owner {doc.owner ?? "—"} · updated {new Date(doc.updatedAt).toLocaleDateString()}
            {doc.approvedBy ? ` · approved by ${doc.approvedBy} on ${new Date(doc.approvedAt!).toLocaleDateString()}` : ""}
            {doc.lastEditedBy ? ` · last edited by ${doc.lastEditedBy}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`pill ${m.cls}`}>{m.label}</span>
          <button className="btn btn-sm" onClick={copyMarkdown} disabled={busy}>
            <i className="fa-solid fa-copy" /> Copy as Markdown
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {info && <p style={{ color: "var(--teal-dark)", fontWeight: 500, fontSize: 13 }}>{info}</p>}

      {doc.comments.map((c) => (
        <div
          key={c.id}
          style={{ background: "#FCF0DA", borderLeft: "3px solid #8A5A0B", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 13, marginBottom: 10 }}
        >
          <div style={{ fontWeight: 500, marginBottom: 2 }}>
            {c.roleLabel} ({c.who}) · {new Date(c.createdAt).toLocaleDateString()}
          </div>
          {c.body}
        </div>
      ))}

      <div className="card" style={{ marginTop: 14 }}>
        {doc.status === "draft" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => navigate(`/pmm/${id}/edit`)}>
              <i className="fa-solid fa-pen" /> Continue editing
            </button>
            {(isOwner || me?.role === "admin") && (
              <button className="btn btn-danger" onClick={deleteDraft} disabled={busy}>
                <i className="fa-solid fa-trash" /> Delete draft
              </button>
            )}
          </div>
        )}
        {doc.status === "pending" && (
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>Director review</div>
            <textarea
              placeholder="Add a comment (required if requesting changes)..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              style={{ minHeight: 70 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => navigate(`/pmm/${id}`)} disabled>
                <i className="fa-solid fa-hourglass-half" /> Awaiting review
              </button>
              <button
                className="btn btn-danger"
                onClick={requestChanges}
                disabled={busy || reviewComment.trim() === ""}
                title={reviewComment.trim() === "" ? "Add a comment describing what needs to change" : "Send back for changes"}
              >
                <i className="fa-solid fa-rotate-left" /> Request changes
              </button>
              <button className="btn btn-primary" onClick={approve} disabled={busy}>
                <i className="fa-solid fa-check" /> Approve
              </button>
            </div>
          </div>
        )}
        {doc.status === "changes" && (
          <button className="btn btn-primary" onClick={() => navigate(`/pmm/${id}/edit`)}>
            <i className="fa-solid fa-pen" /> Revise &amp; resubmit
          </button>
        )}
        {doc.status === "approved" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn" onClick={() => navigate(`/pmm/${id}/edit`)}>
              <i className="fa-solid fa-pen" /> Edit document
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Approved content is live in the knowledge base — edits update it on the next approval.
            </span>
          </div>
        )}
      </div>

      <div className="prose" style={{ marginTop: 16 }} dangerouslySetInnerHTML={{ __html: doc.renderedHtml }} />

      {doc.files.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500 }}>Reference files</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {doc.files.map((f) => (
              <span key={f.id} className="filechip">
                <i className="fa-solid fa-file" /> {f.filename}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
