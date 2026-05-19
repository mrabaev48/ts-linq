# ISSUE-006: Internal services exported from `@ts-linq/orm` and `@ts-linq/query` public APIs

## Severity

Medium

## Category

- Public API
- Clean Architecture
- Maintainability
- Documentation Drift

## Location

- `packages/orm/src/index.ts:5-8` — `AuditInterceptor`, `CacheCoordinator`, `ChangeValidationService`, `SoftDeleteInterceptor`
- `packages/query/src/index.ts:1-17` — `IncludePlanner`, `FallbackManager`, `MetricsCacheDecorator`, `RowMaterializer`, `QueryBuilder`, `QueryModel`, `queryUtils`, internal `PaginationBuilder`, `TtlCacheDecorator`, `InMemorySqlCache`

## Problem

Both packages export internal collaborator classes from their root `index.ts`. These classes were created by audit v4 to **decompose** god classes (`DbContext`, `Queryable`, `EnhancedSqlCache`). The decomposition gave each one its own file, then the resulting classes were re-exported indiscriminately.

`packages/orm/src/index.ts` reads:
```ts
export * from './ChangeTracker';
export * from './DbContext';
export * from './DbSet';
export { AuditInterceptor } from './services/AuditInterceptor';
export { CacheCoordinator } from './services/CacheCoordinator';
export { ChangeValidationService } from './services/ChangeValidationService';
export { SoftDeleteInterceptor } from './services/SoftDeleteInterceptor';
```

`packages/query/src/index.ts` is even broader — re-exports of `IncludePlanner`, `FallbackManager`, `MetricsCacheDecorator`, `RowMaterializer`, etc., none of which are part of the documented user API.

There is no `@internal` JSDoc tag, no `internal/` subfolder convention, no separate `entry-points/internal.ts` — these classes are now indistinguishable from the documented `DbContext` / `Queryable` surface, and `ts-prune` has been configured to *ignore* `src/index.ts` (`ts-prune-ignore.txt`) so dead-code analysis cannot flag them.

The interceptors and `CacheCoordinator` were created **as a side-effect of fixing audit v4 ISSUE-004 / ISSUE-009**. Their existence is an implementation detail; re-exporting them publishes the implementation as the contract.

## Evidence

- `packages/orm/src/index.ts` — 8 lines, 4 of which export services.
- `packages/query/src/index.ts` — 17 lines, ~10 of which are non-`Queryable` exports.
- `issues-v4/ISSUE-009-cache-coherency-scattered.md` (closed) — created `CacheCoordinator` as an internal decomposition of `DbContext`.
- No public docs mention these classes as a user-facing API. The repository README and TypeDoc config (`typedoc.json`) describe only `DbContext` / `DbSet` / `Queryable`.
- `dependency-cruiser` rules currently do not enforce `no-public-from-internal` — the `arch:deps` pass at audit time is clean because the boundary is not declared.

## Why It Matters

- **API stability**: Any consumer importing `CacheCoordinator` directly (e.g. for advanced multi-cache scenarios) locks the team into a stable shape. The class was designed as a private decomposition and may need to change signature freely.
- **Versioning**: SemVer compliance becomes harder — every internal refactor risks a major version bump because tools see the exported names.
- **Discoverability inverted**: Users browsing IntelliSense see 10+ classes with no clear distinction between "use this" and "this exists for tests/decomposition". The barrier to first use is higher than necessary.
- **Decomposition discipline**: Future SRP refactors will be discouraged because each new extracted class becomes one more public export.
- **Drift with documentation**: README / TypeDoc describe a narrow API; the actual exports are far wider. New contributors cannot tell which class is "real".

## Recommended Fix

1. Adopt a `@internal` convention. Each non-public class file gets `/** @internal */` on the class itself. Enable TypeScript's `--stripInternal` for the published `dist/` output, OR move them under `packages/<pkg>/src/internal/` and re-export only from a private barrel.
2. Trim `packages/orm/src/index.ts` to:
   ```ts
   export * from './ChangeTracker';
   export * from './DbContext';
   export * from './DbSet';
   ```
   Move every service re-export into `packages/orm/src/internal/index.ts` (or remove entirely if nothing in `tests-new/` imports them at the package root — they can be tested via direct file paths inside the package).
3. Trim `packages/query/src/index.ts` to expose only `Queryable`, `QueryBuilder`, `QueryModel`, `LruCache` / `InMemorySqlCache` (cache implementations that *are* intended for users), and the public types from `TypedQueryable`. Move the rest behind an internal barrel.
4. Update `dependency-cruiser` with a `no-public-from-internal` rule keyed off the `internal/` subfolder.
5. Add a `pnpm api:check` script that runs `api-extractor` (or `tsc --emitDeclarationOnly` + `dts-buddy`) to fail CI when a non-`@internal` export is added without an entry in `docs/`.

## Acceptance Criteria

- `packages/orm/src/index.ts` exports only `ChangeTracker`, `DbContext`, `DbSet` (and types they depend on).
- `packages/query/src/index.ts` exports only documented public symbols (≤ 6 classes / 3 types).
- All internal services live under an `internal/` subfolder and are not reachable via `import { X } from '@ts-linq/<pkg>'`.
- `dependency-cruiser` enforces the boundary; `pnpm arch:deps` fails when a public file imports from `internal/` *and* re-exports the symbol.
- Tests that previously imported internals from the root barrel are updated to import from the internal path.
- `pnpm typecheck && pnpm test && pnpm build` green.
