import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AgentSummary, listAgents, updateAgent } from "../lib/api";
import { AgentDrawer } from "../components/AgentDrawer";

// Agents tab — unified registry of the app's pipeline task agents and the 14
// PMM sub-agents (blueprint app/docs/blueprints/agents-tab.md §3.2). Admin-only:
// the nav hides the entry and the backend 403s regardless.

const GROUPS: { id: "task" | "A" | "B" | "C"; label: string }[] = [
  { id: "task", label: "Pipeline task agents" },
  { id: "A", label: "Intelligence agents (Group A)" },
  { id: "B", label: "Activation agents (Group B)" },
  { id: "C", label: "Governance agents (Group C)" },
];

function groupAgents(agents: AgentSummary[], id: "task" | "A" | "B" | "C"): AgentSummary[] {
  if (id === "task") return agents.filter((a) => a.kind === "task");
  return agents.filter((a) => a.kind === "pmm" && a.grp === id);
}

/** Configured/base badge: override wins, then any other delta, then stock. */
function configBadge(a: AgentSummary): { cls: string; label: string } {
  if (a.overridden) return { cls: "pill-draft", label: "Overridden" };
  if (a.has_custom_instructions || a.model !== null)
    return { cls: "pill-review", label: "Configured" };
  return { cls: "pill-archived", label: "Base" };
}

export function Agents() {
  const { me } = useAuth();
  const admin = me?.role === "admin";

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState("");
  const [selected, setSelected] = useState<AgentSummary | null>(null);

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
      const r = await updateAgent(a.key, { enabled: !a.enabled });
      setAgents((list) =>
        list.map((x) =>
          x.key === a.key
            ? { ...x, enabled: r.agent.enabled, updated_at: r.agent.updated_at }
            : x
        )
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setToggling("");
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

  const renderRow = (a: AgentSummary) => {
    const badge = configBadge(a);
    return (
      <div
        key={a.key}
        className="card"
        role="button"
        tabIndex={0}
        onClick={() => setSelected(a)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelected(a);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 0,
          padding: "13px 18px",
          cursor: "pointer",
          opacity: a.enabled ? 1 : 0.65,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "var(--r-sm)",
            background: "#E1F0F2",
            color: "var(--teal-dark)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i className={`fa-solid ${a.kind === "task" ? "fa-gears" : "fa-robot"}`} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 500 }}>{a.name}</span>
            <span
              className="pill pill-archived"
              style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}
            >
              {a.key}
            </span>
            <span className={`pill ${badge.cls}`}>{badge.label}</span>
            {a.has_custom_instructions && (
              <span className="pill pill-review" title="Custom instructions are appended on every run">
                +instructions
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 2,
            }}
          >
            {a.description}
          </div>
        </div>
        <span
          className={`pill ${a.model !== null ? "pill-live" : "pill-archived"}`}
          title={a.model !== null ? "Custom model for this agent" : "Uses the PMM default model"}
          style={{ whiteSpace: "nowrap" }}
        >
          {a.model ?? `Default · ${defaultModel}`}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          Updated {a.updated_at.slice(0, 10)}
          {a.updated_by_name ? ` · ${a.updated_by_name}` : ""}
        </span>
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
              ? "Click to disable — runs that depend on this agent stop with a message naming this tab"
              : "Disabled: every dependent run fails fast. Click to enable."
          }
        >
          {a.enabled ? "Enabled" : "Disabled"}
        </button>
      </div>
    );
  };

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
            Configure the AI steps this app runs and the 14 PMM sub-agents. Changes apply at
            run time; every save is logged.
          </p>
        </div>
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

      {loading ? (
        <div className="empty-note">Loading agents…</div>
      ) : agents.length === 0 ? (
        <div className="card">
          <div className="empty-note">
            No agents registered yet. The agents registry ships with migration{" "}
            <code>0012_agents.sql</code> — run <code>npm run migrate</code> in{" "}
            <code>app/backend</code>, restart the server, and reload this page.
          </div>
        </div>
      ) : (
        GROUPS.map((g) => {
          const rows = groupAgents(agents, g.id);
          if (rows.length === 0) return null;
          return (
            <div key={g.id}>
              <div className="section-label">{g.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map(renderRow)}
              </div>
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
