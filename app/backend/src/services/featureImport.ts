// Pure, dependency-free parsing for the Feature Catalog Excel pre-load.
// Split out from featureXlsxImport.ts (which touches SheetJS + the DB) so the
// load-bearing logic — column resolution, multi-row feature assembly,
// idempotency keys, phantom-range defense — is unit-testable in isolation
// (codebase convention: see competitiveParsing.ts / templateRender.ts).

/** A worksheet as a matrix of cells: row 0 is the header. */
export type SheetMatrix = (string | number | null | undefined)[][];

export interface ParsedFeature {
  name: string;
  capabilities: string; // joined bullet lines
  description: string | null; // 1-line capability summary
  value_prop: string | null;
  persona: string | null;
}

/** Column roles we map the sheet headers onto. The Excel headers carry typos
 *  ("capbility") and vary in spacing, so we match on normalized substrings. */
type ColRole = "name" | "capabilities" | "summary" | "value_prop" | "persona";

function normHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Resolve header row → column index per role. Tolerant of the sheet's typos
 *  and column reordering; returns -1 for a role whose column is absent. */
export function resolveColumns(header: (string | number | null | undefined)[]): Record<ColRole, number> {
  const cols: Record<ColRole, number> = {
    name: -1,
    capabilities: -1,
    summary: -1,
    value_prop: -1,
    persona: -1,
  };
  header.forEach((raw, i) => {
    const h = normHeader(raw);
    if (h === "") return;
    if (cols.name === -1 && h.includes("feature name")) cols.name = i;
    else if (cols.capabilities === -1 && h.includes("high level")) cols.capabilities = i;
    else if (cols.value_prop === -1 && (h.includes("value prop") || h.includes("value proposition"))) cols.value_prop = i;
    // "1 line capbility summary" — typo-tolerant: any header with "summary".
    else if (cols.summary === -1 && h.includes("summary")) cols.summary = i;
    else if (cols.persona === -1 && h.includes("persona")) cols.persona = i;
  });
  return cols;
}

/** A sheet is a feature sheet if its header carries a Feature Name column —
 *  true even when it has zero feature rows yet (e.g. the "ROW" tab). Used so
 *  every real product tab becomes a sub-product, empty or not. */
export function isFeatureSheet(sheet: SheetMatrix): boolean {
  if (!Array.isArray(sheet) || sheet.length < 1) return false;
  return resolveColumns(sheet[0] ?? []).name !== -1;
}

function cell(row: (string | number | null | undefined)[], idx: number): string {
  if (idx < 0) return "";
  const v = row[idx];
  return v == null ? "" : String(v).trim();
}

/** Normalize a capabilities cell into individual bullet lines, stripping the
 *  Excel's leading "• " / "- " markers and \r\n artifacts. Whitespace only is
 *  cleaned mechanically; typos in the copy are deliberately left for PMM. */
function bulletLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[•\-•▪✦]\s*/, "").trim())
    .filter((l) => l !== "");
}

/** Stop scanning a sheet after this many consecutive fully-blank rows — SheetJS
 *  can report a phantom range in the tens of thousands (the "Estimation &
 *  Bidding" sheet reports ~139,884 rows). blankrows:false in the reader plus
 *  this guard bounds the assembler regardless of the declared range. */
export const MAX_BLANK_STREAK = 50;

/** Assemble features from a sheet matrix. A row with a non-empty Feature Name
 *  opens a new feature; following rows with an empty Feature Name are
 *  CONTINUATION rows whose capabilities bullet appends to the current feature.
 *  Summary / value-prop / persona are taken from the feature's opening row. */
export function assembleFeatures(sheet: SheetMatrix): ParsedFeature[] {
  if (!Array.isArray(sheet) || sheet.length < 2) return [];
  const cols = resolveColumns(sheet[0] ?? []);
  if (cols.name === -1) return []; // not a feature sheet

  const features: ParsedFeature[] = [];
  let current: (ParsedFeature & { bullets: string[] }) | null = null;
  let blankStreak = 0;

  const flush = () => {
    if (!current) return;
    const { bullets, ...rest } = current;
    features.push({ ...rest, capabilities: bullets.join("\n") });
    current = null;
  };

  for (let r = 1; r < sheet.length; r++) {
    const row = sheet[r] ?? [];
    const isBlank = row.every((c) => c == null || String(c).trim() === "");
    if (isBlank) {
      if (++blankStreak >= MAX_BLANK_STREAK) break;
      continue;
    }
    blankStreak = 0;

    const name = cell(row, cols.name);
    const caps = cell(row, cols.capabilities);
    if (name !== "") {
      flush();
      current = {
        name,
        bullets: bulletLines(caps),
        capabilities: "",
        description: cell(row, cols.summary) || null,
        value_prop: cell(row, cols.value_prop) || null,
        persona: cell(row, cols.persona) || null,
      };
    } else if (current) {
      // Continuation row: append its capability bullet(s) to the open feature.
      current.bullets.push(...bulletLines(caps));
    }
    // A pre-header stray row (no open feature, no name) is ignored.
  }
  flush();
  return features.filter((f) => f.name !== "");
}

// ---------- idempotency keys ----------

/** Case/whitespace-stable feature name for the (sub_product, name) key. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function subProductKey(productId: string, subProductName: string): string {
  return `${productId}::${subProductName.trim().toLowerCase()}`;
}

export function featureKey(subProductId: string, featureName: string): string {
  return `${subProductId}::${normalizeName(featureName)}`;
}
