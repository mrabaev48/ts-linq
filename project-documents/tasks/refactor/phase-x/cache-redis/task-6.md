---
status: not-started
phase: phase-x
package: cache-redis
priority: P2
effort: S
risk: low
category: package-boundary
depends_on: []
related: ["cache-memcached/task-2.md"]
---

# Refactor: Remove unused `@ts-linq/core` hard dependency from cache adapters

## Problem
`@ts-linq/cache-redis` (and `@ts-linq/cache-memcached`) declare `@ts-linq/core`
as a regular runtime `dependency`, but neither package imports anything from
`@ts-linq/core`. The base `@ts-linq/cache` package, by contrast, declares
`@ts-linq/core` as a *peer* dependency. This is both an unused dependency and an
inconsistent boundary declaration across the cache family.

## Evidence
- `packages/cache-redis/package.json` — `dependencies` includes
  `"@ts-linq/core": "workspace:*"`.
- `packages/cache-memcached/package.json` — same.
- Source grep: no `@ts-linq/core` import exists in
  `packages/cache-redis/src` or `packages/cache-memcached/src`
  (the adapters import only from `@ts-linq/types`:
  `RedisSqlCacheAdapter.ts:1`, `RedisEntityCacheAdapter.ts:1`,
  `MemcachedSqlCacheAdapter.ts:1`, etc.).
- `packages/cache/package.json` declares `@ts-linq/core` under
  `peerDependencies`, not `dependencies` — inconsistent with the adapters.

## Why this is bad
- Declares a dependency edge that does not exist → misleads dependency-graph
  tooling (`pnpm arch:deps`), risks introducing an accidental cycle, and bloats
  the install/closure for publishable packages (`cache-redis`/`cache-memcached`
  are not `private`).
- Inconsistent dependency *kind* (dep vs peer) across packages that play the same
  architectural role.

## Target architecture
- Cache backend adapters depend only on the contracts they actually use
  (`@ts-linq/types`) and their transport peer (`ioredis`/`redis`, `memjs`).
- Any dependency on `@ts-linq/core` is either removed (if truly unused) or made a
  peer dependency consistent with `@ts-linq/cache`.

## Proposed refactor
1. Confirm via `pnpm arch:deps` that nothing in either adapter package imports
   `@ts-linq/core`.
2. Remove `@ts-linq/core` from `dependencies` in both `package.json` files (or
   move to `peerDependencies` if a future need is intended — but only if real).
3. Re-run `pnpm arch:deps` / `pnpm arch:cycles` to confirm the graph is cleaner.

## Suggested design patterns
- **Dependency Inversion / minimal coupling**: depend on the abstraction package
  (`@ts-linq/types`) only.

## Testing plan
- `pnpm build` and `pnpm typecheck` pass after removal.
- `pnpm arch:deps` shows no `cache-redis`/`cache-memcached` → `core` edge.
- Existing adapter tests still pass.

## Acceptance criteria
- [ ] No unused `@ts-linq/core` dependency in either adapter package.
- [ ] Dependency kind is consistent across the cache family.
- [ ] Architecture tooling confirms the edge is gone.

## Refactor order
Independent, trivial; can land before or after the shared-base work.

## Notes
Check `pnpm-lock.yaml` updates are committed. Since these packages are publishable,
trimming the dependency closure has real downstream value.
