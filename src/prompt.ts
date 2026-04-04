import { createInterface, type Interface } from "node:readline";

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
    console.error("\nGenerated commit message:");
    console.error("─".repeat(40));
    console.error(message);
    console.error("─".repeat(40));
    console.error("");
    console.error("  (a) Accept");
    console.error("  (r) Regenerate");
    console.error("  (c) Cancel");
    console.error("");

    const choice = await ask(rl, "> ");

    switch (choice.toLowerCase()) {
      case "a":
        return { action: "accept" };

      case "r": {
        const instructions = await ask(
          rl,
          "Additional instructions (press Enter to skip): ",
        );
        return {
          action: "regenerate",
          instructions: instructions || undefined,
        };
      }

      case "c":
        return { action: "cancel" };

      default:
        console.error(`Unknown choice "${choice}", defaulting to cancel.`);
        return { action: "cancel" };
    }
  } finally {
    if (ownRl) {
      rl.close();
    }
  }
}
