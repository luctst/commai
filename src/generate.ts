import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getRepoRoot, getStagedDiff, commit as gitCommit } from "./git.js";
import { createAIService } from "./services/ai/ai.js";
import { resolveProvider } from "./services/ai/resolveModel.js";
import { promptUserForAction } from "./prompt.js";
import {
  type AIService,
  type CommaiConfig,
  type GenerateOptions,
} from "./types.js";
import * as logger from "./utils/logger.js";

const COMMAI_DIR = ".commai";
const CONFIG_FILE = ".config";

async function loadConfig(): Promise<CommaiConfig> {
  const repoRoot = await getRepoRoot();
  const configPath = join(repoRoot, COMMAI_DIR, CONFIG_FILE);
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw) as CommaiConfig;
}

export async function generate(
  commitMsgFile: string,
  opts?: GenerateOptions,
): Promise<void> {
  let model: string;
  let interactive: boolean;
  let autoCommit: boolean;
  let service: AIService | undefined = opts?.service;

  if (service && opts?.model) {
    // Test path — all values provided directly
    model = opts.model;
    interactive = opts.interactive ?? false;
    autoCommit = opts.autoCommit ?? false;
  } else {
    // Normal path — read from .commai/.config
    let config: CommaiConfig;
    try {
      config = await loadConfig();
    } catch {
      logger.error(
        "commai is not installed. Run 'commai install --model <model>' first.",
      );
      process.exit(1);
    }
    model = opts?.model ?? config.model;
    interactive = opts?.interactive ?? config.interactive;
    autoCommit = opts?.autoCommit ?? config.autoCommit;
  }

  // 1. Read staged diff
  let diff: string;
  try {
    diff = await getStagedDiff();
  } catch {
    // Not in a git repo or git failed — exit silently
    return;
  }

  if (!diff) {
    // No staged changes — let git proceed
    return;
  }

  // 2. Check if commit file already has user content
  let existingContent = "";
  try {
    existingContent = await readFile(commitMsgFile, "utf8");
  } catch {
    // File might not exist — not fatal
  }

  const nonCommentLines = existingContent
    .split("\n")
    .filter((line) => !line.startsWith("#") && line.trim() !== "");

  if (nonCommentLines.length > 0) {
    // User already typed a message — don't overwrite
    return;
  }

  // 3. Create AI service
  if (!service) {
    try {
      service = createAIService(resolveProvider(model), { model });
    } catch (err) {
      logger.error((err as Error).message);
      return;
    }
  }

  // 4. Generate message
  let message: string;
  try {
    message = await service.generateCommitMessage(diff);
  } catch (err) {
    logger.error(`AI call failed: ${(err as Error).message}`);
    return;
  }

  // 5. Interactive or direct mode
  if (interactive) {
    let done = false;
    while (!done) {
      const result = await promptUserForAction(message);

      switch (result.action) {
        case "accept":
          done = true;
          break;

        case "regenerate":
          try {
            message = await service.generateCommitMessage(
              diff,
              result.instructions,
            );
          } catch (err) {
            logger.error(`AI call failed: ${(err as Error).message}`);
            return;
          }
          break;

        case "cancel":
          return;
      }
    }
  }

  // 6. Write the message
  // Preserve existing # comment lines (branch info, diff stats, etc.)
  const comments = existingContent
    .split("\n")
    .filter((line) => line.startsWith("#"))
    .join("\n");

  const finalContent = comments
    ? `${message}\n\n${comments}\n`
    : `${message}\n`;

  if (autoCommit) {
    await gitCommit(message);
  } else {
    await writeFile(commitMsgFile, finalContent, "utf8");
  }
}
