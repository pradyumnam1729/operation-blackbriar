import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  AgentSummary,
  deleteCustomAgent,
  invokeCustomAgentTest,
  listAgents,
  registerCustomAgent,
  updateAgent,
  updateCustomAgent,
} from "../lib/api";
import { AgentDrawer } from "../components/AgentDrawer";

// Agents tab — unified registry of the app's pipeline task agents, the 14 PMM
// sub-agents, and team-connected custom agents (HTTP endpoints registered
// here; the agentic Ask loop can delegate to any enabled one). Admin-only:
// the nav hides the entry and the backend 403s regardless.

const GROUPS: { id: "task" | "A" | "B" | "C" | "custom"; label: string; blurb: string }[] = [
  { id: "custom", label: "Custom connected agents", blurb: "Your team's own agents, called over HTTP. Enabled agents are available to Ask Hive as delegation targets." },
  { id: "task", label: "Pipeline task agents", blurb: "The AI steps this app runs — questionnaire extraction, messaging generation, template fill, ask, compare." },
  { id: "A", label: "Intelligence agents · Group A", blurb: "Market, persona, competitive, win-loss, and evidence intelligence." },
  { id: "B", label: "Activation agents · Group B", blurb: "Launches, enablement, adoption, and pricing activation." },
  { id: "C", label: "Governance agents · Group C", blurb: "Messaging effectiveness, content governance, performance, prioritization." },
];

function groupAgents(agents: AgentSummary[], id: "task" | "A" | "B" | "C" | "custom"): AgentSummary[] {
  if (id === "task") return agents.filter((a) => a.kind === "task");
  if (id === "custom") return agents.filter((a) => a.kind === "custom");
  return agents.filter((a) => a.kind === "pmm" && a.grp === id);
}

/** Configured/base badge: override wins, then any other delta, then stock. */
function configBadge(a: AgentSummary): { cls: string; label: string } {
  if (a.overridden) return { cls: "pill-draft", label: "Overridden" };
  if (a.has_custom_instructions || a.model !== null)
    return { cls: "pill-review", label: "Configured" };
  return { cls: "pill-archived", label: "Base" };
}

const KIND_ICON: Record<string, string> = {
  task: "fa-gears",
  pmm: "fa-robot",
  custom: "fa-plug",
};

function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

interface ConnectForm {
  name: string;
  description: string;
  endpoint_url: string;
  auth_token: string;
  timeout_ms: string;
  owner_team: string;
}

const EMPTY_FORM: ConnectForm = {
  name: "",
  description: "",
  endpoint_url: "",
  auth_token: "",
  timeout_ms: "20000",
  owner_team: "",
};

export function Agents() {
  const { me } = useAuth();
  const admin = me?.role === "admin";

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState("");
  const [selected, setSelected] = useState<AgentSummary | null>(null);

  // Connect-agent form + per-card test results
  const [showConnect, setShowConnect] = useState(false);
  const [form, setForm] = useState<ConnectForm>(EMPTY_FORM);
  const [connectBusy, setConnectBusy] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [testing, setTesting] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await listAgents();
      setAgents(r.agents);
      setDefaultModel(r.default_model);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!admin) return;
    void load();
  }, [admin, load]);

  const toggleEnabled = async (a: AgentSummary) => {
    setToggling(a.key);
    setError("");
    try {
      if (a.kind === "custom") {
        const r = await updateCustomAgent(a.key, { enabled: !a.enabled });
        setAgents((list) =>
          list.map((x) => (x.key === a.key ? { ...x, enabled: r.agent.enabled } : x))
        );
      } else {
        const r = await updateAgent(a.key, { enabled: !a.enabled });
        setAgents((list) =>
          list.map((x) =>
            x.key === a.key ? { ...x, enabled: r.agent.enabled, updated_at: r.agent.updated_at } : x
          )
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setToggling("");
    }
  };

  const connect = async () => {
    setConnectBusy(true);
    setError("");
    try {
      await registerCustomAgent({
        name: form.name,
        description: form.description,
        endpoint_url: form.endpoint_url,
        auth_token: form.auth_token || undefined,
        timeout_ms: Number(form.timeout_ms) || undefined,
        owner_team: form.owner_team || undefined,
      });
      setForm(EMPTY_FORM);
      setShowConnect(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnectBusy(false);
    }
  };

  const testAgent = async (a: AgentSummary) => {
    setTesting(a.key);
    setTestResults((r) => ({ ...r, [a.key]: { ok: true, text: "Testing…" } }));
    try {
      const r = await invokeCustomAgentTest(a.key);
      setTestResults((prev) => ({
        ...prev,
        [a.key]: {
          ok: true,
          text: `${(r.latency_ms / 1000).toFixed(1)}s — ${r.output.slice(0, 160)}`,
        },
      }));
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [a.key]: { ok: false, text: (e as Error).message } }));
    } finally {
      setTesting("");
    }
  };

  const removeAgent = async (a: AgentSummary) => {
    if (!window.confirm(`Disconnect and delete "${a.name}"? Ask Hive will no longer delegate to it.`))
      return;
    setError("");
    try {
      await deleteCustomAgent(a.key);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ---- non-admin guard (nav hides the entry; backend 403s regardless) ----
  if (!admin) {
    return (
      <div>
        <h1 className="pagetitle">Agents</h1>
        <div className="card">
          <div className="empty-note">
            The Agents registry is where the PMM admin tunes the AI steps this app runs.
            If an answer or asset needs a different emphasis, ask your PMM admin — changes
            made here apply to every role at run time.
          </div>
        </div>
      </div>
    );
  }

  const renderCard = (a: AgentSummary) => {
    const badge = configBadge(a);
    const isCustom = a.kind === "custom";
    const test = testResults[a.key];
    return (
      <div
        key={a.key}
        className="card"
        role={isCustom ? undefined : "button"}
        tabIndex={isCustom ? undefined : 0}
        onClick={() => !isCustom && setSelected(a)}
        onKeyDown={(e) => {
          if (!isCustom && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setSelected(a);
          }
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 0,
          padding: "18px 18px 14px",
          cursor: isCustom ? "default" : "pointer",
          opacity: a.enabled ? 1 : 0.6,
          transition: "box-shadow .15s ease, transform .15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-2)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
          (e.currentTarget as HTMLDivElement).style.transform = "";
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--r-sm)",
              background: isCustom ? "#FDF6DC" : "#E1F0F2",
              color: isCustom ? "#8A6D00" : "var(--teal-dark)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 15,
            }}
          >
            <i className={`fa-solid ${KIND_ICON[a.kind] ?? "fa-robot"}`} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
                lineHeight: 1.3,
              }}
            >
              {a.name}
            </div>
            <div
              style={{
                fontFamily: "Consolas, monospace",
                fontSize: 10.5,
                color: "var(--text-muted)",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.key}
              {isCustom && a.endpoint_url ? ` · ${hostOf(a.endpoint_url)}` : ""}
            </div>
          </div>
          <button
            className={`pill ${a.enabled ? "pill-live" : "pill-lost"}`}
            style={{ border: "none", cursor: "pointer", flexShrink: 0 }}
            disabled={toggling === a.key}
            onClick={(e) => {
              e.stopPropagation();
              void toggleEnabled(a);
            }}
            title={
              a.enabled
                ? "Click to disable — dependent runs stop with a message naming this tab"
                : "Disabled: every dependent run fails fast. Click to enable."
            }
          >
            {a.enabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        {/* description */}
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 40,
          }}
          title={a.description}
        >
          {a.description}
        </div>

        {/* test result (custom only) */}
        {isCustom && test && (
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              padding: "7px 10px",
              borderRadius: "var(--r-sm)",
              background: test.ok ? "#EFF7F1" : "#FCE8E8",
              color: test.ok ? "#1D6B3C" : "#A32D2D",
            }}
          >
            {test.text}
          </div>
        )}

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: "auto",
            paddingTop: 10,
            borderTop: "1px solid var(--border)",
          }}
        >
          {isCustom ? (
            <>
              <span className="pill pill-review">HTTP agent</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>
                Updated {a.updated_at.slice(0, 10)}
              </span>
              <button
                className="btn btn-sm"
                disabled={testing === a.key}
                onClick={(e) => {
                  e.stopPropagation();
                  void testAgent(a);
                }}
              >
                <i className={`fa-solid ${testing === a.key ? "fa-spinner fa-spin" : "fa-bolt"}`} />{" "}
                Test
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  void removeAgent(a);
                }}
              >
                <i className="fa-solid fa-trash" />
              </button>
            </>
          ) : (
            <>
              <span className={`pill ${badge.cls}`}>{badge.label}</span>
              {a.has_custom_instructions && (
                <span className="pill pill-review" title="Custom instructions appended on every run">
                  +instructions
                </span>
              )}
              <span
                className={`pill ${a.model !== null ? "pill-live" : "pill-archived"}`}
                title={a.model !== null ? "Custom model for this agent" : "Uses the PMM default model"}
              >
                {a.model ?? "Default model"}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                {a.updated_at.slice(0, 10)}
                {a.updated_by_name ? ` · ${a.updated_by_name}` : ""}
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  const inputStyle = { marginTop: 0 } as const;

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="pagetitle">
            Agents{" "}
            <span className="pill pill-lock" style={{ marginLeft: 6 }}>
              <i className="fa-solid fa-lock" style={{ fontSize: 9 }} /> Admin only
            </span>
          </h1>
          <p className="pagesub">
            The AI workforce behind Hive: the app's pipeline agents, the 14 PMM sub-agents, and
            your team's own connected agents. Changes apply at run time; every save is logged.
          </p>
        </div>
        <button
          className={showConnect ? "btn" : "btn btn-primary"}
          onClick={() => setShowConnect((s) => !s)}
        >
          <i className={`fa-solid ${showConnect ? "fa-xmark" : "fa-plug"}`} />
          {showConnect ? "Cancel" : "Connect custom agent"}
        </button>
      </div>

      {error !== "" && (
        <div
          style={{
            background: "#FCE8E8",
            color: "#A32D2D",
            borderRadius: "var(--r-md)",
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {showConnect && (
        <div className="card">
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Connect a custom agent</h3>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: 1.55 }}>
            Point Hive at any HTTP agent your team runs. Hive sends{" "}
            <code style={{ fontSize: 11.5 }}>{'POST {"input", "context", "source": "hive"}'}</code>{" "}
            and expects <code style={{ fontSize: 11.5 }}>{'{"output": "..."}'}</code> (or plain text)
            back. Once enabled, Ask Hive can delegate matching questions to it — write the
            description as the routing rule: it is exactly what the Ask agent reads to decide when
            to call your agent.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={inputStyle}>Agent name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. RFP Compliance Agent"
              />
            </div>
            <div>
              <label style={inputStyle}>Owner team (optional)</label>
              <input
                value={form.owner_team}
                onChange={(e) => setForm({ ...form, owner_team: e.target.value })}
                placeholder="e.g. Proposals"
              />
            </div>
          </div>
          <label>What does it do? (Ask Hive routes on this)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Answers RFP compliance questions: certifications, security standards, data residency, SLAs. Use for any question about compliance requirements in a proposal."
            style={{ minHeight: 64 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div>
              <label>Endpoint URL</label>
              <input
                value={form.endpoint_url}
                onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
                placeholder="https://agents.yourteam.dev/rfp"
              />
            </div>
            <div>
              <label>Auth token (optional)</label>
              <input
                type="password"
                value={form.auth_token}
                onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
                placeholder="Sent as Bearer token"
              />
            </div>
            <div>
              <label>Timeout (ms)</label>
              <input
                value={form.timeout_ms}
                onChange={(e) => setForm({ ...form, timeout_ms: e.target.value })}
                placeholder="20000"
              />
            </div>
          </div>
          <p style={{ marginBottom: 0 }}>
            <button
              className="btn btn-primary"
              onClick={() => void connect()}
              disabled={
                connectBusy ||
                form.name.trim() === "" ||
                form.description.trim() === "" ||
                !/^https?:\/\//i.test(form.endpoint_url.trim())
              }
              title={
                form.name.trim() === ""
                  ? "Name the agent first"
                  : form.description.trim() === ""
                    ? "Describe what it does — Ask Hive routes on the description"
                    : !/^https?:\/\//i.test(form.endpoint_url.trim())
                      ? "Enter a full http(s) endpoint URL"
                      : "Register the agent"
              }
            >
              <i className="fa-solid fa-plug" /> {connectBusy ? "Connecting…" : "Connect agent"}
            </button>
          </p>
        </div>
      )}

      {loading ? (
        <div className="empty-note">Loading agents…</div>
      ) : agents.length === 0 ? (
        <div className="card">
          <div className="empty-note">
            No agents registered yet. The agents registry ships with migration{" "}
            <code>0013_agents.sql</code> — run <code>npm run migrate</code> in{" "}
            <code>app/backend</code>, restart the server, and reload this page.
          </div>
        </div>
      ) : (
        GROUPS.map((g) => {
          const rows = groupAgents(agents, g.id);
          if (rows.length === 0 && g.id !== "custom") return null;
          return (
            <div key={g.id} style={{ marginBottom: 26 }}>
              <div className="section-label" style={{ marginBottom: 2 }}>
                {g.label}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--text-muted)", marginLeft: 8 }}>
                  {rows.length}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>{g.blurb}</p>
              {rows.length === 0 ? (
                <div className="empty-note" style={{ paddingTop: 4 }}>
                  No custom agents connected yet — use “Connect custom agent” above. Enabled agents
                  become delegation targets for Ask Hive automatically.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
                    gap: 14,
                  }}
                >
                  {rows.map(renderCard)}
                </div>
              )}
            </div>
          );
        })
      )}

      {selected && (
        <AgentDrawer
          agentKey={selected.key}
          updatedByName={selected.updated_by_name}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}
