# P0-10: Concurrency Tokens & RowVersion — Implementation Summary

**Status**: ✅ done
**Branch**: feat/p0-10-concurrency-tokens-rowversion

## What was implemented

### New types — `@ts-linq/types`
- `ColumnMetadata.isConcurrencyToken?: boolean` — marks a column as a concurrency token (WHERE-injected on UPDATE/DELETE)
- `SqlDialect.buildUpdate` — updated signature: `(entity, metadata, versionCol?, concurrencyTokens?, originalValues?)`
- `SqlDialect.buildDelete` — updated signature: `(entity, metadata, concurrencyTokens?, originalValues?)`

### New classes — `@ts-linq/orm`
- `packages/orm/src/changetracker/EntityEntry.ts` — `EntityEntry<T>` with `reload()` and `getDatabaseValues()`; uses `provider.findById()` internally
- `packages/orm/src/exceptions/DbUpdateConcurrencyException.ts` — `DbUpdateConcurrencyException extends Error` with `entries: EntityEntry[]`

### PropertyBuilder — `@ts-linq/orm`
- `isConcurrencyToken(yes = true): this` — marks `ColumnMetadata.isConcurrencyToken`
- `isRowVersion(): this` — sets both `isVersion = true` and `isConcurrencyToken = true`

### originalValues propagation chain — `@ts-linq/orm`
- `TrackedChange` type (UpdateCommand, DeleteCommand) now includes `originalValues?: object`
- `UpdateCommand.execute()` passes `originalValues` to `provider.update()`
- `DeleteCommand.execute()` passes `originalValues` to `provider.delete()`
- `DbContext.normalizeChange()` now includes `originalValues` in result (previously dropped it)
- `DbContext.applyUpdate()` / `applyDelete()` — pick `originalValues` from `NormalizedChange`
- `DbContext.saveChanges()` — catches `OptimisticConcurrencyError`, wraps into `DbUpdateConcurrencyException` with `entries` for all failed changes

### Abstract layer — `@ts-linq/core`
- `DatabaseProvider.update(entity, entityClass, originalValues?)` — added optional `originalValues` parameter
- `DatabaseProvider.delete(entity, entityClass, originalValues?)` — added optional `originalValues` parameter

### Dialects — WHERE injection
All three dialects updated:
- `buildUpdate` — for each `isConcurrencyToken && !isVersion` column: appends `AND col = @origVal` using `originalValues`
- `buildDelete` — for each `isConcurrencyToken` column: appends `AND col = @origVal`

### Providers — conflict detection
All three providers updated:
- `update()`: finds `concurrencyTokens = meta.columns.filter(c => c.isConcurrencyToken && !c.isVersion)`, passes to dialect, throws `OptimisticConcurrencyError` on `affectedRows === 0` if tokens present
- `delete()`: finds `concurrencyTokens = meta.columns.filter(c => c.isConcurrencyToken)`, passes to dialect, throws on conflict

### Exports added
- `packages/orm/src/index.ts`: exports `EntityEntry`, `DbUpdateConcurrencyException`

## Key design decisions
- `OptimisticConcurrencyError` (in `@ts-linq/types`) is still thrown by providers (no circular dep)
- `DbUpdateConcurrencyException` (in `@ts-linq/orm`) wraps it in `saveChanges()` with populated `entries`
- `isRowVersion` columns are treated as version columns (auto-increment in SET) AND concurrency tokens (WHERE check uses current entity value, not originalValues)
- Non-version concurrency tokens use `originalValues` from ChangeTracker snapshot

## Tests added
- `packages/orm/tests/property-builder-concurrency.test.ts`
- `packages/orm/tests/db-update-concurrency-exception.test.ts`
- `packages/dialect-postgres/tests-new/build-update-concurrency.test.ts`
- `packages/dialect-mysql/tests-new/build-update-concurrency.test.ts`
- `packages/dialect-mssql/tests-new/build-update-concurrency.test.ts`
- `packages/integration-tests/tests-new/05-metadata-decorators/concurrency-tokens.test.ts`

## Files changed
- `packages/types/src/index.ts` — ColumnMetadata + SqlDialect
- `packages/core/src/DatabaseProvider.ts` — update/delete signatures
- `packages/orm/src/builders/PropertyBuilder.ts` — isConcurrencyToken/isRowVersion
- `packages/orm/src/changetracker/EntityEntry.ts` — NEW
- `packages/orm/src/exceptions/DbUpdateConcurrencyException.ts` — NEW
- `packages/orm/src/commands/UpdateCommand.ts` — originalValues
- `packages/orm/src/commands/DeleteCommand.ts` — originalValues
- `packages/orm/src/DbContext.ts` — normalizeChange + catch/rethrow
- `packages/orm/src/index.ts` — exports
- `packages/dialect-postgres/src/PostgresDialect.ts`
- `packages/dialect-mysql/src/MysqlDialect.ts`
- `packages/dialect-mssql/src/MssqlDialect.ts`
- `packages/provider-postgres/src/PostgresProvider.ts`
- `packages/provider-mysql/src/MySqlProvider.ts`
- `packages/provider-mssql/src/MsSqlProvider.ts`
