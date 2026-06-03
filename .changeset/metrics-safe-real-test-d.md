---
'@ts-linq/metrics-safe': patch
---

chore(metrics-safe): real type-level tests for the public surface

Replace the stale `test-d/index.test-d.ts` (a copy of the branded-id/query layer
that imported symbols the package never exported) with `tsd` assertions for the
actual public surface: `safeCache`, `safeCacheSize`, `safeCacheEvicted`,
`warnIfLoggerDebug`, and `MemoryProfiler` / `MemorySample` /
`MemoryProfilerOptions`. Wire the type test to run in CI via a repo-wide `test-d`
Turbo task (`pnpm test-d`) and a per-package `test-d` script. No runtime or
public-API change; documentation corrected to match the real exports.
