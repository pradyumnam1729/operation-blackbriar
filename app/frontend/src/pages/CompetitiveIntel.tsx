import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { lineLogo } from "../lib/branding";

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

interface BattlecardRow {
  id: string;
  title: string;
  status: "draft" | "in_review" | "final" | "archived";
  updated_at: string;
}

interface CiReportRow {
  id: string;
  competitor: string | null;
  aurigo_product: string | null;
  title: string;
  status: "draft" | "final" | "archived";
  created_at: string;
}

interface NewsItemRow {
  id: string;
  headline: string;
  summary_html: string;
  source_url: string | null;
  status: "pending" | "approved" | "dismissed";
  discovered_at: string;
  category: string | null;
  priority: "high" | "normal";
}

interface MarketThreatRow {
  id: string;
  name: string;
  aurigo_product: string | null;
  summary_html: string;
  rationale: string;
  confidence: number;
  source_url: string | null;
  status: "draft" | "final" | "archived";
  created_at: string;
}

const SUGGESTIONS = [
  "Top 3 features vs Kahua for a state DOT deal",
  "How does Procore's AI compare to ours for facility owners?",
  "Where does e-Builder beat us, honestly?",
];

const NEWS_CATEGORY_LABELS = ["News", "Press Release", "Acquisition", "AI Direction", "Bidding & RFP", "Webinar & Event", "Site Change"];

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

const MAP_AURIGO_PRODUCTS = ["Masterworks", "Masterworks AI", "Primus"];

const errBox: React.CSSProperties = {
  background: "#FCE8E8",
  color: "#A32D2D",
  borderRadius: "var(--r-md)",
  padding: "10px 14px",
  fontSize: 13,
  marginBottom: 14,
};

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
  const [tab, setTab] = useState<"compare" | "battlecards" | "map" | "reports" | "news" | "threats">("compare");

  // Battlecards originated from this page (comparison- or CI-report-sourced).
  const [battlecards, setBattlecards] = useState<BattlecardRow[]>([]);

  // CI Reports
  const [reports, setReports] = useState<CiReportRow[]>([]);
  const [reportCompetitorId, setReportCompetitorId] = useState("");
  const [reportProduct, setReportProduct] = useState("");
  const [reportBrief, setReportBrief] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [openReport, setOpenReport] = useState<{ id: string; title: string; contentHtml: string } | null>(null);

  // Daily news
  const [news, setNews] = useState<NewsItemRow[]>([]);
  const [newsBusyId, setNewsBusyId] = useState("");
  const [newsError, setNewsError] = useState("");
  const [newsView, setNewsView] = useState<"latest" | "past" | "site_changes">("latest");
  const [newsPriority, setNewsPriority] = useState<"all" | "high">("all");

  // Market threats
  const [threats, setThreats] = useState<MarketThreatRow[]>([]);
  const [threatForm, setThreatForm] = useState({ name: "", product: "", url: "" });
  const [threatBusy, setThreatBusy] = useState(false);
  const [threatError, setThreatError] = useState("");
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
  const [mapProducts, setMapProducts] = useState<string[]>(["Masterworks", "Primus"]);
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

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ jinaConfigured: boolean; competitors: Competitor[] }>(
        "/api/competitive/competitors"
      );
      setCompetitors(r.competitors);
      setJinaOk(r.jinaConfigured);
      const h = await apiGet<{ comparisons: HistoryRow[] }>("/api/competitive/comparisons");
      setHistory(h.comparisons);
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
      const bc = await apiGet<{ artifacts: BattlecardRow[] }>("/api/artifacts?asset_type=battlecard");
      setBattlecards(bc.artifacts);
      const rr = await apiGet<{ reports: CiReportRow[] }>("/api/competitive/ci-reports");
      setReports(rr.reports);
      const tt = await apiGet<{ threats: MarketThreatRow[] }>("/api/competitive/threats");
      setThreats(tt.threats);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadNews = useCallback(async () => {
    try {
      const nn = await apiGet<{ items: NewsItemRow[] }>(
        `/api/competitive/news?view=${newsView}&priority=${newsPriority}`
      );
      setNews(nn.items);
    } catch (e) {
      setNewsError((e as Error).message);
    }
  }, [newsView, newsPriority]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

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

  // ---------- CI Reports ----------
  const generateReport = async () => {
    if (!reportCompetitorId) return;
    setReportBusy(true);
    setReportError("");
    try {
      await apiPost("/api/competitive/ci-reports", {
        competitorId: reportCompetitorId,
        product: reportProduct || undefined,
        extraBrief: reportBrief.trim() || undefined,
      });
      setReportBrief("");
      await load();
    } catch (e) {
      setReportError((e as Error).message);
    } finally {
      setReportBusy(false);
    }
  };

  const viewReport = async (id: string) => {
    setReportError("");
    try {
      const r = await apiGet<{ report: { id: string; title: string; content_html: string } }>(
        `/api/competitive/ci-reports/${id}`
      );
      setOpenReport({ id: r.report.id, title: r.report.title, contentHtml: r.report.content_html });
    } catch (e) {
      setReportError((e as Error).message);
    }
  };

  const approveReport = async (id: string) => {
    setReportBusy(true);
    setReportError("");
    try {
      await apiPost(`/api/competitive/ci-reports/${id}/approve`);
      setOpenReport(null);
      await load();
    } catch (e) {
      setReportError((e as Error).message);
    } finally {
      setReportBusy(false);
    }
  };

  const battlecardFromReport = async (id: string) => {
    setReportBusy(true);
    setReportError("");
    try {
      const r = await apiPost<{ artifactId: string }>(`/api/competitive/ci-reports/${id}/battlecard`);
      navigate(`/library/${r.artifactId}`);
    } catch (e) {
      setReportError((e as Error).message);
    } finally {
      setReportBusy(false);
    }
  };

  // ---------- Daily news ----------
  const dismissNews = async (id: string) => {
    setNewsBusyId(id);
    setNewsError("");
    try {
      await apiPost(`/api/competitive/news/${id}/dismiss`);
      await load();
    } catch (e) {
      setNewsError((e as Error).message);
    } finally {
      setNewsBusyId("");
    }
  };

  // ---------- Market threats ----------
  const draftThreat = async () => {
    if (threatForm.name.trim() === "") return;
    setThreatBusy(true);
    setThreatError("");
    try {
      await apiPost("/api/competitive/threats/draft", {
        name: threatForm.name.trim(),
        product: threatForm.product || undefined,
        url: threatForm.url.trim() || undefined,
      });
      setThreatForm({ name: "", product: "", url: "" });
      await load();
    } catch (e) {
      setThreatError((e as Error).message);
    } finally {
      setThreatBusy(false);
    }
  };

  const approveThreat = async (id: string) => {
    setThreatBusy(true);
    setThreatError("");
    try {
      await apiPost(`/api/competitive/threats/${id}/approve`);
      await load();
    } catch (e) {
      setThreatError((e as Error).message);
    } finally {
      setThreatBusy(false);
    }
  };

  const staleDays = (iso: string | null) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

  return (
    <div className="competitive-intel">
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
        <button className={tab === "compare" ? "active" : ""} onClick={() => setTab("compare")}>
          <i className="fa-solid fa-chess" style={{ marginRight: 6 }} /> Compare &amp; registry
        </button>
        <button className={tab === "battlecards" ? "active" : ""} onClick={() => setTab("battlecards")}>
          <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }} /> Battlecards
        </button>
        <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>
          <i className="fa-solid fa-file-shield" style={{ marginRight: 6 }} /> CI reports
        </button>
        <button className={tab === "news" ? "active" : ""} onClick={() => setTab("news")}>
          <i className="fa-solid fa-newspaper" style={{ marginRight: 6 }} /> Daily news
        </button>
        <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>
          <i className="fa-solid fa-map-location-dot" style={{ marginRight: 6 }} /> Positioning map
        </button>
        <button className={tab === "threats" ? "active" : ""} onClick={() => setTab("threats")}>
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} /> Market threats
        </button>
      </div>

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
          {(() => {
            const logo = lineLogo(product);
            return logo ? <img src={logo} alt="" style={{ height: 22, width: "auto", alignSelf: "center" }} /> : null;
          })()}
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">Auto-pick Aurigo product</option>
            <option value="Primus">Compare vs Primus</option>
            <option value="Masterworks">Compare vs Masterworks</option>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => {
                const okSources = c.sources.filter((s) => s.status === "ok");
                const newest = okSources.map((s) => s.scraped_at).sort().reverse()[0] ?? null;
                const age = staleDays(newest);
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

      {/* ---------- battlecards tab ---------- */}
      {tab === "battlecards" && (
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Battlecards</h3>
          {battlecards.length === 0 && (
            <div className="empty-note">
              None yet — save a comparison or an approved CI report as a battlecard to see it here.
            </div>
          )}
          {battlecards.map((b) => (
            <div key={b.id} className="rowhover" style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 6px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => navigate(`/library/${b.id}`)}>
              <span className={`pill ${b.status === "final" ? "pill-final" : b.status === "archived" ? "pill-archived" : "pill-draft"}`}>{b.status}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{b.title}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(b.updated_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---------- CI reports tab ---------- */}
      {tab === "reports" && (
        <>
          {isAdmin && (
            <div className="card">
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Generate a CI report</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
                <select
                  value={reportCompetitorId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setReportCompetitorId(id);
                    // Reflect the registry's own competitor->product mapping —
                    // don't make the user re-pick what's already defined.
                    const c = competitors.find((x) => x.id === id);
                    setReportProduct(c?.aurigo_product ?? "");
                  }}
                >
                  <option value="">Pick a competitor…</option>
                  {competitors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.aurigo_product ? ` (${c.aurigo_product})` : ""}
                    </option>
                  ))}
                </select>
                {(() => {
                  const logo = lineLogo(reportProduct);
                  return logo ? <img src={logo} alt="" style={{ height: 22, width: "auto", alignSelf: "center" }} /> : null;
                })()}
                <select value={reportProduct} onChange={(e) => setReportProduct(e.target.value)} title="Pre-filled from the competitor registry — override only for a genuine cross-market case">
                  <option value="">Auto-pick Aurigo product</option>
                  <option value="Primus">Primus</option>
                  <option value="Masterworks">Masterworks</option>
                </select>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--text-secondary)" }}>
                Product is pre-filled from the competitor registry — change it only if this
                competitor genuinely spans multiple markets.
              </p>
              <input
                placeholder="Extra brief (optional) — angle to emphasize, deal context…"
                value={reportBrief}
                onChange={(e) => setReportBrief(e.target.value)}
              />
              <p style={{ marginTop: 10, marginBottom: 0 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void generateReport()}
                  disabled={reportBusy || !reportCompetitorId || !jinaOk}
                >
                  <i className={`fa-solid ${reportBusy ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`} />{" "}
                  {reportBusy ? "Generating…" : "Generate report"}
                </button>
              </p>
              {reportError && <div style={{ ...errBox, marginTop: 12 }}>{reportError}</div>}
            </div>
          )}

          <div className="card">
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>
              {isAdmin ? "All reports" : "Approved CI reports"}
            </h3>
            {reports.length === 0 && <div className="empty-note">No CI reports yet.</div>}
            {reports.map((r) => (
              <div key={r.id} className="rowhover" style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 6px", borderBottom: "1px solid var(--border)" }}>
                <span className={`pill ${r.status === "final" ? "pill-final" : "pill-draft"}`}>{r.status}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{r.title}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                <button className="btn btn-sm" onClick={() => void viewReport(r.id)}>
                  <i className="fa-solid fa-eye" /> View
                </button>
                {r.status === "final" && (
                  <button className="btn btn-sm btn-primary" onClick={() => void battlecardFromReport(r.id)} disabled={reportBusy}>
                    <i className="fa-solid fa-shield-halved" /> Generate battlecard
                  </button>
                )}
              </div>
            ))}
          </div>

          {openReport && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{openReport.title}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  {isAdmin && (
                    <button className="btn btn-primary btn-sm" onClick={() => void approveReport(openReport.id)} disabled={reportBusy}>
                      <i className="fa-solid fa-circle-check" /> Approve
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => setOpenReport(null)}>
                    <i className="fa-solid fa-xmark" /> Close
                  </button>
                </div>
              </div>
              <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0 }} dangerouslySetInnerHTML={{ __html: openReport.contentHtml }} />
            </div>
          )}
        </>
      )}

      {/* ---------- Daily news tab ---------- */}
      {tab === "news" && (
        <>
          {newsError && <div style={errBox}>{newsError}</div>}

          <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["latest", "past", "site_changes"] as const).map((v) => (
                <button
                  key={v}
                  className={`btn btn-sm ${newsView === v ? "btn-primary" : ""}`}
                  onClick={() => setNewsView(v)}
                >
                  {v === "latest" ? "Latest" : v === "past" ? "Past news" : "Site Changes"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "high"] as const).map((p) => (
                <button
                  key={p}
                  className={`btn btn-sm ${newsPriority === p ? "btn-primary" : ""}`}
                  onClick={() => setNewsPriority(p)}
                >
                  {p === "all" ? "All" : "High priority"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-3" style={{ marginTop: 12 }}>
            <div className="card">
              <div style={{ fontSize: 22, fontWeight: 600 }}>{battlecards.filter((b) => b.status === "final").length}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Battlecards published</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {threats.filter((t) => t.status === "draft").length + reports.filter((r) => r.status === "draft").length}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Pending review</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {
                  news.filter(
                    (n) =>
                      n.category === "Site Change" &&
                      Date.now() - new Date(n.discovered_at).getTime() < 7 * 24 * 3600 * 1000
                  ).length
                }
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Site changes (7d)</div>
            </div>
          </div>

          <div className="grid grid-3" style={{ marginTop: 12 }}>
            {NEWS_CATEGORY_LABELS.map((category) => {
              const items = news.filter((n) => (newsView === "site_changes" ? true : n.category === category));
              if (newsView === "site_changes" && category !== "Site Change") return null;
              return (
                <div key={category} className="card">
                  <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>
                    {category} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{items.length}</span>
                  </h3>
                  {items.length === 0 && <div className="empty-note">Nothing here yet.</div>}
                  {items.map((n) => (
                    <div key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span
                          title={n.priority === "high" ? "High priority" : "Normal priority"}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: n.priority === "high" ? "#c0392b" : "var(--text-muted)",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{n.headline}</span>
                        {isAdmin && (
                          <button
                            className="btn btn-sm"
                            style={{ marginLeft: "auto" }}
                            disabled={newsBusyId === n.id}
                            onClick={() => void dismissNews(n.id)}
                            title="Hide a bad scan"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        )}
                      </div>
                      <div
                        className="prose"
                        style={{ border: "none", boxShadow: "none", padding: 0, fontSize: 12 }}
                        dangerouslySetInnerHTML={{ __html: n.summary_html }}
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(n.discovered_at).toLocaleDateString()}</span>
                      {n.source_url && (
                        <a href={n.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, marginLeft: 8 }}>
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 9, marginRight: 3 }} />
                          source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------- Market threats tab ---------- */}
      {tab === "threats" && (
        <>
          {isAdmin && (
            <div className="card">
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Draft a threat / new entrant</h3>
              <div className="grid grid-3">
                <input placeholder="Name" value={threatForm.name} onChange={(e) => setThreatForm({ ...threatForm, name: e.target.value })} />
                <select value={threatForm.product} onChange={(e) => setThreatForm({ ...threatForm, product: e.target.value })}>
                  <option value="">Aurigo product (optional)</option>
                  <option value="Primus">Primus</option>
                  <option value="Masterworks">Masterworks</option>
                </select>
                <input placeholder="Source URL (optional)" value={threatForm.url} onChange={(e) => setThreatForm({ ...threatForm, url: e.target.value })} />
              </div>
              <p style={{ marginTop: 10, marginBottom: 0 }}>
                <button className="btn btn-primary btn-sm" onClick={() => void draftThreat()} disabled={threatBusy || threatForm.name.trim() === ""}>
                  <i className={`fa-solid ${threatBusy ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`} />{" "}
                  {threatBusy ? "Researching…" : "AI-draft assessment"}
                </button>
              </p>
              {threatError && <div style={{ ...errBox, marginTop: 12 }}>{threatError}</div>}
            </div>
          )}

          <div className="card">
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>
              {isAdmin ? "All threats & entrants" : "Approved threats & entrants"}
            </h3>
            {threats.length === 0 && <div className="empty-note">Nothing flagged yet.</div>}
            {threats.map((t) => (
              <div key={t.id} style={{ padding: "10px 6px", borderBottom: "1px solid var(--border)" }}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 500, fontSize: 13.5 }}>{t.name}</span>
                    {t.aurigo_product && <span className="pill pill-live">{t.aurigo_product}</span>}
                    <span
                      className={`pill ${t.confidence >= 70 ? "pill-lost" : t.confidence >= 40 ? "pill-review" : "pill-pending"}`}
                      title="Confidence this is a real, current threat"
                    >
                      {Math.round(t.confidence)}% confidence
                    </span>
                    {isAdmin && <span className={`pill ${t.status === "final" ? "pill-final" : "pill-draft"}`}>{t.status}</span>}
                  </div>
                  {isAdmin && t.status === "draft" && (
                    <button className="btn btn-sm btn-primary" disabled={threatBusy} onClick={() => void approveThreat(t.id)}>
                      <i className="fa-solid fa-circle-check" /> Approve
                    </button>
                  )}
                </div>
                <div className="prose" style={{ border: "none", boxShadow: "none", padding: 0, fontSize: 12.5, marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: t.summary_html }} />
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  <b>Why flagged:</b> {t.rationale}
                </div>
                {t.source_url && (
                  <a href={t.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10, marginRight: 4 }} />
                    source
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
