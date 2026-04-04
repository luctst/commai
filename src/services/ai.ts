import { ClaudeService } from "./claude.js";

export interface AIService {
  generateCommitMessage(diff: string, instructions?: string): Promise<string>;
}

export type AIProvider = "claude";

export function createAIService(
  provider: AIProvider,
  options: { model?: string } = {},
): AIService {
  switch (provider) {
    case "claude":
      return new ClaudeService(options.model);
    default:
      throw new Error(
        `Unknown AI provider: "${provider}". Available providers: claude`,
      );
  }
}
