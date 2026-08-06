import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { askWarRoom } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type Persona = "sales" | "marketing" | "elt";

const PERSONA_TO_ROLE: Record<Persona, string> = {
  sales: "sales",
  marketing: "marketing",
  elt: "leadership",
};

const HOME_SUBS: Record<Persona, string> = {
  sales: "Here's what's relevant to Sales today.",
  marketing: "Here's what's relevant to Marketing today.",
  elt: "A strategic pulse across GTM programs.",
};

const PLACEHOLDERS: Record<Persona, string> = {
  sales: "Ask for a talk track, a battlecard, or a business case...",
  marketing: "Ask for a datasheet, an FAQ, or messaging guidance...",
  elt: "Ask for a KPI snapshot, a roadmap pulse, or a governance check...",
};

const SUGGESTIONS: Record<Persona, string[]> = {
  sales: [
    "Give me a talk track for a state DOT worried about staff turnover",
    "Build a battlecard against Kahua for a Masterworks deal",
    "Find proof points for an airport client",
  ],
  marketing: [
    "Draft an FAQ for Masterworks Plan capital planners",
    "What are our approved differentiators for Primus?",
    "Check what our brand voice rules say about AI claims",
  ],
  elt: [
    "Summarize how we win against Oracle Primavera",
    "What shipped across all products recently?",
    "What are the top loss reasons this quarter?",
  ],
};

interface QuickAction {
  icon: string;
  title: string;
  desc: string;
  to: string;
}

const QUICK: Record<Persona, QuickAction[]> = {
  sales: [
    { icon: "fa-shield-halved", title: "Competitor battlecard", desc: "Strengths, weaknesses, landmines, talk track by competitor.", to: "/library" },
    { icon: "fa-chart-column", title: "Win / loss by competitor", desc: "See how we're doing against Oracle, Kahua, e-Builder.", to: "/winloss" },
    { icon: "fa-magnifying-glass", title: "Find an asset", desc: "Search finished, approved collateral by product and persona.", to: "/library" },
    { icon: "fa-upload", title: "Request an asset", desc: "Need something that doesn't exist yet? File a request with context.", to: "/requests" },
    { icon: "fa-layer-group", title: "Feature catalog", desc: "What shipped recently, per product, straight from release notes.", to: "/features" },
    { icon: "fa-calculator", title: "Business case builder", desc: "Generate an executive one-pager from a template.", to: "/studio" },
  ],
  marketing: [
    { icon: "fa-wand-magic-sparkles", title: "Asset creation studio", desc: "Datasheets, decks, FAQs on approved brand templates.", to: "/studio" },
    { icon: "fa-layer-group", title: "Feature catalog", desc: "Every recent feature by product, straight from release notes.", to: "/features" },
    { icon: "fa-box-archive", title: "Content repository", desc: "Browse finished assets by product, type, and persona.", to: "/library" },
    { icon: "fa-upload", title: "Submit source material", desc: "Attach transcripts, briefs, and decks to a request.", to: "/requests" },
    { icon: "fa-comments", title: "Collaborate", desc: "Comment, @mention, and resolve threads on any asset.", to: "/library" },
    { icon: "fa-bell", title: "Notifications", desc: "Mentions and updates across your requests and assets.", to: "/notifications" },
  ],
  elt: [
    { icon: "fa-chart-line", title: "Win rate snapshot", desc: "Closed-won / lost trend by product line and competitor.", to: "/winloss" },
    { icon: "fa-layer-group", title: "Roadmap pulse", desc: "What shipped this quarter, by product.", to: "/features" },
    { icon: "fa-box-archive", title: "Asset governance", desc: "Draft / in review / final mix across the repository.", to: "/library" },
    { icon: "fa-upload", title: "Requests pipeline", desc: "What GTM teams are asking for right now.", to: "/requests" },
  ],
};

interface Bubble {
  role: "user" | "bot";
  text?: string;
  html?: string;
}

export function Home() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const defaultPersona: Persona =
    me?.role === "marketing" ? "marketing" : me?.role === "elt" ? "elt" : "sales";
  const [persona, setPersona] = useState<Persona>(defaultPersona);
  const [thread, setThread] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    const first = (me?.fullName ?? me?.email ?? "").split(/[\s(@]/)[0];
    return `Good ${part}, ${first || "there"}`;
  }, [me]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (q === "" || busy) return;
    setInput("");
    setThread((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await askWarRoom(q, PERSONA_TO_ROLE[persona]);
      setThread((t) => [...t, { role: "bot", html: r.answerHtml }]);
    } catch (e) {
      setThread((t) => [
        ...t,
        { role: "bot", text: `I couldn't answer that: ${(e as Error).message}` },
      ]);
    } finally {
      setBusy(false);
      window.setTimeout(
        () => threadRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
        50
      );
    }
  };

  const initials = ((me?.fullName ?? me?.email ?? "U").match(/\b\w/g) ?? ["U"])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <h1 className="pagetitle">{greeting}</h1>
      <p className="pagesub">{HOME_SUBS[persona]}</p>

      <div style={{ marginBottom: 20 }}>
        <div className="persona-label">Who's asking?</div>
        <div className="persona-switch">
          {(["sales", "marketing", "elt"] as Persona[]).map((p) => (
            <button
              key={p}
              className={persona === p ? "active" : ""}
              onClick={() => setPersona(p)}
            >
              {p === "elt" ? "ELT" : p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-hero">
        <div className="chat-heading">
          <i className="fa-solid fa-wand-magic-sparkles" /> Ask Hive
        </div>
        <div className="chat-thread" ref={threadRef}>
          {thread.map((b, i) => (
            <div key={i} className={`chat-bubble ${b.role}`}>
              <div className="av">
                {b.role === "user" ? (
                  initials
                ) : (
                  <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: 11 }} />
                )}
              </div>
              <div className="msg">
                {b.html ? (
                  <div className="prose" dangerouslySetInnerHTML={{ __html: b.html }} />
                ) : (
                  b.text
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="chat-bubble bot">
              <div className="av">
                <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: 11 }} />
              </div>
              <div className="msg" style={{ color: "var(--text-muted)" }}>
                Consulting the war room…
              </div>
            </div>
          )}
        </div>
        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <i className="fa-solid fa-message" style={{ color: "var(--teal-light)", fontSize: 15 }} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDERS[persona]}
          />
          <button type="submit" className="chat-send" disabled={busy}>
            <i className="fa-solid fa-arrow-up" />
          </button>
        </form>
        <div className="chip-row">
          {SUGGESTIONS[persona].map((s) => (
            <button key={s} type="button" className="sugg-chip" onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <h3 className="section-label">Quick actions</h3>
      <div className="grid grid-3">
        {QUICK[persona].map((q) => (
          <div key={q.title} className="quick-card" onClick={() => navigate(q.to)}>
            <div className="qicon">
              <i className={`fa-solid ${q.icon}`} />
            </div>
            <h3>{q.title}</h3>
            <p>{q.desc}</p>
            <span className="go">
              Open <i className="fa-solid fa-arrow-right" style={{ fontSize: 10 }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
