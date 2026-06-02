---
status: not-started
phase: phase-x
package: cache-redis
priority: P1
effort: M
risk: medium
category: package-boundary
depends_on: []
related: ["cache-memcached/task-2.md"]
---

# Refactor: Centralize SqlCache/CountCache + transport client interfaces in types

## Problem

The cache *role* contracts (`SqlCache`, `CountCache`) and the Redis transport
contracts (`RedisClientLike`, `RedisSubscriberLike`, `RedisPublisherLike`) are
re-declared inside individual adapter files rather than living in the shared
`@ts-linq/types` package. `CountCacheEntry` is also re-declared per adapter.

## Evidence

- `SqlCache` declared in `cache-redis/src/redis/RedisSqlCacheAdapter.ts:3` AND
  `cache-memcached/src/memcached/MemcachedSqlCacheAdapter.ts:3`.
- `CountCache` + `CountCacheEntry` declared in
  `cache-redis/src/redis/RedisCountCacheAdapter.ts:1-10` AND
  `cache-memcached/src/memcached/MemcachedCountCacheAdapter.ts:1-10`.
- `RedisClientLike`, `RedisSubscriberLike`, `RedisPublisherLike` declared
  independently in BOTH `RedisSqlCacheAdapter.ts:9-21` and
  `RedisCountCacheAdapter.ts:12-24`.
- `RedisEntityCacheAdapter.ts:3-7` imports those transport types from
  `./RedisSqlCacheAdapter` — i.e. one adapter file is the de-facto "types module"
  for another, an accidental coupling.
- `index.ts` re-exports `RedisClientLike` under two aliases
  (`RedisCountClientLike`, `RedisSqlClientLike`) papering over the duplication.

## Why this is bad

- **DRY / Single Source of Truth.** Multiple definitions of the same contract;
  `SqlCacheEntry` already lives in `@ts-linq/types` (`types/src/index.ts:560`)
  but the *cache role* interfaces that wrap it do not.
- **Accidental coupling.** Importing transport types from a sibling adapter file
  (`RedisEntityCacheAdapter` ← `RedisSqlCacheAdapter`) couples unrelated adapters
  and blocks the base-class extraction (task-1).
- **Boundary violation.** Per CLAUDE.md, shared abstractions belong in
  shared/core packages and public APIs go through entrypoints — not buried in an
  implementation file.

## Target architecture

- Move `SqlCache`, `CountCache`, `CountCacheEntry` (or a generic
  `RoleCache<T>`), and a backend-agnostic transport contract into
  `@ts-linq/types`. The Redis-specific `RedisClientLike` etc. can remain in the
  adapter package but should be declared once (a single `redis/contracts.ts`),
  not per adapter.
- Adapters import role contracts from `types` and transport contracts from one
  local module. This applies **DIP** and **ISP** (small, focused contracts).

## Proposed refactor

1. Add `SqlCache`, `CountCache`, `CountCacheEntry` (or generic) to
   `@ts-linq/types`.
2. Create `cache-redis/src/redis/contracts.ts` with the single declaration of
   `RedisClientLike`/`RedisSubscriberLike`/`RedisPublisherLike`.
3. Update all three Redis adapters to import from those two locations.
4. Keep the public `index.ts` re-exports stable (preserve the existing alias
   exports to avoid a breaking change; mark aliases `@deprecated`).

## Suggested design patterns

- **DIP:** adapters depend on contracts from `types`, not on each other.
- **ISP:** transport split into the minimal `get/set/del`, `subscribe`,
  `publish` surfaces already present.

## Testing plan

- Typecheck: adapters still satisfy `implements SqlCache`/`CountCache` from
  `types`.
- Contract: a `tsd`/compile fixture asserting an `ioredis`-shaped client is
  assignable to the single `RedisClientLike`.
- Ensure no public export removed (back-compat) — verify `index.ts` surface.

## Acceptance criteria

- [ ] `SqlCache`/`CountCache`/`CountCacheEntry` declared once, in `@ts-linq/types`.
- [ ] Redis transport interfaces declared once in a dedicated module.
- [ ] No adapter imports types from a sibling adapter file.
- [ ] Public `index.ts` export surface unchanged (or only additive).
- [ ] `pnpm build` + `pnpm typecheck` pass.

## Refactor order

1. Add contracts to `types`.
2. Single-source the Redis transport contracts.
3. Repoint adapters.
4. Mirror in cache-memcached/task-2.

## Notes

Prerequisite for the base-class extraction (task-1): the base must reference one
canonical set of contracts.
