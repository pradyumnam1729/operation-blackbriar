import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { SortableTable } from "../SortableTable";
import { ExemplarLibraryTable } from "./ExemplarLibraryTable";

// Reference documents tab (blueprint workspace-tabs §4.4–§4.5). Ingested
// knowledge-base documents, sub-tabbed by doc type (one fetch, client-side
// filtering); the "exemplars" sub-tab hosts the curated exemplar library and
// is excluded from "all" (distinct source).

interface KbDocument {
  id: string;
  title: string;
  filename: string | null;
  source: string;
  docType: string;
  aiEnabled: boolean;
  chunkCount: number;
  createdAt: string;
  product: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  upload: "Upload",
  local_folder: "Local folder",
  sharepoint: "SharePoint",
  war_room: "War room",
  manual: "Manual",
};

interface ReferenceDocsTabProps {
  sub: string;
  admin: boolean;
}

export function ReferenceDocsTab({ sub, admin }: ReferenceDocsTabProps) {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<KbDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    apiGet<{ documents: KbDocument[] }>("/api/documents")
      .then((r) => setDocs(r.documents))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (sub === "exemplars") return <ExemplarLibraryTable />;

  const rows = sub === "all" ? docs : docs.filter((d) => d.docType === sub);

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
        <div className="empty-note">Loading documents…</div>
      ) : (
        <SortableTable<KbDocument>
          rows={rows}
          rowKey={(d) => d.id}
          defaultSort={{ key: "ingested", dir: "desc" }}
          emptyNode={
            admin
              ? "No ingested documents of this type. Ingest files from the Uploads console or a connector."
              : "Documents you upload appear here once ingested."
          }
          filter={{
            value: filter,
            onChange: setFilter,
            placeholder: "Filter by title, type, source, product",
            label: "Filter reference documents",
            text: (d) =>
              `${d.title} ${d.docType} ${SOURCE_LABELS[d.source] ?? d.source} ${d.product ?? ""}`,
          }}
          columns={[
            {
              key: "title",
              label: "Title",
              sortable: true,
              sortValue: (d) => d.title,
              render: (d) => (
                <span style={{ fontWeight: 500 }}>
                  <i
                    className="fa-solid fa-file-lines"
                    style={{ color: "var(--teal-dark)", marginRight: 8 }}
                  />
                  {d.title}
                </span>
              ),
            },
            {
              key: "docType",
              label: "Doc type",
              sortable: true,
              hidden: sub !== "all",
              sortValue: (d) => d.docType,
              render: (d) => d.docType,
            },
            {
              key: "source",
              label: "Source",
              sortable: true,
              sortValue: (d) => SOURCE_LABELS[d.source] ?? d.source,
              render: (d) => SOURCE_LABELS[d.source] ?? d.source,
            },
            {
              key: "product",
              label: "Product",
              sortable: true,
              sortValue: (d) => d.product ?? null,
              render: (d) => d.product ?? "—",
            },
            {
              key: "chunks",
              label: "Chunks",
              sortable: true,
              numeric: true,
              sortValue: (d) => d.chunkCount,
              render: (d) => d.chunkCount,
            },
            {
              key: "ai",
              label: "AI",
              sortable: true,
              sortValue: (d) => (d.aiEnabled ? "Enabled" : "Disabled"),
              render: (d) => (
                <span className={`pill ${d.aiEnabled ? "pill-final" : "pill-archived"}`}>
                  {d.aiEnabled ? "Enabled" : "Disabled"}
                </span>
              ),
            },
            {
              key: "ingested",
              label: "Ingested",
              sortable: true,
              numeric: true,
              nowrap: true,
              sortValue: (d) => new Date(d.createdAt).getTime(),
              render: (d) => new Date(d.createdAt).toLocaleDateString(),
            },
            {
              key: "actions",
              label: "",
              nowrap: true,
              hidden: !admin,
              render: () => (
                <button
                  className="btn btn-sm"
                  onClick={() => navigate("/uploads")}
                  title="Manage this document in the Uploads console"
                >
                  <i className="fa-solid fa-sliders" /> Manage
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
