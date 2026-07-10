# @ts-linq/dialect-kit

## 0.4.1

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.11.0
  - @ts-linq/sql-visitor@4.3.7

## 0.4.0

### Minor Changes

- refactor(dialect): shared `DdlStrategy` contract + `AbstractDdlStrategy` (Template Method)

  Introduce a shared DDL-generation contract and hoist the triplicated CREATE TABLE / ALTER / FK /
  constraint / comment algorithm out of the three dialect DDL strategy classes.
  - **`@ts-linq/types`** (minor): new `DdlStrategy`, `TypeMapper`, `ForeignKeySpec`, and
    `CreateIndexSpec` interfaces — the contract migrations/scaffolding/providers depend on instead of
    concrete classes (Dependency Inversion; a missing method is now a compile error).
  - **`@ts-linq/dialect-kit`** (minor): new `AbstractDdlStrategy` (Template Method) owning the invariant
    DDL algorithm, parameterized by a per-dialect `TypeMapper` (Strategy) + the task-3 quoting helpers +
    divergent hooks. Also relocates `formatValue` here from `@ts-linq/core`'s `SqlHelper`, removing the
    dialect→core dependency-direction smell in the DDL surface.
  - **`@ts-linq/dialect-postgres` / `dialect-mysql` / `dialect-mssql`** (patch): each concrete strategy
    now `extends AbstractDdlStrategy implements DdlStrategy`, reduced to a `TypeMapper` + divergent
    hooks. No SQL output change (byte-verified). The COMMENT-in-column-definition drift is reconciled
    structurally: the shared skeleton is comment-free and MySQL's inline comment is an explicit,
    documented dialect hook.
  - **`@ts-linq/core`** (patch): `DdlStrategy` now re-exports from `@ts-linq/types` (backward compatible;
    `DdlBuilder` and the public `core` surface are unchanged).

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.10.0
  - @ts-linq/sql-visitor@4.3.6

## 0.3.0

### Minor Changes

- Introduce a shared base SQL dialect (Template Method + injected `DialectSyntax` Strategy) to
  eliminate the ~85% cross-dialect DML/SELECT duplication.

  `@ts-linq/dialect-kit` gains two new public exports: `AbstractSqlDialect` (owns the invariant
  clause-ordering and parameter-collection algorithms for `buildSelect`/`buildInsert`/`buildUpdate`/
  `buildDelete`/`buildBulkUpdate`/`buildBulkDelete`) and the `DialectSyntax` interface (plus the
  `InsertDecoration` helper type). `DialectSyntax` captures the only three variation axes — identifier
  quoting, parameter-marker renumbering, and LIMIT/OFFSET/SELECT-head syntax — as injectable policy.

  `@ts-linq/dialect-postgres`, `@ts-linq/dialect-mysql`, and `@ts-linq/dialect-mssql` are internally
  restructured to extend `AbstractSqlDialect`, each reduced to a `DialectSyntax` wiring plus a few
  divergent hooks (temporal support, CTE prefix, `RETURNING`/`OUTPUT` write-back). Exported class
  names and the `SqlDialect` shape are unchanged, and SQL output is byte-identical (guarded by the
  shared contract-test harness and per-dialect golden snapshots). One latent bug is fixed as a side
  effect: MySQL's `buildUpdate` now consistently rejects an empty updatable-column set (as PostgreSQL
  and SQL Server already did) instead of emitting invalid `SET  WHERE` SQL.

## 0.2.1

### Patch Changes

- Fail fast on unserializable SQL parameters instead of writing corrupt `"[object Object]"`.

  **`@ts-linq/types`** adds a new `ParameterCoercionError` (extends the canonical `OrmError`) with a
  new stable `OrmErrorCode.ParameterCoercion` (`'PARAMETER_COERCION_ERROR'`) literal. It carries the
  offending column/property identifier in `details.property` and preserves the original serialization
  failure via `cause`.

  **`@ts-linq/dialect-kit`** — the shared `coerceSqlParameter` no longer swallows a `JSON.stringify`
  failure and silently degrades to `String(value)` (which bound a corrupt `"[object Object]"` SQL
  parameter with no diagnostic — a programmer error turning into silent data corruption). A
  non-serializable value (e.g. a circular reference) now throws `ParameterCoercionError` with the
  property identifier and `cause`. `bigint` is handled explicitly (rendered as its decimal string)
  before the JSON path, preserving prior behavior for that value. The happy path (primitives, `Date`,
  `Uint8Array`, plain objects/arrays → JSON) is unchanged. `coerceSqlParameter` gains an optional
  `property?: string` argument used to enrich the thrown error's context.

- Updated dependencies
  - @ts-linq/types@4.9.0
  - @ts-linq/sql-visitor@4.3.5

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
