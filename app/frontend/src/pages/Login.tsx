import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

const DEMO_ACCOUNTS = [
  ["admin@aurigo.demo", "Admin@12345", "PMM Admin"],
  ["sales@aurigo.demo", "Sales@12345", "Sales"],
  ["marketing@aurigo.demo", "Marketing@12345", "Marketing"],
  ["elt@aurigo.demo", "Elt@12345", "ELT"],
] as const;

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent, em?: string, pw?: string) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const err = await signIn(em ?? email, pw ?? password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: "80px auto" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>PMM Agent</h1>
        <p>Product marketing as an on-demand capability.</p>
        <form onSubmit={submit}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <p>
            <button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </p>
        </form>
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      </div>
      <div className="card">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Demo accounts</h2>
        {DEMO_ACCOUNTS.map(([em, pw, label]) => (
          <p key={em}>
            <button onClick={() => void submit(undefined, em, pw)} disabled={busy}>
              {label}
            </button>{" "}
            <span style={{ color: "var(--grey-mid)" }}>{em}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
