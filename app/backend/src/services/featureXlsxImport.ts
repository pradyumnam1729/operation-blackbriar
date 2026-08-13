import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { SupabaseClient } from "@supabase/supabase-js";
import { REPO_ROOT } from "./warRoom";
import { logActivity } from "./activity";
import {
  ParsedFeature,
  SheetMatrix,
  assembleFeatures,
  featureKey,
} from "./featureImport";

// Excel pre-load for the Feature Catalog. Reads the Masterworks workbook,
// assembles features (multi-row), and upserts sub-products + features
// idempotently. This is a BULK PRE-LOAD only — it never touches the normal
// single-add path (POST /api/features) or release-note processing, and every
// imported row is marked origin='xlsx_import' so the UI can badge it as
// unvalidated (draft-gate visibility).

const DEFAULT_WORKBOOK = path.join(
  REPO_ROOT,
  "local-folders",
  "Input",
  "Masterworks 2026 Complete Features List.xlsx"
);

export interface SheetImport {
  sheet: string;
  subProductId: string | null;
  featuresParsed: number;
  created: number;
  updated: number;
  error?: string;
}

export interface ImportSummary {
  workbook: string;
  productId: string;
  sheets: SheetImport[];
  totals: { subProducts: number; created: number; updated: number };
}

/** Read a workbook path into a { sheetName -> matrix } map. blankrows:false is
 *  the first line of defense against SheetJS phantom ranges. */
export function readWorkbook(filePath: string): Record<string, SheetMatrix> {
  const wb = XLSX.readFile(filePath);
  const out: Record<string, SheetMatrix> = {};
  for (const name of wb.SheetNames) {
    out[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      blankrows: false,
      defval: null,
    }) as SheetMatrix;
  }
  return out;
}

/** Get-or-create a sub-product by (product_id, name). Idempotent via the
 *  unique (product_id, lower(name)) index — lookup then insert. */
async function ensureSubProduct(
  sb: SupabaseClient,
  productId: string,
  name: string
): Promise<string> {
  const { data: existing } = await sb
    .from("sub_products")
    .select("id")
    .eq("product_id", productId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await sb
    .from("sub_products")
    .insert({ product_id: productId, name })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "sub_product insert failed");
  return data.id as string;
}

async function upsertFeature(
  sb: SupabaseClient,
  productId: string,
  subProductId: string,
  f: ParsedFeature,
  existingByKey: Map<string, string>
): Promise<"created" | "updated"> {
  const fields = {
    capabilities: f.capabilities || null,
    description: f.description,
    value_prop: f.value_prop,
    persona: f.persona,
    origin: "xlsx_import",
    updated_at: new Date().toISOString(),
  };
  const existingId = existingByKey.get(featureKey(subProductId, f.name));
  if (existingId) {
    const { error } = await sb.from("features").update(fields).eq("id", existingId);
    if (error) throw new Error(error.message);
    return "updated";
  }
  const { error } = await sb.from("features").insert({
    product_id: productId,
    sub_product_id: subProductId,
    name: f.name,
    status: "active",
    ...fields,
  });
  if (error) throw new Error(error.message);
  return "created";
}

export interface ImportOptions {
  filePath?: string;
  productId?: string; // the suite anchor product (default: Masterworks suite)
  actorId?: string | null;
}

const MASTERWORKS_SUITE_ID = "11111111-1111-1111-1111-1111111111a0";

/** Import the Masterworks features workbook. Re-running is a no-op on content
 *  (created=0, updated=N) thanks to the (sub_product, name) key. */
export async function importMasterworksWorkbook(
  sb: SupabaseClient,
  opts: ImportOptions = {}
): Promise<ImportSummary> {
  const filePath = opts.filePath ?? DEFAULT_WORKBOOK;
  const productId = opts.productId ?? MASTERWORKS_SUITE_ID;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workbook not found: ${filePath}`);
  }
  const sheets = readWorkbook(filePath);
  const summary: ImportSummary = {
    workbook: path.basename(filePath),
    productId,
    sheets: [],
    totals: { subProducts: 0, created: 0, updated: 0 },
  };

  for (const [sheetName, matrix] of Object.entries(sheets)) {
    const parsed = assembleFeatures(matrix);
    const record: SheetImport = {
      sheet: sheetName,
      subProductId: null,
      featuresParsed: parsed.length,
      created: 0,
      updated: 0,
    };
    if (parsed.length === 0) {
      summary.sheets.push(record); // empty sheet (e.g. "ROW") — recorded, skipped
      continue;
    }
    try {
      const subProductId = await ensureSubProduct(sb, productId, sheetName.trim());
      record.subProductId = subProductId;
      summary.totals.subProducts += 1;

      // One read of this sub-product's existing features → the idempotency map.
      const { data: existing } = await sb
        .from("features")
        .select("id, name")
        .eq("sub_product_id", subProductId);
      const existingByKey = new Map<string, string>();
      for (const e of existing ?? []) {
        existingByKey.set(featureKey(subProductId, e.name), e.id); // featureKey normalizes internally
      }

      for (const f of parsed) {
        const outcome = await upsertFeature(sb, productId, subProductId, f, existingByKey);
        record[outcome] += 1;
        summary.totals[outcome] += 1;
      }
    } catch (err) {
      record.error = (err as Error).message;
    }
    summary.sheets.push(record);
  }

  void logActivity("feature_import", productId, opts.actorId ?? null, "xlsx_imported", {
    workbook: summary.workbook,
    created: summary.totals.created,
    updated: summary.totals.updated,
    subProducts: summary.totals.subProducts,
  });
  return summary;
}
