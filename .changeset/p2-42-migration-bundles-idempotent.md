---
'@ts-linq/migrations': minor
'@ts-linq/orm': minor
'@ts-linq/cli': minor
---

feat(migrations): add migration bundles, idempotent scripts, and HasPendingModelChanges (P2-42)

- `@ts-linq/migrations`: new `IdempotentEmitter` that wraps each migration in a per-dialect guard block (PostgreSQL DO $$, MSSQL IF NOT EXISTS, MySQL stored procedure); new `MigrationBundleBuilder` using esbuild to produce self-contained Node.js bundle scripts; new `ModelSnapshotBuilder` / `ModelSnapshotSerializer` for deterministic model-state JSON; new `ModelSnapshotDiff` for structural change detection between two snapshots
- `@ts-linq/orm`: `DatabaseFacade` gains `hasPendingModelChanges()` (synchronous), `getPendingMigrations()`, and `migrate({ idempotent? })` mirroring EF Core's `HasPendingModelChanges`, `GetPendingMigrationsAsync`, and `MigrateAsync`; `DbContextOptionsBuilder` gains `.migrations({ directory })` fluent method; `DbContextOptions` gains `migrationsDirectory` field
- `@ts-linq/cli`: new `migration:script` command (`--idempotent`, `--output`); new `migration:bundle` command (`--target`, `--output`)
