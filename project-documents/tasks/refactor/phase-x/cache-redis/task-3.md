---
status: not-started
phase: phase-x
package: cache-redis
priority: P1
effort: M
risk: high
category: error-handling
depends_on: ["cache-redis/task-2.md"]
related: ["cache-memcached/task-3.md", "cache/task-1.md"]
---

# Refactor: Make sync vs async cache contract explicit (ISP) and fix off-contract getAsync

## Problem

The adapters implement strictly synchronous contracts (`SqlCache.get`,
`CountCache.get`, `EntityCacheLike.get`) but their *actual* remote-read
capability is exposed only through an off-contract `getAsync` method (Sql/Count)
or is entirely unavailable on the sync path (Entity). Callers using the declared
interface can never read remote data; they silently get `undefined` and a
background fetch that only helps a *future* call.

## Evidence

- `RedisSqlCacheAdapter` `implements SqlCache` (sync) but adds
  `async getAsync(key)` at `RedisSqlCacheAdapter.ts:104` that does the real
  remote read.
- `RedisCountCacheAdapter.getAsync` at `RedisCountCacheAdapter.ts:94` — same.
- `RedisEntityCacheAdapter.get()` at `RedisEntityCacheAdapter.ts:95-126`: on a
  shadow miss it calls `triggerAsyncFetch(key)` (line 112) and **returns
  `undefined`** — the long comment at lines 103-110 admits it "DOES NOT support
  transparent lazy loading from Redis on get()". The first read of any key always
  misses, even when Redis holds the value.
- `getAsync` is not part of `SqlCache`/`CountCache`, so it is invisible to any
  consumer typed against the interface (and to `CompositeSqlLogger`-style
  composition of caches).

## Why this is bad

- **ISP / Liskov violation.** The class claims a contract it cannot honour
  meaningfully (sync `get` that can never serve remote data). Substituting a
  Redis adapter where a sync cache is expected changes correctness, not just
  performance.
- **Hidden API.** The genuinely useful method (`getAsync`) is undiscoverable
  through the type system, so consumers either down-cast to the concrete class
  (breaking DIP) or never benefit from Redis at all.
- **Correctness surprise.** The entity adapter's "fetch for next time" means a
  cold key is *always* a miss on first access — counterintuitive for a cache and
  a latent source of duplicated DB load.

## Target architecture

Introduce an explicit **async cache contract** and let callers depend on it via
DIP, while keeping the sync contract for purely in-process caches:

- `interface AsyncSqlCache { getAsync(key): Promise<SqlCacheEntry | undefined>; setAsync(...): Promise<void>; ... }`
  (and `AsyncCountCache`, `AsyncEntityCache`) in `@ts-linq/types`.
- Remote adapters implement the **async** contract as their primary surface; the
  sync `get()` becomes an honest "shadow-only" fast path that is explicitly
  documented as such (or is removed from the public surface if the ORM can call
  the async path).
- The ORM's cache-consuming code should prefer the async contract for remote
  backends. Investigate whether the call sites in `core` can `await` the cache;
  if not, document the sync `get()` as shadow-only and expose `getAsync` on the
  interface so it is at least type-visible.

This applies **ISP** (separate sync vs async capabilities) and **DIP**
(consumers depend on the capability they actually need).

## Proposed refactor

1. Define `Async*Cache` contracts in `@ts-linq/types`.
2. Have remote adapters declare `implements Async*Cache`; keep sync `get()` but
   annotate it (and its docs) as shadow-only.
3. Audit `@ts-linq/core` cache call sites to determine whether an async read
   path is feasible; capture findings in this task before changing core.
4. For the entity adapter, either provide a real `getAsync` (currently absent —
   only `triggerAsyncFetch` exists) or document the sync-only limitation
   prominently.

## Suggested design patterns

- **ISP:** split sync vs async cache capabilities.
- **DIP:** consumers depend on the async contract abstraction.
- **Null Object (optional):** a no-op cache implementing both contracts for the
  "caching disabled" path, avoiding `if (cache)` checks in core.

## Testing plan

- Contract: remote adapter satisfies `Async*Cache`; cold-key `getAsync` returns
  the remote value (with a fake transport holding a value).
- Regression: cold-key sync `get()` documented behaviour (shadow-only) is
  asserted so the limitation is intentional, not accidental.
- Integration: ORM call site (if migrated to async) serves cached results from
  Redis on first access.

## Acceptance criteria

- [ ] Explicit `Async*Cache` contracts exist in `@ts-linq/types`.
- [ ] Remote adapters expose their real read capability through the type system.
- [ ] Entity adapter cold-key behaviour is either fixed (real async get) or
      documented as an intentional shadow-only limitation with a test.
- [ ] No consumer needs to down-cast to a concrete adapter class to read remotely.

## Refactor order

1. Define async contracts in types.
2. Declare on adapters; document sync get().
3. Audit + (optionally) migrate core call sites.

## Notes

`risk: high` because changing the cache read contract touches `@ts-linq/core`
hot paths. The audit step (3) must precede any core change; if async migration
is infeasible, the minimum acceptable outcome is making `getAsync` type-visible
and documenting the sync limitation.
