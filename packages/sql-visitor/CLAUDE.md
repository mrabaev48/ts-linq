# CLAUDE.md — @ts-linq/sql-visitor

## Role

Shared **SQL-generation engine**. Walks `@ts-linq/ast` nodes and emits parameterized SQL,
delegating all dialect specifics (quoting, function names, JSON paths, parameter style) to
injected ports.

## Hard boundaries

- Depends only on `@ts-linq/ast` and `@ts-linq/types`.
- Must **not** depend on a concrete dialect, `core`, `query`, or `orm`. Dialects depend on this.
- All dialect-specific behavior must arrive via ports (`EfFunctionTranslator`,
  `JsonPathTranslator`, `ColumnResolver`, `ConverterResolver`) — never `if (dialect === 'pg')`.

## Critical invariants

- **Always parameterize.** Values go through `ParameterState`; never interpolate a value into the
  SQL string. Identifiers must be quoted by the dialect, not concatenated raw.
- **Parameter numbering must be consistent** across the whole rendered statement — a single
  `ParameterState` instance owns the counter; do not reset it mid-statement.
- The visitor contract must stay uniform across node visitors (see refactor task on dispatch
  unification).

## Public API surface & stability

- Public via `src/index.ts` (named exports). `SqlVisitor` + `SqlVisitorOptions` and the resolver
  ports are the primary contract for dialects and `query`.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/sql-visitor/`:
- `task-1` — unify the visitor contract + introduce a dispatch registry instead of ad-hoc wiring.
- `task-2` — fix parameter-state numbering edge cases.

## Validation

```bash
pnpm --filter @ts-linq/sql-visitor typecheck
pnpm --filter @ts-linq/sql-visitor lint
pnpm --filter @ts-linq/sql-visitor build
```

Changes here affect all three dialects and `query` — run their builds/tests after edits.

## Do / Don't

- **Do** route every value through the parameter state and every identifier through a resolver.
- **Don't** hardcode a dialect's syntax; add a port and let the dialect implement it.
- **Don't** duplicate the `JsonPathNode` type — import it from `@ts-linq/ast`.
