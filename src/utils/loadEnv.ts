import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Parses a .env file into a key/value map.
 *
 * Rules:
 *   - Lines beginning with # (after optional leading whitespace) are comments
 *   - Blank / whitespace-only lines are skipped
 *   - Each valid line must contain '='; everything before the first '=' is the key
 *   - Keys are trimmed; values are trimmed, then optionally unquoted
 *   - Matching surrounding quotes (" or ') are stripped from values
 *   - Inline comments are NOT stripped (value may contain '#')
 */
function parseEnvFile(content: string): Map<string, string> {
  const result = new Map<string, string>();

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    if (key === "") continue;

    let value = line.slice(eqIndex + 1).trim();

    // Strip matching surrounding quotes
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' || first === "'") && first === last) {
        value = value.slice(1, -1);
      }
    }

    result.set(key, value);
  }

  return result;
}

/**
 * Reads a .env file and applies its key/value pairs to process.env.
 * Keys already present in process.env are never overwritten (shell wins).
 * Missing files are silently ignored.
 */
function applyEnvFile(filePath: string): void {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }

  for (const [key, value] of parseEnvFile(content)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Loads environment variables from:
 *   1. ~/.commai/.env  (user-level global, lower precedence)
 *   2. .env            (project-level, cwd, higher precedence)
 *
 * Shell environment always wins over both.
 * Missing files are silently skipped.
 */
export function loadEnv(): void {
  applyEnvFile(join(process.cwd(), ".env")); // project — higher precedence (applied first)
  applyEnvFile(join(homedir(), ".commai", ".env")); // global — fills in anything project didn't set
}
