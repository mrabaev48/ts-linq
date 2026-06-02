# @ts-linq/migrations

> Schema migrations, schema diffing, the migration runner, idempotent script/bundle generation,
> and database-first scaffolding for ts-linq.

This package compares the model snapshot against the database (or a previous snapshot), generates
migration steps, runs them with tracking, and can emit idempotent SQL scripts or bundled
migrations. It also provides DB-first scaffolding (`scaffoldDbContext`).

## Installation

```bash
pnpm add @ts-linq/migrations
```

## What lives here

- **Runner** — `MigrationRunner` (apply/rollback/status, migration history tracking).
- **Authoring** — `Migration`, `MigrationBuilder`, `MigrationFileBuilder`, `MigrationTemplate`.
- **Diffing** — `SchemaComparator`, `SchemaInspector`, `DiffMigrationGenerator`,
  `DiffBasedMigration`, `comparators/*`, `snapshot/diff`, `snapshot/model-snapshot`.
- **SQL builders** — `builders/*` (tables, columns, indexes, FKs, unique constraints, sequences,
  seeds) + `SqlUtils`.
- **Script/bundle output** — `script/idempotent-emitter`, `bundle/build-bundle` (uses `esbuild`).
- **Scaffolding (DB-first)** — `scaffoldDbContext`, `name-normalizer` (exported via `./scaffold`).
- **Schema model** — `SchemaSnapshot`, `Dialect`, `DialectMigrationSql`.

## Exports

- `.` — migration building blocks.
- `./scaffold` — `scaffoldDbContext` and scaffolding types.

## Package structure

```
src/
  MigrationRunner.ts, Migration.ts, MigrationBuilder.ts, MigrationFileBuilder.ts
  SchemaComparator.ts, SchemaInspector.ts, SchemaSnapshot.ts, DiffMigrationGenerator.ts
  builders/*           # per-object SQL builders
  comparators/*        # column/index comparators
  script/idempotent-emitter.ts, bundle/build-bundle.ts
  scaffold/*           # DB-first scaffolding
  snapshot/*           # model snapshot + diff
  index.ts
```

## Dependencies

- `@ts-linq/core`, `@ts-linq/metadata`, `@ts-linq/types`, `esbuild`

## License

Part of the ts-linq monorepo. See the repository root for license details.
