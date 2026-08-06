import { useState } from "react";
import { askWarRoom } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// The asker's platform role pre-selects the answer framing; they can override
// (e.g., an admin previewing the Sales view).
const ROLES = [
  ["sales", "Sales"],
  ["proposals", "Proposals"],
  ["marketing", "Marketing"],
  ["leadership", "Leadership"],
  ["product", "Product"],
  ["cs", "Customer Success"],
  ["sdr", "SDR / BDR"],
] as const;

const DEFAULT_ROLE: Record<string, string> = {
  sales: "sales",
  marketing: "marketing",
  elt: "leadership",
  admin: "sales",
};

export function AskWarRoom() {
  const { me } = useAuth();
  const [question, setQuestion] = useState("");
  const [role, setRole] = useState<string>(DEFAULT_ROLE[me?.role ?? "sales"] ?? "sales");
  const [answerHtml, setAnswerHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    setAnswerHtml("");
    try {
      const r = await askWarRoom(question, role);
      setAnswerHtml(r.answerHtml);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Ask the War Room</h2>
        <p>
          Plain-language questions, role-ready answers — grounded only in
          approved GTM knowledge, with sources.
        </p>
        <label>Answer framed for</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label>Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. A state DOT is comparing us to Kahua on configurability. What do I say?"
        />
        <p>
          <button onClick={submit} disabled={busy || question.trim() === ""}>
            {busy ? "Consulting the war room…" : "Ask"}
          </button>
        </p>
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      </div>
      {answerHtml && (
        <div className="prose" dangerouslySetInnerHTML={{ __html: answerHtml }} />
      )}
    </div>
  );
}
