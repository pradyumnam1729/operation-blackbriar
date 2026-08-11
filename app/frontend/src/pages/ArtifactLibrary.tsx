import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPost, getProducts, Product } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { FoundationQuestionnaire } from "./FoundationQuestionnaire";

export type ArtifactStatus = "draft" | "in_review" | "final" | "archived";

export interface ArtifactListItem {
  id: string;
  title: string;
  asset_type: string;
  product_id: string | null;
  product_name: string | null;
  persona: string | null;
  status: ArtifactStatus;
  current_version: number;
  created_by: string | null;
  updated_at: string;
}

const ASSET_TYPES = ["one-pager", "datasheet", "deck", "faq", "battlecard", "email", "other"];
const STATUS_LABELS: Record<ArtifactStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  final: "Final",
  archived: "Archived",
};

const STATUS_PILL: Record<ArtifactStatus, string> = {
  draft: "pill-draft",
  in_review: "pill-review",
  final: "pill-final",
  archived: "pill-archived",
};

const TYPE_ICON: Record<string, string> = {
  "one-pager": "fa-file-lines",
  datasheet: "fa-file-invoice",
  deck: "fa-display",
  faq: "fa-circle-question",
  battlecard: "fa-shield-halved",
  email: "fa-envelope",
  other: "fa-file",
};

export function ArtifactLibrary() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const admin = me?.role === "admin";

  // Page-level view: the versioned asset repository (all roles) or the
  // Foundation questionnaire pipeline (admin only). ?tab=questionnaire
  // deep-links straight to the questionnaire (used by /questionnaire and
  // /pmm redirects).
  const [view, setView] = useState<"assets" | "questionnaire">(
    searchParams.get("tab") === "questionnaire" ? "questionnaire" : "assets"
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters — the title search is seeded from ?q= (topbar search deep link)
  const [productId, setProductId] = useState("");
  const [assetType, setAssetType] = useState("");
  const [status, setStatus] = useState("");
  const [persona, setPersona] = useState("");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [mine, setMine] = useState(false);

  // Follow-up topbar searches while already on /library update the filter too
  // (and land on the assets view, where the search applies).
  useEffect(() => {
    const incoming = searchParams.get("q");
    if (incoming !== null) {
      setQ(incoming);
      setView("assets");
    }
    if (searchParams.get("tab") === "questionnaire") setView("questionnaire");
  }, [searchParams]);

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newType, setNewType] = useState("one-pager");
  const [newPersona, setNewPersona] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (productId) params.set("product_id", productId);
      if (assetType) params.set("asset_type", assetType);
      if (admin && status) params.set("status", status);
      if (persona.trim()) params.set("persona", persona.trim());
      if (q.trim()) params.set("q", q.trim());
      if (mine) params.set("mine", "1");
      setLoading(true);
      setError(null);
      apiGet<{ artifacts: ArtifactListItem[] }>(`/api/artifacts?${params.toString()}`)
        .then((r) => setArtifacts(r.artifacts))
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [productId, assetType, status, persona, q, mine, admin]);

  const create = async () => {
    if (!newTitle.trim()) {
      setCreateError("Title is required");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const r = await apiPost<{ artifact: { id: string } }>("/api/artifacts", {
        title: newTitle.trim(),
        asset_type: newType,
        product_id: newProductId || undefined,
        persona: newPersona.trim() || undefined,
      });
      navigate(`/library/${r.artifact.id}`);
    } catch (e) {
      setCreateError((e as Error).message);
      setCreating(false);
    }
  };

  const showQuestionnaire = admin && view === "questionnaire";

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="pagetitle">
            PMM Workspace{" "}
            {admin && (
              <span className="pill pill-lock" style={{ marginLeft: 6 }}>
                <i className="fa-solid fa-lock" style={{ fontSize: 9 }} /> Admin only
              </span>
            )}
          </h1>
          {!showQuestionnaire && (
            <p className="pagesub">Every finished asset, versioned. Non-admins see final only.</p>
          )}
        </div>
        {!showQuestionnaire && (
          <button
            className={showCreate ? "btn" : "btn btn-primary"}
            onClick={() => setShowCreate((s) => !s)}
          >
            <i className={`fa-solid ${showCreate ? "fa-xmark" : "fa-plus"}`} />
            {showCreate ? "Cancel" : "New artifact"}
          </button>
        )}
      </div>

      {admin && (
        <div className="tab-row" style={{ margin: "10px 0 16px" }}>
          <button className={view === "assets" ? "active" : ""} onClick={() => setView("assets")}>
            <i className="fa-solid fa-box-archive" style={{ marginRight: 6 }} /> Asset workspace
          </button>
          <button
            className={view === "questionnaire" ? "active" : ""}
            onClick={() => setView("questionnaire")}
          >
            <i className="fa-solid fa-file-signature" style={{ marginRight: 6 }} /> Positioning &amp;
            messaging
          </button>
        </div>
      )}

      {showQuestionnaire ? (
        <FoundationQuestionnaire embedded />
      ) : (
      <>
      {showCreate && (
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>New artifact</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ marginTop: 0 }}>Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Masterworks Build One-Pager"
              />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>Product</label>
              <select value={newProductId} onChange={(e) => setNewProductId(e.target.value)}>
                <option value="">— none —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ marginTop: 0 }}>Asset type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ marginTop: 0 }}>Persona</label>
              <input
                value={newPersona}
                onChange={(e) => setNewPersona(e.target.value)}
                placeholder="e.g. Program Director"
              />
            </div>
          </div>
          {createError && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "#FCE8E8",
                borderRadius: "var(--r-md)",
                color: "#A32D2D",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {createError}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={create} disabled={creating}>
              <i className="fa-solid fa-plus" />
              {creating ? "Creating…" : "Create draft"}
            </button>
          </div>
        </div>
      )}

      <div className="row-between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={assetType} onChange={(e) => setAssetType(e.target.value)}>
            <option value="">All types</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {admin && (
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {(Object.keys(STATUS_LABELS) as ArtifactStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          <input
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="Persona"
            style={{ width: 150, borderRadius: "var(--r-pill)", padding: "8px 16px", fontSize: 13 }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles"
            style={{ width: 200, borderRadius: "var(--r-pill)", padding: "8px 16px", fontSize: 13 }}
          />
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            margin: 0,
            whiteSpace: "nowrap",
            fontWeight: 400,
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
            style={{ width: "auto" }}
          />
          My artifacts
        </label>
      </div>

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

      {loading ? (
        <div className="empty-note">Loading artifacts…</div>
      ) : artifacts.length === 0 ? (
        <div className="empty-note">
          No artifacts match these filters.
          {!admin && !mine && " Only finalized artifacts appear here — check “My artifacts” for your drafts."}
        </div>
      ) : (
        <div className="grid grid-3">
          {artifacts.map((a) => (
            <div
              key={a.id}
              className="asset-card"
              onClick={() => navigate(`/library/${a.id}`)}
              style={{
                cursor: "pointer",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: 16,
                background: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                boxShadow: "var(--shadow-1)",
              }}
            >
              <div
                className="thumb2"
                style={{
                  height: 70,
                  borderRadius: "var(--r-sm)",
                  background: "var(--bg-page)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: 20,
                }}
              >
                <i className={`fa-solid ${TYPE_ICON[a.asset_type] ?? "fa-file"}`} />
              </div>
              <div className="row-between">
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{a.title}</h4>
                <span className={`pill ${STATUS_PILL[a.status]}`}>{STATUS_LABELS[a.status]}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {a.asset_type}
                {a.product_name ? ` · ${a.product_name}` : ""}
                {a.persona ? ` · ${a.persona}` : ""}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                v{a.current_version} · {a.current_version} version{a.current_version === 1 ? "" : "s"} ·
                updated {new Date(a.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
