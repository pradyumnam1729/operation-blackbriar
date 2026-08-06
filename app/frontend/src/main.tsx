import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { FoundationQuestionnaire } from "./pages/FoundationQuestionnaire";
import { Requests } from "./pages/Requests";
import { ArtifactLibrary } from "./pages/ArtifactLibrary";
import { ArtifactEditor } from "./pages/ArtifactEditor";
import { FeatureCatalog } from "./pages/FeatureCatalog";
import { WinLoss } from "./pages/WinLoss";
import { CompetitiveIntel } from "./pages/CompetitiveIntel";
import { PMMWorkspace } from "./pages/PMMWorkspace";
import { PMMWizard } from "./pages/PMMWizard";
import { PMMDocDetail } from "./pages/PMMDocDetail";
import { Guardrails } from "./pages/Guardrails";
import { UploadsConsole } from "./pages/UploadsConsole";
import { Studio } from "./pages/Studio";
import { Templates } from "./pages/Templates";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { Agents } from "./pages/Agents";
import { Notifications } from "./pages/Notifications";
import "./styles/brand.css";

function Root() {
  const { loading, me } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!me) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ask" element={<Navigate to="/" replace />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/library" element={<ArtifactLibrary />} />
        <Route path="/library/:id" element={<ArtifactEditor />} />
        <Route path="/features" element={<FeatureCatalog />} />
        <Route path="/winloss" element={<WinLoss />} />
        <Route path="/competitive" element={<CompetitiveIntel />} />
        <Route path="/pmm" element={<PMMWorkspace />} />
        <Route path="/pmm/:id" element={<PMMDocDetail />} />
        <Route path="/pmm/:id/edit" element={<PMMWizard />} />
        <Route path="/guardrails" element={<Guardrails />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/uploads" element={<UploadsConsole />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/questionnaire" element={<FoundationQuestionnaire />} />
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
