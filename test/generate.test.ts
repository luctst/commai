import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AIService } from "../src/services/ai/ai.js";

const execFileAsync = promisify(execFile);

async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd });
}

/** Creates a mock AIService that returns a fixed message */
function createMockService(message: string): AIService {
  return {
    generateCommitMessage: mock.fn(async () => message),
  };
}

let tempDir: string;
let commitMsgFile: string;

describe("generate", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "commai-generate-test-"));
    await git(["init"], tempDir);
    await git(["config", "user.email", "test@test.com"], tempDir);
    await git(["config", "user.name", "Test"], tempDir);

    commitMsgFile = join(tempDir, "COMMIT_EDITMSG");
    // Write the default commit message file with git comments
    await writeFile(
      commitMsgFile,
      "# Please enter the commit message\n# Lines starting with '#' will be ignored\n",
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes the generated message to the commit file (non-interactive)", async () => {
    const { generate } = await import("../src/generate.js");

    // Stage a file so there's a diff
    await writeFile(join(tempDir, "app.ts"), 'console.log("hello");\n');
    await git(["add", "app.ts"], tempDir);

    const origCwd = process.cwd();
    process.chdir(tempDir);
    try {
      await generate(commitMsgFile, {
        interactive: false,
        service: createMockService("feat: add hello world"),
      });

      const content = await readFile(commitMsgFile, "utf8");
      assert.ok(content.startsWith("feat: add hello world"));
      // Verify git comments are preserved
      assert.ok(content.includes("# Please enter the commit message"));
    } finally {
      process.chdir(origCwd);
    }
  });

  it("preserves existing # comment lines", async () => {
    const { generate } = await import("../src/generate.js");

    await writeFile(join(tempDir, "file.ts"), "const x = 1;\n");
    await git(["add", "file.ts"], tempDir);

    const comments =
      "# On branch main\n# Changes to be committed:\n#   new file: file.ts\n";
    await writeFile(commitMsgFile, comments);

    const origCwd = process.cwd();
    process.chdir(tempDir);
    try {
      await generate(commitMsgFile, {
        interactive: false,
        service: createMockService("feat: add constant"),
      });

      const content = await readFile(commitMsgFile, "utf8");
      assert.ok(content.includes("feat: add constant"));
      assert.ok(content.includes("# On branch main"));
      assert.ok(content.includes("# Changes to be committed:"));
    } finally {
      process.chdir(origCwd);
    }
  });

  it("calls generateCommitMessage with the staged diff", async () => {
    const { generate } = await import("../src/generate.js");

    await writeFile(join(tempDir, "index.ts"), "export const a = 42;\n");
    await git(["add", "index.ts"], tempDir);

    const mockService = createMockService("feat: add exports");

    const origCwd = process.cwd();
    process.chdir(tempDir);
    try {
      await generate(commitMsgFile, {
        interactive: false,
        service: mockService,
      });

      // Verify the mock was called
      const fn = mockService.generateCommitMessage as ReturnType<
        typeof mock.fn
      >;
      assert.equal(fn.mock.calls.length, 1);
      // First arg should be the diff content
      const diffArg = fn.mock.calls[0].arguments[0] as string;
      assert.ok(diffArg.includes("index.ts"));
      assert.ok(diffArg.includes("export const a = 42"));
    } finally {
      process.chdir(origCwd);
    }
  });
});
