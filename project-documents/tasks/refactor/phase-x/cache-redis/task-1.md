---
status: not-started
phase: phase-x
package: cache-redis
priority: P1
effort: L
risk: medium
category: architecture
depends_on: ["cache-redis/task-2.md"]
related: ["cache-memcached/task-1.md", "cache/task-3.md"]
---

# Refactor: Extract shared abstract shadow-cache base (Template Method) shared by Redis + Memcached

## Problem

The three Redis adapters and the three Memcached adapters re-implement the same
shadow-cache machinery six times. Only the transport calls differ
(`ioredis`-style `get/set/del` vs `memjs`-style `get/set/delete` with Buffer).
There is no shared base, so every fix (TTL bug, LRU bug, eviction bug) must be
applied in up to six places.

## Evidence

Near-identical members across all six adapters:

- Shadow map + entry shape `{ value, ts }`:
  `cache-redis/src/redis/RedisSqlCacheAdapter.ts:54`,
  `RedisCountCacheAdapter.ts:46`, `RedisEntityCacheAdapter.ts:48`;
  `cache-memcached/src/memcached/MemcachedSqlCacheAdapter.ts:34`,
  `MemcachedCountCacheAdapter.ts:37`, `MemcachedEntityCacheAdapter.ts:36`.
- `ensureCapacity()` FIFO eviction loop: `RedisSqlCacheAdapter.ts:195`,
  `RedisCountCacheAdapter.ts:172`, `MemcachedSqlCacheAdapter.ts:178`,
  `MemcachedCountCacheAdapter.ts:154`, etc.
- TTL-expiry + LRU-touch in `get()`: `RedisSqlCacheAdapter.ts:91-102`,
  `MemcachedSqlCacheAdapter.ts:60-74` (identical logic).
- djb2 hash `h()` / `computeHash()`: `RedisSqlCacheAdapter.ts:223`,
  `RedisCountCacheAdapter.ts:199`, `RedisEntityCacheAdapter.ts:208`,
  `MemcachedSqlCacheAdapter.ts:194`, `MemcachedCountCacheAdapter.ts:170`,
  `MemcachedEntityCacheAdapter.ts:160`.
- `_metrics` shape + `getMetrics()`: present (and duplicated) in all six.
- `invalidateBy()`: `RedisSqlCacheAdapter.ts:173`, `RedisCountCacheAdapter.ts:151`,
  `MemcachedSqlCacheAdapter.ts:141`, `MemcachedCountCacheAdapter.ts:135`.

## Why this is bad

- **DRY violation at scale.** Six copies of TTL/LRU/eviction/hash/metrics — the
  most expensive form of duplication in the cluster.
- **Divergence already happening.** The Count adapter `console.warn`s on write
  failure while Sql/Entity adapters swallow silently; Sql `get()` skips metrics
  while `getAsync()` records them. These are duplication-induced inconsistencies.
- **Untestable core logic.** TTL/eviction correctness must be re-tested per
  adapter; there is no single unit under test.

## Target architecture

Apply the **Template Method** pattern with **composition-first** transport:

```
abstract class ShadowCacheBase<TStored, TPublic> {
  // owns: shadow Map, TTL expiry, LRU touch, ensureCapacity, _metrics,
  //       getMetrics, key namespacing + hashing, invalidateBy, pub/sub
  protected abstract readRemote(namespacedKey: string): Promise<string | null>;
  protected abstract writeRemote(namespacedKey, payload, ttlSeconds?): Promise<void>;
  protected abstract deleteRemote(namespacedKey: string): Promise<void>;
  protected abstract serialize(value: TPublic): string;
  protected abstract deserialize(raw: string): TPublic;
}
```

- Redis/Memcached each provide a thin **transport object** (composition) or a
  subclass implementing only `readRemote`/`writeRemote`/`deleteRemote`. Prefer a
  `RemoteTransport` interface injected into the base (composition over
  inheritance) so the base is not coupled to a class hierarchy.
- Concrete cache *roles* (Sql / Count / Entity) parameterize
  serialize/deserialize and public shape.
- This satisfies **SRP** (base = caching policy, transport = I/O), **OCP** (new
  backends add a transport, not a new copy), **DIP** (base depends on a
  transport abstraction), and **DRY**.

## Proposed refactor

1. Land cache-redis/task-2 first (shared `SqlCache`/`CountCache`/transport
   interfaces in `@ts-linq/types`).
2. Create the base in a shared location reachable by both adapter packages — the
   natural home is `@ts-linq/cache` (after cache/task-1 clarifies its role) or a
   small new internal module in `types`/`core`.
3. Implement `RemoteTransport` for Redis (string-based) and Memcached
   (Buffer-based, with the `decode()` helper folded into the transport).
4. Reduce each adapter to: construct base + transport + role serializer.
5. Move TTL/LRU/eviction/hash/metrics unit tests onto the base.

## Suggested design patterns

- **Template Method / Strategy:** caching policy fixed in base; transport varies.
- **Composition over inheritance:** inject `RemoteTransport` rather than forcing
  a deep class hierarchy across packages.
- **Single Source of Truth (DRY):** one TTL/eviction/hash implementation.

## Testing plan

- Unit (on base, with fake transport): TTL expiry, LRU touch ordering,
  `ensureCapacity` eviction at `shadowMaxSize`, metrics counts.
- Contract: run one shared suite against Redis transport and Memcached transport
  fakes; both must pass identically.
- Error-path: transport read rejects → degrade to miss; transport write rejects
  → degradation hook fired, shadow unaffected.

## Acceptance criteria

- [ ] One shared base owns shadow/TTL/LRU/eviction/hash/metrics/invalidateBy.
- [ ] Redis and Memcached adapters contain only transport + role serialization.
- [ ] No duplicated `ensureCapacity`/`h()`/`getMetrics` across the six adapters.
- [ ] A single contract suite validates both backends via fakes.
- [ ] `pnpm build`, `pnpm typecheck`, package unit tests pass.

## Refactor order

1. cache-redis/task-2 (shared interfaces).
2. Build base + `RemoteTransport`.
3. Migrate Redis Sql/Count/Entity.
4. Migrate Memcached (cache-memcached/task-1) onto the same base.
5. Consolidate tests onto base.

## Notes

This is a joint task with `cache-memcached/task-1`; they must land together so
both backends ride the same base. Coordinate key building with `cache/task-3`
(shared `CacheKeyStrategy`).
