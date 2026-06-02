# Refactor Audit: cache-memcached

## Package responsibility

`@ts-linq/cache-memcached` provides Memcached-backed adapters (`memjs` client)
for the three ORM cache roles: entity L2 (`MemcachedEntityCacheAdapter`),
generated-SQL cache (`MemcachedSqlCacheAdapter`), and count cache
(`MemcachedCountCacheAdapter`). Same shadow-cache + write-through model as
`cache-redis`, but with a Buffer-based transport and no pub/sub invalidation.

## Current architectural problems

This package is a near clone of `cache-redis` and shares all of its structural
defects, plus a few of its own:

1. **Six-way duplication with cache-redis.** Shadow Map, TTL expiry, LRU touch,
   `ensureCapacity`, djb2 `h()`, `_metrics`/`getMetrics`, `invalidateBy`,
   `buildKey`/`k`/`getNamespacedKey` are duplicated from the Redis adapters with
   only the transport differing (`memjs` Buffer get/set/delete + a `decode()`
   helper). No shared base.
2. **Re-declared contracts.** `SqlCache`, `CountCache`, `CountCacheEntry`, and
   `MemjsClientLike` are re-declared per adapter; `MemcachedEntityCacheAdapter`
   imports `MemjsClientLike` from a sibling adapter file.
3. **ISP / honesty violation.** Same as Redis: `implements SqlCache`/`CountCache`
   (sync) but the real remote read is the off-contract `getAsync`; the entity
   adapter's sync `get()` can never serve a remote value.
4. **`clear()` is silently incomplete.** `MemcachedEntityCacheAdapter.clear()`
   and `MemcachedSqlCacheAdapter.clear()` only clear the local shadow and leave
   the remote cache populated — the docstring at
   `MemcachedEntityCacheAdapter.ts:123-126` admits `clear()` does not affect
   Memcached. A caller invoking `clear()` reasonably expects the cache emptied;
   stale remote entries survive and can repopulate the shadow on the next
   `getAsync`. This is a correctness gap, not just a perf note.
5. **Inconsistent error handling.** Count adapter `console.warn`s on write/delete
   failure; Sql/Entity adapters swallow silently. None notify `SqlLogger`.

## Refactor goals

- Ride the shared abstract base extracted in `cache-redis/task-1`.
- Pull contracts into `@ts-linq/types` (joint with `cache-redis/task-2`).
- Make the sync/async contract honest (joint with `cache-redis/task-3`).
- Unify failure handling through `SqlLogger` (joint with `cache-redis/task-4`).
- Make `clear()` either truly clear remote or be explicitly documented + renamed.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Migrate Memcached adapters onto the shared shadow-cache base | P1 | Removes clone-of-redis duplication |
| 2 | task-2.md — Move SqlCache/CountCache + MemjsClientLike contracts to types/single module | P1 | Kills re-declared contracts |
| 3 | task-3.md — Fix silently-incomplete clear() that leaves remote entries stale | P1 | Correctness gap: stale data survives clear() |

## Dependencies on other packages

- `@ts-linq/types` (`SqlCacheEntry`, `EntityCacheLike`).
- `@ts-linq/core` (declared dependency).
- Peer: `memjs` (optional).
- Tightly coupled to `cache-redis` by duplication — base extraction is joint.

## Testing strategy

- Reuse the shared contract suite (from cache-redis/task-1) against a fake
  `memjs`-shaped Buffer transport.
- Error-path tests for transport failures (degrade to miss, emit telemetry).
- A dedicated `clear()` semantics test (remote actually emptied OR documented
  shadow-only with a deliberate assertion).

## Notes

Almost every finding here is the Memcached mirror of a `cache-redis` finding;
tasks are written to be executed jointly. The one Memcached-specific correctness
issue is the no-op-on-remote `clear()`.
