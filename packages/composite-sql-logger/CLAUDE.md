# CLAUDE.md — @ts-linq/composite-sql-logger

## Role

A **fan-out `SqlLogger`**: forwards every event to a list of child loggers. Plus a matching
`SqlLoggerFactory`.

## Hard boundaries

- Depends on `@ts-linq/types`; `@ts-linq/core` is a peer.
- Implements `SqlLogger` / `SqlLoggerFactory` only.

## Critical invariants & known hazards

- **Failure isolation:** one child logger throwing must not stop the others or break the query.
  Wrap each child dispatch so a faulty logger is contained (and reported), not silently dropped.
- Preserve event ordering and pass the full event payload unchanged to every child.

## Public API surface & stability

- Public via `src/index.ts` (`CompositeSqlLogger`, `CompositeSqlLoggerFactory`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/composite-sql-logger/` — robust per-child failure
isolation.

## Validation

```bash
pnpm --filter @ts-linq/composite-sql-logger typecheck
pnpm --filter @ts-linq/composite-sql-logger lint
pnpm --filter @ts-linq/composite-sql-logger build
```

## Do / Don't

- **Do** isolate each child's failures.
- **Don't** let one logger's exception break the chain or the query.
