import Anthropic from "@anthropic-ai/sdk";
import { loadBrandDna } from "./warRoom";

const client = new Anthropic();

const MODEL = process.env.PMM_MODEL ?? "claude-opus-4-8";

// Stable system core — everything here must stay byte-identical across requests
// so it caches as a prompt prefix. Volatile, per-request content goes in the
// user message, never here.
function systemCore(): string {
  return [
    "You are the PMM Agent for Aurigo — a product marketing knowledge engine.",
    "You answer ONLY from the GTM War Room content provided below. If the war room cannot support an answer, say exactly what is missing and which intelligence input would fill the gap. Never guess and never invent customer quotes, numbers, or competitor claims.",
    "",
    "Non-negotiable voice rules (Voice of Aurigo):",
    "- Open from the reader's world, not from Aurigo or the product.",
    '- "AI-native" is the only approved AI modifier. Never "AI-powered", "AI-driven", or "AI-enabled".',
    '- "life cycle" is two words. "infrastructure" is never pluralized.',
    "- Government agencies run capital programs (Masterworks/Essentials); facility owners run portfolios (Primus). Never swap program/portfolio.",
    '- Never use "ROI" in public-sector framing — use "program outcomes" or "capital program performance".',
    '- Never precede an organization abbreviation with "the" (write "FHWA requires", not "the FHWA requires").',
    '- Banned: hassle-free, effortlessly, seamless, circle back, "single source of truth" (use "unified system"), best-in-class, cutting-edge, world-class.',
    "- Direct, active voice, confident. No hedging (may/could/might/potentially). Precise outcomes, not vague benefit words.",
    "",
    "Every claim you make must trace to a war-room file. End every answer with a 'Sources:' line listing the war-room file paths you used.",
    "",
    "=== GTM WAR ROOM: BRAND DNA ===",
    loadBrandDna(),
  ].join("\n");
}

export interface AskOptions {
  /** Extra war-room context beyond brand DNA, e.g. competitive dossiers. */
  extraContext?: string;
  maxTokens?: number;
}

export async function ask(userPrompt: string, opts: AskOptions = {}): Promise<string> {
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: systemCore(),
      cache_control: { type: "ephemeral" },
    },
  ];

  const content = opts.extraContext
    ? `=== ADDITIONAL WAR ROOM CONTEXT ===\n${opts.extraContext}\n\n=== TASK ===\n${userPrompt}`
    : userPrompt;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request (safety refusal).");
  }

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
