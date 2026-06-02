---
status: not-started
phase: phase-x
package: provider-mysql
priority: P2
effort: S
risk: medium
category: sql
depends_on: ["provider-mssql/task-5.md"]
related: ["provider-mssql/task-5.md", "provider-postgres/task-5.md"]
---

# Refactor: Move MySQL `ON DUPLICATE KEY UPDATE` upsert SQL into the dialect (with quoted identifiers)

## Problem
`MySqlProvider.upsert` hand-builds `INSERT ... ON DUPLICATE KEY UPDATE` by string concatenation
inside the provider, with **unquoted** table and column identifiers — a SQL-safety and
layering problem identical in spirit to the MSSQL MERGE issue.

## Evidence
- `packages/provider-mysql/src/MySqlProvider.ts:224-246` — `upsert`.
- `:234` `names = insertable.map((c) => c.columnName)` (unquoted), `:243` `INSERT INTO ${metadata.tableName} (...) ... ON DUPLICATE KEY UPDATE ${updateSet}` (table + `VALUES(col)` unquoted).
- Params built without the coercer (`:236-238`), so geometry/JSON values are not encoded on upsert (also noted in task-2).

## Why this is bad
- SQL generation belongs in `@ts-linq/dialect-mysql`, not the provider (separation of concerns).
- Unquoted identifiers break (or worse) for reserved-word / special-char columns.
- Duplicates column-classification logic the dialect already has.

## Target architecture
Add `buildUpsert(entity, metadata)` to the MySQL dialect using its `quoteIdentifier` + column
helpers (Builder pattern); provider calls it, routes params through the shared coercer, and
executes. Guard with `supportsUpsert` capability (task-4).

## Proposed refactor
1. Implement `buildUpsert` in dialect-mysql.
2. Replace the provider body with a single dialect call + coerced params + execute.

## Suggested design patterns
- **Builder**, **Template Method/Strategy** (per-dialect upsert syntax).

## Testing plan
- Unit (dialect): snapshot generated SQL incl. quoted identifiers + reserved-word column.
- Provider: upsert round-trip via the contract suite (task-6).

## Acceptance criteria
- [ ] No raw upsert SQL concatenation in `MySqlProvider`.
- [ ] Identifiers are quoted by the dialect.
- [ ] Upsert params go through the coercer.
- [ ] Dialect snapshot tests cover the upsert SQL.

## Refactor order
Depends on `provider-mssql/task-5.md` (pattern) and `task-2.md` (coercer); after task-4.

## Notes
See anchor `provider-mssql/task-5.md`.
