import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Optional persistence layer. Content truth stays in GTM-War-Room markdown;
// Supabase holds the query/answer log and asset lifecycle metadata.
// With no credentials configured the app runs file-only — every helper is a no-op.
let client: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client =
    url && key
      ? createClient(url, key, { auth: { persistSession: false } })
      : null;
  if (!client) {
    console.warn("Supabase not configured — running file-only (no query log / asset metadata).");
  }
  return client;
}

export async function logQuery(role: string, question: string, answer: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("query_log").insert({ role, question, answer });
  if (error) console.error("query_log insert failed:", error.message);
}

export interface AssetRecord {
  type: string;
  product: string;
  audience: string;
  warRoomPath: string;
  guardOk: boolean;
  guardViolations: string[];
}

export async function recordAsset(a: AssetRecord): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("assets").insert({
    type: a.type,
    product: a.product,
    audience: a.audience,
    war_room_path: a.warRoomPath,
    guard_ok: a.guardOk,
    guard_violations: a.guardViolations,
  });
  if (error) console.error("assets insert failed:", error.message);
}

export async function markAssetApproved(warRoomPath: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb
    .from("assets")
    .update({ stage: "final", approved_at: new Date().toISOString() })
    .eq("war_room_path", warRoomPath);
  if (error) console.error("assets approve update failed:", error.message);
}

export async function dbStatus(): Promise<"disabled" | "connected" | "error"> {
  const sb = supabase();
  if (!sb) return "disabled";
  const { error } = await sb.from("products").select("id").limit(1);
  return error ? "error" : "connected";
}
