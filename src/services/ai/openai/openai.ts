import { type AIService, type FetchFn } from "../../../types.js";
import {
  MAX_TOKENS,
  MAX_DIFF_CHARS,
  SYSTEM_PROMPT,
  USER_MESSAGE,
} from "../ai.js";
import * as logger from "../../../utils/logger.js";

const DEFAULT_MODEL = "gpt@latest";
const API_BASE = "https://api.openai.com/v1";

/** Minimal types for the OpenAI API responses we use. */
interface ModelsResponse {
  data: Array<{ id: string; created: number }>;
}

interface ChatCompletionResponse {
  choices: Array<{ message?: { content: string | null } }>;
}

export class OpenAIService implements AIService {
  private modelInput: string;
  private resolvedModel?: string;
  private apiKey: string;
  private fetchFn: FetchFn;

  constructor(model?: string, fetchFn?: FetchFn) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && !fetchFn) {
      logger.error("OPENAI_API_KEY environment variable is not set.");
      logger.warn(
        "Set it in ~/.commai/.env or a .env in your project root (OPENAI_API_KEY=sk-...)" +
          ", or export it in your shell profile.",
      );
      process.exit(1);
    }

    this.apiKey = apiKey ?? "";
    this.modelInput = model ?? DEFAULT_MODEL;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
    };
  }

  private async resolveOpenAIModel(input: string): Promise<string> {
    const [family, version] = input.split("@", 2);

    const res = await this.fetchFn(`${API_BASE}/models`, {
      headers: this.headers(),
    });
    if (!res.ok) return input;

    const body = (await res.json()) as ModelsResponse;
    const matching = body.data
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
      // Raw model ID (no @) — use as-is, skip the models.list() call
      if (!this.modelInput.includes("@")) {
        this.resolvedModel = this.modelInput;
      } else {
        try {
          this.resolvedModel = await this.resolveOpenAIModel(this.modelInput);
        } catch {
          logger.warn("Could not resolve model alias, using as-is.");
          this.resolvedModel = this.modelInput;
        }
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

    const res = await this.fetchFn(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: await this.getModel(),
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "unknown error");
      throw new Error(`OpenAI API error (${res.status}): ${errorText}`);
    }

    const body = (await res.json()) as ChatCompletionResponse;
    const content = body.choices[0]?.message?.content;
    return content ? content.trim() : "";
  }
}
