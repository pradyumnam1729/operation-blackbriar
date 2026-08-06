import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

// PMM Workspace — Positioning & Messaging document list with status tabs and
// the new-document setup (product + title), per hive 1.html.

interface PmmDocRow {
  id: string;
  title: string;
  product: string;
  status: "draft" | "pending" | "changes" | "approved";
  updatedAt: string;
  owner: string | null;
  progress: { answered: number; total: number };
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "pill-draft" },
  pending: { label: "Pending approval", cls: "pill-pending" },
  changes: { label: "Changes requested", cls: "pill-deprecated" },
  approved: { label: "Approved", cls: "pill-final" },
};

const TABS = [
  ["", "All"],
  ["draft", "Draft"],
  ["pending", "Pending approval"],
  ["changes", "Changes requested"],
  ["approved", "Approved"],
] as const;

export function PMMWorkspace() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<PmmDocRow[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newProduct, setNewProduct] = useState("Masterworks");
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ docs: PmmDocRow[] }>(
        `/api/pmm${filter ? `?status=${filter}` : ""}`
      );
      setDocs(r.docs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDoc = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await apiPost<{ id: string }>("/api/pmm", {
        title: newTitle.trim() || `${newProduct} — Positioning & Messaging`,
        product: newProduct,
      });
      navigate(`/pmm/${r.id}/edit`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="pagetitle">
            PMM Workspace{" "}
            <span className="pill pill-lock" style={{ marginLeft: 6 }}>
              <i className="fa-solid fa-lock" style={{ fontSize: 9 }} /> Admin only
            </span>
          </h1>
          <p className="pagesub">
            Build Positioning &amp; Messaging documents — answer the standard question set, attach
            source material, send for Director review.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>
          <i className="fa-solid fa-plus" /> New document
        </button>
      </div>

      {error && (
        <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {showNew && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>New Positioning &amp; Messaging document</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
            Answer the standard question set below, section by section. You can save as a draft and
            come back any time.
          </p>
          <label style={{ marginTop: 0 }}>Which product is this for?</label>
          <div className="step-pills">
            {["Masterworks", "Essentials", "Primus", "Lumina"].map((p) => (
              <button
                key={p}
                className={`step-pill ${newProduct === p ? "active" : ""}`}
                onClick={() => setNewProduct(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <label>Document title</label>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`${newProduct} — Positioning & Messaging`}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 18, width: "100%", justifyContent: "center" }}
            onClick={createDoc}
            disabled={busy}
          >
            Start <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      )}

      <div className="tab-row" style={{ marginTop: 14 }}>
        {TABS.map(([value, label]) => (
          <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {docs.map((d) => {
          const m = STATUS_META[d.status];
          return (
            <div
              key={d.id}
              className="card rowhover"
              style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 0, cursor: "pointer", padding: "14px 18px" }}
              onClick={() => navigate(`/pmm/${d.id}`)}
            >
              <div style={{ width: 38, height: 38, borderRadius: "var(--r-sm)", background: "#E1F0F2", color: "var(--teal-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="fa-solid fa-file-signature" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{d.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                  {d.product} · {d.owner ?? "—"} · updated {new Date(d.updatedAt).toLocaleDateString()} ·{" "}
                  {d.progress.answered}/{d.progress.total} sections
                </div>
              </div>
              <span className={`pill ${m.cls}`}>{m.label}</span>
              <i className="fa-solid fa-chevron-right" style={{ color: "var(--text-muted)" }} />
            </div>
          );
        })}
        {docs.length === 0 && <div className="empty-note">No documents in this status yet.</div>}
      </div>
    </div>
  );
}
