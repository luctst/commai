import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// We test git.ts via integration tests against a real temporary git repo.
// This avoids fragile mocking of child_process.

let tempDir: string;

async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd });
}

describe("git helpers", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "commai-test-"));
    await git(["init"], tempDir);
    await git(["config", "user.email", "test@test.com"], tempDir);
    await git(["config", "user.name", "Test"], tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("getRepoRoot", () => {
    it("returns the repo root from within the repo", async () => {
      // Dynamic import so each test gets a fresh module context
      const { getRepoRoot } = await import("../src/git.js");

      // Run from within the temp repo
      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        const root = await getRepoRoot();
        // Resolve symlinks (macOS /private/tmp vs /tmp)
        const { realpathSync } = await import("node:fs");
        assert.equal(realpathSync(root), realpathSync(tempDir));
      } finally {
        process.chdir(origCwd);
      }
    });
  });

  describe("getStagedDiff", () => {
    it("returns empty string when nothing is staged", async () => {
      const { getStagedDiff } = await import("../src/git.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        const diff = await getStagedDiff();
        assert.equal(diff, "");
      } finally {
        process.chdir(origCwd);
      }
    });

    it("returns diff content when files are staged", async () => {
      const { getStagedDiff } = await import("../src/git.js");
      const { writeFile } = await import("node:fs/promises");

      // Create and stage a file
      await writeFile(join(tempDir, "hello.txt"), "hello world\n");
      await git(["add", "hello.txt"], tempDir);

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        const diff = await getStagedDiff();
        assert.ok(diff.includes("hello world"));
        assert.ok(diff.includes("hello.txt"));
      } finally {
        process.chdir(origCwd);
      }
    });
  });

  describe("commit", () => {
    it("creates a commit with the given message", async () => {
      const { commit } = await import("../src/git.js");
      const { writeFile } = await import("node:fs/promises");

      // Need at least one staged file to commit
      await writeFile(join(tempDir, "file.txt"), "content\n");
      await git(["add", "file.txt"], tempDir);

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await commit("test: initial commit");
        const { stdout } = await git(["log", "--oneline", "-1"], tempDir);
        assert.ok(stdout.includes("test: initial commit"));
      } finally {
        process.chdir(origCwd);
      }
    });
  });
});
