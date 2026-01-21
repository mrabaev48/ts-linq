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
- `@ts-linq/orm` — `DbContext`, `DbSet`, change tracking
- `@ts-linq/migrations` — schema diff + migration helpers
- Providers:
  - `@ts-linq/provider-postgres`
  - `@ts-linq/provider-mysql`
  - `@ts-linq/provider-mssql`

