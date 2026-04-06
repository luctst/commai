import { ClaudeService } from "./claude/claude.js";
import { type AIProvider } from "./resolveModel.js";

export interface AIService {
  generateCommitMessage(diff: string, instructions?: string): Promise<string>;
}

export const MAX_TOKENS = 256;
export const MAX_DIFF_CHARS = 100_000;
export const USER_MESSAGE = "Generate a commit message for this diff:";
export const SYSTEM_PROMPT = `You are a git commit message generator. Given a git diff of staged changes, write a concise, conventional commit message.

Rules:
- First line: imperative mood, max 72 characters, no period (e.g. "fix: correct off-by-one in pagination")
- Use conventional commit prefixes: feat, fix, refactor, docs, test, chore, style, perf
- Optionally add a blank line followed by a short body (2-3 lines max) if the change is complex
- Be specific and factual — describe what changed, not just that something changed
- Output ONLY the commit message, no explanation, no markdown formatting`;

export type { AIProvider };

export function createAIService(
  provider: AIProvider,
  options: { model?: string } = {},
): AIService {
  switch (provider) {
    case "claude":
      return new ClaudeService(options.model);
    default:
      throw new Error(
        `Unknown AI provider: "${provider}".`,
      );
  }
}
