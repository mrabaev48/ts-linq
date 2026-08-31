# @ts-linq/examples

> Runnable code examples for ts-linq.

Small, runnable programs demonstrating ts-linq features against a real PostgreSQL instance.

## Prerequisites

A local PostgreSQL instance — from the repo root:

```bash
docker compose up -d
export POSTGRES_URL='postgres://postgres:postgres@localhost:5432/ts_linq'  # optional, this is the default
```

## Running

```bash
pnpm --filter @ts-linq/examples build
pnpm --filter @ts-linq/examples example:crud           # entity definition, connect, CRUD, saveChanges
pnpm --filter @ts-linq/examples example:linq-queries    # where / orderBy / select / pagination / count
```

`build` compiles through `@ts-linq/transformer-morph` (`ts-linq-transform`), which rewrites the
`where(...)`/`select(...)` lambdas in these examples into their compiled AST form at build time —
the same transformer described in the root README.

## Package structure

```
src/
  index.ts          # manifest / how to run the examples below
  crud.ts           # define an entity, connect, add/read/update/remove, saveChanges
  linq-queries.ts    # where, orderBy/orderByDescending, select, skip/take, count
```

## License

Part of the ts-linq monorepo. See the repository root for license details.
