import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { ask } from "../services/claude";
import { markdownToHtml } from "../services/html";
import { chunksToContext, retrieveChunks } from "../services/ingestion";
import { contentFrameworks } from "../services/guardrailFiles";

// Home-dashboard quick generation (hive 2): every persona card generates a
// ready asset against a picked product + industry (+ content type for
// marketing). Grounded in the knowledge base + war-room brand DNA (injected
// by systemCore); the model must never invent proof points.
export const quickGenRouter = Router();

quickGenRouter.use(requireAuth);

const PRODUCTS = ["Masterworks", "Masterworks AI", "Primus"];

const GENERIC_VERTICAL = "Generic / All Verticals";

// Each product owns its own vertical list — mirrors the frontend picker in
// Home.tsx. Deliberately not one shared list: Masterworks and Primus sell
// into different markets.
const INDUSTRIES_BY_PRODUCT: Record<string, string[]> = {
  Masterworks: [
    GENERIC_VERTICAL,
    "Transportation (DOT/Transit/Airports)",
    "Water & Utilities",
    "Healthcare & Higher Education",
    "State & Local Government",
    "Federal Agencies",
  ],
  "Masterworks AI": [GENERIC_VERTICAL],
  Primus: [
    GENERIC_VERTICAL,
    "Data Centers",
    "Energy & Utilities",
    "Manufacturing",
    "Life Sciences",
    "Private Sector",
  ],
};

const CONTENT_TYPES = [
  "Video script",
  "Email campaign",
  "Social media",
  "LinkedIn AD",
  "Webpage copy",
  "Event banner",
];

// Competitor picker — only ever used by the "Competitive intel" action.
// Products with no list here (Masterworks AI) fall back to the model
// picking the competitor from the knowledge base, as before.
const COMPETITORS_BY_PRODUCT: Record<string, string[]> = {
  Masterworks: ["Kahua", "e-Builder", "Oracle", "Procore"],
  Primus: ["Procore", "Oracle Primavera", "Kahua", "Copperleaf", "Ecosys"],
};

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
  "Feature catalog": {
    tag: "Feature catalog",
    brief:
      "List every recently shipped feature for this product (from the feature list below), grouped by category, each with a one-line description straight from the release notes. This is a catalog, not a narrative — bulleted list only, no marketing framing. If there are no shipped features on file for this product, say so plainly.",
    useFeatures: true,
  },
};

// Maps quick-generate actions to "Content frameworks" guardrail sections
// (admin-managed answer frameworks, editable in the Guardrails tab). Content
// creation studio matches by its picked content type instead.
const FRAMEWORK_BY_ACTION: Record<string, string> = {
  "Elevator pitch": "Elevator pitch",
  "Value proposition": "Value prop",
  "LinkedIn content kit": "LinkedIn post",
  "Keynote talk-track builder": "Keynote session",
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
  const { action, product, industry, contentType, competitor } = (req.body ?? {}) as {
    action?: string;
    product?: string;
    industry?: string;
    contentType?: string;
    competitor?: string;
  };

  const spec = action ? ACTIONS[action] : undefined;
  if (!spec) return res.status(400).json({ error: "Unknown quick-generate action" });
  if (!product || !PRODUCTS.includes(product))
    return res.status(400).json({ error: "Pick a product" });
  if (!industry || !(INDUSTRIES_BY_PRODUCT[product] ?? []).includes(industry))
    return res.status(400).json({ error: "Pick an industry vertical" });
  if (contentType && !CONTENT_TYPES.includes(contentType))
    return res.status(400).json({ error: "Unknown content type" });

  // Competitor is only meaningful for "Competitive intel", and only for
  // products with a defined list — Masterworks AI has none, so it keeps the
  // old behavior of letting the model pick from the knowledge base.
  const competitorList = COMPETITORS_BY_PRODUCT[product] ?? [];
  if (action === "Competitive intel" && competitorList.length > 0) {
    if (!competitor || !competitorList.includes(competitor))
      return res.status(400).json({ error: "Pick a competitor" });
  } else if (competitor && !competitorList.includes(competitor)) {
    return res.status(400).json({ error: "Unknown competitor" });
  }

  const isGeneric = industry === GENERIC_VERTICAL;
  const industryPhrase = isGeneric ? "" : ` ${industry}`;
  const brief =
    action === "Competitive intel" && competitor
      ? spec.brief.replace(
          "against the competitor the knowledge base most often positions it against",
          `against ${competitor} specifically`
        )
      : spec.brief;

  try {
    const [chunks, features, frameworks] = await Promise.all([
      retrieveChunks(
        `${product}${industryPhrase} ${action} ${competitor ?? ""} ${contentType ?? ""} positioning value proposition proof points customers`,
        10
      ),
      spec.useFeatures ? featureContext(product) : Promise.resolve(""),
      contentFrameworks(),
    ]);

    // Admin-approved framework for this action (Guardrails tab, "Content
    // frameworks" file) overrides the built-in brief: same grounding, but the
    // structure, sequence, and length rules come from the framework.
    const framework = frameworks[FRAMEWORK_BY_ACTION[action ?? ""] ?? contentType ?? ""] ?? null;
    const effectiveBrief = framework
      ? [
          "Follow the admin-approved content framework below EXACTLY — its structure, narrative sequence, length limits, and rules override the default brief. Where it names the 'Positioning & Messaging document' as the source of truth, use the AURIGO KNOWLEDGE BASE excerpts below plus the brand context as that source. Resolve <Persona>, <Executive Name / Role>, and <Keynote Theme> placeholders sensibly for this product and industry from the knowledge base.",
          framework
            .replace(/<Product Name>/g, `Aurigo ${product}`)
            .replace(/<Industry Vertical>/g, isGeneric ? "public infrastructure" : industry),
        ].join("\n\n")
      : brief;

    const prompt = [
      `Quick asset generation for a GTM teammate. Product: Aurigo ${product}.${
        isGeneric
          ? " Not industry-specific — write for a general buyer across Aurigo's core verticals."
          : ` Industry: ${industry}.`
      }${contentType ? ` Content type: ${contentType}.` : ""}`,
      effectiveBrief,
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
