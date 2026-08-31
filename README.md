# ts-linq

TypeScript ORM inspired by Entity Framework Core: decorator-based entities, change tracking, and LINQ-style fluent querying.

## About this project

`ts-linq` is a personal pet project, not a published or officially supported library. It's a
sandbox for exploring what an EF Core-style ORM looks like when rebuilt from scratch in
TypeScript — decorator-based entity mapping, a change tracker, a fluent LINQ-like query API,
and multi-dialect SQL/DDL generation, organized as a proper `pnpm` monorepo with strict package
boundaries.

It's built purely for fun, and mostly with AI coding agents. The point isn't to have an LLM
autocomplete snippets — it's to practice a different way of working: the agent writes the code,
and I focus on driving the development process — architecture decisions, task breakdown, review,
and keeping the whole thing consistent — rather than typing every line by hand.

The main motivation is hands-on, in-depth practice with:

- type-level TypeScript (generics, conditional/mapped types, fluent builder APIs that keep
  strong inference across chained calls);
- compiler-level work — a `ts-patch`/Compiler-API transformer that rewrites `where(u => ...)`
  predicates into a typed AST at compile time instead of parsing them at runtime;
- cross-dialect SQL/DDL generation shared across PostgreSQL, MySQL, and SQL Server through a
  common strategy layer;
- monorepo and architecture discipline — clean package boundaries, typed error hierarchies,
  and dependency-graph enforcement across ~30+ packages.

Expect it to evolve, break compatibility, and take on scope driven by curiosity rather than a
product roadmap.

## Supported databases

- PostgreSQL (`@ts-linq/provider-postgres`)
- MySQL (`@ts-linq/provider-mysql`)
- Microsoft SQL Server (`@ts-linq/provider-mssql`)

## Quick start (PostgreSQL)

```ts
import 'reflect-metadata';
import { DbContext } from '@ts-linq/orm';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { PostgresProvider } from '@ts-linq/provider-postgres';

@Entity({ name: 'users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT', nullable: false })
  name!: string;
}

class AppDbContext extends DbContext {
  users = this.defineSet(User);
}

async function main() {
  const provider = new PostgresProvider({
    host: 'localhost',
    port: 5432,
    database: 'ts_linq',
    user: 'postgres',
    password: 'postgres'
  });
  const ctx = new AppDbContext({ provider });

  await ctx.ensureCreated();

  const u = new User();
  u.name = 'Alice';
  ctx.users.add(u);
  await ctx.saveChanges();

  const all = await ctx.users.orderBy((x) => x.id).toArray();
  console.log(all);

  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

## Compile-time predicate transformer (recommended)

`@ts-linq/query` no longer parses predicates at runtime via `Function#toString()` and regex.
Instead, a compile-time transformer rewrites:

```ts
q.where((u) => u.age >= minAge && !u.isActive);
```

into:

```ts
q.whereCompiled({ ast, parameters });
```

### Setup (ts-patch)

1. Install `ts-patch` as a dev dependency and patch your local TypeScript installation:

```bash
npm i -D ts-patch
npx ts-patch install
```

2. Add the plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ts-linq/transformer",
        "type": "program"
      }
    ]
  }
}
```

3. Compile using `tspc` (ts-patch compiler wrapper):

```bash
npx tspc -p tsconfig.json
```

### Supported expression subset (v1)

- `ArrowFunction` with a single parameter, expression body (not a block)
- `&&` → `LogicalOperator.And`
- `!` → `UnaryOperator.Not`
- comparisons: `===`, `==`, `>`, `>=`, `<`, `<=`
- left operand: member access rooted at the lambda parameter (`u.profile.age`)
- right operand: literal (`number|string|boolean|null`) or a closure value (no lambda param references)

### Breaking change / migration

- Runtime `PredicateParser` has been removed.
- Calling `where(...)` or `having(...)` without the transformer will throw:
  `ts-linq(where): compile-time transformer is required...`
- If your environment cannot run the transformer, you can call `whereCompiled(...)` / `havingCompiled(...)`
  manually (but you lose the nice `where(u => ...)` UX).

### ts-patch-free alternative

`@ts-linq/transformer-morph` is a newer, drop-in replacement for `@ts-linq/transformer` built on
`ts-morph` + the TypeScript Compiler API — it produces byte-compatible `whereCompiled(...)` output
without patching your local TypeScript installation. New integrations should prefer it; see
[`packages/transformer-morph/README.md`](./packages/transformer-morph/README.md). It's what
[`packages/examples`](./packages/examples) builds with.

## Local PostgreSQL via Docker

This repository ships a minimal `docker-compose.yml` for PostgreSQL.

```bash
docker compose up -d
export POSTGRES_URL='postgres://postgres:postgres@localhost:5432/ts_linq'
```

## Examples

[`packages/examples`](./packages/examples) has two runnable programs exercising the public API
against a real PostgreSQL instance (see [Local PostgreSQL via Docker](#local-postgresql-via-docker)
above):

```bash
docker compose up -d
pnpm --filter @ts-linq/examples build
pnpm --filter @ts-linq/examples example:crud           # entity definition, CRUD, saveChanges
pnpm --filter @ts-linq/examples example:linq-queries    # where/orderBy/select/pagination
```

## Feature guides

In-depth write-ups for specific features live under [`apps/docs`](./apps/docs):

- [Alternate Keys and Rich Indexes](./apps/docs/alternate-keys-indexes.md)
- [Backing Fields and Property Access Mode](./apps/docs/backing-fields-property-access.md)
- [Batching / MaxBatchSize](./apps/docs/batching-max-batch-size.md)
- [Cascade Delete Behaviors](./apps/docs/cascade-delete-behaviors.md)
- [DbContext Pooling and IDbContextFactory](./apps/docs/db-context-pooling.md)
- [EF.Functions](./apps/docs/ef-functions.md)
- [ExecuteUpdate and ExecuteDelete](./apps/docs/execute-update-delete.md)
- [ExecutionStrategy and EnableRetryOnFailure](./apps/docs/execution-strategy.md)
- [HierarchyId Support](./apps/docs/hierarchy-id.md)
- [Idempotent Migration Scripts & HasPendingModelChanges](./apps/docs/idempotent-scripts.md)
- [Logging, Sensitive Data, Detailed Errors, ConfigureWarnings](./apps/docs/logging-diagnostics.md)
- [Migration Bundles](./apps/docs/migration-bundles.md)
- [Query Tags and Call-Site Tagging](./apps/docs/query-tags.md)
- [Spatial Types](./apps/docs/spatial.md)
- [Stored Procedure Mapping for Insert / Update / Delete](./apps/docs/stored-procedure-mapping.md)
- [Temporal Queries (SQL Server System-Versioned Tables)](./apps/docs/temporal-queries.md)
- [Value Generators and Sentinel](./apps/docs/value-generators.md)
- [Views and Keyless Entities](./apps/docs/views-keyless-entities.md)

## Repository layout

Monorepo packages live under `packages/`.

- `@ts-linq/types` — shared types
- `@ts-linq/metadata` — decorators + metadata storage
- `@ts-linq/query` — query model + SQL generation helpers
- `@ts-linq/transformer` — compile-time predicate transformer (`where(...)` → `whereCompiled(...)`)
- `@ts-linq/orm` — `DbContext`, `DbSet`, change tracking
- `@ts-linq/migrations` — schema diff + migration helpers
- Providers:
  - `@ts-linq/provider-postgres`
  - `@ts-linq/provider-mysql`
  - `@ts-linq/provider-mssql`

## License

[MIT](./LICENSE)
