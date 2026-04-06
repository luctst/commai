---
name: Environment variable loading (.env file support)
description: How commai loads API keys — loadEnv() utility, precedence rules, .env file locations
type: project
---

`src/utils/loadEnv.ts` exports `loadEnv()`, called at the top of `bin/cli.ts` before `program.parse()`.

Load order (first-wins, because we only set keys not already in process.env):
1. `.env` in `process.cwd()` — project-level (applied first → highest file precedence)
2. `~/.commai/.env` — user-level global (fills in what project didn't set)
3. Shell environment — always wins (already set in process.env before loadEnv runs)

Parser handles: quoted values (`"` or `'`), `=` in values, `#` comments, blank lines, `\r\n` endings. Inline comments are NOT stripped (safe default for values containing `#`).

**Why:** Telling users to `export ANTHROPIC_API_KEY=...` inline risks shell history exposure. `.env` files are already gitignored.

**How to apply:** To support a new provider key, no changes needed — loadEnv() loads all keys from the .env files generically.
