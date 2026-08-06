import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

// Win/Loss dashboard: read-only view over the (mock) Salesforce mirror.

interface Opportunity {
  id: string;
  sf_id: string | null;
  name: string;
  account_name: string | null;
  product_line: string | null;
  stage: "closed_won" | "closed_lost";
  amount: number | null;
  competitor: string | null;
  loss_reason: string | null;
  closed_at: string | null;
  owner: string | null;
  synced_at: string;
}

interface Summary {
  totals: { won: number; lost: number; wonAmount: number; lostAmount: number; winRate: number };
  byCompetitor: { competitor: string; won: number; lost: number }[];
  byLossReason: { loss_reason: string; count: number }[];
  byProductLine: { product_line: string; won: number; lost: number }[];
  byBand: { band: string; won: number; lost: number }[];
}

interface SyncRun {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  detail: string | null;
}

const BANDS = ["<500K", "500K-1M", "1M-2M", ">2M"];

const fmtMoney = (n: number | null) => (n === null ? "—" : `$${n.toLocaleString()}`);
const fmtDate = (v: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString();
};

function StagePill({ stage }: { stage: Opportunity["stage"] }) {
  const won = stage === "closed_won";
  return <span className={`pill ${won ? "pill-won" : "pill-lost"}`}>{won ? "Won" : "Lost"}</span>;
}

/** Hive bar row: label | teal won fill + red lost fill | counts. */
function WonLostBar({
  label,
  won,
  lost,
  max,
}: {
  label: string;
  won: number;
  lost: number;
  max: number;
}) {
  const pct = (n: number) => (max === 0 ? 0 : Math.round((n / max) * 100));
  return (
    <div className="bar-row">
      <div className="lab" title={label}>
        {label}
      </div>
      <div className="bar-track">
        {won > 0 && <div className="bar-fill" style={{ width: `${pct(won)}%`, minWidth: 4 }} />}
        {lost > 0 && <div className="bar-fill lost" style={{ width: `${pct(lost)}%`, minWidth: 4 }} />}
      </div>
      <div className="bar-val">
        {won}/{lost}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="val">{value}</div>
    </div>
  );
}

export function WinLoss() {
  const [productLine, setProductLine] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [stage, setStage] = useState("");
  const [band, setBand] = useState("");
  const [q, setQ] = useState("");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [allOpps, setAllOpps] = useState<Opportunity[]>([]); // unfiltered, for dropdown options
  const [lastSync, setLastSync] = useState<SyncRun | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filterQs = useMemo(() => {
    const params = new URLSearchParams();
    if (productLine) params.set("product_line", productLine);
    if (competitor) params.set("competitor", competitor);
    if (stage) params.set("stage", stage);
    if (band) params.set("band", band);
    return params;
  }, [productLine, competitor, stage, band]);

  const loadData = async () => {
    try {
      const listParams = new URLSearchParams(filterQs);
      if (q.trim()) listParams.set("q", q.trim());
      const [s, list] = await Promise.all([
        apiGet<Summary>(`/api/opportunities/summary?${filterQs.toString()}`),
        apiGet<{ opportunities: Opportunity[] }>(`/api/opportunities?${listParams.toString()}`),
      ]);
      setSummary(s);
      setOpps(list.opportunities);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const loadLastSync = () =>
    apiGet<{ run: SyncRun | null }>("/api/opportunities/last-sync")
      .then((r) => setLastSync(r.run))
      .catch(() => setLastSync(null));

  useEffect(() => {
    apiGet<{ opportunities: Opportunity[] }>("/api/opportunities")
      .then((r) => setAllOpps(r.opportunities))
      .catch(() => setAllOpps([]));
    void loadLastSync();
  }, []);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterQs, q]);

  // Escape closes the opportunity drawer (backdrop click and the X also work).
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await apiPost<{ run: SyncRun }>("/api/opportunities/refresh");
      setLastSync(r.run);
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const productLines = useMemo(
    () => [...new Set(allOpps.map((o) => o.product_line).filter((v): v is string => !!v))].sort(),
    [allOpps]
  );
  const competitors = useMemo(
    () => [...new Set(allOpps.map((o) => o.competitor).filter((v): v is string => !!v))].sort(),
    [allOpps]
  );

  const maxCompetitor = Math.max(1, ...(summary?.byCompetitor ?? []).map((c) => c.won + c.lost));
  const maxLoss = Math.max(1, ...(summary?.byLossReason ?? []).map((l) => l.count));
  const maxLine = Math.max(1, ...(summary?.byProductLine ?? []).map((p) => p.won + p.lost));
  const maxBand = Math.max(1, ...(summary?.byBand ?? []).map((b) => b.won + b.lost));

  const totalDeals = (summary?.totals.won ?? 0) + (summary?.totals.lost ?? 0);
  const avgDeal =
    summary && totalDeals > 0
      ? Math.round((summary.totals.wonAmount + summary.totals.lostAmount) / totalDeals)
      : null;

  return (
    <div>
      {/* ---------- header ---------- */}
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="pagetitle">Win / loss analysis</h1>
          <p className="pagesub" title={lastSync?.detail ?? undefined}>
            Synced from the Salesforce mirror.{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {lastSync
                ? `Last synced ${new Date(lastSync.finished_at ?? lastSync.started_at).toLocaleString()}`
                : "Never synced"}
            </span>
            {lastSync?.detail && (
              <span style={{ color: "var(--text-muted)" }}> — {lastSync.detail}</span>
            )}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => void refresh()} disabled={refreshing}>
          <i className="fa-solid fa-rotate" /> {refreshing ? "Syncing…" : "Refresh now"}
        </button>
      </div>

      {error && <p style={{ color: "var(--red)" }}>{error}</p>}

      {/* ---------- metrics ---------- */}
      {summary && (
        <div className="grid grid-4" style={{ marginBottom: 18 }}>
          <Metric label="Closed-won" value={summary.totals.won.toLocaleString()} />
          <Metric label="Closed-lost" value={summary.totals.lost.toLocaleString()} />
          <Metric label="Win rate" value={`${summary.totals.winRate.toLocaleString()}%`} />
          <Metric label="Avg deal size" value={fmtMoney(avgDeal)} />
          <Metric label="Won $" value={fmtMoney(summary.totals.wonAmount)} />
          <Metric label="Lost $" value={fmtMoney(summary.totals.lostAmount)} />
        </div>
      )}

      {/* ---------- filters ---------- */}
      <div className="card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={competitor} onChange={(e) => setCompetitor(e.target.value)}>
            <option value="">All competitors</option>
            {competitors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={productLine} onChange={(e) => setProductLine(e.target.value)}>
            <option value="">All product lines</option>
            {productLines.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            <option value="closed_won">Won</option>
            <option value="closed_lost">Lost</option>
          </select>
          <select value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="">All deal sizes</option>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <div style={{ flex: "1 1 180px", maxWidth: 280 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or account"
              aria-label="Search opportunities"
            />
          </div>
        </div>
      </div>

      {/* ---------- charts ---------- */}
      {summary && (
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>By competitor</h3>
            {summary.byCompetitor.map((c) => (
              <WonLostBar key={c.competitor} label={c.competitor} won={c.won} lost={c.lost} max={maxCompetitor} />
            ))}
            {summary.byCompetitor.length === 0 && (
              <p className="empty-note">No data for these filters.</p>
            )}
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>By loss reason</h3>
            {summary.byLossReason.map((l) => (
              <div key={l.loss_reason} className="bar-row">
                <div className="lab" title={l.loss_reason}>
                  {l.loss_reason}
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill lost"
                    style={{ width: `${Math.round((l.count / maxLoss) * 100)}%`, minWidth: 4 }}
                  />
                </div>
                <div className="bar-val">{l.count}</div>
              </div>
            ))}
            {summary.byLossReason.length === 0 && (
              <p className="empty-note">No lost deals for these filters.</p>
            )}
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>By product line</h3>
            {summary.byProductLine.map((p) => (
              <WonLostBar key={p.product_line} label={p.product_line} won={p.won} lost={p.lost} max={maxLine} />
            ))}
            {summary.byProductLine.length === 0 && (
              <p className="empty-note">No data for these filters.</p>
            )}
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>By deal size</h3>
            {summary.byBand.map((b) => (
              <WonLostBar key={b.band} label={b.band} won={b.won} lost={b.lost} max={maxBand} />
            ))}
          </div>
        </div>
      )}

      {/* ---------- opportunity table ---------- */}
      <div className="card" style={{ overflowX: "auto" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>
          Opportunities ({opps.length.toLocaleString()})
        </h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Account</th>
              <th>Product line</th>
              <th>Stage</th>
              <th>Amount</th>
              <th>Competitor</th>
              <th>Loss reason</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => (
              <tr key={o.id} className="rowhover" style={{ cursor: "pointer" }} onClick={() => setSelected(o)}>
                <td style={{ fontWeight: 500 }}>{o.name}</td>
                <td>{o.account_name ?? "—"}</td>
                <td>{o.product_line ?? "—"}</td>
                <td>
                  <StagePill stage={o.stage} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(o.amount)}</td>
                <td>{o.competitor ?? "—"}</td>
                <td>{o.loss_reason ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.closed_at)}</td>
              </tr>
            ))}
            {opps.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-note">
                  No opportunities match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- opportunity drawer ---------- */}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>{selected.name}</h2>
              <button className="close" aria-label="Close" onClick={() => setSelected(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ marginBottom: 18 }}>
              <StagePill stage={selected.stage} />
            </div>
            <div className="grid grid-2" style={{ gap: 14 }}>
              {(
                [
                  ["Account", selected.account_name ?? "—"],
                  ["Product line", selected.product_line ?? "—"],
                  ["Amount", fmtMoney(selected.amount)],
                  ["Competitor", selected.competitor ?? "—"],
                  ["Loss reason", selected.loss_reason ?? "—"],
                  ["Closed", fmtDate(selected.closed_at)],
                  ["Owner", selected.owner ?? "—"],
                  ["Salesforce ID", selected.sf_id ?? "—"],
                  ["Synced", fmtDate(selected.synced_at)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      marginBottom: 3,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 13.5 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
