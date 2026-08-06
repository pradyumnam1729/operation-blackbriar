import { supabase } from "./supabase";

// Generic authed API helpers. Module pages build on these — the Supabase
// access token rides every request and the backend enforces roles.

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
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

export interface FoundationResponse {
  sections: { path: string; title: string; preview: string }[];
  context: { path: string; exists: boolean }[];
}

export const getFoundation = () => apiGet<FoundationResponse>("/api/foundation");
export const getFoundationFile = (path: string) =>
  apiGet<{ path: string; content: string }>(
    `/api/foundation/file?path=${encodeURIComponent(path)}`
  );

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

export const startExtraction = (productId: string, pass: "transcripts" | "documents") =>
  apiPost<{ run: FqRun }>(`/api/questionnaire/${productId}/extract`, { pass });

export const startMerge = (productId: string) =>
  apiPost<{ run: FqRun }>(`/api/questionnaire/${productId}/merge`);

export const getRuns = (productId: string) =>
  apiGet<{ runs: FqRun[] }>(`/api/questionnaire/${productId}/runs`).then((r) => r.runs);

export const decideAnswer = (answerId: string, body: FqDecisionBody) =>
  apiPost<{ answer: FqAnswer }>(`/api/questionnaire/answers/${answerId}/decision`, body).then(
    (r) => r.answer
  );

export const startGeneration = (productId: string) =>
  apiPost<{ run: FqRun }>(`/api/questionnaire/${productId}/generate`);

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
