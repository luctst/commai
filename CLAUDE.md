# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install              # install dependencies
pnpm test                 # run all tests
npx tsx --test test/git.test.ts   # run a single test file
npx tsx bin/cli.ts --help         # run CLI locally without installing

# Configure commai in the repo (run once)
npx tsx bin/cli.ts install --model sonnet@latest --interactive

# Generate a commit message (called by git hook; uses config from .commai/.config)
npx tsx bin/cli.ts generate
```

No build step — TypeScript is executed directly via `tsx`.

## Architecture

**commai** is a CLI tool that generates git commit messages using AI. It integrates with git via the `prepare-commit-msg` hook.

### Flow

`bin/commai.js` (thin Node shim) → `bin/cli.ts` (commander dispatch) → command handlers in `src/`

**install command:** Runs once per repo to configure commai.

1. Accepts CLI options: `--model` (required), `--interactive`, `--auto-commit`
2. Creates `.commai/` directory and hook scripts
3. Writes `CommaiConfig` to `.commai/.config` (JSON) with the provided options
4. Sets `git config core.hooksPath .commai`

**generate command** (core runtime path, called by git hook):

1. Reads `CommaiConfig` from `.commai/.config`
2. `src/git.ts` reads the staged diff (`git diff --cached`)
3. `src/services/ai/resolveModel.ts` determines the provider (e.g., `"claude"` or `"openai"`) from a model string like `"sonnet@latest"`, `"gpt-4-turbo"`, or a raw model ID
4. `src/services/ai/ai.ts` factory `createAIService()` instantiates the provider's service (`ClaudeService` or `OpenAIService`)
5. `src/prompt.ts` runs the interactive accept/regenerate/cancel loop via `node:readline` (if `interactive: true`)
6. `src/generate.ts` orchestrates the above and writes the result to the commit message file (or calls `git commit -m` directly when `autoCommit: true`)

### AI Service Layer

**Provider resolution** is split into two concerns:

- `resolveProvider(modelString)` in `src/services/ai/resolveModel.ts` — synchronous function that determines which AI provider a model string maps to. Supports Claude families (`sonnet`, `opus`, `haiku`) and OpenAI families (`gpt`, `o`) in both alias format (`"sonnet@latest"`, `"gpt-4@latest"`) and raw model IDs (`"claude-sonnet-4-20250514"`, `"gpt-4-turbo"`). Throws if no known family is found.
- `createAIService(provider, { model? })` in `src/services/ai/ai.ts` — factory that instantiates the service for a given provider (`"claude"` → `ClaudeService`, `"openai"` → `OpenAIService`).

Each service handles its own **model ID resolution**. `ClaudeService.getModel()` and `OpenAIService.getModel()` each resolve aliases to concrete model IDs via their respective `models.list()` APIs, falling back to the input as-is on error or if it's not an alias.

`AIService` interface is intentionally minimal: `generateCommitMessage(diff, instructions?)`. New providers go in `src/services/ai/<provider>/` and get a case in the `createAIService()` factory switch.

### Hook Lifecycle

`src/install.ts` exports `install()` and `uninstall()`.

**install():**

1. Creates `.commai/` at the repo root.
2. Writes `.commai/prepare-commit-msg` — runs `commai generate`, skips amend/merge/squash commits, then falls through to `.husky/prepare-commit-msg` and `.git/hooks/prepare-commit-msg` for chain compatibility.
3. Writes forwarder scripts for all 12 standard hooks (`pre-commit`, `commit-msg`, `post-commit`, `pre-push`, `pre-rebase`, `post-checkout`, `post-merge`, `post-rewrite`, `pre-auto-gc`, `applypatch-msg`, `pre-applypatch`, `post-applypatch`) — each delegates to the matching `.husky/<hook>` then `.git/hooks/<hook>`.
4. Sets `git config core.hooksPath .commai` — redirects all git hook dispatch to `.commai/`.
5. Writes `CommaiConfig` to `.commai/.config` (JSON) containing `model`, `interactive`, `autoCommit`, and the previous `core.hooksPath` value (for uninstall restoration).

**uninstall():**

1. Verifies `# managed-by-commai` marker in `.commai/prepare-commit-msg`. Exits 1 if absent (foreign directory) or if `.commai/` doesn't exist.
2. Removes `.commai/` entirely.
3. Restores `core.hooksPath` to its saved value, or unsets it if it was previously empty.

**Idempotency:** install overwrites its own `.commai/` (marker present). Refuses to overwrite a `.commai/` not created by commai — exits 1.

### Error Handling Convention

AI/network failures exit 0 (non-fatal — never block a commit). Only configuration errors (missing API key like `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, not a git repo) exit 1.

## Testing

Tests use `node:test` (built-in) + `node:assert/strict`, run via `tsx --test`. No external test framework.

- **git.test.ts / install.test.ts**: Integration tests using real temporary git repos (`mkdtemp` + `git init`). Tests `chdir` into the temp repo and restore cwd in `finally` blocks.
- **generate.test.ts**: Injects a mock `AIService` via the `service` option on `generate()`.
- **services/claude.test.ts**: Injects a mock Anthropic client via the `ClaudeService` constructor's second argument.
- **services/openai.test.ts**: Injects a mock OpenAI client via the `OpenAIService` constructor's second argument.

Both `generate()` and service constructors (`ClaudeService`, `OpenAIService`) accept optional dependency injection parameters specifically for testability — no module mocking needed.

## CI/CD

- `.github/workflows/ci.yml` — tests on push/PR, Node 18/20/22 matrix
- `.github/workflows/publish.yml` — npm publish with provenance on `v*` tag push (requires `NPM_TOKEN` secret)
