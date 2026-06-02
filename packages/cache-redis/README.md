# @ts-linq/cache-redis

> Redis adapters for ts-linq caches (`SqlCache`, `CountCache`, `EntityCache`).

Concrete Redis-backed implementations of the ts-linq cache contracts. Works with either `ioredis`
or `redis` as the client (provided as peer dependencies).

## Installation

```bash
pnpm add @ts-linq/cache-redis
# plus one of: ioredis | redis
```

## What lives here

- **`RedisSqlCacheAdapter`** — caches SQL query results.
- **`RedisCountCacheAdapter`** — caches `count()` results.
- **`RedisEntityCacheAdapter`** — caches materialized entities.

## Usage

```ts
import Redis from 'ioredis';
import { RedisSqlCacheAdapter } from '@ts-linq/cache-redis';

const cache = new RedisSqlCacheAdapter(new Redis(process.env.REDIS_URL));
```

## Package structure

```
src/
  redis/RedisSqlCacheAdapter.ts
  redis/RedisCountCacheAdapter.ts
  redis/RedisEntityCacheAdapter.ts
  index.ts
```

## Dependencies

- `@ts-linq/core`, `@ts-linq/types`
- Peer: `ioredis`, `redis`, `typescript`

## License

Part of the ts-linq monorepo. See the repository root for license details.
