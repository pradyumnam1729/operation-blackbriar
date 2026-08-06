import { useState } from "react";
import { AskWarRoom } from "./pages/AskWarRoom";
import { FoundationDoc } from "./pages/FoundationDoc";
import { AssetGenerator } from "./pages/AssetGenerator";
import { Approvals } from "./pages/Approvals";

const TABS = [
  ["ask", "Ask the War Room"],
  ["foundation", "Foundational Doc"],
  ["assets", "Generate Assets"],
  ["approvals", "Approvals"],
] as const;

type Tab = (typeof TABS)[number][0];

export default function App() {
  const [tab, setTab] = useState<Tab>("ask");

  return (
    <>
      <header className="app-header">
        <span className="brand">PMM Agent</span>
        <nav>
          {TABS.map(([id, label]) => (
            <a
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        {tab === "ask" && <AskWarRoom />}
        {tab === "foundation" && <FoundationDoc />}
        {tab === "assets" && <AssetGenerator />}
        {tab === "approvals" && <Approvals />}
      </main>
    </>
  );
}
