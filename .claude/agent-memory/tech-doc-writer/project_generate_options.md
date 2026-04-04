---
name: GenerateOptions shape
description: Current GenerateOptions fields in src/generate.ts — model, interactive, autoCommit, service
type: project
---

`GenerateOptions` (src/generate.ts) has four fields:
- `model` — AI model string, default `claude-sonnet-4-20250514`
- `interactive` — boolean, default `true`; runs the accept/regenerate/cancel prompt loop
- `autoCommit` — boolean, default `false`; if true calls `git commit -m` directly instead of writing to the commit file
- `service` — optional `AIService` injection for testing

`instructions` is NOT a GenerateOptions field. It is only accepted via the interactive regenerate loop (`promptUserForAction` returns it on `regenerate` action).

`generate()` also short-circuits if the commit file already has non-comment content (user pre-typed a message).

**Why:** Tracks the current API surface to avoid documenting stale or removed fields.

**How to apply:** When writing JSDoc or explaining generate() behavior, use these exact fields. Do not reference an `instructions` option on generate().
