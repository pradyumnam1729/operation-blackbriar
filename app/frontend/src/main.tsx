import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { AskWarRoom } from "./pages/AskWarRoom";
import { FoundationDoc } from "./pages/FoundationDoc";
import { Requests } from "./pages/Requests";
import { ArtifactLibrary } from "./pages/ArtifactLibrary";
import { ArtifactEditor } from "./pages/ArtifactEditor";
import { FeatureCatalog } from "./pages/FeatureCatalog";
import { WinLoss } from "./pages/WinLoss";
import { UploadsConsole } from "./pages/UploadsConsole";
import { Studio } from "./pages/Studio";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { Notifications } from "./pages/Notifications";
import "./styles/brand.css";

function Root() {
  const { loading, me } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!me) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/ask" replace />} />
        <Route path="/ask" element={<AskWarRoom />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/library" element={<ArtifactLibrary />} />
        <Route path="/library/:id" element={<ArtifactEditor />} />
        <Route path="/features" element={<FeatureCatalog />} />
        <Route path="/winloss" element={<WinLoss />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/uploads" element={<UploadsConsole />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/foundation" element={<FoundationDoc />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/ask" replace />} />
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
