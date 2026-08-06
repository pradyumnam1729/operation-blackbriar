import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import {
  AnswerRow,
  AnswerStatus,
  Candidate,
  QuestionRow,
  RunPass,
  gatherSources,
  isSignedOff,
  regenerateMerge,
  runExtractionPass,
  runMergePass,
  startRun,
} from "../services/questionnaire";
import { runGeneration } from "../services/messagingDoc";

// Foundation Questionnaire pipeline: extraction passes → review queue →
// sign-off gate → doc generation. Admin (PMM) only — the questionnaire is
// §8.4 PMM work; consumers read the finished messaging docs instead.
export const questionnaireRouter = Router();

questionnaireRouter.use(requireAuth, requireAdmin);

// Generous: generation is 6 sequential Opus calls with adaptive thinking and can
// legitimately run 30+ minutes. This sweep only exists to clear runs orphaned by
// a server restart — a live run that crosses it is protected by finishRun's
// running-only transition, but it must stay rare.
const STALE_RUN_MS = 60 * 60 * 1000;

interface RunRow {
  id: string;
  pass: RunPass;
  status: "running" | "done" | "failed";
  detail: string | null;
  docs_used: number;
  questions_answered: number;
  started_at: string;
  finished_at: string | null;
}

interface SectionRow {
  id: string;
  part: string;
  title: string;
  mode: string;
  ord: number;
}

/** 409 guard: one active run per product. Returns the running row, if any. */
async function findRunningRun(productId: string): Promise<RunRow | null> {
  const sb = supabase()!;
  const { data } = await sb
    .from("fq_runs")
    .select("id, pass, status, detail, docs_used, questions_answered, started_at, finished_at")
    .eq("product_id", productId)
    .eq("status", "running")
    .limit(1);
  return ((data ?? []) as RunRow[])[0] ?? null;
}

// ---------- 1. full questionnaire state ----------
// GET /api/questionnaire/:productId
questionnaireRouter.get("/:productId", async (req, res) => {
  const sb = supabase()!;
  const productId = req.params.productId;

  const { data: product } = await sb.from("products").select("id").eq("id", productId).maybeSingle();
  if (!product) return res.status(404).json({ error: "Product not found" });

  const [{ data: sectionData }, { data: questionData }, { data: answerData }, { data: runData }] =
    await Promise.all([
      sb.from("fq_sections").select("id, part, title, mode, ord").order("ord"),
      sb.from("fq_questions").select("id, section_id, ord, prompt, guidance").order("ord"),
      sb.from("fq_answers").select("*").eq("product_id", productId),
      sb
        .from("fq_runs")
        .select("id, pass, status, detail, docs_used, questions_answered, started_at, finished_at")
        .eq("product_id", productId)
        .order("started_at", { ascending: false }),
    ]);

  const sections = (sectionData ?? []) as SectionRow[];
  const questions = (questionData ?? []) as QuestionRow[];
  const answers = (answerData ?? []) as AnswerRow[];
  const answerByQuestion = new Map(answers.map((a) => [a.question_id, a]));

  const payload = sections.map((s) => ({
    ...s,
    questions:
      s.mode === "extract" || s.mode === "hybrid"
        ? questions
            .filter((q) => q.section_id === s.id)
            .map((q) => {
              const a = answerByQuestion.get(q.id);
              return {
                id: q.id,
                ord: q.ord,
                prompt: q.prompt,
                guidance: q.guidance,
                answer: a
                  ? {
                      id: a.id,
                      status: a.status,
                      transcript_candidate: a.transcript_candidate,
                      document_candidate: a.document_candidate,
                      merged_candidate: a.merged_candidate,
                      final_answer: a.final_answer,
                      final_sources: a.final_sources,
                      feedback: a.feedback,
                      decided_at: a.decided_at,
                    }
                  : null,
              };
            })
        : [],
  }));

  const count = (status: AnswerStatus) => answers.filter((a) => a.status === status).length;
  const progress = {
    total: questions.length,
    unanswered: questions.length - answers.filter((a) => a.status !== "unanswered").length,
    pending_review: count("pending_review"),
    accepted: count("accepted"),
    rejected: count("rejected"),
    gaps: count("gap"),
  };

  // Latest run per pass (rows are already newest-first).
  const latestByPass = new Map<RunPass, RunRow>();
  for (const run of (runData ?? []) as RunRow[]) {
    if (!latestByPass.has(run.pass)) latestByPass.set(run.pass, run);
  }

  res.json({ sections: payload, progress, runs: [...latestByPass.values()] });
});

// ---------- 2. start an extraction pass ----------
// POST /api/questionnaire/:productId/extract { pass }
questionnaireRouter.post("/:productId/extract", async (req, res) => {
  const sb = supabase()!;
  const productId = req.params.productId;
  const pass = (req.body as { pass?: string }).pass;
  if (pass !== "transcripts" && pass !== "documents") {
    return res.status(400).json({ error: 'pass must be "transcripts" or "documents"' });
  }

  const { data: product } = await sb.from("products").select("id").eq("id", productId).maybeSingle();
  if (!product) return res.status(404).json({ error: "Product not found" });

  const running = await findRunningRun(productId);
  if (running) {
    return res
      .status(409)
      .json({ error: `A ${running.pass} run is already in progress for this product.` });
  }

  // §3.1 fail-fast: never extract from nothing; say how to populate instead.
  const sources = await gatherSources(productId, pass);
  if (sources.length === 0) {
    return res.status(422).json({
      error: `No ${pass} ingested for this product yet. Add sources via Requests & intake, the Uploads console, or the local Input folder.`,
    });
  }

  const runId = await startRun(productId, pass);
  void runExtractionPass(productId, pass, runId);
  void logActivity("fq_run", runId, req.user!.id, "extraction_started", {
    pass,
    product_id: productId,
    docs: sources.length,
  });
  res.status(202).json({ run: { id: runId, pass, status: "running", docs_used: sources.length } });
});

// ---------- 3. build the review queue (merge pass) ----------
// POST /api/questionnaire/:productId/merge
questionnaireRouter.post("/:productId/merge", async (req, res) => {
  const sb = supabase()!;
  const productId = req.params.productId;

  const { data: product } = await sb.from("products").select("id").eq("id", productId).maybeSingle();
  if (!product) return res.status(404).json({ error: "Product not found" });

  const running = await findRunningRun(productId);
  if (running) {
    return res
      .status(409)
      .json({ error: `A ${running.pass} run is already in progress for this product.` });
  }

  const { data: done } = await sb
    .from("fq_runs")
    .select("id")
    .eq("product_id", productId)
    .in("pass", ["transcripts", "documents"])
    .eq("status", "done")
    .limit(1);
  if (!done || done.length === 0) {
    return res.status(409).json({
      error:
        "Neither extraction pass has completed for this product yet — run the transcripts or documents pass first.",
    });
  }

  const runId = await startRun(productId, "merge");
  void runMergePass(productId, runId);
  void logActivity("fq_run", runId, req.user!.id, "merge_started", { product_id: productId });
  res.status(202).json({ run: { id: runId, pass: "merge", status: "running" } });
});

// ---------- 4. run list (poll target) ----------
// GET /api/questionnaire/:productId/runs
questionnaireRouter.get("/:productId/runs", async (req, res) => {
  const sb = supabase()!;
  const productId = req.params.productId;

  // Stale-run sweep: a server restart mid-run leaves 'running' rows orphaned;
  // anything running for >15 minutes is flipped to failed (no job queue).
  await sb
    .from("fq_runs")
    .update({
      status: "failed",
      detail: "Run timed out — likely a server restart mid-run. Start it again.",
      finished_at: new Date().toISOString(),
    })
    .eq("product_id", productId)
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - STALE_RUN_MS).toISOString());

  const { data, error } = await sb
    .from("fq_runs")
    .select("id, pass, status, detail, docs_used, questions_answered, started_at, finished_at")
    .eq("product_id", productId)
    .order("started_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ runs: data ?? [] });
});

// ---------- 5. PMM decision on one answer ----------
// POST /api/questionnaire/answers/:answerId/decision { action, content?, source?, feedback? }
questionnaireRouter.post("/answers/:answerId/decision", async (req, res) => {
  const sb = supabase()!;
  const { action, content, source, feedback } = req.body as {
    action?: string;
    content?: string;
    source?: string;
    feedback?: string;
  };
  const ACTIONS = ["accept", "edit", "pick", "regenerate", "reject"];
  if (!action || !ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of ${ACTIONS.join(", ")}` });
  }

  const { data } = await sb
    .from("fq_answers")
    .select("*")
    .eq("id", req.params.answerId)
    .maybeSingle();
  if (!data) return res.status(404).json({ error: "Answer not found" });
  const answer = data as AnswerRow;
  if (answer.status === "unanswered") {
    return res
      .status(409)
      .json({ error: "Nothing to decide yet — build the review queue (merge pass) first." });
  }

  const now = new Date().toISOString();

  // Regenerate is synchronous and does its own persistence (merged_candidate,
  // feedback, status stays pending_review).
  if (action === "regenerate") {
    if (!feedback || feedback.trim() === "") {
      return res.status(400).json({ error: "feedback is required for regenerate" });
    }
    try {
      await regenerateMerge(answer.id, feedback.trim());
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
    const { data: updated } = await sb.from("fq_answers").select("*").eq("id", answer.id).single();
    void logActivity("fq_answer", answer.id, req.user!.id, "regenerate", {
      question_id: answer.question_id,
      feedback: feedback.trim(),
    });
    return res.json({ answer: updated });
  }

  let patch: Record<string, unknown>;
  switch (action) {
    case "accept": {
      const merged = answer.merged_candidate;
      if (!merged) {
        return res.status(400).json({ error: "No merged proposal to accept for this question" });
      }
      patch = { final_answer: merged.content, final_sources: merged.sources, status: "accepted" };
      break;
    }
    case "edit": {
      if (!content || content.trim() === "") {
        return res.status(400).json({ error: "content is required for edit" });
      }
      patch = {
        final_answer: content.trim(),
        final_sources: answer.merged_candidate?.sources ?? [],
        status: "accepted",
      };
      break;
    }
    case "pick": {
      if (source !== "transcript" && source !== "document") {
        return res.status(400).json({ error: 'source must be "transcript" or "document"' });
      }
      const candidate: Candidate | null =
        source === "transcript" ? answer.transcript_candidate : answer.document_candidate;
      if (!candidate) {
        return res.status(400).json({ error: `No ${source} candidate for this question` });
      }
      patch = { final_answer: candidate.content, final_sources: candidate.sources, status: "accepted" };
      break;
    }
    default: {
      // reject — keep earlier feedback (e.g. from a regenerate) if none is given now
      patch = { status: "rejected", feedback: feedback?.trim() || (answer.feedback ?? null) };
      break;
    }
  }

  patch.decided_by = req.user!.id;
  patch.decided_at = now;
  patch.updated_at = now;

  const { data: updated, error } = await sb
    .from("fq_answers")
    .update(patch)
    .eq("id", answer.id)
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  void logActivity("fq_answer", answer.id, req.user!.id, action, {
    question_id: answer.question_id,
    ...(source ? { source } : {}),
    ...(feedback ? { feedback } : {}),
  });
  res.json({ answer: updated });
});

// ---------- 6. generate the messaging doc (sign-off gated) ----------
// POST /api/questionnaire/:productId/generate
questionnaireRouter.post("/:productId/generate", async (req, res) => {
  const sb = supabase()!;
  const productId = req.params.productId;

  const { data: product } = await sb.from("products").select("id").eq("id", productId).maybeSingle();
  if (!product) return res.status(404).json({ error: "Product not found" });

  const running = await findRunningRun(productId);
  if (running) {
    return res
      .status(409)
      .json({ error: `A ${running.pass} run is already in progress for this product.` });
  }

  // §3.1 intelligence gate: every extract question must be decided before
  // anything downstream generates from it.
  const signOff = await isSignedOff(productId);
  if (!signOff.ok) {
    return res.status(409).json({
      error: `Questionnaire is not signed off — ${signOff.pending} question(s) still unanswered or pending review.`,
      pending: signOff.pending,
    });
  }

  const runId = await startRun(productId, "generate");
  void runGeneration(productId, req.user!.id, runId);
  void logActivity("fq_run", runId, req.user!.id, "generation_started", { product_id: productId });
  res.status(202).json({ run: { id: runId, pass: "generate", status: "running" } });
});
