# @ts-linq/plugin-audit

> Audit-logging plugin for ts-linq — records who changed what and when via the ORM middleware
> lifecycle.

`AuditMiddleware` implements the `OrmMiddleware` contract from `@ts-linq/types` to capture entity
changes (create/update/delete) for audit trails.

## Installation

```bash
pnpm add @ts-linq/plugin-audit
```

## What lives here

- **`AuditMiddleware`** (`AuditMiddleware.ts`) — `OrmMiddleware` that hooks entity-change events.
- **`types.ts`** — audit options/types.
- **`utils.ts`** — helpers.

## Usage

```ts
import { AuditMiddleware } from '@ts-linq/plugin-audit';
// Register on the DbContext middleware pipeline.
```

> **⚠️ Status:** The ORM middleware lifecycle hooks this plugin targets are **not currently invoked**
> by the runtime. See `CLAUDE.md` and the refactor tasks before relying on this in production.

## Package structure

```
src/
  AuditMiddleware.ts
  types.ts
  utils.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`, `@ts-linq/metadata`

## License

Part of the ts-linq monorepo. See the repository root for license details.
