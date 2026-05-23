# P2-42: Migration Bundles, Idempotent Scripts, HasPendingModelChanges

**Status**: done  
**Branch**: feat/p2-42-migration-bundles-idempotent  
**Completed**: 2026-05-24

---

## What was implemented

### @ts-linq/migrations (new files)

| File | Purpose |
|------|---------|
| `src/snapshot/model-snapshot.ts` | `ModelSnapshotBuilder`, `ModelSnapshotSerializer` — deterministic JSON of current `MetadataStorage` state |
| `src/snapshot/diff.ts` | `ModelSnapshotDiff.compare(before, after)` — structural change detection between two snapshots |
| `src/script/idempotent-emitter.ts` | `IdempotentEmitter.emit(steps, dialect)` — per-dialect SQL guard blocks (PG: DO $$, MSSQL: IF NOT EXISTS, MySQL: stored procedure) |
| `src/bundle/build-bundle.ts` | `MigrationBundleBuilder.build(options)` — esbuild-based self-contained Node.js bundle |

**Key type**: `IdempotentMigrationStep { version, name, upSql[] }` (distinct from `DiffMigrationGenerator.MigrationStep { sql }`)

**New dependency**: `esbuild` added to `@ts-linq/migrations` dependencies.

---

### @ts-linq/core

- `DbContextOptions.migrationsDirectory?: string` added to `packages/core/src/types/index.ts`

---

### @ts-linq/orm (new file + modified)

| File | Change |
|------|--------|
| `src/database/has-pending-model-changes.ts` | `PendingModelChangesChecker` — implements `hasPendingModelChanges()`, `getPendingMigrations()`, `migrate()` |
| `src/DatabaseFacade.ts` | Added three public methods; constructor now accepts optional `migrationsDir` |
| `src/DbContextOptionsBuilder.ts` | `.migrations({ directory })` fluent method + `MigrationsOptions` interface |
| `src/index.ts` | Re-exports `has-pending-model-changes` |
| `package.json` | Added `@ts-linq/migrations: workspace:*` as dependency |

**DbContext.ts** passes `options.migrationsDirectory` to `new DatabaseFacade(ctx, options.migrationsDirectory)`.

---

### @ts-linq/cli (new commands)

| Command | Class | Type | Description |
|---------|-------|------|-------------|
| `migration:script` | `MigrationsScriptCommand` | `DbCommand` | `--idempotent --output migrate.sql` |
| `migration:bundle` | `MigrationsBundleCommand` | `Command` | `--target node-linux-x64 --output dist/migrate.bundle.js` |

Both commands registered in `src/cli.ts` registry.

---

## Public API (EF Core parity)

```typescript
// Synchronous model drift check
if (ctx.database.hasPendingModelChanges()) { ... }

// List unapplied migration files
const pending = await ctx.database.getPendingMigrations();

// Apply pending (standard or idempotent)
await ctx.database.migrate();
await ctx.database.migrate({ idempotent: true });

// Setup in options builder
new DbContextOptionsBuilder({ provider })
  .migrations({ directory: './migrations' })
  .build()
```

---

## Test coverage

- Unit: `packages/migrations/tests-new/snapshot/`, `script/`, `bundle/`
- Unit CLI: `packages/cli/tests-new/migration-script-command.test.ts`, `migration-bundle-command.test.ts`
- Integration: `packages/integration-tests/tests-new/03-migrations-dialect/idempotent-script.integration.test.ts`
- E2E: `packages/e2e-tests/tests/migrations/migration-idempotent.e2e.test.ts`

---

## Architecture notes

- `@ts-linq/orm` → `@ts-linq/migrations` is a new package dependency (no circular cycles confirmed)
- `@ts-linq/e2e-tests` now also depends on `@ts-linq/migrations`
- `hasPendingModelChanges()` is synchronous (reads `model.snapshot.json` from `migrationsDir`)
- Migration history table remains `__migrations` (not renamed)
- `MigrationsBundleCommand` is a `Command` (no DB needed to produce the bundle)
- `MigrationsScriptCommand` is a `DbCommand` (needs DB to check applied migrations)

---

## Docs

- `apps/docs/migration-bundles.md`
- `apps/docs/idempotent-scripts.md`
