---
status: not-started
phase: phase-x
package: cache
priority: P2
effort: S
risk: low
category: clean-code
depends_on: []
related: []
---

# Refactor: Remove dead, unexported, duplicated CachePolicy from cache package

## Problem

`packages/cache/src/CachePolicy.ts` defines `CachePolicyOptions`,
`CachePolicy` (a Stage-3 class decorator), and `getCachePolicy`. This file is a
near-verbatim duplicate of the canonical decorator in `@ts-linq/core`, AND it is
not exported from the package entrypoint, so it is unreachable dead code.

## Evidence

- `packages/cache/src/CachePolicy.ts:15` — `export function CachePolicy(...)`.
- `packages/core/src/decorators/CachePolicy.ts` — identical
  `CachePolicyOptions`, `cachePolicies` WeakMap, `CachePolicy`, `getCachePolicy`
  (byte-for-byte the same logic, including the
  `'@CachePolicy requires TS5 Stage-3 decorators'` throw).
- `packages/cache/src/index.ts:1` — only `export * from './EntityCache';`.
  `CachePolicy` is therefore never exported from `@ts-linq/cache`.
- A `tests-new/CachePolicy.test.ts` exists and imports the file directly, which
  masks the fact that the symbol is not part of the public API.

## Why this is bad

- **Dead code.** Unreachable from the package's public surface; ships nothing.
- **DRY violation.** Two implementations of the same decorator/metadata store.
  The two `cachePolicies` WeakMaps are distinct objects, so if any code ever
  imported the `cache` copy it would read a *different* metadata store than the
  one populated by the `core` decorator — a latent correctness trap.
- **Maintenance noise.** Confuses readers about where cache invalidation policy
  actually lives.

## Target architecture

Single canonical decorator in `@ts-linq/core` (or wherever entity decorators are
centralized). The `cache` package keeps no decorator copy. This honours
**Clean Code** (no dead/duplicate code) and **Single Source of Truth**.

## Proposed refactor

1. Delete `packages/cache/src/CachePolicy.ts`.
2. Delete or relocate `packages/cache/tests-new/CachePolicy.test.ts` (the
   behaviour is already covered by core's decorator tests; if not, move the
   assertions there).
3. Remove `@ts-linq/cache` from `@ts-linq/metrics-safe`/types dep graph only if
   the package is being deleted entirely (coordinate with cache/task-1).

## Suggested design patterns

- **Single Source of Truth (DRY):** one decorator, one metadata WeakMap.
- **Clean Code:** eliminate unreachable code.

## Testing plan

- Confirm `pnpm typecheck` + `pnpm build` pass with the file removed.
- Ensure decorator behaviour (Stage-3 metadata registration, throw on legacy
  decorators) remains covered by a test against the `core` copy.

## Acceptance criteria

- [ ] `packages/cache/src/CachePolicy.ts` deleted.
- [ ] No production code references the deleted symbol.
- [ ] `@CachePolicy` behaviour remains covered by a test against the canonical
      `@ts-linq/core` decorator.
- [ ] `pnpm build` and `pnpm typecheck` pass.

## Refactor order

1. Verify core copy is the one wired into metadata.
2. Delete cache copy + its test.
3. Validate build.

## Notes

If cache/task-1 chooses to delete the whole `@ts-linq/cache` package, this task
is subsumed; keep it as a standalone task in case the package is retained.
