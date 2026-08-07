import { supabase } from "./supabase";

// Generic authed API helpers. Module pages build on these — the Supabase
// access token rides every request and the backend enforces roles.

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Error carrying the HTTP status and parsed body — callers that need the
 *  status (409 no-final-doc gate) or extra fields (validation `issues`,
 *  per-slot `over` limits) test `instanceof ApiError`. Message stays the
 *  server's `{error}` string, so existing `(e as Error).message` call sites
 *  keep working unchanged. */
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof body.error === "string" ? body.error : res.statusText,
      body
    );
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  return handle<T>(await fetch(path, { headers: await authHeaders() }));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

export async function apiDelete<T>(path: string): Promise<T> {
  return handle<T>(
    await fetch(path, { method: "DELETE", headers: await authHeaders() })
  );
}

/** Multipart upload (files + fields). Content-Type left to the browser. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return handle<T>(
    await fetch(path, { method: "POST", headers: await authHeaders(), body: form })
  );
}

// ---- shared types ----
export type Role = "admin" | "sales" | "marketing" | "elt";

export interface Me {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
}

export interface Product {
  id: string;
  name: string;
  line: string;
  module: string;
}

export const getMe = () => apiGet<{ user: Me }>("/api/me").then((r) => r.user);
export const getProducts = () =>
  apiGet<{ products: Product[] }>("/api/products").then((r) => r.products);

export const askWarRoom = (question: string, role: string) =>
  apiPost<{ answerHtml: string; role: string }>("/api/query", { question, role });

// ---- Foundation Questionnaire pipeline (admin) ----

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

export type FqAnswerStatus =
  | "unanswered"
  | "pending_review"
  | "accepted"
  | "rejected"
  | "gap";

export interface FqAnswer {
  id: string;
  status: FqAnswerStatus;
  transcript_candidate: Candidate | null;
  document_candidate: Candidate | null;
  merged_candidate: Candidate | null;
  final_answer: string | null;
  final_sources: CitedSource[];
  feedback: string | null;
  decided_at: string | null;
}

export interface FqQuestion {
  id: string;
  ord: number;
  prompt: string;
  guidance: string | null;
  answer: FqAnswer | null;
}

export interface FqSection {
  id: string;
  part: string;
  title: string;
  mode: "extract" | "synthesize" | "hybrid" | "auto" | "static";
  ord: number;
  questions: FqQuestion[];
}

export interface FqProgress {
  total: number;
  unanswered: number;
  pending_review: number;
  accepted: number;
  rejected: number;
  gaps: number;
}

export type FqRunPass = "transcripts" | "documents" | "merge" | "generate";

export interface FqRun {
  id: string;
  pass: FqRunPass;
  status: "running" | "done" | "failed";
  detail: string | null;
  docs_used: number;
  questions_answered: number;
  started_at: string;
  finished_at: string | null;
}

export interface QuestionnairePayload {
  sections: FqSection[];
  progress: FqProgress;
  runs: FqRun[];
}

export interface FqDecisionBody {
  action: "accept" | "edit" | "pick" | "regenerate" | "reject";
  content?: string;
  source?: "transcript" | "document";
  feedback?: string;
}

export const getQuestionnaire = (productId: string) =>
  apiGet<QuestionnairePayload>(`/api/questionnaire/${productId}`);

// 202 responses carry only a slim run stub — the full row comes from getRuns polling.
export type FqRunStub = Pick<FqRun, "id" | "pass" | "status">;

export const startExtraction = (productId: string, pass: "transcripts" | "documents") =>
  apiPost<{ run: FqRunStub }>(`/api/questionnaire/${productId}/extract`, { pass });

export const startMerge = (productId: string) =>
  apiPost<{ run: FqRunStub }>(`/api/questionnaire/${productId}/merge`);

export const getRuns = (productId: string) =>
  apiGet<{ runs: FqRun[] }>(`/api/questionnaire/${productId}/runs`).then((r) => r.runs);

export const decideAnswer = (answerId: string, body: FqDecisionBody) =>
  apiPost<{ answer: FqAnswer }>(`/api/questionnaire/answers/${answerId}/decision`, body).then(
    (r) => r.answer
  );

export const startGeneration = (productId: string) =>
  apiPost<{ run: FqRunStub }>(`/api/questionnaire/${productId}/generate`);

// ---- Messaging & positioning documents ----

export type MessagingDocStatus = "draft" | "final" | "archived";

export interface MessagingDocSummary {
  id: string;
  version: number;
  status: MessagingDocStatus;
  title: string;
  created_at: string;
  approved_at: string | null;
  war_room_path: string | null;
  exported_path: string | null;
}

export interface MessagingDocGap {
  question_id: string;
  prompt: string;
  note: string;
}

export interface MessagingDoc extends MessagingDocSummary {
  product_id: string;
  sections: { id: string; title: string; markdown: string }[];
  content_md: string;
  content_html: string;
  gaps: MessagingDocGap[];
  guard_violations: string[];
  created_by: string | null;
  approved_by: string | null;
}

export interface ApproveDocResponse {
  doc: MessagingDoc;
  warRoomPath: string;
  exportedPath: string | null;
  warning?: string;
}

export const listMessagingDocs = (productId: string) =>
  apiGet<{ docs: MessagingDocSummary[] }>(`/api/messaging-docs/${productId}`).then(
    (r) => r.docs
  );

export const getMessagingDoc = (id: string) =>
  apiGet<{ doc: MessagingDoc }>(`/api/messaging-docs/doc/${id}`).then((r) => r.doc);

export const approveMessagingDoc = (id: string) =>
  apiPost<ApproveDocResponse>(`/api/messaging-docs/doc/${id}/approve`);

// ---- Template Library (layout-locked, slot-based templates) ----

export type TemplateFormat = "html" | "svg" | "deck" | "email" | "markdown";
export type FunnelStage = "awareness" | "consideration" | "decision" | "expansion";

export interface TemplateSlot {
  id: string;
  label: string;
  purpose: string;
  max_chars: number;
  required: boolean;
  render: "text" | "multiline" | "lines";
  max_lines?: number;
  source_sections: string[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  asset_type: string;
  format: TemplateFormat | null;
  product_line: string | null;
  preview_color: string | null;
  audience: string | null;
  persona: string | null;
  funnel_stage: FunnelStage | null;
  exemplar_path: string | null;
  template_version: number;
  approved: boolean;
  /** True iff the template carries a layout body — legacy mock rows are false. */
  generation_ready: boolean;
}

export interface TemplateDetail extends TemplateSummary {
  body: string | null;
  slots: TemplateSlot[];
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface TemplateWriteBody {
  name: string;
  asset_type: string;
  format: TemplateFormat;
  body: string;
  slots: TemplateSlot[];
  product_line?: string | null;
  audience?: string | null;
  persona?: string | null;
  funnel_stage?: FunnelStage | null;
  exemplar_path?: string | null;
  preview_color?: string | null;
  /** PUT only — approval is toggled on update, no separate endpoint. */
  approved?: boolean;
}

export interface RenderWarning {
  slot_id: string;
  kind: "over_limit" | "missing" | "empty_section";
  detail: string;
}

export interface TemplatePreviewPayload {
  format: TemplateFormat;
  payload: string;
}

export interface GenerateFromTemplateResponse {
  artifactId: string;
  guard: { ok: boolean; violations: string[] };
  warnings: RenderWarning[];
  messagingDocVersion: number;
}

export interface ArtifactRender {
  format: TemplateFormat;
  payload: string;
  slot_fills: Record<string, string>;
  warnings: RenderWarning[];
  template_id: string | null;
  template_version: number | null;
  messaging_doc_id: string | null;
}

export const listTemplates = (filters?: { asset_type?: string; format?: TemplateFormat }) => {
  const params = new URLSearchParams();
  if (filters?.asset_type) params.set("asset_type", filters.asset_type);
  if (filters?.format) params.set("format", filters.format);
  const qs = params.toString();
  return apiGet<{ templates: TemplateSummary[] }>(
    `/api/templates${qs === "" ? "" : `?${qs}`}`
  ).then((r) => r.templates);
};

export const getTemplate = (id: string) =>
  apiGet<{ template: TemplateDetail }>(`/api/templates/${id}`).then((r) => r.template);

export const createTemplate = (body: TemplateWriteBody) =>
  apiPost<{ template: TemplateDetail }>("/api/templates", body).then((r) => r.template);

export const updateTemplate = (id: string, body: Partial<TemplateWriteBody>) =>
  apiPut<{ template: TemplateDetail }>(`/api/templates/${id}`, body).then((r) => r.template);

export const deleteTemplate = (id: string) =>
  apiDelete<{ ok: true }>(`/api/templates/${id}`);

/** 422 for legacy rows without a layout body — surface the message, do not retry. */
export const previewTemplate = (id: string) =>
  apiGet<TemplatePreviewPayload>(`/api/templates/${id}/preview`);

/** 409 (no final messaging doc) is the §3.1 gate — link the user to /questionnaire. */
export const generateFromTemplate = (
  id: string,
  body: { product_id: string; title: string; extra_brief?: string }
) => apiPost<GenerateFromTemplateResponse>(`/api/templates/${id}/generate`, body);

export const getArtifactRender = (artifactId: string, version?: number) =>
  apiGet<{ render: ArtifactRender }>(
    `/api/artifacts/${artifactId}/render${version === undefined ? "" : `?version=${version}`}`
  ).then((r) => r.render);

/** Deterministic re-render, no model call. 400 body carries `over: [{slot_id, chars, max}]`. */
export const saveArtifactSlots = (
  artifactId: string,
  fills: Record<string, string>,
  note?: string
) => apiPost<{ version: number }>(`/api/artifacts/${artifactId}/slots`, { fills, note });

// ---- Agents registry (admin-only; blueprint app/docs/blueprints/agents-tab.md §2.4) ----

export type AgentKind = "task" | "pmm";
export type AgentGroup = "A" | "B" | "C";
export type AgentContract =
  | "fq-answers-json"
  | "fills-json"
  | "section-headings"
  | "markdown";

export interface AgentSummary {
  key: string;
  kind: AgentKind;
  grp: AgentGroup | null;
  name: string;
  description: string;
  model: string | null;
  enabled: boolean;
  /** prompt_override != null */
  overridden: boolean;
  has_custom_instructions: boolean;
  updated_at: string;
  updated_by_name: string | null;
}

export interface AgentListResponse {
  agents: AgentSummary[];
  default_model: string;
  model_allowlist: string[];
}

export interface AgentDetail {
  id: string;
  key: string;
  kind: AgentKind;
  grp: AgentGroup | null;
  name: string;
  description: string;
  /** Overridable body only — the locked contract suffix is code-owned. */
  base_prompt: string;
  custom_instructions: string;
  /** null = use base_prompt. Never replaces the contract suffix. */
  prompt_override: string | null;
  /** null = PMM default model. */
  model: string | null;
  enabled: boolean;
  defaults: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
  /** Present on PUT/revert responses (raw row); GET detail omits it. */
  created_at?: string;
}

export interface AgentMeta {
  contract: AgentContract;
  /** Code-owned suffix, built with sample runtime values — shown read-only. */
  contract_suffix_preview: string;
  placeholders: string[];
  defaults_schema: string;
  registry_defaults: Record<string, unknown>;
  model_allowlist: string[];
  default_model: string;
}

export interface AgentPatch {
  custom_instructions?: string;
  prompt_override?: string | null;
  model?: string | null;
  enabled?: boolean;
  defaults?: Record<string, unknown>;
}

export interface AgentTestRunBody {
  custom_instructions?: string;
  prompt_override?: string | null;
  model?: string | null;
  defaults?: Record<string, unknown>;
  input?: { question?: string; role?: string; brief?: string };
  compose_only?: boolean;
}

export interface TestRunResult {
  prompt: string;
  output_raw?: string;
  output_html?: string;
  contract: { checked: boolean; ok: boolean; error?: string };
  guard: { ok: boolean; violations: string[] };
  model_used: string;
  duration_ms: number;
}

export const listAgents = () => apiGet<AgentListResponse>("/api/agents");

export const getAgent = (key: string) =>
  apiGet<{ agent: AgentDetail; meta: AgentMeta }>(`/api/agents/${encodeURIComponent(key)}`);

/** 400 for an unlisted model or non-object defaults; warnings carry unknown {{placeholders}}. */
export const updateAgent = (key: string, patch: AgentPatch) =>
  apiPut<{ agent: AgentDetail; warnings: string[] }>(
    `/api/agents/${encodeURIComponent(key)}`,
    patch
  );

/** Clears override/instructions/model/defaults; keeps enabled state (§0.1-4). */
export const revertAgent = (key: string) =>
  apiPost<{ agent: AgentDetail }>(`/api/agents/${encodeURIComponent(key)}/revert`);

/** Runs a CANDIDATE config (never persisted). 400 missing sample input; 409 disabled; 502 model failure. */
export const testRunAgent = (key: string, body: AgentTestRunBody) =>
  apiPost<TestRunResult>(`/api/agents/${encodeURIComponent(key)}/test-run`, body);
