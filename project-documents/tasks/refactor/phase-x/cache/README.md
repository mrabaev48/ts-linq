# Refactor Audit: cache

## Package responsibility

`@ts-linq/cache` is intended to host the base cache abstractions for the ORM:
an in-memory FIFO level-2 `EntityCache` (`packages/cache/src/EntityCache.ts`),
the `EntityCacheLike` interface, and a `@CachePolicy` decorator declaring
per-entity cache invalidation dependencies (`packages/cache/src/CachePolicy.ts`).

## Current architectural problems

The package is in a broken/orphaned state and does not function as the
"base abstractions" layer its description implies:

1. **No consumer.** A repo-wide search shows no production `import` of
   `@ts-linq/cache'` outside the package itself. The runtime `EntityCache`
   actually used by the ORM lives in `@ts-linq/core/src/utils/EntityCache.ts`
   (triple duplication: `cache`, `core`, plus `EntityCacheLike` in `types`).
2. **Dead `CachePolicy`.** `packages/cache/src/CachePolicy.ts` is a verbatim
   duplicate of `@ts-linq/core/src/decorators/CachePolicy.ts`, and it is not
   even re-exported from `packages/cache/src/index.ts` (which only does
   `export * from './EntityCache'`). It is unreachable code.
3. **Interface duplication.** `EntityCacheLike` is declared identically in
   `packages/cache/src/EntityCache.ts:7` and `packages/types/src/index.ts:1043`.
4. **`Function` type smell.** The public API keys cache entries on `Function`
   (TS lint discourages this) and stringifies ids via `String(id)`, which
   collides composite/object ids.

## Refactor goals

- Decide the package's fate: either make it the single source of truth for
  `EntityCacheLike` + `EntityCache` + `CachePolicy` and have `core` depend on
  it, or delete it and consolidate into `core`/`types`. Eliminate triple
  duplication either way.
- Remove dead/unexported code.
- Replace `Function`-keyed / `String(id)` key building with a typed,
  collision-safe key strategy.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Resolve triple duplication of EntityCache / EntityCacheLike across cache, core, types | P1 | Single source of truth; biggest maintainability win |
| 2 | task-2.md — Remove dead, unexported, duplicated CachePolicy from cache package | P2 | Dead code; duplicate of core decorator |
| 3 | task-3.md — Replace Function-keyed / String(id) cache key building with collision-safe strategy | P2 | Correctness + type safety of public API |

## Dependencies on other packages

- Declares dep on `@ts-linq/types` and `@ts-linq/metrics-safe`, peer on
  `@ts-linq/core`.
- `EntityCache.set` calls `safeCacheEvicted` from `@ts-linq/metrics-safe`.
- Conceptually overlaps with `@ts-linq/core` (the real `EntityCache`) and
  `@ts-linq/types` (`EntityCacheLike`).

## Testing strategy

- Unit tests already exist (`tests-new/EntityCache.test.ts`,
  `CachePolicy.test.ts`). After consolidation, ensure the surviving copy keeps
  these behaviours: FIFO eviction at `maxSize`, null/undefined id guards,
  metrics emission on eviction.
- Add a contract test asserting `EntityCache implements EntityCacheLike` from
  the single canonical interface location.

## Notes

This package is the clearest "ghost package" in the cluster: published API
(`index.ts`) exposes only `EntityCache`, the rest is dead, and nothing imports
it. Resolving its identity should precede the cache-adapter de-duplication work
in `cache-redis`/`cache-memcached`, since those adapters depend on a shared
base abstraction that logically belongs here.
