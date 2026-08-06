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
      <h1 className="pagetitle">Foundational doc</h1>
      <p className="pagesub">
        One rigorous foundation per product: positioning, ICP, customer language, brand guardrails.
        Everything the knowledge engine answers from starts here.
      </p>

      {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      {!data && !error && <p className="empty-note">Loading…</p>}

      {data && data.sections.length > 0 && (
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          {data.sections.map((s) => (
            <div
              key={s.path}
              className="card"
              style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: 8 }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {s.preview}…
              </p>
              <div style={{ marginTop: "auto" }}>
                <button className="btn btn-sm" onClick={() => void view(s.path)}>
                  <i className="fa-solid fa-book-open" /> Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Context files</h3>
          {data.context.map((c) => (
            <div key={c.path} className="check-row">
              <i className={c.exists ? "fa-solid fa-circle-check pass" : "fa-solid fa-circle-xmark fail"} />
              <span>{c.path}</span>
              {!c.exists && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  missing — populate before relying on answers
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>
            <i className="fa-solid fa-file-lines" style={{ marginRight: 8, color: "var(--teal-dark)" }} />
            {open.path}
          </h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 13.5,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {open.content}
          </pre>
        </div>
      )}
    </div>
  );
}
