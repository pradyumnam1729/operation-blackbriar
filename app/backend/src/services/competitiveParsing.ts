// Pure, dependency-free parsing + computation for the competitive module.
// Lives apart from competitive.ts/frameworks.ts so the evidence-discipline
// logic is unit-testable without touching the Claude client or the DB
// (QA S5: behavior this load-bearing must be covered by pure tests).

// ---------- minimal JSON envelope extraction (first { .. last }) ----------

export function extractJsonObject<T>(raw: string): T {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in output");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

// ---------- threat tiers ----------

export interface ThreatTierEntry {
  competitor: string;
  tier: 1 | 2 | 3;
  rationale: string;
  trajectory: "rising" | "stable" | "fading";
  watch_items: string[];
}

export function parseThreatTiers(raw: string): {
  entries: ThreatTierEntry[];
  skipped: { name: string; reason: string }[];
  summary: string | null;
} | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject<Record<string, unknown>>(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.entries)) return null;
  const entries: ThreatTierEntry[] = [];
  for (const e of parsed.entries) {
    const o = e as Record<string, unknown>;
    const tier = Number(o.tier);
    if (typeof o.competitor !== "string" || o.competitor.trim() === "") continue;
    if (![1, 2, 3].includes(tier)) continue;
    if (!["rising", "stable", "fading"].includes(o.trajectory as string)) continue;
    entries.push({
      competitor: o.competitor.trim(),
      tier: tier as 1 | 2 | 3,
      rationale: typeof o.rationale === "string" ? o.rationale : "",
      trajectory: o.trajectory as "rising" | "stable" | "fading",
      watch_items: Array.isArray(o.watch_items)
        ? (o.watch_items as unknown[]).filter((w): w is string => typeof w === "string").slice(0, 3)
        : [],
    });
  }
  if (entries.length === 0) return null;
  const skipped = Array.isArray(parsed.skipped)
    ? (parsed.skipped as Record<string, unknown>[])
        .filter((s) => typeof s?.name === "string")
        .map((s) => ({
          name: s.name as string,
          reason: typeof s.reason === "string" ? s.reason : "insufficient evidence",
        }))
    : [];
  return { entries, skipped, summary: typeof parsed.summary === "string" ? parsed.summary : null };
}

// ---------- SWOT ----------

export interface SwotItem {
  text: string;
  evidence_url: string | null;
}

/** allowedUrls: the exact source URLs that fed the prompt. S/W items must
 *  cite one of them — a URL-shaped hallucination is dropped, not rendered
 *  (QA S4: "cited" means cited FROM the scraped sources). */
export function parseSwot(
  raw: string,
  allowedUrls: Set<string>
): {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
  summary: string | null;
} | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject<Record<string, unknown>>(raw);
  } catch {
    return null;
  }
  const quadrant = (v: unknown, requireUrl: boolean): SwotItem[] | null => {
    if (!Array.isArray(v)) return null;
    const items: SwotItem[] = [];
    for (const entry of v) {
      const o = entry as Record<string, unknown>;
      if (typeof o?.text !== "string" || o.text.trim() === "") continue;
      const url =
        typeof o.evidence_url === "string" && o.evidence_url.trim() !== ""
          ? o.evidence_url.trim().replace(/\/+$/, "")
          : null;
      if (requireUrl) {
        if (!url || !allowedUrls.has(url)) continue; // uncited OR fabricated citation → dropped
        items.push({ text: o.text.trim(), evidence_url: url });
      } else {
        items.push({ text: o.text.trim(), evidence_url: null });
      }
    }
    return items.slice(0, 5);
  };
  const strengths = quadrant(parsed.strengths, true);
  const weaknesses = quadrant(parsed.weaknesses, true);
  const opportunities = quadrant(parsed.opportunities, false);
  const threats = quadrant(parsed.threats, false);
  if (!strengths || !weaknesses || !opportunities || !threats) return null;
  if (strengths.length + weaknesses.length + opportunities.length + threats.length === 0) return null;
  return {
    strengths,
    weaknesses,
    opportunities,
    threats,
    summary: typeof parsed.summary === "string" ? parsed.summary : null,
  };
}

// ---------- positioning-map movement ----------

export interface AxisLike {
  label: string;
  low: string;
  high: string;
}

export interface MapLike {
  id: string;
  createdAt: string;
  xAxis: AxisLike;
  yAxis: AxisLike;
  points: { name: string; type: "aurigo" | "competitor"; x: number; y: number }[];
}

export interface MapMove {
  name: string;
  type: "aurigo" | "competitor";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  dx: number;
  dy: number;
}

export interface MapMovement {
  fromId: string;
  toId: string;
  fromDate: string;
  toDate: string;
  xAxis: AxisLike;
  yAxis: AxisLike;
  moves: MapMove[];
  entered: string[];
  exited: string[];
}

export class AxesMismatchError extends Error {
  constructor() {
    super(
      "These two maps use different axes — movement between them is meaningless. Rebuild with pinned axes to get a comparable series."
    );
  }
}

const sameAxis = (a: AxisLike, b: AxisLike) =>
  a.label === b.label && a.low === b.low && a.high === b.high; // ends too — swapped low/high would sign-flip drift (QA N3)

/** Pure movement computation between two stored maps. Refuses cross-axis
 *  comparison (cross-axis movement is meaningless). */
export function computeMovement(from: MapLike, to: MapLike): MapMovement {
  if (!sameAxis(from.xAxis, to.xAxis) || !sameAxis(from.yAxis, to.yAxis)) {
    throw new AxesMismatchError();
  }
  const fromByName = new Map(from.points.map((p) => [p.name, p]));
  const toByName = new Map(to.points.map((p) => [p.name, p]));
  const moves: MapMove[] = [];
  for (const [name, tp] of toByName) {
    const fp = fromByName.get(name);
    if (!fp) continue;
    moves.push({
      name,
      type: tp.type,
      fromX: fp.x,
      fromY: fp.y,
      toX: tp.x,
      toY: tp.y,
      dx: Math.round((tp.x - fp.x) * 10) / 10,
      dy: Math.round((tp.y - fp.y) * 10) / 10,
    });
  }
  return {
    fromId: from.id,
    toId: to.id,
    fromDate: from.createdAt,
    toDate: to.createdAt,
    xAxis: to.xAxis,
    yAxis: to.yAxis,
    moves: moves.sort((a, b) => Math.abs(b.dx) + Math.abs(b.dy) - (Math.abs(a.dx) + Math.abs(a.dy))),
    entered: [...toByName.keys()].filter((n) => !fromByName.has(n)),
    exited: [...fromByName.keys()].filter((n) => !toByName.has(n)),
  };
}

// ---------- Porter's Five Forces ----------

export const FORCE_KEYS = [
  "rivalry",
  "buyer_power",
  "supplier_power",
  "new_entrants",
  "substitutes",
] as const;
export type ForceKey = (typeof FORCE_KEYS)[number];

export interface ForceFactor {
  text: string;
  basis: "scraped" | "internal" | "inference";
  evidence_url: string | null;
}

export interface Force {
  intensity: "low" | "medium" | "high";
  factors: ForceFactor[];
}

/** Five-forces envelope. Every factor carries its evidence basis; a factor
 *  claiming basis "scraped" must cite a URL that actually fed the prompt or
 *  it is demoted to "inference" (never dropped — the judgment may still be
 *  useful, but it must not masquerade as scraped fact). */
export function parseFiveForces(
  raw: string,
  allowedUrls: Set<string>
): { forces: Record<ForceKey, Force>; summary: string | null } | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject<Record<string, unknown>>(raw);
  } catch {
    return null;
  }
  const forcesRaw = parsed.forces as Record<string, unknown> | undefined;
  if (!forcesRaw || typeof forcesRaw !== "object") return null;
  const forces = {} as Record<ForceKey, Force>;
  for (const key of FORCE_KEYS) {
    const f = forcesRaw[key] as Record<string, unknown> | undefined;
    if (!f || !["low", "medium", "high"].includes(f.intensity as string)) return null;
    const factors: ForceFactor[] = [];
    for (const entry of Array.isArray(f.factors) ? f.factors : []) {
      const o = entry as Record<string, unknown>;
      if (typeof o?.text !== "string" || o.text.trim() === "") continue;
      let basis = ["scraped", "internal", "inference"].includes(o.basis as string)
        ? (o.basis as ForceFactor["basis"])
        : "inference";
      let url =
        typeof o.evidence_url === "string" && o.evidence_url.trim() !== ""
          ? o.evidence_url.trim().replace(/\/+$/, "")
          : null;
      if (basis === "scraped" && (!url || !allowedUrls.has(url))) {
        basis = "inference"; // fabricated or missing citation → demoted, not trusted
        url = null;
      }
      factors.push({ text: o.text.trim(), basis, evidence_url: basis === "scraped" ? url : null });
    }
    if (factors.length === 0) return null;
    forces[key] = { intensity: f.intensity as Force["intensity"], factors: factors.slice(0, 5) };
  }
  return { forces, summary: typeof parsed.summary === "string" ? parsed.summary : null };
}

// ---------- feature / capability matrix ----------

export type CellStatus = "confirmed" | "partial" | "not_confirmed" | "absent_from_sources";

export interface MatrixCell {
  status: CellStatus;
  note: string;
  evidence_url: string | null;
}

export interface MatrixRow {
  capability: string;
  aurigo: { status: CellStatus; note: string };
  competitors: Record<string, MatrixCell>;
}

/** Capability-matrix envelope. Competitor cells claiming "confirmed"/"partial"
 *  must cite a URL from the evidence set — otherwise the cell is demoted to
 *  "not_confirmed" (the evidence rule as a parser, not a prompt hope).
 *  Unknown competitor names are dropped; "absent_from_sources" is a
 *  first-class value, distinct from "they don't have it". */
export function parseFeatureMatrix(
  raw: string,
  allowedCompetitors: Set<string>,
  allowedUrls: Set<string>
): { rows: MatrixRow[]; summary: string | null } | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject<Record<string, unknown>>(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.rows)) return null;
  const STATUSES: CellStatus[] = ["confirmed", "partial", "not_confirmed", "absent_from_sources"];
  const rows: MatrixRow[] = [];
  for (const entry of parsed.rows) {
    const o = entry as Record<string, unknown>;
    if (typeof o?.capability !== "string" || o.capability.trim() === "") continue;
    const aurigoRaw = o.aurigo as Record<string, unknown> | undefined;
    if (!aurigoRaw || !STATUSES.includes(aurigoRaw.status as CellStatus)) continue;
    const compsRaw = o.competitors as Record<string, unknown> | undefined;
    if (!compsRaw || typeof compsRaw !== "object") continue;
    const competitors: Record<string, MatrixCell> = {};
    for (const [name, cellRaw] of Object.entries(compsRaw)) {
      if (!allowedCompetitors.has(name)) continue; // hallucinated competitor → dropped
      const cell = cellRaw as Record<string, unknown>;
      let status = STATUSES.includes(cell?.status as CellStatus)
        ? (cell.status as CellStatus)
        : "not_confirmed";
      let url =
        typeof cell?.evidence_url === "string" && cell.evidence_url.trim() !== ""
          ? cell.evidence_url.trim().replace(/\/+$/, "")
          : null;
      if ((status === "confirmed" || status === "partial") && (!url || !allowedUrls.has(url))) {
        status = "not_confirmed"; // positive claim without a real citation → demoted
        url = null;
      }
      competitors[name] = {
        status,
        note: typeof cell?.note === "string" ? cell.note : "",
        evidence_url: status === "confirmed" || status === "partial" ? url : null,
      };
    }
    if (Object.keys(competitors).length === 0) continue;
    rows.push({
      capability: o.capability.trim(),
      aurigo: {
        status: aurigoRaw.status as CellStatus,
        note: typeof aurigoRaw.note === "string" ? aurigoRaw.note : "",
      },
      competitors,
    });
  }
  if (rows.length === 0) return null;
  return { rows: rows.slice(0, 15), summary: typeof parsed.summary === "string" ? parsed.summary : null };
}
