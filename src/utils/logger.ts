import chalk from "chalk";

/**
 * Writes to stdout — general info and success messages.
 * ✔ message
 */
export function log(message: string): void {
  process.stdout.write(chalk.green("✔") + " " + message + "\n");
}

/**
 * Writes to stderr — error messages.
 * ✖ message
 */
export function error(message: string): void {
  process.stderr.write(chalk.red("✖") + " " + chalk.red(message) + "\n");
}

/**
 * Writes to stderr — warnings.
 * ⚠ message
 */
export function warn(message: string): void {
  process.stderr.write(chalk.yellow("⚠") + " " + chalk.yellow(message) + "\n");
}

/**
 * Writes to stderr — only when DEBUG=1 is set in the environment.
 * › message
 */
export function debug(message: string): void {
  if (process.env.DEBUG === "1") {
    process.stderr.write(chalk.gray("›") + " " + chalk.gray(message) + "\n");
  }
}

/**
 * Writes to stderr — interactive UI output (prompts, menus, generated message display).
 * Uses stderr intentionally so it does not pollute stdout when output is piped.
 * Plain write — no prefix, caller controls formatting.
 */
export function ui(message: string): void {
  process.stderr.write(message + "\n");
}
