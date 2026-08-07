import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ApiError,
  GenerateFromTemplateResponse,
  generateFromTemplate,
  getProducts,
  Product,
  RoutingProposal,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// Ask-to-artifact confirmation card (blueprint ask-to-artifact.md §6.3).
// Rendered inside a bot chat bubble when POST /api/query returns
// kind:"routing". The system proposes; the human confirms — Generate calls
// the existing template-generate route and the draft lands in the normal
// approval machine (§8.4). The card owns its own state and never blocks
// the chat thread.

interface RoutingCardProps {
  proposal: RoutingProposal;
  /** The original ask — re-submitted with mode:"question" on "Just answer this instead". */
  question: string;
  onAnswerInstead: () => void;
}

type CardPhase =
  | { name: "idle" }
  | { name: "generating" }
  | { name: "success"; result: GenerateFromTemplateResponse }
  // 409 = no final messaging doc for the picked product (§3.1 gate). Fields
  // stay live: picking a product that HAS a final doc recovers in-card.
  | { name: "gate409"; message: string }
  | { name: "error"; message: string };

const banner: React.CSSProperties = {
  background: "#FCE8E8",
  borderRadius: "var(--r-md)",
  padding: "10px 14px",
  color: "#A32D2D",
  fontSize: 12.5,
  fontWeight: 500,
  marginTop: 10,
};

// `question` stays on the props contract (the parent builds onAnswerInstead
// from it) but the card itself only needs the callback.
export function RoutingCard({ proposal, onAnswerInstead }: RoutingCardProps) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const admin = me?.role === "admin";
  const uid = useId();

  const [phase, setPhase] = useState<CardPhase>({ name: "idle" });
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState(proposal.product.id);
  const [title, setTitle] = useState(proposal.suggested_title);
  const [brief, setBrief] = useState(proposal.brief);

  useEffect(() => {
    let alive = true;
    getProducts()
      .then((rows) => {
        if (alive) setProducts(rows);
      })
      .catch(() => {
        /* select falls back to the proposed product only */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Options: full products list once loaded; until then (or on fetch failure)
  // the proposal's product keeps the select valid.
  const options: { id: string; name: string }[] =
    products.length > 0 ? products : [proposal.product];
  const pickedName =
    options.find((p) => p.id === productId)?.name ?? proposal.product.name;

  const generating = phase.name === "generating";
  const canGenerate = !generating && title.trim() !== "";

  const generate = async () => {
    if (!canGenerate) return;
    setPhase({ name: "generating" });
    try {
      const r = await generateFromTemplate(proposal.template.id, {
        product_id: productId,
        title: title.trim(),
        extra_brief: brief.trim() === "" ? undefined : brief.trim(),
      });
      setPhase({ name: "success", result: r });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409)
        setPhase({ name: "gate409", message: e.message });
      else setPhase({ name: "error", message: (e as Error).message });
    }
  };

  // ---- success: card collapses; link, no auto-navigate (a chat surface
  // should not teleport the user out of the thread) ----
  if (phase.name === "success") {
    const { result } = phase;
    const clean = result.guard.ok && result.warnings.length === 0;
    return (
      <div style={{ width: 520, maxWidth: "100%" }}>
        <div className="check-row" style={{ fontWeight: 500 }}>
          <i className="fa-solid fa-circle-check pass" /> Draft created —{" "}
          {proposal.template.name} for {pickedName}
        </div>
        {!clean && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>
              Automated content check
            </div>
            {result.warnings.length > 0 && (
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
                <div style={{ ...banner, marginTop: 4, marginBottom: 6 }}>
                  {result.guard.violations.join(", ")} — fix these in the editor before the asset
                  can move past draft.
                </div>
              </>
            )}
            {result.guard.ok && (
              <div className="check-row">
                <i className="fa-solid fa-circle-check pass" /> Brand / voice rules — clear
              </div>
            )}
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={() => navigate(`/library/${result.artifactId}`)}
        >
          <i className="fa-solid fa-pen-to-square" /> Open in editor
        </button>
      </div>
    );
  }

  // ---- proposal / generating / 409 / error: prefilled confirmation form ----
  return (
    <div style={{ width: 520, maxWidth: "100%" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill pill-draft">Asset request</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {Math.round(proposal.confidence * 100)}% confidence
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "6px 0 2px" }}>
        Routed: {proposal.reason}
        {proposal.template_fallback_used ? " — closest available template for this type." : ""}
      </div>

      {/* template row */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "10px 12px",
          margin: "8px 0 2px",
          background: "var(--bg-page)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500 }}>{proposal.template.name}</span>
          {admin && (
            <Link
              to={`/templates?preview=${proposal.template.id}`}
              target="_blank"
              rel="noopener"
              style={{ fontSize: 12.5, textDecoration: "underline", marginLeft: "auto" }}
              title="Opens the template preview in a new tab, so this thread stays put"
            >
              Preview
            </Link>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
          {proposal.asset_type}
          {proposal.template.product_line ? ` · ${proposal.template.product_line}` : ""}
          {proposal.template.funnel_stage ? ` · ${proposal.template.funnel_stage}` : ""}
        </div>
      </div>

      <label htmlFor={`${uid}-product`}>Product</label>
      <select
        id={`${uid}-product`}
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
        disabled={generating}
      >
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <label htmlFor={`${uid}-title`}>Title</label>
      <input
        id={`${uid}-title`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={generating}
        placeholder="Give the draft a title"
      />

      <label htmlFor={`${uid}-brief`}>Brief (optional)</label>
      <textarea
        id={`${uid}-brief`}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        disabled={generating}
        placeholder="Audience, situation, and emphasis…"
        style={{ minHeight: 72 }}
      />

      {phase.name === "gate409" && (
        <div style={banner}>
          {phase.message}
          <div style={{ marginTop: 8, fontWeight: 400 }}>
            {admin ? (
              <Link to="/questionnaire" style={{ fontWeight: 500, textDecoration: "underline" }}>
                Open the Foundation Questionnaire
              </Link>
            ) : (
              <>Ask your PMM admin to approve a messaging document for {pickedName} first.</>
            )}
          </div>
        </div>
      )}

      {phase.name === "error" && <div style={banner}>{phase.message}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          className="btn btn-primary"
          onClick={() => void generate()}
          disabled={!canGenerate}
          style={!canGenerate ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          title={
            generating
              ? "Generating…"
              : title.trim() === ""
                ? "Give the draft a title first"
                : "Generate the draft"
          }
        >
          {generating ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" /> Generating draft…
            </>
          ) : (
            <>
              <i className="fa-solid fa-wand-magic-sparkles" /> Generate draft
            </>
          )}
        </button>
        <button className="btn" onClick={onAnswerInstead} disabled={generating}>
          <i className="fa-solid fa-reply" /> Just answer this instead
        </button>
      </div>
    </div>
  );
}
