# dialect-postgres/task-1 — Shared base SQL dialect (✅ completed)

**Branch:** `audit-refactor/dialect-shared-base-dialect`. P1 / XL / high-risk — keystone dedup of the dialects cluster.

## What landed
- New in `@ts-linq/dialect-kit` (`src/dialect/`):
  - `AbstractSqlDialect implements SqlDialect` (Template Method) — owns invariant clause-ordering + parameter collection for `buildSelect/buildInsert/buildUpdate/buildDelete/buildBulkUpdate/buildBulkDelete`, plus `quoteIdentifier`/`quoteStringLiteral`. Reuses shared emitters (`emitJoin/emitWhere/emitGroup/emitOrder`) + `selectInsertable/UpdatableColumns` + `coerceSqlParameter/applyConverter`.
  - `DialectSyntax` (Strategy) — the 3 variation axes only: `quote`, `quoteStringLiteral`, `renumberPlaceholders`, `renderSelectHead`, `renderLimitOffset(options,hasOrderBy)`, `insertColumnSeparator`.
  - `InsertDecoration` type ({ output?, returning?, returningPk? }).
  - Exported from `dialect-kit/src/index.ts`. Version 0.2.1 → **0.3.0 (minor)**.
- Protected hooks on the base (only genuinely divergent bits):
  - `getEntityMetadata(entityClass)` — **abstract**; each concrete returns `MetadataStorage.getEntity` (kept in concretes so dialect-kit does NOT depend on `@ts-linq/metadata`; metadata injection deferred to task-8).
  - `assertTemporalSupported` — default no-op; PG/MySQL override → throw `TemporalNotSupportedError` (called first in buildSelect, so throws even for rawSqlSource).
  - `renderTemporal(options,params)` — default ''; MSSQL override → `buildTemporalClause` (metadata branch only).
  - `applyCtePrefix(query,options)` — default identity; PG override → `WITH … AS (…) ` prefix.
  - `getInsertDecoration(metadata)` — default {}; PG → `{ returning: ' RETURNING *' }`; MSSQL → `{ output: ' OUTPUT INSERTED.<pk> AS id', returningPk }` when PK generated.
- Concrete dialects reduced to `DialectSyntax` wiring (moved to per-dialect `src/syntax.ts`) + hooks; class files now **PostgresDialect 98 / MysqlDialect 88 / MssqlDialect 100** lines (< 120 target). Removed all duplicated build*/buildSelectHead/collectSelectParams/buildLimitOffset/buildFromClause/applyCte/buildOffsetFetch + per-dialect INSERT_POLICY (now base default `{excludeComputed:true, excludeGeneratedPk:true}`).

## No-SQL-output-change proof
- task-6 contract harness (`runSqlDialectContract`) + per-dialect `dialect-contract.golden.ts` (byte-equality) — **unchanged**, all green.
- Key equivalence: unified buildUpdate/Insert builds `?` placeholders then `syntax.renumberPlaceholders` → byte-identical to PG's old manual `$N` inline (verified vs golden `version` case). PG INSERT separator `,` (no space) preserved via `insertColumnSeparator`.
- New unit test: `dialect-kit/tests-new/AbstractSqlDialect.test.ts` (fake DialectSyntax — clause order, SELECT-params-before-FROM, INSERT decoration/separator, unified empty-update guard).

## One intentional behavior change (approved)
- MySQL `buildUpdate` now throws on empty updatable columns (latent bug: previously emitted invalid `SET  WHERE`), matching PG/MSSQL. Untested edge path; documented in changeset/PR.

## Validation (all green)
typecheck 33/33 · lint 0 errors · build 33/33 · arch:cycles ✔ no cycles (base does NOT import concretes) · arch:deps ✔ no violations · arch:dead clean · **test:all: unit + integration + e2e (290 e2e vs real PG/MySQL/MSSQL) all pass**.

## Feeds
- task-7 (shared `DdlStrategy` mirrors this for DDL) · task-2 (capability model replacing optional `SqlDialect` methods) · task-8 (inject metadata into buildSelect, remove concrete `getEntityMetadata` duplication).

Changeset: dialect-kit minor; dialect-postgres/mysql/mssql patch (2.8.11). dialect-postgres stays 🔄 In Progress (tasks 7, 2, 8 pending).
