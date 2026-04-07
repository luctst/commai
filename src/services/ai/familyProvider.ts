import { type AIProvider } from "../../types.js";

/** Maps model family names to their AI provider. Add new providers here. */
export const FAMILY_TO_PROVIDER: Readonly<Record<string, AIProvider>> = {
  sonnet: "claude",
  opus: "claude",
  haiku: "claude",
  gpt: "openai",
  o: "openai",
};
