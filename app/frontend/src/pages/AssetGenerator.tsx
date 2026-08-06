import { useState } from "react";
import { generateAsset, GenerateResponse } from "../lib/api";

export function AssetGenerator() {
  const [type, setType] = useState("battlecard");
  const [product, setProduct] = useState("Masterworks");
  const [audience, setAudience] = useState("public owners (government agencies)");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await generateAsset(type, product, audience));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Generate an Asset</h2>
      <p>
        Customer-ready collateral in minutes, always as a draft — nothing ships
        without PMM approval.
      </p>
      <label>Asset type</label>
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="battlecard">Competitive battlecard</option>
        <option value="one-pager">Sales one-pager</option>
        <option value="exec-brief">Executive brief</option>
      </select>
      <label>Product</label>
      <select value={product} onChange={(e) => setProduct(e.target.value)}>
        <option>Masterworks</option>
        <option>Essentials</option>
        <option>Primus</option>
        <option>Masterworks AI</option>
      </select>
      <label>Audience</label>
      <input value={audience} onChange={(e) => setAudience(e.target.value)} />
      <p>
        <button className="cta" onClick={run} disabled={busy}>
          {busy ? "Generating draft…" : "Generate draft"}
        </button>
      </p>
      {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      {result && (
        <>
          <p>
            Saved to <code>GTM-War-Room/{result.path}</code>
            <span className="badge-draft">DRAFT</span>
          </p>
          {!result.guard.ok && (
            <p style={{ color: "var(--red)" }}>
              Voice guard flagged: {result.guard.violations.join(", ")} — fix
              before approval.
            </p>
          )}
          <pre className="answer">{result.content}</pre>
        </>
      )}
    </div>
  );
}
