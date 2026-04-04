import { writeFile, rm, access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getRepoRoot } from "./git.js";

const HOOK_MARKER = "# managed-by-commai";

const HOOK_CONTENT = `#!/bin/sh
${HOOK_MARKER}
# Args: $1=commit-msg-file, $2=source-type, $3=sha-if-amend
# Skip if amending, merging, or squashing
case "$2" in
  amend|merge|squash) exit 0 ;;
esac

commai generate "$1"
`;

export async function install(): Promise<void> {
  let repoRoot: string;
  try {
    repoRoot = await getRepoRoot();
  } catch {
    console.error("Error: not inside a git repository.");
    process.exit(1);
  }

  const hookPath = join(repoRoot, ".git", "hooks", "prepare-commit-msg");

  // Check if a hook already exists and is not ours
  try {
    await access(hookPath);
    const existing = await readFile(hookPath, "utf8");
    if (!existing.includes(HOOK_MARKER)) {
      console.error(
        "Error: a prepare-commit-msg hook already exists and was not created by commai.",
      );
      console.error(`Manual review required: ${hookPath}`);
      process.exit(1);
    }
    // It's ours — overwrite (idempotent upgrade)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
    // File doesn't exist — proceed to create
  }

  await writeFile(hookPath, HOOK_CONTENT, { mode: 0o755 });
  console.log(`Hook installed at ${hookPath}`);
  console.log("Make sure ANTHROPIC_API_KEY is set in your environment.");
}

export async function uninstall(): Promise<void> {
  let repoRoot: string;
  try {
    repoRoot = await getRepoRoot();
  } catch {
    console.error("Error: not inside a git repository.");
    process.exit(1);
  }

  const hookPath = join(repoRoot, ".git", "hooks", "prepare-commit-msg");

  try {
    const existing = await readFile(hookPath, "utf8");
    if (!existing.includes(HOOK_MARKER)) {
      console.error(
        "Error: the hook at this path was not created by commai. Refusing to delete it.",
      );
      process.exit(1);
    }
    await rm(hookPath);
    console.log("Hook removed.");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("No hook found — nothing to uninstall.");
    } else {
      throw err;
    }
  }
}
