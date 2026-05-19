# ISSUE-008: CLI Eagerly Imports All Three Database Providers

## Severity

High

## Category

- Dependency Boundary
- Build/Tooling
- Maintainability

## Location

- `packages/cli/src/provider-factory.ts`
- `packages/cli/package.json`

## Problem

`packages/cli/src/provider-factory.ts` statically imports all three database provider packages at the top of the module:

```ts
import { PostgresProvider } from '@ts-linq/provider-postgres';
import { MySqlProvider } from '@ts-linq/provider-mysql';
import { MssqlProvider } from '@ts-linq/provider-mssql';
```

This means every CLI invocation — regardless of which database the user has configured — loads all three providers, their respective dialect packages, and all native database drivers (`pg`, `mysql2`, `mssql`) into the process.

Each provider transitively depends on a native driver with compiled binaries. A user who only uses PostgreSQL must still have `mysql2` and `mssql` installed (or the CLI will fail to start), and the CLI startup time is inflated by loading three providers when one is needed.

## Evidence

`packages/cli/src/provider-factory.ts:8-10`:
```ts
import { PostgresProvider } from '@ts-linq/provider-postgres';
import { MySqlProvider } from '@ts-linq/provider-mysql';
import { MssqlProvider } from '@ts-linq/provider-mssql';
```

The function `createProviderFromEnv()` dispatches on `process.env.DB_PROVIDER` but all three imports are already evaluated before any runtime check occurs.

`packages/cli/package.json` lists all three providers as direct `dependencies` (not `devDependencies`), confirming they are bundled into the published CLI.

## Why It Matters

- **Installation size**: All three native database drivers are required transitive dependencies, even for single-DB projects.
- **Startup latency**: Loading three providers at module initialization adds unnecessary startup time to every CLI command.
- **Coupling**: CLI design implies that providers are pluggable, yet the current implementation hardcodes all three.
- **Maintenance**: Adding a fourth provider (e.g., SQLite) requires modifying `provider-factory.ts` core logic.

## Recommended Fix

Use dynamic imports to load only the requested provider:

```ts
export async function createProviderFromEnv(): Promise<DatabaseProvider> {
  const kind = (process.env.DB_PROVIDER || 'postgres').toLowerCase();
  if (isPg(kind)) {
    const { PostgresProvider } = await import('@ts-linq/provider-postgres');
    return createPg(PostgresProvider);
  }
  if (kind === 'mysql') {
    const { MySqlProvider } = await import('@ts-linq/provider-mysql');
    return createMy(MySqlProvider);
  }
  // ...
}
```

Alternatively, accept a provider class as a parameter and let the CLI entry point import the correct provider based on configuration.

## Acceptance Criteria

- `packages/cli/src/provider-factory.ts` contains no static top-level imports of provider packages.
- Each provider package is loaded only when `DB_PROVIDER` matches its type.
- `packages/cli/package.json` moves provider packages to `optionalDependencies` or `peerDependencies`.
- CLI starts without error in an environment where only one native driver is installed.
