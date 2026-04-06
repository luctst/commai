# commai

Generate git commit messages using Claude AI.

**commai** is a CLI tool that automatically generates commit messages based on your staged changes using the Anthropic Claude API. It integrates seamlessly with git via the `prepare-commit-msg` hook and supports interactive accept/regenerate/cancel workflows.

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

Choose one:

**Option A: Project-level (recommended for shared repos)**

Create `.env` in your repo root:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

**Option B: Global (recommended for personal machines)**

Create `~/.commai/.env`:

```bash
mkdir -p ~/.commai
echo "ANTHROPIC_API_KEY=sk-ant-..." > ~/.commai/.env
```

**Option C: Shell environment**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Install the hook

Run this once per git repository. Pass your chosen model — it's stored in `.commai/.config` and used on every subsequent commit.

```bash
cd your-project
commai install --model sonnet@latest
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

| Variable            | Required | Default | Description                                                                                    |
| ------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Yes      | —       | Your Anthropic API key (starts with `sk-ant-`). [Get one here](https://console.anthropic.com). |

### .env File Loading

commai loads environment variables in this order (later values override earlier ones):

1. `~/.commai/.env` (global, shared across projects)
2. `.env` in your project root (project-specific)
3. Shell environment (highest precedence)

Example project `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-abc123...
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
- `1` — Configuration error (missing `ANTHROPIC_API_KEY`, not a git repo, invalid model family).

## Model Selection

### Alias Format

Models are specified as `<family>@<version>`:

- `sonnet@latest` — Latest Claude 3.5 Sonnet (recommended for best results)
- `haiku@latest` — Latest Claude 3.5 Haiku (fastest, cheapest)
- `haiku@4.0.25` — Specific version
- `claude-opus-4-1-20250805` — Raw model ID (if you know the exact version)

### How Resolution Works

1. commai sends `<family>@<version>` to the Anthropic `models.list()` API
2. Filters for models matching `<family>` (case-insensitive)
3. If `version` is `latest`, picks the most recently created matching model
4. Otherwise, filters for models containing the version string (dots replaced with dashes)
5. Returns the most recently created match, or falls back to the raw input if no matches found

### Available Models

Query available models:

```bash
curl https://api.anthropic.com/v1/models \
  -H "api-key: $ANTHROPIC_API_KEY" | jq '.data[].id'
```

Common aliases:

- `sonnet@latest` → `claude-3-5-sonnet-20241022` (or newer)
- `haiku@latest` → `claude-3-5-haiku-20241022` (or newer)
- `opus@latest` → `claude-3-opus-20250219` (or newer)

See the [Anthropic models page](https://docs.anthropic.com/en/docs/about/models) for up-to-date availability.

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
   ├─ Generate message via Claude API
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

### "ANTHROPIC_API_KEY environment variable is not set"

The hook can't find your API key.

**Fixes:**

1. Check `.env` in your project root exists and contains `ANTHROPIC_API_KEY=sk-ant-...`
2. Check `~/.commai/.env` exists if using a global key
3. Check shell environment: `echo $ANTHROPIC_API_KEY`
4. Make sure the file isn't ignored by git (if shared in a private repo, add to `.gitignore`)

### "Could not resolve model alias"

The model `<family>@<version>` didn't match any models in the API.

**Fixes:**

1. Check your API key is correct (try a fresh one from [console.anthropic.com](https://console.anthropic.com))
2. Verify the family name: `sonnet`, `haiku`, `opus` (case-insensitive)
3. Check for typos in the version: `latest` is the safest default
4. Use the raw model ID if known: `claude-3-5-sonnet-20241022`

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

Network issues or API errors. commai logs the error and exits 0 (non-fatal).

**Debug:**

```bash
# Test the API key manually
curl https://api.anthropic.com/v1/messages \
  -H "api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-haiku-20241022","max_tokens":100,"messages":[{"role":"user","content":"hi"}]}'
```

If this fails, your API key or network connectivity is the issue. Your commit will still proceed.

## License

MIT. See [LICENSE](LICENSE) for full text.

---

**Questions?** Check the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.
