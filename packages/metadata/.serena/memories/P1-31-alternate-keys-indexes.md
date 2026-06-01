---
name: P1-31-alternate-keys-indexes
description: Alternate keys (hasAlternateKey) and rich indexes (includeProperties, isDescending, lambda hasIndex) — P1-31 implementation
type: project
---

# P1-31: Alternate Keys and Rich Indexes

## Status: Done

## Public API Changes

### `@ts-linq/orm` — EntityTypeBuilder
- `hasAlternateKey(selector: (e: T) => unknown): this` — single or multi-column, lambda form
- `hasIndex(selector: (e: T) => unknown): IndexBuilder<T>` — new lambda overload (alongside existing spread-keys form)

### `@ts-linq/orm` — IndexBuilder
- `includeProperties(selector: (e: T) => unknown): this` — covering index INCLUDE
- `isDescending(flags: boolean[]): this` — per-column sort direction

### `@ts-linq/orm` — utils.ts
- `extractPropertyNames<T>(selector)` — handles single and array `[e.a, e.b]` selectors

### `@ts-linq/types`
- `IndexMetadata.isDescending?: boolean[]` — new field
- `AlternateKeyMetadata { name: string; columns: string[] }` — new interface
- `EntityMetadata.alternateKeys?: AlternateKeyMetadata[]` — new field

### `@ts-linq/migrations`
- `UniqueConstraintDef { name: string; columns: string[] }` — new type in DiffTypes
- `TableSnapshot.uniqueConstraints?: UniqueConstraintDef[]`
- `TableDiff.uniqueConstraintCreates/Drops` — new diff fields
- `SchemaComparator.diffUniqueConstraints()` — name-based diff
- `DialectMigrationSql` — includes `UniqueConstraintsSqlBuilder` in pipeline
- `buildAddUniqueConstraintSql` / `buildDropUniqueConstraintSql` — exported helpers
- `buildCreateIndexSql` — now includes INCLUDE clause for PostgreSQL

### Dialects
All three dialects have `generateAddUniqueConstraintSql(table, name, columns)` and `generateDropUniqueConstraintSql(table, name)`.

## Key Design Decisions
- Alternate keys emit as named UNIQUE **constraints** (not indexes) — `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE`
- `isDescending` is converted to `orders` map in `SchemaSnapshot.buildExpectedFromMetadata()` before reaching IndexDef
- MySQL: `hasFilter` on indexes silently ignored (no partial index support)
- `hasPrincipalKey()` on relationship builders now resolves FK `refColumns` from `alternateKeys` on target entity

## Files Modified
- `packages/types/src/index.ts`
- `packages/orm/src/builders/utils.ts`
- `packages/orm/src/builders/IndexBuilder.ts`
- `packages/orm/src/builders/EntityTypeBuilder.ts`
- `packages/metadata/src/EntityMetadata.ts`
- `packages/metadata/src/MetadataRegistry.ts`
- `packages/migrations/src/DiffTypes.ts`
- `packages/migrations/src/SchemaSnapshot.ts`
- `packages/migrations/src/SchemaComparator.ts`
- `packages/migrations/src/DialectMigrationSql.ts`
- `packages/migrations/src/builders/MigrationHandlers.ts`
- `packages/migrations/src/builders/UniqueConstraintsSqlBuilder.ts` (new)
- `packages/migrations/src/builders/handlers/TableHandlers.ts`
- `packages/dialect-postgres/src/PostgresDdlStrategy.ts`
- `packages/dialect-mysql/src/MySqlDdlStrategy.ts`
- `packages/dialect-mssql/src/MssqlDdlStrategy.ts`
