# CLAUDE.md — @ts-linq/cache-memcached

## Role

**Memcached adapters** implementing the ts-linq cache contracts (SQL/Count/Entity caches).

## Hard boundaries

- Depends on `core`, `types`. `memjs` is a **peer** dependency.
- Implements the cache contracts from `@ts-linq/cache` — don't define parallel interfaces.

## Critical invariants & known hazards

- **Fail-open:** a Memcached error must degrade to a cache miss → DB query, never throw into the
  query path.
- Memcached has value-size and TTL limits — guard large payloads and respect server TTL semantics.
- Keep serialization compatible with the Redis adapter; share via a base where possible.

## Public API surface & stability

- Public via `src/index.ts` (the three Memcached adapters). Client injected via constructor (DI).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/cache-memcached/` — shared cache-adapter base and
canonical interface alignment.

## Validation

```bash
pnpm --filter @ts-linq/cache-memcached typecheck
pnpm --filter @ts-linq/cache-memcached lint
pnpm --filter @ts-linq/cache-memcached build
```

## Do / Don't

- **Do** inject the `memjs` client; fail open; respect size/TTL limits.
- **Don't** duplicate cache interfaces or hard-import the client at module scope.
