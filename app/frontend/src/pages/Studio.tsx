import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, getProducts, Product } from "../lib/api";

// Asset Studio: pick an asset type → pick a (mock Canva) template → pick a
// prompt + product + title → generate a draft artifact and open it in the editor.

interface Template {
  id: string;
  name: string;
  asset_type: string;
  product_line: string | null;
  preview_color: string | null;
}

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
}

const ASSET_TYPES: { key: string; label: string; desc: string }[] = [
  { key: "datasheet", label: "Datasheet", desc: "One-page product overview with outcome-led capabilities and proof." },
  { key: "deck", label: "Sales Deck", desc: "Slide outline on the 7-step narrative arc with speaker notes." },
  { key: "faq", label: "FAQ", desc: "Customer-facing questions and direct answers from the objection library." },
  { key: "one-pager", label: "One-Pager", desc: "Executive summary: outcomes, the decision, and proof per claim." },
];

export function Studio() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [assetType, setAssetType] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [promptId, setPromptId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [title, setTitle] = useState("");
  const [extraBrief, setExtraBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    getProducts().then(setProducts).catch(() => {});
  }, []);

  const pickType = async (key: string) => {
    setAssetType(key);
    setTemplate(null);
    setPromptId("");
    setResult(null);
    setError("");
    try {
      const [t, p] = await Promise.all([
        apiGet<{ templates: Template[] }>(`/api/studio/templates?asset_type=${encodeURIComponent(key)}`),
        apiGet<{ prompts: PromptEntry[] }>(`/api/studio/prompts?asset_type=${encodeURIComponent(key)}`),
      ]);
      setTemplates(t.templates);
      setPrompts(p.prompts);
      if (p.prompts.length === 1) setPromptId(p.prompts[0].id);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pickTemplate = (t: Template) => {
    setTemplate(t);
    setStep(3);
  };

  const generate = async () => {
    if (!template || promptId === "" || title.trim() === "") return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
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
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="pagetitle">Asset creation studio</h1>
      <p className="pagesub">
        Pick a type, a brand template, and a prompt — the draft lands in the library editor.
      </p>

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
                      {t.name}
                      <div style={{ fontWeight: 400, fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                        {t.product_line ?? "All lines"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="empty-note" style={{ paddingBottom: 0 }}>
                Canva template (mock preview — Canva Connect pending). Generation targets the in-app editor; the
                Canva push activates once OAuth is granted.
              </div>
            </div>

            <div className="card">
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Prompt library</h3>
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
              <option value="">— whole portfolio —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

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
              disabled={busy || !template || promptId === "" || title.trim() === ""}
              title={
                busy
                  ? "Generating…"
                  : !template
                    ? "Select a template first"
                    : promptId === ""
                      ? "Select a prompt first"
                      : title.trim() === ""
                        ? "Give the draft a title first"
                        : "Generate the draft"
              }
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
              {busy ? "Generating…" : "Generate draft"}
            </button>

            {result && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>Automated content check</div>
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
    </div>
  );
}
