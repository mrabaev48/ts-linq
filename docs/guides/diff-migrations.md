# Guide: Schema diff migrations

This guide shows a pragmatic approach to generating safe schema diffs from entity metadata and applying them via the `Migration` API.

> Production systems should use explicit, reviewed migrations. The diff flow is a helper for development.

## Goals

- Detect new/removed/changed columns and indexes
- Generate additive-safe SQL (CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN)
- Avoid destructive ops by default; emit comments/TODOs for manual handling

## Steps

1. Read entity metadata from `MetadataStorage`
2. Query live schema (PRAGMA in SQLite; information_schema/sys catalogs in others)
3. Build snapshots and compute `SchemaDiff` via `compareSchemas()`
4. Generate SQL per dialect: `generateMigrationFromDiff(diff, 'postgresql'|'mysql'|'mssql'|'sqlite')`
5. (Опционально) Применить через `Migration`/`MigrationRunner` или исполнять SQL напрямую

## API usage

```ts
import { DiffMigrationGenerator } from '../../src/migrations/DiffMigrationGenerator';
import { generateMigrationFromDiff } from '../../src/migrations/DialectMigrationSql';

// 1) Построить diff (пример для SQLite провайдера)
const gen = new DiffMigrationGenerator(provider /* DatabaseProvider */);
const steps = await gen.generate(); // минимальный набор SQL для SQLite

// 2) Или построить общий SchemaDiff и сгенерировать SQL для другого диалекта
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import { compareSchemas } from '../../src/migrations/DiffTypes';

// expected/actual snapshots → diff → SQL (примерно как делает DiffMigrationGenerator внутри)
// ...получите snapshots, затем:
const diff = compareSchemas(expectedSnapshot, actualSnapshot);
const { up, down } = generateMigrationFromDiff(diff, 'postgresql');
for (const sql of up) await provider.executeNonQuery(sql);
```

## Dialect notes

- PostgreSQL: кавычки идентификаторов `"name"`, `ALTER COLUMN TYPE`, `SET/DROP NOT NULL`.
- MySQL: кавычки `` `name` ``, `MODIFY/CHANGE COLUMN` (для nullability нужен полный тип).
- MSSQL: кавычки `[name]`, `ALTER COLUMN` (тип обязателен при смене nullability).
- SQLite: ограниченная поддержка `ALTER`; сложные изменения требуют перестроения таблицы (в генераторе это учитывается).

## Notes

- For non-SQLite, use `information_schema.columns` (MySQL/Postgres) and `sys.columns` (MSSQL)
- Avoid dropping columns or altering types automatically; prefer rebuild or ручные миграции
- Prefer hand-written follow-up migrations for destructive changes

## Testing

- Unit: сравнение snapshots → `compareSchemas`, генерация SQL `generateMigrationFromDiff`
- Integration: выполнить SQL на тестовой БД и повторно — операции должны быть идемпотентны
