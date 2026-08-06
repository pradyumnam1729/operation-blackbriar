import fs from "fs";
import path from "path";

// Text extraction for uploaded/watched files. Degrades gracefully: anything
// we cannot parse is marked 'unsupported' and can still be stored/downloaded.

export interface ExtractResult {
  status: "done" | "failed" | "unsupported";
  text: string;
}

export async function extractText(filePath: string): Promise<ExtractResult> {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if ([".txt", ".md", ".vtt", ".srt", ".csv"].includes(ext)) {
      return { status: "done", text: fs.readFileSync(filePath, "utf-8") };
    }
    if (ext === ".pdf") {
      const pdfParse = require("pdf-parse") as (b: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(fs.readFileSync(filePath));
      return { status: "done", text: data.text };
    }
    if (ext === ".docx") {
      const mammoth = require("mammoth") as { extractRawText: (o: { path: string }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ path: filePath });
      return { status: "done", text: result.value };
    }
    // .pptx and other binary formats: stored and downloadable, not indexed yet.
    return { status: "unsupported", text: "" };
  } catch (err) {
    console.error(`extraction failed for ${filePath}:`, (err as Error).message);
    return { status: "failed", text: "" };
  }
}
