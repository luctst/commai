import Anthropic from "@anthropic-ai/sdk";
import { type AIService } from "../../../types.js";
import {
  MAX_TOKENS,
  MAX_DIFF_CHARS,
  SYSTEM_PROMPT,
  USER_MESSAGE,
} from "../ai.js";
import * as logger from "../../../utils/logger.js";

const DEFAULT_MODEL = "haiku@latest";

export class ClaudeService implements AIService {
  private modelInput: string;
  private resolvedModel?: string;
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

    this.modelInput = model ?? DEFAULT_MODEL;
    this.client = client ?? new Anthropic({ apiKey });
  }

  private async resolveClaudeModel(input: string): Promise<string> {
    const [family, version] = input.split("@", 2);
    const page = await this.client.models.list();

    const matching = page.data
      .filter((m) => m.id.toLowerCase().includes(family.toLowerCase()))
      .filter((m) =>
        version === "latest" ? true : m.id.includes(version.replace(".", "-")),
      );

    if (matching.length === 0) return input;
    matching.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return matching[0].id;
  }

  private async getModel(): Promise<string> {
    if (!this.resolvedModel) {
      try {
        this.resolvedModel = await this.resolveClaudeModel(this.modelInput);
      } catch {
        logger.warn("Could not resolve model alias, using as-is.");
        this.resolvedModel = this.modelInput;
      }
    }
    return this.resolvedModel;
  }

  async generateCommitMessage(
    diff: string,
    instructions?: string,
  ): Promise<string> {
    const truncatedDiff =
      diff.length > MAX_DIFF_CHARS
        ? diff.slice(0, MAX_DIFF_CHARS) + "\n\n[diff truncated]"
        : diff;

    let userMessage = `${USER_MESSAGE}\n\n${truncatedDiff}`;

    if (instructions) {
      userMessage += `\n\nAdditional instructions: ${instructions}`;
    }

    const response = await this.client.messages.create({
      model: await this.getModel(),
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock ? textBlock.text.trim() : "";
  }
}
