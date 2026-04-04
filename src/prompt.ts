import { createInterface, type Interface } from "node:readline";
import chalk from "chalk";
import * as logger from "./utils/logger.js";

export type PromptAction =
  | { action: "accept" }
  | { action: "regenerate"; instructions?: string }
  | { action: "cancel" };

function ask(rl: Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Display the generated message and prompt the user to accept, regenerate, or cancel.
 * Accepts an optional readline interface for testing.
 */
export async function promptUserForAction(
  message: string,
  rl?: Interface,
): Promise<PromptAction> {
  const ownRl = !rl;

  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: process.stderr, // stderr so it doesn't pollute stdout if piped
      terminal: true,
    });
  }

  try {
    const divider = chalk.gray("─".repeat(40));

    logger.ui("");
    logger.ui(chalk.bold("Generated commit message:"));
    logger.ui(divider);
    logger.ui(chalk.cyan(message));
    logger.ui(divider);
    logger.ui("");
    logger.ui(`  ${chalk.green("(a)")} Accept`);
    logger.ui(`  ${chalk.yellow("(r)")} Regenerate`);
    logger.ui(`  ${chalk.red("(c)")} Cancel`);
    logger.ui("");

    const choice = await ask(rl, chalk.bold("> "));

    switch (choice.toLowerCase()) {
      case "a":
        return { action: "accept" };

      case "r": {
        const instructions = await ask(
          rl,
          chalk.gray("Additional instructions (press Enter to skip): "),
        );
        return {
          action: "regenerate",
          instructions: instructions || undefined,
        };
      }

      case "c":
        return { action: "cancel" };

      default:
        logger.warn(`Unknown choice "${choice}", defaulting to cancel.`);
        return { action: "cancel" };
    }
  } finally {
    if (ownRl) {
      rl.close();
    }
  }
}
