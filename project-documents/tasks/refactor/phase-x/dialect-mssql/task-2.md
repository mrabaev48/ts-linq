---
status: not-started
phase: phase-x
package: dialect-mssql
priority: P0
effort: S
risk: high
category: sql
depends_on: []
related: ['dialect-postgres/task-3.md', 'dialect-mysql/task-2.md']
---

# Refactor: Fix MSSQL DDL raw-string-literal interpolation and unquoted CRUD identifiers (injection/correctness)

## Problem
MSSQL is the most exposed dialect for the cluster-wide quoting defect (host: `dialect-postgres/task-3.md`).
It interpolates the raw table name into SQL **string literals** without escaping single quotes, and emits
**unquoted** identifiers in CRUD — both unique to / worst-in MSSQL.

## Evidence
- Raw table name in a string literal, no `'`→`''` escaping:
  - `packages/dialect-mssql/src/MssqlDdlStrategy.ts:31`
    `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${metadata.tableName}') ...`.
  - `packages/dialect-mssql/src/MssqlDdlStrategy.ts:103`
    `EXEC sp_rename '${tableName}', '${newTableName}'`.
  - Contrast: comment SQL DOES escape (`MssqlDdlStrategy.ts:156`), proving the inconsistency.
- Unquoted identifiers in CRUD (break on reserved words / case-sensitive collations):
  - `packages/dialect-mssql/src/MssqlDialect.ts:160-162` INSERT (`INSERT INTO ${metadata.tableName} (...)`).
  - `MssqlDialect.ts:220` UPDATE, `MssqlDialect.ts:253` DELETE — table/column names unquoted.
- `quoteIdentifier` (correct `]`→`]]` escaping) exists at `MssqlDialect.ts:45` but is not used by these builders.

## Why this is bad
- A table name containing `'` produces broken SQL or, with attacker-influenced identifiers (db-first
  scaffolding via `introspector.ts`), an injection vector. Defense-in-depth is absent here while present
  elsewhere in the same file.
- Unquoted CRUD identifiers fail on reserved words and case-sensitive databases — a correctness bug, not just style.

## Target architecture
- Add `quoteStringLiteral(s)` (escape `'`→`''`) and route the `sys.tables` lookup and `sp_rename` through it.
- Route all CRUD/DDL identifiers through `quoteIdentifier` (or the injected quoter from the shared `DialectSyntax`).

## Proposed refactor
1. Add `quoteStringLiteral`; fix `MssqlDdlStrategy.ts:31` and `:103`.
2. Quote identifiers in MSSQL INSERT/UPDATE/DELETE.
3. Add regression tests with table `o'brien` and column `weird]name`.

## Suggested design patterns
- **Single Source of Truth / Facade** for quoting + literal escaping. WHY: one audited place for injection reasoning.

## Testing plan
- Regression: adversarial identifiers → correctly escaped MSSQL SQL.
- Snapshot CRUD/DDL output to lock behavior (feeds `dialect-postgres/task-6.md`).

## Acceptance criteria
- [ ] MSSQL DDL string literals escape single quotes.
- [ ] MSSQL CRUD emits quoted identifiers.
- [ ] Adversarial-identifier regression tests pass.

## Refactor order
1. `quoteStringLiteral` + DDL literal fix (highest risk). 2. CRUD identifier quoting. 3. Tests.

## Notes
P0: this is the cluster's only SQL-safety defect and MSSQL is the worst-affected. Coordinate with the host task
`dialect-postgres/task-3.md` so the quoter is centralized once.
