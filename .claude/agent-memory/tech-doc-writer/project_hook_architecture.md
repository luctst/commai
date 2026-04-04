---
name: Hook Architecture
description: commai hook model uses .commai/ directory + core.hooksPath redirect, not .git/hooks/ directly
type: project
---

install() creates `.commai/` at repo root, writes `prepare-commit-msg` and 12 standard forwarder scripts there, then sets `git config core.hooksPath .commai`. This redirects all git hook dispatch through `.commai/`. Previous `core.hooksPath` is saved in `.commai/.config` (JSON) for restore on uninstall().

**Why:** Allows commai to intercept all hooks without clobbering existing `.git/hooks/` or husky setup. Forwarders chain to `.husky/<hook>` and `.git/hooks/<hook>` for compatibility.

**How to apply:** Any documentation or explanation of hook installation must reference `.commai/` and `core.hooksPath`, not `.git/hooks/prepare-commit-msg`. The `# managed-by-commai` marker is still used for idempotency/foreign-directory detection, but it lives in `.commai/prepare-commit-msg`.
