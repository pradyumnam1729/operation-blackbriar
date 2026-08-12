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

/** POST that expects a binary response (e.g. a generated PDF) instead of JSON. */
export async function apiPostBlob(path: string, body?: unknown): Promise<Blob> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof parsed.error === "string" ? parsed.error : res.statusText,
      parsed
    );
  }
  return res.blob();
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

// ---- Ask-to-artifact routing (blueprint app/docs/blueprints/ask-to-artifact.md §3.1, §6.1) ----

/** Template the router chose — always a validated row from the candidate set,
 *  never raw model output. */
export interface RoutingTemplateRef {
  id: string;
  name: string;
  asset_type: string;
  product_line: string | null;
  audience: string | null;
  persona: string | null;
  funnel_stage: string | null;
}

export interface RoutingProposal {
  /** Router's stated confidence (already past the server-side threshold). */
  confidence: number;
  /** From the chosen template row, not the model's guess. */
  asset_type: string;
  template: RoutingTemplateRef;
  /** True when the model's template_id was invalid/absent and the server fell
   *  back to the asset type's first approved template. */
  template_fallback_used: boolean;
  /** Resolved products row (default: Masterworks AI). */
  product: { id: string; name: string };
  /** Code-built: `${product.name} — ${template.name}`. */
  suggested_title: string;
  /** Model-drafted, user-editable; sent as extra_brief on Generate. */
  brief: string;
  /** One line explaining the routing, shown on the card. */
  reason: string;
}

export interface AskTraceStep {
  tool: string;
  summary: string;
}

export type AskResponse =
  | { kind: "answer"; answerHtml: string; role: string; trace?: AskTraceStep[] }
  | { kind: "routing"; role: string; proposal: RoutingProposal };

/** mode "question" skips classification — the card's "Just answer this
 *  instead" escape hatch. Default "auto" classifies first. */
export const askWarRoom = (question: string, role: string, mode?: "auto" | "question") =>
  apiPost<AskResponse>("/api/query", { question, role, mode });

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

export type AgentKind = "task" | "pmm" | "custom";
export type AgentGroup = "A" | "B" | "C";
export type AgentContract =
  | "fq-answers-json"
  | "fills-json"
  | "section-headings"
  | "markdown"
  | "route-json";

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
  /** Custom connected agents only. */
  endpoint_url?: string | null;
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

// ---- Custom connected agents (Agents tab, admin) ----

export interface CustomAgent {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  endpoint_url: string | null;
  timeout_ms: number;
  owner_team: string | null;
  has_auth_token: boolean;
  updated_at: string;
}

export interface CustomAgentInput {
  name: string;
  description: string;
  endpoint_url: string;
  auth_token?: string;
  timeout_ms?: number;
  owner_team?: string;
}

export const registerCustomAgent = (body: CustomAgentInput) =>
  apiPost<{ agent: CustomAgent }>("/api/agents/custom", body);

export const updateCustomAgent = (key: string, patch: Partial<CustomAgentInput> & { enabled?: boolean }) =>
  apiPut<{ agent: CustomAgent }>(`/api/agents/custom/${encodeURIComponent(key)}`, patch);

export const deleteCustomAgent = (key: string) =>
  apiDelete<{ ok: boolean }>(`/api/agents/custom/${encodeURIComponent(key)}`);

export const invokeCustomAgentTest = (key: string, input?: string) =>
  apiPost<{ output: string; latency_ms: number }>(
    `/api/agents/custom/${encodeURIComponent(key)}/invoke`,
    { input }
  );

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

// ---- Deck Studio + Document Editor v2 (blueprint app/docs/blueprints/deck-studio.md §1.1, §4, §5.4) ----

export type SlideLayout =
  | "title"            // deck opener: kicker + title + subtitle, dark teal full bleed
  | "agenda"           // numbered items
  | "section"          // section separator, darkest teal full bleed
  | "content-bullets"  // headline + bullets (the workhorse)
  | "two-column"       // headline + two headed card columns
  | "quote"            // proof/quote slide, dark teal
  | "closing";         // CTA slide, darkest teal, wordmark

export interface SlideColumn {
  heading: string;
  items: string[];
}

export interface SlideQuote {
  text: string;
  attribution: string;
}

export interface DeckSlide {
  id: string;                            // stable within the deck ("s1", "s2", …)
  layout: SlideLayout;
  title: string;                         // plain text, ≤200 chars
  subtitle?: string;                     // title | section | closing; ≤300
  body?: string[];                       // agenda | content-bullets; ≤20 items, each ≤500
  columns?: [SlideColumn, SlideColumn];  // two-column only
  quote?: SlideQuote;                    // quote only
  notes?: string;                        // speaker notes, ≤2000; ships in the .pptx
}

export interface DeckDoc {
  schema: 1;
  theme: "aurigo-2026";
  slides: DeckSlide[]; // 1–40
}

/** §1.1 hard server caps — the UI shows soft counters from 80% of these. */
// Mirrors CAPS in app/backend/src/services/deck.ts — keep byte-identical so
// the soft counters warn before the server's hard 400s.
export const DECK_CAPS = {
  slides: 40,
  title: 200,
  subtitle: 300,
  bulletsPerSlide: 20,
  bullet: 500,
  columnHeading: 120,
  columnItem: 300,
  quoteText: 600,
  quoteAttribution: 200,
  notes: 2000,
} as const;

/** Guard result riding save/chat responses — informational on drafts, the
 *  admin-only finalize gate is the enforcement point (§0.1-5). */
export interface GuardCheck {
  ok: boolean;
  violations: string[];
}

export type ArtifactStatus = "draft" | "in_review" | "final" | "archived";

export interface ArtifactDetail {
  id: string;
  title: string;
  asset_type: string;
  product_id: string | null;
  product_name: string | null;
  persona: string | null;
  status: ArtifactStatus;
  current_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtifactVersionMeta {
  id: string;
  version: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ArtifactDetailResponse {
  artifact: ArtifactDetail;
  versions: ArtifactVersionMeta[];
  contentHtml: string;
  /** True for template-generated artifacts — an artifact_renders row exists. */
  hasRender?: boolean;
  /** Current version's structured slides; null for documents and legacy decks (§4.1). */
  slides?: DeckDoc | null;
}

export const getArtifactDetail = (id: string) =>
  apiGet<ArtifactDetailResponse>(`/api/artifacts/${id}`);

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatEditResponse {
  version: number;
  summary: string;
  guard: GuardCheck;
  slides: DeckDoc | null; // null for document artifacts
  contentHtml: string;
}

/** Conversational edit — a new version on success (§4.4). 422 = unparseable AI
 *  reply (issues in body, nothing saved); 502 = AI unavailable, content untouched. */
export const chatEditArtifact = (
  id: string,
  body: { message: string; scope?: string; history?: ChatTurn[] }
) => apiPost<ChatEditResponse>(`/api/artifacts/${id}/chat-edit`, body);

export interface ConvertToSlidesResponse {
  version: number;
  slides: DeckDoc;
  guard: GuardCheck;
  summary: string;
}

/** Legacy HTML-only decks → structured slides (§4.6). 409 = not convertible. */
export const convertToSlides = (id: string) =>
  apiPost<ConvertToSlidesResponse>(`/api/artifacts/${id}/convert-to-slides`);

export interface SaveVersionResponse {
  version: number;
  guard?: GuardCheck;
}

/** Dual-mode save (§4.2): exactly one of `slides` | `content_html`. 400 with
 *  `issues` for invalid slides. Guard never blocks a draft save. */
export const saveArtifactVersion = (
  id: string,
  body: { slides: DeckDoc; note?: string } | { content_html: string; note?: string }
) => apiPost<SaveVersionResponse>(`/api/artifacts/${id}/versions`, body);

/** Authed binary fetch — !ok throws ApiError from the JSON error body (§5.4). */
export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(path, { headers: await authHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof body.error === "string" ? body.error : res.statusText,
      body
    );
  }
  return res.blob();
}

/** Downloads the deck as a real .pptx (bearer header rides the fetch — the
 *  token cannot ride an <a href>). ApiError(409) = no structured slides yet. */
export async function downloadArtifactPptx(
  id: string,
  title: string,
  version?: number
): Promise<void> {
  const blob = await apiGetBlob(
    `/api/artifacts/${id}/export.pptx${version === undefined ? "" : `?version=${version}`}`
  );
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "deck";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}${version === undefined ? "" : `-v${version}`}.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
