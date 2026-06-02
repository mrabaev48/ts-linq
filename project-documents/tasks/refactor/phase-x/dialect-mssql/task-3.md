---
status: not-started
phase: phase-x
package: dialect-mssql
priority: P1
effort: S
risk: medium
category: sql
depends_on: ['dialect-postgres/task-4.md']
related: ['dialect-postgres/task-4.md']
---

# Refactor: Reconcile MSSQL insertable/updatable column filter divergence (missing isComputed exclusion)

## Problem
MSSQL's INSERT/batch column-selection predicate diverges from MySQL and Postgres: it does **not** exclude
computed columns from INSERT, and uses a simpler "generated unless value provided" rule that differs from the
PG/MySQL predicate (which also drops generated PKs lacking a value). This is a real behavioral inconsistency
produced by copy-paste, and it can attempt to INSERT into a computed column.

## Evidence
- MSSQL INSERT filter (no `isComputed` check): `packages/dialect-mssql/src/MssqlDialect.ts:143-145`
  `metadata.columns.filter((col) => !col.isGenerated || entity[col.propertyName] !== undefined)`.
- MSSQL batch `insertableCols` (also no `isComputed`, no PK-without-value rule):
  `packages/dialect-mssql/src/batch-syntax.ts:39-43`.
- Compare MySQL: excludes `isComputed` (`packages/dialect-mysql/src/MysqlDialect.ts:132-134`) and batch
  (`packages/dialect-mysql/src/batch-syntax.ts:33-42`).
- Compare Postgres: excludes `isComputed` and generated PK without value
  (`packages/dialect-postgres/src/PostgresDialect.ts:199-207`, `batch-syntax.ts:49-58`).
- MSSQL DDL DOES emit computed columns as `[col] AS (expr) PERSISTED` (`MssqlDdlStrategy.ts:34-44`), so
  attempting to INSERT a value into such a column is invalid SQL — the filter omission is a latent bug.

## Why this is bad
- Inserting into / updating a computed column is a SQL Server error; the divergence means MSSQL behaves
  incorrectly where PG/MySQL behave correctly.
- It is exactly the kind of silent drift that duplication causes and that the shared column-selection policy
  (host `dialect-postgres/task-4.md`) is meant to eliminate.

## Target architecture
- Adopt the shared `selectInsertableColumns(metadata, entity, policy)` from `dialect-postgres/task-4.md` with an
  explicit policy that excludes computed columns and (configurably) generated PKs without a value, applied
  uniformly to MSSQL.

## Proposed refactor
1. Replace MSSQL's two divergent filters (`MssqlDialect.ts:143`, `batch-syntax.ts:39`) with the shared function.
2. Confirm computed columns are excluded from INSERT and UPDATE SET lists on MSSQL.
3. Add a regression test: entity with a computed column → MSSQL INSERT omits it.

## Suggested design patterns
- **Policy object (parameterize from above)**. WHY: legitimate dialect differences become declared inputs, not accidental code drift.

## Testing plan
- Unit: MSSQL INSERT/UPDATE/batch with a computed column → column excluded.
- Contract: cross-dialect parity for computed-column handling (`dialect-postgres/task-6.md`).

## Acceptance criteria
- [ ] MSSQL uses the shared column-selection policy; computed columns excluded from INSERT/UPDATE.
- [ ] Parity with PG/MySQL verified by the contract suite.
- [ ] Existing MSSQL tests pass.

## Refactor order
Land as part of `dialect-postgres/task-4.md` (shared column selection), which removes the divergence by construction.

## Notes
This is the most concrete instance of the duplication-induced drift cited across the cluster; fixing it is a
direct correctness improvement, not just cleanup.
