import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { SortableTable } from "../SortableTable";
import {
  ArtifactListItem,
  artifactFilterText,
  STATUS_LABELS,
  STATUS_PILL,
  TYPE_ICON,
} from "./artifactMeta";

// In progress / My drafts tab (blueprint workspace-tabs §4.3). One fetch
// serves all four status sub-tabs; filtering is client-side. This tab is a
// worklist, so rows click through to the editor (unlike finals).

interface InProgressTabProps {
  sub: string;
  productId: string;
  admin: boolean;
  filterValue: string;
  onFilterChange: (v: string) => void;
}

export function InProgressTab({
  sub,
  productId,
  admin,
  filterValue,
  onFilterChange,
}: InProgressTabProps) {
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<ArtifactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (productId) params.set("product_id", productId);
    // Non-admins get their own artifacts (any status) via mine=1 — exactly
    // today's backend rule. Admins opt in with the "My artifacts" checkbox.
    if (!admin || mine) params.set("mine", "1");
    setLoading(true);
    setError("");
    const qs = params.toString();
    apiGet<{ artifacts: ArtifactListItem[] }>(`/api/artifacts${qs === "" ? "" : `?${qs}`}`)
      .then((r) => setArtifacts(r.artifacts))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [admin, mine, productId]);

  // Finals live on the Finalized assets tab — never double-listed here.
  const rows = artifacts.filter((a) => {
    if (a.status === "final") return false;
    if (sub === "draft") return a.status === "draft";
    if (sub === "review") return a.status === "in_review";
    if (sub === "archived") return a.status === "archived";
    return true; // all
  });

  return (
    <div>
      {admin && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            margin: "0 0 12px",
            whiteSpace: "nowrap",
            fontWeight: 400,
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
            style={{ width: "auto" }}
          />
          My artifacts
        </label>
      )}
      {error && (
        <div
          style={{
            marginBottom: 12,
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
      {loading ? (
        <div className="empty-note">Loading artifacts…</div>
      ) : (
        <SortableTable<ArtifactListItem>
          rows={rows}
          rowKey={(a) => a.id}
          defaultSort={{ key: "updated", dir: "desc" }}
          onRowClick={(a) => navigate(`/library/${a.id}`)}
          emptyNode={
            admin
              ? "Nothing in progress. Create a new artifact or generate one in the Asset studio."
              : "You have no drafts yet. Generated assets you save land here."
          }
          filter={{
            value: filterValue,
            onChange: onFilterChange,
            placeholder: "Filter by title, persona, product, type",
            label: "Filter in-progress artifacts",
            text: artifactFilterText,
          }}
          columns={[
            {
              key: "name",
              label: "Name",
              sortable: true,
              sortValue: (a) => a.title,
              render: (a) => (
                <span style={{ fontWeight: 500 }}>
                  <i
                    className={`fa-solid ${TYPE_ICON[a.asset_type] ?? "fa-file"}`}
                    style={{ color: "var(--teal-dark)", marginRight: 8 }}
                  />
                  {a.title}
                </span>
              ),
            },
            {
              key: "type",
              label: "Type",
              sortable: true,
              sortValue: (a) => a.asset_type,
              render: (a) => a.asset_type,
            },
            {
              key: "product",
              label: "Product",
              sortable: true,
              sortValue: (a) => a.product_name ?? null,
              render: (a) => a.product_name ?? "—",
            },
            {
              key: "persona",
              label: "Persona",
              sortable: true,
              sortValue: (a) => a.persona ?? null,
              render: (a) => a.persona ?? "—",
            },
            {
              key: "status",
              label: "Status",
              sortable: true,
              sortValue: (a) => STATUS_LABELS[a.status],
              render: (a) => (
                <span className={`pill ${STATUS_PILL[a.status]}`}>{STATUS_LABELS[a.status]}</span>
              ),
            },
            {
              key: "version",
              label: "Version",
              sortable: true,
              numeric: true,
              sortValue: (a) => a.current_version,
              render: (a) => `v${a.current_version}`,
            },
            {
              key: "updated",
              label: "Updated",
              sortable: true,
              numeric: true,
              nowrap: true,
              sortValue: (a) => new Date(a.updated_at).getTime(),
              render: (a) => new Date(a.updated_at).toLocaleDateString(),
            },
            {
              key: "actions",
              label: "",
              nowrap: true,
              render: (a) => (
                <button
                  className="btn btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/library/${a.id}`);
                  }}
                  title="Open in the artifact editor"
                >
                  <i className="fa-solid fa-pen-to-square" /> Open
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
