import { supabase } from "./db";
import { ask } from "./claude";
import { parseModelJson } from "./questionnaire";
import {
  RouterCandidate,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";

// Ask-to-artifact routing layer (blueprint §4). classifyAsk is a pre-gate on
// the ask flow whose non-negotiable contract is: THE ANSWER FLOW IS NEVER
// BLOCKED BY THE ROUTER. Every failure mode — disabled agent, unconfigured DB,
// empty catalog, model error, parse failure, low confidence, invalid proposal —
// returns {intent:"question"} so the request degrades to today's exact
// behavior (decision §0.1-4: bypass, not block; assertAgentEnabled is
// deliberately NOT called here). The model proposes, code verifies (§0.1-5):
// only template ids from the freshly-loaded candidate set and product ids from
// the products table ever reach the response — the model's raw strings never
// reach generateFromTemplate.

export type { RouterCandidate } from "./agents";

/** §3.1 proposal shape — every field code-validated, never raw model output. */
export interface RoutingProposal {
  confidence: number;
  asset_type: string;
  template: RouterCandidate;
  template_fallback_used: boolean;
  product: { id: string; name: string };
  suggested_title: string;
  brief: string;
  reason: string;
}

export type ClassifyResult =
  | { intent: "question" } // includes every degraded/skipped case
  | { intent: "artifact"; proposal: RoutingProposal };

const CANDIDATE_CAP = 60; // token bound (§4.1)
const BRIEF_MAX_CHARS = 500;
const REASON_MAX_CHARS = 200;
const DEFAULT_MIN_CONFIDENCE = 0.6;
const AMBIGUITY_DEFAULT_PRODUCT = "Masterworks AI"; // approved requirement (§0.1-5)

/** LOCKED contract suffix for `ask-router` (§1.2): template catalog (runtime
 *  data — never config), the request, and the JSON contract parseModelJson
 *  consumes. Appended unconditionally by composeAgentPrompt — an override can
 *  never remove it. Exported for routes/agents.ts (suffix preview + test run),
 *  same pattern as buildSlotFillSuffix. */
export function buildRouterSuffix(
  candidates: RouterCandidate[],
  question: string,
  role: string
): string {
  return `Template catalog - generation-ready, approved templates. These are the ONLY valid
template_id values:
${JSON.stringify(candidates)}

Request from the ${role} team:
${question}

Return ONLY valid JSON - no markdown fences, no commentary - matching exactly:
{"intent": "question" | "artifact", "confidence": 0.0-1.0, "asset_type": "...", "template_id": "...", "product_name": "...", "brief": "...", "reason": "..."}
When intent is "question", include only intent, confidence, and reason.`;
}

/** Candidate set = templates that can actually generate: approved AND body is
 *  not null (mirrors generation_ready in routes/templates.ts). Deterministic
 *  order (asset_type, then name) — the type-fallback in the validation ladder
 *  depends on it. Errors degrade to [] (→ question upstream). */
export async function loadRouterCandidates(): Promise<RouterCandidate[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("templates")
    .select("id, name, asset_type, product_line, audience, persona, funnel_stage")
    .eq("approved", true)
    .not("body", "is", null)
    .order("asset_type", { ascending: true })
    .order("name", { ascending: true })
    .limit(CANDIDATE_CAP);
  if (error || !data) {
    if (error) console.warn(`ask-router: candidate load failed — ${error.message}`);
    return [];
  }
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    asset_type: String(r.asset_type),
    product_line: typeof r.product_line === "string" ? r.product_line : null,
    audience: typeof r.audience === "string" ? r.audience : null,
    persona: typeof r.persona === "string" ? r.persona : null,
    funnel_stage: typeof r.funnel_stage === "string" ? r.funnel_stage : null,
  }));
}

/** Pure decision on raw model output — parse, intent, confidence threshold,
 *  and the template validation ladder (§4.2 steps 4–6, 8). Exported for unit
 *  tests; classifyAsk adds the config/model/product I/O around it. */
export type RouteDecision =
  | { intent: "question"; cause: string | null }
  | {
      intent: "artifact";
      confidence: number;
      template: RouterCandidate;
      template_fallback_used: boolean;
      product_name: string | null;
      brief: string;
      reason: string;
    };

export function decideRoute(
  raw: string,
  candidates: RouterCandidate[],
  minConfidence: number
): RouteDecision {
  let parsed: Record<string, unknown>;
  try {
    parsed = parseModelJson<Record<string, unknown>>(raw);
  } catch (err) {
    return { intent: "question", cause: `parse failure: ${(err as Error).message}` };
  }

  // §4.2-4: anything that is not an explicit artifact classification is a question.
  if (parsed.intent !== "artifact") return { intent: "question", cause: null };

  // §4.2-5: non-numeric/missing confidence or below threshold → question.
  const confidence = parsed.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return { intent: "question", cause: "non-numeric confidence" };
  }
  if (confidence < minConfidence) {
    return { intent: "question", cause: `confidence ${confidence} below threshold ${minConfidence}` };
  }

  // §4.2-6: the template validation ladder. (a) exact candidate id — use the
  // candidate's OWN asset_type, ignoring the model's if they disagree;
  // (b) asset-type fallback to the first candidate of that type in the
  // deterministic order; (c) neither → question.
  let template: RouterCandidate | undefined;
  let fallback = false;
  if (typeof parsed.template_id === "string") {
    template = candidates.find((c) => c.id === parsed.template_id);
  }
  if (!template) {
    const assetType = typeof parsed.asset_type === "string" ? parsed.asset_type.trim().toLowerCase() : "";
    if (assetType !== "") {
      template = candidates.find((c) => c.asset_type.toLowerCase() === assetType);
      fallback = template !== undefined;
    }
  }
  if (!template) {
    return { intent: "question", cause: "no catalog match for proposed template_id or asset_type" };
  }

  // §4.2-8: assemble validated, capped strings.
  return {
    intent: "artifact",
    confidence,
    template,
    template_fallback_used: fallback,
    product_name:
      typeof parsed.product_name === "string" && parsed.product_name.trim() !== ""
        ? parsed.product_name.trim()
        : null,
    brief: String(parsed.brief ?? "").trim().slice(0, BRIEF_MAX_CHARS),
    reason: String(parsed.reason ?? "").trim().slice(0, REASON_MAX_CHARS),
  };
}

/** §4.2-7: case-insensitive exact match against products.name; no match or
 *  absent → the Masterworks AI row; even that missing → null (→ question —
 *  never a proposal with a dangling product). */
async function resolveProduct(productName: string | null): Promise<{ id: string; name: string } | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.from("products").select("id, name");
  if (error || !data) return null;
  const rows = (data as { id: string; name: string }[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
  }));
  const wanted = productName?.toLowerCase();
  const match = wanted ? rows.find((r) => r.name.toLowerCase() === wanted) : undefined;
  return (
    match ?? rows.find((r) => r.name.toLowerCase() === AMBIGUITY_DEFAULT_PRODUCT.toLowerCase()) ?? null
  );
}

/** THE entry point. NEVER throws; every failure returns {intent:"question"}
 *  (decision §0.1-4) with a console.warn naming the cause. */
export async function classifyAsk(question: string, role: string): Promise<ClassifyResult> {
  try {
    // 1. Config. AgentError / DB-unconfigured → question. Disabled → question
    //    (bypass, NOT assertAgentEnabled — no 409, no user-visible difference).
    let cfg;
    try {
      cfg = await getAgentConfig("ask-router");
    } catch (err) {
      console.warn(`ask-router: config unavailable — answering as question (${(err as Error).message})`);
      return { intent: "question" };
    }
    if (cfg.enabled === false) return { intent: "question" };

    // 2. Candidates. Empty catalog = nothing to route to → question (no model call).
    const candidates = await loadRouterCandidates();
    if (candidates.length === 0) return { intent: "question" };

    // 3. One small call on the configured (haiku-default) model. ask() is
    //    reused so the cached brand-DNA system prefix rides along — it helps
    //    product inference ("DOT prospect" → Masterworks line). No corpus.
    const prompt = composeAgentPrompt(cfg, {}, buildRouterSuffix(candidates, question, role));
    let raw: string;
    try {
      raw = await ask(prompt, { maxTokens: 500, model: resolveModel(cfg) });
    } catch (err) {
      console.warn(`ask-router: model call failed — answering as question (${(err as Error).message})`);
      return { intent: "question" };
    }

    // 4–6, 8. Parse + threshold + validation ladder (pure).
    const minRaw = Number(cfg.defaults.min_confidence ?? DEFAULT_MIN_CONFIDENCE);
    const min = Number.isFinite(minRaw) ? Math.min(1, Math.max(0, minRaw)) : DEFAULT_MIN_CONFIDENCE;
    const decision = decideRoute(raw, candidates, min);
    if (decision.intent === "question") {
      if (decision.cause) console.warn(`ask-router: degraded to question — ${decision.cause}`);
      return { intent: "question" };
    }

    // 7. Product resolution against the products table.
    const product = await resolveProduct(decision.product_name);
    if (!product) {
      console.warn("ask-router: no resolvable product row (Masterworks AI missing?) — answering as question");
      return { intent: "question" };
    }

    return {
      intent: "artifact",
      proposal: {
        confidence: decision.confidence,
        asset_type: decision.template.asset_type,
        template: decision.template,
        template_fallback_used: decision.template_fallback_used,
        product,
        suggested_title: `${product.name} — ${decision.template.name}`,
        brief: decision.brief,
        reason: decision.reason,
      },
    };
  } catch (err) {
    console.warn(`ask-router: unexpected failure — answering as question (${(err as Error).message})`);
    return { intent: "question" };
  }
}
