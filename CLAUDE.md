# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install              # install dependencies
pnpm test                 # run all tests
npx tsx --test test/git.test.ts   # run a single test file
npx tsx bin/cli.ts --help         # run CLI locally without installing
```

No build step — TypeScript is executed directly via `tsx`.

## Architecture

**commai** is a CLI tool that generates git commit messages using AI. It integrates with git via the `prepare-commit-msg` hook.

### Flow

`bin/commai.js` (thin Node shim) → `bin/cli.ts` (commander dispatch) → command handlers in `src/`

The `generate` command is the core path:

1. `src/git.ts` reads the staged diff (`git diff --cached`)
2. `src/services/ai.ts` factory creates an `AIService` (currently only `ClaudeService` in `claude.ts`)
3. `src/prompt.ts` runs the interactive accept/regenerate/cancel loop via `node:readline`
4. `src/generate.ts` orchestrates the above and writes the result to the commit message file

### AI Service Layer

`AIService` interface in `src/services/ai.ts` with a `createAIService()` factory. New providers go in `src/services/` and get a case in the factory switch. The interface is intentionally minimal: `generateCommitMessage(diff, instructions?)`.

### Hook Lifecycle

`src/install.ts` writes/removes the `prepare-commit-msg` hook in `.git/hooks/`. Uses a `# managed-by-commai` marker comment for idempotency — install overwrites its own hook but refuses to touch foreign hooks.

### Error Handling Convention

AI/network failures exit 0 (non-fatal — never block a commit). Only configuration errors (missing API key, not a git repo) exit 1.

## Testing

Tests use `node:test` (built-in) + `node:assert/strict`, run via `tsx --test`. No external test framework.

- **git.test.ts / install.test.ts**: Integration tests using real temporary git repos (`mkdtemp` + `git init`). Tests `chdir` into the temp repo and restore cwd in `finally` blocks.
- **generate.test.ts**: Injects a mock `AIService` via the `service` option on `generate()`.
- **services/claude.test.ts**: Injects a mock Anthropic client via the `ClaudeService` constructor's second argument.

Both `generate()` and `ClaudeService` accept optional dependency injection parameters specifically for testability — no module mocking needed.

## CI/CD

- `.github/workflows/ci.yml` — tests on push/PR, Node 18/20/22 matrix
- `.github/workflows/publish.yml` — npm publish with provenance on `v*` tag push (requires `NPM_TOKEN` secret)
