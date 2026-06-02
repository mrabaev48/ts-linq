---
status: not-started
phase: phase-x
package: dialect-mysql
priority: P1
effort: S
risk: medium
category: sql
depends_on: ['dialect-postgres/task-3.md']
related: ['dialect-postgres/task-3.md', 'dialect-mssql/task-2.md']
---

# Refactor: MySQL CRUD unquoted identifiers and JSON-path translator quoting (centralize via shared quoter)

## Problem
Like MSSQL, MySQL CRUD emits **unquoted** table/column identifiers, and its JSON path translator hand-rolls
backtick quoting on `node.column` instead of using the dialect's escaping `quoteIdentifier`. Both bypass the
single source of truth for identifier safety (host: `dialect-postgres/task-3.md`).

## Evidence
- Unquoted CRUD identifiers (break on reserved words / case-sensitive table names):
  - `packages/dialect-mysql/src/MysqlDialect.ts:141` INSERT (`INSERT INTO ${metadata.tableName} (...)`).
  - `packages/dialect-mysql/src/MysqlDialect.ts:183` UPDATE, `:208` DELETE.
- `quoteIdentifier` (correct `` ` ``→`` `` `` escaping) defined but unused by these builders
  (`packages/dialect-mysql/src/MysqlDialect.ts:44`).
- JSON path translator hand-quotes the column with raw backticks and interpolates path segments into a JSON
  path literal without escaping: `packages/dialect-mysql/src/json/JsonPathTranslator.ts:10-12`
  (`` const col = `\`${node.column}\``; ... `(${col}->>'$.${path.join('.')}')` ``).
- The three JSON translators are structurally parallel but not sharing a base
  (`dialect-mssql/src/json/JsonPathTranslator.ts`, `dialect-postgres/src/json/JsonPathTranslator.ts`).

## Why this is bad
- Unquoted CRUD identifiers are a correctness bug on reserved words / case-sensitive collations.
- Re-deriving quoting in the JSON translator duplicates the escaping rule and risks drift; a column name with a
  backtick would break the emitted JSON access.
- SSOT violation mirrored from the host quoting task.

## Target architecture
- Route MySQL CRUD identifiers through `quoteIdentifier` (or the injected `DialectSyntax` quoter from
  `dialect-postgres/task-1.md`).
- Have the JSON path translator obtain its column quoting from the same quoter rather than inline backticks.
- Consider a small shared `JsonPathTranslator` base if the three converge after quoting is centralized.

## Proposed refactor
1. Quote identifiers in MySQL INSERT/UPDATE/DELETE.
2. Replace inline backticks in `JsonPathTranslator.translate` with the shared quoter.
3. Add regression tests for reserved-word table names and backtick-containing columns.

## Suggested design patterns
- **Single Source of Truth / Facade** for quoting. WHY: one audited escaping rule.
- **Strategy injection** of the quoter into the JSON translator. WHY: dialect-agnostic translator logic.

## Testing plan
- Regression: MySQL CRUD with a reserved-word table (`order`) → quoted output.
- Regression: JSON access on a column named with a backtick → correctly escaped.
- Contract: feeds the cross-dialect suite (`dialect-postgres/task-6.md`).

## Acceptance criteria
- [ ] MySQL CRUD emits quoted identifiers.
- [ ] JSON path translator uses the shared quoter; no inline backticks.
- [ ] Reserved-word / backtick regression tests pass.

## Refactor order
Land with the host quoting task (`dialect-postgres/task-3.md`).

## Notes
Filed under MySQL because the unquoted-CRUD and JSON-translator-quoting instances are MySQL-specific; the root
fix is the centralized quoter from the host task.
