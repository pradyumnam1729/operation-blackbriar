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
  const lower = text.toLowerCase();
  const violations = loadForbiddenWords().filter((w) =>
    lower.includes(w.toLowerCase())
  );
  return { ok: violations.length === 0, violations };
}
