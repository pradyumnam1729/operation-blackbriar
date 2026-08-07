import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  apiGet,
  apiPost,
  ApiError,
  generateFromTemplate,
  getProducts,
  listTemplates,
  Product,
  RenderWarning,
  TemplateSummary,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { ReferenceLibrary } from "../components/ReferenceLibrary";

// Asset Studio: pick an asset type → pick a template → generate a draft
// artifact and open it in the editor. Slot-driven templates (Template Library)
// fill their slots from the product's approved messaging document — no prompt
// needed; legacy mock templates keep the prompt-library path.

interface PromptEntry {
  id: string;
  name: string;
  asset_type: string;
  body: string;
}

interface GenerateResponse {
  artifactId: string;
  guard: { ok: boolean; violations: string[] };
  degraded?: boolean;
  warnings?: RenderWarning[];
  messagingDocVersion?: number;
}

const ASSET_TYPES: { key: string; label: string; desc: string }[] = [
  { key: "datasheet", label: "Datasheet", desc: "One-page product overview with outcome-led capabilities and proof." },
  { key: "deck", label: "Sales Deck", desc: "Slide outline on the 7-step narrative arc with speaker notes." },
  { key: "faq", label: "FAQ", desc: "Customer-facing questions and direct answers from the objection library." },
  { key: "one-pager", label: "One-Pager", desc: "Executive summary: outcomes, the decision, and proof per claim." },
  { key: "brochure", label: "Brochure", desc: "Multi-page print story: cover, narrative, capabilities, proof, and CTA." },
  { key: "battlecard", label: "Battlecard", desc: "Internal objection handling: why we win, counters, and trap-to-set questions." },
  { key: "banner", label: "Banner", desc: "1200×628 social/display graphic with headline and CTA text." },
];

interface FinalAsset {
  id: string;
  title: string;
  asset_type: string;
  product_name: string | null;
  persona: string | null;
  status: string;
  current_version: number;
  updated_at: string;
}

const FINAL_TYPE_ICON: Record<string, string> = {
  "one-pager": "fa-file-lines",
  datasheet: "fa-file-invoice",
  deck: "fa-display",
  faq: "fa-circle-question",
  brochure: "fa-book-open",
  battlecard: "fa-shield-halved",
  banner: "fa-image",
  email: "fa-envelope",
  other: "fa-file",
};

export function Studio() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const admin = me?.role === "admin";

  // Non-admins only see finalized content — generation is PMM-only. Admins
  // get a Create tab and the same finalized gallery.
  const [view, setView] = useState<"create" | "finalized">(admin ? "create" : "finalized");
  const [finals, setFinals] = useState<FinalAsset[]>([]);
  const [finalsLoading, setFinalsLoading] = useState(false);

  useEffect(() => {
    if (view !== "finalized") return;
    setFinalsLoading(true);
    // Non-admin artifact listing is already final-only server-side; admins
    // filter explicitly so drafts stay out of the gallery.
    apiGet<{ artifacts: FinalAsset[] }>(`/api/artifacts${admin ? "?status=final" : ""}`)
      .then((r) => setFinals(r.artifacts.filter((a) => a.status === "final")))
      .catch(() => setFinals([]))
      .finally(() => setFinalsLoading(false));
  }, [view, admin]);

  const [step, setStep] = useState(1);
  const [assetType, setAssetType] = useState("");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [promptId, setPromptId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [title, setTitle] = useState("");
  const [extraBrief, setExtraBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gate409, setGate409] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  // Slot-driven = the template carries a layout body; text comes from the
  // approved messaging document, so no prompt is needed but a product is.
  const slotDriven = template?.generation_ready === true;

  useEffect(() => {
    getProducts().then(setProducts).catch(() => {});
  }, []);

  const pickType = async (key: string) => {
    setAssetType(key);
    setTemplate(null);
    setPromptId("");
    setResult(null);
    setError("");
    setGate409(null);
    try {
      const [t, p] = await Promise.all([
        listTemplates({ asset_type: key }),
        apiGet<{ prompts: PromptEntry[] }>(`/api/studio/prompts?asset_type=${encodeURIComponent(key)}`),
      ]);
      setTemplates(t);
      setPrompts(p.prompts);
      if (p.prompts.length === 1) setPromptId(p.prompts[0].id);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pickTemplate = (t: TemplateSummary) => {
    setTemplate(t);
    setResult(null);
    setGate409(null);
    setStep(3);
  };

  // /studio?template=<id> deep link (Template library's Generate button):
  // preselect the template's asset type and jump straight to the details step.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const tid = searchParams.get("template");
    if (!tid) return;
    void (async () => {
      try {
        const all = await listTemplates();
        const t = all.find((x) => x.id === tid);
        if (!t) return;
        await pickType(t.asset_type);
        setTemplate(t);
        setStep(3);
      } catch {
        // fall back to the normal wizard
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    if (!template || title.trim() === "") return;
    if (template.generation_ready ? productId === "" : promptId === "") return;
    setBusy(true);
    setError("");
    setGate409(null);
    setResult(null);
    try {
      if (template.generation_ready) {
        // Slot-driven path: layout is locked, slots fill from the product's
        // final messaging doc. 409 = no final doc yet (§3.1 gate).
        const r = await generateFromTemplate(template.id, {
          product_id: productId,
          title: title.trim(),
          extra_brief: extraBrief.trim() === "" ? undefined : extraBrief.trim(),
        });
        if (r.guard.ok && r.warnings.length === 0) {
          navigate(`/library/${r.artifactId}`);
          return;
        }
        setResult(r); // warnings or guard violations — surface before opening the editor
        return;
      }
      const r = await apiPost<GenerateResponse>("/api/studio/generate", {
        template_id: template.id,
        prompt_id: promptId,
        product_id: productId === "" ? undefined : productId,
        title: title.trim(),
        extra_brief: extraBrief.trim() === "" ? undefined : extraBrief.trim(),
      });
      if (!r.degraded && r.guard.ok) {
        navigate(`/library/${r.artifactId}`);
        return;
      }
      setResult(r); // degraded or guard violations — surface before opening the editor
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setGate409(e.message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showCreate = admin && view === "create";

  return (
    <div>
      <h1 className="pagetitle">Asset studio</h1>
      <p className="pagesub">
        {showCreate
          ? "Pick a type, a brand template, and a prompt — the draft lands in the library editor."
          : "Finalized assets — system finals from the PMM workspace plus the curated reference library, viewable and exportable to PDF."}
      </p>

      {admin && (
        <div className="tab-row" style={{ margin: "4px 0 16px" }}>
          <button className={view === "create" ? "active" : ""} onClick={() => setView("create")}>
            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6 }} /> Create
          </button>
          <button
            className={view === "finalized" ? "active" : ""}
            onClick={() => setView("finalized")}
          >
            <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} /> Finalized assets
          </button>
        </div>
      )}

      {!showCreate ? (
        <>
          <div className="section-label">System finals</div>
          {finalsLoading ? (
            <div className="empty-note">Loading finalized assets…</div>
          ) : finals.length === 0 ? (
            <div className="empty-note">
              Nothing finalized yet. Assets appear here once a PMM admin saves them as final in the
              PMM workspace.
            </div>
          ) : (
            <div className="grid grid-3">
              {finals.map((a) => (
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
                    <i className={`fa-solid ${FINAL_TYPE_ICON[a.asset_type] ?? "fa-file"}`} />
                  </div>
                  <div className="row-between">
                    <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{a.title}</h4>
                    <span className="pill pill-final">Final</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {a.asset_type}
                    {a.product_name ? ` · ${a.product_name}` : ""}
                    {a.persona ? ` · ${a.persona}` : ""}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    v{a.current_version} · updated {new Date(a.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
          <ReferenceLibrary />
        </>
      ) : (
        <>
      <div className="step-pills">
        {ASSET_TYPES.map((t) => (
          <button
            key={t.key}
            className={assetType === t.key ? "step-pill active" : "step-pill"}
            title={t.desc}
            onClick={() => void pickType(t.key)}
          >
            {t.label}
          </button>
        ))}
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

      {step === 1 && (
        <div className="empty-note">Pick an asset type above to load its brand templates and prompt library.</div>
      )}

      {step >= 2 && (
        <div className="grid grid-2" style={{ alignItems: "start" }}>
          <div>
            <div className="card">
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Brand templates</h3>
              {templates.length === 0 && (
                <div className="empty-note">No approved templates for this asset type yet.</div>
              )}
              <div className="grid grid-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={template?.id === t.id ? "template-card selected" : "template-card"}
                    onClick={() => pickTemplate(t)}
                  >
                    <div
                      className="thumb"
                      style={
                        t.preview_color
                          ? { background: `linear-gradient(135deg, ${t.preview_color}, #CFE8EA)` }
                          : undefined
                      }
                    >
                      <i className="fa-solid fa-file-lines" />
                    </div>
                    <div className="tname">
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {t.name}
                        {t.generation_ready && <span className="pill pill-final">Slot-driven</span>}
                      </div>
                      <div style={{ fontWeight: 400, fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                        {t.product_line ?? "All lines"}
                        {t.format ? ` · ${t.format}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="empty-note" style={{ paddingBottom: 0 }}>
                Slot-driven templates carry a locked layout and fill from the product&rsquo;s approved
                messaging document. Others are mock previews served by the prompt path — browse and
                preview all of them in the Template library.
              </div>
            </div>

            <div className="card">
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Prompt library</h3>
              {slotDriven && (
                <div className="empty-note" style={{ paddingTop: 0 }}>
                  Not needed for a slot-driven template — the text comes from the approved messaging
                  document, not a prompt.
                </div>
              )}
              {prompts.length === 0 && <div className="empty-note">No prompts for this asset type yet.</div>}
              {prompts.map((p) => (
                <div
                  key={p.id}
                  className={promptId === p.id ? "prompt-item selected" : "prompt-item"}
                  onClick={() => setPromptId(p.id)}
                >
                  <div className="t">{p.name}</div>
                  <div className="d">{p.body.length > 220 ? `${p.body.slice(0, 220)}…` : p.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Output preview</h3>
              <span className="pill pill-draft">Draft</span>
            </div>

            {template ? (
              <div
                style={{
                  background: "var(--bg-page)",
                  borderRadius: "var(--r-md)",
                  padding: "10px 14px",
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                  marginBottom: 4,
                }}
              >
                Template: <b style={{ color: "var(--teal-dark)" }}>{template.name}</b>
              </div>
            ) : (
              <div className="empty-note" style={{ paddingTop: 0 }}>
                Select a template on the left to brief the generator.
              </div>
            )}

            <label>Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option
                value=""
                disabled={slotDriven}
                title={
                  slotDriven
                    ? "Slot-driven generation runs from one product's approved messaging document"
                    : undefined
                }
              >
                — whole portfolio —
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {slotDriven && productId === "" && (
              <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
                Slot-driven generation runs from one product&rsquo;s approved messaging document —
                pick a product.
              </p>
            )}

            <label>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Masterworks Build Datasheet — State DOTs"
            />

            <label>Extra brief (optional)</label>
            <textarea
              value={extraBrief}
              onChange={(e) => setExtraBrief(e.target.value)}
              placeholder="Persona, deal context, angles to emphasize…"
            />

            <button
              className="btn"
              style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
              onClick={generate}
              disabled={
                busy ||
                !template ||
                title.trim() === "" ||
                (slotDriven ? productId === "" : promptId === "")
              }
              title={
                busy
                  ? "Generating…"
                  : !template
                    ? "Select a template first"
                    : slotDriven && productId === ""
                      ? "Pick the product whose approved messaging feeds the slots"
                      : !slotDriven && promptId === ""
                        ? "Select a prompt first"
                        : title.trim() === ""
                          ? "Give the draft a title first"
                          : "Generate the draft"
              }
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
              {busy ? "Generating…" : "Generate draft"}
            </button>

            {gate409 && (
              <div
                style={{
                  marginTop: 14,
                  padding: "12px 16px",
                  background: "#FCE8E8",
                  borderRadius: "var(--r-md)",
                  color: "#A32D2D",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {gate409}
                <div style={{ marginTop: 8 }}>
                  <Link to="/questionnaire" style={{ fontWeight: 500, textDecoration: "underline" }}>
                    Open the Foundation Questionnaire
                  </Link>
                </div>
              </div>
            )}

            {result && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>Automated content check</div>
                {result.warnings !== undefined && result.warnings.length > 0 && (
                  <>
                    <div className="check-row">
                      <i className="fa-solid fa-triangle-exclamation" style={{ color: "var(--red)" }} />
                      {result.warnings.length} slot{result.warnings.length === 1 ? "" : "s"} need
                      {result.warnings.length === 1 ? "s" : ""} PMM input — the render carries visible
                      placeholders until the text is supplied in the editor.
                    </div>
                    <ul style={{ margin: "4px 0 8px", paddingLeft: 22, fontSize: 12.5, color: "var(--text-secondary)" }}>
                      {result.warnings.map((w, i) => (
                        <li key={i}>
                          <b>{w.slot_id}</b>: {w.detail}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {result.degraded && (
                  <div className="check-row">
                    <i className="fa-solid fa-circle-xmark fail" /> AI generation unavailable — a starter scaffold
                    was created instead.
                  </div>
                )}
                {result.guard.ok ? (
                  <div className="check-row">
                    <i className="fa-solid fa-circle-check pass" /> Forbidden-words list — clear
                  </div>
                ) : (
                  <>
                    <div className="check-row">
                      <i className="fa-solid fa-circle-xmark fail" /> Forbidden-words list —{" "}
                      {result.guard.violations.length} banned term
                      {result.guard.violations.length === 1 ? "" : "s"}
                    </div>
                    <div
                      style={{
                        background: "#FCE8E8",
                        borderRadius: "var(--r-md)",
                        padding: "10px 14px",
                        margin: "4px 0 6px",
                        fontSize: 12.5,
                        color: "#A32D2D",
                      }}
                    >
                      {result.guard.violations.join(", ")} — fix these in the editor before the asset can move past
                      draft.
                    </div>
                  </>
                )}
                <div className="check-row">
                  {result.degraded ? (
                    <>
                      <i className="fa-solid fa-circle-xmark fail" /> Brand / voice rules — draft the sections in
                      the editor
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-circle-check pass" /> Brand / voice rules — clear
                    </>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                  onClick={() => navigate(`/library/${result.artifactId}`)}
                >
                  <i className="fa-solid fa-pen-to-square" /> Open in editor
                </button>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
