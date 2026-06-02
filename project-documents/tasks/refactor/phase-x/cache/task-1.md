---
status: not-started
phase: phase-x
package: cache
priority: P1
effort: M
risk: medium
category: package-boundary
depends_on: []
related: ["cache-redis/task-1.md", "cache-memcached/task-1.md"]
---

# Refactor: Resolve triple duplication of EntityCache / EntityCacheLike across cache, core, types

## Problem

The same in-memory L2 cache abstraction exists in three places with three
slightly different definitions, and the `@ts-linq/cache` copy — despite the
package being *described* as the home of base cache abstractions — is not used
by anything in the monorepo.

## Evidence

- `packages/cache/src/EntityCache.ts:7` declares `interface EntityCacheLike`.
- `packages/types/src/index.ts:1043` declares an identical `interface EntityCacheLike`.
- `packages/cache/src/EntityCache.ts:14` declares `class EntityCache`.
- A second runtime implementation exists at
  `packages/core/src/utils/EntityCache.ts` (exported via
  `packages/core/src/utils/index.ts` and `packages/core/src/index.ts`).
- Repo search for `import ... from '@ts-linq/cache'` in `packages/**/src`
  returns no production consumers — only the `cache` package's own files.
- `packages/cache/src/index.ts` exports only `EntityCache`.

## Why this is bad

- **DRY / Single Source of Truth violation.** Two runtime classes and two
  interface declarations for one concept. A change to eviction or key logic in
  one copy silently diverges from the others.
- **Dishonest package boundary.** The package presents itself as the cache
  abstraction layer, but `core` ships its own copy and ignores it. New
  contributors cannot tell which `EntityCache` is authoritative.
- **Type identity hazard.** Two structurally-identical `EntityCacheLike`
  interfaces are assignable today, but any drift breaks cross-package typing
  with confusing errors.

## Target architecture

Apply the **Dependency Inversion Principle** and **single source of truth**:

- The *contract* (`EntityCacheLike`) belongs in `@ts-linq/types` — it is a pure
  type with no runtime, already consumed by the adapter packages.
- The *default implementation* (`EntityCache`) belongs in exactly one runtime
  package. Two clean options:
  - **(A) Consolidate into core:** delete `@ts-linq/cache`'s `EntityCache`,
    keep `core/src/utils/EntityCache.ts`, have it `implements EntityCacheLike`
    imported from `@ts-linq/types`. Mark `@ts-linq/cache` for removal.
  - **(B) Promote cache as the home:** delete `core/src/utils/EntityCache.ts`,
    re-export the `@ts-linq/cache` implementation from core, and make core
    depend on `@ts-linq/cache`. Keep `EntityCacheLike` in `types`.
- Recommendation: **(A)**, because `core` already owns the only live usage and
  `@ts-linq/cache` has no other reason to exist after CachePolicy is removed
  (see task-2).

## Proposed refactor

1. Confirm runtime call sites of the core `EntityCache` (grep
   `new EntityCache` / `EntityCache` in `packages/core/src`).
2. Make `core/src/utils/EntityCache.ts` `implements EntityCacheLike` from
   `@ts-linq/types` (remove the local interface there if present).
3. Delete `packages/cache/src/EntityCache.ts`'s `EntityCacheLike` interface;
   if option (A), schedule the whole `@ts-linq/cache` package for deletion in a
   follow-up once task-2 lands.
4. Update `@ts-linq/cache` `tests-new` accordingly (move/retire).

## Suggested design patterns

- **Dependency Inversion:** consumers and adapters depend on the
  `EntityCacheLike` abstraction in `types`, never on a concrete class.
- **Single Source of Truth (DRY):** one interface declaration, one default
  implementation.

## Testing plan

- Unit: keep the existing `EntityCache` behaviour tests against the surviving
  implementation (FIFO eviction at `maxSize`, null/undefined id guard, eviction
  metric emitted once per eviction).
- Contract: a type-level test (`tsd` or compile fixture) asserting the surviving
  `EntityCache` is assignable to `EntityCacheLike` from `@ts-linq/types`.
- Regression: ensure `pnpm build` + downstream package typechecks pass after the
  interface in `cache` is removed.

## Acceptance criteria

- [ ] Exactly one `EntityCacheLike` declaration remains (in `@ts-linq/types`).
- [ ] Exactly one default `EntityCache` runtime implementation remains.
- [ ] The surviving `EntityCache` explicitly `implements EntityCacheLike` from `types`.
- [ ] No production code imports a deleted symbol; `pnpm build` and `pnpm typecheck` pass.
- [ ] Behaviour tests preserved against the surviving implementation.

## Refactor order

1. Audit live usages.
2. Point the surviving class at the `types` interface.
3. Remove the duplicate interface(s).
4. Coordinate package deletion in a follow-up after task-2.

## Notes

Do this before any cache-adapter de-duplication (cache-redis/cache-memcached
task-1), because the shared adapter base should depend on the consolidated
`EntityCacheLike`/cache contracts rather than re-deriving them.
