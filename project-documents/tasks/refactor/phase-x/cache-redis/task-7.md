---
status: not-started
phase: phase-x
package: cache-redis
priority: P1
effort: S
risk: medium
category: typescript
depends_on: ["cache-redis/task-2.md"]
related: ["cache-memcached/task-2.md"]
---

# Refactor: Local re-declared SqlCache/CountCache interfaces are narrower than the canonical contract

## Problem
Each adapter file re-declares its own `SqlCache` / `CountCache` interface, and
those local copies are *narrower* than the canonical interfaces in
`@ts-linq/types`. `class RedisSqlCacheAdapter implements SqlCache` therefore
binds to the local 3-method interface, not the real contract — the adapter
*appears* to satisfy `SqlCache` while omitting members the canonical contract
requires, and TypeScript never flags the mismatch.

## Evidence
- Local `SqlCache` (only `get`/`set`/`clear`):
  `packages/cache-redis/src/redis/RedisSqlCacheAdapter.ts:3-7`
  and `packages/cache-memcached/src/memcached/MemcachedSqlCacheAdapter.ts:3-7`.
- Canonical `SqlCache` requires `size(): number` and optionally
  `invalidateBy`/`getMetrics`:
  `packages/types/src/index.ts:565-574`.
- Local `CountCache` (only `get`/`set`/`clear`):
  `RedisCountCacheAdapter.ts:6-10`, `MemcachedCountCacheAdapter.ts:6-10`;
  canonical adds optional `invalidateBy`/`getMetrics`:
  `packages/types/src/index.ts:549-557`.
- The adapters *do* implement the extra members (`size`, `invalidateBy`,
  `getMetrics`) — e.g. `RedisSqlCacheAdapter.size()` line 169,
  `invalidateBy()` line 173, `getMetrics()` line 212 — but the `implements`
  clause points at the local narrow interface, so the conformance to the real
  `@ts-linq/types` contract is never type-checked.

## Why this is bad
- False conformance: an adapter could drop `size()` and still compile, then fail
  at runtime where `@ts-linq/core` calls `cache.size()` through the canonical
  `SqlCache` type.
- Two definitions of the same contract → drift (the local copies already differ
  from the canonical one).
- Violates Single Source of Truth and Dependency Inversion (depend on the
  published abstraction).

## Target architecture
- The adapters `implements` the canonical `SqlCache` / `CountCache` from
  `@ts-linq/types`. No local re-declaration of these contracts anywhere in the
  adapter packages (this is the type-correctness half of cache-redis/task-2's
  contract-centralization).

## Proposed refactor
1. Delete the local `SqlCache` / `CountCache` interface declarations from the
   adapter files.
2. `import type { SqlCache, CountCache } from '@ts-linq/types'` and use those in
   the `implements` clauses.
3. Fix any conformance errors surfaced (they should already be satisfied since
   `size`/`invalidateBy`/`getMetrics` are implemented).
4. Keep transport-client interfaces (`RedisClientLike`, `MemjsClientLike`)
   handled by cache-redis/task-2 (they are a separate concern).

## Suggested design patterns
- **Dependency Inversion**: implement the published contract, not a private copy.
- **Single Source of Truth** for the cache contract.

## Testing plan
- `pnpm typecheck` must enforce full canonical-contract conformance.
- Add a type-level test asserting each adapter is assignable to the canonical
  `SqlCache` / `CountCache` type.
- Existing adapter unit tests continue to pass.

## Acceptance criteria
- [ ] No local `SqlCache` / `CountCache` interface remains in adapter files.
- [ ] Adapters `implements` the `@ts-linq/types` contracts.
- [ ] Type-level assignability test added.
- [ ] `pnpm typecheck` passes.

## Refactor order
Do together with cache-redis/task-2 (contract centralization). This task is the
type-correctness aspect; task-2 also relocates the transport-client interfaces.

## Notes
Applies symmetrically to cache-memcached (see cache-memcached/task-2). Low effort
but real correctness value: it closes a silent gap between declared and required
contract.
