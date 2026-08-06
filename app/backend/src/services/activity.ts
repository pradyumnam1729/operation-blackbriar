import { supabase } from "./db";

/** Append-only activity feed entry. Fire-and-forget from routes. */
export async function logActivity(
  entityType: string,
  entityId: string,
  actorId: string | null,
  action: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("activity_log").insert({
    entity_type: entityType,
    entity_id: entityId,
    actor_id: actorId,
    action,
    detail,
  });
  if (error) console.error("activity_log insert failed:", error.message);
}

/**
 * In-app notification + (stubbed) email. Real sending waits for the SMTP key
 * and the email_send feature flag; until then emails are logged, not sent.
 */
export async function notify(
  userId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("notifications").insert({ user_id: userId, type, payload });
  if (error) {
    console.error("notification insert failed:", error.message);
    return;
  }
  const { data: flag } = await sb.from("feature_flags").select("enabled").eq("key", "email_send").single();
  if (flag?.enabled) {
    // SMTP integration lands here once the key is configured.
    console.log(`[email] would send '${type}' to user ${userId}`);
  } else {
    console.log(`[email stub] '${type}' for user ${userId} (email_send flag off)`);
  }
}

export async function flagEnabled(key: string): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { data } = await sb.from("feature_flags").select("enabled").eq("key", key).single();
  return data?.enabled ?? false;
}
