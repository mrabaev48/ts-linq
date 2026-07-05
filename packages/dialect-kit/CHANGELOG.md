# @ts-linq/dialect-kit

## 0.2.0

### Minor Changes

- Deduplicate parameter coercion and column-selection helpers into `@ts-linq/dialect-kit`.

  `coerceSqlParameter`, `applyConverter`, `numberPlaceholders`, `selectInsertableColumns`,
  `selectUpdatableColumns` (and the `InsertableColumnOptions` policy type) are now the single source of
  truth in `@ts-linq/dialect-kit`, replacing ~6 near-identical copies previously spread across each
  dialect class and its `batch-syntax` module. Per-dialect INSERT differences are expressed as an
  explicit policy object rather than divergent code.

  **Behavioural fix (SQL Server):** computed columns are now excluded from INSERT (and UPDATE) column
  lists on the MSSQL dialect, matching the PostgreSQL and MySQL dialects. Previously MSSQL emitted the
  computed column into the INSERT list — a latent bug. Computed-column handling is now uniform across
  all three dialects.

## 0.1.0

### Minor Changes

- Collapse the per-dialect SQL clause emitters into shared pure functions and remove dead code.
  - Introduce `@ts-linq/dialect-kit` with stateless `emitWhere` / `emitJoin` / `emitGroup` /
    `emitOrder` emitters. Identifier quoting is injected into `emitJoin` (Strategy injection); the
    four functions are the single source of truth for clause rendering across dialects.
  - Remove four dead, never-called private clause methods from `PostgresDialect`
    (`buildJoins` / `buildWhereClause` / `buildGroupByHaving` / `buildOrderBy`).
  - Replace the twelve near-identical per-dialect emitter classes (Postgres/MySQL/MSSQL) with the
    shared emitters.
  - **Behavioural fix:** `GROUP BY` with an empty column list no longer emits a dangling
    `GROUP BY`. The MSSQL empty-columns guard is now shared, so Postgres and MySQL produce valid
    SQL for this edge case, matching MSSQL.
