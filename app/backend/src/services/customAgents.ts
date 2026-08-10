import { supabase } from "./db";

// Custom connected agents: teams register any HTTP endpoint as an agent.
// Contract (kept deliberately minimal so anything — a LangChain service, an
// Agent SDK app, an n8n flow, a bare Lambda — can implement it):
//
//   POST <endpoint_url>
//   Authorization: Bearer <auth_token>        (only if a token is configured)
//   { "input": string, "context": string|null, "source": "hive", "agent_key": string }
//
//   → 200 with { "output": string }           (or a bare text body)
//
// Anything else (non-2xx, timeout, malformed) surfaces as a clear error —
// never silently swallowed.

export interface CustomAgentRow {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  endpoint_url: string | null;
  auth_token: string | null;
  timeout_ms: number;
  owner_team: string | null;
  updated_at: string;
}

export const CUSTOM_AGENT_COLS =
  "id, key, name, description, enabled, endpoint_url, auth_token, timeout_ms, owner_team, updated_at";

export async function listCustomAgents(): Promise<CustomAgentRow[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data } = await sb
    .from("agents")
    .select(CUSTOM_AGENT_COLS)
    .eq("kind", "custom")
    .order("created_at", { ascending: true });
  return (data ?? []) as CustomAgentRow[];
}

export interface InvokeResult {
  output: string;
  latencyMs: number;
}

export async function invokeCustomAgent(
  agent: CustomAgentRow,
  input: string,
  context: string | null = null
): Promise<InvokeResult> {
  if (!agent.endpoint_url) {
    throw new Error(`Custom agent "${agent.name}" has no endpoint URL configured.`);
  }
  if (!agent.enabled) {
    throw new Error(`Custom agent "${agent.name}" is disabled in the Agents tab.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), agent.timeout_ms || 20000);
  const started = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (agent.auth_token) headers.Authorization = `Bearer ${agent.auth_token}`;
    const resp = await fetch(agent.endpoint_url, {
      method: "POST",
      headers,
      body: JSON.stringify({ input, context, source: "hive", agent_key: agent.key }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(
        `Agent endpoint returned ${resp.status}: ${text.slice(0, 300) || "(empty body)"}`
      );
    }
    // Accept {output} JSON or a bare text body.
    let output = text;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.output === "string") output = parsed.output;
      else if (typeof parsed.answer === "string") output = parsed.answer;
      else if (typeof parsed.result === "string") output = parsed.result;
    } catch {
      /* bare text is fine */
    }
    if (output.trim() === "") throw new Error("Agent endpoint returned an empty response.");
    return { output: output.slice(0, 30_000), latencyMs };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(
        `Custom agent "${agent.name}" timed out after ${agent.timeout_ms || 20000}ms.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
