import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

const DEMO_ACCOUNTS = [
  ["admin@aurigo.demo", "Admin@12345", "PMM Admin"],
  ["sales@aurigo.demo", "Sales@12345", "Sales"],
  ["marketing@aurigo.demo", "Marketing@12345", "Marketing"],
  ["elt@aurigo.demo", "Elt@12345", "ELT"],
] as const;

// Local copy of the Hive hexagon mark (do not import from Layout).
function HiveMark() {
  return (
    <svg viewBox="0 0 90 84" width="42" height="39">
      <polygon points="45,4 78,23 78,61 45,80 12,61 12,23" fill="none" stroke="#8FBFC9" strokeWidth="3" />
      <polygon points="30,15 41.3,21.5 41.3,34.5 30,41 18.7,34.5 18.7,21.5" fill="#46B2BE" />
      <polygon points="60,15 71.3,21.5 71.3,34.5 60,41 48.7,34.5 48.7,21.5" fill="#0B4D5C" />
      <polygon points="45,41 56.3,47.5 56.3,60.5 45,67 33.7,60.5 33.7,47.5" fill="#F8D146" />
    </svg>
  );
}

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
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <HiveMark />
            <div>
              <div style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.15 }}>Hive</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>by Aurigo</div>
            </div>
          </div>
          <p className="pagesub" style={{ marginBottom: 14 }}>
            Product marketing as an on-demand capability.
          </p>
          <form onSubmit={submit}>
            <label style={{ marginTop: 0 }}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
              disabled={busy}
            >
              <i className="fa-solid fa-right-to-bracket" />
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {error && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
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
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Demo accounts</h3>
          <div className="grid grid-2" style={{ gap: 10 }}>
            {DEMO_ACCOUNTS.map(([em, pw, label]) => (
              <button
                key={em}
                className="btn"
                style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "10px 14px" }}
                onClick={() => void submit(undefined, em, pw)}
                disabled={busy}
              >
                <span style={{ fontWeight: 500 }}>
                  <i className="fa-solid fa-user" style={{ marginRight: 7, color: "var(--teal-dark)" }} />
                  {label}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 400 }}>{em}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
