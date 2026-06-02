# CLAUDE.md — @ts-linq/cache-redis

## Role

**Redis adapters** implementing the ts-linq cache contracts (SQL/Count/Entity caches).

## Hard boundaries

- Depends on `core`, `types`. Redis clients (`ioredis`/`redis`) are **peer** deps — never hard-import
  them in a way that forces a dependency on consumers who use the other client.
- Implements the cache contracts from `@ts-linq/cache` — don't define parallel interfaces.

## Critical invariants & known hazards

- **Fail-open:** a Redis error (timeout, disconnect) must degrade to a cache miss → DB query, never
  throw into the query path.
- Serialize/deserialize consistently with the Memcached adapter so cached shapes are
  backend-agnostic; share that logic via a base where possible.
- Respect TTL / key derivation from `CachePolicy` exactly.

## Public API surface & stability

- Public via `src/index.ts` (the three Redis adapters). Constructor accepts the client instance
  (DI) — keep it client-agnostic across `ioredis`/`redis`.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/cache-redis/` — shared cache-adapter base, canonical
interface alignment, peer-dep handling.

## Validation

```bash
pnpm --filter @ts-linq/cache-redis typecheck
pnpm --filter @ts-linq/cache-redis lint
pnpm --filter @ts-linq/cache-redis build
```

## Do / Don't

- **Do** accept the Redis client via constructor (DI); fail open on backend errors.
- **Don't** hard-couple to one client library or duplicate cache interfaces.
