# commai

Generate git commit messages using AI.

**commai** is a CLI tool that automatically generates commit messages based on your staged changes. It supports Claude (Anthropic) and OpenAI models, integrates with git via the `prepare-commit-msg` hook, and supports interactive accept/regenerate/cancel workflows. The provider is auto-detected from the model name — no extra configuration needed.

## Installation

Install globally or per-project. Requires Node 18+.

```bash
# Global (recommended for single-user machines)
npm install -g commai

# Or per-project
npm install --save-dev commai
pnpm add -D commai
```

## Quick Start

### 1. Set your API key

Set the key for your chosen provider. commai infers the provider from the model name, so only the relevant key needs to be set.

**Claude (Anthropic)** — required for `sonnet`, `haiku`, `opus` models:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**OpenAI** — required for `gpt`, `o` models:

```bash
export OPENAI_API_KEY=sk-...
```

You can also store keys in a `.env` file to avoid setting them in every shell session. See [Environment Variables](#environment-variables) for all options.

### 2. Install the hook

Run this once per git repository. Pass your chosen model — it's stored in `.commai/.config` and used on every subsequent commit. The provider (Claude or OpenAI) is resolved automatically from the model family.

```bash
cd your-project

# Claude
commai install --model sonnet@latest

# OpenAI
commai install --model gpt@latest
```

With all options explicit:

```bash
commai install --model haiku@latest --interactive --auto-commit
```

This creates `.commai/prepare-commit-msg`, writes `.commai/.config`, and sets `git config core.hooksPath .commai`.

### 3. Make a commit

```bash
git add .
git commit

# Interactive prompt appears:
#
#  Generated commit message:
#  ────────────────────────────────────────
#  feat: add user authentication
#  ────────────────────────────────────────
#
#    (a) Accept
#    (r) Regenerate
#    (c) Cancel
#
#  >
```

- **Accept (a)**: Use the message and proceed with the commit.
- **Regenerate (r)**: Ask for optional instructions and generate a new message.
- **Cancel (c)**: Abort the commit; you can edit and retry.

If you run `git commit` again without staged changes, commai exits gracefully (exit code 0). If you've already typed a message, commai respects it and doesn't override.

## Configuration

### Environment Variables

Only the key for your chosen provider is required. commai infers the provider from the model family in `--model`.

| Variable            | Required for  | Description                                                                               |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Claude models | Anthropic API key (starts with `sk-ant-`). [Get one here](https://console.anthropic.com). |
| `OPENAI_API_KEY`    | OpenAI models | OpenAI API key (starts with `sk-`). [Get one here](https://platform.openai.com/api-keys). |

### .env File Loading

commai loads environment variables in this order (shell always wins):

1. `~/.commai/.env` — global, applied first (lower precedence)
2. `.env` in your project root — applied second, overrides global
3. Shell environment — always wins over both

Example `~/.commai/.env` (global, covers all your projects):

```bash
ANTHROPIC_API_KEY=sk-ant-abc123...
OPENAI_API_KEY=sk-xyz789...
```

Example project `.env` (project-specific override):

```bash
ANTHROPIC_API_KEY=sk-ant-project-specific...
```

## Commands

### `commai install --model <model> [--interactive] [--auto-commit]`

Install the `prepare-commit-msg` hook and write the runtime config to `.commai/.config`.

```bash
commai install --model sonnet@latest
commai install --model haiku@latest --interactive --auto-commit
```

**Options:**

| Flag              | Default  | Description                                                                                                                    |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--model <model>` | Required | Model to use, in `<family>@<version>` format (e.g., `sonnet@latest`, `haiku@4.0.25`). See [Model Selection](#model-selection). |
| `--interactive`   | `true`   | Show the accept/regenerate/cancel prompt on each commit.                                                                       |
| `--auto-commit`   | `false`  | Run `git commit -m '<message>'` automatically after accepting.                                                                 |

**Effects:**

- Creates `.commai/` directory at repo root
- Writes `.commai/prepare-commit-msg` (marked with `# managed-by-commai`)
- Writes `.commai/.config` (JSON) with `model`, `interactive`, `autoCommit`, and the previous `core.hooksPath` value
- Sets `git config core.hooksPath .commai`
- Creates forwarder scripts for all 12 git hooks (chains to `.husky/` and `.git/hooks/`)

To change options (e.g., switch model), re-run `commai install --model <new-model>`. Do not edit `.commai/.config` manually.

**Idempotent:** Running install again safely overwrites the hook if it was created by commai. Exits 1 if `.commai/` exists but wasn't created by commai (foreign directory — refuses to overwrite).

### `commai uninstall`

Remove the commai hook from the current repository.

```bash
commai uninstall
```

**Effects:**

- Removes `.commai/` directory entirely
- Restores `core.hooksPath` to its previous value, or unsets it if it was previously empty
- Preserves user's `.husky/` and `.git/hooks/` directories

**Safety:** Checks for the `# managed-by-commai` marker in `.commai/prepare-commit-msg`. Exits 1 if the marker is absent (refuses to uninstall a foreign hook directory).

### `commai generate <file>`

Generate a commit message from staged changes. Normally called by the `prepare-commit-msg` hook; rarely invoked directly.

**Arguments:**

- `<file>` — Path to the commit message file (usually `.git/COMMIT_EDITMSG`, provided by git)

All runtime options (`model`, `interactive`, `autoCommit`) are read from `.commai/.config`. To change them, re-run `commai install --model <model> [--interactive] [--auto-commit]`.

**Example:**

```bash
commai generate .git/COMMIT_EDITMSG
```

**Exit codes:**

- `0` — Success, or non-fatal failure (AI error, network timeout, user cancelled). Commit is never blocked.
- `1` — Configuration error (missing API key, `commai install` not run, not a git repo, unknown model family).

## Model Selection

### Alias Format

Models are specified as `<family>@<version>`. The family determines both the provider and the model series. Raw model IDs are also accepted.

**Claude (Anthropic):**

| Alias                        | Description                                |
| ---------------------------- | ------------------------------------------ |
| `sonnet@latest`              | Latest Claude Sonnet — best quality        |
| `haiku@latest`               | Latest Claude Haiku — fastest and cheapest |
| `opus@latest`                | Latest Claude Opus — highest capability    |
| `haiku@4.0.25`               | Specific Claude version                    |
| `claude-3-5-sonnet-20241022` | Raw model ID                               |

**OpenAI:**

| Alias         | Description                              |
| ------------- | ---------------------------------------- |
| `gpt@latest`  | Latest GPT model                         |
| `o@latest`    | Latest OpenAI reasoning model (o-series) |
| `gpt@4-turbo` | Specific GPT version                     |
| `gpt-4-turbo` | Raw model ID                             |

### Provider Auto-Detection

The provider is resolved from the model family — no extra config needed:

| Family                    | Provider           | API key required    |
| ------------------------- | ------------------ | ------------------- |
| `sonnet`, `haiku`, `opus` | Claude (Anthropic) | `ANTHROPIC_API_KEY` |
| `gpt`, `o`                | OpenAI             | `OPENAI_API_KEY`    |

### How Resolution Works

1. Extract the family from `<family>@<version>` (or scan the raw ID for a known family substring)
2. Look up the provider from the family map above
3. Query the provider's `models.list()` API and filter by family (case-insensitive)
4. If `version` is `latest`, pick the most recently created match; otherwise filter by version string (dots → dashes)
5. Fall back to the input as-is if no match is found or the API call fails

### Available Models

**Claude:**

```bash
curl https://api.anthropic.com/v1/models \
  -H "api-key: $ANTHROPIC_API_KEY" | jq '.data[].id'
```

See the [Anthropic models page](https://docs.anthropic.com/en/docs/about/models) for up-to-date availability.

**OpenAI:**

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[].id'
```

See the [OpenAI models page](https://platform.openai.com/docs/models) for up-to-date availability.

## How It Works

```
[git commit] → [prepare-commit-msg hook]
   ↓
[commai generate]
   ├─ Read options from .commai/.config (model, interactive, autoCommit)
   ├─ Read staged diff via `git diff --cached`
   ├─ Check: existing user content? (skip if yes)
   ├─ Check: changes to stage? (skip if no)
   ├─ Create AI service (resolve model, load API key)
   ├─ Generate message via AI provider API (Claude or OpenAI)
   ├─ Interactive prompt (accept/regenerate/cancel)
   └─ Write to commit file or run `git commit -m`
   ↓
[commit proceeds or is cancelled]
```

### Hook Chain Compatibility

commai respects other git tooling by chaining hooks:

```
.commai/prepare-commit-msg
  ├─ Run `commai generate`
  ├─ Then check `.husky/prepare-commit-msg` (run if executable)
  └─ Then check `.git/hooks/prepare-commit-msg` (run if executable)
```

This allows commai to coexist with husky, commitlint, and other pre-commit tooling.

### What's Safe to Delete

- **Don't delete `.commai/`** — Run `commai uninstall` instead
- **Don't edit `.commai/`** — Hook scripts and `.commai/.config` are auto-generated. To change options, re-run `commai install --model <model>`
- **Safe to delete:** `.git/hooks/prepare-commit-msg` (if not created by you), or third-party hooks if you're sure they're no longer needed

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is not set" / "OPENAI_API_KEY environment variable is not set"

The hook can't find the API key for the configured model's provider.

**Fixes:**

1. Check which provider your model uses — see the [Provider Auto-Detection](#provider-auto-detection) table
2. Check `.env` in your project root contains the right key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)
3. Check `~/.commai/.env` exists if using a global key
4. Verify shell environment: `echo $ANTHROPIC_API_KEY` or `echo $OPENAI_API_KEY`
5. If the `.env` is in a shared repo, make sure it's in `.gitignore` to avoid committing secrets

### "Could not resolve model alias"

The model `<family>@<version>` didn't match any models in the provider's API.

**Fixes:**

1. Verify the family name — Claude: `sonnet`, `haiku`, `opus`; OpenAI: `gpt`, `o` (case-insensitive)
2. Check for typos in the version: `latest` is the safest default
3. Check the API key for the correct provider is set and valid
4. Use the raw model ID as a fallback (e.g., `claude-3-5-sonnet-20241022` or `gpt-4-turbo`)

### Hook isn't running / commit skips message generation

Check if commai is installed:

```bash
git config core.hooksPath
# Should output: .commai
```

If empty or different, run `commai install` again.

**Also note:** commai intentionally skips generation in these cases:

- No staged changes (`git add` nothing)
- User already typed a message (commai respects manual input)
- Merge/amend/squash commits (special git contexts where auto-generation is risky)

### "EISDIR: illegal operation on a directory"

Likely trying to run commai outside a git repository.

```bash
# Fix: cd into a git repo
cd /path/to/project
commai install
```

### Permission denied / hook file not executable

After installing, the hook script should be executable.

```bash
# Check
ls -l .commai/prepare-commit-msg
# Should show: -rwxr-xr-x (or similar, with x bits set)

# Fix if needed
chmod +x .commai/prepare-commit-msg
```

### "AI call failed" / Network timeout

Network issues or API errors. commai logs the error and exits 0 (non-fatal) — your commit will still proceed.

**Debug (Claude):**

```bash
curl https://api.anthropic.com/v1/messages \
  -H "api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-haiku-20241022","max_tokens":100,"messages":[{"role":"user","content":"hi"}]}'
```

**Debug (OpenAI):**

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","max_tokens":100,"messages":[{"role":"user","content":"hi"}]}'
```

If either call fails, the issue is your API key or network connectivity.

## License

MIT. See [LICENSE](LICENSE) for full text.

---

**Questions?** Check the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.
