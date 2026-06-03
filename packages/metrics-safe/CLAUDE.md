# CLAUDE.md — @ts-linq/metrics-safe

## Role

Provides **fail-safe** wrappers so the ORM can emit metrics / profile memory without a hard
dependency on a metrics backend. The defining property: if nothing is wired up, calls are no-ops.

## Hard boundaries

- **Zero runtime dependencies** — keep it that way. The whole point is that depending on this
  package adds no transitive metrics dependency. The *only* declared dep is `@ts-linq/types` (the
  monorepo foundation), consumed **type-only** (`import type`) to type `safeInvoke`/`SafeSqlLogger`
  against `SqlLogger`; the import is fully erased, so the emitted JS imports nothing and no runtime
  dependency is added. It lives in `dependencies` (not `devDependencies`) because `SqlLogger` is part
  of this package's public `.d.ts` and consumers need it at compile time. Do not add any other
  dependency, and never import a higher-level package.
- Consumed by `core`, `query`, `cache`. Must not depend on any of them.

## Critical invariants

- Every public helper must be safe to call when no collector is registered (Null-Object behavior).
- No throwing on the metrics path — a telemetry failure must never break a query.

## Public API surface & stability

- Two entrypoints:
  - **Root `.`** (`src/index.ts`) — re-exports `lib/MetricsSafe.ts` **and**
    `lib/MemoryProfiler.ts` (the latter for backward compatibility).
  - **Subpath `./memory`** (`@ts-linq/metrics-safe/memory`, via `src/memory.ts`) — the
    dedicated entrypoint for the Node-coupled `MemoryProfiler` so the safe helpers stay on a
    light root. See refactor `task-3` (Option A) for the boundary decision; full extraction to
    `@ts-linq/memory-profiler` (Option B) is deferred tech debt.
- Symbols:
  - Functions (root): `safeInvoke` (generic safe-invoke primitive, typed against `SqlLogger`),
    `safeCache`, `safeCacheSize`, `safeCacheEvicted`, `warnIfLoggerDebug`.
  - Classes/types: `SafeSqlLogger` (Decorator wrapping any `SqlLogger` so every method is
    guarded) on the root; `MemoryProfiler` + `MemorySample`, `MemoryProfilerOptions` on **both**
    the root (back-compat) and `./memory`.
  - Internally, `safeInvoke` and all three `safeCache*` wrappers funnel through one private
    `invokeSafely(logger, method, args)` core (no closed method union — OCP). `safeCacheEvicted`
    invokes `cacheEvicted`, which is **not** part of `SqlLogger`, so it routes through the
    string-based core rather than the `keyof SqlLogger`-typed `safeInvoke`.
- Signatures are guarded by `test-d/index.test-d.ts` (root surface) and `test-d/memory.test-d.ts`
  (the `./memory` subpath); run via `pnpm -F @ts-linq/metrics-safe test-d` or repo-wide
  `pnpm test-d`. Update those assertions when the public surface changes. The `tsd` block in
  `package.json` maps the `./memory` specifier to the built `dist/memory.d.ts` (mirroring how
  `orm/tsconfig.json` maps `@ts-linq/query/internal`) since `tsd` resolves under `node`.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/metrics-safe/` — make the Null-Object behavior
explicit and ensure failures in a real backend are isolated.

## Validation

```bash
pnpm --filter @ts-linq/metrics-safe typecheck
pnpm --filter @ts-linq/metrics-safe lint
pnpm --filter @ts-linq/metrics-safe build
```

## Do / Don't

- **Do** keep every entry point no-op-safe and non-throwing.
- **Don't** add dependencies or import higher-level packages.
