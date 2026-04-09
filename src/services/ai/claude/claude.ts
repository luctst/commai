import { type AIService, type FetchFn } from "../../../types.js";
import {
  MAX_TOKENS,
  MAX_DIFF_CHARS,
  SYSTEM_PROMPT,
  USER_MESSAGE,
} from "../ai.js";
import * as logger from "../../../utils/logger.js";

const DEFAULT_MODEL = "haiku@latest";
const API_BASE = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";

/** Minimal types for the Anthropic API responses we use. */
interface ModelsResponse {
  data: Array<{ id: string; created_at: string }>;
}

interface MessagesResponse {
  content: Array<{ type: string; text?: string }>;
}

export class ClaudeService implements AIService {
  private modelInput: string;
  private resolvedModel?: string;
  private apiKey: string;
  private fetchFn: FetchFn;

  constructor(model?: string, fetchFn?: FetchFn) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey && !fetchFn) {
      logger.error("ANTHROPIC_API_KEY environment variable is not set.");
      logger.warn(
        "Set it in ~/.commai/.env or a .env in your project root (ANTHROPIC_API_KEY=sk-ant-...)" +
          ", or export it in your shell profile.",
      );
      process.exit(1);
    }

    this.apiKey = apiKey ?? "";
    this.modelInput = model ?? DEFAULT_MODEL;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {
      "x-api-key": this.apiKey,
      "anthropic-version": API_VERSION,
    };
    if (json) h["content-type"] = "application/json";
    return h;
  }

  private async resolveClaudeModel(input: string): Promise<string> {
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
    matching.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return matching[0].id;
  }

  private async getModel(): Promise<string> {
    if (!this.resolvedModel) {
      // Raw model ID (no @) — use as-is, skip the models.list() call
      if (!this.modelInput.includes("@")) {
        this.resolvedModel = this.modelInput;
      } else {
        try {
          this.resolvedModel = await this.resolveClaudeModel(this.modelInput);
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

    const res = await this.fetchFn(`${API_BASE}/messages`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({
        model: await this.getModel(),
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "unknown error");
      throw new Error(`Anthropic API error (${res.status}): ${errorText}`);
    }

    const body = (await res.json()) as MessagesResponse;
    const textBlock = body.content.find((block) => block.type === "text");
    return textBlock?.text?.trim() ?? "";
  }
}
