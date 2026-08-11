import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, askWarRoom, AskTraceStep, RoutingProposal } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { RoutingCard } from "../components/RoutingCard";

// Home dashboard (hive 2): persona-specific quick-generation cards. Every
// card opens the generator — pick product + industry (+ content type for
// marketing) — and produces a ready-to-review asset from the knowledge base.

type Persona = "sales" | "marketing" | "elt" | "proposals";

const PERSONA_TO_ROLE: Record<Persona, string> = {
  sales: "sales",
  marketing: "marketing",
  elt: "leadership",
  proposals: "proposals",
};

const HOME_SUBS: Record<Persona, string> = {
  sales: "Here's what's relevant to Sales today.",
  marketing: "Here's what's relevant to Marketing today.",
  elt: "A strategic pulse across GTM programs.",
  proposals: "Here's what's relevant to Proposals today.",
};

const PLACEHOLDERS: Record<Persona, string> = {
  sales: "Ask for a talk track, a battlecard, or a business case...",
  marketing: "Ask for a video script, a datasheet, or messaging guidance...",
  elt: "Ask for a KPI snapshot, a roadmap pulse, or a governance check...",
  proposals: "Ask for RFP response language, a compliance answer, or cleared proof points...",
};

const SUGGESTIONS: Record<Persona, string[]> = {
  sales: [
    "Give me a talk track for a state DOT worried about staff turnover",
    "Build a battlecard against Kahua for a Masterworks deal",
    "Find proof points for an airport client",
  ],
  marketing: [
    "Draft a FAQ for Masterworks local agency buyers",
    "What are our approved differentiators for Primus?",
    "Check what our brand voice rules say about AI claims",
  ],
  elt: [
    "Summarize how we win against Oracle Primavera",
    "What shipped across all products recently?",
    "What are the top loss reasons this quarter?",
  ],
  proposals: [
    "Draft a compliant response to a Davis-Bacon documentation requirement",
    "What proof points are cleared for external use in an RFP for a state DOT?",
    "Write a boilerplate company & product overview for a Masterworks proposal",
  ],
};

interface GenCard {
  icon: string;
  title: string;
  desc: string;
  /** Backend quick-generate action key when it differs from the display title
   *  (audit fix: card titles must not impersonate nav destinations). */
  action?: string;
}

/** The action key sent to /api/quick-generate for a card. */
const actionOf = (c: GenCard | null): string => (c ? (c.action ?? c.title) : "");

// hive 2 persona card sets — every card generates, none navigate.
const GEN_CARDS: Record<Persona, GenCard[]> = {
  sales: [
    { icon: "fa-bolt", title: "Elevator pitch", desc: "Tell it who you're calling — get a 30-second opener and discovery questions." },
    { icon: "fa-shield-halved", title: "Competitive brief", action: "Competitive intel", desc: "Generate strengths, weaknesses, landmines, and a talk track — deep analysis lives on the Competitive intel page." },
    { icon: "fa-lightbulb", title: "Value proposition", desc: "The value prop and proof points that win, by persona." },
    { icon: "fa-magnifying-glass", title: "Enablement assets", desc: "Which proof points and case studies fit, by industry." },
    { icon: "fa-star", title: "Customer proof points", desc: "Real quotes and metrics, matched to the prospect's industry." },
    { icon: "fa-thumbs-up", title: "LinkedIn content kit", desc: "Ready-made posts and a posting guide." },
  ],
  marketing: [
    { icon: "fa-wand-magic-sparkles", title: "Content creation studio", desc: "Pick a product, then create case studies, social posts, video scripts, or ad campaign copy." },
    { icon: "fa-bullhorn", title: "Campaign brief generator", desc: "Pick a theme and funnel stage for a full brief: lead message, target persona, channel mix, and CTA." },
    { icon: "fa-magnifying-glass-chart", title: "SEO/AEO content brief builder", desc: "Pick a topic or keyword cluster for a content brief built to your AEO standard, not just SEO." },
    { icon: "fa-rocket", title: "Launch asset kit", desc: "When a feature ships, generate the full bundle: website copy, a social post, a PR angle, and an email." },
  ],
  elt: [
    { icon: "fa-microphone-lines", title: "Keynote talk-track builder", desc: "8–10 talking points built from recent shipped features and a proof point." },
    { icon: "fa-feather-pointed", title: "Thought-leadership draft generator", desc: "A byline/LinkedIn outline in your voice, drawn from customer evidence." },
    { icon: "fa-chart-pie", title: "Quarterly exec summary", desc: "One-page rollup of position, launches, and outcomes — in board language." },
    { icon: "fa-newspaper", title: "Analyst/press briefing brief", desc: "Feature list, competitive positioning, and cleared proof points, ready before a call." },
    { icon: "fa-shield-halved", title: "Competitive brief", action: "Competitive intel", desc: "Generate strengths, weaknesses, landmines, and a talk track — deep analysis lives on the Competitive intel page." },
  ],
  proposals: [
    { icon: "fa-layer-group", title: "Feature rundown", action: "Feature catalog", desc: "Generate a per-product feature summary — the live catalog is on the Feature catalog page." },
    { icon: "fa-shield-halved", title: "Competitive brief", action: "Competitive intel", desc: "Generate strengths, weaknesses, landmines, and a talk track — deep analysis lives on the Competitive intel page." },
  ],
};

const GEN_PRODUCTS = ["Masterworks", "Masterworks AI", "Primus"];

const GENERIC_VERTICAL = "Generic / All Verticals";

// Each product owns its own vertical list — deliberately not a shared lookup,
// since Masterworks and Primus sell into different markets.
const GEN_INDUSTRIES_BY_PRODUCT: Record<string, string[]> = {
  Masterworks: [
    GENERIC_VERTICAL,
    "Transportation (DOT/Transit/Airports)",
    "Water & Utilities",
    "Healthcare & Higher Education",
    "State & Local Government",
    "Federal Agencies",
  ],
  "Masterworks AI": [GENERIC_VERTICAL],
  Primus: [
    GENERIC_VERTICAL,
    "Data Centers",
    "Energy & Utilities",
    "Manufacturing",
    "Life Sciences",
    "Private Sector",
  ],
};

const GEN_CONTENT_TYPES = [
  "Video script",
  "Email campaign",
  "Social media",
  "LinkedIn AD",
  "Webpage copy",
  "Event banner",
];

// Competitor picker for the "Competitive intel" card — per product, since
// Masterworks and Primus compete against different sets. Products with no
// list here (Masterworks AI) fall back to the model picking automatically.
const GEN_COMPETITORS_BY_PRODUCT: Record<string, string[]> = {
  Masterworks: ["Kahua", "e-Builder", "Oracle", "Procore"],
  Primus: ["Procore", "Oracle Primavera", "Kahua", "Copperleaf", "Ecosys"],
};

interface GenResult {
  tag: string;
  html: string;
  evidence: { title: string; docType: string }[];
}

interface Bubble {
  role: "user" | "bot";
  text?: string;
  html?: string;
  /** kind:"routing" ask response — rendered as a RoutingCard confirmation
   *  (blueprint ask-to-artifact.md §6.2). */
  proposal?: RoutingProposal;
  /** The original ask, kept so "Just answer this instead" can re-submit it
   *  with mode:"question". */
  question?: string;
  /** Agentic evidence trail: the tools the model chose to consult. */
  trace?: AskTraceStep[];
}

const TRACE_LABELS: Record<string, { icon: string; label: string }> = {
  search_knowledge_base: { icon: "fa-database", label: "Searched knowledge base" },
  search_war_room: { icon: "fa-folder-open", label: "Searched war room" },
  get_product_features: { icon: "fa-layer-group", label: "Pulled feature catalog" },
  get_competitor_sources: { icon: "fa-chess", label: "Fetched competitor sources" },
  list_final_assets: { icon: "fa-box-archive", label: "Checked repository" },
  invoke_custom_agent: { icon: "fa-plug", label: "Delegated to team agent" },
};

export function Home() {
  const { me } = useAuth();
  const defaultPersona: Persona =
    me?.role === "marketing" ? "marketing" : me?.role === "elt" ? "elt" : "sales";
  const [persona, setPersona] = useState<Persona>(defaultPersona);
  const [thread, setThread] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  // Suggestion chips come from the admin-managed Prompt-library guardrail,
  // with the built-in list as fallback.
  const [liveSuggestions, setLiveSuggestions] = useState<Record<string, string[]>>({});

  // ---- generator modal state ----
  const [genCard, setGenCard] = useState<GenCard | null>(null);
  const [genPhase, setGenPhase] = useState<"select" | "loading" | "result">("select");
  const [genProduct, setGenProduct] = useState("");
  const [genIndustry, setGenIndustry] = useState("");
  const [genType, setGenType] = useState("");
  const [genCompetitor, setGenCompetitor] = useState("");
  const [genResult, setGenResult] = useState<GenResult | null>(null);
  const [genError, setGenError] = useState("");
  const [loadMsg, setLoadMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const loadTimer = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const needsContentType = persona === "marketing" && genCard?.title === "Content creation studio";
  // Industry vertical applies to EVERY quick action — an elevator pitch for a
  // DOT is not one for a water utility. "Generic / All Verticals" stays
  // preselected (pickGenProduct), so one-click generation still works.
  // Competitor remains Competitive-intel-only.
  const needsIndustry = genCard !== null;
  const competitorOptions = GEN_COMPETITORS_BY_PRODUCT[genProduct] ?? [];
  const needsCompetitor = actionOf(genCard) === "Competitive intel" && competitorOptions.length > 0;
  const genReady =
    genProduct !== "" &&
    genIndustry !== "" &&
    (!needsContentType || genType !== "") &&
    (!needsCompetitor || genCompetitor !== "");

  useEffect(() => {
    apiGet<{ suggestions: Record<string, string[]> }>("/api/guardrails/prompts")
      .then((r) => setLiveSuggestions(r.suggestions))
      .catch(() => {});
    return () => {
      if (loadTimer.current !== null) window.clearInterval(loadTimer.current);
    };
  }, []);

  const suggestionsFor = (p: Persona): string[] => {
    const key = p === "elt" ? "elt" : p;
    const live = liveSuggestions[key] ?? (p === "elt" ? liveSuggestions["pmm"] : undefined);
    return live && live.length > 0 ? live.slice(0, 3) : SUGGESTIONS[p];
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    const first = (me?.fullName ?? me?.email ?? "").split(/[\s(@]/)[0];
    return `Good ${part}, ${first || "there"}`;
  }, [me]);

  // ---- generator flow ----

  const openGenerator = (card: GenCard) => {
    setGenCard(card);
    setGenPhase("select");
    setGenProduct("");
    setGenIndustry("");
    setGenType("");
    setGenCompetitor("");
    setGenResult(null);
    setGenError("");
    setCopied(false);
  };

  const closeGenerator = () => {
    if (loadTimer.current !== null) window.clearInterval(loadTimer.current);
    setGenCard(null);
  };

  // Picking a product resets the industry to that product's default
  // ("Generic / All Verticals") and clears the competitor pick, since both
  // lists are per-product.
  const pickGenProduct = (p: string) => {
    setGenProduct(p);
    setGenIndustry(GEN_INDUSTRIES_BY_PRODUCT[p]?.[0] ?? GENERIC_VERTICAL);
    setGenCompetitor("");
  };

  const runGeneration = async () => {
    if (!genCard || !genReady) return;
    setGenPhase("loading");
    setGenError("");
    const stages = [
      `Pulling ${genProduct} context and ${
        genIndustry === GENERIC_VERTICAL ? "general" : genIndustry
      } proof points…`,
      needsCompetitor
        ? `Building the case against ${genCompetitor}…`
        : genType !== ""
          ? `Shaping this as a ${genType.toLowerCase()}…`
          : "Matching knowledge-base evidence to this request…",
      "Writing the draft in Aurigo voice…",
    ];
    let i = 0;
    setLoadMsg(stages[0]);
    if (loadTimer.current !== null) window.clearInterval(loadTimer.current);
    loadTimer.current = window.setInterval(() => {
      i = Math.min(i + 1, stages.length - 1);
      setLoadMsg(stages[i]);
    }, 3500);
    try {
      const r = await apiPost<GenResult>("/api/quick-generate", {
        action: actionOf(genCard),
        product: genProduct,
        industry: genIndustry,
        contentType: needsContentType ? genType : undefined,
        competitor: needsCompetitor ? genCompetitor : undefined,
      });
      setGenResult(r);
      setGenPhase("result");
    } catch (e) {
      setGenError((e as Error).message);
      setGenPhase("select");
    } finally {
      if (loadTimer.current !== null) window.clearInterval(loadTimer.current);
    }
  };

  const copyResult = async () => {
    if (!resultRef.current) return;
    try {
      await navigator.clipboard.writeText(resultRef.current.innerText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  // ---- chat ----

  // mode "question" skips the ask-router — used by the routing card's
  // "Just answer this instead" (misclassification recovery in one click).
  const send = async (text?: string, mode?: "auto" | "question") => {
    const q = (text ?? input).trim();
    if (q === "" || busy) return;
    setInput("");
    setThread((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await askWarRoom(q, PERSONA_TO_ROLE[persona], mode);
      if (r.kind === "routing") {
        // Artifact request — render the confirmation card; nothing generates
        // until the human clicks Generate (§8.4).
        setThread((t) => [...t, { role: "bot", proposal: r.proposal, question: q }]);
      } else {
        setThread((t) => [...t, { role: "bot", html: r.answerHtml, trace: r.trace }]);
      }
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

  const fieldLabel = (label: string) => (
    <div
      style={{
        fontSize: 11.5,
        textTransform: "uppercase",
        letterSpacing: ".05em",
        color: "var(--teal-dark)",
        fontWeight: 600,
        marginBottom: 8,
      }}
    >
      {label}
    </div>
  );

  const pillRow = (label: string, values: string[], picked: string, onPick: (v: string) => void) => (
    <div style={{ marginBottom: 16 }}>
      {fieldLabel(label)}
      <div className="step-pills">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className={`step-pill ${picked === v ? "active" : ""}`}
            onClick={() => onPick(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  // Per-product industry vertical — a real dropdown, not pills, with
  // "Generic / All Verticals" as the pre-selected default.
  const industryDropdown = () => (
    <div style={{ marginBottom: 16 }}>
      {fieldLabel("Industry vertical")}
      <select value={genIndustry} onChange={(e) => setGenIndustry(e.target.value)}>
        {(GEN_INDUSTRIES_BY_PRODUCT[genProduct] ?? [GENERIC_VERTICAL]).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );

  // Competitor picker — only ever rendered for the "Competitive intel" card
  // (see needsCompetitor). No other quick action touches this field.
  const competitorDropdown = () => (
    <div style={{ marginBottom: 16 }}>
      {fieldLabel("Competitor")}
      <select value={genCompetitor} onChange={(e) => setGenCompetitor(e.target.value)}>
        <option value="" disabled>
          Select a competitor…
        </option>
        {competitorOptions.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <h1 className="pagetitle">{greeting}</h1>
      <p className="pagesub">{HOME_SUBS[persona]}</p>

      <div style={{ marginBottom: 20 }}>
        <div className="persona-label">Who's asking?</div>
        <div className="persona-switch">
          {(["sales", "marketing", "elt", "proposals"] as Persona[]).map((p) => (
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
        <div className="chat-heading" style={{ display: "flex", alignItems: "center" }}>
          <i className="fa-solid fa-wand-magic-sparkles" /> Ask Hive
          {thread.length > 0 && (
            <button
              type="button"
              title="Reset chat"
              onClick={() => setThread([])}
              style={{
                marginLeft: "auto",
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "1px solid var(--border-strong, #CBD5E1)",
                background: "#fff",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <i className="fa-solid fa-arrow-rotate-left" style={{ fontSize: 12 }} />
            </button>
          )}
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
                {b.proposal ? (
                  <RoutingCard
                    proposal={b.proposal}
                    question={b.question ?? ""}
                    onAnswerInstead={() => void send(b.question, "question")}
                  />
                ) : b.html ? (
                  <>
                    {b.trace && b.trace.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          marginBottom: 10,
                          paddingBottom: 10,
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        {b.trace.map((s, ti) => {
                          const meta = TRACE_LABELS[s.tool] ?? { icon: "fa-gear", label: s.tool };
                          return (
                            <div
                              key={ti}
                              style={{
                                fontSize: 11.5,
                                color: "var(--text-muted)",
                                display: "flex",
                                alignItems: "baseline",
                                gap: 6,
                              }}
                            >
                              <i
                                className={`fa-solid ${meta.icon}`}
                                style={{ fontSize: 10, color: "var(--teal-light)", width: 12 }}
                              />
                              <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>
                                {meta.label}
                              </span>
                              <span>{s.summary}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="prose" dangerouslySetInnerHTML={{ __html: b.html }} />
                  </>
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
                Gathering evidence — searching the knowledge base, catalog, and competitive
                sources as needed…
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
          {suggestionsFor(persona).map((s) => (
            <button key={s} type="button" className="sugg-chip" onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <h3 className="section-label">Quick generation</h3>
      <div className="grid grid-3">
        {GEN_CARDS[persona].map((q) => (
          <div key={q.title} className="quick-card" onClick={() => openGenerator(q)}>
            <div className="qicon">
              <i className={`fa-solid ${q.icon}`} />
            </div>
            <h3>{q.title}</h3>
            <p>{q.desc}</p>
            <span className="go">
              Generate <i className="fa-solid fa-arrow-right" style={{ fontSize: 10 }} />
            </span>
          </div>
        ))}
      </div>

      {/* ---------- generator modal ---------- */}
      {genCard && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && genPhase !== "loading") closeGenerator();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4, 32, 39, 0.55)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "var(--r-lg)",
              boxShadow: "0 24px 60px rgba(0,0,0,.35)",
              width: genPhase === "result" ? "min(94vw, 760px)" : "min(92vw, 520px)",
              maxHeight: "88vh",
              overflowY: "auto",
              padding: "26px 26px 22px",
            }}
          >
            {/* head */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "var(--r-sm)",
                  background: "#E1F0F2",
                  color: "var(--teal-dark)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i className={`fa-solid ${genCard.icon}`} />
              </div>
              <h3 style={{ fontSize: 16, margin: 0, flex: 1 }}>{genCard.title}</h3>
              {genResult && genPhase === "result" && (
                <span className="pill pill-draft">{genResult.tag}</span>
              )}
              <button
                type="button"
                onClick={closeGenerator}
                disabled={genPhase === "loading"}
                style={{
                  border: "none",
                  background: "var(--bg-page)",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {genPhase === "select" && (
              <>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "4px 0 20px", lineHeight: 1.5 }}>
                  {needsIndustry
                    ? "Tell us who this is for, and we'll generate it against the right product and industry context."
                    : "Pick a product and we'll generate it against the right context."}
                </p>
                {genError && (
                  <div style={{ background: "#FCE8E8", color: "#A32D2D", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
                    {genError}
                  </div>
                )}
                {pillRow("Product", GEN_PRODUCTS, genProduct, pickGenProduct)}
                {needsIndustry &&
                  (GEN_INDUSTRIES_BY_PRODUCT[genProduct]?.length ?? 0) > 1 &&
                  industryDropdown()}
                {needsCompetitor && competitorDropdown()}
                {needsContentType &&
                  pillRow("Content type", GEN_CONTENT_TYPES, genType, setGenType)}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => void runGeneration()}
                    disabled={!genReady}
                    style={!genReady ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                    title={genReady ? "Generate" : "Pick the options above first"}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles" /> Generate
                  </button>
                </div>
              </>
            )}

            {genPhase === "loading" && (
              <div style={{ textAlign: "center", padding: "36px 10px 30px" }}>
                <i
                  className="fa-solid fa-spinner fa-spin"
                  style={{ fontSize: 26, color: "var(--teal-dark)", marginBottom: 16, display: "block" }}
                />
                <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>{loadMsg}</div>
              </div>
            )}

            {genPhase === "result" && genResult && (
              <>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--teal-dark)",
                    fontWeight: 500,
                    background: "#E1F0F2",
                    borderRadius: "var(--r-sm)",
                    padding: "8px 12px",
                    margin: "10px 0 14px",
                  }}
                >
                  <i className="fa-solid fa-crosshairs" style={{ marginRight: 6 }} />
                  Generated for <b>{genProduct}</b>
                  {needsIndustry && (
                    <>
                      {" "}
                      · <b>{genIndustry}</b>
                    </>
                  )}
                  {genType !== "" && (
                    <>
                      {" "}
                      · <b>{genType}</b>
                    </>
                  )}
                  {needsCompetitor && genCompetitor !== "" && (
                    <>
                      {" "}
                      vs. <b>{genCompetitor}</b>
                    </>
                  )}
                </div>
                <div
                  ref={resultRef}
                  className="prose"
                  style={{ border: "none", boxShadow: "none", padding: 0 }}
                  dangerouslySetInnerHTML={{ __html: genResult.html }}
                />
                {genResult.evidence.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
                    Grounded in: {genResult.evidence.map((e) => e.title).join(", ")}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                  <button className="btn" onClick={() => setGenPhase("select")}>
                    <i className="fa-solid fa-arrow-left" /> Go to the previous menu
                  </button>
                  <button className="btn btn-primary" onClick={() => void copyResult()}>
                    <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`} />{" "}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
