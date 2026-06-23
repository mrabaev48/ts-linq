---
status: completed
phase: phase-x
package: orm
priority: P1
effort: M
risk: medium
category: package-boundary
depends_on: []
related: []
---

# Refactor: Establish a real public/internal API boundary

## Problem

The `@ts-linq/orm` public barrel (`src/index.ts`) re-exports many
implementation-detail modules with no `@internal` discipline, while a dedicated
internal barrel (`src/internal/index.ts`) exists but is **not wired to a package
`exports` subpath** — so the intended boundary is both leaky (internals on the
main entrypoint) and unreachable (the `internal` barrel cannot be imported as
`@ts-linq/orm/internal`). Additionally, the package reaches into another
package's internals via a tsconfig `paths` alias.

## Evidence

- `src/index.ts` re-exports implementation details on the **public** surface:
  - `export * from './save-changes/batch-executor'` and `'./save-changes/batch-grouper'`
  - `export * from './IdentityMap'`
  - `export * from './interceptors/InterceptorRegistry'`
  - `export { HiLoValueGenerator, ... }` value generators
  - `export { CascadeWalker }`, `export { JsonSnapshotter }`
  - `export * from './database/has-pending-model-changes'`
- `src/internal/index.ts` declares `@internal` and exports `AuditInterceptor`,
  `CacheCoordinator`, `ChangeValidationService`, `SoftDeleteInterceptor` — but
  `package.json` `exports` only maps `"."`; there is **no** `"./internal"`
  subpath, so this barrel is dead from a consumer's perspective.
- `packages/orm/package.json` `exports` has a single `"."` entry.
- `packages/orm/tsconfig.json` `paths`:
  `"@ts-linq/query/internal": ["../query/dist/internal"]` — deep import into the
  query package's build output, bypassing `@ts-linq/query`'s public entrypoint
  (used by `DbContext.ts:11` for `EnhancedSqlCache`, `InMemoryCountCache`).

## Why this is bad

- Consumers can import and depend on internals (`BatchExecutor`,
  `InterceptorRegistry`, `IdentityMap`), making every internal a de-facto public
  API that cannot change without a breaking-change/changeset.
- The existing `internal/` barrel gives a false sense of encapsulation; it
  protects four services while a dozen other internals leak from `"."`.
- Reaching into `@ts-linq/query/dist/internal` couples `orm` to `query`'s build
  layout; a refactor of `query`'s internals silently breaks `orm`.
- Inconsistent with the project's package-boundary rules ("Public APIs must go
  through package entrypoints"; "Do not import package internals unless
  explicitly allowed").

## Target architecture

A deliberate two-tier surface enforced by `package.json` `exports`
(dependency inversion at the package boundary; interface segregation):

- **`@ts-linq/orm`** (`"."`) — only the supported public API: `DbContext`,
  `DbSet`, `ModelBuilder` + builders, `ChangeTrackerFacade` API, factory/pooling,
  options builders, `sql` tag, typed exceptions, value-generator *types* that
  users implement.
- **`@ts-linq/orm/internal`** (`"./internal"`) — explicitly opt-in internals for
  sibling packages/tests (executors, registries, coordinators, IdentityMap).
- For the query deep-import: have `@ts-linq/query` publish an official
  `@ts-linq/query/internal` `exports` subpath (or move `EnhancedSqlCache`/
  `InMemoryCountCache` to a shared location) so `orm` no longer references
  `../query/dist/internal` build output directly.

## Proposed refactor

1. Audit every re-export in `src/index.ts`; move implementation-only modules
   (`batch-executor`, `batch-grouper`, `IdentityMap`, `InterceptorRegistry`,
   `CascadeWalker`, `JsonSnapshotter`, `has-pending-model-changes`) into
   `src/internal/index.ts`.
2. Add `"./internal"` to `package.json` `exports` mapping to
   `dist/internal/index.js` / `.d.ts` (cjs+esm).
3. Annotate retained-but-advanced public exports with `@public`/`@internal`
   TSDoc consistently.
4. Replace the `@ts-linq/query/internal` `paths` alias with a real published
   subpath on `@ts-linq/query`, or relocate the two cache classes; update
   `DbContext.ts:11`.
5. Update downstream packages/tests that imported the now-internal symbols to use
   `@ts-linq/orm/internal`.

## Suggested design patterns

- **Facade + published-language boundary** — the package entrypoint is the
  contract; internals are quarantined behind an opt-in subpath.
- **Interface segregation** at the package level (public vs internal exports).

## Testing plan

- **Contract/API test:** snapshot the `@ts-linq/orm` public export set and gate
  it in CI (`ts-prune` / explicit allowlist) so internals cannot re-leak.
- **Build:** verify `@ts-linq/orm/internal` resolves in both cjs and esm.
- **Boundary:** `pnpm arch:deps` confirms no consumer imports
  `@ts-linq/query/dist/internal` after the alias is removed.
- **Regression:** full build + downstream package builds pass.

## Acceptance criteria

- [ ] Implementation-only modules removed from the `"."` barrel.
- [ ] `package.json` exposes a working `"./internal"` subpath (cjs+esm+types).
- [ ] `@ts-linq/query/internal` deep-import via `dist` is replaced by a published
      subpath or relocated shared module.
- [ ] CI gate snapshots the public API surface.
- [ ] `pnpm build && pnpm arch:deps && pnpm arch:dead` pass.

## Refactor order

1. Land query's published `internal` subpath; switch `orm` off the `dist` alias.
2. Move leaked modules into `src/internal` + add the `exports` subpath.
3. Add the public-API snapshot CI gate.

## Notes

This is a **breaking change** for anyone importing the now-internal symbols from
`@ts-linq/orm`; it requires a `major` changeset and a migration note pointing to
`@ts-linq/orm/internal`.
