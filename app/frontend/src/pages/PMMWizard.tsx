import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiUpload } from "../lib/api";

// PMM Workspace wizard: step-by-step question set with part track + progress,
// autosave, attach source material, review & submit (per hive 1.html).

interface PmmField {
  key: string;
  label: string;
  type: "text" | "textarea" | "rows";
  placeholder?: string;
  columns?: string[];
  minRows?: number;
}

interface PmmStep {
  part: string;
  code: string;
  title: string;
  help: string;
  kind: "fields" | "group";
  fields?: PmmField[];
  groupFields?: PmmField[];
}

type RowsAnswer = string[][];
type FieldsAnswer = Record<string, string | RowsAnswer>;
type GroupAnswer = Record<string, string>[];
type Answers = Record<string, FieldsAnswer | GroupAnswer>;

interface PmmDoc {
  id: string;
  title: string;
  product: string;
  status: string;
  answers: Answers;
  files: { id: string; filename: string }[];
  progress: { answered: number; total: number };
}

type Phase = "form" | "attach" | "review";

function blankRows(f: PmmField): RowsAnswer {
  return Array.from({ length: f.minRows ?? 3 }, () => (f.columns ?? []).map(() => ""));
}

function blankGroupItem(step: PmmStep): Record<string, string> {
  const o: Record<string, string> = {};
  for (const f of step.groupFields ?? []) o[f.key] = "";
  return o;
}

export function PMMWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<PmmStep[]>([]);
  const [partNames, setPartNames] = useState<Record<string, string>>({});
  const [doc, setDoc] = useState<PmmDoc | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await apiGet<{ steps: PmmStep[]; partNames: Record<string, string> }>("/api/pmm/steps");
      setSteps(s.steps);
      setPartNames(s.partNames);
      const d = await apiGet<{ doc: PmmDoc }>(`/api/pmm/${id}`);
      setDoc(d.doc);
      setAnswers((d.doc.answers as Answers) ?? {});
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const step = steps[stepIdx];
  const parts = useMemo(() => [...new Set(steps.map((s) => s.part))], [steps]);
  const progressPct = steps.length > 0 ? Math.round(((stepIdx + 1) / steps.length) * 100) : 0;

  const save = async (): Promise<boolean> => {
    setSaving(true);
    setError("");
    try {
      await apiPut(`/api/pmm/${id}/answers`, { answers });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    if (!(await save())) return;
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1);
    else setPhase("attach");
    window.scrollTo({ top: 0 });
  };

  const goBack = async () => {
    await save();
    if (phase === "review") setPhase("attach");
    else if (phase === "attach") setPhase("form");
    else if (stepIdx > 0) setStepIdx(stepIdx - 1);
    window.scrollTo({ top: 0 });
  };

  const saveExit = async () => {
    if (await save()) navigate(`/pmm/${id}`);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await apiPut(`/api/pmm/${id}/answers`, { answers });
      await apiPost(`/api/pmm/${id}/submit`);
      navigate(`/pmm/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      form.append("pmm_doc_id", id!);
      await apiUpload("/api/uploads", form);
      const d = await apiGet<{ doc: PmmDoc }>(`/api/pmm/${id}`);
      setDoc(d.doc);
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // ---------- answer mutation helpers ----------
  const setField = (code: string, key: string, value: string) =>
    setAnswers((a) => ({ ...a, [code]: { ...((a[code] as FieldsAnswer) ?? {}), [key]: value } }));

  const setCell = (code: string, key: string, field: PmmField, ri: number, ci: number, value: string) =>
    setAnswers((a) => {
      const fa = { ...((a[code] as FieldsAnswer) ?? {}) };
      const rows = ((fa[key] as RowsAnswer) ?? blankRows(field)).map((r) => [...r]);
      while (rows.length <= ri) rows.push((field.columns ?? []).map(() => ""));
      rows[ri][ci] = value;
      fa[key] = rows;
      return { ...a, [code]: fa };
    });

  const addRow = (code: string, key: string, field: PmmField) =>
    setAnswers((a) => {
      const fa = { ...((a[code] as FieldsAnswer) ?? {}) };
      const rows = ((fa[key] as RowsAnswer) ?? blankRows(field)).map((r) => [...r]);
      rows.push((field.columns ?? []).map(() => ""));
      fa[key] = rows;
      return { ...a, [code]: fa };
    });

  const setGroupField = (code: string, idx: number, key: string, value: string) =>
    setAnswers((a) => {
      const items = [...(((a[code] as GroupAnswer) ?? []) as GroupAnswer)];
      while (items.length <= idx) items.push({});
      items[idx] = { ...items[idx], [key]: value };
      return { ...a, [code]: items };
    });

  const addGroupItem = (s: PmmStep) =>
    setAnswers((a) => ({
      ...a,
      [s.code]: [...(((a[s.code] as GroupAnswer) ?? []) as GroupAnswer), blankGroupItem(s)],
    }));

  const removeGroupItem = (code: string, idx: number) =>
    setAnswers((a) => ({
      ...a,
      [code]: (((a[code] as GroupAnswer) ?? []) as GroupAnswer).filter((_, i) => i !== idx),
    }));

  // ---------- renderers ----------
  const renderField = (code: string, f: PmmField) => {
    const fa = (answers[code] as FieldsAnswer) ?? {};
    if (f.type === "rows") {
      const rows = ((fa[f.key] as RowsAnswer) ?? blankRows(f));
      return (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <label style={{ marginTop: 0 }}>{f.label}</label>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>{(f.columns ?? []).map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri}>
                    {(f.columns ?? []).map((_, ci) => (
                      <td key={ci} style={{ padding: 4 }}>
                        <input
                          value={r[ci] ?? ""}
                          onChange={(e) => setCell(code, f.key, f, ri, ci, e.target.value)}
                          style={{ borderRadius: "var(--r-sm)", fontSize: 12.5, padding: "7px 10px" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => addRow(code, f.key, f)}>
            <i className="fa-solid fa-plus" /> Add row
          </button>
        </div>
      );
    }
    if (f.type === "textarea") {
      return (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <label style={{ marginTop: 0 }}>{f.label}</label>
          <textarea
            value={(fa[f.key] as string) ?? ""}
            placeholder={f.placeholder}
            onChange={(e) => setField(code, f.key, e.target.value)}
          />
        </div>
      );
    }
    return (
      <div key={f.key} style={{ marginBottom: 14 }}>
        <label style={{ marginTop: 0 }}>{f.label}</label>
        <input
          value={(fa[f.key] as string) ?? ""}
          placeholder={f.placeholder}
          onChange={(e) => setField(code, f.key, e.target.value)}
        />
      </div>
    );
  };

  const renderGroup = (s: PmmStep) => {
    const items = ((answers[s.code] as GroupAnswer) ?? []) as GroupAnswer;
    const shown = items.length > 0 ? items : [blankGroupItem(s)];
    return (
      <div>
        {shown.map((it, idx) => (
          <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 14, marginBottom: 12 }}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>
                Persona {idx + 1}
              </span>
              {shown.length > 1 && (
                <button className="btn btn-danger btn-sm" onClick={() => removeGroupItem(s.code, idx)}>
                  <i className="fa-solid fa-trash" />
                </button>
              )}
            </div>
            {(s.groupFields ?? []).map((f) =>
              f.type === "textarea" ? (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={{ marginTop: 0 }}>{f.label}</label>
                  <textarea
                    style={{ minHeight: 64 }}
                    value={it[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setGroupField(s.code, idx, f.key, e.target.value)}
                  />
                </div>
              ) : (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={{ marginTop: 0 }}>{f.label}</label>
                  <input
                    value={it[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setGroupField(s.code, idx, f.key, e.target.value)}
                  />
                </div>
              )
            )}
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => addGroupItem(s)}>
          <i className="fa-solid fa-plus" /> Add persona
        </button>
      </div>
    );
  };

  if (!doc || steps.length === 0) {
    return <div className="empty-note">{error || "Loading…"}</div>;
  }

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <button className="btn btn-sm" onClick={saveExit} disabled={saving}>
          <i className="fa-solid fa-arrow-left" /> Exit
        </button>
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
          {doc.title} · {doc.product}
          {saving && (
            <span style={{ marginLeft: 8 }}>
              <i className="fa-solid fa-spinner fa-spin" /> saving…
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {phase === "form" && step && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 640, margin: "0 auto 10px" }}>
            {parts.map((p) => (
              <span
                key={p}
                className={`pill ${step.part === p ? "pill-live" : "pill-archived"}`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  const target = steps.findIndex((s) => s.part === p);
                  if (target >= 0) {
                    void save().then((ok) => ok && setStepIdx(target));
                  }
                }}
              >
                {p} · {partNames[p] ?? p}
              </span>
            ))}
          </div>
          <div style={{ maxWidth: 640, margin: "0 auto 18px", height: 8, background: "var(--bg-page)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--border)" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--teal-light)", borderRadius: 999, transition: "width .2s ease" }} />
          </div>

          <div className="card" style={{ maxWidth: 640, margin: "0 auto 18px" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
              {step.code} · step {stepIdx + 1} of {steps.length}
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>{step.title}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>{step.help}</p>
            {step.kind === "group" ? renderGroup(step) : (step.fields ?? []).map((f) => renderField(step.code, f))}
          </div>

          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn" onClick={goBack} disabled={saving || (stepIdx === 0 && phase === "form")}>
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            <button className="btn" onClick={saveExit} disabled={saving}>
              Save as draft &amp; exit
            </button>
            <button className="btn btn-primary" onClick={goNext} disabled={saving}>
              {stepIdx === steps.length - 1 ? "Attach files" : "Next"} <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        </>
      )}

      {phase === "attach" && (
        <div className="card" style={{ maxWidth: 640, margin: "18px auto" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Attach source material</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
            Optional — PRDs, call transcripts, research reports. These stay attached for reference;
            they won't be auto-summarized into the document.
          </p>
          <label className="dropzone" style={{ display: "block" }}>
            <i className="fa-solid fa-cloud-arrow-up" />
            {busy ? "Uploading…" : "Drag files here, or click to browse"}
            <br />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>PDF, DOCX, PPTX, TXT, VTT, SRT</span>
            <input type="file" multiple style={{ display: "none" }} onChange={(e) => void uploadFiles(e.target.files)} />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {doc.files.map((f) => (
              <span key={f.id} className="filechip">
                <i className="fa-solid fa-file" /> {f.filename}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button className="btn" onClick={goBack}>
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            <button className="btn btn-primary" onClick={() => setPhase("review")}>
              Review <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="card" style={{ maxWidth: 640, margin: "18px auto" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Review &amp; submit</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
            This goes to the Director of PMM for approval once submitted.
          </p>
          <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: "14px 16px", fontSize: 13 }}>
            <div><strong>{doc.title}</strong> · {doc.product}</div>
            <div style={{ marginTop: 6 }}>
              {doc.progress.answered} of {doc.progress.total} sections answered ·{" "}
              {doc.files.length} reference file{doc.files.length === 1 ? "" : "s"} attached
            </div>
            {doc.progress.answered < doc.progress.total && (
              <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
                Unanswered sections will show as "Not yet provided" — you can still submit and revise later.
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button className="btn" onClick={goBack}>
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? "Submitting…" : "Submit for approval"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
