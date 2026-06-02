# CLAUDE.md — @ts-linq/query

## Role

The fluent **query layer**: `Queryable` chain, execution pipeline, `EF` helpers, materialization,
caching, and fallbacks. Sits on `core` + `sql-visitor`; consumed by `orm`.

## Hard boundaries

- Depends on `types`, `metrics-safe`, `ast`, `sql-visitor`, `core`, `metadata`.
- Must **not** depend on `orm`, dialects, or providers directly.
- Public surface is `.`; internal collaborators go through `./internal` and are **not** stable.
  Keep implementation detail out of the main barrel.

## Critical invariants & known hazards

- **`Queryable` must be immutable.** Each operator returns a new instance; mutating shared state
  causes an aliasing bug where two derived queries interfere (refactor `task-2`, P0). Never mutate
  `this` in an operator.
- **Wire `SqlVisitorOptions` through the whole `where`/`having` path.** Today converters/options
  are partially dropped, so value converters are silently ignored in predicates (refactor
  `task-4`, P0). 
- **No raw SQL assembly in `Queryable`.** SQL string building must live in the dialect, not here
  (refactor `task-6`, P0).
- **Global query filters must not be silently dropped** — a swallowed filter can leak rows across
  tenants/soft-deletes. Surface filter-application failures.
- `Queryable` is a **god class (~1812 LOC)** — the largest in the repo. Add collaborators, don't
  grow it (refactor `task-1`, P0).

## Public API surface & stability

- `src/index.ts` is the contract; `src/internal/index.ts` is explicitly unstable.
- Preserve generic inference across the chain — every operator must thread the element type. Avoid
  widening to `any`/`unknown` mid-chain.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/query/` (4× P0): decompose `Queryable`, fix
immutability/aliasing, wire `SqlVisitorOptions`, move SQL assembly to dialect.

## Validation

```bash
pnpm --filter @ts-linq/query typecheck
pnpm --filter @ts-linq/query lint
pnpm --filter @ts-linq/query build
```

## Do / Don't

- **Do** return new `Queryable` instances from operators (immutability).
- **Do** thread `SqlVisitorOptions`/converters end-to-end.
- **Don't** assemble dialect SQL strings here.
- **Don't** leak internal classes through the main barrel.
