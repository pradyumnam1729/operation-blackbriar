import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";

// Guardrails: the grounding files behind every Hive output (per hive 1.html).
// List view + inline editor; admin-only.

interface GuardrailFile {
  id: string;
  name: string;
  description: string | null;
  content: string;
  active: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export function Guardrails() {
  const [files, setFiles] = useState<GuardrailFile[]>([]);
  const [editing, setEditing] = useState<GuardrailFile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ files: GuardrailFile[] }>("/api/guardrails");
      setFiles(r.files);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (f: GuardrailFile) => {
    setEditing(f);
    setIsNew(false);
    setName(f.name);
    setContent(f.content);
    window.scrollTo({ top: 0 });
  };

  const openNew = () => {
    setEditing({ id: "", name: "", description: null, content: "", active: true, updatedAt: "", updatedBy: null });
    setIsNew(true);
    setName("");
    setContent("# New guardrail file\n\n");
  };

  const save = async () => {
    if (name.trim() === "") return;
    setBusy(true);
    setError("");
    try {
      if (isNew) await apiPost("/api/guardrails", { name, content });
      else await apiPut(`/api/guardrails/${editing!.id}`, { name, content });
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (f: GuardrailFile) => {
    setBusy(true);
    setError("");
    try {
      await apiPut(`/api/guardrails/${f.id}`, { active: !f.active });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: GuardrailFile) => {
    if (!window.confirm(`Delete guardrail file "${f.name}"? AI outputs stop grounding on it immediately.`)) return;
    setBusy(true);
    try {
      await apiDelete(`/api/guardrails/${f.id}`);
      if (editing?.id === f.id) setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div>
        <button className="btn btn-sm" style={{ marginBottom: 16 }} onClick={() => setEditing(null)}>
          <i className="fa-solid fa-arrow-left" /> Guardrails
        </button>
        <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
          <label style={{ marginTop: 0 }}>File name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label>Content (Markdown)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ minHeight: 380, fontFamily: "Consolas, monospace", fontSize: 13, lineHeight: 1.6 }}
          />
          <div className="row-between" style={{ marginTop: 16 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {isNew
                ? "New file — active immediately after save."
                : `Last updated ${new Date(editing.updatedAt).toLocaleDateString()}${editing.updatedBy ? ` by ${editing.updatedBy}` : ""}`}
            </span>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={busy || name.trim() === ""}
              title={name.trim() === "" ? "Name the file first" : "Save — takes effect within a minute"}
            >
              <i className="fa-solid fa-check" /> Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="pagetitle">
            Guardrails{" "}
            <span className="pill pill-lock" style={{ marginLeft: 6 }}>
              <i className="fa-solid fa-lock" style={{ fontSize: 9 }} /> Admin only
            </span>
          </h1>
          <p className="pagesub">
            The grounding files behind every Hive output — keeps answers consistent no matter who's asking.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <i className="fa-solid fa-plus" /> New file
        </button>
      </div>

      <div style={{ background: "#F2FAFB", border: "1px solid #D7EEF1", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 14, color: "var(--teal-darkest)" }}>
        <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />
        Every answer Hive generates — chat replies, battlecards, generated assets, PMM documents — is
        checked against these files first. Edit with care. (The forbidden-words list itself lives in{" "}
        <code>.claude/hooks/forbidden-words.txt</code> and is enforced in code and CI.)
      </div>

      {error && (
        <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {files.map((f) => (
          <div
            key={f.id}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 0, padding: "14px 18px", opacity: f.active ? 1 : 0.6 }}
          >
            <div style={{ width: 38, height: 38, borderRadius: "var(--r-sm)", background: "#E1F0F2", color: "var(--teal-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="fa-solid fa-file-lines" />
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => openEdit(f)}>
              <div style={{ fontWeight: 500 }}>{f.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{f.description}</div>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              Updated {new Date(f.updatedAt).toLocaleDateString()}
              {f.updatedBy ? ` · ${f.updatedBy}` : ""}
            </span>
            <button
              className={`pill ${f.active ? "pill-final" : "pill-archived"}`}
              style={{ border: "none", cursor: "pointer" }}
              onClick={() => void toggleActive(f)}
              disabled={busy}
              title={f.active ? "Click to stop grounding on this file" : "Click to activate"}
            >
              {f.active ? "Active" : "Inactive"}
            </button>
            <button className="btn btn-sm" onClick={() => openEdit(f)}>
              <i className="fa-solid fa-pen" />
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => void remove(f)} disabled={busy}>
              <i className="fa-solid fa-trash" />
            </button>
          </div>
        ))}
        {files.length === 0 && <div className="empty-note">No guardrail files yet.</div>}
      </div>
    </div>
  );
}
