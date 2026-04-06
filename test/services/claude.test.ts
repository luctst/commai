import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClaudeService } from "../../src/services/ai/claude/claude.js";

/** Creates a mock Anthropic client */
function createMockClient(responseText: string) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text" as const, text: responseText }],
      }),
    },
    models: {
      list: async () => ({
        data: [{ id: "claude-sonnet-4-6", created_at: 1 }],
      }),
    },
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("ClaudeService", () => {
  it("returns the generated commit message", async () => {
    const client = createMockClient("feat: add user login");
    const service = new ClaudeService("claude-sonnet-4-20250514", client);

    const result = await service.generateCommitMessage("diff content here");
    assert.equal(result, "feat: add user login");
  });

  it("trims whitespace from the response", async () => {
    const client = createMockClient("  fix: remove trailing spaces  \n");
    const service = new ClaudeService("claude-sonnet-4-20250514", client);

    const result = await service.generateCommitMessage("diff");
    assert.equal(result, "fix: remove trailing spaces");
  });

  it("appends instructions to the prompt when provided", async () => {
    let capturedMessages: unknown;
    const client = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          capturedMessages = params.messages;
          return {
            content: [{ type: "text", text: "refactor: simplify auth logic" }],
          };
        },
      },
      models: {
        list: async () => ({
          data: [{ id: "claude-sonnet-4-6", created_at: 1 }],
        }),
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const service = new ClaudeService("claude-sonnet-4-20250514", client);
    await service.generateCommitMessage("diff", "focus on the auth changes");

    const messages = capturedMessages as Array<{
      role: string;
      content: string;
    }>;
    assert.ok(
      messages[0].content.includes(
        "Additional instructions: focus on the auth changes",
      ),
    );
  });

  it("truncates very long diffs", async () => {
    let capturedContent: string = "";
    const client = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          const msgs = params.messages as Array<{
            role: string;
            content: string;
          }>;
          capturedContent = msgs[0].content;
          return {
            content: [{ type: "text", text: "chore: large change" }],
          };
        },
      },
      models: {
        list: async () => ({
          data: [{ id: "claude-sonnet-4-6", created_at: 1 }],
        }),
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const service = new ClaudeService("claude-sonnet-4-20250514", client);
    const longDiff = "x".repeat(200_000);
    await service.generateCommitMessage(longDiff);

    assert.ok(capturedContent.includes("[diff truncated]"));
    // Should be significantly shorter than the original
    assert.ok(capturedContent.length < 200_000);
  });

  it("returns empty string when response has no text block", async () => {
    const client = {
      messages: {
        create: async () => ({
          content: [],
        }),
      },
      models: {
        list: async () => ({
          data: [{ id: "claude-sonnet-4-6", created_at: 1 }],
        }),
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const service = new ClaudeService("claude-sonnet-4-20250514", client);
    const result = await service.generateCommitMessage("diff");
    assert.equal(result, "");
  });
});
