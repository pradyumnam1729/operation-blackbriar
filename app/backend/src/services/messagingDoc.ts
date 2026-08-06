import fs from "fs";
import path from "path";
import { supabase } from "./db";
import { ask } from "./claude";
import { markdownToHtml, htmlToText } from "./html";
import { checkForbiddenWords } from "./guardrails";
import { logActivity } from "./activity";
import { WAR_ROOM_DIR } from "./warRoom";
import { getLocalFolders, wrapExportHtml } from "./localFolders";
import {
  AnswerRow,
  QuestionRow,
  finishRun,
  loadQuestionBank,
} from "./questionnaire";
import {
  assertAgentEnabled,
  composeAgentPrompt,
  getAgentConfig,
  resolveModel,
} from "./agents";

// Messaging & Positioning document generation (blueprint §3.2). Generated Part
// by Part from PMM-approved questionnaire answers only — positioning (A) feeds
// messaging (B), and both feed personas, competition, and copy kits (C/D/E),
// so copy never generates straight from positioning (§3.2 of the constitution).
// Born draft; only PMM-admin approval (guard-gated) makes it final.

export interface GapItem {
  question_id: string;
  prompt: string;
  note: string;
}

export interface DocSection {
  id: string;
  title: string;
  markdown: string;
}

export interface DocMeta {
  productName: string;
  title: string;
  stage: "draft" | "final";
  sources: string[];
  date: string;
}

export interface MessagingDocRow {
  id: string;
  product_id: string;
  version: number;
  status: "draft" | "final" | "archived";
  title: string;
  sections: DocSection[];
  content_md: string;
  content_html: string;
  gaps: GapItem[];
  guard_violations: string[];
  war_room_path: string | null;
  exported_path: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

/** Service-level failure with the HTTP status the route should return. */
export class MessagingDocError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly violations: string[] = []
  ) {
    super(message);
  }
}

interface SectionRow {
  id: string;
  part: string;
  title: string;
  mode: string;
  ord: number;
}

// Sections filled deterministically — never sent to the model.
const DETERMINISTIC_SECTIONS = new Set(["B7", "F3", "F4", "F5"]);

// Reference placeholder, rendered verbatim while no customer proof is cleared
// for external use (no clearance mechanism exists yet, so this is always used).
const B7_PLACEHOLDER =
  "No customer proof points are cleared for use yet. This section will be populated once named references and quantified outcomes are approved for external use.";

const F3_CHECKLIST = [
  "Before any copy built from this document ships, confirm every line:",
  "",
  "- [ ] Opens from the reader's world, not from Aurigo or the product.",
  '- [ ] Survives the swap test: put a competitor\'s name in place of "Aurigo" — if the sentence still works, rewrite it around the approved unique attributes.',
  '- [ ] "AI-native" is the only AI modifier used; no other AI- compound appears.',
  '- [ ] "life cycle" is two words; "infrastructure" is never pluralized.',
  "- [ ] Program vs. portfolio is correct: government agencies run capital programs; facility owners run portfolios.",
  "- [ ] No ROI framing in public-sector copy — use program outcomes or capital program performance.",
  "- [ ] No terms from the avoid column of the Preferred Word List (F2).",
  "- [ ] Every number, name, and certification traces to a PMM-approved questionnaire answer.",
].join("\n");

const F4_OWNERSHIP = [
  "Owner: PMM admin — maintained in the PMM Agent app; regenerate from the Foundation Questionnaire, do not hand-edit exports.",
  "",
  "- Versions are tracked in the app; the war-room file always holds the latest final version.",
  "- Propose changes through the Foundation Questionnaire review queue — approved answers regenerate this document.",
].join("\n");

/** Per-section generation instructions (blueprint §3.2 table). The code map
 *  is the base; admin entries in the `messaging-doc-generation` agent's
 *  `defaults.section_instructions` override it per section id at run time. */
export const SECTION_INSTRUCTIONS: Record<string, string> = {
  A1: "Render the approved answers nearly verbatim under the reference sub-headings Why / How / What. Formatting only — do not add facts.",
  A2: "Render the approved answers nearly verbatim under the sub-headings Category, Why now, and Market context. Formatting only — do not add facts.",
  A3: "Render the approved answers nearly verbatim under the sub-headings Best fit, Segments, Who's in the room, Buying triggers, and Not a fit. Formatting only — do not add facts.",
  A4: "Render the approved answers nearly verbatim under the sub-headings Alternatives, What they can't copy, and Proof it's real. Formatting only — do not add facts.",
  A5: 'Two positioning statements from the A1–A4 answers: classic Geoffrey Moore ("For … who …, X is … that … Unlike …, X …") and April Dunford components (category / best-fit customers / alternatives / unique attributes / value & proof).',
  B1: "Hero umbrella message, positioning opener, three tagline tiers: one-liner of 10 words or fewer, short of about 25 words, long of about 50 words.",
  B2: "Exactly four value pillars as a table: pillar / what it means for the customer / proof — pillars derive from the C-persona pains and B5 outcomes.",
  B3: "Plain-language description + one-paragraph product description from the B3 answers.",
  B4: "Messaging matrix table: customer pain / capability / why-us advantage / benefit — one row per approved C-persona pain, mapped to B5 capabilities and A4 attributes.",
  B5: "Capability/agent catalog table from the B5 answers: item / group / what it does / outcome.",
  B6: 'Platform narrative from the B6 answers: what the platform makes possible, architecture layers, enterprise-trust bullets, and "why it\'s different" bullets. Certification wording verbatim from B6-Q3.',
  C1: "Per the value-prop schema: Measured on / Top pain (approved answers) / Value prop / 30-second elevator pitch / 3 discovery questions (synthesized).",
  C2: "Per the value-prop schema: Measured on / Top pain (approved answers) / Value prop / 30-second elevator pitch / 3 discovery questions (synthesized).",
  C3: "Per the value-prop schema: Measured on / Top pain (approved answers) / Value prop / 30-second elevator pitch / 3 discovery questions (synthesized).",
  C4: "Per the value-prop schema: Measured on / Top pain (approved answers) / Value prop / 30-second elevator pitch / 3 discovery questions (synthesized).",
  D1: "Stack-up table: rows = domain data, where it runs, governance, time to value; columns = us / bolt-on tools / legacy-DIY — from the A4 and D2 answers.",
  D2: 'Per-competitor table from the D2 answers: where they are today (with dates) / how we win. Close with "⚠ To confirm: competitor intelligence current as of source dates — verify before external use."',
  D3: "Head-to-head cards: they say / you counter / trap to set — one per alternative class.",
  D4: "Objection table from the D4-Q1 raw objections: objection (raw language) / counter grounded in the A4 and B6 facts.",
  E1: "Marketing kit: campaign themes, funnel-stage messages, social/PR angles, website copy blocks, and boilerplate — all pulled from B1/B2/A2.",
  E2: "Sales kit: opener, elevator pitch, 2 cold-email templates keyed to the A3-Q4 triggers, discovery script from the C discovery questions, MEDDIC-lite qualification, red flags from A3-Q5, and advance-the-deal steps.",
  E3: "Proposals/RFP kit: requirement-theme table (theme / response / proof), technical differentiators, security boilerplate from the B6-Q3 facts, and a 5-entry RFP FAQ.",
  F1: "Voice & tone bullets derived from the Brand DNA and Voice of Aurigo rules already in the system prompt — not from extraction.",
  F2: "Preferred word table (approved term / the rule it encodes) derived from the Brand DNA and Voice of Aurigo rules already in the system prompt — not from extraction. Never print a banned term verbatim anywhere: state the approved term and describe the rule instead, so the deterministic word guard stays clean.",
};

/** LOCKED contract suffix for `messaging-doc-generation`: the Produce-ONLY
 *  section list — splitSections parses exactly these headings, so it is
 *  code-owned and appended unconditionally by composeAgentPrompt. The
 *  overridable body lives in agentPrompts.ts (documented ordering delta,
 *  Agents blueprint §2.2-6: this block moved from mid-prompt to the tail). */
export function buildProduceSuffix(sectionLines: string): string {
  return `Produce ONLY these sections, in order, each starting with a heading "## {id} · {title}":
${sectionLines}`;
}

/** Split one Part's model output into per-section markdown by the "## {id} · {title}" headings. */
function splitSections(output: string, sections: { id: string; title: string }[]): Map<string, string> {
  const found: { id: string; index: number; headingLength: number }[] = [];
  for (const s of sections) {
    const match = new RegExp(`^##\\s*${s.id}\\b[^\\n]*$`, "m").exec(output);
    if (match) found.push({ id: s.id, index: match.index, headingLength: match[0].length });
  }
  found.sort((a, b) => a.index - b.index);
  const map = new Map<string, string>();
  for (let i = 0; i < found.length; i++) {
    const start = found[i].index + found[i].headingLength;
    const end = i + 1 < found.length ? found[i + 1].index : output.length;
    map.set(found[i].id, output.slice(start, end).trim());
  }
  return map;
}

/** F5 source: every gap or rejected question, plus every accepted answer that
 *  still carries an unresolved [Conflict: marker from the merge pass. */
export function buildGapList(answers: AnswerRow[], questions: QuestionRow[]): GapItem[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const order = new Map(questions.map((q, i) => [q.id, i]));
  const items: GapItem[] = [];
  for (const a of answers) {
    const q = byId.get(a.question_id);
    if (!q) continue;
    if (a.status === "gap") {
      items.push({
        question_id: a.question_id,
        prompt: q.prompt,
        note: "No evidence found in the ingested sources — add a transcript or document that covers this.",
      });
    } else if (a.status === "rejected") {
      items.push({
        question_id: a.question_id,
        prompt: q.prompt,
        note: a.feedback
          ? `Rejected in PMM review: ${a.feedback}`
          : "Rejected in PMM review — re-run extraction with better sources.",
      });
    } else if (a.status === "accepted" && (a.final_answer ?? "").includes("[Conflict:")) {
      items.push({
        question_id: a.question_id,
        prompt: q.prompt,
        note: "Accepted answer carries an unresolved [Conflict:] note — verify before external use.",
      });
    }
  }
  return items.sort(
    (a, b) => (order.get(a.question_id) ?? 0) - (order.get(b.question_id) ?? 0)
  );
}

function renderGapList(gaps: GapItem[]): string {
  if (gaps.length === 0) {
    return "No open inputs — every questionnaire item was confirmed in review.";
  }
  return gaps
    .map((g) => `- ⚠ To confirm — **${g.question_id}**: ${g.prompt}\n  ${g.note}`)
    .join("\n");
}

/** Frontmatter + '# {title}' + sections in fq_sections.ord order.
 *  The HTML render skips the frontmatter — markdown never crosses to the
 *  frontend, and YAML would otherwise render as stray text. */
export function assembleDoc(
  meta: DocMeta,
  sections: DocSection[]
): { md: string; html: string } {
  const frontmatter = [
    "---",
    `product: ${meta.productName}`,
    "audience: internal-gtm",
    "persona: all",
    `stage: ${meta.stage}`,
    "sources:",
    ...meta.sources.map((s) => `  - ${s}`),
    `date: ${meta.date}`,
    "---",
  ].join("\n");
  const body = [
    `# ${meta.title}`,
    ...sections.map((s) => `## ${s.id} · ${s.title}\n\n${s.markdown.trim()}`),
  ].join("\n\n");
  return { md: `${frontmatter}\n\n${body}\n`, html: markdownToHtml(body) };
}

// ---------- generation run ----------

/** Background generation run. Loads sections + accepted answers, generates Part
 *  by Part (6 model calls: A, B, C, D, E, F), assembles, guards, inserts a
 *  messaging_docs draft (version = max(version)+1), finishRun('done', docId). */
export async function runGeneration(
  productId: string,
  userId: string,
  runId: string
): Promise<void> {
  try {
    const sb = supabase();
    if (!sb) throw new Error("Database not configured");

    const { data: product } = await sb
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();
    if (!product) throw new Error("Product not found");
    const productName = (product as { name: string }).name;

    const { data: sectionData } = await sb
      .from("fq_sections")
      .select("id, part, title, mode, ord")
      .order("ord");
    const sections = (sectionData ?? []) as SectionRow[];
    if (sections.length === 0) throw new Error("fq_sections is empty — run the migration first.");

    const questions = await loadQuestionBank();
    const { data: answerData } = await sb
      .from("fq_answers")
      .select("*")
      .eq("product_id", productId);
    const answers = (answerData ?? []) as AnswerRow[];

    const questionById = new Map(questions.map((q) => [q.id, q]));
    const accepted = answers.filter((a) => a.status === "accepted" && a.final_answer);
    const answersJson = JSON.stringify(
      accepted.map((a) => ({
        question_id: a.question_id,
        section: questionById.get(a.question_id)?.section_id ?? "",
        prompt: questionById.get(a.question_id)?.prompt ?? "",
        final_answer: a.final_answer,
        sources: a.final_sources ?? [],
      })),
      null,
      2
    );
    const answersContext = `PMM-approved questionnaire answers (JSON):\n${answersJson}`;

    // Agent config, loaded once before the Part loop (§0.1-7). Disabled ->
    // AgentError; the outer catch records it via finishRun('failed', ...).
    const cfg = await getAgentConfig("messaging-doc-generation");
    assertAgentEnabled(cfg);
    const model = resolveModel(cfg);
    const sectionOverrides =
      cfg.defaults.section_instructions && typeof cfg.defaults.section_instructions === "object"
        ? (cfg.defaults.section_instructions as Record<string, string>)
        : {};
    const instructions: Record<string, string> = { ...SECTION_INSTRUCTIONS, ...sectionOverrides };

    // Part chain (§3.2): A first; A rides along for B; A+B for C, D, E.
    const generated = new Map<string, string>();
    let partA = "";
    let partB = "";
    for (const part of ["A", "B", "C", "D", "E", "F"]) {
      const partSections = sections.filter(
        (s) => s.part === part && !DETERMINISTIC_SECTIONS.has(s.id)
      );
      if (partSections.length === 0) continue;

      const sectionLines = partSections
        .map((s) => `- "## ${s.id} · ${s.title}": ${instructions[s.id] ?? "Synthesize from the approved answers."}`)
        .join("\n");
      let extraContext = answersContext;
      if (part === "B") {
        extraContext += `\n\n=== APPROVED PART A (POSITIONING) ===\n${partA}`;
      } else if (part === "C" || part === "D" || part === "E") {
        extraContext += `\n\n=== APPROVED PART A (POSITIONING) ===\n${partA}\n\n=== APPROVED PART B (MESSAGING) ===\n${partB}`;
      }

      const output = await ask(
        composeAgentPrompt(
          cfg,
          { part, product_name: productName },
          buildProduceSuffix(sectionLines)
        ),
        { extraContext, maxTokens: 16000, model }
      );
      const chunks = splitSections(output, partSections);
      for (const s of partSections) {
        generated.set(
          s.id,
          chunks.get(s.id) ??
            `⚠ To confirm: section ${s.id} was not generated — regenerate the document.`
        );
      }
      const partMd = partSections
        .map((s) => `## ${s.id} · ${s.title}\n\n${generated.get(s.id)}`)
        .join("\n\n");
      if (part === "A") partA = partMd;
      if (part === "B") partB = partMd;
    }

    // Deterministic sections — no model involvement (blueprint §3.2).
    generated.set("B7", B7_PLACEHOLDER);
    generated.set("F3", F3_CHECKLIST);
    generated.set("F4", F4_OWNERSHIP);
    const gaps = buildGapList(answers, questions);
    generated.set("F5", renderGapList(gaps));

    const docSections: DocSection[] = sections.map((s) => ({
      id: s.id,
      title: s.title,
      markdown: generated.get(s.id) ?? "",
    }));

    // Frontmatter sources: distinct source-doc titles across the final answers.
    const sourceTitles = new Set<string>();
    for (const a of accepted) {
      for (const s of a.final_sources ?? []) {
        if (s.title) sourceTitles.add(s.title);
      }
    }
    const meta: DocMeta = {
      productName,
      title: `${productName} — Positioning & Messaging`,
      stage: "draft",
      sources: [...sourceTitles].sort().concat("GTM-War-Room/BRAND-DNA/*"),
      date: new Date().toISOString().slice(0, 10),
    };
    const { md, html } = assembleDoc(meta, docSections);
    const guard = checkForbiddenWords(htmlToText(html));

    const { data: prev } = await sb
      .from("messaging_docs")
      .select("version")
      .eq("product_id", productId)
      .order("version", { ascending: false })
      .limit(1);
    const version = (((prev ?? [])[0] as { version: number } | undefined)?.version ?? 0) + 1;

    const { data: doc, error } = await sb
      .from("messaging_docs")
      .insert({
        product_id: productId,
        version,
        status: "draft",
        title: meta.title,
        sections: docSections,
        content_md: md,
        content_html: html,
        gaps,
        guard_violations: guard.violations,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !doc) throw new Error(error?.message ?? "messaging_docs insert failed");

    await finishRun(runId, "done", doc.id as string, { questionsAnswered: accepted.length });
    void logActivity("messaging_doc", doc.id as string, userId, "generated", {
      version,
      gaps: gaps.length,
      guard_ok: guard.ok,
    });
  } catch (err) {
    await finishRun(runId, "failed", (err as Error).message);
  }
}

// ---------- approval ----------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Writes content_md to GTM-War-Room/PLAYBOOKS-AND-ASSETS/messaging/<product-slug>-messaging-and-positioning.md
 *  (overwrite = latest final; history lives in messaging_docs). Returns the relative path. */
export function writeToWarRoom(doc: MessagingDocRow, productName: string): string {
  const rel = `PLAYBOOKS-AND-ASSETS/messaging/${slugify(productName)}-messaging-and-positioning.md`;
  const abs = path.resolve(WAR_ROOM_DIR, rel);
  if (!abs.startsWith(WAR_ROOM_DIR)) {
    throw new Error("Resolved war-room path escapes the war room"); // no traversal
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, doc.content_md, "utf-8");
  return rel;
}

/** Styled-HTML export to the configured local Output folder (same shell as
 *  exportFinals via wrapExportHtml). Returns the absolute path, or null when
 *  local folders are not configured. */
export async function exportDocHtml(
  doc: MessagingDocRow,
  productName: string
): Promise<string | null> {
  const row = await getLocalFolders();
  if (!row || !row.config.outputPath) return null;
  fs.mkdirSync(row.config.outputPath, { recursive: true });
  const footer = `${productName} · messaging & positioning · v${doc.version} · exported ${new Date().toISOString().slice(0, 10)} · Hive by Aurigo`;
  const file = path.join(
    row.config.outputPath,
    `${slugify(productName)}-messaging-and-positioning-v${doc.version}.html`
  );
  fs.writeFileSync(file, wrapExportHtml(doc.title, doc.content_html, footer), "utf-8");
  return file;
}

/** Approval (admin route only): guard re-check → archive previous final →
 *  status 'final' → writeToWarRoom → exportDocHtml → logActivity. */
export async function approveMessagingDoc(
  docId: string,
  userId: string
): Promise<{ warRoomPath: string; exportedPath: string | null; warning?: string }> {
  const sb = supabase();
  if (!sb) throw new MessagingDocError("Database not configured", 503);

  const { data } = await sb.from("messaging_docs").select("*").eq("id", docId).maybeSingle();
  if (!data) throw new MessagingDocError("Messaging doc not found", 404);
  const doc = data as MessagingDocRow;
  if (doc.status !== "draft") {
    throw new MessagingDocError(
      `Only draft documents can be approved (current status: '${doc.status}').`,
      409
    );
  }

  // Deterministic voice guard before anything goes final (mirrors artifacts.ts).
  const guard = checkForbiddenWords(htmlToText(doc.content_html));
  if (!guard.ok) {
    throw new MessagingDocError(
      `Cannot approve — banned words found: ${guard.violations.join(", ")}`,
      422,
      guard.violations
    );
  }

  const { data: product } = await sb
    .from("products")
    .select("name")
    .eq("id", doc.product_id)
    .single();
  const productName = (product as { name: string } | null)?.name ?? "Aurigo";

  // Archive any previous final version — one final per product at a time.
  await sb
    .from("messaging_docs")
    .update({ status: "archived" })
    .eq("product_id", doc.product_id)
    .eq("status", "final")
    .neq("id", doc.id);

  const contentMd = doc.content_md.replace(/^stage: draft$/m, "stage: final");
  const finalDoc: MessagingDocRow = { ...doc, content_md: contentMd };
  const warRoomPath = writeToWarRoom(finalDoc, productName);
  const exportedPath = await exportDocHtml(finalDoc, productName);

  const { error } = await sb
    .from("messaging_docs")
    .update({
      status: "final",
      approved_by: userId,
      approved_at: new Date().toISOString(),
      war_room_path: warRoomPath,
      exported_path: exportedPath,
      content_md: contentMd,
    })
    .eq("id", doc.id);
  if (error) throw new MessagingDocError(error.message, 500);

  void logActivity("messaging_doc", doc.id, userId, "approved", {
    version: doc.version,
    war_room_path: warRoomPath,
    exported: exportedPath !== null,
  });

  return {
    warRoomPath,
    exportedPath,
    ...(exportedPath === null
      ? {
          warning:
            "Local folders are not configured — the styled HTML export was skipped. Configure the Output folder under Integrations.",
        }
      : {}),
  };
}
