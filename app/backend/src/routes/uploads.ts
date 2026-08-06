import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { requireAuth, requireAdmin, AuthedUser } from "../middleware/auth";
import { supabase } from "../services/db";
import { extractText } from "../services/extract";
import { logActivity } from "../services/activity";

// Uploads console backend: multipart intake, text extraction, visibility rules,
// and the admin-only promotion gate into context_docs.
export const uploadsRouter = Router();

const UPLOAD_DIR = path.resolve(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTS = [".pdf", ".docx", ".pptx", ".txt", ".md", ".vtt", ".srt"];
const DOC_TYPES = ["prd", "jtbd", "transcript", "release_note", "battlecard", "other"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\- ]+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return cb(new Error(`File type not allowed: ${ext || "unknown"}. Accepted: ${ALLOWED_EXTS.join(" ")}`));
    }
    cb(null, true);
  },
});

interface UploadRowLike {
  uploader_id: string | null;
  sensitive: boolean;
  request?: { requester_id: string | null } | null;
}

/** Non-admins see their own uploads or uploads on their own requests; sensitive files only if uploader or admin. */
function canView(user: AuthedUser, row: UploadRowLike): boolean {
  if (user.role === "admin") return true;
  if (row.uploader_id === user.id) return true;
  if (row.sensitive) return false;
  return !!row.request && row.request.requester_id === user.id;
}

const ROW_SELECT =
  "id, request_id, uploader_id, filename, file_type, storage_path, size_bytes, sensitive, " +
  "extraction_status, promoted, promoted_at, created_at, " +
  "uploader:profiles!uploads_uploader_id_fkey(full_name, email), " +
  "request:requests!uploads_request_id_fkey(id, title, requester_id)";

async function fetchRow(id: string) {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb
    .from("uploads")
    .select(`${ROW_SELECT}, extracted_text`)
    .eq("id", id)
    .single();
  return data as
    | (UploadRowLike & {
        id: string;
        filename: string;
        file_type: string;
        storage_path: string;
        size_bytes: number;
        extraction_status: string;
        promoted: boolean;
        promoted_at: string | null;
        created_at: string;
        request_id: string | null;
        extracted_text: string | null;
      })
    | null;
}

// POST / — multipart upload, field "files" (multiple). Optional: request_id, sensitive ("true"/"false").
uploadsRouter.post("/", requireAuth, (req: Request, res: Response) => {
  upload.array("files", 20)(req, res, async (err: unknown) => {
    if (err) return res.status(400).json({ error: (err as Error).message });
    const sb = supabase();
    if (!sb) return res.status(503).json({ error: "Database not configured" });
    const user = req.user!;
    const files = (req.files ?? []) as Express.Multer.File[];
    if (files.length === 0) return res.status(400).json({ error: "No files uploaded (field name: files)" });

    const body = req.body as { request_id?: string; sensitive?: string };
    const requestId = body.request_id && body.request_id.trim() !== "" ? body.request_id : null;

    try {
      const created: unknown[] = [];
      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
        const autoSensitive = ext === "vtt" || ext === "srt"; // transcripts default sensitive
        const sensitive =
          body.sensitive === "true" ? true : body.sensitive === "false" ? false : autoSensitive;

        const { data: row, error } = await sb
          .from("uploads")
          .insert({
            request_id: requestId,
            uploader_id: user.id,
            filename: file.originalname,
            file_type: ext,
            storage_path: file.path,
            size_bytes: file.size,
            sensitive,
          })
          .select("id")
          .single();
        if (error || !row) {
          return res.status(500).json({ error: error?.message ?? "Insert failed" });
        }

        const extracted = await extractText(file.path);
        await sb
          .from("uploads")
          .update({
            extracted_text: extracted.text || null,
            extraction_status: extracted.status,
          })
          .eq("id", row.id);

        void logActivity("upload", row.id, user.id, "file_uploaded", {
          filename: file.originalname,
          file_type: ext,
          sensitive,
          request_id: requestId,
          extraction_status: extracted.status,
        });

        created.push(await fetchRow(row.id));
      }
      res.status(201).json({ uploads: created });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
});

// GET / — list with filters: q (filename + extracted_text), file_type, promoted, request_id.
uploadsRouter.get("/", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const user = req.user!;
  const { q, file_type, promoted, request_id } = req.query as Record<string, string | undefined>;

  let query = sb.from("uploads").select(ROW_SELECT).order("created_at", { ascending: false });
  if (q && q.trim() !== "") {
    const safe = q.replace(/[,()]/g, " ").trim();
    query = query.or(`filename.ilike.%${safe}%,extracted_text.ilike.%${safe}%`);
  }
  if (file_type && file_type.trim() !== "") query = query.eq("file_type", file_type);
  if (promoted === "true") query = query.eq("promoted", true);
  if (promoted === "false") query = query.eq("promoted", false);
  if (request_id && request_id.trim() !== "") query = query.eq("request_id", request_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const rows = (data ?? []) as unknown as (UploadRowLike & Record<string, unknown>)[];
  const visible = rows.filter((r) => canView(user, r));
  res.json({ uploads: visible });
});

// GET /:id/preview — metadata + first 2000 chars of extracted text.
uploadsRouter.get("/:id/preview", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const row = await fetchRow(req.params.id);
  if (!row) return res.status(404).json({ error: "Upload not found" });
  if (!canView(req.user!, row)) return res.status(403).json({ error: "You cannot view this upload" });
  const { extracted_text, storage_path: _sp, ...meta } = row;
  res.json({
    upload: meta,
    preview: (extracted_text ?? "").slice(0, 2000),
    truncated: (extracted_text ?? "").length > 2000,
  });
});

// GET /:id/download — same visibility rules.
uploadsRouter.get("/:id/download", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const row = await fetchRow(req.params.id);
  if (!row) return res.status(404).json({ error: "Upload not found" });
  if (!canView(req.user!, row)) return res.status(403).json({ error: "You cannot download this upload" });
  if (!fs.existsSync(row.storage_path)) {
    return res.status(410).json({ error: "File is no longer on disk" });
  }
  res.download(row.storage_path, row.filename);
});

// DELETE /:id — admin only; removes file from disk and the row.
uploadsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const row = await fetchRow(req.params.id);
  if (!row) return res.status(404).json({ error: "Upload not found" });
  try {
    if (fs.existsSync(row.storage_path)) fs.unlinkSync(row.storage_path);
  } catch (e) {
    console.error(`failed to delete file ${row.storage_path}:`, (e as Error).message);
  }
  const { error } = await sb.from("uploads").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("upload", req.params.id, req.user!.id, "file_deleted", { filename: row.filename });
  res.json({ ok: true });
});

// POST /:id/promote — admin approval gate: extracted text becomes an approved context doc.
uploadsRouter.post("/:id/promote", requireAuth, requireAdmin, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { title, doc_type, product_id } = req.body as {
    title?: string;
    doc_type?: string;
    product_id?: string;
  };
  if (!doc_type || !DOC_TYPES.includes(doc_type)) {
    return res.status(400).json({ error: `doc_type must be one of ${DOC_TYPES.join(", ")}` });
  }
  const row = await fetchRow(req.params.id);
  if (!row) return res.status(404).json({ error: "Upload not found" });
  if (!row.extracted_text || row.extracted_text.trim() === "") {
    return res.status(422).json({ error: "No extracted text — this file cannot be promoted to context" });
  }

  const { data: doc, error: docErr } = await sb
    .from("context_docs")
    .insert({
      title: title && title.trim() !== "" ? title.trim() : row.filename,
      source: "upload",
      doc_type,
      product_id: product_id && product_id.trim() !== "" ? product_id : null,
      content: row.extracted_text,
      upload_id: row.id,
      approved: true,
    })
    .select("id, title, doc_type")
    .single();
  if (docErr || !doc) return res.status(500).json({ error: docErr?.message ?? "Promotion failed" });

  const { error: upErr } = await sb
    .from("uploads")
    .update({ promoted: true, promoted_at: new Date().toISOString(), promoted_by: req.user!.id })
    .eq("id", row.id);
  if (upErr) return res.status(500).json({ error: upErr.message });

  void logActivity("upload", row.id, req.user!.id, "promoted_to_context", {
    context_doc_id: doc.id,
    doc_type,
    title: doc.title,
  });

  res.json({ ok: true, contextDoc: doc, upload: await fetchRow(row.id) });
});
