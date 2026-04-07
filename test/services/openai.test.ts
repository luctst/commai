import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OpenAIService } from "../../src/services/ai/openai/openai.js";

/** Creates a mock OpenAI client */
function createMockClient(responseText: string) {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: responseText } }],
        }),
      },
    },
    models: {
      list: async function* () {
        yield { id: "gpt-4o-2025-01-01", created: 1 };
      },
    },
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("OpenAIService", () => {
  it("returns the generated commit message", async () => {
    const client = createMockClient("feat: add user login");
    const service = new OpenAIService("gpt-4o", client);

    const result = await service.generateCommitMessage("diff content here");
    assert.equal(result, "feat: add user login");
  });

  it("trims whitespace from the response", async () => {
    const client = createMockClient("  fix: remove trailing spaces  \n");
    const service = new OpenAIService("gpt-4o", client);

    const result = await service.generateCommitMessage("diff");
    assert.equal(result, "fix: remove trailing spaces");
  });

  it("appends instructions to the prompt when provided", async () => {
    let capturedMessages: unknown;
    const client = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            capturedMessages = params.messages;
            return {
              choices: [
                { message: { content: "refactor: simplify auth logic" } },
              ],
            };
          },
        },
      },
      models: {
        list: async function* () {
          yield { id: "gpt-4o-2025-01-01", created: 1 };
        },
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const service = new OpenAIService("gpt-4o", client);
    await service.generateCommitMessage("diff", "focus on the auth changes");

    const messages = capturedMessages as Array<{
      role: string;
      content: string;
    }>;
    // messages[0] is system, messages[1] is user
    assert.ok(
      messages[1].content.includes(
        "Additional instructions: focus on the auth changes",
      ),
    );
  });

  it("truncates very long diffs", async () => {
    let capturedContent: string = "";
    const client = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            const msgs = params.messages as Array<{
              role: string;
              content: string;
            }>;
            capturedContent = msgs[1].content;
            return {
              choices: [{ message: { content: "chore: large change" } }],
            };
          },
        },
      },
      models: {
        list: async function* () {
          yield { id: "gpt-4o-2025-01-01", created: 1 };
        },
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const service = new OpenAIService("gpt-4o", client);
    const longDiff = "x".repeat(200_000);
    await service.generateCommitMessage(longDiff);

    assert.ok(capturedContent.includes("[diff truncated]"));
    assert.ok(capturedContent.length < 200_000);
  });

  it("returns empty string when response has no content", async () => {
    const client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: null } }],
          }),
        },
      },
      models: {
        list: async function* () {
          yield { id: "gpt-4o-2025-01-01", created: 1 };
        },
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const service = new OpenAIService("gpt-4o", client);
    const result = await service.generateCommitMessage("diff");
    assert.equal(result, "");
  });
});
