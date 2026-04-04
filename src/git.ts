import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Returns the absolute path to the root of the current git repo.
 * Throws if not inside a git repo.
 */
export async function getRepoRoot(): Promise<string> {
  const { stdout } = await execFileAsync("git", [
    "rev-parse",
    "--show-toplevel",
  ]);
  return stdout.trim();
}

/**
 * Returns the staged diff as a string.
 * Returns empty string if nothing is staged.
 */
export async function getStagedDiff(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["diff", "--cached"]);
  return stdout.trim();
}

/**
 * Commits with the given message using git commit -m.
 */
export async function commit(message: string): Promise<void> {
  await execFileAsync("git", ["commit", "-m", message]);
}
