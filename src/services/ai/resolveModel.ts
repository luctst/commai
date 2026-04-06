import { type AIProvider } from "../../types.js";
import { FAMILY_TO_PROVIDER } from "./familyProvider.js";

/**
 * Resolves a model input string to its AI provider name.
 * - Alias format: "sonnet@latest" → extracts family, looks up provider
 * - Raw model ID: "claude-sonnet-4-20250514" → scans for known family substring
 * - Throws if no known family is found
 */
export function resolveProvider(input: string): AIProvider {
  if (input.includes("@")) {
    const [family] = input.split("@", 1);
    const provider = FAMILY_TO_PROVIDER[family.toLowerCase()];
    if (!provider) {
      throw new Error(
        `Unknown model family: "${family}". Known families: ${Object.keys(FAMILY_TO_PROVIDER).join(", ")}`,
      );
    }
    return provider;
  }

  for (const [family, provider] of Object.entries(FAMILY_TO_PROVIDER)) {
    if (input.toLowerCase().includes(family)) {
      return provider;
    }
  }

  throw new Error(
    `Cannot determine provider for model: "${input}". Known families: ${Object.keys(FAMILY_TO_PROVIDER).join(", ")}`,
  );
}
