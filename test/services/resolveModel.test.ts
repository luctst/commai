import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveProvider } from "../../src/services/ai/resolveModel.js";

describe("resolveProvider", () => {
  it("returns 'claude' for sonnet@latest alias", () => {
    assert.equal(resolveProvider("sonnet@latest"), "claude");
  });

  it("returns 'claude' for opus@4 alias", () => {
    assert.equal(resolveProvider("opus@4"), "claude");
  });

  it("returns 'claude' for haiku@4.5 alias", () => {
    assert.equal(resolveProvider("haiku@4.5"), "claude");
  });

  it("returns 'claude' for raw model ID containing a known family", () => {
    assert.equal(resolveProvider("claude-sonnet-4-20250514"), "claude");
  });

  it("throws for an unknown family alias", () => {
    assert.throws(() => resolveProvider("gpt@latest"), /Unknown model family/);
  });

  it("throws for a raw model ID with no known family", () => {
    assert.throws(() => resolveProvider("gpt-4o"), /Cannot determine provider/);
  });
});
