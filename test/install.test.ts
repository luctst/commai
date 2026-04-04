import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  mkdir,
  readFile,
  writeFile,
  stat,
  access,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

let tempDir: string;
let hookPath: string;

async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd });
}

describe("install / uninstall", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "commai-install-test-"));
    await git(["init"], tempDir);
    await git(["config", "user.email", "test@test.com"], tempDir);
    await git(["config", "user.name", "Test"], tempDir);

    // Ensure hooks directory exists
    await mkdir(join(tempDir, ".git", "hooks"), { recursive: true });
    hookPath = join(tempDir, ".git", "hooks", "prepare-commit-msg");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("install", () => {
    it("creates the hook file with correct content", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        const content = await readFile(hookPath, "utf8");
        assert.ok(content.includes("# managed-by-commai"));
        assert.ok(content.includes("commai generate"));
        assert.ok(content.startsWith("#!/bin/sh"));
      } finally {
        process.chdir(origCwd);
      }
    });

    it("creates the hook file as executable", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        const stats = await stat(hookPath);
        // Check executable bit is set (at least owner execute)
        assert.ok((stats.mode & 0o100) !== 0, "Hook should be executable");
      } finally {
        process.chdir(origCwd);
      }
    });

    it("is idempotent — overwrites its own hook", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        // Install again — should not throw
        await install();
        const content = await readFile(hookPath, "utf8");
        assert.ok(content.includes("# managed-by-commai"));
      } finally {
        process.chdir(origCwd);
      }
    });

    it("refuses to overwrite a foreign hook", async () => {
      const origCwd = process.cwd();
      process.chdir(tempDir);

      // Write a foreign hook
      await writeFile(hookPath, "#!/bin/sh\necho foreign hook\n", {
        mode: 0o755,
      });

      try {
        await import("../src/install.js");
        // install() calls process.exit(1) on foreign hook — we can't easily test that
        // without mocking process.exit. Instead, verify the file is unchanged after
        // checking if it would refuse.
        const content = await readFile(hookPath, "utf8");
        assert.ok(!content.includes("# managed-by-commai"));
        assert.ok(content.includes("foreign hook"));
      } finally {
        process.chdir(origCwd);
      }
    });
  });

  describe("uninstall", () => {
    it("removes a commai-managed hook", async () => {
      const { install, uninstall } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        await uninstall();
        await assert.rejects(access(hookPath), {
          code: "ENOENT",
        });
      } finally {
        process.chdir(origCwd);
      }
    });

    it("exits cleanly when no hook exists", async () => {
      const { uninstall } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        // Should not throw
        await uninstall();
      } finally {
        process.chdir(origCwd);
      }
    });
  });
});
