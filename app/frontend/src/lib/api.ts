async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface QueryResponse {
  answer: string;
  role: string;
}

export function askWarRoom(question: string, role: string) {
  return fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, role }),
  }).then((r) => json<QueryResponse>(r));
}

export interface FoundationResponse {
  sections: { path: string; title: string; preview: string }[];
  context: { path: string; exists: boolean }[];
}

export function getFoundation() {
  return fetch("/api/foundation").then((r) => json<FoundationResponse>(r));
}

export function getFoundationFile(path: string) {
  return fetch(`/api/foundation/file?path=${encodeURIComponent(path)}`).then((r) =>
    json<{ path: string; content: string }>(r)
  );
}

export interface GenerateResponse {
  path: string;
  stage: string;
  content: string;
  guard: { ok: boolean; violations: string[] };
}

export function generateAsset(type: string, product: string, audience: string) {
  return fetch("/api/assets/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, product, audience }),
  }).then((r) => json<GenerateResponse>(r));
}

export function listDrafts() {
  return fetch("/api/assets").then((r) =>
    json<{ drafts: { path: string; preview: string }[] }>(r)
  );
}

export function approveAsset(path: string) {
  return fetch("/api/assets/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  }).then((r) => json<{ path: string; stage: string }>(r));
}
