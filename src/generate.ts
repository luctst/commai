import { readFile, writeFile } from "node:fs/promises";
import { getStagedDiff, commit as gitCommit } from "./git.js";
import { createAIService } from "./services/ai/ai.js";
import { resolveProvider } from "./services/ai/resolveModel.js";
import { promptUserForAction } from "./prompt.js";
import { type AIService, type GenerateOptions } from "./types.js";
import * as logger from "./utils/logger.js";

export async function generate(
  commitMsgFile: string,
  opts: GenerateOptions,
): Promise<void> {
  const { model, interactive, autoCommit } = opts;

  // 1. Read staged diff
  let diff: string;
  try {
    diff = await getStagedDiff();
  } catch {
    // Not in a git repo or git failed — exit silently
    process.exit(0);
  }

  if (!diff) {
    // No staged changes — let git proceed
    process.exit(0);
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
    process.exit(0);
  }

  // 3. Create AI service
  let service: AIService;
  try {
    service =
      opts.service ?? createAIService(resolveProvider(model), { model });
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  // 4. Generate message
  let message: string;
  try {
    message = await service.generateCommitMessage(diff);
  } catch (err) {
    logger.error(`AI call failed: ${(err as Error).message}`);
    process.exit(1);
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
            process.exit(0);
          }
          break;

        case "cancel":
          process.exit(0);
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
