# @ts-linq/metrics-safe

## 1.1.0

### Minor Changes

- [#156](https://github.com/mrabaev48/ts-linq/pull/156) [`70a5949`](https://github.com/mrabaev48/ts-linq/commit/70a5949c4d9640aab4855506e4c0540cf6344cd6) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(metrics-safe): generic safeInvoke / SafeSqlLogger safe-invoke abstraction (OCP)

  Generalize the hard-wired safe-metrics helper into an extensible, type-safe
  abstraction. The former `tryInvoke` (a closed `'cache' | 'cacheSize' |
'cacheEvicted'` method union) is replaced internally by a single guarded
  `invokeSafely` core, and two new public symbols are added:
  - `safeInvoke<M extends keyof SqlLogger>(logger, method, ...args)` — a generic,
    type-safe primitive that checks the method name and its arguments against the
    `SqlLogger` contract, then invokes the (possibly absent, possibly throwing)
    method without ever propagating an error. New safely-invoked events are added by
    _calling_ it — no edit to any closed union (OCP / DIP).
  - `SafeSqlLogger` — a Decorator that wraps any `SqlLogger` so every method is
    guarded once; callers hold a logger that "can never throw" (Decorator + Null-Object).

  `safeCache`, `safeCacheSize`, and `safeCacheEvicted` are preserved with identical
  signatures and behaviour (re-expressed over the shared core), so existing callers
  are unaffected. Additive and backward compatible.

  `safeInvoke`/`SafeSqlLogger` are typed against `SqlLogger` via a type-only
  `import type` from `@ts-linq/types`, which is fully erased at build time — the
  package keeps zero runtime dependencies.

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
