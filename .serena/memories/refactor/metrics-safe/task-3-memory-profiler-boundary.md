# refactor metrics-safe / task-3: MemoryProfiler boundary (Option A)

## Decision
`@ts-linq/metrics-safe` bundled two unrelated responsibilities: lightweight safe-invoke
helpers (`lib/MetricsSafe.ts`) and the Node-coupled `MemoryProfiler` (`lib/MemoryProfiler.ts`:
`node:fs/path/inspector`, `process.memoryUsage`, `FinalizationRegistry`, `setInterval`).
**Chosen Option A — subpath export.** Added `@ts-linq/metrics-safe/memory` via a thin
`src/memory.ts` barrel (`export * from './lib/MemoryProfiler'`) + an `exports` map entry.
**Root re-export retained** in `src/index.ts` for back-compat. Dependency graph unchanged.

## Why A (not B = new `@ts-linq/memory-profiler` package)
- Concrete `MemoryProfiler` class is imported **nowhere outside this package's own tests**.
  Real consumers depend on the structural shape `MemoryProfilerLike`:
  - `prometheus-sql-logger` defines its **own local** `MemoryProfilerLike` and does NOT depend
    on `@ts-linq/metrics-safe`.
  - `@ts-linq/orm` `DbContext` uses `MemoryProfilerLike` re-exported from `@ts-linq/core`
    (`DiagnosticsOptions.memoryProfiler`).
- ISP seam already clean → low-risk move. Subpath gives cohesion win at near-zero cost; no new
  package/changeset-graph/build wiring. Repo precedent: `migrations/scaffold`, `query/internal`.

## Public API change
- New entrypoint `@ts-linq/metrics-safe/memory` exposing `MemoryProfiler`, `MemorySample`,
  `MemoryProfilerOptions`. Same symbols still on root (back-compat).
- `package.json` `exports."./memory"` → `dist/memory.{d.ts,js}` + `dist/esm/memory.js`.

## Resolution gotchas (important)
- Repo base tsconfig uses `moduleResolution: "node"` (node10), which does **NOT** honor the
  `exports` map for bare subpath specifiers. The `exports` subpath resolves natively only under
  `bundler`/`node16` (verified by probe). In-repo TS consumers importing the subpath in source
  must add a `paths` mapping to `dist/memory` (same pattern as `orm/tsconfig.json` →
  `@ts-linq/query/internal` → `../query/dist/internal`). No production consumer imports the
  subpath today, so no `paths` was added anywhere except tsd.
- `tsd` ignores `module`/`moduleResolution` overrides → can't use bundler in tsd. Instead the
  `tsd` block in `metrics-safe/package.json` maps `@ts-linq/metrics-safe/memory` →
  `./dist/memory.d.ts` via `paths`, so `test-d/memory.test-d.ts` resolves the subpath artifact.

## Files
- NEW `packages/metrics-safe/src/memory.ts` (thin barrel).
- `packages/metrics-safe/package.json`: `exports."./memory"` + `tsd.compilerOptions.paths`.
- NEW `packages/metrics-safe/test-d/memory.test-d.ts` (subpath type tests).
- `src/index.ts` unchanged (back-compat). Existing `tests/MemoryProfiler.test.ts`,
  `test-d/index.test-d.ts` unchanged.
- Docs: `task-3.md` (ADR + status completed), metrics-safe refactor `README.md`, package
  `CLAUDE.md` (two-entrypoint surface), changeset `metrics-safe-memory-subpath.md` (minor).

## Deferred tech debt
- Option B = full extraction into standalone `@ts-linq/memory-profiler` package. Deferred to a
  broader observability reorg. Because root still re-exports the profiler, safe helpers aren't
  *fully* isolated yet.

## Validation (all green)
typecheck, lint (0 errors), tests:unit (2975), test:integration (464), tests:e2e (290),
build (32/32), test-d (33/33 incl. root + /memory), arch:deps clean, arch:cycles clean,
arch:dead no new findings. `prometheus-sql-logger` builds & still accepts profiler via
`MemoryProfilerLike`.
