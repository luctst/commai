import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  stat,
  access,
  mkdir,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

let tempDir: string;
let commaiDir: string;

async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd });
}

const STANDARD_HOOKS = [
  "pre-commit",
  "commit-msg",
  "post-commit",
  "pre-push",
  "pre-rebase",
  "post-checkout",
  "post-merge",
  "post-rewrite",
  "pre-auto-gc",
  "applypatch-msg",
  "pre-applypatch",
  "post-applypatch",
];

describe("install / uninstall", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "commai-install-test-"));
    await git(["init"], tempDir);
    await git(["config", "user.email", "test@test.com"], tempDir);
    await git(["config", "user.name", "Test"], tempDir);
    commaiDir = join(tempDir, ".commai");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("install", () => {
    it("creates .commai/ with correct prepare-commit-msg content", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        const content = await readFile(
          join(commaiDir, "prepare-commit-msg"),
          "utf8",
        );
        assert.ok(content.startsWith("#!/bin/sh"));
        assert.ok(content.includes("# managed-by-commai"));
        assert.ok(content.includes("commai generate"));
        assert.ok(content.includes(".husky/prepare-commit-msg"));
        assert.ok(content.includes(".git/hooks/prepare-commit-msg"));
      } finally {
        process.chdir(origCwd);
      }
    });

    it("creates forwarder scripts for all standard hooks", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        for (const hook of STANDARD_HOOKS) {
          const content = await readFile(join(commaiDir, hook), "utf8");
          assert.ok(content.startsWith("#!/bin/sh"));
          assert.ok(content.includes(`.husky/${hook}`));
          assert.ok(content.includes(`.git/hooks/${hook}`));
        }
      } finally {
        process.chdir(origCwd);
      }
    });

    it("creates hook files as executable", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        const stats = await stat(join(commaiDir, "prepare-commit-msg"));
        assert.ok((stats.mode & 0o100) !== 0, "Hook should be executable");
      } finally {
        process.chdir(origCwd);
      }
    });

    it("sets core.hooksPath to .commai", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        const { stdout } = await git(["config", "core.hooksPath"], tempDir);
        assert.equal(stdout.trim(), ".commai");
      } finally {
        process.chdir(origCwd);
      }
    });

    it("writes .commai/.config with correct JSON", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        const raw = await readFile(join(commaiDir, ".config"), "utf8");
        const config = JSON.parse(raw);
        assert.equal(config.prevHooksPath, "");
      } finally {
        process.chdir(origCwd);
      }
    });

    it("saves previous core.hooksPath in .config", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await git(["config", "core.hooksPath", ".husky"], tempDir);
        await install();
        const raw = await readFile(join(commaiDir, ".config"), "utf8");
        const config = JSON.parse(raw);
        assert.equal(config.prevHooksPath, ".husky");
      } finally {
        process.chdir(origCwd);
      }
    });

    it("is idempotent — overwrites its own hooks", async () => {
      const { install } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        await install();
        const content = await readFile(
          join(commaiDir, "prepare-commit-msg"),
          "utf8",
        );
        assert.ok(content.includes("# managed-by-commai"));
      } finally {
        process.chdir(origCwd);
      }
    });

    it("refuses if .commai/ exists without marker", async () => {
      const origCwd = process.cwd();
      process.chdir(tempDir);

      await mkdir(commaiDir, { recursive: true });
      await writeFile(
        join(commaiDir, "prepare-commit-msg"),
        "#!/bin/sh\necho foreign\n",
        { mode: 0o755 },
      );

      try {
        const { install } = await import("../src/install.js");
        const originalExit = process.exit;
        let exitCode: number | undefined;
        process.exit = (code: number) => {
          exitCode = code;
          throw new Error("process.exit called");
        };
        try {
          await install();
        } catch {
          // expected
        }
        process.exit = originalExit;
        assert.equal(exitCode, 1);
      } finally {
        process.chdir(origCwd);
      }
    });
  });

  describe("uninstall", () => {
    it("deletes .commai/ entirely", async () => {
      const { install, uninstall } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        await uninstall();
        await assert.rejects(access(commaiDir), { code: "ENOENT" });
      } finally {
        process.chdir(origCwd);
      }
    });

    it("unsets core.hooksPath when previous value was empty", async () => {
      const { install, uninstall } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await install();
        await uninstall();
        await assert.rejects(git(["config", "core.hooksPath"], tempDir));
      } finally {
        process.chdir(origCwd);
      }
    });

    it("restores core.hooksPath to previous value", async () => {
      const { install, uninstall } = await import("../src/install.js");

      const origCwd = process.cwd();
      process.chdir(tempDir);
      try {
        await git(["config", "core.hooksPath", ".husky"], tempDir);
        await install();
        await uninstall();
        const { stdout } = await git(["config", "core.hooksPath"], tempDir);
        assert.equal(stdout.trim(), ".husky");
      } finally {
        process.chdir(origCwd);
      }
    });

    it("exits 1 when .commai/prepare-commit-msg has no marker", async () => {
      const origCwd = process.cwd();
      process.chdir(tempDir);

      await mkdir(commaiDir, { recursive: true });
      await writeFile(
        join(commaiDir, "prepare-commit-msg"),
        "#!/bin/sh\necho foreign\n",
        { mode: 0o755 },
      );

      try {
        const { uninstall } = await import("../src/install.js");
        const originalExit = process.exit;
        let exitCode: number | undefined;
        process.exit = (code: number) => {
          exitCode = code;
          throw new Error("process.exit called");
        };
        try {
          await uninstall();
        } catch {
          // expected
        }
        process.exit = originalExit;
        assert.equal(exitCode, 1);
      } finally {
        process.chdir(origCwd);
      }
    });

    it("exits 1 when .commai/ does not exist", async () => {
      const origCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const { uninstall } = await import("../src/install.js");
        const originalExit = process.exit;
        let exitCode: number | undefined;
        process.exit = (code: number) => {
          exitCode = code;
          throw new Error("process.exit called");
        };
        try {
          await uninstall();
        } catch {
          // expected
        }
        process.exit = originalExit;
        assert.equal(exitCode, 1);
      } finally {
        process.chdir(origCwd);
      }
    });
  });
});
