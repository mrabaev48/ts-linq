# refactor query/task-7: Split QueryBuilder (compile/cache decorator)

✅ DONE (branch audit-refactor/query-split-compile-execute-cache, query's 7TH refactor task).

## What changed
- `QueryBuilder` (333 LOC, mixed compile+cache-key+cache-lifecycle) decomposed via Decorator+SRP into:
  - `SqlCompiler` interface (`generateSql`, `generateFromModel`, new `generateCount`) — packages/query/src/SqlCompiler.ts
  - `SqlCompilerImpl` — cache-agnostic core; dialect.buildSelect + model→options + unions/tags. Zero cache deps.
  - `buildCountModel(model)` — pure helper (clone, select=['COUNT(*) as count'], strip orderBy/limit/offset, distinct=false). No casts.
  - `CacheKeyBuilder` — pure static cache-key/plan-key/extractCurrentParams (packages/query/src/CacheKeyBuilder.ts), extracted verbatim.
  - `CachingSqlCompiler` — decorator wrapping SqlCompilerImpl; full-cache + plan-template (isTemplateSqlCache) strategies, metrics/insights/dispose, invalidateForEntity.
  - `SqlCacheCapabilities` interface (getMetrics?/getOptimizationInsights?/dispose?) replaces all `instanceof EnhancedSqlCache` (cast via `as unknown as SqlCacheCapabilities`).
- `QueryBuilder` is now a thin facade (`implements SqlCompiler`) wrapping `CachingSqlCompiler(SqlCompilerImpl(dialect), cache, ...)`. Public API unchanged (same ctor signature, same methods).
- **BREAKING (major)**: removed deprecated no-op statics `QueryBuilder.clearCache()`, `disposeCache()`, `invalidateForEntity()` — use instance methods.
- `QueryExecutor.buildCountSqlAndParams` now calls `this.sqlBuilder.generateCount(entityClass, queryModel)` — the two `as unknown as {select?:...}/{distinct?:...}` casts are GONE (QueryModel.select/distinct were already correctly typed; cast was unnecessary).
- New internal exports via `packages/query/src/internal/index.ts`: CacheKeyBuilder, CachingSqlCompiler, SqlCompiler/SqlCompilerImpl/buildCountModel, SqlCacheCapabilities/SqlCacheOptimizationInsights.
- 18 existing `sqlBuilder.generateFromModel(...)` call sites across 6 files needed ZERO changes (same method names preserved on facade).

## Fallout fixed
- `packages/orm/src/services/CacheCoordinator.ts` had a dead-code fallback branch calling the removed static `QueryBuilder.invalidateForEntity(name)` (the old static was already a no-op returning 0) — removed the branch + unused `QueryBuilder` import. orm patch bump.

## Versions
- query: 2.5.1 → 3.0.0 (major)
- orm: 4.0.23 → 4.0.24 (patch, internal dep bump)

## Validation
typecheck/lint/build/arch:deps/arch:cycles/arch:dead all clean. Unit 322/322 suites pass (3376 tests). Integration 87/88 (1 known-flaky mssql temporal timing test, passes in isolation — unrelated). E2E 19/19 (290 tests).

## Tech debt (deferred, not required by this task)
- query/task-1 collaborators (AggregateOperations, StreamingExecutor, PredicateBuilder, Queryable, QueryExecutor) keep `sqlBuilder: QueryBuilder` field type — could retype to `SqlCompiler` interface (pure type-only follow-up).
- `CachingSqlCompiler.generateCount` caches under its own key (count-shaped model) distinct from row-select cache entries — correct but worth noting for cache-size tuning.
- Cache strategy (full vs plan-template) remains an `if (isTemplateSqlCache(...))` branch in CachingSqlCompiler rather than a pluggable Strategy object — possible future refinement.

## Next query tasks
task-5 (selector types), task-9 (include proxy), task-10 (barrel curation) — all pending.
