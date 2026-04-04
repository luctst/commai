import Anthropic from "@anthropic-ai/sdk";
import type { AIService } from "./ai.js";
import * as logger from "../utils/logger.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 256;
const MAX_DIFF_CHARS = 100_000;

const SYSTEM_PROMPT = `You are a git commit message generator. Given a git diff of staged changes, write a concise, conventional commit message.

Rules:
- First line: imperative mood, max 72 characters, no period (e.g. "fix: correct off-by-one in pagination")
- Use conventional commit prefixes: feat, fix, refactor, docs, test, chore, style, perf
- Optionally add a blank line followed by a short body (2-3 lines max) if the change is complex
- Be specific and factual — describe what changed, not just that something changed
- Output ONLY the commit message, no explanation, no markdown formatting`;

export class ClaudeService implements AIService {
  private model: string;
  private client: Anthropic;

  constructor(model?: string, client?: Anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey && !client) {
      logger.error("ANTHROPIC_API_KEY environment variable is not set.");
      logger.warn(
        "Set it in your shell profile: export ANTHROPIC_API_KEY=sk-ant-...",
      );
      process.exit(1);
    }

    this.model = model ?? DEFAULT_MODEL;
    this.client = client ?? new Anthropic({ apiKey });
  }

  async generateCommitMessage(
    diff: string,
    instructions?: string,
  ): Promise<string> {
    const truncatedDiff =
      diff.length > MAX_DIFF_CHARS
        ? diff.slice(0, MAX_DIFF_CHARS) + "\n\n[diff truncated]"
        : diff;

    let userMessage = `Generate a commit message for this diff:\n\n${truncatedDiff}`;

    if (instructions) {
      userMessage += `\n\nAdditional instructions: ${instructions}`;
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock ? textBlock.text.trim() : "";
  }
}
