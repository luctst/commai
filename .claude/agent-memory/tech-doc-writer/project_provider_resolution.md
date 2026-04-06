---
name: Provider Resolution Architecture
description: commai separates provider detection from model ID resolution — resolveProvider() picks the provider, each service resolves its own model IDs
type: project
---

**Provider vs. Model ID resolution:**

commai now splits model resolution into two independent concerns:

1. **Provider resolution** (`resolveProvider()` in `src/services/ai/resolveModel.ts`) — synchronous, determines which AI provider (e.g., `"claude"`) a model string maps to. Handles both alias format (`"sonnet@latest"`) and raw model IDs (`"claude-sonnet-4-20250514"`). Throws if no known family is found.

2. **Model ID resolution** — handled by each service internally (e.g., `ClaudeService.getModel()` calls `models.list()` to resolve aliases to concrete IDs).

**Why:** Keeps provider dispatch logic decoupled from provider-specific model resolution. Makes it easy to add new providers without duplicating alias-resolution logic.

**Key files:**
- `src/services/ai/resolveModel.ts` — `resolveProvider()` function + `AIProvider` type
- `src/services/ai/ai.ts` — `createAIService(provider, { model })` factory
- `src/services/ai/claude/claude.ts` — `ClaudeService` with private `resolveClaudeModel()` and `getModel()`
- `src/generate.ts` — calls `resolveProvider(model)` before `createAIService()`

**How to add a new provider:**
1. Create `src/services/ai/<provider>/<provider>.ts` with a class implementing `AIService`
2. Add the family→provider mapping to `FAMILY_TO_PROVIDER` in `src/services/ai/familyProvider.ts`
3. Add a case to `createAIService()` switch in `src/services/ai/ai.ts`
