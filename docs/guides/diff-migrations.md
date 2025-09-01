# Guide: Schema diff migrations

This guide shows a pragmatic approach to generating safe schema diffs from entity metadata and applying them via the `Migration` API.

> Production systems should use explicit, reviewed migrations. The diff flow is a helper for development.

## Goals
- Detect new/removed/changed columns and indexes
- Generate additive-safe SQL (CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN)
- Avoid destructive ops by default; emit comments/TODOs for manual handling

## Steps
1) Read entity metadata from `MetadataStorage`
2) Query live schema (PRAGMA in SQLite; information_schema in others)
3) Compare and produce operations: CreateTable, AddColumn, CreateIndex
4) Wrap as `Migration` with idempotent SQL

## Example (SQLite sketch)
```ts
import { Migration, MigrationRunner } from '../../src';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';

class DiffMigration extends Migration {
  protected get name() { return 'Diff_' + Date.now(); }
  protected get version() { return String(Date.now()); }
  public async up() {
    const entities = MetadataStorage.getEntities();
    for (const e of entities) {
      await provider.executeNonQuery(`CREATE TABLE IF NOT EXISTS ${e.tableName} (/* columns */)`);
      // add columns
      for (const c of e.columns) {
        // check existence via PRAGMA table_info
        // if not exists: ALTER TABLE ADD COLUMN
      }
      // indexes
      for (const i of e.indexes) {
        await provider.executeNonQuery(`CREATE ${i.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${i.name} ON ${e.tableName} (${i.columns.join(', ')})`);
      }
    }
  }
  public async down() { /* no-op for diffs */ }
}
```

## Notes
- For non-SQLite, use `information_schema.columns` (MySQL/Postgres) and `sys.columns` (MSSQL)
- Avoid dropping columns or altering types automatically; output warnings
- Prefer hand-written follow-up migrations for destructive changes

## Testing
- Run against a scratch DB, then run `MigrationRunner` and verify idempotency
