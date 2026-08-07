import { Router } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import { ask } from "../services/claude";

// Feature Catalog module. Reading is open to all signed-in roles; every
// mutation (process, review, manual CRUD) is admin (PMM) only.
export const featuresRouter = Router();

featuresRouter.use(requireAuth);

type ChangeType = "added" | "changed" | "deprecated";

interface ExtractedFeature {
  name: string;
  description: string | null;
  category: string | null;
  release_date: string | null;
  change_type: ChangeType;
  confidence: number;
}

/** Defensively parse the model's answer: find the first [...] JSON block. */
function parseExtraction(raw: string): ExtractedFeature[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const items: ExtractedFeature[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const changeType: ChangeType =
      typeof o.change_type === "string" && ["added", "changed", "deprecated"].includes(o.change_type)
        ? (o.change_type as ChangeType)
        : "added";
    const confRaw = typeof o.confidence === "number" ? o.confidence : Number(o.confidence);
    const confidence = Number.isFinite(confRaw) ? Math.max(0, Math.min(1, confRaw)) : 0.5;
    const releaseDate =
      typeof o.release_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.release_date)
        ? o.release_date
        : null;
    items.push({
      name,
      description: typeof o.description === "string" ? o.description : null,
      category: typeof o.category === "string" ? o.category : null,
      release_date: releaseDate,
      change_type: changeType,
      confidence,
    });
  }
  return items;
}

/**
 * Apply one extracted/approved change to the features table.
 * added → insert (status active). changed/deprecated → update the existing
 * feature matched by name (case-insensitive); if none exists, insert with
 * that status so the catalog still reflects the note.
 */
async function applyChange(
  sb: SupabaseClient,
  productId: string,
  item: ExtractedFeature,
  releaseNoteId: string | null,
  actorId: string | null
): Promise<void> {
  if (item.change_type === "added") {
    const { data, error } = await sb
      .from("features")
      .insert({
        product_id: productId,
        name: item.name,
        description: item.description,
        category: item.category,
        release_date: item.release_date,
        release_note_id: releaseNoteId,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logActivity("feature", data.id, actorId, "created_from_release_note", {
      name: item.name,
      change_type: "added",
      confidence: item.confidence,
    });
    return;
  }

  const status = item.change_type === "changed" ? "changed" : "deprecated";
  const { data: existing } = await sb
    .from("features")
    .select("id")
    .eq("product_id", productId)
    .ilike("name", item.name)
    .limit(1);

  if (existing && existing.length > 0) {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (item.description) patch.description = item.description;
    if (releaseNoteId) patch.release_note_id = releaseNoteId;
    if (item.release_date) patch.release_date = item.release_date;
    const { error } = await sb.from("features").update(patch).eq("id", existing[0].id);
    if (error) throw new Error(error.message);
    await logActivity("feature", existing[0].id, actorId, "status_updated_from_release_note", {
      name: item.name,
      change_type: item.change_type,
      confidence: item.confidence,
    });
  } else {
    const { data, error } = await sb
      .from("features")
      .insert({
        product_id: productId,
        name: item.name,
        description: item.description,
        category: item.category,
        release_date: item.release_date,
        release_note_id: releaseNoteId,
        status,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logActivity("feature", data.id, actorId, "created_from_release_note", {
      name: item.name,
      change_type: item.change_type,
      note: "no existing feature matched by name; inserted with status",
    });
  }
}

// ---------- GET / — feature list for a product ----------
featuresRouter.get("/", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const productId = req.query.product_id as string | undefined;
  let q = sb
    .from("features")
    .select("id, product_id, name, description, category, release_date, release_note_id, source_url, status, created_at, updated_at")
    .order("release_date", { ascending: false, nullsFirst: false });
  if (productId) q = q.eq("product_id", productId);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ features: data ?? [] });
});

// ---------- GET /release-notes — processed notes with change summary ----------
featuresRouter.get("/release-notes", async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const productId = req.query.product_id as string | undefined;
  let q = sb
    .from("release_notes")
    .select("id, product_id, filename, source_path, processed_at, created_at")
    .order("created_at", { ascending: false });
  if (productId) q = q.eq("product_id", productId);

  const { data: notes, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  const noteIds = (notes ?? []).map((n) => n.id);

  let features: { id: string; name: string; status: string; release_note_id: string }[] = [];
  let pendingReviews: { release_note_id: string | null }[] = [];
  if (noteIds.length > 0) {
    const [fRes, rRes] = await Promise.all([
      sb.from("features").select("id, name, status, release_note_id").in("release_note_id", noteIds),
      sb.from("feature_reviews").select("release_note_id").in("release_note_id", noteIds).eq("status", "pending"),
    ]);
    features = fRes.data ?? [];
    pendingReviews = rRes.data ?? [];
  }

  const summarized = (notes ?? []).map((n) => {
    const linked = features.filter((f) => f.release_note_id === n.id);
    return {
      ...n,
      added: linked.filter((f) => f.status === "active").map((f) => f.name),
      changed: linked.filter((f) => f.status === "changed").map((f) => f.name),
      deprecated: linked.filter((f) => f.status === "deprecated").map((f) => f.name),
      pending_reviews: pendingReviews.filter((r) => r.release_note_id === n.id).length,
    };
  });

  res.json({ notes: summarized });
});

// ---------- POST /process — AI extraction with manual-review fallback ----------
featuresRouter.post("/process", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { release_note_id, product_id, filename, raw_text } = (req.body ?? {}) as {
    release_note_id?: string;
    product_id?: string;
    filename?: string;
    raw_text?: string;
  };

  let note: { id: string; product_id: string; filename: string; raw_text: string };
  if (release_note_id) {
    const { data } = await sb
      .from("release_notes")
      .select("id, product_id, filename, raw_text")
      .eq("id", release_note_id)
      .single();
    if (!data) return res.status(404).json({ error: "Release note not found" });
    if (!data.raw_text || data.raw_text.trim() === "")
      return res.status(400).json({ error: "Release note has no stored text to process" });
    note = data;
  } else {
    if (!product_id || !filename || !raw_text || raw_text.trim() === "") {
      return res
        .status(400)
        .json({ error: "Provide release_note_id, or product_id + filename + raw_text" });
    }
    const { data, error } = await sb
      .from("release_notes")
      .insert({ product_id, filename, raw_text })
      .select("id, product_id, filename, raw_text")
      .single();
    if (error || !data) return res.status(400).json({ error: error?.message ?? "Could not store release note" });
    note = data;
  }

  const { data: product } = await sb
    .from("products")
    .select("name, line, module")
    .eq("id", note.product_id)
    .single();

  let extracted: ExtractedFeature[] = [];
  let aiUnavailable = false;
  try {
    const prompt = [
      "Extract the product feature entries from the release note below.",
      "Respond with ONLY a JSON array — no prose before or after — of objects with exactly these keys:",
      '{"name": string, "description": string, "category": string, "release_date": "YYYY-MM-DD" or null, "change_type": "added" | "changed" | "deprecated", "confidence": number between 0 and 1}',
      "Rules:",
      "- One object per distinct feature that was added, changed, or deprecated.",
      "- confidence is your certainty the entry is a real feature change read correctly from the text.",
      "- description is one buyer-readable sentence. category is a short area label (e.g. Funding, Inspections).",
      "- Use the note's release date for release_date if features do not carry their own.",
      "",
      `Product: ${product?.name ?? note.product_id}`,
      `Filename: ${note.filename}`,
      "=== RELEASE NOTE TEXT ===",
      note.raw_text.slice(0, 30_000),
    ].join("\n");

    const answer = await ask(prompt, { maxTokens: 4000 });
    extracted = parseExtraction(answer);
  } catch (err) {
    console.error("[features/process] AI extraction unavailable:", (err as Error).message);
    aiUnavailable = true;
  }

  let applied = 0;
  let queued = 0;

  if (aiUnavailable || extracted.length === 0) {
    // Degraded path: queue the whole note for manual review so nothing is lost.
    const { error } = await sb.from("feature_reviews").insert({
      release_note_id: note.id,
      product_id: note.product_id,
      proposed: {
        note: aiUnavailable
          ? "AI extraction unavailable (no API credits or model error) — review the raw text and add features manually."
          : "AI extraction returned no feature entries — review the raw text manually.",
        filename: note.filename,
        raw_text_snippet: note.raw_text.slice(0, 2000),
      },
      change_type: "added",
      confidence: 0.1,
      status: "pending",
    });
    if (error) return res.status(500).json({ error: error.message });
    queued = 1;
  } else {
    for (const item of extracted) {
      if (item.confidence >= 0.75) {
        try {
          await applyChange(sb, note.product_id, item, note.id, req.user?.id ?? null);
          applied += 1;
        } catch (err) {
          console.error("[features/process] apply failed, queueing for review:", (err as Error).message);
          await sb.from("feature_reviews").insert({
            release_note_id: note.id,
            product_id: note.product_id,
            proposed: item,
            change_type: item.change_type,
            confidence: item.confidence,
            status: "pending",
          });
          queued += 1;
        }
      } else {
        const { error } = await sb.from("feature_reviews").insert({
          release_note_id: note.id,
          product_id: note.product_id,
          proposed: item,
          change_type: item.change_type,
          confidence: item.confidence,
          status: "pending",
        });
        if (!error) queued += 1;
      }
    }
  }

  await sb
    .from("release_notes")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", note.id);
  await logActivity("release_note", note.id, req.user?.id ?? null, "processed", {
    filename: note.filename,
    applied,
    queued,
    ai_unavailable: aiUnavailable,
  });

  res.json({ applied, queued, ai_unavailable: aiUnavailable, release_note_id: note.id });
});

// ---------- POST /build-from-documents — build the catalog from the knowledge base ----------
// Uses the uploaded/ingested documents (PRDs, transcripts, etc.) as the source
// instead of a release note. Same confidence gate: >= 0.75 lands in the catalog,
// below that goes to the review queue with the source documents recorded.
featuresRouter.post("/build-from-documents", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { product_id } = (req.body ?? {}) as { product_id?: string };
  if (!product_id) return res.status(400).json({ error: "product_id is required" });
  // Guards the .or() filter string below: only a validated UUID may ever reach
  // it, regardless of what upstream checks do or don't run first.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id)) {
    return res.status(400).json({ error: "product_id must be a UUID" });
  }

  const { data: product } = await sb
    .from("products")
    .select("id, name, line, module")
    .eq("id", product_id)
    .single();
  if (!product) return res.status(404).json({ error: "Product not found" });

  // Candidate sources: AI-enabled knowledge-base documents. If the product
  // has its OWN tagged documents, use only those — mixing in untagged
  // documents dilutes the corpus and mis-attributes other products' features
  // (seen with Masterworks AI picking up Maintain features). Untagged
  // documents are only a fallback for products with nothing tagged yet.
  const { data: docs, error: docsError } = await sb
    .from("documents")
    .select("id, title, doc_type, product_id")
    .eq("ai_enabled", true)
    .or(`product_id.eq.${product_id},product_id.is.null`);
  if (docsError) return res.status(500).json({ error: docsError.message });
  if (!docs || docs.length === 0) {
    return res.status(400).json({
      error:
        "No AI-enabled documents are available for this product. Upload documents (or drop them in the Input folder) and enable them for AI in the Uploads console.",
    });
  }

  const tagged = docs.filter((d) => d.product_id === product_id);
  const ordered = tagged.length > 0 ? tagged : docs;

  const { data: chunks, error: chunksError } = await sb
    .from("document_chunks")
    .select("document_id, chunk_index, content")
    .in("document_id", ordered.map((d) => d.id))
    .order("chunk_index", { ascending: true });
  if (chunksError) return res.status(500).json({ error: chunksError.message });

  const CORPUS_CAP = 120_000;
  let corpus = "";
  const docsUsed: string[] = [];
  for (const doc of ordered) {
    const body = (chunks ?? [])
      .filter((c) => c.document_id === doc.id)
      .map((c) => c.content)
      .join("\n");
    if (body.trim() === "") continue;
    const block = `\n=== SOURCE DOCUMENT: ${doc.title} [${doc.doc_type}] ===\n${body}\n`;
    if (corpus.length + block.length > CORPUS_CAP) {
      const room = CORPUS_CAP - corpus.length;
      if (room > 2000) {
        corpus += block.slice(0, room);
        docsUsed.push(`${doc.title} (truncated)`);
      }
      break;
    }
    corpus += block;
    docsUsed.push(doc.title);
  }
  if (corpus.trim() === "") {
    return res.status(400).json({ error: "The selected documents have no readable text chunks." });
  }

  // Skip names the catalog already has for this product so rebuilds are idempotent.
  const { data: existingRows } = await sb
    .from("features")
    .select("name")
    .eq("product_id", product_id);
  const existingNames = new Set((existingRows ?? []).map((f) => f.name.trim().toLowerCase()));

  let extracted: ExtractedFeature[] = [];
  try {
    const prompt = [
      `Build the feature catalog for the product "${product.name}" (${product.line} line, ${product.module} module) from the source documents below.`,
      "The documents are PRDs, walkthrough transcripts, and other uploaded material. Some may cover OTHER products — use only content that is clearly about this product.",
      "Respond with ONLY a JSON array — no prose before or after — of objects with exactly these keys:",
      '{"name": string, "description": string, "category": string, "release_date": "YYYY-MM-DD" or null, "change_type": "added", "confidence": number between 0 and 1}',
      "Rules:",
      "- One object per distinct, concrete product capability. Aim for the 10-25 most important; no duplicates, no vague themes.",
      "- Only include capabilities actually described in the documents — never invent. confidence reflects how explicitly the sources support the entry: a capability named and described in a PRD for this product warrants 0.8+; something only alluded to in a conversation warrants less.",
      "- description is one buyer-readable sentence. category is a short area label (e.g. Inspections, Work Orders).",
      "- release_date is null unless a document states a real date for that capability.",
      "",
      corpus,
    ].join("\n");

    const answer = await ask(prompt, { maxTokens: 8000 });
    extracted = parseExtraction(answer);
  } catch (err) {
    console.error("[features/build-from-documents] AI extraction failed:", (err as Error).message);
    return res.status(502).json({ error: `AI extraction failed: ${(err as Error).message}` });
  }
  if (extracted.length === 0) {
    return res
      .status(422)
      .json({ error: "The model returned no feature entries from these documents." });
  }

  let applied = 0;
  let queued = 0;
  let skipped = 0;
  for (const item of extracted) {
    const key = item.name.trim().toLowerCase();
    if (existingNames.has(key)) {
      skipped += 1;
      continue;
    }
    if (item.confidence >= 0.75) {
      try {
        await applyChange(sb, product_id, item, null, req.user?.id ?? null);
        applied += 1;
        existingNames.add(key);
        continue;
      } catch (err) {
        console.error(
          "[features/build-from-documents] apply failed, queueing for review:",
          (err as Error).message
        );
      }
    }
    const { error } = await sb.from("feature_reviews").insert({
      release_note_id: null,
      product_id,
      proposed: { ...item, source: "knowledge_base", source_documents: docsUsed },
      change_type: item.change_type,
      confidence: item.confidence,
      status: "pending",
    });
    if (!error) queued += 1;
  }

  await logActivity("product", product_id, req.user?.id ?? null, "catalog_built_from_documents", {
    product: product.name,
    documents: docsUsed,
    extracted: extracted.length,
    applied,
    queued,
    skipped,
  });

  res.json({ applied, queued, skipped, extracted: extracted.length, documents_used: docsUsed });
});

// ---------- GET /reviews — review queue with product names ----------
featuresRouter.get("/reviews", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const status = (req.query.status as string) || "pending";
  const { data, error } = await sb
    .from("feature_reviews")
    .select(
      "id, release_note_id, product_id, proposed, change_type, confidence, status, created_at, products(name), release_notes(filename)"
    )
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reviews: data ?? [] });
});

// ---------- POST /reviews/:id/approve ----------
featuresRouter.post("/reviews/:id/approve", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { data: review } = await sb
    .from("feature_reviews")
    .select("id, release_note_id, product_id, proposed, change_type, confidence, status")
    .eq("id", req.params.id)
    .single();
  if (!review) return res.status(404).json({ error: "Review not found" });
  if (review.status !== "pending") return res.status(400).json({ error: "Review is not pending" });

  const proposed = (review.proposed ?? {}) as Record<string, unknown>;
  const name = typeof proposed.name === "string" ? proposed.name.trim() : "";

  let appliedFeature = false;
  if (name) {
    const item: ExtractedFeature = {
      name,
      description: typeof proposed.description === "string" ? proposed.description : null,
      category: typeof proposed.category === "string" ? proposed.category : null,
      release_date:
        typeof proposed.release_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(proposed.release_date)
          ? proposed.release_date
          : null,
      change_type: review.change_type as ChangeType,
      confidence: Number(review.confidence) || 0.5,
    };
    try {
      await applyChange(sb, review.product_id, item, review.release_note_id, req.user?.id ?? null);
      appliedFeature = true;
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  }

  const { error } = await sb
    .from("feature_reviews")
    .update({ status: "approved", reviewed_by: req.user?.id ?? null })
    .eq("id", review.id);
  if (error) return res.status(500).json({ error: error.message });

  await logActivity("feature_review", review.id, req.user?.id ?? null, "approved", {
    applied_to_catalog: appliedFeature,
    change_type: review.change_type,
  });

  res.json({
    ok: true,
    applied: appliedFeature,
    message: appliedFeature
      ? "Approved and applied to the feature catalog."
      : "Approved and cleared. The proposal had no feature name (raw-note fallback) — add the feature manually if needed.",
  });
});

// ---------- POST /reviews/:id/reject ----------
featuresRouter.post("/reviews/:id/reject", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { data: review } = await sb
    .from("feature_reviews")
    .select("id, status")
    .eq("id", req.params.id)
    .single();
  if (!review) return res.status(404).json({ error: "Review not found" });
  if (review.status !== "pending") return res.status(400).json({ error: "Review is not pending" });

  const { error } = await sb
    .from("feature_reviews")
    .update({ status: "rejected", reviewed_by: req.user?.id ?? null })
    .eq("id", review.id);
  if (error) return res.status(500).json({ error: error.message });

  await logActivity("feature_review", review.id, req.user?.id ?? null, "rejected", {});
  res.json({ ok: true });
});

// ---------- Admin manual CRUD ----------
featuresRouter.post("/", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { product_id, name, description, category, release_date, source_url } = (req.body ?? {}) as {
    product_id?: string;
    name?: string;
    description?: string;
    category?: string;
    release_date?: string;
    source_url?: string;
  };
  if (!product_id || !name || name.trim() === "")
    return res.status(400).json({ error: "product_id and name are required" });

  const { data, error } = await sb
    .from("features")
    .insert({
      product_id,
      name: name.trim(),
      description: description ?? null,
      category: category ?? null,
      release_date: release_date && /^\d{4}-\d{2}-\d{2}$/.test(release_date) ? release_date : null,
      source_url: source_url ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) return res.status(400).json({ error: error.message });

  await logActivity("feature", data.id, req.user?.id ?? null, "created_manually", { name: data.name });
  res.status(201).json({ feature: data });
});

featuresRouter.put("/:id", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const allowed = ["name", "description", "category", "release_date", "source_url", "status"] as const;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (typeof patch.status === "string" && !["active", "changed", "deprecated"].includes(patch.status as string)) {
    return res.status(400).json({ error: "status must be active, changed, or deprecated" });
  }
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No editable fields provided" });
  patch.updated_at = new Date().toISOString();

  const { data, error } = await sb
    .from("features")
    .update(patch)
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Feature not found" });

  await logActivity("feature", data.id, req.user?.id ?? null, "updated_manually", { fields: Object.keys(patch) });
  res.json({ feature: data });
});

featuresRouter.delete("/:id", requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });

  const { data: existing } = await sb
    .from("features")
    .select("id, name")
    .eq("id", req.params.id)
    .single();
  if (!existing) return res.status(404).json({ error: "Feature not found" });

  const { error } = await sb.from("features").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  await logActivity("feature", existing.id, req.user?.id ?? null, "deleted", { name: existing.name });
  res.json({ ok: true });
});
