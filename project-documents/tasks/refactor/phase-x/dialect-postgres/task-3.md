---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P0
effort: M
risk: high
category: sql
depends_on: []
related: ['dialect-mssql/task-2.md', 'dialect-mysql/task-2.md']
---

# Refactor: Centralize identifier quoting; stop hand-rolling/bypassing quote chars in DML & DDL

## Problem
Every dialect exposes a correct, escaping `quoteIdentifier()` — but its own
INSERT/UPDATE/DELETE/batch/DDL builders **do not call it**. They hardcode the quote character inline
and, in MSSQL/MySQL CRUD, **omit quoting entirely**. The escaping logic that prevents identifier-break-out
is centralized in exactly one place that the SQL generators never use.

## Evidence
- Correct escaping defined but unused internally:
  - `PostgresDialect.ts:48` `quoteIdentifier` escapes `"`→`""`.
  - `MssqlDialect.ts:45` escapes `]`→`]]`. `MysqlDialect.ts:44` escapes `` ` ``→`` `` ``.
  - Internal usage grep shows `quoteIdentifier` is only ever called by `query`/`provider` packages, never inside the dialect builders.
- MSSQL CRUD emits **unquoted** identifiers: `MssqlDialect.ts:160-162` (`INSERT INTO ${metadata.tableName} (${columnNames.join(', ')})`), `:220` UPDATE, `:253` DELETE.
- MySQL CRUD also unquoted: `MysqlDialect.ts:141` INSERT, `:183` UPDATE, `:208` DELETE.
- Postgres CRUD hardcodes `"..."` without using the escaping helper: `PostgresDialect.ts:208,213,233,252,287`.
- Batch builders hardcode quotes too: `dialect-postgres/src/batch-syntax.ts:86,134` (`"`), `dialect-mssql/src/batch-syntax.ts:72,118` (`[]`).
- DDL hardcodes quotes and, worse, interpolates the **raw table name into string literals** without escaping single quotes:
  - `MssqlDdlStrategy.ts:31` `... WHERE name = '${metadata.tableName}'` (no `'`→`''`).
  - `MssqlDdlStrategy.ts:107` `EXEC sp_rename '${tableName}', '${newTableName}'` (no escaping).
  (Comment SQL at `MssqlDdlStrategy.ts:160` does escape `'`, proving the inconsistency.)

## Why this is bad
- A column/table name containing the dialect's quote char (or, for MSSQL, a single quote) produces broken or
  ambiguous SQL — and is a defense-in-depth gap. While names are normally developer-controlled, db-first
  scaffolding (`introspector.ts`) and dynamic models can surface arbitrary DB identifiers.
- MSSQL/MySQL unquoted identifiers break on reserved words and case-sensitive collations.
- Inconsistency (Postgres quotes, MSSQL/MySQL do not) is a correctness landmine across providers.
- SSOT violation: escaping rules live in `quoteIdentifier` but are re-derived (incorrectly) everywhere else.

## Target architecture
Single-responsibility **identifier rendering service** used by ALL SQL generation:
- All DML/DDL/batch builders MUST route identifiers through the dialect's `quoteIdentifier` (or a shared
  `IdentifierQuoter` injected via the `DialectSyntax` strategy from task-1).
- DDL string-literal interpolation (MSSQL `sys.tables` lookup, `sp_rename`) MUST use a dedicated
  `quoteStringLiteral()` that escapes `'`→`''`.

## Proposed refactor
1. Add `quoteStringLiteral(s)` to each dialect (escape `'`).
2. Replace every inline quote (``[`"``) and every raw `${tableName}` in DML/DDL/batch with `quoteIdentifier`/`quoteStringLiteral`.
3. Quote identifiers in MSSQL/MySQL CRUD where currently omitted.
4. Add regression tests with identifiers containing the quote char and a single quote.

## Suggested design patterns
- **Single Source of Truth / Facade** for quoting. WHY: one audited place to reason about injection and reserved words.
- **Strategy injection** of the quoter (ties into task-1 `DialectSyntax`). WHY: emitters stay dialect-agnostic.

## Testing plan
- Regression: entity with column `` `weird"name]` ``, table `o'brien` → assert generated SQL is correctly escaped per dialect.
- Snapshot CRUD output for all three dialects to lock quoting behavior (feeds contract test, task-6).

## Acceptance criteria
- [ ] No inline quote characters or raw `${tableName}` remain in DML/DDL/batch builders; all go through helpers.
- [ ] MSSQL/MySQL CRUD now emit quoted identifiers.
- [ ] MSSQL DDL string literals escape single quotes.
- [ ] Regression tests for adversarial identifiers pass on all three dialects.

## Refactor order
1. Add `quoteStringLiteral`. 2. Fix MSSQL DDL literals (highest risk). 3. Route DML/batch through quoter. 4. Add quoting to MSSQL/MySQL CRUD. 5. Tests.

## Notes
P0 because it is the only SQL-safety/correctness finding in the cluster and it is inconsistent across dialects.
Cross-dialect; sibling stubs link here. Best landed AFTER or together with task-1 so the quoter is injected once.
