import { useEffect, useState } from "react";
import { approveAsset, listDrafts } from "../lib/api";

export function Approvals() {
  const [drafts, setDrafts] = useState<{ path: string; preview: string }[]>([]);
  const [message, setMessage] = useState("");

  const refresh = () =>
    listDrafts()
      .then((r) => setDrafts(r.drafts))
      .catch((e) => setMessage((e as Error).message));

  useEffect(() => {
    refresh();
  }, []);

  const approve = async (path: string) => {
    setMessage("");
    try {
      await approveAsset(path);
      setMessage(`Approved: ${path}`);
      refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div className="card">
      <h2>Approvals</h2>
      <p>
        The system proposes; the PMM admin decides. Drafts stay drafts until
        approved here.
      </p>
      {message && <p>{message}</p>}
      {drafts.length === 0 && <p>No drafts waiting.</p>}
      {drafts.map((d) => (
        <div key={d.path} style={{ marginBottom: 16 }}>
          <p>
            <strong>{d.path}</strong>
            <span className="badge-draft">DRAFT</span>
          </p>
          <pre className="answer">{d.preview}…</pre>
          <button onClick={() => approve(d.path)}>Approve → final</button>
        </div>
      ))}
    </div>
  );
}
