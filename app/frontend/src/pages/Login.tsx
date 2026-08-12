import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

const DEMO_ACCOUNTS: { email: string; password: string; label: string; icon: string }[] = [
  { email: "admin@aurigo.demo",     password: "Admin@12345",     label: "PMM Admin",  icon: "fa-user-shield" },
  { email: "sales@aurigo.demo",     password: "Sales@12345",     label: "Sales",      icon: "fa-handshake" },
  { email: "marketing@aurigo.demo", password: "Marketing@12345", label: "Marketing",  icon: "fa-bullhorn" },
  { email: "elt@aurigo.demo",       password: "Elt@12345",       label: "ELT",        icon: "fa-chart-line" },
];

function HiveMark() {
  return (
    <svg viewBox="0 0 90 84" width="44" height="41">
      <polygon points="45,4 78,23 78,61 45,80 12,61 12,23" fill="none" stroke="#8FBFC9" strokeWidth="3" />
      <polygon points="30,15 41.3,21.5 41.3,34.5 30,41 18.7,34.5 18.7,21.5" fill="#46B2BE" />
      <polygon points="60,15 71.3,21.5 71.3,34.5 60,41 48.7,34.5 48.7,21.5" fill="#0B4D5C" />
      <polygon points="45,41 56.3,47.5 56.3,60.5 45,67 33.7,60.5 33.7,47.5" fill="#F8D146" />
    </svg>
  );
}

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);

  const submit = async (e?: React.FormEvent, em?: string, pw?: string) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const err = await signIn(em ?? email, pw ?? password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div className="login-bg">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ---------- branding ---------- */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <HiveMark />
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#053445", lineHeight: 1.1, letterSpacing: "-0.01em" }}>Hive</div>
            <div style={{ fontSize: 12.5, color: "#6fa3ae", marginTop: 1 }}>by Aurigo</div>
          </div>
        </div>

        {/* ---------- login card ---------- */}
        <div style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(70,178,190,0.25)",
          borderRadius: 20,
          padding: "28px 28px 24px",
          boxShadow: "0 12px 40px rgba(1,95,116,0.12)",
        }}>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#5b6669" }}>
            Product marketing as an on-demand capability.
          </p>
          <form onSubmit={submit}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#5b6669", marginBottom: 6 }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              style={{
                width: "100%", boxSizing: "border-box", marginBottom: 14,
                background: "#fff", border: "1px solid #d6dde1",
                borderRadius: 10, padding: "10px 14px", fontSize: 14,
                color: "#20282b", outline: "none",
              }}
            />
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#5b6669", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                width: "100%", boxSizing: "border-box", marginBottom: 20,
                background: "#fff", border: "1px solid #d6dde1",
                borderRadius: 10, padding: "10px 14px", fontSize: 14,
                color: "#20282b", outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
                background: "#015f74", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 16px rgba(1,95,116,0.5)",
              }}
            >
              <i className="fa-solid fa-right-to-bracket" />
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {error && (
            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: "rgba(238,49,53,0.15)", border: "1px solid rgba(238,49,53,0.3)",
              borderRadius: 10, color: "#ffb3b5", fontSize: 13, fontWeight: 500,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* ---------- persona quick-login ---------- */}
        <div style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(70,178,190,0.25)",
          borderRadius: 20,
          padding: "20px 22px",
        }}>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, fontWeight: 500, color: "#8d979a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Sign in as
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {DEMO_ACCOUNTS.map(({ email: em, password: pw, label, icon }) => (
              <button
                key={em}
                onClick={() => void submit(undefined, em, pw)}
                disabled={busy}
                style={{
                  background: "#fff", border: "1px solid #e1e6e9",
                  borderRadius: 12, padding: "12px 14px", cursor: busy ? "not-allowed" : "pointer",
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#e8f6f8";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#46b2be";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#e1e6e9";
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#20282b", display: "flex", alignItems: "center", gap: 7 }}>
                  <i className={`fa-solid ${icon}`} style={{ color: "#46b2be", fontSize: 13 }} />
                  {label}
                </span>
                <span style={{ fontSize: 11, color: "#8d979a", fontWeight: 400 }}>{em}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
