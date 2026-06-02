# @ts-linq/orm

> The high-level ORM: `DbContext`, change tracking, `DbSet`, the fluent model-building API,
> value generators, context pooling, transactions, and interceptor registration.

This is the package application code uses directly. It composes `core`, `query`, `metadata`, and
`migrations` into an Entity-Framework-style developer experience: define a `DbContext`, configure
the model with builders, query via `DbSet`, mutate tracked entities, and `saveChanges()`.

## Installation

```bash
pnpm add @ts-linq/orm
```

## What lives here

- **Context** — `DbContext`, `DbContextOptionsBuilder`, `DatabaseFacade`, context pooling
  (`DbContextPool`, `PooledDbContextFactory`), `DbContextFactory`.
- **Sets & tracking** — `DbSet`, `ChangeTracker`, `ChangeTrackerFacade`, `EntityEntry`,
  `PropertyEntry`, `IdentityMap`, `LocalView`, `CascadeWalker`, `JsonSnapshotter`.
- **Model building** — `ModelBuilder`, `EntityTypeBuilder`, and the `builders/*` family
  (navigation, owned types, complex types, indexes, sequences, discriminators, DB functions).
- **Value generators** — `HiLoValueGenerator`, `UlidValueGenerator`, `UuidV7ValueGenerator`,
  `UtcNowValueGenerator`.
- **Transactions & save** — `DbContextTransaction`, batch executor/grouper, `sql` interpolation tag.
- **Options** — warning configuration, sensitive-data logging, `logTo`.
- **Exceptions** — `DbUpdateConcurrencyException`, `KeylessMutationError`.

## Usage

```ts
class AppDb extends DbContext {
  users = this.set(User);
  protected onModelCreating(b: ModelBuilder) {
    b.entity(User).property(u => u.email).isRequired();
  }
}

const db = new AppDb(options);
const u = await db.users.where(x => x.id === 1).firstAsync();
u.email = 'new@example.com';
await db.saveChanges();
```

## Package structure

```
src/
  DbContext.ts, DbContextOptionsBuilder.ts, DatabaseFacade.ts, DbSet.ts
  ChangeTracker.ts, changetracker/*, IdentityMap.ts, LocalView.ts
  ModelBuilder.ts, builders/*           # fluent model configuration
  valueGenerators/*, save-changes/*, transactions/*, pooling/*
  exceptions/*, options/*, factory/*
  index.ts                              # public barrel
```

## Dependencies

- `@ts-linq/concurrency`, `@ts-linq/core`, `@ts-linq/metadata`, `@ts-linq/metrics-safe`,
  `@ts-linq/migrations`, `@ts-linq/query`, `@ts-linq/sql-visitor`, `@ts-linq/telemetry`,
  `@ts-linq/types`

## License

Part of the ts-linq monorepo. See the repository root for license details.
