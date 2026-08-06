import { useState } from "react";
import { askWarRoom } from "../lib/api";

const ROLES = [
  ["sales", "Sales"],
  ["proposals", "Proposals"],
  ["marketing", "Marketing"],
  ["leadership", "Leadership"],
  ["product", "Product"],
  ["cs", "Customer Success"],
  ["sdr", "SDR / BDR"],
] as const;

export function AskWarRoom() {
  const [question, setQuestion] = useState("");
  const [role, setRole] = useState<string>("sales");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const r = await askWarRoom(question, role);
      setAnswer(r.answer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Ask the War Room</h2>
      <p>
        Plain-language questions, role-ready answers — grounded only in the GTM
        War Room, with sources.
      </p>
      <label>I work in</label>
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
      {answer && <pre className="answer">{answer}</pre>}
    </div>
  );
}
