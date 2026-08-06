import Anthropic from "@anthropic-ai/sdk";
import chokidar, { FSWatcher } from "chokidar";
import fs from "fs";
import path from "path";
import { supabase } from "./db";
import { extractText } from "./extract";
import { htmlToText } from "./html";
import { ingestDocument } from "./ingestion";

// Local Input/Output folder pair. Input: drop files in, they are ingested
// (release notes -> catalog review queue; anything else -> context docs
// pending approval). Output: finalized artifacts are exported here as
// standalone, styled HTML files.

export interface LocalFoldersConfig {
  inputPath: string;
  outputPath: string;
  docType: string; // release_note | prd | jtbd | transcript | other
  productLine?: string | null;
  processed?: Record<string, number>; // filename -> mtimeMs already ingested
  lastScan?: string;
  lastScanResult?: string;
  lastIngest?: string; // last scan that actually ingested/skipped files
  lastIngestResult?: string;
  lastExport?: string;
  lastExportResult?: string;
}

const SUPPORTED = [".pdf", ".docx", ".txt", ".md", ".vtt", ".srt", ".csv"];

/**
 * Per-file document-type detection from the filename. The folder's docType is
 * only the default — a PRD dropped into a release-notes folder must still
 * classify as a PRD. Returns null when the filename carries no type signal so
 * the caller can fall through to content classification.
 */
export function detectDocType(filename: string): string | null {
  const name = filename.toLowerCase();
  const ext = path.extname(name);
  if (ext === ".vtt" || ext === ".srt") return "transcript";
  if (/\bprd\b|product[-_ ]requirements/.test(name)) return "prd";
  if (/\bjtbd\b|jobs[-_ ]to[-_ ]be[-_ ]done/.test(name)) return "jtbd";
  if (/transcript|meeting[-_ ]recording/.test(name)) return "transcript";
  if (/battlecard/.test(name)) return "battlecard";
  if (/release[-_ ]?notes?|changelog|what[-_ ]?s[-_ ]?new/.test(name)) return "release_note";
  return null;
}

const DOC_TYPES = ["release_note", "prd", "jtbd", "transcript", "battlecard", "other"];

/** Unambiguous per-file product match: every word of the product name appears
 *  in the filename (e.g. "masterworks-maintain-…"). Null otherwise — a shared
 *  context doc is visible to every product's questionnaire. */
export function matchProductByFilename<T extends { name: string }>(
  filename: string,
  products: T[]
): T | null {
  const name = filename.toLowerCase();
  return (
    products.find((p) =>
      p.name
        .toLowerCase()
        .split(/\s+/)
        .every((w) => name.includes(w))
    ) ?? null
  );
}

export interface ContentClassification {
  docType: string | null;
  productName: string | null;
}

/**
 * Content-based classification for type and product. Type matters when the
 * filename carries no signal (e.g. "Asset condition management_ product
 * walkthrough and feedback.docx" is a call transcript, not a release note);
 * product matters so questionnaire evidence is scoped to the product it is
 * actually about. Cheap Haiku call over the first few thousand characters;
 * nulls on any failure so the caller's defaults apply.
 */
export async function classifyContent(
  text: string,
  productNames: string[]
): Promise<ContentClassification> {
  const none: ContentClassification = { docType: null, productName: null };
  if (!process.env.ANTHROPIC_API_KEY) return none;
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: [
        "Classify the document excerpt. Return ONLY a JSON object, no fences, no commentary:",
        '{"doc_type":"<label>","product":"<name or shared>"}',
        "",
        "doc_type is exactly one of: release_note, prd, jtbd, transcript, battlecard, other.",
        "transcript = a transcription of a call, meeting, demo, or walkthrough (speaker turns, dialogue, timestamps, conversational filler).",
        "release_note = product release/version notes listing shipped changes.",
        "prd = product requirements document. jtbd = jobs-to-be-done research.",
        "battlecard = competitive sales battlecard. Anything else = other.",
        "",
        `product is the ONE product this document is about, chosen from exactly this list: ${productNames.join(", ")}.`,
        'If the document spans several products, matches none of them, or you are not confident, use "shared".',
      ].join("\n"),
      messages: [{ role: "user", content: text.slice(0, 6000) }],
    });
    const raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return none;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      doc_type?: unknown;
      product?: unknown;
    };
    const docType =
      typeof parsed.doc_type === "string" && DOC_TYPES.includes(parsed.doc_type.toLowerCase())
        ? parsed.doc_type.toLowerCase()
        : null;
    const productName =
      typeof parsed.product === "string"
        ? productNames.find((n) => n.toLowerCase() === (parsed.product as string).toLowerCase()) ??
          null
        : null;
    return { docType, productName };
  } catch (err) {
    console.error("[local-folders] content classification failed:", (err as Error).message);
    return none;
  }
}

export async function getLocalFolders(): Promise<{
  id: string;
  enabled: boolean;
  config: LocalFoldersConfig;
} | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb
    .from("integrations")
    .select("id, enabled, config")
    .eq("kind", "local_folders")
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, enabled: data.enabled, config: data.config as LocalFoldersConfig };
}

export async function saveLocalFolders(
  cfg: Pick<LocalFoldersConfig, "inputPath" | "outputPath" | "docType" | "productLine">
): Promise<void> {
  const sb = supabase()!;
  // Create the folders so the connection is usable immediately.
  fs.mkdirSync(cfg.inputPath, { recursive: true });
  fs.mkdirSync(cfg.outputPath, { recursive: true });
  const existing = await getLocalFolders();
  const config: LocalFoldersConfig = {
    ...(existing?.config ?? {}),
    ...cfg,
  };
  if (existing) {
    await sb.from("integrations").update({ config, enabled: true }).eq("id", existing.id);
  } else {
    await sb.from("integrations").insert({
      kind: "local_folders",
      name: "Local folders (Input / Output)",
      enabled: true,
      config,
    });
  }
  await restartInputWatcher();
}

async function ingestOne(filePath: string, cfg: LocalFoldersConfig): Promise<string> {
  const sb = supabase()!;
  const filename = path.basename(filePath);
  const { status, text } = await extractText(filePath);
  if (status !== "done" || text.trim() === "") return `skipped ${filename} (${status})`;

  const { data: products } = await sb.from("products").select("id, name, line");

  // Classify per file — type AND product. Filename first, then content, then
  // the folder defaults. A doc scoped to the wrong product would feed another
  // product's questionnaire, so an unconfident product match stays null (shared).
  let docType = detectDocType(filename);
  let product = matchProductByFilename(filename, products ?? []);
  if (!docType || !product) {
    const cls = await classifyContent(text, (products ?? []).map((p) => p.name));
    docType = docType ?? cls.docType;
    product =
      product ?? products?.find((p) => p.name === cls.productName) ?? null;
  }
  docType = docType ?? cfg.docType;
  const lineDefault =
    products?.find(
      (p) => cfg.productLine && p.line.toLowerCase() === cfg.productLine!.toLowerCase()
    ) ?? null;

  // Chunk into the knowledge base first (dedupe happens here). Admin-configured
  // source, so documents are AI-enabled immediately.
  const ingest = await ingestDocument({
    title: filename,
    filename,
    text,
    source: "local_folder",
    docType,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    aiEnabled: true,
  });
  if (ingest.deduped) {
    return `duplicate skipped: ${filename} matches existing document "${ingest.duplicateOf}"`;
  }

  if (docType === "release_note") {
    const releaseProduct = product ?? lineDefault ?? products?.[0];
    if (!releaseProduct) return `no product match for ${filename}`;
    const { data: rn } = await sb
      .from("release_notes")
      .insert({
        product_id: releaseProduct.id,
        filename,
        source_path: filePath,
        raw_text: text,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    await sb.from("feature_reviews").insert({
      release_note_id: rn?.id,
      product_id: releaseProduct.id,
      proposed: {
        note: "Release note from Input folder — run Process in the Feature Catalog to extract features.",
        filename,
        snippet: text.slice(0, 1500),
      },
      change_type: "added",
      confidence: 0.1,
      status: "pending",
    });
    return `release note ingested: ${filename} (${ingest.chunkCount} chunks)`;
  }

  // The Foundation Questionnaire extracts from context_docs, not the chunked
  // knowledge base — mirror non-release-note docs there or the questionnaire
  // reports "no sources" even though retrieval can see the file.
  await sb.from("context_docs").delete().eq("title", filename).eq("source", "folder_watch");
  await sb.from("context_docs").insert({
    title: filename,
    source: "folder_watch",
    doc_type: docType,
    product_id: product?.id ?? null,
    content: text.slice(0, 200_000),
    approved: false,
  });

  return `${docType} ingested: ${filename} (${ingest.chunkCount} chunks, AI-enabled)`;
}

/** Scan the Input folder now; only files that are new or changed since the last scan are ingested. */
export async function scanInput(): Promise<string[]> {
  const row = await getLocalFolders();
  if (!row) throw new Error("Local folders are not configured yet.");
  const cfg = row.config;
  if (!fs.existsSync(cfg.inputPath)) {
    throw new Error(`Input folder does not exist: ${cfg.inputPath}`);
  }
  const sb = supabase()!;
  const processed = cfg.processed ?? {};
  const log: string[] = [];
  const files = fs
    .readdirSync(cfg.inputPath, { withFileTypes: true })
    .filter((d) => d.isFile() && SUPPORTED.includes(path.extname(d.name).toLowerCase()));

  for (const f of files) {
    const abs = path.join(cfg.inputPath, f.name);
    const mtime = fs.statSync(abs).mtimeMs;
    if (processed[f.name] === mtime) continue; // unchanged since last ingest
    try {
      const result = await ingestOne(abs, cfg);
      log.push(result);
      // Failed extractions stay unmarked so the next scan retries them
      // (e.g. a file caught mid-copy); unsupported formats are recorded.
      if (!result.includes("(failed)")) processed[f.name] = mtime;
    } catch (err) {
      log.push(`failed ${f.name}: ${(err as Error).message}`);
    }
  }
  // Keep the last real ingest visible — an empty follow-up scan must not
  // erase "prd ingested: ..." from the admin UI.
  if (log.length > 0) {
    cfg.lastIngest = new Date().toISOString();
    cfg.lastIngestResult = log.join("; ");
  }
  if (log.length === 0) log.push("no new or changed files in the Input folder");

  cfg.processed = processed;
  cfg.lastScan = new Date().toISOString();
  cfg.lastScanResult = log[log.length - 1];
  await sb.from("integrations").update({ config: cfg }).eq("id", row.id);
  return log;
}

/** Standalone styled-HTML shell shared by every Output-folder export
 *  (final artifacts here; messaging docs in messagingDoc.ts). */
export function wrapExportHtml(title: string, bodyHtml: string, footer: string): string {
  return [
    "<!doctype html>",
    `<html lang="en"><head><meta charset="utf-8"><title>${title}</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<style>body{font-family:Roboto,Arial,sans-serif;color:#20282B;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.65}h1{color:#053445}h2{color:#015F74}a{color:#015F74}table{border-collapse:collapse;width:100%}th,td{border:1px solid #E1E6E9;padding:8px 10px;text-align:left}th{background:#F5F7F8}blockquote{border-left:3px solid #46B2BE;margin:12px 0;padding:6px 16px;background:#F2FAFB}footer{margin-top:40px;font-size:12px;color:#8D979A;border-top:1px solid #E1E6E9;padding-top:12px}</style>",
    "</head><body>",
    bodyHtml,
    `<footer>${footer}</footer>`,
    "</body></html>",
  ].join("\n");
}

/** Raw-render export extension by format (blueprint §5): finals generated from a
 *  template export their self-contained payload, not the wrapped digest. */
const RENDER_EXPORT_EXT: Record<string, string> = {
  html: ".html",
  svg: ".svg",
  deck: "-deck.html",
  email: ".html",
  markdown: ".md",
};

/** Export every final artifact to the Output folder as a standalone styled HTML file. */
export async function exportFinals(): Promise<string[]> {
  const row = await getLocalFolders();
  if (!row) throw new Error("Local folders are not configured yet.");
  const cfg = row.config;
  fs.mkdirSync(cfg.outputPath, { recursive: true });
  const sb = supabase()!;

  const { data: finals } = await sb
    .from("artifacts")
    .select("id, title, asset_type, current_version, updated_at, products(name)")
    .eq("status", "final");

  const log: string[] = [];
  for (const a of finals ?? []) {
    const slug = a.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    // Template-generated finals: export the raw render payload with the right
    // extension; everything else keeps the styled wrapExportHtml shell.
    const { data: render } = await sb
      .from("artifact_renders")
      .select("format, payload")
      .eq("artifact_id", a.id)
      .eq("version", a.current_version)
      .maybeSingle();
    if (render) {
      const ext = RENDER_EXPORT_EXT[render.format] ?? ".html";
      const file = path.join(cfg.outputPath, `${slug || a.id}${ext}`);
      fs.writeFileSync(file, render.payload, "utf-8");
      log.push(`exported ${path.basename(file)} (${render.format} render, ${render.payload.length} chars)`);
      continue;
    }

    const { data: v } = await sb
      .from("artifact_versions")
      .select("content_html")
      .eq("artifact_id", a.id)
      .eq("version", a.current_version)
      .single();
    if (!v) continue;
    const productName =
      (a as unknown as { products: { name: string } | null }).products?.name ?? "Aurigo";
    const html = wrapExportHtml(
      a.title,
      v.content_html,
      `${productName} · ${a.asset_type} · v${a.current_version} · exported ${new Date().toISOString().slice(0, 10)} · Hive by Aurigo`
    );
    const file = path.join(cfg.outputPath, `${slug || a.id}.html`);
    fs.writeFileSync(file, html, "utf-8");
    log.push(`exported ${path.basename(file)} (${htmlToText(v.content_html).length} chars)`);
  }
  if (log.length === 0) log.push("no final artifacts to export yet");

  cfg.lastExport = new Date().toISOString();
  cfg.lastExportResult = `${(finals ?? []).length} artifact(s) exported`;
  await sb.from("integrations").update({ config: cfg }).eq("id", row.id);
  return log;
}

let inputWatcher: FSWatcher | null = null;

export async function restartInputWatcher(): Promise<void> {
  if (inputWatcher) {
    await inputWatcher.close();
    inputWatcher = null;
  }
  const row = await getLocalFolders();
  if (!row || !row.enabled) return;
  if (!fs.existsSync(row.config.inputPath)) return;
  inputWatcher = chokidar.watch(row.config.inputPath, {
    ignoreInitial: true,
    awaitWriteFinish: true,
    depth: 1,
  });
  const onFile = () =>
    scanInput()
      .then((log) => console.log(`[local-folders] ${log[log.length - 1]}`))
      .catch((err) => console.error("[local-folders] scan failed:", (err as Error).message));
  inputWatcher.on("add", onFile);
  inputWatcher.on("change", onFile);
  console.log(`[local-folders] watching Input: ${row.config.inputPath}`);
}

export async function setLocalFoldersEnabled(enabled: boolean): Promise<void> {
  const row = await getLocalFolders();
  if (!row) throw new Error("Local folders are not configured yet.");
  await supabase()!.from("integrations").update({ enabled }).eq("id", row.id);
  await restartInputWatcher();
}
