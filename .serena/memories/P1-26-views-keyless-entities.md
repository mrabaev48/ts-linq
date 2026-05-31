# P1-26: Views and Keyless Entities

## Status: done

## Public API (packages/orm)

`EntityTypeBuilder<T>` has three new fluent methods:
- `toView(name: string): this` — maps entity to a DB view
- `hasNoKey(): this` — declares entity as keyless (no PK, never tracked)
- `hasViewSql(sql: string): this` — optional CREATE VIEW DDL for migrations

## Metadata Flags (packages/types, packages/metadata)

`EntityMetadata` has three new optional fields:
- `isKeyless?: boolean`
- `viewName?: string`
- `viewSql?: string`

`EntityMetadataBuilder` has `setIsKeyless()`, `setViewName()`, `setViewSql()`.
`MetadataRegistry` has `setFluentKeyless()`, `setFluentViewName()`, `setFluentViewSql()`.

## Error (packages/orm)

`KeylessMutationError` (extends Error) is thrown by `DbSet.add/update/remove/addRange/updateRange/removeRange` when `meta.isKeyless === true`. Exported from `@ts-linq/orm`.

## Query Pipeline (packages/query)

`Queryable._applyTracking()` checks `meta.isKeyless` and returns plain objects without attaching to ChangeTracker. No identity-map insertion.

## Dialects (packages/dialect-*)

All three dialects resolve FROM clause as: `options.from ?? metadata.viewName ?? metadata.tableName`

## Migrations (packages/migrations)

`DiffTypes.ts` has new `ViewSnapshot { name, sql? }` type and `SchemaSnapshot.views?: ViewSnapshot[]`.
`SchemaSnapshotBuilder.buildExpectedFromMetadata()` skips keyless entities from tables and collects them in `viewMap`. Views with `viewSql` include the SQL; others are pre-existing (no DDL emitted).

## DbSetContext

Added optional `registry?: MetadataRegistry` field. `DbContext.buildDbSetContext()` passes `this._registry`. `DbSet` uses registry for keyless checks (falls back to `MetadataStorage` if registry absent).

## Test Files

- `packages/orm/tests-new/KeylessEntities.test.ts` — metadata flags, error class
- `packages/migrations/tests-new/snapshot/keyless-view-snapshot.test.ts` — snapshot builder behavior

## Docs

`apps/docs/views-keyless-entities.md`
