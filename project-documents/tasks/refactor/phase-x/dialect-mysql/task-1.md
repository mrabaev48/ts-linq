---
status: not-started
phase: phase-x
package: dialect-mysql
priority: P1
effort: XL
risk: high
category: architecture
depends_on: []
related: ['dialect-postgres/task-1.md', 'dialect-postgres/task-2.md', 'dialect-mssql/task-1.md']
---

# Refactor: MySQL participation in the shared base SQL dialect (Template Method + DialectSyntax)

## Problem
`MysqlDialect` is one of three ~85%-identical dialect classes. The cross-dialect refactor is authored as the
host task `dialect-postgres/task-1.md`. This sibling tracks the MySQL-specific concerns the shared base must
preserve via strategy hooks rather than inline branches.

## Evidence
- `packages/dialect-mysql/src/MysqlDialect.ts:77` `buildSelect` shares the universal skeleton but: leaves `?`
  placeholders untouched (mysql2 positional params — no `numberPlaceholders` step), throws
  `TemporalNotSupportedError` for temporal queries (`:78-83`), and uses a MySQL LIMIT/OFFSET emitter with an
  offset-without-limit hack `LIMIT 18446744073709551615 OFFSET n` (`:120-130`).
- `buildInsert` returns no RETURNING and relies on `LAST_INSERT_ID()` (batch path:
  `packages/dialect-mysql/src/batch-syntax.ts:75`); per-entity batch UPDATE because MySQL lacks a clean
  multi-row UPDATE (`batch-syntax.ts:83-119`, returns `statements[]`).
- `parameterLimit = MYSQL_PARAM_LIMIT` (65535).
- MySQL-only collaborators: `sequenceEmulation.ts` (counter-table HiLo emulation).

## Why this is bad
- These MySQL behaviors are entangled with the duplicated skeleton; without a base + hooks they keep being
  hand-maintained against the other two copies.
- The placeholder-style difference (`?` kept vs `$N`/`@pN` renumber) is precisely the kind of variation a
  `DialectSyntax` strategy should own.

## Target architecture
- Implement the shared `AbstractSqlDialect` (host task) and expose MySQL specifics via hooks:
  `renderParameterMarker` (identity — keep `?`), `renderLimitOffset` (with the offset-only hack),
  `renderReturning` (none / LAST_INSERT_ID), and a `temporalHook` that throws `TemporalNotSupportedError`.
- `DialectSyntax` carries `parameterLimit = 65535` and the `` ` `` quoter.

## Proposed refactor
1. After the host base lands, move MySQL-only fragments into the named hooks.
2. Keep `sequenceEmulation.ts` and the per-statement batch-UPDATE strategy as MySQL collaborators.
3. Reconsider the `LIMIT 18446744073709551615` offset hack (extract behind the limit hook with a comment;
   verify against current MySQL recommendation during implementation).

## Suggested design patterns
- **Template Method hook overrides** for placeholder/limit/returning/temporal. WHY: isolates real MySQL deltas.
- **Strategy** for quoting + parameter limit. WHY: data, not code branches.
- **Null Object / capability flag** for temporal (declare `temporal:false`). WHY: the throw becomes a declared capability.

## Testing plan
- Run the shared contract suite (`dialect-postgres/task-6.md`) against `MysqlDialect`.
- Keep `tests-new/dialect/MysqlDialect.test.ts` and `MysqlBatchSyntax.test.ts` green.
- Snapshot LIMIT/OFFSET (including offset-only) and per-statement batch UPDATE output.

## Acceptance criteria
- [ ] `MysqlDialect` extends the shared base; only MySQL hooks remain.
- [ ] `?` markers preserved (no renumber); offset-only LIMIT hack and `LAST_INSERT_ID` flow preserved.
- [ ] `TemporalNotSupportedError` retained; MySQL declares `temporal:false` in the capability model.
- [ ] Contract + existing MySQL tests pass.

## Refactor order
Follow `dialect-postgres/task-1.md`; migrate MySQL after Postgres because of the placeholder-style and
batch-UPDATE deltas.

## Notes
MySQL keeps `?` while MSSQL/PG renumber — the placeholder rendering step is the cleanest example of why the
parameter marker belongs in `DialectSyntax`.
