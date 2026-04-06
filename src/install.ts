import { writeFile, rm, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  getRepoRoot,
  getGitConfig,
  setGitConfig,
  unsetGitConfig,
} from "./git.js";
import * as logger from "./utils/logger.js";
import type { CommaiConfig } from "./types.js";

const HOOK_MARKER = "# managed-by-commai";
const COMMAI_DIR = ".commai";
const CONFIG_FILE = ".config";

const STANDARD_HOOKS = [
  "pre-commit",
  "commit-msg",
  "post-commit",
  "pre-push",
  "pre-rebase",
  "post-checkout",
  "post-merge",
  "post-rewrite",
  "pre-auto-gc",
  "applypatch-msg",
  "pre-applypatch",
  "post-applypatch",
];

const PREPARE_COMMIT_MSG_CONTENT = `#!/bin/sh
${HOOK_MARKER}
case "$2" in
  amend|merge|squash) exit 0 ;;
esac
commai generate "$1"
[ -x ".husky/prepare-commit-msg" ] && exec ".husky/prepare-commit-msg" "$@"
[ -x ".git/hooks/prepare-commit-msg" ] && exec ".git/hooks/prepare-commit-msg" "$@"
exit 0
`;

function forwarderContent(hookName: string): string {
  return `#!/bin/sh
[ -x ".husky/${hookName}" ] && exec ".husky/${hookName}" "$@"
[ -x ".git/hooks/${hookName}" ] && exec ".git/hooks/${hookName}" "$@"
exit 0
`;
}

export async function install(
  opts: Pick<CommaiConfig, "model" | "interactive" | "autoCommit">,
): Promise<void> {
  let repoRoot: string;
  try {
    repoRoot = await getRepoRoot();
  } catch {
    logger.error("Not inside a git repository.");
    process.exit(1);
  }

  const commaiDir = join(repoRoot, COMMAI_DIR);
  const hookPath = join(commaiDir, "prepare-commit-msg");

  try {
    const existing = await readFile(hookPath, "utf8");
    if (!existing.includes(HOOK_MARKER)) {
      logger.error(
        "A .commai/ directory already exists and was not created by commai.",
      );
      process.exit(1);
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  const prevHooksPath = (await getGitConfig("core.hooksPath")) ?? "";

  await mkdir(commaiDir, { recursive: true });
  await writeFile(hookPath, PREPARE_COMMIT_MSG_CONTENT, { mode: 0o755 });

  for (const hook of STANDARD_HOOKS) {
    await writeFile(join(commaiDir, hook), forwarderContent(hook), {
      mode: 0o755,
    });
  }

  const config: CommaiConfig = {
    prevHooksPath,
    model: opts.model,
    interactive: opts.interactive,
    autoCommit: opts.autoCommit,
  };
  await writeFile(join(commaiDir, CONFIG_FILE), JSON.stringify(config) + "\n");

  await setGitConfig("core.hooksPath", COMMAI_DIR);

  logger.log(`Hooks installed in ${commaiDir}`);
  logger.warn("Make sure ANTHROPIC_API_KEY is set in your environment.");
}

export async function uninstall(): Promise<void> {
  let repoRoot: string;
  try {
    repoRoot = await getRepoRoot();
  } catch {
    logger.error("Not inside a git repository.");
    process.exit(1);
  }

  const commaiDir = join(repoRoot, COMMAI_DIR);
  const hookPath = join(commaiDir, "prepare-commit-msg");

  let existing: string;
  try {
    existing = await readFile(hookPath, "utf8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      logger.error("No commai hooks found — nothing to uninstall.");
      process.exit(1);
    }
    throw err;
  }

  if (!existing.includes(HOOK_MARKER)) {
    logger.error(
      "The .commai/ directory was not created by commai. Refusing to delete it.",
    );
    process.exit(1);
  }

  let prevHooksPath = "";
  try {
    const configRaw = await readFile(join(commaiDir, CONFIG_FILE), "utf8");
    const config = JSON.parse(configRaw);
    prevHooksPath = config.prevHooksPath ?? "";
  } catch {
    // Config missing or malformed — treat as empty previous path
  }

  await rm(commaiDir, { recursive: true });

  if (prevHooksPath) {
    await setGitConfig("core.hooksPath", prevHooksPath);
  } else {
    await unsetGitConfig("core.hooksPath");
  }

  logger.log("Hooks removed.");
}
