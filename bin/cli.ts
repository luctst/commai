import { loadEnv } from "../src/utils/loadEnv.js";
import { Command } from "commander";
import { install, uninstall } from "../src/install.js";
import { generate } from "../src/generate.js";

loadEnv();

const program = new Command();

program
  .name("commai")
  .description("Generate git commit messages using AI")
  .version("0.1.0");

program
  .command("install")
  .description("Install the prepare-commit-msg git hook in the current repo")
  .requiredOption(
    "--model <model>",
    "model to use with the <family>@<version> format e.g: sonnet@latest | haiku@4.0.25",
  )
  .option(
    "--interactive",
    "interactive prompt ask for confirmation, regenerate message or cancel process",
    true,
  )
  .option(
    "--auto-commit",
    "Run git commit automatically after accepting the message",
    false,
  )
  .action(
    async (opts: {
      model: string;
      interactive: boolean;
      autoCommit: boolean;
    }) => {
      await install({
        model: opts.model,
        interactive: opts.interactive,
        autoCommit: opts.autoCommit,
      });
    },
  );

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
  .action(async (file: string) => {
    await generate(file);
  });

program.parseAsync().catch((err: Error) => {
  process.stderr.write(`commai: ${err.message}\n`);
  process.exitCode = 1;
});
