import chokidar, { FSWatcher } from "chokidar";
import path from "path";
import { supabase } from "./db";
import { flagEnabled } from "./activity";
import { extractText } from "./extract";
import { REPO_ROOT } from "./warRoom";

// Local-folder stand-in for SharePoint (Phase 0). Watches the folders defined
// in the `integrations` table (kind = sharepoint_local). Behind the
// `sharepoint_watcher` feature flag; swap to Graph API when access is granted.

let watchers: FSWatcher[] = [];

async function processFile(filePath: string, productHint: string | null, docType: string) {
  const sb = supabase();
  if (!sb) return;
  const { status, text } = await extractText(filePath);
  if (status !== "done" || text.trim() === "") {
    console.log(`[watcher] skipped ${filePath} (${status})`);
    return;
  }
  const filename = path.basename(filePath);

  if (docType === "release_note") {
    // Match the file to a product by folder hint (line name in path).
    const { data: products } = await sb.from("products").select("id, name, line");
    const product =
      products?.find((p) => productHint && p.line.toLowerCase() === productHint.toLowerCase()) ??
      products?.[0];
    if (!product) return;

    const { data: rn } = await sb
      .from("release_notes")
      .insert({ product_id: product.id, filename, source_path: filePath, raw_text: text, processed_at: new Date().toISOString() })
      .select("id")
      .single();

    // Extraction of individual features from the note uses the LLM; with no
    // API credits it degrades to queueing the whole note for manual review.
    await sb.from("feature_reviews").insert({
      release_note_id: rn?.id,
      product_id: product.id,
      proposed: { note: "New release note ingested — extract features manually or re-run with AI extraction.", filename },
      change_type: "added",
      confidence: 0.1,
      status: "pending",
    });
    console.log(`[watcher] release note ingested: ${filename} -> review queue`);
  } else {
    await sb.from("context_docs").insert({
      title: filename,
      source: "folder_watch",
      doc_type: docType,
      content: text.slice(0, 200_000),
      approved: false,
    });
    console.log(`[watcher] context doc ingested (pending approval): ${filename}`);
  }
}

export async function startWatchers(): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  if (!(await flagEnabled("sharepoint_watcher"))) {
    console.log("[watcher] sharepoint_watcher flag off — not watching folders");
    return;
  }
  const { data: integrations } = await sb
    .from("integrations")
    .select("name, config, enabled")
    .eq("kind", "sharepoint_local")
    .eq("enabled", true);

  for (const integ of integrations ?? []) {
    const cfg = integ.config as { path: string; doc_type: string };
    const abs = path.isAbsolute(cfg.path) ? cfg.path : path.resolve(REPO_ROOT, cfg.path);
    const hint = /masterworks/i.test(abs) ? "Masterworks" : /primus/i.test(abs) ? "Primus" : null;
    const w = chokidar.watch(abs, { ignoreInitial: false, awaitWriteFinish: true, depth: 2 });
    w.on("add", (p) => void processFile(p, hint, cfg.doc_type));
    w.on("change", (p) => void processFile(p, hint, cfg.doc_type));
    watchers.push(w);
    console.log(`[watcher] watching ${abs} (${cfg.doc_type}) for '${integ.name}'`);
  }
}

export async function stopWatchers(): Promise<void> {
  await Promise.all(watchers.map((w) => w.close()));
  watchers = [];
}
