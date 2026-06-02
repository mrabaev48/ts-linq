---
status: not-started
phase: phase-x
package: cache-memcached
priority: P1
effort: M
risk: medium
category: package-boundary
depends_on: []
related: ["cache-redis/task-2.md"]
---

# Refactor: Move SqlCache/CountCache + MemjsClientLike contracts to types/single module

## Problem

`SqlCache`, `CountCache`, `CountCacheEntry`, and `MemjsClientLike` are
re-declared inside Memcached adapter files, mirroring the same `@ts-linq/types`
omission found in `cache-redis`. One adapter imports the transport type from a
sibling adapter file.

## Evidence

- `SqlCache` declared in `MemcachedSqlCacheAdapter.ts:3` (duplicate of the Redis
  and `types` notions).
- `CountCache` + `CountCacheEntry` in `MemcachedCountCacheAdapter.ts:1-10`.
- `MemjsClientLike` declared in both `MemcachedSqlCacheAdapter.ts:9-17` and
  `MemcachedCountCacheAdapter.ts:12-20`.
- `MemcachedEntityCacheAdapter.ts:3` imports `MemjsClientLike` from
  `./MemcachedSqlCacheAdapter` — accidental coupling between adapters.
- `index.ts` re-exports `MemjsClientLike` under two aliases
  (`MemcachedCountClientLike`, `MemcachedSqlClientLike`).

## Why this is bad

- **DRY / Single Source of Truth.** Same as `cache-redis/task-2`: cache role
  contracts belong in `@ts-linq/types`, not buried per adapter.
- **Accidental coupling.** Sourcing transport types from a sibling adapter file
  blocks the base extraction and obscures the dependency graph.

## Target architecture

- `SqlCache`/`CountCache`/`CountCacheEntry` live in `@ts-linq/types` (shared with
  `cache-redis`, satisfying both packages from one declaration).
- `MemjsClientLike` declared once in `cache-memcached/src/memcached/contracts.ts`.
- Adapters import role contracts from `types`, transport from the local module.
  Applies **DIP** + **ISP**.

## Proposed refactor

1. Reuse the `types` additions from `cache-redis/task-2` (do not re-add).
2. Create `cache-memcached/src/memcached/contracts.ts` with the single
   `MemjsClientLike`.
3. Repoint all three adapters.
4. Keep `index.ts` exports stable; mark redundant aliases `@deprecated`.

## Suggested design patterns

- **DIP / ISP:** focused contracts, depended upon from `types` + one local
  module.

## Testing plan

- Typecheck: adapters satisfy `SqlCache`/`CountCache` from `types`.
- Contract: a `memjs`-shaped client is assignable to the single `MemjsClientLike`.
- Verify `index.ts` public surface unchanged.

## Acceptance criteria

- [ ] No role contract re-declared in Memcached adapter files.
- [ ] `MemjsClientLike` declared once.
- [ ] No adapter imports types from a sibling adapter file.
- [ ] Public export surface unchanged or additive.

## Refactor order

1. Depends on `types` additions from cache-redis/task-2.
2. Single-source `MemjsClientLike`.
3. Repoint adapters.

## Notes

Joint with `cache-redis/task-2`; the `types` additions are shared.
