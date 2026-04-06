import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadEnv } from "../../src/utils/loadEnv.js";

let tempDir: string;
let originalCwd: string;
let envSnapshot: string[];

describe("loadEnv", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "commai-loadenv-test-"));
    originalCwd = process.cwd();
    envSnapshot = Object.keys(process.env);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    for (const key of Object.keys(process.env)) {
      if (!envSnapshot.includes(key)) {
        delete process.env[key];
      }
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loads KEY=value from .env in cwd", async () => {
    await writeFile(join(tempDir, ".env"), "TEST_KEY_CWD=hello_world\n");
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_CWD, "hello_world");
  });

  it("does not overwrite existing process.env values (shell wins)", async () => {
    process.env.TEST_KEY_SHELL = "from_shell";
    await writeFile(join(tempDir, ".env"), "TEST_KEY_SHELL=from_file\n");
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_SHELL, "from_shell");
  });

  it("silently skips a missing .env file", async () => {
    process.chdir(tempDir); // no .env file present
    assert.doesNotThrow(() => loadEnv());
  });

  it("handles quoted values with double quotes", async () => {
    await writeFile(join(tempDir, ".env"), 'TEST_KEY_DQ="quoted value"\n');
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_DQ, "quoted value");
  });

  it("handles quoted values with single quotes", async () => {
    await writeFile(join(tempDir, ".env"), "TEST_KEY_SQ='single quoted'\n");
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_SQ, "single quoted");
  });

  it("does not strip mismatched quotes", async () => {
    await writeFile(join(tempDir, ".env"), "TEST_KEY_MQ=\"mismatched'\n");
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_MQ, "\"mismatched'");
  });

  it("handles KEY=value=with=equals (only first = is separator)", async () => {
    await writeFile(join(tempDir, ".env"), "TEST_KEY_EQ=val=ue=here\n");
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_EQ, "val=ue=here");
  });

  it("skips comment lines", async () => {
    await writeFile(
      join(tempDir, ".env"),
      "# this is a comment\nTEST_KEY_COMMENT=real_value\n",
    );
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_COMMENT, "real_value");
  });

  it("skips blank lines", async () => {
    await writeFile(join(tempDir, ".env"), "\n\nTEST_KEY_BLANK=found\n\n");
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_BLANK, "found");
  });

  it("handles empty value (KEY=)", async () => {
    await writeFile(join(tempDir, ".env"), "TEST_KEY_EMPTY=\n");
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_EMPTY, "");
  });

  it("handles multiple keys in one file", async () => {
    await writeFile(
      join(tempDir, ".env"),
      "TEST_MULTI_A=alpha\nTEST_MULTI_B=beta\nTEST_MULTI_C=gamma\n",
    );
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_MULTI_A, "alpha");
    assert.equal(process.env.TEST_MULTI_B, "beta");
    assert.equal(process.env.TEST_MULTI_C, "gamma");
  });

  it("handles Windows-style \\r\\n line endings", async () => {
    await writeFile(join(tempDir, ".env"), "TEST_KEY_CRLF=windows\r\n", "utf8");
    process.chdir(tempDir);
    loadEnv();
    assert.equal(process.env.TEST_KEY_CRLF, "windows");
  });
});
