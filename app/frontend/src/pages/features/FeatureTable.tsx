import { Fragment, useMemo, useState } from "react";
import { FeatureRecord, FeatureStatus } from "../../lib/api";
import { SUBPRODUCT_LABEL } from "./labels";
import { splitCapabilities, splitPersonas } from "./FeatureCards";

// QuickBase-style data table for the Feature Catalog. Everything below —
// global search, per-column filters, sort, column visibility, row expansion —
// runs client-side over the fetched scope (blueprint 07 §3: ~250 rows, no
// per-keystroke API calls).

type ColKey =
  | "name"
  | "sub_product"
  | "description"
  | "value_prop"
  | "persona"
  | "status"
  | "origin"
  | "created_at";

interface ColDef {
  key: ColKey;
  label: string;
  /** name is the anchor column — always shown, can't be toggled off. */
  locked?: boolean;
}

const COLUMNS: ColDef[] = [
  { key: "name", label: "Feature name", locked: true },
  { key: "sub_product", label: SUBPRODUCT_LABEL },
  { key: "description", label: "Capability summary" },
  { key: "value_prop", label: "Value prop" },
  { key: "persona", label: "Persona" },
  { key: "status", label: "Status" },
  { key: "origin", label: "Source" },
  { key: "created_at", label: "Created" },
];

const STATUS_LABEL: Record<FeatureStatus, { cls: string; label: string }> = {
  active: { cls: "pill-live", label: "Live" },
  changed: { cls: "pill-changed", label: "Changed" },
  deprecated: { cls: "pill-deprecated", label: "Deprecated" },
};

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  name: true,
  sub_product: true,
  description: true,
  value_prop: true,
  persona: true,
  status: true,
  origin: false,
  created_at: false,
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isImported(f: FeatureRecord): boolean {
  return f.origin === "xlsx_import";
}

type SortState = { key: ColKey; dir: "asc" | "desc" } | null;

function sortValue(f: FeatureRecord, key: ColKey): string | number {
  switch (key) {
    case "name":
      return f.name?.toLowerCase() ?? "";
    case "sub_product":
      return f.sub_product_name?.toLowerCase() ?? "";
    case "description":
      return f.description?.toLowerCase() ?? "";
    case "value_prop":
      return f.value_prop?.toLowerCase() ?? "";
    case "persona":
      return f.persona?.toLowerCase() ?? "";
    case "status":
      return f.status;
    case "origin":
      return f.origin ?? "";
    case "created_at":
      return f.created_at ? new Date(f.created_at).getTime() : 0;
  }
}

function compare(a: FeatureRecord, b: FeatureRecord, key: ColKey, dir: "asc" | "desc"): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  let r = 0;
  if (typeof av === "number" && typeof bv === "number") r = av - bv;
  else r = String(av).localeCompare(String(bv));
  return dir === "asc" ? r : -r;
}

interface FeatureTableProps {
  features: FeatureRecord[];
  isAdmin: boolean;
  busy: boolean;
  onDelete: (id: string, name: string) => void;
}

export function FeatureTable({ features, isAdmin, busy, onDelete }: FeatureTableProps) {
  const [search, setSearch] = useState("");
  const [subFilter, setSubFilter] = useState<Set<string>>(new Set());
  const [personaFilter, setPersonaFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [nameContains, setNameContains] = useState("");
  const [descContains, setDescContains] = useState("");
  const [valueContains, setValueContains] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(DEFAULT_VISIBLE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"filters" | "columns" | null>(null);

  // ---- option lists derived from the loaded scope ----
  const subOptions = useMemo(
    () =>
      Array.from(new Set(features.map((f) => f.sub_product_name).filter((s): s is string => !!s))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [features]
  );
  const personaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of features) for (const p of splitPersonas(f.persona)) set.add(p);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [features]);
  const statusOptions = useMemo(
    () => Array.from(new Set(features.map((f) => f.status))) as FeatureStatus[],
    [features]
  );

  // ---- filter ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nc = nameContains.trim().toLowerCase();
    const dc = descContains.trim().toLowerCase();
    const vc = valueContains.trim().toLowerCase();
    const rows = features.filter((f) => {
      if (q) {
        const hay = `${f.name ?? ""} ${f.description ?? ""} ${f.value_prop ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (nc && !(f.name ?? "").toLowerCase().includes(nc)) return false;
      if (dc && !(f.description ?? "").toLowerCase().includes(dc)) return false;
      if (vc && !(f.value_prop ?? "").toLowerCase().includes(vc)) return false;
      if (subFilter.size > 0 && !(f.sub_product_name && subFilter.has(f.sub_product_name))) return false;
      if (personaFilter.size > 0) {
        const ps = splitPersonas(f.persona);
        if (!ps.some((p) => personaFilter.has(p))) return false;
      }
      if (statusFilter.size > 0 && !statusFilter.has(f.status)) return false;
      return true;
    });
    // Default sort: Sub-product → Feature name; else the chosen key, name as tiebreak.
    const sorted = [...rows];
    if (sort) {
      sorted.sort((a, b) => compare(a, b, sort.key, sort.dir) || compare(a, b, "name", "asc"));
    } else {
      sorted.sort((a, b) => compare(a, b, "sub_product", "asc") || compare(a, b, "name", "asc"));
    }
    return sorted;
  }, [features, search, nameContains, descContains, valueContains, subFilter, personaFilter, statusFilter, sort]);

  const visibleCols = COLUMNS.filter((c) => c.locked || visible[c.key]);
  // chevron + visible data cols + optional actions
  const colSpan = visibleCols.length + 1 + (isAdmin ? 1 : 0);

  const toggleSort = (key: ColKey) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null; // third click clears back to the default sort
    });
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (nameContains.trim() ? 1 : 0) +
    (descContains.trim() ? 1 : 0) +
    (valueContains.trim() ? 1 : 0) +
    subFilter.size +
    personaFilter.size +
    statusFilter.size;

  const clearAll = () => {
    setSearch("");
    setNameContains("");
    setDescContains("");
    setValueContains("");
    setSubFilter(new Set());
    setPersonaFilter(new Set());
    setStatusFilter(new Set());
  };

  // ---- active-filter chips ----
  const chips: { label: string; onClear: () => void }[] = [];
  if (search.trim()) chips.push({ label: `Search: “${search.trim()}”`, onClear: () => setSearch("") });
  if (nameContains.trim())
    chips.push({ label: `Name ~ “${nameContains.trim()}”`, onClear: () => setNameContains("") });
  if (descContains.trim())
    chips.push({ label: `Summary ~ “${descContains.trim()}”`, onClear: () => setDescContains("") });
  if (valueContains.trim())
    chips.push({ label: `Value ~ “${valueContains.trim()}”`, onClear: () => setValueContains("") });
  subFilter.forEach((s) =>
    chips.push({ label: `${SUBPRODUCT_LABEL}: ${s}`, onClear: () => toggleIn(setSubFilter, s) })
  );
  personaFilter.forEach((p) =>
    chips.push({ label: `Persona: ${p}`, onClear: () => toggleIn(setPersonaFilter, p) })
  );
  statusFilter.forEach((s) =>
    chips.push({
      label: `Status: ${STATUS_LABEL[s as FeatureStatus].label}`,
      onClear: () => toggleIn(setStatusFilter, s),
    })
  );

  const sortIcon = (key: ColKey) => {
    if (!sort || sort.key !== key)
      return <i className="fa-solid fa-sort" style={{ fontSize: 9, marginLeft: 6, color: "var(--text-muted)" }} />;
    return (
      <i
        className={`fa-solid fa-sort-${sort.dir === "asc" ? "up" : "down"}`}
        style={{ fontSize: 9, marginLeft: 6, color: "var(--teal-dark)" }}
      />
    );
  };

  const renderCell = (f: FeatureRecord, key: ColKey) => {
    switch (key) {
      case "name":
        return <strong style={{ fontWeight: 500 }}>{f.name}</strong>;
      case "sub_product":
        return f.sub_product_name ?? "—";
      case "description":
        return <span style={{ color: "var(--text-secondary)" }}>{f.description ?? "—"}</span>;
      case "value_prop":
        return f.value_prop ?? "—";
      case "persona": {
        const ps = splitPersonas(f.persona);
        if (ps.length === 0) return "—";
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
            {ps.map((p) => (
              <span key={p} className="pill pill-archived">
                {p}
              </span>
            ))}
          </span>
        );
      }
      case "status":
        return (
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            <span className={`pill ${STATUS_LABEL[f.status].cls}`}>{STATUS_LABEL[f.status].label}</span>
            {isImported(f) && (
              <span className="pill pill-changed" title="Imported from spreadsheet — not yet PMM-validated">
                <i className="fa-solid fa-file-import" style={{ fontSize: 9 }} /> Imported
              </span>
            )}
          </span>
        );
      case "origin":
        return isImported(f) ? (
          <span className="pill pill-changed" title="Imported from spreadsheet — not yet PMM-validated">
            Imported
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>Manual</span>
        );
      case "created_at":
        return <span style={{ color: "var(--text-secondary)" }}>{fmtDate(f.created_at)}</span>;
    }
  };

  const textColWidth: Partial<Record<ColKey, number>> = {
    description: 240,
    value_prop: 240,
    name: 200,
  };

  return (
    <div style={{ marginBottom: 18 }}>
      {/* ---- toolbar ---- */}
      <div
        className="row-between"
        style={{ marginBottom: chips.length > 0 ? 10 : 14, position: "relative", zIndex: 5 }}
      >
        <div className="search" style={{ maxWidth: 320, margin: 0 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 12 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, summary, value prop…"
            aria-label="Search features"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="btn btn-sm"
              style={{ border: "none", padding: 2, background: "transparent" }}
              aria-label="Clear search"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, position: "relative" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            {filtered.length} feature{filtered.length === 1 ? "" : "s"}
            {filtered.length !== features.length ? ` of ${features.length}` : ""}
          </span>

          {/* Filters dropdown */}
          <div style={{ position: "relative" }}>
            <button
              className={`btn btn-sm${activeFilterCount > 0 ? " btn-primary" : ""}`}
              onClick={() => setPanel((p) => (p === "filters" ? null : "filters"))}
            >
              <i className="fa-solid fa-filter" style={{ fontSize: 11 }} /> Filters
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            {panel === "filters" && (
              <FilterPanel
                subOptions={subOptions}
                personaOptions={personaOptions}
                statusOptions={statusOptions}
                subFilter={subFilter}
                personaFilter={personaFilter}
                statusFilter={statusFilter}
                nameContains={nameContains}
                descContains={descContains}
                valueContains={valueContains}
                onToggleSub={(v) => toggleIn(setSubFilter, v)}
                onTogglePersona={(v) => toggleIn(setPersonaFilter, v)}
                onToggleStatus={(v) => toggleIn(setStatusFilter, v)}
                setNameContains={setNameContains}
                setDescContains={setDescContains}
                setValueContains={setValueContains}
                onClearAll={clearAll}
                onClose={() => setPanel(null)}
              />
            )}
          </div>

          {/* Columns dropdown */}
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-sm"
              onClick={() => setPanel((p) => (p === "columns" ? null : "columns"))}
            >
              <i className="fa-solid fa-table-columns" style={{ fontSize: 11 }} /> Columns
            </button>
            {panel === "columns" && (
              <Dropdown onClose={() => setPanel(null)} width={220}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>
                  Visible columns
                </div>
                {COLUMNS.map((c) => (
                  <label
                    key={c.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "0 0 6px",
                      fontWeight: 400,
                      color: c.locked ? "var(--text-muted)" : "var(--text-primary)",
                      cursor: c.locked ? "default" : "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={c.locked ? true : visible[c.key]}
                      disabled={c.locked}
                      onChange={() => setVisible((v) => ({ ...v, [c.key]: !v[c.key] }))}
                    />
                    {c.label}
                  </label>
                ))}
              </Dropdown>
            )}
          </div>
        </div>
      </div>

      {/* backdrop to close open dropdowns on outside click */}
      {panel && (
        <div
          onClick={() => setPanel(null)}
          style={{ position: "fixed", inset: 0, zIndex: 4 }}
          aria-hidden
        />
      )}

      {/* ---- active filter chips ---- */}
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, alignItems: "center" }}>
          {chips.map((c, i) => (
            <span
              key={i}
              className="pill pill-live"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {c.label}
              <button
                onClick={c.onClear}
                aria-label={`Remove filter ${c.label}`}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  padding: 0,
                  display: "inline-flex",
                }}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: 10 }} />
              </button>
            </span>
          ))}
          <button className="btn btn-sm" onClick={clearAll} style={{ padding: "3px 10px" }}>
            Clear all
          </button>
        </div>
      )}

      {/* ---- table ---- */}
      {filtered.length === 0 ? (
        <p className="empty-note">No features match the current search or filters.</p>
      ) : (
        <div
          style={{
            overflow: "auto",
            maxHeight: "70vh",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            background: "var(--bg-card)",
          }}
        >
          <table style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 2, width: 34 }} />
                {visibleCols.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "var(--bg-card)",
                      zIndex: 2,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      userSelect: "none",
                    }}
                    title="Sort"
                  >
                    {c.label}
                    {sortIcon(c.key)}
                  </th>
                ))}
                {isAdmin && (
                  <th style={{ position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 2, width: 70 }} />
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const isOpen = expanded.has(f.id);
                const caps = splitCapabilities(f.capabilities);
                return (
                  <Fragment key={f.id}>
                    <tr
                      className="rowhover"
                      onClick={() => toggleExpand(f.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        <i
                          className={`fa-solid fa-chevron-${isOpen ? "down" : "right"}`}
                          style={{ fontSize: 11 }}
                        />
                      </td>
                      {visibleCols.map((c) => (
                        <td
                          key={c.key}
                          style={{
                            maxWidth: textColWidth[c.key],
                            whiteSpace: c.key === "sub_product" || c.key === "created_at" ? "nowrap" : "normal",
                          }}
                        >
                          {renderCell(f, c.key)}
                        </td>
                      ))}
                      {isAdmin && (
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onDelete(f.id, f.name)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={colSpan} style={{ background: "var(--bg-page)" }}>
                          {caps.length > 0 ? (
                            <div>
                              <div
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.03em",
                                  color: "var(--text-secondary)",
                                  marginBottom: 6,
                                }}
                              >
                                Capabilities
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                                {caps.map((cap, i) => (
                                  <li key={i}>{cap}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <span className="empty-note" style={{ padding: 0 }}>
                              No capability detail recorded for this feature.
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- small dropdown shell ----
function Dropdown({
  children,
  onClose,
  width = 240,
}: {
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 6px)",
        width,
        maxHeight: 360,
        overflowY: "auto",
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-2)",
        padding: 14,
        zIndex: 6,
      }}
      role="menu"
    >
      {children}
      <div style={{ textAlign: "right", marginTop: 8 }}>
        <button className="btn btn-sm" onClick={onClose} style={{ padding: "3px 10px" }}>
          Done
        </button>
      </div>
    </div>
  );
}

function CheckGroup({
  title,
  options,
  selected,
  onToggle,
  labelFor,
}: {
  title: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  labelFor?: (v: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
        {title}
      </div>
      {options.map((o) => (
        <label
          key={o}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "0 0 5px",
            fontWeight: 400,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={selected.has(o)}
            onChange={() => onToggle(o)}
          />
          {labelFor ? labelFor(o) : o}
        </label>
      ))}
    </div>
  );
}

function FilterPanel(props: {
  subOptions: string[];
  personaOptions: string[];
  statusOptions: FeatureStatus[];
  subFilter: Set<string>;
  personaFilter: Set<string>;
  statusFilter: Set<string>;
  nameContains: string;
  descContains: string;
  valueContains: string;
  onToggleSub: (v: string) => void;
  onTogglePersona: (v: string) => void;
  onToggleStatus: (v: string) => void;
  setNameContains: (v: string) => void;
  setDescContains: (v: string) => void;
  setValueContains: (v: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  return (
    <Dropdown onClose={props.onClose} width={280}>
      <div style={{ textAlign: "right", marginBottom: 6 }}>
        <button className="btn btn-sm" onClick={props.onClearAll} style={{ padding: "3px 10px" }}>
          Clear all
        </button>
      </div>
      <CheckGroup
        title={SUBPRODUCT_LABEL}
        options={props.subOptions}
        selected={props.subFilter}
        onToggle={props.onToggleSub}
      />
      <CheckGroup
        title="Persona"
        options={props.personaOptions}
        selected={props.personaFilter}
        onToggle={props.onTogglePersona}
      />
      <CheckGroup
        title="Status"
        options={props.statusOptions}
        selected={props.statusFilter}
        onToggle={props.onToggleStatus}
        labelFor={(s) => STATUS_LABEL[s as FeatureStatus].label}
      />
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
          Contains
        </div>
        <input
          value={props.nameContains}
          onChange={(e) => props.setNameContains(e.target.value)}
          placeholder="Feature name contains…"
          style={{ marginBottom: 6 }}
        />
        <input
          value={props.descContains}
          onChange={(e) => props.setDescContains(e.target.value)}
          placeholder="Capability summary contains…"
          style={{ marginBottom: 6 }}
        />
        <input
          value={props.valueContains}
          onChange={(e) => props.setValueContains(e.target.value)}
          placeholder="Value prop contains…"
        />
      </div>
    </Dropdown>
  );
}
