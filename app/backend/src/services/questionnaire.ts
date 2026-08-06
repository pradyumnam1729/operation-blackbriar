import { supabase } from "./db";
import { ask } from "./claude";
import {
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";

// Foundation Questionnaire extraction pipeline (blueprint §3.1). Two evidence
// passes (transcripts, documents) answer the seeded question bank with cited
// candidates; a merge pass proposes one reconciled answer per question for the
// PMM review queue. Model judgment is never the only defense: citations are
// filtered deterministically against the doc ids actually shown to the model.

export interface CitedSource {
  doc_id: string;
  title: string;
  evidence: string;
}

export interface Candidate {
  content: string;
  confidence: number;
  sources: CitedSource[];
}

export interface SourceDoc {
  id: string;
  title: string;
  content: string;
}

export type RunPass = "transcripts" | "documents" | "merge" | "generate";

export type AnswerStatus = "unanswered" | "pending_review" | "accepted" | "rejected" | "gap";

export interface QuestionRow {
  id: string;
  section_id: string;
  ord: number;
  prompt: string;
  guidance: string | null;
}

export interface AnswerRow {
  id: string;
  product_id: string;
  question_id: string;
  transcript_candidate: Candidate | null;
  document_candidate: Candidate | null;
  merged_candidate: Candidate | null;
  final_answer: string | null;
  final_sources: CitedSource[];
  status: AnswerStatus;
  feedback: string | null;
  decided_by: string | null;
  decided_at: string | null;
  updated_at: string;
}

const DOC_TRUNCATE_CHARS = 30_000;
const BATCH_MAX_CHARS = 80_000;
const MERGE_CHUNK_SIZE = 12;

// ---------- run tracking ----------

/** Insert fq_runs row; 1 active run per product enforced by caller (409). */
export async function startRun(productId: string, pass: RunPass): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("Database not configured");
  const { data, error } = await sb
    .from("fq_runs")
    .insert({ product_id: productId, pass })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not start run");
  return data.id as string;
}

export async function finishRun(
  runId: string,
  status: "done" | "failed",
  detail: string,
  counts?: { docsUsed?: number; questionsAnswered?: number }
): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const patch: Record<string, unknown> = {
    status,
    detail,
    finished_at: new Date().toISOString(),
  };
  if (counts?.docsUsed !== undefined) patch.docs_used = counts.docsUsed;
  if (counts?.questionsAnswered !== undefined) patch.questions_answered = counts.questionsAnswered;
  // Only transition rows still running: if the stale sweep already flipped this
  // run to failed, a late completion must not resurrect it as done.
  const { error } = await sb.from("fq_runs").update(patch).eq("id", runId).eq("status", "running");
  if (error) console.error("fq_runs finish update failed:", error.message);
}

// ---------- sources ----------

/** Pass sources. transcripts: context_docs where doc_type='transcript' and (product_id = :p or product_id is null).
 *  documents: context_docs with doc_type in ('prd','jtbd','battlecard','other') same product filter,
 *  PLUS release_notes for the product (title = filename, content = raw_text).
 *  Reconciliation sign-off is the validation gate, so unapproved context_docs are included. */
export async function gatherSources(
  productId: string,
  pass: "transcripts" | "documents"
): Promise<SourceDoc[]> {
  const sb = supabase();
  if (!sb) return [];
  const productFilter = `product_id.eq.${productId},product_id.is.null`;

  if (pass === "transcripts") {
    const { data } = await sb
      .from("context_docs")
      .select("id, title, content")
      .eq("doc_type", "transcript")
      .or(productFilter);
    return ((data ?? []) as SourceDoc[]).filter((d) => d.content && d.content.trim() !== "");
  }

  const [{ data: docs }, { data: notes }] = await Promise.all([
    sb
      .from("context_docs")
      .select("id, title, content")
      .in("doc_type", ["prd", "jtbd", "battlecard", "other"])
      .or(productFilter),
    sb.from("release_notes").select("id, filename, raw_text").eq("product_id", productId),
  ]);

  const out = ((docs ?? []) as SourceDoc[]).filter((d) => d.content && d.content.trim() !== "");
  for (const n of (notes ?? []) as { id: string; filename: string; raw_text: string | null }[]) {
    if (n.raw_text && n.raw_text.trim() !== "") {
      out.push({ id: n.id, title: n.filename, content: n.raw_text });
    }
  }
  return out;
}

// ---------- pure helpers (unit-testable, deterministic) ----------

/** Greedy batching: individual docs truncated to 30_000 chars; docs packed into
 *  batches of <= 80_000 chars total. One model call per batch, all questions per call. */
export function batchDocs(docs: SourceDoc[], maxChars = BATCH_MAX_CHARS): SourceDoc[][] {
  const batches: SourceDoc[][] = [];
  let current: SourceDoc[] = [];
  let size = 0;
  for (const doc of docs) {
    const trimmed = { ...doc, content: doc.content.slice(0, DOC_TRUNCATE_CHARS) };
    if (current.length > 0 && size + trimmed.content.length > maxChars) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(trimmed);
    size += trimmed.content.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Strip ``` fences, slice first '{' .. last '}', JSON.parse. Throws on failure. */
export function parseModelJson<T>(raw: string): T {
  const unfenced = raw.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in model output");
  return JSON.parse(unfenced.slice(start, end + 1)) as T;
}

/** Cross-batch reducer: keep the higher-confidence candidate per question. */
export function reduceCandidates(a: Candidate | null, b: Candidate | null): Candidate | null {
  if (!a) return b;
  if (!b) return a;
  return b.confidence > a.confidence ? b : a;
}

/** Question bank in reference order (section ord, then question ord). */
export async function loadQuestionBank(): Promise<QuestionRow[]> {
  const sb = supabase();
  if (!sb) return [];
  const [{ data: sections }, { data: questions }] = await Promise.all([
    sb.from("fq_sections").select("id, ord"),
    sb.from("fq_questions").select("id, section_id, ord, prompt, guidance"),
  ]);
  const sectionOrd = new Map(
    ((sections ?? []) as { id: string; ord: number }[]).map((s) => [s.id, s.ord])
  );
  return ((questions ?? []) as QuestionRow[]).sort(
    (a, b) =>
      (sectionOrd.get(a.section_id) ?? 0) - (sectionOrd.get(b.section_id) ?? 0) || a.ord - b.ord
  );
}

/** Defensive parse of one model answer entry. Citations whose doc_id was not in
 *  the allowed set are dropped deterministically (anti-invention post-filter). */
function sanitizeCandidate(
  raw: unknown,
  allowedDocIds: Set<string>,
  titles: Map<string, string>
): Candidate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const content = typeof o.content === "string" ? o.content.trim() : "";
  if (content === "") return null;
  const confRaw = typeof o.confidence === "number" ? o.confidence : Number(o.confidence);
  const confidence = Number.isFinite(confRaw) ? Math.max(0, Math.min(1, confRaw)) : 0.5;
  const sources: CitedSource[] = [];
  const claimedSources = Array.isArray(o.sources) ? o.sources.length : 0;
  if (Array.isArray(o.sources)) {
    for (const entry of o.sources) {
      if (!entry || typeof entry !== "object") continue;
      const s = entry as Record<string, unknown>;
      const docId = typeof s.doc_id === "string" ? s.doc_id : "";
      if (!allowedDocIds.has(docId)) continue;
      sources.push({
        doc_id: docId,
        title:
          typeof s.title === "string" && s.title.trim() !== ""
            ? s.title
            : titles.get(docId) ?? "",
        evidence: typeof s.evidence === "string" ? s.evidence : "",
      });
    }
  }
  // Every citation the model offered was invented (no doc_id from this batch):
  // the content is untrustworthy too — discard rather than surface it uncited.
  if (claimedSources > 0 && sources.length === 0) return null;
  return { content, confidence, sources };
}

// ---------- model calls ----------

interface RawAnswerEnvelope {
  answers?: unknown[];
}

/** ask() + parseModelJson with one repair retry (blueprint §3.1). */
async function askJson<T>(prompt: string, extraContext?: string, model?: string): Promise<T> {
  const opts = { extraContext, maxTokens: 16000, model };
  try {
    return parseModelJson<T>(await ask(prompt, opts));
  } catch {
    const repaired = `${prompt}\nYour previous reply was not valid JSON. Return only the JSON object.`;
    return parseModelJson<T>(await ask(repaired, opts));
  }
}

// The overridable extraction/merge bodies live in agentPrompts.ts and reach
// the model through the `fq-extraction` / `fq-merge` agent config
// (composeAgentPrompt). The suffix builders below are the LOCKED contract
// tails — parseModelJson/sanitizeCandidate consume their JSON shape, so they
// are code-owned and appended unconditionally (Agents blueprint §0.1-2).

/** LOCKED contract suffix for `fq-extraction`: question list + JSON demand. */
export function buildExtractionSuffix(
  questions: Pick<QuestionRow, "id" | "prompt" | "guidance">[]
): string {
  const questionsJson = JSON.stringify(
    questions.map((q) => ({ id: q.id, prompt: q.prompt, guidance: q.guidance ?? "" }))
  );
  return `Questions (JSON):
${questionsJson}

Return ONLY valid JSON — no markdown fences, no commentary — matching exactly:
{"answers":[{"question_id":"A1-Q1","content":"...","confidence":0.85,"sources":[{"doc_id":"<uuid from the doc tag>","title":"<doc title>","evidence":"<verbatim quote>"}]}]}`;
}

export interface MergeItem {
  question_id: string;
  prompt: string;
  transcript_candidate: Candidate | null;
  document_candidate: Candidate | null;
}

/** LOCKED contract suffix for `fq-merge`. The PMM-feedback line is runtime
 *  reviewer text (never admin config), so it rides at the top of the suffix —
 *  after the body and any custom instructions, before the JSON contract. */
export function buildMergeSuffix(items: MergeItem[], feedback?: string): string {
  const feedbackBlock = feedback
    ? `- The PMM reviewer rejected the previous proposal with this feedback — address it directly: "${feedback}"\n\n`
    : "";
  return `${feedbackBlock}Questions and candidates (JSON):
${JSON.stringify(items)}

Return ONLY valid JSON: {"answers":[{"question_id":"...","content":"...","confidence":0.8,"sources":[...]}]}`;
}

/** Union of both candidates' cited doc ids + titles — the merge citation filter. */
function candidateSourceIndex(
  ...candidates: (Candidate | null)[]
): { allowed: Set<string>; titles: Map<string, string> } {
  const allowed = new Set<string>();
  const titles = new Map<string, string>();
  for (const c of candidates) {
    for (const s of c?.sources ?? []) {
      allowed.add(s.doc_id);
      if (s.title) titles.set(s.doc_id, s.title);
    }
  }
  return { allowed, titles };
}

// ---------- passes ----------

/** The extraction pass. Sequential batches (no concurrency — protects the API
 *  budget and keeps the prompt cache warm). Upserts the pass's candidate column
 *  per question after every batch so partial progress survives a later failure.
 *  Fired with `void` from the route; failures land in fq_runs. */
export async function runExtractionPass(
  productId: string,
  pass: "transcripts" | "documents",
  runId: string
): Promise<void> {
  try {
    const sb = supabase();
    if (!sb) throw new Error("Database not configured");

    const { data: product } = await sb
      .from("products")
      .select("name, line")
      .eq("id", productId)
      .single();
    if (!product) throw new Error("Product not found");

    const questions = await loadQuestionBank();
    const questionIds = new Set(questions.map((q) => q.id));
    const sources = await gatherSources(productId, pass);
    if (sources.length === 0) throw new Error(`No ${pass} ingested for this product.`);

    // Agent config, loaded once per run (mid-run changes apply to the next
    // run, §0.1-7). Disabled -> AgentError; the outer catch records its
    // message via finishRun('failed', ...) — the kill-switch surface (§0.1-5).
    const cfg = await getAgentConfig("fq-extraction");
    assertAgentEnabled(cfg);
    const model = resolveModel(cfg);
    const p = product as { name: string; line: string | null };
    const sourceType =
      pass === "transcripts" ? "call transcripts" : "product documents (PRDs, specs, release notes)";

    const batches = batchDocs(sources);
    const prompt = composeAgentPrompt(
      cfg,
      { product_name: p.name, product_line: p.line ?? p.name, source_type: sourceType },
      buildExtractionSuffix(questions)
    );
    const column = pass === "transcripts" ? "transcript_candidate" : "document_candidate";
    const best = new Map<string, Candidate>();

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const docsXml = batch
        .map((d) => `<doc id="${d.id}" title="${d.title}">\n${d.content}\n</doc>`)
        .join("\n\n");

      let parsed: RawAnswerEnvelope;
      try {
        parsed = await askJson<RawAnswerEnvelope>(prompt, docsXml, model);
      } catch {
        await finishRun(
          runId,
          "failed",
          `Model returned unparseable output for batch ${i + 1} — re-run the pass.`,
          { docsUsed: sources.length, questionsAnswered: best.size }
        );
        return;
      }

      const allowed = new Set(batch.map((d) => d.id));
      const titles = new Map(batch.map((d) => [d.id, d.title]));
      const touched = new Set<string>();
      for (const entry of parsed.answers ?? []) {
        const qid =
          entry && typeof entry === "object" && typeof (entry as { question_id?: unknown }).question_id === "string"
            ? (entry as { question_id: string }).question_id
            : "";
        if (!questionIds.has(qid)) continue;
        const candidate = sanitizeCandidate(entry, allowed, titles);
        if (!candidate) continue;
        const reduced = reduceCandidates(best.get(qid) ?? null, candidate);
        if (!reduced) continue;
        best.set(qid, reduced);
        touched.add(qid);
      }

      // Persist after every batch — the reducer is idempotent, so a later
      // batch failure keeps everything already extracted.
      for (const qid of touched) {
        const { error } = await sb.from("fq_answers").upsert(
          {
            product_id: productId,
            question_id: qid,
            [column]: best.get(qid),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "product_id,question_id" }
        );
        if (error) throw new Error(`fq_answers upsert failed: ${error.message}`);
      }
    }

    await finishRun(
      runId,
      "done",
      `${best.size} of ${questions.length} questions answered from ${sources.length} source(s) in ${batches.length} batch(es).`,
      { docsUsed: sources.length, questionsAnswered: best.size }
    );
  } catch (err) {
    await finishRun(runId, "failed", (err as Error).message);
  }
}

/** Merge proposer. For each question of this product:
 *  both candidates → include in one batched merge call (chunks of ~12 questions);
 *  one candidate  → merged_candidate = that candidate verbatim (no model call);
 *  none           → status 'gap'.
 *  Sets status 'pending_review' wherever a merged_candidate lands (single-candidate
 *  questions still require sign-off — requirement 3). */
export async function runMergePass(productId: string, runId: string): Promise<void> {
  try {
    const sb = supabase();
    if (!sb) throw new Error("Database not configured");

    // Agent config for the merge proposer (§0.1-5/-7: loaded once at run
    // start; disabled -> failed run naming the Agents tab via the catch).
    const cfg = await getAgentConfig("fq-merge");
    assertAgentEnabled(cfg);
    const model = resolveModel(cfg);

    const questions = await loadQuestionBank();
    const { data: answerData } = await sb
      .from("fq_answers")
      .select("*")
      .eq("product_id", productId);
    const byQuestion = new Map(
      ((answerData ?? []) as AnswerRow[]).map((a) => [a.question_id, a])
    );
    const now = () => new Date().toISOString();

    const toMerge: { question: QuestionRow; row: AnswerRow }[] = [];
    let singles = 0;
    let gaps = 0;
    let kept = 0;

    for (const question of questions) {
      const row = byQuestion.get(question.id);
      // A PMM decision is the sign-off gate (§8.4) — re-running the merge must
      // never un-decide an adjudicated question.
      if (row && (row.status === "accepted" || row.status === "rejected")) {
        kept += 1;
        continue;
      }
      const transcript = row?.transcript_candidate ?? null;
      const document = row?.document_candidate ?? null;

      if (transcript && document && row) {
        toMerge.push({ question, row });
        continue;
      }

      const only = transcript ?? document;
      if (only && row) {
        const { error } = await sb
          .from("fq_answers")
          .update({ merged_candidate: only, status: "pending_review", updated_at: now() })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
        singles += 1;
      } else {
        // Zero candidates from either pass — this question is a gap (F5 item).
        const { error } = await sb.from("fq_answers").upsert(
          { product_id: productId, question_id: question.id, status: "gap", updated_at: now() },
          { onConflict: "product_id,question_id" }
        );
        if (error) throw new Error(error.message);
        gaps += 1;
      }
    }

    for (let i = 0; i < toMerge.length; i += MERGE_CHUNK_SIZE) {
      const chunk = toMerge.slice(i, i + MERGE_CHUNK_SIZE);
      const items: MergeItem[] = chunk.map(({ question, row }) => ({
        question_id: question.id,
        prompt: question.prompt,
        transcript_candidate: row.transcript_candidate,
        document_candidate: row.document_candidate,
      }));

      let parsed: RawAnswerEnvelope;
      try {
        parsed = await askJson<RawAnswerEnvelope>(
          composeAgentPrompt(cfg, {}, buildMergeSuffix(items)),
          undefined,
          model
        );
      } catch {
        await finishRun(
          runId,
          "failed",
          `Model returned unparseable output for merge batch ${Math.floor(i / MERGE_CHUNK_SIZE) + 1} — re-run the pass.`
        );
        return;
      }

      const proposals = new Map<string, unknown>();
      for (const entry of parsed.answers ?? []) {
        const qid =
          entry && typeof entry === "object" && typeof (entry as { question_id?: unknown }).question_id === "string"
            ? (entry as { question_id: string }).question_id
            : "";
        if (qid !== "") proposals.set(qid, entry);
      }

      for (const { question, row } of chunk) {
        const { allowed, titles } = candidateSourceIndex(
          row.transcript_candidate,
          row.document_candidate
        );
        const proposed = sanitizeCandidate(proposals.get(question.id), allowed, titles);
        // Model skipped or mangled the question → fall back to the
        // higher-confidence candidate so nothing is stranded outside the queue.
        const merged =
          proposed ?? reduceCandidates(row.transcript_candidate, row.document_candidate);
        if (!merged) continue;
        const { error } = await sb
          .from("fq_answers")
          .update({ merged_candidate: merged, status: "pending_review", updated_at: now() })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
      }
    }

    await finishRun(
      runId,
      "done",
      `Review queue built: ${toMerge.length} merged proposal(s), ${singles} single-candidate question(s), ${gaps} gap(s)` +
        (kept > 0 ? `, ${kept} already-decided question(s) left untouched.` : "."),
      { questionsAnswered: toMerge.length + singles }
    );
  } catch (err) {
    await finishRun(runId, "failed", (err as Error).message);
  }
}

/** Synchronous single-question re-merge for the Regenerate CTA; returns the new proposal. */
export async function regenerateMerge(answerId: string, feedback: string): Promise<Candidate> {
  const sb = supabase();
  if (!sb) throw new Error("Database not configured");

  const { data: answer } = await sb
    .from("fq_answers")
    .select("*")
    .eq("id", answerId)
    .maybeSingle();
  if (!answer) throw new Error("Answer not found");
  const row = answer as AnswerRow;

  const transcript = row.transcript_candidate;
  const document = row.document_candidate;
  if (!transcript && !document) {
    throw new Error("This question has no extraction candidates to merge.");
  }

  const { data: question } = await sb
    .from("fq_questions")
    .select("id, prompt")
    .eq("id", row.question_id)
    .single();

  // Agent config: synchronous path — a disabled agent throws AgentError(409),
  // which the decision route maps to its status (kill switch, §0.1-5).
  const cfg = await getAgentConfig("fq-merge");
  assertAgentEnabled(cfg);

  const items: MergeItem[] = [
    {
      question_id: row.question_id,
      prompt: (question as { prompt?: string } | null)?.prompt ?? "",
      transcript_candidate: transcript,
      document_candidate: document,
    },
  ];
  const parsed = await askJson<RawAnswerEnvelope>(
    composeAgentPrompt(cfg, {}, buildMergeSuffix(items, feedback)),
    undefined,
    resolveModel(cfg)
  );

  const { allowed, titles } = candidateSourceIndex(transcript, document);
  const proposed = sanitizeCandidate((parsed.answers ?? [])[0], allowed, titles);
  const merged = proposed ?? reduceCandidates(transcript, document);
  if (!merged) throw new Error("The model did not return a usable merged answer.");

  const { error } = await sb
    .from("fq_answers")
    .update({
      merged_candidate: merged,
      feedback,
      status: "pending_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", answerId);
  if (error) throw new Error(error.message);

  return merged;
}

/** True when no extract question for the product is 'unanswered' or 'pending_review'.
 *  Questions with no fq_answers row yet count as unanswered. */
export async function isSignedOff(productId: string): Promise<{ ok: boolean; pending: number }> {
  const sb = supabase();
  if (!sb) return { ok: false, pending: 0 };
  const [{ data: questions }, { data: answers }] = await Promise.all([
    sb.from("fq_questions").select("id"),
    sb.from("fq_answers").select("question_id, status").eq("product_id", productId),
  ]);
  const decided = new Set(
    ((answers ?? []) as { question_id: string; status: AnswerStatus }[])
      .filter((a) => a.status === "accepted" || a.status === "rejected" || a.status === "gap")
      .map((a) => a.question_id)
  );
  const pending = ((questions ?? []) as { id: string }[]).filter((q) => !decided.has(q.id)).length;
  return { ok: pending === 0, pending };
}
