---
status: completed
phase: phase-x
package: metrics-safe
priority: P2
effort: M
risk: low
category: architecture
depends_on: []
related: ["cache-redis/task-4.md", "telemetry/task-1.md"]
---

# Refactor: Generalize tryInvoke into an extensible safe-invoke abstraction (OCP)

## Problem

The safe-metrics helper is hard-wired to three specific logger methods. Each new
event that needs safe optional invocation forces edits to a string-literal union
and a new bespoke wrapper function. The package's stated purpose ("safe helpers
for optional metrics/logging") is general, but the implementation is special-cased
to cache events.

## Evidence

- `packages/metrics-safe/src/lib/MetricsSafe.ts:11-30` — `tryInvoke(logger,
  method: 'cache' | 'cacheSize' | 'cacheEvicted', payload)`: the `method`
  parameter is a closed union of exactly three names.
- One wrapper per method: `safeCache` (line 32), `safeCacheSize` (line 44),
  `safeCacheEvicted` (line 51).
- The cluster already needs more safely-invoked events — cache adapters degrade
  on backend failure and should emit `fallback`/`cache` events
  (cache-redis/task-4), and `DiagnosticEmitter` is gaining routable resilience
  events (telemetry/task-1). Each would currently require a new `safeX` + union
  entry.

## Why this is bad

- **Open/Closed violation.** Adding a safe event requires modifying existing code
  rather than extending it.
- **Scales poorly.** The `SqlLogger` interface has ~15 event methods; mirroring
  each with a bespoke `safeX` is unsustainable duplication.
- **Inconsistent guard surface.** Code that wants to safely call, say,
  `logger.fallback(...)` has no helper and tends to re-implement the
  try/catch + optional-method guard inline (already seen across the cache
  adapters and the loggers' `try {} catch {}` blocks).

## Target architecture

Provide a general safe-invoke primitive plus a thin **Decorator** that wraps any
`SqlLogger` so every method is guarded once:

- `safeInvoke<M extends keyof SqlLogger>(logger, method, ...args)` — generic over
  the logger method, type-checked against the `SqlLogger` shape from
  `@ts-linq/types`, preserving the debug-gated `console.warn` behaviour.
- OR a `SafeSqlLogger` **Decorator** class implementing `SqlLogger` that delegates
  to a wrapped logger, swallowing/optionally-debug-logging any throw — so callers
  hold a `SqlLogger` that "can never throw" and need no per-call guards.
- Keep `safeCache`/`safeCacheSize`/`safeCacheEvicted` as thin back-compat
  wrappers over the generic primitive (no breaking change).

This applies **OCP** (extend by calling, not editing), **DIP** (typed against the
`SqlLogger` abstraction), and **Decorator** (cross-cutting safety wrap).

## Proposed refactor

1. Add `safeInvoke` generic helper typed against `SqlLogger` method names.
2. Optionally add a `SafeSqlLogger` decorator for whole-logger wrapping.
3. Re-implement the three existing `safeX` wrappers in terms of `safeInvoke`.
4. (Follow-up, in their own tasks) migrate the cache adapters' ad-hoc
   try/catch logger calls and the loggers' internal guards to the shared helper.

## Suggested design patterns

- **Decorator:** `SafeSqlLogger` wraps any logger with uniform error swallowing.
- **OCP:** generic `safeInvoke` extends to any event without edits.
- **Null Object:** undefined logger remains a silent no-op (existing behaviour).

## Testing plan

- Unit: `safeInvoke` never throws for undefined logger / missing method /
  throwing method; debug `console.warn` gated by `TSL_METRICS_DEBUG`.
- Unit: `safeCache`/`safeCacheSize`/`safeCacheEvicted` behaviour unchanged
  (back-compat).
- Unit (if decorator added): `SafeSqlLogger` forwards all `SqlLogger` methods and
  never propagates a throw.
- Type test: `safeInvoke(logger, 'fallback', info)` only type-checks for real
  `SqlLogger` methods.

## Acceptance criteria

- [x] A generic `safeInvoke` (and/or `SafeSqlLogger` decorator) exists, typed
      against `SqlLogger`.
- [x] Existing `safeCache*` wrappers preserved and re-expressed via the primitive.
- [x] Adding a new safe event requires no edit to a closed union.
- [x] `pnpm typecheck` + unit tests pass.

## Outcome

**Implemented** (additive, fully backward compatible):

- **Internal primitive** — the hard-wired `tryInvoke` (closed `'cache' | 'cacheSize'
  | 'cacheEvicted'` union) was generalized into `invokeSafely(logger: unknown,
  method: string, args: readonly unknown[])`. Widening `method` to `string` removes
  the closed union entirely (OCP). Behaviour is byte-for-byte identical: optional-method
  guard (Null-Object), throw-swallowing, and the `TSL_METRICS_DEBUG`-gated `console.warn`.
- **`safeInvoke<M extends keyof SqlLogger>(logger, method, ...args:
  Parameters<NonNullable<SqlLogger[M]>>)`** — the new public, type-safe primitive (DIP).
  Adding a new safely-invoked event is done by *calling* it with another `SqlLogger`
  method name — no edit to any union.
- **`SafeSqlLogger implements SqlLogger`** — Decorator wrapping any logger so every
  method is guarded once and can never propagate a throw (Decorator + Null-Object).
- **`safeCache` / `safeCacheSize` / `safeCacheEvicted`** — re-expressed as thin wrappers
  over `invokeSafely`; public signatures unchanged (`logger: unknown`), so `@ts-linq/cache`,
  `core`, `orm`, `query` keep working. `safeCacheEvicted` routes through the string-based
  core (note: `cacheEvicted` is not part of the `SqlLogger` interface, so it intentionally
  does *not* go through the `keyof SqlLogger`-typed `safeInvoke`).

**Boundary decision** — typed against `SqlLogger` via a **type-only** `import type` from
`@ts-linq/types`, declared in **`dependencies`** (`workspace:*`). `import type` is fully erased,
so the emitted JS contains no `require('@ts-linq/types')` — the package's **runtime
zero-dependency** invariant is preserved (verified by grepping the emitted JS). It must be a real
`dependency` (not `devDependency`) because `SqlLogger` appears in the package's public `.d.ts`
(`safeInvoke` signature + `SafeSqlLogger implements SqlLogger`), so consumers need it resolvable at
compile time; `devDependencies` are not installed transitively. This mirrors the existing
`@ts-linq/composite-sql-logger`, which type-only-imports `SqlLogger` and keeps `@ts-linq/types` in
`dependencies`. `@ts-linq/types` is the monorepo foundation (not a higher-level package);
`arch:deps`/`arch:cycles`/`arch:phantom` are clean.

**Validation** — `pnpm typecheck` (32/32), `pnpm lint` (0 errors), `pnpm test:unit`
(2975/2975, incl. 39 metrics-safe), `pnpm test-d` (33/33), clean `pnpm build`,
`pnpm arch:deps`/`arch:cycles`/`arch:dead`/`arch:phantom` all clean. `minor` changeset added.

**Follow-up (out of scope)** — migrate cache adapters' ad-hoc try/catch and the loggers'
internal guards to `safeInvoke`/`SafeSqlLogger` (cache-redis/task-4, telemetry/task-1);
optionally promote `cacheEvicted` into the `SqlLogger` interface.

## Refactor order

1. Add generic primitive.
2. Re-base existing wrappers.
3. Optional decorator.
4. Migrate consumers in follow-up tasks.

## Notes

Back-compat must be preserved (`@ts-linq/cache` calls `safeCacheEvicted`). This is
additive; the bump is `minor` (new API) per the changeset rules.
