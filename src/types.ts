/** AI provider identifier — add new provider strings here as they are supported. */
export type AIProvider = "claude";

/** Minimal contract every AI service must implement. */
export interface AIService {
  generateCommitMessage(diff: string, instructions?: string): Promise<string>;
}

/** Shape of .commai/.config — single source of truth for generate options. */
export interface CommaiConfig {
  prevHooksPath: string;
  model: string;
  interactive: boolean;
  autoCommit: boolean;
}

/** Options accepted by the generate() command (test-only overrides). */
export interface GenerateOptions {
  /** Injected AI service for testing */
  service?: AIService;
  /** Override config values for testing */
  model?: string;
  interactive?: boolean;
  autoCommit?: boolean;
}

/** Result of the interactive prompt loop. */
export type PromptAction =
  | { action: "accept" }
  | { action: "regenerate"; instructions?: string }
  | { action: "cancel" };
