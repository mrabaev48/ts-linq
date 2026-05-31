---
title: HasData seeding integrated with migrations
ef_core_api: modelBuilder.Entity<T>().HasData(new T { ... }, new T { ... })
status: done
priority: P0
effort: M
depends_on: [P0-01]
related: [P0-14]
ts_linq_packages_touched: [@ts-linq/orm, @ts-linq/metadata, @ts-linq/migrations]
---

# HasData — Model Seeding

## 1. Why (problem statement)

Reference data (countries, roles, feature flags) belongs in the schema, not in ad-hoc scripts. EF Core lets users declare seed rows in `OnModelCreating` via `HasData`, and the migration generator diffs seed sets between snapshots to emit precise INSERT/UPDATE/DELETE statements. `ts-linq` ships `MigrationRunner` and `SchemaComparator` for DDL only — there is no concept of seed data. Users currently maintain hand-written seed scripts that drift from the model. Wiring `HasData` into the existing migration diff gives us seed parity for free.

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
modelBuilder.Entity<Role>().HasData(
  new Role { Id = 1, Name = "admin" },
  new Role { Id = 2, Name = "user"  });

modelBuilder.Entity<Country>().HasData(
  new Country { Code = "US", Name = "United States" },
  new Country { Code = "EE", Name = "Estonia" });
```

TypeScript shape that `ts-linq` must mirror:

```ts
export class EntityTypeBuilder<T> {
  hasData(...rows: T[]): this;
}
```

> Hard rule: public TypeScript names MUST match EF Core.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart LR
  MB[ModelBuilder.entity<T>().hasData(...)] --> Seed[SeedDataMetadata]
  Seed --> Snap[ModelSnapshot includes seed sets]
  Snap --> Cmp[SchemaComparator diffs seeds]
  Cmp --> Mig[DiffBasedMigration emits INSERT/UPDATE/DELETE]
  Mig --> Run[MigrationRunner applies]
```

- **Decision**: Seeds are part of the model snapshot. On migration diff, the comparator walks each entity's seed set against the previous snapshot keyed by primary key. New rows ⇒ INSERT; changed non-key columns ⇒ UPDATE; removed ⇒ DELETE.
- **Context**: `MigrationRunner`/`DiffBasedMigration` already operate on snapshots; extending them with seed diff is mechanical.
- **Consequences**:
  - (+) Reference data tracked under version control with schema.
  - (+) Idempotent re-runs.
  - (−) Seed rows must have explicit, stable primary keys.
  - (~) Cyclic FK dependencies in seeds need topological ordering.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/orm`, `@ts-linq/metadata`, `@ts-linq/migrations`
- **New types / files**:
  - `packages/metadata/src/SeedDataMetadata.ts`
  - `packages/migrations/src/seed/SeedDiff.ts`
- **Touch-points**:
  - `packages/orm/src/builders/EntityTypeBuilder.ts` — `hasData(...rows)`.
  - `packages/migrations/src/SchemaComparator.ts` — append seed diff after DDL diff.
  - `packages/migrations/src/DiffBasedMigration.ts` — render emitted DML in the same migration file.
  - `packages/migrations/src/MigrationRunner.ts` — apply DML inside the same transaction as DDL.
- **Data flow**: ModelSnapshot serialises seeds alongside metadata. Comparator joins previous and current seed sets by PK; differences become DML ops. Topo-sort ensures FK constraints satisfied at apply time.

## 5. Implementation options

### Option A — Seeds in ModelSnapshot, diffed by PK (recommended)
- Pros: parity with EF, idempotent, transactional with DDL.
- Cons: seeds with computed keys or trigger-derived PKs unsupported.
- Effort: M

### Option B — Always re-insert (TRUNCATE + INSERT)
- Pros: trivial.
- Cons: destroys user mutations on seed rows; breaks FK in dependent tables.
- Effort: S

### Option C — Separate seed file outside migrations
- Pros: keeps migrations DDL-only.
- Cons: drifts from schema; no diff; matches what users do today badly.
- Effort: M

### Recommendation
Option A. Diff-by-PK is exactly how EF behaves and what users expect.

## 6. Related problems / follow-up tasks

- [P0-01](./P0-01-fluent-api-modelbuilder.md) — builder host.
- [P0-14](./P0-14-computed-default-check.md) — seed values must respect `HasDefaultValue`/computed columns (skip server-computed columns when generating INSERTs).

## 7. Acceptance criteria

- [ ] Public API mirrors EF Core signature.
- [ ] `hasData` rejects rows with missing primary key.
- [ ] Diff produces correct INSERT / UPDATE / DELETE between snapshots.
- [ ] Topological sort of seeds across entities with FKs.
- [ ] Integration test: roll forward, roll back, re-apply — converges idempotently.
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`.

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
