import { useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, getProducts, Product } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// Feature Catalog: the living record of what each product module ships.
// Reading is open to all roles; processing, review, and edits are PMM-only.

interface Feature {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  category: string | null;
  release_date: string | null;
  release_note_id: string | null;
  source_url: string | null;
  status: "active" | "changed" | "deprecated";
}

interface NoteSummary {
  id: string;
  filename: string;
  processed_at: string | null;
  created_at: string;
  added: string[];
  changed: string[];
  deprecated: string[];
  pending_reviews: number;
}

interface ReviewRow {
  id: string;
  product_id: string;
  proposed: Record<string, unknown>;
  change_type: "added" | "changed" | "deprecated";
  confidence: number;
  status: string;
  created_at: string;
  products?: { name: string } | null;
  release_notes?: { filename: string } | null;
}

interface ProcessResult {
  applied: number;
  queued: number;
  ai_unavailable: boolean;
}

const STATUS_PILL: Record<Feature["status"], { cls: string; label: string }> = {
  active: { cls: "pill-live", label: "Live" },
  changed: { cls: "pill-changed", label: "Changed" },
  deprecated: { cls: "pill-deprecated", label: "Deprecated" },
};

const CHANGE_PILL: Record<ReviewRow["change_type"], string> = {
  added: "pill-added",
  changed: "pill-changed",
  deprecated: "pill-deprecated",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Seeded rows carry placeholder example.com URLs — those are dead destinations, not sources. */
function hasRealSource(url: string | null): url is string {
  return !!url && !url.toLowerCase().includes("example.com");
}

const PROPOSED_FIELDS: [string, string][] = [
  ["name", "Name"],
  ["description", "Description"],
  ["category", "Category"],
  ["release_date", "Release date"],
  ["note", "Note"],
  ["filename", "Filename"],
  ["raw_text_snippet", "Raw text (snippet)"],
];

export function FeatureCatalog() {
  const { me } = useAuth();
  const isAdmin = me?.role === "admin";

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Process form (admin)
  const [procProduct, setProcProduct] = useState("");
  const [procFilename, setProcFilename] = useState("");
  const [procText, setProcText] = useState("");
  const [procResult, setProcResult] = useState<ProcessResult | null>(null);

  // Release-note deep link: scroll to + flash the matching note entry (or the card).
  const notesCardRef = useRef<HTMLDivElement | null>(null);
  const noteRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashNoteId, setFlashNoteId] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);

  const goToNote = (releaseNoteId: string | null) => {
    const el = (releaseNoteId && noteRefs.current[releaseNoteId]) || notesCardRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashNoteId(releaseNoteId ?? "__card__");
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashNoteId(null), 1800);
  };

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  // Manual add form (admin)
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    product_id: "",
    name: "",
    description: "",
    category: "",
    release_date: "",
    source_url: "",
  });

  const loadCatalog = useCallback(async (pid: string) => {
    if (!pid) return;
    try {
      const [f, n] = await Promise.all([
        apiGet<{ features: Feature[] }>(`/api/features?product_id=${pid}`),
        apiGet<{ notes: NoteSummary[] }>(`/api/features/release-notes?product_id=${pid}`),
      ]);
      setFeatures(f.features);
      setNotes(n.notes);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await apiGet<{ reviews: ReviewRow[] }>("/api/features/reviews?status=pending");
      setReviews(r.reviews);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [isAdmin]);

  useEffect(() => {
    getProducts()
      .then((p) => {
        setProducts(p);
        if (p.length > 0) {
          setProductId(p[0].id);
          setProcProduct(p[0].id);
          setAddForm((f) => ({ ...f, product_id: p[0].id }));
        }
      })
      .catch((e) => setError((e as Error).message));
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    void loadCatalog(productId);
  }, [productId, loadCatalog]);

  const refreshAll = async () => {
    await Promise.all([loadCatalog(productId), loadReviews()]);
  };

  const processNote = async () => {
    setBusy(true);
    setError("");
    setProcResult(null);
    try {
      const r = await apiPost<ProcessResult>("/api/features/process", {
        product_id: procProduct,
        filename: procFilename.trim() || "pasted-release-note.txt",
        raw_text: procText,
      });
      setProcResult(r);
      setProcText("");
      setProcFilename("");
      await refreshAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decideReview = async (id: string, decision: "approve" | "reject") => {
    setBusy(true);
    setError("");
    try {
      await apiPost(`/api/features/reviews/${id}/${decision}`);
      await refreshAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addFeature = async () => {
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/features", {
        product_id: addForm.product_id,
        name: addForm.name,
        description: addForm.description || undefined,
        category: addForm.category || undefined,
        release_date: addForm.release_date || undefined,
        source_url: addForm.source_url || undefined,
      });
      setAddForm((f) => ({ ...f, name: "", description: "", category: "", release_date: "", source_url: "" }));
      setShowAdd(false);
      await loadCatalog(productId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeFeature = async (id: string, name: string) => {
    if (!window.confirm(`Delete feature "${name}" from the catalog?`)) return;
    setBusy(true);
    setError("");
    try {
      await apiDelete(`/api/features/${id}`);
      await loadCatalog(productId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const productName = products.find((p) => p.id === productId)?.name ?? "";
  const latestNote = notes.length > 0 ? notes[0] : null;

  return (
    <div>
      <h1 className="pagetitle">Product feature catalog</h1>
      <p className="pagesub">
        What each module ships, when it shipped, and what changed — kept current from processed
        release notes across the product life cycle.
      </p>

      {error && <p style={{ color: "var(--red)" }}>{error}</p>}

      {/* ---------- product picker + diff banner ---------- */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {productName ? `${productName} · ${features.length} feature${features.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        <div
          className="row-between"
          style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: "12px 16px" }}
        >
          {latestNote ? (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="pill pill-added">
                  <i className="fa-solid fa-plus" style={{ fontSize: 9 }} /> {latestNote.added.length} added
                </span>
                <span className="pill pill-changed">
                  <i className="fa-solid fa-pen" style={{ fontSize: 9 }} /> {latestNote.changed.length} changed
                </span>
                <span className="pill pill-deprecated">
                  <i className="fa-solid fa-minus" style={{ fontSize: 9 }} /> {latestNote.deprecated.length} deprecated
                </span>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                since last release note processed
              </span>
            </>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              No release notes processed for this product yet.
            </span>
          )}
        </div>
      </div>

      {/* ---------- feature grid ---------- */}
      {features.length === 0 ? (
        <p className="empty-note">No features recorded for this product yet.</p>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          {features.map((f) => (
            <div key={f.id} className="feature-card">
              <div className="top">
                <h4>{f.name}</h4>
                <span className={`pill ${STATUS_PILL[f.status].cls}`}>{STATUS_PILL[f.status].label}</span>
              </div>
              {f.description && <p>{f.description}</p>}
              <div className="meta">
                <span>
                  {f.category ?? "Uncategorized"} · {fmtDate(f.release_date)}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  {hasRealSource(f.source_url) ? (
                    <a href={f.source_url} target="_blank" rel="noopener noreferrer">
                      <i className="fa-solid fa-arrow-up-right-from-square" /> Source
                    </a>
                  ) : f.release_note_id ? (
                    <a
                      role="button"
                      tabIndex={0}
                      title="Jump to the release note below"
                      style={{ cursor: "pointer" }}
                      onClick={() => goToNote(f.release_note_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") goToNote(f.release_note_id);
                      }}
                    >
                      <i className="fa-solid fa-file-lines" /> Release note
                    </a>
                  ) : null}
                  {isAdmin && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => removeFeature(f.id, f.name)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- release notes ---------- */}
      <div
        className="card"
        ref={notesCardRef}
        style={
          flashNoteId === "__card__"
            ? { outline: "2px solid var(--teal-light)", transition: "outline 0.2s ease" }
            : undefined
        }
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Release notes</h3>
        {notes.length === 0 && (
          <p className="empty-note">
            No release notes ingested for this product yet. Notes arrive from the watched SharePoint
            stand-in folders or from a manual paste below.
          </p>
        )}
        {notes.map((n, idx) => (
          <div
            key={n.id}
            ref={(el) => {
              noteRefs.current[n.id] = el;
            }}
            style={{
              borderBottom: idx === notes.length - 1 ? "none" : "1px solid var(--border)",
              padding: "12px 0",
              ...(flashNoteId === n.id
                ? {
                    background: "#F2FAFB",
                    outline: "2px solid var(--teal-light)",
                    borderRadius: "var(--r-md)",
                    transition: "background 0.2s ease",
                  }
                : {}),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <strong style={{ fontSize: 13.5 }}>{n.filename}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {n.processed_at ? `processed ${fmtDate(n.processed_at)}` : "not processed yet"}
              </span>
              {n.pending_reviews > 0 && (
                <span className="pill pill-review">
                  {n.pending_reviews} pending review{n.pending_reviews > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, fontSize: 12.5 }}>
              <div>
                <span className="pill pill-added" style={{ marginRight: 8 }}>
                  <i className="fa-solid fa-plus" style={{ fontSize: 9 }} /> Added ({n.added.length})
                </span>
                {n.added.length > 0 ? n.added.join(", ") : "none"}
              </div>
              <div>
                <span className="pill pill-changed" style={{ marginRight: 8 }}>
                  <i className="fa-solid fa-pen" style={{ fontSize: 9 }} /> Changed ({n.changed.length})
                </span>
                {n.changed.length > 0 ? n.changed.join(", ") : "none"}
              </div>
              <div>
                <span className="pill pill-deprecated" style={{ marginRight: 8 }}>
                  <i className="fa-solid fa-minus" style={{ fontSize: 9 }} /> Deprecated ({n.deprecated.length})
                </span>
                {n.deprecated.length > 0 ? n.deprecated.join(", ") : "none"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- admin: review queue ---------- */}
      {isAdmin && (
        <>
          <h3 className="section-label">Feature-extraction review queue</h3>
          <p className="pagesub">
            Extracted changes below the confidence bar — and whole notes when AI extraction is
            unavailable — wait here for a PMM decision before touching the catalog.
          </p>
          {reviews.length === 0 && <p className="empty-note">Nothing pending. The catalog is current.</p>}
          {reviews.length > 0 && (
            <div className="grid grid-2" style={{ marginBottom: 18 }}>
              {reviews.map((r) => (
                <div key={r.id} className="card" style={{ marginBottom: 0 }}>
                  <div className="row-between">
                    <h4 style={{ margin: 0, fontSize: 14 }}>
                      {r.products?.name ?? "Unknown product"}{" "}
                      <span className={`pill ${CHANGE_PILL[r.change_type]}`} style={{ marginLeft: 6 }}>
                        {r.change_type}
                      </span>
                    </h4>
                    <span className="pill pill-pending">
                      Confidence: {Math.round(Number(r.confidence) * 100)}%
                    </span>
                  </div>
                  {r.release_notes?.filename && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
                      from {r.release_notes.filename}
                    </p>
                  )}
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "10px 0 14px" }}>
                    {PROPOSED_FIELDS.filter(
                      ([key]) => typeof r.proposed[key] === "string" && r.proposed[key] !== ""
                    ).map(([key, label]) => (
                      <div key={key} style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{label}: </span>
                        <span style={{ whiteSpace: "pre-wrap" }}>
                          {String(r.proposed[key]).slice(0, 600)}
                          {String(r.proposed[key]).length > 600 ? "…" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => decideReview(r.id, "approve")}
                      disabled={busy}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => decideReview(r.id, "reject")}
                      disabled={busy}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------- admin: process release note ---------- */}
      {isAdmin && (
        <div className="card">
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 500 }}>Process a release note</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>
            Paste raw release note text. High-confidence extractions apply to the catalog directly;
            everything else lands in the review queue. If AI extraction is unavailable, the whole
            note is queued for manual review — nothing is lost.
          </p>
          <label>Product</label>
          <select value={procProduct} onChange={(e) => setProcProduct(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label>Filename</label>
          <input
            value={procFilename}
            onChange={(e) => setProcFilename(e.target.value)}
            placeholder="e.g. masterworks-plan-2026-07-release-notes.md"
          />
          <label>Release note text</label>
          <textarea
            value={procText}
            onChange={(e) => setProcText(e.target.value)}
            style={{ minHeight: 160 }}
            placeholder="Paste the full release note text here…"
          />
          <p>
            <button
              className="btn btn-primary"
              onClick={processNote}
              disabled={busy || procText.trim() === "" || !procProduct}
              title={
                busy
                  ? "Working…"
                  : !procProduct
                    ? "Pick a product first"
                    : procText.trim() === ""
                      ? "Paste the release note text first"
                      : "Process this release note"
              }
            >
              <i className="fa-solid fa-wand-magic-sparkles" /> {busy ? "Processing…" : "Process"}
            </button>
          </p>
          {procResult && (
            <pre className="answer">
              {`Applied directly to catalog: ${procResult.applied}\nQueued for review: ${procResult.queued}` +
                (procResult.ai_unavailable
                  ? "\n\nAI extraction was unavailable (no API credits or model error), so the note was queued for manual review. Open the review queue above to work it by hand."
                  : "")}
            </pre>
          )}
        </div>
      )}

      {/* ---------- admin: manual add ---------- */}
      {isAdmin && (
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Add feature manually</h3>
          {!showAdd && (
            <p style={{ margin: 0 }}>
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <i className="fa-solid fa-plus" /> Add a feature
              </button>
            </p>
          )}
          {showAdd && (
            <div>
              <label>Product</label>
              <select
                value={addForm.product_id}
                onChange={(e) => setAddForm((f) => ({ ...f, product_id: e.target.value }))}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <label>Name</label>
              <input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Grant Milestone Tracking"
              />
              <label>Description</label>
              <textarea
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="One buyer-readable sentence on what it does."
              />
              <label>Category</label>
              <input
                value={addForm.category}
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Funding"
              />
              <label>Release date</label>
              <input
                type="date"
                value={addForm.release_date}
                onChange={(e) => setAddForm((f) => ({ ...f, release_date: e.target.value }))}
              />
              <label>Source URL</label>
              <input
                value={addForm.source_url}
                onChange={(e) => setAddForm((f) => ({ ...f, source_url: e.target.value }))}
                placeholder="Link to the release note (optional)"
              />
              <p style={{ display: "flex", gap: 8, marginBottom: 0 }}>
                <button
                  className="btn btn-primary"
                  onClick={addFeature}
                  disabled={busy || addForm.name.trim() === "" || !addForm.product_id}
                  title={
                    busy
                      ? "Working…"
                      : !addForm.product_id
                        ? "Pick a product first"
                        : addForm.name.trim() === ""
                          ? "Give the feature a name first"
                          : "Save this feature"
                  }
                >
                  <i className="fa-solid fa-check" /> {busy ? "Saving…" : "Save feature"}
                </button>
                <button className="btn" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
