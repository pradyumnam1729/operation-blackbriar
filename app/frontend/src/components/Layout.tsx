import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../lib/api";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Home", icon: "fa-house" },
  { to: "/features", label: "Feature catalog", icon: "fa-layer-group" },
  { to: "/winloss", label: "Win / loss", icon: "fa-chart-column" },
  { to: "/requests", label: "Requests & intake", icon: "fa-upload" },
  { to: "/studio", label: "Asset studio", icon: "fa-wand-magic-sparkles" },
  { to: "/library", label: "Repository", icon: "fa-box-archive" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/uploads", label: "Uploads console", icon: "fa-shield-halved", adminOnly: true },
  { to: "/integrations", label: "Integrations", icon: "fa-circle-nodes", adminOnly: true },
  { to: "/foundation", label: "Foundation", icon: "fa-book", adminOnly: true },
];

function HiveMark() {
  return (
    <svg viewBox="0 0 90 84" width="30" height="28">
      <polygon points="45,4 78,23 78,61 45,80 12,61 12,23" fill="none" stroke="#8FBFC9" strokeWidth="3" />
      <polygon points="30,15 41.3,21.5 41.3,34.5 30,41 18.7,34.5 18.7,21.5" fill="#46B2BE" />
      <polygon points="60,15 71.3,21.5 71.3,34.5 60,41 48.7,34.5 48.7,21.5" fill="#0B4D5C" />
      <polygon points="45,41 56.3,47.5 56.3,60.5 45,67 33.7,60.5 33.7,47.5" fill="#F8D146" />
    </svg>
  );
}

function initials(name: string | null, email: string): string {
  const src = name && name.trim() !== "" ? name : email;
  const parts = src.replace(/[(),]/g, "").split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function Layout() {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () =>
      apiGet<{ notifications: { read: boolean }[] }>("/api/comments/notifications")
        .then((r) => alive && setHasUnread(r.notifications.some((n) => !n.read)))
        .catch(() => {});
    check();
    const t = window.setInterval(check, 30000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const renderItem = (n: NavItem) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.to === "/"}
      data-tooltip={n.label}
      className={({ isActive }) => (isActive ? "navitem active" : "navitem")}
    >
      <i className={`fa-solid ${n.icon}`} />
      <span className="navtext">{n.label}</span>
    </NavLink>
  );

  return (
    <div className={collapsed ? "app collapsed" : "app"}>
      <aside className="sidebar">
        <button
          className="sb-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((c) => !c)}
        >
          <i className={`fa-solid ${collapsed ? "fa-chevron-right" : "fa-chevron-left"}`} />
        </button>

        <div className="brand">
          <div className="mark">
            <HiveMark />
          </div>
          <div>
            <div className="name">Hive</div>
            <div className="sub">by Aurigo</div>
          </div>
        </div>

        <div className="navgroup">{MAIN_NAV.map(renderItem)}</div>

        {me?.role === "admin" && (
          <div className="navgroup">
            <div className="navlabel">Admin</div>
            {ADMIN_NAV.map(renderItem)}
          </div>
        )}

        <div className="sidebar-foot">
          Signed in as {me?.fullName ?? me?.email}
          <br />
          {me?.email}
          <br />
          <a onClick={() => void signOut()}>Sign out</a>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
            Hive
          </span>
          <div className="top-actions">
            <button
              className="icon-btn"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              <i className="fa-regular fa-bell" />
              {hasUnread && <span className="dot" />}
            </button>
            <div className="avatar" title={me?.email}>
              {initials(me?.fullName ?? null, me?.email ?? "")}
            </div>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
