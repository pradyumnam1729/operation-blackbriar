import { supabase } from "./db";

// Guardrail files: admin-editable grounding content injected into every AI
// system prompt. Cached briefly so ask() stays fast and the prompt prefix
// stays stable between edits (good for prompt caching).

export interface GuardrailFile {
  id: string;
  name: string;
  description: string | null;
  content_md: string;
  active: boolean;
  sort: number;
  updated_at: string;
}

let cache: { text: string; at: number } | null = null;
const TTL_MS = 60_000;

export function invalidateGuardrailCache(): void {
  cache = null;
}

/** Active guardrail files rendered for the system prompt (60s cache). */
export async function guardrailContext(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.text;
  const sb = supabase();
  if (!sb) return "";
  const { data } = await sb
    .from("guardrail_files")
    .select("name, content_md")
    .eq("active", true)
    .order("sort");
  const text = (data ?? [])
    .filter((f) => f.content_md && f.content_md.trim() !== "")
    .map((f) => `<guardrail name="${f.name}">\n${f.content_md}\n</guardrail>`)
    .join("\n\n");
  cache = { text, at: Date.now() };
  return text;
}

/** Parse the Prompt library guardrail into per-audience suggestion chips. */
export async function promptSuggestions(): Promise<Record<string, string[]>> {
  const sb = supabase();
  if (!sb) return {};
  const { data } = await sb
    .from("guardrail_files")
    .select("content_md")
    .eq("name", "Prompt library")
    .eq("active", true)
    .maybeSingle();
  if (!data?.content_md) return {};
  const out: Record<string, string[]> = {};
  let section = "";
  for (const line of data.content_md.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      section = h[1].trim().toLowerCase();
      continue;
    }
    const item = line.match(/^-\s+(.+)$/);
    if (item && section) {
      (out[section] ??= []).push(item[1].trim());
    }
  }
  return out;
}
