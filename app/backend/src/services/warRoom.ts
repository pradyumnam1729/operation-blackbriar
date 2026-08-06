import fs from "fs";
import path from "path";

// The war room is the knowledge base shared with the Claude Code workspace.
// Resolution order: WAR_ROOM_DIR env → ../../GTM-War-Room relative to this package.
export const WAR_ROOM_DIR =
  process.env.WAR_ROOM_DIR && process.env.WAR_ROOM_DIR.trim() !== ""
    ? path.resolve(process.env.WAR_ROOM_DIR)
    : path.resolve(__dirname, "..", "..", "..", "..", "GTM-War-Room");

export const REPO_ROOT = path.resolve(WAR_ROOM_DIR, "..");

const BRAND_DNA_FILES = [
  "BRAND-DNA/positioning-and-icp.md",
  "BRAND-DNA/brand-voice.md",
  "BRAND-DNA/our-customer.md",
  "BRAND-DNA/gtm-rules.md",
];

export function readWarRoomFile(relPath: string): string | null {
  const abs = path.resolve(WAR_ROOM_DIR, relPath);
  if (!abs.startsWith(WAR_ROOM_DIR)) return null; // no traversal outside the war room
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return fs.readFileSync(abs, "utf-8");
}

/**
 * Brand DNA — the minimum viable context (Master Instructions §4.1).
 * This is the STABLE prompt prefix: keep it byte-identical across requests so
 * the Anthropic prompt cache holds (see pmm-playbook/vol-7-ai-engineering).
 */
export function loadBrandDna(): string {
  const parts: string[] = [];
  for (const f of BRAND_DNA_FILES) {
    const content = readWarRoomFile(f);
    parts.push(
      content !== null
        ? `<file path="GTM-War-Room/${f}">\n${content}\n</file>`
        : `<file path="GTM-War-Room/${f}" status="MISSING" />`
    );
  }
  return parts.join("\n\n");
}

export interface WarRoomDoc {
  relPath: string;
  content: string;
}

/** Recursively load every markdown file in the war room (small corpus — whole-file retrieval). */
export function loadCorpus(subdir = ""): WarRoomDoc[] {
  const docs: WarRoomDoc[] = [];
  const start = path.resolve(WAR_ROOM_DIR, subdir);
  if (!fs.existsSync(start)) return docs;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".md")) {
        docs.push({
          relPath: path.relative(WAR_ROOM_DIR, abs).replace(/\\/g, "/"),
          content: fs.readFileSync(abs, "utf-8"),
        });
      }
    }
  };
  walk(start);
  return docs;
}
