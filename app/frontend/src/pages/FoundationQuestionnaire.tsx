import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApproveDocResponse,
  approveMessagingDoc,
  FqAnswer,
  FqRun,
  FqRunPass,
  getMessagingDoc,
  getProducts,
  getQuestionnaire,
  getRuns,
  listMessagingDocs,
  MessagingDoc,
  MessagingDocSummary,
  Product,
  QuestionnairePayload,
  startExtraction,
  startGeneration,
  startMerge,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { QuestionCard } from "../components/QuestionCard";

// Foundation Questionnaire pipeline: extract evidence from ingested sources,
// reconcile per question, generate the Positioning & Messaging document, and
// promote it draft → final (PMM admin approval gate, §8.4).

const STEPS = ["Extract", "Review", "Generate", "Approve"];

const RUN_PILL: Record<FqRun["status"], string> = {
  running: "pill-pending",
  done: "pill-final",
  failed: "pill-lost",
};

const DOC_PILL: Record<MessagingDocSummary["status"], string> = {
  draft: "pill-draft",
  final: "pill-final",
  archived: "pill-archived",
};

// GapsPanel: which doc types would likely fill a gap, by part (§3.1 — propose
// how to populate, never guess).
const GAP_SUGGESTIONS: Record<string, string> = {
  A: "Add positioning inputs — PRDs, strategy docs, or call transcripts — via the Uploads console.",
  B: "Add product documents — PRDs, specs, or release notes — via the Uploads console.",
  C: "Add customer call transcripts (.vtt/.srt) — persona pains come from raw customer language.",
  D: "Add battlecards or competitive notes via the Uploads console.",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function FoundationQuestionnaire({ embedded = false }: { embedded?: boolean }) {
  const { me } = useAuth();
  const admin = me?.role === "admin";

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [data, setData] = useState<QuestionnairePayload | null>(null);
  const [docs, setDocs] = useState<MessagingDocSummary[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [doc, setDoc] = useState<MessagingDoc | null>(null);
  const [approval, setApproval] = useState<ApproveDocResponse | null>(null);

  const [error, setError] = useState("");
  const [sourceGap, setSourceGap] = useState(""); // 422 "no docs ingested" guidance
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // ---- loading ----

  useEffect(() => {
    if (!admin) return;
    getProducts()
      .then((list) => {
        setProducts(list);
        const preferred = list.find((p) => p.name === "Masterworks AI") ?? list[0];
        if (preferred) setProductId(preferred.id);
      })
      .catch((e) => setError((e as Error).message));
  }, [admin]);

  const refresh = useCallback(async () => {
    if (productId === "") return;
    try {
      const [payload, docList] = await Promise.all([
        getQuestionnaire(productId),
        listMessagingDocs(productId).catch(() => [] as MessagingDocSummary[]),
      ]);
      setData(payload);
      setDocs([...docList].sort((a, b) => b.version - a.version));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId === "") return;
    setLoading(true);
    setData(null);
    setDocs([]);
    setSelectedDocId("");
    setDoc(null);
    setApproval(null);
    setSourceGap("");
    void refresh();
  }, [productId, refresh]);

  // ---- run polling (2s while any run is running; stop when none) ----

  const anyRunning = useMemo(
    () => data?.runs.some((r) => r.status === "running") ?? false,
    [data]
  );

  useEffect(() => {
    if (!anyRunning || productId === "") return;
    const t = window.setInterval(async () => {
      try {
        const runs = await getRuns(productId);
        if (runs.some((r) => r.status === "running")) {
          setData((d) => (d ? { ...d, runs } : d));
        } else {
          await refresh(); // final state: pull answers/progress/docs once, effect re-runs and stops
        }
      } catch {
        // transient poll failure — keep polling
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [anyRunning, productId, refresh]);

  // ---- doc selection ----

  useEffect(() => {
    if (docs.length === 0) {
      setSelectedDocId("");
      setDoc(null);
      return;
    }
    if (!docs.some((d) => d.id === selectedDocId)) setSelectedDocId(docs[0].id);
  }, [docs, selectedDocId]);

  useEffect(() => {
    if (selectedDocId === "") return;
    getMessagingDoc(selectedDocId)
      .then(setDoc)
      .catch((e) => setError((e as Error).message));
  }, [selectedDocId]);

  // ---- derived state ----

  const latestRun = useCallback(
    (pass: FqRunPass): FqRun | null => {
      const runs = data?.runs ?? [];
      const forPass = runs
        .filter((r) => r.pass === pass)
        .sort((a, b) => b.started_at.localeCompare(a.started_at));
      return forPass[0] ?? null;
    },
    [data]
  );

  const progress = data?.progress ?? null;
  const pendingCount = progress ? progress.unanswered + progress.pending_review : 0;
  const reviewed = progress ? progress.accepted + progress.rejected + progress.gaps : 0;
  const signedOff = progress !== null && progress.total > 0 && pendingCount === 0;
  const hasAnyAnswer =
    data?.sections.some((s) => s.questions.some((q) => q.answer !== null)) ?? false;
  const anyPassDone =
    latestRun("transcripts")?.status === "done" || latestRun("documents")?.status === "done";
  const generateRun = latestRun("generate");
  const generating = generateRun?.status === "running";

  const activeStep = useMemo(() => {
    if (docs.length > 0) return 4;
    if (generating || signedOff) return 3;
    if (hasAnyAnswer) return 2;
    return 1;
  }, [docs, generating, signedOff, hasAnyAnswer]);

  // ---- actions ----

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("ingested for this product yet")) setSourceGap(msg);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onExtract = (pass: "transcripts" | "documents") =>
    void runAction(async () => {
      setSourceGap("");
      await startExtraction(productId, pass);
    });

  const onMerge = () => void runAction(() => startMerge(productId));
  const onGenerate = () => void runAction(() => startGeneration(productId));

  const onApprove = () => {
    if (doc === null) return;
    void runAction(async () => {
      const r = await approveMessagingDoc(doc.id);
      setApproval(r);
      setDoc(r.doc);
    });
  };

  const onAnswerUpdated = (questionId: string, answer: FqAnswer) => {
    setData((d) => {
      if (!d) return d;
      const sections = d.sections.map((s) => ({
        ...s,
        questions: s.questions.map((q) => (q.id === questionId ? { ...q, answer } : q)),
      }));
      const all = sections.flatMap((s) => s.questions);
      const count = (st: string) => all.filter((q) => q.answer?.status === st).length;
      return {
        ...d,
        sections,
        progress: {
          total: all.length,
          unanswered: all.filter((q) => q.answer === null || q.answer.status === "unanswered")
            .length,
          pending_review: count("pending_review"),
          accepted: count("accepted"),
          rejected: count("rejected"),
          gaps: count("gap"),
        },
      };
    });
  };

  // ---- non-admin guard (nav hides the entry; backend 403s regardless) ----

  if (!admin) {
    return (
      <div>
        {!embedded && <h1 className="pagetitle">Positioning &amp; messaging</h1>}
        <div className="card">
          <div className="empty-note">
            The Foundation Questionnaire is the PMM admin&rsquo;s workspace. Approved messaging
            documents are available to every role once published.
          </div>
        </div>
      </div>
    );
  }

  const extractQuestionsFlat =
    data?.sections.flatMap((s) => s.questions.map((q) => ({ section: s, question: q }))) ?? [];
  const gapItems = extractQuestionsFlat.filter((x) => x.question.answer?.status === "gap");

  const renderPassCard = (
    pass: "transcripts" | "documents",
    title: string,
    icon: string,
    desc: string
  ) => {
    const run = latestRun(pass);
    return (
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>
            <i className={`fa-regular ${icon}`} style={{ color: "var(--teal-dark)", marginRight: 8 }} />
            {title}
          </h2>
          {run && <span className={`pill ${RUN_PILL[run.status]}`}>{run.status}</span>}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "8px 0 12px" }}>
          {desc}
        </p>
        {run ? (
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
            Last run {fmtWhen(run.started_at)} — {run.docs_used} source doc
            {run.docs_used === 1 ? "" : "s"}, {run.questions_answered} question
            {run.questions_answered === 1 ? "" : "s"} answered.
            {run.status === "failed" && run.detail !== null && (
              <div style={{ color: "#a32d2d", marginTop: 6 }}>
                <i className="fa-solid fa-circle-xmark" style={{ marginRight: 6 }} />
                {run.detail}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-note" style={{ paddingTop: 0 }}>
            Not run yet.
          </div>
        )}
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || anyRunning}
          onClick={() => onExtract(pass)}
        >
          <i
            className={`fa-solid ${
              run?.status === "running" ? "fa-spinner fa-spin" : "fa-play"
            }`}
          />
          {run?.status === "running"
            ? "Running…"
            : run?.status === "failed"
            ? "Retry pass"
            : run !== null
            ? "Re-run pass"
            : "Run pass"}
        </button>
      </div>
    );
  };

  const mergeRun = latestRun("merge");

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        {!embedded && (
          <h1 className="pagetitle" style={{ margin: 0 }}>
            Positioning &amp; messaging
          </h1>
        )}
        <select
          aria-label="Product"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{ minWidth: 220, ...(embedded ? { marginLeft: "auto" } : {}) }}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <p className="pagesub">
        Extract evidence from ingested sources, review every answer, then generate the Positioning
        &amp; Messaging document — the unified system every downstream asset draws from.
      </p>

      <div className="step-pills">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={activeStep === i + 1 ? "step-pill active" : "step-pill"}
            aria-current={activeStep === i + 1 ? "step" : undefined}
          >
            {i + 1} · {label}
          </span>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "#FCE8E8",
            borderRadius: "var(--r-md)",
            color: "#A32D2D",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {sourceGap !== "" && (
        <div className="card" style={{ borderColor: "#f3c9c9" }}>
          <h2 style={{ marginTop: 0 }}>
            <i
              className="fa-solid fa-triangle-exclamation"
              style={{ color: "#8a5a0b", marginRight: 8 }}
            />
            No sources to extract from
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{sourceGap}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn btn-sm" to="/requests">
              <i className="fa-solid fa-upload" /> Requests &amp; intake
            </Link>
            <Link className="btn btn-sm" to="/uploads">
              <i className="fa-solid fa-shield-halved" /> Uploads console
            </Link>
            <Link className="btn btn-sm" to="/integrations">
              <i className="fa-solid fa-circle-nodes" /> Integrations (local Input folder)
            </Link>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-note">Loading questionnaire…</div>
      ) : data === null ? null : (
        <>
          {/* ---- 1 · Extract ---- */}
          <div className="section-label">1 · Extraction passes</div>
          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            {renderPassCard(
              "transcripts",
              "Transcripts pass",
              "fa-comments",
              "Customer call transcripts — raw customer language, pains, and objections."
            )}
            {renderPassCard(
              "documents",
              "Documents pass",
              "fa-file-lines",
              "PRDs, JTBDs, battlecards, and release notes — product facts and capabilities."
            )}
          </div>

          <div className="card">
            <div className="row-between">
              <div>
                <h2 style={{ margin: 0 }}>Build review queue</h2>
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "6px 0 0" }}>
                  Reconciles both passes into one merge proposal per question. Questions without
                  evidence become gaps. Every answer — including single-source ones — requires your
                  sign-off.
                </p>
                {mergeRun?.status === "failed" && mergeRun.detail !== null && (
                  <div style={{ fontSize: 12.5, color: "#a32d2d", marginTop: 8 }}>
                    <i className="fa-solid fa-circle-xmark" style={{ marginRight: 6 }} />
                    {mergeRun.detail}
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary"
                disabled={busy || anyRunning || !anyPassDone}
                title={anyPassDone ? undefined : "Complete at least one extraction pass first"}
                onClick={onMerge}
              >
                <i
                  className={`fa-solid ${
                    mergeRun?.status === "running" ? "fa-spinner fa-spin" : "fa-code-merge"
                  }`}
                />
                {mergeRun?.status === "running"
                  ? "Building…"
                  : mergeRun?.status === "failed"
                  ? "Retry review queue"
                  : "Build review queue"}
              </button>
            </div>
          </div>

          {/* ---- 2 · Review ---- */}
          <div className="section-label">2 · Review queue</div>
          {!hasAnyAnswer ? (
            <div className="card">
              <div className="empty-note">
                No answers yet. Run the extraction passes above, then build the review queue to
                start reconciling evidence.
              </div>
            </div>
          ) : (
            <>
              {progress && (
                <div className="card">
                  <div className="bar-row" style={{ marginBottom: 0 }}>
                    <span className="lab">Reviewed</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${progress.total === 0 ? 0 : Math.round((reviewed / progress.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="bar-val">
                      {reviewed}/{progress.total}
                    </span>
                  </div>
                  {signedOff && (
                    <div style={{ fontSize: 13, color: "#0e6b4e", fontWeight: 500, marginTop: 10 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
                      All questions signed off — the questionnaire is ready for generation.
                    </div>
                  )}
                </div>
              )}
              {data.sections
                .filter((s) => s.questions.length > 0)
                .map((s) => (
                  <div key={s.id}>
                    <div className="section-label">
                      {s.id} · {s.title}
                    </div>
                    {s.questions.map((q) => (
                      <QuestionCard key={q.id} question={q} onUpdated={onAnswerUpdated} />
                    ))}
                  </div>
                ))}
            </>
          )}

          {/* ---- Gaps ---- */}
          {gapItems.length > 0 && (
            <>
              <div className="section-label">Gaps — will appear in Part F5</div>
              <div className="card">
                {gapItems.map(({ section, question }) => (
                  <div
                    key={question.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      <i
                        className="fa-solid fa-triangle-exclamation"
                        style={{ color: "#8a5a0b", marginRight: 8 }}
                      />
                      {question.id} — {question.prompt}
                    </div>
                    <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                      ⚠ To confirm — listed in F5.{" "}
                      {GAP_SUGGESTIONS[section.part] ?? GAP_SUGGESTIONS.B}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ---- 3 · Generate ---- */}
          <div className="section-label">3 · Generate document</div>
          <div className="card">
            {progress && (
              <div className="grid grid-4" style={{ marginBottom: 16 }}>
                <div className="metric">
                  <div className="label">Accepted</div>
                  <div className="val">{progress.accepted}</div>
                </div>
                <div className="metric">
                  <div className="label">Rejected</div>
                  <div className="val">{progress.rejected}</div>
                </div>
                <div className="metric">
                  <div className="label">Gaps</div>
                  <div className="val">{progress.gaps}</div>
                </div>
                <div className="metric">
                  <div className="label">Still pending</div>
                  <div className="val">{pendingCount}</div>
                </div>
              </div>
            )}
            {generating ? (
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />
                Generating the Positioning &amp; Messaging document part by part — this takes a few
                minutes. The draft appears below when it lands.
              </div>
            ) : (
              <>
                {generateRun?.status === "failed" && generateRun.detail !== null && (
                  <div style={{ fontSize: 12.5, color: "#a32d2d", marginBottom: 10 }}>
                    <i className="fa-solid fa-circle-xmark" style={{ marginRight: 6 }} />
                    {generateRun.detail}
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  disabled={busy || anyRunning || !signedOff}
                  onClick={onGenerate}
                >
                  <i className="fa-solid fa-wand-magic-sparkles" />
                  {generateRun?.status === "failed" ? "Retry generation" : "Generate document"}
                </button>
                {!signedOff && (
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 10 }}>
                    <i className="fa-solid fa-lock" style={{ marginRight: 6 }} />
                    {pendingCount} question{pendingCount === 1 ? "" : "s"} still unanswered or
                    pending review — sign off every question before generating.
                  </div>
                )}
              </>
            )}
          </div>

          {/* ---- 4 · Approve ---- */}
          <div className="section-label">4 · Document versions</div>
          {docs.length === 0 ? (
            <div className="card">
              <div className="empty-note">
                No document generated yet. Complete the review and generate the first draft.
              </div>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {docs.map((d) => (
                  <button
                    key={d.id}
                    className={selectedDocId === d.id ? "btn btn-primary btn-sm" : "btn btn-sm"}
                    onClick={() => {
                      setApproval(null);
                      setSelectedDocId(d.id);
                    }}
                  >
                    v{d.version}
                    <span className={`pill ${DOC_PILL[d.status]}`}>{d.status}</span>
                  </button>
                ))}
              </div>

              {doc === null ? (
                <div className="empty-note">Loading document…</div>
              ) : (
                <>
                  <div className="row-between" style={{ marginBottom: 12 }}>
                    <div>
                      <h2 style={{ margin: 0 }}>{doc.title}</h2>
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>
                        v{doc.version} · created {fmtWhen(doc.created_at)}
                        {doc.approved_at !== null && <> · approved {fmtWhen(doc.approved_at)}</>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {doc.gaps.length > 0 && (
                        <span className="pill pill-pending">
                          <i className="fa-solid fa-triangle-exclamation" />
                          {doc.gaps.length} open input{doc.gaps.length === 1 ? "" : "s"} to confirm
                        </span>
                      )}
                      <span className={`pill ${DOC_PILL[doc.status]}`}>{doc.status}</span>
                      {doc.status === "draft" && (
                        <button className="btn btn-primary" disabled={busy} onClick={onApprove}>
                          <i className="fa-solid fa-circle-check" />
                          {busy ? "Publishing…" : "Approve & publish"}
                        </button>
                      )}
                    </div>
                  </div>

                  {doc.guard_violations.length > 0 && (
                    <div
                      role="alert"
                      style={{
                        marginBottom: 12,
                        padding: "12px 16px",
                        background: "#FCE8E8",
                        borderRadius: "var(--r-md)",
                        color: "#A32D2D",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      <i className="fa-solid fa-circle-xmark" style={{ marginRight: 8 }} />
                      Voice guardrails flagged: {doc.guard_violations.join(", ")} — regenerate after
                      correcting the underlying answers; approval is blocked until the document is
                      clean.
                    </div>
                  )}

                  {approval !== null && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: "12px 16px",
                        background: "#E1F0F2",
                        borderRadius: "var(--r-md)",
                        color: "var(--teal-dark)",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: 8 }} />
                        Published to the war room: {approval.warRoomPath}
                      </div>
                      {approval.exportedPath !== null ? (
                        <div style={{ marginTop: 4 }}>
                          Exported HTML: {approval.exportedPath}
                        </div>
                      ) : (
                        <div style={{ marginTop: 4, color: "#8a5a0b" }}>
                          <i
                            className="fa-solid fa-triangle-exclamation"
                            style={{ marginRight: 6 }}
                          />
                          {approval.warning ??
                            "Local Output folder is not configured — the HTML export was skipped."}{" "}
                          <Link to="/integrations">Configure it in Integrations.</Link>
                        </div>
                      )}
                    </div>
                  )}

                  {doc.status === "final" && approval === null && (
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
                      {doc.war_room_path !== null && <>War room: {doc.war_room_path}. </>}
                      {doc.exported_path !== null && <>Exported HTML: {doc.exported_path}.</>}
                    </div>
                  )}

                  <div className="prose" dangerouslySetInnerHTML={{ __html: doc.content_html }} />
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
