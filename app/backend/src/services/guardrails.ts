import fs from "fs";
import path from "path";
import { REPO_ROOT } from "./warRoom";

// Deterministic layer of the voice guard — same list the Claude Code
// PostToolUse hook uses (.claude/hooks/forbidden-words.txt). Model judgment is
// never the only line of defense for brand compliance.
function loadForbiddenWords(): string[] {
  const p = path.resolve(REPO_ROOT, ".claude", "hooks", "forbidden-words.txt");
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf-8")
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

export interface GuardrailResult {
  ok: boolean;
  violations: string[];
}

export function checkForbiddenWords(text: string): GuardrailResult {
  // Mention vs. use: a quoted occurrence ("the retired \"public agencies\"
  // phrasing is banned") is documentation or a verbatim customer quote, not a
  // voice violation — terminology glossaries would otherwise block their own
  // approval forever. Quoted spans are stripped before the scan; unquoted
  // usage is still caught.
  const unquoted = text
    .replace(/"[^"\n]{1,200}"/g, " ")
    .replace(/[“][^“”\n]{1,200}[”]/g, " ")
    .toLowerCase();
  const violations = loadForbiddenWords().filter((w) =>
    unquoted.includes(w.toLowerCase())
  );
  return { ok: violations.length === 0, violations };
}
