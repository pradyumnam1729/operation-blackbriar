import crypto from "crypto";
import { supabase } from "./db";

// Open API key auth domain (blueprint open-api.md §2.1). Keys are high-entropy
// random tokens (160 bits) stored as sha-256 hashes; plaintext is shown once at
// creation and never persisted or logged. Node crypto only — no new deps.

export const API_SCOPES = ["assets:read", "messaging:read", "intel:read", "ask"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "assets:read": "List and download finalized assets (battlecards, datasheets, decks…)",
  "messaging:read": "Read approved Positioning & Messaging documents",
  "intel:read": "Read approved competitive intelligence (registry, CI reports, market threats)",
  "ask": "Ask the PMM knowledge engine plain-language questions (uses AI tokens)",
};

/** True when `scopes` is a non-empty array whose every element is a known
 *  API_SCOPES value. Pure — unit-tested; used by the create route (§2.3). */
export function isValidScopeSet(scopes: unknown): scopes is ApiScope[] {
  return (
    Array.isArray(scopes) &&
    scopes.length > 0 &&
    scopes.every((s) => typeof s === "string" && (API_SCOPES as readonly string[]).includes(s))
  );
}

/** Generate a key. Called exactly once per key; plaintext never persisted. */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `pmm_live_${crypto.randomBytes(20).toString("hex")}`; // 9 + 40 chars
  return { plaintext, hash: hashApiKey(plaintext), prefix: plaintext.slice(0, 15) };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export interface ResolvedApiKey {
  id: string;
  name: string;
  team: string;
  scopes: string[];
}

/** Hash the presented key, look it up by key_hash, require enabled. null on any
 *  miss (unknown OR revoked — the caller must never distinguish which). Side
 *  effect on hit: fire-and-forget last_used_at update (decision §0.1-4). The
 *  presented key is never logged, never stored anywhere but the hash lookup. */
export async function resolveApiKey(presented: string): Promise<ResolvedApiKey | null> {
  const sb = supabase();
  if (!sb) return null;
  const hash = hashApiKey(presented);
  const { data, error } = await sb
    .from("api_keys")
    .select("id, name, team, scopes, enabled")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data || data.enabled === false) return null;

  // Fire-and-forget: a per-call last_used_at update is cheaper than staleness
  // bookkeeping at MVP volume. Failure is non-fatal.
  void sb
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(({ error: uErr }) => {
      if (uErr) console.error("api_keys last_used_at update failed:", uErr.message);
    });

  return {
    id: String(data.id),
    name: String(data.name),
    team: String(data.team ?? ""),
    scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : [],
  };
}

/** Fire-and-forget insert into api_request_log. Never throws; console.error on
 *  failure. Stores the key id — NEVER key material. */
export function logApiRequest(
  keyId: string,
  method: string,
  path: string,
  status: number,
  durationMs: number
): void {
  const sb = supabase();
  if (!sb) return;
  void sb
    .from("api_request_log")
    .insert({ key_id: keyId, method, path, status, duration_ms: durationMs })
    .then(({ error }) => {
      if (error) console.error("api_request_log insert failed:", error.message);
    });
}
