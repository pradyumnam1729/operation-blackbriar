// The standard Positioning & Messaging question set (per hive 1.html).
// Single source of truth: served to the wizard, used by the renderer and the
// markdown export. Answer shape: { [code]: { [fieldKey]: string | string[][] } }
// except kind 'group' steps, whose answers are arrays of { [fieldKey]: string }.

export interface PmmField {
  key: string;
  label: string;
  type: "text" | "textarea" | "rows";
  placeholder?: string;
  columns?: string[]; // rows type
  minRows?: number; // rows type
}

export interface PmmStep {
  part: "A" | "B" | "C" | "D" | "E";
  code: string;
  title: string;
  help: string;
  kind: "fields" | "group";
  fields?: PmmField[];
  groupFields?: PmmField[];
}

export const PMM_PART_NAMES: Record<string, string> = {
  A: "Foundation",
  B: "Messaging",
  C: "Personas",
  D: "Battlecards",
  E: "Activation kits",
};

export const PMM_STEPS: PmmStep[] = [
  {
    part: "A", code: "A1", title: "The why (Golden Circle)",
    help: "Why do you exist, beyond making money? What deserves this product a right to exist?",
    kind: "fields",
    fields: [
      { key: "why", label: "Why", type: "textarea", placeholder: "Public infrastructure shapes every community..." },
      { key: "how", label: "How", type: "textarea", placeholder: "By building on..." },
      { key: "what", label: "What", type: "textarea", placeholder: "The product, in one sentence." },
    ],
  },
  {
    part: "A", code: "A2", title: "Market & category",
    help: "What category do you own, and why does it matter now?",
    kind: "fields",
    fields: [
      { key: "category", label: "Market category", type: "text", placeholder: "AI for capital program management" },
      { key: "whynow", label: "Why now", type: "textarea", placeholder: "What changed in the market that makes this urgent?" },
      { key: "context", label: "Market context & stats", type: "textarea", placeholder: "Any market-size figures or benchmarks — flag sources to confirm." },
    ],
  },
  {
    part: "A", code: "A3", title: "Best-fit customer & ICP",
    help: "Who is this for, and who is it explicitly not for?",
    kind: "fields",
    fields: [
      { key: "bestfit", label: "Best-fit description", type: "textarea" },
      { key: "room", label: "Who's in the room / buying triggers", type: "textarea" },
      { key: "notfit", label: "Not a fit — walk-away signals", type: "textarea" },
    ],
  },
  {
    part: "A", code: "A4", title: "Competitive alternatives & right to win",
    help: "What do buyers do instead of choosing you, and why do you win anyway?",
    kind: "fields",
    fields: [
      { key: "alternatives", label: "What buyers do instead", type: "textarea" },
      { key: "cantcopy", label: "Three things competitors can't copy", type: "textarea" },
      { key: "proof", label: "Proof it's real", type: "textarea" },
    ],
  },
  {
    part: "A", code: "A5", title: "Positioning statement",
    help: "The classic positioning statement, plus what makes it unique.",
    kind: "fields",
    fields: [
      { key: "statement", label: "Classic positioning statement", type: "textarea", placeholder: "For [best-fit customer] who [need], [product] is [category] that [outcome]. Unlike [alternatives], we [differentiator]." },
      { key: "unique", label: "Unique attributes", type: "textarea" },
      { key: "value", label: "Value & proof", type: "textarea" },
    ],
  },
  {
    part: "B", code: "B1", title: "Umbrella message & taglines",
    help: "The one message every other message rolls up to.",
    kind: "fields",
    fields: [
      { key: "hero", label: "Hero / umbrella message", type: "text", placeholder: "Turn capital program insights into action — faster." },
      { key: "oneliner", label: "One-liner tagline (≤10 words)", type: "text" },
      { key: "short", label: "Short tagline (~25 words)", type: "textarea" },
    ],
  },
  {
    part: "B", code: "B2", title: "Top value pillars",
    help: "The 3–4 ways this delivers value — customer needs, not features.",
    kind: "fields",
    fields: [
      { key: "pillars", label: "Value pillars", type: "rows", columns: ["Pillar", "What it means for the customer", "Proof"], minRows: 3 },
    ],
  },
  {
    part: "B", code: "B3", title: "What it does",
    help: "Plain language — what would you tell someone who has never heard of this product?",
    kind: "fields",
    fields: [
      { key: "plain", label: "Plain-language description", type: "textarea" },
      { key: "paragraph", label: "One-paragraph product description", type: "textarea" },
    ],
  },
  {
    part: "B", code: "B4", title: "Messaging matrix",
    help: "Map each customer pain to the capability that solves it.",
    kind: "fields",
    fields: [
      { key: "matrix", label: "Messaging matrix", type: "rows", columns: ["Customer pain", "Capability", "Why us", "Benefit"], minRows: 3 },
    ],
  },
  {
    part: "B", code: "B5", title: "Key capabilities & agent catalog",
    help: "The building blocks of the value story.",
    kind: "fields",
    fields: [
      { key: "agents", label: "Capabilities / agents", type: "rows", columns: ["Capability", "Group", "What it does", "Outcome"], minRows: 3 },
    ],
  },
  {
    part: "B", code: "B6", title: "The AI story & platform",
    help: "How the underlying platform makes the value story credible.",
    kind: "fields",
    fields: [
      { key: "possible", label: "What the platform makes possible", type: "textarea" },
      { key: "trust", label: "Built for enterprise trust", type: "textarea" },
    ],
  },
  {
    part: "B", code: "B7", title: "Proof points & testimonials",
    help: "Named customers, quantified outcomes, quotes cleared for use.",
    kind: "fields",
    fields: [{ key: "proofpoints", label: "Proof points / testimonials", type: "textarea" }],
  },
  {
    part: "C", code: "C", title: "Persona value props",
    help: "One card per buyer or user in the room.",
    kind: "group",
    groupFields: [
      { key: "name", label: "Persona name", type: "text", placeholder: "Capital Program / PMO Director" },
      { key: "pain", label: "Top pain", type: "textarea" },
      { key: "value", label: "Value prop", type: "textarea" },
      { key: "pitch", label: "Elevator pitch (30 sec)", type: "textarea" },
    ],
  },
  {
    part: "D", code: "D1", title: "How we stack up",
    help: "A side-by-side against the alternatives.",
    kind: "fields",
    fields: [
      { key: "stackup", label: "Comparison", type: "rows", columns: ["Dimension", "Us", "Bolt-on AI", "Legacy / DIY"], minRows: 3 },
    ],
  },
  {
    part: "D", code: "D2", title: "Where the competition is on AI",
    help: "Named competitors and how you win against each.",
    kind: "fields",
    fields: [
      { key: "competitors", label: "Competitor breakdown", type: "rows", columns: ["Competitor", "Where they are today", "How we win"], minRows: 2 },
    ],
  },
  {
    part: "D", code: "D3", title: "Head-to-head battlecards",
    help: "What they say, how you counter.",
    kind: "fields",
    fields: [
      { key: "battlecards", label: "Battlecards", type: "rows", columns: ["Scenario", "They say", "You counter"], minRows: 2 },
    ],
  },
  {
    part: "D", code: "D4", title: "Objection handling",
    help: "The pushbacks that stall deals, and how to turn each one.",
    kind: "fields",
    fields: [
      { key: "objections", label: "Objections", type: "rows", columns: ["Objection", "Counter"], minRows: 3 },
    ],
  },
  {
    part: "E", code: "E1", title: "Marketing kit",
    help: "Campaign themes and funnel messaging.",
    kind: "fields",
    fields: [
      { key: "themes", label: "Campaign themes", type: "textarea" },
      { key: "funnel", label: "Messaging by funnel stage", type: "rows", columns: ["Stage", "Lead message", "Assets / CTA"], minRows: 3 },
    ],
  },
  {
    part: "E", code: "E2", title: "Sales kit",
    help: "What reps say, and how they open.",
    kind: "fields",
    fields: [
      { key: "pitch", label: "Company elevator pitch", type: "textarea" },
      { key: "email", label: "Cold email — trigger & subject", type: "textarea" },
      { key: "discovery", label: "Discovery script", type: "textarea" },
    ],
  },
  {
    part: "E", code: "E3", title: "Proposals / RFP kit",
    help: "Reusable answers for RFPs and security questionnaires.",
    kind: "fields",
    fields: [
      { key: "rfp", label: "RFP requirement mapping", type: "rows", columns: ["Requirement theme", "Response", "Proof"], minRows: 3 },
    ],
  },
];

type RowsAnswer = string[][];
type FieldsAnswer = Record<string, string | RowsAnswer>;
type GroupAnswer = Record<string, string>[];
export type PmmAnswers = Record<string, FieldsAnswer | GroupAnswer>;

/** Render a document's answers to markdown (mirrors the wireframe's Copy-as-Markdown). */
export function pmmToMarkdown(
  title: string,
  product: string,
  statusLabel: string,
  answers: PmmAnswers
): string {
  let md = `# ${title}\n\n*${product} · ${statusLabel}*\n\n`;
  for (const s of PMM_STEPS) {
    md += `## ${s.part} · ${s.title}\n\n`;
    if (s.kind === "group") {
      const items = ((answers[s.code] as GroupAnswer) ?? []).filter((it) =>
        Object.values(it).some((v) => v && v.trim() !== "")
      );
      if (items.length === 0) {
        md += "_Not yet provided._\n\n";
      } else {
        for (const it of items) {
          md += `**${it.name || "Persona"}**\n\n`;
          for (const f of s.groupFields ?? []) {
            if (f.key !== "name" && it[f.key]) md += `- ${f.label}: ${it[f.key]}\n`;
          }
          md += "\n";
        }
      }
      continue;
    }
    const fa = (answers[s.code] as FieldsAnswer) ?? {};
    let any = false;
    for (const f of s.fields ?? []) {
      const v = fa[f.key];
      if (f.type === "rows") {
        const rows = ((v as RowsAnswer) ?? []).filter((r) => r.some((c) => c && c.trim() !== ""));
        if (rows.length > 0) {
          any = true;
          md += `| ${f.columns!.join(" | ")} |\n| ${f.columns!.map(() => "---").join(" | ")} |\n`;
          for (const r of rows) md += `| ${r.map((c) => (c || "").replace(/\n/g, " ")).join(" | ")} |\n`;
          md += "\n";
        }
      } else if (typeof v === "string" && v.trim() !== "") {
        any = true;
        md += `**${f.label}:** ${v}\n\n`;
      }
    }
    if (!any) md += "_Not yet provided._\n\n";
  }
  return md;
}

/** How many steps have at least one filled field (drives the progress bar). */
export function pmmProgress(answers: PmmAnswers): { answered: number; total: number } {
  let answered = 0;
  for (const s of PMM_STEPS) {
    if (s.kind === "group") {
      const items = (answers[s.code] as GroupAnswer) ?? [];
      if (items.some((it) => Object.values(it).some((v) => v && v.trim() !== ""))) answered++;
      continue;
    }
    const fa = (answers[s.code] as FieldsAnswer) ?? {};
    const filled = (s.fields ?? []).some((f) => {
      const v = fa[f.key];
      if (f.type === "rows") return ((v as RowsAnswer) ?? []).some((r) => r.some((c) => c && c.trim() !== ""));
      return typeof v === "string" && v.trim() !== "";
    });
    if (filled) answered++;
  }
  return { answered, total: PMM_STEPS.length };
}
