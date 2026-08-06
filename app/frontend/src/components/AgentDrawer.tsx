import { CSSProperties, useEffect, useMemo, useState } from "react";
import {
  AgentDetail,
  AgentMeta,
  AgentTestRunBody,
  ApiError,
  TestRunResult,
  getAgent,
  revertAgent,
  testRunAgent,
  updateAgent,
} from "../lib/api";

// Right-side configuration drawer for one agent (blueprint agents-tab.md §3.2).
// Edits ride as a CANDIDATE until Save; Test run exercises the candidate through
// the real composition + model call without persisting anything.

const MONO: CSSProperties = {
  fontFamily: "Consolas, monospace",
  fontSize: 12.5,
  lineHeight: 1.55,
};

const PRE_BOX: CSSProperties = {
  ...MONO,
  whiteSpace: "pre-wrap",
  background: "var(--bg-page)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-md)",
  padding: "12px 14px",
  margin: 0,
  maxHeight: 260,
  overflow: "auto",
};

/** Contracts whose output is machine-parsed — the untested-override advisory applies. */
const JSON_CONTRACTS = ["fq-answers-json", "fills-json", "section-headings"];

const FALLBACK_ROLES = [
  "sales",
  "proposals",
  "marketing",
  "leadership",
  "product",
  "cs",
  "sdr",
  "general",
];

type TestInputKind = "question_role" | "question" | "brief" | "none";

function testInputKind(agent: AgentDetail): TestInputKind {
  if (agent.key === "ask-war-room") return "question_role";
  if (agent.key === "competitive-compare") return "question";
  if (agent.kind === "pmm") return "brief";
  return "none";
}

const GROUP_LABELS: Record<string, string> = {
  A: "Group A · Intelligence",
  B: "Group B · Activation",
  C: "Group C · Governance",
};

interface Props {
  agentKey: string;
  updatedByName: string | null;
  onClose: () => void;
  /** Fired after any successful save or revert so the list can refresh. */
  onChanged: () => void;
}

export function AgentDrawer({ agentKey, updatedByName, onClose, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [meta, setMeta] = useState<AgentMeta | null>(null);

  // Candidate config (form state).
  const [enabled, setEnabled] = useState(true);
  const [model, setModel] = useState(""); // "" = PMM default
  const [customInstructions, setCustomInstructions] = useState("");
  const [defaultsText, setDefaultsText] = useState("{}");
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideText, setOverrideText] = useState("");

  const [dirty, setDirty] = useState(false);
  const [testedSinceEdit, setTestedSinceEdit] = useState(false);

  // Save / revert state.
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [modelError, setModelError] = useState("");
  const [defaultsError, setDefaultsError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [revertOpen, setRevertOpen] = useState(false);
  const [revertBusy, setRevertBusy] = useState(false);

  // Test-run state.
  const [testQuestion, setTestQuestion] = useState("");
  const [testRole, setTestRole] = useState("general");
  const [testBrief, setTestBrief] = useState("");
  const [testBusy, setTestBusy] = useState<"" | "run" | "preview">("");
  const [testError, setTestError] = useState("");
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);

  const applyAgent = (a: AgentDetail) => {
    setAgent(a);
    setEnabled(a.enabled);
    setModel(a.model ?? "");
    setCustomInstructions(a.custom_instructions);
    setDefaultsText(JSON.stringify(a.defaults, null, 2));
    setOverrideOn(a.prompt_override !== null);
    setOverrideText(a.prompt_override ?? a.base_prompt);
    setDirty(false);
    setTestedSinceEdit(false);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError("");
    setAgent(null);
    setMeta(null);
    setWarnings([]);
    setSaveError("");
    setModelError("");
    setDefaultsError("");
    setTestError("");
    setTestResult(null);
    getAgent(agentKey)
      .then((r) => {
        if (!alive) return;
        applyAgent(r.agent);
        setMeta(r.meta);
      })
      .catch((e) => alive && setLoadError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [agentKey]);

  const markDirty = () => {
    setDirty(true);
    setTestedSinceEdit(false);
  };

  const attemptClose = () => {
    if (dirty && !window.confirm("Discard unsaved changes to this agent?")) return;
    onClose();
  };

  // Escape closes (through the dirty guard).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const parseDefaults = (): Record<string, unknown> | null => {
    const t = defaultsText.trim();
    if (t === "") return {};
    try {
      const parsed = JSON.parse(t) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setDefaultsError("Task defaults must be a JSON object.");
        return null;
      }
      setDefaultsError("");
      return parsed as Record<string, unknown>;
    } catch (e) {
      setDefaultsError(`Not valid JSON: ${(e as Error).message}`);
      return null;
    }
  };

  const candidate = (defaults: Record<string, unknown>): AgentTestRunBody => ({
    custom_instructions: customInstructions,
    // An override byte-equal to base is no override — don't persist a
    // permanent "Overridden" badge with zero delta.
    prompt_override: overrideOn && overrideText !== agent?.base_prompt ? overrideText : null,
    model: model === "" ? null : model,
    defaults,
  });

  const jsonContractAgent = meta !== null && JSON_CONTRACTS.includes(meta.contract);

  const save = async () => {
    if (agent === null) return;
    const defaults = parseDefaults();
    if (defaults === null) return;
    setSaveBusy(true);
    setSaveError("");
    setModelError("");
    try {
      const r = await updateAgent(agent.key, { ...candidate(defaults), enabled });
      const serverWarnings = r.warnings ?? [];
      const advisory =
        overrideOn && jsonContractAgent && !testedSinceEdit
          ? [
              "This override has not been test-run since your last edit. The locked suffix still enforces the output contract, but run a test to confirm the model follows it.",
            ]
          : [];
      applyAgent(r.agent);
      setWarnings([...serverWarnings, ...advisory]);
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        const msg = e.message.toLowerCase();
        if (msg.includes("model")) setModelError(e.message);
        else if (msg.includes("defaults")) setDefaultsError(e.message);
        else setSaveError(e.message);
      } else {
        setSaveError((e as Error).message);
      }
    } finally {
      setSaveBusy(false);
    }
  };

  const doRevert = async () => {
    if (agent === null) return;
    setRevertBusy(true);
    setSaveError("");
    try {
      const r = await revertAgent(agent.key);
      applyAgent(r.agent);
      setWarnings([]);
      setRevertOpen(false);
      onChanged();
    } catch (e) {
      setSaveError((e as Error).message);
      setRevertOpen(false);
    } finally {
      setRevertBusy(false);
    }
  };

  const inputKind: TestInputKind = agent !== null ? testInputKind(agent) : "none";

  const roles = useMemo(() => {
    try {
      const d = JSON.parse(defaultsText.trim() === "" ? "{}" : defaultsText) as Record<
        string,
        unknown
      >;
      const rf = d.role_framing;
      if (rf !== null && typeof rf === "object" && !Array.isArray(rf)) {
        const keys = Object.keys(rf as Record<string, unknown>);
        if (keys.length > 0) return keys;
      }
    } catch {
      // fall through to the seeded role list
    }
    return FALLBACK_ROLES;
  }, [defaultsText]);

  const missingTestInput =
    (inputKind === "question_role" || inputKind === "question") && testQuestion.trim() === ""
      ? "Enter a question to test with."
      : inputKind === "brief" && testBrief.trim() === ""
        ? "Enter a short brief to test with."
        : "";

  const runTest = async (composeOnly: boolean) => {
    if (agent === null) return;
    if (!composeOnly && missingTestInput !== "") {
      setTestError(missingTestInput);
      return;
    }
    const defaults = parseDefaults();
    if (defaults === null) {
      setTestError("Fix the task defaults JSON first.");
      return;
    }
    setTestBusy(composeOnly ? "preview" : "run");
    setTestError("");
    setTestResult(null);
    try {
      const input: AgentTestRunBody["input"] = {};
      if (inputKind === "question_role") {
        input.question = testQuestion.trim();
        input.role = testRole;
      } else if (inputKind === "question") {
        input.question = testQuestion.trim();
      } else if (inputKind === "brief") {
        input.brief = testBrief.trim();
      }
      const r = await testRunAgent(agent.key, {
        ...candidate(defaults),
        input,
        compose_only: composeOnly || undefined,
      });
      setTestResult(r);
      if (!composeOnly) setTestedSinceEdit(true);
    } catch (e) {
      setTestError((e as Error).message);
    } finally {
      setTestBusy("");
    }
  };

  const clearOverride = () => {
    setOverrideOn(false);
    setOverrideText(agent?.base_prompt ?? "");
    markDirty();
  };

  const sectionLabel = (text: string) => (
    <div
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        margin: "22px 0 10px",
      }}
    >
      {text}
    </div>
  );

  const modelHasOutput =
    testResult !== null &&
    (testResult.output_raw !== undefined || testResult.output_html !== undefined);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div
        className="drawer"
        role="dialog"
        aria-label={`Configure agent ${agent?.name ?? agentKey}`}
        style={{ width: 700, maxWidth: "94%" }}
      >
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <h2 style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {agent?.name ?? agentKey}
            </h2>
            {agent !== null && (
              <span
                className="pill pill-archived"
                style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}
              >
                {agent.key}
              </span>
            )}
          </div>
          <button className="close" aria-label="Close" onClick={attemptClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {loading && <div className="empty-note">Loading agent…</div>}
        {loadError !== "" && (
          <div
            style={{
              background: "#FCE8E8",
              color: "#A32D2D",
              borderRadius: "var(--r-md)",
              padding: "10px 14px",
              fontSize: 13,
            }}
          >
            {loadError}
          </div>
        )}

        {agent !== null && meta !== null && (
          <>
            {/* ---- identity ---- */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span className="pill pill-live">
                {agent.kind === "task" ? "Task agent" : "PMM sub-agent"}
              </span>
              {agent.grp !== null && (
                <span className="pill pill-review">{GROUP_LABELS[agent.grp] ?? agent.grp}</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px", lineHeight: 1.5 }}>
              {agent.description}
            </p>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Updated {agent.updated_at.slice(0, 10)}
              {updatedByName !== null && updatedByName !== "" ? ` · ${updatedByName}` : ""}
            </div>

            {/* ---- enabled / kill switch ---- */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 16,
                padding: "12px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                background: enabled ? "var(--bg-card)" : "#FCE8E8",
              }}
            >
              <div
                className={`toggle-switch ${enabled ? "on" : ""}`}
                role="switch"
                aria-checked={enabled}
                aria-label={enabled ? "Disable agent" : "Enable agent"}
                tabIndex={0}
                onClick={() => {
                  setEnabled((v) => !v);
                  markDirty();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEnabled((v) => !v);
                    markDirty();
                  }
                }}
              >
                <div className="thumb" />
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                {enabled ? (
                  <span>
                    <strong>Enabled.</strong> This agent runs whenever its step in the pipeline is
                    triggered.
                  </span>
                ) : (
                  <span style={{ color: "#A32D2D" }}>
                    <strong>Disabled — admin kill switch.</strong> Every run that depends on this
                    agent stops immediately with a message naming this tab. It never falls back
                    silently to the base prompt. Saved with the Save button below.
                  </span>
                )}
              </div>
            </div>

            {/* ---- config form ---- */}
            {sectionLabel("Configuration")}

            <label style={{ marginTop: 0 }} htmlFor="agent-model">
              Model
            </label>
            <select
              id="agent-model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setModelError("");
                markDirty();
              }}
            >
              <option value="">Default ({meta.default_model})</option>
              {meta.model_allowlist
                .filter((m) => m !== "")
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
            {modelError !== "" && (
              <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 5 }}>{modelError}</div>
            )}

            <label htmlFor="agent-instructions">Custom instructions</label>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>
              Appended to the prompt body on every run — base or override. Use for tone, emphasis,
              extra constraints.
            </div>
            <textarea
              id="agent-instructions"
              value={customInstructions}
              onChange={(e) => {
                setCustomInstructions(e.target.value);
                markDirty();
              }}
              placeholder="e.g. Always lead with the program outcome, never the feature."
            />

            <label htmlFor="agent-defaults">Task defaults (JSON)</label>
            {meta.defaults_schema !== "" && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>
                {meta.defaults_schema}
              </div>
            )}
            <textarea
              id="agent-defaults"
              value={defaultsText}
              onChange={(e) => {
                setDefaultsText(e.target.value);
                setDefaultsError("");
                markDirty();
              }}
              style={{ ...MONO, minHeight: 120 }}
            />
            {defaultsError !== "" && (
              <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 5 }}>
                {defaultsError}
              </div>
            )}

            {/* ---- prompt panel ---- */}
            {sectionLabel("Prompt")}

            <label style={{ marginTop: 0 }}>Base prompt (canonical — synced at boot)</label>
            {agent.base_prompt.trim() === "" ? (
              <div className="empty-note" style={{ padding: "6px 0" }}>
                This agent has no fixed base body
                {agent.key === "ask-war-room"
                  ? " — the per-role framing in Task defaults is the prompt body. A full override collapses all roles into one preamble ({{role}} is available)."
                  : "."}
              </div>
            ) : (
              <pre style={PRE_BOX}>{agent.base_prompt}</pre>
            )}

            {meta.placeholders.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {meta.placeholders.map((p) => (
                  <span
                    key={p}
                    className="pill pill-archived"
                    style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}
                    title="Interpolated at run time — usable in the override body"
                  >{`{{${p}}}`}</span>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <div
                className={`toggle-switch ${overrideOn ? "on" : ""}`}
                role="switch"
                aria-checked={overrideOn}
                aria-label="Use full prompt override"
                tabIndex={0}
                onClick={() => {
                  setOverrideOn((v) => !v);
                  markDirty();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOverrideOn((v) => !v);
                    markDirty();
                  }
                }}
              >
                <div className="thumb" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Use full override</span>
              {overrideOn && (
                <a
                  role="button"
                  tabIndex={0}
                  onClick={clearOverride}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") clearOverride();
                  }}
                  style={{ fontSize: 12.5, cursor: "pointer", marginLeft: "auto" }}
                >
                  Clear override
                </a>
              )}
            </div>
            {overrideOn && (
              <textarea
                aria-label="Prompt override body"
                value={overrideText}
                onChange={(e) => {
                  setOverrideText(e.target.value);
                  markDirty();
                }}
                style={{ ...MONO, minHeight: 200, marginTop: 8 }}
              />
            )}

            <div
              className="card"
              style={{
                background: "var(--teal-darkest)",
                border: "1px solid var(--teal-darkest)",
                color: "#E6F2F5",
                marginTop: 14,
                marginBottom: 0,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#8FBFC9",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <i className="fa-solid fa-lock" style={{ fontSize: 10 }} /> Always appended —
                locked. Overrides cannot change the output contract.
              </div>
              <pre
                style={{
                  ...MONO,
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  maxHeight: 180,
                  overflow: "auto",
                  color: "#E6F2F5",
                }}
              >
                {meta.contract_suffix_preview}
              </pre>
            </div>

            {/* ---- test run ---- */}
            {sectionLabel("Test run")}
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>
              Runs the candidate config above — including unsaved edits — against a small sample.
              Nothing is persisted; use it to check output and the contract before saving.
            </div>

            {inputKind === "question_role" && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ marginTop: 0 }} htmlFor="test-question">
                    Question
                  </label>
                  <input
                    id="test-question"
                    value={testQuestion}
                    onChange={(e) => setTestQuestion(e.target.value)}
                    placeholder="e.g. How do we counter Kahua on configurability?"
                  />
                </div>
                <div>
                  <label style={{ marginTop: 0 }} htmlFor="test-role">
                    Role
                  </label>
                  <select
                    id="test-role"
                    value={testRole}
                    onChange={(e) => setTestRole(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {inputKind === "question" && (
              <>
                <label style={{ marginTop: 0 }} htmlFor="test-question">
                  Question
                </label>
                <input
                  id="test-question"
                  value={testQuestion}
                  onChange={(e) => setTestQuestion(e.target.value)}
                  placeholder="e.g. How does Procore position its capital planning module?"
                />
              </>
            )}
            {inputKind === "brief" && (
              <>
                <label style={{ marginTop: 0 }} htmlFor="test-brief">
                  Brief
                </label>
                <textarea
                  id="test-brief"
                  value={testBrief}
                  onChange={(e) => setTestBrief(e.target.value)}
                  placeholder="One or two sentences on what you want this agent to work on."
                  style={{ minHeight: 70 }}
                />
              </>
            )}
            {inputKind === "none" && (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 }}>
                This agent tests against a built-in sample — no input needed.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="btn"
                onClick={() => void runTest(true)}
                disabled={testBusy !== ""}
                title="Compose the prompt without a model call — inspect the body / locked-suffix seam"
              >
                <i className="fa-solid fa-eye" /> Preview prompt
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void runTest(false)}
                disabled={testBusy !== "" || !enabled}
                title={enabled ? "One real model call against the sample" : "Enable the agent first"}
              >
                <i className="fa-solid fa-flask" />{" "}
                {testBusy === "run" ? "Running…" : "Run test"}
              </button>
              {testBusy === "run" && (
                <span style={{ fontSize: 12.5, color: "var(--text-muted)", alignSelf: "center" }}>
                  Calling the model — usually under a minute.
                </span>
              )}
            </div>

            {testError !== "" && (
              <div
                style={{
                  background: "#FCE8E8",
                  color: "#A32D2D",
                  borderRadius: "var(--r-md)",
                  padding: "10px 14px",
                  fontSize: 13,
                  marginTop: 10,
                }}
              >
                Test run failed: {testError}
              </div>
            )}

            {testResult !== null && (
              <div style={{ marginTop: 12 }}>
                {modelHasOutput ? (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {testResult.contract?.checked ? (
                        testResult.contract.ok ? (
                          <span className="pill pill-final">
                            <i className="fa-solid fa-check" style={{ fontSize: 10 }} /> Contract OK
                          </span>
                        ) : (
                          <span className="pill pill-lost">
                            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 10 }} />{" "}
                            Contract BROKEN — fix the override before saving
                          </span>
                        )
                      ) : (
                        <span className="pill pill-archived">No JSON contract — voice guard only</span>
                      )}
                      {testResult.guard?.ok ? (
                        <span className="pill pill-final">Voice guard OK</span>
                      ) : (
                        <span className="pill pill-lost">
                          Voice guard flagged {testResult.guard?.violations.length ?? 0}
                        </span>
                      )}
                      <span className="pill pill-archived">
                        {testResult.model_used} · {testResult.duration_ms} ms
                      </span>
                    </div>
                    {testResult.contract?.checked &&
                      !testResult.contract.ok &&
                      testResult.contract.error !== undefined && (
                        <div style={{ color: "#A32D2D", fontSize: 12.5, marginBottom: 8 }}>
                          {testResult.contract.error}
                        </div>
                      )}
                    {testResult.guard !== undefined && !testResult.guard.ok && (
                      <ul style={{ color: "#A32D2D", fontSize: 12.5, margin: "0 0 8px", paddingLeft: 18 }}>
                        {testResult.guard.violations.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    )}
                    {testResult.output_html !== undefined ? (
                      <div
                        className="prose"
                        style={{ maxHeight: 320, overflow: "auto", padding: "16px 18px" }}
                        dangerouslySetInnerHTML={{ __html: testResult.output_html }}
                      />
                    ) : (
                      <pre style={{ ...PRE_BOX, maxHeight: 320 }}>{testResult.output_raw}</pre>
                    )}
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ fontSize: 12.5, color: "var(--teal-dark)", cursor: "pointer" }}>
                        Composed prompt (body · instructions · locked suffix)
                      </summary>
                      <pre style={{ ...PRE_BOX, marginTop: 8 }}>{testResult.prompt}</pre>
                    </details>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>
                      Prompt preview — no model call was made.
                    </div>
                    <pre style={{ ...PRE_BOX, maxHeight: 320 }}>{testResult.prompt}</pre>
                  </>
                )}
              </div>
            )}

            {/* ---- warnings + footer ---- */}
            {warnings.length > 0 && (
              <div
                style={{
                  background: "#FCF0DA",
                  color: "#8A5A0B",
                  borderRadius: "var(--r-md)",
                  padding: "10px 14px",
                  fontSize: 12.5,
                  marginTop: 18,
                  lineHeight: 1.5,
                }}
              >
                <strong>Saved with warnings:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {saveError !== "" && (
              <div
                style={{
                  background: "#FCE8E8",
                  color: "#A32D2D",
                  borderRadius: "var(--r-md)",
                  padding: "10px 14px",
                  fontSize: 13,
                  marginTop: 18,
                }}
              >
                {saveError}
              </div>
            )}

            <div className="row-between" style={{ marginTop: 18, paddingBottom: 8 }}>
              <button
                className="btn btn-danger"
                onClick={() => setRevertOpen(true)}
                disabled={saveBusy || revertBusy}
              >
                <i className="fa-solid fa-rotate-left" /> Revert to base
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {dirty && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Unsaved changes</span>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => void save()}
                  disabled={saveBusy || !dirty}
                >
                  <i className="fa-solid fa-check" /> {saveBusy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---- revert confirm ---- */}
      {revertOpen && agent !== null && meta !== null && (
        <div className="modalwrap" onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal" role="alertdialog" aria-label="Confirm revert to base">
            <h3>Revert “{agent.name}” to base?</h3>
            <p>This restores the stock configuration:</p>
            <ul style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, paddingLeft: 18, margin: "0 0 8px" }}>
              <li>Clears the full prompt override</li>
              <li>Clears custom instructions</li>
              <li>Resets the model to the default ({meta.default_model})</li>
              <li>Resets task defaults to the registry values</li>
            </ul>
            <p>The enabled/disabled state is kept. Every revert is logged.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button className="btn" onClick={() => setRevertOpen(false)} disabled={revertBusy}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => void doRevert()} disabled={revertBusy}>
                <i className="fa-solid fa-rotate-left" /> {revertBusy ? "Reverting…" : "Revert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
