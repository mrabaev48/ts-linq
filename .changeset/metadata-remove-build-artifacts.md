---
---

Internal repository hygiene: removed 24 committed build artifacts
(`.d.ts` / `.d.ts.map` / `.js.map`) from `packages/metadata/src` — stale generated outputs
interleaved with the authored TypeScript sources (the "dist stale-file trap").
No public API, exported type, or runtime-behaviour change; `@ts-linq/metadata` already
compiles only to `dist/`. Empty changeset: no package release is required.
