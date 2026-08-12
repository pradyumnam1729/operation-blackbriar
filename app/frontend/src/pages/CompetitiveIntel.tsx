import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// Competitive Intelligence: grounded comparisons of Aurigo products vs market
// competitors. Competitor facts come only from scraped sources (Jina Reader);
// Aurigo facts come only from the knowledge base + war room.

interface SourceRow {
  url: string;
  label: string | null;
  status: string;
  scraped_at: string | null;
}

interface Competitor {
  id: string;
  name: string;
  website: string | null;
  category: string | null;
  aurigo_product: string | null;
  sources: SourceRow[];
}

interface CompareResult {
  comparisonId: string;
  answerHtml: string;
  competitor: string;
  aurigoProduct: string | null;
  sources: { url: string; label: string | null; scrapedAt: string | null }[];
  aurigoEvidence: { title: string; docType: string }[];
}

interface HistoryRow {
  id: string;
  question: string;
  competitor: string | null;
  aurigoProduct: string | null;
  status: string;
  createdAt: string;
}

interface WatchRow {
  competitor_id: string;
  enabled: boolean;
  cadence_hours: number;
  last_run_at: string | null;
  next_run_at: string | null;
}

interface RunRow {
  id: string;
  competitor_id: string | null;
  kind: string;
  status: string;
  progress: {
    phase?: string;
    discovered?: number;
    scraped?: number;
    changed?: number;
    events_emitted?: number;
    budget_exhausted?: boolean;
  };
  error: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  competitor_id: string;
  competitor: string | null;
  event_type: string;
  severity: "info" | "notable" | "high";
  title: string;
  summary_md: string | null;
  diff_excerpt: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

interface ThreatEntry {
  competitor: string;
  tier: 1 | 2 | 3;
  rationale: string;
  trajectory: "rising" | "stable" | "fading";
  watch_items: string[];
}

interface Analysis {
  id: string;
  frameworkKey: string;
  params: Record<string, unknown>;
  result: unknown;
  summaryHtml: string | null;
  skipped: { name: string; reason: string }[];
  createdAt: string;
}

interface DigestT {
  id: string;
  windowStart: string;
  windowEnd: string;
  contentHtml: string;
  createdAt: string;
}

interface OverviewT {
  tracking: boolean;
  watches: { competitorId: string; competitor: string; enabled: boolean; lastRunAt: string | null }[];
  threatBoard: Analysis | null;
  staleBattlecards: { artifactId: string; competitor: string; title: string | null; reason: string | null }[];
  lastDigest: DigestT | null;
}

interface EventsSummaryT {
  days: number;
  total: number;
  byCompetitor: { competitor: string; info: number; notable: number; high: number }[];
  top: { competitor: string; severity: string; title: string; createdAt: string }[];
}

// Tier badges reuse the severity pill classes from brand.css so threat levels
// read the same as delta severities everywhere on the page.
const TIER_STYLE: Record<number, { label: string; pill: string }> = {
  1: { label: "Tier 1 · Active threat", pill: "pill-lost" },
  2: { label: "Tier 2 · Direct", pill: "pill-review" },
  3: { label: "Tier 3 · Watch", pill: "pill-archived" },
};

const TRAJECTORY_ARROW: Record<string, string> = { rising: "↑ rising", stable: "→ stable", fading: "↓ fading" };

// Overview dashboard: four uniform cards in a 2×2 grid. Every card is the same
// fixed height; the header row stays pinned and long content scrolls inside
// the body area instead of stretching the card.
const DASH_CARD: CSSProperties = { height: 400, display: "flex", flexDirection: "column", marginBottom: 0, minHeight: 0 };
const DASH_HEAD: CSSProperties = { marginBottom: 10, flexShrink: 0 };
const DASH_BODY: CSSProperties = { flex: 1, overflowY: "auto", minHeight: 0 };

// ---------- Five Forces (frameworks tab) ----------
type ForceBasis = "scraped" | "internal" | "inference";
interface ForceFactor {
  text: string;
  basis: ForceBasis;
  evidence_url: string | null;
}
interface ForceT {
  intensity: "low" | "medium" | "high";
  factors: ForceFactor[];
}
interface FiveForcesResult {
  forces: {
    rivalry: ForceT;
    buyer_power: ForceT;
    supplier_power: ForceT;
    new_entrants: ForceT;
    substitutes: ForceT;
  };
}

const INTENSITY_PILL: Record<string, string> = { high: "pill-lost", medium: "pill-pending", low: "pill-review" };

// Small provenance chip on each force factor: scraped links to its evidence,
// inference is visibly muted so analyst judgment never reads as fact.
function BasisChip({ basis, url }: { basis: ForceBasis; url: string | null }) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10,
    fontWeight: 500,
    borderRadius: "var(--r-pill)",
    padding: "1px 7px",
    verticalAlign: "1px",
  };
  if (basis === "scraped") {
    const chip = (
      <span style={{ ...base, background: "#E1F0F2", color: "var(--teal-dark)" }}>
        scraped
        {url && <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 8 }} />}
      </span>
    );
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {chip}
      </a>
    ) : (
      chip
    );
  }
  if (basis === "inference") {
    return (
      <span style={{ ...base, background: "var(--grey-2)", color: "var(--text-muted)" }} title="analyst judgment — not confirmed in evidence">
        inference
      </span>
    );
  }
  return <span style={{ ...base, background: "#E4F4EE", color: "#0E6B4E" }}>internal</span>;
}

function ForceCard({
  title,
  force,
  emphasized = false,
  style,
}: {
  title: string;
  force: ForceT | undefined;
  emphasized?: boolean;
  style?: CSSProperties;
}) {
  if (!force) return null;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderTop: emphasized ? "3px solid var(--teal-dark)" : "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
        background: "var(--bg-card)",
        ...style,
      }}
    >
      <div className="row-between" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</span>
        <span className={`pill ${INTENSITY_PILL[force.intensity] ?? "pill-review"}`}>{force.intensity}</span>
      </div>
      {force.factors.map((f, i) => (
        <div key={i} style={{ fontSize: 12.5, marginBottom: 6, lineHeight: 1.45 }}>
          • {f.text} <BasisChip basis={f.basis} url={f.evidence_url} />
        </div>
      ))}
      {force.factors.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Evidence too thin for honest factors.</div>
      )}
    </div>
  );
}

// ---------- Capability matrix (frameworks tab) ----------
type MatrixStatus = "confirmed" | "partial" | "not_confirmed" | "absent_from_sources";
interface MatrixCellT {
  status: MatrixStatus;
  note: string | null;
  evidence_url?: string | null;
}
interface MatrixRowT {
  capability: string;
  aurigo: { status: MatrixStatus; note: string | null };
  competitors: Record<string, MatrixCellT>;
}

// Status glyph + note. The two "unknown" states are deliberately distinct:
// "?" = we could not confirm it; "—" = their sources never mention it, which
// is NOT the same claim as "they don't have it".
function MatrixCellView({ cell }: { cell: MatrixCellT | undefined }) {
  if (!cell) {
    return (
      <span style={{ color: "var(--text-muted)" }} title="no data returned for this cell">
        —
      </span>
    );
  }
  const glyph =
    cell.status === "confirmed" ? (
      <i className="fa-solid fa-circle-check" style={{ color: "var(--teal-dark)" }} title="confirmed in sources" />
    ) : cell.status === "partial" ? (
      <i className="fa-solid fa-circle-half-stroke" style={{ color: "#8A5A0B" }} title="partial coverage in sources" />
    ) : cell.status === "not_confirmed" ? (
      <span style={{ color: "var(--text-muted)", fontWeight: 600 }} title="not confirmed in available sources">
        ?
      </span>
    ) : (
      <span style={{ color: "var(--text-muted)" }} title="absent from their sources — NOT the same as they don't have it">
        —
      </span>
    );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
      {glyph}
      {cell.note && <span style={{ color: "var(--text-secondary)" }}>{cell.note}</span>}
      {cell.evidence_url && (
        <a href={cell.evidence_url} target="_blank" rel="noopener noreferrer" title="Open the source">
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 9 }} />
        </a>
      )}
    </span>
  );
}

// One card style for a threat-board entry, shared by the Overview threat board
// and the Frameworks threat-tiers view (same data, same rendering).
function ThreatTile({
  entry,
  showTier = true,
  showWatch = false,
  style,
}: {
  entry: ThreatEntry;
  showTier?: boolean;
  showWatch?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "10px 14px", background: "var(--bg-card)", ...style }}
      title={!showWatch && entry.watch_items.length > 0 ? entry.watch_items.join(" · ") : undefined}
    >
      <div style={{ fontWeight: 500, fontSize: 13.5, marginBottom: 5 }}>
        {entry.competitor}{" "}
        <span style={{ fontWeight: 400, fontSize: 12.5, color: "var(--text-secondary)" }}>{TRAJECTORY_ARROW[entry.trajectory]}</span>
      </div>
      {showTier && <span className={`pill ${TIER_STYLE[entry.tier].pill}`}>{TIER_STYLE[entry.tier].label}</span>}
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "6px 0 0" }}>{entry.rationale}</p>
      {showWatch && entry.watch_items.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "5px 0 0" }}>Watch: {entry.watch_items.join(" · ")}</p>
      )}
    </div>
  );
}

const SUGGESTIONS = [
  "Top 3 features vs Kahua for a state DOT deal",
  "How does Procore's AI compare to ours for facility owners?",
  "Where does e-Builder beat us, honestly?",
];

interface PositioningAxis {
  label: string;
  low: string;
  high: string;
}

interface PositioningPoint {
  name: string;
  type: "aurigo" | "competitor";
  x: number;
  y: number;
  size: number;
  note: string | null;
}

interface QuadrantLabels {
  top_left: string;
  top_right: string;
  bottom_left: string;
  bottom_right: string;
}

interface MapParams {
  xAxis?: PositioningAxis;
  yAxis?: PositioningAxis;
  products?: string[];
  competitorIds?: string[];
}

interface PositioningMap {
  id: string;
  xAxis: PositioningAxis;
  yAxis: PositioningAxis;
  quadrants: QuadrantLabels | null;
  points: PositioningPoint[];
  skipped: { name: string; reason: string }[];
  summaryHtml: string | null;
  evidence: { title: string; docType: string }[];
  params: MapParams;
  createdAt: string;
}

// Axis presets the map can be rebuilt around. "Model's choice" lets the AI
// pick the most separating axes from the evidence; the rest pin the axis.
const AXIS_PRESETS: PositioningAxis[] = [
  { label: "Buyer focus", low: "General construction", high: "Public-sector capital programs" },
  { label: "Scope of coverage", low: "Point solution", high: "Full life cycle suite" },
  { label: "AI depth", low: "Bolt-on features", high: "AI-native platform" },
  { label: "Deployment model", low: "Heavy implementation", high: "Fast time to value" },
  { label: "Buyer size", low: "Small teams", high: "Enterprise programs" },
  { label: "Asset orientation", low: "Project delivery", high: "Asset & maintenance management" },
];

const MAP_AURIGO_PRODUCTS = ["Masterworks", "Masterworks AI", "Primus", "Essentials"];

interface Tip {
  x: number;
  y: number;
  title: string;
  note: string | null;
  size: number;
}

/**
 * Industry-standard quadrant chart: tinted quadrants with labels, center
 * cross, evidence-weighted bubble sizes, brand colors, hover tooltips.
 */
function MapChart({ map, onHover }: { map: PositioningMap; onHover: (t: Tip | null) => void }) {
  const W = 820;
  const H = 540;
  const M = { top: 34, right: 34, bottom: 70, left: 82 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const px = (x: number) => M.left + (x / 100) * plotW;
  const py = (y: number) => M.top + plotH - (y / 100) * plotH;
  const radius = (size: number) => 7 + (Math.max(20, Math.min(100, size)) / 100) * 13;

  const quadLabel = (text: string, x: number, y: number, anchor: "start" | "end") => (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={10.5}
      fontWeight={600}
      letterSpacing="0.08em"
      fill="#8CA3AC"
      style={{ textTransform: "uppercase" }}
    >
      {text.toUpperCase()}
    </text>
  );

  // Sort so bigger bubbles render first (small ones stay clickable on top).
  const points = [...map.points].sort((a, b) => b.size - a.size);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="Positioning map"
    >
      {/* quadrant tints */}
      <rect x={M.left} y={M.top} width={plotW / 2} height={plotH / 2} fill="#F3F8F9" />
      <rect x={px(50)} y={M.top} width={plotW / 2} height={plotH / 2} fill="#E9F4F5" />
      <rect x={M.left} y={py(50)} width={plotW / 2} height={plotH / 2} fill="#F8FAFB" />
      <rect x={px(50)} y={py(50)} width={plotW / 2} height={plotH / 2} fill="#F3F8F9" />
      <rect x={M.left} y={M.top} width={plotW} height={plotH} fill="none" stroke="#DCE5E9" />

      {/* center cross */}
      <line x1={px(50)} y1={M.top} x2={px(50)} y2={M.top + plotH} stroke="#C4D3D9" strokeDasharray="5 5" />
      <line x1={M.left} y1={py(50)} x2={M.left + plotW} y2={py(50)} stroke="#C4D3D9" strokeDasharray="5 5" />

      {/* quadrant labels */}
      {map.quadrants && (
        <>
          {quadLabel(map.quadrants.top_left, M.left + 10, M.top + 18, "start")}
          {quadLabel(map.quadrants.top_right, M.left + plotW - 10, M.top + 18, "end")}
          {quadLabel(map.quadrants.bottom_left, M.left + 10, M.top + plotH - 10, "start")}
          {quadLabel(map.quadrants.bottom_right, M.left + plotW - 10, M.top + plotH - 10, "end")}
        </>
      )}

      {/* x axis */}
      <text x={M.left + plotW / 2} y={H - 14} textAnchor="middle" fontSize={13} fontWeight={600} fill="#0B4D5C">
        {map.xAxis.label}
      </text>
      <text x={M.left} y={M.top + plotH + 22} textAnchor="start" fontSize={11} fill="#7C8B94">
        ← {map.xAxis.low}
      </text>
      <text x={M.left + plotW} y={M.top + plotH + 22} textAnchor="end" fontSize={11} fill="#7C8B94">
        {map.xAxis.high} →
      </text>

      {/* y axis */}
      <text
        x={22}
        y={M.top + plotH / 2}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fill="#0B4D5C"
        transform={`rotate(-90 22 ${M.top + plotH / 2})`}
      >
        {map.yAxis.label}
      </text>
      <text x={M.left - 10} y={M.top + plotH - 2} textAnchor="end" fontSize={11} fill="#7C8B94">
        {map.yAxis.low}
      </text>
      <text x={M.left - 10} y={M.top + 12} textAnchor="end" fontSize={11} fill="#7C8B94">
        {map.yAxis.high} ↑
      </text>

      {points.map((p) => {
        const cx = px(p.x);
        const cy = py(p.y);
        const r = radius(p.size);
        const aurigo = p.type === "aurigo";
        const labelLeft = p.x > 70;
        return (
          <g
            key={p.name}
            style={{ cursor: "pointer" }}
            onMouseEnter={(e) =>
              onHover({ x: e.clientX, y: e.clientY, title: p.name, note: p.note, size: p.size })
            }
            onMouseMove={(e) =>
              onHover({ x: e.clientX, y: e.clientY, title: p.name, note: p.note, size: p.size })
            }
            onMouseLeave={() => onHover(null)}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={aurigo ? "#015F74" : "#64748B"}
              fillOpacity={aurigo ? 0.92 : 0.55}
              stroke={aurigo ? "#F8D146" : "#fff"}
              strokeWidth={aurigo ? 2.5 : 1.5}
            />
            {aurigo && <circle cx={cx} cy={cy} r={2.6} fill="#F8D146" />}
            <text
              x={labelLeft ? cx - r - 7 : cx + r + 7}
              y={cy + 4}
              textAnchor={labelLeft ? "end" : "start"}
              fontSize={12.5}
              fontWeight={aurigo ? 600 : 400}
              fill={aurigo ? "#015F74" : "#475569"}
            >
              {p.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function CompetitiveIntel() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const isAdmin = me?.role === "admin";

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [jinaOk, setJinaOk] = useState(true);
  const [question, setQuestion] = useState("");
  const [competitorId, setCompetitorId] = useState("");
  const [product, setProduct] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", website: "", category: "", aurigoProduct: "" });
  const [sourceUrlFor, setSourceUrlFor] = useState<{ id: string; url: string } | null>(null);
  const [tab, setTab] = useState<"overview" | "compare" | "map" | "frameworks" | "deltas">("compare");
  const [overview, setOverview] = useState<OverviewT | null>(null);
  const [eventsSummary, setEventsSummary] = useState<EventsSummaryT | null>(null);
  const [overviewBusy, setOverviewBusy] = useState("");
  const [fwKey, setFwKey] = useState<"threat-tiers" | "swot" | "delta-timeline" | "five-forces" | "feature-matrix">("threat-tiers");
  const [fwAnalysis, setFwAnalysis] = useState<Analysis | null>(null);
  const [fwBusy, setFwBusy] = useState(false);
  const [fwError, setFwError] = useState("");
  const [fwCompetitor, setFwCompetitor] = useState("");
  const [mapHistory, setMapHistory] = useState<PositioningMap[]>([]);
  const [movement, setMovement] = useState<{ moves: { name: string; dx: number; dy: number }[]; entered: string[]; exited: string[] } | null>(null);
  const [movementNote, setMovementNote] = useState("");
  const [watches, setWatches] = useState<Record<string, WatchRow>>({});
  const [liveRuns, setLiveRuns] = useState<Record<string, RunRow>>({});
  const [events, setEvents] = useState<EventRow[]>([]);
  const [severityFilter, setSeverityFilter] = useState<"" | "info" | "notable" | "high">("");
  const [openEvent, setOpenEvent] = useState("");
  const [posMap, setPosMap] = useState<PositioningMap | null>(null);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapError, setMapError] = useState("");
  const [tip, setTip] = useState<Tip | null>(null);

  // Map parameters. "auto" = the model picks the axes; a preset label pins
  // that axis; "custom" uses the free-text axis fields.
  const [xPreset, setXPreset] = useState("auto");
  const [yPreset, setYPreset] = useState("auto");
  const [xCustom, setXCustom] = useState<PositioningAxis>({ label: "", low: "", high: "" });
  const [yCustom, setYCustom] = useState<PositioningAxis>({ label: "", low: "", high: "" });
  const [mapProducts, setMapProducts] = useState<string[]>(["Masterworks", "Primus", "Essentials"]);
  const [mapCompetitors, setMapCompetitors] = useState<string[]>([]);
  const paramsRestored = useRef(false);

  const resolveAxis = (preset: string, custom: PositioningAxis): PositioningAxis | undefined => {
    if (preset === "auto") return undefined;
    if (preset === "custom")
      return custom.label.trim() !== ""
        ? {
            label: custom.label.trim(),
            low: custom.low.trim() || "Low",
            high: custom.high.trim() || "High",
          }
        : undefined;
    return AXIS_PRESETS.find((a) => a.label === preset);
  };

  const loadWatchState = useCallback(async () => {
    try {
      const w = await apiGet<{ watches: WatchRow[] }>("/api/competitive/watches");
      setWatches(Object.fromEntries(w.watches.map((x) => [x.competitor_id, x])));
      const ev = await apiGet<{ events: EventRow[] }>("/api/competitive/events?limit=50");
      setEvents(ev.events);
      // Resume polling any runs still in flight (e.g. after a page refresh).
      const runs = await apiGet<{ runs: RunRow[] }>("/api/competitive/runs?limit=10");
      const live = runs.runs.filter((r) => r.status === "queued" || r.status === "running");
      setLiveRuns(Object.fromEntries(live.map((r) => [r.id, r])));
    } catch {
      // Watch tables may not exist yet (migration 0019 not applied) — the rest
      // of the page keeps working; tracking UI just stays inert.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ jinaConfigured: boolean; competitors: Competitor[] }>(
        "/api/competitive/competitors"
      );
      setCompetitors(r.competitors);
      setJinaOk(r.jinaConfigured);
      const h = await apiGet<{ comparisons: HistoryRow[] }>("/api/competitive/comparisons");
      setHistory(h.comparisons);
      void loadWatchState();
      const m = await apiGet<{ map: PositioningMap | null }>("/api/competitive/positioning-map");
      setPosMap(m.map);
      // Restore the last build's parameters into the controls, once.
      if (m.map && !paramsRestored.current) {
        paramsRestored.current = true;
        const p = m.map.params;
        if (p.xAxis) {
          const preset = AXIS_PRESETS.find((a) => a.label === p.xAxis!.label);
          setXPreset(preset ? preset.label : "custom");
          if (!preset) setXCustom(p.xAxis);
        }
        if (p.yAxis) {
          const preset = AXIS_PRESETS.find((a) => a.label === p.yAxis!.label);
          setYPreset(preset ? preset.label : "custom");
          if (!preset) setYCustom(p.yAxis);
        }
        if (p.products && p.products.length > 0) setMapProducts(p.products);
        if (p.competitorIds && p.competitorIds.length > 0) setMapCompetitors(p.competitorIds);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadWatchState]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll live research runs every 3s; when one finishes, refresh the page data
  // so new sources and delta events appear. In-flight guard prevents overlap
  // when the API is slow; a transient fetch failure keeps the run in the map
  // (runs are never deleted server-side, so polling can safely continue).
  const pollBusy = useRef(false);
  useEffect(() => {
    const ids = Object.keys(liveRuns);
    if (ids.length === 0) return;
    const t = setInterval(async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try {
        for (const id of ids) {
          try {
            const { run } = await apiGet<{ run: RunRow }>(`/api/competitive/runs/${id}`);
            if (run.status === "queued" || run.status === "running") {
              setLiveRuns((m) => ({ ...m, [id]: run }));
            } else {
              setLiveRuns((m) => {
                const next = { ...m };
                delete next[id];
                return next;
              });
              if (run.status === "failed" && run.error) setError(`Research run failed: ${run.error}`);
              void load();
            }
          } catch {
            // transient — keep polling this run
          }
        }
      } finally {
        pollBusy.current = false;
      }
    }, 3_000);
    return () => clearInterval(t);
  }, [liveRuns, load]);

  const track = async (c: Competitor) => {
    setBusyRow(c.id);
    setError("");
    try {
      const r = await apiPost<{ runId: string; kind: string }>(
        `/api/competitive/competitors/${c.id}/track`
      );
      setInfo(
        r.kind === "bootstrap"
          ? `Tracking ${c.name} — running the first research sweep (typed sources, scrape, change detection)…`
          : `Tracking ${c.name} — refreshing its sources…`
      );
      const { run } = await apiGet<{ run: RunRow }>(`/api/competitive/runs/${r.runId}`);
      setLiveRuns((m) => ({ ...m, [run.id]: run }));
      await loadWatchState();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyRow("");
    }
  };

  const untrack = async (c: Competitor) => {
    setBusyRow(c.id);
    try {
      await apiDelete(`/api/competitive/competitors/${c.id}/track`);
      await loadWatchState();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyRow("");
    }
  };

  const loadOverview = useCallback(async () => {
    try {
      const o = await apiGet<OverviewT>("/api/competitive/elt-overview");
      setOverview(o);
      const s = await apiGet<EventsSummaryT>("/api/competitive/events/summary?days=7");
      setEventsSummary(s);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (tab === "overview") void loadOverview();
    if (tab === "map") {
      apiGet<{ maps: PositioningMap[] }>("/api/competitive/positioning-map/history?limit=12")
        .then((r) => setMapHistory(r.maps))
        .catch(() => setMapHistory([]));
    }
    if (tab === "frameworks") {
      if (fwKey === "swot" && !fwCompetitor) {
        setFwAnalysis(null); // never show an arbitrary competitor's SWOT
        return;
      }
      apiGet<{ analysis: Analysis | null }>(`/api/competitive/frameworks/${fwKey}/latest${fwKey === "swot" ? `?competitorId=${fwCompetitor}` : ""}`)
        .then((r) => setFwAnalysis(r.analysis))
        .catch(() => setFwAnalysis(null));
    }
  }, [tab, fwKey, fwCompetitor, loadOverview]);

  const buildFrameworkNow = async () => {
    setFwBusy(true);
    setFwError("");
    try {
      const r = await apiPost<{ analysis: Analysis }>(`/api/competitive/frameworks/${fwKey}/build`, {
        competitorId: fwKey === "swot" ? fwCompetitor || undefined : undefined,
      });
      setFwAnalysis(r.analysis);
      if (fwKey === "threat-tiers") void loadOverview();
    } catch (e) {
      setFwError((e as Error).message);
    } finally {
      setFwBusy(false);
    }
  };

  // Frameworks get the same save-to-workspace affordance as the digest
  // (consistency: three sibling generators, one persistence model).
  const saveFramework = async () => {
    setFwBusy(true);
    setFwError("");
    try {
      const r = await apiPost<{ artifactId: string }>(
        `/api/competitive/frameworks/${fwKey}/save-as-artifact`,
        { competitorId: fwKey === "swot" ? fwCompetitor || undefined : undefined }
      );
      navigate(`/library/${r.artifactId}`);
    } catch (e) {
      setFwError((e as Error).message);
    } finally {
      setFwBusy(false);
    }
  };

  const buildDigestNow = async () => {
    setOverviewBusy("digest");
    setError("");
    try {
      await apiPost("/api/competitive/digest", { windowDays: 7 });
      await loadOverview();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOverviewBusy("");
    }
  };

  const saveDigest = async (id: string) => {
    setOverviewBusy("save");
    try {
      const r = await apiPost<{ artifactId: string }>(`/api/competitive/digests/${id}/save-as-artifact`);
      navigate(`/library/${r.artifactId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOverviewBusy("");
    }
  };

  const regenerateBattlecard = async (artifactId: string) => {
    setOverviewBusy(artifactId);
    setError("");
    try {
      await apiPost(`/api/competitive/battlecards/${artifactId}/regenerate`);
      await loadOverview();
      setInfo("Battlecard regenerated as a new draft version — review it in the library before promoting.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOverviewBusy("");
    }
  };

  const compareWithPrevious = async () => {
    setMovement(null);
    setMovementNote("");
    if (!posMap) return;
    const prev = mapHistory.find(
      (m) =>
        m.id !== posMap.id &&
        new Date(m.createdAt) < new Date(posMap.createdAt) &&
        m.xAxis.label === posMap.xAxis.label &&
        m.yAxis.label === posMap.yAxis.label
    );
    if (!prev) {
      setMovementNote("No earlier build with the same axes — rebuild with pinned axes over time to get a comparable series.");
      return;
    }
    try {
      const r = await apiGet<{ movement: { moves: { name: string; dx: number; dy: number }[]; entered: string[]; exited: string[] } }>(
        `/api/competitive/positioning-map/movement?fromId=${prev.id}&toId=${posMap.id}`
      );
      setMovement(r.movement);
      setMovementNote(`vs build of ${new Date(prev.createdAt).toLocaleDateString()}`);
    } catch (e) {
      setMovementNote((e as Error).message);
    }
  };

  const ackEvent = async (id: string) => {
    try {
      await apiPost(`/api/competitive/events/${id}/ack`);
      setEvents((list) =>
        list.map((e) => (e.id === id ? { ...e, acknowledged_at: new Date().toISOString() } : e))
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runCompare = async (q?: string) => {
    const text = (q ?? question).trim();
    if (text === "" || busy) return;
    setBusy(true);
    setError("");
    setInfo("Scraping fresh sources and building the comparison — this can take up to a minute…");
    setResult(null);
    try {
      const r = await apiPost<CompareResult>("/api/competitive/compare", {
        question: text,
        competitorId: competitorId || undefined,
        product: product || undefined,
      });
      setResult(r);
      setInfo("");
      await load();
    } catch (e) {
      setError((e as Error).message);
      setInfo("");
    } finally {
      setBusy(false);
    }
  };

  const refreshMap = async () => {
    setMapBusy(true);
    setMapError("");
    const xAxis = resolveAxis(xPreset, xCustom);
    const yAxis = resolveAxis(yPreset, yCustom);
    try {
      const r = await apiPost<{ map: PositioningMap }>("/api/competitive/positioning-map/refresh", {
        xAxis: xAxis && yAxis ? xAxis : undefined,
        yAxis: xAxis && yAxis ? yAxis : undefined,
        products: mapProducts,
        competitorIds: mapCompetitors.length > 0 ? mapCompetitors : undefined,
      });
      setPosMap(r.map);
      setMovement(null);
      setMovementNote("");
    } catch (e) {
      setMapError((e as Error).message);
    } finally {
      setMapBusy(false);
    }
  };

  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const saveBattlecard = async () => {
    if (!result) return;
    setBusy(true);
    setError("");
    try {
      const r = await apiPost<{ artifactId: string }>(
        `/api/competitive/comparisons/${result.comparisonId}/battlecard`
      );
      navigate(`/library/${r.artifactId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (id: string) => {
    setError("");
    try {
      const r = await apiGet<{
        comparison: {
          id: string;
          question: string;
          aurigo_product: string | null;
          answer_html: string | null;
          sources: { url: string; label: string | null; scrapedAt?: string | null }[];
          aurigo_evidence: { title: string; docType: string }[];
          competitor: string | null;
          status: string;
          error: string | null;
        };
      }>(`/api/competitive/comparisons/${id}`);
      const c = r.comparison;
      if (c.status !== "ok" || !c.answer_html) {
        setError(`That comparison failed: ${c.error ?? "no answer stored"}`);
        return;
      }
      setResult({
        comparisonId: c.id,
        answerHtml: c.answer_html,
        competitor: c.competitor ?? "Competitor",
        aurigoProduct: c.aurigo_product,
        sources: c.sources.map((s) => ({ url: s.url, label: s.label, scrapedAt: s.scrapedAt ?? null })),
        aurigoEvidence: c.aurigo_evidence ?? [],
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const refreshSources = async (id: string) => {
    setBusyRow(id);
    setError("");
    try {
      const r = await apiPost<{ scraped: number }>(`/api/competitive/competitors/${id}/refresh`);
      setInfo(`Scraped ${r.scraped} source(s).`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyRow("");
    }
  };

  const addCompetitor = async () => {
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/competitive/competitors", addForm);
      setShowAdd(false);
      setAddForm({ name: "", website: "", category: "", aurigoProduct: "" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addSourceUrl = async () => {
    if (!sourceUrlFor) return;
    setBusy(true);
    setError("");
    try {
      await apiPost(`/api/competitive/competitors/${sourceUrlFor.id}/sources`, {
        url: sourceUrlFor.url,
      });
      setSourceUrlFor(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeCompetitor = async (c: Competitor) => {
    if (!window.confirm(`Remove ${c.name} and its scraped sources?`)) return;
    setBusyRow(c.id);
    try {
      await apiDelete(`/api/competitive/competitors/${c.id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyRow("");
    }
  };

  const staleDays = (iso: string | null) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

  return (
    <div>
      <h1 className="pagetitle">Competitive intel</h1>
      <p className="pagesub">
        Grounded comparisons: competitor facts only from freshly scraped sources, Aurigo facts only
        from your knowledge base. Save any answer as a battlecard draft.
      </p>

      {!jinaOk && (
        <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          JINA_API_KEY is not configured in app/backend/.env — scraping is unavailable.
        </div>
      )}
      {error && (
        <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="tab-row" style={{ margin: "4px 0 16px" }}>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          <i className="fa-solid fa-gauge-high" style={{ marginRight: 6 }} /> Overview
        </button>
        <button className={tab === "compare" ? "active" : ""} onClick={() => setTab("compare")}>
          <i className="fa-solid fa-chess" style={{ marginRight: 6 }} /> Compare &amp; registry
        </button>
        <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>
          <i className="fa-solid fa-map-location-dot" style={{ marginRight: 6 }} /> Positioning map
        </button>
        <button className={tab === "frameworks" ? "active" : ""} onClick={() => setTab("frameworks")}>
          <i className="fa-solid fa-table-cells-large" style={{ marginRight: 6 }} /> Frameworks
        </button>
        <button className={tab === "deltas" ? "active" : ""} onClick={() => setTab("deltas")}>
          <i className="fa-solid fa-wave-square" style={{ marginRight: 6 }} /> Deltas
          {events.filter((e) => !e.acknowledged_at).length > 0 && (
            <span className="pill pill-pending" style={{ marginLeft: 6 }}>
              {events.filter((e) => !e.acknowledged_at).length}
            </span>
          )}
        </button>
      </div>

      {/* ---------- overview (ELT) tab: uniform 2×2 dashboard ---------- */}
      {tab === "overview" && (
        <div className="grid grid-2" style={{ alignItems: "stretch", marginBottom: 18 }}>
          {/* threat board */}
          <div className="card" style={DASH_CARD}>
            <div className="row-between" style={DASH_HEAD}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                <i className="fa-solid fa-shield-halved" style={{ color: "var(--teal-dark)", marginRight: 8 }} />
                Threat board
                {overview?.threatBoard && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 10, fontWeight: 400 }}>
                    built {new Date(overview.threatBoard.createdAt).toLocaleString()}
                  </span>
                )}
              </h3>
              <button className="btn btn-sm" onClick={() => { setTab("frameworks"); setFwKey("threat-tiers"); }}>
                <i className="fa-solid fa-arrows-rotate" /> Rebuild in Frameworks
              </button>
            </div>
            <div style={DASH_BODY}>
              {overview?.threatBoard ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {((overview.threatBoard.result as { entries: ThreatEntry[] })?.entries ?? []).map((t) => (
                    <ThreatTile key={t.competitor} entry={t} />
                  ))}
                </div>
              ) : (
                <div className="empty-note">No threat board yet — build one in the Frameworks tab (needs tracked competitors with scraped sources).</div>
              )}
              {overview?.threatBoard?.summaryHtml && (
                <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0, marginTop: 12 }} dangerouslySetInnerHTML={{ __html: overview.threatBoard.summaryHtml }} />
              )}
            </div>
          </div>

          {/* deltas this week */}
          <div className="card" style={DASH_CARD}>
            <div className="row-between" style={DASH_HEAD}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                <i className="fa-solid fa-wave-square" style={{ color: "var(--teal-dark)", marginRight: 8 }} />
                Deltas — last 7 days
              </h3>
              <button className="btn btn-sm" onClick={() => setTab("deltas")}>
                Open the delta feed
              </button>
            </div>
            <div style={DASH_BODY}>
              {eventsSummary && eventsSummary.total > 0 ? (
                <>
                  {eventsSummary.byCompetitor.map((c) => (
                    <div key={c.competitor} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", fontSize: 13 }}>
                      <span style={{ fontWeight: 500, flex: 1 }}>{c.competitor}</span>
                      {c.high > 0 && <span className="pill pill-lost">{c.high} high</span>}
                      {c.notable > 0 && <span className="pill pill-pending">{c.notable} notable</span>}
                      {c.info > 0 && <span className="pill pill-review">{c.info} info</span>}
                    </div>
                  ))}
                  {eventsSummary.top.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      {eventsSummary.top.map((t, i) => (
                        <div key={i} style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{t.competitor}</span> — {t.title}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-note">
                  No competitor changes detected in the window
                  {overview && !overview.tracking ? " — no competitors are being tracked yet. Start in Compare & registry." : " — nothing material moved (that is a valid, verified result)."}
                </div>
              )}
            </div>
          </div>

          {/* battlecard readiness */}
          <div className="card" style={DASH_CARD}>
            <div className="row-between" style={DASH_HEAD}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                <i className="fa-solid fa-file-shield" style={{ color: "var(--teal-dark)", marginRight: 8 }} />
                Battlecard readiness
              </h3>
            </div>
            <div style={DASH_BODY}>
              {overview && overview.staleBattlecards.length > 0 ? (
                overview.staleBattlecards.map((b) => (
                  <div key={b.artifactId} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <span className="pill pill-lost">stale</span>
                    <span style={{ flex: 1, fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{b.competitor}</span>
                      {b.reason && <span style={{ color: "var(--text-secondary)" }}> — {b.reason}</span>}
                    </span>
                    <button className="btn btn-sm" disabled={overviewBusy === b.artifactId} onClick={() => void regenerateBattlecard(b.artifactId)} title="Re-run against fresh sources; lands as a new draft version">
                      <i className={`fa-solid ${overviewBusy === b.artifactId ? "fa-spinner fa-spin" : "fa-rotate"}`} /> Regenerate
                    </button>
                    <button className="btn btn-sm" onClick={() => navigate(`/library/${b.artifactId}`)}>
                      Open
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-note">No stale battlecards — every canonical card is current with its tracked sources.</div>
              )}
              {overview && overview.watches.length > 0 && (
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 10, marginBottom: 0 }}>
                  Watching: {overview.watches.filter((w) => w.enabled).map((w) => w.competitor).join(", ") || "none"}
                </p>
              )}
            </div>
          </div>

          {/* digest */}
          <div className="card" style={DASH_CARD}>
            <div className="row-between" style={DASH_HEAD}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                <i className="fa-solid fa-newspaper" style={{ color: "var(--teal-dark)", marginRight: 8 }} />
                Competitive digest
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" disabled={overviewBusy === "digest"} onClick={() => void buildDigestNow()}>
                  <i className={`fa-solid ${overviewBusy === "digest" ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`} /> Build 7-day digest
                </button>
                {overview?.lastDigest && (
                  <button className="btn btn-sm" disabled={overviewBusy === "save"} onClick={() => void saveDigest(overview.lastDigest!.id)} title="Save to the artifact library as a draft">
                    <i className="fa-solid fa-box-archive" /> Save as draft
                  </button>
                )}
              </div>
            </div>
            <div style={DASH_BODY}>
              {overview?.lastDigest ? (
                <>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
                    {overview.lastDigest.windowStart.slice(0, 10)} → {overview.lastDigest.windowEnd.slice(0, 10)} · built {new Date(overview.lastDigest.createdAt).toLocaleString()}
                  </p>
                  <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0 }} dangerouslySetInnerHTML={{ __html: overview.lastDigest.contentHtml }} />
                </>
              ) : (
                <div className="empty-note">No digest yet. Build one — an explicit "nothing material changed" is a valid digest.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "compare" && (
      <>
      {/* ---------- ask ---------- */}
      <div className="chat-hero">
        <div className="chat-heading">
          <i className="fa-solid fa-chess" /> Compare against the market
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <select value={competitorId} onChange={(e) => setCompetitorId(e.target.value)}>
            <option value="">Auto-detect competitor</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">Auto-pick Aurigo product</option>
            <option value="Primus">Compare vs Primus</option>
            <option value="Masterworks">Compare vs Masterworks</option>
            <option value="Essentials">Compare vs Essentials</option>
          </select>
        </div>
        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            void runCompare();
          }}
        >
          <i className="fa-solid fa-magnifying-glass-chart" style={{ color: "var(--teal-light)", fontSize: 15 }} />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='e.g. "top 3 features vs Kahua", "Kahua AI vs Procore AI"…'
          />
          <button type="submit" className="chat-send" disabled={busy || !jinaOk} title={jinaOk ? "Compare" : "Configure JINA_API_KEY first"}>
            <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-arrow-up"}`} />
          </button>
        </form>
        <div className="chip-row">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="sugg-chip" onClick={() => void runCompare(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
        {info && <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 12, marginBottom: 0 }}>{info}</p>}
      </div>

      {/* ---------- result ---------- */}
      {result && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                Aurigo {result.aurigoProduct ?? ""} vs {result.competitor}
              </h3>
              <button className="btn btn-primary btn-sm" onClick={saveBattlecard} disabled={busy}>
                <i className="fa-solid fa-shield-halved" /> Save as battlecard
              </button>
            </div>
            <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0 }} dangerouslySetInnerHTML={{ __html: result.answerHtml }} />
          </div>
          <div className="card">
            <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>Evidence used</h3>
            <div className="grid grid-2">
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Competitor sources (scraped)
                </div>
                {result.sources.map((s) => (
                  <div key={s.url} style={{ fontSize: 12.5, marginBottom: 6 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10, marginRight: 6 }} />
                      {s.label ?? s.url}
                    </a>
                    {s.scrapedAt && (
                      <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                        scraped {new Date(s.scrapedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Aurigo ground truth (knowledge base)
                </div>
                {result.aurigoEvidence.length === 0 && (
                  <div className="empty-note" style={{ padding: 0 }}>
                    No knowledge-base chunks matched — the answer used war-room content only.
                  </div>
                )}
                {result.aurigoEvidence.map((d, i) => (
                  <div key={i} style={{ fontSize: 12.5, marginBottom: 6 }}>
                    <span className="pill pill-review">{d.docType}</span>{" "}
                    <span style={{ marginLeft: 4 }}>{d.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---------- registry ---------- */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Competitor registry</h3>
          <button className="btn btn-sm" onClick={() => setShowAdd((s) => !s)}>
            <i className="fa-solid fa-plus" /> Add competitor
          </button>
        </div>

        {showAdd && (
          <div style={{ background: "var(--bg-page)", borderRadius: "var(--r-md)", padding: 14, marginBottom: 14 }}>
            <div className="grid grid-4">
              <input placeholder="Name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              <input placeholder="Website (https://…)" value={addForm.website} onChange={(e) => setAddForm({ ...addForm, website: e.target.value })} />
              <input placeholder="Category" value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} />
              <select value={addForm.aurigoProduct} onChange={(e) => setAddForm({ ...addForm, aurigoProduct: e.target.value })}>
                <option value="">Maps to (auto)</option>
                <option>Primus</option>
                <option>Masterworks</option>
                <option>Essentials</option>
              </select>
            </div>
            <p style={{ marginBottom: 0 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={addCompetitor}
                disabled={busy || addForm.name.trim() === ""}
                title={addForm.name.trim() === "" ? "Name the competitor first" : "Add to registry"}
              >
                Add
              </button>
            </p>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Competitor</th>
                <th>Category</th>
                <th>Compared vs</th>
                <th>Sources</th>
                <th>Watch</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => {
                const okSources = c.sources.filter((s) => s.status === "ok");
                const newest = okSources.map((s) => s.scraped_at).sort().reverse()[0] ?? null;
                const age = staleDays(newest);
                const watch = watches[c.id];
                const liveRun = Object.values(liveRuns).find(
                  (r) => r.competitor_id === c.id && (r.status === "queued" || r.status === "running")
                );
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>
                      {c.name}
                      {c.website && (
                        <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, fontSize: 12 }}>
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10 }} />
                        </a>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5 }}>{c.category ?? "—"}</td>
                    <td>{c.aurigo_product ? <span className="pill pill-live">{c.aurigo_product}</span> : <span className="pill pill-pending">auto</span>}</td>
                    <td style={{ fontSize: 12.5 }}>
                      {okSources.length > 0 ? (
                        <>
                          {okSources.length} scraped
                          {age !== null && (
                            <span className={`pill ${age > 30 ? "pill-pending" : "pill-final"}`} style={{ marginLeft: 6 }}>
                              {age === 0 ? "today" : `${age}d old`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="pill pill-pending">none yet</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>
                      {liveRun ? (
                        <span className="pill pill-pending" title={`${liveRun.kind} run in progress`}>
                          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 5 }} />
                          {liveRun.status === "queued"
                            ? "queued"
                            : liveRun.progress.phase ?? "running"}
                          {typeof liveRun.progress.scraped === "number" &&
                            liveRun.progress.scraped > 0 &&
                            ` · ${liveRun.progress.scraped} scraped`}
                        </span>
                      ) : watch?.enabled ? (
                        <>
                          <span className="pill pill-live" title={watch.last_run_at ? `Last run ${new Date(watch.last_run_at).toLocaleString()}` : "No run finished yet"}>
                            <i className="fa-solid fa-satellite-dish" style={{ marginRight: 5 }} />
                            watching
                          </span>{" "}
                          <button className="btn btn-sm" onClick={() => void untrack(c)} disabled={busyRow === c.id} title="Pause the background watch">
                            <i className="fa-solid fa-pause" />
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-sm"
                          onClick={() => void track(c)}
                          disabled={busyRow === c.id || !jinaOk}
                          title="Start background research: typed sources, weekly re-scrape, change detection"
                        >
                          <i className="fa-solid fa-satellite-dish" /> Track
                        </button>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => void refreshSources(c.id)} disabled={busyRow === c.id || !jinaOk} title="Discover + re-scrape sources">
                        <i className={`fa-solid ${busyRow === c.id ? "fa-spinner fa-spin" : "fa-rotate"}`} /> Refresh
                      </button>{" "}
                      <button className="btn btn-sm" onClick={() => setSourceUrlFor({ id: c.id, url: "" })} title="Add a specific source URL">
                        <i className="fa-solid fa-link" />
                      </button>{" "}
                      {isAdmin && (
                        <button className="btn btn-danger btn-sm" onClick={() => void removeCompetitor(c)} disabled={busyRow === c.id}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sourceUrlFor && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <input
              style={{ maxWidth: 420 }}
              placeholder="https://competitor.com/product-page"
              value={sourceUrlFor.url}
              onChange={(e) => setSourceUrlFor({ ...sourceUrlFor, url: e.target.value })}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={addSourceUrl}
              disabled={busy || !/^https?:\/\//i.test(sourceUrlFor.url)}
              title={/^https?:\/\//i.test(sourceUrlFor.url) ? "Add source" : "Enter a full http(s) URL"}
            >
              Add source
            </button>
            <button className="btn btn-sm" onClick={() => setSourceUrlFor(null)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ---------- history ---------- */}
      {history.length > 0 && (
        <div className="card">
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 500 }}>Recent comparisons</h3>
          {history.map((h) => (
            <div
              key={h.id}
              className="rowhover"
              style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 6px", borderBottom: "1px solid var(--border)", cursor: h.status === "ok" ? "pointer" : "default" }}
              onClick={() => h.status === "ok" && void openHistory(h.id)}
            >
              <span className={`pill ${h.status === "ok" ? "pill-final" : "pill-lost"}`}>{h.status}</span>
              <span style={{ fontWeight: 500 }}>{h.competitor ?? "?"}</span>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.question}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(h.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {/* ---------- frameworks tab ---------- */}
      {tab === "frameworks" && (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
            <div className="step-pills" style={{ margin: 0 }}>
              {([
                ["threat-tiers", "Threat tiers"],
                ["swot", "SWOT"],
                ["delta-timeline", "Delta timeline"],
                ["five-forces", "Five Forces"],
                ["feature-matrix", "Capability matrix"],
              ] as const).map(([k, label]) => (
                <button key={k} type="button" className={`step-pill ${fwKey === k ? "active" : ""}`} onClick={() => { setFwKey(k); setFwAnalysis(null); setFwError(""); }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {fwKey === "swot" && (
                <select value={fwCompetitor} onChange={(e) => setFwCompetitor(e.target.value)}>
                  <option value="">Pick a competitor…</option>
                  {competitors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button className="btn btn-primary btn-sm" disabled={fwBusy || (fwKey === "swot" && !fwCompetitor)} onClick={() => void buildFrameworkNow()}>
                <i className={`fa-solid ${fwBusy ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`} /> {fwAnalysis ? "Rebuild" : "Build"}
              </button>
              {fwAnalysis && (
                <button
                  className="btn btn-sm"
                  disabled={fwBusy}
                  title="Save this analysis to the PMM workspace as a draft"
                  onClick={() => void saveFramework()}
                >
                  <i className="fa-solid fa-floppy-disk" /> Save as draft
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 12px" }}>
            Same evidence discipline as everything here: competitor facts only from scraped sources,
            Aurigo facts only from the knowledge base; thin evidence means fewer items, never padding.
          </p>
          {fwError && (
            <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{fwError}</div>
          )}
          {fwBusy && <div className="empty-note">Reading the evidence and building the analysis — up to a minute…</div>}

          {!fwBusy && fwAnalysis && fwKey === "threat-tiers" && (
            <>
              <div className="grid grid-3">
                {[1, 2, 3].map((tier) => (
                  <div key={tier}>
                    <div style={{ marginBottom: 8 }}>
                      <span className={`pill ${TIER_STYLE[tier].pill}`}>{TIER_STYLE[tier].label}</span>
                    </div>
                    {((fwAnalysis.result as { entries: ThreatEntry[] })?.entries ?? [])
                      .filter((t) => t.tier === tier)
                      .map((t) => (
                        <ThreatTile key={t.competitor} entry={t} showTier={false} showWatch style={{ marginBottom: 8 }} />
                      ))}
                  </div>
                ))}
              </div>
              {fwAnalysis.summaryHtml && (
                <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0, marginTop: 12 }} dangerouslySetInnerHTML={{ __html: fwAnalysis.summaryHtml }} />
              )}
              {fwAnalysis.skipped.length > 0 && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  Not tiered (insufficient evidence or integrate-don't-compete): {fwAnalysis.skipped.map((s) => s.name).join(", ")}
                </p>
              )}
            </>
          )}

          {!fwBusy && fwAnalysis && fwKey === "swot" && (
            <>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>
                SWOT: {String(fwAnalysis.params.competitor ?? competitors.find((c) => c.id === fwCompetitor)?.name ?? "")}
                <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                  built {new Date(fwAnalysis.createdAt).toLocaleString()}
                </span>
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {([
                  ["strengths", "Their strengths", "scraped sources only"],
                  ["weaknesses", "Their weaknesses", "scraped sources only"],
                  ["opportunities", "Our opportunities", "internal inference"],
                  ["threats", "Threats to us", "internal inference"],
                ] as const).map(([q, title, caption]) => (
                  <div key={q} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
                    <div className="row-between" style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</span>
                      <span className="pill pill-review" style={{ fontSize: 10 }}>{caption}</span>
                    </div>
                    {((fwAnalysis.result as Record<string, { text: string; evidence_url: string | null }[]>)[q] ?? []).map((item, i) => (
                      <div key={i} style={{ fontSize: 12.5, marginBottom: 6 }}>
                        • {item.text}
                        {item.evidence_url && (
                          <a href={item.evidence_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: 11 }}>
                            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 9 }} /> source
                          </a>
                        )}
                      </div>
                    ))}
                    {((fwAnalysis.result as Record<string, unknown[]>)[q] ?? []).length === 0 && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Evidence too thin for honest items.</div>
                    )}
                  </div>
                ))}
              </div>
              {fwAnalysis.summaryHtml && (
                <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0, marginTop: 12 }} dangerouslySetInnerHTML={{ __html: fwAnalysis.summaryHtml }} />
              )}
            </>
          )}

          {!fwBusy && fwAnalysis && fwKey === "delta-timeline" && (
            <>
              {((fwAnalysis.result as { weeks: { weekStart: string; events: { competitor: string; severity: string; event_type: string; title: string }[] }[] })?.weeks ?? []).map((w) => (
                <div key={w.weekStart} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", marginBottom: 6 }}>WEEK OF {w.weekStart}</div>
                  {w.events.map((e, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 12.5 }}>
                      <span className={`pill ${e.severity === "high" ? "pill-lost" : e.severity === "notable" ? "pill-pending" : "pill-review"}`}>{e.severity}</span>
                      <span style={{ fontWeight: 500 }}>{e.competitor}</span>
                      <span style={{ color: "var(--text-secondary)" }}>{e.title}</span>
                    </div>
                  ))}
                </div>
              ))}
              {((fwAnalysis.result as { weeks: unknown[] })?.weeks ?? []).length === 0 && (
                <div className="empty-note">No events in the last 90 days — track competitors to populate the timeline.</div>
              )}
            </>
          )}

          {!fwBusy && fwAnalysis && fwKey === "five-forces" && (() => {
            const forces = (fwAnalysis.result as FiveForcesResult | null)?.forces;
            return (
              <>
                {forces ? (
                  // Classic five-box arrangement: New entrants above, Supplier
                  // and Buyer power flanking, Rivalry emphasized in the center,
                  // Substitutes below.
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "1fr 1.15fr 1fr",
                      gridTemplateAreas: '". entrants ." "supplier rivalry buyer" ". substitutes ."',
                      alignItems: "stretch",
                    }}
                  >
                    <ForceCard title="Threat of new entrants" force={forces.new_entrants} style={{ gridArea: "entrants" }} />
                    <ForceCard title="Supplier power" force={forces.supplier_power} style={{ gridArea: "supplier" }} />
                    <ForceCard title="Competitive rivalry" force={forces.rivalry} emphasized style={{ gridArea: "rivalry" }} />
                    <ForceCard title="Buyer power" force={forces.buyer_power} style={{ gridArea: "buyer" }} />
                    <ForceCard title="Threat of substitutes" force={forces.substitutes} style={{ gridArea: "substitutes" }} />
                  </div>
                ) : (
                  <div className="empty-note">The stored analysis has no forces payload — rebuild it.</div>
                )}
                {fwAnalysis.summaryHtml && (
                  <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0, marginTop: 12 }} dangerouslySetInnerHTML={{ __html: fwAnalysis.summaryHtml }} />
                )}
                {fwAnalysis.skipped.length > 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                    Not included (insufficient evidence): {fwAnalysis.skipped.map((s) => s.name).join(", ")}
                  </p>
                )}
              </>
            );
          })()}

          {!fwBusy && fwAnalysis && fwKey === "feature-matrix" && (() => {
            const rows = (fwAnalysis.result as { rows?: MatrixRowT[] } | null)?.rows ?? [];
            // Column set = union of competitor names across rows, first-seen order.
            const competitorNames: string[] = [];
            for (const r of rows) {
              for (const name of Object.keys(r.competitors ?? {})) {
                if (!competitorNames.includes(name)) competitorNames.push(name);
              }
            }
            const thSticky: CSSProperties = { position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 };
            return (
              <>
                {rows.length > 0 ? (
                  <div style={{ overflow: "auto", maxHeight: 520, border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={thSticky}>Capability</th>
                          <th style={{ ...thSticky, background: "#E9F4F5", borderTop: "3px solid var(--teal-dark)", color: "var(--teal-dark)" }}>
                            Aurigo
                          </th>
                          {competitorNames.map((n) => (
                            <th key={n} style={thSticky}>{n}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.capability}>
                            <td style={{ fontWeight: 500, fontSize: 12.5 }}>{r.capability}</td>
                            <td style={{ background: "#F2FAFB" }}>
                              <MatrixCellView cell={{ ...r.aurigo, evidence_url: null }} />
                            </td>
                            {competitorNames.map((n) => (
                              <td key={n}>
                                <MatrixCellView cell={r.competitors?.[n]} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-note">The stored analysis has no capability rows — rebuild it.</div>
                )}
                {fwAnalysis.summaryHtml && (
                  <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0, marginTop: 12 }} dangerouslySetInnerHTML={{ __html: fwAnalysis.summaryHtml }} />
                )}
                {fwAnalysis.skipped.length > 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                    Not included (insufficient evidence): {fwAnalysis.skipped.map((s) => s.name).join(", ")}
                  </p>
                )}
              </>
            );
          })()}

          {!fwBusy && !fwAnalysis && !fwError && (
            <div className="empty-note">
              {fwKey === "swot" ? "Pick a competitor and build." : "No analysis stored yet — build one."}
            </div>
          )}
        </div>
      )}

      {/* ---------- deltas tab ---------- */}
      {tab === "deltas" && (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
              <i className="fa-solid fa-wave-square" style={{ color: "var(--teal-dark)", marginRight: 8 }} />
              Competitor deltas
            </h3>
            <div className="step-pills" style={{ margin: 0 }}>
              {(["", "high", "notable", "info"] as const).map((s) => (
                <button
                  key={s || "all"}
                  type="button"
                  className={`step-pill ${severityFilter === s ? "active" : ""}`}
                  onClick={() => setSeverityFilter(s)}
                >
                  {s === "" ? "All" : s}
                </button>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 12px" }}>
            Changes detected on tracked competitors&apos; sources. Every event is grounded in a
            scraped diff — the summary judges only the changed lines, never the full page. Track a
            competitor in the registry to start the background watch.
          </p>
          {events.filter((e) => severityFilter === "" || e.severity === severityFilter).length === 0 && (
            <div className="empty-note">
              No changes detected yet. Events land here when a tracked competitor&apos;s sources
              change — a quiet feed after runs have completed means nothing material moved.
            </div>
          )}
          {events
            .filter((e) => severityFilter === "" || e.severity === severityFilter)
            .map((e) => (
              <div key={e.id} style={{ padding: "10px 6px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    className={`pill ${
                      e.severity === "high" ? "pill-lost" : e.severity === "notable" ? "pill-pending" : "pill-review"
                    }`}
                  >
                    {e.severity}
                  </span>
                  <span className="pill pill-final">{e.event_type.replace(/_/g, " ")}</span>
                  <span style={{ fontWeight: 500 }}>{e.competitor ?? "?"}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{e.title}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                  {(e.summary_md || e.diff_excerpt) && (
                    <button className="btn btn-sm" onClick={() => setOpenEvent(openEvent === e.id ? "" : e.id)}>
                      <i className={`fa-solid ${openEvent === e.id ? "fa-chevron-up" : "fa-chevron-down"}`} />
                    </button>
                  )}
                  {!e.acknowledged_at ? (
                    <button className="btn btn-sm" onClick={() => void ackEvent(e.id)} title="Mark as read">
                      <i className="fa-solid fa-check" /> Ack
                    </button>
                  ) : (
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      <i className="fa-solid fa-check" /> read
                    </span>
                  )}
                </div>
                {openEvent === e.id && (
                  <div style={{ marginTop: 8, paddingLeft: 4 }}>
                    {e.summary_md && (
                      <p style={{ fontSize: 13, margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{e.summary_md}</p>
                    )}
                    {e.diff_excerpt && (
                      <pre
                        style={{
                          fontSize: 11.5,
                          background: "var(--bg-page)",
                          borderRadius: "var(--r-md)",
                          padding: "10px 12px",
                          overflowX: "auto",
                          whiteSpace: "pre-wrap",
                          maxHeight: 260,
                          overflowY: "auto",
                        }}
                      >
                        {e.diff_excerpt}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ---------- positioning map tab ---------- */}
      {tab === "map" && (
        <>
          <div className="card">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Map parameters</h3>
              <button className="btn btn-primary btn-sm" onClick={() => void refreshMap()} disabled={mapBusy}>
                <i className={`fa-solid ${mapBusy ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`} />{" "}
                {mapBusy ? "Building…" : posMap ? "Rebuild map" : "Build map"}
              </button>
            </div>
            <div className="grid grid-2" style={{ alignItems: "start" }}>
              <div>
                <label style={{ marginTop: 0 }}>X axis</label>
                <select value={xPreset} onChange={(e) => setXPreset(e.target.value)}>
                  <option value="auto">Model's choice (best separator)</option>
                  {AXIS_PRESETS.map((a) => (
                    <option key={a.label} value={a.label}>
                      {a.label} ({a.low} → {a.high})
                    </option>
                  ))}
                  <option value="custom">Custom axis…</option>
                </select>
                {xPreset === "custom" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                    <input placeholder="Axis label" value={xCustom.label} onChange={(e) => setXCustom({ ...xCustom, label: e.target.value })} />
                    <input placeholder="Low end" value={xCustom.low} onChange={(e) => setXCustom({ ...xCustom, low: e.target.value })} />
                    <input placeholder="High end" value={xCustom.high} onChange={(e) => setXCustom({ ...xCustom, high: e.target.value })} />
                  </div>
                )}
                <label>Y axis</label>
                <select value={yPreset} onChange={(e) => setYPreset(e.target.value)}>
                  <option value="auto">Model's choice (best separator)</option>
                  {AXIS_PRESETS.map((a) => (
                    <option key={a.label} value={a.label}>
                      {a.label} ({a.low} → {a.high})
                    </option>
                  ))}
                  <option value="custom">Custom axis…</option>
                </select>
                {yPreset === "custom" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                    <input placeholder="Axis label" value={yCustom.label} onChange={(e) => setYCustom({ ...yCustom, label: e.target.value })} />
                    <input placeholder="Low end" value={yCustom.low} onChange={(e) => setYCustom({ ...yCustom, low: e.target.value })} />
                    <input placeholder="High end" value={yCustom.high} onChange={(e) => setYCustom({ ...yCustom, high: e.target.value })} />
                  </div>
                )}
                {(resolveAxis(xPreset, xCustom) === undefined) !== (resolveAxis(yPreset, yCustom) === undefined) && (
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "8px 0 0" }}>
                    Pin both axes to use them — with only one pinned, the model chooses both.
                  </p>
                )}
              </div>
              <div>
                <label style={{ marginTop: 0 }}>Aurigo products on the map</label>
                <div className="step-pills">
                  {MAP_AURIGO_PRODUCTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`step-pill ${mapProducts.includes(p) ? "active" : ""}`}
                      onClick={() => setMapProducts((l) => toggleIn(l, p))}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <label>Competitors (none selected = all with sources)</label>
                <div className="step-pills">
                  {competitors.map((c) => {
                    const hasSources = c.sources.some((s) => s.status === "ok");
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`step-pill ${mapCompetitors.includes(c.id) ? "active" : ""}`}
                        style={!hasSources ? { opacity: 0.45 } : undefined}
                        title={hasSources ? c.name : `${c.name} — no scraped sources yet; it will be listed as skipped`}
                        onClick={() => setMapCompetitors((l) => toggleIn(l, c.id))}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {mapError && (
              <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginTop: 12 }}>
                {mapError}
              </div>
            )}
          </div>

          <div className="card">
            <div className="row-between" style={{ marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                <i className="fa-solid fa-map-location-dot" style={{ color: "var(--teal-dark)", marginRight: 8 }} />
                {posMap ? `${posMap.xAxis.label} × ${posMap.yAxis.label}` : "Positioning map"}
              </h3>
              {posMap && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  built {new Date(posMap.createdAt).toLocaleString()}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 12px" }}>
              Aurigo products are placed from the knowledge base — customer conversations included —
              and competitors only from their scraped sources. Bubble size is evidence-weighted
              presence on these axes. Hover a bubble for the reasoning.
            </p>
            {mapBusy && (
              <div className="empty-note">
                Reading scraped sources and the knowledge base — this can take up to a minute…
              </div>
            )}
            {posMap && !mapBusy ? (
              <>
                <MapChart map={posMap} onHover={setTip} />
                <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#015F74", border: "2px solid #F8D146", marginRight: 6, verticalAlign: "-1px" }} />
                    Aurigo products
                  </span>
                  <span>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#64748B", opacity: 0.7, marginRight: 6, verticalAlign: "-1px" }} />
                    Competitors
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>Bubble size = evidence strength</span>
                  {posMap.skipped.length > 0 && (
                    <span style={{ color: "var(--text-muted)" }}>
                      Not placed (insufficient evidence): {posMap.skipped.map((s) => s.name).join(", ")}
                    </span>
                  )}
                </div>
                {posMap.summaryHtml && (
                  <div
                    className="prose"
                    style={{ border: "none", boxShadow: "none", padding: 0, marginTop: 12 }}
                    dangerouslySetInnerHTML={{ __html: posMap.summaryHtml }}
                  />
                )}
              </>
            ) : (
              !mapBusy && (
                <div className="empty-note">
                  No map built yet. Set the parameters above and build — competitors need scraped
                  sources (Compare &amp; registry tab) to be placed.
                </div>
              )
            )}
          </div>

          {/* map history + movement (Phase 1: the time dimension) */}
          {mapHistory.length > 1 && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Build history</h3>
                <button className="btn btn-sm" onClick={() => void compareWithPrevious()} disabled={!posMap} title="Movement vs the previous build with the same axes">
                  <i className="fa-solid fa-arrows-left-right" /> Compare with previous
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {mapHistory.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`step-pill ${posMap?.id === m.id ? "active" : ""}`}
                    title={`${m.xAxis.label} × ${m.yAxis.label}`}
                    onClick={() => { setPosMap(m); setMovement(null); setMovementNote(""); }}
                  >
                    {new Date(m.createdAt).toLocaleDateString()}
                  </button>
                ))}
              </div>
              {movementNote && <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "10px 0 0" }}>{movementNote}</p>}
              {movement && (
                <div style={{ marginTop: 8 }}>
                  {movement.moves.filter((mv) => Math.abs(mv.dx) + Math.abs(mv.dy) >= 3).slice(0, 8).map((mv) => (
                    <div key={mv.name} style={{ fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{mv.name}</span>{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        {mv.dx !== 0 && `${mv.dx > 0 ? "→" : "←"} ${Math.abs(mv.dx)} on X`}
                        {mv.dx !== 0 && mv.dy !== 0 && " · "}
                        {mv.dy !== 0 && `${mv.dy > 0 ? "↑" : "↓"} ${Math.abs(mv.dy)} on Y`}
                      </span>
                    </div>
                  ))}
                  {movement.moves.every((mv) => Math.abs(mv.dx) + Math.abs(mv.dy) < 3) && (
                    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0 }}>No meaningful movement (&lt;3 pts) between these builds.</p>
                  )}
                  {movement.entered.length > 0 && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>Entered: {movement.entered.join(", ")}</p>
                  )}
                  {movement.exited.length > 0 && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>Left the map: {movement.exited.join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {tip && (
            <div
              style={{
                position: "fixed",
                left: Math.min(tip.x + 14, window.innerWidth - 320),
                top: tip.y + 14,
                zIndex: 300,
                maxWidth: 300,
                background: "#0B2E36",
                color: "#F2F7F8",
                borderRadius: "var(--r-md)",
                padding: "10px 13px",
                fontSize: 12.5,
                lineHeight: 1.5,
                boxShadow: "0 10px 30px rgba(0,0,0,.3)",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 3 }}>{tip.title}</div>
              {tip.note && <div>{tip.note}</div>}
              <div style={{ color: "#9FC1C9", marginTop: 4 }}>Evidence strength: {tip.size}/100</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
