---
title: Inheritance mapping — TPH, TPT, TPC
ef_core_api: EntityTypeBuilder<T>.HasDiscriminator<TKey>(e => e.Type).HasValue<Sub>("sub") / UseTptMappingStrategy() / UseTpcMappingStrategy()
status: done
priority: P0
effort: XL
depends_on: [P0-01]
related: [P0-11]
ts_linq_packages_touched: [@ts-linq/orm, @ts-linq/metadata, @ts-linq/query, @ts-linq/sql-visitor, @ts-linq/migrations]
---

# Inheritance Mapping — TPH / TPT / TPC

## 1. Why (problem statement)

Polymorphic hierarchies are common: `Notification` with `EmailNotification` / `SmsNotification`, `Payment` with `CardPayment` / `BankPayment`. EF Core supports three storage strategies — Table-per-Hierarchy (one table + discriminator column), Table-per-Type (base table + per-subtype tables joined by PK), Table-per-Concrete-type (no base table, one table per leaf). `ts-linq` cannot model hierarchies at all today: a `@Entity` decorator on a subclass is silently ignored at materialization. This blocks domains with inheritance, and the discriminator column is also the primary mechanism for filtering polymorphic queries (`ctx.Notifications.OfType<EmailNotification>()`).

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
// TPH (default)
modelBuilder.Entity<Payment>()
  .HasDiscriminator<string>("kind")
  .HasValue<CardPayment>("card")
  .HasValue<BankPayment>("bank");

// TPT
modelBuilder.Entity<Payment>().UseTptMappingStrategy();
modelBuilder.Entity<CardPayment>().ToTable("card_payments");

// TPC
modelBuilder.Entity<Payment>().UseTpcMappingStrategy();
modelBuilder.Entity<BankPayment>().ToTable("bank_payments");

var emails = ctx.Notifications.OfType<EmailNotification>().ToList();
```

TypeScript shape that `ts-linq` must mirror:

```ts
export class EntityTypeBuilder<T> {
  hasDiscriminator<TKey>(name: string): DiscriminatorBuilder<TKey>;
  useTphMappingStrategy(): this;
  useTptMappingStrategy(): this;
  useTpcMappingStrategy(): this;
}

export class DiscriminatorBuilder<TKey> {
  hasValue<TSub>(ctor: Ctor<TSub>, value: TKey): this;
  isComplete(complete?: boolean): this;
}

export interface IQueryable<T> {
  ofType<TSub extends T>(ctor: Ctor<TSub>): IQueryable<TSub>;
}
```

> Hard rule: public TypeScript names and chaining order MUST match EF Core.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart TB
  H[Hierarchy root EntityMetadata] --> S{Strategy}
  S -->|TPH| One[(one table + discriminator)]
  S -->|TPT| Many[(base table + sub tables joined on PK)]
  S -->|TPC| Each[(one table per concrete leaf, UNION ALL)]
  Q[Queryable<Base>.ofType<Sub>()] --> H
  Q --> SV[SqlVisitor branches per strategy]
```

- **Decision**: Hierarchy metadata holds the strategy; `SqlVisitor` has three emission paths (filter by discriminator / LEFT JOIN subtype tables / UNION ALL across leaves). Materialization always uses the discriminator (synthetic for TPT/TPC if absent).
- **Context**: Touches every major subsystem — metadata, query, SQL, migrations.
- **Consequences**:
  - (+) Unlocks polymorphic domains.
  - (+) `OfType<T>()` becomes a single LINQ operator usable across strategies.
  - (−) DDL diff (migrations) gets considerably more complex (rename of TPH → TPT is non-trivial).
  - (~) TPC requires careful key strategy: globally unique IDs needed since the base "table" is virtual.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/metadata`, `@ts-linq/orm`, `@ts-linq/query`, `@ts-linq/sql-visitor`, `@ts-linq/migrations`
- **New types / files**:
  - `packages/metadata/src/InheritanceStrategy.ts`
  - `packages/metadata/src/HierarchyMetadata.ts`
  - `packages/orm/src/builders/DiscriminatorBuilder.ts`
  - `packages/sql-visitor/src/visitors/InheritanceVisitor.ts`
- **Touch-points**:
  - `packages/orm/src/builders/EntityTypeBuilder.ts` — discriminator + strategy.
  - `packages/query/src/Queryable.ts` — add `ofType(ctor)`.
  - `packages/sql-visitor/src/visitors/SelectVisitor.ts` — strategy dispatch.
  - `packages/migrations/src/SchemaComparator.ts` — emit DDL per strategy; detect strategy migrations.
  - Materializer — pick ctor from discriminator value.
- **Data flow**: At query time, the visitor reads the hierarchy strategy. TPH adds a `WHERE disc IN (...)`. TPT generates a base SELECT + LEFT JOINs to subtype tables and a CASE-discriminator. TPC emits `UNION ALL` across all leaves with a synthetic discriminator literal per branch.

## 5. Implementation options

### Option A — Three full strategies behind one metadata flag (recommended)
- Pros: feature-complete; users pick the best storage for their domain.
- Cons: largest implementation surface.
- Effort: XL

### Option B — TPH only now, TPT/TPC later
- Pros: covers 70% of cases quickly.
- Cons: locks API; users with normalised schemas blocked.
- Effort: L

### Option C — TPC as client-side merge of independent DbSets
- Pros: avoids UNION translation.
- Cons: breaks `Where` semantics across the hierarchy; not real EF parity.
- Effort: M

### Recommendation
Option A. Skipping TPT/TPC now means every consumer with normalized DBs is blocked, and re-opening the API later is expensive.

## 6. Related problems / follow-up tasks

- [P0-01](./P0-01-fluent-api-modelbuilder.md) — builder hosts strategy methods.
- [P0-11](./P0-11-global-query-filters.md) — query filters must compose with discriminator predicates without double-filtering.

## 7. Acceptance criteria

- [ ] Public API mirrors EF Core signature.
- [ ] TPH: discriminator column generated; `ofType<T>()` filters correctly.
- [ ] TPT: subtype tables join on PK; insert/update splits across tables in one transaction.
- [ ] TPC: `UNION ALL` query and per-leaf insert path verified.
- [ ] Materializer constructs correct concrete subclass.
- [ ] Migration emits DDL for all three strategies in postgres.
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`.

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
