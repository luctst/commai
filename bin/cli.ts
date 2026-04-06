import { Command } from "commander";
import { install, uninstall } from "../src/install.js";
import { generate } from "../src/generate.js";

const program = new Command();

program
  .name("commai")
  .description("Generate git commit messages using AI")
  .version("1.0.0");

program
  .command("install")
  .description("Install the prepare-commit-msg git hook in the current repo")
  .action(async () => {
    await install();
  });

program
  .command("uninstall")
  .description("Remove the commai git hook from the current repo")
  .action(async () => {
    await uninstall();
  });

program
  .command("generate")
  .description("Generate a commit message from staged changes")
  .argument("<file>", "Path to the commit message file")
  .requiredOption("--model <model>", "model to use with the <family>@<version> format e.g: sonnet@latest | haiku@4.0.25")
  .option("--no-interactive", "Skip interactive prompt, write message directly")
  .option(
    "--auto-commit",
    "Run git commit automatically after accepting the message",
    false,
  )
  .action(async (file: string, opts: Record<string, unknown>) => {
    await generate(file, {
      model: opts.model as string,
      interactive: opts.interactive as boolean,
      autoCommit: opts.autoCommit as boolean,
    });
  });

program.parse();
