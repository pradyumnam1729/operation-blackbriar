import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiPost, getProducts, Product } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { FoundationQuestionnaire } from "./FoundationQuestionnaire";
import { FinalAssetsTab } from "../components/workspace/FinalAssetsTab";
import { InProgressTab } from "../components/workspace/InProgressTab";
import { ReferenceDocsTab } from "../components/workspace/ReferenceDocsTab";

// PMM Workspace — the single tabbed home for finalized assets, work in
// progress, reference documents, and the positioning pipeline (blueprint
// workspace-tabs §3). Tabs and sub-tabs are URL state (?tab=&sub=) —
// linkable, refresh-safe, back/forward-safe. ?tab=questionnaire is
// load-bearing (the /pmm and /questionnaire redirects) and preserved.

type TabKey = "finalized" | "in-progress" | "reference" | "questionnaire";

interface SubDef {
  key: string;
  label: string;
  /** Noun phrase for type-specific empty states ("datasheets", "FAQs", …). */
  noun?: string;
}

const FINAL_SUBS: SubDef[] = [
  { key: "all", label: "All" },
  { key: "datasheet", label: "Datasheets", noun: "datasheets" },
  { key: "deck", label: "Decks", noun: "decks" },
  { key: "one-pager", label: "One-pagers", noun: "one-pagers" },
  { key: "faq", label: "FAQs", noun: "FAQs" },
  { key: "brochure", label: "Brochures", noun: "brochures" },
  { key: "battlecard", label: "Battlecards", noun: "battlecards" },
  { key: "banner", label: "Banners", noun: "banners" },
  { key: "email", label: "Emails", noun: "emails" },
  { key: "other", label: "Other", noun: "other assets" },
  { key: "messaging", label: "Messaging documents" },
];

const PROGRESS_SUBS: SubDef[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "review", label: "In review" },
  { key: "archived", label: "Archived" },
];

const REFERENCE_SUBS: SubDef[] = [
  { key: "all", label: "All" },
  { key: "transcript", label: "Transcripts" },
  { key: "prd", label: "PRDs" },
  { key: "release_note", label: "Release notes" },
  { key: "jtbd", label: "JTBDs" },
  { key: "battlecard", label: "Battlecards" },
  { key: "other", label: "Other" },
  { key: "exemplars", label: "Exemplar library" },
];

const SUBS: Record<TabKey, SubDef[]> = {
  finalized: FINAL_SUBS,
  "in-progress": PROGRESS_SUBS,
  reference: REFERENCE_SUBS,
  questionnaire: [],
};

const ASSET_TYPES = ["one-pager", "datasheet", "deck", "faq", "battlecard", "email", "other"];

export function ArtifactLibrary() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const admin = me?.role === "admin";

  // Unknown/illegal tab or sub falls back to defaults — no crash, no redirect
  // loop. The questionnaire tab is admin-only; others fall back to finalized.
  const rawTab = searchParams.get("tab") ?? "finalized";
  const tab: TabKey =
    rawTab === "in-progress" || rawTab === "reference"
      ? rawTab
      : rawTab === "questionnaire" && admin
        ? "questionnaire"
        : "finalized";
  const subs = SUBS[tab];
  const rawSub = searchParams.get("sub") ?? "all";
  const sub = subs.some((s) => s.key === rawSub) ? rawSub : "all";
  const subDef = subs.find((s) => s.key === sub);

  // Changing tab resets sub to "all" (the sub param is simply dropped). Top-tab
  // changes push history so Back steps through tabs; sub-tab changes replace.
  const setTab = (t: TabKey) => setSearchParams({ tab: t });
  const setSub = (s: string) => setSearchParams({ tab, sub: s }, { replace: true });

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");

  // Artifact text filter — seeded from ?q= (topbar search deep link) and
  // shared across the finalized + in-progress artifact tables, so switching
  // tabs keeps the narrowing. Reference/messaging tables keep their own.
  const [artifactFilter, setArtifactFilter] = useState(searchParams.get("q") ?? "");
  useEffect(() => {
    const incoming = searchParams.get("q");
    if (incoming !== null) setArtifactFilter(incoming);
  }, [searchParams]);

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  // create form (admin, In progress tab)
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newType, setNewType] = useState("one-pager");
  const [newPersona, setNewPersona] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "finalized", label: "Finalized assets", icon: "fa-circle-check" },
    {
      key: "in-progress",
      label: admin ? "In progress" : "My drafts",
      icon: "fa-pen-to-square",
    },
    { key: "reference", label: "Reference documents", icon: "fa-book" },
    ...(admin
      ? [{ key: "questionnaire" as TabKey, label: "Positioning & messaging", icon: "fa-file-signature" }]
      : []),
  ];

  const showProductFilter =
    (tab === "finalized" && sub !== "messaging") || tab === "in-progress";

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="pagetitle">{admin ? "PMM Workspace" : "Asset library"}</h1>
          <p className="pagesub">
            {admin
              ? "Finalized assets, work in progress, reference documents, and the positioning pipeline — one tabbed workspace."
              : "Finalized assets, your drafts, and the reference documents behind them."}
          </p>
        </div>
        {admin && tab === "in-progress" && (
          <button
            className={showCreate ? "btn" : "btn btn-primary"}
            onClick={() => setShowCreate((s) => !s)}
          >
            <i className={`fa-solid ${showCreate ? "fa-xmark" : "fa-plus"}`} />
            {showCreate ? "Cancel" : "New artifact"}
          </button>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Workspace sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            <i className={`fa-solid ${t.icon}`} style={{ marginRight: 7 }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "questionnaire" && admin ? (
        <FoundationQuestionnaire embedded />
      ) : (
        <>
          <div className="step-pills" role="tablist" aria-label="Filter by category">
            {subs.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={sub === s.key}
                className={sub === s.key ? "step-pill active" : "step-pill"}
                onClick={() => setSub(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {admin && tab === "in-progress" && showCreate && (
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

          {showProductFilter && (
            <div style={{ marginBottom: 12 }}>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                aria-label="Filter by product"
              >
                <option value="">All products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tab === "finalized" && (
            <FinalAssetsTab
              sub={sub}
              subNoun={subDef?.noun ?? "assets"}
              productId={productId}
              admin={admin}
              filterValue={artifactFilter}
              onFilterChange={setArtifactFilter}
            />
          )}
          {tab === "in-progress" && (
            <InProgressTab
              sub={sub}
              productId={productId}
              admin={admin}
              filterValue={artifactFilter}
              onFilterChange={setArtifactFilter}
            />
          )}
          {tab === "reference" && <ReferenceDocsTab sub={sub} admin={admin} />}
        </>
      )}
    </div>
  );
}
