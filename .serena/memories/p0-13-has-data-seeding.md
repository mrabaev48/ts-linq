# P0-13: HasData — Model Seeding

## Status
✅ Done (feat/p0-13-has-data-seeding → PR merged to main)

## Public API
```ts
// EntityTypeBuilder<T>
hasData(...rows: T[]): this
```
Mirrors EF Core `modelBuilder.Entity<T>().HasData(new T { ... })`.

## Architecture

### Data Flow
```
hasData(rows) → EntityTypeBuilder._seedRows
  → _applyToRegistry() → MetadataRegistry.setSeedData()
  → EntityMetadata.seedData: Record<string, unknown>[]
  → ModelSnapshotBuilder → ModelTableSnapshot.seedData (sorted by PK)
  → compareModelSeeds(prev, current) → SeedRowOp[]
  → generateMigrationFromDiff({ tables, seedOps }) → INSERT/UPDATE/DELETE SQL
```

### New Files
- `packages/migrations/src/seed/SeedDiff.ts` — `diffSeeds()` + `topoSortSeedOps()`
- `packages/migrations/src/builders/SeedsSqlBuilder.ts` — dialect-aware DML generation

### Modified Files
- `@ts-linq/types` — `EntityMetadata.seedData?: Record<string, unknown>[]`
- `@ts-linq/metadata` — `EntityMetadataBuilder.setSeedData()`, `MetadataRegistry.setSeedData()`, `MetadataStorage.setSeedData()`
- `@ts-linq/orm` — `EntityTypeBuilder.hasData(...rows)` + `_seedRows` field
- `@ts-linq/migrations`:
  - `DiffTypes.ts` — `SeedRowInsert/Update/Delete`, `SeedRowOp`, `SchemaDiff.seedOps?`
  - `snapshot/model-snapshot.ts` — `ModelTableSnapshot.seedData?`, numeric PK sort
  - `SchemaComparator.ts` — `compareModelSeeds(prev, current): SeedRowOp[]`
  - `DialectMigrationSql.ts` — calls `SeedsSqlBuilder.generate()` for `diff.seedOps`

## Key Decisions
- Seeds diffed between **prev and current ModelSnapshot** (not live DB) — EF Core parity
- Rows sorted by PK value (numeric sort for numbers, lexicographic for strings) for deterministic JSON
- PK validation at diff time (not at hasData() call time — registry doesn't have PK info yet)
- buildUpdate() skips silently (emits comment) when all columns are PKs (no SET parts)
- Topological sort by FK graph for INSERT order, reverse for DELETE order
- Cycle detection falls back to original order (no throw)

## Integration Test Caveat
- Integration tests must use fluent-only entity configuration (no `@Entity`/`@PrimaryKey` decorators)
  because decorator metadata is lost after `MetadataStorage.clear()` in `afterEach`
- Pattern: `applySeeds(mb => { baseEntity(mb); mb.entity(T, b => b.hasData(...)); })`

## Validation Results
All checks passed: typecheck ✅, lint ✅, unit (2555) ✅, integration (429+2skip) ✅, e2e (290) ✅, build ✅, arch:deps ✅, arch:cycles ✅, arch:dead ✅
