import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Requests } from "./pages/Requests";
import { ArtifactLibrary } from "./pages/ArtifactLibrary";
import { ArtifactEditor } from "./pages/ArtifactEditor";
import { FeatureCatalog } from "./pages/FeatureCatalog";
import { CompetitiveIntel } from "./pages/CompetitiveIntel";
import { Guardrails } from "./pages/Guardrails";
import { UploadsConsole } from "./pages/UploadsConsole";
import { UsersAdmin } from "./pages/UsersAdmin";
import { Studio } from "./pages/Studio";
import { Templates } from "./pages/Templates";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { Agents } from "./pages/Agents";
import { Notifications } from "./pages/Notifications";
import "./styles/brand.css";
import "./styles/deck.css";

function Root() {
  const { loading, me } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!me) return <Login />;
  // Admin-only surfaces (Template library, PMM Workspace, Agents, Connectors,
  // Guardrails, Uploads): other roles are bounced to Home.
  const adminOnly = (el: React.ReactElement) =>
    me.role === "admin" ? el : <Navigate to="/" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ask" element={<Navigate to="/" replace />} />
        <Route path="/requests" element={<Requests />} />
        {/* The workspace page is admin-only; the editor stays open so Studio
            and battlecard saves can land non-admin drafts. */}
        <Route path="/library" element={adminOnly(<ArtifactLibrary />)} />
        <Route path="/library/:id" element={<ArtifactEditor />} />
        <Route path="/features" element={<FeatureCatalog />} />
        <Route path="/competitive" element={<CompetitiveIntel />} />
        <Route path="/pmm" element={<Navigate to="/library?tab=questionnaire" replace />} />
        <Route path="/guardrails" element={adminOnly(<Guardrails />)} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/templates" element={adminOnly(<Templates />)} />
        <Route path="/users" element={adminOnly(<UsersAdmin />)} />
        <Route path="/uploads" element={adminOnly(<UploadsConsole />)} />
        <Route path="/integrations" element={adminOnly(<IntegrationsPage />)} />
        <Route path="/agents" element={adminOnly(<Agents />)} />
        <Route path="/questionnaire" element={<Navigate to="/library?tab=questionnaire" replace />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
