# @ts-linq/dialect-kit

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
