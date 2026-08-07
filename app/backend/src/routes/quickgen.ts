import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { ask } from "../services/claude";
import { markdownToHtml } from "../services/html";
import { chunksToContext, retrieveChunks } from "../services/ingestion";

// Home-dashboard quick generation (hive 2): every persona card generates a
// ready asset against a picked product + industry (+ content type for
// marketing). Grounded in the knowledge base + war-room brand DNA (injected
// by systemCore); the model must never invent proof points.
export const quickGenRouter = Router();

quickGenRouter.use(requireAuth);

const PRODUCTS = ["Masterworks", "Masterworks AI", "Primus"];
const INDUSTRIES = [
  "Data centers",
  "Energy and utilities",
  "Federal",
  "Life sciences",
  "Local government",
  "Manufacturing",
  "State and large government",
];
const CONTENT_TYPES = [
  "Video script",
  "Email campaign",
  "Social media",
  "LinkedIn AD",
  "Webpage copy",
  "Event banner",
];

interface ActionBrief {
  tag: string;
  brief: string;
  useFeatures?: boolean;
}

const ACTIONS: Record<string, ActionBrief> = {
  "Elevator pitch": {
    tag: "Draft",
    brief:
      "Write a 30-second cold-call opener for this product and industry, then 3 discovery questions. Open from the buyer's world, not from Aurigo. Sections: '30-second opener' (one tight paragraph) and 'Discovery questions' (bulleted).",
  },
  "Competitive intel": {
    tag: "Battlecard",
    brief:
      "Write a compact battlecard for this product in this industry against the competitor the knowledge base most often positions it against. Sections: 'Strengths' (theirs, honest), 'Weaknesses' (theirs), 'Landmines' (questions the rep should plant), 'Talk track' (2-3 sentences). Base competitor claims only on the knowledge base; where evidence is thin, say so plainly.",
  },
  "Value proposition": {
    tag: "Value prop",
    brief:
      "Write the value proposition for this product in this industry: the buyer problem in the buyer's words, the value statement, 3 differentiators, and the proof points that support each. Sections: 'The problem', 'Value statement', 'Differentiators & proof'.",
  },
  "Enablement assets": {
    tag: "Enablement",
    brief:
      "Recommend the enablement content a rep should use for this product and industry: which stories, proof points, and asset angles fit, and what each one proves. Bulleted list with one line of 'use it when' guidance per item. Only reference material actually present in the knowledge base.",
  },
  "Customer proof points": {
    tag: "Proof points",
    brief:
      "List real customer proof points (quotes, named outcomes, metrics) from the knowledge base matched to this industry, each with what it proves and where to use it. If the knowledge base has no validated proof point for this industry, say exactly that and suggest the nearest adjacent evidence — never invent a quote or number.",
  },
  "LinkedIn content kit": {
    tag: "LinkedIn kit",
    brief:
      "Write 2 ready-to-post LinkedIn posts for this product and industry plus a short posting guide (cadence, tagging rules). Posts open from the reader's world and end with one engaging question.",
  },
  "Content creation studio": {
    tag: "Draft",
    brief:
      "Create the requested content type for this product and industry, ready to review. Match the format's conventions exactly (a video script gets timed beats with Visual/Voiceover/On-screen; an email campaign gets subject lines and body; social media gets 3 variations; an ad gets headline/body pairs; webpage copy gets hero + sections; an event banner gets headline + subline options).",
  },
  "Campaign brief generator": {
    tag: "Brief",
    brief:
      "Write a campaign brief for this product and industry. Sections: 'Lead message' (one sentence), 'Target persona', 'Channel mix' (bulleted), 'CTA'. Keep it one page and specific to the industry's buying context.",
  },
  "SEO/AEO content brief builder": {
    tag: "Content brief",
    brief:
      "Write an AEO-first content brief for this product and industry. Sections: 'Question-format H1', 'Direct answer opening' (the first fifty words, definition named plainly), 'Structured facts to include' (bulleted, citable), 'Comparison table guidance'. Citable structure first, promotional framing last.",
  },
  "Launch asset kit": {
    tag: "Launch bundle",
    brief:
      "Generate the launch bundle for this product's most recent shipped capability (from the feature list below): 'Website copy block' (two sentences: feature, outcome, audience), 'Social post' (LinkedIn-sized), 'PR angle' (positioned as proof of doing more with the same people, not a feature announcement), 'Email' (subject line + single CTA).",
    useFeatures: true,
  },
  "Keynote talk-track builder": {
    tag: "Talk track",
    brief:
      "Build 8-10 keynote talking points for this product and industry, drawn from recently shipped capabilities (feature list below) and one proof point from the knowledge base. Each point is one sentence a speaker can deliver verbatim. End with a closing line.",
    useFeatures: true,
  },
  "Thought-leadership draft generator": {
    tag: "Byline outline",
    brief:
      "Outline a byline / LinkedIn thought-leadership piece for this product and industry: working title, the argument in three moves, the customer evidence to cite (only from the knowledge base), and a closing provocation. Executive voice, no product pitch until the final third.",
  },
  "Quarterly exec summary": {
    tag: "Exec summary",
    brief:
      "Write a one-page executive rollup for this product and industry in board language: market position, what shipped (feature list below), competitive posture, and program outcomes evidence from the knowledge base. Where data is not on file, state the gap rather than estimating.",
    useFeatures: true,
  },
  "Analyst/press briefing brief": {
    tag: "Briefing",
    brief:
      "Prepare an analyst/press pre-call brief for this product and industry: shipped capabilities (feature list below), competitive positioning in two sentences, and 2-3 proof points cleared for external use from the knowledge base (mark any that still need clearance).",
    useFeatures: true,
  },
};

/** Recent features for the picked product line, for launch/keynote/exec cards. */
async function featureContext(product: string): Promise<string> {
  const sb = supabase();
  if (!sb) return "";
  const { data: prods } = await sb.from("products").select("id, name");
  const wanted = (prods ?? []).filter((p) =>
    product === "Masterworks"
      ? p.name.startsWith("Masterworks") && p.name !== "Masterworks AI"
      : p.name.startsWith(product)
  );
  if (wanted.length === 0) return "";
  const { data: feats } = await sb
    .from("features")
    .select("name, description, category, release_date, status, product_id")
    .in("product_id", wanted.map((p) => p.id))
    .eq("status", "active")
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(40);
  if (!feats || feats.length === 0) return "";
  const byId = new Map(wanted.map((p) => [p.id, p.name]));
  return feats
    .map(
      (f) =>
        `- [${byId.get(f.product_id) ?? product}] ${f.name}${f.category ? ` (${f.category})` : ""}: ${f.description ?? ""}`
    )
    .join("\n");
}

quickGenRouter.post("/", async (req, res) => {
  const { action, product, industry, contentType } = (req.body ?? {}) as {
    action?: string;
    product?: string;
    industry?: string;
    contentType?: string;
  };

  const spec = action ? ACTIONS[action] : undefined;
  if (!spec) return res.status(400).json({ error: "Unknown quick-generate action" });
  if (!product || !PRODUCTS.includes(product))
    return res.status(400).json({ error: "Pick a product" });
  if (!industry || !INDUSTRIES.includes(industry))
    return res.status(400).json({ error: "Pick an industry" });
  if (contentType && !CONTENT_TYPES.includes(contentType))
    return res.status(400).json({ error: "Unknown content type" });

  try {
    const [chunks, features] = await Promise.all([
      retrieveChunks(
        `${product} ${industry} ${action} ${contentType ?? ""} positioning value proposition proof points customers`,
        10
      ),
      spec.useFeatures ? featureContext(product) : Promise.resolve(""),
    ]);

    const prompt = [
      `Quick asset generation for a GTM teammate. Product: Aurigo ${product}. Industry: ${industry}.${contentType ? ` Content type: ${contentType}.` : ""}`,
      spec.brief,
      "Output rules:",
      "- Respond in clean markdown with the section headings named in the brief. No preamble, no closing meta-commentary — the response IS the asset.",
      "- Do NOT include a frontmatter/metadata block (no product/audience/sources header) — this is quick-copy output, not a war-room file.",
      "- Ground every claim in the knowledge base below and the brand context you already carry. Never invent customer names, quotes, or metrics: if a proof point is not on file, write that it is not on file.",
      "- This is a draft for human review before any external use.",
      features !== "" ? `=== SHIPPED FEATURES (from the Feature catalog) ===\n${features}` : "",
      chunks.length > 0
        ? `=== AURIGO KNOWLEDGE BASE (ground truth) ===\n${chunksToContext(chunks)}`
        : "=== AURIGO KNOWLEDGE BASE ===\n(no matching chunks — rely on brand context only and keep claims general)",
    ]
      .filter((s) => s !== "")
      .join("\n\n");

    let md = await ask(prompt, { maxTokens: 3500 });
    // Defensive: drop a leading frontmatter block if the model still adds one.
    md = md.replace(/^\s*---[\s\S]*?---\s*/, "");
    res.json({
      tag: spec.tag,
      html: markdownToHtml(md),
      evidence: chunks.map((c) => ({ title: c.title, docType: c.doc_type })),
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
