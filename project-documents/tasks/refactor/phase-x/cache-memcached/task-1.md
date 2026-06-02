---
status: not-started
phase: phase-x
package: cache-memcached
priority: P1
effort: L
risk: medium
category: architecture
depends_on: ["cache-redis/task-1.md", "cache-memcached/task-2.md"]
related: ["cache-redis/task-1.md"]
---

# Refactor: Migrate Memcached adapters onto the shared shadow-cache base

## Problem

The three Memcached adapters duplicate the shadow-cache machinery already
duplicated across the three Redis adapters. Only the transport differs (`memjs`
Buffer-based `get/set/delete` plus a `decode()` Buffer→string helper). There is
no shared base; every TTL/LRU/eviction fix must be applied here too.

## Evidence

- Shadow + `{ value, ts }`: `MemcachedSqlCacheAdapter.ts:34`,
  `MemcachedCountCacheAdapter.ts:37`, `MemcachedEntityCacheAdapter.ts:36`.
- `ensureCapacity()`: `MemcachedSqlCacheAdapter.ts:178`,
  `MemcachedCountCacheAdapter.ts:154`, `MemcachedEntityCacheAdapter.ts:151`.
- TTL expiry + LRU touch in `get()`: `MemcachedSqlCacheAdapter.ts:60-74`
  (identical to `RedisSqlCacheAdapter.ts:91-102`).
- djb2 `h()`/`computeHash()`: `MemcachedSqlCacheAdapter.ts:194`,
  `MemcachedCountCacheAdapter.ts:170`, `MemcachedEntityCacheAdapter.ts:160`.
- `_metrics` + `getMetrics()`: all three.
- `getAsync()` remote read: `MemcachedSqlCacheAdapter.ts:76`,
  `MemcachedCountCacheAdapter.ts:79`.
- Memcached-only delta: `decode()` Buffer helper
  (`MemcachedSqlCacheAdapter.ts:51`, `MemcachedCountCacheAdapter.ts:54`) and
  `{ expires }` option shape on `set`.

## Why this is bad

- **DRY violation across packages.** Six total copies (3 Redis + 3 Memcached) of
  the same caching policy.
- **Divergence risk.** The `clear()` semantics already differ
  (Memcached `clear()` increments `invalidations` by shadow size;
  Redis `clear()` publishes to pub/sub) — proof the copies have drifted.

## Target architecture

Reuse the **Template Method / composition** base defined in `cache-redis/task-1`.
Memcached supplies a `RemoteTransport` implementing:

- `readRemote(key): Promise<string | null>` — wraps `client.get` + `decode`.
- `writeRemote(key, payload, ttl?): Promise<void>` — wraps `client.set` with
  `{ expires }`.
- `deleteRemote(key): Promise<void>` — wraps `client.delete`.

Memcached has no pub/sub, so its transport returns no-op `subscribe`/`publish`
(Null Object), keeping the base uniform. This satisfies **OCP** (new backend =
new transport), **SRP**, **DIP**, **DRY**.

## Proposed refactor

1. Depend on the shared base (cache-redis/task-1) and contracts
   (cache-memcached/task-2).
2. Implement `MemcachedTransport` (Buffer encode/decode + `{ expires }`).
3. Reduce each Memcached adapter to base + transport + role serializer.
4. Move TTL/LRU/eviction tests onto the shared base suite (run with the Memcached
   fake transport).

## Suggested design patterns

- **Template Method / Strategy:** shared policy, varying transport.
- **Null Object:** no-op pub/sub for Memcached (no broadcast invalidation).
- **Composition over inheritance:** inject transport into the base.

## Testing plan

- Contract suite (shared) against a fake `memjs` Buffer transport.
- Buffer decode edge cases: null value, non-UTF8 bytes (already guarded by
  `decode()` catch — preserve that behaviour as valid recovery).
- Eviction/TTL parity with the Redis run of the same suite.

## Acceptance criteria

- [ ] Memcached adapters contain only transport + role serialization.
- [ ] No duplicated `ensureCapacity`/`h()`/`getMetrics`/TTL logic remains.
- [ ] The shared contract suite passes against the Memcached transport.
- [ ] `pnpm build`, `pnpm typecheck`, package tests pass.

## Refactor order

1. cache-redis/task-1 (base) + cache-memcached/task-2 (contracts).
2. Implement `MemcachedTransport`.
3. Migrate adapters; consolidate tests.

## Notes

Joint execution with `cache-redis/task-1`. The Buffer `decode()` catch is VALID
recovery (corrupt bytes → miss) and should be preserved inside the transport.
