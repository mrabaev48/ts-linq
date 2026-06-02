---
status: not-started
phase: phase-x
package: cache-redis
priority: P2
effort: S
risk: low
category: clean-code
depends_on: ["cache-redis/task-1.md"]
related: ["cache-memcached/task-1.md"]
---

# Refactor: Fix metrics inconsistency between get() and getAsync()

## Problem

In the Redis Sql cache adapter, the synchronous `get()` does not update
`_metrics`, while `getAsync()` does. Hit/miss/request counts therefore depend on
which read method a caller happens to use, making `getMetrics()` unreliable.

## Evidence

- `RedisSqlCacheAdapter.get()` — `RedisSqlCacheAdapter.ts:91-102` performs a
  shadow lookup, TTL check, and LRU touch but never touches `_metrics`
  (no `requests++`, `hits++`, or `misses++`).
- `RedisSqlCacheAdapter.getAsync()` — `:104-137` increments
  `_metrics.requests`, `_metrics.hits`, `_metrics.misses`.
- The Count adapter is *more* consistent: both `get()` (`RedisCountCacheAdapter.ts:78`)
  and `getAsync()` (`:94`) update metrics — so the two adapters disagree on the
  convention, confirming this is drift, not intent.
- `getMetrics()` (`:212`) reports these counters as if authoritative.

## Why this is bad

- **Misleading observability.** `db_cache_hits_total` / `misses_total` derived
  from `getMetrics()` undercount whenever the sync path is used, skewing hit-rate
  dashboards.
- **Duplication-induced inconsistency.** A direct symptom of the missing shared
  base (task-1): the same conceptual operation is instrumented differently in two
  methods of the same class and differently again across sibling classes.

## Target architecture

Centralize metric accounting in the shared base (task-1) so every read path —
sync shadow hit, sync miss, async remote hit, async miss, eviction,
invalidation — increments exactly one well-defined counter, in one place. This is
**SRP** (metrics is the base's concern) and **DRY**.

## Proposed refactor

1. After the base extraction (task-1), route all `get`/`getAsync` paths through
   shared helpers (`recordHit`, `recordMiss`, `recordRequest`) on the base.
2. Ensure sync `get()` records request/hit/miss identically to `getAsync()`.
3. Define and document the canonical counting semantics (e.g. one `request` per
   public read call; `hit` only on served value; `miss` otherwise).

## Suggested design patterns

- **SRP / DRY:** single metric accounting path in the base.

## Testing plan

- Unit: N sync `get()` hits + M sync `get()` misses produce `requests=N+M`,
  `hits=N`, `misses=M`.
- Unit: same counts via `getAsync()` produce identical totals.
- Unit: eviction and invalidation increment their counters once each.

## Acceptance criteria

- [ ] Sync and async read paths update `_metrics` identically.
- [ ] Counting semantics documented and asserted by tests.
- [ ] `getMetrics()` hit-rate is consistent regardless of read method used.

## Refactor order

1. Land task-1.
2. Centralize counters in base.
3. Add metric-accounting tests.

## Notes

Small but worth a discrete task because the inconsistency directly corrupts the
Prometheus cache-hit metrics fed by `cacheSize`/`cache` events downstream.
