# @ts-linq/plugin-soft-delete

> Soft-delete plugin for ts-linq — turns deletes into flag updates and filters out soft-deleted
> rows.

`SoftDeleteMiddleware` implements the `OrmMiddleware` contract from `@ts-linq/types` to convert
`DELETE` operations into `UPDATE`s of a soft-delete column and to exclude soft-deleted rows from
queries.

## Installation

```bash
pnpm add @ts-linq/plugin-soft-delete
```

## What lives here

- **`SoftDeleteMiddleware`** (`SoftDeleteMiddleware.ts`) — intercepts deletes + applies a filter.
- **`types.ts`** — soft-delete options (column name, deleted value, …).
- **`utils.ts`** — helpers.

## Usage

```ts
import { SoftDeleteMiddleware } from '@ts-linq/plugin-soft-delete';
// Register with the soft-delete column configuration.
```

> **⚠️ Status:** The middleware lifecycle is **not currently invoked** by the runtime, and this
> plugin **duplicates** the soft-delete support already built into `@ts-linq/orm`. See `CLAUDE.md`.

## Package structure

```
src/
  SoftDeleteMiddleware.ts
  types.ts
  utils.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`, `@ts-linq/metadata`

## License

Part of the ts-linq monorepo. See the repository root for license details.
