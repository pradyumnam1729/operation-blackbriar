import { useState } from "react";
import {
  ApiError,
  createTemplate,
  updateTemplate,
  FunnelStage,
  TemplateDetail,
  TemplateFormat,
  TemplateSlot,
  TemplateWriteBody,
} from "../lib/api";

// Admin-only create/edit drawer (blueprint §4.2). MVP is deliberately
// textarea-based: layout body + slots JSON are authored as text and the
// backend's validateTemplateDefinition returns the issue list we render.
// Live preview of unsaved state is V2 — preview always shows saved state.

interface Props {
  /** null = create a new template. */
  template: TemplateDetail | null;
  onClose: () => void;
  onSaved: (t: TemplateDetail) => void;
}

const FORMATS: TemplateFormat[] = ["html", "svg", "deck", "email", "markdown"];
const ASSET_TYPES = [
  "datasheet",
  "one-pager",
  "brochure",
  "banner",
  "deck",
  "email",
  "battlecard",
  "case-study",
  "faq",
];
const STAGES: FunnelStage[] = ["awareness", "consideration", "decision", "expansion"];

const errStrip: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  background: "#FCE8E8",
  borderRadius: "var(--r-md)",
  color: "#A32D2D",
  fontSize: 13,
  fontWeight: 500,
};

export function TemplateEditor({ template, onClose, onSaved }: Props) {
  const creating = template === null;
  const [name, setName] = useState(template?.name ?? "");
  const [assetType, setAssetType] = useState(template?.asset_type ?? "datasheet");
  const [format, setFormat] = useState<TemplateFormat>(template?.format ?? "html");
  const [body, setBody] = useState(template?.body ?? "");
  const [slotsJson, setSlotsJson] = useState(
    JSON.stringify(template?.slots ?? [], null, 2)
  );
  const [productLine, setProductLine] = useState(template?.product_line ?? "");
  const [audience, setAudience] = useState(template?.audience ?? "");
  const [persona, setPersona] = useState(template?.persona ?? "");
  const [funnelStage, setFunnelStage] = useState<FunnelStage | "">(
    template?.funnel_stage ?? ""
  );
  const [exemplarPath, setExemplarPath] = useState(template?.exemplar_path ?? "");
  const [previewColor, setPreviewColor] = useState(template?.preview_color ?? "#015F74");
  const [approved, setApproved] = useState(template?.approved ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const save = async () => {
    setError(null);
    setIssues([]);
    let slots: TemplateSlot[];
    try {
      slots = JSON.parse(slotsJson) as TemplateSlot[];
      if (!Array.isArray(slots)) throw new Error("not an array");
    } catch {
      setError("Slots must be a JSON array — fix the syntax before saving.");
      return;
    }
    const payload: TemplateWriteBody = {
      name: name.trim(),
      asset_type: assetType,
      format,
      body,
      slots,
      product_line: productLine.trim() === "" ? null : productLine.trim(),
      audience: audience.trim() === "" ? null : audience.trim(),
      persona: persona.trim() === "" ? null : persona.trim(),
      funnel_stage: funnelStage === "" ? null : funnelStage,
      exemplar_path: exemplarPath.trim() === "" ? null : exemplarPath.trim(),
      preview_color: previewColor.trim() === "" ? null : previewColor.trim(),
      approved,
    };
    setSaving(true);
    try {
      const saved = creating
        ? await createTemplate(payload)
        : await updateTemplate(template.id, payload);
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body.issues)) {
        setIssues(e.body.issues as string[]);
        setError(e.message);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="drawer"
        style={{ width: 640, maxWidth: "94%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>{creating ? "New template" : "Edit template"}</h2>
          <button className="close" aria-label="Close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <label htmlFor="tpl-name">Name</label>
        <input
          id="tpl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aurigo Datasheet — Overview (US Letter)"
        />

        <div className="grid grid-2" style={{ gap: 12 }}>
          <div>
            <label htmlFor="tpl-type">Asset type</label>
            <select id="tpl-type" value={assetType} onChange={(e) => setAssetType(e.target.value)}>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tpl-format">Format</label>
            <select
              id="tpl-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as TemplateFormat)}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-2" style={{ gap: 12 }}>
          <div>
            <label htmlFor="tpl-line">Product line (optional)</label>
            <input
              id="tpl-line"
              value={productLine}
              onChange={(e) => setProductLine(e.target.value)}
              placeholder="e.g. Masterworks"
            />
          </div>
          <div>
            <label htmlFor="tpl-stage">Funnel stage (optional)</label>
            <select
              id="tpl-stage"
              value={funnelStage}
              onChange={(e) => setFunnelStage(e.target.value as FunnelStage | "")}
            >
              <option value="">—</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor="tpl-audience">Audience (optional)</label>
        <input
          id="tpl-audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g. public-sector capital program owners"
        />

        <label htmlFor="tpl-persona">Persona (optional)</label>
        <input
          id="tpl-persona"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="e.g. Capital Program / PMO Director"
        />

        <label htmlFor="tpl-exemplar">Exemplar path (optional)</label>
        <input
          id="tpl-exemplar"
          value={exemplarPath}
          onChange={(e) => setExemplarPath(e.target.value)}
          placeholder="reference output/Output/…"
        />

        <label htmlFor="tpl-color">Preview color (optional)</label>
        <input
          id="tpl-color"
          value={previewColor}
          onChange={(e) => setPreviewColor(e.target.value)}
          placeholder="#015F74"
        />

        <label htmlFor="tpl-body">
          Layout body ({format === "deck" ? "JSON slide schema" : `${format} with {{slot}} placeholders`})
        </label>
        <textarea
          id="tpl-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12 }}
          placeholder={format === "deck" ? '{"master":{"css":"…"},"slides":[…]}' : "<!doctype html>…{{headline}}…"}
        />

        <label htmlFor="tpl-slots">Slots (JSON array)</label>
        <textarea
          id="tpl-slots"
          value={slotsJson}
          onChange={(e) => setSlotsJson(e.target.value)}
          rows={10}
          style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12 }}
          placeholder='[{"id":"headline","label":"Headline","purpose":"…","max_chars":60,"required":true,"render":"text","source_sections":["B1"]}]'
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
            style={{ width: "auto" }}
          />
          Approved — visible to all roles and usable for generation
        </label>

        <button
          className="btn btn-primary"
          style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
          disabled={saving || name.trim() === "" || body.trim() === ""}
          onClick={save}
          title={
            name.trim() === ""
              ? "Give the template a name first"
              : body.trim() === ""
                ? "Add the layout body first"
                : "Validate and save"
          }
        >
          <i className="fa-solid fa-circle-check" />
          {saving ? "Validating…" : "Validate & save"}
        </button>

        {error && <div style={errStrip}>{error}</div>}
        {issues.length > 0 && (
          <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "#A32D2D", fontSize: 12.5 }}>
            {issues.map((issue, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {issue}
              </li>
            ))}
          </ul>
        )}

        <p className="empty-note" style={{ padding: "10px 0 0" }}>
          Layout is locked at save: generation only fills the named slots from the product&rsquo;s
          approved messaging document. Preview always shows the last saved state.
        </p>
      </div>
    </div>
  );
}
