# Memory Index

## Project

- [Hook Architecture](./project_hook_architecture.md) — commai uses `.commai/` dir + `core.hooksPath`, not `.git/hooks/` directly
- [GenerateOptions shape](./project_generate_options.md) — current fields on `generate()`: model, interactive, autoCommit, service
- [Provider Resolution Architecture](./project_provider_resolution.md) — provider detection separated from model ID resolution; `resolveProvider()` picks the provider, each service resolves its own model IDs
