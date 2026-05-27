# Idempotent Migration Scripts & HasPendingModelChanges

This document covers two production-grade migration features:

1. **Idempotent SQL scripts** — SQL files that are safe to re-run.
2. **`HasPendingModelChanges`** — runtime drift detection between the application model and applied migrations.

---

## Idempotent SQL scripts

> **EF Core equivalent**: `dotnet ef migrations script --idempotent --output migrate.sql`

### Overview

A standard migration script applies each step exactly once. If the script fails halfway through
or is accidentally re-run, it may corrupt the database. An **idempotent** script wraps each
migration in a guard block that checks `__migrations` before executing — making the script safe
to execute multiple times.

### CLI usage

```bash
# Generate an idempotent script (prints to stdout)
pnpm ts-linq migrations script --idempotent

# Save to a file
pnpm ts-linq migrations script --idempotent --output migrate.sql

# Standard (non-idempotent) script
pnpm ts-linq migrations script --output migrate.sql
```

### How it works — per-dialect guards

#### PostgreSQL

```sql
-- Migration: 20241201000000_CreateUsers
DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __migrations
        WHERE version = '20241201000000'
    ) THEN
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);

        INSERT INTO __migrations (version, name, applied_at)
        VALUES ('20241201000000', 'CreateUsers', NOW()::TEXT);
    END IF;
END $migration$;
```

#### SQL Server

```sql
-- Migration: 20241201000000_CreateUsers
IF NOT EXISTS (
    SELECT 1 FROM __migrations
    WHERE version = '20241201000000'
)
BEGIN
    CREATE TABLE users (id INT PRIMARY KEY, name NVARCHAR(255) NOT NULL);

    INSERT INTO __migrations (version, name, applied_at)
    VALUES ('20241201000000', 'CreateUsers', CONVERT(VARCHAR(50), GETDATE(), 126));
END
GO
```

#### MySQL

Each migration is wrapped in a temporary stored procedure (MySQL does not support `IF/THEN`
outside stored procedures):

```sql
-- Migration: 20241201000000_CreateUsers
DROP PROCEDURE IF EXISTS _apply_migration_20241201000000;
DELIMITER //
CREATE PROCEDURE _apply_migration_20241201000000()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __migrations
        WHERE version = '20241201000000'
    ) THEN
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);

        INSERT INTO __migrations (version, name, applied_at)
        VALUES ('20241201000000', 'CreateUsers', NOW());
    END IF;
END //
DELIMITER ;
CALL _apply_migration_20241201000000();
DROP PROCEDURE IF EXISTS _apply_migration_20241201000000;
```

### Programmatic API

```typescript
import { IdempotentEmitter } from '@ts-linq/migrations';
import type { IdempotentMigrationStep } from '@ts-linq/migrations';
import * as fs from 'node:fs';

const steps: IdempotentMigrationStep[] = [
  {
    version: '20241201000000',
    name: 'CreateUsers',
    upSql: ['CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)']
  }
];

const sql = new IdempotentEmitter().emit(steps, 'postgresql');
fs.writeFileSync('migrate.sql', sql);
```

---

## HasPendingModelChanges

> **EF Core equivalent**: `ctx.Database.HasPendingModelChanges()`

### Overview

`hasPendingModelChanges()` is a **synchronous** check that compares the current application
model (from `MetadataStorage`) with the snapshot stored in `<migrationsDir>/model.snapshot.json`.
When they differ — or when no snapshot exists yet — it returns `true`, signalling that a new
migration should be generated.

### Setup

Enable the migration integration on your `DbContextOptionsBuilder`:

```typescript
const opts = new DbContextOptionsBuilder({ provider })
  .migrations({ directory: './migrations' })
  .build();

const ctx = new AppDbContext(opts);
```

### Usage

```typescript
// Synchronous check — no database connection needed
if (ctx.database.hasPendingModelChanges()) {
  throw new Error('Model is out of sync with migrations — run: pnpm ts-linq generate:migration');
}

// List pending migration files (async — queries __migrations table)
const pending = await ctx.database.getPendingMigrations();
console.log(`${pending.length} migration(s) pending:`, pending);

// Apply all pending migrations (standard)
await ctx.database.migrate();

// Apply all pending migrations (idempotent — safe to re-run)
await ctx.database.migrate({ idempotent: true });
```

### Model snapshot file

The snapshot file (`model.snapshot.json`) is written to the migrations directory by
`pnpm ts-linq schema:export` or by calling the `ModelSnapshotBuilder` programmatically.
Commit this file alongside your migration files so CI can detect drift.

```bash
pnpm ts-linq schema:export   # also updates model.snapshot.json
```

### API reference

| Method | Type | Description |
|--------|------|-------------|
| `ctx.database.hasPendingModelChanges()` | `(): boolean` | Synchronous model drift check |
| `ctx.database.getPendingMigrations()` | `(): Promise<string[]>` | Lists unapplied migration versions |
| `ctx.database.migrate(options?)` | `(opts?: MigrateOptions): Promise<void>` | Applies all pending migrations |

#### `MigrateOptions`

```typescript
interface MigrateOptions {
  /** When true, each migration step is wrapped in an idempotency guard. */
  idempotent?: boolean;
}
```

---

## Programmatic snapshot API

```typescript
import {
  ModelSnapshotBuilder,
  ModelSnapshotSerializer,
  ModelSnapshotDiff
} from '@ts-linq/migrations';
import * as fs from 'node:fs';

// Build current snapshot
const builder = new ModelSnapshotBuilder();
const current = builder.buildFromMetadata();

// Serialize to disk
const serializer = new ModelSnapshotSerializer();
fs.writeFileSync('./migrations/model.snapshot.json', serializer.serialize(current));

// Compare stored vs current
const stored = serializer.deserialize(fs.readFileSync('./migrations/model.snapshot.json', 'utf8'));
const diff = new ModelSnapshotDiff().compare(stored, current);

if (diff.hasDifferences) {
  console.warn('Model has drifted:');
  for (const td of diff.tableDiffs) {
    console.warn(`  Table ${td.table}: ${td.kind}`);
    for (const cd of td.columnDiffs ?? []) {
      console.warn(`    Column ${cd.column}: ${cd.kind}`);
    }
  }
}
```
