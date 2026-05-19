---
title: Many-to-many with skip navigations
ef_core_api: EntityTypeBuilder<T>.HasMany(e => e.Tags).WithMany(t => t.Posts).UsingEntity<PostTag>(...)
status: not-started
priority: P0
effort: L
depends_on: [P0-01]
related: [P0-09]
ts_linq_packages_touched: [@ts-linq/orm, @ts-linq/metadata, @ts-linq/query, @ts-linq/sql-visitor, @ts-linq/migrations]
---

# Many-to-Many with Skip Navigations

## 1. Why (problem statement)

`Post` has `Tag[]`, `Tag` has `Post[]`, and the user never wants to think about a `PostTag` join entity. EF Core delivers this through "skip navigations": `HasMany().WithMany()` auto-generates a shadow join entity (or accepts an explicit one via `UsingEntity<T>(...)`) and lets users do `post.Tags.Add(tag)` directly. `ts-linq` today requires the user to materialise the join table by hand and write the LINQ join manually — a constant source of toil and bugs. Skip navigations also interact tightly with `Include` (eager) and `LazyLoadingProxy` (lazy), both of which already exist in the codebase.

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
modelBuilder.Entity<Post>()
  .HasMany(p => p.Tags)
  .WithMany(t => t.Posts);

// explicit join
modelBuilder.Entity<Post>()
  .HasMany(p => p.Tags)
  .WithMany(t => t.Posts)
  .UsingEntity<PostTag>(
    j => j.HasOne(pt => pt.Tag).WithMany().HasForeignKey(pt => pt.TagId),
    j => j.HasOne(pt => pt.Post).WithMany().HasForeignKey(pt => pt.PostId),
    j => {
      j.HasKey(pt => new { pt.PostId, pt.TagId });
      j.Property(pt => pt.AddedAt).HasDefaultValueSql("NOW()");
    });
```

TypeScript shape that `ts-linq` must mirror:

```ts
export class CollectionNavigationBuilder<T, TRel> {
  withMany(selector?: (r: TRel) => T[]): CollectionCollectionBuilder<T, TRel>;
}

export class CollectionCollectionBuilder<TLeft, TRight> {
  usingEntity<TJoin>(
    configureRight: (j: EntityTypeBuilder<TJoin>) => ReferenceCollectionBuilder<TRight, TJoin>,
    configureLeft:  (j: EntityTypeBuilder<TJoin>) => ReferenceCollectionBuilder<TLeft, TJoin>,
    configureJoin?: (j: EntityTypeBuilder<TJoin>) => void,
  ): EntityTypeBuilder<TJoin>;
}
```

> Hard rule: public TypeScript names and chaining order MUST match EF Core.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart LR
  Left[Entity Post.tags : Tag[]] --> SN[SkipNavigation]
  Right[Entity Tag.posts : Post[]] --> SN
  SN --> J[Join entity metadata<br/>auto-synthesised or explicit]
  J --> Mig[Migrations emit join table]
  SN --> Q[Queryable: include(p => p.tags) auto-joins]
  SN --> CT[ChangeTracker tracks join rows]
```

- **Decision**: Skip-navigation metadata wraps a normal join entity. The change tracker emits add/remove rows when collection adds/removes; queries auto-emit two joins (left↔join, join↔right).
- **Context**: The existing `Include` machinery already does N+1-free joins; one more hop is mechanical.
- **Consequences**:
  - (+) Domain code becomes idiomatic.
  - (+) DDL for the join table is generated automatically.
  - (−) ChangeTracker must understand "synthetic" entities the user never sees.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/orm`, `@ts-linq/metadata`, `@ts-linq/query`, `@ts-linq/sql-visitor`, `@ts-linq/migrations`
- **New types / files**:
  - `packages/metadata/src/SkipNavigationMetadata.ts`
  - `packages/orm/src/builders/CollectionCollectionBuilder.ts`
- **Touch-points**:
  - `packages/orm/src/builders/CollectionNavigationBuilder.ts` — `withMany`.
  - `packages/orm/src/ChangeTracker.ts` — `detectChanges` produces inserts/deletes against the join table from collection diffs.
  - `packages/query/src/Queryable.ts` — `include` resolves skip navs as a double join.
  - `packages/migrations/src/SchemaComparator.ts` — emit DDL for synthesised join tables (composite PK).
- **Data flow**: at finalize time, if no explicit `UsingEntity` was supplied, synthesise a join entity with composite PK `(leftFk, rightFk)`. On `SaveChanges`, diff the in-memory collection against the snapshot to produce INSERT/DELETE rows on the join table.

## 5. Implementation options

### Option A — Synthesised join entity + ChangeTracker diff (recommended)
- Pros: EF parity, supports `UsingEntity<T>()` upgrade path with extra columns.
- Cons: diffing collections is O(n) per save.
- Effort: L

### Option B — Treat skip navs as syntactic sugar, force users to declare join entity
- Pros: smaller scope.
- Cons: defeats the value of the feature.
- Effort: M

### Option C — Use raw SQL DML for inserts/deletes, skip ChangeTracker
- Pros: cheap saves.
- Cons: no transactional consistency with other entity changes; breaks save-order rules.
- Effort: M

### Recommendation
Option A. EF parity is the goal and `UsingEntity` is the documented upgrade path when extra columns appear.

## 6. Related problems / follow-up tasks

- [P0-01](./P0-01-fluent-api-modelbuilder.md) — builder surface.
- [P0-09](./P0-09-cascade-delete-behaviors.md) — cascade rules on join table FKs must be configurable.

## 7. Acceptance criteria

- [ ] Public API mirrors EF Core signature.
- [ ] Implicit M-N: `post.tags.push(tag); ctx.saveChanges()` inserts the join row.
- [ ] Explicit `UsingEntity<T>` supports extra columns (`addedAt`) with defaults.
- [ ] `include(p => p.tags)` emits a single SQL with two joins.
- [ ] Migration emits join-table DDL with composite PK and FKs.
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`.

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
