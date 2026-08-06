import { useEffect, useState } from "react";
import { getFoundation, getFoundationFile, FoundationResponse } from "../lib/api";

export function FoundationDoc() {
  const [data, setData] = useState<FoundationResponse | null>(null);
  const [open, setOpen] = useState<{ path: string; content: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getFoundation().then(setData).catch((e) => setError((e as Error).message));
  }, []);

  const view = async (path: string) => {
    try {
      setOpen(await getFoundationFile(path));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Foundational Doc</h2>
        <p>
          One rigorous foundation per product: positioning, ICP, customer
          language, brand guardrails. Everything the knowledge engine answers
          from starts here.
        </p>
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
        {data?.sections.map((s) => (
          <div key={s.path} style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18 }}>{s.title}</h2>
            <p>{s.preview}…</p>
            <button onClick={() => view(s.path)}>Open</button>
          </div>
        ))}
      </div>
      {data && (
        <div className="card">
          <h2 style={{ fontSize: 18 }}>Context files</h2>
          <ul>
            {data.context.map((c) => (
              <li key={c.path}>
                {c.path} {c.exists ? "✓" : "— missing (populate before relying on answers)"}
              </li>
            ))}
          </ul>
        </div>
      )}
      {open && (
        <div className="card">
          <h2 style={{ fontSize: 18 }}>{open.path}</h2>
          <pre className="answer">{open.content}</pre>
        </div>
      )}
    </div>
  );
}
