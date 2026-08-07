import Anthropic from "@anthropic-ai/sdk";
import { client, MODEL, systemCore } from "./claude";
import { supabase } from "./db";
import { chunksToContext, retrieveChunks } from "./ingestion";
import { loadCorpus } from "./warRoom";

// Agentic Ask Hive: instead of stuffing the whole war room into one call, the
// model gets tools and decides what evidence to gather — search the knowledge
// base, search war-room files, pull the live feature catalog, fetch scraped
// competitor sources, list finalized assets — then answers. Every tool call is
// recorded as a trace step the UI shows with the answer. Evidence discipline
// is unchanged: competitor claims only from scraped sources, no invention.

export interface TraceStep {
  tool: string;
  summary: string;
}

const MAX_ROUNDS = 6;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_knowledge_base",
    description:
      "Full-text search over the ingested knowledge base: PRDs, customer call transcripts, release notes, and uploaded documents. Returns the most relevant excerpts with document titles. Use for product facts, customer language, and proof points.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Search terms" } },
      required: ["query"],
    },
  },
  {
    name: "search_war_room",
    description:
      "Search the GTM war-room files: competitive notes, personas, win-loss, market intelligence, messaging playbooks, strategy. Returns matching file excerpts with their paths. Use for positioning, personas, and GTM guidance beyond the brand DNA you already have.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Search terms" } },
      required: ["query"],
    },
  },
  {
    name: "get_product_features",
    description:
      "The live feature catalog: shipped capabilities for an Aurigo product line, extracted from PRDs and release notes. Use when asked what a product does or what shipped recently.",
    input_schema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: 'One of "Masterworks", "Masterworks AI", "Primus"',
        },
      },
      required: ["product"],
    },
  },
  {
    name: "get_competitor_sources",
    description:
      "Freshly scraped website/review content for a named competitor (e.g. Kahua, Procore, e-Builder, Oracle Primavera). This is the ONLY permitted source for claims about a competitor — if this returns nothing, say the competitor is not confirmed in available sources.",
    input_schema: {
      type: "object",
      properties: { competitor: { type: "string", description: "Competitor name" } },
      required: ["competitor"],
    },
  },
  {
    name: "list_final_assets",
    description:
      "List finalized, approved assets in the content repository (battlecards, datasheets, decks, FAQs). Use when the asker wants existing collateral rather than a fresh answer.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Optional title filter" } },
    },
  },
];

interface ToolOutcome {
  output: string;
  summary: string;
}

async function execSearchKnowledgeBase(query: string): Promise<ToolOutcome> {
  const chunks = await retrieveChunks(query, 8);
  if (chunks.length === 0) {
    return {
      output: `No knowledge-base matches for "${query}".`,
      summary: `"${query}" → no matches`,
    };
  }
  return {
    output: chunksToContext(chunks).slice(0, 20_000),
    summary: `"${query}" → ${chunks.length} excerpt${chunks.length === 1 ? "" : "s"}`,
  };
}

function execSearchWarRoom(query: string): ToolOutcome {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  const scored = loadCorpus()
    .filter((d) => !d.relPath.startsWith("BRAND-DNA"))
    .map((d) => {
      const hay = `${d.relPath}\n${d.content}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        let idx = hay.indexOf(t);
        while (idx !== -1) {
          score += 1;
          idx = hay.indexOf(t, idx + t.length);
        }
      }
      return { doc: d, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (scored.length === 0) {
    return {
      output: `No war-room files match "${query}".`,
      summary: `"${query}" → no matching files`,
    };
  }
  return {
    output: scored
      .map((s) => `<file path="GTM-War-Room/${s.doc.relPath}">\n${s.doc.content.slice(0, 7000)}\n</file>`)
      .join("\n\n"),
    summary: `"${query}" → ${scored.map((s) => s.doc.relPath).join(", ")}`,
  };
}

async function execGetProductFeatures(product: string): Promise<ToolOutcome> {
  const sb = supabase();
  if (!sb) return { output: "Feature catalog unavailable.", summary: `${product} → unavailable` };
  const { data: prods } = await sb.from("products").select("id, name");
  const wanted = (prods ?? []).filter((p) =>
    product.trim().toLowerCase() === "masterworks"
      ? p.name.startsWith("Masterworks") && p.name !== "Masterworks AI"
      : p.name.toLowerCase().startsWith(product.trim().toLowerCase())
  );
  if (wanted.length === 0) {
    return {
      output: `No product matching "${product}". Known lines: Masterworks, Masterworks AI, Primus.`,
      summary: `${product} → unknown product`,
    };
  }
  const byId = new Map(wanted.map((p) => [p.id, p.name]));
  const { data: feats } = await sb
    .from("features")
    .select("product_id, name, description, category, release_date, status")
    .in("product_id", wanted.map((p) => p.id))
    .eq("status", "active")
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(60);
  if (!feats || feats.length === 0) {
    return {
      output: `The feature catalog has no shipped features on file for ${product}.`,
      summary: `${product} → 0 features`,
    };
  }
  return {
    output: feats
      .map(
        (f) =>
          `- [${byId.get(f.product_id)}] ${f.name}${f.category ? ` (${f.category})` : ""}: ${f.description ?? ""}`
      )
      .join("\n"),
    summary: `${product} → ${feats.length} features`,
  };
}

async function execGetCompetitorSources(competitor: string): Promise<ToolOutcome> {
  const sb = supabase();
  if (!sb) return { output: "Registry unavailable.", summary: `${competitor} → unavailable` };
  const { data: comps } = await sb.from("competitors").select("id, name, aliases");
  const lower = competitor.trim().toLowerCase();
  const match = (comps ?? []).find((c) =>
    [c.name, ...((c.aliases as string[] | null) ?? [])].some(
      (n) => n && (n.toLowerCase().includes(lower) || lower.includes(n.toLowerCase()))
    )
  );
  if (!match) {
    return {
      output: `"${competitor}" is not in the competitor registry. Known competitors can be added on the Competitive Intel page.`,
      summary: `${competitor} → not in registry`,
    };
  }
  const { data: srcs } = await sb
    .from("competitor_sources")
    .select("url, label, content_md, scraped_at")
    .eq("competitor_id", match.id)
    .eq("status", "ok")
    .limit(3);
  const usable = (srcs ?? []).filter((s) => s.content_md);
  if (usable.length === 0) {
    return {
      output: `${match.name} has no scraped sources yet — its claims cannot be verified. Say so rather than guessing; sources can be refreshed on the Competitive Intel page.`,
      summary: `${match.name} → no scraped sources`,
    };
  }
  return {
    output: usable
      .map(
        (s) =>
          `<competitor_source url="${s.url}" title="${s.label ?? ""}" scraped="${s.scraped_at ?? ""}">\n${(s.content_md ?? "").slice(0, 8000)}\n</competitor_source>`
      )
      .join("\n\n"),
    summary: `${match.name} → ${usable.length} scraped source${usable.length === 1 ? "" : "s"}`,
  };
}

async function execListFinalAssets(query?: string): Promise<ToolOutcome> {
  const sb = supabase();
  if (!sb) return { output: "Repository unavailable.", summary: "assets → unavailable" };
  let q = sb
    .from("artifacts")
    .select("title, asset_type, persona, updated_at, products(name)")
    .eq("status", "final")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (query && query.trim() !== "") q = q.ilike("title", `%${query.trim()}%`);
  const { data } = await q;
  if (!data || data.length === 0) {
    return {
      output: query
        ? `No finalized assets match "${query}".`
        : "No finalized assets in the repository yet.",
      summary: `assets${query ? ` "${query}"` : ""} → 0 found`,
    };
  }
  return {
    output: data
      .map((a) => {
        const product = (a as unknown as { products: { name: string } | null }).products?.name;
        return `- ${a.title} (${a.asset_type}${product ? `, ${product}` : ""}${a.persona ? `, for ${a.persona}` : ""})`;
      })
      .join("\n"),
    summary: `assets${query ? ` "${query}"` : ""} → ${data.length} found`,
  };
}

async function execTool(name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "search_knowledge_base":
        return await execSearchKnowledgeBase(String(input.query ?? ""));
      case "search_war_room":
        return execSearchWarRoom(String(input.query ?? ""));
      case "get_product_features":
        return await execGetProductFeatures(String(input.product ?? ""));
      case "get_competitor_sources":
        return await execGetCompetitorSources(String(input.competitor ?? ""));
      case "list_final_assets":
        return await execListFinalAssets(input.query === undefined ? undefined : String(input.query));
      default:
        return { output: `Unknown tool ${name}.`, summary: `${name} → unknown tool` };
    }
  } catch (err) {
    const msg = (err as Error).message;
    return { output: `Tool ${name} failed: ${msg}`, summary: `${name} → failed` };
  }
}

const TOOL_MODE_SYSTEM = [
  "",
  "=== TOOL MODE ===",
  "You have tools to gather evidence before answering: search the knowledge base, search the war-room files, pull the live feature catalog, fetch scraped competitor sources, and list finalized assets.",
  "Decide what you need, gather it (usually 1-4 tool calls), then answer. Do not answer questions about specifics before checking the relevant tool.",
  "Claims about a competitor may come ONLY from get_competitor_sources output — if it has nothing, say the claim is not confirmed in available sources.",
  "Your Sources line should list the war-room files, documents, and scraped sources you actually used.",
].join("\n");

export async function answerWithTools(
  userPrompt: string,
  opts: { model?: string } = {}
): Promise<{ answer: string; trace: TraceStep[] }> {
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: (await systemCore()) + TOOL_MODE_SYSTEM,
      cache_control: { type: "ephemeral" },
    },
  ];

  const trace: TraceStep[] = [];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.messages.create({
      model: opts.model ?? MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The model declined this request (safety refusal).");
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const answer = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      if (answer.trim() === "") throw new Error("The model returned an empty answer.");
      return { answer, trace };
    }

    // Preserve the full assistant turn (thinking blocks included) so the
    // conversation stays valid, then feed back every tool result.
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const outcome = await execTool(tu.name, (tu.input ?? {}) as Record<string, unknown>);
      trace.push({ tool: tu.name, summary: outcome.summary });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: outcome.output });
    }
    messages.push({ role: "user", content: results });
  }

  throw new Error(`Tool loop exceeded ${MAX_ROUNDS} rounds without a final answer.`);
}
