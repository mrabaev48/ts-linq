# @ts-linq/cli

> Command-line tools for ts-linq: migrations, schema diff/apply/export, entity & migration
> generation, DB-first scaffolding, compiled-model optimization, seeding, and a metrics endpoint.

Provides the `ts-linq` binary used in development and CI to manage the database lifecycle around a
ts-linq `DbContext`.

## Installation

```bash
pnpm add -D @ts-linq/cli
# invoke via: pnpm ts-linq <command>
```

## Commands

| Command | Purpose |
|---|---|
| `init` | Scaffold initial ts-linq config |
| `generate:migration` | Generate a migration from model changes |
| `generate:entity` / `generate:entities` | Generate entity classes |
| `migrations:status` / `:validate` / `:dry-run` | Inspect/validate pending migrations |
| `migrations:rollback` | Roll back applied migrations |
| `migrations:script` / `:bundle` | Emit idempotent SQL script / bundled migrations |
| `schema:diff` / `:apply` / `:export` / `:validate` | Schema diffing and application |
| `scaffold` | DB-first scaffolding of a `DbContext` |
| `dbcontext:optimize` | Emit a compiled model (AOT) |
| `seed` | Run data seeding |
| `metrics:serve` | Serve a metrics endpoint |

## Architecture

The CLI is structured with ports & adapters: `ports/` (`FileSystem`, `Logger`, `ProviderFactory`)
with `adapters/` (`NodeFs`, `ConsoleLogger`, `EnvProviderFactory`). Commands implement a common
`Command` interface and are wired in `CommandRegistry`. Generators live in `generators/`.

## Package structure

```
src/
  cli.ts                 # bin entry (ts-linq)
  CommandRegistry.ts
  commands/*             # one file per command
  ports/*, adapters/*    # ports & adapters
  generators/*           # entity/migration/compiled-model emitters
  bootstrap/StubDatabaseProvider.ts
  provider-factory.ts, config.ts, utils.ts
  index.ts
```

## Dependencies

- `@ts-linq/core`, `@ts-linq/metadata`, `@ts-linq/types`, `@ts-linq/migrations`
- `typescript` (peer)

## License

Part of the ts-linq monorepo. See the repository root for license details.
