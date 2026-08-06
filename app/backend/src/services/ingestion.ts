import crypto from "crypto";
import { supabase } from "./db";

// Document ingestion: dedupe by content hash, split into heading-aware chunks
// with metadata, store for ranked retrieval. Every ingest path (local Input
// folder, upload console, SharePoint) funnels through ingestDocument().

const CHUNK_MAX = 1400; // chars per chunk (~350 tokens)
const CHUNK_OVERLAP = 200; // trailing carry-over between chunks

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/** Normalize before hashing so trivial whitespace/line-ending differences dedupe. */
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export interface Chunk {
  index: number;
  content: string;
  heading: string | null;
  hash: string;
  tokenEstimate: number;
}

/** Paragraph-accumulating chunker that tracks the nearest markdown heading. */
export function chunkText(text: string): Chunk[] {
  const paragraphs = normalize(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "");

  const chunks: Chunk[] = [];
  let buffer = "";
  let currentHeading: string | null = null;
  let bufferHeading: string | null = null;
  const seenHashes = new Set<string>();

  const flush = () => {
    const content = buffer.trim();
    buffer = "";
    if (content === "") return;
    const hash = sha256(content);
    if (seenHashes.has(hash)) return; // intra-document duplicate chunk
    seenHashes.add(hash);
    chunks.push({
      index: chunks.length,
      content,
      heading: bufferHeading,
      hash,
      tokenEstimate: Math.ceil(content.length / 4),
    });
  };

  for (const p of paragraphs) {
    const headingMatch = p.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) currentHeading = headingMatch[1].trim().slice(0, 200);

    if (buffer !== "" && buffer.length + p.length + 2 > CHUNK_MAX) {
      const tail = buffer.slice(-CHUNK_OVERLAP);
      flush();
      buffer = tail.trimStart() === "" ? "" : `…${tail}`;
    }
    if (buffer === "") bufferHeading = currentHeading;
    buffer = buffer === "" ? p : `${buffer}\n\n${p}`;

    // A single paragraph longer than the max gets hard-split.
    while (buffer.length > CHUNK_MAX * 1.5) {
      const head = buffer.slice(0, CHUNK_MAX);
      const rest = buffer.slice(CHUNK_MAX - CHUNK_OVERLAP);
      buffer = head;
      flush();
      buffer = `…${rest}`;
      bufferHeading = currentHeading;
    }
  }
  flush();
  return chunks;
}

export interface IngestInput {
  title: string;
  filename?: string;
  text: string;
  source: "upload" | "local_folder" | "sharepoint" | "war_room" | "manual";
  docType: string;
  productId?: string | null;
  productName?: string | null;
  uploadId?: string | null;
  createdBy?: string | null;
  /** Whether AI features may use this document immediately (admin-configured sources: yes; uploads: opt-in). */
  aiEnabled: boolean;
}

export interface IngestResult {
  documentId: string;
  deduped: boolean;
  duplicateOf?: string; // title of the existing doc when deduped
  chunkCount: number;
}

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const sb = supabase();
  if (!sb) throw new Error("Database not configured");
  const normalized = normalize(input.text);
  if (normalized === "") throw new Error("Document has no extractable text");
  const hash = sha256(normalized);

  // File-level dedup: identical content (any filename) maps to the existing document.
  const { data: existing } = await sb
    .from("documents")
    .select("id, title, chunk_count")
    .eq("content_hash", hash)
    .maybeSingle();
  if (existing) {
    return {
      documentId: existing.id,
      deduped: true,
      duplicateOf: existing.title,
      chunkCount: existing.chunk_count,
    };
  }

  const { data: doc, error } = await sb
    .from("documents")
    .insert({
      title: input.title,
      filename: input.filename ?? null,
      source: input.source,
      doc_type: input.docType,
      product_id: input.productId ?? null,
      upload_id: input.uploadId ?? null,
      content_hash: hash,
      ai_enabled: input.aiEnabled,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error || !doc) throw new Error(`document insert failed: ${error?.message}`);

  const chunks = chunkText(normalized);
  const rows = chunks.map((c) => ({
    document_id: doc.id,
    chunk_index: c.index,
    content: c.content,
    chunk_hash: c.hash,
    heading: c.heading,
    token_estimate: c.tokenEstimate,
    metadata: {
      source: input.source,
      doc_type: input.docType,
      product: input.productName ?? null,
      filename: input.filename ?? null,
      heading: c.heading,
    },
  }));
  if (rows.length > 0) {
    const { error: chunkErr } = await sb.from("document_chunks").insert(rows);
    if (chunkErr) {
      await sb.from("documents").delete().eq("id", doc.id);
      throw new Error(`chunk insert failed: ${chunkErr.message}`);
    }
  }
  await sb.from("documents").update({ chunk_count: rows.length }).eq("id", doc.id);

  return { documentId: doc.id, deduped: false, chunkCount: rows.length };
}

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  content: string;
  heading: string | null;
  metadata: Record<string, unknown>;
  title: string;
  doc_type: string;
  rank: number;
}

/** Ranked full-text retrieval over AI-enabled documents. Empty on any failure. */
export async function retrieveChunks(question: string, limit = 8): Promise<RetrievedChunk[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("match_chunks", { q: question, n: limit });
  if (error) {
    console.error("match_chunks failed:", error.message);
    return [];
  }
  return (data ?? []) as RetrievedChunk[];
}

/** Render retrieved chunks as context the model can cite. */
export function chunksToContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map(
      (c) =>
        `<chunk source="${String(c.metadata.filename ?? c.title)}" doc_type="${c.doc_type}"${
          c.heading ? ` section="${c.heading}"` : ""
        }${c.metadata.product ? ` product="${String(c.metadata.product)}"` : ""}>\n${c.content}\n</chunk>`
    )
    .join("\n\n");
}
