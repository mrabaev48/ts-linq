# @ts-linq/cache-memcached

> Memcached adapters for ts-linq caches (`SqlCache`, `CountCache`, `EntityCache`).

Concrete Memcached-backed implementations of the ts-linq cache contracts, using `memjs` as the
client (peer dependency).

## Installation

```bash
pnpm add @ts-linq/cache-memcached
# plus: memjs
```

## What lives here

- **`MemcachedSqlCacheAdapter`** — caches SQL query results.
- **`MemcachedCountCacheAdapter`** — caches `count()` results.
- **`MemcachedEntityCacheAdapter`** — caches materialized entities.

## Usage

```ts
import { Client } from 'memjs';
import { MemcachedSqlCacheAdapter } from '@ts-linq/cache-memcached';

const cache = new MemcachedSqlCacheAdapter(Client.create());
```

## Package structure

```
src/
  memcached/MemcachedSqlCacheAdapter.ts
  memcached/MemcachedCountCacheAdapter.ts
  memcached/MemcachedEntityCacheAdapter.ts
  index.ts
```

## Dependencies

- `@ts-linq/core`, `@ts-linq/types`
- Peer: `memjs`, `typescript`

## License

Part of the ts-linq monorepo. See the repository root for license details.
