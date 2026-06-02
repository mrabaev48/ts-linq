# CLAUDE.md — @ts-linq/prometheus-sql-logger

## Role

Optional **`SqlLogger`** that records SQL execution metrics as Prometheus time-series.

## Hard boundaries

- Depends on `@ts-linq/types`; `@ts-linq/core` is a peer.
- Implements the `SqlLogger` contract; no other ORM internals.

## Critical invariants & known hazards

- **Bounded label cardinality (P0).** Today metric labels are derived from arbitrary parsed SQL,
  which creates unbounded time-series and can OOM the metrics backend (refactor `task-1`, P0). Only
  label by bounded dimensions (operation, table-from-metadata, status). Never label by raw SQL,
  parameter values, or free-form strings.
- **`PrometheusSqlLogger` is a god class (~663 LOC)** — decompose (refactor `task-3`).
- Never throw into the query path; isolate metrics failures.

## Public API surface & stability

- Public via `src/index.ts` (`PrometheusSqlLogger`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/prometheus-sql-logger/` (1× P0 cardinality +
decomposition).

## Validation

```bash
pnpm --filter @ts-linq/prometheus-sql-logger typecheck
pnpm --filter @ts-linq/prometheus-sql-logger lint
pnpm --filter @ts-linq/prometheus-sql-logger build
```

## Do / Don't

- **Do** use a fixed, bounded label set.
- **Don't** label metrics with SQL text, parameters, or unbounded values.
- **Don't** throw from the logger.
