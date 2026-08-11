import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { openArtifactRender } from "../../lib/assetViewers";
import { SortableTable } from "../SortableTable";
import { MessagingDocsTable } from "./MessagingDocsTable";
import {
  ArtifactListItem,
  artifactFilterText,
  TYPE_ICON,
} from "./artifactMeta";

// Finalized assets tab (blueprint workspace-tabs §4.1–§4.2). Type sub-tabs
// filter one finals dataset client-side; the "messaging" sub-tab swaps in the
// approved messaging documents table (different entity, own columns).

interface FinalAssetsTabProps {
  sub: string;
  /** Noun phrase for the type sub-tab empty state ("datasheets", "FAQs", …). */
  subNoun: string;
  productId: string;
  admin: boolean;
  filterValue: string;
  onFilterChange: (v: string) => void;
}

export function FinalAssetsTab({
  sub,
  subNoun,
  productId,
  admin,
  filterValue,
  onFilterChange,
}: FinalAssetsTabProps) {
  const navigate = useNavigate();
  const [finals, setFinals] = useState<ArtifactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    // Non-admin artifact listing is already final-only server-side; admins
    // filter explicitly so drafts stay out of the finals table.
    if (admin) params.set("status", "final");
    if (productId) params.set("product_id", productId);
    setLoading(true);
    setError("");
    const qs = params.toString();
    apiGet<{ artifacts: ArtifactListItem[] }>(`/api/artifacts${qs === "" ? "" : `?${qs}`}`)
      .then((r) => setFinals(r.artifacts.filter((a) => a.status === "final")))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [admin, productId]);

  if (sub === "messaging") return <MessagingDocsTable />;

  const rows = sub === "all" ? finals : finals.filter((a) => a.asset_type === sub);

  const view = async (a: ArtifactListItem) => {
    setError("");
    try {
      await openArtifactRender(a);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
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
        <div className="empty-note">Loading finalized assets…</div>
      ) : (
        <SortableTable<ArtifactListItem>
          rows={rows}
          rowKey={(a) => a.id}
          defaultSort={{ key: "updated", dir: "desc" }}
          emptyNode={
            sub === "all"
              ? "Nothing finalized yet. Assets appear here once a PMM admin approves them."
              : `No finalized ${subNoun} yet.`
          }
          filter={{
            value: filterValue,
            onChange: onFilterChange,
            placeholder: "Filter by title, persona, product, type",
            label: "Filter finalized assets",
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
              hidden: sub !== "all",
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
                <>
                  <button
                    className="btn btn-sm"
                    onClick={() => void view(a)}
                    title="View the finalized content in a new tab"
                  >
                    <i className="fa-solid fa-eye" /> View
                  </button>{" "}
                  {admin && (
                    <button
                      className="btn btn-sm"
                      onClick={() => navigate(`/library/${a.id}`)}
                      title="Edit in the artifact editor"
                    >
                      <i className="fa-solid fa-pen" /> Edit
                    </button>
                  )}
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
