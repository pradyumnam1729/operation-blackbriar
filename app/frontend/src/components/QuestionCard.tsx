import { useState } from "react";
import {
  Candidate,
  decideAnswer,
  FqAnswer,
  FqAnswerStatus,
  FqDecisionBody,
  FqQuestion,
} from "../lib/api";

// Reconciliation card for one Foundation Questionnaire question: transcript vs
// document evidence side by side, the AI merge proposal, and the PMM decision
// CTAs. Every decision round-trips through decideAnswer and updates in place.

interface Props {
  question: FqQuestion;
  onUpdated: (questionId: string, answer: FqAnswer) => void;
}

const STATUS_PILL: Record<FqAnswerStatus, { cls: string; label: string }> = {
  unanswered: { cls: "pill-archived", label: "Unanswered" },
  pending_review: { cls: "pill-pending", label: "Pending review" },
  accepted: { cls: "pill-final", label: "Accepted" },
  rejected: { cls: "pill-lost", label: "Rejected" },
  gap: { cls: "pill-draft", label: "Gap — to confirm" },
};

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls = value >= 0.75 ? "pill-final" : value >= 0.5 ? "pill-pending" : "pill-lost";
  return <span className={`pill ${cls}`}>{pct}% confidence</span>;
}

function SourceChips({ sources }: { sources: Candidate["sources"] }) {
  if (sources.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      {sources.map((s, i) => (
        <span key={`${s.doc_id}-${i}`} className="filechip" title={s.evidence}>
          <i className="fa-regular fa-file-lines" /> {s.title}
        </span>
      ))}
    </div>
  );
}

function CandidateColumn({
  label,
  icon,
  candidate,
  emptyText,
}: {
  label: string;
  icon: string;
  candidate: Candidate | null;
  emptyText: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-page)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          <i className={`fa-regular ${icon}`} style={{ marginRight: 6 }} />
          {label}
        </span>
        {candidate && <ConfidenceBadge value={candidate.confidence} />}
      </div>
      {candidate ? (
        <>
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>{candidate.content}</div>
          <SourceChips sources={candidate.sources} />
        </>
      ) : (
        <div className="empty-note" style={{ padding: "4px 0" }}>
          {emptyText}
        </div>
      )}
    </div>
  );
}

type CardMode = "" | "edit" | "regenerate" | "reject";

export function QuestionCard({ question, onUpdated }: Props) {
  const answer = question.answer;
  const [mode, setMode] = useState<CardMode>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const status: FqAnswerStatus = answer?.status ?? "unanswered";
  const pill = STATUS_PILL[status];
  const merged = answer?.merged_candidate ?? null;

  const decide = async (body: FqDecisionBody) => {
    if (!answer) return;
    setBusy(true);
    setErr("");
    try {
      const updated = await decideAnswer(answer.id, body);
      onUpdated(question.id, updated);
      setMode("");
      setText("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openMode = (m: CardMode) => {
    setErr("");
    if (mode === m) {
      setMode("");
      return;
    }
    setMode(m);
    if (m === "edit") setText(answer?.final_answer ?? merged?.content ?? "");
    else setText(answer?.feedback ?? "");
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.45 }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 400, marginRight: 8 }}>
              {question.id}
            </span>
            {question.prompt}
          </div>
          {question.guidance && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {question.guidance}
            </div>
          )}
        </div>
        <span className={`pill ${pill.cls}`} style={{ flexShrink: 0 }}>
          {pill.label}
        </span>
      </div>

      {!answer || status === "unanswered" ? (
        <div className="empty-note">
          {answer && (answer.transcript_candidate || answer.document_candidate)
            ? "Evidence extracted — build the review queue to reconcile it into a proposal."
            : "No evidence extracted yet — run the extraction passes, then build the review queue."}
        </div>
      ) : (
        <>
          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <CandidateColumn
              label="Transcript evidence"
              icon="fa-comments"
              candidate={answer.transcript_candidate}
              emptyText="No transcript evidence"
            />
            <CandidateColumn
              label="Document evidence"
              icon="fa-file-lines"
              candidate={answer.document_candidate}
              emptyText="No document evidence"
            />
          </div>

          {status === "gap" ? (
            <div className="empty-note">
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6, color: "#8a5a0b" }} />
              Neither pass found evidence — flagged &ldquo;⚠ To confirm&rdquo; and listed in Part F5 of the
              generated document.
            </div>
          ) : status === "accepted" && answer.final_answer !== null ? (
            <div
              style={{
                marginTop: 12,
                background: "#e4f4ee",
                borderLeft: "3px solid #0e6b4e",
                borderRadius: "0 var(--r-sm) var(--r-sm) 0",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "#0e6b4e",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  marginBottom: 6,
                }}
              >
                <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
                Final answer
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55 }}>{answer.final_answer}</div>
              <SourceChips sources={answer.final_sources} />
            </div>
          ) : merged ? (
            <div
              style={{
                marginTop: 12,
                background: "#f2fafb",
                borderLeft: "3px solid var(--teal-light)",
                borderRadius: "0 var(--r-sm) var(--r-sm) 0",
                padding: "12px 14px",
                opacity: status === "rejected" ? 0.65 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "var(--teal-dark)",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  <i className="fa-solid fa-code-merge" style={{ marginRight: 6 }} />
                  Merged proposal
                </span>
                <ConfidenceBadge value={merged.confidence} />
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55 }}>{merged.content}</div>
              <SourceChips sources={merged.sources} />
            </div>
          ) : null}

          {status === "rejected" && answer.feedback && (
            <div style={{ fontSize: 12.5, color: "#a32d2d", marginTop: 10 }}>
              <i className="fa-solid fa-circle-xmark" style={{ marginRight: 6 }} />
              Rejected with feedback: {answer.feedback}
            </div>
          )}

          {merged && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => void decide({ action: "accept" })}
              >
                <i className="fa-solid fa-check" /> Accept
              </button>
              <button className="btn btn-sm" disabled={busy} onClick={() => openMode("edit")}>
                <i className="fa-solid fa-pen" /> Edit
              </button>
              <button
                className="btn btn-sm"
                disabled={busy || answer.transcript_candidate === null}
                onClick={() => void decide({ action: "pick", source: "transcript" })}
              >
                <i className="fa-regular fa-comments" /> Use transcript
              </button>
              <button
                className="btn btn-sm"
                disabled={busy || answer.document_candidate === null}
                onClick={() => void decide({ action: "pick", source: "document" })}
              >
                <i className="fa-regular fa-file-lines" /> Use document
              </button>
              <button className="btn btn-sm" disabled={busy} onClick={() => openMode("regenerate")}>
                <i className="fa-solid fa-rotate" /> Regenerate
              </button>
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => openMode("reject")}>
                <i className="fa-solid fa-ban" /> Reject
              </button>
            </div>
          )}

          {mode === "edit" && (
            <div style={{ marginTop: 12 }}>
              <label htmlFor={`edit-${question.id}`}>Edited answer</label>
              <textarea
                id={`edit-${question.id}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-sm" disabled={busy} onClick={() => setMode("")}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy || text.trim() === ""}
                  onClick={() => void decide({ action: "edit", content: text.trim() })}
                >
                  <i className="fa-solid fa-check" /> Save
                </button>
              </div>
            </div>
          )}

          {mode === "regenerate" && (
            <div style={{ marginTop: 12 }}>
              <label htmlFor={`regen-${question.id}`}>
                What should the new proposal do differently? (required)
              </label>
              <textarea
                id={`regen-${question.id}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Keep the customer quote, drop the unsourced figure."
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-sm" disabled={busy} onClick={() => setMode("")}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy || text.trim() === ""}
                  onClick={() => void decide({ action: "regenerate", feedback: text.trim() })}
                >
                  <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-rotate"}`} />
                  {busy ? "Regenerating…" : "Regenerate proposal"}
                </button>
              </div>
            </div>
          )}

          {mode === "reject" && (
            <div style={{ marginTop: 12 }}>
              <label htmlFor={`reject-${question.id}`}>Why is this rejected? (optional)</label>
              <textarea
                id={`reject-${question.id}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-sm" disabled={busy} onClick={() => setMode("")}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() =>
                    void decide({
                      action: "reject",
                      ...(text.trim() === "" ? {} : { feedback: text.trim() }),
                    })
                  }
                >
                  <i className="fa-solid fa-ban" /> Reject question
                </button>
              </div>
            </div>
          )}

          {err && (
            <div style={{ fontSize: 12.5, color: "#a32d2d", marginTop: 10 }}>{err}</div>
          )}
        </>
      )}
    </div>
  );
}
