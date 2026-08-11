import { useMemo, useState } from "react";
import type { ReactNode } from "react";

// Generic client-side sortable/filterable table (blueprint workspace-tabs §4/§5).
// Serves all five PMM Workspace table variants. Sorting and filtering are
// client-side by design — hackathon-scale row counts, no server capability
// needed. Headers are real <button>s so sorting is keyboard-accessible.

export type SortDir = "asc" | "desc";

export interface SortableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Numeric / chronological compare (pair with a sortValue returning a number). */
  numeric?: boolean;
  nowrap?: boolean;
  hidden?: boolean;
  /** Value used for sorting; falls back to render-less cell text when omitted. */
  sortValue?: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
}

export interface TableFilter<T> {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Accessible name for the filter input. */
  label: string;
  /** Haystack the case-insensitive substring filter matches against. */
  text: (row: T) => string;
}

interface SortableTableProps<T> {
  columns: SortableColumn<T>[];
  rows: T[];
  defaultSort: { key: string; dir: SortDir };
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Shown when the dataset itself is empty. */
  emptyNode: ReactNode;
  filter?: TableFilter<T>;
}

function compareValues(a: string | number | null, b: string | number | null, numeric: boolean): number {
  if (numeric) return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

export function SortableTable<T>({
  columns,
  rows,
  defaultSort,
  rowKey,
  onRowClick,
  emptyNode,
  filter,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSort.key);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort.dir);

  const visible = columns.filter((c) => !c.hidden);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const shown = useMemo(() => {
    let out = rows;
    if (filter && filter.value.trim() !== "") {
      const needle = filter.value.trim().toLowerCase();
      out = out.filter((r) => filter.text(r).toLowerCase().includes(needle));
    }
    const col = columns.find((c) => c.key === sortKey);
    if (col?.sortable && col.sortValue) {
      const dir = sortDir === "asc" ? 1 : -1;
      // Nulls pin last UNCONDITIONALLY — outside the direction multiplier, so
      // never-approved / missing values can't float to the top under desc.
      out = [...out].sort((a, b) => {
        const av = col.sortValue!(a);
        const bv = col.sortValue!(b);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return dir * compareValues(av, bv, col.numeric === true);
      });
    }
    return out;
  }, [rows, filter, columns, sortKey, sortDir]);

  const indicator = (key: string) =>
    sortKey !== key ? "fa-sort" : sortDir === "asc" ? "fa-sort-up" : "fa-sort-down";

  return (
    <div>
      {filter && (
        <div style={{ margin: "0 0 12px" }}>
          <input
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            placeholder={filter.placeholder}
            aria-label={filter.label}
            style={{ width: 260, borderRadius: "var(--r-pill)", padding: "8px 16px", fontSize: 13 }}
          />
        </div>
      )}
      {rows.length === 0 ? (
        <div className="empty-note">{emptyNode}</div>
      ) : shown.length === 0 ? (
        <div className="empty-note">No rows match the filter.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {visible.map((c) => (
                  <th key={c.key} aria-sort={c.sortable && sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sortable ? (
                      <button
                        onClick={() => toggleSort(c.key)}
                        aria-label={`Sort by ${c.label}`}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          font: "inherit",
                          color: "inherit",
                          textTransform: "inherit",
                          letterSpacing: "inherit",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          cursor: "pointer",
                        }}
                      >
                        {c.label}
                        <i
                          className={`fa-solid ${indicator(c.key)}`}
                          aria-hidden="true"
                          style={{ fontSize: 10, color: sortKey === c.key ? "var(--teal-dark)" : "var(--text-muted)" }}
                        />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          // Row-level only — nested action buttons keep their
                          // native Enter/Space activation.
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(r);
                          }
                        }
                      : undefined
                  }
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {visible.map((c) => (
                    <td key={c.key} style={c.nowrap ? { whiteSpace: "nowrap" } : undefined}>
                      {c.render ? c.render(r) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
