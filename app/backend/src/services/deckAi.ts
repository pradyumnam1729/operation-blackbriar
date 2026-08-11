import { ask } from "./claude";
import { DeckDoc, extractDeckJson } from "./deck";

// Model-touching half of Deck Studio (blueprint deck-studio.md §3.4).
// Every function: strict-JSON instruction, schema inlined, 7-step arc summary,
// ONE automatic repair round; still invalid → DeckAiParseError (422, nothing
// saved by the caller).

export class DeckAiParseError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super("The AI reply could not be parsed into valid slides.");
    this.issues = issues;
  }
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

const SCHEMA_BLOCK = [
  "DeckDoc JSON schema (all text fields are PLAIN TEXT — no markdown, no HTML):",
  '{"schema": 1, "theme": "aurigo-2026", "slides": [{',
  '  "id": "s1",                              // stable, unique ("s1","s2",…)',
  '  "layout": "title" | "agenda" | "section" | "content-bullets" | "two-column" | "quote" | "closing",',
  '  "title": "≤200 chars, required",',
  '  "subtitle": "≤300, only on title/section/closing",',
  '  "body": ["≤20 items, each ≤500 chars — only on agenda/content-bullets"],',
  '  "columns": [{"heading": "≤120", "items": ["≤10 × ≤300"]}, {…}],   // exactly 2, only on two-column',
  '  "quote": {"text": "≤600", "attribution": "≤200"},                 // only on quote',
  '  "notes": "speaker notes ≤2000, optional — these ship inside the .pptx file"',
  "}]}  // 1-40 slides",
].join("\n");

const ARC_BLOCK = [
  "The 7-step narrative arc (Aurigo playbook Vol 2 ch. 03) for a full deck:",
  "opener (title) → 1 the old way → 2 what changed → 3 the tension → 4 cost of inaction → 5 why alternatives aren't enough (two-column maturity model — ceilings, never trash-talk) → 6 what success looks like → 7 proof (quote) → closing (next step).",
  "Open from the buyer's world, not from Aurigo.",
].join("\n");

async function askForDeck(prompt: string, maxTokens: number): Promise<{ raw: string; deck: DeckDoc }> {
  const first = await ask(prompt, { maxTokens });
  let result = extractDeckJson(first);
  if ("deck" in result) return { raw: first, deck: result.deck };

  // One repair round with the concrete issues, then give up cleanly.
  const repair = await ask(
    `${prompt}\n\nYour previous reply was invalid: ${result.issues.join("; ")}. Return corrected JSON only — no commentary.`,
    { maxTokens }
  );
  result = extractDeckJson(repair);
  if ("deck" in result) return { raw: repair, deck: result.deck };
  throw new DeckAiParseError(result.issues);
}

/** Studio deck generation: 7-10 slides on the arc, grounded in war-room context. */
export async function generateDeckSlides(opts: {
  title: string;
  assetPrompt: string;
  productContext: string;
  extraBrief?: string;
}): Promise<DeckDoc> {
  const prompt = [
    `Generate a sales deck titled "${opts.title}" as structured slides.`,
    "Return ONLY a JSON object matching this schema — no markdown fences, no commentary:",
    SCHEMA_BLOCK,
    ARC_BLOCK,
    "Produce 7-10 slides covering the arc (agenda optional for 9+). Every claim must trace to the provided context — never invent customer names, quotes, or numbers; write 'Needs PMM input: …' instead.",
    "Speaker notes: 1-3 sentences per slide telling the presenter what to say.",
    `=== GENERATION BRIEF ===\n${opts.assetPrompt}`,
    opts.extraBrief ? `=== EXTRA BRIEF ===\n${opts.extraBrief}` : "",
    opts.productContext !== "" ? `=== PRODUCT / WAR-ROOM CONTEXT ===\n${opts.productContext}` : "",
  ]
    .filter((s) => s !== "")
    .join("\n\n");
  return (await askForDeck(prompt, 8000)).deck;
}

/** Conversational edit: full deck in, full deck + one-line summary out. */
export async function chatEditSlides(
  deck: DeckDoc,
  message: string,
  scope: string,
  history: ChatTurn[]
): Promise<{ deck: DeckDoc; summary: string }> {
  const scopeLine =
    scope !== "all"
      ? `Scope: change ONLY slide "${scope}". Return the FULL deck with every other slide byte-identical, all ids preserved.`
      : "Scope: the whole deck. Preserve the ids of slides you do not change.";
  const historyBlock =
    history.length > 0
      ? `Recent conversation (context only):\n${history
          .slice(-6)
          .map((t) => `${t.role === "user" ? "User" : "You"}: ${t.text}`)
          .join("\n")}`
      : "";
  const prompt = [
    "You are editing a slide deck. Apply the user's instruction and return ONLY a JSON object:",
    '{"summary": "≤120 chars, imperative past tense (e.g. Tightened the proof slide to two quantified points)", "deck": <DeckDoc>}',
    SCHEMA_BLOCK,
    scopeLine,
    "Never invent customer names, quotes, or numbers that are not already in the deck.",
    historyBlock,
    `=== CURRENT DECK ===\n${JSON.stringify(deck)}`,
    `=== USER INSTRUCTION ===\n${message}`,
  ]
    .filter((s) => s !== "")
    .join("\n\n");

  const first = await ask(prompt, { maxTokens: 8000 });
  const parsed = parseChatReply(first);
  if (parsed) return parsed;

  const repair = await ask(
    `${prompt}\n\nYour previous reply was invalid JSON or an invalid deck. Return the {"summary", "deck"} JSON object only.`,
    { maxTokens: 8000 }
  );
  const reparsed = parseChatReply(repair);
  if (reparsed) return reparsed;
  throw new DeckAiParseError(["chat reply did not contain a valid {summary, deck} object"]);
}

function parseChatReply(raw: string): { deck: DeckDoc; summary: string } | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let outer: Record<string, unknown>;
  try {
    outer = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const result = extractDeckJson(JSON.stringify(outer.deck ?? outer));
  if (!("deck" in result)) return null;
  const summary =
    typeof outer.summary === "string" && outer.summary.trim() !== ""
      ? outer.summary.trim().slice(0, 120)
      : "AI edit";
  return { deck: result.deck, summary };
}

/** Legacy conversion: HTML document → arc-shaped DeckDoc, inventing nothing. */
export async function htmlToSlides(
  contentHtml: string,
  title: string
): Promise<{ deck: DeckDoc; summary: string }> {
  const prompt = [
    `Convert this HTML document into a structured slide deck titled "${title}".`,
    "Return ONLY a JSON object matching this schema — no markdown fences, no commentary:",
    SCHEMA_BLOCK,
    ARC_BLOCK,
    "Preserve every load-bearing claim from the document. Invent NOTHING: where an arc step has no source material, add a slide bullet 'Needs PMM input: <what is missing>' instead of fabricating.",
    `=== DOCUMENT HTML ===\n${contentHtml.slice(0, 60_000)}`,
  ].join("\n\n");
  const { deck } = await askForDeck(prompt, 8000);
  return {
    deck,
    summary: `Converted the document into ${deck.slides.length} structured slides`,
  };
}
