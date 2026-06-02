# CLAUDE.md — @ts-linq/cache

## Role

Caching **abstractions**: `CachePolicy` + `EntityCache` contract. The concrete backends live in
`cache-redis` / `cache-memcached`; the in-memory SQL/count caches live in `query`.

## Hard boundaries

- Depends on `types`, `metrics-safe`; `core` is a peer.
- This package owns the **canonical cache interfaces** — adapters must implement these, not invent
  parallel ones.

## Critical invariants & known hazards

- Keep the cache interface **single-sourced** here so Redis/Memcached adapters and the `query`
  caches all agree. Avoid drift between `EntityCache` here and the `SqlCache`/`CountCache` shapes in
  `query`.
- Cache reads must be **fail-open**: a cache backend error should fall back to the database, not
  break the query.

## Public API surface & stability

- Public via `src/index.ts` (`CachePolicy`, `EntityCache`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/cache/` — shared adapter base + canonical interface
consolidation across the cache packages.

## Validation

```bash
pnpm --filter @ts-linq/cache typecheck
pnpm --filter @ts-linq/cache lint
pnpm --filter @ts-linq/cache build
```

## Do / Don't

- **Do** define cache contracts here once; have adapters implement them.
- **Don't** duplicate cache interfaces in adapters or `query`.
