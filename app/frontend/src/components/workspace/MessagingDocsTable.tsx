import { useEffect, useState } from "react";
import { apiGet } from "../../lib/api";
import { openMessagingDoc } from "../../lib/assetViewers";
import { SortableTable } from "../SortableTable";

// Finalized assets → Messaging documents sub-tab (blueprint workspace-tabs §4.2).
// Approved P&M documents are finalized deliverables too — the questionnaire
// pipeline's output, published to the war room on approval.

export interface ApprovedMessagingDoc {
  id: string;
  version: number;
  status: string;
  title: string;
  approved_at: string | null;
  war_room_path: string | null;
  products: { name: string } | null;
}

export function MessagingDocsTable() {
  const [docs, setDocs] = useState<ApprovedMessagingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    apiGet<{ docs: ApprovedMessagingDoc[] }>("/api/messaging-docs")
      .then((r) => setDocs(r.docs))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const view = async (d: ApprovedMessagingDoc) => {
    setError("");
    try {
      await openMessagingDoc(d);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <div className="empty-note">Loading messaging documents…</div>;

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
      <SortableTable<ApprovedMessagingDoc>
        rows={docs}
        rowKey={(d) => d.id}
        defaultSort={{ key: "approved", dir: "desc" }}
        emptyNode="No approved messaging documents yet. Approve one from the Positioning & messaging tab."
        filter={{
          value: filter,
          onChange: setFilter,
          placeholder: "Filter documents",
          label: "Filter messaging documents",
          text: (d) => `${d.title} ${d.products?.name ?? ""}`,
        }}
        columns={[
          {
            key: "document",
            label: "Document",
            sortable: true,
            sortValue: (d) => d.title,
            render: (d) => (
              <span style={{ fontWeight: 500 }}>
                <i
                  className="fa-solid fa-file-signature"
                  style={{ color: "var(--teal-dark)", marginRight: 8 }}
                />
                {d.title}
              </span>
            ),
          },
          {
            key: "product",
            label: "Product",
            sortable: true,
            sortValue: (d) => d.products?.name ?? null,
            render: (d) => d.products?.name ?? "—",
          },
          {
            key: "version",
            label: "Version",
            sortable: true,
            numeric: true,
            sortValue: (d) => d.version,
            render: (d) => `v${d.version}`,
          },
          {
            key: "approved",
            label: "Approved",
            sortable: true,
            numeric: true,
            nowrap: true,
            sortValue: (d) => (d.approved_at ? new Date(d.approved_at).getTime() : null),
            render: (d) => (d.approved_at ? new Date(d.approved_at).toLocaleDateString() : "—"),
          },
          {
            key: "war_room_path",
            label: "War room path",
            render: (d) => (
              <span style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                {d.war_room_path ?? "—"}
              </span>
            ),
          },
          {
            key: "actions",
            label: "",
            nowrap: true,
            render: (d) => (
              <button
                className="btn btn-sm"
                onClick={() => void view(d)}
                title="View the published document"
              >
                <i className="fa-solid fa-eye" /> View
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
