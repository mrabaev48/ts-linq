---
status: not-started
phase: phase-x
package: query
priority: P1
effort: M
risk: medium
category: architecture
depends_on: []
related: ["query/task-1.md"]
---

# Refactor: Separate SQL plan *compilation* from *execution* and make caching a decorator

## Problem
`QueryBuilder` (`packages/query/src/QueryBuilder.ts`, 320 LOC) mixes three concerns:
SQL **generation** (`generateSql`/`generateFromModel`), **cache key construction +
serialization** (`buildCacheKey`, `serializeWhere/OrderBy/GroupBy/Joins`, `:194-256`), and
**cache lifecycle/metrics** (`remember`, `getFromCache`, `getCacheMetrics`,
`getOptimizationInsights`, `invalidateForEntity`, `:136-319`). Cache logic is *embedded*,
not composed — the builder both decides cache keys and owns the cache instance
(`this._cache = cache ?? new EnhancedSqlCache(...)`, `:36`).

It also still carries **deprecated no-op static methods** (`clearCache`, `disposeCache`,
`invalidateForEntity`, `:148-158, 314-319`) kept "for backward compatibility" — dead
surface area that should be excised in a major.

Separately, the **template/plan cache vs full cache** branching is hand-rolled inside
`generateSql` (`:53-90`) with regex-based plan-key derivation (`buildPlanKey`, `:252-256`)
that string-munges `?(val)` patterns — brittle and untestable in isolation.

## Evidence
- Three concerns in one class: `QueryBuilder.ts` generation `:40-134`, cache-key
  serialization `:194-256`, cache lifecycle/metrics `:136-319`.
- Cache instance owned by builder: `QueryBuilder.ts:36`.
- Deprecated no-op statics: `QueryBuilder.ts:148-158, 314-319`.
- Regex plan-key derivation: `QueryBuilder.ts:252-256`.
- Count SQL is built by *mutating a cloned model* in `QueryExecutor.buildCountSqlAndParams`
  (`QueryExecutor.ts:367-380`) — compilation logic leaking into the executor.

## Why this is bad
- **SRP/OCP**: the cache strategy (none / full / plan-template) is baked into the builder via
  `instanceof EnhancedSqlCache` checks (`:143, 162, 181`) and `isTemplateSqlCache` branches —
  adding a strategy means editing the builder.
- **Testability**: cache-key stability and plan-key derivation are private statics, only
  reachable through `generateSql`.
- **Leaky compilation**: `QueryExecutor` re-compiles count SQL by poking private model
  fields with `as unknown as { select?: string[] }` casts (`QueryExecutor.ts:373-377`) — a
  compilation concern living in the execution layer.

## Target architecture
Apply **Decorator** + **Single Responsibility**:

- `SqlCompiler` — pure function/class: `(entityClass, model) → { query, parameters }`. No
  cache. Owns count-SQL shaping too (move `buildCountSqlAndParams` here).
- `CacheKeyBuilder` — pure: `(entityClass, options, ns, provider) → key` and `→ planKey`.
  Unit-testable; replaces the private statics.
- `CachingSqlCompiler` (Decorator) — wraps `SqlCompiler`, consults a `SqlCache`, handles
  full vs plan-template strategy via a strategy object, emits metrics. The DbContext injects
  the cache; the compiler core stays cache-agnostic.
- Delete the deprecated no-op statics (major bump).

`QueryExecutor` then depends on a `SqlCompiler` interface (DIP) and never reshapes models or
casts to private fields.

## Proposed refactor
1. Extract `CacheKeyBuilder` from the private statics; add unit tests for key + plan-key
   stability.
2. Extract `SqlCompiler` (generation + count shaping) with no cache dependency.
3. Wrap it in `CachingSqlCompiler` implementing the existing public `generateSql`/
   `generateFromModel` so callers are unchanged.
4. Replace `instanceof EnhancedSqlCache` checks with a small `SqlCacheCapabilities`
   interface (metrics/insights optional methods) — program to the interface.
5. Remove deprecated no-op statics.
6. Move `buildCountSqlAndParams` out of `QueryExecutor` into `SqlCompiler.compileCount`.

## Suggested design patterns
- **Decorator** (`CachingSqlCompiler` over `SqlCompiler`) — *Why*: caching becomes optional,
  composable, and independently testable; mirrors the existing `EnhancedSqlCache`
  decorator chain (LRU→Metrics→TTL) for consistency.
- **Strategy** (full vs plan-template caching) — *Why*: OCP for new cache modes.
- **Pure function extraction** (`CacheKeyBuilder`) — *Why*: deterministic, trivially
  testable.

## Testing plan
- **Unit**: `CacheKeyBuilder` key/plan-key stability across equivalent + differing models;
  `SqlCompiler` output without cache; `CachingSqlCompiler` hit/miss/invalidation.
- **Regression**: `QueryBuilder.test.ts` + `EnhancedSqlCache.test.ts` green.
- **Contract**: count SQL identical before/after the `compileCount` move.

## Acceptance criteria
- [ ] `SqlCompiler` has zero cache dependency.
- [ ] Caching is a decorator; cache injected, not defaulted inside the compiler core.
- [ ] `CacheKeyBuilder` extracted with unit tests.
- [ ] No `instanceof EnhancedSqlCache` branching in the compiler.
- [ ] Deprecated no-op statics removed.
- [ ] `buildCountSqlAndParams` moved out of `QueryExecutor`; no private-field casts remain.
- [ ] Existing tests green.

## Refactor order
Can land independently of the `Queryable` decomposition; complements `query/task-1.md`.

## Notes
Removing deprecated statics is a breaking change → `major` changeset with migration note.
