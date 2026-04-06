/** AI provider identifier — add new provider strings here as they are supported. */
export type AIProvider = "claude";

/** Minimal contract every AI service must implement. */
export interface AIService {
  generateCommitMessage(diff: string, instructions?: string): Promise<string>;
}

/** Options accepted by the generate() command. */
export interface GenerateOptions {
  model: string;
  interactive: boolean;
  autoCommit: boolean;
  /** Injected AI service for testing */
  service?: AIService;
}

/** Result of the interactive prompt loop. */
export type PromptAction =
  | { action: "accept" }
  | { action: "regenerate"; instructions?: string }
  | { action: "cancel" };
