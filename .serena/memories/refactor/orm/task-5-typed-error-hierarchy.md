# refactor/orm/task-5 — typed ORM error hierarchy

**Status:** ✅ DONE (orm's 5th task). Branch `audit-refactor/orm-typed-error-hierarchy`.
orm stays 🔄 In Progress; next orm = task-6 (public/internal barrel boundary).

## What & why
`@ts-linq/orm` threw bare `new Error(string)` for distinct failures; its 2 custom
exceptions lacked `code`/`context`/`cause`. Callers could only string-match. Made all
failures branchable on `e.code` / `e instanceof OrmError`.

## CRITICAL reconciliation (CLAUDE.md §16)
The task file proposed a NEW `OrmError` base under `orm/src/exceptions/`. **Rejected** —
canonical abstract `OrmError` already lives in `@ts-linq/types` (`packages/types/src/errors.ts`)
with the `OrmErrorCode` const-object registry. No parallel hierarchy: orm errors extend the
canonical base; new mid-level classes + codes added IN `@ts-linq/types`.

## Changes
### `@ts-linq/types/errors.ts` (minor 4.7.0 -> 4.8.0)
- 8 new `OrmErrorCode` literals: `ORM_SET_NOT_CONFIGURED`, `ORM_NO_PRIMARY_KEY`,
  `ORM_NO_DB_CONTEXT`, `ORM_TRANSFORMER_REQUIRED`, `ORM_MIGRATIONS_DIR_NOT_CONFIGURED`,
  `ORM_KEYLESS_MUTATION`, `ORM_UPDATE_FAILED`, `ORM_UPDATE_CONCURRENCY`.
- `OrmConfigurationError extends OrmError` — dev-config mistakes. `code` is PARAMETERIZED
  (constructor arg, typed `OrmConfigurationErrorCode` union incl. KeylessMutation) — deviates
  from the 1-fixed-code-per-class convention deliberately, because one class covers 5+ sites.
  Static factories centralize codes + preserve message text: `setNotConfigured(name)`,
  `noDbContext(name)`, `noPrimaryKey(name)`, `transformerRequired()`,
  `migrationsDirectoryNotConfigured()`.
- `DbUpdateException extends OrmError` — generic persistence boundary; `code: string =
  OrmErrorCode.DbUpdate` (DatabaseError pattern -> subclass can `override`).
- Barrel `index.ts` is a NAMED-export list (NOT `export *`) -> had to add `DbUpdateException`,
  `OrmConfigurationError`, `type OrmConfigurationErrorCode` explicitly.

### `@ts-linq/orm` (minor 5.0.0 -> 5.1.0)
- `exceptions/DbUpdateConcurrencyException.ts`: re-parented `extends DbUpdateException`,
  `override readonly code = DbUpdateConcurrency`, ctor `(message, entries, opts?)` keeps
  `entries: EntityEntry[]` (orm-internal type -> CANNOT move class to types). `name` auto =
  `'DbUpdateConcurrencyException'` (base sets `new.target.name`).
- `exceptions/KeylessMutationError.ts`: re-parented `extends OrmConfigurationError`, passes
  `ORM_KEYLESS_MUTATION`; message/name unchanged.
- 5 bare throws replaced (messages byte-preserved): `context/DbSetRegistry.ts` (set not
  configured), `DbSet.ts` `_seed` (no context) + `upsert` (no PK), `DatabaseFacade.ts`
  (migrations dir), `builders/EntityTypeBuilder.ts` `hasQueryFilter` (transformer).
- Concurrency translation `context/save-pipeline/saveSteps.ts`: now passes the originating
  `OptimisticConcurrencyError` as `{ cause }`.
- Barrel re-exports `DbUpdateException`, `OrmConfigurationError` from `@ts-linq/types`
  (catchable contract; existing `DbUpdateConcurrencyException`/`KeylessMutationError` kept).

## Tests
- `packages/types/src/__tests__/errors.test.ts` — runtime + type-level for both new classes
  (factory codes/messages, cause, name, `OrmConfigurationError['code']` union assertion).
- `packages/types/tests/type-exports.test.ts` — added both to `toBeDefined` + the strict
  `expectedExports` allow-list (Object.keys snapshot).
- `packages/types/src/__tests__/exports.check.ts` — added value-imports (non-strict).
- `packages/orm/tests/db-update-concurrency-exception.test.ts` — added instanceof-hierarchy +
  `cause` preservation cases.

## Validation — ALL GREEN
typecheck, lint (0 err), test:unit (3729), test:integration (390), test:e2e (Docker-skipped),
build, arch:deps (0 viol), arch:cycles, arch:dead. (Rebuild types dist before typecheck.)
Scripts are `test:unit/test:integration/test:e2e` (NOT `tests:*`).

## Tech-debt / follow-ups
- Pagination bare throws stay in `@ts-linq/query` (`PaginationBuilder.ts:32,46`,
  "paginate requires page >= 1" / "keysetPaginate requires size >= 1") — out of orm scope.
- task-2 coordination: reclassified catches should wrap via this hierarchy with `cause`.
- types minor cascaded patch bumps to all dependents (foundation package).
