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
  getArtifactRender,
  RenderWarning,
  TemplateSummary,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { ReferenceLibrary } from "../components/ReferenceLibrary";
import { lineLogo } from "../lib/branding";

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

interface ApprovedMessagingDoc {
  id: string;
  version: number;
  status: string;
  title: string;
  approved_at: string | null;
  war_room_path: string | null;
  products: { name: string } | null;
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
  const [finalsError, setFinalsError] = useState("");
  const [approvedDocs, setApprovedDocs] = useState<ApprovedMessagingDoc[]>([]);

  // Approved P&M documents are finalized deliverables too — the questionnaire
  // pipeline's output, published to the war room on approval.
  useEffect(() => {
    if (view !== "finalized") return;
    apiGet<{ docs: ApprovedMessagingDoc[] }>("/api/messaging-docs")
      .then((r) => setApprovedDocs(r.docs))
      .catch(() => setApprovedDocs([]));
  }, [view]);

  const viewDoc = async (d: ApprovedMessagingDoc) => {
    setFinalsError("");
    try {
      const r = await apiGet<{ doc: { title: string; content_html: string } }>(
        `/api/messaging-docs/doc/${d.id}`
      );
      const html = [
        '<!doctype html><html><head><meta charset="utf-8">',
        `<title>${r.doc.title}</title>`,
        "<style>body{font-family:Roboto,Arial,sans-serif;color:#20282B;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.65}h1{color:#053445}h2{color:#015F74}a{color:#015F74}table{border-collapse:collapse;width:100%}th,td{border:1px solid #E1E6E9;padding:8px 10px;text-align:left}th{background:#F5F7F8}</style>",
        "</head><body>",
        r.doc.content_html,
        "</body></html>",
      ].join("");
      window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
    } catch (e) {
      setFinalsError((e as Error).message);
    }
  };

  // View renders the finalized content in a new tab — the repository editor is
  // reached only through the explicit Edit action. Template-generated artifacts
  // open their true laid-out render (artifact_renders payload); the flat digest
  // is only the fallback for rich-text artifacts.
  const viewFinal = async (a: FinalAsset) => {
    setFinalsError("");
    try {
      const r = await apiGet<{ contentHtml: string; hasRender?: boolean }>(`/api/artifacts/${a.id}`);
      if (r.hasRender) {
        try {
          const render = await getArtifactRender(a.id);
          if (render.format === "html" || render.format === "email" || render.format === "deck") {
            window.open(URL.createObjectURL(new Blob([render.payload], { type: "text/html" })), "_blank");
            return;
          }
          if (render.format === "svg") {
            window.open(URL.createObjectURL(new Blob([render.payload], { type: "image/svg+xml" })), "_blank");
            return;
          }
          // markdown and anything else: fall through to the digest shell.
        } catch {
          // render fetch failed — fall back to the digest below
        }
      }
      // Digest fallback: it already opens with its own <h1>, so no extra title.
      const html = [
        '<!doctype html><html><head><meta charset="utf-8">',
        `<title>${a.title}</title>`,
        "<style>@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');body{font-family:Roboto,Arial,sans-serif;color:#20282B;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.65;overflow-wrap:anywhere}h1{color:#053445}h2{color:#015F74}a{color:#015F74}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #E1E6E9;padding:8px 10px;text-align:left;overflow-wrap:anywhere}th{background:#F5F7F8}</style>",
        "</head><body>",
        r.contentHtml === "" ? `<h1>${a.title}</h1><p>(no rendered content)</p>` : r.contentHtml,
        "</body></html>",
      ].join("");
      window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
    } catch (e) {
      setFinalsError((e as Error).message);
    }
  };

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
  // Deck generation success toast (deck-studio.md §5.3) — shown briefly before
  // navigating into the slide editor.
  const [toast, setToast] = useState<string | null>(null);

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
        if (template.asset_type === "deck") {
          // Deck prompt path now lands structured slides (§4.5) — say so, then open.
          setToast("Deck generated — opening slide editor");
          window.setTimeout(() => navigate(`/library/${r.artifactId}`), 900);
          return;
        }
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
          {approvedDocs.length > 0 && (
            <>
              <div className="section-label">Approved messaging documents</div>
              <div style={{ overflowX: "auto", marginBottom: 18 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Product</th>
                      <th>Version</th>
                      <th>Approved</th>
                      <th>War room</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedDocs.map((d) => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 500 }}>
                          <i className="fa-solid fa-file-signature" style={{ color: "var(--teal-dark)", marginRight: 8 }} />
                          {d.title}
                        </td>
                        <td>{d.products?.name ?? "—"}</td>
                        <td>v{d.version}</td>
                        <td>{d.approved_at ? new Date(d.approved_at).toLocaleDateString() : "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                          {d.war_room_path ?? "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn btn-sm" onClick={() => void viewDoc(d)} title="View the published document">
                            <i className="fa-solid fa-eye" /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="section-label">System finals</div>
          {finalsError && (
            <div style={{ marginBottom: 12, padding: "10px 14px", background: "#FCE8E8", borderRadius: "var(--r-md)", color: "#A32D2D", fontSize: 13 }}>
              {finalsError}
            </div>
          )}
          {finalsLoading ? (
            <div className="empty-note">Loading finalized assets…</div>
          ) : finals.length === 0 ? (
            <div className="empty-note">
              Nothing finalized yet. Assets appear here once a PMM admin saves them as final in the
              PMM workspace.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Persona</th>
                    <th>Version</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {finals.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>
                        <i
                          className={`fa-solid ${FINAL_TYPE_ICON[a.asset_type] ?? "fa-file"}`}
                          style={{ color: "var(--teal-dark)", marginRight: 8 }}
                        />
                        {a.title}
                      </td>
                      <td>{a.asset_type}</td>
                      <td>{a.product_name ?? "—"}</td>
                      <td>{a.persona ?? "—"}</td>
                      <td>v{a.current_version}</td>
                      <td>{new Date(a.updated_at).toLocaleDateString()}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => void viewFinal(a)}
                          title="View the finalized content in a new tab"
                        >
                          <i className="fa-solid fa-eye" /> View
                        </button>{" "}
                        {admin && (
                          <button
                            className="btn btn-sm"
                            onClick={() => navigate(`/library/${a.id}`)}
                            title="Edit in the PMM workspace repository"
                          >
                            <i className="fa-solid fa-pen" /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(() => {
                const logo = lineLogo(products.find((p) => p.id === productId)?.line);
                return logo ? <img src={logo} alt="" style={{ height: 20, width: "auto" }} /> : null;
              })()}
              <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ flex: 1 }}>
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
            </div>
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

      {toast !== null && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--teal-darkest)",
            color: "#fff",
            padding: "12px 22px",
            borderRadius: "var(--r-pill)",
            fontSize: 13.5,
            fontWeight: 500,
            boxShadow: "var(--shadow-2)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ color: "var(--teal-light)" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
