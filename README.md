# ts-linq

TypeScript ORM inspired by Entity Framework Core: decorator-based entities, change tracking, and LINQ-style fluent querying.

## Supported databases

- PostgreSQL (`@ts-linq/provider-postgres`)
- MySQL (`@ts-linq/provider-mysql`)
- Microsoft SQL Server (`@ts-linq/provider-mssql`)

## Quick start (PostgreSQL)

```ts
import 'reflect-metadata';
import { DbContext, DbSet } from '@ts-linq/orm';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

@Entity({ name: 'users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT', nullable: false })
  name!: string;
}

class AppDbContext extends DbContext {
  public users!: DbSet<User>;
}

async function main() {
  const ctx = new AppDbContext({
    provider: 'postgresql',
    connectionString:
      process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/ts_linq'
  });

  ctx.register(User);
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
q.where(u => u.age >= minAge && !u.isActive)
```

into:

```ts
q.whereCompiled({ ast, parameters })
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

## Local PostgreSQL via Docker

This repository ships a minimal `docker-compose.yml` for PostgreSQL.

```bash
docker compose up -d
export POSTGRES_URL='postgres://postgres:postgres@localhost:5432/ef_test'
```

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

