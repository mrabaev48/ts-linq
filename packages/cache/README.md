# @ts-linq/cache

> Caching abstractions for ts-linq: cache policy and the entity-cache contract.

This package defines the cache-policy model and `EntityCache` abstraction used by the query layer
and the concrete cache adapters (`@ts-linq/cache-redis`, `@ts-linq/cache-memcached`).

## Installation

```bash
pnpm add @ts-linq/cache
# requires @ts-linq/core as a peer
```

## What lives here

- **`CachePolicy`** (`CachePolicy.ts`) — TTL / invalidation / keying policy for cached results.
- **`EntityCache`** (`EntityCache.ts`) — the entity-cache contract that adapters implement.

## Usage

```ts
import { CachePolicy } from '@ts-linq/cache';
// Use with @CachePolicy decorator / query caching, backed by a concrete adapter.
```

## Package structure

```
src/
  CachePolicy.ts
  EntityCache.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`, `@ts-linq/metrics-safe`
- `@ts-linq/core` (peer)

## License

Part of the ts-linq monorepo. See the repository root for license details.
