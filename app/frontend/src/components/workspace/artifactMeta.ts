import type { ArtifactStatus } from "../../lib/api";

// Shared artifact display metadata for the PMM Workspace tables
// (blueprint workspace-tabs §4). Kept out of the page shell so the tab
// components do not import the component that mounts them.

export interface ArtifactListItem {
  id: string;
  title: string;
  asset_type: string;
  product_id: string | null;
  product_name: string | null;
  persona: string | null;
  status: ArtifactStatus;
  current_version: number;
  created_by: string | null;
  updated_at: string;
}

export const STATUS_LABELS: Record<ArtifactStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  final: "Final",
  archived: "Archived",
};

export const STATUS_PILL: Record<ArtifactStatus, string> = {
  draft: "pill-draft",
  in_review: "pill-review",
  final: "pill-final",
  archived: "pill-archived",
};

export const TYPE_ICON: Record<string, string> = {
  "one-pager": "fa-file-lines",
  datasheet: "fa-file-invoice",
  deck: "fa-display",
  faq: "fa-circle-question",
  brochure: "fa-book-open",
  battlecard: "fa-shield-halved",
  banner: "fa-image",
  email: "fa-envelope",
  other: "fa-file",
};

/** Case-insensitive haystack for the shared artifact text filter (§4.1/§4.3). */
export function artifactFilterText(a: ArtifactListItem): string {
  return [a.title, a.persona ?? "", a.product_name ?? "", a.asset_type].join(" ");
}
