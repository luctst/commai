import { Command } from "commander";
import { install, uninstall } from "../src/install.js";
import { generate } from "../src/generate.js";
import { GenerateOptions } from "../src/types.js";

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
  .option("--interactive", "interactive prompt ask for confirmation, regenerate message or cancel process", true)
  .option(
    "--auto-commit",
    "Run git commit automatically after accepting the message",
    false,
  )
  .action(async (file: string, opts: GenerateOptions) => {
    await generate(file, {
      model: opts.model,
      interactive: opts.interactive,
      autoCommit: opts.autoCommit,
    });
  });

program.parse();
