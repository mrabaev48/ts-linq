# Refactor Audit: cache-redis

## Package responsibility

`@ts-linq/cache-redis` provides Redis-backed adapters for the ORM's three cache
roles — entity L2 (`RedisEntityCacheAdapter`), generated-SQL cache
(`RedisSqlCacheAdapter`), and count cache (`RedisCountCacheAdapter`). Each adapter
is a write-through cache with a local in-process **shadow** Map (LRU-ish + TTL),
optional key hashing, and optional pub/sub invalidation.

## Current architectural problems

1. **Massive cross-package + intra-package duplication.** All three Redis
   adapters and all three Memcached adapters share ~90% identical structure:
   shadow Map management, `ensureCapacity` eviction, TTL expiry, LRU touch,
   `buildKey`/`k`/`getNamespacedKey`, djb2 `h`, `_metrics`, `getMetrics`,
   `invalidateBy`, pub/sub subscribe/publish. Only the transport (`client.get`,
   `set`, `del`) differs. There is no shared base.
2. **Adapter-local re-declared interfaces.** `RedisClientLike`,
   `RedisSubscriberLike`, `RedisPublisherLike` are declared independently in
   both `RedisSqlCacheAdapter.ts` and `RedisCountCacheAdapter.ts`; `SqlCache` /
   `CountCache` contracts are re-declared in each adapter rather than living in
   `@ts-linq/types`.
3. **Interface Segregation / honesty violation.** `RedisSqlCacheAdapter` and
   `RedisCountCacheAdapter` advertise themselves via `implements SqlCache` /
   `implements CountCache` — purely synchronous contracts — yet their real
   value (remote reads) is only available through an off-contract `getAsync`
   method. `RedisEntityCacheAdapter.get()` can *never* return a remote value on
   the synchronous interface; it only fires a background fetch that helps "next
   time". The advertised contract is misleading.
4. **Inconsistent error handling.** Write-through/delete failures are silently
   swallowed in the Sql/Entity adapters but `console.warn`'d in the Count
   adapter — same failure class, three different policies, none surfaced to the
   ORM's `SqlLogger`.
5. **Metrics inconsistency.** `RedisSqlCacheAdapter.get()` does not increment
   `_metrics` while `getAsync()` does, so hit/miss counts depend on which method
   the caller happens to use.

## Refactor goals

- Extract a shared **abstract base adapter** (Template Method) so Redis and
  Memcached only implement the transport (`readRemote`/`writeRemote`/
  `deleteRemote`).
- Centralize `SqlCache`/`CountCache`/transport interfaces in `@ts-linq/types`.
- Make the sync-vs-async contract explicit and honest (ISP).
- Route backend failures through a single, consistent degradation policy that
  notifies the `SqlLogger` instead of silent/ad-hoc `console.warn`.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Extract shared abstract shadow-cache base (Template Method) shared by Redis + Memcached | P1 | Removes ~6x duplication; biggest structural win |
| 2 | task-2.md — Centralize SqlCache/CountCache + transport client interfaces in types | P1 | Kills re-declared contracts; enables the base |
| 3 | task-3.md — Make sync vs async cache contract explicit (ISP) and fix off-contract getAsync | P1 | Adapters lie about their capabilities today |
| 4 | task-4.md — Unify backend-failure degradation policy and route through SqlLogger | P1 | Inconsistent silent/console.warn handling |
| 5 | task-5.md — Fix metrics inconsistency between get() and getAsync() | P2 | Hit/miss counts are method-dependent |

## Dependencies on other packages

- `@ts-linq/types` (`SqlCacheEntry`, `EntityCacheLike`).
- `@ts-linq/core` (declared dependency).
- Peer: `ioredis` / `redis` (optional).
- Tightly parallels `@ts-linq/cache-memcached` — the base-class extraction is a
  joint task across both.

## Testing strategy

- Contract tests run against the shared base via a fake in-memory transport, so
  Redis and Memcached adapters are validated by the *same* suite.
- Error-path tests: transport throws on read → adapter degrades to miss (valid
  recovery, no exception bubbles); transport throws on write → degradation event
  emitted, shadow remains consistent.
- TTL/eviction/LRU unit tests live once on the base.

## Notes

The single highest-value refactor in this cluster: six near-identical adapter
classes collapse to one base + three thin transport implementations per backend.
Error-handling classification — a backend network error degrading to a cache
*miss* is VALID recovery; the problem is the *inconsistent and unreported*
handling, plus the entity adapter's inability to ever serve remote data
synchronously.
