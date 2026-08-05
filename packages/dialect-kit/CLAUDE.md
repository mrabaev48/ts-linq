# CLAUDE.md — @ts-linq/dialect-kit

## Role

Shared **stateless SQL clause emitters** plus **parameter/column helpers** for the three dialects.
Holds the single source of truth for rendering `WHERE` / `JOIN` / `GROUP BY … HAVING` / `ORDER BY`
fragments, for parameter coercion (`coerceSqlParameter`, `applyConverter`), placeholder renumbering
(`numberPlaceholders`), and INSERT/UPDATE column selection (`selectInsertableColumns` /
`selectUpdatableColumns`), so dialects compose them into `buildSelect`/CRUD/`batch-syntax` instead of
copy-pasting near-identical logic.

## Hard boundaries

- Depends only on `@ts-linq/types` and `@ts-linq/sql-visitor` (for `renderJoinOn`).
- Must **not** depend on a concrete dialect, `core`, `metadata`, `query`, or `orm` — those depend
  on this. Keeps the dependency graph `dialect-* → dialect-kit → {sql-visitor, types}`, no cycles.

## Critical invariants

- **Pure functions only.** Every emitter is stateless; the sole dialect-specific concern
  (identifier quoting) is injected into `emitJoin` as `quote: (id) => string` (Strategy injection).
  Do not add dialect branching or hold dialect state here.
- **`emitGroup` guards empty columns** — never emit a dangling ` GROUP BY `. This guard is shared
  correct behavior; do not reintroduce the per-dialect drift this package removed.
- **Always parameterize.** Emitters push bound parameters onto the caller's accumulator in
  left-to-right order; never interpolate values.

## Public API surface & stability

- Public via `src/index.ts`: `emitWhere`, `emitJoin`, `emitGroup`, `emitOrder`; `coerceSqlParameter`,
  `applyConverter`, `numberPlaceholders`; `selectInsertableColumns`, `selectUpdatableColumns`,
  `InsertableColumnOptions`.
- `DialectOptionsBuilder` is the single implementation behind the per-dialect
  `PostgresOptionsBuilder`/`MysqlOptionsBuilder`/`MssqlOptionsBuilder` names, which are thin
  subclasses kept only for published-name stability. Add builder options here, never in a dialect.
- `AbstractSqlDialect.buildSelect` takes `EntityMetadata | undefined` from the caller. The base has
  **no** metadata hook — a dialect must never resolve metadata itself.
- `InsertableColumnOptions` (`excludeComputed`, `excludeGeneratedPk`) is the **policy object**: legit
  per-dialect INSERT differences are declared config, never hidden branches. All three dialects
  currently pass `{ excludeComputed: true, excludeGeneratedPk: true }`.
- Intended future home for the shared base dialect (refactor `dialect-*/task-1`).

## Validation

```bash
pnpm --filter @ts-linq/dialect-kit typecheck
pnpm --filter @ts-linq/dialect-kit lint
pnpm --filter @ts-linq/dialect-kit build
```

Changes here affect all three dialects — run their builds/tests after edits.

## Do / Don't

- **Do** keep emitters pure and inject quoting.
- **Don't** copy an emitter back into a dialect or branch on dialect identity.
