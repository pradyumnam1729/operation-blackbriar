import { ReactNode, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { SharePointDrawer } from "../components/SharePointDrawer";
import { LocalFoldersDrawer } from "../components/LocalFoldersDrawer";

// Connectors screen — one card per connector (blueprint connectors-cards.md).
// The page shell loads the three status GETs, renders the card grid with
// flag-toggle pills, and opens the SharePoint / Local folders config drawers.
// All mutations are admin-only on the backend; non-admins see static pills and
// read-only drawers.

interface FlagRow {
  key: string;
  enabled: boolean;
}

interface LfSummary {
  configured: boolean;
  enabled?: boolean;
  lastScan?: string | null;
  lastExport?: string | null;
}

interface SpSummary {
  configured: boolean;
  flagEnabled: boolean;
  connections: { enabled: boolean; lastSync: string | null }[];
}

interface ConnectorCard {
  id: string;
  name: string;
  subline: string;
  icon: string; // full Font Awesome class
  desc: string;
  toggle: {
    on: boolean;
    labels: [string, string];
    disabled?: boolean;
    hint?: string;
    run: () => Promise<void>;
  };
  footerPill: { cls: string; label: string };
  stat: ReactNode;
  opens: "sharepoint" | "localfolders" | null;
}

function fmt(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "never";
}

export function IntegrationsPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === "admin";

  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [lf, setLf] = useState<LfSummary | null>(null);
  const [sp, setSp] = useState<SpSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<"sharepoint" | "localfolders" | null>(null);

  const load = useCallback(async () => {
    const [fr, lr, sr] = await Promise.allSettled([
      apiGet<{ flags: FlagRow[] }>("/api/integrations"),
      apiGet<LfSummary>("/api/local-folders"),
      apiGet<SpSummary>("/api/sharepoint/status"),
    ]);
    const errs: string[] = [];
    if (fr.status === "fulfilled") setFlags(fr.value.flags);
    else errs.push((fr.reason as Error).message);
    if (lr.status === "fulfilled") setLf(lr.value);
    else errs.push((lr.reason as Error).message);
    if (sr.status === "fulfilled") setSp(sr.value);
    else errs.push((sr.reason as Error).message);
    setError(errs.join(" · "));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flagOn = (key: string) => flags.find((f) => f.key === key)?.enabled ?? false;

  const flip = (card: ConnectorCard) => {
    if (!isAdmin || card.toggle.disabled === true || busy !== "") return;
    setBusy(card.id);
    setError("");
    card.toggle
      .run()
      .then(load)
      .catch((e) => {
        const msg = (e as Error).message;
        setError(
          msg.includes("Admin")
            ? "Only PMMs (admins) can change integration settings. Ask a PMM to flip this."
            : msg
        );
      })
      .finally(() => setBusy(""));
  };

  const lastSpSync =
    sp !== null && sp.connections.length > 0
      ? sp.connections
          .map((c) => c.lastSync)
          .filter((s): s is string => s !== null)
          .sort()
          .at(-1) ?? null
      : null;

  const cards: ConnectorCard[] = [
    {
      id: "sharepoint",
      name: "SharePoint (Microsoft Graph)",
      subline: "sharepoint_graph",
      icon: "fa-brands fa-microsoft",
      desc: "Live sync of release notes and context docs via Microsoft Graph.",
      toggle: {
        on: flagOn("sharepoint_graph"),
        labels: ["Live sync on", "Live sync off"],
        run: async () => {
          await apiPost("/api/integrations/flags/sharepoint_graph/toggle");
        },
      },
      footerPill:
        sp === null
          ? { cls: "pill-pending", label: "Status unavailable" }
          : sp.configured
            ? { cls: "pill-live", label: "Credentials configured" }
            : { cls: "pill-lock", label: "Credentials missing" },
      stat:
        sp !== null
          ? `${sp.connections.length} connection${sp.connections.length === 1 ? "" : "s"} · last sync ${fmt(lastSpSync)}`
          : "",
      opens: "sharepoint",
    },
    {
      id: "localfolders",
      name: "Local folders (Input / Output)",
      subline: "local-folders",
      icon: "fa-solid fa-hard-drive",
      desc: "Watched Input folder + Output export — the SharePoint stand-in.",
      toggle: {
        on: lf?.enabled ?? false,
        labels: ["Watching Input", "Paused"],
        disabled: lf?.configured !== true,
        hint: lf?.configured === true ? undefined : "Configure the folder pair first",
        run: async () => {
          await apiPost("/api/local-folders/toggle");
        },
      },
      footerPill:
        lf === null
          ? { cls: "pill-pending", label: "Status unavailable" }
          : lf.configured
            ? { cls: "pill-live", label: "Configured" }
            : { cls: "pill-pending", label: "Not configured" },
      stat: lf !== null ? `last scan ${fmt(lf.lastScan)} · last export ${fmt(lf.lastExport)}` : "",
      opens: "localfolders",
    },
    {
      id: "salesforce",
      name: "Salesforce",
      subline: "salesforce_live",
      icon: "fa-solid fa-cloud",
      desc: "Nightly sync of win / loss opportunity data.",
      toggle: {
        on: flagOn("salesforce_live"),
        labels: ["Live (mock)", "Off"],
        run: async () => {
          await apiPost("/api/integrations/flags/salesforce_live/toggle");
        },
      },
      footerPill: { cls: "pill-review", label: "Mock data" },
      stat: "Mock opportunities until the read-only Connected App is provisioned.",
      opens: null,
    },
    {
      id: "canva",
      name: "Canva",
      subline: "canva_live",
      icon: "fa-solid fa-palette",
      desc: "Populate approved brand templates directly in Asset Studio.",
      toggle: {
        on: flagOn("canva_live"),
        labels: ["Live (mock)", "Off"],
        run: async () => {
          await apiPost("/api/integrations/flags/canva_live/toggle");
        },
      },
      footerPill: { cls: "pill-review", label: "Mock data" },
      stat: "Mock template gallery until the Canva Connect OAuth app exists.",
      opens: null,
    },
  ];

  const renderCard = (c: ConnectorCard) => {
    const clickable = c.opens !== null;
    return (
      <div
        key={c.id}
        className="card"
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={() => clickable && setOpen(c.opens)}
        onKeyDown={(e) => {
          // Only when the card itself is focused — a focused toggle pill must
          // keep its native Enter/Space activation.
          if (e.target !== e.currentTarget) return;
          if (clickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(c.opens);
          }
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 0,
          padding: "18px 18px 14px",
          cursor: clickable ? "pointer" : "default",
          transition: "box-shadow .15s ease, transform .15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-2)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
          (e.currentTarget as HTMLDivElement).style.transform = "";
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--r-sm)",
              background: "#E1F0F2",
              color: "var(--teal-dark)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 15,
            }}
          >
            <i className={c.icon} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
                lineHeight: 1.3,
              }}
            >
              {c.name}
            </div>
            <div
              style={{
                fontFamily: "Consolas, monospace",
                fontSize: 10.5,
                color: "var(--text-muted)",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.subline}
            </div>
          </div>
          {isAdmin ? (
            <button
              className={`pill ${c.toggle.on ? "pill-live" : "pill-lost"}`}
              style={{ border: "none", cursor: c.toggle.disabled === true ? "not-allowed" : "pointer", flexShrink: 0 }}
              disabled={busy !== "" || c.toggle.disabled === true}
              onClick={(e) => {
                e.stopPropagation();
                flip(c);
              }}
              title={c.toggle.hint ?? (c.toggle.on ? "Click to turn off" : "Click to turn on")}
            >
              {c.toggle.on ? c.toggle.labels[0] : c.toggle.labels[1]}
            </button>
          ) : (
            <span className={`pill ${c.toggle.on ? "pill-live" : "pill-lost"}`} style={{ flexShrink: 0 }}>
              {c.toggle.on ? c.toggle.labels[0] : c.toggle.labels[1]}
            </span>
          )}
        </div>

        {/* description */}
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 40,
          }}
          title={c.desc}
        >
          {c.desc}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: "auto",
            paddingTop: 10,
            borderTop: "1px solid var(--border)",
          }}
        >
          <span className={`pill ${c.footerPill.cls}`}>{c.footerPill.label}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1, minWidth: 0 }}>{c.stat}</span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 className="pagetitle">
        Connectors{" "}
        <span className="pill pill-lock" style={{ marginLeft: 6 }}>
          <i className="fa-solid fa-lock" style={{ fontSize: 9 }} /> Admin only
        </span>
      </h1>
      <p className="pagesub">
        Turn on the systems Hive pulls from and pushes to. Only PMM admins can change settings.
      </p>

      {error !== "" && (
        <div
          style={{
            background: "#FCE8E8",
            color: "#A32D2D",
            borderRadius: "var(--r-md)",
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-note">Loading connectors…</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: 14,
          }}
        >
          {cards.map(renderCard)}
        </div>
      )}

      {open === "sharepoint" && (
        <SharePointDrawer isAdmin={isAdmin} onClose={() => setOpen(null)} onChanged={() => void load()} />
      )}
      {open === "localfolders" && (
        <LocalFoldersDrawer isAdmin={isAdmin} onClose={() => setOpen(null)} onChanged={() => void load()} />
      )}
    </div>
  );
}
