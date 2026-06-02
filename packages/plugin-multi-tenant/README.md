# @ts-linq/plugin-multi-tenant

> Multi-tenancy plugin for ts-linq — automatically scopes queries to the current tenant.

`MultiTenantMiddleware` implements the `OrmMiddleware` contract from `@ts-linq/types` to inject a
tenant filter into queries so each tenant only sees its own rows.

## Installation

```bash
pnpm add @ts-linq/plugin-multi-tenant
```

## What lives here

- **`MultiTenantMiddleware`** (`MultiTenantMiddleware.ts`) — resolves the current tenant and applies
  a tenant filter.
- **`types.ts`** — `MultiTenantOptions` (tenant column, resolver, …).
- **`utils.ts`** — helpers.

## Usage

```ts
import { MultiTenantMiddleware } from '@ts-linq/plugin-multi-tenant';
// Register with a tenant resolver and the tenant id column.
```

> **⚠️ Status & security:** The middleware lifecycle this plugin targets is **not currently invoked**
> by the runtime, and the current filter construction has a **SQL-injection vulnerability**. Do not
> use in production until the refactor tasks land. See `CLAUDE.md`.

## Package structure

```
src/
  MultiTenantMiddleware.ts
  types.ts
  utils.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`, `@ts-linq/metadata`

## License

Part of the ts-linq monorepo. See the repository root for license details.
