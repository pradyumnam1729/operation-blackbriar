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
