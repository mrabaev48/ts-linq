# @ts-linq/metrics-safe

## 1.0.1

### Patch Changes

- [#154](https://github.com/mrabaev48/ts-linq/pull/154) [`8e79681`](https://github.com/mrabaev48/ts-linq/commit/8e79681455dca1c1f60a616cb9b8882ca9cafef6) Thanks [@mrabaev48](https://github.com/mrabaev48)! - chore(metrics-safe): real type-level tests for the public surface

  Replace the stale `test-d/index.test-d.ts` (a copy of the branded-id/query layer
  that imported symbols the package never exported) with `tsd` assertions for the
  actual public surface: `safeCache`, `safeCacheSize`, `safeCacheEvicted`,
  `warnIfLoggerDebug`, and `MemoryProfiler` / `MemorySample` /
  `MemoryProfilerOptions`. Wire the type test to run in CI via a repo-wide `test-d`
  Turbo task (`pnpm test-d`) and a per-package `test-d` script. No runtime or
  public-API change; documentation corrected to match the real exports.
