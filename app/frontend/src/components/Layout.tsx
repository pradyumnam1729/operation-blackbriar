import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface NavItem {
  to: string;
  label: string;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/ask", label: "Ask the War Room" },
  { to: "/requests", label: "Requests" },
  { to: "/library", label: "Artifact Library" },
  { to: "/features", label: "Feature Catalog" },
  { to: "/winloss", label: "Win/Loss" },
  { to: "/studio", label: "Asset Studio" },
  { to: "/uploads", label: "Uploads", adminOnly: true },
  { to: "/integrations", label: "Integrations", adminOnly: true },
  { to: "/foundation", label: "Foundation", adminOnly: true },
  { to: "/notifications", label: "Notifications" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "PMM Admin",
  sales: "Sales",
  marketing: "Marketing",
  elt: "ELT",
};

export function Layout() {
  const { me, signOut } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">PMM Agent</div>
        <nav>
          {NAV.filter((n) => !n.adminOnly || me?.role === "admin").map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{me?.fullName ?? me?.email}</strong>
            <span className="role-badge">{ROLE_LABELS[me?.role ?? ""] ?? me?.role}</span>
          </div>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      </aside>
      <div className="content">
        <Outlet />
      </div>
    </div>
  );
}
