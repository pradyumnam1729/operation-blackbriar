import { useCallback, useEffect, useState } from "react";
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
  note: string | null;
}

interface PositioningMap {
  id: string;
  xAxis: PositioningAxis;
  yAxis: PositioningAxis;
  points: PositioningPoint[];
  skipped: { name: string; reason: string }[];
  summaryHtml: string | null;
  evidence: { title: string; docType: string }[];
  createdAt: string;
}

/** SVG quadrant scatter: Aurigo products in brand teal, competitors in slate. */
function MapChart({ map }: { map: PositioningMap }) {
  const W = 760;
  const H = 460;
  const M = { top: 28, right: 30, bottom: 64, left: 76 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const px = (x: number) => M.left + (x / 100) * plotW;
  const py = (y: number) => M.top + plotH - (y / 100) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Positioning map">
      <rect x={M.left} y={M.top} width={plotW} height={plotH} fill="var(--bg-page, #F7F9FA)" stroke="#E2E8F0" />
      <line x1={px(50)} y1={M.top} x2={px(50)} y2={M.top + plotH} stroke="#D7E0E4" strokeDasharray="4 4" />
      <line x1={M.left} y1={py(50)} x2={M.left + plotW} y2={py(50)} stroke="#D7E0E4" strokeDasharray="4 4" />

      {/* x axis labels */}
      <text x={M.left + plotW / 2} y={H - 12} textAnchor="middle" fontSize={12.5} fontWeight={500} fill="#334155">
        {map.xAxis.label}
      </text>
      <text x={M.left} y={M.top + plotH + 20} textAnchor="start" fontSize={11} fill="#7C8B94">
        ← {map.xAxis.low}
      </text>
      <text x={M.left + plotW} y={M.top + plotH + 20} textAnchor="end" fontSize={11} fill="#7C8B94">
        {map.xAxis.high} →
      </text>

      {/* y axis labels */}
      <text
        x={20}
        y={M.top + plotH / 2}
        textAnchor="middle"
        fontSize={12.5}
        fontWeight={500}
        fill="#334155"
        transform={`rotate(-90 20 ${M.top + plotH / 2})`}
      >
        {map.yAxis.label}
      </text>
      <text x={M.left - 8} y={M.top + plotH} textAnchor="end" fontSize={11} fill="#7C8B94">
        {map.yAxis.low}
      </text>
      <text x={M.left - 8} y={M.top + 10} textAnchor="end" fontSize={11} fill="#7C8B94">
        {map.yAxis.high}
      </text>

      {map.points.map((p) => {
        const cx = px(p.x);
        const cy = py(p.y);
        const aurigo = p.type === "aurigo";
        const labelLeft = p.x > 72;
        return (
          <g key={p.name}>
            <title>{p.note ? `${p.name} — ${p.note}` : p.name}</title>
            <circle
              cx={cx}
              cy={cy}
              r={aurigo ? 8 : 6}
              fill={aurigo ? "#015F74" : "#94A3B8"}
              stroke={aurigo ? "#F8D146" : "#fff"}
              strokeWidth={aurigo ? 2 : 1.5}
            />
            <text
              x={labelLeft ? cx - 12 : cx + 12}
              y={cy + 4}
              textAnchor={labelLeft ? "end" : "start"}
              fontSize={12}
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
  const [posMap, setPosMap] = useState<PositioningMap | null>(null);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapError, setMapError] = useState("");

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
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    try {
      const r = await apiPost<{ map: PositioningMap }>("/api/competitive/positioning-map/refresh");
      setPosMap(r.map);
    } catch (e) {
      setMapError((e as Error).message);
    } finally {
      setMapBusy(false);
    }
  };

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

      {/* ---------- positioning map ---------- */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
            <i className="fa-solid fa-map-location-dot" style={{ color: "var(--teal-dark)", marginRight: 8 }} />
            Live positioning map
          </h3>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {posMap && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                built {new Date(posMap.createdAt).toLocaleString()}
              </span>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => void refreshMap()} disabled={mapBusy}>
              <i className={`fa-solid ${mapBusy ? "fa-spinner fa-spin" : "fa-rotate"}`} />{" "}
              {mapBusy ? "Building…" : posMap ? "Rebuild map" : "Build map"}
            </button>
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 12px" }}>
          Aurigo products are placed from the knowledge base — customer conversations included —
          and competitors only from their scraped sources. Hover a point for the reasoning.
        </p>
        {mapError && (
          <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
            {mapError}
          </div>
        )}
        {mapBusy && !posMap && (
          <div className="empty-note">Reading scraped sources and the knowledge base — this can take up to a minute…</div>
        )}
        {posMap ? (
          <>
            <MapChart map={posMap} />
            <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
              <span>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#015F74", border: "2px solid #F8D146", marginRight: 6, verticalAlign: "-1px" }} />
                Aurigo products
              </span>
              <span>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#94A3B8", marginRight: 6, verticalAlign: "-1px" }} />
                Competitors
              </span>
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
              No map built yet. Scrape at least one competitor in the registry below, then build the
              map.
            </div>
          )
        )}
      </div>

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
    </div>
  );
}
