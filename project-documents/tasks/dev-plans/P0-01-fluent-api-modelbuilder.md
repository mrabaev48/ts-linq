---
title: Fluent API — ModelBuilder & OnModelCreating
ef_core_api: DbContext.OnModelCreating(ModelBuilder modelBuilder) / modelBuilder.Entity<T>().HasOne().WithMany().HasForeignKey()
status: not-started
priority: P0
effort: XL
depends_on: []
related: [P0-05, P0-06, P0-07, P0-08, P0-09, P0-11, P0-14, P0-15]
ts_linq_packages_touched: [@ts-linq/orm, @ts-linq/metadata, @ts-linq/core]
---

# Fluent API — ModelBuilder & OnModelCreating

## 1. Why (problem statement)

EF Core users configure their model in two places: data annotations (decorators in our TS port) and the Fluent API exposed through `DbContext.OnModelCreating(ModelBuilder)`. The Fluent API is the canonical, more powerful surface: it supports configuration that cannot be expressed via attributes (composite keys, shadow properties, multi-relationship overrides, owned types, query filters, value converters, discriminators). `ts-linq` today only ships decorator-based metadata in `@ts-linq/metadata` (`@Entity`, `@Column`, `@PrimaryKey`, `@ForeignKey`) and has no programmatic builder. Without a `ModelBuilder` we cannot land the rest of the P0 roadmap (value converters, owned types, inheritance strategies, M-N skip navs, cascade behavior, concurrency tokens, global filters, computed/default/check, JSON, HasData). This task is the foundation: it introduces an additive Fluent API that coexists with the decorator registry and feeds the same internal metadata model used by `Queryable`, `DbSet`, `SqlVisitor`, and `MigrationRunner`.

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
public class AppDbContext : DbContext {
  public DbSet<User> Users => Set<User>();
  public DbSet<Profile> Profiles => Set<Profile>();

  protected override void OnModelCreating(ModelBuilder modelBuilder) {
    modelBuilder.Entity<User>(b => {
      b.ToTable("users");
      b.HasKey(u => u.Id);
      b.Property(u => u.Email).HasMaxLength(256).IsRequired();
      b.HasOne(u => u.Profile)
       .WithOne(p => p.User)
       .HasForeignKey<Profile>(p => p.UserId);
    });

    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
  }
}

public class UserConfiguration : IEntityTypeConfiguration<User> {
  public void Configure(EntityTypeBuilder<User> builder) {
    builder.HasIndex(u => u.Email).IsUnique();
  }
}
```

TypeScript shape that `ts-linq` must mirror (signatures only):

```ts
export abstract class DbContext {
  protected onModelCreating(modelBuilder: ModelBuilder): void {}
}

export class ModelBuilder {
  entity<T>(ctor: Ctor<T>, configure?: (b: EntityTypeBuilder<T>) => void): EntityTypeBuilder<T>;
  applyConfiguration<T>(config: IEntityTypeConfiguration<T>): ModelBuilder;
  applyConfigurationsFromAssembly(modules: Record<string, unknown>[]): ModelBuilder;
}

export interface IEntityTypeConfiguration<T> {
  configure(builder: EntityTypeBuilder<T>): void;
}

export class EntityTypeBuilder<T> {
  toTable(name: string, schema?: string): this;
  hasKey<K extends keyof T>(...keys: K[]): this;
  property<K extends keyof T>(selector: (e: T) => T[K]): PropertyBuilder<T[K]>;
  hasOne<TRel>(selector: (e: T) => TRel | undefined): ReferenceNavigationBuilder<T, TRel>;
  hasMany<TRel>(selector: (e: T) => TRel[]): CollectionNavigationBuilder<T, TRel>;
  hasIndex<K extends keyof T>(...keys: K[]): IndexBuilder<T>;
}

export class ReferenceNavigationBuilder<T, TRel> {
  withOne(selector?: (r: TRel) => T | undefined): ReferenceReferenceBuilder<T, TRel>;
  withMany(selector?: (r: TRel) => T[]): ReferenceCollectionBuilder<T, TRel>;
}

export class ReferenceReferenceBuilder<T, TRel> {
  hasForeignKey<TDep>(selector: (e: TDep) => unknown): this;
  hasPrincipalKey<TPrin>(selector: (e: TPrin) => unknown): this;
  onDelete(behavior: DeleteBehavior): this;
  isRequired(required?: boolean): this;
}
```

> Hard rule: the public TypeScript names, chaining order, and semantics MUST match EF Core. Internal implementation is free to deviate.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart TB
  Dev[User: AppDbContext.onModelCreating] --> MB[ModelBuilder<br/>@ts-linq/orm]
  MB --> ETB[EntityTypeBuilder<T>]
  ETB --> Reg[Unified MetadataRegistry<br/>@ts-linq/metadata]
  Dec[Decorators @Entity/@Column] --> Reg
  Reg --> Q[Queryable / DbSet<br/>@ts-linq/query, orm]
  Reg --> SV[SqlVisitor<br/>@ts-linq/sql-visitor]
  Reg --> Mig[MigrationRunner<br/>@ts-linq/migrations]
```

- **Decision**: Introduce a `ModelBuilder` in `@ts-linq/orm` that writes into the existing `@ts-linq/metadata` registry. Decorators remain the default, Fluent API overrides on conflict (EF parity).
- **Context**: Existing pipelines (`SqlVisitor`, `MigrationRunner`, `EntityLoader`) already consume metadata via the registry. Adding another writer is non-breaking.
- **Consequences**:
  - (+) Unlocks every other P0 task without forking metadata.
  - (+) Decorator users see no change.
  - (−) Order-of-application precedence must be documented (decorators first, Fluent overrides).
  - (~) `DbContext` lifecycle gains a model-finalization step.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/orm`, `@ts-linq/metadata`, `@ts-linq/core`
- **New types / files**:
  - `packages/orm/src/ModelBuilder.ts`
  - `packages/orm/src/builders/EntityTypeBuilder.ts`
  - `packages/orm/src/builders/PropertyBuilder.ts`
  - `packages/orm/src/builders/ReferenceNavigationBuilder.ts`
  - `packages/orm/src/builders/CollectionNavigationBuilder.ts`
  - `packages/orm/src/builders/IndexBuilder.ts`
  - `packages/orm/src/builders/IEntityTypeConfiguration.ts`
  - `packages/metadata/src/MetadataRegistry.ts` — extend with `mergeFluent(...)` API
- **Touch-points**:
  - `packages/orm/src/DbContext.ts` — add `onModelCreating(builder)`; call once in constructor after decorator scan; cache finalized model per context type.
  - `packages/orm/src/DbSet.ts` — read effective metadata from finalized model snapshot, not directly from decorator registry.
  - `packages/metadata/src/index.ts` — export merged-metadata getters.
- **Data flow**:
  1. `DbContext` constructor builds an initial `ModelSnapshot` from decorators.
  2. Calls `onModelCreating(modelBuilder)`; user mutates builder.
  3. `modelBuilder.finalize()` produces an immutable `IModel` consumed downstream by query translation and migrations.
  4. Subsequent `DbSet<T>()` calls resolve metadata against the frozen `IModel`.

## 5. Implementation options

### Option A — Hybrid: Fluent writes through metadata registry (recommended)
- Pros: zero duplication, decorators and Fluent share storage, smallest blast radius, downstream packages unchanged.
- Cons: registry must distinguish "source: attribute vs fluent" for override semantics.
- Effort: L

### Option B — Parallel ModelBuilder model, decorators projected at finalize
- Pros: cleaner separation of "configuration" vs "model".
- Cons: doubles the metadata surface, requires rewriting `SqlVisitor` consumers; high risk.
- Effort: XL

### Option C — Fluent-only, deprecate decorators
- Pros: matches recent EF Core direction.
- Cons: breaks existing `ts-linq` users; not additive.
- Effort: L but breaking.

### Recommendation
Option A. The decorator registry already exists and is consumed everywhere; layering a builder on top is the lowest-risk path that unlocks the whole P0 batch.

## 6. Related problems / follow-up tasks

- [P0-05](./P0-05-value-converters.md) — `HasConversion` is a method on `PropertyBuilder`.
- [P0-06](./P0-06-owned-entity-types.md) — `OwnsOne` is a method on `EntityTypeBuilder`.
- [P0-07](./P0-07-inheritance-tph-tpt-tpc.md) — `HasDiscriminator` / `UseTpt...` live on `EntityTypeBuilder`.
- [P0-08](./P0-08-many-to-many-skip-navigations.md) — `HasMany().WithMany()` needs `CollectionCollectionBuilder`.
- [P0-09](./P0-09-cascade-delete-behaviors.md) — `OnDelete(...)` is wired into navigation builders.
- [P0-11](./P0-11-global-query-filters.md) — `HasQueryFilter` on `EntityTypeBuilder`.
- [P0-14](./P0-14-computed-default-check.md) — `HasDefaultValue` / `HasComputedColumnSql` on `PropertyBuilder`.
- [P0-15](./P0-15-json-columns.md) — `ToJson()` on owned-type builder.

## 7. Acceptance criteria

- [ ] Public API mirrors EF Core signature (Entity, Property, HasOne/WithOne, HasMany/WithMany, HasKey, HasIndex, ToTable, ApplyConfiguration, ApplyConfigurationsFromAssembly).
- [ ] Unit tests cover: decorator-only model, fluent-only model, hybrid override, `IEntityTypeConfiguration` discovery.
- [ ] Integration test against postgres dialect proves DDL matches between decorator and fluent equivalents.
- [ ] Docs in `apps/docs/` updated with side-by-side decorator vs fluent example.
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`.

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
