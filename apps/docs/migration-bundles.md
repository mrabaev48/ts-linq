# Migration Bundles

> **EF Core equivalent**: `dotnet ef migrations bundle --self-contained -r linux-x64`

Migration bundles produce a **self-contained Node.js script** that applies your database
migrations without requiring a full Node project, `.ts` files, or development dependencies on
the target machine. Simply ship the bundle to your production server and run it with `node`.

---

## Quick start

```bash
# Build a bundle for the current platform (auto-detected)
pnpm ts-linq migrations bundle

# Build for a specific target platform
pnpm ts-linq migrations bundle --target node-linux-x64

# Specify a custom output path
pnpm ts-linq migrations bundle --target node-linux-x64 --output dist/migrate.bundle.js
```

---

## Supported targets

| Flag value          | Platform           |
|---------------------|--------------------|
| `node-linux-x64`    | Linux x86-64       |
| `node-linux-arm64`  | Linux ARM 64-bit   |
| `node-win-x64`      | Windows x86-64     |
| `node-macos-x64`    | macOS x86-64       |
| `node-macos-arm64`  | macOS Apple Silicon|

When `--target` is omitted the current host platform is used.

---

## Running the bundle

The generated bundle reads the database connection from environment variables at runtime:

```bash
# PostgreSQL
export DATABASE_URL="postgresql://user:pass@host:5432/mydb"
export DB_PROVIDER="postgres"          # optional, defaults to "postgres"
node dist/migrate.bundle.js

# MySQL
export DATABASE_URL="mysql://user:pass@host:3306/mydb"
export DB_PROVIDER="mysql"
node dist/migrate.bundle.js

# SQL Server
export DATABASE_URL="Server=host;Database=mydb;User Id=user;Password=pass;"
export DB_PROVIDER="mssql"
node dist/migrate.bundle.js
```

---

## Requirements

esbuild must be installed in the project that runs the `migrations bundle` command:

```bash
pnpm add -D esbuild
```

The migration provider package (`@ts-linq/provider-postgres`, etc.) must be installed
on the target machine where the bundle will be executed.

---

## How it works

```mermaid
flowchart LR
  MF[Migration files\n*.ts / *.js] --> E[esbuild]
  R[MigrationRunner] --> E
  E --> B[migrate.bundle.js\n~single self-contained script]
  B -->|node| DB[(Database)]
```

1. All migration class files in the migrations directory are discovered and sorted.
2. An entry script is generated that loads the provider from `DB_PROVIDER` + `DATABASE_URL`.
3. esbuild bundles the entry script + all migrations + `MigrationRunner` into one file.
4. The output is a standard CommonJS Node.js script.

---

## Programmatic API

```typescript
import { MigrationBundleBuilder } from '@ts-linq/migrations';

const builder = new MigrationBundleBuilder();

await builder.build({
  migrationsDir: './migrations',
  outputFile: './dist/migrate.bundle.js',
  target: 'node-linux-x64',
});
```

---

## Limitations

- The bundle includes all migration files — there is no way to bundle a subset.
- Each provider package must still be installed on the target machine (they are listed as
  `external` dependencies in the bundle and resolved at runtime).
- The bundle always runs the full set of **pending** migrations. Rollback is not supported
  via bundles — use `pnpm ts-linq migration:rollback` during development instead.
