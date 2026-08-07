import fs from "fs";
import path from "path";

// Text extraction for uploaded/watched files. Degrades gracefully: anything
// we cannot parse is marked 'unsupported' and can still be stored/downloaded.

export interface ExtractResult {
  status: "done" | "failed" | "unsupported";
  text: string;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

/**
 * Slide deck → heading-structured markdown: each slide a `## Slide N` section
 * (chunk heading), text runs joined per paragraph, speaker notes appended.
 * pptx is a zip of XML — no heavy parser needed for text extraction.
 */
function pptxToMarkdown(filePath: string): string {
  const AdmZip = require("adm-zip") as typeof import("adm-zip");
  const zip = new AdmZip(filePath);
  const slides = new Map<number, string>();
  const notes = new Map<number, string>();

  for (const entry of zip.getEntries()) {
    const slide = entry.entryName.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    const note = entry.entryName.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/);
    if (!slide && !note) continue;
    const xml = entry.getData().toString("utf-8");
    const paragraphs = [...xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
      .map((p) =>
        [...p[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
          .map((t) => decodeXmlEntities(t[1]))
          .join("")
          .trim()
      )
      .filter((p) => p !== "");
    const text = paragraphs.join("\n");
    if (slide) slides.set(Number(slide[1]), text);
    else if (note) notes.set(Number(note[1]), text);
  }

  const out: string[] = [];
  for (const idx of [...slides.keys()].sort((a, b) => a - b)) {
    const body = slides.get(idx)!;
    if (body.trim() === "") continue;
    out.push(`## Slide ${idx}\n\n${body}`);
    const note = notes.get(idx);
    if (note && note.trim() !== "") out.push(`Speaker notes (slide ${idx}):\n${note}`);
  }
  return out.join("\n\n");
}

/** A cell value, trimmed; multi-line cell content becomes "- " bullets. */
function cellLines(v: unknown): string[] {
  return String(v ?? "")
    .split(/\r?\n/)
    .map((s) => s.replace(/^[•\-\s]+/, "").trim())
    .filter((s) => s !== "");
}

/**
 * Workbook → heading-structured markdown, tuned for the chunker: each sheet
 * becomes a `##` section and each named row a `###` block, so document_chunks
 * carry the sheet (sub-product) and row (feature) as their heading. Rows whose
 * name column is empty are continuation rows — their content belongs to the
 * previous block (a common spreadsheet pattern for bullet lists). Fully empty
 * rows are dropped, which also defuses phantom used-range rows.
 */
function xlsxToMarkdown(filePath: string): string {
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.read(fs.readFileSync(filePath));
  const out: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    const rows = raw
      .map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()))
      .filter((r) => r.some((c) => c !== ""));
    if (rows.length < 2) continue; // header-only or empty sheet

    const header = rows[0];
    // The "name" column that starts a new block: the second column when the
    // sheet has one (col 0 is usually the sheet-level product name), else 0.
    const nameCol = header.length > 1 ? 1 : 0;

    out.push(`## ${sheetName}`);
    let block: string[] = [];
    const flush = () => {
      if (block.length > 0) out.push(block.join("\n"));
      block = [];
    };

    for (const row of rows.slice(1)) {
      if (row[nameCol] !== "") {
        flush();
        block.push(`### ${row[nameCol]}`);
        for (let c = 0; c < row.length; c++) {
          if (c === nameCol || row[c] === "") continue;
          const label = header[c] !== "" ? header[c] : `Column ${c + 1}`;
          const lines = cellLines(row[c]);
          block.push(
            lines.length > 1
              ? `**${label}:**\n${lines.map((l) => `- ${l}`).join("\n")}`
              : `**${label}:** ${lines[0] ?? ""}`
          );
        }
      } else if (block.length > 0) {
        // Continuation row: append its content cells to the open block.
        for (let c = 0; c < row.length; c++) {
          if (row[c] === "") continue;
          block.push(...cellLines(row[c]).map((l) => `- ${l}`));
        }
      }
    }
    flush();
  }
  return out.join("\n\n");
}

export async function extractText(filePath: string): Promise<ExtractResult> {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if ([".txt", ".md", ".vtt", ".srt", ".csv"].includes(ext)) {
      return { status: "done", text: fs.readFileSync(filePath, "utf-8") };
    }
    if (ext === ".pdf") {
      // pdf-parse v2 exports a class, not the v1 function.
      const { PDFParse } = require("pdf-parse") as {
        PDFParse: new (o: { data: Buffer }) => { getText: () => Promise<{ text: string }> };
      };
      const parser = new PDFParse({ data: fs.readFileSync(filePath) });
      const result = await parser.getText();
      return { status: "done", text: result.text };
    }
    if (ext === ".docx") {
      const mammoth = require("mammoth") as { extractRawText: (o: { path: string }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ path: filePath });
      return { status: "done", text: result.value };
    }
    if (ext === ".xlsx" || ext === ".xls") {
      return { status: "done", text: xlsxToMarkdown(filePath) };
    }
    if (ext === ".pptx") {
      return { status: "done", text: pptxToMarkdown(filePath) };
    }
    // Other binary formats (video, images): stored and downloadable, not indexed.
    return { status: "unsupported", text: "" };
  } catch (err) {
    console.error(`extraction failed for ${filePath}:`, (err as Error).message);
    return { status: "failed", text: "" };
  }
}
