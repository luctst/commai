import OpenAI from "openai";
import { type AIService } from "../../../types.js";
import {
  MAX_TOKENS,
  MAX_DIFF_CHARS,
  SYSTEM_PROMPT,
  USER_MESSAGE,
} from "../ai.js";
import * as logger from "../../../utils/logger.js";

const DEFAULT_MODEL = "gpt@latest";

export class OpenAIService implements AIService {
  private modelInput: string;
  private resolvedModel?: string;
  private client: OpenAI;

  constructor(model?: string, client?: OpenAI) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && !client) {
      logger.error("OPENAI_API_KEY environment variable is not set.");
      logger.warn(
        "Set it in ~/.commai/.env or a .env in your project root (OPENAI_API_KEY=sk-...)" +
          ", or export it in your shell profile.",
      );
      process.exit(1);
    }

    this.modelInput = model ?? DEFAULT_MODEL;
    this.client = client ?? new OpenAI({ apiKey });
  }

  private async resolveOpenAIModel(input: string): Promise<string> {
    const [family, version] = input.split("@", 2);

    const models: OpenAI.Models.Model[] = [];
    for await (const model of this.client.models.list()) {
      models.push(model);
    }

    const matching = models
      .filter((m) => m.id.toLowerCase().includes(family.toLowerCase()))
      .filter((m) =>
        version === "latest" ? true : m.id.includes(version.replace(".", "-")),
      );

    if (matching.length === 0) return input;
    matching.sort((a, b) => b.created - a.created);
    return matching[0].id;
  }

  private async getModel(): Promise<string> {
    if (!this.resolvedModel) {
      try {
        this.resolvedModel = await this.resolveOpenAIModel(this.modelInput);
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

    const response = await this.client.chat.completions.create({
      model: await this.getModel(),
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return content ? content.trim() : "";
  }
}
