# metrics-safe/task-2 — safeInvoke / SafeSqlLogger (OCP), completed

Branch `refactor-metrics-safe-safe-invoke` (off origin/main). Generalized the hard-wired
`tryInvoke` in `packages/metrics-safe/src/lib/MetricsSafe.ts`.

## New architecture
- **private `invokeSafely(logger: unknown, method: string, args: readonly unknown[]): void`** — the
  single shared guarded-invoke core. Optional-method guard (Null-Object), throw-swallow, and the
  `TSL_METRICS_DEBUG`-gated `console.warn('[ts-linq metrics]', method, e)`. `method` widened from the
  former closed `'cache'|'cacheSize'|'cacheEvicted'` union to `string` → removes the closed union (OCP).
- **public `safeInvoke<M extends keyof SqlLogger>(logger: SqlLogger | undefined, method: M, ...args: Parameters<NonNullable<SqlLogger[M]>>): void`** —
  type-safe primitive over the SqlLogger contract (DIP). Extend by calling, not editing.
- **public `class SafeSqlLogger implements SqlLogger`** — Decorator; ctor takes inner SqlLogger; every
  base + optional method forwards through `invokeSafely(this.inner, '<name>', [arg])`; never throws.
- `safeCache`/`safeCacheSize`/`safeCacheEvicted` re-expressed over `invokeSafely`; **public signatures
  unchanged** (`logger: unknown`) → back-compat preserved for callers in cache/core/orm/query.

## Critical gotcha
`SqlLogger` (packages/types/src/logging.ts:117) declares `cache?`/`cacheSize?` but **NOT** `cacheEvicted`.
So `safeCacheEvicted` deliberately routes through the string-based core, not the keyof-typed `safeInvoke`.
Did NOT add `cacheEvicted` to SqlLogger (out of scope; noted as follow-up).

## Boundary decision (zero-dependency invariant)
Typed via `import type { SqlLogger, CacheInfo, ... } from '@ts-linq/types'`. Declared `@ts-linq/types`
as a **devDependency** (`workspace:*`) + added tsconfig `references: [{ "path": "../types" }]`.
`import type` is fully erased → emitted JS has no `require('@ts-linq/types')`, `dependencies` stays `{}`,
runtime zero-dep preserved (verified by grepping dist JS). `arch:phantom` only flags undeclared tsconfig
**path aliases** (none added) → clean. metrics-safe → types is allowed by `.dependency-cruiser.cjs`
(types is the foundation, not a forbidden target).

## Tests
- `tests/MetricsSafe.test.ts` extended with `safeInvoke` + `SafeSqlLogger` blocks (39 tests total).
  Helper `makeLogger(overrides)` builds a valid SqlLogger.
- `test-d/index.test-d.ts` extended: positive `safeInvoke(sql, 'fallback'|'cacheSize'|'debug', ...)`,
  negatives `expectError` for bad method name + wrong arg types; `expectAssignable<SqlLogger>(new SafeSqlLogger(sql))`.

## Validation (all green)
typecheck 32/32, lint 0 err, test:unit 2975, test-d 33/33, build (clean rebuild verified),
arch:deps/cycles/dead/phantom clean. `minor` changeset `.changeset/metrics-safe-safe-invoke.md`.

## Follow-up tech debt
Migrate cache adapters' ad-hoc try/catch + loggers' internal guards to safeInvoke/SafeSqlLogger
(cache-redis/task-4, telemetry/task-1). Optionally promote `cacheEvicted` into SqlLogger.
