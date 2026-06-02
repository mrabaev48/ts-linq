---
status: not-started
phase: phase-x
package: cache
priority: P2
effort: S
risk: medium
category: typescript
depends_on: ["cache/task-1.md"]
related: ["cache-redis/task-1.md", "cache-memcached/task-1.md"]
---

# Refactor: Replace Function-keyed / String(id) cache key building with collision-safe strategy

## Problem

The L2 entity cache builds keys as `` `${entityClass.name}|${String(id)}` `` and
types the entity argument as `Function`. This is both a TypeScript anti-pattern
and a correctness hazard for non-primitive ids.

## Evidence

- `packages/cache/src/EntityCache.ts:30` —
  `return \`${entityClass.name}|${String(id)}\`;`
- `packages/cache/src/EntityCache.ts:8-10` — public methods typed with
  `entityClass: Function`, `id: unknown`.
- The identical pattern is copy-pasted into the adapters:
  `cache-redis/src/redis/RedisEntityCacheAdapter.ts:86-88` and
  `cache-memcached/src/memcached/MemcachedEntityCacheAdapter.ts:51-53`.

## Why this is bad

- **`Function` type smell.** `Function` accepts any callable, defeats type
  checking, and is flagged by `@typescript-eslint/ban-types`. The cache cannot
  distinguish an entity constructor from an arbitrary function.
- **Key collisions via `String(id)`.** Composite or object ids stringify to
  `[object Object]`, collapsing distinct entities to one key — a silent
  data-corruption bug for any consumer with non-scalar keys.
- **Name collisions.** `entityClass.name` is not unique across modules
  (minification, duplicate class names) — two different entity types can share a
  cache namespace.

## Target architecture

Introduce a small, testable, injectable key strategy (Strategy pattern) on the
canonical `EntityCacheLike` contract, defaulting to a safe serializer:

- Type the entity argument as an entity constructor
  (`abstract new (...args: any[]) => object` or the project's existing
  `EntityCtor`/metadata token) instead of `Function`.
- Build keys from a stable entity identifier (the metadata-registered table or
  entity name token, not `.name`) plus a canonical id serialization that handles
  arrays/objects (e.g. JSON of sorted composite-key tuple).
- Expose key building as a pluggable `CacheKeyStrategy` so adapters reuse it
  rather than re-implementing `buildKey`.

This applies **SRP** (key building is its own concern), **DIP** (adapters depend
on the strategy abstraction), and **Strategy pattern** (swap key schemes without
touching cache logic).

## Proposed refactor

1. Define `interface CacheKeyStrategy { build(entity: EntityCtor, id: unknown): string }`
   in `@ts-linq/types` (next to `EntityCacheLike`).
2. Provide a default `DefaultEntityKeyStrategy` that resolves a stable entity
   token (via metadata if available, else a registered name) and serializes
   composite ids deterministically.
3. Have `EntityCache` and both remote entity adapters consume the strategy
   instead of a local `buildKey`.

## Suggested design patterns

- **Strategy:** `CacheKeyStrategy` makes the key scheme swappable and unit
  testable in isolation.
- **DIP:** adapters depend on the strategy interface, not concrete code.
- **Single Source of Truth:** one key implementation shared by L2 + remote
  adapters (ties into cache-redis/cache-memcached task-1).

## Testing plan

- Unit: distinct composite ids produce distinct keys; object ids do not collapse
  to `[object Object]`; same id produces stable key across calls.
- Unit: two entity types with the same class name produce different keys.
- Contract: the default strategy is used identically by `EntityCache` and the
  remote entity adapters (shared base from cache-redis/memcached task-1).

## Acceptance criteria

- [ ] Public cache methods no longer type the entity arg as bare `Function`.
- [ ] Composite/object ids cannot collide via `String(id)`.
- [ ] Key building is a single shared, injectable strategy reused by L2 + remote
      entity adapters.
- [ ] Unit tests cover composite ids and class-name collisions.

## Refactor order

1. Land cache/task-1 (single contract location) first.
2. Add `CacheKeyStrategy` + default to `types`.
3. Migrate `EntityCache`, then the two remote adapters.

## Notes

Lower priority than the duplication tasks but should be coordinated with the
adapter-base extraction so the strategy is defined once and reused everywhere.
