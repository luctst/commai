import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OpenAIService } from "../../src/services/ai/openai/openai.js";
import type { FetchFn } from "../../src/types.js";

/** Creates a mock fetch that returns the given text from the chat completions endpoint. */
function createMockFetch(responseText: string): FetchFn {
  return async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.endsWith("/models")) {
      return Response.json({
        data: [{ id: "gpt-4o-2025-01-01", created: 1 }],
      });
    }

    return Response.json({
      choices: [{ message: { content: responseText } }],
    });
  };
}

describe("OpenAIService", () => {
  it("returns the generated commit message", async () => {
    const fetchFn = createMockFetch("feat: add user login");
    const service = new OpenAIService("gpt-4o", fetchFn);

    const result = await service.generateCommitMessage("diff content here");
    assert.equal(result, "feat: add user login");
  });

  it("trims whitespace from the response", async () => {
    const fetchFn = createMockFetch("  fix: remove trailing spaces  \n");
    const service = new OpenAIService("gpt-4o", fetchFn);

    const result = await service.generateCommitMessage("diff");
    assert.equal(result, "fix: remove trailing spaces");
  });

  it("appends instructions to the prompt when provided", async () => {
    let capturedBody: string = "";
    const fetchFn: FetchFn = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/models")) {
        return Response.json({
          data: [{ id: "gpt-4o-2025-01-01", created: 1 }],
        });
      }

      capturedBody = (init?.body as string) ?? "";
      return Response.json({
        choices: [{ message: { content: "refactor: simplify auth logic" } }],
      });
    };

    const service = new OpenAIService("gpt-4o", fetchFn);
    await service.generateCommitMessage("diff", "focus on the auth changes");

    const parsed = JSON.parse(capturedBody);
    // messages[0] is system, messages[1] is user
    assert.ok(
      parsed.messages[1].content.includes(
        "Additional instructions: focus on the auth changes",
      ),
    );
  });

  it("truncates very long diffs", async () => {
    let capturedBody: string = "";
    const fetchFn: FetchFn = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/models")) {
        return Response.json({
          data: [{ id: "gpt-4o-2025-01-01", created: 1 }],
        });
      }

      capturedBody = (init?.body as string) ?? "";
      return Response.json({
        choices: [{ message: { content: "chore: large change" } }],
      });
    };

    const service = new OpenAIService("gpt-4o", fetchFn);
    const longDiff = "x".repeat(200_000);
    await service.generateCommitMessage(longDiff);

    const parsed = JSON.parse(capturedBody);
    const userContent = parsed.messages[1].content;
    assert.ok(userContent.includes("[diff truncated]"));
    assert.ok(userContent.length < 200_000);
  });

  it("returns empty string when response has no content", async () => {
    const fetchFn: FetchFn = async () => {
      return Response.json({
        choices: [{ message: { content: null } }],
      });
    };

    const service = new OpenAIService("gpt-4o", fetchFn);
    const result = await service.generateCommitMessage("diff");
    assert.equal(result, "");
  });

  it("skips models.list() call for raw model IDs (no @)", async () => {
    let modelsListCalled = false;
    const fetchFn: FetchFn = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/models")) {
        modelsListCalled = true;
        return Response.json({ data: [] });
      }

      return Response.json({
        choices: [{ message: { content: "feat: something" } }],
      });
    };

    const service = new OpenAIService("gpt-4o", fetchFn);
    await service.generateCommitMessage("diff");

    assert.equal(
      modelsListCalled,
      false,
      "models.list() should not be called for raw model IDs",
    );
  });

  it("calls models.list() for alias format (with @)", async () => {
    let modelsListCalled = false;
    const fetchFn: FetchFn = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/models")) {
        modelsListCalled = true;
        return Response.json({
          data: [{ id: "gpt-4o-2025-01-01", created: 1 }],
        });
      }

      return Response.json({
        choices: [{ message: { content: "feat: something" } }],
      });
    };

    const service = new OpenAIService("gpt@latest", fetchFn);
    await service.generateCommitMessage("diff");

    assert.equal(
      modelsListCalled,
      true,
      "models.list() should be called for alias format",
    );
  });
});
