---
name: Build and publish setup
description: TypeScript compilation setup — tsconfig.build.json, dist/ output, prepublishOnly hook, and what ships to npm
type: project
---

commai uses a two-tsconfig pattern:
- `tsconfig.json` — `noEmit: true`, used for IDE and `pnpm typecheck` in CI
- `tsconfig.build.json` — extends main, `noEmit: false`, `outDir: dist`, `rootDir: .`, excludes `test/`

Build output goes to `dist/` (gitignored). The npm package ships `dist/` + `bin/commai.js` (the shim).

`bin/commai.js` imports `../dist/bin/cli.js` at runtime. For local dev, bypass the shim and use `npx tsx bin/cli.ts` directly (as documented in CLAUDE.md).

**Why:** `tsx` is in devDependencies — consumers who install commai wouldn't be able to run raw `.ts` files.

**How to apply:** When adding new `.ts` source files, they compile automatically via `tsc -p tsconfig.build.json`. No changes to build config needed unless adding new directories. Run `pnpm run build` to verify before publishing.
